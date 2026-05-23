import { PageLayout } from '@/components/layout/PageLayout';
import { LegalContent } from './LegalContent';

export function Termos() {
  return (
    <PageLayout>
      <article className="legal-page">
        <div className="container-sm">
          <header className="legal-page__header">
            <p className="legal-page__eyebrow">Documentos</p>
            <h1 className="legal-page__title">Termos de Uso</h1>
          </header>
          <LegalContent type="termos" />
        </div>
      </article>
    </PageLayout>
  );
}
