import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import './PageLayout.css';

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="page-layout">
      {/* Skip link: invisível até receber foco via Tab. Permite usuários
          de teclado/leitor de tela pular toda a Navbar (5+ links) e ir
          direto pro conteúdo. WCAG 2.4.1 (Bypass Blocks). Item U1 do
          Improvement-system.md §11.4. */}
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <Navbar />
      <main id="main" className="page-layout__main">
        {children}
      </main>
      <Footer />
    </div>
  );
}
