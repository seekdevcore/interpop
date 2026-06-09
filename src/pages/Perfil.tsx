/**
 * Página de perfil do usuário logado.
 *
 * 3 seções independentes (cada uma com Save próprio):
 *   1. Informações pessoais — first_name, last_name, bio (PATCH /api/auth/me/)
 *   2. Avatar — upload de imagem (PATCH multipart)
 *   3. Senha — current_password + new_password (POST /api/auth/me/password/)
 *
 * Email é mostrado mas NÃO editável aqui: mudar email exige confirmação
 * por novo email (fluxo separado, fora do MVP). Aviso visível para o user.
 */
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { authService, type ApiUser } from '../services/authService';
import { extractApiError } from '../utils/extractApiError';
import { PasswordChecklist } from '../components/ui/PasswordChecklist';
import { isPasswordStrong } from '../utils/passwordRules';
import './Perfil.css';

interface InfoForm {
  username: string;
  first_name: string;
  last_name: string;
  bio: string;
}

interface PasswordForm {
  current: string;
  next: string;
  next2: string;
}

export function Perfil() {
  const { currentUser, isLoading, refreshUser } = useAuth();

  // Estado local que sincroniza com currentUser. Permite editar sem alterar
  // o context imediatamente — só atualiza ao salvar com sucesso.
  const [info, setInfo] = useState<InfoForm>({
    username: '',
    first_name: '',
    last_name: '',
    bio: '',
  });
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoFeedback, setInfoFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [pwForm, setPwForm] = useState<PasswordForm>({
    current: '',
    next: '',
    next2: '',
  });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwFeedback, setPwFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  // Sincroniza form com currentUser quando ele carrega
  useEffect(() => {
    if (currentUser) {
      setInfo({
        username: currentUser.username ?? '',
        first_name: currentUser.first_name,
        last_name: currentUser.last_name,
        bio: currentUser.bio ?? '',
      });
      // Avatar URL atual (do backend) — só seta se ainda não houver preview local
      if (!avatarFile && currentUser.avatar) {
        setAvatarPreview(currentUser.avatar);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Cleanup do blob URL quando muda
  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  // Guard: loading inicial OU não logado
  if (isLoading) {
    return (
      <PageLayout>
        <div className="container-sm perfil-loading">Carregando…</div>
      </PageLayout>
    );
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (infoSaving) return;
    setInfoSaving(true);
    setInfoFeedback(null);
    try {
      const updated = await authService.updateProfile({
        username: info.username.trim(),
        first_name: info.first_name.trim(),
        last_name: info.last_name.trim(),
        bio: info.bio.trim(),
      });
      setInfoFeedback({
        type: 'success',
        msg: 'Informações atualizadas.',
      });
      // Atualiza valor local com retorno do backend (canônico)
      const u = updated.data as ApiUser;
      setInfo({
        username: u.username ?? '',
        first_name: u.first_name,
        last_name: u.last_name,
        bio: u.bio ?? '',
      });
      // Propaga para o AuthContext → Navbar reflete o nome novo imediatamente
      await refreshUser();
    } catch (err) {
      setInfoFeedback({
        type: 'error',
        msg: extractApiError(err, 'Erro ao salvar informações.'),
      });
    } finally {
      setInfoSaving(false);
    }
  }

  function handleAvatarFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    // Limite básico de 2MB (avatar não precisa ser grande)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarFeedback({
        type: 'error',
        msg: 'Imagem grande demais. Máximo 2MB.',
      });
      return;
    }
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarFeedback(null);
  }

  async function handleSaveAvatar() {
    if (!avatarFile || avatarSaving) return;
    setAvatarSaving(true);
    setAvatarFeedback(null);
    try {
      await authService.updateProfile({ avatar: avatarFile });
      // Propaga para o AuthContext → Navbar pega a nova URL do avatar
      // automaticamente. Sem reload necessário.
      await refreshUser();
      setAvatarFeedback({
        type: 'success',
        msg: 'Avatar atualizado.',
      });
      setAvatarFile(null); // limpa file pra próximo upload
    } catch (err) {
      setAvatarFeedback({
        type: 'error',
        msg: extractApiError(err, 'Erro ao enviar avatar.'),
      });
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwSaving) return;
    if (pwForm.next !== pwForm.next2) {
      setPwFeedback({ type: 'error', msg: 'As senhas novas não coincidem.' });
      return;
    }
    if (!isPasswordStrong(pwForm.next)) {
      setPwFeedback({
        type: 'error',
        msg: 'A nova senha não atende a todos os requisitos de segurança.',
      });
      return;
    }
    setPwSaving(true);
    setPwFeedback(null);
    try {
      await authService.changePassword(pwForm.current, pwForm.next);
      setPwFeedback({
        type: 'success',
        msg: 'Senha alterada. Sessão atual continua válida.',
      });
      setPwForm({ current: '', next: '', next2: '' });
    } catch (err) {
      setPwFeedback({
        type: 'error',
        msg: extractApiError(err, 'Erro ao alterar senha.'),
      });
    } finally {
      setPwSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PageLayout>
      <section className="perfil-page" aria-labelledby="perfil-title">
        <div className="container-sm">
          <header className="perfil-page__header">
            <h1 id="perfil-title" className="perfil-page__title">
              Meu perfil
            </h1>
            <p className="perfil-page__subtitle">
              Gerencie suas informações públicas, avatar e senha.
            </p>
          </header>

          {/* ── Seção 1: Informações pessoais ── */}
          <form
            onSubmit={handleSaveInfo}
            className="perfil-card"
            aria-labelledby="info-heading"
          >
            <header className="perfil-card__header">
              <h2 id="info-heading">Informações pessoais</h2>
              <p>Aparecem em artigos, comentários e perfil público.</p>
            </header>

            <div className="perfil-card__body">
              <div className="perfil-grid">
                <Input
                  id="perfil-first-name"
                  label="Nome"
                  value={info.first_name}
                  onChange={(e) =>
                    setInfo((f) => ({ ...f, first_name: e.target.value }))
                  }
                  required
                  autoComplete="given-name"
                />
                <Input
                  id="perfil-last-name"
                  label="Sobrenome"
                  value={info.last_name}
                  onChange={(e) =>
                    setInfo((f) => ({ ...f, last_name: e.target.value }))
                  }
                  required
                  autoComplete="family-name"
                />
              </div>

              <Input
                id="perfil-username"
                label="Nome de usuário"
                value={info.username}
                onChange={(e) =>
                  setInfo((f) => ({ ...f, username: e.target.value }))
                }
                autoComplete="username"
                required
              />
              <p className="perfil-card__hint">
                Identificador público único. Aparece como @
                {info.username || 'seu_usuario'} abaixo do seu nome em
                comentários e artigos.
              </p>

              <div className="input-field">
                <label htmlFor="bio" className="input-label">
                  Bio <span className="perfil-card__optional">(opcional)</span>
                </label>
                <textarea
                  id="bio"
                  className="perfil-textarea"
                  rows={3}
                  maxLength={500}
                  value={info.bio}
                  onChange={(e) =>
                    setInfo((f) => ({ ...f, bio: e.target.value }))
                  }
                  placeholder="Conte um pouco sobre você (até 500 caracteres)…"
                />
                <p className="perfil-card__hint">{info.bio.length} / 500</p>
              </div>

              {/* Email readonly */}
              <div className="input-field">
                <label className="input-label">E-mail</label>
                <input
                  type="email"
                  value={currentUser.email ?? ''}
                  readOnly
                  className="perfil-readonly"
                />
                <p className="perfil-card__hint">
                  Para alterar o e-mail, contate o suporte (mudança exige
                  confirmação por novo e-mail).
                </p>
              </div>

              {infoFeedback && (
                <p
                  className={`perfil-feedback perfil-feedback--${infoFeedback.type}`}
                  role={infoFeedback.type === 'error' ? 'alert' : 'status'}
                >
                  {infoFeedback.msg}
                </p>
              )}
            </div>

            <footer className="perfil-card__footer">
              <Button
                type="submit"
                variant="primary"
                disabled={
                  infoSaving ||
                  !info.username.trim() ||
                  !info.first_name ||
                  !info.last_name
                }
              >
                {infoSaving ? 'Salvando…' : 'Salvar informações'}
              </Button>
            </footer>
          </form>

          {/* ── Seção 2: Avatar ── */}
          <div className="perfil-card" aria-labelledby="avatar-heading">
            <header className="perfil-card__header">
              <h2 id="avatar-heading">Avatar</h2>
              <p>JPG, PNG ou WebP, até 2MB. Aparece em comentários e perfil.</p>
            </header>

            <div className="perfil-card__body perfil-avatar-body">
              <div className="perfil-avatar-preview" aria-hidden="true">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" />
                ) : (
                  <span>{currentUser.avatar_initial}</span>
                )}
              </div>

              <div className="perfil-avatar-actions">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="perfil-avatar-input"
                  onChange={handleAvatarFileSelected}
                  aria-label="Selecionar nova imagem de avatar"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarFile ? 'Trocar arquivo' : 'Escolher imagem'}
                </Button>
                {avatarFile && (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={avatarSaving}
                    onClick={handleSaveAvatar}
                  >
                    {avatarSaving ? 'Enviando…' : 'Salvar avatar'}
                  </Button>
                )}
                {avatarFeedback && (
                  <p
                    className={`perfil-feedback perfil-feedback--${avatarFeedback.type}`}
                    role={avatarFeedback.type === 'error' ? 'alert' : 'status'}
                  >
                    {avatarFeedback.msg}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Seção 3: Senha ── */}
          <form
            onSubmit={handleChangePassword}
            className="perfil-card"
            aria-labelledby="pw-heading"
          >
            <header className="perfil-card__header">
              <h2 id="pw-heading">Alterar senha</h2>
              <p>
                Por segurança, exige sua senha atual. A nova senha precisa
                cumprir todos os requisitos abaixo.
              </p>
            </header>

            <div className="perfil-card__body">
              <Input
                id="perfil-pw-current"
                label="Senha atual"
                type="password"
                value={pwForm.current}
                onChange={(e) =>
                  setPwForm((f) => ({ ...f, current: e.target.value }))
                }
                autoComplete="current-password"
                required
              />
              <Input
                id="perfil-pw-new"
                label="Nova senha"
                type="password"
                value={pwForm.next}
                onChange={(e) =>
                  setPwForm((f) => ({ ...f, next: e.target.value }))
                }
                autoComplete="new-password"
                required
              />
              <PasswordChecklist value={pwForm.next} />
              <Input
                id="perfil-pw-new2"
                label="Confirmar nova senha"
                type="password"
                value={pwForm.next2}
                onChange={(e) =>
                  setPwForm((f) => ({ ...f, next2: e.target.value }))
                }
                autoComplete="new-password"
                required
              />

              {pwFeedback && (
                <p
                  className={`perfil-feedback perfil-feedback--${pwFeedback.type}`}
                  role={pwFeedback.type === 'error' ? 'alert' : 'status'}
                >
                  {pwFeedback.msg}
                </p>
              )}
            </div>

            <footer className="perfil-card__footer">
              <Button
                type="submit"
                variant="primary"
                disabled={
                  pwSaving ||
                  !pwForm.current ||
                  !isPasswordStrong(pwForm.next) ||
                  pwForm.next !== pwForm.next2
                }
              >
                {pwSaving ? 'Alterando…' : 'Alterar senha'}
              </Button>
            </footer>
          </form>
        </div>
      </section>
    </PageLayout>
  );
}
