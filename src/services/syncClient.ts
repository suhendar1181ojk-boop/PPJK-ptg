import {
  buildDeterministicShipmentId,
  getInitialSeedD1Shipments,
  mergeD1ShipmentsLww,
  normalizeD1ShipmentRecord,
  type D1ImporterSummaryRow,
  type D1ShipmentFilter,
  type D1ShipmentInput,
  type D1ShipmentRecord,
  type D1SyncQueueItem,
  generateD1QueryUrl,
  summarizeD1ByImporter,
} from '../utils/d1Contract';

export const D1_CACHE_DB_NAME = 'ptg_ppjk_d1_cache';
const D1_CACHE_DB_VERSION = 1;
const STORE_SHIPMENTS = 'shipments';
const STORE_SYNC_QUEUE = 'sync_queue';
const STORE_META = 'meta';
const META_LAST_SYNC_KEY = 'last_sync_at';
const META_INITIALIZED_KEY = 'cache_initialized';

// Fallback in-memory mirror if IndexedDB is unavailable in constrained contexts
const memoryShipments = new Map<string, D1ShipmentRecord>();
const memoryQueue = new Map<string, D1SyncQueueItem>();
let memoryLastSyncAt: string | null = null;
let memoryInitialized = false;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openD1CacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error('IndexedDB tidak tersedia di lingkungan ini.'));
      return;
    }
    const req = indexedDB.open(D1_CACHE_DB_NAME, D1_CACHE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SHIPMENTS)) {
        const sStore = db.createObjectStore(STORE_SHIPMENTS, { keyPath: 'id' });
        sStore.createIndex('os_code', 'os_code', { unique: false });
        sStore.createIndex('updated_at', 'updated_at', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        const qStore = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'queue_id' });
        qStore.createIndex('shipment_id', 'shipment_id', { unique: false });
        qStore.createIndex('queued_at', 'queued_at', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Gagal membuka IndexedDB D1 cache.'));
  });
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  if (!hasIndexedDb()) {
    if (storeName === STORE_SHIPMENTS) return Array.from(memoryShipments.values()) as unknown as T[];
    if (storeName === STORE_SYNC_QUEUE) return Array.from(memoryQueue.values()) as unknown as T[];
    return [];
  }
  const db = await openD1CacheDb();
  try {
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(req.error || new Error(`Gagal membaca ${storeName}.`));
    });
  } finally {
    db.close();
  }
}

async function idbGetMeta(key: string): Promise<string | null> {
  if (!hasIndexedDb()) {
    if (key === META_LAST_SYNC_KEY) return memoryLastSyncAt;
    if (key === META_INITIALIZED_KEY) return memoryInitialized ? '1' : null;
    return null;
  }
  const db = await openD1CacheDb();
  try {
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const req = store.get(key);
      req.onsuccess = () => {
        const res = req.result as { key: string; value?: string } | undefined;
        resolve(res?.value ?? null);
      };
      req.onerror = () => reject(req.error || new Error('Gagal membaca metadata cache.'));
    });
  } finally {
    db.close();
  }
}

async function idbSetMeta(key: string, value: string): Promise<void> {
  if (!hasIndexedDb()) {
    if (key === META_LAST_SYNC_KEY) memoryLastSyncAt = value;
    if (key === META_INITIALIZED_KEY) memoryInitialized = value === '1';
    return;
  }
  const db = await openD1CacheDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Gagal menyimpan metadata cache.'));
    });
  } finally {
    db.close();
  }
}

async function idbPutMany<T extends object>(storeName: string, items: T[]): Promise<void> {
  if (items.length === 0) return;
  if (!hasIndexedDb()) {
    if (storeName === STORE_SHIPMENTS) {
      for (const item of items as unknown as D1ShipmentRecord[]) {
        memoryShipments.set(item.id, item);
      }
    } else if (storeName === STORE_SYNC_QUEUE) {
      for (const item of items as unknown as D1SyncQueueItem[]) {
        memoryQueue.set(item.queue_id, item);
      }
    }
    return;
  }
  const db = await openD1CacheDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error(`Gagal menulis ${storeName}.`));
    });
  } finally {
    db.close();
  }
}

