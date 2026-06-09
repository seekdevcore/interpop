/**
 * Seção de comentários do artigo — carrega lista paginada, recebe
 * novos posts, gerencia respostas aninhadas e likes opcionais.
 *
 * Mantém TODO o estado local (lista, contagem, form, erro). Article.tsx
 * só passa `slug` e `currentUser` — a integração com a API e a
 * recursão de respostas/curtidas ficam encapsuladas aqui.
 *
 * Extraído de Article.tsx (Batch E) — esse bloco respondia por ~30%
 * das linhas e da complexidade de estado; isolá-lo simplifica o
 * componente pai e facilita testes futuros do fluxo de comentários.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { CommentItem } from '../ui/CommentItem';
import commentService, { type ApiComment } from '@/services/commentService';
import type { ApiUser } from '@/services/authService';
import { extractApiError } from '@/utils/extractApiError';

interface ArticleCommentsProps {
  slug: string;
  currentUser: ApiUser | null;
}

export function ArticleComments({ slug, currentUser }: ArticleCommentsProps) {
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  // Paginação: a API serve 20 comentários de topo por página. Sem isto, só a
  // 1ª página carregava e o resto ficava inacessível. `nextPage` = número da
  // próxima página (null = acabou).
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!slug) return;
    commentService
      .list(slug)
      .then((r) => {
        setComments(r.data.results);
        setTotalComments(r.data.count);
        setNextPage(r.data.next ? 2 : null);
      })
      .catch(() => {});
  }, [slug]);

  const handleLoadMore = useCallback(async () => {
    if (nextPage === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await commentService.list(slug, {
        page: String(nextPage),
      });
      // Dedup por id: publicar um comentário novo desloca o offset do servidor
      // (ordem por -created_at), então a página seguinte pode repetir um item
      // que já está na lista. Mantemos só os realmente novos.
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...data.results.filter((c) => !seen.has(c.id))];
      });
      setNextPage(data.next ? nextPage + 1 : null);
    } catch {
      // Silencioso: o botão continua disponível para nova tentativa.
    } finally {
      setLoadingMore(false);
    }
  }, [nextPage, loadingMore, slug]);

  const handleSubmitComment = useCallback(async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    setCommentError('');
    try {
      const { data } = await commentService.add(slug, commentText.trim());
      setComments((prev) => [data, ...prev]);
      setTotalComments((n) => n + 1);
      setCommentText('');
    } catch (err: unknown) {
      setCommentError(
        extractApiError(err, 'Não foi possível publicar o comentário.'),
      );
    } finally {
      setSubmitting(false);
    }
  }, [commentText, slug, submitting]);

  const handleDelete = useCallback(
    (id: string) => {
      // Conta quantos comentários SOMEM de fato. Deletar um pai remove o pai
      // + todas as respostas dele (nesting é de no máximo 1 nível). Antes
      // decrementava só 1 → contador "Comentários (N)" dessincronizava do
      // que aparece na tela. Alvo no topo: 1 + replies; alvo é reply: 1.
      const top = comments.find((c) => c.id === id);
      const removed = top ? 1 + (top.replies?.length ?? 0) : 1;

      const removeFromList = (list: ApiComment[]): ApiComment[] =>
        list
          .filter((c) => c.id !== id)
          .map((c) => ({ ...c, replies: removeFromList(c.replies ?? []) }));
      setComments((prev) => removeFromList(prev));
      setTotalComments((n) => Math.max(0, n - removed));
    },
    [comments],
  );

  const handleReplyAdded = useCallback(
    (parentId: string, reply: ApiComment) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? {
                ...c,
                replies: [...(c.replies ?? []), reply],
                replies_count: c.replies_count + 1,
              }
            : c,
        ),
      );
      setTotalComments((n) => n + 1);
    },
    [],
  );

  const handleLikeToggled = useCallback(
    (id: string, liked: boolean, count: number) => {
      const update = (list: ApiComment[]): ApiComment[] =>
        list.map((c) => {
          if (c.id === id) return { ...c, is_liked: liked, likes_count: count };
          return { ...c, replies: update(c.replies ?? []) };
        });
      setComments((prev) => update(prev));
    },
    [],
  );

  return (
    <section className="article-comments" aria-labelledby="comments-heading">
      <h2 id="comments-heading">
        Comentários <span>({totalComments})</span>
      </h2>

      {currentUser ? (
        <div className="article-comment-form">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Deixe seu comentário…"
            rows={3}
            maxLength={2000}
            aria-label="Escrever comentário"
          />
          {commentError && (
            <p
              role="alert"
              style={{
                color: '#991B1B',
                background: '#FEE2E2',
                padding: 'var(--sp-2) var(--sp-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                marginTop: 'var(--sp-2)',
              }}
            >
              {commentError}
            </p>
          )}
          <div className="article-comment-form__actions">
            <Button
              variant="primary"
              size="md"
              disabled={!commentText.trim() || submitting}
              onClick={handleSubmitComment}
            >
              {submitting ? 'Publicando…' : 'Publicar comentário'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="article-comments__login-prompt">
          <Link to="/login" className="auth-link auth-link--strong">
            Entre
          </Link>{' '}
          ou{' '}
          <Link to="/cadastro" className="auth-link auth-link--strong">
            crie uma conta
          </Link>{' '}
          para comentar.
        </p>
      )}

      {comments.length > 0 ? (
        <>
          <ol className="article-comments-list">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                articleSlug={slug}
                onDelete={handleDelete}
                onReplyAdded={handleReplyAdded}
                onLikeToggled={handleLikeToggled}
              />
            ))}
          </ol>
          {nextPage !== null && (
            <div className="article-comments__more">
              <Button
                variant="outline"
                size="md"
                disabled={loadingMore}
                onClick={handleLoadMore}
              >
                {loadingMore ? 'Carregando…' : 'Ver mais comentários'}
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="article-comments__empty">Seja o primeiro a comentar.</p>
      )}
    </section>
  );
}
