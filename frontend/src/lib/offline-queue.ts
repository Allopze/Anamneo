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

export interface PendingSave {
  id?: number; // auto-incremented by IndexedDB
  encounterId: string;
  sectionKey: string;
  data: unknown;
  completed?: boolean;
  queuedAt: string;
  userId: string;
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
  if (!isIndexedDBAvailable()) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(save);

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
  if (!isIndexedDBAvailable()) return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => {
      db.close();
      const saves = (request.result as PendingSave[]).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
      resolve(saves);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
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

/** Count of pending saves (for badge display). */
export async function countPendingSaves(): Promise<number> {
  if (!isIndexedDBAvailable()) return 0;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).count();

    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
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
