/**
 * Demo: comentários (backend/apps/comments/{views,serializers}.py).
 *
 * Não espelhado: o ScopedRateThrottle de 10 POST/min (o designer não deve
 * esbarrar em limite enquanto testa a tela).
 */
import { demoDb } from '@/mocks/demo/db';
import type { DemoComment } from '@/mocks/demo/fixtures';
import {
  authenticate,
  charField,
  detail,
  errorBag,
  isAdmin,
  json,
  MSG,
  noContent,
  paginate,
  readBody,
  route,
  safeDecode,
  uuidField,
} from '@/mocks/demo/http';
import { commentOut } from '@/mocks/demo/serializers';

/** `get_article()`: só artigo publicado; o resto (rascunho, inexistente) é 404. */
function publishedArticle(slug: string) {
  return (
    demoDb.state.articles.find(
      (a) => a.slug === safeDecode(slug) && a.status === 'published',
    ) ?? null
  );
}

const articleNotFound = () => detail(MSG.notFound('Article'), 404);
const commentNotFound = () => detail(MSG.notFound('Comment'), 404);

export const commentHandlers = [
  route<{ slug: string }>(
    'get',
    '/articles/:slug/comments/',
    ({ params, request }) => {
      const article = publishedArticle(params.slug);
      if (!article) return articleNotFound();
      const viewer = demoDb.currentUser();
      const items = demoDb.state.comments
        .filter(
          (c) =>
            c.article_id === article.id &&
            !c.is_deleted &&
            c.parent_id === null,
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const page = paginate(request, items);
      if (page.error) return page.error;
      return json({
        ...page.body,
        results: page.body.results.map((c) => commentOut(demoDb, c, viewer)),
      });
    },
  ),

  route<{ slug: string }>(
    'post',
    '/articles/:slug/comments/',
    async ({ params, request }) => {
      const auth = authenticate();
      if (auth.error) return auth.error;
      const article = publishedArticle(params.slug);
      if (!article) return articleNotFound();

      const body = await readBody(request);
      const bag = errorBag();
      const content = charField(bag, body, 'content', { maxLength: 2000 });
      let parentId: string | null = null;
      if (body.parent_id !== undefined && body.parent_id !== null) {
        const id = uuidField(bag, body, 'parent_id');
        if (id !== undefined) {
          // validate_parent_id: pai do mesmo artigo, não apagado e de topo
          const ok = demoDb.state.comments.some(
            (c) =>
              c.id === id &&
              c.article_id === article.id &&
              !c.is_deleted &&
              c.parent_id === null,
          );
          if (ok) parentId = id;
          else
            bag.add('parent_id', 'Comentário pai inválido ou não encontrado.');
        }
      }
      if (bag.has()) return bag.response();

      const comment: DemoComment = {
        id: crypto.randomUUID(),
        article_id: article.id,
        author_id: auth.user.id,
        content: content!,
        parent_id: parentId,
        created_at: demoDb.nowIso(),
        liked_by: [],
        is_deleted: false,
      };
      demoDb.state.comments.push(comment);
      return json(commentOut(demoDb, comment, auth.user), 201);
    },
  ),

  // DestroyView usa Comment.objects.all(): apagar de novo também dá 204
  route<{ id: string }>('delete', '/comments/:id/', ({ params }) => {
    const auth = authenticate({ allowBanned: true });
    if (auth.error) return auth.error;
    const comment = demoDb.state.comments.find((c) => c.id === params.id);
    if (!comment) return commentNotFound();
    if (!isAdmin(auth.user) && comment.author_id !== auth.user.id)
      return detail(MSG.forbidden, 403);
    comment.is_deleted = true;
    return noContent();
  }),

  route<{ id: string }>('post', '/comments/:id/like/', ({ params }) => {
    const auth = authenticate();
    if (auth.error) return auth.error;
    const comment = demoDb.state.comments.find(
      (c) => c.id === params.id && !c.is_deleted,
    );
    if (!comment) return commentNotFound();
    const uid = auth.user.id;
    const liked = !comment.liked_by.includes(uid);
    comment.liked_by = liked
      ? [...comment.liked_by, uid]
      : comment.liked_by.filter((id) => id !== uid);
    return json({ liked, likes_count: comment.liked_by.length });
  }),
];
