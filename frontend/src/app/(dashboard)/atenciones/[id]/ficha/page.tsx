'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Attachment, Encounter, SEXO_LABELS, PREVISION_LABELS, STATUS_LABELS, REVIEW_STATUS_LABELS } from '@/types';
import { FiAlertTriangle, FiArrowLeft, FiFileText, FiPrinter, FiDownload, FiPaperclip } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import { useAuthStore } from '@/stores/auth-store';
import {
  formatHistoryFieldText,
  getRevisionSystemEntries,
  getTreatmentPlanText,
} from '@/lib/clinical';

function fallbackPdfFilename(encounter: Encounter | undefined, kind: 'pdf' | 'receta' | 'ordenes' | 'derivacion') {
  const patientName = (encounter?.patient?.nombre || 'Paciente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .trim();
  const encounterDate = encounter?.createdAt
    ? format(new Date(encounter.createdAt), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd');

  if (kind === 'pdf') {
    return `${patientName} - ${encounterDate}.pdf`;
  }
  return `${patientName} - ${kind} - ${encounterDate}.pdf`;
}

function getFilenameFromDisposition(value?: string) {
  if (!value) {
    return null;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const classicMatch = /filename="?([^"]+)"?/i.exec(value);
  return classicMatch?.[1] || null;
}

export default function FichaClinicaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const isOperationalAdmin = !!user?.isAdmin;

  const { data: encounter, isLoading } = useQuery({
    queryKey: ['encounter', id],
    queryFn: async () => {
      const response = await api.get(`/encounters/${id}`);
      return response.data as Encounter;
    },
    enabled: !isOperationalAdmin,
  });

  useEffect(() => {
    if (!isOperationalAdmin) return;
    router.replace('/');
  }, [isOperationalAdmin, router]);

  if (isOperationalAdmin) {
    return null;
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    try {
      const response = await api.get(`/attachments/${attachment.id}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: attachment.mime });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.originalName || 'archivo';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al descargar el adjunto');
    }
  };

  const handleDownloadPdf = async () => {
    await handleDownloadDocument('pdf');
  };

  const handleDownloadDocument = async (kind: 'pdf' | 'receta' | 'ordenes' | 'derivacion') => {
    try {
      const endpoint = kind === 'pdf'
        ? `/encounters/${id}/export/pdf`
        : `/encounters/${id}/export/document/${kind}`;
      const response = await api.get(endpoint, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getFilenameFromDisposition(response.headers['content-disposition'])
        || fallbackPdfFilename(encounter, kind);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al generar el documento');
    }
  };

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

  const sections = encounter.sections || [];
  const identificacion = sections.find((s) => s.sectionKey === 'IDENTIFICACION')?.data || {};
  const motivoConsulta = sections.find((s) => s.sectionKey === 'MOTIVO_CONSULTA')?.data || {};
  const anamnesisProxima = sections.find((s) => s.sectionKey === 'ANAMNESIS_PROXIMA')?.data || {};
  const anamnesisRemota = sections.find((s) => s.sectionKey === 'ANAMNESIS_REMOTA')?.data || {};
  const revisionSistemas = sections.find((s) => s.sectionKey === 'REVISION_SISTEMAS')?.data || {};
  const examenFisico = sections.find((s) => s.sectionKey === 'EXAMEN_FISICO')?.data || {};
  const sospechaDiagnostica = sections.find((s) => s.sectionKey === 'SOSPECHA_DIAGNOSTICA')?.data || {};
  const tratamiento = sections.find((s) => s.sectionKey === 'TRATAMIENTO')?.data || {};
  const respuestaTratamiento = sections.find((s) => s.sectionKey === 'RESPUESTA_TRATAMIENTO')?.data || {};
  const observaciones = sections.find((s) => s.sectionKey === 'OBSERVACIONES')?.data || {};
  const revisionEntries = getRevisionSystemEntries(revisionSistemas);
  const treatmentPlan = getTreatmentPlanText(tratamiento);
  const linkedAttachmentsByOrderId = (encounter.attachments || []).reduce<Record<string, Attachment[]>>((acc, attachment) => {
    if (!attachment.linkedOrderId) {
      return acc;
    }

    if (!acc[attachment.linkedOrderId]) {
      acc[attachment.linkedOrderId] = [];
    }

    acc[attachment.linkedOrderId].push(attachment);
    return acc;
  }, {});

  const renderLinkedAttachments = (orderId?: string) => {
    if (!orderId) return null;

    const attachments = linkedAttachmentsByOrderId[orderId] || [];
    if (attachments.length === 0) return null;

    return (
      <div className="mt-2 rounded-card border border-surface-muted/30 bg-surface-base/40 p-3">
        <div className="flex items-center gap-2 text-ink-secondary">
          <FiPaperclip className="h-4 w-4" />
          <span className="text-sm font-medium">Adjuntos vinculados</span>
        </div>
        <ul className="mt-2 space-y-2">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="rounded-md bg-surface-elevated px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-primary">{attachment.originalName}</p>
                  <p className="text-xs text-ink-muted">
                    {[attachment.description, attachment.uploadedAt ? format(new Date(attachment.uploadedAt), "d MMM yyyy", { locale: es }) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadAttachment(attachment)}
                  className="no-print inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:text-ink"
                >
                  <FiDownload className="h-3.5 w-3.5" />
                  Descargar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <>
      {/* Print controls - hidden when printing */}
      <div className="no-print sticky top-0 z-30 bg-surface-elevated border-b border-surface-muted/30 px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Link
            href={`/atenciones/${id}`}
            className="flex items-center gap-2 text-ink-secondary hover:text-ink-primary"
          >
            <FiArrowLeft className="w-5 h-5" />
            {encounter?.status === 'COMPLETADO' ? 'Volver al resumen' : 'Volver a edición'}
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={() => handleDownloadDocument('receta')} className="btn btn-secondary flex items-center gap-2">
              <FiDownload className="w-4 h-4" />
              Receta
            </button>
            <button onClick={() => handleDownloadDocument('ordenes')} className="btn btn-secondary flex items-center gap-2">
              <FiDownload className="w-4 h-4" />
              Órdenes
            </button>
            <button onClick={() => handleDownloadDocument('derivacion')} className="btn btn-secondary flex items-center gap-2">
              <FiDownload className="w-4 h-4" />
              Derivación
            </button>
            <button onClick={handleDownloadPdf} className="btn btn-secondary flex items-center gap-2">
              <FiDownload className="w-4 h-4" />
              Descargar PDF
            </button>
            <button onClick={handlePrint} className="btn btn-primary flex items-center gap-2">
              <FiPrinter className="w-4 h-4" />
              Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* Clinical record content */}
      <div className="max-w-4xl mx-auto p-8 bg-surface-elevated print:p-0">
        {/* Header */}
        <header className="text-center border-b-2 border-ink-primary pb-4 mb-6">
          <h1 className="text-2xl font-bold text-ink-primary">FICHA CLÍNICA</h1>
          <p className="text-ink-secondary">
            Fecha: {format(new Date(encounter.createdAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
          </p>
        </header>

        {/* Patient identification */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-surface-muted/30 pb-1 mb-3">
            1. IDENTIFICACIÓN DEL PACIENTE
          </h2>
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
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <p><strong>Nombre:</strong> {identificacion.nombre || '-'}</p>
            <p><strong>RUT:</strong> {identificacion.rut || 'Sin RUT'}</p>
            <p><strong>Edad:</strong> {identificacion.edad} años{identificacion.edadMeses ? ` ${identificacion.edadMeses} meses` : ''}</p>
            <p><strong>Sexo:</strong> {SEXO_LABELS[identificacion.sexo] || '-'}</p>
            <p><strong>Previsión:</strong> {PREVISION_LABELS[identificacion.prevision] || '-'}</p>
            <p><strong>Trabajo:</strong> {identificacion.trabajo || '-'}</p>
            <p className="col-span-2"><strong>Domicilio:</strong> {identificacion.domicilio || '-'}</p>
          </div>
        </section>

        {/* Motivo de consulta */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-surface-muted/30 pb-1 mb-3">
            2. MOTIVO DE CONSULTA
          </h2>
          <p className="text-sm whitespace-pre-wrap">{motivoConsulta.texto || '-'}</p>
          {motivoConsulta.afeccionSeleccionada && (
            <p className="text-sm mt-2 text-ink-secondary">
              <strong>Afección probable:</strong> {motivoConsulta.afeccionSeleccionada.name}
            </p>
          )}
        </section>

        {/* Anamnesis próxima */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-surface-muted/30 pb-1 mb-3">
            3. ANAMNESIS PRÓXIMA
          </h2>
          <div className="text-sm space-y-2">
            {anamnesisProxima.relatoAmpliado && (
              <p><strong>Relato:</strong> {anamnesisProxima.relatoAmpliado}</p>
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
        <section className="mb-6 print-break-before">
          <h2 className="text-lg font-bold border-b border-surface-muted/30 pb-1 mb-3">
            4. ANAMNESIS REMOTA
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

        {/* Examen físico */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-surface-muted/30 pb-1 mb-3">
            5. REVISIÓN POR SISTEMAS
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
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-surface-muted/30 pb-1 mb-3">
            6. EXAMEN FÍSICO
          </h2>
          <div className="text-sm">
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
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-surface-muted/30 pb-1 mb-3">
            7. SOSPECHA DIAGNÓSTICA
          </h2>
          {sospechaDiagnostica.sospechas?.length > 0 ? (
            <ol className="list-decimal list-inside text-sm space-y-1">
              {sospechaDiagnostica.sospechas.map((s: any, i: number) => (
                <li key={i}>
                  <strong>{s.diagnostico}</strong>
                  {s.notas && <span className="text-ink-secondary"> - {s.notas}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm">-</p>
          )}
        </section>

        {/* Tratamiento */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-surface-muted/30 pb-1 mb-3">
            8. TRATAMIENTO
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
                    <li key={item.id}>{[item.nombre, item.dosis, item.frecuencia, item.duracion].filter(Boolean).join(' · ')}</li>
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
                      {renderLinkedAttachments(item.id)}
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
                      {renderLinkedAttachments(item.id)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Respuesta al tratamiento */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-surface-muted/30 pb-1 mb-3">
            9. RESPUESTA AL TRATAMIENTO
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
          <section className="mb-6">
            <h2 className="text-lg font-bold border-b border-surface-muted/30 pb-1 mb-3">
              10. OBSERVACIONES
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
        <footer className="mt-12 pt-6 border-t border-surface-muted/30">
          <div className="flex justify-between text-sm">
            <p>
              <strong>Profesional:</strong> {encounter.createdBy?.nombre || '-'}
            </p>
            <p>
              <strong>Estado:</strong> {STATUS_LABELS[encounter.status]}
            </p>
          </div>
          <div className="mt-2 text-sm">
            <strong>Revisión:</strong> {REVIEW_STATUS_LABELS[encounter.reviewStatus || 'NO_REQUIERE_REVISION']}
          </div>
          <div className="mt-8 flex justify-end">
            <div className="text-center">
              <div className="w-48 border-t border-ink-primary pt-1">
                <p className="text-sm">Firma y Timbre</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
