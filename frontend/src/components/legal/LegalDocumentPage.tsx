import Link from 'next/link';
import { FiArrowLeft, FiCheckCircle, FiExternalLink, FiShield } from 'react-icons/fi';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_DOCUMENT_VERSION,
  type LegalDocumentContent,
} from '@/lib/legal-content';

interface LegalDocumentPageProps {
  document: LegalDocumentContent;
}

const LEGAL_REFERENCES = [
  {
    label: 'Ley 19.628',
    href: 'https://www.bcn.cl/leychile/navegar?idLey=19628',
  },
  {
    label: 'Ley 20.584',
    href: 'https://www.bcn.cl/leychile/navegar?idNorma=1039348',
  },
  {
    label: 'Ley 21.719',
    href: 'https://www.bcn.cl/leychile/navegar?idNorma=1209272',
  },
];

export default function LegalDocumentPage({ document }: LegalDocumentPageProps) {
  return (
    <main className="legal-shell">
      <header className="legal-topbar">
        <Link href="/login" className="legal-back-link">
          <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al acceso
        </Link>
        <AnamneoLogo
          className="gap-2"
          iconClassName="h-9 w-9 text-ink"
          textClassName="text-2xl font-extrabold text-ink"
          priority
          inlineIcon
        />
      </header>

      <div className="legal-layout">
        <aside className="legal-aside" aria-label="Resumen del documento">
          <div className="legal-aside-card">
            <div className="legal-aside-icon">
              <FiShield className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="legal-aside-label">Documento vigente</p>
            <p className="legal-aside-title">{document.title}</p>
            <dl className="legal-meta-list">
              <div>
                <dt>Versión</dt>
                <dd>{LEGAL_DOCUMENT_VERSION}</dd>
              </div>
              <div>
                <dt>Vigencia</dt>
                <dd>{LEGAL_EFFECTIVE_DATE}</dd>
              </div>
              <div>
                <dt>Contacto</dt>
                <dd>{LEGAL_CONTACT_EMAIL}</dd>
              </div>
            </dl>
          </div>

          <nav className="legal-index" aria-label="Índice">
            {document.sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        <article className="legal-document">
          <section className="legal-hero" aria-labelledby="legal-title">
            <p className="legal-version">Versión {LEGAL_DOCUMENT_VERSION}</p>
            <h1 id="legal-title">{document.title}</h1>
            <p className="legal-description">{document.description}</p>
          </section>

          <section className="legal-summary" aria-label="Resumen">
            {document.summary.map((item) => (
              <div key={item} className="legal-summary-item">
                <FiCheckCircle className="h-4 w-4" aria-hidden="true" />
                <p>{item}</p>
              </div>
            ))}
          </section>

          {document.dataCategories ? (
            <section className="legal-data-table" aria-label="Categorías de datos">
              {document.dataCategories.map((category) => (
                <div key={category.label} className="legal-data-row">
                  <h2>{category.label}</h2>
                  <p>{category.examples}</p>
                  <p>{category.purpose}</p>
                </div>
              ))}
            </section>
          ) : null}

          <div className="legal-section-stack">
            {document.sections.map((section) => (
              <section key={section.id} id={section.id} className="legal-section">
                <h2>{section.title}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <footer className="legal-footer-note">
            <p>
              Este documento es una base operativa y debe revisarse con asesoría legal antes de usarlo como texto
              contractual definitivo.
            </p>
            <div className="legal-reference-list">
              {LEGAL_REFERENCES.map((reference) => (
                <a key={reference.href} href={reference.href} target="_blank" rel="noreferrer">
                  {reference.label}
                  <FiExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ))}
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}
