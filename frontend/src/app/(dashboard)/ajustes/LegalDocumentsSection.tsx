import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LEGAL_DOCUMENT_VERSION } from '../../../../../shared/legal-contract';

type LegalAcceptancesResponse = {
  currentVersion: string;
  documents: Array<{
    type: 'TERMS' | 'PRIVACY';
    label: string;
    currentVersion: string;
    latestAccepted: {
      documentType: string;
      version: string;
      acceptedAt: string;
    } | null;
  }>;
};

const LEGAL_DOCUMENT_LINKS: Record<'TERMS' | 'PRIVACY', string> = {
  TERMS: '/terminos-y-condiciones',
  PRIVACY: '/politica-de-privacidad',
};

export default function LegalDocumentsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['legal-acceptances', 'me'],
    queryFn: async () => {
      const response = await api.get('/legal/acceptances/me');
      return response.data as LegalAcceptancesResponse;
    },
  });

  const documents = data?.documents ?? [
    {
      type: 'TERMS' as const,
      label: 'Términos y Condiciones de Servicio',
      currentVersion: LEGAL_DOCUMENT_VERSION,
      latestAccepted: null,
    },
    {
      type: 'PRIVACY' as const,
      label: 'Política de Privacidad',
      currentVersion: LEGAL_DOCUMENT_VERSION,
      latestAccepted: null,
    },
  ];

  return (
    <div className="card mb-6">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Documentos legales</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Versiones vigentes y registro de aceptación asociado a tu cuenta.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {documents.map((document) => {
          const accepted = document.latestAccepted;
          const acceptedDate = accepted
            ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(new Date(accepted.acceptedAt))
            : null;

          return (
            <div key={document.type} className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{document.label}</p>
                  <p className="mt-1 text-xs text-ink-muted">Versión vigente {document.currentVersion}</p>
                </div>
                <Link href={LEGAL_DOCUMENT_LINKS[document.type]} className="panel-link">
                  Ver documento
                </Link>
              </div>

              <p className="mt-4 text-sm text-ink-secondary">
                {isLoading
                  ? 'Consultando aceptación...'
                  : accepted && accepted.version === document.currentVersion
                    ? `Aceptado el ${acceptedDate}`
                    : 'Sin aceptación vigente registrada para esta versión.'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
