import type { DatabaseState } from '../types/ppjk';
import {
  DATABASE_SHEET_TABS,
  parseSheetMatrixMapToDatabase,
} from './sheetsSchema';

export const BACKUP_FORMAT_ID = 'PTG_PPJK_DB_BACKUP' as const;
export const BACKUP_SCHEMA_VERSION = 1 as const;
export const MAX_LOCAL_BACKUP_SNAPSHOTS = 10;

export type BackupSnapshotSource =
  | 'manual'
  | 'pre-restore'
  | 'pre-reset'
  | 'cloud-drive';

export interface BackupRecordCounts {
  shipments: number;
  kontainers: number;
  customers: number;
  importirs: number;
  shippers: number;
  users: number;
  logs: number;
  catatan: number;
  dokumen: number;
  pengeluaranOps: number;
}

export interface DatabaseBackupEnvelope {
  format: typeof BACKUP_FORMAT_ID;
  version: number;
  createdAt: string;
  createdBy: string;
  source: BackupSnapshotSource;
  label?: string;
  counts: BackupRecordCounts;
  database: DatabaseState;
}

export interface LocalBackupSnapshotRecord {
  id: string;
  label: string;
  createdAt: string;
  createdBy: string;
  source: BackupSnapshotSource;
  byteSize: number;
  counts: BackupRecordCounts;
  envelope: DatabaseBackupEnvelope;
}

export interface ParseDatabaseBackupResult {
  ok: boolean;
  error?: string;
  envelope?: DatabaseBackupEnvelope;
  database?: DatabaseState;
  counts?: BackupRecordCounts;
  createdAt?: string;
  createdBy?: string;
  matchedTabs?: string[];
}

export function computeBackupCounts(db: Partial<DatabaseState>): BackupRecordCounts {
  return {
    shipments: Array.isArray(db.shipments) ? db.shipments.length : 0,
    kontainers: Array.isArray(db.kontainers) ? db.kontainers.length : 0,
    customers: Array.isArray(db.customers) ? db.customers.length : 0,
    importirs: Array.isArray(db.importirs) ? db.importirs.length : 0,
    shippers: Array.isArray(db.shippers) ? db.shippers.length : 0,
    users: Array.isArray(db.users) ? db.users.length : 0,
    logs: Array.isArray(db.logs) ? db.logs.length : 0,
    catatan: Array.isArray(db.catatan) ? db.catatan.length : 0,
    dokumen: Array.isArray(db.dokumen) ? db.dokumen.length : 0,
    pengeluaranOps: Array.isArray(db.pengeluaranOps) ? db.pengeluaranOps.length : 0,
  };
}

export function computeTotalBackupRecords(counts: BackupRecordCounts): number {
  return (
    counts.shipments +
    counts.kontainers +
    counts.customers +
    counts.importirs +
    counts.shippers +
    counts.users +
    counts.logs +
    counts.catatan +
    counts.dokumen +
    counts.pengeluaranOps
  );
}

export function buildDatabaseBackupFilename(
  ext: 'json' | 'xlsx',
  date = new Date()
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `PTG_PPJK_BACKUP_${y}-${m}-${d}_${hh}${mm}${ss}.${ext}`;
}

export function createDatabaseBackupEnvelope(
  db: DatabaseState,
  options: {
    createdBy?: string;
    source?: BackupSnapshotSource;
    label?: string;
    createdAt?: string;
  } = {}
): DatabaseBackupEnvelope {
  const createdAt = options.createdAt || new Date().toISOString();
  const createdBy = (options.createdBy || 'admin').trim() || 'admin';
  const source: BackupSnapshotSource = options.source || 'manual';
  const clonedDb = JSON.parse(JSON.stringify(db)) as DatabaseState;

  return {
    format: BACKUP_FORMAT_ID,
    version: BACKUP_SCHEMA_VERSION,
    createdAt,
    createdBy,
    source,
    label: options.label?.trim() || undefined,
    counts: computeBackupCounts(clonedDb),
    database: clonedDb,
  };
}

export function serializeDatabaseBackupJson(
  db: DatabaseState,
  options: {
    createdBy?: string;
    source?: BackupSnapshotSource;
    label?: string;
    createdAt?: string;
    pretty?: boolean;
  } = {}
): string {
  const envelope = createDatabaseBackupEnvelope(db, options);
  return options.pretty === false
    ? JSON.stringify(envelope)
    : JSON.stringify(envelope, null, 2);
}

function isPlainRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function normalizeCandidateDatabase(
  candidate: Record<string, unknown>,
  fallbackDb?: DatabaseState
): { ok: boolean; error?: string; database?: DatabaseState } {
  const hasShipments = Array.isArray(candidate.shipments);
  const hasUsers = Array.isArray(candidate.users);
  const hasPengaturan = isPlainRecord(candidate.pengaturan);

  if (!hasShipments && !hasUsers && !hasPengaturan) {
    return {
      ok: false,
      error:
        'Struktur file backup tidak valid: koleksi utama (shipments, users, pengaturan) tidak ditemukan.',
    };
  }

  if (!hasShipments) {
    return {
      ok: false,
      error: 'Struktur file backup tidak valid: daftar shipments tidak berupa array.',
    };
  }

  const users = Array.isArray(candidate.users)
    ? (candidate.users as DatabaseState['users'])
    : fallbackDb?.users || [];

  if (users.length === 0) {
    return {
      ok: false,
      error: 'File backup tidak memiliki data akun pengguna (users) yang valid.',
    };
  }

  const pengaturan = isPlainRecord(candidate.pengaturan)
    ? ({
        ...(fallbackDb?.pengaturan || {}),
        ...(candidate.pengaturan as unknown as DatabaseState['pengaturan']),
      } as DatabaseState['pengaturan'])
    : fallbackDb?.pengaturan;

  if (!pengaturan) {
    return {
      ok: false,
      error: 'File backup tidak memiliki objek pengaturan sistem yang valid.',
    };
  }

  const normalized: DatabaseState = {
    shipments: candidate.shipments as DatabaseState['shipments'],
    kontainers: Array.isArray(candidate.kontainers)
      ? (candidate.kontainers as DatabaseState['kontainers'])
      : [],
    customers: Array.isArray(candidate.customers)
      ? (candidate.customers as DatabaseState['customers'])
      : [],
    importirs: Array.isArray(candidate.importirs)
      ? (candidate.importirs as DatabaseState['importirs'])
      : [],
    shippers: Array.isArray(candidate.shippers)
      ? (candidate.shippers as DatabaseState['shippers'])
      : [],
    users,
    logs: Array.isArray(candidate.logs) ? (candidate.logs as DatabaseState['logs']) : [],
    catatan: Array.isArray(candidate.catatan)
      ? (candidate.catatan as DatabaseState['catatan'])
      : [],
    dokumen: Array.isArray(candidate.dokumen)
      ? (candidate.dokumen as DatabaseState['dokumen'])
      : [],
    pengeluaranOps: Array.isArray(candidate.pengeluaranOps)
      ? (candidate.pengeluaranOps as DatabaseState['pengeluaranOps'])
      : [],
    pengaturan,
  };

  return { ok: true, database: normalized };
}

export function parseDatabaseBackupJson(
  rawText: string,
  fallbackDb?: DatabaseState
): ParseDatabaseBackupResult {
  const trimmed = (rawText || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'File backup JSON kosong.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      ok: false,
      error: 'Format JSON tidak valid atau file rusak. Pastikan memilih file backup .json PTG PPJK.',
    };
  }

  if (!isPlainRecord(parsed)) {
    return {
      ok: false,
      error: 'Isi file JSON harus berupa objek snapshot database PTG PPJK.',
    };
  }

  // Case 1: Wrapped DatabaseBackupEnvelope
  if (parsed.format === BACKUP_FORMAT_ID || isPlainRecord(parsed.database)) {
    if (!isPlainRecord(parsed.database)) {
      return {
        ok: false,
        error: 'Amplop backup JSON tidak berisi objek database.',
      };
    }
    const dbCheck = normalizeCandidateDatabase(parsed.database, fallbackDb);
    if (!dbCheck.ok || !dbCheck.database) {
      return { ok: false, error: dbCheck.error };
    }
    const counts = computeBackupCounts(dbCheck.database);
    const createdAt =
      typeof parsed.createdAt === 'string' && parsed.createdAt.trim()
        ? parsed.createdAt
        : new Date().toISOString();
    const createdBy =
      typeof parsed.createdBy === 'string' && parsed.createdBy.trim()
        ? parsed.createdBy
        : 'backup-file';
    const source: BackupSnapshotSource =
      parsed.source === 'pre-restore' ||
      parsed.source === 'pre-reset' ||
      parsed.source === 'cloud-drive'
        ? parsed.source
        : 'manual';

    return {
      ok: true,
      envelope: {
        format: BACKUP_FORMAT_ID,
        version: Number(parsed.version) || BACKUP_SCHEMA_VERSION,
        createdAt,
        createdBy,
        source,
        label: typeof parsed.label === 'string' ? parsed.label : undefined,
        counts,
        database: dbCheck.database,
      },
      database: dbCheck.database,
      counts,
      createdAt,
      createdBy,
    };
  }

  // Case 2: Raw DatabaseState JSON
  const rawCheck = normalizeCandidateDatabase(parsed, fallbackDb);
  if (!rawCheck.ok || !rawCheck.database) {
    return { ok: false, error: rawCheck.error };
  }
  const counts = computeBackupCounts(rawCheck.database);
  return {
    ok: true,
    database: rawCheck.database,
    counts,
    createdAt: new Date().toISOString(),
    createdBy: 'raw-json',
  };
}

