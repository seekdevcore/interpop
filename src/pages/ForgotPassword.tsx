import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { authService } from '../services/authService';
import './Auth.css';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.requestPasswordReset(email);
      setSent(true);
    } catch {
      setError('Não foi possível processar a solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout
        heading="Verifique seu e-mail"
        subheading="Se o endereço existir, você receberá as instruções em instantes."
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
          <p>
            Confira sua caixa de entrada (e a pasta de spam, se necessário).
          </p>
          <Link
            to="/login"
            className="btn btn--primary btn--md"
            style={{ marginTop: '1rem', display: 'inline-block' }}
          >
            Voltar para o login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading="Recuperar senha"
      subheading="Informe seu e-mail e enviaremos um link para criar uma nova senha."
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={loading || !email.trim()}
        >
          {loading ? 'Enviando…' : 'Enviar link de recuperação'}
        </Button>
      </form>

      <p className="auth-switch">
        Lembrou a senha?{' '}
        <Link to="/login" className="auth-link auth-link--strong">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
