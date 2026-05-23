import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../components/ErrorFallback';
import { Home } from '../pages/Home';
import { News } from '../pages/News';
import { Newsletter } from '../pages/Newsletter';
import { About } from '../pages/About';
import { Termos } from '../pages/Legal/Termos';
import { Privacidade } from '../pages/Legal/Privacidade';
import { Article } from '../pages/Article';
import { Login } from '@/pages/Auth/Login';
import { Register } from '@/pages/Auth/Register';
import { ForgotPassword } from '@/pages/Auth/ForgotPassword';
import { ResetPassword } from '@/pages/Auth/ResetPassword';
import { Perfil } from '../pages/Perfil';
import { NotFound } from '../pages/NotFound';
import { AdminRoute } from './AdminRoute';
import { ScrollToHashOrTop } from './ScrollToHashOrTop';

// Code-split: /admin carrega Recharts (~50KB gz) e MetricsDashboard pesados
// que LEITORES NUNCA VEEM. Lazy import remove esse peso do bundle inicial.
// /criar-publicacao também é cor que só editor/admin acessa.
const Admin = lazy(() =>
  import('../pages/Admin').then((m) => ({ default: m.Admin })),
);
const CreatePost = lazy(() =>
  import('../pages/CreatePost').then((m) => ({ default: m.CreatePost })),
);
const EditPost = lazy(() =>
  import('../pages/CreatePost').then((m) => ({ default: m.EditPost })),
);

/** Spinner mínimo enquanto o chunk lazy carrega. */
function RouteLoader() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--clr-muted)',
        fontSize: 'var(--text-sm)',
      }}
    >
      Carregando…
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToHashOrTop />
      {/* ErrorBoundary global: captura throw em qualquer rota e oferece
          UI de recuperação. Sem isso, um erro em renderArticleBody, Recharts
          ou qualquer effect derrubava a app pra tela branca.
          Item F5 do Improvement-system.md §11.3 (priority matrix top-7). */}
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/noticias" element={<News />} />
          <Route path="/newsletter" element={<Newsletter />} />
          <Route path="/sobre" element={<About />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/noticia/:slug" element={<Article />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="/recuperar-senha" element={<ForgotPassword />} />
          <Route path="/redefinir-senha/:token" element={<ResetPassword />} />
          {/* /perfil: gating de auth feito DENTRO da Perfil.tsx (redireciona
            para /login se não logado). Sem AdminRoute porque qualquer usuário
            autenticado (incluindo leitor comum) pode editar seu próprio perfil. */}
          <Route path="/perfil" element={<Perfil />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Suspense fallback={<RouteLoader />}>
                  <Admin />
                </Suspense>
              </AdminRoute>
            }
          />
          <Route
            path="/criar-publicacao"
            element={
              <AdminRoute>
                <Suspense fallback={<RouteLoader />}>
                  <CreatePost />
                </Suspense>
              </AdminRoute>
            }
          />
          <Route
            path="/editar-publicacao/:slug"
            element={
              <AdminRoute>
                <Suspense fallback={<RouteLoader />}>
                  <EditPost />
                </Suspense>
              </AdminRoute>
            }
          />
          {/* F16: catch-all 404 editorial — voz Interpop, não "Oops" genérico. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
