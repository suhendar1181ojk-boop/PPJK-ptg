import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  ChevronDown,
  ChevronUp,
  Crown,
  FileImage,
  Globe,
  ImagePlus,
  Lock,
  Mail,
  MapPin,
  Phone,
  Power,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import type {
  AppView,
  LogPerubahan,
  ModulePermissionsMap,
  Pengaturan,
  PhasePermissions,
  RoleModuleAccessMap,
  UserAccount,
  UserRole,
} from '../types/ppjk';
import {
  APP_MODULE_META,
  buildUserMonitoringRows,
  DEFAULT_PENGATURAN,
  getDefaultModuleAccessForRole,
  getDefaultPhasePermissions,
  getPpjkIdentity,
  isOwnerSuperAdmin,
  PHASE_META,
  prepareBrandingImageDataUrl,
  resolveUserPhasePermissions,
} from '../utils/ppjkLogic';
import { CardWindowToggleButton, ModuleCardBatchToggle } from './CardWindowControls';
import { useCardCollapse } from '../contexts/CardCollapseContext';
import { syncBrandingToServerAndHead } from '../services/dynamicBrandingService';
import { derivePwaShortName } from '../utils/appBrandingIcons';

interface SetupAppViewProps {
  pengaturan: Pengaturan;
  users: UserAccount[];
  logs: LogPerubahan[];
  userRole: UserRole;
  currentUsername: string;
  onSavePengaturan: (p: Pengaturan) => Promise<void>;
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
}

type SetupTab = 'identity' | 'control';

const CONTROLLABLE_ROLES: UserRole[] = [
  'Owner',
  'Admin',
  'Checker',
  'Drafter',
  'Operasional',
  'Manajer',
];

