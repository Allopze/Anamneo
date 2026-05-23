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
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="rounded-md border border-slate-300 p-2 text-slate-600">
              <FiArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Ficha de atención</h1>
              <p className="text-sm text-slate-600">
                {encounter ? new Date(encounter.fecha).toLocaleDateString('es-CL') : 'Cargando...'}
              </p>
            </div>
          </div>
          <button onClick={handleDownloadPdf} className="flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm text-white">
            <FiDownload className="h-4 w-4" />
            Descargar PDF
          </button>
        </header>

        {error && <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

        {encounter && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              {encounter.motivoConsulta || encounter.tipoAtencion || 'Atención clínica'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{encounter.medico?.nombre ?? 'Equipo clínico'} · {encounter.status}</p>
            <div className="mt-5 space-y-4">
              {encounter.sections.map((section) => (
                <article key={section.id} className="rounded-md border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">{section.sectionKey.replaceAll('_', ' ')}</h3>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-700">
                    {JSON.stringify(section.data, null, 2)}
                  </pre>
                </article>
              ))}
            </div>
            {encounter.attachments.length > 0 && (
              <div className="mt-5 rounded-md border border-slate-200 p-3">
                <h3 className="text-sm font-semibold text-slate-900">Adjuntos asociados</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {encounter.attachments.map((attachment) => (
                    <li key={attachment.id} className="flex justify-between gap-3">
                      <span>{attachment.originalName}</span>
                      <span className="text-xs text-slate-500">{attachment.mime}</span>
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
