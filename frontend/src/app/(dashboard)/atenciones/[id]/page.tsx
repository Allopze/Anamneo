'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import {
  clearEncounterDraft,
  hasEncounterDraftUnsavedChanges,
  readEncounterDraft,
  writeEncounterDraft,
} from '@/lib/encounter-draft';
import {
  Attachment,
  Encounter,
  IdentificacionData,
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
  FiActivity,
  FiSlash,
  FiClock,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  canCompleteEncounter as canCompleteEncounterPermission,
  canEditEncounter,
  canUploadAttachments as canUploadAttachmentsPermission,
  canViewMedicoOnlySections,
} from '@/lib/permissions';

import ClinicalAlerts from '@/components/ClinicalAlerts';
import TemplateSelector from '@/components/TemplateSelector';

import ConfirmModal from '@/components/common/ConfirmModal';

const SectionLoadingFallback = () => (
  <div className="rounded-card border border-surface-muted/40 bg-surface-base/55 px-5 py-5 text-sm text-ink-secondary">
    Cargando sección…
  </div>
);

const SECTION_COMPONENTS: Record<SectionKey, React.ComponentType<any>> = {
  IDENTIFICACION: dynamic(() => import('@/components/sections/IdentificacionSection'), {
    loading: SectionLoadingFallback,
  }),
  MOTIVO_CONSULTA: dynamic(() => import('@/components/sections/MotivoConsultaSection'), {
    loading: SectionLoadingFallback,
  }),
  ANAMNESIS_PROXIMA: dynamic(() => import('@/components/sections/AnamnesisProximaSection'), {
    loading: SectionLoadingFallback,
  }),
  ANAMNESIS_REMOTA: dynamic(() => import('@/components/sections/AnamnesisRemotaSection'), {
    loading: SectionLoadingFallback,
  }),
  REVISION_SISTEMAS: dynamic(() => import('@/components/sections/RevisionSistemasSection'), {
    loading: SectionLoadingFallback,
  }),
  EXAMEN_FISICO: dynamic(() => import('@/components/sections/ExamenFisicoSection'), {
    loading: SectionLoadingFallback,
  }),
  SOSPECHA_DIAGNOSTICA: dynamic(() => import('@/components/sections/SospechaDiagnosticaSection'), {
    loading: SectionLoadingFallback,
  }),
  TRATAMIENTO: dynamic(() => import('@/components/sections/TratamientoSection'), {
    loading: SectionLoadingFallback,
  }),
  RESPUESTA_TRATAMIENTO: dynamic(() => import('@/components/sections/RespuestaTratamientoSection'), {
    loading: SectionLoadingFallback,
  }),
  OBSERVACIONES: dynamic(() => import('@/components/sections/ObservacionesSection'), {
    loading: SectionLoadingFallback,
  }),
};

const AUTOSAVE_DELAY = 10000; // 10 seconds
const REVIEW_NOTE_MIN_LENGTH = 10;
const CLOSURE_NOTE_MIN_LENGTH = 15;
const LINKABLE_ATTACHMENT_LABELS = {
  EXAMEN: 'Examen',
  DERIVACION: 'Derivación',
} as const;

const headerDateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const compactDateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const TOOLBAR_BUTTON_CLASS =
  'inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-input border border-frame/15 bg-surface-elevated px-4 py-3 text-sm font-medium text-ink shadow-soft transition-colors hover:border-frame/30 hover:bg-surface-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20 disabled:cursor-not-allowed disabled:opacity-50';

const TOOLBAR_PRIMARY_BUTTON_CLASS =
  'inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-input border border-accent/70 bg-accent px-4 py-3 text-sm font-semibold text-accent-text shadow-soft transition-colors hover:bg-accent-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 disabled:cursor-not-allowed disabled:opacity-50';

const TOOLBAR_SUCCESS_BUTTON_CLASS =
  'inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-input bg-status-green px-4 py-3 text-sm font-medium text-status-green-text transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-green/40 disabled:cursor-not-allowed disabled:opacity-50';

const SURFACE_PANEL_CLASS =
  'overflow-hidden rounded-card border border-frame/10 bg-surface-elevated shadow-soft';

const INNER_PANEL_CLASS =
  'rounded-card border border-surface-muted/45 bg-surface-base/55';

const RAIL_PANEL_CLASS =
  'overflow-hidden rounded-card border border-frame/10 bg-surface-elevated/78 shadow-soft';

