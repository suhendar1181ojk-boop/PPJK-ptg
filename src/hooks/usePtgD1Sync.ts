import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeLocalImporterSummary,
  deleteLocalShipmentOfflineFirst,
  fetchD1BackendStatus,
  importBatchShipmentsOfflineFirst,
  readLocalD1State,
  saveLocalShipmentOfflineFirst,
  syncNow,
  type BatchCsvImportResult,
} from '../services/syncClient';
import type {
  D1ImporterSummaryRow,
  D1ShipmentInput,
  D1ShipmentRecord,
} from '../utils/d1Contract';

export type D1SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export function formatLastSyncTimestamp(iso: string | null): string {
  if (!iso) return 'Belum pernah sync';
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return 'Belum pernah sync';
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(dt);
  } catch {
    return iso;
  }
}

export interface UsePtgD1SyncResult {
  shipments: D1ShipmentRecord[];
  allRecords: D1ShipmentRecord[];
  importerSummary: D1ImporterSummaryRow[];
  pendingCount: number;
  isOnline: boolean;
  status: D1SyncStatus;
  lastSyncAt: string | null;
  formattedLastSync: string;
  errorMessage: string | null;
  backendMode: 'cloudflare-proxy' | 'local-d1-edge';
  handleSync: () => Promise<void>;
  saveShipment: (input: D1ShipmentInput) => Promise<D1ShipmentRecord>;
  deleteShipment: (idOrOsCode: string) => Promise<void>;
  importBatchShipments: (rows: D1ShipmentRecord[]) => Promise<BatchCsvImportResult>;
  refreshLocalState: () => Promise<void>;
}

export function usePtgD1Sync(): UsePtgD1SyncResult {
  const [allRecords, setAllRecords] = useState<D1ShipmentRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [status, setStatus] = useState<D1SyncStatus>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendMode, setBackendMode] = useState<'cloudflare-proxy' | 'local-d1-edge'>(
    'local-d1-edge'
  );

  const refreshLocalState = useCallback(async () => {
    const local = await readLocalD1State();
    setAllRecords(local.shipments);
    setPendingCount(local.queue.length);
    setLastSyncAt(local.lastSyncAt);
  }, []);

  const handleSync = useCallback(async () => {
    const currentlyOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    setIsOnline(currentlyOnline);
    if (!currentlyOnline) {
      setStatus('offline');
      setErrorMessage('Perangkat sedang offline. Perubahan aman tersimpan di IndexedDB.');
      return;
    }

    setStatus('syncing');
    setErrorMessage(null);
    try {
      const result = await syncNow();
      setAllRecords(result.shipments);
      setPendingCount(result.pendingCount);
      setLastSyncAt(result.lastSyncAt);
      setStatus('synced');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal sinkronisasi dengan Cloudflare D1.'
      );
      await refreshLocalState();
    }
  }, [refreshLocalState]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await refreshLocalState();
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        fetchD1BackendStatus()
          .then((info) => {
            if (mounted) setBackendMode(info.mode);
          })
          .catch(() => {
            // Keep default local-d1-edge label silently
          });
        await handleSync();
      } else if (mounted) {
        setStatus('offline');
      }
    };

    void init();

    const onOnline = () => {
      if (!mounted) return;
      setIsOnline(true);
      setErrorMessage(null);
      void handleSync();
    };

    const onOffline = () => {
      if (!mounted) return;
      setIsOnline(false);
      setStatus('offline');
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      mounted = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [handleSync, refreshLocalState]);

  const saveShipment = useCallback(
    async (input: D1ShipmentInput): Promise<D1ShipmentRecord> => {
      const localRes = await saveLocalShipmentOfflineFirst(input);
      setAllRecords(localRes.shipments);
      setPendingCount(localRes.queue.length);

      const onlineNow = typeof navigator === 'undefined' ? true : navigator.onLine;
      setIsOnline(onlineNow);
      if (onlineNow) {
        try {
          setStatus('syncing');
          setErrorMessage(null);
          const syncRes = await syncNow();
          setAllRecords(syncRes.shipments);
          setPendingCount(syncRes.pendingCount);
          setLastSyncAt(syncRes.lastSyncAt);
          setStatus('synced');
        } catch (err) {
          setStatus('error');
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Data tersimpan lokal, menunggu sinkronisasi D1.'
          );
        }
      } else {
        setStatus('offline');
      }

      return localRes.savedRecord;
    },
    []
  );

  const deleteShipment = useCallback(async (idOrOsCode: string): Promise<void> => {
    const localRes = await deleteLocalShipmentOfflineFirst(idOrOsCode);
    setAllRecords(localRes.shipments);
    setPendingCount(localRes.queue.length);

    const onlineNow = typeof navigator === 'undefined' ? true : navigator.onLine;
    setIsOnline(onlineNow);
    if (onlineNow) {
      try {
        setStatus('syncing');
        setErrorMessage(null);
        const syncRes = await syncNow();
        setAllRecords(syncRes.shipments);
        setPendingCount(syncRes.pendingCount);
        setLastSyncAt(syncRes.lastSyncAt);
        setStatus('synced');
      } catch (err) {
        setStatus('error');
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Penghapusan tersimpan lokal, menunggu sinkronisasi D1.'
        );
      }
    } else {
      setStatus('offline');
    }
  }, []);

  const importBatchShipments = useCallback(
    async (rows: D1ShipmentRecord[]): Promise<BatchCsvImportResult> => {
      const onlineNow = typeof navigator === 'undefined' ? true : navigator.onLine;
      setIsOnline(onlineNow);
      if (onlineNow) setStatus('syncing');

      const result = await importBatchShipmentsOfflineFirst(rows);
      setAllRecords(result.shipments);
      setPendingCount(result.pendingCount);
      if (result.uploadedToD1) {
        const nowIso = new Date().toISOString();
        setLastSyncAt(nowIso);
        setStatus('synced');
        setErrorMessage(null);
      } else {
        setStatus(onlineNow ? 'error' : 'offline');
      }
      return result;
    },
    []
  );

  const shipments = useMemo(
    () =>
      allRecords
        .filter((r) => !r.deleted_at)
        .sort((a, b) => {
          if (a.is_urgent !== b.is_urgent) return b.is_urgent - a.is_urgent;
          return (b.updated_at || '').localeCompare(a.updated_at || '');
        }),
    [allRecords]
  );

  const importerSummary = useMemo(
    () => computeLocalImporterSummary(shipments),
    [shipments]
  );

  const formattedLastSync = useMemo(
    () => formatLastSyncTimestamp(lastSyncAt),
    [lastSyncAt]
  );

  return {
    shipments,
    allRecords,
    importerSummary,
    pendingCount,
    isOnline,
    status,
    lastSyncAt,
    formattedLastSync,
    errorMessage,
    backendMode,
    handleSync,
    saveShipment,
    deleteShipment,
    importBatchShipments,
    refreshLocalState,
  };
}
