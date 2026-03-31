'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import {
  Attachment,
  Encounter,
  REVIEW_STATUS_LABELS,
  SectionKey,
  StructuredOrder,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  TratamientoData,
} from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { buildGeneratedClinicalSummary } from '@/lib/clinical';
import {
  FiArrowLeft,
  FiCheck,
  FiSave,
  FiAlertCircle,
  FiLoader,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiPaperclip,
  FiX,
  FiDownload,
  FiTrash2,
  FiFileText,
  FiClipboard,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  canCompleteEncounter as canCompleteEncounterPermission,
  canEditEncounter,
  canUploadAttachments as canUploadAttachmentsPermission,
  canViewMedicoOnlySections,
} from '@/lib/permissions';

// Section components
import IdentificacionSection from '@/components/sections/IdentificacionSection';
import MotivoConsultaSection from '@/components/sections/MotivoConsultaSection';
import AnamnesisProximaSection from '@/components/sections/AnamnesisProximaSection';
import AnamnesisRemotaSection from '@/components/sections/AnamnesisRemotaSection';
import RevisionSistemasSection from '@/components/sections/RevisionSistemasSection';
import ExamenFisicoSection from '@/components/sections/ExamenFisicoSection';
import SospechaDiagnosticaSection from '@/components/sections/SospechaDiagnosticaSection';
import TratamientoSection from '@/components/sections/TratamientoSection';
import RespuestaTratamientoSection from '@/components/sections/RespuestaTratamientoSection';
import ObservacionesSection from '@/components/sections/ObservacionesSection';
import ClinicalAlerts from '@/components/ClinicalAlerts';
import TemplateSelector from '@/components/TemplateSelector';

import ConfirmModal from '@/components/common/ConfirmModal';

const SECTION_COMPONENTS: Record<SectionKey, React.ComponentType<any>> = {
  IDENTIFICACION: IdentificacionSection,
  MOTIVO_CONSULTA: MotivoConsultaSection,
  ANAMNESIS_PROXIMA: AnamnesisProximaSection,
  ANAMNESIS_REMOTA: AnamnesisRemotaSection,
  REVISION_SISTEMAS: RevisionSistemasSection,
  EXAMEN_FISICO: ExamenFisicoSection,
  SOSPECHA_DIAGNOSTICA: SospechaDiagnosticaSection,
  TRATAMIENTO: TratamientoSection,
  RESPUESTA_TRATAMIENTO: RespuestaTratamientoSection,
  OBSERVACIONES: ObservacionesSection,
};

const AUTOSAVE_DELAY = 10000; // 10 seconds
const LINKABLE_ATTACHMENT_LABELS = {
  EXAMEN: 'Examen',
  DERIVACION: 'Derivación',
} as const;

// Sections only visible to doctors
const MEDICO_ONLY_SECTIONS: SectionKey[] = [
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
  'RESPUESTA_TRATAMIENTO',
];

const TEMPLATE_FIELD_BY_SECTION: Partial<Record<SectionKey, string>> = {
  MOTIVO_CONSULTA: 'texto',
  ANAMNESIS_PROXIMA: 'relatoAmpliado',
  TRATAMIENTO: 'plan',
  RESPUESTA_TRATAMIENTO: 'evolucion',
  OBSERVACIONES: 'observaciones',
};

const SECTION_STATUS_META = {
  idle: {
    label: 'Sin cambios',
    badgeClassName: 'bg-surface-muted text-ink-secondary',
    dotClassName: 'bg-surface-muted',
  },
  dirty: {
    label: 'Pendiente',
    badgeClassName: 'bg-status-yellow/20 text-status-yellow',
    dotClassName: 'bg-status-yellow',
  },
  saving: {
    label: 'Guardando',
    badgeClassName: 'bg-accent/20 text-accent',
    dotClassName: 'bg-accent/100',
  },
  saved: {
    label: 'Guardada',
    badgeClassName: 'bg-emerald-100 text-emerald-700',
    dotClassName: 'bg-emerald-500',
  },
  completed: {
    label: 'Completa',
    badgeClassName: 'bg-status-green/20 text-status-green',
    dotClassName: 'bg-status-green',
  },
  error: {
    label: 'Error',
    badgeClassName: 'bg-status-red/20 text-status-red',
    dotClassName: 'bg-status-red',
  },
} as const;

type SectionUiState = keyof typeof SECTION_STATUS_META;

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const buildIdentificationSnapshotFromPatient = (encounter: Encounter) => ({
  nombre: encounter.patient?.nombre || '',
  rut: encounter.patient?.rut || '',
  rutExempt: encounter.patient?.rutExempt || false,
  rutExemptReason: encounter.patient?.rutExemptReason || '',
  edad: encounter.patient?.edad,
  sexo: encounter.patient?.sexo || '',
  prevision: encounter.patient?.prevision || '',
  trabajo: encounter.patient?.trabajo || '',
  domicilio: encounter.patient?.domicilio || '',
});