const WORKSPACE_STICKY_OFFSET_CLASS = 'top-[110px]';

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
    badgeClassName: 'text-ink-secondary',
    dotClassName: 'bg-surface-muted',
  },
  dirty: {
    label: 'Pendiente',
    badgeClassName: 'text-accent-text',
    dotClassName: 'bg-status-yellow',
  },
  saving: {
    label: 'Guardando…',
    badgeClassName: 'text-ink',
    dotClassName: 'bg-frame',
  },
  saved: {
    label: 'Guardada',
    badgeClassName: 'text-status-green-text',
    dotClassName: 'bg-status-green',
  },
  completed: {
    label: 'Completa',
    badgeClassName: 'text-status-green-text',
    dotClassName: 'bg-status-green',
  },
  error: {
    label: 'Error',
    badgeClassName: 'text-status-red-text',
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

const formatDateTime = (value?: string | null) => (
  value ? headerDateFormatter.format(new Date(value)) : '—'
);

const formatCompactDate = (value?: string | null) => (
  value ? compactDateFormatter.format(new Date(value)) : '—'
);

export default function EncounterWizardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isMedico, canEditAntecedentes } = useAuthStore();
  const isOperationalAdmin = !!user?.isAdmin;
  const [isSectionSwitchPending, startSectionTransition] = useTransition();

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savingSectionKey, setSavingSectionKey] = useState<SectionKey | null>(null);
  const [savedSectionKey, setSavedSectionKey] = useState<SectionKey | null>(null);
  const [errorSectionKey, setErrorSectionKey] = useState<SectionKey | null>(null);
  const [savedSnapshotJson, setSavedSnapshotJson] = useState('');
  const [sidebarTab, setSidebarTab] = useState<'revision' | 'apoyo' | 'cierre'>('revision');
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
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
  const [reviewActionNote, setReviewActionNote] = useState('');
  const [closureNote, setClosureNote] = useState('');
  const initializedEncounterIdRef = useRef<string | null>(null);

  // Fetch encounter data
  const { data: encounter, isLoading, error } = useQuery({
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

  // Elapsed consultation timer
  useEffect(() => {
    if (!encounter?.createdAt) return;
    const calc = () => Math.max(0, Math.floor((Date.now() - new Date(encounter.createdAt).getTime()) / 60000));
    setElapsedMinutes(calc());
    const interval = setInterval(() => setElapsedMinutes(calc()), 60000);
    return () => clearInterval(interval);
  }, [encounter?.createdAt]);

  const isDoctor = isMedico();
  const canEdit = canEditEncounter(user ?? null, encounter);
  const canUpload = canUploadAttachmentsPermission(user ?? null);
  const allSections = encounter?.sections;
  const sections = useMemo(
    () => {
      const source = allSections ?? [];
      return (
      canViewMedicoOnlySections(user ?? null)
        ? source
        : source.filter((section) => !MEDICO_ONLY_SECTIONS.includes(section.sectionKey))
      );
    },
    [allSections, user],
  );
  const currentSection = sections[currentSectionIndex];

  useEffect(() => {
    setReviewActionNote(encounter?.reviewNote || '');
    setClosureNote(encounter?.closureNote || '');
  }, [encounter?.id, encounter?.reviewNote, encounter?.closureNote]);

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
    mutationFn: (payload: { closureNote: string }) => api.post(`/encounters/${id}/complete`, payload),
    onSuccess: () => {
      if (user?.id) {
        clearEncounterDraft(id, user.id);
      }
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
    mutationFn: async ({
      reviewStatus,
      note,
    }: {
      reviewStatus: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO';
      note?: string;
    }) => api.put(`/encounters/${id}/review-status`, { reviewStatus, note }),
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
      const storedDraft = user?.id ? readEncounterDraft(encounter.id, user.id) : null;
      const restoredFormData = storedDraft?.formData ?? initialData;
      const restoredSavedSnapshot = storedDraft?.savedSnapshot ?? initialData;

      setFormData(restoredFormData);
      formDataRef.current = restoredFormData;
      lastSavedRef.current = JSON.stringify(restoredSavedSnapshot);
      setSavedSnapshotJson(lastSavedRef.current);
      setCurrentSectionIndex(
        Math.min(
          Math.max(storedDraft?.currentSectionIndex ?? 0, 0),
          Math.max(sections.length - 1, 0),
        ),
      );

      if (storedDraft && hasEncounterDraftUnsavedChanges(storedDraft)) {
        toast.success('Se restauró un borrador local de esta atención');
      }
    }
  }, [encounter, sections.length, user?.id]);

  useEffect(() => {
    if (!encounter?.id || !user?.id) return;
    if (initializedEncounterIdRef.current !== encounter.id) return;

    if (encounter.status !== 'EN_PROGRESO') {
      clearEncounterDraft(encounter.id, user.id);
      return;
    }

    const savedSnapshot = (() => {
      try {
        return JSON.parse(savedSnapshotJson || '{}') as Record<string, unknown>;
      } catch {
        return {};
      }
    })();

    const draft = {
      version: 1,
      encounterId: encounter.id,
      userId: user.id,
      currentSectionIndex,
      formData,
      savedSnapshot,
    };

    if (hasEncounterDraftUnsavedChanges(draft)) {
      writeEncounterDraft(draft);
      return;
    }

    clearEncounterDraft(encounter.id, user.id);
  }, [currentSectionIndex, encounter?.id, encounter?.status, formData, savedSnapshotJson, user?.id]);

  // Autosave logic — uses refs to avoid stale closures
  const persistSection = useCallback(async ({
    sectionKey,
    completed,
  }: {
    sectionKey?: SectionKey;
    completed?: boolean;
  } = {}) => {
    if (!canEdit) return;
    if (!encounter?.sections) return;

    const targetSectionKey = sectionKey ?? activeSectionKeyRef.current;
    if (!targetSectionKey) return;

    const currentData = formDataRef.current[targetSectionKey];
    let savedSnapshot: Record<string, any> = {};
    try { savedSnapshot = JSON.parse(lastSavedRef.current || '{}'); } catch { /* ignore */ }
    const savedSectionData = JSON.stringify(savedSnapshot[targetSectionKey]);
    const currentSectionData = JSON.stringify(currentData);
    const persistedSection = sections.find((section) => section.sectionKey === targetSectionKey);
    const shouldSaveData = currentSectionData !== savedSectionData;
    const shouldSaveCompletion = completed !== undefined && persistedSection?.completed !== completed;

    if (!shouldSaveData && !shouldSaveCompletion) {
      return;
    }

    setSaveStatus('saving');
    await saveSectionMutation.mutateAsync({
      sectionKey: targetSectionKey,
      data: currentData,
      ...(completed !== undefined ? { completed } : {}),
    });
  }, [canEdit, encounter?.sections, saveSectionMutation, sections]);

  const saveCurrentSection = useCallback(() => {
    void persistSection();
  }, [persistSection]);

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

  const moveToSection = (nextIndex: number) => {
    saveCurrentSection();
    startSectionTransition(() => {
      setCurrentSectionIndex(nextIndex);
    });
  };

  const handleNavigate = async (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentSectionIndex > 0) {
      moveToSection(currentSectionIndex - 1);
    } else if (direction === 'next' && currentSectionIndex < sections.length - 1) {
      if (canEdit && currentSection && !currentSection.completed) {
        await persistSection({
          sectionKey: currentSection.sectionKey,
          completed: true,
        });
      } else {
        saveCurrentSection();
      }

      startSectionTransition(() => {
        setCurrentSectionIndex(currentSectionIndex + 1);
      });
    }
  };

  const handleMarkNotApplicable = () => {
    if (!canEdit) return;
    if (!currentSection) return;

    const sectionKey = currentSection.sectionKey;
    handleSectionDataChange(sectionKey, { ...formData[sectionKey], _notApplicable: true });
    void persistSection({
      sectionKey,
      completed: true,
    });
    toast.success('Sección marcada como no aplica');
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
    completeMutation.mutate({ closureNote: closureNote.trim() || undefined });
  };

  const handleReviewStatusChange = (
    reviewStatus: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO'
  ) => {
    if (
      (reviewStatus === 'LISTA_PARA_REVISION' || reviewStatus === 'REVISADA_POR_MEDICO')
      && reviewActionNote.trim().length < REVIEW_NOTE_MIN_LENGTH
    ) {
      toast.error(`La nota de revisión debe tener al menos ${REVIEW_NOTE_MIN_LENGTH} caracteres`);
      return;
    }

    reviewStatusMutation.mutate({
      reviewStatus,
      note: reviewActionNote,
    });
  };

  const SectionComponent = currentSection ? SECTION_COMPONENTS[currentSection.sectionKey] : null;
  const completedCount = useMemo(
    () => sections.filter((section) => section.completed).length,
    [sections],
  );
  const progressPercentage = sections.length > 0 ? (completedCount / sections.length) * 100 : 0;
  const canComplete = canCompleteEncounterPermission(user ?? null, encounter);
  const attachments = useMemo(
    () => attachmentsQuery.data ?? [],
    [attachmentsQuery.data],
  );
  const tratamientoData = (formData.TRATAMIENTO ?? encounter?.sections?.find((section) => section.sectionKey === 'TRATAMIENTO')?.data ?? {}) as TratamientoData;
  const examenesEstructurados = useMemo(
    () => (Array.isArray(tratamientoData.examenesEstructurados) ? tratamientoData.examenesEstructurados : []),
    [tratamientoData.examenesEstructurados],
  );
  const derivacionesEstructuradas = useMemo(
    () => (Array.isArray(tratamientoData.derivacionesEstructuradas) ? tratamientoData.derivacionesEstructuradas : []),
    [tratamientoData.derivacionesEstructuradas],
  );
  const currentLinkedOrderType = uploadMeta.category === 'EXAMEN'
    ? 'EXAMEN'
    : uploadMeta.category === 'DERIVACION'
    ? 'DERIVACION'
    : '';
  const currentLinkableOrders: StructuredOrder[] = useMemo(
    () => (
      currentLinkedOrderType === 'EXAMEN'
        ? examenesEstructurados
        : currentLinkedOrderType === 'DERIVACION'
        ? derivacionesEstructuradas
        : []
    ),
    [currentLinkedOrderType, derivacionesEstructuradas, examenesEstructurados],
  );
  const linkedAttachmentsByOrderId = useMemo(
    () => attachments.reduce<Record<string, Attachment[]>>((acc, attachment) => {
      if (!attachment.linkedOrderId) {
        return acc;
      }

      if (!acc[attachment.linkedOrderId]) {
        acc[attachment.linkedOrderId] = [];
      }

      acc[attachment.linkedOrderId].push(attachment);
      return acc;
    }, {}),
    [attachments],
  );
  const supportsTemplates = Boolean(currentSection && TEMPLATE_FIELD_BY_SECTION[currentSection.sectionKey]);
  const generatedSummary = useMemo(
    () => {
      if (!encounter) {
        return '';
      }

      return buildGeneratedClinicalSummary({
        ...encounter,
        sections: sections.map((section) => ({
          ...section,
          data: formData[section.sectionKey] ?? section.data,
        })),
      } as Encounter);
    },
    [encounter, formData, sections],
  );

  const savedSnapshot = useMemo(() => {
    try {
      return JSON.parse(savedSnapshotJson || '{}') as Record<string, any>;
    } catch {
      return {};
    }
  }, [savedSnapshotJson]);

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
  const identificationSnapshotStatus = encounter?.identificationSnapshotStatus;
  const identificationData = ((formData.IDENTIFICACION
    ?? encounter?.sections?.find((section) => section.sectionKey === 'IDENTIFICACION')?.data
    ?? {}) as IdentificacionData);
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
    if (!encounter) return;
    handleSectionDataChange('IDENTIFICACION', buildIdentificationSnapshotFromPatient(encounter));
    toast.success('Se restauró la identificación desde la ficha maestra del paciente');
  };

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

  if (error || !encounter) {
    const msg = error ? getErrorMessage(error) : null;
    return (
      <div className="text-center py-12">
        <FiAlertCircle className="mx-auto mb-4 h-12 w-12 text-status-red" />
        <h2 className="mb-2 text-xl font-bold text-ink">Atención no encontrada</h2>
        {msg ? <p className="mb-4 whitespace-pre-line text-sm text-ink-muted">{msg}</p> : null}
        <Link href="/pacientes" className="btn btn-primary">
          Volver a pacientes
        </Link>
      </div>
    );
  }

  const saveStateLabel = canEdit
    ? saveStatus === 'saving'
      ? 'Guardando…'
      : saveStatus === 'saved'
      ? 'Cambios guardados'
      : saveStatus === 'error'
      ? 'Error al guardar'
      : hasUnsavedChanges
      ? 'Cambios sin guardar'
      : 'Sin cambios'
    : null;

  const saveStateToneClass = saveStatus === 'error'
    ? 'text-status-red-text'
    : saveStatus === 'saved'
    ? 'text-status-green-text'
    : saveStatus === 'saving'
    ? 'text-ink'
    : hasUnsavedChanges
    ? 'text-accent-text'
    : 'text-ink-secondary';

  const SIDEBAR_TABS = [
    { key: 'revision' as const, label: 'Revisión', icon: FiActivity },
    { key: 'apoyo' as const, label: 'Apoyo', icon: FiClipboard },
    { key: 'cierre' as const, label: 'Cierre', icon: FiFileText },
  ];

  const secondaryColumn = (
    <div className="flex flex-col gap-0">
      <section className={SURFACE_PANEL_CLASS}>
        {/* Tabs */}
        <div className="flex border-b border-surface-muted/40">
          {SIDEBAR_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSidebarTab(tab.key)}
              className={clsx(
                'flex flex-1 items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors',
                sidebarTab === tab.key
                  ? 'border-b-2 border-accent text-ink'
                  : 'text-ink-secondary hover:text-ink',
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {sidebarTab === 'revision' && (
        <div className="px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FiActivity className="h-4 w-4 text-ink-secondary" />
                <p className="text-sm font-semibold text-ink">
                  {REVIEW_STATUS_LABELS[encounter.reviewStatus || 'NO_REQUIERE_REVISION']}
                </p>
              </div>
              <p className="mt-1 text-sm text-ink-secondary">
                {encounter.reviewedAt
                  ? `Última revisión · ${formatDateTime(encounter.reviewedAt)}`
                  : encounter.reviewRequestedAt
                  ? `Solicitada · ${formatDateTime(encounter.reviewRequestedAt)}`
                  : 'Sin revisión pendiente'}
              </p>
            </div>
          </div>

          <label className="mt-5 block text-sm font-medium text-ink" htmlFor="review-note">
            Nota de revisión
          </label>
          <textarea
            id="review-note"
            name="review_note"
            className="form-input form-textarea mt-2 min-h-[132px]"
            value={reviewActionNote}
            onChange={(e) => setReviewActionNote(e.target.value)}
            placeholder="Contexto clínico para la revisión médica…"
            readOnly={!canEdit}
          />
          <p className="mt-2 text-xs text-ink-muted">
            Obligatoria para enviar a revisión o marcar revisada. Mínimo {REVIEW_NOTE_MIN_LENGTH} caracteres.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {!isDoctor && encounter.reviewStatus !== 'LISTA_PARA_REVISION' ? (
              <button
                className={TOOLBAR_BUTTON_CLASS}
                onClick={() => handleReviewStatusChange('LISTA_PARA_REVISION')}
                disabled={reviewStatusMutation.isPending}
              >
                Enviar a Revisión Médica
              </button>
            ) : null}
            {isDoctor && encounter.reviewStatus !== 'REVISADA_POR_MEDICO' ? (
              <button
                className={TOOLBAR_BUTTON_CLASS}
                onClick={() => handleReviewStatusChange('REVISADA_POR_MEDICO')}
                disabled={reviewStatusMutation.isPending}
              >
                Marcar Revisada
              </button>
            ) : null}
          </div>

          <div className="mt-5 border-t border-surface-muted/35 pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">Resumen Clínico Generado</h3>
              {canEdit && generatedSummary ? (
                <button
                  type="button"
                  className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink"
                  onClick={() => {
                    const existing = formData.OBSERVACIONES || {};
                    const updatedData = {
                      ...existing,
                      resumenClinico: generatedSummary,
                    };
                    handleSectionDataChange('OBSERVACIONES', updatedData);
                    saveSectionMutation.mutate({ sectionKey: 'OBSERVACIONES', data: updatedData });
                    toast.success('Resumen longitudinal guardado');
                  }}
                >
                  Guardar Resumen
                </button>
              ) : null}
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-secondary">
              {generatedSummary || 'Completa más secciones para generar un resumen clínico automático.'}
            </p>
          </div>
        </div>
        )}

        {sidebarTab === 'apoyo' && (
        <div className="px-5 py-5">
          <div className="grid gap-2">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASS}
              onClick={() => setIsAttachmentsOpen(true)}
            >
              Adjuntos de la Atención
            </button>
            {canEditAntecedentes() ? (
              <Link
                href={`/pacientes/${encounter.patientId}/historial`}
                className={TOOLBAR_BUTTON_CLASS}
              >
                Antecedentes del Paciente
              </Link>
            ) : null}
          </div>

          <form
            className="mt-5 flex flex-col gap-3 border-t border-surface-muted/35 pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              createTaskMutation.mutate();
            }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <FiClipboard className="h-4 w-4 text-ink-secondary" />
              Seguimiento Rápido
            </div>
            <input
              name="quick_task_title"
              className="form-input"
              value={quickTask.title}
              onChange={(e) => setQuickTask((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Ej.: revisar examen en 48 h…"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                name="quick_task_type"
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
                name="quick_task_due_date"
                className="form-input"
                value={quickTask.dueDate}
                onChange={(e) => setQuickTask((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              className={TOOLBAR_PRIMARY_BUTTON_CLASS}
              disabled={!quickTask.title.trim() || createTaskMutation.isPending}
            >
              {createTaskMutation.isPending ? 'Creando…' : 'Crear Seguimiento'}
            </button>
          </form>
        </div>
        )}

        {sidebarTab === 'cierre' && (
        <div className="px-5 py-5">
          <dl className="grid gap-3 text-sm">
            <div className={INNER_PANEL_CLASS}>
              <div className="px-4 py-3">
                <dt className="text-xs font-medium text-ink-muted">Revisión</dt>
                <dd className="mt-2 text-ink-secondary">
                  Solicitada por {encounter.reviewRequestedBy?.nombre || '—'}
                  {encounter.reviewRequestedAt ? ` · ${formatDateTime(encounter.reviewRequestedAt)}` : ''}
                </dd>
                <dd className="mt-1 text-ink-secondary">
                  Revisada por {encounter.reviewedBy?.nombre || '—'}
                  {encounter.reviewedAt ? ` · ${formatDateTime(encounter.reviewedAt)}` : ''}
                </dd>
              </div>
            </div>
            <div className={INNER_PANEL_CLASS}>
              <div className="px-4 py-3">
                <dt className="text-xs font-medium text-ink-muted">Cierre</dt>
                <dd className="mt-2 text-ink-secondary">
                  Cerrada por {encounter.completedBy?.nombre || '—'}
                  {encounter.completedAt ? ` · ${formatDateTime(encounter.completedAt)}` : ''}
                </dd>
              </div>
            </div>
          </dl>

          <div className="mt-5 flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-ink" htmlFor="closure-note">
              Nota de cierre
            </label>
            {canComplete && generatedSummary && !closureNote.trim() ? (
              <button
                type="button"
                className="text-sm font-medium text-accent transition-colors hover:text-accent/80"
                onClick={() => setClosureNote(generatedSummary)}
              >
                Usar resumen generado
              </button>
            ) : null}
          </div>
          <textarea
            id="closure-note"
            name="closure_note"
            className="form-input form-textarea mt-2 min-h-[132px]"
            value={closureNote}
            onChange={(e) => setClosureNote(e.target.value)}
            placeholder="Resumen clínico del cierre y próximos pasos…"
            readOnly={!canComplete}
          />
          <p className="mt-2 text-xs text-ink-muted">
            Opcional. Puedes agregar un breve resumen o comentario de cierre.
          </p>

          {encounter.tasks && encounter.tasks.length > 0 ? (
            <div className="mt-5 border-t border-surface-muted/35 pt-4">
              <h3 className="text-sm font-semibold text-ink">Seguimientos Vinculados</h3>
              <div className="mt-3 flex flex-col gap-2">
                {encounter.tasks.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-input border border-surface-muted/45 bg-surface-base/45 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{task.title}</p>
                      <p className="mt-1 text-xs text-ink-secondary">
                        {TASK_TYPE_LABELS[task.type]} · {TASK_STATUS_LABELS[task.status]}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {formatCompactDate(task.dueDate || task.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        )}
      </section>
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-surface-base">
      <header className="border-b border-frame/10 bg-surface-elevated/96">
        <div className="w-full px-4 py-5 lg:px-8 xl:px-10">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-4">
                <Link
                  href={`/pacientes/${encounter.patientId}`}
                  aria-label="Volver al paciente"
                  className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-input border border-surface-muted/45 bg-surface-base text-ink-secondary transition-colors hover:bg-surface-muted/18 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20"
                >
                  <FiArrowLeft className="h-4.5 w-4.5" />
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-secondary">
                    <span>Atención</span>
                    <span>{encounter.patient?.rut || 'Sin RUT'}</span>
                    <span>{formatDateTime(encounter.createdAt)}</span>
                    <span className="inline-flex items-center gap-1">
                      <FiClock className="h-3.5 w-3.5" />
                      {elapsedMinutes < 60
                        ? `${elapsedMinutes} min`
                        : `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`}
                    </span>
                  </div>
                  <h1 className="mt-1 truncate text-[1.75rem] font-extrabold tracking-tight text-ink lg:text-[2rem]">
                    {encounter.patient?.nombre}
                  </h1>
                  <div className="mt-4 max-w-2xl">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink-secondary">Progreso de la atención</span>
                      <span className="font-medium text-ink">
                        {completedCount}/{sections.length} secciones
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted/45">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              {canEdit && saveStateLabel ? (
                <div
                  className={clsx(
                    'inline-flex min-h-12 items-center gap-2 rounded-input border border-frame/15 bg-surface-elevated px-4 py-3 text-sm shadow-soft',
                    saveStateToneClass,
                  )}
                  aria-live="polite"
                  role="status"
                >
                  {saveStatus === 'saving' ? (
                    <FiLoader className="h-4 w-4 animate-spin" />
                  ) : saveStatus === 'saved' ? (
                    <FiCheck className="h-4 w-4" />
                  ) : saveStatus === 'error' ? (
                    <FiAlertCircle className="h-4 w-4" />
                  ) : (
                    <FiSave className="h-4 w-4" />
                  )}
                  {saveStateLabel}
                </div>
              ) : null}

              {canEdit ? (
                <button
                  onClick={saveCurrentSection}
                  disabled={!hasUnsavedChanges || saveSectionMutation.isPending}
                  className={TOOLBAR_PRIMARY_BUTTON_CLASS}
                >
                  <FiSave className="h-4 w-4" />
                  Guardar Ahora
                </button>
              ) : null}

              <Link
                href={`/atenciones/${id}/ficha`}
                className={TOOLBAR_BUTTON_CLASS}
              >
                <FiEye className="h-4 w-4" />
                Ficha Clínica
              </Link>

              {canComplete ? (
                <button
                  onClick={handleComplete}
                  disabled={completeMutation.isPending}
                  className={TOOLBAR_SUCCESS_BUTTON_CLASS}
                >
                  <FiCheck className="h-4 w-4" />
                  Finalizar Atención
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="grid w-full gap-5 px-4 py-5 xl:grid-cols-[264px_minmax(0,1fr)_356px] xl:items-start xl:px-6 xl:py-6 2xl:px-10">
        <aside className="hidden xl:block">
          <div className={clsx('sticky', WORKSPACE_STICKY_OFFSET_CLASS)}>
            <div className={RAIL_PANEL_CLASS}>
              <div className="border-b border-surface-muted/35 px-5 py-5">
                <h2 className="text-sm font-semibold text-ink">Secciones</h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  Navega la atención y detecta de inmediato qué sigue abierto.
                </p>
              </div>

              <nav className="flex flex-col gap-2 px-3 py-3" aria-label="Secciones de la atención">
                {sections.map((section, index) => {
                  const sectionState = getSectionUiState(section);
                  const sectionStatusMeta = SECTION_STATUS_META[sectionState];
                  const isActive = index === currentSectionIndex;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => moveToSection(index)}
                      className={clsx(
                        'group grid w-full grid-cols-[36px_minmax(0,1fr)] items-start gap-3 rounded-card border px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20',
                        isActive
                          ? 'border-frame/15 bg-surface-base shadow-soft'
                          : 'border-transparent hover:border-surface-muted/40 hover:bg-surface-base/45'
                      )}
                      aria-current={isActive ? 'step' : undefined}
                    >
                      <span
                        className={clsx(
                          'mt-0.5 flex size-9 items-center justify-center rounded-input border text-xs font-semibold',
                          isActive
                            ? 'border-status-yellow/70 bg-status-yellow text-accent-text'
                            : section.completed
                            ? 'border-status-green/40 bg-status-green/14 text-status-green-text'
                            : 'border-surface-muted/55 bg-surface-elevated text-ink-secondary'
                        )}
                      >
                        {section.completed ? <FiCheck className="h-3.5 w-3.5" /> : index + 1}
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {section.label}
                        </span>
                        <span className={clsx('mt-1 flex items-center gap-2 text-xs', sectionStatusMeta.badgeClassName)}>
                          <span className={clsx('h-1.5 w-1.5 rounded-full', sectionStatusMeta.dotClassName)} />
                          {sectionStatusMeta.label}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mx-auto flex max-w-[920px] flex-col gap-5">
            <div className="xl:hidden">
              <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sidebar-scroll" aria-label="Secciones">
                {sections.map((section, index) => {
                  const state = getSectionUiState(section);
                  const meta = SECTION_STATUS_META[state];
                  const isActive = index === currentSectionIndex;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => moveToSection(index)}
                      className={clsx(
                        'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'border-accent/40 bg-accent/10 text-ink'
                          : 'border-surface-muted/45 bg-surface-elevated text-ink-secondary hover:border-accent/30 hover:text-ink',
                      )}
                    >
                      <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dotClassName)} />
                      <span className="whitespace-nowrap">{index + 1}. {section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {encounter.patientId ? (
              <ClinicalAlerts patientId={encounter.patientId} />
            ) : null}

            <section className={SURFACE_PANEL_CLASS}>
              <div className="border-b border-surface-muted/40 px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-secondary">
                      <span>Sección {currentSectionIndex + 1} de {sections.length}</span>
                      <span className={clsx('flex items-center gap-2', currentSectionStatusMeta.badgeClassName)}>
                        <span className={clsx('h-1.5 w-1.5 rounded-full', currentSectionStatusMeta.dotClassName)} />
                        {currentSectionStatusMeta.label}
                      </span>
                      {isSectionSwitchPending ? <span>Cambiando sección…</span> : null}
                    </div>
                    <h2 className="mt-2 text-[1.7rem] font-extrabold tracking-tight text-ink">
                      {currentSection?.label}
                    </h2>
                  </div>

                  {canEdit && supportsTemplates && currentSection ? (
                    <TemplateSelector
                      sectionKey={currentSection.sectionKey}
                      onInsert={insertTemplateIntoCurrentSection}
                    />
                  ) : null}
                </div>
              </div>

              <div className="px-5 py-5 sm:px-6">
                {SectionComponent ? (
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
                    patientAge={identificationData.edad ?? encounter.patient?.edad}
                    patientAgeMonths={identificationData.edadMeses ?? encounter.patient?.edadMeses}
                    patientSexo={identificationData.sexo ?? encounter.patient?.sexo}
                    motivoConsultaData={currentSection.sectionKey === 'SOSPECHA_DIAGNOSTICA' ? (formData.MOTIVO_CONSULTA ?? encounter?.sections?.find((s) => s.sectionKey === 'MOTIVO_CONSULTA')?.data) : undefined}
                  />
                ) : (
                  <div className="rounded-card border border-surface-muted/40 bg-surface-base/55 px-5 py-5 text-sm text-ink-secondary">
                    No hay una sección activa para mostrar.
                  </div>
                )}
              </div>

              <div className="border-t border-surface-muted/40 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => handleNavigate('prev')}
                    disabled={currentSectionIndex === 0}
                    className={TOOLBAR_BUTTON_CLASS}
                  >
                    <FiChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    {canEdit && currentSection?.sectionKey !== 'IDENTIFICACION' ? (
                      <button
                        onClick={handleMarkNotApplicable}
                        disabled={saveSectionMutation.isPending || currentSection?.completed}
                        className={TOOLBAR_BUTTON_CLASS}
                        title="Marcar esta sección como no aplica para este paciente"
                      >
                        <FiSlash className="h-4 w-4" />
                        No aplica
                      </button>
                    ) : null}


                    {currentSectionIndex < sections.length - 1 ? (
                      <button
                        onClick={() => handleNavigate('next')}
                        className={TOOLBAR_PRIMARY_BUTTON_CLASS}
                      >
                        Siguiente
                        <FiChevronRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => currentSection && persistSection({ sectionKey: currentSection.sectionKey, completed: true })}
                        disabled={saveSectionMutation.isPending || currentSection?.completed || !canEdit}
                        className={TOOLBAR_PRIMARY_BUTTON_CLASS}
                        title="Marcar como completa y guardar los últimos cambios"
                      >
                        Completar
                        <FiCheck className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div className="xl:hidden">
              {secondaryColumn}
            </div>
          </div>
        </main>

        <aside className="hidden xl:block">
          <div className={clsx('sticky', WORKSPACE_STICKY_OFFSET_CLASS)}>
            {secondaryColumn}
          </div>
        </aside>
      </div>

      {isAttachmentsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/55 backdrop-blur-[1px]"
            onClick={() => setIsAttachmentsOpen(false)}
          />
          <div className="relative w-full max-w-3xl overflow-hidden rounded-card border border-frame/10 bg-surface-elevated shadow-dropdown" role="dialog" aria-modal="true" aria-label="Adjuntos de la atención">
            <div className="flex items-start justify-between gap-3 border-b border-surface-muted/35 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">Adjuntos de la Atención</h2>
                <p className="text-sm text-ink-secondary">Archivos cargados y documentos vinculados a esta atención.</p>
              </div>
              <button
                className={TOOLBAR_BUTTON_CLASS}
                onClick={() => setIsAttachmentsOpen(false)}
                aria-label="Cerrar adjuntos"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5">
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
                  className="flex flex-col gap-4 border-b border-surface-muted/35 pb-5"
                >
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <div className="flex min-w-0 flex-col gap-3">
                      <div>
                        <label className="form-label" htmlFor="attachment-file">Archivo</label>
                        <input
                          id="attachment-file"
                          name="attachment_file"
                          type="file"
                          className="form-input"
                          onChange={(e) => {
                            setUploadError(null);
                            setSelectedFile(e.target.files?.[0] ?? null);
                          }}
                        />
                      </div>
                      <div>
                        <label className="form-label" htmlFor="attachment-description">Descripción</label>
                        <input
                          id="attachment-description"
                          name="attachment_description"
                          type="text"
                          className="form-input"
                          value={uploadMeta.description}
                          onChange={(e) => setUploadMeta((prev) => ({ ...prev, description: e.target.value }))}
                          placeholder="Descripción breve del archivo…"
                        />
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-3">
                      <div>
                        <label className="form-label" htmlFor="attachment-category">Categoría</label>
                        <select
                          id="attachment-category"
                          name="attachment_category"
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
                      </div>
                      {currentLinkedOrderType ? (
                        <div>
                          <label className="form-label" htmlFor="attachment-linked-order">
                            Vincular a {LINKABLE_ATTACHMENT_LABELS[currentLinkedOrderType]}
                          </label>
                          <select
                            id="attachment-linked-order"
                            name="attachment_linked_order"
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
                          <p className="mt-2 text-xs text-ink-muted">
                            {currentLinkableOrders.length > 0
                              ? `Puedes asociar este archivo a un ${LINKABLE_ATTACHMENT_LABELS[currentLinkedOrderType]} estructurado para seguir resultados con más contexto.`
                              : `No hay ${currentLinkedOrderType === 'EXAMEN' ? 'exámenes' : 'derivaciones'} estructurados disponibles todavía.`}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ink-secondary">
                      {selectedFile ? `Archivo seleccionado: ${selectedFile.name}` : 'Selecciona un archivo para subirlo a esta atención.'}
                    </p>
                    <button
                      type="submit"
                      className={TOOLBAR_PRIMARY_BUTTON_CLASS}
                      disabled={uploadMutation.isPending || !selectedFile}
                    >
                      {uploadMutation.isPending ? 'Subiendo…' : 'Subir Archivo'}
                    </button>
                  </div>
                </form>
              )}

              {uploadError && (
                <p className="mt-4 text-sm text-status-red-text">{uploadError}</p>
              )}

              <div className="mt-5 overflow-hidden rounded-card border border-surface-muted/35">
                {attachmentsQuery.isLoading ? (
                  <div className="p-4 text-sm text-ink-muted">Cargando adjuntos…</div>
                ) : attachmentsQuery.error ? (
                  <div className="p-4 text-sm text-status-red-text">
                    {getErrorMessage(attachmentsQuery.error)}
                  </div>
                ) : attachments.length === 0 ? (
                  <div className="p-4 text-sm text-ink-muted">No hay archivos adjuntos.</div>
                ) : (
                  <ul className="divide-y divide-surface-muted/30">
                    {attachments.map((attachment) => (
                      <li key={attachment.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-ink">
                            {attachment.originalName}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {formatFileSize(attachment.size)} ·{' '}
                            {formatDateTime(attachment.uploadedAt)}
                            {attachment.uploadedBy?.nombre ? ` · ${attachment.uploadedBy.nombre}` : ''}
                          </p>
                          {(attachment.category || attachment.description) && (
                            <p className="text-xs text-ink-muted">
                              {[attachment.category, attachment.description].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {attachment.linkedOrderType && attachment.linkedOrderLabel && (
                            <p className="text-xs text-accent-text">
                              Vinculado a {LINKABLE_ATTACHMENT_LABELS[attachment.linkedOrderType]}: {attachment.linkedOrderLabel}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownload(attachment)}
                            className={TOOLBAR_BUTTON_CLASS}
                          >
                            <FiDownload className="h-4 w-4" />
                            Descargar
                          </button>
                          {isDoctor && (
                            <button
                              type="button"
                              onClick={() => setShowDeleteAttachment(attachment.id)}
                              disabled={deleteMutation.isPending}
                              className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-input bg-status-red px-4 py-3 text-sm font-medium text-white transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-red/35 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <FiTrash2 className="h-4 w-4" />
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
