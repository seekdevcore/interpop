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

        <div className="auth-form__row auth-form__row--end">
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
