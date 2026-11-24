import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Cloud,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { D1SyncStatus } from '../hooks/usePtgD1Sync';

interface SyncButtonBarProps {
  isOnline: boolean;
  pendingCount: number;
  status: D1SyncStatus;
  formattedLastSync: string;
  errorMessage: string | null;
  backendMode?: 'cloudflare-proxy' | 'local-d1-edge';
  onSync: () => void;
}

export function SyncButtonBar({
  isOnline,
  pendingCount,
  status,
  formattedLastSync,
  errorMessage,
  backendMode = 'local-d1-edge',
  onSync,
}: SyncButtonBarProps) {
  const isSyncing = status === 'syncing';

  return (
    <div
      data-testid="d1-sync-button-bar"
      className="rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.08] shadow-sm p-3.5 sm:p-4 space-y-2.5"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Status Koneksi Online / Offline */}
          <span
            data-testid="d1-connection-badge"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
              isOnline
                ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/35'
                : 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/35'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </span>

          {/* Antrean Offline Badge */}
          <span
            data-testid="d1-pending-queue-badge"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border tabular-nums ${
              pendingCount > 0
                ? 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/35'
                : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.08]'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Antrean Offline:</span>
            <strong className="font-bold">{pendingCount}</strong>
          </span>

          {/* Backend Mode Tag */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-indigo-50 dark:bg-violet-500/15 text-indigo-700 dark:text-violet-300 border border-indigo-200 dark:border-violet-500/30">
            <span>
              {backendMode === 'cloudflare-proxy'
                ? 'Cloudflare Worker D1 (Live)'
                : 'D1 Edge Sync API + IndexedDB'}
            </span>
          </span>

          {/* Waktu Sync Terakhir */}
          <span
            data-testid="d1-last-sync-text"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Sync terakhir:</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {formattedLastSync}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto">
          {status === 'synced' && !errorMessage && pendingCount === 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tersinkron
            </span>
          )}

          <button
            type="button"
            data-testid="d1-sync-now-btn"
            onClick={onSync}
            disabled={isSyncing}
            className="inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl bg-[#0B2545] hover:bg-[#133866] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] dark:hover:brightness-110 disabled:opacity-60 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sync D1'}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          data-testid="d1-sync-error-banner"
          className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-500/12 border border-red-200 dark:border-red-500/30 px-3 py-2 text-xs text-red-700 dark:text-red-300"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
