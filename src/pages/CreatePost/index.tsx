import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import articleService, {
  type ApiCategory,
} from '../../services/articleService';
import { extractApiError } from '../../utils/extractApiError';
import { renderArticleBody } from '../../utils/renderArticleBody';
import '../../styles/article-body.css';
import './CreatePost.css';

interface CreatePostProps {
  /** Quando passado, vira modo "Editar publicação" (carrega artigo, PATCH em vez de POST). */
  editingSlug?: string;
}

/** Wrapper de rota /editar-publicacao/:slug — extrai slug e delega ao CreatePost. */
export function EditPost() {
  const { slug } = useParams<{ slug: string }>();
  return <CreatePost editingSlug={slug} />;
}

interface FormState {
  title: string;
  excerpt: string;
  body: string;
  category: string; // holds the selected category id as a string (form-native)
  cover_caption: string; // G1-style "Descrição — Foto: Agência"
}

const EMPTY: FormState = {
  title: '',
  excerpt: '',
  body: '',
  category: '',
  cover_caption: '',
};

export function CreatePost({ editingSlug }: CreatePostProps = {}) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isEditing = !!editingSlug;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [preview, setPreview] = useState(false);
  const [published, setPublished] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [apiError, setApiError] = useState('');

  // Modo edição: carrega artigo existente e popula form. O cover_image é
  // OPCIONAL na PATCH — só envia se o usuário trocar (coverFile != null).
  useEffect(() => {
    if (!editingSlug) return;
    articleService
      .get(editingSlug)
      .then((r) => {
        const a = r.data;
        setForm({
          title: a.title,
          excerpt: a.excerpt,
          body: a.body ?? '',
          category: a.category ? String(a.category.id) : '',
          cover_caption: a.cover_caption ?? '',
        });
        // Preview da capa atual (URL absoluta vinda do backend).
        if (a.cover_image) setCoverPreview(a.cover_image);
      })
      .catch(() =>
        setApiError('Não foi possível carregar a publicação para edição.'),
      );
  }, [editingSlug]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URL when it changes or component unmounts
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  // Load categories from the API so the dropdown is always in sync with what
  // the backend will accept as category_id.
  useEffect(() => {
    // Cache em memória — reusa o array carregado pela primeira página.
    articleService
      .getCachedCategories()
      .then(setCategories)
      .catch(() => setApiError('Não foi possível carregar as categorias.'));
  }, []);

  const set =
    (field: keyof FormState) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  function applyFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    applyFile(e.target.files?.[0]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    applyFile(e.dataTransfer.files?.[0]);
  }

  function removeCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const isValid =
    form.title.trim() &&
    form.excerpt.trim() &&
    form.body.trim() &&
    form.category;

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isPublishing) return;
    setIsPublishing(true);
    setApiError('');
    try {
      // Payload base — em modo edit não enviamos cover_image se o usuário
      // não trocou (coverFile=null) pra não apagar a capa atual.
      const payload = {
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        body: form.body.trim(),
        category_id: Number(form.category),
        cover_caption: form.cover_caption.trim(),
        ...(coverFile ? { cover_image: coverFile } : {}),
      };

      if (isEditing && editingSlug) {
        await articleService.update(editingSlug, payload);
      } else {
        await articleService.create({
          ...payload,
          status: 'published',
          is_featured: false,
        });
      }
      setPublished(true);
    } catch (err: unknown) {
      // Surfa o primeiro field error OU DRF detail OU rede offline — nunca
      // fallback silencioso.
      setApiError(
        extractApiError(err, 'Não foi possível publicar. Tente novamente.'),
      );
    } finally {
      setIsPublishing(false);
    }
  }

  if (published) {
    return (
      <div className="create-post__success">
        <div className="create-post__success-card">
          <div className="create-post__success-icon" aria-hidden="true">
            ✓
          </div>
          <h1>Publicação enviada!</h1>
          <p>
            "<strong>{form.title}</strong>" foi publicada com sucesso e já está
            disponível para os leitores da Interpop.
          </p>
          {coverPreview && (
            <img
              className="create-post__success-thumb"
              src={coverPreview}
              alt="Capa publicada"
            />
          )}
          <div className="create-post__success-actions">
            <Button variant="primary" size="lg" onClick={() => navigate('/')}>
              Ver no site
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setForm(EMPTY);
                removeCover();
                setPublished(false);
              }}
            >
              Nova publicação
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate('/admin')}
            >
              Voltar ao painel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-post">
      {/* ── Header ── */}
      <div className="create-post__header">
        <div className="create-post__header-left">
          <button
            className="create-post__back"
            onClick={() => navigate('/admin')}
          >
            ← Painel Admin
          </button>
          <div>
            <h1>{isEditing ? 'Editar publicação' : 'Nova publicação'}</h1>
            <p>
              {isEditing ? 'Editando como ' : 'Criando como '}
              <strong>{currentUser?.full_name}</strong>
            </p>
          </div>
        </div>
        <div className="create-post__header-actions">
          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={() => setPreview((v) => !v)}
          >
            {preview ? '✏️ Editar' : '👁 Prévia'}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="create-post-form"
            disabled={!isValid || isPublishing}
          >
            {isPublishing
              ? isEditing
                ? 'Salvando…'
                : 'Publicando…'
              : isEditing
                ? 'Salvar alterações'
                : 'Publicar'}
          </Button>
        </div>
      </div>

      {apiError && (
        <div
          role="alert"
          style={{
            margin: '0 var(--sp-6) var(--sp-4)',
            padding: 'var(--sp-3) var(--sp-4)',
            borderRadius: 'var(--radius-md)',
            background: '#FEE2E2',
            color: '#991B1B',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
          }}
        >
          {apiError}
        </div>
      )}

      <div className="create-post__body">
        {/* ── Form ── */}
        <form
          id="create-post-form"
          className="create-post__form"
          onSubmit={handlePublish}
          noValidate
        >
          <div className="create-post__card">
            <h2>Conteúdo</h2>

            <Input
              id="post-title"
              label="Título da publicação *"
              placeholder="Um título claro e chamativo..."
              value={form.title}
              onChange={set('title')}
              required
            />

            <div className="input-field">
              <label htmlFor="post-excerpt" className="input-label">
                Resumo *
              </label>
              <textarea
                id="post-excerpt"
                className="create-post__textarea create-post__textarea--sm"
                placeholder="Um parágrafo que resume a matéria (aparece na listagem)..."
                value={form.excerpt}
                onChange={set('excerpt')}
                rows={3}
                required
              />
            </div>

            <div className="input-field">
              <label htmlFor="post-body" className="input-label">
                Corpo do artigo *
              </label>
              <textarea
                id="post-body"
                className="create-post__textarea create-post__textarea--lg"
                placeholder="Escreva o conteúdo completo do artigo aqui..."
                value={form.body}
                onChange={set('body')}
                rows={16}
                required
              />
              <p className="create-post__hint">
                <strong>Sintaxe de formatação:</strong> comece um parágrafo com{' '}
                <code>&gt; </code> para criar uma <em>citação em destaque</em>,
                ou com <code>## </code> para um <em>subtítulo</em>. Separe
                parágrafos com uma linha em branco. A primeira letra do artigo
                vira capitular automaticamente.
              </p>
            </div>
          </div>

          <div className="create-post__card">
            <h2>Metadados</h2>

            <div className="input-field">
              <label htmlFor="post-category" className="input-label">
                Categoria *
              </label>
              <select
                id="post-category"
                className="create-post__select"
                value={form.category}
                onChange={set('category')}
                required
              >
                <option value="">Selecione uma categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Image upload ── */}
            <div className="input-field">
              <label className="input-label">
                Imagem de capa
                <span className="admin__label-optional">
                  {' '}
                  (recomendado: 1920 × 1080 px · 16:9 — também é o máximo)
                </span>
              </label>

              {coverPreview ? (
                <div className="create-post__img-preview">
                  <img src={coverPreview} alt="Pré-visualização da capa" />
                  <div className="create-post__img-overlay">
                    <button
                      type="button"
                      className="create-post__img-change"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Trocar imagem
                    </button>
                    <button
                      type="button"
                      className="create-post__img-remove"
                      onClick={removeCover}
                      aria-label="Remover imagem de capa"
                    >
                      ✕
                    </button>
                  </div>
                  <span className="create-post__img-filename">
                    {coverFile?.name}
                  </span>
                </div>
              ) : (
                <div
                  className={`create-post__dropzone ${dragOver ? 'create-post__dropzone--active' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  role="button"
                  tabIndex={0}
                  aria-label="Clique ou arraste uma imagem para fazer upload da capa"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ')
                      fileInputRef.current?.click();
                  }}
                >
                  <div
                    className="create-post__dropzone-icon"
                    aria-hidden="true"
                  >
                    🖼️
                  </div>
                  <p className="create-post__dropzone-text">
                    Clique para selecionar ou arraste uma imagem aqui
                  </p>
                  <p className="create-post__dropzone-hint">
                    PNG, JPG, WEBP · até 10 MB
                  </p>
                  <p className="create-post__dropzone-hint">
                    Dimensão ideal (e máxima): <strong>1920 × 1080 px</strong> ·
                    proporção 16:9
                  </p>
                </div>
              )}

              {/* Hidden native file input */}
              <input
                ref={fileInputRef}
                id="post-cover-file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="create-post__file-input"
                onChange={handleFileInput}
                aria-label="Selecionar imagem de capa do dispositivo"
              />
            </div>

            {/* Legenda da capa — padrão G1 "Descrição — Foto: Agência" */}
            <div className="input-field">
              <label htmlFor="post-cover-caption" className="input-label">
                Legenda da capa
                <span className="admin__label-optional"> (opcional)</span>
              </label>
              <input
                id="post-cover-caption"
                type="text"
                className="create-post__caption-input"
                placeholder="Ex.: Ator na cerimônia de abertura — Foto: REUTERS/Fotógrafo"
                value={form.cover_caption}
                onChange={set('cover_caption')}
                maxLength={300}
              />
            </div>
          </div>
        </form>

        {/* ── Preview ── */}
        {preview && (
          <aside
            className="create-post__preview"
            aria-label="Pré-visualização do artigo"
          >
            <div className="create-post__preview-header">
              <span>Pré-visualização</span>
            </div>
            <div className="create-post__preview-body">
              {form.category && (
                <span className="create-post__preview-category">
                  {categories.find((c) => String(c.id) === form.category)
                    ?.name ?? ''}
                </span>
              )}
              <h2 className="create-post__preview-title">
                {form.title || (
                  <span className="create-post__placeholder">
                    Título do artigo
                  </span>
                )}
              </h2>
              <p className="create-post__preview-excerpt">
                {form.excerpt || (
                  <span className="create-post__placeholder">
                    O resumo aparecerá aqui...
                  </span>
                )}
              </p>
              <div className="create-post__preview-meta">
                <span>{currentUser?.full_name}</span>
                <span>·</span>
                <span>
                  {new Date().toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              {coverPreview && (
                <img
                  className="create-post__preview-img"
                  src={coverPreview}
                  alt="Capa do artigo"
                />
              )}
              {form.body && (
                <div className="create-post__preview-content article-body">
                  {/* Mesmo parser do Article.tsx — preview ao vivo da
                      sintaxe markdown leve (> blockquote, ## h2, dropcap). */}
                  {renderArticleBody(form.body, currentUser?.full_name)}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
