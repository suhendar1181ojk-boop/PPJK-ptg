import * as XLSX from 'xlsx';
import type { DatabaseState } from '../types/ppjk';
import {
  buildDatabaseBackupFilename,
  buildLocalBackupSnapshotRecord,
  MAX_LOCAL_BACKUP_SNAPSHOTS,
  parseDatabaseBackupFromWorkbookSheets,
  parseDatabaseBackupJson,
  serializeDatabaseBackupJson,
  sortAndTrimLocalBackups,
  type BackupRecordCounts,
  type BackupSnapshotSource,
  type LocalBackupSnapshotRecord,
} from '../utils/backupLogic';
import { serializeDatabaseToSheetMatrixMap } from '../utils/sheetsSchema';

const BACKUP_VAULT_DB_NAME = 'PTG_PPJK_BACKUP_VAULT_DB';
const BACKUP_VAULT_DB_VERSION = 1;
const BACKUP_VAULT_STORE = 'snapshots';
const BACKUP_VAULT_LS_KEY = 'PTG_PPJK_BACKUP_VAULT_V1';

export interface ParsedBackupFilePreview {
  fileName: string;
  fileType: 'json' | 'xlsx';
  byteSize: number;
  createdAt: string;
  createdBy: string;
  counts: BackupRecordCounts;
  database: DatabaseState;
  matchedTabs?: string[];
}

function hasIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openBackupVaultDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error('IndexedDB tidak tersedia.'));
  }
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(BACKUP_VAULT_DB_NAME, BACKUP_VAULT_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BACKUP_VAULT_STORE)) {
        db.createObjectStore(BACKUP_VAULT_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Gagal membuka vault backup IndexedDB.'));
  });
}

function readBackupsFromLocalStorage(): LocalBackupSnapshotRecord[] {
  try {
    const raw = localStorage.getItem(BACKUP_VAULT_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sortAndTrimLocalBackups(parsed) : [];
  } catch {
    return [];
  }
}

function writeBackupsToLocalStorage(records: LocalBackupSnapshotRecord[]): void {
  try {
    const trimmed = sortAndTrimLocalBackups(records, MAX_LOCAL_BACKUP_SNAPSHOTS);
    localStorage.setItem(BACKUP_VAULT_LS_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota overflow in localStorage fallback; IndexedDB holds full snapshots
  }
}

async function replaceBackupVaultInIndexedDb(records: LocalBackupSnapshotRecord[]): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openBackupVaultDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BACKUP_VAULT_STORE, 'readwrite');
      const store = tx.objectStore(BACKUP_VAULT_STORE);
      store.clear();
      for (const rec of records) {
        store.put(rec);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Gagal menulis snapshot backup.'));
      tx.onabort = () => reject(tx.error || new Error('Transaksi snapshot backup dibatalkan.'));
    });
  } finally {
    db.close();
  }
}

export async function listLocalBackupSnapshots(): Promise<LocalBackupSnapshotRecord[]> {
  if (!hasIndexedDb()) {
    return readBackupsFromLocalStorage();
  }
  try {
    const db = await openBackupVaultDb();
    try {
      const rows = await new Promise<LocalBackupSnapshotRecord[]>((resolve, reject) => {
        const tx = db.transaction(BACKUP_VAULT_STORE, 'readonly');
        const req = tx.objectStore(BACKUP_VAULT_STORE).getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error || new Error('Gagal membaca daftar backup lokal.'));
      });
      if (rows.length > 0) {
        return sortAndTrimLocalBackups(rows, MAX_LOCAL_BACKUP_SNAPSHOTS);
      }
      return readBackupsFromLocalStorage();
    } finally {
      db.close();
    }
  } catch {
    return readBackupsFromLocalStorage();
  }
}

export async function saveLocalBackupSnapshot(
  database: DatabaseState,
  options: {
    createdBy?: string;
    source?: BackupSnapshotSource;
    label?: string;
  } = {}
): Promise<{
  record: LocalBackupSnapshotRecord;
  allRecords: LocalBackupSnapshotRecord[];
}> {
  const existing = await listLocalBackupSnapshots();
  const record = buildLocalBackupSnapshotRecord(database, options);
  const allRecords = sortAndTrimLocalBackups(
    [record, ...existing],
    MAX_LOCAL_BACKUP_SNAPSHOTS
  );

  try {
    await replaceBackupVaultInIndexedDb(allRecords);
  } catch {
    // fallback handled below
  }
  writeBackupsToLocalStorage(allRecords);
  return { record, allRecords };
}

