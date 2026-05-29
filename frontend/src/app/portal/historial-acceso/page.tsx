'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiArrowLeft, FiChevronLeft, FiChevronRight, FiDownload, FiShield } from 'react-icons/fi';
import { AlertBanner } from '@/components/common/AlertBanner';
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
    <main className="portal-page">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="portal-header">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="portal-icon-button" aria-label="Volver al portal">
              <FiArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <FiShield className="h-5 w-5 text-ink-muted" />
              <h1 className="portal-title-sm">Historial de accesos a mi ficha</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting}
            className="portal-button-secondary"
          >
            <FiDownload className="h-4 w-4" />
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
        </header>

        <p className="portal-copy">
          Aquí puedes ver quién accedió o modificó tu ficha clínica. Los actores se muestran solo con su rol e iniciales para proteger la privacidad del personal.
        </p>

        {error && (
          <AlertBanner variant="error" message={error} />
        )}

        {loading && (
          <div className="portal-table-shell space-y-0 p-4" aria-busy="true" aria-label="Cargando historial">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="grid gap-3 border-b border-surface-muted/60 py-3 last:border-b-0 sm:grid-cols-5">
                <div className="h-4 w-28 skeleton" />
                <div className="h-4 w-32 skeleton" />
                <div className="h-4 w-24 skeleton" />
                <div className="h-4 w-20 skeleton" />
                <div className="h-4 w-16 skeleton" />
              </div>
            ))}
          </div>
        )}

        {data && !loading && (
          <>
            <div className="portal-table-shell">
              <table className="w-full text-sm">
                <thead className="bg-surface-inset text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-ink-secondary">Fecha y hora</th>
                    <th className="px-4 py-3 font-semibold text-ink-secondary">Sección</th>
                    <th className="px-4 py-3 font-semibold text-ink-secondary">Acción</th>
                    <th className="px-4 py-3 font-semibold text-ink-secondary">Actor</th>
                    <th className="px-4 py-3 font-semibold text-ink-secondary">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-muted/70">
                  {data.items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-ink-muted">
                        Todavía no hay registros de acceso disponibles.
                      </td>
                    </tr>
                  )}
                  {data.items.map((entry) => (
                    <tr key={entry.id} className="hover:bg-surface-inset">
                      <td className="whitespace-nowrap px-4 py-3 text-ink">
                        {new Date(entry.timestamp).toLocaleDateString('es-CL')}{' '}
                        <span className="text-ink-muted">
                          {new Date(entry.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">
                        {ENTITY_LABELS[entry.entityType] ?? entry.entityType}
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted text-[10px] font-bold text-ink-secondary">
                            {entry.actorInitials}
                          </span>
                          <span className="text-ink-secondary">
                            {ROLE_LABELS[entry.actorRole] ?? entry.actorRole}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          entry.result === 'SUCCESS'
                            ? 'bg-status-green/20 text-status-green-text'
                            : 'bg-status-red/15 text-status-red-text'
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
                <p className="text-sm text-ink-muted">
                  {data.total} registros · Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="portal-icon-button"
                    aria-label="Página anterior"
                  >
                    <FiChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="portal-icon-button"
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