export function SetupAppView({
  pengaturan,
  users,
  logs,
  userRole,
  currentUsername,
  onSavePengaturan,
  onSaveUser,
}: SetupAppViewProps) {
  const isOwner = isOwnerSuperAdmin(userRole);
  const [tab, setTab] = useState<SetupTab>(isOwner ? 'control' : 'identity');
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Identity Form State
  const initialId = useMemo(() => getPpjkIdentity(pengaturan), [pengaturan]);
  const [ppjkBrandName, setPpjkBrandName] = useState(initialId.brandName);
  const [ppjkCompanyName, setPpjkCompanyName] = useState(initialId.companyName);
  const [ppjkTagline, setPpjkTagline] = useState(initialId.tagline);
  const [ppjkNpwp, setPpjkNpwp] = useState(initialId.npwp);
  const [ppjkAddress, setPpjkAddress] = useState(initialId.address);
  const [ppjkPhone, setPpjkPhone] = useState(initialId.phone);
  const [ppjkEmail, setPpjkEmail] = useState(initialId.email);
  const [ppjkWebsite, setPpjkWebsite] = useState(initialId.website);
  const [ppjkFooterNote, setPpjkFooterNote] = useState(initialId.footerNote);
  const [ppjkLogoDataUrl, setPpjkLogoDataUrl] = useState(initialId.logoDataUrl);
  const [ppjkLogoFileName, setPpjkLogoFileName] = useState(initialId.logoFileName);
  const [ppjkKopSuratDataUrl, setPpjkKopSuratDataUrl] = useState(initialId.kopSuratDataUrl);
  const [ppjkKopSuratFileName, setPpjkKopSuratFileName] = useState(initialId.kopSuratFileName);
  const [uploadingAsset, setUploadingAsset] = useState<'logo' | 'kop' | null>(null);

  useEffect(() => {
    const id = getPpjkIdentity(pengaturan);
    setPpjkBrandName(id.brandName);
    setPpjkCompanyName(id.companyName);
    setPpjkTagline(id.tagline);
    setPpjkNpwp(id.npwp);
    setPpjkAddress(id.address);
    setPpjkPhone(id.phone);
    setPpjkEmail(id.email);
    setPpjkWebsite(id.website);
    setPpjkFooterNote(id.footerNote);
    setPpjkLogoDataUrl(id.logoDataUrl);
    setPpjkLogoFileName(id.logoFileName);
    setPpjkKopSuratDataUrl(id.kopSuratDataUrl);
    setPpjkKopSuratFileName(id.kopSuratFileName);
  }, [pengaturan]);

  // Monitoring filters
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const notify = (msg: string) => {
    setErrorMsg('');
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3200);
  };

  const notifyErr = (err: unknown, fallback: string) => {
    setFeedback('');
    setErrorMsg(err instanceof Error ? err.message : fallback);
  };

  const monitoringRows = useMemo(
    () => buildUserMonitoringRows(users, logs, pengaturan),
    [users, logs, pengaturan]
  );

  const filteredMonitoringRows = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return monitoringRows.filter((row) => {
      if (roleFilter !== 'ALL' && row.user.role !== roleFilter) return false;
      if (!q) return true;
      return (
        row.user.username.toLowerCase().includes(q) ||
        row.user.nama.toLowerCase().includes(q) ||
        row.user.role.toLowerCase().includes(q)
      );
    });
  }, [monitoringRows, userSearch, roleFilter]);

  const totalActiveUsers = users.filter((u) => u.aktif).length;
  const totalCustomModuleUsers = monitoringRows.filter((r) => r.hasCustomModuleOverrides).length;
  const { isCollapsed } = useCardCollapse();
  const setupModuleCardIds = useMemo(() => {
    const ids = ['setup-role-banner'];
    if (tab === 'identity') {
      ids.push('setup-identity-card', 'setup-logo-card', 'setup-kop-card', 'setup-preview-card');
    } else {
      ids.push(
        'setup-role-matrix-card',
        'setup-user-monitor-card',
        ...filteredMonitoringRows.map((row) => `setup-monitor-user-${row.user.username}`)
      );
    }
    return ids;
  }, [tab, filteredMonitoringRows]);

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ppjkBrandName.trim() || !ppjkCompanyName.trim()) {
      setErrorMsg('Nama Brand PPJK dan Nama Badan Hukum / Perusahaan wajib diisi.');
      return;
    }
    setSavingIdentity(true);
    try {
      const nextBrand = ppjkBrandName.trim();
      const nextCompany = ppjkCompanyName.trim();
      const nextTagline = ppjkTagline.trim();
      const nextLogo = ppjkLogoDataUrl.trim();
      await onSavePengaturan({
        ...pengaturan,
        ppjkBrandName: nextBrand,
        ppjkCompanyName: nextCompany,
        ppjkTagline: nextTagline,
        ppjkNpwp: ppjkNpwp.trim(),
        ppjkAddress: ppjkAddress.trim(),
        ppjkPhone: ppjkPhone.trim(),
        ppjkEmail: ppjkEmail.trim(),
        ppjkWebsite: ppjkWebsite.trim(),
        ppjkFooterNote: ppjkFooterNote.trim(),
        ppjkLogoDataUrl: nextLogo,
        ppjkLogoFileName: ppjkLogoFileName.trim(),
        ppjkKopSuratDataUrl: ppjkKopSuratDataUrl.trim(),
        ppjkKopSuratFileName: ppjkKopSuratFileName.trim(),
      });
      await syncBrandingToServerAndHead({
        logoDataUrl: nextLogo,
        brandName: nextBrand,
        tagline: nextTagline,
        companyName: nextCompany,
        forceServerSync: true,
      });
      notify(
        'Identitas aplikasi, Logo PT (ikon HP, favicon & aplikasi) & Kop Surat PPJK berhasil diperbarui.'
      );
    } catch (err) {
      notifyErr(err, 'Gagal menyimpan identitas PPJK.');
    } finally {
      setSavingIdentity(false);
    }
  };

  const handleBrandingFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    variant: 'logo' | 'kop'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAsset(variant);
    setErrorMsg('');
    try {
      const result = await prepareBrandingImageDataUrl(file, variant);
      if (variant === 'logo') {
        const nextBrand = ppjkBrandName.trim() || DEFAULT_PENGATURAN.ppjkBrandName || 'PTG PPJK';
        const nextCompany =
          ppjkCompanyName.trim() ||
          DEFAULT_PENGATURAN.ppjkCompanyName ||
          'PT PTG Logistik Kepabeanan';
        const nextTagline = ppjkTagline.trim();

        setPpjkLogoDataUrl(result.dataUrl);
        setPpjkLogoFileName(file.name);

        await onSavePengaturan({
          ...pengaturan,
          ppjkBrandName: nextBrand,
          ppjkCompanyName: nextCompany,
          ppjkTagline: nextTagline,
          ppjkNpwp: ppjkNpwp.trim(),
          ppjkAddress: ppjkAddress.trim(),
          ppjkPhone: ppjkPhone.trim(),
          ppjkEmail: ppjkEmail.trim(),
          ppjkWebsite: ppjkWebsite.trim(),
          ppjkFooterNote: ppjkFooterNote.trim(),
          ppjkLogoDataUrl: result.dataUrl,
          ppjkLogoFileName: file.name,
          ppjkKopSuratDataUrl: ppjkKopSuratDataUrl.trim(),
          ppjkKopSuratFileName: ppjkKopSuratFileName.trim(),
        });

        await syncBrandingToServerAndHead({
          logoDataUrl: result.dataUrl,
          brandName: nextBrand,
          tagline: nextTagline,
          companyName: nextCompany,
          forceServerSync: true,
        });

        notify(
          result.note ||
            `Logo PT "${file.name}" langsung diterapkan ke logo aplikasi, favicon browser, dan ikon layar HP.`
        );
      } else {
        setPpjkKopSuratDataUrl(result.dataUrl);
        setPpjkKopSuratFileName(file.name);
        notify(
          result.note ||
            `Kop Surat PPJK "${file.name}" siap. Klik "Simpan Identitas PPJK" untuk menerapkan ke seluruh cetakan PDF/KDI.`
        );
      }
    } catch (err) {
      notifyErr(
        err,
        variant === 'logo'
          ? 'Gagal memproses file Logo PT.'
          : 'Gagal memproses file Kop Surat PPJK.'
      );
    } finally {
      setUploadingAsset(null);
    }
  };

  const handleRemoveLogoPt = async () => {
    setUploadingAsset('logo');
    setErrorMsg('');
    try {
      setPpjkLogoDataUrl('');
      setPpjkLogoFileName('');
      await onSavePengaturan({
        ...pengaturan,
        ppjkLogoDataUrl: '',
        ppjkLogoFileName: '',
      });
      await syncBrandingToServerAndHead({
        logoDataUrl: '',
        brandName: ppjkBrandName.trim(),
        tagline: ppjkTagline.trim(),
        companyName: ppjkCompanyName.trim(),
        forceServerSync: true,
      });
      notify('Logo PT dihapus. Favicon dan ikon layar HP dikembalikan ke standar awal.');
    } catch (err) {
      notifyErr(err, 'Gagal menghapus Logo PT.');
    } finally {
      setUploadingAsset(null);
    }
  };

  const handleResetIdentity = () => {
    setPpjkBrandName(DEFAULT_PENGATURAN.ppjkBrandName || 'PTG PPJK');
    setPpjkCompanyName(DEFAULT_PENGATURAN.ppjkCompanyName || 'PT PTG Logistik Kepabeanan');
    setPpjkTagline(DEFAULT_PENGATURAN.ppjkTagline || 'Customs Brokerage & Import Tracking');
    setPpjkNpwp(DEFAULT_PENGATURAN.ppjkNpwp || '');
    setPpjkAddress(DEFAULT_PENGATURAN.ppjkAddress || '');
    setPpjkPhone(DEFAULT_PENGATURAN.ppjkPhone || '');
    setPpjkEmail(DEFAULT_PENGATURAN.ppjkEmail || '');
    setPpjkWebsite(DEFAULT_PENGATURAN.ppjkWebsite || '');
    setPpjkFooterNote(DEFAULT_PENGATURAN.ppjkFooterNote || '');
    setPpjkLogoDataUrl('');
    setPpjkLogoFileName('');
    setPpjkKopSuratDataUrl('');
    setPpjkKopSuratFileName('');
  };

  const getEffectiveRoleModuleValue = (role: UserRole, moduleId: AppView): boolean => {
    if (role === 'Owner') return true;
    const rolePolicy = pengaturan.roleModuleAccess?.[role];
    if (rolePolicy && typeof rolePolicy[moduleId] === 'boolean') {
      return Boolean(rolePolicy[moduleId]);
    }
    const def = getDefaultModuleAccessForRole(role);
    return def[moduleId] ?? false;
  };

  const handleToggleRoleModule = async (role: UserRole, moduleId: AppView) => {
    if (!isOwner || role === 'Owner') return;
    const key = `role:${role}:${moduleId}`;
    setBusyKey(key);
    try {
      const currentVal = getEffectiveRoleModuleValue(role, moduleId);
      const nextVal = !currentVal;
      const currentMap: RoleModuleAccessMap = { ...(pengaturan.roleModuleAccess || {}) };
      const roleEntry: ModulePermissionsMap = {
        ...getDefaultModuleAccessForRole(role),
        ...(currentMap[role] || {}),
        [moduleId]: nextVal,
      };
      currentMap[role] = roleEntry;
      await onSavePengaturan({
        ...pengaturan,
        roleModuleAccess: currentMap,
      });
      const modMeta = APP_MODULE_META.find((m) => m.id === moduleId);
      notify(
        `Modul "${modMeta?.shortLabel || moduleId}" untuk peran ${role} diubah menjadi ${
          nextVal ? 'Aktif' : 'Nonaktif'
        }.`
      );
    } catch (err) {
      notifyErr(err, 'Gagal mengubah toggle modul peran.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleResetAllRoleModules = async () => {
    if (!isOwner) return;
    setBusyKey('role:reset');
    try {
      await onSavePengaturan({
        ...pengaturan,
        roleModuleAccess: {},
      });
      notify('Seluruh toggle modul per peran dikembalikan ke standar awal.');
    } catch (err) {
      notifyErr(err, 'Gagal mereset toggle modul peran.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleUserActive = async (u: UserAccount) => {
    if (!isOwner || u.role === 'Owner') return;
    const key = `active:${u.username}`;
    setBusyKey(key);
    try {
      await onSaveUser({
        username: u.username,
        nama: u.nama,
        role: u.role,
        aktif: !u.aktif,
        phasePermissions: resolveUserPhasePermissions(u.role, u.phasePermissions),
        modulePermissions: u.modulePermissions,
      });
      notify(`Akun ${u.username} sekarang ${!u.aktif ? 'Aktif' : 'Dinonaktifkan'}.`);
    } catch (err) {
      notifyErr(err, 'Gagal mengubah status aktif user.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleUserModule = async (
    u: UserAccount,
    moduleId: AppView,
    currentResolvedVal: boolean
  ) => {
    if (!isOwner || u.role === 'Owner') return;
    const key = `umod:${u.username}:${moduleId}`;
    setBusyKey(key);
    try {
      const nextVal = !currentResolvedVal;
      const nextOverrides: ModulePermissionsMap = {
        ...(u.modulePermissions || {}),
        [moduleId]: nextVal,
      };
      await onSaveUser({
        username: u.username,
        nama: u.nama,
        role: u.role,
        aktif: u.aktif,
        phasePermissions: resolveUserPhasePermissions(u.role, u.phasePermissions),
        modulePermissions: nextOverrides,
      });
      const modMeta = APP_MODULE_META.find((m) => m.id === moduleId);
      notify(
        `Akses modul "${modMeta?.shortLabel || moduleId}" untuk ${u.username}: ${
          nextVal ? 'Aktif' : 'Nonaktif'
        }.`
      );
    } catch (err) {
      notifyErr(err, 'Gagal mengubah akses modul user.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleClearUserModuleOverrides = async (u: UserAccount) => {
    if (!isOwner || u.role === 'Owner') return;
    const key = `umod-reset:${u.username}`;
    setBusyKey(key);
    try {
      await onSaveUser({
        username: u.username,
        nama: u.nama,
        role: u.role,
        aktif: u.aktif,
        phasePermissions: resolveUserPhasePermissions(u.role, u.phasePermissions),
        modulePermissions: {},
      });
      notify(`Akses modul ${u.username} dikembalikan mengikuti aturan peran ${u.role}.`);
    } catch (err) {
      notifyErr(err, 'Gagal mereset override modul user.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleUserPhase = async (
    u: UserAccount,
    phaseKey: keyof PhasePermissions,
    phaseLabel: string
  ) => {
    if (!isOwner || u.role === 'Owner') return;
    const key = `uphase:${u.username}:${phaseKey}`;
    setBusyKey(key);
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
        modulePermissions: u.modulePermissions,
      });
      notify(`Fase "${phaseLabel}" untuk ${u.username}: ${nextVal ? 'Aktif' : 'Nonaktif'}.`);
    } catch (err) {
      notifyErr(err, 'Gagal mengubah toggle fase user.');
    } finally {
      setBusyKey(null);
    }
  };

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40';

  const tabBtnCls = (active: boolean) =>
    `inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
      active
        ? 'bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white border-[#0B2545] dark:border-transparent shadow-sm'
        : 'bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-[#182032]'
    }`;

  return (
    <div className="space-y-5" data-testid="setup-app-view">
      {/* Top Role Status Banner */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 ${
          isOwner
            ? 'bg-gradient-to-r from-[#0B2545] via-[#13315C] to-[#1D3557] dark:from-[#1B1336] dark:via-[#161B33] dark:to-[#131926] border-amber-400/40 dark:border-violet-500/40 text-white'
            : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/35 text-amber-900 dark:text-amber-200'
        }`}
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isOwner
                ? 'bg-amber-400/20 border border-amber-300/40 text-amber-300'
                : 'bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            {isOwner ? <Crown className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold">
                {isOwner
                  ? 'Mode Super Admin Owner Aktif'
                  : 'Mode Baca — Kontrol Penuh Khusus Owner (Super Admin)'}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase ${
                  isOwner
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/35'
                    : 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30'
                }`}
              >
                {userRole}
              </span>
            </div>
            {!isCollapsed('setup-role-banner') && (
              <p
                className={`text-xs mt-1 ${
                  isOwner ? 'text-white/80' : 'text-amber-800/90 dark:text-amber-200/80'
                }`}
              >
                {isOwner
                  ? 'Anda memiliki kendali penuh untuk mengatur identitas aplikasi PPJK, mengaktifkan/menonaktifkan setiap modul terhadap peran atau user individual, serta memantau aktivitas pengguna.'
                  : 'Hanya akun dengan peran Owner (Super Admin) yang dapat mengubah toggle kontrol modul aplikasi atau memodifikasi batasan pengguna.'}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`px-3 py-1.5 rounded-xl font-semibold tabular-nums ${
              isOwner
                ? 'bg-white/10 text-white border border-white/15'
                : 'bg-white/70 dark:bg-white/10 text-amber-900 dark:text-amber-100'
            }`}
          >
            {totalActiveUsers}/{users.length} User Aktif
          </span>
          <span
            className={`px-3 py-1.5 rounded-xl font-semibold tabular-nums ${
              isOwner
                ? 'bg-white/10 text-white border border-white/15'
                : 'bg-white/70 dark:bg-white/10 text-amber-900 dark:text-amber-100'
            }`}
          >
            {APP_MODULE_META.length} Modul Terkontrol
          </span>
          <CardWindowToggleButton
            cardId="setup-role-banner"
            label="Status Super Admin"
            compact
            className={
              isOwner
                ? '!bg-white/15 !border-white/25 !text-white hover:!bg-white/25'
                : ''
            }
          />
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="setup-tab-control"
            onClick={() => setTab('control')}
            className={tabBtnCls(tab === 'control')}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Kontrol Modul &amp; Pantau User</span>
          </button>
          <button
            type="button"
            data-testid="setup-tab-identity"
            onClick={() => setTab('identity')}
            className={tabBtnCls(tab === 'identity')}
          >
            <Building2 className="w-4 h-4" />
            <span>Setup Identitas PPJK</span>
          </button>
        </div>
        <ModuleCardBatchToggle cardIds={setupModuleCardIds} moduleName="Setup & Kontrol" />
      </div>

      {feedback && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
        >
          {feedback}
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 text-xs font-semibold text-red-700 dark:text-red-300"
        >
          {errorMsg}
        </div>
      )}

      {/* TAB 1: IDENTITAS APLIKASI PPJK */}
      {tab === 'identity' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleSaveIdentity}
            className="xl:col-span-7 bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-[#0B2545] dark:text-white">
                  Identitas Aplikasi &amp; Profil Perusahaan PPJK
                </h3>
                {!isCollapsed('setup-identity-card') && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Nama PPJK, badan hukum, NPWP/izin, dan kontak akan tampil otomatis di Sidebar, Header, Halaman Login, pesan WA/Email, Surat Jalan, dan PDF Penagihan.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResetIdentity}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Default</span>
                </button>
                <CardWindowToggleButton
                  cardId="setup-identity-card"
                  label="Identitas Aplikasi PPJK"
                />
              </div>
            </div>

            {!isCollapsed('setup-identity-card') && (
              <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="ppjkBrandName"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Nama Brand / Aplikasi PPJK *
                </label>
                <input
                  id="ppjkBrandName"
                  type="text"
                  value={ppjkBrandName}
                  onChange={(e) => setPpjkBrandName(e.target.value)}
                  placeholder="Contoh: PTG PPJK / Bintang Samudera PPJK"
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="ppjkCompanyName"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Nama Badan Hukum / PT PPJK *
                </label>
                <input
                  id="ppjkCompanyName"
                  type="text"
                  value={ppjkCompanyName}
                  onChange={(e) => setPpjkCompanyName(e.target.value)}
                  placeholder="Contoh: PT PTG Logistik Kepabeanan"
                  className={inputCls}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="ppjkTagline"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Tagline / Subjudul Sistem
                </label>
                <input
                  id="ppjkTagline"
                  type="text"
                  value={ppjkTagline}
                  onChange={(e) => setPpjkTagline(e.target.value)}
                  placeholder="Customs Brokerage & Import Tracking"
                  className={inputCls}
                />
              </div>

              <div>
                <label
                  htmlFor="ppjkNpwp"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  NPWP / Nomor Izin PPJK
                </label>
                <input
                  id="ppjkNpwp"
                  type="text"
                  value={ppjkNpwp}
                  onChange={(e) => setPpjkNpwp(e.target.value)}
                  placeholder="01.234.567.8-041.000 · PPJK-040200"
                  className={`${inputCls} font-mono-code`}
                />
              </div>

              <div>
                <label
                  htmlFor="ppjkPhone"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Telepon Kantor
                </label>
                <input
                  id="ppjkPhone"
                  type="text"
                  value={ppjkPhone}
                  onChange={(e) => setPpjkPhone(e.target.value)}
                  placeholder="021-4390-8811"
                  className={inputCls}
                />
              </div>

              <div>
                <label
                  htmlFor="ppjkEmail"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Email Resmi PPJK
                </label>
                <input
                  id="ppjkEmail"
                  type="email"
                  value={ppjkEmail}
                  onChange={(e) => setPpjkEmail(e.target.value)}
                  placeholder="operasional@ptg-ppjk.co.id"
                  className={inputCls}
                />
              </div>

              <div>
                <label
                  htmlFor="ppjkWebsite"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Website / Portal
                </label>
                <input
                  id="ppjkWebsite"
                  type="text"
                  value={ppjkWebsite}
                  onChange={(e) => setPpjkWebsite(e.target.value)}
                  placeholder="https://ptg-ppjk.co.id"
                  className={inputCls}
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="ppjkAddress"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Alamat Lengkap Kantor PPJK
                </label>
                <textarea
                  id="ppjkAddress"
                  rows={2}
                  value={ppjkAddress}
                  onChange={(e) => setPpjkAddress(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="ppjkFooterNote"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Catatan Kaki Dokumen &amp; Penagihan
                </label>
                <textarea
                  id="ppjkFooterNote"
                  rows={2}
                  value={ppjkFooterNote}
                  onChange={(e) => setPpjkFooterNote(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Upload Logo PT & Upload Kop Surat PPJK */}
              <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-[#0B2545] dark:text-white flex items-center gap-1.5">
                      <ImagePlus className="w-3.5 h-3.5 text-[#F28C28] dark:text-violet-400" />
                      <span>Upload Logo PT. &amp; Kop Surat PPJK</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Format PNG, JPG, WebP, atau SVG (dikompresi otomatis agar ringan untuk offline &amp; sinkron Google Sheets).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
                  {/* Card 1: Upload Logo PT */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          Logo PT. PPJK (Sekali Upload)
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Otomatis jadi Logo Aplikasi, Favicon Tab, &amp; Ikon Layar HP (Android/iOS)
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ppjkLogoDataUrl && (
                          <button
                            type="button"
                            onClick={() => void handleRemoveLogoPt()}
                            disabled={uploadingAsset === 'logo'}
                            aria-label="Hapus Logo PT"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Hapus</span>
                          </button>
                        )}
                        <CardWindowToggleButton cardId="setup-logo-card" label="Logo PT PPJK" compact />
                      </div>
                    </div>

                    {!isCollapsed('setup-logo-card') && (
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-xl bg-white dark:bg-[#0D111C] border border-dashed border-slate-300 dark:border-white/15 flex items-center justify-center overflow-hidden shrink-0 p-1.5">
                        {ppjkLogoDataUrl ? (
                          <img
                            src={ppjkLogoDataUrl}
                            alt="Preview Logo PT PPJK"
                            data-testid="ppjk-logo-preview"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImagePlus className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <label
                          htmlFor="ppjkLogoUploadInput"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B2545] hover:bg-[#13315C] dark:bg-violet-600 dark:hover:bg-violet-500 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {uploadingAsset === 'logo'
                              ? 'Memproses...'
                              : ppjkLogoDataUrl
                                ? 'Ganti Logo PT.'
                                : 'Upload Logo PT.'}
                          </span>
                        </label>
                        <input
                          id="ppjkLogoUploadInput"
                          data-testid="ppjk-logo-upload-input"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={(e) => handleBrandingFileUpload(e, 'logo')}
                          className="sr-only"
                        />
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {ppjkLogoFileName || (ppjkLogoDataUrl ? 'Logo tersimpan' : 'Belum ada file logo dipilih')}
                        </div>
                      </div>
                    </div>
                    )}
                  </div>

                  {/* Card 2: Upload Kop Surat PPJK */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          Kop Surat PPJK (Banner Resmi)
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Dipakai di cetak KDI, Surat Jalan, Penagihan &amp; Tanda Terima
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ppjkKopSuratDataUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setPpjkKopSuratDataUrl('');
                              setPpjkKopSuratFileName('');
                            }}
                            aria-label="Hapus Kop Surat PPJK"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Hapus</span>
                          </button>
                        )}
                        <CardWindowToggleButton cardId="setup-kop-card" label="Kop Surat PPJK" compact />
                      </div>
                    </div>

                    {!isCollapsed('setup-kop-card') && (
                    <div className="space-y-2">
                      <div className="w-full h-16 rounded-xl bg-white dark:bg-[#0D111C] border border-dashed border-slate-300 dark:border-white/15 flex items-center justify-center overflow-hidden p-1.5">
                        {ppjkKopSuratDataUrl ? (
                          <img
                            src={ppjkKopSuratDataUrl}
                            alt="Preview Kop Surat PPJK"
                            data-testid="ppjk-kop-preview"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                            <FileImage className="w-4 h-4" />
                            <span>Pratinjau Kop Surat A4 (lebar penuh)</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="ppjkKopSuratUploadInput"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F28C28] hover:bg-[#D97719] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-[11px] font-semibold cursor-pointer transition-colors shrink-0"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {uploadingAsset === 'kop'
                              ? 'Memproses...'
                              : ppjkKopSuratDataUrl
                                ? 'Ganti Kop Surat'
                                : 'Upload Kop Surat'}
                          </span>
                        </label>
                        <input
                          id="ppjkKopSuratUploadInput"
                          data-testid="ppjk-kop-upload-input"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={(e) => handleBrandingFileUpload(e, 'kop')}
                          className="sr-only"
                        />
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {ppjkKopSuratFileName || (ppjkKopSuratDataUrl ? 'Kop surat tersimpan' : 'Opsional · Fallback ke Kop otomatis')}
                        </div>
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
              <button
                type="submit"
                disabled={savingIdentity || uploadingAsset !== null}
                data-testid="save-ppjk-identity-btn"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>{savingIdentity ? 'Menyimpan...' : 'Simpan Identitas PPJK'}</span>
              </button>
            </div>
              </>
            )}
          </form>

          {/* Live Kop & Branding Preview */}
          <div className="xl:col-span-5 space-y-4">
            <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pratinjau Langsung Kop &amp; Branding Aplikasi
                </div>
                <CardWindowToggleButton
                  cardId="setup-preview-card"
                  label="Pratinjau Kop & Branding"
                />
              </div>

              {!isCollapsed('setup-preview-card') && (
                <>

              <div className="rounded-2xl bg-[#0B2545] dark:bg-[#0D111C] text-white p-5 border border-white/10 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {ppjkLogoDataUrl && (
                      <div className="w-11 h-11 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                        <img
                          src={ppjkLogoDataUrl}
                          alt="Logo PT"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#F28C28] dark:text-violet-400">
                        {ppjkBrandName || 'PTG PPJK'}
                      </div>
                      <h4 className="text-lg font-bold text-white mt-0.5 truncate">
                        {ppjkCompanyName || 'PT PTG Logistik Kepabeanan'}
                      </h4>
                      <p className="text-xs text-white/75 mt-0.5">
                        {ppjkTagline || 'Customs Brokerage & Import Tracking'}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-[10.5px] font-mono-code text-white/90 shrink-0">
                    AKTIF
                  </span>
                </div>

                <div className="pt-3 border-t border-white/10 space-y-1.5 text-xs text-white/80">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="font-mono-code text-[11px]">{ppjkNpwp || '-'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                    <span>{ppjkAddress || '-'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-sky-300" />
                      <span>{ppjkPhone || '-'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-violet-300" />
                      <span>{ppjkEmail || '-'}</span>
                    </span>
                    {ppjkWebsite && (
                      <span className="inline-flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-emerald-300" />
                        <span>{ppjkWebsite}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Pratinjau Kop Surat Dokumen Cetak (KDI / Surat Jalan / Penagihan) */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pratinjau Kop Surat Cetak (KDI / PDF)
                </div>
                <div className="rounded-xl bg-white text-slate-900 border border-slate-300 p-3 shadow-xs">
                  {ppjkKopSuratDataUrl ? (
                    <div className="space-y-1.5">
                      <img
                        src={ppjkKopSuratDataUrl}
                        alt="Pratinjau Kop Surat PPJK"
                        className="w-full max-h-24 object-contain mx-auto"
                      />
                      <div className="h-[2px] bg-[#0B2545]" />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 pb-1.5 border-b-2 border-[#0B2545]">
                        {ppjkLogoDataUrl ? (
                          <div className="w-9 h-9 rounded border border-slate-200 bg-white p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                            <img
                              src={ppjkLogoDataUrl}
                              alt="Logo Kop"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded bg-[#0B2545] border border-[#F28C28] flex flex-col items-center justify-center shrink-0 text-white">
                            <span className="text-[10px] font-extrabold leading-none">
                              {(ppjkBrandName || 'PTG')
                                .split(/\s+/)
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((w) => w[0]?.toUpperCase() || '')
                                .join('') || 'PPJK'}
                            </span>
                            <span className="text-[6px] font-bold text-[#F28C28]">PPJK</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-extrabold text-[#0B2545] uppercase truncate">
                            {ppjkCompanyName || 'PT PTG Logistik Kepabeanan'}
                          </div>
                          <div className="text-[10px] font-bold text-[#D97719] truncate">
                            {ppjkBrandName || 'PTG PPJK'} · {ppjkTagline || ''}
                          </div>
                          <div className="text-[9px] text-slate-600 truncate">
                            {ppjkAddress} {ppjkPhone ? `| ${ppjkPhone}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="h-[1.5px] bg-[#F28C28]" />
                    </div>
                  )}
                </div>
              </div>

              {/* Pratinjau Ikon Layar HP, Favicon & Logo Aplikasi */}
              <div
                data-testid="branding-targets-preview"
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.06] space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    <Smartphone className="w-3.5 h-3.5 text-[#F28C28] dark:text-violet-400" />
                    <span>Target Logo Otomatis</span>
                  </div>
                  <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {ppjkLogoDataUrl ? 'Logo PT Aktif' : 'Ikon Default'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-xl bg-white dark:bg-[#0D111C] border border-slate-200 dark:border-white/10 flex flex-col items-center text-center gap-1.5">
                    <div className="w-11 h-11 rounded-[12px] bg-white border border-slate-200 shadow-sm p-1 flex items-center justify-center overflow-hidden">
                      <img
                        src={ppjkLogoDataUrl || '/pwa-192x192.png'}
                        alt="Pratinjau Ikon Layar HP"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate w-full">
                      {derivePwaShortName(ppjkBrandName)}
                    </div>
                    <div className="text-[9.5px] text-slate-400">Ikon Layar HP</div>
                  </div>

                  <div className="p-2 rounded-xl bg-white dark:bg-[#0D111C] border border-slate-200 dark:border-white/10 flex flex-col items-center text-center gap-1.5">
                    <div className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-[#182032] border border-slate-200 dark:border-white/10 flex items-center gap-1.5 min-w-0">
                      <img
                        src={ppjkLogoDataUrl || '/pwa-192x192.png'}
                        alt="Pratinjau Favicon Tab"
                        className="w-4 h-4 rounded-xs object-contain shrink-0 bg-white"
                      />
                      <span className="text-[10px] font-medium text-slate-700 dark:text-slate-200 truncate">
                        {ppjkBrandName || 'PTG PPJK'}
                      </span>
                    </div>
                    <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                      Favicon Tab
                    </div>
                    <div className="text-[9.5px] text-slate-400">Browser Tab</div>
                  </div>

                  <div className="p-2 rounded-xl bg-white dark:bg-[#0D111C] border border-slate-200 dark:border-white/10 flex flex-col items-center text-center gap-1.5">
                    <div className="w-11 h-11 rounded-xl bg-[#0B2545] p-1.5 flex items-center justify-center overflow-hidden">
                      <img
                        src={ppjkLogoDataUrl || '/pwa-192x192.png'}
                        alt="Pratinjau Logo Aplikasi"
                        className="w-full h-full object-contain rounded-md bg-white p-0.5"
                      />
                    </div>
                    <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                      Logo Aplikasi
                    </div>
                    <div className="text-[9.5px] text-slate-400">Sidebar &amp; Header</div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.06] text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <div className="font-semibold text-slate-900 dark:text-white">
                  Catatan Kaki Dokumen Resmi:
                </div>
                <p className="leading-relaxed italic">
                  &ldquo;{ppjkFooterNote || '-'}&rdquo;
                </p>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KONTROL MODUL & PEMANTAUAN USER (SUPER ADMIN OWNER) */}
      {tab === 'control' && (
        <div className="space-y-5">
          {/* 1. Matriks Toggle Aktif / Nonaktif Modul per Peran */}
          <section
            aria-label="Matriks kontrol modul aplikasi PPJK per peran"
            className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0B2545] dark:text-white flex items-start sm:items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-[#F28C28] dark:text-violet-400" />
                  <span>Kontrol Toggle Aktif / Tidak Modul Aplikasi PPJK (Per Peran)</span>
                </h3>
                {!isCollapsed('setup-role-matrix-card') && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Owner mengaktifkan atau menonaktifkan akses setiap modul bagi Admin, Checker, Drafter, Operasional, dan Manajer. Akun Owner kebal terhadap pembatasan.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {isOwner && (
                  <button
                    type="button"
                    onClick={handleResetAllRoleModules}
                    disabled={busyKey === 'role:reset'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.06] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Default Semua Peran</span>
                  </button>
                )}
                <CardWindowToggleButton
                  cardId="setup-role-matrix-card"
                  label="Matriks Kontrol Modul Per Peran"
                />
              </div>
            </div>

            {!isCollapsed('setup-role-matrix-card') && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs" data-testid="role-module-matrix-table">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#182032] border-b border-slate-200 dark:border-white/[0.08] text-[11px] text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4 font-semibold min-w-[210px]">Modul Aplikasi PPJK</th>
                    {CONTROLLABLE_ROLES.map((r) => (
                      <th key={r} className="py-3 px-2.5 font-semibold text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {r === 'Owner' && <Crown className="w-3 h-3 text-amber-500" />}
                          <span>{r}</span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {APP_MODULE_META.map((mod) => (
                    <tr
                      key={mod.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{mod.label}</span>
                          {mod.ownerExclusive && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                              Super Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {mod.description}
                        </div>
                      </td>

                      {CONTROLLABLE_ROLES.map((role) => {
                        const enabled = getEffectiveRoleModuleValue(role, mod.id);
                        const locked = role === 'Owner' || !isOwner;
                        const isBusy = busyKey === `role:${role}:${mod.id}`;
                        return (
                          <td key={role} className="py-2.5 px-2.5 text-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={enabled}
                              aria-label={`Toggle modul ${mod.shortLabel} untuk peran ${role}`}
                              data-testid={`role-toggle-${role}-${mod.id}`}
                              disabled={locked || isBusy}
                              onClick={() => handleToggleRoleModule(role, mod.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                                locked ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'
                              } ${
                                enabled
                                  ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-slate-100 dark:bg-[#182032] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              <span
                                className={`w-6 h-3.5 rounded-full p-0.5 flex items-center transition-colors ${
                                  enabled
                                    ? 'bg-emerald-600 dark:bg-emerald-500 justify-end'
                                    : 'bg-slate-300 dark:bg-slate-600 justify-start'
                                }`}
                              >
                                <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
                              </span>
                              <span>{role === 'Owner' ? 'Kebal' : enabled ? 'Aktif' : 'Off'}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </section>

          {/* 2. Pemantauan User & Kontrol Toggle Khusus Per User */}
          <section
            aria-label="Pemantauan user dan batasan modul per pengguna"
            className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#0B2545] dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#F28C28] dark:text-violet-400" />
                  <span>Pemantauan User, Log Aktivitas &amp; Toggle Batasan Per User</span>
                </h3>
                {!isCollapsed('setup-user-monitor-card') && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pantau status akun, jumlah aktivitas perubahan data, serta atur pengecualian toggle modul &amp; fase edit untuk tiap akun pengguna.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold tabular-nums">
                  Aktif: {totalActiveUsers}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold tabular-nums">
                  Custom Modul: {totalCustomModuleUsers}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 font-semibold tabular-nums">
                  Total Log: {logs.length}
                </span>
                <CardWindowToggleButton
                  cardId="setup-user-monitor-card"
                  label="Pemantauan User & Log Aktivitas"
                />
              </div>
            </div>

            {!isCollapsed('setup-user-monitor-card') && (
              <>
            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  aria-label="Cari username atau nama pengguna"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Cari username, nama lengkap, atau peran..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40"
                />
              </div>
              <select
                aria-label="Filter peran user"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">Semua Peran ({users.length})</option>
                {CONTROLLABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Monitoring Cards */}
            <div className="divide-y divide-slate-200 dark:divide-white/[0.08] border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden">
              {filteredMonitoringRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  Tidak ada akun pengguna yang cocok dengan filter pencarian.
                </div>
              ) : (
                filteredMonitoringRows.map((row) => {
                  const u = row.user;
                  const isRowOwner = u.role === 'Owner';
                  const isSelf = u.username.toLowerCase() === currentUsername.toLowerCase();
                  const isExpanded = expandedUser === u.username;

                  return (
                    <div
                      key={u.username}
                      data-testid={`monitor-user-row-${u.username}`}
                      className="p-4 bg-white dark:bg-[#131926] space-y-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono-code font-bold text-[#0B2545] dark:text-violet-300">
                              {u.username}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {u.nama}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                isRowOwner
                                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/35'
                                  : 'bg-slate-100 dark:bg-[#182032] text-[#0B2545] dark:text-slate-200'
                              }`}
                            >
                              {isRowOwner && <Crown className="w-3 h-3" />}
                              <span>{u.role}</span>
                            </span>
                            {row.hasCustomModuleOverrides && (
                              <span className="px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30 text-[10px] font-semibold">
                                Custom Modul
                              </span>
                            )}
                            {isSelf && (
                              <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 text-[10px] font-semibold">
                                Sedang Login
                              </span>
                            )}
                          </div>

                          {!isCollapsed(`setup-monitor-user-${u.username}`) && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <SlidersHorizontal className="w-3 h-3 text-emerald-500" />
                              <span>
                                Modul:{' '}
                                <strong className="text-slate-800 dark:text-slate-200">
                                  {row.enabledModulesCount}/{row.totalModulesCount} Aktif
                                </strong>
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <ShieldAlert className="w-3 h-3 text-indigo-500" />
                              <span>
                                Edit Fase:{' '}
                                <strong className="text-slate-800 dark:text-slate-200">
                                  {row.activePhasesCount}/4
                                </strong>
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Activity className="w-3 h-3 text-amber-500" />
                              <span>
                                Log Aktivitas:{' '}
                                <strong className="text-slate-800 dark:text-slate-200">
                                  {row.activityCount}x
                                </strong>
                                {row.lastActivityAt && (
                                  <>
                                    {' '}
                                    · Terakhir{' '}
                                    {new Date(row.lastActivityAt).toLocaleString('id-ID', {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                    {row.lastKodeOs ? ` (${row.lastKodeOs})` : ''}
                                  </>
                                )}
                              </span>
                            </span>
                          </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${
                              u.aktif
                                ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                                : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30'
                            }`}
                          >
                            {u.aktif ? 'Akun Aktif' : 'Nonaktif'}
                          </span>

                          {isOwner && !isRowOwner && !isSelf && (
                            <button
                              type="button"
                              onClick={() => handleToggleUserActive(u)}
                              disabled={busyKey === `active:${u.username}`}
                              aria-label={`${u.aktif ? 'Nonaktifkan' : 'Aktifkan'} akun ${u.username}`}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                                u.aktif
                                  ? 'bg-red-50 dark:bg-red-500/15 hover:bg-red-100 dark:hover:bg-red-500/25 text-red-700 dark:text-red-300'
                                  : 'bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              <Power className="w-3 h-3" />
                              <span>{u.aktif ? 'Nonaktifkan' : 'Aktifkan'}</span>
                            </button>
                          )}

                          {!isRowOwner && (
                            <button
                              type="button"
                              data-testid={`expand-user-controls-${u.username}`}
                              onClick={() =>
                                setExpandedUser((prev) => (prev === u.username ? null : u.username))
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-[#1F2940] text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              <span>{isExpanded ? 'Tutup Kontrol' : 'Atur Modul & Fase'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <CardWindowToggleButton
                            cardId={`setup-monitor-user-${u.username}`}
                            label={`Kartu User ${u.username}`}
                            compact
                          />
                        </div>
                      </div>

                      {/* Expanded Individual User Controls */}
                      {!isCollapsed(`setup-monitor-user-${u.username}`) && isExpanded && !isRowOwner && (
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200/80 dark:border-white/[0.06] space-y-4">
                          {/* Module Overrides */}
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B2545] dark:text-violet-300">
                                Kontrol Toggle Modul Khusus User ({u.username})
                              </span>
                              {isOwner && row.hasCustomModuleOverrides && (
                                <button
                                  type="button"
                                  onClick={() => handleClearUserModuleOverrides(u)}
                                  disabled={busyKey === `umod-reset:${u.username}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-[#F28C28] dark:hover:text-violet-300 cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Ikuti Default Peran ({u.role})</span>
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
                              {APP_MODULE_META.map((mod) => {
                                const enabled = Boolean(row.resolvedModules[mod.id]);
                                const hasOverride =
                                  u.modulePermissions &&
                                  typeof u.modulePermissions[mod.id] === 'boolean';
                                const isBusy = busyKey === `umod:${u.username}:${mod.id}`;
                                return (
                                  <button
                                    key={mod.id}
                                    type="button"
                                    role="switch"
                                    aria-checked={enabled}
                                    aria-label={`Toggle user ${u.username} modul ${mod.shortLabel}`}
                                    data-testid={`user-module-toggle-${u.username}-${mod.id}`}
                                    disabled={!isOwner || isBusy}
                                    onClick={() => handleToggleUserModule(u, mod.id, enabled)}
                                    className={`min-h-[42px] px-2.5 py-2 rounded-lg border flex items-center justify-between gap-2 text-[11px] font-semibold transition-colors ${
                                      !isOwner ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'
                                    } ${
                                      enabled
                                        ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                                        : 'bg-white dark:bg-[#182032] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    <span className="truncate text-left">
                                      {mod.shortLabel}
                                      {hasOverride && (
                                        <span className="ml-1 text-[9.5px] font-bold text-violet-600 dark:text-violet-300">
                                          *
                                        </span>
                                      )}
                                    </span>
                                    <span className="inline-flex items-center gap-1 shrink-0">
                                      <span className="text-[10px] font-bold uppercase">
                                        {enabled ? 'Aktif' : 'Off'}
                                      </span>
                                      <span
                                        className={`w-6 h-3.5 rounded-full p-0.5 flex items-center transition-colors ${
                                          enabled
                                            ? 'bg-emerald-600 dark:bg-emerald-500 justify-end'
                                            : 'bg-slate-300 dark:bg-slate-600 justify-start'
                                        }`}
                                      >
                                        <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Phase Edit Permissions */}
                          <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-white/[0.06]">
                            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                              Kontrol Hak Edit Fase Shipment (Fase 1–4)
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                              {PHASE_META.map((ph) => {
                                const enabled = row.resolvedPhases[ph.key];
                                const isBusy = busyKey === `uphase:${u.username}:${ph.key}`;
                                return (
                                  <button
                                    key={ph.key}
                                    type="button"
                                    role="switch"
                                    aria-checked={enabled}
                                    aria-label={`Toggle user ${u.username} ${ph.label}`}
                                    disabled={!isOwner || isBusy}
                                    onClick={() => handleToggleUserPhase(u, ph.key, ph.label)}
                                    className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 text-[11px] font-semibold transition-colors ${
                                      !isOwner ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'
                                    } ${
                                      enabled
                                        ? 'bg-sky-50 dark:bg-sky-500/15 border-sky-300 dark:border-sky-500/40 text-sky-900 dark:text-sky-200'
                                        : 'bg-white dark:bg-[#182032] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    <span className="truncate">{ph.label}</span>
                                    <span className="text-[10px] font-bold uppercase shrink-0">
                                      {enabled ? 'Aktif' : 'Off'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
