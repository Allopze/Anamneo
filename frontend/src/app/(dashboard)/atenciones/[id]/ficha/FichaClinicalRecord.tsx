import clsx from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiShield } from 'react-icons/fi';
import { REVIEW_STATUS_LABELS, STATUS_LABELS, type Attachment, type Encounter } from '@/types';
import {
  CurrentComplaintSection,
  DiagnosticAssessmentSection,
  IdentificationSection,
  ObservationsSection,
  PhysicalExamSection,
  RecentHistorySection,
  RemoteHistorySection,
  SystemsReviewSection,
  TreatmentResponseSection,
  TreatmentSection,
} from './FichaClinicalSections';

type FichaClinicalRecordProps = {
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
};

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

  const statusLabel = STATUS_LABELS[encounter.status];

  return (
    <div
      className={clsx(
        'mx-auto max-w-5xl border border-surface-muted/50 bg-surface-elevated p-8 print:border-0 print:p-0',
        clinicalOutputBlock && 'print:hidden',
      )}
    >
      <header className="mb-8 border-b border-ink-primary pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink-primary">Ficha Clínica</h1>
            <p className="mt-2 text-sm text-ink-secondary">
              {statusLabel} · {format(new Date(encounter.createdAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
            </p>
            {encounter.createdBy?.nombre ? (
              <p className="mt-0.5 text-sm text-ink-muted">{encounter.createdBy.nombre}</p>
            ) : null}
          </div>
          {encounter.status === 'FIRMADO' ? (
            <div className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-status-green-text">
              <FiShield className="h-4 w-4" />
              Firmada
            </div>
          ) : null}
        </div>
      </header>

      <IdentificationSection
        encounter={encounter}
        identificacion={identificacion}
        identificationMissingFields={identificationMissingFields}
        patientCompletenessMeta={patientCompletenessMeta}
      />

      <CurrentComplaintSection motivoConsulta={motivoConsulta} />
      <RecentHistorySection anamnesisProxima={anamnesisProxima} />
      <RemoteHistorySection anamnesisRemota={anamnesisRemota} />
      <SystemsReviewSection revisionEntries={revisionEntries} />
      <PhysicalExamSection examenFisico={examenFisico} />
      <DiagnosticAssessmentSection sospechaDiagnostica={sospechaDiagnostica} />

      <TreatmentSection
        treatmentPlan={treatmentPlan}
        tratamiento={tratamiento}
        linkedAttachmentsByOrderId={linkedAttachmentsByOrderId}
        onPreviewAttachment={onPreviewAttachment}
        onDownloadAttachment={onDownloadAttachment}
      />

      <TreatmentResponseSection respuestaTratamiento={respuestaTratamiento} />
      <ObservationsSection observaciones={observaciones} />

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
