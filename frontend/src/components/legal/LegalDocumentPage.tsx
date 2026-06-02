import Link from 'next/link';
import { FiArrowLeft, FiCheckCircle, FiExternalLink, FiShield } from 'react-icons/fi';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';
import {
  DEFAULT_LEGAL_REFERENCES,
  formatLegalEffectiveDate,
  type LegalDocumentPublic,
} from '@/lib/legal-content';

interface LegalDocumentPageProps {
  document: LegalDocumentPublic;
}

export default function LegalDocumentPage({ document }: LegalDocumentPageProps) {
  const content = document.contentJson;
  const contactEmail = content.contactEmail ?? 'soporte@anamneo.cl';
  const references = content.references?.length ? content.references : DEFAULT_LEGAL_REFERENCES;
  const structuredRows = content.dataCategories?.length
    ? content.dataCategories
    : [
        {
          label: 'Documento',
          examples: document.title,
          purpose: document.description,
        },
        {
          label: 'Vigencia',
          examples: formatLegalEffectiveDate(document.effectiveAt),
          purpose: 'Define la versión aplicable para registro, acceso y operación del espacio clínico.',
        },
        {
          label: 'Contacto',
          examples: contactEmail,
          purpose: 'Canal disponible para consultas o solicitudes relacionadas con este documento.',
        },
      ];

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
                <dd>{document.version}</dd>
              </div>
              <div>
                <dt>Vigencia</dt>
                <dd>{formatLegalEffectiveDate(document.effectiveAt)}</dd>
              </div>
              <div>
                <dt>Contacto</dt>
                <dd>{contactEmail}</dd>
              </div>
            </dl>
          </div>

          <nav className="legal-index" aria-label="Índice">
            {content.sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        <article className="legal-document">
          <section className="legal-hero" aria-labelledby="legal-title">
            <p className="legal-version">Versión {document.version}</p>
            <h1 id="legal-title">{document.title}</h1>
            <p className="legal-description">{document.description}</p>
          </section>

          <section className="legal-summary" aria-label="Resumen">
            {content.summary.map((item) => (
              <div key={item} className="legal-summary-item">
                <FiCheckCircle className="h-4 w-4" aria-hidden="true" />
                <p>{item}</p>
              </div>
            ))}
          </section>

          <section className="legal-data-table" aria-label={content.dataCategories?.length ? 'Categorías de datos' : 'Resumen estructurado'}>
            {structuredRows.map((category) => (
              <div key={category.label} className="legal-data-row">
                <h2>{category.label}</h2>
                <p>{category.examples}</p>
                <p>{category.purpose}</p>
              </div>
            ))}
          </section>

          <div className="legal-section-stack">
            {content.sections.map((section) => (
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
            <p>{content.footerNote ?? 'Documento vigente publicado por el administrador del espacio clínico.'}</p>
            <div className="legal-reference-list">
              {references.map((reference) => (
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