export async function deleteLocalBackupSnapshot(
  id: string
): Promise<LocalBackupSnapshotRecord[]> {
  const existing = await listLocalBackupSnapshots();
  const next = existing.filter((r) => r.id !== id);
  try {
    await replaceBackupVaultInIndexedDb(next);
  } catch {
    // fallback handled below
  }
  writeBackupsToLocalStorage(next);
  return next;
}

export function triggerTextBlobDownload(
  content: string,
  filename: string,
  mimeType = 'application/json;charset=utf-8'
): number {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return blob.size;
}

export function downloadDatabaseBackupJson(
  db: DatabaseState,
  createdBy: string,
  label?: string
): { filename: string; byteSize: number } {
  const filename = buildDatabaseBackupFilename('json');
  const json = serializeDatabaseBackupJson(db, {
    createdBy,
    source: 'manual',
    label: label || 'Backup JSON Penuh',
    pretty: true,
  });
  const byteSize = triggerTextBlobDownload(json, filename, 'application/json;charset=utf-8');
  return { filename, byteSize };
}

export function downloadSnapshotRecordJson(
  record: LocalBackupSnapshotRecord
): { filename: string; byteSize: number } {
  const dt = new Date(record.createdAt);
  const filename = Number.isNaN(dt.getTime())
    ? buildDatabaseBackupFilename('json')
    : buildDatabaseBackupFilename('json', dt);
  const json = JSON.stringify(record.envelope, null, 2);
  const byteSize = triggerTextBlobDownload(json, filename, 'application/json;charset=utf-8');
  return { filename, byteSize };
}

export function downloadDatabaseBackupExcel(
  db: DatabaseState,
  createdBy: string
): { filename: string; tabCount: number } {
  const matrices = serializeDatabaseToSheetMatrixMap(db, createdBy);
  const wb = XLSX.utils.book_new();
  const entries = Object.entries(matrices);
  for (const [tabName, matrix] of entries) {
    const safeSheetName = tabName.slice(0, 31);
    const ws = XLSX.utils.aoa_to_sheet(matrix);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  }
  const filename = buildDatabaseBackupFilename('xlsx');
  XLSX.writeFile(wb, filename);
  return { filename, tabCount: entries.length };
}

export function buildDatabaseBackupJsonFile(
  db: DatabaseState,
  createdBy: string,
  label = 'Backup Cloud Google Drive'
): File {
  const filename = buildDatabaseBackupFilename('json');
  const json = serializeDatabaseBackupJson(db, {
    createdBy,
    source: 'cloud-drive',
    label,
    pretty: false,
  });
  return new File([json], filename, { type: 'application/json' });
}

export async function readDatabaseBackupFile(
  file: File,
  fallbackDb: DatabaseState
): Promise<ParsedBackupFilePreview> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.json')) {
    const text = await file.text();
    const parsed = parseDatabaseBackupJson(text, fallbackDb);
    if (!parsed.ok || !parsed.database || !parsed.counts) {
      throw new Error(parsed.error || 'File backup JSON tidak valid.');
    }
    return {
      fileName: file.name,
      fileType: 'json',
      byteSize: file.size,
      createdAt: parsed.createdAt || new Date().toISOString(),
      createdBy: parsed.createdBy || 'backup-file',
      counts: parsed.counts,
      database: parsed.database,
    };
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetsMatrixMap: Record<string, string[][]> = {};
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
      });
      sheetsMatrixMap[sheetName] = rows.map((row) =>
        Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []
      );
    }

    const parsed = parseDatabaseBackupFromWorkbookSheets(sheetsMatrixMap, fallbackDb);
    if (!parsed.ok || !parsed.database || !parsed.counts) {
      throw new Error(parsed.error || 'File workbook Excel backup tidak valid.');
    }
    return {
      fileName: file.name,
      fileType: 'xlsx',
      byteSize: file.size,
      createdAt: parsed.createdAt || new Date().toISOString(),
      createdBy: 'excel-workbook',
      counts: parsed.counts,
      database: parsed.database,
      matchedTabs: parsed.matchedTabs,
    };
  }

  throw new Error(
    'Format file tidak didukung. Pilih file backup berformat .json atau .xlsx (12 tab database).'
  );
}
