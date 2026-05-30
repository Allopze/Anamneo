import type { QueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { writeEncounterSectionConflict, type EncounterSectionConflictBackup } from '@/lib/encounter-draft';
import type { PendingSave } from '@/lib/offline-queue';
import type { Encounter, SectionKey } from '@/types';

export interface SaveSectionMutationVars {
  sectionKey: SectionKey;
  data: any;
  baseUpdatedAt?: string;
  completed?: boolean;
  notApplicable?: boolean;
  notApplicableReason?: string;
}

export type PersistSectionResult = 'noop' | 'saved' | 'queued';

export interface UseEncounterSectionSaveFlowParams {
  canEdit: boolean;
  encounter?: Encounter;
  id: string;
  isDraftHydrated: boolean;
  queryClient: QueryClient;
  sections: NonNullable<Encounter['sections']>;
  userId?: string;
  enqueueOfflineSave: (save: Omit<PendingSave, 'id'>) => Promise<void>;
  activeSectionKeyRef: React.MutableRefObject<SectionKey | null>;
  formDataRef: React.MutableRefObject<Record<string, any>>;
  lastSavedRef: React.MutableRefObject<string>;
  setErrorSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setLastSavedAt: React.Dispatch<React.SetStateAction<Date | null>>;
  setLastSaveOrigin: React.Dispatch<React.SetStateAction<'direct' | 'offline-sync' | null>>;
  setRecoverableConflicts: React.Dispatch<React.SetStateAction<EncounterSectionConflictBackup[]>>;
  setRecoverableConflict: React.Dispatch<React.SetStateAction<EncounterSectionConflictBackup | null>>;
  setSavedSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setSavedSnapshotJson: React.Dispatch<React.SetStateAction<string>>;
  setSaveStatus: React.Dispatch<React.SetStateAction<'idle' | 'saving' | 'saved' | 'queued' | 'error'>>;
  setSavingSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
}

export function readSavedSnapshot(lastSavedRef: React.MutableRefObject<string>) {
  try {
    return JSON.parse(lastSavedRef.current || '{}') as Record<string, any>;
  } catch {
    return {};
  }
}

export function getPersistedSectionUpdatedAt(
  sections: NonNullable<Encounter['sections']>,
  sectionKey: SectionKey,
): string | undefined {
  return sections.find((section) => section.sectionKey === sectionKey)?.updatedAt;
}

export function buildSectionUpdatedAtSnapshot(sections: NonNullable<Encounter['sections']>) {
  return Object.fromEntries(
    sections.map((section) => [section.sectionKey, section.updatedAt]),
  ) as Partial<Record<SectionKey, string>>;
}

function buildIdentificationSnapshot(encounter?: Encounter): Record<string, unknown> {
  return {
    nombre: encounter?.patient?.nombre ?? '',
    rut: encounter?.patient?.rut ?? '',
    rutExempt: Boolean(encounter?.patient?.rutExempt),
    rutExemptReason: encounter?.patient?.rutExemptReason ?? '',
    edad: encounter?.patient?.edad ?? '',
    edadMeses: encounter?.patient?.edadMeses ?? null,
    sexo: encounter?.patient?.sexo ?? '',
    prevision: encounter?.patient?.prevision ?? '',
    trabajo: encounter?.patient?.trabajo ?? '',
    domicilio: encounter?.patient?.domicilio ?? '',
  };
}

export function getSectionPayloadData(params: {
  encounter?: Encounter;
  sections: NonNullable<Encounter['sections']>;
  formDataRef: React.MutableRefObject<Record<string, any>>;
  sectionKey: SectionKey;
}) {
  const { encounter, sections, formDataRef, sectionKey } = params;
  const currentFormData = formDataRef.current[sectionKey];
  if (currentFormData !== undefined) {
    return currentFormData;
  }

  const persistedSection = sections.find((section) => section.sectionKey === sectionKey);

  if (sectionKey === 'IDENTIFICACION') {
    return persistedSection?.data ?? buildIdentificationSnapshot(encounter);
  }

  return persistedSection?.data ?? {};
}

// ── refreshSectionFromServer context ────────────────────────────

export interface RefreshSectionContext {
  id: string;
  userId: string | undefined;
  queryClient: QueryClient;
  latestSectionUpdatedAtRef: React.MutableRefObject<Partial<Record<SectionKey, string>>>;
  activeSectionKeyRef: React.MutableRefObject<SectionKey | null>;
  lastSavedRef: React.MutableRefObject<string>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setSavedSnapshotJson: React.Dispatch<React.SetStateAction<string>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setSavingSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setSavedSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setErrorSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setRecoverableConflicts: React.Dispatch<React.SetStateAction<EncounterSectionConflictBackup[]>>;
  setRecoverableConflict: React.Dispatch<React.SetStateAction<EncounterSectionConflictBackup | null>>;
  setSaveStatus: React.Dispatch<React.SetStateAction<'idle' | 'saving' | 'saved' | 'queued' | 'error'>>;
  setLastSavedAt: React.Dispatch<React.SetStateAction<Date | null>>;
  setLastSaveOrigin: React.Dispatch<React.SetStateAction<'direct' | 'offline-sync' | null>>;
}

/**
 * Fetches the latest server state for a section and reconciles local state.
 * Called after a 409 conflict to surface a recoverable conflict backup.
 */
export async function refreshSectionFromServer(
  sectionKey: SectionKey,
  localDataForConflict: Record<string, unknown> | undefined,
  ctx: RefreshSectionContext,
) {

  const response = await api.get<Encounter>(`/encounters/${ctx.id}`);
  const latestEncounter = response.data;
  const latestSection = latestEncounter.sections?.find(
    (section) => section.sectionKey === sectionKey,
  );

  ctx.queryClient.setQueryData(['encounter', ctx.id], latestEncounter);

  if (!latestSection) {
    ctx.setSaveStatus('idle');
    ctx.setErrorSectionKey(null);
    return;
  }

  const normalizedServerData = (latestSection.data ?? {}) as Record<string, unknown>;
  ctx.latestSectionUpdatedAtRef.current[sectionKey] = latestSection.updatedAt;

  if (localDataForConflict && ctx.userId) {
    const savedAt = new Date().toISOString();
    const conflictBackup: EncounterSectionConflictBackup = {
      version: 2,
      encounterId: ctx.id,
      userId: ctx.userId,
      sectionKey,
      localData: localDataForConflict,
      serverData: normalizedServerData,
      serverUpdatedAt: latestSection.updatedAt,
      savedAt,
    };
    await writeEncounterSectionConflict(conflictBackup);
    ctx.setRecoverableConflicts((current) => [
      conflictBackup,
      ...current.filter((item) => item.sectionKey !== sectionKey),
    ]);
    ctx.setRecoverableConflict(conflictBackup);
  }

  ctx.setFormData((previous) => ({ ...previous, [sectionKey]: normalizedServerData }));

  const savedSnapshot = readSavedSnapshot(ctx.lastSavedRef);
  savedSnapshot[sectionKey] = normalizedServerData;
  ctx.lastSavedRef.current = JSON.stringify(savedSnapshot);
  ctx.setSavedSnapshotJson(ctx.lastSavedRef.current);
  ctx.setHasUnsavedChanges((current) =>
    ctx.activeSectionKeyRef.current === sectionKey ? false : current,
  );
  ctx.setLastSavedAt(new Date(latestSection.updatedAt));
  ctx.setLastSaveOrigin(null);
  ctx.setSavingSectionKey(null);
  ctx.setSavedSectionKey(null);
  ctx.setErrorSectionKey(localDataForConflict ? sectionKey : null);
  ctx.setSaveStatus(localDataForConflict ? 'error' : 'idle');
}

// ── Mutation success/error handler helpers ───────────────────────

import type { SaveSectionResponse } from './encounter-wizard.constants';
import { clearEncounterSectionConflict } from '@/lib/encounter-draft';
import { invalidateAlertOverviewQueries } from '@/lib/query-invalidation';
import { notify } from '@/lib/notify';
import axios from 'axios';
import { isNetworkError } from '@/lib/offline-queue';
import { isSharedDeviceModeEnabled } from '@/stores/privacy-settings-store';

export interface SaveSectionSuccessCtx extends RefreshSectionContext {
  formDataRef: React.MutableRefObject<Record<string, any>>;
  saveStatusTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

export interface SaveSectionErrorCtx {
  id: string;
  userId: string | undefined;
  encounter: Encounter | undefined;
  sections: NonNullable<Encounter['sections']>;
  formDataRef: React.MutableRefObject<Record<string, any>>;
  enqueueOfflineSave: (save: Omit<PendingSave, 'id'>) => Promise<void>;
  queryClient: QueryClient;
  refreshCtx: RefreshSectionContext;
  setErrorSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setSavingSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setSavedSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setSaveStatus: React.Dispatch<React.SetStateAction<'idle' | 'saving' | 'saved' | 'queued' | 'error'>>;
}

export async function handleSaveSectionSuccess(
  response: { data: SaveSectionResponse },
  variables: SaveSectionMutationVars,
  ctx: SaveSectionSuccessCtx,
) {
  const savedSnapshot = readSavedSnapshot(ctx.lastSavedRef);
  const normalizedSectionData = response.data.data;
  if (response.data.updatedAt) {
    ctx.latestSectionUpdatedAtRef.current[variables.sectionKey] = response.data.updatedAt;
  }
  savedSnapshot[variables.sectionKey] = normalizedSectionData;
  ctx.lastSavedRef.current = JSON.stringify(savedSnapshot);
  ctx.setSavedSnapshotJson(ctx.lastSavedRef.current);
  ctx.setFormData((previous) => ({ ...previous, [variables.sectionKey]: normalizedSectionData }));

  ctx.queryClient.setQueryData<Encounter | undefined>(['encounter', ctx.id], (previous) => {
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
              updatedAt: response.data.updatedAt,
            }
          : section,
      ),
    };
  });

  const activeSectionKey = ctx.activeSectionKeyRef.current;
  if (activeSectionKey) {
    const activeData = JSON.stringify(ctx.formDataRef.current[activeSectionKey]);
    const activeSavedData = JSON.stringify(savedSnapshot[activeSectionKey]);
    ctx.setHasUnsavedChanges(activeData !== activeSavedData);
  } else {
    ctx.setHasUnsavedChanges(false);
  }

  ctx.setSavingSectionKey(null);
  ctx.setSavedSectionKey(variables.sectionKey);
  ctx.setErrorSectionKey(null);
  if (ctx.userId) {
    clearEncounterSectionConflict(ctx.id, ctx.userId, variables.sectionKey);
  }
  ctx.setRecoverableConflicts((current) =>
    current.filter((item) => item.sectionKey !== variables.sectionKey),
  );
  ctx.setRecoverableConflict((current) =>
    current?.sectionKey === variables.sectionKey ? null : current,
  );
  ctx.setSaveStatus('saved');
  ctx.setLastSavedAt(new Date());
  ctx.setLastSaveOrigin('direct');
  response.data.warnings?.forEach((warning) => notify.info(warning));

  if (variables.sectionKey === 'EXAMEN_FISICO') {
    await invalidateAlertOverviewQueries(ctx.queryClient);
  }

  ctx.saveStatusTimerRef.current = setTimeout(() => {
    ctx.setSaveStatus('idle');
    ctx.setSavedSectionKey((current) => (current === variables.sectionKey ? null : current));
  }, 2000);
}

