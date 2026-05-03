'use client';

import { useQuery } from '@tanstack/react-query';
import { FiAlertCircle } from 'react-icons/fi';
import { api } from '@/lib/api';
import { LEGAL_DOCUMENT_LABELS, type LegalDocumentPublic, type LegalDocumentType } from '@/lib/legal-content';
import LegalDocumentPage from './LegalDocumentPage';

interface LegalDocumentLoaderProps {
  type: LegalDocumentType;
}

export default function LegalDocumentLoader({ type }: LegalDocumentLoaderProps) {
  const documentQuery = useQuery({
    queryKey: ['legal-document', type, 'current'],
    queryFn: async () => {
      const response = await api.get(`/legal/documents/${type}/current`);
      return response.data as LegalDocumentPublic;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (documentQuery.isLoading) {
    return (
      <main className="legal-shell">
        <div className="legal-document mx-auto mt-10 max-w-3xl">
          <div className="legal-hero">
            <p className="legal-version">Documento vigente</p>
            <h1>{LEGAL_DOCUMENT_LABELS[type]}</h1>
            <p className="legal-description">Cargando versión publicada...</p>
          </div>
        </div>
      </main>
    );
  }

  if (documentQuery.isError || !documentQuery.data) {
    return (
      <main className="legal-shell">
        <section className="legal-document mx-auto mt-10 max-w-3xl" aria-labelledby="legal-unavailable-title">
          <div className="legal-hero">
            <p className="legal-version">Documento no disponible</p>
            <h1 id="legal-unavailable-title">{LEGAL_DOCUMENT_LABELS[type]}</h1>
            <p className="legal-description">
              No hay una versión publicada disponible en este momento. Contacta al administrador del espacio clínico.
            </p>
          </div>
          <div className="legal-summary">
            <div className="legal-summary-item">
              <FiAlertCircle className="h-4 w-4" aria-hidden="true" />
              <p>El registro queda bloqueado hasta que exista una versión vigente publicada.</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return <LegalDocumentPage document={documentQuery.data} />;
}
