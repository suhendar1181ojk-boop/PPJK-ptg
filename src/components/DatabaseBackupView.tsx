import React, { useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Database,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  HardDrive,
  History,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import type { DatabaseState } from '../types/ppjk';
import {
  computeBackupCounts,
  computeTotalBackupRecords,
  type LocalBackupSnapshotRecord,
} from '../utils/backupLogic';
import {
  readDatabaseBackupFile,
  type ParsedBackupFilePreview,
} from '../services/backupService';
import { formatBytesReadable, estimateDatabaseByteSize } from '../utils/offlineDbLogic';
import { describeRegisteredDriveDestination } from '../utils/googleDriveFolderLogic';
import { CardWindowToggleButton, ModuleCardBatchToggle } from './CardWindowControls';
import { useCardCollapse } from '../contexts/CardCollapseContext';

interface DatabaseBackupViewProps {
  db: DatabaseState;
  currentUserName: string;
  driveUserEmail: string | null;
  darkMode: boolean;
  isAdmin: boolean;
  localBackups: LocalBackupSnapshotRecord[];
  busyAction?: string | null;
  lastCloudBackup?: {
    fileName: string;
    webViewLink?: string;
    ownerEmail?: string;
    uploadedAt: string;
    channel: 'oauth-direct' | 'gas-webapp';
  } | null;
  onDownloadJson: (label?: string) => void;
  onDownloadExcel: () => void;
  onCreateLocalSnapshot: (label?: string) => Promise<void>;
  onDownloadSnapshotJson: (record: LocalBackupSnapshotRecord) => void;
  onDeleteLocalSnapshot: (id: string) => Promise<void>;
  onBackupToGoogleDrive: (label?: string) => Promise<void>;
  onRestoreDatabase: (params: {
    database: DatabaseState;
    sourceLabel: string;
    saveSafetyBackupFirst: boolean;
  }) => Promise<void>;
}

const SOURCE_LABELS: Record<LocalBackupSnapshotRecord['source'], string> = {
  manual: 'Snapshot Manual',
  'pre-restore': 'Cadangan Pra-Restore',
  'pre-reset': 'Cadangan Pra-Reset',
  'cloud-drive': 'Sinkron Cloud Drive',
};

export const DatabaseBackupView: React.FC<DatabaseBackupViewProps> = ({
  db,
  driveUserEmail,
  darkMode,
  isAdmin,
  localBackups,
  busyAction,
  lastCloudBackup,
  onDownloadJson,
  onDownloadExcel,
  onCreateLocalSnapshot,
  onDownloadSnapshotJson,
  onDeleteLocalSnapshot,
  onBackupToGoogleDrive,
  onRestoreDatabase,
}) => {
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [restorePreview, setRestorePreview] = useState<ParsedBackupFilePreview | null>(null);
  const [restoreParseError, setRestoreParseError] = useState('');
  const [parsingFile, setParsingFile] = useState(false);
  const [saveSafetyBeforeRestore, setSaveSafetyBeforeRestore] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const counts = useMemo(() => computeBackupCounts(db), [db]);
  const totalRecords = useMemo(() => computeTotalBackupRecords(counts), [counts]);
  const approxBytes = useMemo(() => estimateDatabaseByteSize(db), [db]);
  const driveDest = useMemo(
    () => describeRegisteredDriveDestination(db.pengaturan, driveUserEmail),
    [db.pengaturan, driveUserEmail]
  );
  const { isCollapsed } = useCardCollapse();
  const backupModuleCardIds = useMemo(
    () => [
      'backup-kpi-total',
      'backup-kpi-master',
      'backup-kpi-ops',
      'backup-kpi-local',
      'backup-create-card',
      'backup-restore-card',
      'backup-history-card',
    ],
    []
  );

  const showSuccess = (msg: string) => {
    setErrorMessage('');
    setStatusMessage(msg);
  };

  const showError = (err: unknown, fallback: string) => {
    setStatusMessage('');
    setErrorMessage(err instanceof Error ? err.message : fallback);
  };

  const handleCreateSnapshotClick = async () => {
    try {
      await onCreateLocalSnapshot(snapshotLabel.trim() || undefined);
      setSnapshotLabel('');
      showSuccess('Snapshot backup lokal berhasil disimpan ke Vault IndexedDB browser.');
    } catch (err) {
      showError(err, 'Gagal menyimpan snapshot backup lokal.');
    }
  };

  const handleCloudDriveBackupClick = async () => {
    try {
      await onBackupToGoogleDrive(snapshotLabel.trim() || undefined);
      showSuccess('File backup database (.json) berhasil dikirim ke folder Google Drive terdaftar.');
    } catch (err) {
      showError(err, 'Gagal mengirim backup database ke Google Drive.');
    }
  };

  const handleRestoreFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRestoreParseError('');
    setRestorePreview(null);
    setParsingFile(true);
    try {
      const preview = await readDatabaseBackupFile(file, db);
      setRestorePreview(preview);
    } catch (err) {
      setRestoreParseError(
        err instanceof Error ? err.message : 'File backup gagal dibaca atau format tidak sesuai.'
      );
    } finally {
      setParsingFile(false);
    }
  };

  const handleConfirmFileRestore = async () => {
    if (!restorePreview || !isAdmin) return;
    const modalBg = darkMode ? '#131926' : '#ffffff';
    const modalColor = darkMode ? '#f1f5f9' : '#0f172a';
    const confirm = await Swal.fire({
      title: 'Pulihkan Database dari Backup?',
      text: `Database aktif akan diganti dengan ${restorePreview.counts.shipments} shipment, ${restorePreview.counts.customers} customer, ${restorePreview.counts.users} user, dan ${restorePreview.counts.pengeluaranOps} pengeluaran ops dari "${restorePreview.fileName}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      confirmButtonText: 'Ya, Pulihkan Sekarang',
      cancelButtonText: 'Batal',
      background: modalBg,
      color: modalColor,
    });
    if (!confirm.isConfirmed) return;

    try {
      await onRestoreDatabase({
        database: restorePreview.database,
        sourceLabel: `Restore file ${restorePreview.fileName}`,
        saveSafetyBackupFirst: saveSafetyBeforeRestore,
      });
      setRestorePreview(null);
      showSuccess(
        `Database berhasil dipulihkan dari "${restorePreview.fileName}"${
          saveSafetyBeforeRestore ? ' (snapshot pengaman pra-restore telah disimpan).' : '.'
        }`
      );
    } catch (err) {
      showError(err, 'Gagal memulihkan database dari file backup.');
    }
  };

  const handleRestoreSnapshotClick = async (record: LocalBackupSnapshotRecord) => {
    if (!isAdmin) return;
    const modalBg = darkMode ? '#131926' : '#ffffff';
    const modalColor = darkMode ? '#f1f5f9' : '#0f172a';
    const confirm = await Swal.fire({
      title: `Pulihkan "${record.label}"?`,
      text: `Data aplikasi akan dikembalikan ke kondisi ${new Date(record.createdAt).toLocaleString(
        'id-ID'
      )} (${record.counts.shipments} shipment, ${record.counts.customers} customer).`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0B2545',
      confirmButtonText: 'Pulihkan Snapshot',
      cancelButtonText: 'Batal',
      background: modalBg,
      color: modalColor,
    });
    if (!confirm.isConfirmed) return;

    try {
      await onRestoreDatabase({
        database: record.envelope.database,
        sourceLabel: `Restore snapshot "${record.label}"`,
        saveSafetyBackupFirst: true,
      });
      showSuccess(`Database berhasil dipulihkan ke snapshot "${record.label}".`);
    } catch (err) {
      showError(err, 'Gagal memulihkan snapshot lokal.');
    }
  };

  const handleDeleteSnapshotClick = async (record: LocalBackupSnapshotRecord) => {
    if (!isAdmin) return;
    try {
      await onDeleteLocalSnapshot(record.id);
      showSuccess(`Snapshot "${record.label}" dihapus dari Vault lokal.`);
    } catch (err) {
      showError(err, 'Gagal menghapus snapshot lokal.');
    }
  };

  const isBusy = Boolean(busyAction);

  return (
    <div data-testid="database-backup-view" className="space-y-6">
      {/* Header & Ringkasan */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#0B2545] dark:text-white">
            Backup &amp; Pemulihan Database (12 Tab)
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Ekspor seluruh data operasional ke file JSON atau Excel 12-tab, simpan snapshot lokal di browser, atau cadangkan langsung ke Google Drive terdaftar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Total {totalRecords} entri · {formatBytesReadable(approxBytes)}
          </span>
          <ModuleCardBatchToggle cardIds={backupModuleCardIds} moduleName="Backup Database" />
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          data-testid="backup-status-banner"
          className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-xs font-medium text-emerald-800 dark:text-emerald-200"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          data-testid="backup-error-banner"
          className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 text-xs font-medium text-red-700 dark:text-red-300"
        >
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 4 Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-start">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Shipment &amp; Kontainer
            </div>
            <CardWindowToggleButton
              cardId="backup-kpi-total"
              label="KPI Shipment & Kontainer"
              compact
            />
          </div>
          {!isCollapsed('backup-kpi-total') && (
            <div className="text-lg font-bold text-[#0B2545] dark:text-white mt-1 tabular-nums">
              {counts.shipments}{' '}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                dok · {counts.kontainers} cont
              </span>
            </div>
          )}
        </div>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Data Master &amp; Akun
            </div>
            <CardWindowToggleButton
              cardId="backup-kpi-master"
              label="KPI Data Master & Akun"
              compact
            />
          </div>
          {!isCollapsed('backup-kpi-master') && (
            <div className="text-lg font-bold text-[#0B2545] dark:text-white mt-1 tabular-nums">
              {counts.customers + counts.importirs + counts.shippers}{' '}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                master · {counts.users} user
              </span>
            </div>
          )}
        </div>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Dokumen, Ops &amp; Log
            </div>
            <CardWindowToggleButton
              cardId="backup-kpi-ops"
              label="KPI Dokumen, Ops & Log"
              compact
            />
          </div>
          {!isCollapsed('backup-kpi-ops') && (
            <div className="text-lg font-bold text-[#0B2545] dark:text-white mt-1 tabular-nums">
              {counts.dokumen + counts.pengeluaranOps}{' '}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                berkas/ops · {counts.logs} log
              </span>
            </div>
          )}
        </div>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Snapshot Lokal Tersimpan
            </div>
            <CardWindowToggleButton
              cardId="backup-kpi-local"
              label="KPI Snapshot Lokal Tersimpan"
              compact
            />
          </div>
          {!isCollapsed('backup-kpi-local') && (
            <div className="text-lg font-bold text-[#0B2545] dark:text-white mt-1 tabular-nums">
              {localBackups.length}{' '}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                / 10 slot · {formatBytesReadable(approxBytes)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Section 1: Buat & Ekspor Backup */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-[#0B2545] dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-[#F28C28] dark:text-violet-400 shrink-0" />
              <span>Buat &amp; Unduh Backup Database</span>
            </h4>
            {!isCollapsed('backup-create-card') && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                File <code className="font-mono-code">.json</code> menyimpan seluruh struktur objek secara utuh (lossless), sedangkan file <code className="font-mono-code">.xlsx</code> mengekspor seluruh 12 tab Spreadsheet.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Drive: <strong className="text-slate-700 dark:text-slate-200">{driveDest.registeredGmail || 'Endpoint GAS Default'}</strong>
                {' · '}
                <span className="font-mono-code">{driveDest.folderLabel}</span>
              </span>
            </div>
            <CardWindowToggleButton
              cardId="backup-create-card"
              label="Buat & Unduh Backup Database"
            />
          </div>
        </div>

        {!isCollapsed('backup-create-card') && (
          <>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            data-testid="input-backup-label"
            value={snapshotLabel}
            onChange={(e) => setSnapshotLabel(e.target.value)}
            placeholder="Label opsional backup (contoh: Sebelum Tutup Buku Nov 2026)"
            aria-label="Label snapshot backup"
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            data-testid="btn-backup-download-json"
            disabled={isBusy}
            onClick={() => {
              onDownloadJson(snapshotLabel.trim() || undefined);
              showSuccess('File backup JSON berhasil diunduh ke perangkat Anda.');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-[#123663] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <FileJson className="w-4 h-4" />
            <span>Download Backup JSON</span>
          </button>

          <button
            type="button"
            data-testid="btn-backup-download-excel"
            disabled={isBusy}
            onClick={() => {
              onDownloadExcel();
              showSuccess('Workbook Excel 12-Tab berhasil diunduh.');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 disabled:opacity-50 text-emerald-800 dark:text-emerald-200 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Excel (12 Tab)</span>
          </button>

          <button
            type="button"
            data-testid="btn-backup-create-local"
            disabled={isBusy || !isAdmin}
            onClick={() => void handleCreateSnapshotClick()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] disabled:opacity-50 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Save className="w-4 h-4 text-[#F28C28] dark:text-violet-400" />
            <span>{busyAction === 'local' ? 'Menyimpan...' : 'Simpan Snapshot Lokal'}</span>
          </button>

          <button
            type="button"
            data-testid="btn-backup-cloud-drive"
            disabled={isBusy || !isAdmin}
            onClick={() => void handleCloudDriveBackupClick()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-500/15 hover:bg-sky-100 dark:hover:bg-sky-500/25 disabled:opacity-50 text-sky-800 dark:text-sky-200 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <CloudUpload className="w-4 h-4" />
            <span>{busyAction === 'drive' ? 'Mengunggah ke Drive...' : 'Backup ke Google Drive'}</span>
          </button>
        </div>

        {lastCloudBackup && (
          <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <span>
              Backup Drive terakhir: <strong className="font-mono-code">{lastCloudBackup.fileName}</strong>
              {' · '}
              {new Date(lastCloudBackup.uploadedAt).toLocaleString('id-ID')}
              {lastCloudBackup.ownerEmail ? ` · ${lastCloudBackup.ownerEmail}` : ''}
            </span>
            {lastCloudBackup.webViewLink && (
              <a
                href={lastCloudBackup.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Buka File di Drive</span>
              </a>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {/* Section 2: Restore dari File Backup */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-[#0B2545] dark:text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Pulihkan (Restore) Database dari File Backup</span>
            </h4>
            {!isCollapsed('backup-restore-card') && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Unggah file backup <code className="font-mono-code">.json</code> atau workbook Excel <code className="font-mono-code">.xlsx</code> (12 tab) untuk mempratinjau isi data sebelum memulihkan.
              </p>
            )}
          </div>
          <CardWindowToggleButton
            cardId="backup-restore-card"
            label="Pulihkan Database dari File Backup"
          />
        </div>

        {!isCollapsed('backup-restore-card') && (
          <>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.xlsx,.xls"
            data-testid="input-restore-backup-file"
            aria-label="Pilih file backup JSON atau Excel untuk restore"
            onChange={(e) => void handleRestoreFileSelected(e)}
            className="hidden"
          />
          <button
            type="button"
            data-testid="btn-choose-restore-file"
            disabled={isBusy || parsingFile || !isAdmin}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#182032] hover:bg-slate-100 dark:hover:bg-[#1F2940] disabled:opacity-50 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#F28C28] dark:text-violet-400" />
            <span>{parsingFile ? 'Membaca File...' : 'Pilih File Backup (.json / .xlsx)'}</span>
          </button>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={saveSafetyBeforeRestore}
              onChange={(e) => setSaveSafetyBeforeRestore(e.target.checked)}
              className="rounded border-slate-300 dark:border-white/20"
            />
            <span>Simpan snapshot cadangan otomatis sebelum restore</span>
          </label>
        </div>

        {restoreParseError && (
          <div
            role="alert"
            data-testid="restore-parse-error"
            className="px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 text-xs font-medium text-red-700 dark:text-red-300"
          >
            {restoreParseError}
          </div>
        )}

        {restorePreview && (
          <div
            data-testid="restore-preview-card"
            className="p-4 rounded-xl bg-slate-50 dark:bg-[#111625] border border-emerald-300 dark:border-emerald-500/40 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[#0B2545] dark:text-white">
                  Pratinjau File: <span className="font-mono-code">{restorePreview.fileName}</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                  Format {restorePreview.fileType.toUpperCase()} · {formatBytesReadable(restorePreview.byteSize)} · Dibuat oleh {restorePreview.createdBy}
                  {restorePreview.matchedTabs ? ` · ${restorePreview.matchedTabs.length} tab cocok` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRestorePreview(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  data-testid="btn-restore-confirm"
                  disabled={isBusy}
                  onClick={() => void handleConfirmFileRestore()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{busyAction === 'restore' ? 'Memulihkan...' : 'Pulihkan Database Sekarang'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] tabular-nums">
              <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#182032] border border-slate-200/80 dark:border-white/[0.06]">
                Shipments: <strong>{restorePreview.counts.shipments}</strong>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#182032] border border-slate-200/80 dark:border-white/[0.06]">
                Kontainer: <strong>{restorePreview.counts.kontainers}</strong>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#182032] border border-slate-200/80 dark:border-white/[0.06]">
                Customer: <strong>{restorePreview.counts.customers}</strong>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#182032] border border-slate-200/80 dark:border-white/[0.06]">
                Users: <strong>{restorePreview.counts.users}</strong>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#182032] border border-slate-200/80 dark:border-white/[0.06]">
                Biaya Ops: <strong>{restorePreview.counts.pengeluaranOps}</strong>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Section 3: Riwayat Snapshot Lokal */}
      <div className="rounded-xl bg-white dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#0B2545] dark:text-violet-400" />
            <h4 className="text-sm font-bold text-[#0B2545] dark:text-white">
              Riwayat Snapshot Backup Lokal (Vault Browser)
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {localBackups.length} / 10 snapshot di IndexedDB
            </span>
            <CardWindowToggleButton
              cardId="backup-history-card"
              label="Riwayat Snapshot Backup Lokal"
            />
          </div>
        </div>

        {!isCollapsed('backup-history-card') && (
          <>

        {localBackups.length === 0 ? (
          <div
            data-testid="backup-history-empty"
            className="p-6 text-center space-y-2"
          >
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Belum ada snapshot backup lokal tersimpan. Klik <strong>Simpan Snapshot Lokal</strong> untuk membuat titik pemulihan cepat.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-white/[0.06]">
            {localBackups.map((snap) => (
              <div
                key={snap.id}
                data-testid={`backup-snapshot-row-${snap.id}`}
                className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                    {snap.label}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {new Date(snap.createdAt).toLocaleString('id-ID')} · {SOURCE_LABELS[snap.source]} ·{' '}
                    {snap.createdBy} · {formatBytesReadable(snap.byteSize)}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                    {snap.counts.shipments} shipment · {snap.counts.kontainers} kontainer ·{' '}
                    {snap.counts.customers} customer · {snap.counts.pengeluaranOps} ops ·{' '}
                    {snap.counts.users} user
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid={`btn-snapshot-restore-${snap.id}`}
                    disabled={isBusy || !isAdmin}
                    onClick={() => void handleRestoreSnapshotClick(snap)}
                    aria-label={`Pulihkan snapshot ${snap.label}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0B2545] hover:bg-[#123663] dark:bg-violet-600 dark:hover:bg-violet-700 disabled:opacity-50 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Pulihkan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadSnapshotJson(snap)}
                    aria-label={`Unduh JSON ${snap.label}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-slate-700 dark:text-slate-200 text-[11px] font-semibold cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>JSON</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || !isAdmin}
                    onClick={() => void handleDeleteSnapshotClick(snap)}
                    aria-label={`Hapus snapshot ${snap.label}`}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/15 disabled:opacity-50 text-[11px] font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};
