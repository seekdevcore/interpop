/**
 * Demo: `/api/v1/moderation/*` (backend/apps/moderation/{views,serializers,
 * services}.py). Hierarquia igual à do backend: dev é imune; admin só é
 * banido/desbanido por dev; editor só solicita.
 */
import { demoDb } from '@/mocks/demo/db';
import type { DemoBan, DemoUser } from '@/mocks/demo/fixtures';
import {
  authenticate,
  charField,
  detail,
  errorBag,
  isAdmin,
  isStaff,
  json,
  matchesSearch,
  MSG,
  noContent,
  paginate,
  readBody,
  route,
  str,
  type Body,
  type ErrorBag,
} from '@/mocks/demo/http';
import { banOut, banRequestOut } from '@/mocks/demo/serializers';

const byCreatedDesc = (a: { created_at: string }, b: { created_at: string }) =>
  b.created_at.localeCompare(a.created_at);

/**
 * `PrimaryKeyRelatedField(queryset=User.filter(role__in=roles,
 * is_banned=False))`: fora do queryset → "Pk inválido".
 */
function userPkField(
  bag: ErrorBag,
  body: Body,
  name: string,
  roles: DemoUser['role'][],
) {
  const raw = body[name];
  if (raw === undefined || raw === null || raw === '') {
    bag.add(
      name,
      raw === undefined ? MSG.required : 'Este campo não pode ser nulo.',
    );
    return undefined;
  }
  const id = String(raw);
  const user = demoDb.state.users.find(
    (u) => u.id === id && roles.includes(u.role) && !u.is_banned,
  );
  if (!user) {
    bag.add(name, MSG.invalidPk(id));
    return undefined;
  }
  return user;
}

/** services.ban_user: reativa a linha de ban do usuário ou cria uma. */
function banUser(
  target: DemoUser,
  actor: DemoUser,
  reason: string,
  trigger: string,
  expiresAt: string | null,
) {
  const { bans } = demoDb.state;
  const now = demoDb.nowIso();
  let ban = bans.find((b) => b.user_id === target.id);
  if (ban) {
    Object.assign(ban, {
      banned_by_id: actor.id,
      reason,
      trigger_message: trigger,
      expires_at: expiresAt,
      is_active: true,
      unbanned_by_id: null,
      unbanned_at: null,
      created_at: now,
    } satisfies Partial<DemoBan>);
  } else {
    ban = {
      id: crypto.randomUUID(),
      user_id: target.id,
      banned_by_id: actor.id,
      unbanned_by_id: null,
      reason,
      trigger_message: trigger,
      created_at: now,
      expires_at: expiresAt,
      is_active: true,
      unbanned_at: null,
    };
    bans.push(ban);
  }
  target.is_banned = true;
  return ban;
}

const REQUEST_STATUS_LABEL = {
  pending: 'pendente',
  approved: 'aprovada',
  rejected: 'rejeitada',
} as const;

