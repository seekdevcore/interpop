/**
 * Demo: `/api/v1/auth/*` (backend/apps/users/{views,serializers}.py).
 *
 * Desvios conscientes do backend, só no demo:
 * - qualquer senha entra em qualquer conta (o designer não precisa decorar);
 * - troca de senha aceita qualquer senha atual não vazia;
 * - redefinição aceita qualquer UUID como token (não há e-mail para receber);
 * - `GET /auth/users/` exige editor+.
 */
import { demoDb } from '@/mocks/demo/db';
import type { DemoUser } from '@/mocks/demo/fixtures';
import {
  authenticate,
  bool,
  charField,
  detail,
  emailField,
  errorBag,
  fieldErrors,
  fileUrl,
  isStaff,
  json,
  matchesSearch,
  MSG,
  paginate,
  passwordErrors,
  readBody,
  route,
  uuidField,
  type ErrorBag,
} from '@/mocks/demo/http';
import { adminUser, publicUser } from '@/mocks/demo/serializers';

const USERNAME_RE = /^[A-Za-z0-9_.-]+$/;

/** `_validate_username` (roda depois dos validadores de campo). */
function validateUsername(bag: ErrorBag, username: string, selfId?: string) {
  if (!USERNAME_RE.test(username)) {
    bag.add(
      'username',
      'Use apenas letras, números, ponto, hífen ou underline (sem espaços).',
    );
    return;
  }
  const taken = demoDb.state.users.some(
    (u) =>
      u.id !== selfId && u.username.toLowerCase() === username.toLowerCase(),
  );
  if (taken) bag.add('username', 'Este nome de usuário já está em uso.');
}

/** `CharField(min_length=8)` + `validate_password` num campo de senha nova. */
function newPassword(
  bag: ErrorBag,
  body: Record<string, unknown>,
  name: string,
) {
  const value = charField(bag, body, name, { minLength: 8 });
  return value;
}