async function idbDeleteKeys(storeName: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  if (!hasIndexedDb()) {
    if (storeName === STORE_SYNC_QUEUE) {
      for (const k of keys) memoryQueue.delete(k);
    } else if (storeName === STORE_SHIPMENTS) {
      for (const k of keys) memoryShipments.delete(k);
    }
    return;
  }
  const db = await openD1CacheDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const key of keys) {
        store.delete(key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error(`Gagal menghapus entri ${storeName}.`));
    });
  } finally {
    db.close();
  }
}

export async function readLocalD1State(): Promise<{
  shipments: D1ShipmentRecord[];
  queue: D1SyncQueueItem[];
  lastSyncAt: string | null;
}> {
  const [shipments, queue, lastSyncAt, initialized] = await Promise.all([
    idbGetAll<D1ShipmentRecord>(STORE_SHIPMENTS),
    idbGetAll<D1SyncQueueItem>(STORE_SYNC_QUEUE),
    idbGetMeta(META_LAST_SYNC_KEY),
    idbGetMeta(META_INITIALIZED_KEY),
  ]);

  let finalShipments = shipments;
  if (!initialized && shipments.length === 0) {
    const seed = getInitialSeedD1Shipments();
    await idbPutMany(STORE_SHIPMENTS, seed);
    await idbSetMeta(META_INITIALIZED_KEY, '1');
    finalShipments = seed;
  }

  return {
    shipments: finalShipments,
    queue: [...queue].sort((a, b) => a.queued_at.localeCompare(b.queued_at)),
    lastSyncAt,
  };
}

export async function saveLocalShipmentOfflineFirst(
  input: D1ShipmentInput
): Promise<{
  savedRecord: D1ShipmentRecord;
  shipments: D1ShipmentRecord[];
  queue: D1SyncQueueItem[];
}> {
  const state = await readLocalD1State();
  const osCode = input.os_code.trim().toUpperCase();
  const existing = state.shipments.find(
    (s) =>
      (input.id && s.id === input.id) ||
      s.os_code.toUpperCase() === osCode
  );

  const nowIso = new Date().toISOString();
  const nextVersion = existing
    ? Math.max(existing.version, Number(input.version) || existing.version) + 1
    : Math.max(1, Number(input.version) || 1);

  const savedRecord = normalizeD1ShipmentRecord(
    {
      ...existing,
      ...input,
      id: input.id || existing?.id || buildDeterministicShipmentId(osCode),
      os_code: osCode,
      updated_at: nowIso,
      deleted_at: null,
      version: nextVersion,
    },
    nowIso
  );

  await idbPutMany(STORE_SHIPMENTS, [savedRecord]);

  // Coalesce queue item by shipment_id so rapid offline edits don't duplicate payloads
  const queueItem: D1SyncQueueItem = {
    queue_id: `q_${savedRecord.id}`,
    action: 'upsert',
    shipment_id: savedRecord.id,
    os_code: savedRecord.os_code,
    payload: savedRecord,
    queued_at: nowIso,
    retry_count: 0,
  };
  await idbPutMany(STORE_SYNC_QUEUE, [queueItem]);

  const refreshed = await readLocalD1State();
  return {
    savedRecord,
    shipments: refreshed.shipments,
    queue: refreshed.queue,
  };
}

export async function deleteLocalShipmentOfflineFirst(
  idOrOsCode: string
): Promise<{
  deletedRecord: D1ShipmentRecord | null;
  shipments: D1ShipmentRecord[];
  queue: D1SyncQueueItem[];
}> {
  const state = await readLocalD1State();
  const targetClean = idOrOsCode.trim();
  const existing = state.shipments.find(
    (s) =>
      s.id === targetClean ||
      s.os_code.toUpperCase() === targetClean.toUpperCase()
  );

  if (!existing) {
    return { deletedRecord: null, shipments: state.shipments, queue: state.queue };
  }

  const nowIso = new Date().toISOString();
  const tombstone: D1ShipmentRecord = {
    ...existing,
    deleted_at: nowIso,
    updated_at: nowIso,
    version: existing.version + 1,
  };

  await idbPutMany(STORE_SHIPMENTS, [tombstone]);

  const queueItem: D1SyncQueueItem = {
    queue_id: `q_${tombstone.id}`,
    action: 'delete',
    shipment_id: tombstone.id,
    os_code: tombstone.os_code,
    payload: tombstone,
    queued_at: nowIso,
    retry_count: 0,
  };
  await idbPutMany(STORE_SYNC_QUEUE, [queueItem]);

  const refreshed = await readLocalD1State();
  return {
    deletedRecord: tombstone,
    shipments: refreshed.shipments,
    queue: refreshed.queue,
  };
}