export default function EncounterWizardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isMedico, canEditAntecedentes } = useAuthStore();

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savingSectionKey, setSavingSectionKey] = useState<SectionKey | null>(null);
  const [savedSectionKey, setSavedSectionKey] = useState<SectionKey | null>(null);
  const [errorSectionKey, setErrorSectionKey] = useState<SectionKey | null>(null);
  const [savedSnapshotJson, setSavedSnapshotJson] = useState('');
  const lastSavedRef = useRef<string>('');
  const formDataRef = useRef<Record<string, any>>({});
  const activeSectionKeyRef = useRef<SectionKey | null>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveStatusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMeta, setUploadMeta] = useState({
    category: 'GENERAL',
    description: '',
    linkedOrderType: '',
    linkedOrderId: '',
  });
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showDeleteAttachment, setShowDeleteAttachment] = useState<string | null>(null);
  const [quickTask, setQuickTask] = useState({ title: '', type: 'SEGUIMIENTO', dueDate: '' });
  const initializedEncounterIdRef = useRef<string | null>(null);

  // Fetch encounter data
  const { data: encounter, isLoading, error } = useQuery({
    queryKey: ['encounter', id],
    queryFn: async () => {
      const response = await api.get(`/encounters/${id}`);
      return response.data as Encounter;
    },
  });
  const isDoctor = isMedico();
  const canEdit = canEditEncounter(user ?? null, encounter);
  const canUpload = canUploadAttachmentsPermission(user ?? null);
  const allSections = encounter?.sections || [];
  const sections = canViewMedicoOnlySections(user ?? null)
    ? allSections
    : allSections.filter((section) => !MEDICO_ONLY_SECTIONS.includes(section.sectionKey));
  const currentSection = sections[currentSectionIndex];

  useEffect(() => {
    activeSectionKeyRef.current = currentSection?.sectionKey ?? null;
  }, [currentSection]);

  // Save section mutation
  const saveSectionMutation = useMutation({
    mutationFn: async ({
      sectionKey,
      data,
      completed,
    }: {
      sectionKey: SectionKey;
      data: any;
      completed?: boolean;
    }) => {
      return api.put(`/encounters/${id}/sections/${sectionKey}`, {
        data,
        completed,
      });
    },
    onMutate: (variables) => {
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
      }
      setSavingSectionKey(variables.sectionKey);
      setSavedSectionKey(null);
      setErrorSectionKey(null);
      setSaveStatus('saving');
    },
    onSuccess: (response, variables) => {
      let savedSnapshot: Record<string, any> = {};
      try {
        savedSnapshot = JSON.parse(lastSavedRef.current || '{}');
      } catch {
        savedSnapshot = {};
      }

      savedSnapshot[variables.sectionKey] = variables.data;
      lastSavedRef.current = JSON.stringify(savedSnapshot);
      setSavedSnapshotJson(lastSavedRef.current);

      queryClient.setQueryData<Encounter | undefined>(['encounter', id], (previous) => {
        if (!previous) return previous;
        if (!previous.sections) return previous;

        return {
          ...previous,
          sections: previous.sections.map((section) =>
            section.sectionKey === variables.sectionKey
              ? {
                  ...section,
                  data: response.data.data,
                  completed: response.data.completed,
                }
              : section
          ),
        };
      });

      const activeSectionKey = activeSectionKeyRef.current;
      if (activeSectionKey) {
        const activeData = JSON.stringify(formDataRef.current[activeSectionKey]);
        const activeSavedData = JSON.stringify(savedSnapshot[activeSectionKey]);
        setHasUnsavedChanges(activeData !== activeSavedData);
      } else {
        setHasUnsavedChanges(false);
      }

      setSavingSectionKey(null);
      setSavedSectionKey(variables.sectionKey);
      setErrorSectionKey(null);
      setSaveStatus('saved');
      saveStatusTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
        setSavedSectionKey((current) => (
          current === variables.sectionKey ? null : current
        ));
      }, 2000);
    },
    onError: (err, variables) => {
      setSavingSectionKey(null);
      setSavedSectionKey(null);
      setErrorSectionKey(variables.sectionKey);
      setSaveStatus('error');
      toast.error('Error al guardar: ' + getErrorMessage(err));
    },
  });

  // Complete encounter mutation
  const completeMutation = useMutation({
    mutationFn: () => api.post(`/encounters/${id}/complete`),
    onSuccess: () => {
      toast.success('Atención completada');
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      router.push(`/atenciones/${id}/ficha`);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });


  const attachmentsQuery = useQuery({
    queryKey: ['attachments', id],
    queryFn: async () => {
      const response = await api.get(`/attachments/encounter/${id}`);
      return response.data as Attachment[];
    },
    enabled: isAttachmentsOpen || currentSection?.sectionKey === 'TRATAMIENTO',
    staleTime: 30_000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', uploadMeta.category);
      formData.append('description', uploadMeta.description);
      if (uploadMeta.linkedOrderType && uploadMeta.linkedOrderId) {
        formData.append('linkedOrderType', uploadMeta.linkedOrderType);
        formData.append('linkedOrderId', uploadMeta.linkedOrderId);
      }
      return api.post(`/attachments/encounter/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      toast.success('Archivo adjuntado');
      setSelectedFile(null);
      setUploadMeta({ category: 'GENERAL', description: '', linkedOrderType: '', linkedOrderId: '' });
      queryClient.invalidateQueries({ queryKey: ['attachments', id] });
    },
    onError: (err) => {
      const msg = getErrorMessage(err);
      setUploadError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => api.delete(`/attachments/${attachmentId}`),
    onSuccess: () => {
      toast.success('Archivo eliminado');
      queryClient.invalidateQueries({ queryKey: ['attachments', id] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const reviewStatusMutation = useMutation({
    mutationFn: async (reviewStatus: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO') =>
      api.put(`/encounters/${id}/review-status`, { reviewStatus }),
    onSuccess: () => {
      toast.success('Estado de revisión actualizado');
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      queryClient.invalidateQueries({ queryKey: ['patient', encounter?.patientId] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async () =>
      api.post(`/patients/${encounter?.patientId}/tasks`, {
        ...quickTask,
        encounterId: id,
        dueDate: quickTask.dueDate || undefined,
      }),
    onSuccess: () => {
      toast.success('Seguimiento creado');
      setQuickTask({ title: '', type: 'SEGUIMIENTO', dueDate: '' });
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      queryClient.invalidateQueries({ queryKey: ['patient', encounter?.patientId] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  useEffect(() => {
    if (!isAttachmentsOpen) {
      setSelectedFile(null);
      setUploadError(null);
      setUploadMeta({ category: 'GENERAL', description: '', linkedOrderType: '', linkedOrderId: '' });
    }
  }, [isAttachmentsOpen]);

  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const handleDownload = async (attachment: Attachment) => {
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
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Initialize form data from encounter sections (only on first load per encounter)
  useEffect(() => {
    if (encounter?.sections && encounter.id !== initializedEncounterIdRef.current) {
      initializedEncounterIdRef.current = encounter.id;
      const initialData: Record<string, any> = {};
      encounter.sections.forEach((section) => {
        initialData[section.sectionKey] = section.data;
      });
      setFormData(initialData);
      formDataRef.current = initialData;
      lastSavedRef.current = JSON.stringify(initialData);
      setSavedSnapshotJson(lastSavedRef.current);
    }
  }, [encounter]);

  // Autosave logic — uses refs to avoid stale closures
  const saveCurrentSection = useCallback(() => {
    if (!canEdit) return;
    if (!encounter?.sections) return;
    
    const sectionKey = activeSectionKeyRef.current;
    if (!sectionKey) return;
    const currentData = formDataRef.current[sectionKey];
    
    // Compare the current section's data against its snapshot
    let savedSnapshot: Record<string, any> = {};
    try { savedSnapshot = JSON.parse(lastSavedRef.current || '{}'); } catch { /* ignore */ }
    const savedSectionData = JSON.stringify(savedSnapshot[sectionKey]);
    const currentSectionData = JSON.stringify(currentData);

    if (currentSectionData !== savedSectionData) {
      setSaveStatus('saving');
      saveSectionMutation.mutate({
        sectionKey,
        data: currentData,
      });
    }
  }, [canEdit, encounter?.sections, saveSectionMutation]);

  // Set up autosave timer
  useEffect(() => {
    if (!canEdit) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      return;
    }
    if (hasUnsavedChanges) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(() => {
        saveCurrentSection();
      }, AUTOSAVE_DELAY);
    }

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [canEdit, hasUnsavedChanges, saveCurrentSection]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Keyboard shortcuts: Ctrl/⌘+S save, Ctrl/⌘+←/→ navigate sections
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === 's') {
        e.preventDefault();
        saveCurrentSection();
      } else if (e.key === 'ArrowLeft' && currentSectionIndex > 0) {
        e.preventDefault();
        saveCurrentSection();
        setCurrentSectionIndex((i) => i - 1);
      } else if (e.key === 'ArrowRight' && currentSectionIndex < sections.length - 1) {
        e.preventDefault();
        saveCurrentSection();
        setCurrentSectionIndex((i) => i + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveCurrentSection, currentSectionIndex, sections.length]);

  const handleSectionDataChange = (sectionKey: SectionKey, data: any) => {
    if (!canEdit) return;
    setFormData((prev) => ({ ...prev, [sectionKey]: data }));
    setErrorSectionKey((current) => (
      current === sectionKey ? null : current
    ));
    setSaveStatus('idle');
  };

  useEffect(() => {
    if (!currentSection) {
      setHasUnsavedChanges(false);
      return;
    }

    let savedSnapshot: Record<string, any> = {};
    try {
      savedSnapshot = JSON.parse(lastSavedRef.current || '{}');
    } catch {
      savedSnapshot = {};
    }

    const currentData = JSON.stringify(formData[currentSection.sectionKey] ?? {});
    const savedData = JSON.stringify(savedSnapshot[currentSection.sectionKey] ?? {});
    setHasUnsavedChanges(currentData !== savedData);
  }, [currentSection, formData]);

  const insertTemplateIntoCurrentSection = (content: string) => {
    if (!currentSection || !canEdit) return;

    const targetField = TEMPLATE_FIELD_BY_SECTION[currentSection.sectionKey];
    if (!targetField) return;

    const currentData = formData[currentSection.sectionKey] || {};
    const existingValue = typeof currentData[targetField] === 'string'
      ? currentData[targetField].trim()
      : '';
    const nextValue = existingValue
      ? `${existingValue}\n\n${content}`.trim()
      : content;

    handleSectionDataChange(currentSection.sectionKey, {
      ...currentData,
      [targetField]: nextValue,
    });
    toast.success('Plantilla insertada en la sección actual');
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    // Save current section before navigating
    saveCurrentSection();

    if (direction === 'prev' && currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
    } else if (direction === 'next' && currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
    }
  };

  const handleMarkComplete = () => {
    if (!canEdit) return;
    if (!currentSection) return;
    
    saveSectionMutation.mutate({
      sectionKey: currentSection.sectionKey,
      data: formData[currentSection.sectionKey],
      completed: true,
    });
  };

  const handleComplete = async () => {
    if (!canEdit) return;
    if (hasUnsavedChanges) {
      const sectionKey = activeSectionKeyRef.current;
      if (sectionKey) {
        const currentData = formDataRef.current[sectionKey];
        try {
          await saveSectionMutation.mutateAsync({ sectionKey, data: currentData });
        } catch {
          // save error already shown via onError
          return;
        }
      }
    }
    setShowCompleteConfirm(true);
  };

  const confirmComplete = () => {
    setShowCompleteConfirm(false);
    completeMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (error || !encounter) {
    const msg = error ? getErrorMessage(error) : null;
    return (
      <div className="text-center py-12">
        <FiAlertCircle className="w-12 h-12 text-status-red mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-ink-primary mb-2">Atención no encontrada</h2>
        {msg && <p className="text-ink-muted text-sm mb-4 whitespace-pre-line">{msg}</p>}
        <Link href="/pacientes" className="btn btn-primary">
          Volver a pacientes
        </Link>
      </div>
    );
  }

  const SectionComponent = currentSection ? SECTION_COMPONENTS[currentSection.sectionKey] : null;
  const completedCount = sections.filter((s) => s.completed).length;
  const canComplete = canCompleteEncounterPermission(user ?? null, encounter);
  const attachments = attachmentsQuery.data ?? [];
  const tratamientoData = (formData.TRATAMIENTO ?? encounter.sections?.find((section) => section.sectionKey === 'TRATAMIENTO')?.data ?? {}) as TratamientoData;
  const examenesEstructurados = Array.isArray(tratamientoData.examenesEstructurados)
    ? tratamientoData.examenesEstructurados
    : [];
  const derivacionesEstructuradas = Array.isArray(tratamientoData.derivacionesEstructuradas)
    ? tratamientoData.derivacionesEstructuradas
    : [];
  const currentLinkedOrderType = uploadMeta.category === 'EXAMEN'
    ? 'EXAMEN'
    : uploadMeta.category === 'DERIVACION'
    ? 'DERIVACION'
    : '';
  const currentLinkableOrders: StructuredOrder[] = currentLinkedOrderType === 'EXAMEN'
    ? examenesEstructurados
    : currentLinkedOrderType === 'DERIVACION'
    ? derivacionesEstructuradas
    : [];
  const linkedAttachmentsByOrderId = attachments.reduce<Record<string, Attachment[]>>((acc, attachment) => {
    if (!attachment.linkedOrderId) {
      return acc;
    }

    if (!acc[attachment.linkedOrderId]) {
      acc[attachment.linkedOrderId] = [];
    }

    acc[attachment.linkedOrderId].push(attachment);
    return acc;
  }, {});
  const supportsTemplates = Boolean(currentSection && TEMPLATE_FIELD_BY_SECTION[currentSection.sectionKey]);
  const generatedSummary = buildGeneratedClinicalSummary({
    ...encounter,
    sections: sections.map((section) => ({
      ...section,
      data: formData[section.sectionKey] ?? section.data,
    })),
  } as Encounter);

  let savedSnapshot: Record<string, any> = {};
  try {
    savedSnapshot = JSON.parse(savedSnapshotJson || '{}');
  } catch {
    savedSnapshot = {};
  }

  const getSectionUiState = (section: NonNullable<Encounter['sections']>[number]): SectionUiState => {
    if (section.sectionKey === savingSectionKey) return 'saving';
    if (section.sectionKey === errorSectionKey) return 'error';

    const currentData = JSON.stringify(formData[section.sectionKey] ?? {});
    const savedData = JSON.stringify(savedSnapshot[section.sectionKey] ?? {});
    const isDirty = currentData !== savedData;

    if (isDirty) return 'dirty';
    if (section.completed) return 'completed';
    if (section.sectionKey === savedSectionKey) return 'saved';
    return 'idle';
  };

  const currentSectionState = currentSection ? getSectionUiState(currentSection) : 'idle';
  const currentSectionStatusMeta = SECTION_STATUS_META[currentSectionState];
  const identificationSnapshotStatus = encounter.identificationSnapshotStatus;
  const handleStartLinkedAttachment = (type: 'EXAMEN' | 'DERIVACION', orderId: string) => {
    setUploadError(null);
    setSelectedFile(null);
    setUploadMeta((prev) => ({
      ...prev,
      category: type,
      linkedOrderType: type,
      linkedOrderId: orderId,
    }));
    setIsAttachmentsOpen(true);
  };

  const handleRestoreIdentificationFromPatient = () => {
    handleSectionDataChange('IDENTIFICACION', buildIdentificationSnapshotFromPatient(encounter));
    toast.success('Se restauró la identificación desde la ficha maestra del paciente');
  };

  return (
    <div className="min-h-screen bg-surface-base/40">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface-elevated border-b border-surface-muted/30">
        <div className="px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/pacientes/${encounter.patientId}`}
              className="p-2 hover:bg-surface-muted rounded-card transition-colors"
            >
              <FiArrowLeft className="w-5 h-5 text-ink-secondary" />
            </Link>
            <div>
              <h1 className="font-semibold text-ink-primary">
                Atención: {encounter.patient?.nombre}
              </h1>
              <p className="text-sm text-ink-muted">
                {completedCount}/{sections.length} secciones completadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Save status */}
            {canEdit && (
              <div className="flex items-center gap-2 text-sm" aria-live="polite" role="status">
                {saveStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-ink-muted">
                    <FiLoader className="w-4 h-4 animate-spin" />
                    Guardando...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-status-green">
                    <FiCheck className="w-4 h-4" />
                    Guardado
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="flex items-center gap-1 text-status-red">
                    <FiAlertCircle className="w-4 h-4" />
                    Error
                  </span>
                )}
              </div>
            )}

            {canEdit && (
              <button
                onClick={saveCurrentSection}
                disabled={!hasUnsavedChanges || saveSectionMutation.isPending}
                className="btn btn-secondary flex items-center gap-2"
              >
                <FiSave className="w-4 h-4" />
                Guardar ahora
              </button>
            )}

            <Link
              href={`/atenciones/${id}/ficha`}
              className="btn btn-secondary flex items-center gap-2"
            >
              <FiEye className="w-4 h-4" />
              Ficha clínica
            </Link>

            {canComplete && (
              <button
                onClick={handleComplete}
                disabled={completeMutation.isPending}
                className="btn btn-success flex items-center gap-2"
              >
                <FiCheck className="w-4 h-4" />
                Finalizar atención
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar stepper */}
        <aside className="hidden lg:block w-72 min-h-[calc(100vh-4rem)] bg-surface-elevated border-r border-surface-muted/30">
          <nav className="p-4 space-y-1">
            {sections.map((section, index) => {
              const sectionState = getSectionUiState(section);
              const sectionStatusMeta = SECTION_STATUS_META[sectionState];

              return (
                <button
                  key={section.id}
                  onClick={() => {
                    saveCurrentSection();
                    setCurrentSectionIndex(index);
                  }}
                  className={clsx(
                    'stepper-item w-full text-left',
                    index === currentSectionIndex && 'stepper-item-active',
                    index !== currentSectionIndex && section.completed && 'stepper-item-completed',
                    index !== currentSectionIndex && !section.completed && 'stepper-item-pending'
                  )}
                >
                  <span
                    className={clsx(
                      'stepper-dot',
                      index === currentSectionIndex && 'stepper-dot-active',
                      index !== currentSectionIndex && section.completed && 'stepper-dot-completed',
                      index !== currentSectionIndex && !section.completed && 'stepper-dot-pending'
                    )}
                  >
                    {section.completed ? <FiCheck className="w-3 h-3" /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm truncate block">{section.label}</span>
                    <span
                      className={clsx(
                        'mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        sectionStatusMeta.badgeClassName,
                      )}
                    >
                      <span className={clsx('w-1.5 h-1.5 rounded-full', sectionStatusMeta.dotClassName)} />
                      {sectionStatusMeta.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            {/* Mobile section selector */}
            <div className="lg:hidden mb-4">
              <label htmlFor="mobile-section-select" className="sr-only">Seleccionar sección</label>
              <select
                id="mobile-section-select"
                value={currentSectionIndex}
                onChange={(e) => {
                  saveCurrentSection();
                  setCurrentSectionIndex(Number(e.target.value));
                }}
                className="form-input text-sm"
              >
                {sections.map((section, index) => {
                  const state = getSectionUiState(section);
                  const statusLabel = SECTION_STATUS_META[state].label;
                  return (
                    <option key={section.id} value={index}>
                      {index + 1}. {section.label} — {statusLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Clinical Alerts */}
            {encounter.patientId && (
              <ClinicalAlerts patientId={encounter.patientId} />
            )}

            <div className="card mb-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-muted">Revisión clínica</p>
                  <h3 className="text-lg font-semibold text-ink-primary">
                    {REVIEW_STATUS_LABELS[encounter.reviewStatus || 'NO_REQUIERE_REVISION']}
                  </h3>
                  <p className="text-sm text-ink-muted">
                    {encounter.reviewedAt
                      ? `Última revisión: ${new Date(encounter.reviewedAt).toLocaleString('es-CL')}`
                      : encounter.reviewRequestedAt
                      ? `Solicitada: ${new Date(encounter.reviewRequestedAt).toLocaleString('es-CL')}`
                      : 'Sin revisión pendiente'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!isDoctor && encounter.reviewStatus !== 'LISTA_PARA_REVISION' && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => reviewStatusMutation.mutate('LISTA_PARA_REVISION')}
                      disabled={reviewStatusMutation.isPending}
                    >
                      Enviar a revisión médica
                    </button>
                  )}
                  {isDoctor && encounter.reviewStatus !== 'REVISADA_POR_MEDICO' && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => reviewStatusMutation.mutate('REVISADA_POR_MEDICO')}
                      disabled={reviewStatusMutation.isPending}
                    >
                      Marcar revisada
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr,1fr]">
                <div className="rounded-xl border border-surface-muted/30 bg-surface-base/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-ink-secondary">
                    <FiFileText className="h-4 w-4" />
                    <span className="text-sm font-medium">Resumen clínico generado</span>
                  </div>
                  <p className="text-sm text-ink-secondary">
                    {generatedSummary || 'Completa más secciones para generar un resumen clínico automático.'}
                  </p>
                  {canEdit && generatedSummary && (
                    <button
                      type="button"
                      className="mt-3 text-sm font-medium text-accent hover:text-accent"
                      onClick={() => {
                        const existing = formData.OBSERVACIONES || {};
                        const updatedData = {
                          ...existing,
                          observaciones: existing.observaciones
                            ? `${existing.observaciones}\n\n${generatedSummary}`
                            : generatedSummary,
                        };
                        handleSectionDataChange('OBSERVACIONES', updatedData);
                        saveSectionMutation.mutate({ sectionKey: 'OBSERVACIONES', data: updatedData });
                        toast.success('Resumen agregado a observaciones');
                      }}
                    >
                      Insertar en observaciones
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-surface-muted/30 p-4">
                    <div className="mb-3 flex items-center gap-2 text-ink-secondary">
                      <FiPaperclip className="h-4 w-4" />
                      <span className="text-sm font-medium">Herramientas rápidas</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                      <button
                        type="button"
                        className="btn btn-secondary w-full justify-center"
                        onClick={() => setIsAttachmentsOpen(true)}
                      >
                        Adjuntos de la atención
                      </button>
                      {canEditAntecedentes() && (
                        <Link
                          href={`/pacientes/${encounter.patientId}/historial`}
                          className="btn btn-secondary w-full justify-center"
                        >
                          Antecedentes del paciente
                        </Link>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-ink-muted">
                      Mantuvimos estas acciones fuera del encabezado para dejar más claro qué botones avanzan la atención y cuáles son de apoyo.
                    </p>
                  </div>
                  <div className="rounded-xl border border-surface-muted/30 p-4">
                    <div className="mb-3 flex items-center gap-2 text-ink-secondary">
                      <FiClipboard className="h-4 w-4" />
                      <span className="text-sm font-medium">Seguimiento rápido</span>
                    </div>
                    <div className="space-y-2">
                      <input
                        className="form-input"
                        value={quickTask.title}
                        onChange={(e) => setQuickTask((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Ej: revisar examen en 48 h"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="form-input"
                          value={quickTask.type}
                          onChange={(e) => setQuickTask((prev) => ({ ...prev, type: e.target.value }))}
                        >
                          {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          className="form-input"
                          value={quickTask.dueDate}
                          onChange={(e) => setQuickTask((prev) => ({ ...prev, dueDate: e.target.value }))}
                        />
                      </div>
                      <button
                        className="btn btn-secondary w-full"
                        onClick={() => createTaskMutation.mutate()}
                        disabled={!quickTask.title.trim() || createTaskMutation.isPending}
                      >
                        Crear seguimiento
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {encounter.tasks && encounter.tasks.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-surface-muted/20 pt-4">
                  {encounter.tasks.slice(0, 4).map((task) => (
                    <div key={task.id} className="flex items-center justify-between rounded-card bg-surface-base/40 px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium text-ink-primary">{task.title}</div>
                        <div className="text-xs text-ink-muted">
                          {TASK_TYPE_LABELS[task.type]} · {TASK_STATUS_LABELS[task.status]}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Section header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-accent">
                  Sección {currentSectionIndex + 1} de {sections.length}
                </span>
                {currentSection?.completed && (
                  <span className="text-xs px-2 py-0.5 bg-status-green/20 text-status-green rounded-full">
                    Completada
                  </span>
                )}
                <span
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded-full',
                    currentSectionStatusMeta.badgeClassName,
                  )}
                >
                  {currentSectionStatusMeta.label}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-ink-primary">{currentSection?.label}</h2>
              {canEdit && supportsTemplates && currentSection && (
                <div className="mt-3">
                  <TemplateSelector
                    sectionKey={currentSection.sectionKey}
                    onInsert={insertTemplateIntoCurrentSection}
                  />
                </div>
              )}
            </div>

            {/* Section form */}
            <div className="card mb-6">
              {SectionComponent && (
                <SectionComponent
                  data={formData[currentSection.sectionKey] || {}}
                  onChange={(data: any) => handleSectionDataChange(currentSection.sectionKey, data)}
                  encounter={encounter}
                  readOnly={!canEdit || currentSection.sectionKey === 'IDENTIFICACION'}
                  snapshotStatus={currentSection.sectionKey === 'IDENTIFICACION' ? identificationSnapshotStatus : undefined}
                  onRestoreFromPatient={currentSection.sectionKey === 'IDENTIFICACION' && canEdit ? handleRestoreIdentificationFromPatient : undefined}
                  patientId={encounter.patientId}
                  canEditPatientHistory={canEditAntecedentes()}
                  linkedAttachmentsByOrderId={linkedAttachmentsByOrderId}
                  onRequestAttachToOrder={handleStartLinkedAttachment}
                />
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => handleNavigate('prev')}
                disabled={currentSectionIndex === 0}
                className="btn btn-secondary flex items-center gap-2"
              >
                <FiChevronLeft className="w-4 h-4" />
                Anterior
              </button>

              {canEdit && (
                <button
                  onClick={handleMarkComplete}
                  disabled={saveSectionMutation.isPending || currentSection?.completed}
                  className="btn btn-success flex items-center gap-2"
                >
                  <FiCheck className="w-4 h-4" />
                  Completar sección
                </button>
              )}

              <button
                onClick={() => handleNavigate('next')}
                disabled={currentSectionIndex === sections.length - 1}
                className="btn btn-primary flex items-center gap-2"
              >
                Siguiente
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>

      {isAttachmentsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink-primary/50"
            onClick={() => setIsAttachmentsOpen(false)}
          />
          <div className="relative w-full max-w-2xl bg-surface-elevated rounded-xl shadow-xl border border-surface-muted/30" role="dialog" aria-modal="true" aria-label="Adjuntos de la atención">
            <div className="p-5 border-b border-surface-muted/30 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-primary">Adjuntos de la atención</h2>
                <p className="text-sm text-ink-secondary">Archivos vinculados a esta atención.</p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setIsAttachmentsOpen(false)}
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {canUpload && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!selectedFile) {
                      setUploadError('Selecciona un archivo para subir');
                      return;
                    }
                    setUploadError(null);
                    uploadMutation.mutate(selectedFile);
                  }}
                  className="flex flex-col sm:flex-row gap-3 items-start sm:items-end"
                >
                  <div className="flex-1 w-full space-y-3">
                    <label className="form-label">Archivo</label>
                    <input
                      type="file"
                      className="form-input"
                      onChange={(e) => {
                        setUploadError(null);
                        setSelectedFile(e.target.files?.[0] ?? null);
                      }}
                    />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <select
                        className="form-input"
                        value={uploadMeta.category}
                        onChange={(e) => {
                          const nextCategory = e.target.value;
                          const nextLinkedOrderType = nextCategory === 'EXAMEN'
                            ? 'EXAMEN'
                            : nextCategory === 'DERIVACION'
                            ? 'DERIVACION'
                            : '';
                          setUploadMeta((prev) => ({
                            ...prev,
                            category: nextCategory,
                            linkedOrderType: nextLinkedOrderType,
                            linkedOrderId: '',
                          }));
                        }}
                      >
                        <option value="GENERAL">General</option>
                        <option value="EXAMEN">Resultado de examen</option>
                        <option value="RECETA">Receta</option>
                        <option value="DERIVACION">Derivación</option>
                        <option value="IMAGEN">Imagen clínica</option>
                      </select>
                      <input
                        type="text"
                        className="form-input"
                        value={uploadMeta.description}
                        onChange={(e) => setUploadMeta((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Descripción breve"
                      />
                    </div>
                    {currentLinkedOrderType && (
                      <div className="space-y-1">
                        <select
                          className="form-input"
                          value={uploadMeta.linkedOrderId}
                          onChange={(e) => setUploadMeta((prev) => ({ ...prev, linkedOrderId: e.target.value }))}
                        >
                          <option value="">Sin vincular a un item específico</option>
                          {currentLinkableOrders.map((order) => (
                            <option key={order.id} value={order.id}>
                              {order.nombre}
                              {order.estado ? ` · ${order.estado}` : ''}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-ink-muted">
                          {currentLinkableOrders.length > 0
                            ? `Puedes asociar este archivo a un ${LINKABLE_ATTACHMENT_LABELS[currentLinkedOrderType]} estructurado para seguir resultados con mayor contexto.`
                            : `No hay ${currentLinkedOrderType === 'EXAMEN' ? 'exámenes' : 'derivaciones'} estructurados disponibles en esta atención todavía.`}
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={uploadMutation.isPending || !selectedFile}
                  >
                    {uploadMutation.isPending ? 'Subiendo...' : 'Subir'}
                  </button>
                </form>
              )}

              {uploadError && (
                <p className="text-sm text-status-red">{uploadError}</p>
              )}

              <div className="border border-surface-muted/30 rounded-card">
                {attachmentsQuery.isLoading ? (
                  <div className="p-4 text-sm text-ink-muted">Cargando adjuntos...</div>
                ) : attachmentsQuery.error ? (
                  <div className="p-4 text-sm text-status-red">
                    {getErrorMessage(attachmentsQuery.error)}
                  </div>
                ) : attachments.length === 0 ? (
                  <div className="p-4 text-sm text-ink-muted">No hay archivos adjuntos.</div>
                ) : (
                  <ul className="divide-y divide-surface-muted/30">
                    {attachments.map((attachment) => (
                      <li key={attachment.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-ink-primary truncate">
                            {attachment.originalName}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {formatFileSize(attachment.size)} ·{' '}
                            {new Date(attachment.uploadedAt).toLocaleString('es-CL')}
                            {attachment.uploadedBy?.nombre ? ` · ${attachment.uploadedBy.nombre}` : ''}
                          </p>
                          {(attachment.category || attachment.description) && (
                            <p className="text-xs text-ink-muted">
                              {[attachment.category, attachment.description].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {attachment.linkedOrderType && attachment.linkedOrderLabel && (
                            <p className="text-xs text-accent">
                              Vinculado a {LINKABLE_ATTACHMENT_LABELS[attachment.linkedOrderType]}: {attachment.linkedOrderLabel}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownload(attachment)}
                            className="btn btn-secondary text-sm flex items-center gap-2"
                          >
                            <FiDownload className="w-4 h-4" />
                            Descargar
                          </button>
                          {isDoctor && (
                            <button
                              type="button"
                              onClick={() => setShowDeleteAttachment(attachment.id)}
                              disabled={deleteMutation.isPending}
                              className="btn btn-danger text-sm flex items-center gap-2"
                            >
                              <FiTrash2 className="w-4 h-4" />
                              Eliminar
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showCompleteConfirm}
        onClose={() => setShowCompleteConfirm(false)}
        onConfirm={confirmComplete}
        title="Finalizar atención"
        message="¿Estás seguro de finalizar esta atención? Una vez finalizada, las secciones no podrán editarse."
        confirmLabel="Finalizar atención"
        variant="warning"
        loading={completeMutation.isPending}
      />

      <ConfirmModal
        isOpen={!!showDeleteAttachment}
        onClose={() => setShowDeleteAttachment(null)}
        onConfirm={() => {
          if (showDeleteAttachment) {
            deleteMutation.mutate(showDeleteAttachment);
            setShowDeleteAttachment(null);
          }
        }}
        title="Eliminar archivo"
        message="¿Estás seguro de eliminar este archivo adjunto? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