export const authHandlers = [
  route('post', '/auth/login/', async ({ request }) => {
    const body = await readBody(request);
    const bag = errorBag();
    const email = emailField(bag, body, 'email');
    charField(bag, body, 'password');
    if (bag.has()) return bag.response();
    const user = demoDb.findUserByEmail(email!);
    // authenticate() do Django devolve None para inativo → mesma mensagem
    if (!user || !user.is_active)
      return fieldErrors({ non_field_errors: ['E-mail ou senha inválidos.'] });
    if (user.is_banned)
      return fieldErrors({ non_field_errors: ['Conta suspensa.'] });
    user.last_login = demoDb.nowIso();
    demoDb.setSession(user.id);
    return json(publicUser(user));
  }),

  route('post', '/auth/logout/', () => {
    const auth = authenticate({ allowBanned: true });
    if (auth.error) return auth.error;
    demoDb.setSession(null);
    return json({ detail: 'Logout realizado.' });
  }),

  route('post', '/auth/refresh/', () =>
    demoDb.currentUser()
      ? new Response(null, { status: 200 })
      : detail('Token de atualização inválido ou ausente.', 401),
  ),

  route('post', '/auth/register/', async ({ request }) => {
    const body = await readBody(request);
    const bag = errorBag();
    const { users } = demoDb.state;

    const email = emailField(bag, body, 'email');
    if (email !== undefined) {
      // UniqueValidator (exato) antes de validate_email (iexact)
      if (users.some((u) => u.email === email))
        bag.add('email', 'user com este email já existe.');
      else if (users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
        bag.add('email', 'Este e-mail já está em uso.');
    }
    const username = charField(bag, body, 'username', { maxLength: 150 });
    if (username !== undefined) {
      if (users.some((u) => u.username === username))
        bag.add('username', 'user com este username já existe.');
      else validateUsername(bag, username);
    }
    const first_name = charField(bag, body, 'first_name', { maxLength: 150 });
    const last_name = charField(bag, body, 'last_name', { maxLength: 150 });
    const password = newPassword(bag, body, 'password');
    const password2 = charField(bag, body, 'password2');
    if (bag.has()) return bag.response();

    if (password !== password2)
      return fieldErrors({ password2: ['As senhas não coincidem.'] });
    const weak = passwordErrors(password!);
    if (weak.length) return fieldErrors({ password: weak });

    const now = demoDb.nowIso();
    const user: DemoUser = {
      id: crypto.randomUUID(),
      email: email!.toLowerCase(),
      username: username!,
      first_name: first_name!,
      last_name: last_name!,
      role: 'user',
      bio: '',
      avatar: null,
      date_joined: now,
      last_login: now,
      updated_at: now,
      is_active: true,
      is_banned: false,
    };
    users.push(user);
    demoDb.setSession(user.id);
    return json(publicUser(user), 201);
  }),

  route('get', '/auth/me/', () => {
    const auth = authenticate({ allowBanned: true });
    if (auth.error) return auth.error;
    return json(publicUser(auth.user));
  }),

  route('patch', '/auth/me/', async ({ request }) => {
    const auth = authenticate({ allowBanned: true });
    if (auth.error) return auth.error;
    const { user } = auth;
    const body = await readBody(request);
    const bag = errorBag();
    const opt = { required: false, maxLength: 150 };

    const username = charField(bag, body, 'username', opt);
    if (username !== undefined) validateUsername(bag, username, user.id);
    const first_name = charField(bag, body, 'first_name', opt);
    const last_name = charField(bag, body, 'last_name', opt);
    const bio = charField(bag, body, 'bio', {
      required: false,
      allowBlank: true,
    });
    if (bag.has()) return bag.response();

    if (username !== undefined) user.username = username;
    if (first_name !== undefined) user.first_name = first_name;
    if (last_name !== undefined) user.last_name = last_name;
    if (bio !== undefined) user.bio = bio;
    const avatar = fileUrl(body.avatar);
    if (avatar) user.avatar = avatar;
    user.updated_at = demoDb.nowIso();
    return json(publicUser(user));
  }),

  route('post', '/auth/me/password/', async ({ request }) => {
    const auth = authenticate({ allowBanned: true });
    if (auth.error) return auth.error;
    const body = await readBody(request);
    const bag = errorBag();
    charField(bag, body, 'old_password');
    const next = newPassword(bag, body, 'new_password');
    if (bag.has()) return bag.response();
    const weak = passwordErrors(next!);
    if (weak.length) return fieldErrors({ new_password: weak });
    // backend troca a senha e derruba os cookies: precisa logar de novo
    demoDb.setSession(null);
    return json({ detail: 'Senha alterada com sucesso.' });
  }),

  route('post', '/auth/password-reset/', async ({ request }) => {
    const body = await readBody(request);
    const bag = errorBag();
    emailField(bag, body, 'email');
    if (bag.has()) return bag.response();
    return json({
      detail: 'Se o e-mail existir, você receberá as instruções em instantes.',
    });
  }),

  route('post', '/auth/password-reset/confirm/', async ({ request }) => {
    const body = await readBody(request);
    const bag = errorBag();
    uuidField(bag, body, 'token');
    const next = newPassword(bag, body, 'new_password');
    if (bag.has()) return bag.response();
    const weak = passwordErrors(next!);
    if (weak.length) return fieldErrors({ new_password: weak });
    return json({ detail: 'Senha redefinida com sucesso.' });
  }),

  route('get', '/auth/users/', ({ request }) => {
    const auth = authenticate({ allow: isStaff, allowBanned: true });
    if (auth.error) return auth.error;
    const p = new URL(request.url).searchParams;
    const role = p.get('role');
    const flags = (['is_active', 'is_banned'] as const).filter(
      (k) => p.get(k) !== null && p.get(k) !== '',
    );
    const items = demoDb.state.users
      .filter((u) => !role || u.role === role)
      .filter((u) => flags.every((k) => u[k] === bool(p.get(k))))
      .filter((u) =>
        matchesSearch(request, [
          u.email,
          u.username,
          u.first_name,
          u.last_name,
        ]),
      )
      .sort((a, b) => b.date_joined.localeCompare(a.date_joined));
    const page = paginate(request, items);
    if (page.error) return page.error;
    return json({
      ...page.body,
      results: page.body.results.map((u) => adminUser(demoDb, u)),
    });
  }),

  route<{ id: string }>('get', '/auth/users/:id/', ({ params }) => {
    const auth = authenticate({ allow: isStaff, allowBanned: true });
    if (auth.error) return auth.error;
    const user = demoDb.findUser(params.id);
    if (!user) return detail(MSG.notFound('User'), 404);
    return json(adminUser(demoDb, user));
  }),
];
