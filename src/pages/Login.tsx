import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err: unknown) {
      const e = err as {
        response?: {
          status?: number;
          data?: { non_field_errors?: string[]; detail?: string };
        };
        request?: unknown;
        message?: string;
        code?: string;
      };
      const apiMsg =
        e?.response?.data?.non_field_errors?.[0] ?? e?.response?.data?.detail;
      let msg: string;
      if (apiMsg) {
        msg = apiMsg;
      } else if (e?.response?.status) {
        msg = `Erro inesperado do servidor (HTTP ${e.response.status}). Tente novamente.`;
      } else if (e?.request) {
        // Request sent but no response — backend down, CORS, or network
        msg =
          'Não foi possível alcançar o servidor. Verifique se o backend está rodando.';
      } else {
        msg = e?.message ?? 'Erro inesperado.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Bem-vindo de volta"
      subheading="Entre com sua conta para continuar lendo."
    >
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

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

        <div className="auth-password-field">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            label="Senha"
            placeholder="••••••••"
            value={form.password}
            onChange={set('password')}
            autoComplete="current-password"
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

        <div className="auth-form__row">
          <label className="auth-checkbox">
            <input type="checkbox" /> Lembrar de mim
          </label>
          <Link to="/recuperar-senha" className="auth-link">
            Esqueceu a senha?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={loading}
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </Button>

        <div className="auth-divider">
          <span>ou continue com</span>
        </div>

        <div className="auth-socials">
          <button type="button" className="auth-social-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </button>
          <button type="button" className="auth-social-btn">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden="true"
              fill="#1877F2"
            >
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Facebook
          </button>
        </div>
      </form>

      <p className="auth-switch">
        Não tem uma conta?{' '}
        <Link to="/cadastro" className="auth-link auth-link--strong">
          Criar conta grátis
        </Link>
      </p>
    </AuthLayout>
  );
}
