import { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import {
  Bell,
  Building2,
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
  type DatabaseState,
  deleteCustomerMaster,
  deleteImportirMaster,
  deleteShipmentDocument,
  deleteShipmentRecord,
  deleteShipperMaster,
  ensureDbInitialized,
  getStoredSession,
  resetDatabase,
  saveCustomerMaster,
  saveImportirMaster,
  savePengaturanRecord,
  saveShipmentRecord,
  saveShipperMaster,
  saveStoredSession,
  saveUserRecord,
  syncSessionWithDb,
  updateShipmentBc11,
  updateShipmentBilling,
  updateShipmentDoPelayaran,
  updateShipmentStatusDokumen,
} from './services/gasSimulator';
import {
  deleteGoogleDriveFile,
  getGoogleDriveAccessToken,
  googleDriveSignIn,
  googleDriveSignOut,
  initGoogleDriveAuth,
  listGoogleDriveFiles,
  uploadFileToGoogleDrive,
} from './services/googleDriveService';
import {
  canPerformAction,
  computeBillingSummary,
  filterShipments,
  getShipmentProcessSignal,
  isContainerGateOut,
  isShipmentBillingEligible,
  isShipmentOutstanding,
  isUrgentMissingAju,
  normalizeStatusDoPelayaran,
} from './utils/ppjkLogic';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ShipmentTableView } from './components/ShipmentTableView';
import { ShipmentDetailDrawer } from './components/ShipmentDetailDrawer';
import { ShipmentFormModal } from './components/ShipmentFormModal';
import { MasterSettingsView } from './components/MasterSettingsView';
import { GasDeployView } from './components/GasDeployView';
import { CheckerSummaryView } from './components/CheckerSummaryView';
import { DoPelayaranView } from './components/DoPelayaranView';
import { SuratJalanView } from './components/SuratJalanView';
import { PenagihanView } from './components/PenagihanView';
import { BillingModal } from './components/BillingModal';
import { GoogleSignInButton } from './components/GoogleDriveButton';

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: 'Dashboard Ringkasan',
  checker: 'Rekap Checker & Status Dokumen',
  do: 'Kesiapan D/O Pelayaran',
  'surat-jalan': 'Surat Jalan & Tracking Pengiriman',
  penagihan: 'Info Owner (WA/Email) & Surat Penagihan',
  outstanding: 'Dokumen Outstanding',
  shipments: 'Semua Data Shipment',
  master: 'Master Data & Pengaturan',
  gas: 'Kode Google Apps Script (Deploy)',
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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('ptg_theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage failure
    }
  }, [darkMode]);

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

  const handleRefreshData = async () => {
    const refreshed = await ensureDbInitialized();
    setDb({ ...refreshed });
    if (session) {
      const synced = await syncSessionWithDb(session);
      setSession(synced);
    }
  };

  const handleLoginSuccess = async (newSession: SessionUser) => {
    setSession(newSession);
    const loadedDb = await ensureDbInitialized();
    setDb(loadedDb);
    setActiveView('dashboard');
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
      const { user } = await googleDriveSignIn();
      setDriveUserEmail(user.email || user.displayName || 'Google Drive Terhubung');
    } catch (err) {
      await Swal.fire({
        title: 'Koneksi Google Drive',
        text:
          err instanceof Error
            ? err.message
            : 'Gagal terhubung ke Google Drive. Silakan coba lagi.',
        icon: 'error',
      });
    } finally {
      setDriveConnecting(false);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    await googleDriveSignOut();
    setDriveUserEmail(null);
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
    setDb({ ...latestDb });
    await Swal.fire({
      title: 'Tersimpan',
      text:
        pendingUploads.length > 0
          ? driveUploadedCount > 0
            ? `Shipment ${res.saved.kodeOs} disimpan & ${driveUploadedCount} file berhasil diupload ke Google Drive.`
            : driveFallbackError
            ? `Shipment ${res.saved.kodeOs} disimpan (Drive fallback lokal: ${driveFallbackError}).`
            : `Shipment ${res.saved.kodeOs} berhasil disimpan beserta ${pendingUploads.length} file dokumen.`
          : `Shipment ${res.saved.kodeOs} berhasil disimpan.`,
      icon: 'success',
      timer: 2000,
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
    setDb({ ...nextDb });
    setDetailKodeOs(null);
  };

  const handleAddComment = async (kodeOs: string, isi: string) => {
    if (!session) return;
    const nextDb = await addShipmentComment(session, kodeOs, isi);
    setDb({ ...nextDb });
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
    if (nextDb) setDb({ ...nextDb });
  };

  const handleUpdateStatusDokumen = async (
    kodeOs: string,
    nextStatus: StatusDokumenType
  ) => {
    if (!session) return;
    const nextDb = await updateShipmentStatusDokumen(session, kodeOs, nextStatus);
    setDb({ ...nextDb });
  };

  const handleUpdateBc11 = async (
    kodeOs: string,
    bc11Terbit: boolean,
    noBc11?: string,
    tglBc11?: string
  ) => {
    if (!session) return;
    const nextDb = await updateShipmentBc11(session, kodeOs, bc11Terbit, noBc11, tglBc11);
    setDb({ ...nextDb });
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
    setDb({ ...nextDb });
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
    setDb({ ...nextDb });
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
    setDb({ ...nextDb });
  };

  const handleCreateShipmentFromDo = async (
    shipment: Shipment,
    containers: KontainerItem[]
  ): Promise<Shipment | undefined> => {
    if (!session) return undefined;
    const res = await saveShipmentRecord(session, shipment, containers, true);
    setDb({ ...res.db });
    const sjInfo = res.saved.suratJalanNomor
      ? ` & Surat Jalan ${res.saved.suratJalanNomor} terbit`
      : '';
    void Swal.fire({
      title: `Catatan D/O ${res.saved.kodeOs} dibuat (${res.saved.statusDokumen})${sjInfo}`,
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
    setDb({ ...nextDb });
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
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

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

  const canCreate = canPerformAction(session.role, 'create_shipment');
  const canAccessMaster =
    canPerformAction(session.role, 'manage_master') ||
    canPerformAction(session.role, 'manage_users');
  const canViewGas = canPerformAction(session.role, 'view_gas_code');

  const effectiveView: AppView =
    (activeView === 'master' && !canAccessMaster) ||
    (activeView === 'gas' && !canViewGas)
      ? 'dashboard'
      : activeView;

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
        activeView={effectiveView}
        onSelectView={(view) => {
          if (view === 'master' && !canAccessMaster) return;
          if (view === 'gas' && !canViewGas) return;
          if (view !== 'shipments') {
            setTableCheckerFilter('');
            setTableSearchQuery('');
          }
          if (view !== 'checker') {
            setSelectedRecapChecker('');
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
      />

      <div
        className={`flex-1 min-w-0 w-full max-w-full flex flex-col transition-all duration-200 ${
          sidebarCollapsed ? 'lg:ml-[76px]' : 'lg:ml-[256px]'
        }`}
      >
        {/* Top Bar matching dark ERP aesthetic */}
        <header className="sticky top-0 z-30 h-16 bg-[#0B2545] dark:bg-[#0D111C]/95 dark:backdrop-blur-md text-white px-4 sm:px-6 flex items-center justify-between gap-3 border-b border-white/10 dark:border-white/[0.06] no-print">
          {/* Left: Mobile Menu + Workspace Indicator */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 dark:bg-white/[0.06] text-white cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/10 dark:bg-[#151B2B] border border-white/10 dark:border-white/[0.07] min-w-0">
              <Building2 className="w-4 h-4 text-[#F28C28] dark:text-[#A78BFA] shrink-0" />
              <span className="text-xs font-semibold text-white truncate max-w-[145px]">
                {effectiveView === 'dashboard'
                  ? 'PTG PPJK — Tracking'
                  : VIEW_TITLES[effectiveView]}
              </span>
            </div>

            <h1 className="xl:hidden text-xs sm:text-sm font-semibold text-white truncate">
              {effectiveView === 'dashboard' ? 'Dashboard' : VIEW_TITLES[effectiveView]}
            </h1>
          </div>

          {/* Center: Global Search Input (Ctrl + K) */}
          <div ref={searchBoxRef} className="relative hidden md:block flex-1 min-w-[215px] max-w-sm lg:max-w-md mx-1.5">
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
                className="w-full h-9 pl-9 pr-3 xl:pr-16 rounded-xl bg-white/10 dark:bg-[#151B2B] border border-white/15 dark:border-white/[0.08] text-xs text-white placeholder:text-white/50 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 focus:border-[#7C3AED]"
              />
              <kbd className="hidden xl:inline-flex absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-white/10 dark:bg-white/[0.06] border border-white/10 text-[10px] font-mono-code text-white/70 dark:text-slate-400 pointer-events-none">
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

            {driveUserEmail ? (
              <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-medium text-emerald-100">
                <HardDrive className="w-3.5 h-3.5 text-emerald-300" />
                <span className="max-w-[120px] truncate" title={driveUserEmail}>
                  {driveUserEmail}
                </span>
                <button
                  type="button"
                  onClick={handleDisconnectGoogleDrive}
                  title="Putuskan koneksi Google Drive"
                  aria-label="Putuskan koneksi Google Drive"
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
              onClick={handleRefreshData}
              aria-label="Refresh data"
              title="Refresh data"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 dark:bg-[#151B2B] dark:hover:bg-[#1D253B] border border-transparent dark:border-white/[0.07] text-white cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* User Profile Pill matching mockup */}
            <div
              data-testid="active-role-badge"
              className="hidden md:flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl bg-white/10 dark:bg-[#151B2B] border border-white/10 dark:border-white/[0.07]"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                {userInitials || 'U'}
              </div>
              <div className="leading-tight min-w-0">
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
          {effectiveView === 'dashboard' && (
            <DashboardView
              shipments={db.shipments}
              logs={db.logs}
              statusList={db.pengaturan.statusList}
              checklistItems={db.pengaturan.checklistItems}
              userName={session.nama}
              userRole={session.role}
              darkMode={darkMode}
              onOpenDetail={(kodeOs) => setDetailKodeOs(kodeOs)}
              onNavigateView={(v) => setActiveView(v)}
              onOpenChecker={(checkerName) => {
                setSelectedRecapChecker(checkerName);
                setActiveView('checker');
              }}
              onGoToOutstanding={() => setActiveView('outstanding')}
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

          {(effectiveView === 'shipments' || effectiveView === 'outstanding') && (
            <ShipmentTableView
              mode={effectiveView === 'outstanding' ? 'outstanding' : 'all'}
              shipments={db.shipments}
              importirs={db.importirs}
              statusList={db.pengaturan.statusList}
              jalurList={db.pengaturan.jalurList}
              checklistItems={db.pengaturan.checklistItems}
              userRole={session.role}
              phasePermissions={session.phasePermissions}
              initialCheckerFilter={effectiveView === 'shipments' ? tableCheckerFilter : ''}
              initialSearchQuery={effectiveView === 'shipments' ? tableSearchQuery : ''}
              onOpenDetail={(kodeOs) => setDetailKodeOs(kodeOs)}
              onEditShipment={openEditForm}
              onCreateShipment={openCreateForm}
              onUpdateStatusDokumen={handleUpdateStatusDokumen}
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
              onSaveCustomer={async (c: Customer) => {
                setDb({ ...(await saveCustomerMaster(session, c)) });
              }}
              onDeleteCustomer={async (kode: string) => {
                setDb({ ...(await deleteCustomerMaster(session, kode)) });
              }}
              onSaveImportir={async (i: Importir) => {
                setDb({ ...(await saveImportirMaster(session, i)) });
              }}
              onDeleteImportir={async (kode: string) => {
                setDb({ ...(await deleteImportirMaster(session, kode)) });
              }}
              onSaveShipper={async (s: Shipper) => {
                setDb({ ...(await saveShipperMaster(session, s)) });
              }}
              onDeleteShipper={async (nama: string) => {
                setDb({ ...(await deleteShipperMaster(session, nama)) });
              }}
              onSaveUser={async (u: {
                username: string;
                nama: string;
                role: UserRole;
                password?: string;
                aktif: boolean;
                mustChangePassword?: boolean;
                phasePermissions?: PhasePermissions;
              }) => {
                const nextDb = await saveUserRecord(session, u);
                setDb({ ...nextDb });
                if (u.username.toLowerCase() === session.username.toLowerCase()) {
                  const synced = await syncSessionWithDb(session);
                  if (synced) setSession(synced);
                }
              }}
              onSavePengaturan={async (p: Pengaturan) => {
                setDb({ ...(await savePengaturanRecord(session, p)) });
              }}
              onResetDatabase={handleResetDb}
            />
          )}

          {effectiveView === 'gas' && canViewGas && <GasDeployView />}
        </main>
      </div>

      {/* Slide-Over Detail Drawer (39 Kolom) */}
      {detailShipment && (
        <ShipmentDetailDrawer
          shipment={detailShipment}
          containers={db.kontainers.filter((k) => k.kodeOs === detailShipment.kodeOs)}
          comments={db.catatan.filter((c) => c.kodeOs === detailShipment.kodeOs)}
          documents={db.dokumen.filter((d) => d.kodeOs === detailShipment.kodeOs)}
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
    </div>
  );
}
