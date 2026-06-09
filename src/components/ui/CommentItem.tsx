import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { ApiComment } from '@/services/commentService';
import commentService from '@/services/commentService';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { formatDateTime } from '@/utils/formatDate';
import { extractApiError } from '@/utils/extractApiError';
import './CommentItem.css';

interface CommentItemProps {
  comment: ApiComment;
  articleSlug: string;
  depth?: number;
  onDelete: (id: string) => void;
  onReplyAdded: (parentId: string, reply: ApiComment) => void;
  onLikeToggled: (id: string, liked: boolean, count: number) => void;
}

export function CommentItem({
  comment,
  articleSlug,
  depth = 0,
  onDelete,
  onReplyAdded,
  onLikeToggled,
}: CommentItemProps) {
  const { currentUser, isAdmin } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);
  // Antes os 3 handlers engoliam o erro (catch vazio): se curtir/responder/
  // excluir falhasse, o usuário clicava e NADA acontecia, sem pista do porquê.
  const [actionError, setActionError] = useState('');

  // `isAdmin` (vem do AuthContext) já cobre admin E dev — dev é admin++.
  const canDelete =
    currentUser && (currentUser.id === comment.author.id || isAdmin);

  const handleLike = useCallback(async () => {
    if (!currentUser || liking) return;
    setLiking(true);
    setActionError('');
    try {
      const { data } = await commentService.toggleLike(comment.id);
      onLikeToggled(comment.id, data.liked, data.likes_count);
    } catch {
      setActionError('Não foi possível registrar a curtida. Tente novamente.');
    } finally {
      setLiking(false);
    }
  }, [comment.id, currentUser, liking, onLikeToggled]);

  const handleReplySubmit = useCallback(async () => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    setActionError('');
    try {
      const { data } = await commentService.add(
        articleSlug,
        replyText.trim(),
        comment.id,
      );
      onReplyAdded(comment.id, data);
      setReplyText('');
      setShowReplyForm(false);
    } catch (err: unknown) {
      setActionError(
        extractApiError(err, 'Não foi possível enviar a resposta.'),
      );
    } finally {
      setSubmitting(false);
    }
  }, [articleSlug, comment.id, onReplyAdded, replyText, submitting]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm('Excluir este comentário?')) return;
    setActionError('');
    try {
      await commentService.remove(comment.id);
      onDelete(comment.id);
    } catch (err: unknown) {
      setActionError(
        extractApiError(err, 'Não foi possível excluir o comentário.'),
      );
    }
  }, [comment.id, onDelete]);

  return (
    <li className={`comment-item ${depth > 0 ? 'comment-item--reply' : ''}`}>
      <Avatar
        src={comment.author.avatar}
        initial={comment.author.avatar_initial}
        className="comment-item__avatar"
      />

      <div className="comment-item__body">
        <div className="comment-item__header">
          <strong className="comment-item__author">
            {comment.author.full_name}
          </strong>
          <time className="comment-item__time" dateTime={comment.created_at}>
            {formatDateTime(comment.created_at)}
          </time>
        </div>

        <p className="comment-item__text">{comment.content}</p>

        <div className="comment-item__actions">
          <button
            className={`comment-item__like ${comment.is_liked ? 'comment-item__like--active' : ''}`}
            onClick={handleLike}
            disabled={!currentUser || liking}
            aria-label={
              comment.is_liked ? 'Descurtir comentário' : 'Curtir comentário'
            }
            aria-pressed={comment.is_liked}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill={comment.is_liked ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>{comment.likes_count}</span>
          </button>

          {depth === 0 && currentUser && (
            <button
              className="comment-item__reply-btn"
              onClick={() => setShowReplyForm((v) => !v)}
              aria-expanded={showReplyForm}
            >
              Responder
            </button>
          )}

          {canDelete && (
            <button
              className="comment-item__delete"
              onClick={handleDelete}
              aria-label="Excluir comentário"
            >
              Excluir
            </button>
          )}
        </div>

        {showReplyForm && (
          <div className="comment-item__reply-form">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Respondendo a ${comment.author.full_name}…`}
              rows={2}
              maxLength={2000}
              aria-label="Escrever resposta"
            />
            <div className="comment-item__reply-form-actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyText('');
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!replyText.trim() || submitting}
                onClick={handleReplySubmit}
              >
                {submitting ? 'Enviando…' : 'Responder'}
              </Button>
            </div>
          </div>
        )}

        {actionError && (
          <p className="comment-item__error" role="alert">
            {actionError}
          </p>
        )}

        {comment.replies && comment.replies.length > 0 && (
          <ol className="comment-item__replies" aria-label="Respostas">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                articleSlug={articleSlug}
                depth={1}
                onDelete={onDelete}
                onReplyAdded={onReplyAdded}
                onLikeToggled={onLikeToggled}
              />
            ))}
          </ol>
        )}
      </div>
    </li>
  );
}
