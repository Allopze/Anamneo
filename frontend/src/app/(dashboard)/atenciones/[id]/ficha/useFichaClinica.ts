import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { AxiosResponse } from 'axios';
import { api, getErrorMessage } from '@/lib/api';
import {
  canExportEncounterDocuments,
  canPrintEncounterRecord,
  canSignEncounter,
} from '@/lib/permissions';
import { Attachment, Encounter, SignEncounterResponse } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { getEncounterActionBlockReason } from '@/lib/clinical-output';
import {
  formatPatientMissingFields,
  getIdentificationMissingFields,
  getPatientCompletenessMeta,
} from '@/lib/patient';
import {
  getRevisionSystemEntries,
  getTreatmentPlanText,
} from '@/lib/clinical';
import { fallbackPdfFilename, getFilenameFromDisposition } from './ficha.constants';

export function useFichaClinica() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isOperationalAdmin = !!user?.isAdmin;
  const [showSignModal, setShowSignModal] = useState(false);
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
  const exportBlockedReason = canExportEncounterDocuments(user ?? null)
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
  const outputBlockReason = exportBlockedReason ?? printBlockedReason;

  useEffect(() => {
    if (!isOperationalAdmin) return;
    router.replace('/');
  }, [isOperationalAdmin, router]);

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
    if (exportBlockedReason) {
      toast.error(exportBlockedReason);
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
  }, [encounter, exportBlockedReason, id]);

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

  const linkedAttachmentsByOrderId = useMemo(() => {
    return (encounter?.attachments || []).reduce<Record<string, Attachment[]>>((acc, attachment) => {
      if (!attachment.linkedOrderId) return acc;
      if (!acc[attachment.linkedOrderId]) acc[attachment.linkedOrderId] = [];
      acc[attachment.linkedOrderId].push(attachment);
      return acc;
    }, {});
  }, [encounter?.attachments]);

  return {
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
  };
}
