'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiArrowLeft, FiChevronLeft, FiChevronRight, FiDownload, FiShield } from 'react-icons/fi';
import { AlertBanner } from '@/components/common/AlertBanner';
import { ScrollableTable } from '@/components/common/ScrollableTable';
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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatDateGroupLabel(date: Date) {
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Groups audit entries into consecutive day buckets so long histories stay scannable. */
function groupEntriesByDay(items: AuditEntry[]) {
  const groups: { key: string; label: string; items: AuditEntry[] }[] = [];
  for (const entry of items) {
    const date = new Date(entry.timestamp);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(entry);
    } else {
      groups.push({ key, label: formatDateGroupLabel(date), items: [entry] });
    }
  }
  return groups;
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
  const formatAuditDate = (timestamp: string) => ({
    date: new Date(timestamp).toLocaleDateString('es-CL'),
    time: new Date(timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
  });

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
            <div className="space-y-5 sm:hidden">
              {data.items.length === 0 ? (
                <div className="portal-card text-center text-sm text-ink-muted">
                  Todavía no hay registros de acceso disponibles.
                </div>
              ) : (
                groupEntriesByDay(data.items).map((group) => (
                  <section key={group.key} className="space-y-3">
                    <h2 className="sticky top-0 z-10 -mx-1 rounded-pill bg-surface-base/85 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-muted backdrop-blur supports-[backdrop-filter]:bg-surface-base/70">
                      {group.label}
                    </h2>
                    {group.items.map((entry) => {
                      const actorInitials = entry.actorInitials?.trim() || '?';
                      const formatted = formatAuditDate(entry.timestamp);
                      return (
                        <article key={entry.id} className="portal-card space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink">
                                {ENTITY_LABELS[entry.entityType] ?? entry.entityType}
                              </p>
                              <p className="mt-1 text-xs text-ink-muted">
                                {formatted.time}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              entry.result === 'SUCCESS'
                                ? 'bg-status-green/20 text-status-green-text'
                                : 'bg-status-red/15 text-status-red-text'
                            }`}>
                              {entry.result === 'SUCCESS' ? 'Exitoso' : 'Fallido'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-t border-surface-muted/45 pt-3">
                            <span className="text-sm text-ink-secondary">
                              {ACTION_LABELS[entry.action] ?? entry.action}
                            </span>
                            <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-ink-secondary">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-surface-muted/60 bg-surface-inset text-[10px] font-bold">
                                {actorInitials}
                              </span>
                              <span className="truncate">{ROLE_LABELS[entry.actorRole] ?? entry.actorRole}</span>
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </section>
                ))
              )}
            </div>

            <ScrollableTable aria-label="Historial de accesos con desplazamiento horizontal" className="portal-table-shell hidden sm:block">
              <table className="min-w-[760px] w-full text-sm">
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
                  {data.items.map((entry) => {
                    const actorInitials = entry.actorInitials?.trim() || '?';
                    const formatted = formatAuditDate(entry.timestamp);
                    return (
                      <tr key={entry.id} className="hover:bg-surface-inset">
                        <td className="whitespace-nowrap px-4 py-3 text-ink">
                          {formatted.date}{' '}
                          <span className="text-ink-muted">
                            {formatted.time}
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
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-surface-muted/60 bg-surface-inset text-[10px] font-bold text-ink-secondary">
                              {actorInitials}
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
                    );
                  })}
                </tbody>
              </table>
            </ScrollableTable>

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
