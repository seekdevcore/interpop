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
import commentService, { type ApiComment } from '../../services/commentService';
import type { ApiUser } from '../../services/authService';
import { extractApiError } from '../../utils/extractApiError';

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

  useEffect(() => {
    if (!slug) return;
    commentService
      .list(slug)
      .then((r) => {
        setComments(r.data.results);
        setTotalComments(r.data.count);
      })
      .catch(() => {});
  }, [slug]);

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

  const handleDelete = useCallback((id: string) => {
    const removeFromList = (list: ApiComment[]): ApiComment[] =>
      list
        .filter((c) => c.id !== id)
        .map((c) => ({ ...c, replies: removeFromList(c.replies ?? []) }));
    setComments((prev) => removeFromList(prev));
    setTotalComments((n) => Math.max(0, n - 1));
  }, []);

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
      ) : (
        <p className="article-comments__empty">Seja o primeiro a comentar.</p>
      )}
    </section>
  );
}
