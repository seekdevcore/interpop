import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authService } from '@/services/authService';
import { PasswordChecklist } from '@/components/ui/PasswordChecklist';
import { isPasswordStrong } from '@/utils/passwordRules';
import './Auth.css';

export function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!isPasswordStrong(form.password)) {
      setError('A senha não atende a todos os requisitos de segurança.');
      return;
    }
    if (!token) {
      setError('Link de recuperação inválido.');
      return;
    }

    setLoading(true);
    try {
      await authService.confirmPasswordReset(token, form.password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } })
        ?.response?.data;
      const msg =
        data?.token?.[0] ??
        data?.new_password?.[0] ??
        'Não foi possível redefinir a senha.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout
        heading="Senha redefinida!"
        subheading="Você será redirecionado para o login em instantes."
      >
        <div className="auth-success">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#16a34a"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>Sua senha foi atualizada com sucesso.</p>
          <Link
            to="/login"
            className="btn btn--primary btn--md"
            style={{ marginTop: '1rem', display: 'inline-block' }}
          >
            Ir para o login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading="Nova senha"
      subheading="Escolha uma senha forte com pelo menos 8 caracteres."
    >
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <div className="auth-password-field">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            label="Nova senha"
            placeholder="Mínimo 8 caracteres"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        <PasswordChecklist value={form.password} />

        <Input
          id="confirm"
          type={showPassword ? 'text' : 'password'}
          label="Confirmar nova senha"
          placeholder="Repita a senha"
          value={form.confirm}
          onChange={set('confirm')}
          autoComplete="new-password"
          required
          error={
            form.confirm && form.password !== form.confirm
              ? 'As senhas não coincidem.'
              : undefined
          }
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={
            loading ||
            !isPasswordStrong(form.password) ||
            form.password !== form.confirm
          }
        >
          {loading ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>
    </AuthLayout>
  );
}
