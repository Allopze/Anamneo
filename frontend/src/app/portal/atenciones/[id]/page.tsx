'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FiArrowLeft, FiDownload } from 'react-icons/fi';
import { portalApi, getErrorMessage } from '@/lib/portal-api';

type PortalEncounter = {
  id: string;
  fecha: string;
  status: string;
  motivoConsulta: string | null;
  tipoAtencion: string | null;
  medico?: { nombre: string } | null;
  sections: Array<{ id: string; sectionKey: string; data: unknown; completed: boolean; notApplicable: boolean }>;
  attachments: Array<{ id: string; originalName: string; mime: string; size: number; uploadedAt: string }>;
};

export default function PortalEncounterPage() {
  const { id } = useParams<{ id: string }>();
  const [encounter, setEncounter] = useState<PortalEncounter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi.get<PortalEncounter>(`/portal/encounters/${id}`)
      .then((res) => setEncounter(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  const handleDownloadPdf = async () => {
    try {
      const res = await portalApi.get(`/portal/encounters/${id}/export/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ficha-clinica.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <main className="portal-page">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="portal-icon-button" aria-label="Volver al portal">
              <FiArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="portal-title">Ficha de atención</h1>
              <p className="portal-copy">
                {encounter ? new Date(encounter.fecha).toLocaleDateString('es-CL') : 'Cargando...'}
              </p>
            </div>
          </div>
          <button onClick={handleDownloadPdf} className="portal-button-primary">
            <FiDownload className="h-4 w-4" />
            Descargar PDF
          </button>
        </header>

        {error && <div className="portal-alert-error">{error}</div>}

        {encounter && (
          <section className="portal-card">
            <h2 className="text-lg font-semibold text-ink">
              {encounter.motivoConsulta || encounter.tipoAtencion || 'Atención clínica'}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{encounter.medico?.nombre ?? 'Equipo clínico'} · {encounter.status}</p>
            <div className="mt-5 space-y-4">
              {encounter.sections.map((section) => (
                <article key={section.id} className="rounded-lg border border-surface-muted/70 p-3">
                  <h3 className="text-sm font-semibold text-ink">{section.sectionKey.replaceAll('_', ' ')}</h3>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-inset p-3 text-xs text-ink-secondary">
                    {JSON.stringify(section.data, null, 2)}
                  </pre>
                </article>
              ))}
            </div>
            {encounter.attachments.length > 0 && (
              <div className="mt-5 rounded-lg border border-surface-muted/70 p-3">
                <h3 className="text-sm font-semibold text-ink">Adjuntos asociados</h3>
                <ul className="mt-2 space-y-2 text-sm text-ink-secondary">
                  {encounter.attachments.map((attachment) => (
                    <li key={attachment.id} className="flex justify-between gap-3">
                      <span>{attachment.originalName}</span>
                      <span className="text-xs text-ink-muted">{attachment.mime}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
