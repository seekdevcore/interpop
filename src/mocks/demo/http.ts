/**
 * Utilidades HTTP dos handlers do demo: rotas com latência, sessão/permissão
 * no formato do DRF, paginação PageNumberPagination e leitura de corpo
 * JSON ou multipart.
 *
 * Mensagens: pt-BR literais do DRF 3.17 / Django 5.1 (LANGUAGE_CODE pt-br),
 * para a tela mostrar exatamente o que mostraria contra o backend real.
 */
import {
  delay,
  http,
  HttpResponse,
  type DefaultBodyType,
  type HttpResponseResolver,
  type PathParams,
} from 'msw';
import { demoDb } from './db';
import type { DemoUser } from './fixtures';

export const MSG = {
  notAuthenticated: 'As credenciais de autenticação não foram fornecidas.',
  forbidden: 'Você não tem permissão para executar essa ação.',
  banned: 'Sua conta foi suspensa.',
  required: 'Este campo é obrigatório.',
  // sic: tradução do DRF 3.17.1 (rest_framework/locale/pt_BR)
  blank: 'Este campo pode não estar em branco.',
  minLength: (n: number) =>
    `Certifique-se de que este campo tenha mais de ${n} caracteres.`,
  invalidEmail: 'Insira um endereço de email válido.',
  invalidUuid: 'Deve ser um UUID válido.',
  invalidPage: 'Página inválida.',
  invalidPk: (id: string) => `Pk inválido "${id}" - objeto não existe.`,
  notFound: (model: string) => `No ${model} matches the given query.`,
  maxLength: (n: number) =>
    `Certifique-se de que este campo não tenha mais de ${n} caracteres.`,
} as const;

const API = '*/api/v1';

type Method = 'get' | 'post' | 'patch' | 'delete';

/**
 * Registra uma rota sob `* /api/v1` (qualquer origem). Toda rota ganha
 * latência realista (`delay()`: 100–400 ms no navegador, ~0 no Node dos
 * testes) e, se não for GET, salva o banco depois de responder.
 */
export function route<P extends PathParams = PathParams>(
  method: Method,
  path: string,
  resolver: HttpResponseResolver<P, DefaultBodyType, DefaultBodyType>,
) {
  return http[method]<P>(`${API}${path}`, async (info) => {
    await delay();
    const res = await resolver(info);
    if (method !== 'get') demoDb.save();
    return res;
  });
}

export const json = (data: unknown, status = 200) =>
  HttpResponse.json(data as DefaultBodyType, { status });
export const detail = (message: string, status: number) =>
  json({ detail: message }, status);
export const fieldErrors = (errors: Record<string, string[]>) =>
  json(errors, 400);
export const noContent = () => new HttpResponse(null, { status: 204 });

export const isAdmin = (u: DemoUser) => u.role === 'admin' || u.role === 'dev';
export const isStaff = (u: DemoUser) => isAdmin(u) || u.role === 'editor';

type Auth = { user: DemoUser; error?: undefined } | { error: Response };

/**
 * Espelha `IsAuthenticated + IsNotBanned` (default do projeto) e, opcional,
 * um teto de papel. `allowBanned` = views que trocam as permissões default
 * (me, logout, troca de senha).
 */
export function authenticate(
  opts: {
    allowBanned?: boolean;
    allow?: (u: DemoUser) => boolean;
  } = {},
): Auth {
  const user = demoDb.currentUser();
  if (!user) return { error: detail(MSG.notAuthenticated, 401) };
  // ordem do DRF: permissão de papel vem antes de IsNotBanned nas views
  if (opts.allow && !opts.allow(user))
    return { error: detail(MSG.forbidden, 403) };
  if (user.is_banned && !opts.allowBanned)
    return { error: detail(MSG.banned, 403) };
  return { user };
}

export type Body = Record<string, unknown>;

/** Corpo como objeto: JSON ou multipart (valores string ou File). */
export async function readBody(request: Request): Promise<Body> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('multipart/form-data')) {
    const out: Body = {};
    (await request.formData()).forEach((v, k) => (out[k] = v));
    return out;
  }
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === 'object' ? (parsed as Body) : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** Booleano de multipart ("true"/"false") ou JSON. */
export const bool = (v: unknown) =>
  v === true || v === 'true' || v === 'True' || v === '1';

/**
 * Erros de validação no formato do DRF (`{campo: [mensagens]}`), na ordem
 * em que o serializer roda: campos primeiro, `validate()` só se nenhum
 * campo falhou (quem chama decide com `has()`).
 */
export function errorBag() {
  const errors: Record<string, string[]> = {};
  return {
    add(field: string, message: string) {
      (errors[field] ??= []).push(message);
    },
    has(field?: string) {
      return field ? field in errors : Object.keys(errors).length > 0;
    },
    response: () => fieldErrors(errors),
  };
}
export type ErrorBag = ReturnType<typeof errorBag>;

