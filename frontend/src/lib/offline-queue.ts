import { isSharedDeviceModeEnabled } from '@/stores/privacy-settings-store';

/**
 * Offline save queue backed by IndexedDB.
 *
 * When a section save fails due to a network error, the payload is stored
 * in IndexedDB. When connectivity returns, queued saves are replayed in
 * order against the API.
 */

const DB_NAME = 'anamneo-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-saves';
const PENDING_SAVE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface PendingSave {
  id?: number; // auto-incremented by IndexedDB
  encounterId: string;
  sectionKey: string;
  data: unknown;
  baseUpdatedAt?: string;
  completed?: boolean;
  notApplicable?: boolean;
  notApplicableReason?: string;
  queuedAt: string;
  userId: string;
}

function isPendingSaveExpired(save: Pick<PendingSave, 'queuedAt'>): boolean {
  const queuedAtTs = new Date(save.queuedAt).getTime();
  if (Number.isNaN(queuedAtTs)) {
    return true;
  }

  return Date.now() - queuedAtTs > PENDING_SAVE_TTL_MS;
}

function getPendingSaveIdentity(save: Pick<PendingSave, 'userId' | 'encounterId' | 'sectionKey'>): string {
  return `${save.userId}::${save.encounterId}::${save.sectionKey}`;
}

export function collapsePendingSaves(saves: PendingSave[]): PendingSave[] {
  const latestByIdentity = new Map<string, PendingSave>();

  [...saves]
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
    .forEach((save) => {
      latestByIdentity.set(getPendingSaveIdentity(save), save);
    });

  return [...latestByIdentity.values()].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

/* ---------- helpers ---------- */

function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ---------- public API ---------- */

/** Enqueue a failed section save for later retry. */
export async function enqueueSave(save: Omit<PendingSave, 'id'>): Promise<void> {
  if (isSharedDeviceModeEnabled()) {
    throw new Error('El modo equipo compartido desactiva el guardado offline local');
  }

  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB no disponible — no se puede encolar el guardado offline');
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        store.add(save);
        return;
      }

      const currentSave = cursor.value as PendingSave;
      if (getPendingSaveIdentity(currentSave) === getPendingSaveIdentity(save)) {
        cursor.delete();
      }
      cursor.continue();
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Read all pending saves ordered by queuedAt (oldest first). */
export async function getPendingSaves(): Promise<PendingSave[]> {
  if (isSharedDeviceModeEnabled()) return [];
  if (!isIndexedDBAvailable()) return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const rawSaves = request.result as PendingSave[];
      const activeSaves = rawSaves.filter((save) => !isPendingSaveExpired(save));

      rawSaves.forEach((save) => {
        if (save.id && isPendingSaveExpired(save)) {
          store.delete(save.id);
        }
      });

      resolve(collapsePendingSaves(activeSaves));
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
    tx.oncomplete = () => {
      db.close();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export function filterPendingSavesByUser(saves: PendingSave[], userId: string): PendingSave[] {
  return saves.filter((save) => save.userId === userId);
}

export async function getPendingSavesForUser(userId: string): Promise<PendingSave[]> {
  const saves = await getPendingSaves();
  return filterPendingSavesByUser(saves, userId);
}

/** Remove a single queued save by its IndexedDB key. */
export async function removePendingSave(id: number): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function clearPendingSavesForUser(userId: string): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      (request.result as PendingSave[]).forEach((save) => {
        if (save.id && save.userId === userId) {
          store.delete(save.id);
        }
      });
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Count of pending saves (for badge display). */
export async function countPendingSaves(): Promise<number> {
  const saves = await getPendingSaves();
  return saves.length;
}

export async function countPendingSavesForUser(userId: string): Promise<number> {
  const saves = await getPendingSavesForUser(userId);
  return saves.length;
}

/** Check whether an Axios error is a network failure (offline). */
export function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const axiosErr = err as { code?: string; response?: unknown };
  return axiosErr.code === 'ERR_NETWORK' || !axiosErr.response;
}
