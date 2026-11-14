import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { HardDrive, LogOut as LogOutIcon, Menu, Plus, RefreshCw } from 'lucide-react';
import type {
  AppView,
  Customer,
  DokumenItem,
  Importir,
  KontainerItem,
  Pengaturan,
  PendingUploadFile,
  PhasePermissions,
  SessionUser,
  Shipment,
  Shipper,
  StatusDokumenType,
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
import { canPerformAction, isShipmentOutstanding } from './utils/ppjkLogic';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ShipmentTableView } from './components/ShipmentTableView';
import { ShipmentDetailDrawer } from './components/ShipmentDetailDrawer';
import { ShipmentFormModal } from './components/ShipmentFormModal';
import { MasterSettingsView } from './components/MasterSettingsView';
import { GasDeployView } from './components/GasDeployView';
import { CheckerSummaryView } from './components/CheckerSummaryView';
import { GoogleSignInButton } from './components/GoogleDriveButton';

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: 'Dashboard Ringkasan',
  checker: 'Rekap Checker & Status Dokumen',
  outstanding: 'Dokumen Outstanding',
  shipments: 'Semua Data Shipment',
  master: 'Master Data & Pengaturan',
  gas: 'Kode Google Apps Script (Deploy)',
};

export default function App() {
  const [session, setSession] = useState<SessionUser | null>(() => getStoredSession());
  const [db, setDb] = useState<DatabaseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [tableCheckerFilter, setTableCheckerFilter] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [detailKodeOs, setDetailKodeOs] = useState<string | null>(null);
  const [formState, setFormState] = useState<{
    open: boolean;
    shipment: Shipment | null;
    containers: KontainerItem[];
  }>({ open: false, shipment: null, containers: [] });

  const [driveUserEmail, setDriveUserEmail] = useState<string | null>(null);
  const [driveConnecting, setDriveConnecting] = useState(false);

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
      confirmButtonColor: '#F28C28',
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
      <div className="min-h-screen bg-[#0B2545] flex items-center justify-center text-white text-sm font-medium">
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

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex overflow-x-hidden">
      <Sidebar
        activeView={effectiveView}
        onSelectView={(view) => {
          if (view === 'master' && !canAccessMaster) return;
          if (view === 'gas' && !canViewGas) return;
          if (view !== 'shipments') setTableCheckerFilter('');
          setActiveView(view);
        }}
        user={session}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onLogout={handleLogout}
        outstandingCount={outstandingCount}
      />

      <div
        className={`flex-1 min-w-0 w-full max-w-full flex flex-col transition-all duration-200 ${
          sidebarCollapsed ? 'lg:ml-[76px]' : 'lg:ml-[256px]'
        }`}
      >
        {/* Top Header (#0B2545) */}
        <header className="sticky top-0 z-30 h-16 bg-[#0B2545] text-white px-4 sm:px-6 flex items-center justify-between gap-4 border-b border-white/10 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm sm:text-base font-semibold text-white truncate">
              {VIEW_TITLES[effectiveView]}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {driveUserEmail ? (
              <div className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-medium text-emerald-100">
                <HardDrive className="w-3.5 h-3.5 text-emerald-300" />
                <span className="max-w-[150px] truncate" title={driveUserEmail}>
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
              <div className="hidden md:block">
                <GoogleSignInButton
                  onClick={handleConnectGoogleDrive}
                  disabled={driveConnecting}
                  label={driveConnecting ? 'Menghubungkan...' : 'Sign in with Google'}
                />
              </div>
            )}

            <span
              data-testid="active-role-badge"
              className="hidden md:inline-flex items-center px-2.5 py-1 rounded-md bg-white/12 border border-white/15 text-[11px] font-semibold text-white/90 whitespace-nowrap"
            >
              Peran: {session.role}
            </span>
            <button
              type="button"
              onClick={handleRefreshData}
              aria-label="Refresh data"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {canCreate && (
              <button
                type="button"
                onClick={openCreateForm}
                aria-label="Tambah Shipment"
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
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
              checklistItems={db.pengaturan.checklistItems}
              onOpenDetail={(kodeOs) => setDetailKodeOs(kodeOs)}
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
              onOpenDetail={(kodeOs) => setDetailKodeOs(kodeOs)}
              onEditShipment={openEditForm}
              onOpenCheckerInTable={(checkerName) => {
                setTableCheckerFilter(checkerName);
                setActiveView('shipments');
              }}
            />
          )}

          {(effectiveView === 'shipments' || effectiveView === 'outstanding') && (
            <ShipmentTableView
              mode={effectiveView === 'outstanding' ? 'outstanding' : 'all'}
              shipments={db.shipments}
              statusList={db.pengaturan.statusList}
              jalurList={db.pengaturan.jalurList}
              checklistItems={db.pengaturan.checklistItems}
              userRole={session.role}
              phasePermissions={session.phasePermissions}
              initialCheckerFilter={effectiveView === 'shipments' ? tableCheckerFilter : ''}
              onOpenDetail={(kodeOs) => setDetailKodeOs(kodeOs)}
              onEditShipment={openEditForm}
              onCreateShipment={openCreateForm}
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
          onAddComment={handleAddComment}
          onUploadDocument={handleUploadDocument}
          onUpdateStatusDokumen={handleUpdateStatusDokumen}
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
