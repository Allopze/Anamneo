import { type Attachment } from '@/types';
import { extractStructuredMedicationLines } from '@/lib/clinical';
import { LinkedAttachments } from './LinkedAttachments';

type AttachmentListProps = {
  items: any[];
  attachmentsByOrderId: Record<string, Attachment[]>;
  onPreviewAttachment: (attachment: Attachment | null) => void;
  onDownloadAttachment: (attachment: Attachment) => void;
};

function StructuredAttachmentList({
  items,
  attachmentsByOrderId,
  onPreviewAttachment,
  onDownloadAttachment,
}: AttachmentListProps) {
  return (
    <ul className="mt-2 space-y-2">
      {items.map((item: any) => (
        <li key={item.id} className="rounded-card border border-surface-muted/30 px-3 py-2">
          <div>{[item.nombre, item.indicacion, item.estado].filter(Boolean).join(' · ')}</div>
          <LinkedAttachments
            orderId={item.id}
            attachmentsByOrderId={attachmentsByOrderId}
            onPreview={(attachment) => onPreviewAttachment(attachment)}
            onDownload={onDownloadAttachment}
          />
        </li>
      ))}
    </ul>
  );
}

export function TreatmentSection({
  treatmentPlan,
  tratamiento,
  linkedAttachmentsByOrderId,
  onPreviewAttachment,
  onDownloadAttachment,
}: {
  treatmentPlan: string;
  tratamiento: any;
  linkedAttachmentsByOrderId: Record<string, Attachment[]>;
  onPreviewAttachment: (attachment: Attachment | null) => void;
  onDownloadAttachment: (attachment: Attachment) => void;
}) {
  return (
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
            <StructuredAttachmentList
              items={tratamiento.examenesEstructurados}
              attachmentsByOrderId={linkedAttachmentsByOrderId}
              onPreviewAttachment={onPreviewAttachment}
              onDownloadAttachment={onDownloadAttachment}
            />
          </div>
        ) : null}
        {tratamiento.derivacionesEstructuradas?.length > 0 ? (
          <div>
            <strong>Derivaciones estructuradas:</strong>
            <StructuredAttachmentList
              items={tratamiento.derivacionesEstructuradas}
              attachmentsByOrderId={linkedAttachmentsByOrderId}
              onPreviewAttachment={onPreviewAttachment}
              onDownloadAttachment={onDownloadAttachment}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function TreatmentResponseSection({ respuestaTratamiento }: { respuestaTratamiento: any }) {
  return (
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
  );
}

export function ObservationsSection({ observaciones }: { observaciones: any }) {
  if (!observaciones.resumenClinico && !observaciones.observaciones) {
    return null;
  }

  return (
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
  );
}
