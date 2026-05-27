'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiArrowLeft, FiChevronLeft, FiChevronRight, FiDownload, FiShield } from 'react-icons/fi';
import { portalApi, getErrorMessage } from '@/lib/portal-api';

const ACTION_LABELS: Record<string, string> = {
  CREAR: 'Creación',
  EDITAR: 'Modificación',
  LEER: 'Consulta',
  ELIMINAR: 'Eliminación',
  EXPORTAR: 'Exportación / descarga',
  FIRMAR: 'Firma',
};

const ENTITY_LABELS: Record<string, string> = {
  Patient: 'Ficha del paciente',
  PatientHistory: 'Antecedentes',
  PatientAllergy: 'Alergias',
  Encounter: 'Atención clínica',
  ClinicalConsent: 'Consentimiento clínico',
  PatientDataProcessingConsent: 'Consentimiento de datos',
  PatientDataRequest: 'Solicitud de datos',
  Attachment: 'Documento adjunto',
};

const ROLE_LABELS: Record<string, string> = {
  MEDICO: 'Médico',
  ASISTENTE: 'Asistente',
  ADMIN: 'Administrador',
};

interface AuditEntry {
  id: string;
  entityType: string;
  action: string;
  reason: string | null;
  result: string;
  timestamp: string;
  actorRole: string;
  actorInitials: string;
}

interface AuditLogResponse {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export default function PortalAuditLogPage() {
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    portalApi
      .get<AuditLogResponse>('/portal/audit-log', { params: { page } })
      .then((res) => {
        setData(res.data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const response = await portalApi.get('/portal/audit-log.csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'historial-acceso.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="rounded p-1.5 hover:bg-slate-100">
              <FiArrowLeft className="h-4 w-4 text-slate-600" />
            </Link>
            <div className="flex items-center gap-2">
              <FiShield className="h-5 w-5 text-slate-400" />
              <h1 className="text-xl font-semibold text-slate-900">Historial de accesos a mi ficha</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <FiDownload className="h-4 w-4" />
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
        </header>

        <p className="text-sm text-slate-600">
          Aquí puedes ver quién accedió o modificó tu ficha clínica. Los actores se muestran solo con su rol e iniciales para proteger la privacidad del personal.
        </p>

        {error && (
          <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        )}

        {loading && (
          <div className="py-12 text-center text-sm text-slate-500">Cargando historial…</div>
        )}

        {data && !loading && (
          <>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-700">Fecha y hora</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Sección</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Acción</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Actor</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500">
                        No hay registros de acceso disponibles.
                      </td>
                    </tr>
                  )}
                  {data.items.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-900">
                        {new Date(entry.timestamp).toLocaleDateString('es-CL')}{' '}
                        <span className="text-slate-500">
                          {new Date(entry.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {ENTITY_LABELS[entry.entityType] ?? entry.entityType}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                            {entry.actorInitials}
                          </span>
                          <span className="text-slate-600">
                            {ROLE_LABELS[entry.actorRole] ?? entry.actorRole}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          entry.result === 'SUCCESS'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {entry.result === 'SUCCESS' ? 'Exitoso' : 'Fallido'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {data.total} registros · Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded border border-slate-300 p-1.5 hover:bg-slate-100 disabled:opacity-40"
                    aria-label="Página anterior"
                  >
                    <FiChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded border border-slate-300 p-1.5 hover:bg-slate-100 disabled:opacity-40"
                    aria-label="Página siguiente"
                  >
                    <FiChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
