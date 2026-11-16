import React, { useState } from 'react';
import {
  CheckCircle2,
  CloudOff,
  Database,
  Download,
  HardDrive,
  RefreshCw,
  Share,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type { IndexedDbStatusSummary } from '../services/indexedDbService';
import { formatBytesReadable, type OfflineSyncTask } from '../utils/offlineDbLogic';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'panel';
  collapsed?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'sidebar',
  collapsed = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    if (variant === 'panel') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Terinstal (Mode Aplikasi Standalone)</span>
        </span>
      );
    }
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        data-testid="pwa-install-btn"
        onClick={install}
        title="Install Aplikasi PTG PPJK (Offline PWA)"
        className={
          variant === 'sidebar'
            ? 'w-full min-h-[38px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6366F1] hover:from-[#6D28D9] hover:to-[#4F46E5] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm'
            : 'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer'
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        {!collapsed && <span>Install Aplikasi</span>}
      </button>
    );
  }

  if (isIOS || variant === 'panel') {
    return (
      <>
        <button
          type="button"
          data-testid="pwa-install-guide-btn"
          onClick={() => setShowGuideModal(true)}
          title={isIOS ? 'Cara Install di iPhone / iPad' : 'Cara Install Aplikasi PWA'}
          className={
            variant === 'sidebar'
              ? 'w-full min-h-[38px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold transition-colors cursor-pointer'
              : 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#161D2F] hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-800 dark:text-slate-100 text-xs font-semibold transition-colors cursor-pointer'
          }
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && <span>{isIOS ? 'Install di iOS' : 'Panduan Install PWA'}</span>}
        </button>

        {showGuideModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="pwa-install-guide-title"
              className="w-full max-w-md rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/10 p-5 shadow-2xl space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3
                      id="pwa-install-guide-title"
                      className="text-sm font-bold text-slate-900 dark:text-white"
                    >
                      {isIOS ? 'Install PTG PPJK di iPhone / iPad' : 'Install Aplikasi PWA (Offline-First)'}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Jalankan langsung dari layar utama tanpa koneksi internet
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Tutup panduan install"
                  onClick={() => setShowGuideModal(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isIOS ? (
                <ol className="text-xs text-slate-700 dark:text-slate-200 space-y-2 pl-4 list-decimal">
                  <li>
                    Ketuk tombol <strong className="inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 inline" /> Share</strong> di bilah Safari.
                  </li>
                  <li>
                    Gulir ke bawah lalu pilih <strong>Add to Home Screen / Tambah ke Layar Utama</strong>.
                  </li>
                  <li>Ketuk <strong>Add / Tambah</strong>.</li>
                </ol>
              ) : (
                <ol className="text-xs text-slate-700 dark:text-slate-200 space-y-2 pl-4 list-decimal">
                  <li>
                    Buka aplikasi melalui tab browser Chrome / Edge utama (bukan mode incognito).
                  </li>
                  <li>
                    Klik ikon <strong>Install App</strong> di ujung kanan address bar browser atau menu <strong>Apps &rarr; Install PTG PPJK Outstanding</strong>.
                  </li>
                  <li>
                    Setelah terinstal, seluruh data &amp; tampilan tetap berjalan penuh saat offline menggunakan <strong>Service Worker</strong> dan <strong>IndexedDB</strong>.
                  </li>
                </ol>
              )}

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2 rounded-xl bg-[#0B2545] dark:bg-violet-600 text-white text-xs font-semibold hover:opacity-95 cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingSyncCount: number;
  syncing?: boolean;
  onSyncPending?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOnline,
  pendingSyncCount,
  syncing = false,
  onSyncPending,
}) => {
  if (isOnline && pendingSyncCount === 0) return null;

  return (
    <div
      data-testid="offline-status-banner"
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-40 no-print flex items-center gap-2.5 px-3.5 py-2 rounded-xl shadow-lg border text-xs font-semibold backdrop-blur-md transition-all max-w-[calc(100vw-2rem)] ${
        !isOnline
          ? 'bg-amber-950/90 border-amber-500/40 text-amber-100'
          : 'bg-indigo-950/90 border-violet-400/40 text-violet-100'
      }`}
    >
      {!isOnline ? (
        <>
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>
            Mode Offline · Data aman di IndexedDB
            {pendingSyncCount > 0 ? ` (${pendingSyncCount} antrean sync)` : ''}
          </span>
        </>
      ) : (
        <>
          <CloudOff className="w-3.5 h-3.5 text-violet-300 shrink-0" />
          <span>{pendingSyncCount} perubahan offline siap disinkronkan</span>
          {onSyncPending && (
            <button
              type="button"
              onClick={onSyncPending}
              disabled={syncing}
              className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white text-[11px] font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Sync...' : 'Sync Sekarang'}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
};

interface OfflineStorageSettingsCardProps {
  isOnline: boolean;
  idbStatus: IndexedDbStatusSummary | null;
  syncQueue: OfflineSyncTask[];
  syncingQueue: boolean;
  onRefreshIdbStatus: () => Promise<void>;
  onForceSaveSnapshot: () => Promise<void>;
  onReplayOfflineQueue: () => Promise<void>;
  onClearOfflineQueue: () => Promise<void>;
}

export const OfflineStorageSettingsCard: React.FC<OfflineStorageSettingsCardProps> = ({
  isOnline,
  idbStatus,
  syncQueue,
  syncingQueue,
  onRefreshIdbStatus,
  onForceSaveSnapshot,
  onReplayOfflineQueue,
  onClearOfflineQueue,
}) => {
  const { swReady, swUpdateAvailable } = usePWAInstall();

  return (
    <div
      data-testid="pwa-indexeddb-panel"
      className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0B2545] to-[#7C3AED] text-white flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-[#0B2545] dark:text-white">
                Mode Offline-First (PWA &amp; IndexedDB)
              </h4>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold ${
                  isOnline
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                }`}
              >
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                <span>{isOnline ? 'Online' : 'Offline Mode Aktif'}</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold ${
                  swReady
                    ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30'
                    : 'bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                <HardDrive className="w-3 h-3" />
                <span>{swReady ? 'Service Worker Siap Offline' : 'Cache App Aktif'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Seluruh database operasional tersimpan secara persisten di{' '}
              <span className="font-mono-code font-semibold text-slate-800 dark:text-slate-200">
                {idbStatus?.dbName || 'PTG_PPJK_OFFLINE_DB'}
              </span>{' '}
              ({idbStatus?.engine || 'IndexedDB'}). Aplikasi tetap bisa dibuka, dicari, dan diubah meski internet terputus.
            </p>
          </div>
        </div>

        <PWAInstallButton variant="panel" />
      </div>

      {swUpdateAvailable && (
        <div className="px-3 py-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-xs text-sky-800 dark:text-sky-200 flex items-center justify-between gap-2">
          <span>Versi pembaruan aplikasi tersedia untuk di-cache offline.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[11px] font-semibold cursor-pointer"
          >
            Muat Ulang
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-white dark:bg-[#111625] border border-slate-200/80 dark:border-white/[0.06]">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Engine Penyimpanan</div>
          <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 font-mono-code">
            {idbStatus?.engine || 'IndexedDB'}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-[#111625] border border-slate-200/80 dark:border-white/[0.06]">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Ukuran Data Lokal</div>
          <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
            {formatBytesReadable(idbStatus?.approxBytes || 0)}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-[#111625] border border-slate-200/80 dark:border-white/[0.06]">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Total Entri Shipment</div>
          <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
            {idbStatus?.collectionCounts?.shipments ?? 0} dok ·{' '}
            {idbStatus?.collectionCounts?.kontainers ?? 0} cont
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-[#111625] border border-slate-200/80 dark:border-white/[0.06]">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Antrean Sync Offline</div>
          <div
            className={`text-sm font-bold mt-0.5 tabular-nums ${
              syncQueue.length > 0
                ? 'text-amber-600 dark:text-amber-300'
                : 'text-emerald-600 dark:text-emerald-300'
            }`}
          >
            {syncQueue.length} tertunda
          </div>
        </div>
      </div>

      {idbStatus?.lastSavedAt && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            Terakhir disimpan ke IndexedDB:{' '}
            <strong className="text-slate-700 dark:text-slate-200">
              {new Date(idbStatus.lastSavedAt).toLocaleString('id-ID')}
            </strong>
          </span>
          {idbStatus.quotaTotalBytes !== null && idbStatus.quotaUsageBytes !== null && (
            <span>
              Kuota Storage Browser: {formatBytesReadable(idbStatus.quotaUsageBytes)} /{' '}
              {formatBytesReadable(idbStatus.quotaTotalBytes)}
            </span>
          )}
        </div>
      )}

      {syncQueue.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              Daftar Antrean Sinkronisasi ke Google Spreadsheet ({syncQueue.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReplayOfflineQueue}
                disabled={!isOnline || syncingQueue}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-[11px] font-semibold cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${syncingQueue ? 'animate-spin' : ''}`} />
                <span>{syncingQueue ? 'Menyinkronkan...' : 'Kirim Antrean'}</span>
              </button>
              <button
                type="button"
                onClick={onClearOfflineQueue}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-400/30 text-red-700 dark:text-red-300 hover:bg-red-500/10 text-[11px] font-semibold cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Hapus Antrean</span>
              </button>
            </div>
          </div>
          <ul className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
            {syncQueue.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  • {task.reason}{' '}
                  <span className="text-slate-500">
                    ({new Date(task.queuedAt).toLocaleTimeString('id-ID')})
                  </span>
                </span>
                {task.lastError && (
                  <span className="text-[10.5px] text-red-600 dark:text-red-300">
                    {task.lastError}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="idb-save-snapshot-btn"
          onClick={onForceSaveSnapshot}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E263D] border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
        >
          <Database className="w-3.5 h-3.5 text-violet-500" />
          <span>Simpan Snapshot ke IndexedDB</span>
        </button>
        <button
          type="button"
          onClick={onRefreshIdbStatus}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E263D] border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
          <span>Periksa Status IndexedDB</span>
        </button>
      </div>
    </div>
  );
};
