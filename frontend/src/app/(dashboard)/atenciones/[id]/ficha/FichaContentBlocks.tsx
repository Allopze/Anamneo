import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiAlertTriangle, FiShield } from 'react-icons/fi';
import { type Encounter } from '@/types';
export { FichaClinicalRecord } from './FichaClinicalRecord';

interface FichaClinicalAlertsProps {
  patientId: string;
  patientOutputBlockReason: string | null;
  fullRecordBlockedReason: string | null;
}

export function FichaClinicalAlerts({
  patientId,
  patientOutputBlockReason,
  fullRecordBlockedReason,
}: FichaClinicalAlertsProps) {
  return (
    <>
      {patientOutputBlockReason ? (
        <div className="no-print mx-auto mt-4 max-w-4xl px-4">
          <div className="rounded-2xl border border-status-yellow/70 bg-status-yellow/40 p-3 text-sm text-accent-text">
            <p className="font-medium">Salidas clinicas bloqueadas</p>
            <p className="mt-1">{patientOutputBlockReason}</p>
            <Link
              href={`/pacientes/${patientId}`}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-status-yellow/70 px-3 py-1.5 text-xs font-semibold text-accent-text transition-colors hover:bg-status-yellow/55"
            >
              Revisar ficha administrativa
            </Link>
          </div>
        </div>
      ) : null}

      {fullRecordBlockedReason && !patientOutputBlockReason ? (
        <div className="no-print mx-auto mt-4 max-w-4xl px-4">
          <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-3 text-sm text-ink-secondary">
            <p className="font-medium text-ink">PDF clínico completo e impresión aún no disponibles</p>
            <p className="mt-1">{fullRecordBlockedReason}</p>
            <p className="mt-2 text-xs text-ink-muted">
              Las recetas, órdenes y derivaciones siguen disponibles mientras la ficha del paciente esté habilitada.
            </p>
          </div>
        </div>
      ) : null}

      {fullRecordBlockedReason ? (
        <section className="hidden print:block px-8 py-12 text-center text-ink-primary">
          <h1 className="text-2xl font-bold">Impresión bloqueada</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-ink-secondary">
            {fullRecordBlockedReason}
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-ink-secondary">
            Completa o firma la atención y valida la ficha administrativa si corresponde antes de usar el circuito
            oficial de documentos.
          </p>
        </section>
      ) : null}
    </>
  );
}

interface FichaSignaturePanelProps {
  encounter: Encounter;
  canSign: boolean;
  signIsPending: boolean;
  onSign: () => void;
  signatureSummary: Array<{ id: string; label: string; value: string }>;
  signatureDiff: {
    baselineCreatedAt?: string | null;
    totalChanges: number;
    hasChanges: boolean;
    sections: Array<{
      sectionKey: string;
      label: string;
      status: 'new' | 'changed';
      fieldChanges: Array<{ path: string; label: string; before: string; after: string }>;
    }>;
    attachmentChanges: Array<{ kind: 'added' | 'removed'; label: string }>;
  };
}

export function FichaSignaturePanel({
  encounter,
  canSign,
  signIsPending,
  onSign,
  signatureSummary,
  signatureDiff,
}: FichaSignaturePanelProps) {
  return (
    <section className="no-print mx-auto mt-4 max-w-4xl px-4">
      <div className="rounded-card border border-surface-muted/40 bg-surface-elevated">
        <div className="border-b border-surface-muted/35 px-5 py-4">
          <h2 className="text-base font-semibold text-ink">
            {canSign ? 'Resumen previo a firma' : 'Reapertura guiada'}
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            {canSign
              ? 'Revisa qué quedará respaldado por la firma antes de confirmar.'
              : 'Si necesitas corregir la atención, deja trazado el motivo antes de volver a edición.'}
          </p>
        </div>

        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          {signatureSummary.map((item) => (
            <div key={item.id} className="rounded-input border border-surface-muted/35 bg-surface-base/55 px-4 py-3">
              <p className="text-xs font-medium text-ink-muted">{item.label}</p>
              <p className="mt-1 text-sm font-medium text-ink">{item.value}</p>
            </div>
          ))}
        </div>

        {encounter.closureNote ? (
          <div className="border-t border-surface-muted/35 px-5 py-4">
            <p className="text-xs font-medium text-ink-muted">Nota de cierre registrada</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-secondary">{encounter.closureNote}</p>
          </div>
        ) : null}

        <div className="border-t border-surface-muted/35 px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-ink-muted">Diff visible por campo</p>
              <p className="mt-1 text-sm text-ink-secondary">
                {signatureDiff.baselineCreatedAt
                  ? `Comparado contra la atención del ${format(new Date(signatureDiff.baselineCreatedAt), "d 'de' MMMM 'de' yyyy", { locale: es })}.`
                  : 'No existe una atención cerrada previa comparable; se mostrará como contenido nuevo.'}
              </p>
            </div>
            <p className="text-sm font-medium text-ink">
              {signatureDiff.totalChanges} cambio{signatureDiff.totalChanges === 1 ? '' : 's'} detectado{signatureDiff.totalChanges === 1 ? '' : 's'}
            </p>
          </div>

          {canSign ? (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onSign}
                disabled={signIsPending}
                className="btn inline-flex items-center gap-2 border-status-red/40 bg-status-red/15 font-semibold text-status-red-text hover:bg-status-red/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiShield className="h-4 w-4" />
                {signIsPending ? 'Firmando…' : 'Firmar Atención'}
              </button>
            </div>
          ) : null}

          {signatureDiff.hasChanges ? (
            <div className="mt-4 flex flex-col gap-4">
              {signatureDiff.sections.map((section) => (
                <div key={section.sectionKey} className="rounded-input border border-surface-muted/35 bg-surface-base/55 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">{section.label}</p>
                    <span className="text-xs text-ink-muted">
                      {section.status === 'new' ? 'Nueva sección' : `${section.fieldChanges.length} cambios`}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    {section.fieldChanges.map((change) => (
                      <div key={`${section.sectionKey}-${change.path}`} className="border-l border-surface-muted/40 pl-3">
                        <p className="text-xs font-medium text-ink-muted">{change.label}</p>
                        <p className="mt-1 text-sm text-ink-secondary">
                          <span className="font-medium text-ink">Antes:</span> {change.before}
                        </p>
                        <p className="mt-1 text-sm text-ink-secondary">
                          <span className="font-medium text-ink">Ahora:</span> {change.after}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {signatureDiff.attachmentChanges.length > 0 ? (
                <div className="rounded-input border border-surface-muted/35 bg-surface-base/55 px-4 py-3">
                  <p className="text-sm font-medium text-ink">Adjuntos</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {signatureDiff.attachmentChanges.map((change, index) => (
                      <p key={`${change.kind}-${change.label}-${index}`} className="text-sm text-ink-secondary">
                        <span className="font-medium text-ink">{change.kind === 'added' ? 'Agregado' : 'Quitado'}:</span> {change.label}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-secondary">
              No se detectaron diferencias de contenido frente a la última atención cerrada comparable.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
