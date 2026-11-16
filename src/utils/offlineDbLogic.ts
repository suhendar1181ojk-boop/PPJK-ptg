import type { DatabaseState } from '../types/ppjk';

export const OFFLINE_DB_COLLECTIONS = [
  'shipments',
  'kontainers',
  'customers',
  'importirs',
  'shippers',
  'users',
  'logs',
  'catatan',
  'dokumen',
  'pengaturan',
] as const;

export type OfflineCollectionKey = (typeof OFFLINE_DB_COLLECTIONS)[number];

export interface OfflineCollectionEntry<K extends OfflineCollectionKey = OfflineCollectionKey> {
  key: K;
  value: DatabaseState[K];
  updatedAt: string;
}

export interface OfflineSyncTask {
  id: string;
  reason: string;
  spreadsheetId?: string;
  queuedAt: string;
  attempts: number;
  status: 'pending' | 'syncing' | 'failed';
  lastError?: string;
}

export function buildCollectionEntries(
  db: DatabaseState,
  updatedAt = new Date().toISOString()
): OfflineCollectionEntry[] {
  return OFFLINE_DB_COLLECTIONS.map((key) => ({
    key,
    value: db[key],
    updatedAt,
  }));
}

export function assembleDatabaseFromEntries(
  entries: OfflineCollectionEntry[]
): DatabaseState | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;

  const map = new Map<OfflineCollectionKey, DatabaseState[OfflineCollectionKey]>();
  for (const entry of entries) {
    if (entry && entry.key) {
      map.set(entry.key, entry.value);
    }
  }

  const users = map.get('users') as DatabaseState['users'] | undefined;
  const pengaturan = map.get('pengaturan') as DatabaseState['pengaturan'] | undefined;
  if (!Array.isArray(users) || users.length === 0 || !pengaturan) {
    return null;
  }

  return {
    shipments: Array.isArray(map.get('shipments'))
      ? (map.get('shipments') as DatabaseState['shipments'])
      : [],
    kontainers: Array.isArray(map.get('kontainers'))
      ? (map.get('kontainers') as DatabaseState['kontainers'])
      : [],
    customers: Array.isArray(map.get('customers'))
      ? (map.get('customers') as DatabaseState['customers'])
      : [],
    importirs: Array.isArray(map.get('importirs'))
      ? (map.get('importirs') as DatabaseState['importirs'])
      : [],
    shippers: Array.isArray(map.get('shippers'))
      ? (map.get('shippers') as DatabaseState['shippers'])
      : [],
    users,
    logs: Array.isArray(map.get('logs')) ? (map.get('logs') as DatabaseState['logs']) : [],
    catatan: Array.isArray(map.get('catatan'))
      ? (map.get('catatan') as DatabaseState['catatan'])
      : [],
    dokumen: Array.isArray(map.get('dokumen'))
      ? (map.get('dokumen') as DatabaseState['dokumen'])
      : [],
    pengaturan,
  };
}

export function enqueueCoalescedSyncTask(
  queue: OfflineSyncTask[],
  input: {
    reason: string;
    spreadsheetId?: string;
    queuedAt?: string;
    id?: string;
  }
): OfflineSyncTask[] {
  const queuedAt = input.queuedAt || new Date().toISOString();
  const targetSheetId = (input.spreadsheetId || '').trim() || undefined;

  // Coalesce into an existing pending/failed task for the same spreadsheetId
  // because spreadsheet sync always pushes the authoritative snapshot.
  const existingIdx = queue.findIndex(
    (item) =>
      (item.status === 'pending' || item.status === 'failed') &&
      (item.spreadsheetId || undefined) === targetSheetId
  );

  if (existingIdx >= 0) {
    const next = [...queue];
    const current = next[existingIdx];
    next[existingIdx] = {
      ...current,
      reason: input.reason || current.reason,
      queuedAt,
      status: 'pending',
    };
    return next;
  }

  const newTask: OfflineSyncTask = {
    id: input.id || `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    reason: input.reason,
    spreadsheetId: targetSheetId,
    queuedAt,
    attempts: 0,
    status: 'pending',
  };

  return [...queue, newTask];
}

export function markSyncTaskAttempt(
  queue: OfflineSyncTask[],
  id: string,
  outcome: 'success' | 'error',
  errorMessage?: string
): OfflineSyncTask[] {
  if (outcome === 'success') {
    return queue.filter((task) => task.id !== id);
  }
  return queue.map((task) =>
    task.id === id
      ? {
          ...task,
          attempts: task.attempts + 1,
          status: 'failed',
          lastError: errorMessage || 'Gagal menyinkronkan ke Google Spreadsheet.',
        }
      : task
  );
}

export function computeCollectionCounts(db: DatabaseState): Record<string, number> {
  return {
    shipments: db.shipments?.length || 0,
    kontainers: db.kontainers?.length || 0,
    customers: db.customers?.length || 0,
    importirs: db.importirs?.length || 0,
    shippers: db.shippers?.length || 0,
    users: db.users?.length || 0,
    logs: db.logs?.length || 0,
    catatan: db.catatan?.length || 0,
    dokumen: db.dokumen?.length || 0,
    pengaturan: 1,
  };
}

export function estimateDatabaseByteSize(db: DatabaseState): number {
  try {
    const json = JSON.stringify(db);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(json).length;
    }
    return json.length;
  } catch {
    return 0;
  }
}

export function formatBytesReadable(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
