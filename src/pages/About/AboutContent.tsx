/**
 * AboutContent — corpo do "Sobre o projeto" reutilizado em duas superfícies:
 *
 *   1. Página dedicada /sobre — wrapper com PageLayout + header editorial
 *   2. Modal compacto invocado do footer das telas de auth (login/cadastro)
 *
 * Mantém apenas o conteúdo (manifesto + pilares + CTA), sem header/h1, pra
 * encaixar bem dentro de Modal (que já fornece título via prop).
 *
 * Estilos compartilhados em /pages/About/About.css.
 */
import { Link } from 'react-router-dom';

interface AboutContentProps {
  /** Quando dentro de Modal, queremos que o "Assinar newsletter" feche o
   *  modal antes de navegar — evita CTA pra outra rota com modal aberto. */
  onNavigate?: () => void;
  /** Nível dos títulos das seções. Em /sobre vêm sob o h1 da página → h2
   *  (default). Dentro do Modal (título já é h2) → h3, evitando salto. */
  headingLevel?: 'h2' | 'h3';
}

export function AboutContent({
  onNavigate,
  headingLevel = 'h2',
}: AboutContentProps) {
  const H = headingLevel;
  return (
    <div className="about-content">
      <p className="about-content__lede">
        O Interpop é um projeto independente que busca analisar criticamente o
        Soft Power e seu papel na manutenção da hegemonia global.
      </p>

      <section className="about-content__section">
        <H>Por que existimos</H>
        <p>
          A partir da cultura pop e das dinâmicas midiáticas, o projeto
          investiga como determinados Atores exercem influência política de
          forma indireta no sistema internacional. Música, moda, cinema,
          literatura e cultura digital não são apenas entretenimento — são
          instrumentos de projeção de poder.
        </p>
        <p>
          Nossa missão é dar ferramentas analíticas para que o leitor
          decodifique o que consome diariamente: por trás de uma série de
          streaming, de uma onda musical ou de uma tendência viral, há decisões
          de Estado, interesses econômicos e disputas narrativas.
        </p>
      </section>

      <section className="about-content__section">
        <H>Pilares editoriais</H>
        <ul className="about-content__pillars">
          <li>
            <strong>Música</strong> — circuitos de exportação cultural,
            indústria fonográfica como instrumento diplomático.
          </li>
          <li>
            <strong>Moda</strong> — estética, identidade nacional e capital
            simbólico no sistema-mundo da moda.
          </li>
          <li>
            <strong>Cinema</strong> — narrativas hegemônicas, financiamento
            estatal e disputa pelo imaginário global.
          </li>
          <li>
            <strong>Literatura</strong> — cânones, tradução e o mercado
            editorial como mediador de poder.
          </li>
          <li>
            <strong>Cultura Digital</strong> — plataformas, algoritmos e a
            economia da atenção como nova fronteira do Soft Power.
          </li>
        </ul>
      </section>

      <section className="about-content__section">
        <H>Como contribuir</H>
        <p>
          Receba nossas análises por e-mail e ajude o projeto a crescer. Toda
          publicação é resultado de pesquisa independente — apoio do leitor é o
          que sustenta o trabalho.
        </p>
        <div className="about-content__cta">
          {/* Link estilizado como botão (NÃO <Button><Link>): button>a é HTML
              inválido e fazia a área de padding do botão virar zona morta —
              só o texto do <a> navegava, exigindo cliques repetidos. */}
          <Link
            to="/newsletter"
            onClick={onNavigate}
            className="btn btn--primary btn--lg"
          >
            Assinar newsletter
          </Link>
          <a
            href="mailto:interpop.cc@gmail.com?subject=Contato"
            className="about-content__contact-link"
          >
            Falar com a redação →
          </a>
        </div>
      </section>
    </div>
  );
}