export function handleSaveSectionError(
  error: unknown,
  variables: SaveSectionMutationVars,
  ctx: SaveSectionErrorCtx,
) {
  ctx.setSavingSectionKey(null);
  ctx.setSavedSectionKey(null);

  if (isNetworkError(error) && ctx.id && ctx.userId) {
    if (isSharedDeviceModeEnabled()) {
      ctx.setErrorSectionKey(variables.sectionKey);
      ctx.setSaveStatus('error');
      notify.error(
        'Sin conexión. El modo equipo compartido desactiva borradores y cola offline local; reconecte antes de continuar.',
      );
      return;
    }

    void ctx
      .enqueueOfflineSave({
        encounterId: ctx.id,
        sectionKey: variables.sectionKey,
        data: variables.data,
        baseUpdatedAt: variables.baseUpdatedAt,
        completed: variables.completed,
        notApplicable: variables.notApplicable,
        notApplicableReason: variables.notApplicableReason,
        queuedAt: new Date().toISOString(),
        userId: ctx.userId,
      })
      .catch(() => {
        ctx.setErrorSectionKey(variables.sectionKey);
        ctx.setSaveStatus('error');
        notify.error('No se pudo encolar el guardado offline. Reintente manualmente.');
      });
    ctx.setErrorSectionKey(null);
    ctx.setSaveStatus('queued');
    notify.info('Sin conexión. Guardado en cola local.');
    return;
  }

  ctx.setErrorSectionKey(variables.sectionKey);
  ctx.setSaveStatus('error');

  if (axios.isAxiosError(error) && error.response?.status === 409) {
    const localConflictData = (variables.data ??
      getSectionPayloadData({
        encounter: ctx.encounter,
        sections: ctx.sections,
        formDataRef: ctx.formDataRef,
        sectionKey: variables.sectionKey,
      })) as Record<string, unknown>;

    void refreshSectionFromServer(variables.sectionKey, localConflictData, ctx.refreshCtx)
      .then(() =>
        notify.error('La sección cambió en otra sesión. Se guardó tu copia local para que puedas recuperarla.'),
      )
      .catch(() => {
        void ctx.queryClient.invalidateQueries({ queryKey: ['encounter', ctx.id] });
        notify.error('La sección cambió en otra sesión. Recargue la atención y revise antes de reintentar.');
      });
    return;
  }

  notify.error('Error al guardar: ' + getErrorMessage(error));
}
