import { PageLayout } from '@/components/layout/PageLayout';
import { LegalContent } from './LegalContent';

export function Privacidade() {
  return (
    <PageLayout>
      <article className="legal-page">
        <div className="container-sm">
          <header className="legal-page__header">
            <p className="legal-page__eyebrow">Documentos</p>
            <h1 className="legal-page__title">Política de Privacidade</h1>
          </header>
          <LegalContent type="privacidade" />
        </div>
      </article>
    </PageLayout>
  );
}
