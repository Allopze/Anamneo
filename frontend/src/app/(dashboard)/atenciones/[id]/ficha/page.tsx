'use client';

import Link from 'next/link';
import { STATUS_LABELS, REVIEW_STATUS_LABELS } from '@/types';
import { FiAlertTriangle, FiShield } from 'react-icons/fi';
import SignEncounterModal from '@/components/common/SignEncounterModal';
import AttachmentPreviewModal from '@/components/common/AttachmentPreviewModal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import {
  formatHistoryFieldText,
} from '@/lib/clinical';
import {
  formatPatientAge,
  formatPatientPrevision,
  formatPatientRut,
  formatPatientSex,
} from '@/lib/patient';
import { ESTADO_GENERAL_LABELS } from './ficha.constants';
import { useFichaClinica } from './useFichaClinica';
import { FichaToolbar } from './FichaToolbar';
import { LinkedAttachments } from './LinkedAttachments';

export default function FichaClinicaPage() {
  const {
    id,
    encounter,
    isLoading,
    isOperationalAdmin,
    canSign,
    clinicalOutputBlock,
    exportBlockedReason,
    printBlockedReason,
    outputBlockReason,
    showSignModal,
    setShowSignModal,
    previewAttachment,
    setPreviewAttachment,
    signMutation,
    handlePrint,
    handleDownloadAttachment,
    handleDownloadDocument,
    handleDownloadPdf,
    sectionData,
    patientCompletenessMeta,
    linkedAttachmentsByOrderId,
  } = useFichaClinica();

  if (isOperationalAdmin) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="text-center py-12">
        <p>Atención no encontrada</p>
      </div>
    );
  }

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
    <>
      <FichaToolbar
        id={id}
        encounter={encounter}
        canSign={canSign}
        exportBlockedReason={exportBlockedReason}
        printBlockedReason={printBlockedReason}
        signIsPending={signMutation.isPending}
        onDownloadDocument={handleDownloadDocument}
        onDownloadPdf={handleDownloadPdf}
        onPrint={handlePrint}
        onSign={() => setShowSignModal(true)}
      />

      {outputBlockReason ? (
        <div className="no-print mx-auto mt-4 max-w-4xl px-4">
          <div className="rounded-2xl border border-status-yellow/70 bg-status-yellow/40 p-3 text-sm text-accent-text">
            <p className="font-medium">Salidas clinicas bloqueadas</p>
            <p className="mt-1">{outputBlockReason}</p>
            <Link
              href={`/pacientes/${encounter.patientId}`}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-status-yellow/70 px-3 py-1.5 text-xs font-semibold text-accent-text transition-colors hover:bg-status-yellow/55"
            >
              Revisar ficha administrativa
            </Link>
          </div>
        </div>
      ) : null}

      {outputBlockReason ? (
        <section className="hidden print:block px-8 py-12 text-center text-ink-primary">
          <h1 className="text-2xl font-bold">Impresión bloqueada</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-ink-secondary">
            {outputBlockReason}
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-ink-secondary">
            Completa o firma la atención y valida la ficha administrativa si corresponde antes de usar el circuito
            oficial de documentos.
          </p>
        </section>
      ) : null}

      {/* Clinical record content */}
      <div className={clsx('max-w-4xl mx-auto p-8 bg-surface-elevated print:p-0', clinicalOutputBlock && 'print:hidden')}>
        {/* Header */}
        <header className="border-b-2 border-ink-primary pb-5 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-ink-primary">Ficha Clínica</h1>
              <p className="mt-1 text-sm text-ink-secondary">
                {format(new Date(encounter.createdAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
              </p>
              {encounter.createdBy?.nombre && (
                <p className="mt-0.5 text-sm text-ink-muted">
                  {encounter.createdBy.nombre}
                </p>
              )}
            </div>
            <span className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shrink-0',
              encounter.status === 'FIRMADO'
                ? 'border-status-green/50 bg-status-green/15 text-status-green-text'
                : encounter.status === 'COMPLETADO'
                ? 'border-accent/40 bg-accent/10 text-accent-text'
                : encounter.status === 'CANCELADO'
                ? 'border-status-red/40 bg-status-red/10 text-status-red-text'
                : 'border-surface-muted/50 bg-surface-muted/30 text-ink-secondary'
            )}>
              {encounter.status === 'FIRMADO' && <FiShield className="w-3 h-3" />}
              {STATUS_LABELS[encounter.status]}
            </span>
          </div>
        </header>

        {/* Patient identification */}
        <section className="mb-8">
          <h2 className="ficha-section-heading">
            1. Identificación del paciente
          </h2>
          {identificationMissingFields.length > 0 && (
            <div className="mb-4 rounded-2xl border border-status-red/35 bg-status-red/10 p-3 text-sm text-status-red-text">
              <div className="flex items-start gap-2">
                <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Identificación incompleta en esta atención</p>
                  <p className="mt-1">
                    Faltan campos demográficos clave: {identificationMissingFields.join(', ')}.
                  </p>
                </div>
              </div>
            </div>
          )}
          {encounter.identificationSnapshotStatus?.hasDifferences && (
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
          )}
          {patientCompletenessMeta && encounter.patient?.completenessStatus && encounter.patient.completenessStatus !== 'VERIFICADA' && (
            <div className="mb-4 rounded-2xl border border-status-yellow/70 bg-status-yellow/40 p-3 text-sm text-accent-text">
              <p className="font-medium">{patientCompletenessMeta.label}</p>
              <p className="mt-1">{patientCompletenessMeta.description}</p>
            </div>
          )}
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

        {/* Motivo de consulta */}
        <section className="mb-8">
          <h2 className="ficha-section-heading">
            2. Motivo de consulta
          </h2>
          <div className="rounded-lg bg-surface-base/60 px-4 py-3">
            <p className="text-sm whitespace-pre-wrap">{motivoConsulta.texto || '-'}</p>
          </div>
          {motivoConsulta.afeccionSeleccionada && (
            <p className="text-sm mt-2 text-ink-secondary">
              <strong>Afección probable:</strong> {motivoConsulta.afeccionSeleccionada.name}
            </p>
          )}
        </section>

        {/* Anamnesis próxima */}
        <section className="mb-8">
          <h2 className="ficha-section-heading">
            3. Anamnesis próxima
          </h2>
          <div className="text-sm space-y-2">
            {anamnesisProxima.relatoAmpliado && (
              <div className="rounded-lg bg-surface-base/60 px-4 py-3">
                <p className="text-xs font-semibold text-ink-muted mb-1">Relato</p>
                <p className="whitespace-pre-wrap">{anamnesisProxima.relatoAmpliado}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {anamnesisProxima.inicio && <p><strong>Inicio:</strong> {anamnesisProxima.inicio}</p>}
              {anamnesisProxima.evolucion && <p><strong>Evolución:</strong> {anamnesisProxima.evolucion}</p>}
            </div>
            {anamnesisProxima.factoresAgravantes && (
              <p><strong>Factores agravantes:</strong> {anamnesisProxima.factoresAgravantes}</p>
            )}
            {anamnesisProxima.factoresAtenuantes && (
              <p><strong>Factores atenuantes:</strong> {anamnesisProxima.factoresAtenuantes}</p>
            )}
            {anamnesisProxima.sintomasAsociados && (
              <p><strong>Síntomas asociados:</strong> {anamnesisProxima.sintomasAsociados}</p>
            )}
          </div>
        </section>

        {/* Anamnesis remota */}
        <section className="mb-8 print-break-before">
          <h2 className="ficha-section-heading">
            4. Anamnesis remota
          </h2>
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
              return text ? (
                <p key={key}><strong>{label}:</strong> {text}</p>
              ) : null;
            })}
          </div>
        </section>

        {/* Revisión por sistemas */}
        <section className="mb-8">
          <h2 className="ficha-section-heading">
            5. Revisión por sistemas
          </h2>
          <div className="text-sm space-y-1">
            {revisionEntries.length > 0 ? (
              revisionEntries.map((entry) => (
                <p key={entry.key}><strong>{entry.label}:</strong> {entry.text}</p>
              ))
            ) : (
              <p>-</p>
            )}
          </div>
        </section>

        {/* Examen físico */}
        <section className="mb-8">
          <h2 className="ficha-section-heading">
            6. Examen físico
          </h2>
          <div className="text-sm">
            {(examenFisico.estadoGeneral || examenFisico.estadoGeneralNotas) && (
              <div className="mb-3">
                <strong>Estado general:</strong>
                <span className="ml-2">
                  {[ESTADO_GENERAL_LABELS[examenFisico.estadoGeneral as string] || examenFisico.estadoGeneral, examenFisico.estadoGeneralNotas].filter(Boolean).join(' · ')}
                </span>
              </div>
            )}
            {examenFisico.signosVitales && (
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
            )}
            <div className="space-y-1">
              {examenFisico.cabeza && <p><strong>Cabeza:</strong> {examenFisico.cabeza}</p>}
              {examenFisico.cuello && <p><strong>Cuello:</strong> {examenFisico.cuello}</p>}
              {examenFisico.torax && <p><strong>Tórax:</strong> {examenFisico.torax}</p>}
              {examenFisico.abdomen && <p><strong>Abdomen:</strong> {examenFisico.abdomen}</p>}
              {examenFisico.extremidades && <p><strong>Extremidades:</strong> {examenFisico.extremidades}</p>}
            </div>
          </div>
        </section>

        {/* Sospecha diagnóstica */}
        <section className="mb-8">
          <h2 className="ficha-section-heading">
            7. Sospecha diagnóstica
          </h2>
          {sospechaDiagnostica.sospechas?.length > 0 ? (
            <ol className="list-decimal list-inside text-sm space-y-1">
              {sospechaDiagnostica.sospechas.map((s: any, i: number) => (
                <li key={i}>
                  <strong>{s.diagnostico}</strong>
                  {s.codigoCie10 && <span className="text-ink-secondary"> ({s.codigoCie10})</span>}
                  {s.descripcionCie10 && <span className="text-ink-secondary"> · {s.descripcionCie10}</span>}
                  {s.notas && <span className="text-ink-secondary"> - {s.notas}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm">-</p>
          )}
        </section>

        {/* Tratamiento */}
        <section className="mb-8">
          <h2 className="ficha-section-heading">
            8. Tratamiento
          </h2>
          <div className="text-sm space-y-2">
            {treatmentPlan && <p><strong>Plan de tratamiento e indicaciones:</strong> {treatmentPlan}</p>}
            {tratamiento.receta && <p><strong>Receta:</strong> {tratamiento.receta}</p>}
            {tratamiento.examenes && <p><strong>Exámenes:</strong> {tratamiento.examenes}</p>}
            {tratamiento.derivaciones && <p><strong>Derivaciones:</strong> {tratamiento.derivaciones}</p>}
            {tratamiento.medicamentosEstructurados?.length > 0 && (
              <div>
                <strong>Medicamentos estructurados:</strong>
                <ul className="list-disc list-inside mt-1">
                  {tratamiento.medicamentosEstructurados.map((item: any) => (
                    <li key={item.id}>{[item.nombre, item.dosis, item.via, item.frecuencia, item.duracion].filter(Boolean).join(' · ')}</li>
                  ))}
                </ul>
              </div>
            )}
            {tratamiento.examenesEstructurados?.length > 0 && (
              <div>
                <strong>Exámenes estructurados:</strong>
                <ul className="mt-2 space-y-2">
                  {tratamiento.examenesEstructurados.map((item: any) => (
                    <li key={item.id} className="rounded-card border border-surface-muted/30 px-3 py-2">
                      <div>{[item.nombre, item.indicacion, item.estado].filter(Boolean).join(' · ')}</div>
                      <LinkedAttachments orderId={item.id} attachmentsByOrderId={linkedAttachmentsByOrderId} onPreview={setPreviewAttachment} onDownload={handleDownloadAttachment} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {tratamiento.derivacionesEstructuradas?.length > 0 && (
              <div>
                <strong>Derivaciones estructuradas:</strong>
                <ul className="mt-2 space-y-2">
                  {tratamiento.derivacionesEstructuradas.map((item: any) => (
                    <li key={item.id} className="rounded-card border border-surface-muted/30 px-3 py-2">
                      <div>{[item.nombre, item.indicacion, item.estado].filter(Boolean).join(' · ')}</div>
                      <LinkedAttachments orderId={item.id} attachmentsByOrderId={linkedAttachmentsByOrderId} onPreview={setPreviewAttachment} onDownload={handleDownloadAttachment} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Respuesta al tratamiento */}
        <section className="mb-8">
          <h2 className="ficha-section-heading">
            9. Respuesta al tratamiento
          </h2>
          <div className="text-sm space-y-2">
            {respuestaTratamiento.evolucion && <p><strong>Evolución:</strong> {respuestaTratamiento.evolucion}</p>}
            {respuestaTratamiento.resultadosExamenes && <p><strong>Resultados de exámenes:</strong> {respuestaTratamiento.resultadosExamenes}</p>}
            {respuestaTratamiento.ajustesTratamiento && <p><strong>Ajustes al tratamiento:</strong> {respuestaTratamiento.ajustesTratamiento}</p>}
            {respuestaTratamiento.planSeguimiento && <p><strong>Plan de seguimiento:</strong> {respuestaTratamiento.planSeguimiento}</p>}
            {!respuestaTratamiento.evolucion && !respuestaTratamiento.resultadosExamenes && !respuestaTratamiento.ajustesTratamiento && !respuestaTratamiento.planSeguimiento && (
              <p>-</p>
            )}
          </div>
        </section>

        {/* Observaciones */}
        {(observaciones.resumenClinico || observaciones.observaciones) && (
          <section className="mb-8">
            <h2 className="ficha-section-heading">
              10. Observaciones
            </h2>
            {observaciones.resumenClinico && (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Resumen longitudinal</p>
                <p className="text-sm whitespace-pre-wrap">{observaciones.resumenClinico}</p>
              </div>
            )}
            {observaciones.observaciones && (
              <p className="text-sm whitespace-pre-wrap">{observaciones.observaciones}</p>
            )}
          </section>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t-2 border-ink-primary">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-ink-muted mb-1">Profesional responsable</p>
              <p className="font-medium text-ink-primary">{encounter.createdBy?.nombre || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-muted mb-1">Estado de la atención</p>
              <p className="font-medium text-ink-primary">{STATUS_LABELS[encounter.status]}</p>
              <p className="text-xs text-ink-secondary mt-0.5">{REVIEW_STATUS_LABELS[encounter.reviewStatus || 'NO_REQUIERE_REVISION']}</p>
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

      <SignEncounterModal
        open={showSignModal}
        loading={signMutation.isPending}
        onConfirm={(password) => signMutation.mutate(password)}
        onClose={() => setShowSignModal(false)}
      />

      <AttachmentPreviewModal
        isOpen={!!previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        attachment={previewAttachment}
      />
    </>
  );
}
