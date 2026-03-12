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
  const lastSavedRef = useRef<string>('');
  const formDataRef = useRef<Record<string, any>>({});
  const activeSectionKeyRef = useRef<SectionKey | null>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Fetch encounter data
  const { data: encounter, isLoading, error } = useQuery({
    queryKey: ['encounter', id],
    queryFn: async () => {
      const response = await api.get(`/encounters/${id}`);
      return response.data as Encounter;
    },
  });
  const isDoctor = isMedico();
  const isEncounterCreator = encounter?.createdBy?.id === user?.id;
  const canEdit = encounter?.status === 'EN_PROGRESO' && (isDoctor || isEncounterCreator);
  const canUpload = canUploadAttachments();
  const allSections = encounter?.sections || [];
  const sections = isDoctor
    ? allSections
    : allSections.filter((section) => !MEDICO_ONLY_SECTIONS.includes(section.sectionKey));

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

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: (err) => {
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

  // Autosave logic
  const saveCurrentSection = useCallback(() => {
    if (!canEdit) return;
    if (!encounter?.sections) return;
    
    const currentSection = sections[currentSectionIndex];
    if (!currentSection) return;
    const currentData = formData[currentSection.sectionKey];
    
    // Compare the current section's data against its snapshot
    let savedSnapshot: Record<string, any> = {};
    try { savedSnapshot = JSON.parse(lastSavedRef.current || '{}'); } catch { /* ignore */ }
    const savedSectionData = JSON.stringify(savedSnapshot[currentSection.sectionKey]);
    const currentSectionData = JSON.stringify(currentData);

    if (currentSectionData !== savedSectionData) {
      setSaveStatus('saving');
      saveSectionMutation.mutate({
        sectionKey: currentSection.sectionKey,
        data: currentData,
      });
    }
  }, [canEdit, currentSectionIndex, formData, saveSectionMutation, sections]);

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

  const handleSectionDataChange = (sectionKey: SectionKey, data: any) => {
    if (!canEdit) return;
    setFormData((prev) => ({ ...prev, [sectionKey]: data }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    // Save current section before navigating
    saveCurrentSection();

    if (direction === 'prev' && currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
    } else if (direction === 'next' && encounter?.sections && currentSectionIndex < encounter.sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
    }
  };

  const handleMarkComplete = () => {
    if (!canEdit) return;
    if (!encounter?.sections) return;
    const currentSection = encounter.sections[currentSectionIndex];
    
    saveSectionMutation.mutate({
      sectionKey: currentSection.sectionKey,
      data: formData[currentSection.sectionKey],
      completed: true,
    });
  };

  const handleComplete = () => {
    if (!canEdit) return;
    saveCurrentSection();
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

  const currentSection = sections[currentSectionIndex];
  const SectionComponent = currentSection ? SECTION_COMPONENTS[currentSection.sectionKey] : null;
  const completedCount = sections.filter((s) => s.completed).length;
  const canComplete = isDoctor && encounter.status === 'EN_PROGRESO';
  const attachments = attachmentsQuery.data ?? [];

  useEffect(() => {
    activeSectionKeyRef.current = currentSection?.sectionKey ?? null;
  }, [currentSection]);

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
              <div className="flex items-center gap-2 text-sm">
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
            {sections.map((section, index) => (
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
                <span className="text-sm truncate">{section.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
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
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{currentSection?.label}</h2>
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
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200">
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
                              onClick={() => {
                                if (confirm('¿Eliminar este archivo?')) {
                                  deleteMutation.mutate(attachment.id);
                                }
                              }}
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
    </div>
  );
}
