const ENCOUNTER_DRAFT_VERSION = 2;
const ENCOUNTER_DRAFT_PREFIX = 'anamneo:encounter-draft';
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

function getEncounterDraftKey(encounterId: string, userId: string) {
  return `${ENCOUNTER_DRAFT_PREFIX}:v${ENCOUNTER_DRAFT_VERSION}:${userId}:${encounterId}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readEncounterDraft(encounterId: string, userId: string): EncounterDraft | null {
  if (typeof window === 'undefined') return null;

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

  window.localStorage.setItem(
    getEncounterDraftKey(draft.encounterId, draft.userId),
    JSON.stringify({ ...draft, savedAt: new Date().toISOString() }),
  );
}

export function clearEncounterDraft(encounterId: string, userId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getEncounterDraftKey(encounterId, userId));
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
