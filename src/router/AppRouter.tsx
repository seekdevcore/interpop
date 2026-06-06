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
import { Unsubscribe } from '../pages/Unsubscribe';
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
// /buscar carrega TanStack Query usage + mark.js (~15KB gz) que a Home
// não precisa. Lazy mantém o bundle inicial enxuto (ADR-026: CSR no MVP,
// medir LCP baseline). Chunk de Buscar é puro client-side hoje.
const Buscar = lazy(() => import('../pages/Buscar'));

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
          {/* Cancelamento via link do email ({SITE_URL}/newsletter/cancelar/<token>).
              Sem esta rota o link caía no 404 (violação LGPD/CAN-SPAM). */}
          <Route path="/newsletter/cancelar/:token" element={<Unsubscribe />} />
          <Route path="/sobre" element={<About />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/noticia/:slug" element={<Article />} />
          {/* US30.1: busca editorial full-text. Lazy chunk + Suspense
              fallback de skeleton (não "Carregando…" genérico) — espera-se
              hit frequente vindo da navbar futura, então respeitar CLS é
              crítico. Pagina inteira tem seu próprio ErrorBoundary
              interno (resilient sub-tree, ADR-030-FE). */}
          <Route
            path="/buscar"
            element={
              <Suspense fallback={<RouteLoader />}>
                <Buscar />
              </Suspense>
            }
          />
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
