import { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { AxiosResponse } from 'axios';
import { api, getErrorMessage } from '@/lib/api';
import {
  canExportEncounterDocuments,
  canPrintEncounterRecord,
  canReopenEncounter,
  canSignEncounter,
} from '@/lib/permissions';
import { Attachment, Encounter, SignEncounterResponse } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import {
  getEncounterActionBlockReason,
  getFocusedEncounterDocumentBlockReason,
} from '@/lib/clinical-output';
import {
  formatPatientMissingFields,
  getIdentificationMissingFields,
  getPatientCompletenessMeta,
} from '@/lib/patient';
import {
  getRevisionSystemEntries,
  getTreatmentPlanText,
} from '@/lib/clinical';
import { groupAttachmentsByOrderId } from '@/lib/attachments';
import { buildEncounterSignatureDiff, buildEncounterSignatureSummary } from '@/lib/encounter-completion';
import { invalidateDashboardOverviewQueries } from '@/lib/query-invalidation';
import { fallbackPdfFilename, getFilenameFromDisposition } from './ficha.constants';
import { type EncounterReopenReasonCode } from '../../../../../../../shared/encounter-reopen-reasons';
import { useDuplicateEncounterAction } from '../useDuplicateEncounterAction';

export function useFichaClinica() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isOperationalAdmin = !!user?.isAdmin;
  const [showSignModal, setShowSignModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const { data: encounter, isLoading } = useQuery({
    queryKey: ['encounter', id],
    queryFn: async () => {
      const response = await api.get(`/encounters/${id}`);
      return response.data as Encounter;
    },
    enabled: !isOperationalAdmin,
  });

  const clinicalOutputBlock = encounter?.clinicalOutputBlock ?? null;
  const canSign = canSignEncounter(user ?? null, encounter);
  const canReopen = canReopenEncounter(user ?? null, encounter);
  const duplicateAction = useDuplicateEncounterAction(encounter);
  const focusedDocumentBlockedReason = canExportEncounterDocuments(user ?? null)
    ? getFocusedEncounterDocumentBlockReason(clinicalOutputBlock)
    : 'No tiene permisos para exportar documentos oficiales de esta atención.';
  const pdfBlockedReason = canExportEncounterDocuments(user ?? null)
    ? getEncounterActionBlockReason(
      encounter?.status,
      clinicalOutputBlock,
      'EXPORT_OFFICIAL_DOCUMENTS',
    )
    : 'No tiene permisos para exportar documentos oficiales de esta atención.';
  const printBlockedReason = canPrintEncounterRecord(user ?? null)
    ? getEncounterActionBlockReason(
      encounter?.status,
      clinicalOutputBlock,
      'PRINT_CLINICAL_RECORD',
    )
    : 'No tiene permisos para imprimir esta ficha clínica.';
  const patientOutputBlockReason = clinicalOutputBlock?.reason ?? null;
  const fullRecordBlockedReason = pdfBlockedReason ?? printBlockedReason;

  const signMutation = useMutation<SignEncounterResponse, unknown, string>({
    mutationFn: async (password) => {
      const response: AxiosResponse<SignEncounterResponse> = await api.post(`/encounters/${id}/sign`, { password });
      return response.data;
    },
    onSuccess: () => {
      setShowSignModal(false);
      toast.success('Atención firmada electrónicamente');
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const reopenMutation = useMutation<Encounter, unknown, { reasonCode: EncounterReopenReasonCode; note: string }>({
    mutationFn: async (payload) => {
      const response = await api.post(`/encounters/${id}/reopen`, payload);
      return response.data as Encounter;
    },
    onSuccess: async () => {
      setShowReopenModal(false);
      toast.success('Atención reabierta');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['encounter', id] }),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
      router.push(`/atenciones/${id}`);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const handlePrint = useCallback(() => {
    if (printBlockedReason) {
      toast.error(printBlockedReason);
      return;
    }

    window.print();
  }, [printBlockedReason]);

  const handleDownloadAttachment = useCallback(async (attachment: Attachment) => {
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
  }, []);

  const handleDownloadDocument = useCallback(async (kind: 'pdf' | 'receta' | 'ordenes' | 'derivacion') => {
    const blockedReason = kind === 'pdf' ? pdfBlockedReason : focusedDocumentBlockedReason;

    if (blockedReason) {
      toast.error(blockedReason);
      return;
    }

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
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, [encounter, focusedDocumentBlockedReason, id, pdfBlockedReason]);

  const handleDownloadPdf = useCallback(async () => {
    await handleDownloadDocument('pdf');
  }, [handleDownloadDocument]);

  // Section data extraction
  const sections = encounter?.sections || [];
  const sectionData = useMemo(() => {
    const get = (key: string) => sections.find((s) => s.sectionKey === key)?.data || {};
    const identificacion = get('IDENTIFICACION');
    const revisionSistemas = get('REVISION_SISTEMAS');
    const tratamiento = get('TRATAMIENTO');
    return {
      identificacion,
      motivoConsulta: get('MOTIVO_CONSULTA'),
      anamnesisProxima: get('ANAMNESIS_PROXIMA'),
      anamnesisRemota: get('ANAMNESIS_REMOTA'),
      examenFisico: get('EXAMEN_FISICO'),
      sospechaDiagnostica: get('SOSPECHA_DIAGNOSTICA'),
      tratamiento,
      respuestaTratamiento: get('RESPUESTA_TRATAMIENTO'),
      observaciones: get('OBSERVACIONES'),
      revisionEntries: getRevisionSystemEntries(revisionSistemas),
      treatmentPlan: getTreatmentPlanText(tratamiento),
      identificationMissingFields: formatPatientMissingFields(getIdentificationMissingFields(identificacion)),
    };
  }, [sections]);

  const patientCompletenessMeta = useMemo(
    () => encounter?.patient ? getPatientCompletenessMeta(encounter.patient) : null,
    [encounter?.patient],
  );

  const linkedAttachmentsByOrderId = useMemo(
    () => groupAttachmentsByOrderId(encounter?.attachments),
    [encounter?.attachments],
  );

  const signatureSummary = useMemo(() => buildEncounterSignatureSummary(encounter), [encounter]);
  const signatureDiff = useMemo(() => buildEncounterSignatureDiff(encounter), [encounter]);

  return {
    id,
    encounter,
    isLoading,
    isOperationalAdmin,
    canSign,
    canReopen,
    canDuplicateEncounter: duplicateAction.canDuplicateEncounter,
    clinicalOutputBlock,
    focusedDocumentBlockedReason,
    pdfBlockedReason,
    printBlockedReason,
    patientOutputBlockReason,
    fullRecordBlockedReason,
    showSignModal,
    setShowSignModal,
    showReopenModal,
    setShowReopenModal,
    previewAttachment,
    setPreviewAttachment,
    signMutation,
    reopenMutation,
    duplicateEncounterMutation: duplicateAction.duplicateEncounterMutation,
    handlePrint,
    handleDownloadAttachment,
    handleDownloadDocument,
    handleDownloadPdf,
    sectionData,
    patientCompletenessMeta,
    linkedAttachmentsByOrderId,
    signatureSummary,
    signatureDiff,
    handleDuplicateEncounter: duplicateAction.handleDuplicateEncounter,
  };
}