export const moderationHandlers = [
  route('get', '/moderation/bans/', ({ request }) => {
    const auth = authenticate({ allow: isAdmin });
    if (auth.error) return auth.error;
    const items = demoDb.state.bans
      .filter((b) => b.is_active)
      .filter((b) => {
        const u = demoDb.findUser(b.user_id);
        return matchesSearch(request, [
          u?.email,
          u?.username,
          u?.first_name,
          u?.last_name,
        ]);
      })
      .sort(byCreatedDesc);
    const page = paginate(request, items);
    if (page.error) return page.error;
    return json({
      ...page.body,
      results: page.body.results.map((b) => banOut(demoDb, b)),
    });
  }),

  route('post', '/moderation/bans/', async ({ request }) => {
    const auth = authenticate({ allow: isAdmin });
    if (auth.error) return auth.error;
    const actor = auth.user;
    const body = await readBody(request);
    const bag = errorBag();
    const roles: DemoUser['role'][] =
      actor.role === 'dev' ? ['user', 'editor', 'admin'] : ['user', 'editor'];
    const target = userPkField(bag, body, 'user_id', roles);
    const reason = charField(bag, body, 'reason');
    const trigger = charField(bag, body, 'trigger_message', {
      required: false,
      allowBlank: true,
    });
    if (bag.has()) return bag.response();
    const ban = banUser(
      target!,
      actor,
      reason!,
      trigger ?? '',
      str(body.expires_at) || null,
    );
    return json(banOut(demoDb, ban), 201);
  }),

  route<{ id: string }>('delete', '/moderation/bans/:id/', ({ params }) => {
    const auth = authenticate({ allow: isAdmin });
    if (auth.error) return auth.error;
    const ban = demoDb.state.bans.find(
      (b) => b.id === params.id && b.is_active,
    );
    if (!ban) return detail(MSG.notFound('Ban'), 404);
    const target = demoDb.findUser(ban.user_id);
    if (target && isAdmin(target) && auth.user.role !== 'dev')
      return detail('Hierarquia: apenas um dev pode desbanir um admin.', 403);
    ban.is_active = false;
    ban.unbanned_by_id = auth.user.id;
    ban.unbanned_at = demoDb.nowIso();
    if (target) target.is_banned = false;
    return noContent();
  }),

  route('get', '/moderation/ban-requests/', ({ request }) => {
    const auth = authenticate();
    if (auth.error) return auth.error;
    const status = new URL(request.url).searchParams.get('status');
    const items = demoDb.state.banRequests
      .filter((r) => isAdmin(auth.user) || r.requested_by_id === auth.user.id)
      .filter((r) => !status || r.status === status)
      .sort(byCreatedDesc);
    const page = paginate(request, items);
    if (page.error) return page.error;
    return json({
      ...page.body,
      results: page.body.results.map((r) => banRequestOut(demoDb, r)),
    });
  }),

  route('post', '/moderation/ban-requests/', async ({ request }) => {
    const auth = authenticate({ allow: isStaff });
    if (auth.error) return auth.error;
    const body = await readBody(request);
    const bag = errorBag();
    const target = userPkField(bag, body, 'target_id', ['user', 'editor']);
    if (
      target &&
      demoDb.state.banRequests.some(
        (r) => r.target_id === target.id && r.status === 'pending',
      )
    )
      bag.add('target_id', 'Já existe solicitação pendente para este usuário.');
    const reason = charField(bag, body, 'reason');
    const trigger = charField(bag, body, 'trigger_message', {
      required: false,
      allowBlank: true,
    });
    if (bag.has()) return bag.response();
    const req = {
      id: crypto.randomUUID(),
      target_id: target!.id,
      requested_by_id: auth.user.id,
      reason: reason!,
      trigger_message: trigger ?? '',
      status: 'pending' as const,
      decided_by_id: null,
      decided_at: null,
      decision_note: '',
      created_at: demoDb.nowIso(),
    };
    demoDb.state.banRequests.push(req);
    return json(banRequestOut(demoDb, req), 201);
  }),

  route<{ id: string }>(
    'post',
    '/moderation/ban-requests/:id/decide/',
    async ({ params, request }) => {
      const auth = authenticate({ allow: isAdmin });
      if (auth.error) return auth.error;
      const req = demoDb.state.banRequests.find((r) => r.id === params.id);
      if (!req) return detail('Solicitação não encontrada.', 404);
      if (req.status !== 'pending')
        return detail(
          `Solicitação já ${REQUEST_STATUS_LABEL[req.status]}.`,
          400,
        );
      const body = await readBody(request);
      const action = str(body.action);
      if (action !== 'approve' && action !== 'reject')
        return detail("action deve ser 'approve' ou 'reject'.", 400);
      if (action === 'approve') {
        const target = demoDb.findUser(req.target_id);
        if (target)
          banUser(target, auth.user, req.reason, req.trigger_message, null);
      }
      req.status = action === 'approve' ? 'approved' : 'rejected';
      req.decided_by_id = auth.user.id;
      req.decided_at = demoDb.nowIso();
      req.decision_note = str(body.decision_note) ?? '';
      return json(banRequestOut(demoDb, req));
    },
  ),
];
