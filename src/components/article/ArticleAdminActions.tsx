/**
 * Ações administrativas do artigo (Editar / Excluir) — visíveis apenas
 * para o autor da publicação ou para um admin. Editor pode mexer só nos
 * próprios; admin tem poder total.
 *
 * Padrão de UX: inline-confirm (sem modal). Clicar "Excluir" troca o
 * botão por um trio "Sim, excluir / Cancelar" — menos cerimônia que
 * um dialog, mais reversível que uma confirmação implícita.
 *
 * Extraído de Article.tsx (Batch E) — isola o estado de confirmação
 * e a chamada destrutiva ao service.
 */
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import articleService from '@/services/articleService';

interface ArticleAdminActionsProps {
  slug: string;
}

export function ArticleAdminActions({ slug }: ArticleAdminActionsProps) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    setError('');
    try {
      await articleService.remove(slug);
      navigate('/noticias');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(
        e?.response?.data?.detail ?? 'Não foi possível excluir a publicação.',
      );
      setDeleting(false);
      setConfirming(false);
    }
  }, [slug, deleting, navigate]);

  return (
    <div
      className="article-admin-actions"
      role="group"
      aria-label="Ações da publicação"
    >
      <Link
        to={`/editar-publicacao/${slug}`}
        className="article-admin-actions__btn"
      >
        Editar
      </Link>
      {!confirming ? (
        <button
          type="button"
          className="article-admin-actions__btn article-admin-actions__btn--danger"
          onClick={() => {
            setConfirming(true);
            setError('');
          }}
        >
          Excluir
        </button>
      ) : (
        <>
          <span className="article-admin-actions__confirm">
            Excluir esta publicação?
          </span>
          <button
            type="button"
            className="article-admin-actions__btn article-admin-actions__btn--danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Excluindo…' : 'Sim, excluir'}
          </button>
          <button
            type="button"
            className="article-admin-actions__btn"
            onClick={() => setConfirming(false)}
            disabled={deleting}
          >
            Cancelar
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="article-admin-actions__error">
          {error}
        </p>
      )}
    </div>
  );
}
