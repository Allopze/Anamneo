import Link from 'next/link';
import clsx from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiAlertTriangle, FiShield } from 'react-icons/fi';
import { REVIEW_STATUS_LABELS, STATUS_LABELS, type Attachment, type Encounter } from '@/types';
import { extractStructuredMedicationLines, formatHistoryFieldText } from '@/lib/clinical';
import {
  formatPatientAge,
  formatPatientPrevision,
  formatPatientRut,
  formatPatientSex,
} from '@/lib/patient';
import { ESTADO_GENERAL_LABELS } from './ficha.constants';
import { LinkedAttachments } from './LinkedAttachments';

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

interface FichaClinicalRecordProps {
  encounter: Encounter;
  clinicalOutputBlock: Encounter['clinicalOutputBlock'] | null;
  patientCompletenessMeta: { label: string; description: string } | null;
  sectionData: {
    identificacion: any;
    motivoConsulta: any;
    anamnesisProxima: any;
    anamnesisRemota: any;
    examenFisico: any;
    sospechaDiagnostica: any;
    tratamiento: any;
    respuestaTratamiento: any;
    observaciones: any;
    revisionEntries: Array<{ key: string; label: string; text: string }>;
    treatmentPlan: string;
    identificationMissingFields: string[];
  };
  linkedAttachmentsByOrderId: Record<string, Attachment[]>;
  onPreviewAttachment: (attachment: Attachment | null) => void;
  onDownloadAttachment: (attachment: Attachment) => void;
}

