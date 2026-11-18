import { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import {
  Bell,
  Building2,
  FileSpreadsheet,
  HardDrive,
  LogOut as LogOutIcon,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
} from 'lucide-react';
import type {
  AppView,
  BillingItem,
  Customer,
  DokumenItem,
  GatePassJenisType,
  Importir,
  KontainerItem,
  ModulePermissionsMap,
  Pengaturan,
  PendingUploadFile,
  PhasePermissions,
  SessionUser,
  Shipment,
  Shipper,
  StatusDokumenType,
  StatusDoPelayaranType,
  StatusGateOutType,
  StatusGatePassType,
  StatusPenagihanType,
  StatusSuratJalanType,
  UserRole,
} from './types/ppjk';
import {
  addShipmentComment,
  addShipmentDocument,
  authenticateUser,
  type BatchExcelImportItem,
  type DatabaseState,
  DB_STORAGE_KEY,
  deleteCustomerMaster,
  deleteImportirMaster,
  deletePengeluaranOpsRecord,
  deleteShipmentDocument,
  deleteShipmentRecord,
  deleteShipperMaster,
  ensureDbInitialized,
  flushIndexedDbWrites,
  getStoredSession,
  importDatabaseSnapshot,
  importShipmentsFromExcelBatch,
  OFFLINE_BROADCAST_CHANNEL,
  refreshAndSyncDatabase,
  resetDatabase,
  saveCustomerMaster,
  saveImportirMaster,
  savePengaturanRecord,
  savePengeluaranOpsRecord,
  saveShipmentRecord,
  saveShipperMaster,
  saveStoredSession,
  saveUserRecord,
  syncSessionWithDb,
  updateShipmentBc11,
  updateShipmentBilling,
  updateShipmentDoPelayaran,
  updateShipmentKodeManualDokOs,
  updateShipmentStatusDokumen,
} from './services/gasSimulator';
import {
  clearOfflineSyncQueue,
  completeOfflineSyncTask,
  enqueueOfflineSyncTask,
  failOfflineSyncTask,
  getIndexedDbStatusSummary,
  getOfflineSyncQueue,
  type IndexedDbStatusSummary,
  saveDatabaseToIndexedDB,
} from './services/indexedDbService';
import type { OfflineSyncTask } from './utils/offlineDbLogic';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  deleteGoogleDriveFile,
  fetchFirebaseAuthorizedDomains,
  getFirebaseAuthConfigInfo,
  getGoogleDriveAccessToken,
  googleDriveSignIn,
  googleDriveSignOut,
  initGoogleDriveAuth,
  listGoogleDriveFiles,
  uploadFileToGoogleDrive,
} from './services/googleDriveService';
import {
  buildUnauthorizedDomainHelp,
  classifyGoogleAuthError,
  GoogleAuthDomainError,
} from './utils/googleAuthLogic';
import {
  createDatabaseSpreadsheet,
  fetchSpreadsheetMetadata,
  findDatabaseSpreadsheet,
  listUserSpreadsheets,
  pullDatabaseFromSpreadsheet,
  pushDatabaseToSpreadsheet,
} from './services/googleSheetsService';
import {
  computeSpreadsheetSyncDiffSummary,
  DATABASE_SHEET_TABS,
} from './utils/sheetsSchema';
import {
  fetchGasWebAppShipments,
  postGasWebAppAddShipment,
} from './services/gasWebAppService';
import {
  DEFAULT_GAS_WEBAPP_URL,
  mergeGasFetchedShipments,
  validateGasWebAppUrl,
} from './utils/gasWebAppLogic';
import {
  canPerformAction,
  computeBillingSummary,
  filterShipments,
  getFirstAccessibleModule,
  getPpjkIdentity,
  getShipmentProcessSignal,
  isContainerGateOut,
  isShipmentBillingEligible,
  isShipmentOutstanding,
  isUrgentMissingAju,
  normalizeStatusDoPelayaran,
  resolveUserModuleAccess,
} from './utils/ppjkLogic';
import {
  hasBuktiPengeluaran,
  type PengeluaranOpsInputPayload,
} from './utils/pengeluaranOpsLogic';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ShipmentTableView } from './components/ShipmentTableView';
import { ShipmentDetailDrawer } from './components/ShipmentDetailDrawer';
import { ShipmentFormModal } from './components/ShipmentFormModal';
import { MasterSettingsView, type MasterTab } from './components/MasterSettingsView';
import { SetupAppView } from './components/SetupAppView';
import { CheckerSummaryView } from './components/CheckerSummaryView';
import { DoPelayaranView } from './components/DoPelayaranView';
import { SuratJalanView } from './components/SuratJalanView';
import { PenagihanView } from './components/PenagihanView';
import { KeuanganOpsView } from './components/KeuanganOpsView';
import { NopenReportView } from './components/NopenReportView';
import { BillingModal } from './components/BillingModal';
import { GoogleSignInButton } from './components/GoogleDriveButton';
import { OfflineIndicator } from './components/PWAStatusControls';

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: 'Dashboard Ringkasan',
  checker: 'Rekap Checker & Status Dokumen',
  do: 'Kesiapan D/O Pelayaran',
  'surat-jalan': 'Surat Jalan & Tracking Pengiriman',
  penagihan: 'Info Owner (WA/Email) & Surat Penagihan',
  'keuangan-ops': 'Keuangan Pengeluaran Operasional',
  'report-nopen': 'Report Rekapan Dokumen No. NOPEN (PIB)',
  outstanding: 'Dokumen Outstanding',
  shipments: 'Semua Data Shipment',
  master: 'Master Data & Pengaturan',
  setup: 'Setup Identitas & Kontrol Owner',
};

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ptg_theme') !== 'light';
    } catch {
      return true;
    }
  });

  const [session, setSession] = useState<SessionUser | null>(() => getStoredSession());
  const [db, setDb] = useState<DatabaseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [tableCheckerFilter, setTableCheckerFilter] = useState<string>('');
  const [selectedRecapChecker, setSelectedRecapChecker] = useState<string>('');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [keuanganOpsFilterKodeOs, setKeuanganOpsFilterKodeOs] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [globalSearch, setGlobalSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const notifBoxRef = useRef<HTMLDivElement | null>(null);

  const [detailKodeOs, setDetailKodeOs] = useState<string | null>(null);
  const [billingModalState, setBillingModalState] = useState<{
    kodeOs: string;
    tab: 'owner' | 'customer';
  } | null>(null);
  const [formState, setFormState] = useState<{
    open: boolean;
    shipment: Shipment | null;
    containers: KontainerItem[];
  }>({ open: false, shipment: null, containers: [] });

  const [driveUserEmail, setDriveUserEmail] = useState<string | null>(null);
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [syncingGasWebApp, setSyncingGasWebApp] = useState(false);
  const [masterInitialTab, setMasterInitialTab] = useState<MasterTab>('customer');
  const autoSyncInFlightRef = useRef(false);
  const isOnline = useOnlineStatus();
  const [idbStatus, setIdbStatus] = useState<IndexedDbStatusSummary | null>(null);
  const [offlineSyncQueue, setOfflineSyncQueue] = useState<OfflineSyncTask[]>([]);
  const [syncingOfflineQueue, setSyncingOfflineQueue] = useState(false);

  const refreshOfflineTelemetry = async (snapshot?: DatabaseState) => {
    try {
      const [status, queue] = await Promise.all([
        getIndexedDbStatusSummary(snapshot),
        getOfflineSyncQueue(),
      ]);
      setIdbStatus(status);
      setOfflineSyncQueue(queue);
    } catch {
      // ignore telemetry check error
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('ptg_theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage failure
    }
  }, [darkMode]);

  useEffect(() => {
    const id = getPpjkIdentity(db?.pengaturan);
    document.title = `${id.brandName} — ${id.companyName}`;
  }, [db?.pengaturan]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeView]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setSearchFocused(false);
        setNotifOpen(false);
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) {
        setSearchFocused(false);
      }
      if (notifBoxRef.current && !notifBoxRef.current.contains(target)) {
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = initGoogleDriveAuth(
      (user) => {
        setDriveUserEmail(user.email || user.displayName || 'Google Drive Terhubung');
      },
      () => {
        setDriveUserEmail(null);
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const params = new URLSearchParams(window.location.search);
        const autostart = params.get('autostart') === '1';
        const loadedDb = await ensureDbInitialized();
        if (!active) return;
        setDb(loadedDb);
        setLastSyncedAt(new Date().toISOString());
        void refreshOfflineTelemetry(loadedDb);

        const existingSession = getStoredSession();
        if (existingSession) {
          const synced = await syncSessionWithDb(existingSession);
          if (!active) return;
          setSession(synced);
        } else if (autostart) {
          const autoSession = await authenticateUser('admin', 'Admin123!');
          if (!active) return;
          setSession(autoSession);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    boot();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncFromLocalStores = () => {
      void refreshAndSyncDatabase().then((res) => {
        setDb({ ...res.db });
        setLastSyncedAt(res.syncedAt);
        void refreshOfflineTelemetry(res.db);
      });
    };
    const onStorageSync = (e: StorageEvent) => {
      if (e.key !== DB_STORAGE_KEY) return;
      syncFromLocalStores();
    };
    window.addEventListener('storage', onStorageSync);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(OFFLINE_BROADCAST_CHANNEL);
        bc.onmessage = () => {
          syncFromLocalStores();
        };
      } catch {
        bc = null;
      }
    }

    return () => {
      window.removeEventListener('storage', onStorageSync);
      if (bc) bc.close();
    };
  }, []);

  const searchMatches = useMemo(() => {
    if (!db || !globalSearch.trim()) return [];
    return filterShipments(
      db.shipments,
      { mode: 'all', search: globalSearch.trim() },
      db.pengaturan.checklistItems
    ).slice(0, 6);
  }, [db, globalSearch]);

  const urgentAlerts = useMemo(() => {
    if (!db) return [];
    return db.shipments.filter(
      (s) => getShipmentProcessSignal(s).active || isUrgentMissingAju(s)
    );
  }, [db]);

  const formatSyncClock = (iso: string | null): string => {
    if (!iso) return '-';
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleReplayOfflineQueue = async () => {
    if (!db || !session || syncingOfflineQueue) return;
    const accessToken = getGoogleDriveAccessToken();
    const queue = await getOfflineSyncQueue();
    if (queue.length === 0) return;

    if (!isOnline) {
      await Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'info',
        title: 'Masih dalam Mode Offline',
        text: `${queue.length} perubahan tetap aman tersimpan di IndexedDB dan akan disinkronkan saat koneksi kembali.`,
        background: darkMode ? '#151B2B' : '#FFFFFF',
        color: darkMode ? '#F1F5F9' : '#0F172A',
        showConfirmButton: false,
        timer: 3200,
      });
      return;
    }

    if (!accessToken) {
      await Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'info',
        title: 'Perlu Sign in Google',
        text: 'Klik "Sign in with Google" untuk mengirim antrean perubahan offline ke Google Spreadsheet.',
        background: darkMode ? '#151B2B' : '#FFFFFF',
        color: darkMode ? '#F1F5F9' : '#0F172A',
        showConfirmButton: false,
        timer: 3500,
      });
      return;
    }

    setSyncingOfflineQueue(true);
    setSyncingSheets(true);
    try {
      let currentDb = db;
      for (const task of queue) {
        const targetSheetId = task.spreadsheetId || currentDb.pengaturan.spreadsheetId;
        if (!targetSheetId) {
          await completeOfflineSyncTask(task.id);
          continue;
        }
        try {
          const pushRes = await pushDatabaseToSpreadsheet(
            accessToken,
            targetSheetId,
            currentDb,
            session.nama
          );
          currentDb = await savePengaturanRecord(session, {
            ...currentDb.pengaturan,
            spreadsheetId: pushRes.spreadsheetId,
            spreadsheetTitle: pushRes.title,
            spreadsheetUrl: pushRes.spreadsheetUrl,
            spreadsheetLastSyncAt: pushRes.syncedAt,
            spreadsheetLastSyncDirection: 'push',
          });
          await flushIndexedDbWrites();
          await completeOfflineSyncTask(task.id);
          setDb({ ...currentDb });
          setLastSyncedAt(pushRes.syncedAt);
        } catch (err) {
          await failOfflineSyncTask(
            task.id,
            err instanceof Error ? err.message : 'Gagal mengirim antrean'
          );
        }
      }
      await refreshOfflineTelemetry(currentDb);
    } finally {
      setSyncingOfflineQueue(false);
      setSyncingSheets(false);
    }
  };

  useEffect(() => {
    if (isOnline && driveUserEmail && offlineSyncQueue.length > 0 && db?.pengaturan.spreadsheetId) {
      void handleReplayOfflineQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, driveUserEmail]);

  const applyDbUpdate = async (
    nextDb: DatabaseState,
    options?: { skipAutoSheetsSync?: boolean }
  ) => {
    setDb({ ...nextDb });
    await flushIndexedDbWrites();

    const accessToken = getGoogleDriveAccessToken();
    const spreadsheetId = nextDb.pengaturan.spreadsheetId;
    if (
      options?.skipAutoSheetsSync ||
      !nextDb.pengaturan.spreadsheetAutoSync ||
      !spreadsheetId ||
      !session
    ) {
      await refreshOfflineTelemetry(nextDb);
      return;
    }

    if (!isOnline || !accessToken) {
      await enqueueOfflineSyncTask(
        !isOnline
          ? 'Perubahan data saat Mode Offline (IndexedDB)'
          : 'Menunggu sesi Google untuk sinkronisasi otomatis',
        spreadsheetId
      );
      await refreshOfflineTelemetry(nextDb);
      return;
    }

    if (autoSyncInFlightRef.current) {
      await refreshOfflineTelemetry(nextDb);
      return;
    }

    autoSyncInFlightRef.current = true;
    setSyncingSheets(true);
    try {
      const pushRes = await pushDatabaseToSpreadsheet(
        accessToken,
        spreadsheetId,
        nextDb,
        session.nama
      );
      const savedMetaDb = await savePengaturanRecord(session, {
        ...nextDb.pengaturan,
        spreadsheetId: pushRes.spreadsheetId,
        spreadsheetTitle: pushRes.title,
        spreadsheetUrl: pushRes.spreadsheetUrl,
        spreadsheetLastSyncAt: pushRes.syncedAt,
        spreadsheetLastSyncDirection: 'push',
      });
      await flushIndexedDbWrites();
      setDb({ ...savedMetaDb });
      setLastSyncedAt(pushRes.syncedAt);
      await refreshOfflineTelemetry(savedMetaDb);
    } catch (err) {
      await enqueueOfflineSyncTask('Auto-sync gagal sementara, masuk antrean offline', spreadsheetId);
      await refreshOfflineTelemetry(nextDb);
      void Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'warning',
        title: 'Tersimpan di IndexedDB · Auto-Sync Antre',
        text:
          err instanceof Error
            ? err.message
            : 'Perubahan tersimpan aman di IndexedDB dan masuk antrean sinkronisasi.',
        background: darkMode ? '#151B2B' : '#FFFFFF',
        color: darkMode ? '#F1F5F9' : '#0F172A',
        showConfirmButton: false,
        timer: 3500,
      });
    } finally {
      autoSyncInFlightRef.current = false;
      setSyncingSheets(false);
    }
  };

  const handleRefreshData = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const startMs = Date.now();
    try {
      const result = await refreshAndSyncDatabase();
      setDb({ ...result.db });

      if (session) {
        const synced = await syncSessionWithDb(session);
        setSession(synced);
      }

      let driveNote = '';
      let sheetsNote = '';
      const accessToken = getGoogleDriveAccessToken();
      if (accessToken) {
        try {
          const driveFiles = await listGoogleDriveFiles({ accessToken, pageSize: 100 });
          driveNote = ` • Drive: ${driveFiles.length} file`;
        } catch {
          driveNote = ' • Drive perlu login ulang';
        }

        const linkedSheetId = result.db.pengaturan.spreadsheetId;
        if (linkedSheetId && result.db.pengaturan.spreadsheetAutoSync && session) {
          try {
            const pulled = await pullDatabaseFromSpreadsheet(
              accessToken,
              linkedSheetId,
              result.db
            );
            const remoteTime = pulled.remoteLastUpdatedAt
              ? new Date(pulled.remoteLastUpdatedAt).getTime()
              : 0;
            const localTime = result.db.pengaturan.spreadsheetLastSyncAt
              ? new Date(result.db.pengaturan.spreadsheetLastSyncAt).getTime()
              : 0;

            if (remoteTime > localTime + 2000) {
              const diff = computeSpreadsheetSyncDiffSummary(result.db, pulled.db);
              const askPull = await Swal.fire({
                title: 'Pembaruan Ditemukan di Google Spreadsheet',
                text: `File "${pulled.title}" memiliki versi lebih baru (${diff.remoteCounts.shipments} shipment di Spreadsheet vs ${diff.localCounts.shipments} di lokal). Terapkan data terbaru dari Google Spreadsheet ke aplikasi?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#059669',
                confirmButtonText: 'Ya, Tarik dari Spreadsheet',
                cancelButtonText: 'Pertahankan Data Lokal',
                background: darkMode ? '#131926' : '#ffffff',
                color: darkMode ? '#f1f5f9' : '#0f172a',
              });
              if (askPull.isConfirmed) {
                const imported = await importDatabaseSnapshot({
                  ...pulled.db,
                  pengaturan: {
                    ...pulled.db.pengaturan,
                    spreadsheetAutoSync: result.db.pengaturan.spreadsheetAutoSync,
                    spreadsheetLastSyncAt: new Date().toISOString(),
                    spreadsheetLastSyncDirection: 'pull',
                  },
                });
                setDb({ ...imported });
                sheetsNote = ' • Sheets: Ditarik';
              } else {
                sheetsNote = ' • Sheets: Lokal dipertahankan';
              }
            } else {
              const pushRes = await pushDatabaseToSpreadsheet(
                accessToken,
                linkedSheetId,
                result.db,
                session.nama
              );
              const savedMetaDb = await savePengaturanRecord(session, {
                ...result.db.pengaturan,
                spreadsheetId: pushRes.spreadsheetId,
                spreadsheetTitle: pushRes.title,
                spreadsheetUrl: pushRes.spreadsheetUrl,
                spreadsheetLastSyncAt: pushRes.syncedAt,
                spreadsheetLastSyncDirection: 'push',
              });
              setDb({ ...savedMetaDb });
              sheetsNote = ` • Sheets: ${pushRes.writtenRows} baris tersinkron`;
            }
          } catch {
            sheetsNote = ' • Sheets perlu cek koneksi';
          }
        }
      } else if (result.db.pengaturan.spreadsheetId) {
        sheetsNote = ' • Sheets: Perlu Sign in Google';
      }

      const elapsed = Date.now() - startMs;
      if (elapsed < 280) {
        await new Promise((resolve) => setTimeout(resolve, 280 - elapsed));
      }

      setLastSyncedAt(result.syncedAt);
      const syncClock = formatSyncClock(result.syncedAt);
      const updateSummary =
        result.updatedShipmentsCount > 0
          ? `${result.updatedShipmentsCount} shipment diperbarui`
          : 'Semua data sudah terbaru';

      void Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'success',
        title: 'Data Berhasil Disinkronkan',
        text: `${result.totalShipments} shipment (${result.outstandingCount} outstanding) • ${updateSummary}${driveNote}${sheetsNote} • ${syncClock}`,
        background: darkMode ? '#151B2B' : '#FFFFFF',
        color: darkMode ? '#F1F5F9' : '#0F172A',
        showConfirmButton: false,
        timer: 3200,
        timerProgressBar: true,
      });
    } catch (err) {
      await Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'error',
        title: 'Gagal Memperbarui Data',
        text:
          err instanceof Error
            ? err.message
            : 'Terjadi kendala saat menyinkronkan data aplikasi.',
        background: darkMode ? '#151B2B' : '#FFFFFF',
        color: darkMode ? '#F1F5F9' : '#0F172A',
        showConfirmButton: false,
        timer: 3200,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoginSuccess = async (newSession: SessionUser) => {
    setSession(newSession);
    const loadedDb = await ensureDbInitialized();
    setDb(loadedDb);
    setLastSyncedAt(new Date().toISOString());
    const firstAllowed = getFirstAccessibleModule(newSession, loadedDb.pengaturan);
    setActiveView(firstAllowed || 'dashboard');
  };

  const handleLogout = () => {
    saveStoredSession(null);
    setSession(null);
    setDetailKodeOs(null);
    setBillingModalState(null);
    setFormState({ open: false, shipment: null, containers: [] });
  };

  const openCreateForm = () => {
    setFormState({ open: true, shipment: null, containers: [] });
  };

  const openEditForm = (kodeOs: string) => {
    if (!db) return;
    const found = db.shipments.find((s) => s.kodeOs === kodeOs) || null;
    const conts = db.kontainers.filter((c) => c.kodeOs === kodeOs);
    setDetailKodeOs(null);
    setFormState({ open: true, shipment: found, containers: conts });
  };

  const handleConnectGoogleDrive = async () => {
    setDriveConnecting(true);
    try {
      const { user, accessToken } = await googleDriveSignIn();
      setDriveUserEmail(user.email || user.displayName || 'Google Drive Terhubung');

      if (db && session) {
        if (!db.pengaturan.spreadsheetId) {
          const foundSheet = await findDatabaseSpreadsheet(accessToken, 'PTG_PPJK_DATABASE');
          if (foundSheet) {
            const askLink = await Swal.fire({
              title: 'Ditemukan File Database Spreadsheet',
              text: `Ditemukan file "${foundSheet.name}" di Google Drive Anda. Hubungkan database aplikasi dengan file tersebut sekarang?`,
              icon: 'question',
              showCancelButton: true,
              confirmButtonColor: '#059669',
              confirmButtonText: 'Ya, Hubungkan Spreadsheet',
              cancelButtonText: 'Nanti Saja',
              background: darkMode ? '#131926' : '#ffffff',
              color: darkMode ? '#f1f5f9' : '#0f172a',
            });
            if (askLink.isConfirmed) {
              await handleConnectExistingSpreadsheet(foundSheet.id);
            }
          }
        }
      }
    } catch (err) {
      setDriveConnecting(false);
      const classified = classifyGoogleAuthError(err);
      const modalBg = darkMode ? '#131926' : '#ffffff';
      const modalColor = darkMode ? '#f1f5f9' : '#0f172a';

      if (err instanceof GoogleAuthDomainError || classified.isUnauthorizedDomain) {
        const domainStatus =
          err instanceof GoogleAuthDomainError
            ? {
                currentHostname: err.hostname,
                currentOrigin: err.origin,
                projectId: err.projectId,
                oAuthClientId: err.oAuthClientId,
                authorizedDomains: err.authorizedDomains,
                gisFallbackError: err.gisFallbackError,
              }
            : await (async () => {
                const status = await fetchFirebaseAuthorizedDomains();
                const cfg = getFirebaseAuthConfigInfo();
                return {
                  currentHostname:
                    status.currentHostname ||
                    (typeof window !== 'undefined' ? window.location.hostname : ''),
                  currentOrigin:
                    status.currentOrigin ||
                    (typeof window !== 'undefined' ? window.location.origin : ''),
                  projectId: status.projectId || cfg.projectId,
                  oAuthClientId: status.oAuthClientId || cfg.oAuthClientId,
                  authorizedDomains: status.authorizedDomains,
                  gisFallbackError: classified.rawMessage,
                };
              })();

        const help = buildUnauthorizedDomainHelp(domainStatus);
        const esc = (s: string) =>
          s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        const preferredLinksHtml =
          help.preferredAppUrls.length > 0
            ? `<div style="margin-top:10px;padding:8px 10px;border-radius:10px;border:1px solid ${
                darkMode ? 'rgba(16,185,129,0.35)' : '#a7f3d0'
              };background:${darkMode ? 'rgba(16,185,129,0.1)' : '#ecfdf5'};">
                <div style="font-weight:700;font-size:11px;margin-bottom:4px;color:${
                  darkMode ? '#6ee7b7' : '#065f46'
                };">Domain Aplikasi yang Sudah Terotorisasi:</div>
                ${help.preferredAppUrls
                  .slice(0, 2)
                  .map(
                    (url) =>
                      `<div style="font-size:11px;margin-top:2px;word-break:break-all;"><a href="${esc(
                        url
                      )}" target="_blank" rel="noopener noreferrer" style="color:${
                        darkMode ? '#34d399' : '#059669'
                      };text-decoration:underline;">${esc(url)}</a></div>`
                  )
                  .join('')}
              </div>`
            : '';

        await Swal.fire({
          title: 'Domain Belum Terotorisasi',
          icon: 'warning',
          background: modalBg,
          color: modalColor,
          confirmButtonText: 'Tutup',
          confirmButtonColor: '#0B2545',
          width: 540,
          padding: '1.25rem',
          html: `
            <div style="text-align:left;font-size:11.5px;line-height:1.45;">
              <p style="margin:0 0 8px 0;">
                Domain <code style="padding:1px 5px;border-radius:5px;background:${
                  darkMode ? '#1e293b' : '#f1f5f9'
                };font-weight:700;">${esc(
                  help.currentHostname
                )}</code> belum terdaftar di <strong>Authorized Domains</strong> Firebase project <code style="padding:1px 5px;border-radius:5px;background:${
                  darkMode ? '#1e293b' : '#f1f5f9'
                };">${esc(help.projectId || '-')}</code>.
              </p>
              <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
                <button type="button" id="ptg-copy-auth-domain-btn" style="padding:5px 10px;border-radius:7px;border:1px solid ${
                  darkMode ? 'rgba(255,255,255,0.2)' : '#cbd5e1'
                };background:${
                  darkMode ? '#1e293b' : '#f8fafc'
                };color:${modalColor};font-size:11px;font-weight:600;cursor:pointer;">
                  Salin Domain (${esc(help.currentHostname)})
                </button>
                <a href="${esc(
                  help.firebaseConsoleUrl
                )}" target="_blank" rel="noopener noreferrer" style="padding:5px 10px;border-radius:7px;background:#059669;color:#ffffff;font-size:11px;font-weight:600;text-decoration:none;">
                  Firebase Console
                </a>
                <a href="${esc(
                  help.gcpCredentialsUrl
                )}" target="_blank" rel="noopener noreferrer" style="padding:5px 10px;border-radius:7px;background:#2563eb;color:#ffffff;font-size:11px;font-weight:600;text-decoration:none;">
                  OAuth Credentials
                </a>
              </div>
              <ol style="margin:0;padding-left:16px;font-size:11px;">
                ${help.steps.map((step) => `<li style="margin-bottom:3px;">${esc(step)}</li>`).join('')}
              </ol>
              ${preferredLinksHtml}
            </div>
          `,
          didOpen: () => {
            const copyBtn = document.getElementById('ptg-copy-auth-domain-btn');
            if (copyBtn) {
              copyBtn.addEventListener('click', () => {
                if (navigator.clipboard?.writeText) {
                  void navigator.clipboard.writeText(help.currentHostname).then(() => {
                    copyBtn.textContent = `Tersalin: ${help.currentHostname}`;
                  });
                }
              });
            }
          },
        });
      } else if (classified.isPopupBlocked) {
        await Swal.fire({
          title: 'Popup Login Diblokir Browser',
          text: 'Browser memblokir jendela login Google. Izinkan pop-up untuk situs ini lalu klik "Sign in with Google" kembali.',
          icon: 'warning',
          background: modalBg,
          color: modalColor,
        });
      } else if (classified.isPopupClosed) {
        await Swal.fire({
          title: 'Login Google Dibatalkan',
          text: 'Jendela pemilihan akun Google ditutup sebelum proses otorisasi selesai.',
          icon: 'info',
          background: modalBg,
          color: modalColor,
        });
      } else {
        await Swal.fire({
          title: 'Koneksi Google Drive & Sheets',
          text:
            err instanceof Error
              ? err.message
              : 'Gagal terhubung ke akun Google. Silakan coba lagi.',
          icon: 'error',
          background: modalBg,
          color: modalColor,
        });
      }
    } finally {
      setDriveConnecting(false);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    await googleDriveSignOut();
    setDriveUserEmail(null);
  };

  const handleCreateSpreadsheet = async (title: string) => {
    if (!db || !session) return;
    const accessToken = getGoogleDriveAccessToken();
    if (!accessToken) {
      await Swal.fire({
        title: 'Login Google Diperlukan',
        text: 'Klik "Sign in with Google" terlebih dahulu untuk membuat Google Spreadsheet.',
        icon: 'info',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
      return;
    }

    const cleanTitle = (title || '').trim() || 'PTG_PPJK_DATABASE';
    const confirm = await Swal.fire({
      title: `Buat Google Spreadsheet "${cleanTitle}"?`,
      text: `Akan dibuat file Google Spreadsheet baru berisi ${DATABASE_SHEET_TABS.length} tab database (${db.shipments.length} shipment, ${db.kontainers.length} kontainer, ${db.customers.length} customer, ${db.users.length} user) dan Auto-Sync Penuh akan diaktifkan.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      confirmButtonText: 'Ya, Buat & Sinkronkan',
      cancelButtonText: 'Batal',
      background: darkMode ? '#131926' : '#ffffff',
      color: darkMode ? '#f1f5f9' : '#0f172a',
    });
    if (!confirm.isConfirmed) return;

    setSyncingSheets(true);
    try {
      const created = await createDatabaseSpreadsheet(accessToken, cleanTitle, db, session.nama);
      const nextDb = await savePengaturanRecord(session, {
        ...db.pengaturan,
        spreadsheetId: created.spreadsheetId,
        spreadsheetTitle: created.title,
        spreadsheetUrl: created.spreadsheetUrl,
        spreadsheetAutoSync: true,
        spreadsheetLastSyncAt: created.syncedAt,
        spreadsheetLastSyncDirection: 'create',
      });
      setDb({ ...nextDb });
      setLastSyncedAt(created.syncedAt);
      await Swal.fire({
        title: 'Google Spreadsheet Siap!',
        text: `File "${created.title}" berhasil dibuat (${created.writtenTabs} tab, ${created.writtenRows} baris data) dan Auto-Sync aktif.`,
        icon: 'success',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
    } catch (err) {
      await Swal.fire({
        title: 'Gagal Membuat Spreadsheet',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan saat membuat Spreadsheet.',
        icon: 'error',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
    } finally {
      setSyncingSheets(false);
    }
  };

  const handlePushToSpreadsheet = async (overrideId?: string) => {
    if (!db || !session) return;
    const accessToken = getGoogleDriveAccessToken();
    const targetId = overrideId || db.pengaturan.spreadsheetId || '';
    if (!accessToken || !targetId) {
      await Swal.fire({
        title: 'Koneksi Google & Spreadsheet Diperlukan',
        text: 'Pastikan Anda sudah Sign in with Google dan memilih Google Spreadsheet tujuan.',
        icon: 'info',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Kirim Data Lokal ke Google Spreadsheet?',
      text: `Isi ${DATABASE_SHEET_TABS.length} tab pada file "${db.pengaturan.spreadsheetTitle || targetId}" akan diperbarui dengan data lokal saat ini (${db.shipments.length} shipment, ${db.kontainers.length} kontainer, ${db.customers.length} customer).`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      confirmButtonText: 'Ya, Perbarui Spreadsheet',
      cancelButtonText: 'Batal',
      background: darkMode ? '#131926' : '#ffffff',
      color: darkMode ? '#f1f5f9' : '#0f172a',
    });
    if (!confirm.isConfirmed) return;

    setSyncingSheets(true);
    try {
      const pushRes = await pushDatabaseToSpreadsheet(accessToken, targetId, db, session.nama);
      const nextDb = await savePengaturanRecord(session, {
        ...db.pengaturan,
        spreadsheetId: pushRes.spreadsheetId,
        spreadsheetTitle: pushRes.title,
        spreadsheetUrl: pushRes.spreadsheetUrl,
        spreadsheetLastSyncAt: pushRes.syncedAt,
        spreadsheetLastSyncDirection: 'push',
      });
      setDb({ ...nextDb });
      setLastSyncedAt(pushRes.syncedAt);
      await Swal.fire({
        title: 'Push ke Google Spreadsheet Berhasil',
        text: `${pushRes.writtenRows} baris pada ${pushRes.writtenTabs} tab di "${pushRes.title}" telah diperbarui.`,
        icon: 'success',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
    } catch (err) {
      await Swal.fire({
        title: 'Gagal Mengirim ke Spreadsheet',
        text: err instanceof Error ? err.message : 'Gagal memperbarui Google Spreadsheet.',
        icon: 'error',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
    } finally {
      setSyncingSheets(false);
    }
  };

  const handlePullFromSpreadsheet = async (overrideId?: string) => {
    if (!db || !session) return;
    const accessToken = getGoogleDriveAccessToken();
    const targetId = overrideId || db.pengaturan.spreadsheetId || '';
    if (!accessToken || !targetId) {
      await Swal.fire({
        title: 'Koneksi Google & Spreadsheet Diperlukan',
        text: 'Pastikan Anda sudah Sign in with Google dan menghubungkan Spreadsheet.',
        icon: 'info',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
      return;
    }

    setSyncingSheets(true);
    try {
      const pulled = await pullDatabaseFromSpreadsheet(accessToken, targetId, db);
      const diff = computeSpreadsheetSyncDiffSummary(db, pulled.db);

      const confirm = await Swal.fire({
        title: `Tarik Database dari "${pulled.title}"?`,
        text: `Data aplikasi lokal (${diff.localCounts.shipments} shipment, ${diff.localCounts.customers} customer) akan diganti dengan data dari Google Spreadsheet (${diff.remoteCounts.shipments} shipment, ${diff.remoteCounts.customers} customer dari ${pulled.matchedTabs.length} tab).`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#7C3AED',
        confirmButtonText: 'Ya, Tarik & Terapkan',
        cancelButtonText: 'Batal',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
      if (!confirm.isConfirmed) return;

      const imported = await importDatabaseSnapshot({
        ...pulled.db,
        pengaturan: {
          ...pulled.db.pengaturan,
          spreadsheetId: pulled.spreadsheetId,
          spreadsheetTitle: pulled.title,
          spreadsheetUrl: pulled.spreadsheetUrl,
          spreadsheetAutoSync:
            pulled.db.pengaturan.spreadsheetAutoSync ?? db.pengaturan.spreadsheetAutoSync ?? true,
          spreadsheetLastSyncAt: new Date().toISOString(),
          spreadsheetLastSyncDirection: 'pull',
        },
      });
      setDb({ ...imported });
      setLastSyncedAt(new Date().toISOString());
      const syncedSession = await syncSessionWithDb(session);
      if (syncedSession) setSession(syncedSession);

      await Swal.fire({
        title: 'Data Berhasil Ditarik dari Spreadsheet',
        text: `Database lokal telah diperbarui dengan ${imported.shipments.length} shipment dari "${pulled.title}".`,
        icon: 'success',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
    } catch (err) {
      await Swal.fire({
        title: 'Gagal Menarik Data Spreadsheet',
        text: err instanceof Error ? err.message : 'Pastikan format tab spreadsheet sesuai.',
        icon: 'error',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
    } finally {
      setSyncingSheets(false);
    }
  };

  const handleConnectExistingSpreadsheet = async (spreadsheetId: string) => {
    if (!db || !session) return;
    const accessToken = getGoogleDriveAccessToken();
    if (!accessToken) {
      await Swal.fire({
        title: 'Login Google Diperlukan',
        text: 'Klik "Sign in with Google" terlebih dahulu untuk menghubungkan Spreadsheet.',
        icon: 'info',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
      return;
    }

    setSyncingSheets(true);
    try {
      const meta = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
      const hasShipmentsTab = meta.sheets.some((s) => s.title === 'Shipments');

      const choice = await Swal.fire({
        title: `Hubungkan "${meta.title}"`,
        text: hasShipmentsTab
          ? `Spreadsheet memiliki ${meta.sheets.length} tab termasuk tab "Shipments". Pilih tindakan awal:`
          : `Spreadsheet memiliki ${meta.sheets.length} tab (${meta.sheets.map((s) => s.title).join(', ')}). Kirim database lokal ke Spreadsheet ini untuk menyiapkan ${DATABASE_SHEET_TABS.length} tab database?`,
        icon: 'question',
        showDenyButton: hasShipmentsTab,
        showCancelButton: true,
        confirmButtonColor: '#059669',
        denyButtonColor: '#7C3AED',
        confirmButtonText: 'Kirim Data Lokal → Spreadsheet',
        denyButtonText: 'Tarik dari Spreadsheet → Lokal',
        cancelButtonText: 'Batal',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });

      if (choice.isConfirmed) {
        const pushRes = await pushDatabaseToSpreadsheet(
          accessToken,
          meta.spreadsheetId,
          db,
          session.nama
        );
        const nextDb = await savePengaturanRecord(session, {
          ...db.pengaturan,
          spreadsheetId: pushRes.spreadsheetId,
          spreadsheetTitle: pushRes.title,
          spreadsheetUrl: pushRes.spreadsheetUrl,
          spreadsheetAutoSync: true,
          spreadsheetLastSyncAt: pushRes.syncedAt,
          spreadsheetLastSyncDirection: 'push',
        });
        setDb({ ...nextDb });
        setLastSyncedAt(pushRes.syncedAt);
        await Swal.fire({
          title: 'Spreadsheet Terhubung & Tersinkron',
          text: `"${pushRes.title}" siap digunakan dengan Auto-Sync aktif.`,
          icon: 'success',
          background: darkMode ? '#131926' : '#ffffff',
          color: darkMode ? '#f1f5f9' : '#0f172a',
        });
      } else if (choice.isDenied && hasShipmentsTab) {
        const pulled = await pullDatabaseFromSpreadsheet(accessToken, meta.spreadsheetId, db);
        const imported = await importDatabaseSnapshot({
          ...pulled.db,
          pengaturan: {
            ...pulled.db.pengaturan,
            spreadsheetId: pulled.spreadsheetId,
            spreadsheetTitle: pulled.title,
            spreadsheetUrl: pulled.spreadsheetUrl,
            spreadsheetAutoSync: true,
            spreadsheetLastSyncAt: new Date().toISOString(),
            spreadsheetLastSyncDirection: 'pull',
          },
        });
        setDb({ ...imported });
        setLastSyncedAt(new Date().toISOString());
        const syncedSession = await syncSessionWithDb(session);
        if (syncedSession) setSession(syncedSession);
        await Swal.fire({
          title: 'Spreadsheet Terhubung (Data Ditarik)',
          text: `${imported.shipments.length} shipment dari "${pulled.title}" telah dimuat dan Auto-Sync aktif.`,
          icon: 'success',
          background: darkMode ? '#131926' : '#ffffff',
          color: darkMode ? '#f1f5f9' : '#0f172a',
        });
      }
    } catch (err) {
      await Swal.fire({
        title: 'Gagal Menghubungkan Spreadsheet',
        text:
          err instanceof Error
            ? err.message
            : 'Periksa kembali ID atau izin akses Google Spreadsheet.',
        icon: 'error',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
    } finally {
      setSyncingSheets(false);
    }
  };

  const handleToggleAutoSyncSpreadsheet = async (enabled: boolean) => {
    if (!db || !session) return;
    if (enabled) {
      const confirm = await Swal.fire({
        title: 'Aktifkan Sinkronisasi Otomatis Penuh?',
        text: `Setiap perubahan shipment, kontainer, master data, dokumen, catatan, dan pengaturan akan otomatis memperbarui file Google Spreadsheet "${db.pengaturan.spreadsheetTitle || db.pengaturan.spreadsheetId}".`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        confirmButtonText: 'Ya, Aktifkan Auto-Sync',
        cancelButtonText: 'Batal',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
      if (!confirm.isConfirmed) return;
    }

    const nextDb = await savePengaturanRecord(session, {
      ...db.pengaturan,
      spreadsheetAutoSync: enabled,
    });
    setDb({ ...nextDb });
  };

  const handleDisconnectSpreadsheet = async () => {
    if (!db || !session) return;
    const confirm = await Swal.fire({
      title: 'Putuskan Hubungan Spreadsheet?',
      text: `Aplikasi akan berhenti menyinkronkan database dengan "${db.pengaturan.spreadsheetTitle || db.pengaturan.spreadsheetId}". File asli di Google Drive Anda tidak akan dihapus.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D64545',
      confirmButtonText: 'Ya, Putuskan',
      cancelButtonText: 'Batal',
      background: darkMode ? '#131926' : '#ffffff',
      color: darkMode ? '#f1f5f9' : '#0f172a',
    });
    if (!confirm.isConfirmed) return;

    const nextDb = await savePengaturanRecord(session, {
      ...db.pengaturan,
      spreadsheetId: '',
      spreadsheetTitle: '',
      spreadsheetUrl: '',
      spreadsheetAutoSync: false,
      spreadsheetLastSyncAt: '',
      spreadsheetLastSyncDirection: '',
    });
    setDb({ ...nextDb });
  };

  const handleListUserSpreadsheets = async () => {
    const accessToken = getGoogleDriveAccessToken();
    if (!accessToken) {
      throw new Error('Silakan Sign in with Google terlebih dahulu.');
    }
    return listUserSpreadsheets(accessToken, 20);
  };

  const syncNewShipmentToGasWebAppIfEnabled = async (
    targetDb: DatabaseState,
    shipment: Shipment,
    containers: KontainerItem[] = []
  ): Promise<{ synced: boolean; error?: string; nextDb?: DatabaseState }> => {
    if (!session) return { synced: false };
    const configuredUrl =
      targetDb.pengaturan.gasWebAppUrl !== undefined
        ? targetDb.pengaturan.gasWebAppUrl
        : DEFAULT_GAS_WEBAPP_URL;
    const autoSync = targetDb.pengaturan.gasWebAppAutoSync !== false;
    if (!autoSync || !configuredUrl || !isOnline) {
      return { synced: false };
    }
    const urlCheck = validateGasWebAppUrl(configuredUrl);
    if (!urlCheck.valid) return { synced: false };

    try {
      const res = await postGasWebAppAddShipment(
        urlCheck.normalizedUrl,
        shipment,
        containers,
        {
          importirs: targetDb.importirs,
          checklistItems: targetDb.pengaturan.checklistItems,
        }
      );
      const updatedDb = await savePengaturanRecord(session, {
        ...targetDb.pengaturan,
        gasWebAppUrl: urlCheck.normalizedUrl,
        gasWebAppLastSyncAt: res.sentAt,
        gasWebAppLastSyncDirection: 'post',
        gasWebAppLastSyncMessage: `POST add ${shipment.kodeOs} (${shipment.noBl}) berhasil`,
      });
      await flushIndexedDbWrites();
      setDb({ ...updatedDb });
      return { synced: true, nextDb: updatedDb };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal mengirim data baru ke Google Apps Script.';
      return { synced: false, error: msg };
    }
  };

  const handleSaveGasWebAppConfig = async (config: {
    gasWebAppUrl: string;
    gasWebAppAutoSync: boolean;
  }) => {
    if (!db || !session) return;
    const nextDb = await savePengaturanRecord(session, {
      ...db.pengaturan,
      gasWebAppUrl: config.gasWebAppUrl.trim(),
      gasWebAppAutoSync: config.gasWebAppAutoSync,
    });
    await applyDbUpdate(nextDb);
    void Swal.fire({
      toast: true,
      position: 'bottom-end',
      icon: 'success',
      title: 'Konfigurasi Endpoint GAS Disimpan',
      text: config.gasWebAppAutoSync
        ? 'Auto-POST { action: "add" } aktif untuk shipment baru.'
        : 'Auto-POST dimatikan (sinkronisasi manual).',
      background: darkMode ? '#151B2B' : '#FFFFFF',
      color: darkMode ? '#F1F5F9' : '#0F172A',
      showConfirmButton: false,
      timer: 2600,
    });
  };

  const handlePullFromGasWebApp = async (overrideUrl?: string) => {
    if (!db || !session) return;
    const targetUrl = (
      overrideUrl ??
      (db.pengaturan.gasWebAppUrl !== undefined
        ? db.pengaturan.gasWebAppUrl
        : DEFAULT_GAS_WEBAPP_URL)
    ).trim();
    const check = validateGasWebAppUrl(targetUrl);
    if (!check.valid) {
      await Swal.fire({
        title: 'URL Endpoint GAS Tidak Valid',
        text: check.error || 'Periksa kembali URL Web App Google Apps Script.',
        icon: 'warning',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
      return;
    }

    setSyncingGasWebApp(true);
    try {
      const fetched = await fetchGasWebAppShipments(
        check.normalizedUrl,
        db.pengaturan.checklistItems,
        db.shipments
      );

      if (fetched.shipments.length === 0) {
        const metaDb = await savePengaturanRecord(session, {
          ...db.pengaturan,
          gasWebAppUrl: check.normalizedUrl,
          gasWebAppLastSyncAt: fetched.fetchedAt,
          gasWebAppLastSyncDirection: 'get',
          gasWebAppLastSyncMessage: 'GET berhasil, belum ada baris shipment di endpoint GAS.',
        });
        await applyDbUpdate(metaDb);
        await Swal.fire({
          title: 'Data GAS Kosong',
          text: 'Endpoint Google Apps Script merespons sukses (GET), namun daftar data shipment masih kosong.',
          icon: 'info',
          background: darkMode ? '#131926' : '#ffffff',
          color: darkMode ? '#f1f5f9' : '#0f172a',
        });
        return;
      }

      const merged = mergeGasFetchedShipments(db, fetched.shipments, session.username);
      const imported = await importDatabaseSnapshot({
        ...merged.nextDb,
        pengaturan: {
          ...merged.nextDb.pengaturan,
          gasWebAppUrl: check.normalizedUrl,
        },
      });
      setDb({ ...imported });
      setLastSyncedAt(fetched.fetchedAt);
      await refreshOfflineTelemetry(imported);

      await Swal.fire({
        title: 'Data Berhasil Diambil dari GAS (GET)',
        text: `Berhasil memproses ${merged.totalRemote} baris dari Google Apps Script (${merged.insertedCount} baru ditambahkan, ${merged.updatedCount} diperbarui).`,
        icon: 'success',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Gagal mengambil data dari endpoint Google Apps Script.';
      const errDb = await savePengaturanRecord(session, {
        ...db.pengaturan,
        gasWebAppUrl: check.normalizedUrl,
        gasWebAppLastSyncAt: new Date().toISOString(),
        gasWebAppLastSyncDirection: 'get',
        gasWebAppLastSyncMessage: `GET gagal: ${message}`,
      });
      setDb({ ...errDb });
      await Swal.fire({
        title: 'Gagal Mengambil Data GAS (GET)',
        text: message,
        icon: 'error',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
    } finally {
      setSyncingGasWebApp(false);
    }
  };

  const handlePushShipmentToGasWebApp = async (
    kodeOs?: string,
    overrideUrl?: string
  ) => {
    if (!db || !session) return;
    const targetUrl = (
      overrideUrl ??
      (db.pengaturan.gasWebAppUrl !== undefined
        ? db.pengaturan.gasWebAppUrl
        : DEFAULT_GAS_WEBAPP_URL)
    ).trim();
    const check = validateGasWebAppUrl(targetUrl);
    if (!check.valid) {
      await Swal.fire({
        title: 'URL Endpoint GAS Tidak Valid',
        text: check.error || 'Periksa kembali URL Web App Google Apps Script.',
        icon: 'warning',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
      return;
    }

    const targetShipment =
      (kodeOs
        ? db.shipments.find((s) => s.kodeOs === kodeOs)
        : db.shipments[0]) || null;
    if (!targetShipment) {
      await Swal.fire({
        title: 'Belum Ada Data Shipment',
        text: 'Tambahkan minimal 1 data shipment terlebih dahulu untuk dikirim ke endpoint GAS.',
        icon: 'info',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
      return;
    }

    setSyncingGasWebApp(true);
    try {
      const targetContainers = db.kontainers.filter(
        (k) => k.kodeOs === targetShipment.kodeOs
      );
      const res = await postGasWebAppAddShipment(
        check.normalizedUrl,
        targetShipment,
        targetContainers,
        {
          importirs: db.importirs,
          checklistItems: db.pengaturan.checklistItems,
        }
      );
      const savedDb = await savePengaturanRecord(session, {
        ...db.pengaturan,
        gasWebAppUrl: check.normalizedUrl,
        gasWebAppLastSyncAt: res.sentAt,
        gasWebAppLastSyncDirection: 'post',
        gasWebAppLastSyncMessage: `POST { action: 'add' } ${targetShipment.kodeOs} berhasil.`,
      });
      await flushIndexedDbWrites();
      setDb({ ...savedDb });
      await Swal.fire({
        title: 'Data Berhasil Dikirim ke GAS (POST add)',
        text: `Shipment ${targetShipment.kodeOs} (BL: ${targetShipment.noBl}) telah dikirim dengan payload { action: 'add', data: {...} }.`,
        icon: 'success',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Gagal mengirim data ke endpoint Google Apps Script.';
      const errDb = await savePengaturanRecord(session, {
        ...db.pengaturan,
        gasWebAppUrl: check.normalizedUrl,
        gasWebAppLastSyncAt: new Date().toISOString(),
        gasWebAppLastSyncDirection: 'post',
        gasWebAppLastSyncMessage: `POST gagal: ${message}`,
      });
      setDb({ ...errDb });
      await Swal.fire({
        title: 'Gagal Mengirim Data ke GAS (POST)',
        text: message,
        icon: 'error',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
    } finally {
      setSyncingGasWebApp(false);
    }
  };

  const uploadSingleDocument = async (
    kodeOs: string,
    jenisDokumen: string,
    namaFile: string,
    file?: File,
    parentFolderSetting = 'PTG_PPJK_DOKUMEN_ROOT'
  ) => {
    if (!session) return;
    const accessToken = getGoogleDriveAccessToken();
    if (accessToken && file) {
      const uploaded = await uploadFileToGoogleDrive({
        accessToken,
        file,
        kodeOs,
        parentFolderSetting,
        jenisDokumen,
      });
      return addShipmentDocument(session, kodeOs, jenisDokumen, uploaded.name, {
        linkDrive: uploaded.webViewLink,
        driveFileId: uploaded.fileId,
        driveFolderId: uploaded.folderId,
        source: 'google-drive',
      });
    }
    return addShipmentDocument(session, kodeOs, jenisDokumen, namaFile, {
      source: 'simulasi',
    });
  };

  const handleSaveShipment = async (
    shipment: Shipment,
    containers: KontainerItem[],
    isNew: boolean,
    pendingUploads: PendingUploadFile[] = []
  ) => {
    if (!session) return;
    const res = await saveShipmentRecord(session, shipment, containers, isNew);
    let latestDb = res.db;
    let driveUploadedCount = 0;
    let driveFallbackError = '';

    for (const item of pendingUploads) {
      try {
        const accessToken = getGoogleDriveAccessToken();
        if (accessToken && item.file) {
          const uploaded = await uploadFileToGoogleDrive({
            accessToken,
            file: item.file,
            kodeOs: res.saved.kodeOs,
            parentFolderSetting: latestDb.pengaturan.driveParentFolderId,
            jenisDokumen: item.jenisDokumen,
          });
          latestDb = await addShipmentDocument(
            session,
            res.saved.kodeOs,
            item.jenisDokumen,
            uploaded.name,
            {
              linkDrive: uploaded.webViewLink,
              driveFileId: uploaded.fileId,
              driveFolderId: uploaded.folderId,
              source: 'google-drive',
            }
          );
          driveUploadedCount++;
        } else {
          latestDb = await addShipmentDocument(
            session,
            res.saved.kodeOs,
            item.jenisDokumen,
            item.namaFile,
            { source: 'simulasi' }
          );
        }
      } catch (err) {
        driveFallbackError = err instanceof Error ? err.message : 'Gagal upload ke Google Drive';
        latestDb = await addShipmentDocument(
          session,
          res.saved.kodeOs,
          item.jenisDokumen,
          item.namaFile,
          { source: 'simulasi' }
        );
      }
    }
    await applyDbUpdate(latestDb);
    let gasNote = '';
    if (isNew) {
      const savedContainers = latestDb.kontainers.filter(
        (k) => k.kodeOs === res.saved.kodeOs
      );
      const gasRes = await syncNewShipmentToGasWebAppIfEnabled(
        latestDb,
        res.saved,
        savedContainers
      );
      if (gasRes.synced) {
        gasNote = ' & tersinkron ke GAS Spreadsheet (POST add).';
      } else if (gasRes.error) {
        gasNote = ` (Lokal tersimpan · GAS POST tertunda: ${gasRes.error})`;
      }
    }
    await Swal.fire({
      title: 'Tersimpan',
      text:
        pendingUploads.length > 0
          ? driveUploadedCount > 0
            ? `Shipment ${res.saved.kodeOs} disimpan & ${driveUploadedCount} file berhasil diupload ke Google Drive.${gasNote}`
            : driveFallbackError
            ? `Shipment ${res.saved.kodeOs} disimpan (Drive fallback lokal: ${driveFallbackError}).${gasNote}`
            : `Shipment ${res.saved.kodeOs} berhasil disimpan beserta ${pendingUploads.length} file dokumen.${gasNote}`
          : `Shipment ${res.saved.kodeOs} berhasil disimpan.${gasNote}`,
      icon: 'success',
      timer: 2200,
      showConfirmButton: false,
    });
  };

  const handleDeleteShipment = async (kodeOs: string) => {
    if (!session) return;
    const confirm = await Swal.fire({
      title: `Hapus Shipment ${kodeOs}?`,
      text: 'Seluruh data shipment dan kontainer terkait akan dihapus.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D64545',
      cancelButtonText: 'Batal',
      confirmButtonText: 'Ya, Hapus',
    });
    if (!confirm.isConfirmed) return;
    const nextDb = await deleteShipmentRecord(session, kodeOs);
    await applyDbUpdate(nextDb);
    setDetailKodeOs(null);
  };

  const handleAddComment = async (kodeOs: string, isi: string) => {
    if (!session) return;
    const nextDb = await addShipmentComment(session, kodeOs, isi);
    await applyDbUpdate(nextDb);
  };

  const handleUploadDocument = async (
    kodeOs: string,
    jenisDokumen: string,
    namaFile: string,
    file?: File
  ) => {
    if (!session) return;
    const nextDb = await uploadSingleDocument(
      kodeOs,
      jenisDokumen,
      namaFile,
      file,
      db?.pengaturan.driveParentFolderId
    );
    if (nextDb) await applyDbUpdate(nextDb);
  };

  const handleUpdateStatusDokumen = async (
    kodeOs: string,
    nextStatus: StatusDokumenType
  ) => {
    if (!session) return;
    const nextDb = await updateShipmentStatusDokumen(session, kodeOs, nextStatus);
    await applyDbUpdate(nextDb);
  };

  const handleUpdateKodeManualDokOs = async (
    kodeOs: string,
    nextCode: string
  ) => {
    if (!session) return;
    const nextDb = await updateShipmentKodeManualDokOs(session, kodeOs, nextCode);
    await applyDbUpdate(nextDb);
  };

  const handleUpdateBc11 = async (
    kodeOs: string,
    bc11Terbit: boolean,
    noBc11?: string,
    tglBc11?: string
  ) => {
    if (!session) return;
    const nextDb = await updateShipmentBc11(session, kodeOs, bc11Terbit, noBc11, tglBc11);
    await applyDbUpdate(nextDb);
  };

  const handleSavePengeluaranOps = async (
    payload: PengeluaranOpsInputPayload,
    isNew: boolean,
    proofFile?: File
  ) => {
    if (!session || !db) return;
    let finalPayload: PengeluaranOpsInputPayload = { ...payload };
    let driveNote = '';

    const accessToken = getGoogleDriveAccessToken();
    if (proofFile && accessToken) {
      try {
        const uploaded = await uploadFileToGoogleDrive({
          accessToken,
          file: proofFile,
          kodeOs: payload.kodeOs || 'UMUM_NON_OS',
          parentFolderSetting: db.pengaturan.driveParentFolderId,
          jenisDokumen: `Bukti_Ops_${payload.kategori}`,
        });
        finalPayload = {
          ...finalPayload,
          buktiNamaFile: uploaded.name,
          buktiLinkDrive: uploaded.webViewLink,
          driveFileId: uploaded.fileId,
          source: 'google-drive',
        };
        driveNote = ' Bukti berhasil diupload ke Google Drive.';
      } catch (err) {
        driveNote = ` (Bukti disimpan lokal offline: ${
          err instanceof Error ? err.message : 'Drive tidak terjangkau'
        })`;
        finalPayload.source = finalPayload.buktiDataUrl ? 'offline-local' : 'simulasi';
      }
    } else if (proofFile) {
      finalPayload.source = finalPayload.buktiDataUrl ? 'offline-local' : 'simulasi';
    }

    const res = await savePengeluaranOpsRecord(session, finalPayload, isNew);
    await applyDbUpdate(res.db);
    await Swal.fire({
      title: isNew ? 'Pengeluaran Ops Tercatat' : 'Pengeluaran Ops Diperbarui',
      text: `${res.saved.kodePengeluaran} (${res.saved.noTandaTerima}) tersimpan untuk ${res.saved.kodeOs}.${driveNote}`,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false,
      background: darkMode ? '#131926' : '#ffffff',
      color: darkMode ? '#f1f5f9' : '#0f172a',
    });
  };

  const handleDeletePengeluaranOps = async (id: string) => {
    if (!session) return;
    const confirm = await Swal.fire({
      title: 'Hapus Catatan Pengeluaran Ops?',
      text: 'Catatan pengeluaran dan nomor tanda terima terkait akan dihapus dari log operasional.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D64545',
      cancelButtonText: 'Batal',
      confirmButtonText: 'Ya, Hapus',
      background: darkMode ? '#131926' : '#ffffff',
      color: darkMode ? '#f1f5f9' : '#0f172a',
    });
    if (!confirm.isConfirmed) return;
    const nextDb = await deletePengeluaranOpsRecord(session, id);
    await applyDbUpdate(nextDb);
  };

  const handleUpdateDoPelayaran = async (
    kodeOs: string,
    payload: {
      statusDokumen?: StatusDokumenType;
      doPelayaranStatus?: StatusDoPelayaranType;
      doBerlakuSampai?: string;
      doCatatanPerpanjangan?: string;
      doGatePassStatus?: StatusGatePassType;
      doGatePassJenis?: GatePassJenisType;
      doGatePassNomor?: string;
      truckingStatus?: StatusDoPelayaranType;
      truckingNamaSupir?: string;
      truckingNoPlat?: string;
      truckingNoHpSupir?: string;
      gateOutStatus?: StatusGateOutType;
      gateOutTanggal?: string;
      gateOutCatatan?: string;
      bindDokumenSelesai?: boolean;
      suratJalanNomor?: string;
      suratJalanTanggal?: string;
      suratJalanStatus?: StatusSuratJalanType;
      suratJalanTujuan?: string;
      suratJalanPenerima?: string;
      suratJalanCatatan?: string;
    }
  ) => {
    if (!session) return;
    const prevTarget = db?.shipments.find((s) => s.kodeOs === kodeOs);
    const wasEligible = prevTarget ? isShipmentBillingEligible(prevTarget) : false;
    const nextDb = await updateShipmentDoPelayaran(session, kodeOs, payload);
    await applyDbUpdate(nextDb);
    const updatedTarget = nextDb.shipments.find((s) => s.kodeOs === kodeOs);
    if (!wasEligible && updatedTarget && isShipmentBillingEligible(updatedTarget)) {
      void Swal.fire({
        title: `${kodeOs} siap Info Owner (WA/Email) & Draft ${updatedTarget.billingNomor || 'Penagihan'}`,
        icon: 'info',
        toast: true,
        position: 'top-end',
        timer: 3200,
        showConfirmButton: false,
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
    }
  };

  const handleNotifyOwnerBilling = async (
    kodeOs: string,
    via: 'WhatsApp' | 'Email' | 'WA & Email'
  ) => {
    if (!session) return;
    const nextDb = await updateShipmentBilling(session, kodeOs, {
      action: 'notify_owner',
      via,
    });
    await applyDbUpdate(nextDb);
  };

  const handleSaveBillingInvoice = async (
    kodeOs: string,
    payload: {
      billingNomor: string;
      billingTanggal: string;
      billingJatuhTempo: string;
      billingItems: BillingItem[];
      billingPpnPersen: number;
      billingCatatan: string;
      billingStatus: StatusPenagihanType;
      customerSentVia?: 'WhatsApp' | 'Email' | 'WA & Email' | '';
    }
  ) => {
    if (!session) return;
    const nextDb = await updateShipmentBilling(session, kodeOs, {
      action: 'save_invoice',
      ...payload,
    });
    await applyDbUpdate(nextDb);
  };

  const handleCreateShipmentFromDo = async (
    shipment: Shipment,
    containers: KontainerItem[]
  ): Promise<Shipment | undefined> => {
    if (!session) return undefined;
    const res = await saveShipmentRecord(session, shipment, containers, true);
    await applyDbUpdate(res.db);
    const savedContainers = res.db.kontainers.filter(
      (k) => k.kodeOs === res.saved.kodeOs
    );
    const gasRes = await syncNewShipmentToGasWebAppIfEnabled(
      res.db,
      res.saved,
      savedContainers
    );
    const sjInfo = res.saved.suratJalanNomor
      ? ` & Surat Jalan ${res.saved.suratJalanNomor} terbit`
      : '';
    const gasInfo = gasRes.synced ? ' · GAS Sync OK' : '';
    void Swal.fire({
      title: `Catatan D/O ${res.saved.kodeOs} dibuat (${res.saved.statusDokumen})${sjInfo}${gasInfo}`,
      icon: 'success',
      toast: true,
      position: 'top-end',
      timer: 2200,
      showConfirmButton: false,
      background: darkMode ? '#131926' : '#ffffff',
      color: darkMode ? '#f1f5f9' : '#0f172a',
    });
    return res.saved;
  };

  const handleImportShipmentsFromExcel = async (
    items: BatchExcelImportItem[],
    options: { updateExisting: boolean; sourceFileName: string }
  ) => {
    if (!session) return;
    const res = await importShipmentsFromExcelBatch(session, items, options);
    await applyDbUpdate(res.db);

    let gasSyncedCount = 0;
    let currentDbForGas = res.db;
    for (const createdKode of res.createdKodeOsList) {
      const createdShip = currentDbForGas.shipments.find((s) => s.kodeOs === createdKode);
      if (!createdShip) continue;
      const createdCont = currentDbForGas.kontainers.filter((k) => k.kodeOs === createdKode);
      const gasRes = await syncNewShipmentToGasWebAppIfEnabled(
        currentDbForGas,
        createdShip,
        createdCont
      );
      if (gasRes.synced) {
        gasSyncedCount++;
        if (gasRes.nextDb) currentDbForGas = gasRes.nextDb;
      }
    }

    const parts: string[] = [];
    if (res.insertedCount > 0) parts.push(`${res.insertedCount} baru ditambahkan`);
    if (res.updatedCount > 0) parts.push(`${res.updatedCount} diperbarui`);
    if (res.skippedCount > 0) parts.push(`${res.skippedCount} dilewati`);
    if (gasSyncedCount > 0) parts.push(`${gasSyncedCount} dikirim ke GAS`);
    await Swal.fire({
      title: 'Upload Excel / CSV Selesai',
      text: parts.length > 0 ? parts.join(' · ') : 'Tidak ada baris yang diproses.',
      icon: res.insertedCount + res.updatedCount > 0 ? 'success' : 'info',
      toast: true,
      position: 'top-end',
      timer: 3200,
      showConfirmButton: false,
      background: darkMode ? '#131926' : '#ffffff',
      color: darkMode ? '#f1f5f9' : '#0f172a',
    });
  };

  const handleDeleteDocument = async (doc: DokumenItem) => {
    if (!session) return;
    const isRealDrive = Boolean(doc.driveFileId);
    const confirm = await Swal.fire({
      title: `Hapus Dokumen "${doc.namaFile}"?`,
      text: isRealDrive
        ? `File "${doc.namaFile}" (${doc.jenisDokumen}) akan dihapus secara permanen dari Google Drive Anda dan dari daftar dokumen ${doc.kodeOs}.`
        : `Catatan dokumen "${doc.namaFile}" akan dihapus dari shipment ${doc.kodeOs}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D64545',
      cancelButtonText: 'Batal',
      confirmButtonText: isRealDrive ? 'Ya, Hapus dari Drive' : 'Ya, Hapus',
    });
    if (!confirm.isConfirmed) return;

    if (doc.driveFileId) {
      const token = getGoogleDriveAccessToken();
      if (!token) {
        await Swal.fire({
          title: 'Login Google Drive Diperlukan',
          text: 'Silakan klik "Sign in with Google" terlebih dahulu untuk menghapus file ini dari Google Drive.',
          icon: 'info',
        });
        return;
      }
      await deleteGoogleDriveFile(token, doc.driveFileId);
    }

    const nextDb = await deleteShipmentDocument(session, doc.id);
    await applyDbUpdate(nextDb);
  };

  const handleListDriveFiles = async () => {
    const token = getGoogleDriveAccessToken();
    if (!token) {
      throw new Error('Silakan Sign in with Google terlebih dahulu untuk melihat file Drive.');
    }
    return listGoogleDriveFiles({ accessToken: token, pageSize: 15 });
  };

  const handleResetDb = async (mode: 'empty' | 'seed') => {
    const confirm = await Swal.fire({
      title: mode === 'empty' ? 'Mulai dari Nol?' : 'Muat Data Contoh PTG?',
      text:
        mode === 'empty'
          ? 'Seluruh shipment dan master data akan dikosongkan (akun user tetap dipertahankan).'
          : 'Data simulasi PTG akan dimuat ulang.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#7C3AED',
      confirmButtonText: 'Lanjutkan',
      cancelButtonText: 'Batal',
    });
    if (!confirm.isConfirmed) return;
    const nextDb = await resetDatabase(mode);
    setDb({ ...nextDb });
    setDetailKodeOs(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B2545] dark:bg-[#090C15] flex items-center justify-center text-white text-sm font-medium">
        Memuat aplikasi PTG PPJK...
      </div>
    );
  }

  if (!session || !db) {
    return <LoginView onLoginSuccess={handleLoginSuccess} pengaturan={db?.pengaturan} />;
  }

  const ppjkIdentity = getPpjkIdentity(db.pengaturan);
  const outstandingCount = db.shipments.filter((s) =>
    isShipmentOutstanding(s, db.pengaturan.checklistItems)
  ).length;
  const doBelumCount = db.shipments.filter(
    (s) => normalizeStatusDoPelayaran(s.doPelayaranStatus) === 'Belum'
  ).length;
  const suratJalanCount = db.shipments.filter(isContainerGateOut).length;
  const billingSummary = computeBillingSummary(db.shipments);
  const pendingBillingCount =
    billingSummary.siapInfoOwnerCount + billingSummary.ownerNotifiedCount;
  const opsExpenseMissingProofCount = (db.pengeluaranOps || []).filter(
    (item) => !hasBuktiPengeluaran(item)
  ).length;

  const moduleAccess = resolveUserModuleAccess(session, db.pengaturan);
  const canCreate = canPerformAction(session.role, 'create_shipment');
  const canAccessMaster =
    (canPerformAction(session.role, 'manage_master') ||
      canPerformAction(session.role, 'manage_users')) &&
    Boolean(moduleAccess.master);
  const canAccessSetup =
    canPerformAction(session.role, 'manage_setup') || Boolean(moduleAccess.setup);

  const isViewAllowed = (v: AppView): boolean => {
    if (v === 'master') return canAccessMaster;
    if (v === 'setup') return canAccessSetup;
    return Boolean(moduleAccess[v]);
  };

  const firstAllowedModule = getFirstAccessibleModule(session, db.pengaturan);
  const effectiveView: AppView | null = isViewAllowed(activeView)
    ? activeView
    : firstAllowedModule;

  const detailShipment = detailKodeOs
    ? db.shipments.find((s) => s.kodeOs === detailKodeOs) || null
    : null;
  const billingModalShipment = billingModalState
    ? db.shipments.find((s) => s.kodeOs === billingModalState.kodeOs) || null
    : null;

  const userInitials = session.nama
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-[#090C15] text-slate-900 dark:text-slate-100 flex overflow-x-hidden transition-colors duration-200">
      <Sidebar
        activeView={effectiveView || 'dashboard'}
        onSelectView={(view) => {
          if (!isViewAllowed(view)) return;
          if (view !== 'shipments') {
            setTableCheckerFilter('');
            setTableSearchQuery('');
          }
          if (view !== 'checker') {
            setSelectedRecapChecker('');
          }
          if (view !== 'keuangan-ops') {
            setKeuanganOpsFilterKodeOs('');
          }
          if (view === 'master') {
            setMasterInitialTab('customer');
          }
          setActiveView(view);
        }}
        user={session}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onLogout={handleLogout}
        outstandingCount={outstandingCount}
        doBelumCount={doBelumCount}
        suratJalanCount={suratJalanCount}
        pendingBillingCount={pendingBillingCount}
        opsExpenseMissingProofCount={opsExpenseMissingProofCount}
        isOnline={isOnline}
        pendingSyncCount={offlineSyncQueue.length}
        pengaturan={db.pengaturan}
      />

      <div
        className={`flex-1 min-w-0 w-full max-w-full flex flex-col transition-all duration-200 ${
          sidebarCollapsed ? 'lg:ml-[76px]' : 'lg:ml-[256px]'
        }`}
      >
        {/* Top Bar matching dark ERP aesthetic */}
        <header className="sticky top-0 z-30 h-16 bg-[#0B2545] dark:bg-[#0D111C]/95 dark:backdrop-blur-md text-white px-4 sm:px-6 flex items-center justify-between gap-3 border-b border-white/10 dark:border-white/[0.06] no-print">
          {/* Left: Mobile Menu + Workspace Indicator */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 xl:flex-none xl:shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 hover:bg-white/20 dark:bg-white/[0.06] text-white cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/10 dark:bg-[#151B2B] border border-white/10 dark:border-white/[0.07] shrink-0">
              <Building2 className="w-4 h-4 text-[#F28C28] dark:text-[#A78BFA] shrink-0" />
              <span
                data-testid="header-brand-title"
                className="text-xs font-semibold text-white truncate max-w-[190px]"
              >
                {effectiveView === 'dashboard' || !effectiveView
                  ? `${ppjkIdentity.brandName} — Tracking`
                  : VIEW_TITLES[effectiveView]}
              </span>
            </div>

            <h1 className="xl:hidden text-xs sm:text-sm font-semibold text-white truncate min-w-0">
              {effectiveView === 'dashboard' || !effectiveView
                ? `${ppjkIdentity.brandName}`
                : VIEW_TITLES[effectiveView]}
            </h1>
          </div>

          {/* Center: Global Search Input (Ctrl + K) */}
          <div ref={searchBoxRef} className="relative hidden md:block flex-1 min-w-[140px] max-w-xs lg:max-w-sm xl:max-w-md mx-1">
            <div className="relative">
              <Search className="w-4 h-4 text-white/50 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                aria-label="Pencarian cepat shipment"
                value={globalSearch}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setSearchFocused(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && globalSearch.trim()) {
                    setTableSearchQuery(globalSearch.trim());
                    setActiveView('shipments');
                    setSearchFocused(false);
                  }
                }}
                placeholder="Cari OS, BL..."
                className="w-full h-9 pl-9 pr-3 2xl:pr-16 rounded-xl bg-white/10 dark:bg-[#151B2B] border border-white/15 dark:border-white/[0.08] text-xs text-white placeholder:text-white/50 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 focus:border-[#7C3AED]"
              />
              <kbd className="hidden 2xl:inline-flex absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-white/10 dark:bg-white/[0.06] border border-white/10 text-[10px] font-mono-code text-white/70 dark:text-slate-400 pointer-events-none">
                Ctrl + K
              </kbd>
            </div>

            {searchFocused && globalSearch.trim() && (
              <div className="absolute left-0 right-0 mt-2 rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden z-50">
                {searchMatches.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    Tidak ada shipment cocok dengan &ldquo;{globalSearch}&rdquo;.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {searchMatches.map((s) => (
                      <button
                        key={s.kodeOs}
                        type="button"
                        onClick={() => {
                          setDetailKodeOs(s.kodeOs);
                          setSearchFocused(false);
                        }}
                        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-code text-xs font-bold text-[#0B2545] dark:text-[#A78BFA]">
                              {s.kodeOs}
                            </span>
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {s.namaCustomer}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            BL: {s.noBl} · {s.status}
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-[#F28C28] dark:text-violet-400 shrink-0">
                          Detail
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Bell Notifications, Theme Switch, Drive, Profile, CTA */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Notification Bell */}
            <div ref={notifBoxRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifikasi sinyal segera proses"
                className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 dark:bg-[#151B2B] dark:hover:bg-[#1D253B] border border-transparent dark:border-white/[0.07] text-white cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {urgentAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {urgentAlerts.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.07] flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Peringatan Segera Proses ({urgentAlerts.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveView('outstanding');
                        setNotifOpen(false);
                      }}
                      className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                    >
                      Lihat Semua
                    </button>
                  </div>
                  {urgentAlerts.length === 0 ? (
                    <div className="p-4 text-xs text-slate-500 dark:text-slate-400">
                      Tidak ada peringatan mendesak saat ini.
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {urgentAlerts.map((s) => {
                        const sig = getShipmentProcessSignal(s);
                        return (
                          <button
                            key={s.kodeOs}
                            type="button"
                            onClick={() => {
                              setDetailKodeOs(s.kodeOs);
                              setNotifOpen(false);
                            }}
                            className="w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono-code text-xs font-bold text-[#0B2545] dark:text-violet-300">
                                {s.kodeOs}
                              </span>
                              <span className="text-[10.5px] font-semibold text-red-600 dark:text-red-400">
                                {sig.active ? sig.shortLabel : 'Tanpa AJU'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-700 dark:text-slate-200 truncate">
                              {s.namaCustomer}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              data-testid="theme-toggle-btn"
              aria-label={darkMode ? 'Aktifkan Light Mode' : 'Aktifkan Dark Mode'}
              title={darkMode ? 'Ubah ke Light Mode' : 'Ubah ke Dark Mode'}
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 dark:bg-[#151B2B] dark:hover:bg-[#1D253B] border border-transparent dark:border-white/[0.07] text-white cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>

            {canAccessMaster && (
              <button
                type="button"
                data-testid="header-sheets-status-btn"
                onClick={() => {
                  setMasterInitialTab('spreadsheet');
                  setActiveView('master');
                }}
                title={
                  db.pengaturan.spreadsheetId
                    ? `Database Spreadsheet: ${db.pengaturan.spreadsheetTitle || 'Terhubung'} (${
                        driveUserEmail ? 'Google Terhubung' : 'Perlu Sign in Google'
                      })`
                    : 'Hubungkan Database ke Google Spreadsheet'
                }
                className={`hidden md:inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl border text-[11px] font-semibold cursor-pointer transition-colors ${
                  db.pengaturan.spreadsheetId && driveUserEmail
                    ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-100 hover:bg-emerald-500/25'
                    : db.pengaturan.spreadsheetId
                      ? 'bg-amber-500/15 border-amber-400/35 text-amber-100 hover:bg-amber-500/25'
                      : 'bg-white/10 border-white/15 text-white/90 hover:bg-white/20'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">
                  {syncingSheets
                    ? 'Sync Sheets...'
                    : db.pengaturan.spreadsheetId
                      ? driveUserEmail
                        ? 'Sheets Aktif'
                        : 'Sheets (Login)'
                      : 'Sheets DB'}
                </span>
              </button>
            )}

            {driveUserEmail ? (
              <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-medium text-emerald-100">
                <HardDrive className="w-3.5 h-3.5 text-emerald-300" />
                <span className="max-w-[120px] truncate" title={driveUserEmail}>
                  {driveUserEmail}
                </span>
                <button
                  type="button"
                  onClick={handleDisconnectGoogleDrive}
                  title="Putuskan koneksi Google Drive & Sheets"
                  aria-label="Putuskan koneksi Google Drive & Sheets"
                  className="ml-1 p-0.5 rounded hover:bg-white/10 text-emerald-200 cursor-pointer"
                >
                  <LogOutIcon className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="hidden xl:block">
                <GoogleSignInButton
                  onClick={handleConnectGoogleDrive}
                  disabled={driveConnecting}
                  label={driveConnecting ? 'Menghubungkan...' : 'Sign in with Google'}
                />
              </div>
            )}

            <button
              type="button"
              data-testid="refresh-sync-btn"
              onClick={handleRefreshData}
              disabled={refreshing}
              aria-label="Sync & Perbarui Data"
              title={
                refreshing
                  ? 'Sedang menyinkronkan & memperbarui data...'
                  : lastSyncedAt
                    ? `Sync & Perbarui Data (Terakhir: ${formatSyncClock(lastSyncedAt)})`
                    : 'Sync & Perbarui Data'
              }
              className="relative inline-flex items-center justify-center gap-1.5 h-9 px-2.5 lg:px-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-70 dark:bg-[#151B2B] dark:hover:bg-[#1D253B] border border-white/10 dark:border-white/[0.08] text-white cursor-pointer transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 shrink-0 ${
                  refreshing ? 'animate-spin text-amber-300' : 'text-emerald-300'
                }`}
              />
              <span className="hidden lg:inline text-[11.5px] font-semibold whitespace-nowrap">
                {refreshing ? 'Sync...' : 'Sync'}
              </span>
              {!refreshing && lastSyncedAt && (
                <span
                  aria-hidden="true"
                  className="lg:hidden absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400"
                />
              )}
            </button>

            {/* User Profile Pill matching mockup */}
            <div
              data-testid="active-role-badge"
              title={`${session.nama} (${session.role})`}
              className="hidden md:flex items-center gap-2 px-1.5 2xl:pl-2 2xl:pr-3 py-1 rounded-xl bg-white/10 dark:bg-[#151B2B] border border-white/10 dark:border-white/[0.07]"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                {userInitials || 'U'}
              </div>
              <div className="hidden 2xl:block leading-tight min-w-0">
                <div className="text-[11.5px] font-semibold text-white truncate max-w-[110px]">
                  {session.nama}
                </div>
                <div className="text-[10px] text-white/65 dark:text-slate-400 truncate">
                  {session.role}
                </div>
              </div>
            </div>

            {canCreate && (
              <button
                type="button"
                onClick={openCreateForm}
                aria-label="Tambah Shipment"
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] dark:hover:from-[#6D28D9] dark:hover:to-[#4F46E5] text-white text-xs font-semibold whitespace-nowrap cursor-pointer shadow-sm dark:shadow-lg dark:shadow-violet-600/20"
              >
                <Plus className="w-4 h-4" />
                <span className="sm:hidden">Tambah</span>
                <span className="hidden sm:inline">Tambah Shipment</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          <div
            key={effectiveView || 'locked'}
            data-testid="module-fade-wrapper"
            className="animate-module-fade-in"
          >
            {!effectiveView && (
            <div
              data-testid="all-modules-locked-notice"
              className="max-w-lg mx-auto mt-10 bg-white dark:bg-[#131926] rounded-2xl border border-amber-200 dark:border-amber-500/35 p-6 text-center space-y-3"
            >
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Akses Modul Dinonaktifkan oleh Owner (Super Admin)
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Seluruh modul aplikasi untuk akun Anda sedang dinonaktifkan melalui Kontrol Super Admin Owner. Silakan hubungi Owner untuk mengaktifkan kembali modul yang diperlukan.
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#0B2545] dark:bg-violet-600 text-white text-xs font-semibold cursor-pointer"
              >
                Keluar / Ganti Akun
              </button>
            </div>
          )}

          {effectiveView === 'dashboard' && (
            <DashboardView
              shipments={db.shipments}
              logs={db.logs}
              statusList={db.pengaturan.statusList}
              checklistItems={db.pengaturan.checklistItems}
              userName={session.nama}
              userRole={session.role}
              moduleAccess={moduleAccess}
              ppjkBrandName={ppjkIdentity.brandName}
              darkMode={darkMode}
              onOpenDetail={(kodeOs) => setDetailKodeOs(kodeOs)}
              onNavigateView={(v) => {
                if (isViewAllowed(v)) setActiveView(v);
              }}
              onOpenChecker={(checkerName) => {
                if (!isViewAllowed('checker')) return;
                setSelectedRecapChecker(checkerName);
                setActiveView('checker');
              }}
              onGoToOutstanding={() => {
                if (isViewAllowed('outstanding')) setActiveView('outstanding');
              }}
            />
          )}

          {effectiveView === 'checker' && (
            <CheckerSummaryView
              shipments={db.shipments}
              statusList={db.pengaturan.statusList}
              checklistItems={db.pengaturan.checklistItems}
              userRole={session.role}
              phasePermissions={session.phasePermissions}
              initialCheckerName={selectedRecapChecker}
              onOpenDetail={(kodeOs) => setDetailKodeOs(kodeOs)}
              onEditShipment={openEditForm}
              onOpenCheckerInTable={(checkerName) => {
                setTableCheckerFilter(checkerName);
                setActiveView('shipments');
              }}
              onUpdateStatusDokumen={handleUpdateStatusDokumen}
            />
          )}

          {effectiveView === 'do' && (
            <DoPelayaranView
              shipments={db.shipments}
              customers={db.customers}
              checklistItems={db.pengaturan.checklistItems}
              pengaturan={db.pengaturan}
              currentUsername={session.nama}
              userRole={session.role}
              phasePermissions={session.phasePermissions}
              canCreateShipment={canCreate}
              onOpenDetail={(kodeOs) => setDetailKodeOs(kodeOs)}
              onOpenBilling={(kodeOs, tab = 'owner') => setBillingModalState({ kodeOs, tab })}
              onUpdateStatusDokumen={handleUpdateStatusDokumen}
              onCreateShipmentFromDo={handleCreateShipmentFromDo}
              onUpdateDoPelayaran={handleUpdateDoPelayaran}
            />
          )}

          {effectiveView === 'surat-jalan' && (
            <SuratJalanView
              shipments={db.shipments}
              pengaturan={db.pengaturan}
              userRole={session.role}
              phasePermissions={session.phasePermissions}
              onOpenDetail={(kodeOs) => setDetailKodeOs(kodeOs)}
              onOpenBilling={(kodeOs, tab = 'owner') => setBillingModalState({ kodeOs, tab })}
              onUpdateDoPelayaran={handleUpdateDoPelayaran}
            />
          )}

          {effectiveView === 'penagihan' && (
            <PenagihanView
              shipments={db.shipments}
              customers={db.customers}
              pengaturan={db.pengaturan}
              userRole={session.role}
              onOpenDetail={(kodeOs) => setDetailKodeOs(kodeOs)}
              onOpenBilling={(kodeOs, tab = 'owner') => setBillingModalState({ kodeOs, tab })}
            />
          )}

          {effectiveView === 'keuangan-ops' && (
            <KeuanganOpsView
              items={db.pengeluaranOps || []}
              shipments={db.shipments}
              users={db.users}
              pengaturan={db.pengaturan}
              session={session}
              googleDriveEmail={driveUserEmail || undefined}
              initialFilterKodeOs={keuanganOpsFilterKodeOs}
              onSavePengeluaran={handleSavePengeluaranOps}
              onDeletePengeluaran={handleDeletePengeluaranOps}
              onOpenShipmentDetail={(kodeOs) => setDetailKodeOs(kodeOs)}
            />
          )}

          {effectiveView === 'report-nopen' && (
            <NopenReportView
              shipments={db.shipments}
              importirs={db.importirs}
              statusList={db.pengaturan.statusList}
              jalurList={db.pengaturan.jalurList}
              checklistItems={db.pengaturan.checklistItems}
              onOpenDetail={(kodeOs) => setDetailKodeOs(kodeOs)}
            />
          )}

          {(effectiveView === 'shipments' || effectiveView === 'outstanding') && (
            <ShipmentTableView
              mode={effectiveView === 'outstanding' ? 'outstanding' : 'all'}
              shipments={db.shipments}
              customers={db.customers}
              importirs={db.importirs}
              pengaturan={db.pengaturan}
              pengeluaranOps={db.pengeluaranOps || []}
              statusList={db.pengaturan.statusList}
              jalurList={db.pengaturan.jalurList}
              checklistItems={db.pengaturan.checklistItems}
              userRole={session.role}
              currentUsername={session.nama}
              phasePermissions={session.phasePermissions}
              initialCheckerFilter={effectiveView === 'shipments' ? tableCheckerFilter : ''}
              initialSearchQuery={effectiveView === 'shipments' ? tableSearchQuery : ''}
              onOpenDetail={(kodeOs) => setDetailKodeOs(kodeOs)}
              onEditShipment={openEditForm}
              onCreateShipment={openCreateForm}
              onImportExcelShipments={
                effectiveView === 'shipments' ? handleImportShipmentsFromExcel : undefined
              }
              onUpdateStatusDokumen={handleUpdateStatusDokumen}
              onUpdateKodeManualDokOs={handleUpdateKodeManualDokOs}
            />
          )}

          {effectiveView === 'master' && canAccessMaster && (
            <MasterSettingsView
              customers={db.customers}
              importirs={db.importirs}
              shippers={db.shippers}
              users={db.users}
              pengaturan={db.pengaturan}
              userRole={session.role}
              currentUsername={session.username}
              dbSnapshot={db}
              initialTab={masterInitialTab}
              driveUserEmail={driveUserEmail}
              driveConnecting={driveConnecting}
              syncingSheets={syncingSheets}
              syncingGasWebApp={syncingGasWebApp}
              darkMode={darkMode}
              onConnectGoogle={handleConnectGoogleDrive}
              onDisconnectGoogle={handleDisconnectGoogleDrive}
              onCreateSpreadsheet={handleCreateSpreadsheet}
              onConnectExistingSpreadsheet={handleConnectExistingSpreadsheet}
              onPushToSpreadsheet={handlePushToSpreadsheet}
              onPullFromSpreadsheet={handlePullFromSpreadsheet}
              onToggleAutoSyncSpreadsheet={handleToggleAutoSyncSpreadsheet}
              onDisconnectSpreadsheet={handleDisconnectSpreadsheet}
              onListSpreadsheets={handleListUserSpreadsheets}
              onSaveGasWebAppConfig={handleSaveGasWebAppConfig}
              onPullFromGasWebApp={handlePullFromGasWebApp}
              onPushShipmentToGasWebApp={handlePushShipmentToGasWebApp}
              isOnline={isOnline}
              idbStatus={idbStatus}
              offlineSyncQueue={offlineSyncQueue}
              syncingOfflineQueue={syncingOfflineQueue}
              onRefreshIdbStatus={async () => {
                await refreshOfflineTelemetry(db);
              }}
              onForceSaveIdbSnapshot={async () => {
                await saveDatabaseToIndexedDB(db);
                await refreshOfflineTelemetry(db);
                await Swal.fire({
                  toast: true,
                  position: 'bottom-end',
                  icon: 'success',
                  title: 'Snapshot IndexedDB Tersimpan',
                  text: `${db.shipments.length} shipment & seluruh master data tersinkron ke IndexedDB.`,
                  background: darkMode ? '#151B2B' : '#FFFFFF',
                  color: darkMode ? '#F1F5F9' : '#0F172A',
                  showConfirmButton: false,
                  timer: 2600,
                });
              }}
              onReplayOfflineQueue={handleReplayOfflineQueue}
              onClearOfflineQueue={async () => {
                await clearOfflineSyncQueue();
                await refreshOfflineTelemetry(db);
              }}
              onSaveCustomer={async (c: Customer) => {
                await applyDbUpdate(await saveCustomerMaster(session, c));
              }}
              onDeleteCustomer={async (kode: string) => {
                await applyDbUpdate(await deleteCustomerMaster(session, kode));
              }}
              onSaveImportir={async (i: Importir) => {
                await applyDbUpdate(await saveImportirMaster(session, i));
              }}
              onDeleteImportir={async (kode: string) => {
                await applyDbUpdate(await deleteImportirMaster(session, kode));
              }}
              onSaveShipper={async (s: Shipper) => {
                await applyDbUpdate(await saveShipperMaster(session, s));
              }}
              onDeleteShipper={async (nama: string) => {
                await applyDbUpdate(await deleteShipperMaster(session, nama));
              }}
              onSaveUser={async (u: {
                username: string;
                nama: string;
                role: UserRole;
                password?: string;
                aktif: boolean;
                mustChangePassword?: boolean;
                phasePermissions?: PhasePermissions;
                modulePermissions?: ModulePermissionsMap;
              }) => {
                const nextDb = await saveUserRecord(session, u);
                await applyDbUpdate(nextDb);
                if (u.username.toLowerCase() === session.username.toLowerCase()) {
                  const synced = await syncSessionWithDb(session);
                  if (synced) setSession(synced);
                }
              }}
              onSavePengaturan={async (p: Pengaturan) => {
                await applyDbUpdate(await savePengaturanRecord(session, p));
              }}
              onResetDatabase={handleResetDb}
            />
          )}

          {effectiveView === 'setup' && canAccessSetup && (
            <SetupAppView
              pengaturan={db.pengaturan}
              users={db.users}
              logs={db.logs}
              userRole={session.role}
              currentUsername={session.username}
              onSavePengaturan={async (p: Pengaturan) => {
                await applyDbUpdate(await savePengaturanRecord(session, p));
              }}
              onSaveUser={async (u: {
                username: string;
                nama: string;
                role: UserRole;
                password?: string;
                aktif: boolean;
                mustChangePassword?: boolean;
                phasePermissions?: PhasePermissions;
                modulePermissions?: ModulePermissionsMap;
              }) => {
                const nextDb = await saveUserRecord(session, u);
                await applyDbUpdate(nextDb);
                if (u.username.toLowerCase() === session.username.toLowerCase()) {
                  const synced = await syncSessionWithDb(session);
                  if (synced) setSession(synced);
                }
              }}
            />
          )}
          </div>
        </main>
      </div>

      {/* Slide-Over Detail Drawer (39 Kolom) */}
      {detailShipment && (
        <ShipmentDetailDrawer
          shipment={detailShipment}
          containers={db.kontainers.filter((k) => k.kodeOs === detailShipment.kodeOs)}
          comments={db.catatan.filter((c) => c.kodeOs === detailShipment.kodeOs)}
          documents={db.dokumen.filter((d) => d.kodeOs === detailShipment.kodeOs)}
          opsExpenses={(db.pengeluaranOps || []).filter(
            (e) => e.kodeOs.trim().toUpperCase() === detailShipment.kodeOs.trim().toUpperCase()
          )}
          pengaturan={db.pengaturan}
          logs={db.logs.filter((l) => l.kodeOs === detailShipment.kodeOs)}
          checklistItems={db.pengaturan.checklistItems}
          userRole={session.role}
          phasePermissions={session.phasePermissions}
          googleDriveUserEmail={driveUserEmail}
          driveConnecting={driveConnecting}
          onConnectGoogleDrive={handleConnectGoogleDrive}
          onListDriveFiles={handleListDriveFiles}
          onDeleteDocument={handleDeleteDocument}
          onClose={() => setDetailKodeOs(null)}
          onEdit={openEditForm}
          onDelete={handleDeleteShipment}
          onOpenBilling={(kodeOs, tab = 'owner') => {
            setDetailKodeOs(null);
            setBillingModalState({ kodeOs, tab });
          }}
          onOpenKeuanganOps={(kodeOs) => {
            setDetailKodeOs(null);
            if (isViewAllowed('keuangan-ops')) {
              setKeuanganOpsFilterKodeOs(kodeOs);
              setActiveView('keuangan-ops');
            }
          }}
          onAddComment={handleAddComment}
          onUploadDocument={handleUploadDocument}
          onUpdateStatusDokumen={handleUpdateStatusDokumen}
          onUpdateBc11={handleUpdateBc11}
          onUpdateDoPelayaran={handleUpdateDoPelayaran}
        />
      )}

      {/* Modal Info Owner (WA/Email) & Auto Surat Penagihan Customer */}
      {billingModalState && billingModalShipment && (
        <BillingModal
          shipment={billingModalShipment}
          customer={db.customers.find((c) => c.kodeCustomer === billingModalShipment.kodeCustomer)}
          pengaturan={db.pengaturan}
          userRole={session.role}
          initialTab={billingModalState.tab}
          onClose={() => setBillingModalState(null)}
          onNotifyOwner={handleNotifyOwnerBilling}
          onSaveInvoice={handleSaveBillingInvoice}
        />
      )}

      {/* 4-Phase Stepper Form Modal */}
      {formState.open && (
        <ShipmentFormModal
          initialShipment={formState.shipment}
          initialContainers={formState.containers}
          existingDocuments={
            formState.shipment
              ? db.dokumen.filter((d) => d.kodeOs === formState.shipment?.kodeOs)
              : []
          }
          customers={db.customers}
          importirs={db.importirs}
          shippers={db.shippers}
          pengaturan={db.pengaturan}
          userRole={session.role}
          phasePermissions={session.phasePermissions}
          currentUsername={session.nama}
          googleDriveUserEmail={driveUserEmail}
          driveConnecting={driveConnecting}
          onConnectGoogleDrive={handleConnectGoogleDrive}
          onClose={() => setFormState({ open: false, shipment: null, containers: [] })}
          onSubmit={handleSaveShipment}
        />
      )}

      <OfflineIndicator
        isOnline={isOnline}
        pendingSyncCount={offlineSyncQueue.length}
        syncing={syncingOfflineQueue}
        onSyncPending={() => {
          void handleReplayOfflineQueue();
        }}
      />
    </div>
  );
}
