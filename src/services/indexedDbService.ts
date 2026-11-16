import type { DatabaseState } from '../types/ppjk';
import {
  assembleDatabaseFromEntries,
  buildCollectionEntries,
  computeCollectionCounts,
  enqueueCoalescedSyncTask,
  estimateDatabaseByteSize,
  markSyncTaskAttempt,
  type OfflineCollectionEntry,
  type OfflineSyncTask,
} from '../utils/offlineDbLogic';

export const INDEXED_DB_NAME = 'PTG_PPJK_OFFLINE_DB';
export const INDEXED_DB_VERSION = 1;

const STORE_COLLECTIONS = 'collections';
const STORE_SYNC_QUEUE = 'syncQueue';
const STORE_META = 'meta';

export interface IndexedDbStatusSummary {
  engine: 'IndexedDB' | 'localStorage-fallback';
  dbName: string;
  lastSavedAt: string | null;
  migratedAt: string | null;
  collectionCounts: Record<string, number>;
  approxBytes: number;
  pendingSyncCount: number;
  quotaUsageBytes: number | null;
  quotaTotalBytes: number | null;
}

export function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

let openDbPromise: Promise<IDBDatabase> | null = null;

function openOfflineDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB tidak tersedia di lingkungan ini.'));
  }
  if (openDbPromise) return openDbPromise;

  openDbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(INDEXED_DB_NAME, INDEXED_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_COLLECTIONS)) {
        db.createObjectStore(STORE_COLLECTIONS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        openDbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      openDbPromise = null;
      reject(request.error || new Error('Gagal membuka IndexedDB.'));
    };
  });

  return openDbPromise;
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction error'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

export async function loadDatabaseFromIndexedDB(): Promise<DatabaseState | null> {
  if (!isIndexedDbAvailable()) return null;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction(STORE_COLLECTIONS, 'readonly');
    const store = tx.objectStore(STORE_COLLECTIONS);
    const entries = await requestToPromise<OfflineCollectionEntry[]>(store.getAll());
    await transactionDone(tx);
    return assembleDatabaseFromEntries(entries);
  } catch {
    return null;
  }
}

export async function saveDatabaseToIndexedDB(
  database: DatabaseState,
  options?: { migratedFromLocalStorage?: boolean }
): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const nowIso = new Date().toISOString();
  const entries = buildCollectionEntries(database, nowIso);
  const db = await openOfflineDatabase();
  const tx = db.transaction([STORE_COLLECTIONS, STORE_META], 'readwrite');
  const colStore = tx.objectStore(STORE_COLLECTIONS);
  const metaStore = tx.objectStore(STORE_META);

  for (const entry of entries) {
    colStore.put(entry);
  }
  metaStore.put({ key: 'lastSavedAt', value: nowIso });
  metaStore.put({ key: 'schemaVersion', value: INDEXED_DB_VERSION });
  if (options?.migratedFromLocalStorage) {
    metaStore.put({ key: 'migratedFromLocalStorageAt', value: nowIso });
  }

  await transactionDone(tx);
}

export async function clearIndexedDB(): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openOfflineDatabase();
  const tx = db.transaction([STORE_COLLECTIONS, STORE_SYNC_QUEUE, STORE_META], 'readwrite');
  tx.objectStore(STORE_COLLECTIONS).clear();
  tx.objectStore(STORE_SYNC_QUEUE).clear();
  tx.objectStore(STORE_META).clear();
  await transactionDone(tx);
}

export async function getOfflineSyncQueue(): Promise<OfflineSyncTask[]> {
  if (!isIndexedDbAvailable()) return [];
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction(STORE_SYNC_QUEUE, 'readonly');
    const items = await requestToPromise<OfflineSyncTask[]>(
      tx.objectStore(STORE_SYNC_QUEUE).getAll()
    );
    await transactionDone(tx);
    return (items || []).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  } catch {
    return [];
  }
}

async function replaceOfflineSyncQueue(queue: OfflineSyncTask[]): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openOfflineDatabase();
  const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
  const store = tx.objectStore(STORE_SYNC_QUEUE);
  store.clear();
  for (const item of queue) {
    store.put(item);
  }
  await transactionDone(tx);
}

export async function enqueueOfflineSyncTask(
  reason: string,
  spreadsheetId?: string
): Promise<OfflineSyncTask[]> {
  const existing = await getOfflineSyncQueue();
  const updated = enqueueCoalescedSyncTask(existing, { reason, spreadsheetId });
  await replaceOfflineSyncQueue(updated);
  return updated;
}

export async function completeOfflineSyncTask(id: string): Promise<OfflineSyncTask[]> {
  const existing = await getOfflineSyncQueue();
  const updated = markSyncTaskAttempt(existing, id, 'success');
  await replaceOfflineSyncQueue(updated);
  return updated;
}

export async function failOfflineSyncTask(
  id: string,
  errorMessage: string
): Promise<OfflineSyncTask[]> {
  const existing = await getOfflineSyncQueue();
  const updated = markSyncTaskAttempt(existing, id, 'error', errorMessage);
  await replaceOfflineSyncQueue(updated);
  return updated;
}

export async function clearOfflineSyncQueue(): Promise<void> {
  await replaceOfflineSyncQueue([]);
}

export async function getIndexedDbStatusSummary(
  fallbackSnapshot?: DatabaseState
): Promise<IndexedDbStatusSummary> {
  if (!isIndexedDbAvailable()) {
    return {
      engine: 'localStorage-fallback',
      dbName: INDEXED_DB_NAME,
      lastSavedAt: null,
      migratedAt: null,
      collectionCounts: fallbackSnapshot ? computeCollectionCounts(fallbackSnapshot) : {},
      approxBytes: fallbackSnapshot ? estimateDatabaseByteSize(fallbackSnapshot) : 0,
      pendingSyncCount: 0,
      quotaUsageBytes: null,
      quotaTotalBytes: null,
    };
  }

  const [storedDb, syncQueue] = await Promise.all([
    loadDatabaseFromIndexedDB(),
    getOfflineSyncQueue(),
  ]);

  let lastSavedAt: string | null = null;
  let migratedAt: string | null = null;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction(STORE_META, 'readonly');
    const metaRows = await requestToPromise<Array<{ key: string; value: unknown }>>(
      tx.objectStore(STORE_META).getAll()
    );
    await transactionDone(tx);
    for (const row of metaRows) {
      if (row.key === 'lastSavedAt' && typeof row.value === 'string') {
        lastSavedAt = row.value;
      }
      if (row.key === 'migratedFromLocalStorageAt' && typeof row.value === 'string') {
        migratedAt = row.value;
      }
    }
  } catch {
    // ignore meta read failure
  }

  let quotaUsageBytes: number | null = null;
  let quotaTotalBytes: number | null = null;
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      quotaUsageBytes = typeof est.usage === 'number' ? est.usage : null;
      quotaTotalBytes = typeof est.quota === 'number' ? est.quota : null;
    } catch {
      // ignore storage estimate unsupported errors
    }
  }

  const targetDb = storedDb || fallbackSnapshot;
  return {
    engine: 'IndexedDB',
    dbName: INDEXED_DB_NAME,
    lastSavedAt,
    migratedAt,
    collectionCounts: targetDb ? computeCollectionCounts(targetDb) : {},
    approxBytes: targetDb ? estimateDatabaseByteSize(targetDb) : 0,
    pendingSyncCount: syncQueue.length,
    quotaUsageBytes,
    quotaTotalBytes,
  };
}
