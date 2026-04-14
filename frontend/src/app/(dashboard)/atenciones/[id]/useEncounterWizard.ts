import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { AxiosResponse } from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { normalizeClosureNoteForCompletion } from '@/lib/encounter-completion';
import {
  clearEncounterDraft,
  hasEncounterDraftUnsavedChanges,
  readEncounterDraft,
  writeEncounterDraft,
} from '@/lib/encounter-draft';
import type {
  Attachment,
  Encounter,
  IdentificacionData,
  SectionKey,
  SignEncounterResponse,
  StructuredOrder,
  TratamientoData,
} from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { buildGeneratedClinicalSummary } from '@/lib/clinical';
import {
  formatPatientMissingFields,
  getIdentificationMissingFields,
  getPatientCompletenessMeta,
} from '@/lib/patient';
import { getEncounterClinicalOutputBlockReason } from '@/lib/clinical-output';
import {
  canCompleteEncounter as canCompleteEncounterPermission,
  canEditEncounter,
  canUploadAttachments as canUploadAttachmentsPermission,
  canViewMedicoOnlySections,
} from '@/lib/permissions';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import {
  enqueueSave,
  getPendingSavesForUser,
  removePendingSave,
  countPendingSavesForUser,
  isNetworkError,
} from '@/lib/offline-queue';
import {
  invalidateAlertOverviewQueries,
  invalidateDashboardOverviewQueries,
  invalidateTaskOverviewQueries,
} from '@/lib/query-invalidation';
import toast from 'react-hot-toast';
import type { SidebarTabKey } from '@/components/EncounterDrawer';
import {
  AUTOSAVE_DELAY,
  MEDICO_ONLY_SECTIONS,
  SECTION_COMPONENTS,
  SECTION_STATUS_META,
  TEMPLATE_FIELD_BY_SECTION,
  type CompleteEncounterPayload,
  type SaveSectionResponse,
  type SectionUiState,
} from './encounter-wizard.constants';