export function FichaClinicalRecord({
  encounter,
  clinicalOutputBlock,
  patientCompletenessMeta,
  sectionData,
  linkedAttachmentsByOrderId,
  onPreviewAttachment,
  onDownloadAttachment,
}: FichaClinicalRecordProps) {
  const {
    identificacion,
    motivoConsulta,
    anamnesisProxima,
    anamnesisRemota,
    examenFisico,
    sospechaDiagnostica,
    tratamiento,
    respuestaTratamiento,
    observaciones,
    revisionEntries,
    treatmentPlan,
    identificationMissingFields,
  } = sectionData;

  return (
    <div className={clsx('max-w-4xl mx-auto p-8 bg-surface-elevated print:p-0', clinicalOutputBlock && 'print:hidden')}>
      <header className="mb-8 border-b-2 border-ink-primary pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink-primary">Ficha Clínica</h1>
            <p className="mt-1 text-sm text-ink-secondary">
              {format(new Date(encounter.createdAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
            </p>
            {encounter.createdBy?.nombre ? (
              <p className="mt-0.5 text-sm text-ink-muted">{encounter.createdBy.nombre}</p>
            ) : null}
          </div>
          <span
            className={clsx(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
              encounter.status === 'FIRMADO'
                ? 'border-status-green/50 bg-status-green/15 text-status-green-text'
                : encounter.status === 'COMPLETADO'
                  ? 'border-accent/40 bg-accent/10 text-accent-text'
                  : encounter.status === 'CANCELADO'
                    ? 'border-status-red/40 bg-status-red/10 text-status-red-text'
                    : 'border-surface-muted/50 bg-surface-muted/30 text-ink-secondary',
            )}
          >
            {encounter.status === 'FIRMADO' ? <FiShield className="h-3 w-3" /> : null}
            {STATUS_LABELS[encounter.status]}
          </span>
        </div>
      </header>

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
          <div className="mb-4 rounded-2xl border border-status-yellow/70 bg-status-yellow/40 p-3 text-sm text-accent-text">
            <div className="flex items-start gap-2">
              <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Snapshot administrativo con divergencias</p>
                <p className="mt-1">
                  La identificación impresa corresponde a esta atención y hoy difiere de la ficha maestra del paciente en: {encounter.identificationSnapshotStatus.differingFieldLabels.join(', ')}.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {patientCompletenessMeta && encounter.patient?.completenessStatus && encounter.patient.completenessStatus !== 'VERIFICADA' ? (
          <div className="mb-4 rounded-2xl border border-status-yellow/70 bg-status-yellow/40 p-3 text-sm text-accent-text">
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

      <section className="mb-8">
        <h2 className="ficha-section-heading">5. Revisión por sistemas</h2>
        <div className="text-sm space-y-1">
          {revisionEntries.length > 0 ? revisionEntries.map((entry) => (
            <p key={entry.key}><strong>{entry.label}:</strong> {entry.text}</p>
          )) : <p>-</p>}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="ficha-section-heading">6. Examen físico</h2>
        <div className="text-sm">
          {(examenFisico.estadoGeneral || examenFisico.estadoGeneralNotas) ? (
            <div className="mb-3">
              <strong>Estado general:</strong>
              <span className="ml-2">
                {[ESTADO_GENERAL_LABELS[examenFisico.estadoGeneral as string] || examenFisico.estadoGeneral, examenFisico.estadoGeneralNotas].filter(Boolean).join(' · ')}
              </span>
            </div>
          ) : null}
          {examenFisico.signosVitales ? (
            <div className="mb-3">
              <strong>Signos vitales:</strong>
              <span className="ml-2">
                PA: {examenFisico.signosVitales.presionArterial || '-'} |
                FC: {examenFisico.signosVitales.frecuenciaCardiaca || '-'} lpm |
                FR: {examenFisico.signosVitales.frecuenciaRespiratoria || '-'} rpm |
                T°: {examenFisico.signosVitales.temperatura || '-'}°C |
                SatO2: {examenFisico.signosVitales.saturacionOxigeno || '-'}% |
                Peso: {examenFisico.signosVitales.peso || '-'} kg |
                Talla: {examenFisico.signosVitales.talla || '-'} cm |
                IMC: {examenFisico.signosVitales.imc || '-'}
              </span>
            </div>
          ) : null}
          <div className="space-y-1">
            {examenFisico.cabeza ? <p><strong>Cabeza:</strong> {examenFisico.cabeza}</p> : null}
            {examenFisico.cuello ? <p><strong>Cuello:</strong> {examenFisico.cuello}</p> : null}
            {examenFisico.torax ? <p><strong>Tórax:</strong> {examenFisico.torax}</p> : null}
            {examenFisico.abdomen ? <p><strong>Abdomen:</strong> {examenFisico.abdomen}</p> : null}
            {examenFisico.extremidades ? <p><strong>Extremidades:</strong> {examenFisico.extremidades}</p> : null}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="ficha-section-heading">7. Sospecha diagnóstica</h2>
        {sospechaDiagnostica.sospechas?.length > 0 ? (
          <ol className="list-decimal list-inside text-sm space-y-1">
            {sospechaDiagnostica.sospechas.map((item: any, index: number) => (
              <li key={index}>
                <strong>{item.diagnostico}</strong>
                {item.codigoCie10 ? <span className="text-ink-secondary"> ({item.codigoCie10})</span> : null}
                {item.descripcionCie10 ? <span className="text-ink-secondary"> · {item.descripcionCie10}</span> : null}
                {item.notas ? <span className="text-ink-secondary"> - {item.notas}</span> : null}
              </li>
            ))}
          </ol>
        ) : <p className="text-sm">-</p>}
      </section>

      <section className="mb-8">
        <h2 className="ficha-section-heading">8. Tratamiento</h2>
        <div className="text-sm space-y-2">
          {treatmentPlan ? <p><strong>Plan de tratamiento e indicaciones:</strong> {treatmentPlan}</p> : null}
          {tratamiento.receta ? <p><strong>Receta:</strong> {tratamiento.receta}</p> : null}
          {tratamiento.examenes ? <p><strong>Exámenes:</strong> {tratamiento.examenes}</p> : null}
          {tratamiento.derivaciones ? <p><strong>Derivaciones:</strong> {tratamiento.derivaciones}</p> : null}
          {tratamiento.medicamentosEstructurados?.length > 0 ? (
            <div>
              <strong>Medicamentos estructurados:</strong>
              <ul className="list-disc list-inside mt-1">
                {extractStructuredMedicationLines(tratamiento.medicamentosEstructurados).map((line, index) => (
                  <li key={`${line}-${index}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {tratamiento.examenesEstructurados?.length > 0 ? (
            <div>
              <strong>Exámenes estructurados:</strong>
              <ul className="mt-2 space-y-2">
                {tratamiento.examenesEstructurados.map((item: any) => (
                  <li key={item.id} className="rounded-card border border-surface-muted/30 px-3 py-2">
                    <div>{[item.nombre, item.indicacion, item.estado].filter(Boolean).join(' · ')}</div>
                    <LinkedAttachments
                      orderId={item.id}
                      attachmentsByOrderId={linkedAttachmentsByOrderId}
                      onPreview={(attachment) => onPreviewAttachment(attachment)}
                      onDownload={onDownloadAttachment}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {tratamiento.derivacionesEstructuradas?.length > 0 ? (
            <div>
              <strong>Derivaciones estructuradas:</strong>
              <ul className="mt-2 space-y-2">
                {tratamiento.derivacionesEstructuradas.map((item: any) => (
                  <li key={item.id} className="rounded-card border border-surface-muted/30 px-3 py-2">
                    <div>{[item.nombre, item.indicacion, item.estado].filter(Boolean).join(' · ')}</div>
                    <LinkedAttachments
                      orderId={item.id}
                      attachmentsByOrderId={linkedAttachmentsByOrderId}
                      onPreview={(attachment) => onPreviewAttachment(attachment)}
                      onDownload={onDownloadAttachment}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="ficha-section-heading">9. Respuesta al tratamiento</h2>
        <div className="text-sm space-y-2">
          {respuestaTratamiento.evolucion ? <p><strong>Evolución:</strong> {respuestaTratamiento.evolucion}</p> : null}
          {respuestaTratamiento.resultadosExamenes ? <p><strong>Resultados de exámenes:</strong> {respuestaTratamiento.resultadosExamenes}</p> : null}
          {respuestaTratamiento.ajustesTratamiento ? <p><strong>Ajustes al tratamiento:</strong> {respuestaTratamiento.ajustesTratamiento}</p> : null}
          {respuestaTratamiento.planSeguimiento ? <p><strong>Plan de seguimiento:</strong> {respuestaTratamiento.planSeguimiento}</p> : null}
          {respuestaTratamiento.respuestaEstructurada ? (
            <div className="rounded-card border border-surface-muted/30 bg-surface-base/50 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Desenlace estructurado</p>
              {respuestaTratamiento.respuestaEstructurada.estado ? (
                <p>
                  <strong>Estado:</strong>{' '}
                  {respuestaTratamiento.respuestaEstructurada.estado === 'FAVORABLE'
                    ? 'Favorable'
                    : respuestaTratamiento.respuestaEstructurada.estado === 'PARCIAL'
                      ? 'Parcial'
                      : respuestaTratamiento.respuestaEstructurada.estado === 'SIN_RESPUESTA'
                        ? 'Sin respuesta'
                        : 'Empeora'}
                </p>
              ) : null}
              {respuestaTratamiento.respuestaEstructurada.notas ? (
                <p className="mt-1"><strong>Notas:</strong> {respuestaTratamiento.respuestaEstructurada.notas}</p>
              ) : null}
            </div>
          ) : null}
          {!respuestaTratamiento.evolucion && !respuestaTratamiento.resultadosExamenes && !respuestaTratamiento.ajustesTratamiento && !respuestaTratamiento.planSeguimiento ? (
            <p>-</p>
          ) : null}
        </div>
      </section>

      {(observaciones.resumenClinico || observaciones.observaciones) ? (
        <section className="mb-8">
          <h2 className="ficha-section-heading">10. Observaciones</h2>
          {observaciones.resumenClinico ? (
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Resumen longitudinal</p>
              <p className="text-sm whitespace-pre-wrap">{observaciones.resumenClinico}</p>
            </div>
          ) : null}
          {observaciones.observaciones ? <p className="text-sm whitespace-pre-wrap">{observaciones.observaciones}</p> : null}
        </section>
      ) : null}

      <footer className="mt-12 border-t-2 border-ink-primary pt-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold text-ink-muted">Profesional responsable</p>
            <p className="font-medium text-ink-primary">{encounter.createdBy?.nombre || '-'}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-ink-muted">Estado de la atención</p>
            <p className="font-medium text-ink-primary">{STATUS_LABELS[encounter.status]}</p>
            <p className="mt-0.5 text-xs text-ink-secondary">{REVIEW_STATUS_LABELS[encounter.reviewStatus || 'NO_REQUIERE_REVISION']}</p>
          </div>
        </div>
        <div className="mt-10 flex justify-end">
          <div className="text-center">
            <div className="w-48 border-t border-ink-primary pt-2">
              <p className="text-sm text-ink-secondary">Firma y Timbre</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