export async function fetchRemoteD1Shipments(
  filter: D1ShipmentFilter = {}
): Promise<{ shipments: D1ShipmentRecord[]; syncedAt: string }> {
  const endpoint = generateD1QueryUrl('/api/shipments', filter);
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errBody || res.statusText}`);
  }
  const data = (await res.json()) as {
    ok?: boolean;
    shipments?: D1ShipmentRecord[];
    synced_at?: string;
    error?: string;
  };
  if (data.ok === false) {
    throw new Error(data.error || 'Worker D1 mengembalikan error.');
  }
  return {
    shipments: Array.isArray(data.shipments) ? data.shipments : [],
    syncedAt: data.synced_at || new Date().toISOString(),
  };
}

export async function fetchD1BackendStatus(): Promise<{
  mode: 'cloudflare-proxy' | 'local-d1-edge';
  worker_configured: boolean;
}> {
  const res = await fetch('/api/d1/status', { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Status endpoint error (${res.status})`);
  }
  return (await res.json()) as {
    mode: 'cloudflare-proxy' | 'local-d1-edge';
    worker_configured: boolean;
  };
}

async function postShipmentsBatch(records: D1ShipmentRecord[]): Promise<D1ShipmentRecord[]> {
  if (records.length === 0) return [];
  const res = await fetch('/api/shipments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ shipments: records }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Push batch gagal (${res.status}): ${errText || res.statusText}`);
  }
  const json = (await res.json()) as {
    ok?: boolean;
    shipments?: D1ShipmentRecord[];
    error?: string;
  };
  if (json.ok === false) {
    throw new Error(json.error || 'Push batch D1 ditolak.');
  }
  return Array.isArray(json.shipments) ? json.shipments : records;
}

async function deleteShipmentRemote(idOrOsCode: string): Promise<void> {
  const res = await fetch(`/api/shipments/${encodeURIComponent(idOrOsCode)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) {
    // Record was never pushed to remote before being deleted locally -> safe to clear queue
    return;
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Delete D1 gagal (${res.status}): ${errText || res.statusText}`);
  }
}

export interface SyncNowResult {
  shipments: D1ShipmentRecord[];
  pushedCount: number;
  pulledCount: number;
  pendingCount: number;
  lastSyncAt: string;
}

/**
 * Offline-First Two-Phase Sync:
 * 1) Push pending `sync_queue` (upsert batches + soft deletes) to Cloudflare D1 / API
 * 2) Pull incremental updates via `/api/shipments?since=<last_sync_at>` and apply Last-Write-Wins
 */
export async function syncNow(): Promise<SyncNowResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Perangkat sedang Offline. Perubahan tersimpan di antrean IndexedDB.');
  }

  const initial = await readLocalD1State();
  const upsertItems = initial.queue.filter((item) => item.action === 'upsert');
  const deleteItems = initial.queue.filter((item) => item.action === 'delete');

  let pushedCount = 0;

  // Phase 1A: Push upserts in chunks of 100
  const chunkSize = 100;
  for (let i = 0; i < upsertItems.length; i += chunkSize) {
    const chunk = upsertItems.slice(i, i + chunkSize);
    try {
      const serverRows = await postShipmentsBatch(chunk.map((c) => c.payload));
      await idbPutMany(STORE_SHIPMENTS, serverRows);
      await idbDeleteKeys(
        STORE_SYNC_QUEUE,
        chunk.map((c) => c.queue_id)
      );
      pushedCount += chunk.length;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Push gagal.';
      await idbPutMany(
        STORE_SYNC_QUEUE,
        chunk.map((c) => ({ ...c, retry_count: c.retry_count + 1, last_error: errMsg }))
      );
      throw err;
    }
  }

  // Phase 1B: Push deletes
  for (const delItem of deleteItems) {
    try {
      await deleteShipmentRemote(delItem.shipment_id || delItem.os_code);
      await idbDeleteKeys(STORE_SYNC_QUEUE, [delItem.queue_id]);
      pushedCount += 1;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Delete sync gagal.';
      await idbPutMany(STORE_SYNC_QUEUE, [
        { ...delItem, retry_count: delItem.retry_count + 1, last_error: errMsg },
      ]);
      throw err;
    }
  }

  // Phase 2: Pull incremental changes from Cloudflare D1 (or full snapshot on initial sync)
  const pullRes = await fetchRemoteD1Shipments(
    initial.lastSyncAt
      ? { since: initial.lastSyncAt, include_deleted: true }
      : { include_deleted: true }
  );

  const afterPushState = await readLocalD1State();
  const merged = mergeD1ShipmentsLww(afterPushState.shipments, pullRes.shipments);
  await idbPutMany(STORE_SHIPMENTS, merged);
  await idbSetMeta(META_INITIALIZED_KEY, '1');
  await idbSetMeta(META_LAST_SYNC_KEY, pullRes.syncedAt);

  const finalState = await readLocalD1State();
  return {
    shipments: finalState.shipments,
    pushedCount,
    pulledCount: pullRes.shipments.length,
    pendingCount: finalState.queue.length,
    lastSyncAt: pullRes.syncedAt,
  };
}

