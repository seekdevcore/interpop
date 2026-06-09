import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LegalContent } from '@/pages/Legal/LegalContent';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { extractApiError } from '@/utils/extractApiError';
import { PasswordChecklist } from '@/components/ui/PasswordChecklist';
import { isPasswordStrong } from '@/utils/passwordRules';
import './Auth.css';

interface RegisterForm {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  confirm: string;
}

/** Qual documento legal está aberto no modal — `null` significa fechado. */
type OpenDoc = null | 'termos' | 'privacidade';

export function Register() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState<RegisterForm>({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [agreed, setAgreed] = useState(false);
  const [openDoc, setOpenDoc] = useState<OpenDoc>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set =
    (field: keyof RegisterForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const passwordMismatch =
    form.confirm !== '' && form.confirm !== form.password;
  const passwordWeak = !isPasswordStrong(form.password);

  // Cadastro real: POST /auth/register/ (seta cookie httpOnly + emite tokens),
  // depois refreshUser() carrega o usuário no contexto via /auth/me/, então
  // navega autenticado pra home. Aceite dos termos + senhas batendo são
  // pré-requisito (botão disabled), mas revalidamos aqui por segurança.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordMismatch || passwordWeak || !agreed || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await authService.register({
        email: form.email.trim(),
        username: form.username.trim(),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        password: form.password,
        password2: form.confirm,
      });
      await refreshUser();
      navigate('/');
    } catch (err: unknown) {
      setError(extractApiError(err, 'Não foi possível criar a conta.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      heading="Criar conta"
      subheading="Junte-se à Interpop e leia sem limites."
    >
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <p className="auth-section-label">Informações pessoais</p>

        <div className="auth-form__row auth-form__row--cols">
          <Input
            id="firstName"
            type="text"
            label="Nome"
            placeholder="João"
            value={form.firstName}
            onChange={set('firstName')}
            autoComplete="given-name"
            required
          />
          <Input
            id="lastName"
            type="text"
            label="Sobrenome"
            placeholder="Silva"
            value={form.lastName}
            onChange={set('lastName')}
            autoComplete="family-name"
            required
          />
        </div>

        <Input
          id="username"
          type="text"
          label="Nome de usuário"
          placeholder="joaosilva"
          value={form.username}
          onChange={set('username')}
          autoComplete="username"
          required
        />

        <Input
          id="email"
          type="email"
          label="E-mail"
          placeholder="seu@email.com"
          value={form.email}
          onChange={set('email')}
          autoComplete="email"
          required
        />

        <p className="auth-section-label">Segurança</p>

        <Input
          id="password"
          type="password"
          label="Senha"
          placeholder="Crie uma senha forte"
          value={form.password}
          onChange={set('password')}
          autoComplete="new-password"
          required
        />
        <PasswordChecklist value={form.password} />
        <Input
          id="confirm"
          type="password"
          label="Confirmar senha"
          placeholder="Repita a senha"
          value={form.confirm}
          onChange={set('confirm')}
          error={passwordMismatch ? 'As senhas não coincidem.' : undefined}
          autoComplete="new-password"
          required
        />

        <label className="auth-checkbox">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            required
          />
          Aceito os{' '}
          <button
            type="button"
            className="auth-link auth-link--btn"
            onClick={() => setOpenDoc('termos')}
          >
            Termos de uso
          </button>{' '}
          e a{' '}
          <button
            type="button"
            className="auth-link auth-link--btn"
            onClick={() => setOpenDoc('privacidade')}
          >
            Política de privacidade
          </button>
        </label>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={!agreed || passwordMismatch || passwordWeak || submitting}
        >
          {submitting ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>

      <p className="auth-switch">
        Já tem uma conta?{' '}
        <Link to="/login" className="auth-link auth-link--strong">
          Entrar
        </Link>
      </p>

      {/* Modais de documento legal — leitura rápida sem sair do fluxo de
          cadastro. As páginas dedicadas /termos e /privacidade (linkadas no
          footer) renderizam o mesmo conteúdo para SEO/compartilhamento. */}
      <Modal
        open={openDoc === 'termos'}
        onClose={() => setOpenDoc(null)}
        title="Termos de uso"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenDoc(null)}>
              Fechar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setAgreed(true);
                setOpenDoc(null);
              }}
            >
              Li e aceito
            </Button>
          </>
        }
      >
        <LegalContent type="termos" />
      </Modal>

      <Modal
        open={openDoc === 'privacidade'}
        onClose={() => setOpenDoc(null)}
        title="Política de privacidade"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenDoc(null)}>
              Fechar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setAgreed(true);
                setOpenDoc(null);
              }}
            >
              Li e aceito
            </Button>
          </>
        }
      >
        <LegalContent type="privacidade" />
      </Modal>
    </AuthLayout>
  );
}
