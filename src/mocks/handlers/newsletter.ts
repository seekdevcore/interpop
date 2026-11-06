/**
 * Demo: `/api/v1/newsletter/*` (backend/apps/newsletter/{views,serializers}.py).
 * O e-mail de boas-vindas (Celery) não existe aqui: só o registro muda.
 */
import { demoDb } from '@/mocks/demo/db';
import {
  emailField,
  errorBag,
  fieldErrors,
  json,
  readBody,
  route,
  uuidField,
} from '@/mocks/demo/http';

export const newsletterHandlers = [
  route('post', '/newsletter/subscribe/', async ({ request }) => {
    const body = await readBody(request);
    const bag = errorBag();
    const raw = emailField(bag, body, 'email');
    if (bag.has()) return bag.response();
    const email = raw!.toLowerCase();
    const { subscribers } = demoDb.state;
    const existing = subscribers.find((s) => s.email === email);
    if (existing) {
      existing.is_active = true;
      return json({ detail: 'E-mail já inscrito e reativado.' });
    }
    subscribers.push({
      email,
      token: crypto.randomUUID(),
      is_active: true,
      created_at: demoDb.nowIso(),
    });
    return json({ detail: 'Inscrição realizada com sucesso!' });
  }),

  route('post', '/newsletter/unsubscribe/', async ({ request }) => {
    const body = await readBody(request);
    const bag = errorBag();
    const token = uuidField(bag, body, 'token');
    if (bag.has()) return bag.response();
    const sub = demoDb.state.subscribers.find(
      (s) => s.token.toLowerCase() === token && s.is_active,
    );
    if (!sub)
      return fieldErrors({ token: ['Token inválido ou já cancelado.'] });
    sub.is_active = false;
    return json({ detail: 'Inscrição cancelada com sucesso.' });
  }),
];