export interface BatchCsvImportResult {
  uploadedToD1: boolean;
  savedCount: number;
  shipments: D1ShipmentRecord[];
  pendingCount: number;
  message: string;
}

/**
 * Saves validated CSV rows into IndexedDB immediately and pushes them in batches
 * to `POST /api/shipments` when online (falling back cleanly to offline queue otherwise).
 */
export async function importBatchShipmentsOfflineFirst(
  records: D1ShipmentRecord[]
): Promise<BatchCsvImportResult> {
  if (records.length === 0) {
    const state = await readLocalD1State();
    return {
      uploadedToD1: false,
      savedCount: 0,
      shipments: state.shipments,
      pendingCount: state.queue.length,
      message: 'Tidak ada baris valid untuk diimpor.',
    };
  }

  const nowIso = new Date().toISOString();
  const state = await readLocalD1State();
  const existingByOs = new Map(state.shipments.map((s) => [s.os_code.toUpperCase(), s]));

  const prepared: D1ShipmentRecord[] = records.map((row) => {
    const prev = existingByOs.get(row.os_code.toUpperCase());
    return normalizeD1ShipmentRecord(
      {
        ...prev,
        ...row,
        id: prev?.id || row.id || buildDeterministicShipmentId(row.os_code),
        updated_at: nowIso,
        deleted_at: null,
        version: prev ? prev.version + 1 : Math.max(1, row.version),
      },
      nowIso
    );
  });

  // Persist to IndexedDB first (offline-first safety)
  await idbPutMany(STORE_SHIPMENTS, prepared);
  await idbSetMeta(META_INITIALIZED_KEY, '1');

  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  if (online) {
    try {
      const chunkSize = 100;
      const syncedRows: D1ShipmentRecord[] = [];
      for (let i = 0; i < prepared.length; i += chunkSize) {
        const batch = prepared.slice(i, i + chunkSize);
        const serverBatch = await postShipmentsBatch(batch);
        syncedRows.push(...serverBatch);
      }
      await idbPutMany(STORE_SHIPMENTS, syncedRows);
      // Remove matching queue entries if any existed from earlier offline edits
      await idbDeleteKeys(
        STORE_SYNC_QUEUE,
        prepared.map((r) => `q_${r.id}`)
      );
      await idbSetMeta(META_LAST_SYNC_KEY, new Date().toISOString());
      const finalState = await readLocalD1State();
      return {
        uploadedToD1: true,
        savedCount: prepared.length,
        shipments: finalState.shipments,
        pendingCount: finalState.queue.length,
        message: `${prepared.length} baris disimpan ke IndexedDB & berhasil dikirim ke Cloudflare D1.`,
      };
    } catch {
      // Network/proxy unavailable -> fall through to sync_queue so rows aren't lost
    }
  }

  const queuedItems: D1SyncQueueItem[] = prepared.map((row) => ({
    queue_id: `q_${row.id}`,
    action: 'upsert',
    shipment_id: row.id,
    os_code: row.os_code,
    payload: row,
    queued_at: nowIso,
    retry_count: 0,
  }));
  await idbPutMany(STORE_SYNC_QUEUE, queuedItems);

  const finalState = await readLocalD1State();
  return {
    uploadedToD1: false,
    savedCount: prepared.length,
    shipments: finalState.shipments,
    pendingCount: finalState.queue.length,
    message: `${prepared.length} baris disimpan ke IndexedDB dan dimasukkan ke Antrean Offline (${finalState.queue.length} antre).`,
  };
}

export function computeLocalImporterSummary(records: D1ShipmentRecord[]): D1ImporterSummaryRow[] {
  return summarizeD1ByImporter(records);
}
