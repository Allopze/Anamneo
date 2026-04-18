'use client';

import { FiAlertTriangle, FiRefreshCcw } from 'react-icons/fi';
import {
  SEXO_LABELS,
  PREVISION_LABELS,
  type IdentificacionData,
  type EncounterIdentificationSnapshotStatus,
} from '@/types';
import { SectionBlock } from '@/components/sections/SectionPrimitives';
import { formatPatientMissingFields, getIdentificationMissingFields } from '@/lib/patient';

function SnapshotField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <span className="form-label">{label}</span>
      <p className="mt-1 min-h-[44px] rounded-input border border-surface-muted/30 bg-surface-base/40 px-5 py-3 text-sm text-ink">
        {value != null && value !== '' ? value : <span className="text-ink-muted">—</span>}
      </p>
    </div>
  );
}

interface Props {
  data: IdentificacionData;
  onChange: (data: IdentificacionData) => void;
  readOnly?: boolean;
  snapshotStatus?: EncounterIdentificationSnapshotStatus;
  onRestoreFromPatient?: () => void;
}

export default function IdentificacionSection({
  data,
  snapshotStatus,
  onRestoreFromPatient,
}: Props) {
  const missingFieldLabels = formatPatientMissingFields(getIdentificationMissingFields(data));

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-card border border-surface-muted/30 bg-surface-base/40 p-5">
        <p className="text-sm font-medium text-ink-primary">Snapshot administrativo de la atención</p>
        <p className="mt-2 text-sm text-ink-secondary">
          Esta sección representa la identificación usada dentro de esta atención. No se edita aquí: si necesitas corregir el dato maestro, hazlo en la ficha del paciente y luego restaura este snapshot.
        </p>
        {snapshotStatus?.hasDifferences ? (
          <div className="mt-4 rounded-card border border-status-yellow/70 bg-status-yellow/40 p-4 text-sm text-accent-text">
            <div className="flex items-start gap-2">
              <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Se detectó divergencia con la ficha maestra</p>
                <p className="mt-1">Campos con diferencia: {snapshotStatus.differingFieldLabels.join(', ')}.</p>
              </div>
            </div>
            {onRestoreFromPatient ? (
              <button
                type="button"
                onClick={onRestoreFromPatient}
                className="btn btn-secondary mt-3 inline-flex items-center gap-2"
              >
                <FiRefreshCcw className="h-4 w-4" />
                Restaurar desde ficha maestra
              </button>
            ) : null}
          </div>
        ) : null}
        {missingFieldLabels.length > 0 ? (
          <div className="mt-4 rounded-card border border-status-red/35 bg-status-red/10 p-4 text-sm text-status-red-text">
            <div className="flex items-start gap-2">
              <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Identificación incompleta en esta atención</p>
                <p className="mt-1">Faltan campos demográficos clave: {missingFieldLabels.join(', ')}.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <SectionBlock title="Datos personales">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SnapshotField label="Nombre completo" value={data.nombre} />
          <SnapshotField label="RUT" value={data.rutExempt ? (data.rutExemptReason || 'Sin RUT') : data.rut} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <SnapshotField label="Edad (años)" value={data.edad != null ? String(data.edad) : undefined} />
          <SnapshotField label="Meses" value={data.edadMeses != null ? String(data.edadMeses) : undefined} />
          <SnapshotField label="Sexo" value={data.sexo ? SEXO_LABELS[data.sexo] : undefined} />
          <SnapshotField label="Previsión" value={data.prevision ? PREVISION_LABELS[data.prevision] : undefined} />
        </div>
      </SectionBlock>

      <SectionBlock title="Contexto y contacto">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SnapshotField label="Trabajo / Ocupación" value={data.trabajo} />
          <SnapshotField label="Domicilio" value={data.domicilio} />
        </div>
      </SectionBlock>
    </div>
  );
}