export function useEncounterWizard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isMedico, canEditAntecedentes } = useAuthStore();
  const isOperationalAdmin = !!user?.isAdmin;
  const [isSectionSwitchPending, startSectionTransition] = useTransition();

  const drawerShortcutHint = useMemo(() => {
    if (typeof navigator === 'undefined') return 'Ctrl+.';
    return /mac/i.test(navigator.platform) ? '⌘.' : 'Ctrl+.';
  }, []);

  // ─── State ──────────────────────────────────────────────────────

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savingSectionKey, setSavingSectionKey] = useState<SectionKey | null>(null);
  const [savedSectionKey, setSavedSectionKey] = useState<SectionKey | null>(null);
  const [errorSectionKey, setErrorSectionKey] = useState<SectionKey | null>(null);
  const [savedSnapshotJson, setSavedSnapshotJson] = useState('');
  const [sidebarTab, setSidebarTab] = useState<SidebarTabKey>(() => {
    if (typeof window === 'undefined') return 'revision';
    const stored = localStorage.getItem('anamneo:encounter-drawer-tab');
    if (stored === 'revision' || stored === 'apoyo' || stored === 'cierre' || stored === 'historial') return stored;
    return 'revision';
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('anamneo:encounter-drawer-open') === '1';
  });
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
  const [showSignModal, setShowSignModal] = useState(false);
  const [showDeleteAttachment, setShowDeleteAttachment] = useState<string | null>(null);
  const [showNotApplicableModal, setShowNotApplicableModal] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [notApplicableReason, setNotApplicableReason] = useState('');
  const [railCompletedCollapsed, setRailCompletedCollapsed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('anamneo:encounter-rail-collapsed') === '1';
  });
  const [quickTask, setQuickTask] = useState({ title: '', type: 'SEGUIMIENTO', dueDate: '' });
  const [reviewActionNote, setReviewActionNote] = useState('');
  const [closureNote, setClosureNote] = useState('');
  const initializedEncounterIdRef = useRef<string | null>(null);
  const isOnline = useOnlineStatus();
  const [pendingSaveCount, setPendingSaveCount] = useState(0);
  const syncingRef = useRef(false);

  // ─── Queries ────────────────────────────────────────────────────

  const {
    data: encounter,
    isLoading,
    error,
  } = useQuery({
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
  const sections = useMemo(() => {
    const source = allSections ?? [];
    return canViewMedicoOnlySections(user ?? null)
      ? source
      : source.filter((section) => !MEDICO_ONLY_SECTIONS.includes(section.sectionKey));
  }, [allSections, user]);
  const currentSection = sections[currentSectionIndex];

  useEffect(() => {
    setReviewActionNote(encounter?.reviewNote || '');
    setClosureNote(encounter?.closureNote || '');
  }, [encounter?.id, encounter?.reviewNote, encounter?.closureNote]);

  useEffect(() => {
    activeSectionKeyRef.current = currentSection?.sectionKey ?? null;
  }, [currentSection]);

  // ─── Mutations ───────────────────────────────────────────────

  const saveSectionMutation = useMutation({
    mutationFn: async ({
      sectionKey,
      data,
      completed,
      notApplicable,
      notApplicableReason: reason,
    }: {
      sectionKey: SectionKey;
      data: any;
      completed?: boolean;
      notApplicable?: boolean;
      notApplicableReason?: string;
    }) => {
      return api.put<SaveSectionResponse>(`/encounters/${id}/sections/${sectionKey}`, {
        data,
        completed,
        notApplicable,
        ...(reason ? { notApplicableReason: reason } : {}),
      });
    },
    onMutate: (variables) => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      setSavingSectionKey(variables.sectionKey);
      setSavedSectionKey(null);
      setErrorSectionKey(null);
      setSaveStatus('saving');
    },
    onSuccess: async (response, variables) => {
      let savedSnapshot: Record<string, any> = {};
      try {
        savedSnapshot = JSON.parse(lastSavedRef.current || '{}');
      } catch {
        savedSnapshot = {};
      }

      const normalizedSectionData = response.data.data;
      savedSnapshot[variables.sectionKey] = normalizedSectionData;
      lastSavedRef.current = JSON.stringify(savedSnapshot);
      setSavedSnapshotJson(lastSavedRef.current);
      setFormData((previous) => ({
        ...previous,
        [variables.sectionKey]: normalizedSectionData,
      }));

      queryClient.setQueryData<Encounter | undefined>(['encounter', id], (previous) => {
        if (!previous?.sections) return previous;
        return {
          ...previous,
          sections: previous.sections.map((section) =>
            section.sectionKey === variables.sectionKey
              ? {
                  ...section,
                  data: normalizedSectionData,
                  completed: response.data.completed,
                  notApplicable: response.data.notApplicable,
                  notApplicableReason: response.data.notApplicableReason,
                }
              : section,
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
      setLastSavedAt(new Date());
      response.data.warnings?.forEach((warning) => toast(warning, { icon: '⚠️' }));
      if (variables.sectionKey === 'EXAMEN_FISICO') {
        await invalidateAlertOverviewQueries(queryClient);
      }
      saveStatusTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
        setSavedSectionKey((current) => (current === variables.sectionKey ? null : current));
      }, 2000);
    },
    onError: (err, variables) => {
      setSavingSectionKey(null);
      setSavedSectionKey(null);

      if (isNetworkError(err) && id && user?.id) {
        enqueueSave({
          encounterId: id,
          sectionKey: variables.sectionKey,
          data: variables.data,
          completed: variables.completed,
          notApplicable: variables.notApplicable,
          notApplicableReason: variables.notApplicableReason,
          queuedAt: new Date().toISOString(),
          userId: user.id,
        })
          .then(() => countPendingSavesForUser(user.id))
          .then(setPendingSaveCount)
          .catch(() => {
            toast.error('No se pudo encolar el guardado offline. Reintente manualmente.');
          });
        setSaveStatus('idle');
        toast('Sin conexión — guardado en cola local', { icon: '📡' });
        return;
      }

      setErrorSectionKey(variables.sectionKey);
      setSaveStatus('error');
      toast.error('Error al guardar: ' + getErrorMessage(err));
    },
  });

  const completeMutation = useMutation<void, unknown, CompleteEncounterPayload>({
    mutationFn: async (payload) => {
      await api.post(`/encounters/${id}/complete`, payload);
    },
    onSuccess: async () => {
      if (user?.id) clearEncounterDraft(id, user.id);
      toast.success('Atención completada');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['encounter', id] }),
        invalidateDashboardOverviewQueries(queryClient),
        invalidateTaskOverviewQueries(queryClient),
      ]);
      router.push(`/atenciones/${id}/ficha`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

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
    onError: (err) => toast.error(getErrorMessage(err)),
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
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', uploadMeta.category);
      fd.append('description', uploadMeta.description);
      if (uploadMeta.linkedOrderType && uploadMeta.linkedOrderId) {
        fd.append('linkedOrderType', uploadMeta.linkedOrderType);
        fd.append('linkedOrderId', uploadMeta.linkedOrderId);
      }
      return api.post(`/attachments/encounter/${id}`, fd, {
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
      setShowDeleteAttachment(null);
      queryClient.invalidateQueries({ queryKey: ['attachments', id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const reviewStatusMutation = useMutation({
    mutationFn: async ({
      reviewStatus,
      note,
    }: {
      reviewStatus: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO';
      note?: string;
    }) => api.put(`/encounters/${id}/review-status`, { reviewStatus, note }),
    onSuccess: async () => {
      toast.success('Estado de revisión actualizado');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['encounter', id] }),
        queryClient.invalidateQueries({ queryKey: ['patient', encounter?.patientId] }),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createTaskMutation = useMutation({
    mutationFn: async () =>
      api.post(`/patients/${encounter?.patientId}/tasks`, {
        ...quickTask,
        encounterId: id,
        dueDate: quickTask.dueDate || undefined,
      }),
    onSuccess: async () => {
      toast.success('Seguimiento creado');
      setQuickTask({ title: '', type: 'SEGUIMIENTO', dueDate: '' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['encounter', id] }),
        queryClient.invalidateQueries({ queryKey: ['patient', encounter?.patientId] }),
        invalidateTaskOverviewQueries(queryClient),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ─── Effects ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isAttachmentsOpen) {
      setSelectedFile(null);
      setUploadError(null);
      setUploadMeta({ category: 'GENERAL', description: '', linkedOrderType: '', linkedOrderId: '' });
    }
  }, [isAttachmentsOpen]);

  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Initialize form data from encounter sections (only on first load per encounter)
  useEffect(() => {
    if (encounter?.sections && encounter.id !== initializedEncounterIdRef.current) {
      initializedEncounterIdRef.current = encounter.id;
      const initialData: Record<string, any> = {};
      encounter.sections.forEach((section) => {
        initialData[section.sectionKey] = section.data;
      });
      const storedDraft = user?.id ? readEncounterDraft(encounter.id, user.id) : null;

      const draftIsStale =
        storedDraft?.encounterUpdatedAt &&
        encounter.updatedAt &&
        new Date(encounter.updatedAt).getTime() > new Date(storedDraft.encounterUpdatedAt).getTime();

      const useDraft = storedDraft && !draftIsStale;
      const restoredFormData = useDraft ? storedDraft.formData : initialData;
      const restoredSavedSnapshot = useDraft ? storedDraft.savedSnapshot : initialData;

      setFormData(restoredFormData);
      formDataRef.current = restoredFormData;
      lastSavedRef.current = JSON.stringify(restoredSavedSnapshot);
      setSavedSnapshotJson(lastSavedRef.current);
      setCurrentSectionIndex(
        Math.min(Math.max(useDraft ? storedDraft.currentSectionIndex : 0, 0), Math.max(sections.length - 1, 0)),
      );

      if (draftIsStale && storedDraft && hasEncounterDraftUnsavedChanges(storedDraft)) {
        toast('Se descartó un borrador local porque la atención fue actualizada en otra sesión', { icon: '⚠️' });
        if (user?.id) clearEncounterDraft(encounter.id, user.id);
      } else if (useDraft && hasEncounterDraftUnsavedChanges(storedDraft)) {
        toast.success('Se restauró un borrador local de esta atención');
      }
    }
  }, [encounter, sections.length, user?.id]);

  // Persist draft to localStorage
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
      version: 2,
      encounterId: encounter.id,
      userId: user.id,
      currentSectionIndex,
      formData,
      savedSnapshot,
      encounterUpdatedAt: encounter.updatedAt,
    };

    if (hasEncounterDraftUnsavedChanges(draft)) {
      writeEncounterDraft(draft);
      return;
    }

    clearEncounterDraft(encounter.id, user.id);
  }, [currentSectionIndex, encounter?.id, encounter?.status, encounter?.updatedAt, formData, savedSnapshotJson, user?.id]);

  // Autosave
  const persistSection = useCallback(
    async ({
      sectionKey,
      completed,
    }: {
      sectionKey?: SectionKey;
      completed?: boolean;
    } = {}) => {
      if (!canEdit || !encounter?.sections) return;

      const targetSectionKey = sectionKey ?? activeSectionKeyRef.current;
      if (!targetSectionKey) return;

      const currentData = formDataRef.current[targetSectionKey];
      let savedSnapshot: Record<string, any> = {};
      try {
        savedSnapshot = JSON.parse(lastSavedRef.current || '{}');
      } catch {
        /* ignore */
      }
      const savedSectionData = JSON.stringify(savedSnapshot[targetSectionKey]);
      const currentSectionData = JSON.stringify(currentData);
      const persistedSection = sections.find((section) => section.sectionKey === targetSectionKey);
      const shouldSaveData = currentSectionData !== savedSectionData;
      const shouldSaveCompletion = completed !== undefined && persistedSection?.completed !== completed;

      if (!shouldSaveData && !shouldSaveCompletion) return;

      setSaveStatus('saving');
      await saveSectionMutation.mutateAsync({
        sectionKey: targetSectionKey,
        data: currentData,
        ...(completed !== undefined ? { completed } : {}),
      });
    },
    [canEdit, encounter?.sections, saveSectionMutation, sections],
  );

  const saveCurrentSection = useCallback(() => {
    void persistSection();
  }, [persistSection]);

  useEffect(() => {
    if (!canEdit) {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      return;
    }
    if (hasUnsavedChanges) {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => saveCurrentSection(), AUTOSAVE_DELAY);
    }
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [canEdit, hasUnsavedChanges, saveCurrentSection]);

  // Sync offline queue
  useEffect(() => {
    if (!isOnline || syncingRef.current || !user?.id) return;

    const activeUserId = user.id;
    let cancelled = false;

    async function syncQueue() {
      const saves = await getPendingSavesForUser(activeUserId);
      if (saves.length === 0 || cancelled) return;

      syncingRef.current = true;
      let synced = 0;

      for (const save of saves) {
        if (cancelled) break;
        try {
          const payload = {
            data: save.data,
            completed: save.completed,
            ...(save.notApplicable !== undefined ? { notApplicable: save.notApplicable } : {}),
            ...(save.notApplicableReason ? { notApplicableReason: save.notApplicableReason } : {}),
          };
          await api.put(`/encounters/${save.encounterId}/sections/${save.sectionKey}`, payload);
          await removePendingSave(save.id!);
          synced++;
        } catch {
          break;
        }
      }

      syncingRef.current = false;
      const remaining = await countPendingSavesForUser(activeUserId);
      if (!cancelled) {
        setPendingSaveCount(remaining);
        if (synced > 0) {
          toast.success(`${synced} cambio${synced > 1 ? 's' : ''} sincronizado${synced > 1 ? 's' : ''}`);
          queryClient.invalidateQueries({ queryKey: ['encounter', id] });
        }
      }
    }

    void syncQueue();
    return () => {
      cancelled = true;
    };
  }, [isOnline, id, queryClient, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setPendingSaveCount(0);
      return;
    }
    void countPendingSavesForUser(user.id).then(setPendingSaveCount);
  }, [user?.id]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === 's') {
        e.preventDefault();
        saveCurrentSection();
      } else if (e.key === '.') {
        e.preventDefault();
        setIsDrawerOpen((prev) => {
          const next = !prev;
          localStorage.setItem('anamneo:encounter-drawer-open', next ? '1' : '0');
          return next;
        });
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

  // ─── Handlers ────────────────────────────────────────────────

  const handleSectionDataChange = (sectionKey: SectionKey, data: any) => {
    if (!canEdit) return;
    setFormData((prev) => ({ ...prev, [sectionKey]: data }));
    setErrorSectionKey((current) => (current === sectionKey ? null : current));
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
    const existingValue = typeof currentData[targetField] === 'string' ? currentData[targetField].trim() : '';
    const nextValue = existingValue ? `${existingValue}\n\n${content}`.trim() : content;
    handleSectionDataChange(currentSection.sectionKey, { ...currentData, [targetField]: nextValue });
    toast.success('Plantilla insertada en la sección actual');
  };

  const moveToSection = (nextIndex: number) => {
    saveCurrentSection();
    startSectionTransition(() => setCurrentSectionIndex(nextIndex));
  };

  const handleNavigate = async (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentSectionIndex > 0) {
      moveToSection(currentSectionIndex - 1);
    } else if (direction === 'next' && currentSectionIndex < sections.length - 1) {
      if (canEdit && currentSection && !currentSection.completed && !currentSection.notApplicable) {
        void persistSection({ sectionKey: currentSection.sectionKey, completed: true });
      } else {
        saveCurrentSection();
      }
      startSectionTransition(() => setCurrentSectionIndex(currentSectionIndex + 1));
    }
  };

  const handleMarkNotApplicable = () => {
    if (!canEdit || !currentSection) return;
    const REQUIRED: SectionKey[] = ['MOTIVO_CONSULTA', 'EXAMEN_FISICO', 'SOSPECHA_DIAGNOSTICA', 'TRATAMIENTO'];
    if (REQUIRED.includes(currentSection.sectionKey)) {
      toast.error('Esta sección es obligatoria y no se puede marcar como "No aplica"');
      return;
    }
    setNotApplicableReason('');
    setShowNotApplicableModal(true);
  };

  const handleConfirmNotApplicable = async () => {
    if (!currentSection) return;
    if (notApplicableReason.trim().length < 10) {
      toast.error('El motivo debe tener al menos 10 caracteres');
      return;
    }
    const sectionKey = currentSection.sectionKey;
    const currentData = formDataRef.current[sectionKey] ?? {};
    try {
      await saveSectionMutation.mutateAsync({
        sectionKey,
        data: currentData,
        completed: true,
        notApplicable: true,
        notApplicableReason: notApplicableReason.trim(),
      });
      setShowNotApplicableModal(false);
      toast.success('Sección marcada como no aplica');
    } catch {
      // onError handler already surfaces UI feedback
    }
  };

  const handleComplete = async () => {
    if (!canEdit) return;
    const blockReason = getEncounterClinicalOutputBlockReason(encounter?.clinicalOutputBlock, 'COMPLETE_ENCOUNTER');
    if (blockReason) {
      toast.error(blockReason);
      return;
    }
    if (hasUnsavedChanges) {
      const sectionKey = activeSectionKeyRef.current;
      if (sectionKey) {
        const currentData = formDataRef.current[sectionKey];
        try {
          await saveSectionMutation.mutateAsync({ sectionKey, data: currentData });
        } catch {
          return;
        }
      }
    }
    setShowCompleteConfirm(true);
  };

  const confirmComplete = () => {
    setShowCompleteConfirm(false);
    completeMutation.mutate({ closureNote: normalizeClosureNoteForCompletion(closureNote) });
  };

  const handleReviewStatusChange = (
    reviewStatus: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO',
  ) => {
    reviewStatusMutation.mutate({ reviewStatus, note: reviewActionNote });
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const response = await api.get(`/attachments/${attachment.id}/download`, { responseType: 'blob' });
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

  const handleRestoreIdentificationFromPatient = async () => {
    if (!encounter) return;
    try {
      const res = await api.post(`/encounters/${id}/reconcile-identification`);
      const reconciledData = res.data.data as IdentificacionData;
      handleSectionDataChange('IDENTIFICACION', reconciledData);
      let snap: Record<string, any> = {};
      try {
        snap = JSON.parse(lastSavedRef.current || '{}');
      } catch {
        snap = {};
      }
      snap.IDENTIFICACION = reconciledData;
      lastSavedRef.current = JSON.stringify(snap);
      setSavedSnapshotJson(lastSavedRef.current);
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      toast.success('Se restauró la identificación desde la ficha maestra del paciente');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

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

  const openDrawerTab = useCallback((tab: SidebarTabKey) => {
    setSidebarTab(tab);
    localStorage.setItem('anamneo:encounter-drawer-tab', tab);
    setIsDrawerOpen(true);
    localStorage.setItem('anamneo:encounter-drawer-open', '1');
  }, []);

  const generatedSummary = useMemo(() => {
    if (!encounter) return '';
    return buildGeneratedClinicalSummary({
      ...encounter,
      sections: sections.map((section) => ({
        ...section,
        data: formData[section.sectionKey] ?? section.data,
      })),
    } as Encounter);
  }, [encounter, formData, sections]);

  const handleSaveGeneratedSummary = useCallback(() => {
    const existing = formData.OBSERVACIONES || {};
    const updatedData = { ...existing, resumenClinico: generatedSummary };
    handleSectionDataChange('OBSERVACIONES', updatedData);
    saveSectionMutation.mutate({ sectionKey: 'OBSERVACIONES', data: updatedData });
    toast.success('Resumen longitudinal guardado');
  }, [formData.OBSERVACIONES, generatedSummary, handleSectionDataChange, saveSectionMutation]);

  const handleQuickNotesSave = useCallback(
    (text: string) => {
      const existing = formData.OBSERVACIONES || {};
      const updatedData = { ...existing, notasInternas: text };
      handleSectionDataChange('OBSERVACIONES', updatedData);
      saveSectionMutation.mutate({ sectionKey: 'OBSERVACIONES', data: updatedData });
    },
    [formData.OBSERVACIONES, handleSectionDataChange, saveSectionMutation],
  );

  const handleViewFicha = async () => {
    if (hasUnsavedChanges) {
      const sectionKey = activeSectionKeyRef.current;
      if (sectionKey) {
        const currentData = formDataRef.current[sectionKey];
        try {
          await saveSectionMutation.mutateAsync({ sectionKey, data: currentData });
        } catch {
          return;
        }
      }
    }
    router.push(`/atenciones/${id}/ficha`);
  };

  // ─── Computed values ────────────────────────────────────────

  const SectionComponent = currentSection ? SECTION_COMPONENTS[currentSection.sectionKey] : null;
  const completedCount = useMemo(() => sections.filter((s) => s.completed).length, [sections]);
  const progressPercentage = sections.length > 0 ? (completedCount / sections.length) * 100 : 0;
  const canComplete = canCompleteEncounterPermission(user ?? null, encounter);
  const attachments = useMemo(() => attachmentsQuery.data ?? [], [attachmentsQuery.data]);

  const tratamientoData = (formData.TRATAMIENTO ??
    encounter?.sections?.find((s) => s.sectionKey === 'TRATAMIENTO')?.data ??
    {}) as TratamientoData;
  const examenesEstructurados = useMemo(
    () => (Array.isArray(tratamientoData.examenesEstructurados) ? tratamientoData.examenesEstructurados : []),
    [tratamientoData.examenesEstructurados],
  );
  const derivacionesEstructuradas = useMemo(
    () => (Array.isArray(tratamientoData.derivacionesEstructuradas) ? tratamientoData.derivacionesEstructuradas : []),
    [tratamientoData.derivacionesEstructuradas],
  );
  const currentLinkedOrderType =
    uploadMeta.category === 'EXAMEN' ? 'EXAMEN' : uploadMeta.category === 'DERIVACION' ? 'DERIVACION' : '';
  const currentLinkableOrders: StructuredOrder[] = useMemo(
    () =>
      currentLinkedOrderType === 'EXAMEN'
        ? examenesEstructurados
        : currentLinkedOrderType === 'DERIVACION'
          ? derivacionesEstructuradas
          : [],
    [currentLinkedOrderType, derivacionesEstructuradas, examenesEstructurados],
  );
  const linkedAttachmentsByOrderId = useMemo(
    () =>
      attachments.reduce<Record<string, Attachment[]>>((acc, a) => {
        if (!a.linkedOrderId) return acc;
        if (!acc[a.linkedOrderId]) acc[a.linkedOrderId] = [];
        acc[a.linkedOrderId].push(a);
        return acc;
      }, {}),
    [attachments],
  );
  const supportsTemplates = Boolean(currentSection && TEMPLATE_FIELD_BY_SECTION[currentSection.sectionKey]);

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
    if (currentData !== savedData) return 'dirty';
    if (section.notApplicable) return 'notApplicable';
    if (section.completed) return 'completed';
    if (section.sectionKey === savedSectionKey) return 'saved';
    return 'idle';
  };

  const currentSectionState = currentSection ? getSectionUiState(currentSection) : 'idle';
  const currentSectionStatusMeta = SECTION_STATUS_META[currentSectionState];
  const identificationSnapshotStatus = encounter?.identificationSnapshotStatus;
  const identificationData = (formData.IDENTIFICACION ??
    encounter?.sections?.find((s) => s.sectionKey === 'IDENTIFICACION')?.data ??
    {}) as IdentificacionData;
  const patientCompletenessMeta = encounter?.patient ? getPatientCompletenessMeta(encounter.patient) : null;
  const identificationMissingFields = formatPatientMissingFields(getIdentificationMissingFields(identificationData));
  const clinicalOutputBlockReason = encounter?.clinicalOutputBlock?.reason ?? null;
  const completionBlockedReason = getEncounterClinicalOutputBlockReason(
    encounter?.clinicalOutputBlock,
    'COMPLETE_ENCOUNTER',
  );

  const lastSavedTimeStr = lastSavedAt
    ? lastSavedAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : null;

  const saveStateLabel = canEdit
    ? saveStatus === 'saving'
      ? 'Guardando…'
      : saveStatus === 'saved'
        ? 'Cambios guardados'
        : saveStatus === 'error'
          ? 'Error al guardar'
          : hasUnsavedChanges
            ? 'Cambios sin guardar'
            : lastSavedTimeStr
              ? `Guardado a las ${lastSavedTimeStr}`
              : 'Sin cambios'
    : null;

  const saveStateToneClass =
    saveStatus === 'error'
      ? 'text-status-red-text'
      : saveStatus === 'saved'
        ? 'text-status-green-text'
        : saveStatus === 'saving'
          ? 'text-ink'
          : hasUnsavedChanges
            ? 'text-accent-text'
            : 'text-ink-secondary';

  return {
    // IDs
    id,
    // Core data
    encounter,
    isLoading,
    error,
    isOperationalAdmin,
    // Auth
    isDoctor,
    canEdit,
    canUpload,
    canComplete,
    canEditAntecedentes,
    // Sections
    sections,
    currentSectionIndex,
    currentSection,
    SectionComponent,
    formData,
    isSectionSwitchPending,
    // Save state
    hasUnsavedChanges,
    saveStatus,
    saveStateLabel,
    saveStateToneClass,
    // Section status
    savingSectionKey,
    savedSectionKey,
    currentSectionState,
    currentSectionStatusMeta,
    getSectionUiState,
    savedSnapshot,
    // Time
    elapsedMinutes,
    // UI state
    isAttachmentsOpen,
    setIsAttachmentsOpen,
    selectedFile,
    setSelectedFile,
    uploadError,
    setUploadError,
    uploadMeta,
    setUploadMeta,
    showCompleteConfirm,
    setShowCompleteConfirm,
    showSignModal,
    setShowSignModal,
    showDeleteAttachment,
    setShowDeleteAttachment,
    showNotApplicableModal,
    setShowNotApplicableModal,
    previewAttachment,
    setPreviewAttachment,
    notApplicableReason,
    setNotApplicableReason,
    railCompletedCollapsed,
    setRailCompletedCollapsed,
    railCollapsed,
    setRailCollapsed,
    sidebarTab,
    setSidebarTab,
    isDrawerOpen,
    setIsDrawerOpen,
    drawerShortcutHint,
    // Network
    isOnline,
    pendingSaveCount,
    // Progress
    completedCount,
    progressPercentage,
    // Attachments
    attachments,
    attachmentsQuery,
    currentLinkedOrderType,
    currentLinkableOrders,
    linkedAttachmentsByOrderId,
    // Templates
    supportsTemplates,
    // Clinical
    generatedSummary,
    identificationSnapshotStatus,
    identificationData,
    patientCompletenessMeta,
    identificationMissingFields,
    clinicalOutputBlockReason,
    completionBlockedReason,
    // Quick task / review / closure
    quickTask,
    setQuickTask,
    reviewActionNote,
    setReviewActionNote,
    closureNote,
    setClosureNote,
    // Mutation states
    saveSectionMutation,
    completeMutation,
    signMutation,
    uploadMutation,
    deleteMutation,
    reviewStatusMutation,
    createTaskMutation,
    // Handlers
    saveCurrentSection,
    persistSection,
    handleSectionDataChange,
    handleNavigate,
    handleComplete,
    confirmComplete,
    handleMarkNotApplicable,
    handleConfirmNotApplicable,
    handleReviewStatusChange,
    handleDownload,
    handleRestoreIdentificationFromPatient,
    handleStartLinkedAttachment,
    insertTemplateIntoCurrentSection,
    moveToSection,
    openDrawerTab,
    handleSaveGeneratedSummary,
    handleQuickNotesSave,
    handleViewFicha,
  };
}

export type EncounterWizardHook = ReturnType<typeof useEncounterWizard>;