interface CharOpts {
  required?: boolean;
  allowBlank?: boolean;
  maxLength?: number;
  minLength?: number;
  messages?: { required?: string; blank?: string };
}

/**
 * `serializers.CharField` (trim_whitespace=True): ausente → required;
 * vazio/só espaço → blank (para aí); senão roda max/min juntos.
 * Devolve o valor aparado, ou undefined se ausente/inválido.
 */
export function charField(
  bag: ErrorBag,
  body: Body,
  name: string,
  opts: CharOpts = {},
): string | undefined {
  const raw = body[name];
  if (raw === undefined || raw === null) {
    if (opts.required ?? true)
      bag.add(name, opts.messages?.required ?? MSG.required);
    return undefined;
  }
  const value = String(raw).trim();
  if (!value) {
    if (opts.allowBlank) return '';
    bag.add(name, opts.messages?.blank ?? MSG.blank);
    return undefined;
  }
  let ok = true;
  if (opts.maxLength && value.length > opts.maxLength) {
    bag.add(name, MSG.maxLength(opts.maxLength));
    ok = false;
  }
  if (opts.minLength && value.length < opts.minLength) {
    bag.add(name, MSG.minLength(opts.minLength));
    ok = false;
  }
  return ok ? value : undefined;
}

/** `serializers.EmailField`: CharField + validador de e-mail do Django. */
export function emailField(
  bag: ErrorBag,
  body: Body,
  name: string,
): string | undefined {
  const value = charField(bag, body, name);
  if (value === undefined) return undefined;
  if (!isEmail(value)) {
    bag.add(name, MSG.invalidEmail);
    return undefined;
  }
  return value;
}

/** `serializers.UUIDField`. */
export function uuidField(
  bag: ErrorBag,
  body: Body,
  name: string,
): string | undefined {
  const raw = body[name];
  if (raw === undefined || raw === null) {
    bag.add(name, MSG.required);
    return undefined;
  }
  if (!isUuid(String(raw).trim())) {
    bag.add(name, MSG.invalidUuid);
    return undefined;
  }
  return String(raw).trim().toLowerCase();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown) => typeof v === 'string' && UUID_RE.test(v);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (v: unknown) =>
  typeof v === 'string' && EMAIL_RE.test(v.trim());

export function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** Imagem enviada → URL utilizável em <img> nesta aba. */
export function fileUrl(file: unknown): string | null {
  if (!(file instanceof Blob)) return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

/** PageNumberPagination do DRF (PAGE_SIZE 20). */
export function paginate<T>(request: Request, items: T[], pageSize = 20) {
  const url = new URL(request.url);
  const raw = url.searchParams.get('page');
  const page = raw === null ? 1 : Number(raw);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  if (!Number.isInteger(page) || page < 1 || page > pages)
    return { error: detail(MSG.invalidPage, 404) } as const;
  const link = (p: number) => {
    const u = new URL(url);
    if (p === 1) u.searchParams.delete('page');
    else u.searchParams.set('page', String(p));
    return u.toString();
  };
  return {
    body: {
      count: items.length,
      next: page < pages ? link(page + 1) : null,
      previous: page > 1 ? link(page - 1) : null,
      results: items.slice((page - 1) * pageSize, page * pageSize),
    },
  } as const;
}

/** `search=` do DRF SearchFilter: cada termo em algum campo (icontains). */
export function matchesSearch(
  request: Request,
  fields: (string | null | undefined)[],
) {
  const q = new URL(request.url).searchParams.get('search')?.trim();
  if (!q) return true;
  const hay = fields.join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((term) => hay.includes(term));
}

/**
 * Senha nos serializers do backend: `CharField(min_length=8)` primeiro (erro
 * de campo); só depois `validate_password` (PasswordComplexityValidator —
 * MinimumLength nunca chega a disparar porque o campo já barrou).
 * CommonPassword/Numeric/UserAttributeSimilarity não são espelhados.
 */
export function passwordErrors(password: string): string[] {
  if (password.length < 8) return [MSG.minLength(8)];
  const errors: string[] = [];
  const missing: string[] = [];
  if (!/[A-Z]/.test(password)) missing.push('uma letra maiúscula');
  if (!/[a-z]/.test(password)) missing.push('uma letra minúscula');
  if (!/\d/.test(password)) missing.push('um número');
  if (!/[@$!%*?&#]/.test(password))
    missing.push('um caractere especial (@$!%*?&#)');
  if (missing.length)
    errors.push(`A senha precisa conter ${missing.join(', ')}.`);
  return errors;
}
