import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  FolderPlus,
  HardDrive,
  Lock,
  Mail,
  Pencil,
  Power,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { GasDeployView } from './GasDeployView';
import { SpreadsheetDatabaseView } from './SpreadsheetDatabaseView';
import { OfflineStorageSettingsCard } from './PWAStatusControls';
import type { SpreadsheetDriveEntry } from '../services/googleSheetsService';
import type { IndexedDbStatusSummary } from '../services/indexedDbService';
import type { OfflineSyncTask } from '../utils/offlineDbLogic';
import type {
  Customer,
  DatabaseState,
  Importir,
  ModulePermissionsMap,
  Pengaturan,
  PhasePermissions,
  Shipper,
  UserAccount,
  UserRole,
} from '../types/ppjk';
import {
  arePhasePermissionsEqual,
  canPerformAction,
  DEFAULT_PENGATURAN,
  getDefaultPhasePermissions,
  isOwnerSuperAdmin,
  PHASE_META,
  resolveUserPhasePermissions,
  ROLE_LIMITS_INFO,
} from '../utils/ppjkLogic';
import {
  buildDriveFolderUrl,
  DEFAULT_DRIVE_ROOT_FOLDER_NAME,
  describeRegisteredDriveDestination,
  extractDriveFolderIdFromInput,
  isValidEmailAddress,
  normalizeGmailAddress,
} from '../utils/googleDriveFolderLogic';

interface MasterSettingsViewProps {
  customers: Customer[];
  importirs: Importir[];
  shippers: Shipper[];
  users: UserAccount[];
  pengaturan: Pengaturan;
  userRole: UserRole;
  currentUsername: string;
  onSaveCustomer: (c: Customer) => Promise<void>;
  onDeleteCustomer: (kode: string) => Promise<void>;
  onSaveImportir: (i: Importir) => Promise<void>;
  onDeleteImportir: (kode: string) => Promise<void>;
  onSaveShipper: (s: Shipper) => Promise<void>;
  onDeleteShipper: (nama: string) => Promise<void>;
  onSaveUser: (u: {
    username: string;
    nama: string;
    role: UserRole;
    password?: string;
    aktif: boolean;
    mustChangePassword?: boolean;
    phasePermissions?: PhasePermissions;
    modulePermissions?: ModulePermissionsMap;
  }) => Promise<void>;
  onDeleteUser: (username: string) => Promise<void>;
  onSavePengaturan: (p: Pengaturan) => Promise<void>;
  onPrepareDriveFolder?: (params: {
    folderInput: string;
    ownerGmail: string;
  }) => Promise<{
    folderId: string;
    folderName: string;
    folderUrl: string;
    ownerEmail?: string;
    channel: 'oauth' | 'gas';
    sharedWithGmail?: boolean;
    shareError?: string;
  }>;
  onVerifyDriveFolder?: (folderInput: string) => Promise<{
    folderId: string;
    folderName: string;
    folderUrl: string;
    ownerEmail?: string;
  }>;
  onResetDatabase: (mode: 'empty' | 'seed') => Promise<void>;
  dbSnapshot: DatabaseState;
  initialTab?: MasterTab;
  driveUserEmail: string | null;
  driveConnecting: boolean;
  syncingSheets: boolean;
  syncingGasWebApp: boolean;
  darkMode: boolean;
  onConnectGoogle: () => Promise<void>;
  onDisconnectGoogle: () => Promise<void>;
  onCreateSpreadsheet: (title: string) => Promise<void>;
  onConnectExistingSpreadsheet: (spreadsheetId: string) => Promise<void>;
  onPushToSpreadsheet: (spreadsheetId?: string) => Promise<void>;
  onPullFromSpreadsheet: (spreadsheetId?: string) => Promise<void>;
  onToggleAutoSyncSpreadsheet: (enabled: boolean) => Promise<void>;
  onDisconnectSpreadsheet: () => Promise<void>;
  onListSpreadsheets: () => Promise<SpreadsheetDriveEntry[]>;
  onSaveGasWebAppConfig: (config: {
    gasWebAppUrl: string;
    gasWebAppAutoSync: boolean;
    gasWebAppFullSyncAuto?: boolean;
  }) => Promise<void>;
  onPullFromGasWebApp: (overrideUrl?: string) => Promise<void>;
  onPushShipmentToGasWebApp: (kodeOs?: string, overrideUrl?: string) => Promise<void>;
  onPushFullDatabaseToGasWebApp: (overrideUrl?: string) => Promise<void>;
  onPullFullDatabaseFromGasWebApp: (overrideUrl?: string) => Promise<void>;
  onSyncFullDatabaseCycleWithGasWebApp: (
    source: 'auto' | 'manual',
    overrideUrl?: string
  ) => Promise<void>;
  isOnline: boolean;
  idbStatus: IndexedDbStatusSummary | null;
  offlineSyncQueue: OfflineSyncTask[];
  syncingOfflineQueue: boolean;
  onRefreshIdbStatus: () => Promise<void>;
  onForceSaveIdbSnapshot: () => Promise<void>;
  onReplayOfflineQueue: () => Promise<void>;
  onClearOfflineQueue: () => Promise<void>;
}

export type MasterTab =
  | 'customer'
  | 'importir'
  | 'shipper'
  | 'users'
  | 'settings'
  | 'spreadsheet'
  | 'gas';

