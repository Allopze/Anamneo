'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Attachment, Encounter, SectionKey } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
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
    badgeClassName: 'bg-slate-100 text-slate-600',
    dotClassName: 'bg-slate-300',
  },
  dirty: {
    label: 'Pendiente',
    badgeClassName: 'bg-amber-100 text-amber-800',
    dotClassName: 'bg-amber-500',
  },
  saving: {
    label: 'Guardando',
    badgeClassName: 'bg-blue-100 text-blue-700',
    dotClassName: 'bg-blue-500',
  },
  saved: {
    label: 'Guardada',
    badgeClassName: 'bg-emerald-100 text-emerald-700',
    dotClassName: 'bg-emerald-500',
  },
  completed: {
    label: 'Completa',
    badgeClassName: 'bg-clinical-100 text-clinical-700',
    dotClassName: 'bg-clinical-500',
  },
  error: {
    label: 'Error',
    badgeClassName: 'bg-red-100 text-red-700',
    dotClassName: 'bg-red-500',
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

export default function EncounterWizardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isMedico, canUploadAttachments, canEditAntecedentes } = useAuthStore();

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savingSectionKey, setSavingSectionKey] = useState<SectionKey | null>(null);
  const [savedSectionKey, setSavedSectionKey] = useState<SectionKey | null>(null);
  const [errorSectionKey, setErrorSectionKey] = useState<SectionKey | null>(null);
  const lastSavedRef = useRef<string>('');
  const formDataRef = useRef<Record<string, any>>({});
  const activeSectionKeyRef = useRef<SectionKey | null>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveStatusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showDeleteAttachment, setShowDeleteAttachment] = useState<string | null>(null);

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
    enabled: isAttachmentsOpen,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/attachments/encounter/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      toast.success('Archivo adjuntado');
      setSelectedFile(null);
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

  useEffect(() => {
    if (!isAttachmentsOpen) {
      setSelectedFile(null);
      setUploadError(null);
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

  // Initialize form data from encounter sections
  useEffect(() => {
    if (encounter?.sections) {
      const initialData: Record<string, any> = {};
      encounter.sections.forEach((section) => {
        initialData[section.sectionKey] = section.data;
      });
      setFormData(initialData);
      formDataRef.current = initialData;
      // Snapshot the full data for autosave comparison (only on initial load / refetch)
      lastSavedRef.current = JSON.stringify(initialData);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleComplete = () => {
    if (!canEdit) return;
    saveCurrentSection();
    setShowCompleteConfirm(true);
  };

  const confirmComplete = () => {
    setShowCompleteConfirm(false);
    completeMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !encounter) {
    const msg = error ? getErrorMessage(error) : null;
    return (
      <div className="text-center py-12">
        <FiAlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Atención no encontrada</h2>
        {msg && <p className="text-slate-500 text-sm mb-4 whitespace-pre-line">{msg}</p>}
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
  const supportsTemplates = Boolean(currentSection && TEMPLATE_FIELD_BY_SECTION[currentSection.sectionKey]);

  let savedSnapshot: Record<string, any> = {};
  try {
    savedSnapshot = JSON.parse(lastSavedRef.current || '{}');
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/pacientes/${encounter.patientId}`}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <FiArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="font-semibold text-slate-900">
                Atención: {encounter.patient?.nombre}
              </h1>
              <p className="text-sm text-slate-500">
                {completedCount}/{sections.length} secciones completadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Save status */}
            {canEdit && (
              <div className="flex items-center gap-2 text-sm" aria-live="polite" role="status">
                {saveStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <FiLoader className="w-4 h-4 animate-spin" />
                    Guardando...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-clinical-600">
                    <FiCheck className="w-4 h-4" />
                    Guardado
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="flex items-center gap-1 text-red-600">
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
                Guardar
              </button>
            )}

            {canEditAntecedentes() && (
              <Link
                href={`/pacientes/${encounter.patientId}/historial`}
                className="btn btn-secondary flex items-center gap-2"
              >
                <FiFileText className="w-4 h-4" />
                Historial
              </Link>
            )}

            <button
              onClick={() => setIsAttachmentsOpen(true)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <FiPaperclip className="w-4 h-4" />
              {canUpload ? 'Adjuntar archivo' : 'Archivos'}
            </button>

            <Link
              href={`/atenciones/${id}/ficha`}
              className="btn btn-secondary flex items-center gap-2"
            >
              <FiEye className="w-4 h-4" />
              Vista previa
            </Link>

            {canComplete && (
              <button
                onClick={handleComplete}
                disabled={completeMutation.isPending}
                className="btn btn-success flex items-center gap-2"
              >
                <FiCheck className="w-4 h-4" />
                Completar
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar stepper */}
        <aside className="hidden lg:block w-72 min-h-[calc(100vh-4rem)] bg-white border-r border-slate-200">
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
            {/* Section header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-primary-600">
                  Sección {currentSectionIndex + 1} de {sections.length}
                </span>
                {currentSection?.completed && (
                  <span className="text-xs px-2 py-0.5 bg-clinical-100 text-clinical-700 rounded-full">
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
              <h2 className="text-2xl font-bold text-slate-900">{currentSection?.label}</h2>
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
                  readOnly={!canEdit}
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
                  Marcar como completada
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
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setIsAttachmentsOpen(false)}
          />
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200" role="dialog" aria-modal="true" aria-label="Adjuntos de la atención">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Adjuntos de la atencion</h2>
                <p className="text-sm text-slate-600">Archivos vinculados a esta atencion.</p>
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
                  <div className="flex-1 w-full">
                    <label className="form-label">Archivo</label>
                    <input
                      type="file"
                      className="form-input"
                      onChange={(e) => {
                        setUploadError(null);
                        setSelectedFile(e.target.files?.[0] ?? null);
                      }}
                    />
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
                <p className="text-sm text-red-600">{uploadError}</p>
              )}

              <div className="border border-slate-200 rounded-lg">
                {attachmentsQuery.isLoading ? (
                  <div className="p-4 text-sm text-slate-500">Cargando adjuntos...</div>
                ) : attachmentsQuery.error ? (
                  <div className="p-4 text-sm text-red-600">
                    {getErrorMessage(attachmentsQuery.error)}
                  </div>
                ) : attachments.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">No hay archivos adjuntos.</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {attachments.map((attachment) => (
                      <li key={attachment.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {attachment.originalName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatFileSize(attachment.size)} ·{' '}
                            {new Date(attachment.uploadedAt).toLocaleString('es-CL')}
                            {attachment.uploadedBy?.nombre ? ` · ${attachment.uploadedBy.nombre}` : ''}
                          </p>
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
        title="Completar atención"
        message="¿Estás seguro de completar esta atención? Una vez completada, las secciones no podrán editarse."
        confirmLabel="Completar atención"
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
