import { PageLayout } from '@/components/layout/PageLayout';
import { AboutContent } from './AboutContent';
import './About.css';

/**
 * "Sobre" — página dedicada (rota /sobre).
 *
 * Wrapper editorial com PageLayout + header com eyebrow + título grande.
 * O corpo (manifesto, pilares, CTA) é delegado a <AboutContent>, que
 * também é reutilizado no modal "Sobre" do footer de auth.
 */
export function About() {
  return (
    <PageLayout>
      <article className="about-page">
        <div className="container-sm">
          <header className="about-page__header">
            <p className="about-page__eyebrow">Sobre o projeto</p>
            <h1 className="about-page__title">
              Cultura pop como <em>arena geopolítica</em>.
            </h1>
          </header>
          <AboutContent />
        </div>
      </article>
    </PageLayout>
  );
}
