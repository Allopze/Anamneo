import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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

export * from './useEncounterSectionSaveFlow.handlers';
