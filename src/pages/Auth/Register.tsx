import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LegalContent } from '@/pages/Legal/LegalContent';
import './Auth.css';

interface RegisterForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
}

/** Qual documento legal está aberto no modal — `null` significa fechado. */
type OpenDoc = null | 'termos' | 'privacidade';

export function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [agreed, setAgreed] = useState(false);
  const [openDoc, setOpenDoc] = useState<OpenDoc>(null);

  const set =
    (field: keyof RegisterForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const passwordMismatch =
    form.confirm !== '' && form.confirm !== form.password;

  // Gating: signup só ocorre se `agreed` for true E senhas baterem.
  // Aceitação dos termos é PRÉ-REQUISITO legal — sem aceite, navegação
  // bloqueada pelo botão disabled.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordMismatch && agreed) navigate('/');
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
          placeholder="Mínimo 8 caracteres"
          value={form.password}
          onChange={set('password')}
          autoComplete="new-password"
          required
        />
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

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={!agreed || passwordMismatch}
        >
          Criar conta
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
