import { isSharedDeviceModeEnabled } from '@/stores/privacy-settings-store';

const ENCOUNTER_DRAFT_VERSION = 2;
const ENCOUNTER_DRAFT_PREFIX = 'anamneo:encounter-draft';
const ENCOUNTER_CONFLICT_PREFIX = 'anamneo:encounter-conflict';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface EncounterDraft {
  version: number;
  encounterId: string;
  userId: string;
  currentSectionIndex: number;
  formData: Record<string, unknown>;
  savedSnapshot: Record<string, unknown>;
  encounterUpdatedAt?: string;
  savedAt?: string;
}

export interface EncounterSectionConflictBackup {
  version: number;
  encounterId: string;
  userId: string;
  sectionKey: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  serverUpdatedAt?: string;
  savedAt?: string;
}

function getEncounterDraftKey(encounterId: string, userId: string) {
  return `${ENCOUNTER_DRAFT_PREFIX}:v${ENCOUNTER_DRAFT_VERSION}:${userId}:${encounterId}`;
}

function getEncounterConflictKey(encounterId: string, userId: string, sectionKey: string) {
  return `${ENCOUNTER_CONFLICT_PREFIX}:v${ENCOUNTER_DRAFT_VERSION}:${userId}:${encounterId}:${sectionKey}`;
}

function getEncounterUserKeyPrefixes(userId: string) {
  return [
    `${ENCOUNTER_DRAFT_PREFIX}:v${ENCOUNTER_DRAFT_VERSION}:${userId}:`,
    `${ENCOUNTER_CONFLICT_PREFIX}:v${ENCOUNTER_DRAFT_VERSION}:${userId}:`,
  ];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readEncounterDraft(encounterId: string, userId: string): EncounterDraft | null {
  if (typeof window === 'undefined') return null;
  if (isSharedDeviceModeEnabled()) return null;

  try {
    const raw = window.localStorage.getItem(getEncounterDraftKey(encounterId, userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<EncounterDraft>;
    if (
      parsed.version !== ENCOUNTER_DRAFT_VERSION
      || parsed.encounterId !== encounterId
      || parsed.userId !== userId
      || !Number.isInteger(parsed.currentSectionIndex)
      || !isPlainObject(parsed.formData)
      || !isPlainObject(parsed.savedSnapshot)
    ) {
      return null;
    }

    // Expire drafts older than TTL
    if (parsed.savedAt && Date.now() - new Date(parsed.savedAt).getTime() > DRAFT_TTL_MS) {
      window.localStorage.removeItem(getEncounterDraftKey(encounterId, userId));
      return null;
    }

    return {
      version: ENCOUNTER_DRAFT_VERSION,
      encounterId: parsed.encounterId,
      userId: parsed.userId,
      currentSectionIndex: Number(parsed.currentSectionIndex),
      formData: parsed.formData,
      savedSnapshot: parsed.savedSnapshot,
      encounterUpdatedAt: typeof parsed.encounterUpdatedAt === 'string'
        ? parsed.encounterUpdatedAt
        : undefined,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function writeEncounterDraft(draft: EncounterDraft): void {
  if (typeof window === 'undefined') return;
  if (isSharedDeviceModeEnabled()) return;

  window.localStorage.setItem(
    getEncounterDraftKey(draft.encounterId, draft.userId),
    JSON.stringify({ ...draft, savedAt: new Date().toISOString() }),
  );
}

export function readEncounterSectionConflict(
  encounterId: string,
  userId: string,
  sectionKey: string,
): EncounterSectionConflictBackup | null {
  if (typeof window === 'undefined') return null;
  if (isSharedDeviceModeEnabled()) return null;

  try {
    const raw = window.localStorage.getItem(getEncounterConflictKey(encounterId, userId, sectionKey));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<EncounterSectionConflictBackup>;
    if (
      parsed.version !== ENCOUNTER_DRAFT_VERSION
      || parsed.encounterId !== encounterId
      || parsed.userId !== userId
      || parsed.sectionKey !== sectionKey
      || !isPlainObject(parsed.localData)
      || !isPlainObject(parsed.serverData)
    ) {
      return null;
    }

    if (parsed.savedAt && Date.now() - new Date(parsed.savedAt).getTime() > DRAFT_TTL_MS) {
      window.localStorage.removeItem(getEncounterConflictKey(encounterId, userId, sectionKey));
      return null;
    }

    return {
      version: ENCOUNTER_DRAFT_VERSION,
      encounterId: parsed.encounterId,
      userId: parsed.userId,
      sectionKey: parsed.sectionKey,
      localData: parsed.localData,
      serverData: parsed.serverData,
      serverUpdatedAt: typeof parsed.serverUpdatedAt === 'string' ? parsed.serverUpdatedAt : undefined,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function writeEncounterSectionConflict(conflict: EncounterSectionConflictBackup): void {
  if (typeof window === 'undefined') return;
  if (isSharedDeviceModeEnabled()) return;

  window.localStorage.setItem(
    getEncounterConflictKey(conflict.encounterId, conflict.userId, conflict.sectionKey),
    JSON.stringify({ ...conflict, savedAt: new Date().toISOString() }),
  );
}

export function listEncounterSectionConflicts(
  encounterId: string,
  userId: string,
): EncounterSectionConflictBackup[] {
  if (typeof window === 'undefined') return [];
  if (isSharedDeviceModeEnabled()) return [];

  const prefix = `${ENCOUNTER_CONFLICT_PREFIX}:v${ENCOUNTER_DRAFT_VERSION}:${userId}:${encounterId}:`;
  const conflicts: EncounterSectionConflictBackup[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(prefix)) {
      continue;
    }

    const sectionKey = key.slice(prefix.length);
    const conflict = readEncounterSectionConflict(encounterId, userId, sectionKey);
    if (conflict) {
      conflicts.push(conflict);
    }
  }

  return conflicts.sort((left, right) => {
    const leftTs = left.savedAt ? new Date(left.savedAt).getTime() : 0;
    const rightTs = right.savedAt ? new Date(right.savedAt).getTime() : 0;
    return rightTs - leftTs;
  });
}

export function clearEncounterDraft(encounterId: string, userId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getEncounterDraftKey(encounterId, userId));
}

export function clearEncounterSectionConflict(encounterId: string, userId: string, sectionKey: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getEncounterConflictKey(encounterId, userId, sectionKey));
}

export function clearEncounterLocalStateForUser(userId: string): void {
  if (typeof window === 'undefined') return;

  const prefixes = getEncounterUserKeyPrefixes(userId);
  const keysToRemove: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }

    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

export function hasEncounterDraftUnsavedChanges(draft: Pick<EncounterDraft, 'formData' | 'savedSnapshot'>): boolean {
  const keys = new Set([
    ...Object.keys(draft.formData),
    ...Object.keys(draft.savedSnapshot),
  ]);

  for (const key of Array.from(keys)) {
    if (JSON.stringify(draft.formData[key]) !== JSON.stringify(draft.savedSnapshot[key])) {
      return true;
    }
  }

  return false;
}
