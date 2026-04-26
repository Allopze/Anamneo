import { FiAlertTriangle } from 'react-icons/fi';
import { type Encounter } from '@/types';
import { formatHistoryFieldText } from '@/lib/clinical';
import {
  formatPatientAge,
  formatPatientPrevision,
  formatPatientRut,
  formatPatientSex,
} from '@/lib/patient';

export function IdentificationSection({
  encounter,
  identificacion,
  identificationMissingFields,
  patientCompletenessMeta,
}: {
  encounter: Encounter;
  identificacion: any;
  identificationMissingFields: string[];
  patientCompletenessMeta: { label: string; description: string } | null;
}) {
  return (
    <section className="mb-8">
      <h2 className="ficha-section-heading">1. Identificación del paciente</h2>
      {identificationMissingFields.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-status-red/35 bg-status-red/10 p-3 text-sm text-status-red-text">
          <div className="flex items-start gap-2">
            <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Identificación incompleta en esta atención</p>
              <p className="mt-1">Faltan campos demográficos clave: {identificationMissingFields.join(', ')}.</p>
            </div>
          </div>
        </div>
      ) : null}
      {encounter.identificationSnapshotStatus?.hasDifferences ? (
        <div className="mb-4 rounded-card border border-status-yellow/70 bg-status-yellow/40 p-3 text-sm text-accent-text">
          <div className="flex items-start gap-2">
            <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Identificación distinta a la ficha del paciente</p>
              <p className="mt-1">
                La identificación de esta atención se mantiene para el documento clínico, pero hoy difiere de la ficha del paciente en: {encounter.identificationSnapshotStatus.differingFieldLabels.join(', ')}.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {patientCompletenessMeta && encounter.patient?.completenessStatus && encounter.patient.completenessStatus !== 'VERIFICADA' ? (
        <div className="mb-4 rounded-card border border-status-yellow/70 bg-status-yellow/40 p-3 text-sm text-accent-text">
          <p className="font-medium">{patientCompletenessMeta.label}</p>
          <p className="mt-1">{patientCompletenessMeta.description}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <p><strong>Nombre:</strong> {identificacion.nombre || '-'}</p>
        <p>
          <strong>RUT:</strong>{' '}
          {formatPatientRut(
            identificacion.rut,
            identificacion.rutExempt ?? encounter.patient?.rutExempt,
            identificacion.rutExemptReason ?? encounter.patient?.rutExemptReason,
          )}
        </p>
        <p><strong>Edad:</strong> {formatPatientAge(identificacion.edad, identificacion.edadMeses)}</p>
        <p><strong>Sexo:</strong> {formatPatientSex(identificacion.sexo)}</p>
        <p><strong>Previsión:</strong> {formatPatientPrevision(identificacion.prevision)}</p>
        <p><strong>Trabajo:</strong> {identificacion.trabajo || '-'}</p>
      </div>
      <p className="mt-2 text-sm"><strong>Domicilio:</strong> {identificacion.domicilio || '-'}</p>
    </section>
  );
}

export function CurrentComplaintSection({ motivoConsulta }: { motivoConsulta: any }) {
  return (
    <section className="mb-8">
      <h2 className="ficha-section-heading">2. Motivo de consulta</h2>
      <div className="rounded-lg bg-surface-base/60 px-4 py-3">
        <p className="text-sm whitespace-pre-wrap">{motivoConsulta.texto || '-'}</p>
      </div>
      {motivoConsulta.afeccionSeleccionada ? (
        <p className="mt-2 text-sm text-ink-secondary">
          <strong>Afección probable:</strong> {motivoConsulta.afeccionSeleccionada.name}
        </p>
      ) : null}
    </section>
  );
}

export function RecentHistorySection({ anamnesisProxima }: { anamnesisProxima: any }) {
  return (
    <section className="mb-8">
      <h2 className="ficha-section-heading">3. Anamnesis próxima</h2>
      <div className="text-sm space-y-2">
        {anamnesisProxima.relatoAmpliado ? (
          <div className="rounded-lg bg-surface-base/60 px-4 py-3">
            <p className="mb-1 text-xs font-semibold text-ink-muted">Relato</p>
            <p className="whitespace-pre-wrap">{anamnesisProxima.relatoAmpliado}</p>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {anamnesisProxima.inicio ? <p><strong>Inicio:</strong> {anamnesisProxima.inicio}</p> : null}
          {anamnesisProxima.evolucion ? <p><strong>Evolución:</strong> {anamnesisProxima.evolucion}</p> : null}
        </div>
        {anamnesisProxima.factoresAgravantes ? <p><strong>Factores agravantes:</strong> {anamnesisProxima.factoresAgravantes}</p> : null}
        {anamnesisProxima.factoresAtenuantes ? <p><strong>Factores atenuantes:</strong> {anamnesisProxima.factoresAtenuantes}</p> : null}
        {anamnesisProxima.sintomasAsociados ? <p><strong>Síntomas asociados:</strong> {anamnesisProxima.sintomasAsociados}</p> : null}
        {anamnesisProxima.perfilDolorAbdominal ? (
          <div className="rounded-card border border-surface-muted/30 bg-surface-base/50 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Perfil estructurado de dolor abdominal</p>
            <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
              {anamnesisProxima.perfilDolorAbdominal.presente ? <p><strong>Dolor abdominal:</strong> Sí</p> : null}
              {anamnesisProxima.perfilDolorAbdominal.vomitos ? <p><strong>Vómitos:</strong> Sí</p> : null}
              {anamnesisProxima.perfilDolorAbdominal.diarrea ? <p><strong>Diarrea:</strong> Sí</p> : null}
              {anamnesisProxima.perfilDolorAbdominal.nauseas ? <p><strong>Náuseas:</strong> Sí</p> : null}
              {anamnesisProxima.perfilDolorAbdominal.estrenimiento ? <p><strong>Estreñimiento:</strong> Sí</p> : null}
              {anamnesisProxima.perfilDolorAbdominal.asociadoComida ? (
                <p>
                  <strong>Asociado a comida:</strong>{' '}
                  {anamnesisProxima.perfilDolorAbdominal.asociadoComida === 'SI'
                    ? 'Sí'
                    : anamnesisProxima.perfilDolorAbdominal.asociadoComida === 'NO'
                      ? 'No'
                      : 'No claro'}
                </p>
              ) : null}
            </div>
            {anamnesisProxima.perfilDolorAbdominal.notas ? (
              <p className="mt-2"><strong>Notas:</strong> {anamnesisProxima.perfilDolorAbdominal.notas}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function RemoteHistorySection({ anamnesisRemota }: { anamnesisRemota: any }) {
  return (
    <section className="mb-8 print-break-before">
      <h2 className="ficha-section-heading">4. Anamnesis remota</h2>
      <div className="text-sm space-y-1">
        {Object.entries({
          antecedentesMedicos: 'Antecedentes médicos',
          antecedentesQuirurgicos: 'Antecedentes quirúrgicos',
          antecedentesGinecoobstetricos: 'Antecedentes ginecoobstétricos',
          antecedentesFamiliares: 'Antecedentes familiares',
          habitos: 'Hábitos',
          medicamentos: 'Medicamentos',
          alergias: 'Alergias',
          inmunizaciones: 'Inmunizaciones',
        }).map(([key, label]) => {
          const text = formatHistoryFieldText(anamnesisRemota[key]);
          return text ? <p key={key}><strong>{label}:</strong> {text}</p> : null;
        })}
      </div>
    </section>
  );
}

export function SystemsReviewSection({
  revisionEntries,
}: {
  revisionEntries: Array<{ key: string; label: string; text: string }>;
}) {
  return (
    <section className="mb-8">
      <h2 className="ficha-section-heading">5. Revisión por sistemas</h2>
      <div className="text-sm space-y-1">
        {revisionEntries.length > 0 ? revisionEntries.map((entry) => (
          <p key={entry.key}><strong>{entry.label}:</strong> {entry.text}</p>
        )) : <p>-</p>}
      </div>
    </section>
  );
}