export function MasterSettingsView({
  customers,
  importirs,
  shippers,
  users,
  pengaturan,
  userRole,
  currentUsername,
  onSaveCustomer,
  onDeleteCustomer,
  onSaveImportir,
  onDeleteImportir,
  onSaveShipper,
  onDeleteShipper,
  onSaveUser,
  onDeleteUser,
  onSavePengaturan,
  onPrepareDriveFolder,
  onVerifyDriveFolder,
  onResetDatabase,
  dbSnapshot,
  initialTab,
  driveUserEmail,
  driveConnecting,
  syncingSheets,
  syncingGasWebApp,
  darkMode,
  onConnectGoogle,
  onDisconnectGoogle,
  onCreateSpreadsheet,
  onConnectExistingSpreadsheet,
  onPushToSpreadsheet,
  onPullFromSpreadsheet,
  onToggleAutoSyncSpreadsheet,
  onDisconnectSpreadsheet,
  onListSpreadsheets,
  onSaveGasWebAppConfig,
  onPullFromGasWebApp,
  onPushShipmentToGasWebApp,
  onPushFullDatabaseToGasWebApp,
  onPullFullDatabaseFromGasWebApp,
  onSyncFullDatabaseCycleWithGasWebApp,
  isOnline,
  idbStatus,
  offlineSyncQueue,
  syncingOfflineQueue,
  onRefreshIdbStatus,
  onForceSaveIdbSnapshot,
  onReplayOfflineQueue,
  onClearOfflineQueue,
}: MasterSettingsViewProps) {
  const [tab, setTab] = useState<MasterTab>(initialTab || 'customer');
  const isAdmin = canPerformAction(userRole, 'manage_users');
  const isOwner = isOwnerSuperAdmin(userRole);
  const canViewGas = canPerformAction(userRole, 'view_gas_code');

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);

  // Form states
  const [custForm, setCustForm] = useState<Customer>({
    kodeCustomer: '',
    namaCustomer: '',
    kontak: '',
  });
  const [impForm, setImpForm] = useState<Importir>({
    kodeImportir: '',
    namaImportir: '',
  });
  const [shipForm, setShipForm] = useState<Shipper>({
    namaShipper: '',
    negara: '',
  });
  const [userForm, setUserForm] = useState<{
    username: string;
    nama: string;
    role: UserRole;
    password: string;
    aktif: boolean;
    mustChangePassword: boolean;
    phasePermissions: PhasePermissions;
  }>({
    username: '',
    nama: '',
    role: 'Checker',
    password: '',
    aktif: true,
    mustChangePassword: false,
    phasePermissions: getDefaultPhasePermissions('Checker'),
  });
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [userError, setUserError] = useState('');
  const [togglingPhaseKey, setTogglingPhaseKey] = useState<string | null>(null);

  const [driveOwnerGmail, setDriveOwnerGmail] = useState(pengaturan.driveOwnerGmail || '');
  const [driveId, setDriveId] = useState(pengaturan.driveParentFolderId);
  const [driveActionBusy, setDriveActionBusy] = useState(false);
  const [driveActionMsg, setDriveActionMsg] = useState('');
  const [driveActionErr, setDriveActionErr] = useState('');
  const [emailsText, setEmailsText] = useState(pengaturan.notificationEmails.join(', '));
  const [statusText, setStatusText] = useState(pengaturan.statusList.join(', '));
  const [checklistText, setChecklistText] = useState(pengaturan.checklistItems.join(', '));
  const [ownerName, setOwnerName] = useState(
    pengaturan.ownerName || DEFAULT_PENGATURAN.ownerName || ''
  );
  const [ownerWhatsapp, setOwnerWhatsapp] = useState(
    pengaturan.ownerWhatsapp || DEFAULT_PENGATURAN.ownerWhatsapp || ''
  );
  const [ownerEmail, setOwnerEmail] = useState(
    pengaturan.ownerEmail || DEFAULT_PENGATURAN.ownerEmail || ''
  );
  const [adminName, setAdminName] = useState(
    pengaturan.adminName || DEFAULT_PENGATURAN.adminName || ''
  );
  const [adminWhatsapp, setAdminWhatsapp] = useState(
    pengaturan.adminWhatsapp || DEFAULT_PENGATURAN.adminWhatsapp || ''
  );
  const [adminEmail, setAdminEmail] = useState(
    pengaturan.adminEmail || DEFAULT_PENGATURAN.adminEmail || ''
  );
  const [billingBankInfo, setBillingBankInfo] = useState(
    pengaturan.billingBankInfo || DEFAULT_PENGATURAN.billingBankInfo || ''
  );
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setDriveOwnerGmail(pengaturan.driveOwnerGmail || '');
    setDriveId(pengaturan.driveParentFolderId || 'PTG_PPJK_DOKUMEN_ROOT');
  }, [pengaturan.driveOwnerGmail, pengaturan.driveParentFolderId]);

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleCustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.kodeCustomer.trim() || !custForm.namaCustomer.trim()) return;
    await onSaveCustomer(custForm);
    setCustForm({ kodeCustomer: '', namaCustomer: '', kontak: '' });
    notify('Master Customer disimpan.');
  };

  const handleImpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!impForm.kodeImportir.trim() || !impForm.namaImportir.trim()) return;
    await onSaveImportir(impForm);
    setImpForm({ kodeImportir: '', namaImportir: '' });
    notify('Master Importir disimpan.');
  };

  const handleShipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipForm.namaShipper.trim()) return;
    await onSaveShipper(shipForm);
    setShipForm({ namaShipper: '', negara: '' });
    notify('Master Shipper disimpan.');
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    if (!userForm.username.trim() || !userForm.nama.trim()) return;
    try {
      await onSaveUser(userForm);
      const wasEdit = Boolean(editingUsername);
      setEditingUsername(null);
      setUserForm({
        username: '',
        nama: '',
        role: 'Checker',
        password: '',
        aktif: true,
        mustChangePassword: false,
        phasePermissions: getDefaultPhasePermissions('Checker'),
      });
      notify(wasEdit ? 'Data user diperbarui.' : 'User baru berhasil ditambahkan.');
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Gagal menyimpan data user.');
    }
  };

  const handleToggleUserActive = async (u: UserAccount) => {
    setUserError('');
    try {
      await onSaveUser({
        username: u.username,
        nama: u.nama,
        role: u.role,
        aktif: !u.aktif,
        phasePermissions: resolveUserPhasePermissions(u.role, u.phasePermissions),
      });
      notify(`Akun ${u.username} sekarang ${!u.aktif ? 'Aktif' : 'Nonaktif'}.`);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Gagal mengubah status akun.');
    }
  };

  const handleDeleteUserClick = async (u: UserAccount) => {
    setUserError('');
    const result = await Swal.fire({
      title: 'Konfirmasi Hapus User',
      html: `Hapus akun user <strong class="font-mono-code">${u.username}</strong> (${u.nama} · ${u.role}) secara permanen?<br/><span class="text-xs opacity-75">User tidak akan dapat login kembali ke aplikasi.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus User',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#DC2626',
      background: darkMode ? '#131926' : '#ffffff',
      color: darkMode ? '#f1f5f9' : '#0f172a',
    });
    if (!result.isConfirmed) return;

    try {
      await onDeleteUser(u.username);
      if (editingUsername && editingUsername.toLowerCase() === u.username.toLowerCase()) {
        setEditingUsername(null);
        setUserForm({
          username: '',
          nama: '',
          role: 'Checker',
          password: '',
          aktif: true,
          mustChangePassword: false,
          phasePermissions: getDefaultPhasePermissions('Checker'),
        });
      }
      notify(`User ${u.username} berhasil dihapus.`);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Gagal menghapus akun user.');
    }
  };

  const handleToggleUserPhase = async (
    u: UserAccount,
    phaseKey: keyof PhasePermissions,
    phaseLabel: string
  ) => {
    setUserError('');
    const opKey = `${u.username}:${phaseKey}`;
    setTogglingPhaseKey(opKey);
    try {
      const currentPerms = resolveUserPhasePermissions(u.role, u.phasePermissions);
      const nextVal = !currentPerms[phaseKey];
      const nextPerms: PhasePermissions = {
        ...currentPerms,
        [phaseKey]: nextVal,
      };
      await onSaveUser({
        username: u.username,
        nama: u.nama,
        role: u.role,
        aktif: u.aktif,
        phasePermissions: nextPerms,
      });
      if (editingUsername && editingUsername.toLowerCase() === u.username.toLowerCase()) {
        setUserForm((prev) => ({ ...prev, phasePermissions: nextPerms }));
      }
      notify(
        `Edit ${phaseLabel} untuk ${u.username}: ${nextVal ? 'Aktif' : 'Tidak'}.`
      );
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Gagal mengubah akses fase user.');
    } finally {
      setTogglingPhaseKey(null);
    }
  };

  const handleResetUserPhasesToDefault = async (u: UserAccount) => {
    setUserError('');
    const defaults = getDefaultPhasePermissions(u.role);
    try {
      await onSaveUser({
        username: u.username,
        nama: u.nama,
        role: u.role,
        aktif: u.aktif,
        phasePermissions: defaults,
      });
      if (editingUsername && editingUsername.toLowerCase() === u.username.toLowerCase()) {
        setUserForm((prev) => ({ ...prev, phasePermissions: defaults }));
      }
      notify(`Hak fase ${u.username} dikembalikan ke default peran ${u.role}.`);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Gagal mereset akses fase.');
    }
  };

  const startEditUser = (u: UserAccount) => {
    setUserError('');
    const normalizedRole = u.role === 'Dokumen/Checker' ? 'Checker' : u.role;
    setEditingUsername(u.username);
    setUserForm({
      username: u.username,
      nama: u.nama,
      role: normalizedRole,
      password: '',
      aktif: u.aktif,
      mustChangePassword: Boolean(u.mustChangePassword),
      phasePermissions: resolveUserPhasePermissions(u.role, u.phasePermissions),
    });
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDriveActionErr('');
    setDriveActionMsg('');

    const cleanGmail = normalizeGmailAddress(driveOwnerGmail);
    if (cleanGmail && !isValidEmailAddress(cleanGmail)) {
      setDriveActionErr('Format alamat Gmail Google Drive tidak valid (contoh: nama@gmail.com).');
      return;
    }

    const extractedFolderId = extractDriveFolderIdFromInput(driveId);
    const trimmedRawDrive = driveId.trim();
    if (
      trimmedRawDrive &&
      trimmedRawDrive !== 'PTG_PPJK_DOKUMEN_ROOT' &&
      !extractedFolderId
    ) {
      setDriveActionErr(
        'ID atau Link Folder Google Drive tidak dikenali. Masukkan Folder ID atau URL https://drive.google.com/drive/folders/...'
      );
      return;
    }

    const nextFolderId = extractedFolderId || 'PTG_PPJK_DOKUMEN_ROOT';
    const nextFolderUrl = extractedFolderId ? buildDriveFolderUrl(extractedFolderId) : '';
    const nextFolderName = extractedFolderId
      ? pengaturan.driveParentFolderName || DEFAULT_DRIVE_ROOT_FOLDER_NAME
      : DEFAULT_DRIVE_ROOT_FOLDER_NAME;

    const splitCsv = (s: string) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    await onSavePengaturan({
      ...pengaturan,
      driveOwnerGmail: cleanGmail,
      driveParentFolderId: nextFolderId,
      driveParentFolderName: nextFolderName,
      driveParentFolderUrl: nextFolderUrl,
      notificationEmails: splitCsv(emailsText),
      statusList: splitCsv(statusText),
      checklistItems: splitCsv(checklistText),
      ownerName: ownerName.trim(),
      ownerWhatsapp: ownerWhatsapp.trim(),
      ownerEmail: ownerEmail.trim(),
      adminName: adminName.trim(),
      adminWhatsapp: adminWhatsapp.trim(),
      adminEmail: adminEmail.trim(),
      billingBankInfo: billingBankInfo.trim(),
    });
    setDriveId(nextFolderId);
    notify('Pengaturan sistem, folder Google Drive & akun Gmail terdaftar diperbarui.');
  };

  const handlePrepareDriveClick = async () => {
    if (!onPrepareDriveFolder) return;
    setDriveActionErr('');
    setDriveActionMsg('');
    const cleanGmail = normalizeGmailAddress(driveOwnerGmail);
    if (cleanGmail && !isValidEmailAddress(cleanGmail)) {
      setDriveActionErr('Masukkan alamat Gmail yang valid terlebih dahulu (contoh: kantor@gmail.com).');
      return;
    }
    setDriveActionBusy(true);
    try {
      const res = await onPrepareDriveFolder({
        folderInput: driveId,
        ownerGmail: cleanGmail,
      });
      setDriveId(res.folderId);
      if (res.ownerEmail) setDriveOwnerGmail(res.ownerEmail);
      const shareNote = res.sharedWithGmail
        ? ` Folder juga dibagikan (Editor) ke ${cleanGmail}.`
        : res.shareError
        ? ` Catatan sharing: ${res.shareError}`
        : '';
      setDriveActionMsg(
        `Folder "${res.folderName}" (${res.folderId}) siap digunakan${
          res.channel === 'gas' ? ' melalui Endpoint GAS.' : ' di Google Drive.'
        }${shareNote}`
      );
    } catch (err) {
      setDriveActionErr(err instanceof Error ? err.message : 'Gagal menyiapkan folder Google Drive.');
    } finally {
      setDriveActionBusy(false);
    }
  };

  const handleVerifyDriveClick = async () => {
    if (!onVerifyDriveFolder) return;
    setDriveActionErr('');
    setDriveActionMsg('');
    setDriveActionBusy(true);
    try {
      const res = await onVerifyDriveFolder(driveId);
      setDriveId(res.folderId);
      if (!driveOwnerGmail.trim() && res.ownerEmail) {
        setDriveOwnerGmail(res.ownerEmail);
      }
      setDriveActionMsg(
        `Folder terverifikasi: "${res.folderName}" (${res.folderId})${
          res.ownerEmail ? ` · Pemilik: ${res.ownerEmail}` : ''
        }.`
      );
    } catch (err) {
      setDriveActionErr(err instanceof Error ? err.message : 'Folder Drive tidak dapat diverifikasi.');
    } finally {
      setDriveActionBusy(false);
    }
  };

  const tabBtnCls = (active: boolean) =>
    `px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
      active
        ? 'bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white border-[#0B2545] dark:border-transparent'
        : 'bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-[#182032]'
    }`;

  const inputCls =
    'px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:bg-slate-100 dark:disabled:bg-[#111625] focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab('customer')} className={tabBtnCls(tab === 'customer')}>
          Master Customer ({customers.length})
        </button>
        <button type="button" onClick={() => setTab('importir')} className={tabBtnCls(tab === 'importir')}>
          Master Importir ({importirs.length})
        </button>
        <button type="button" onClick={() => setTab('shipper')} className={tabBtnCls(tab === 'shipper')}>
          Master Shipper ({shippers.length})
        </button>
        {isAdmin && (
          <>
            <button type="button" onClick={() => setTab('users')} className={tabBtnCls(tab === 'users')}>
              Manajemen User ({users.length})
            </button>
            <button type="button" onClick={() => setTab('settings')} className={tabBtnCls(tab === 'settings')}>
              Pengaturan Sistem
            </button>
          </>
        )}
        <button
          type="button"
          data-testid="tab-master-spreadsheet"
          onClick={() => setTab('spreadsheet')}
          className={`inline-flex items-center gap-1.5 ${tabBtnCls(tab === 'spreadsheet')}`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
          <span>Database Spreadsheet</span>
        </button>
        {canViewGas && (
          <button
            type="button"
            data-testid="tab-master-gas"
            onClick={() => setTab('gas')}
            className={`inline-flex items-center gap-1.5 ${tabBtnCls(tab === 'gas')}`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Kode GAS (Deploy)</span>
          </button>
        )}
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5">
        {tab === 'customer' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#0B2545] dark:text-white">Master Customer</h3>
            <form onSubmit={handleCustSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                placeholder="Kode (CUST-005)"
                value={custForm.kodeCustomer}
                onChange={(e) => setCustForm({ ...custForm, kodeCustomer: e.target.value })}
                className={inputCls}
                required
              />
              <input
                type="text"
                placeholder="Nama Customer"
                value={custForm.namaCustomer}
                onChange={(e) => setCustForm({ ...custForm, namaCustomer: e.target.value })}
                className={`${inputCls} sm:col-span-2`}
                required
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Kontak"
                  value={custForm.kontak}
                  onChange={(e) => setCustForm({ ...custForm, kontak: e.target.value })}
                  className={`flex-1 ${inputCls}`}
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#F28C28] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {customers.map((c) => (
                <div key={c.kodeCustomer} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono-code font-semibold text-[#0B2545] dark:text-violet-300">{c.kodeCustomer}</span>{' '}
                    — <span className="font-medium text-slate-900 dark:text-white">{c.namaCustomer}</span>{' '}
                    <span className="text-slate-500 dark:text-slate-400">({c.kontak || '-'})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteCustomer(c.kodeCustomer)}
                    aria-label={`Hapus customer ${c.kodeCustomer}`}
                    className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'importir' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#0B2545] dark:text-white">Master Importir</h3>
            <form onSubmit={handleImpSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                placeholder="Kode Importir"
                value={impForm.kodeImportir}
                onChange={(e) => setImpForm({ ...impForm, kodeImportir: e.target.value })}
                className={inputCls}
                required
              />
              <input
                type="text"
                placeholder="Nama Importir"
                value={impForm.namaImportir}
                onChange={(e) => setImpForm({ ...impForm, namaImportir: e.target.value })}
                className={inputCls}
                required
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#F28C28] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold cursor-pointer"
              >
                Simpan Importir
              </button>
            </form>
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {importirs.map((i) => (
                <div key={i.kodeImportir} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono-code font-semibold text-[#0B2545] dark:text-violet-300">{i.kodeImportir}</span>{' '}
                    — <span className="text-slate-900 dark:text-white">{i.namaImportir}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteImportir(i.kodeImportir)}
                    aria-label={`Hapus importir ${i.kodeImportir}`}
                    className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'shipper' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#0B2545] dark:text-white">Master Shipper</h3>
            <form onSubmit={handleShipSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                placeholder="Nama Shipper"
                value={shipForm.namaShipper}
                onChange={(e) => setShipForm({ ...shipForm, namaShipper: e.target.value })}
                className={inputCls}
                required
              />
              <input
                type="text"
                placeholder="Negara"
                value={shipForm.negara}
                onChange={(e) => setShipForm({ ...shipForm, negara: e.target.value })}
                className={inputCls}
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#F28C28] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold cursor-pointer"
              >
                Simpan Shipper
              </button>
            </form>
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {shippers.map((sh) => (
                <div key={sh.namaShipper} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">{sh.namaShipper}</span>{' '}
                    <span className="text-slate-500 dark:text-slate-400">({sh.negara || '-'})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteShipper(sh.namaShipper)}
                    aria-label={`Hapus shipper ${sh.namaShipper}`}
                    className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'users' && isAdmin && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#0B2545] dark:text-white">
                  Manajemen User &amp; Batasan Hak Akses
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Buat akun baru untuk Admin, Checker, Drafter, Operasional, atau Manajer beserta kontrol status aktif.
                </p>
              </div>
              {editingUsername && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingUsername(null);
                    setUserError('');
                    setUserForm({
                      username: '',
                      nama: '',
                      role: 'Checker',
                      password: '',
                      aktif: true,
                      mustChangePassword: false,
                      phasePermissions: getDefaultPhasePermissions('Checker'),
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Batal Edit ({editingUsername})
                </button>
              )}
            </div>

            <form onSubmit={handleUserSubmit} className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                <input
                  type="text"
                  aria-label="Username user"
                  placeholder="Username (mis. drafter2)"
                  disabled={Boolean(editingUsername)}
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className={inputCls}
                  required
                />
                <input
                  type="text"
                  aria-label="Nama lengkap user"
                  placeholder="Nama Lengkap"
                  value={userForm.nama}
                  onChange={(e) => setUserForm({ ...userForm, nama: e.target.value })}
                  className={inputCls}
                  required
                />
                <select
                  aria-label="Peran user"
                  value={userForm.role}
                  onChange={(e) => {
                    const nextRole = e.target.value as UserRole;
                    setUserForm((prev) => ({
                      ...prev,
                      role: nextRole,
                      phasePermissions: editingUsername
                        ? prev.phasePermissions
                        : getDefaultPhasePermissions(nextRole),
                    }));
                  }}
                  className={`${inputCls} font-medium`}
                >
                  <option value="Admin">Admin</option>
                  {isOwner && <option value="Owner">Owner (Super Admin)</option>}
                  <option value="Checker">Checker</option>
                  <option value="Drafter">Drafter</option>
                  <option value="Operasional">Operasional</option>
                  <option value="Manajer">Manajer</option>
                </select>
                <input
                  type="password"
                  aria-label="Password user"
                  placeholder={editingUsername ? 'Password baru (opsional)' : 'Password (min. 6)'}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className={inputCls}
                  required={!editingUsername}
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{editingUsername ? 'Perbarui User' : 'Tambah User'}</span>
                </button>
              </div>

              {/* Pengaturan Toggle Edit Fase pada Form User */}
              <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.08] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#0B2545] dark:text-violet-300 uppercase tracking-wide">
                    Pengaturan Edit Fase (Toggle Aktif / Tidak)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setUserForm((prev) => ({
                        ...prev,
                        phasePermissions: getDefaultPhasePermissions(prev.role),
                      }))
                    }
                    className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-[#0B2545] dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Samakan Default {userForm.role}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {PHASE_META.map((ph) => {
                    const enabled = userForm.phasePermissions[ph.key];
                    return (
                      <button
                        key={ph.key}
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={`Form toggle ${ph.label}`}
                        onClick={() =>
                          setUserForm((prev) => ({
                            ...prev,
                            phasePermissions: {
                              ...prev.phasePermissions,
                              [ph.key]: !prev.phasePermissions[ph.key],
                            },
                          }))
                        }
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          enabled
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                            : 'bg-white dark:bg-[#182032] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <span className="truncate">{ph.label}</span>
                        <span className="inline-flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold uppercase">
                            {enabled ? 'Aktif' : 'Tidak'}
                          </span>
                          <span
                            className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                              enabled ? 'bg-emerald-600 dark:bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userForm.aktif}
                    onChange={(e) => setUserForm({ ...userForm, aktif: e.target.checked })}
                    className="rounded border-slate-300 dark:border-white/20"
                  />
                  <span>Akun Aktif</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userForm.mustChangePassword}
                    onChange={(e) =>
                      setUserForm({ ...userForm, mustChangePassword: e.target.checked })
                    }
                    className="rounded border-slate-300 dark:border-white/20"
                  />
                  <span>Wajib ganti password saat login pertama</span>
                </label>
              </div>
              {userError && (
                <div role="alert" className="text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 rounded-lg px-3 py-2">
                  {userError}
                </div>
              )}
            </form>

            {/* Daftar User + Toggle Manual Fase Edit per User */}
            <div className="divide-y divide-slate-200 dark:divide-white/[0.08] border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden">
              {users.map((u) => {
                const isSelf = u.username.toLowerCase() === currentUsername.toLowerCase();
                const isProtectedOwner = u.role === 'Owner' && !isOwner;
                const resolvedPerms = resolveUserPhasePermissions(u.role, u.phasePermissions);
                const defaultPerms = getDefaultPhasePermissions(u.role);
                const isCustom = !arePhasePermissionsEqual(resolvedPerms, defaultPerms);
                const lockSelfAdminToggles =
                  (isSelf && (u.role === 'Admin' || u.role === 'Owner')) ||
                  u.role === 'Owner' ||
                  isProtectedOwner;

                return (
                  <div
                    key={u.username}
                    data-testid={`user-row-${u.username}`}
                    className="p-4 space-y-3 text-xs bg-white dark:bg-[#131926]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono-code font-semibold text-[#0B2545] dark:text-violet-300">
                            {u.username}
                          </span>
                          <span className="font-medium text-slate-900 dark:text-white">{u.nama}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#182032] text-[#0B2545] dark:text-slate-200 font-semibold text-[11px]">
                            {u.role}
                          </span>
                          {isCustom && (
                            <span className="px-1.5 py-0.5 rounded bg-orange-50 dark:bg-amber-500/15 text-[#D97719] dark:text-amber-300 border border-orange-200 dark:border-amber-500/35 text-[10px] font-semibold">
                              Fase Custom
                            </span>
                          )}
                          {isSelf && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-violet-500/15 text-amber-800 dark:text-violet-300 border border-amber-200 dark:border-violet-500/35 text-[10px] font-semibold">
                              Sedang Login
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            u.aktif
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                              : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30'
                          }`}
                        >
                          {u.aktif ? 'Aktif' : 'Nonaktif'}
                        </span>
                        {!isProtectedOwner && (
                          <button
                            type="button"
                            onClick={() => startEditUser(u)}
                            aria-label={`Edit user ${u.username}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-[#1F2940] text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        )}
                        {!isSelf && u.role !== 'Owner' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleUserActive(u)}
                              aria-label={`${u.aktif ? 'Nonaktifkan' : 'Aktifkan'} user ${u.username}`}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                                u.aktif
                                  ? 'bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300'
                                  : 'bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              <Power className="w-3 h-3" />
                              <span>{u.aktif ? 'Nonaktifkan' : 'Aktifkan'}</span>
                            </button>
                            <button
                              type="button"
                              data-testid={`delete-user-btn-${u.username}`}
                              onClick={() => void handleDeleteUserClick(u)}
                              aria-label={`Hapus user ${u.username}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/15 hover:bg-red-100 dark:hover:bg-red-500/25 border border-red-200/80 dark:border-red-500/30 text-[11px] font-semibold text-red-700 dark:text-red-300 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Hapus</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Panel Toggle Fase Edit Manual per User */}
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#161D2F] border border-slate-200/80 dark:border-white/[0.06] space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Akses Edit Fase Manual:
                        </span>
                        {isCustom && !lockSelfAdminToggles && (
                          <button
                            type="button"
                            onClick={() => handleResetUserPhasesToDefault(u)}
                            aria-label={`Reset fase default ${u.username}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B2545] dark:text-violet-300 hover:text-[#F28C28] dark:hover:text-violet-200 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset Default</span>
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {PHASE_META.map((ph) => {
                          const enabled = resolvedPerms[ph.key];
                          const busy = togglingPhaseKey === `${u.username}:${ph.key}`;
                          return (
                            <button
                              key={ph.key}
                              type="button"
                              role="switch"
                              aria-checked={enabled}
                              aria-label={`Toggle ${ph.label} untuk ${u.username}`}
                              disabled={lockSelfAdminToggles || busy}
                              title={
                                lockSelfAdminToggles
                                  ? 'Admin yang sedang login selalu memiliki seluruh akses fase'
                                  : `Klik untuk ubah ${ph.label} (${enabled ? 'Aktif' : 'Tidak'})`
                              }
                              onClick={() => handleToggleUserPhase(u, ph.key, ph.label)}
                              className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 text-[11px] font-semibold transition-colors ${
                                lockSelfAdminToggles
                                  ? 'opacity-75 cursor-not-allowed'
                                  : 'cursor-pointer'
                              } ${
                                enabled
                                  ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-500/25'
                                  : 'bg-white dark:bg-[#182032] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1F2940]'
                              }`}
                            >
                              <span className="truncate">{ph.label}</span>
                              <span className="inline-flex items-center gap-1 shrink-0">
                                <span
                                  className={`text-[10px] font-bold ${
                                    enabled ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-500'
                                  }`}
                                >
                                  {enabled ? 'Aktif' : 'Tidak'}
                                </span>
                                <span
                                  className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                                    enabled
                                      ? 'bg-emerald-600 dark:bg-emerald-500 justify-end'
                                      : 'bg-slate-300 dark:bg-slate-600 justify-start'
                                  }`}
                                >
                                  <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ringkasan Batasan Peran Aplikasi */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B2545] dark:text-violet-300">
                <ShieldCheck className="w-4 h-4 text-[#F28C28] dark:text-violet-400" />
                <span>Matriks Batasan Pengguna Aplikasi</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(['Owner', 'Admin', 'Checker', 'Drafter', 'Operasional', 'Manajer'] as const).map((roleKey) => {
                  const info = ROLE_LIMITS_INFO[roleKey];
                  return (
                    <div
                      key={roleKey}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.07] bg-slate-50/70 dark:bg-[#161D2F] space-y-1.5"
                    >
                      <div className="text-xs font-bold text-[#0B2545] dark:text-white">{info.title}</div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">{info.summary}</p>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                        <strong>Batasan:</strong> {info.restrictions}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'settings' && isAdmin && (
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-[#0B2545] dark:text-white">Pengaturan Sistem</h3>
            <form onSubmit={handleSettingsSubmit} className="space-y-4">
              {/* Panel Tujuan Google Drive & Akun Gmail Terdaftar */}
              {(() => {
                const driveSummary = describeRegisteredDriveDestination(
                  {
                    ...pengaturan,
                    driveOwnerGmail: driveOwnerGmail || pengaturan.driveOwnerGmail,
                    driveParentFolderId: driveId || pengaturan.driveParentFolderId,
                  },
                  driveUserEmail
                );
                const previewFolderUrl =
                  driveSummary.folderUrl || buildDriveFolderUrl(driveId);

                return (
                  <div
                    data-testid="drive-destination-settings"
                    className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <h4 className="text-xs font-bold text-[#0B2545] dark:text-emerald-300 uppercase tracking-wide">
                            Tujuan Upload Google Drive &amp; Akun Gmail Terdaftar
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          Seluruh file scan shipment dan bukti pengeluaran operasional akan disimpan otomatis ke dalam folder Google Drive akun Gmail di bawah ini (mendukung Login Google OAuth maupun otomatis via Endpoint GAS Web App).
                        </p>
                      </div>
                      {previewFolderUrl && (
                        <a
                          href={previewFolderUrl}
                          target="_blank"
                          rel="noreferrer"
                          data-testid="link-open-drive-folder"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#182032] border border-emerald-300 dark:border-emerald-500/40 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Buka Folder Google Drive</span>
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label
                          htmlFor="settingDriveOwnerGmail"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Akun Gmail Tujuan Google Drive
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              id="settingDriveOwnerGmail"
                              data-testid="input-drive-owner-gmail"
                              type="email"
                              value={driveOwnerGmail}
                              onChange={(e) => setDriveOwnerGmail(e.target.value)}
                              placeholder="contoh: arsip.ppjk@gmail.com"
                              className={`w-full pl-8 ${inputCls}`}
                            />
                          </div>
                          {driveUserEmail && driveUserEmail.includes('@') ? (
                            <button
                              type="button"
                              onClick={() => setDriveOwnerGmail(driveUserEmail)}
                              className="px-2.5 py-2 rounded-lg border border-emerald-300 dark:border-emerald-500/40 bg-white dark:bg-[#182032] hover:bg-emerald-50 dark:hover:bg-emerald-500/15 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap cursor-pointer"
                            >
                              Pakai Akun Login
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={driveConnecting}
                              onClick={() => void onConnectGoogle()}
                              className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap cursor-pointer disabled:opacity-60"
                            >
                              {driveConnecting ? 'Menghubungkan...' : 'Hubungkan Google'}
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {driveUserEmail && driveUserEmail.includes('@')
                            ? `Sesi Google aktif saat ini: ${driveUserEmail}`
                            : 'Bila tidak login Google di browser, file tetap dapat masuk ke Drive pemilik GAS Script atau folder yang dibagikan.'}
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="settingDriveFolderId"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                        >
                          ID atau Link Folder Induk Google Drive
                        </label>
                        <input
                          id="settingDriveFolderId"
                          data-testid="input-drive-folder-id"
                          type="text"
                          value={driveId}
                          onChange={(e) => setDriveId(e.target.value)}
                          placeholder="Tempel Folder ID atau URL https://drive.google.com/drive/folders/..."
                          className={`w-full ${inputCls} font-mono-code`}
                        />
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Kosongkan atau biarkan <code className="font-mono-code">PTG_PPJK_DOKUMEN_ROOT</code> untuk membuat folder <code className="font-mono-code">{DEFAULT_DRIVE_ROOT_FOLDER_NAME}</code> otomatis.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-[#182032] border border-slate-200 dark:border-white/10 font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            Tujuan aktif:{' '}
                            <strong>{driveSummary.registeredGmail || 'Belum diatur'}</strong>
                            {' · '}
                            <span className="font-mono-code">{driveSummary.folderLabel}</span>
                          </span>
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {onPrepareDriveFolder && (
                          <button
                            type="button"
                            data-testid="btn-prepare-drive-folder"
                            disabled={driveActionBusy}
                            onClick={() => void handlePrepareDriveClick()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                          >
                            <FolderPlus className="w-3.5 h-3.5" />
                            <span>{driveActionBusy ? 'Memproses...' : 'Siapkan / Buat Folder Drive'}</span>
                          </button>
                        )}
                        {onVerifyDriveFolder && (
                          <button
                            type="button"
                            data-testid="btn-verify-drive-folder"
                            disabled={driveActionBusy || !extractDriveFolderIdFromInput(driveId)}
                            onClick={() => void handleVerifyDriveClick()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] disabled:opacity-50 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                          >
                            <span>Cek Folder</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {driveActionMsg && (
                      <div className="px-3 py-2 rounded-lg bg-emerald-100/80 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/35 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                        {driveActionMsg}
                      </div>
                    )}
                    {driveActionErr && (
                      <div role="alert" className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 text-xs font-medium text-red-700 dark:text-red-300">
                        {driveActionErr}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Penerima Notifikasi Harian (pisahkan koma)
                  </label>
                  <input
                    type="text"
                    value={emailsText}
                    onChange={(e) => setEmailsText(e.target.value)}
                    className={`w-full ${inputCls}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Daftar Status Shipment (pisahkan koma)
                  </label>
                  <textarea
                    rows={3}
                    value={statusText}
                    onChange={(e) => setStatusText(e.target.value)}
                    className={`w-full ${inputCls}`}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Item Checklist Dokumen (pisahkan koma)
                  </label>
                  <textarea
                    rows={2}
                    value={checklistText}
                    onChange={(e) => setChecklistText(e.target.value)}
                    className={`w-full ${inputCls}`}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-[#0B2545] dark:text-violet-300 uppercase tracking-wide">
                    Kontak Owner, Admin &amp; Rekening Penagihan Customer
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Digunakan sebagai tujuan otomatis pesan WhatsApp / Email Owner saat dokumen berstatus SPPB Terbit atau Gate-Out, serta penandatangan Surat Penagihan Admin.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="settingOwnerName"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Nama Owner Perusahaan
                    </label>
                    <input
                      id="settingOwnerName"
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className={`w-full ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="settingOwnerWhatsapp"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      No. WhatsApp Owner
                    </label>
                    <input
                      id="settingOwnerWhatsapp"
                      type="text"
                      value={ownerWhatsapp}
                      onChange={(e) => setOwnerWhatsapp(e.target.value)}
                      placeholder="081199887766"
                      className={`w-full ${inputCls} font-mono-code`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="settingOwnerEmail"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Email Owner
                    </label>
                    <input
                      id="settingOwnerEmail"
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="owner@ptg-ppjk.co.id"
                      className={`w-full ${inputCls}`}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="settingAdminName"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Nama Admin Penagihan
                    </label>
                    <input
                      id="settingAdminName"
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className={`w-full ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="settingAdminWhatsapp"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      No. WhatsApp Admin
                    </label>
                    <input
                      id="settingAdminWhatsapp"
                      type="text"
                      value={adminWhatsapp}
                      onChange={(e) => setAdminWhatsapp(e.target.value)}
                      className={`w-full ${inputCls} font-mono-code`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="settingAdminEmail"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Email Admin Penagihan
                    </label>
                    <input
                      id="settingAdminEmail"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className={`w-full ${inputCls}`}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="settingBillingBankInfo"
                    className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Info Rekening Transfer Surat Penagihan
                  </label>
                  <input
                    id="settingBillingBankInfo"
                    type="text"
                    value={billingBankInfo}
                    onChange={(e) => setBillingBankInfo(e.target.value)}
                    className={`w-full ${inputCls}`}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold cursor-pointer"
              >
                Simpan Pengaturan
              </button>
            </form>

            <OfflineStorageSettingsCard
              isOnline={isOnline}
              idbStatus={idbStatus}
              syncQueue={offlineSyncQueue}
              syncingQueue={syncingOfflineQueue}
              onRefreshIdbStatus={onRefreshIdbStatus}
              onForceSaveSnapshot={onForceSaveIdbSnapshot}
              onReplayOfflineQueue={onReplayOfflineQueue}
              onClearOfflineQueue={onClearOfflineQueue}
            />

            <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-white">
                  Reset Data Simulasi Lokal
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Mulai dari nol tanpa data contoh atau muat ulang data simulasi PTG.
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onResetDatabase('empty')}
                  className="px-3.5 py-2 rounded-lg border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-500/15 hover:bg-red-100 dark:hover:bg-red-500/25 text-xs font-semibold text-red-700 dark:text-red-300 cursor-pointer"
                >
                  Kosongkan Data (Mulai dari Nol)
                </button>
                <button
                  type="button"
                  onClick={() => onResetDatabase('seed')}
                  className="px-3.5 py-2 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
                >
                  Muat Data Contoh
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'spreadsheet' && (
          <SpreadsheetDatabaseView
            db={dbSnapshot}
            driveUserEmail={driveUserEmail}
            driveConnecting={driveConnecting}
            syncingSheets={syncingSheets}
            syncingGasWebApp={syncingGasWebApp}
            darkMode={darkMode}
            isAdmin={isAdmin}
            onConnectGoogle={onConnectGoogle}
            onDisconnectGoogle={onDisconnectGoogle}
            onCreateSpreadsheet={onCreateSpreadsheet}
            onConnectExistingSpreadsheet={onConnectExistingSpreadsheet}
            onPushToSpreadsheet={onPushToSpreadsheet}
            onPullFromSpreadsheet={onPullFromSpreadsheet}
            onToggleAutoSync={onToggleAutoSyncSpreadsheet}
            onDisconnectSpreadsheet={onDisconnectSpreadsheet}
            onListSpreadsheets={onListSpreadsheets}
            onSaveGasWebAppConfig={onSaveGasWebAppConfig}
            onPullFromGasWebApp={onPullFromGasWebApp}
            onPushShipmentToGasWebApp={onPushShipmentToGasWebApp}
            onPushFullDatabaseToGasWebApp={onPushFullDatabaseToGasWebApp}
            onPullFullDatabaseFromGasWebApp={onPullFullDatabaseFromGasWebApp}
            onSyncFullDatabaseCycleWithGasWebApp={onSyncFullDatabaseCycleWithGasWebApp}
          />
        )}

        {tab === 'gas' && canViewGas && (
          <GasDeployView
            pengaturan={pengaturan}
            onSavePengaturan={onSavePengaturan}
          />
        )}
      </div>
    </div>
  );
}