export function parseDatabaseBackupFromWorkbookSheets(
  sheetsMatrixMap: Record<string, string[][]>,
  fallbackDb: DatabaseState
): ParseDatabaseBackupResult {
  const knownTitles = new Set(DATABASE_SHEET_TABS.map((t) => t.title));
  const matchedTabs = Object.keys(sheetsMatrixMap).filter((title) =>
    knownTitles.has(title)
  );

  if (matchedTabs.length === 0) {
    return {
      ok: false,
      error:
        'Workbook Excel tidak memiliki tab database PTG PPJK (Shipments, Kontainer, Master_Customer, Pengaturan, dll).',
    };
  }

  if (!sheetsMatrixMap.Shipments && !sheetsMatrixMap.Master_Customer && !sheetsMatrixMap.Users) {
    return {
      ok: false,
      error:
        'Workbook Excel harus memiliki minimal tab "Shipments", "Master_Customer", atau "Users" untuk dipulihkan.',
    };
  }

  const parsedDb = parseSheetMatrixMapToDatabase(sheetsMatrixMap, fallbackDb);
  const counts = computeBackupCounts(parsedDb);

  return {
    ok: true,
    database: parsedDb,
    counts,
    matchedTabs,
    createdAt: new Date().toISOString(),
    createdBy: 'excel-workbook',
  };
}

export function buildLocalBackupSnapshotRecord(
  db: DatabaseState,
  options: {
    id?: string;
    label?: string;
    createdBy?: string;
    source?: BackupSnapshotSource;
    createdAt?: string;
  } = {}
): LocalBackupSnapshotRecord {
  const createdAt = options.createdAt || new Date().toISOString();
  const source: BackupSnapshotSource = options.source || 'manual';
  const defaultLabel =
    source === 'pre-restore'
      ? 'Otomatis sebelum Restore'
      : source === 'pre-reset'
        ? 'Otomatis sebelum Reset Data'
        : source === 'cloud-drive'
          ? 'Backup Drive Terjadwal'
          : 'Snapshot Manual';
  const label = (options.label || '').trim() || defaultLabel;
  const envelope = createDatabaseBackupEnvelope(db, {
    createdBy: options.createdBy,
    source,
    label,
    createdAt,
  });
  const json = JSON.stringify(envelope);
  const byteSize =
    typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(json).length
      : json.length;

  return {
    id:
      options.id ||
      `bkp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label,
    createdAt,
    createdBy: envelope.createdBy,
    source,
    byteSize,
    counts: envelope.counts,
    envelope,
  };
}

export function sortAndTrimLocalBackups(
  records: LocalBackupSnapshotRecord[],
  maxCount = MAX_LOCAL_BACKUP_SNAPSHOTS
): LocalBackupSnapshotRecord[] {
  const deduped = new Map<string, LocalBackupSnapshotRecord>();
  for (const r of records) {
    if (r && r.id && r.envelope?.database) {
      deduped.set(r.id, r);
    }
  }
  return Array.from(deduped.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.max(1, maxCount));
}
