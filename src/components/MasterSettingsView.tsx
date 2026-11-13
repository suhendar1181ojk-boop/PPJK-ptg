import React, { useState } from 'react';
import { Pencil, Power, RotateCcw, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import type {
  Customer,
  Importir,
  Pengaturan,
  PhasePermissions,
  Shipper,
  UserAccount,
  UserRole,
} from '../types/ppjk';
import {
  arePhasePermissionsEqual,
  canPerformAction,
  getDefaultPhasePermissions,
  PHASE_META,
  resolveUserPhasePermissions,
  ROLE_LIMITS_INFO,
} from '../utils/ppjkLogic';

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
  }) => Promise<void>;
  onSavePengaturan: (p: Pengaturan) => Promise<void>;
  onResetDatabase: (mode: 'empty' | 'seed') => Promise<void>;
}

type MasterTab = 'customer' | 'importir' | 'shipper' | 'users' | 'settings';

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
  onSavePengaturan,
  onResetDatabase,
}: MasterSettingsViewProps) {
  const [tab, setTab] = useState<MasterTab>('customer');
  const isAdmin = canPerformAction(userRole, 'manage_users');

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

  const [driveId, setDriveId] = useState(pengaturan.driveParentFolderId);
  const [emailsText, setEmailsText] = useState(pengaturan.notificationEmails.join(', '));
  const [statusText, setStatusText] = useState(pengaturan.statusList.join(', '));
  const [checklistText, setChecklistText] = useState(pengaturan.checklistItems.join(', '));
  const [feedback, setFeedback] = useState('');

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
    const splitCsv = (s: string) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    await onSavePengaturan({
      ...pengaturan,
      driveParentFolderId: driveId.trim(),
      notificationEmails: splitCsv(emailsText),
      statusList: splitCsv(statusText),
      checklistItems: splitCsv(checklistText),
    });
    notify('Pengaturan sistem diperbarui.');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('customer')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
            tab === 'customer'
              ? 'bg-[#0B2545] text-white border-[#0B2545]'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          Master Customer ({customers.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('importir')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
            tab === 'importir'
              ? 'bg-[#0B2545] text-white border-[#0B2545]'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          Master Importir ({importirs.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('shipper')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
            tab === 'shipper'
              ? 'bg-[#0B2545] text-white border-[#0B2545]'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          Master Shipper ({shippers.length})
        </button>
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setTab('users')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                tab === 'users'
                  ? 'bg-[#0B2545] text-white border-[#0B2545]'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              Manajemen User ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                tab === 'settings'
                  ? 'bg-[#0B2545] text-white border-[#0B2545]'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              Pengaturan Sistem
            </button>
          </>
        )}
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
          {feedback}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        {tab === 'customer' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#0B2545]">Master Customer</h3>
            <form onSubmit={handleCustSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                placeholder="Kode (CUST-005)"
                value={custForm.kodeCustomer}
                onChange={(e) => setCustForm({ ...custForm, kodeCustomer: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
                required
              />
              <input
                type="text"
                placeholder="Nama Customer"
                value={custForm.namaCustomer}
                onChange={(e) => setCustForm({ ...custForm, namaCustomer: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs sm:col-span-2"
                required
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Kontak"
                  value={custForm.kontak}
                  onChange={(e) => setCustForm({ ...custForm, kontak: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#F28C28] text-white text-xs font-semibold cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
            <div className="divide-y divide-slate-100">
              {customers.map((c) => (
                <div key={c.kodeCustomer} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono-code font-semibold text-[#0B2545]">{c.kodeCustomer}</span>{' '}
                    — <span className="font-medium text-slate-900">{c.namaCustomer}</span>{' '}
                    <span className="text-slate-500">({c.kontak || '-'})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteCustomer(c.kodeCustomer)}
                    aria-label={`Hapus customer ${c.kodeCustomer}`}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
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
            <h3 className="text-sm font-semibold text-[#0B2545]">Master Importir</h3>
            <form onSubmit={handleImpSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                placeholder="Kode Importir"
                value={impForm.kodeImportir}
                onChange={(e) => setImpForm({ ...impForm, kodeImportir: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
                required
              />
              <input
                type="text"
                placeholder="Nama Importir"
                value={impForm.namaImportir}
                onChange={(e) => setImpForm({ ...impForm, namaImportir: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#F28C28] text-white text-xs font-semibold cursor-pointer"
              >
                Simpan Importir
              </button>
            </form>
            <div className="divide-y divide-slate-100">
              {importirs.map((i) => (
                <div key={i.kodeImportir} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono-code font-semibold text-[#0B2545]">{i.kodeImportir}</span>{' '}
                    — {i.namaImportir}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteImportir(i.kodeImportir)}
                    aria-label={`Hapus importir ${i.kodeImportir}`}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
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
            <h3 className="text-sm font-semibold text-[#0B2545]">Master Shipper</h3>
            <form onSubmit={handleShipSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                placeholder="Nama Shipper"
                value={shipForm.namaShipper}
                onChange={(e) => setShipForm({ ...shipForm, namaShipper: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
                required
              />
              <input
                type="text"
                placeholder="Negara"
                value={shipForm.negara}
                onChange={(e) => setShipForm({ ...shipForm, negara: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#F28C28] text-white text-xs font-semibold cursor-pointer"
              >
                Simpan Shipper
              </button>
            </form>
            <div className="divide-y divide-slate-100">
              {shippers.map((sh) => (
                <div key={sh.namaShipper} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">{sh.namaShipper}</span>{' '}
                    <span className="text-slate-500">({sh.negara || '-'})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteShipper(sh.namaShipper)}
                    aria-label={`Hapus shipper ${sh.namaShipper}`}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
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
                <h3 className="text-sm font-semibold text-[#0B2545]">
                  Manajemen User &amp; Batasan Hak Akses
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
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
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Batal Edit ({editingUsername})
                </button>
              )}
            </div>

            <form onSubmit={handleUserSubmit} className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                <input
                  type="text"
                  aria-label="Username user"
                  placeholder="Username (mis. drafter2)"
                  disabled={Boolean(editingUsername)}
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100"
                  required
                />
                <input
                  type="text"
                  aria-label="Nama lengkap user"
                  placeholder="Nama Lengkap"
                  value={userForm.nama}
                  onChange={(e) => setUserForm({ ...userForm, nama: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
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
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-medium"
                >
                  <option value="Admin">Admin</option>
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
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  required={!editingUsername}
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] text-white text-xs font-semibold cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{editingUsername ? 'Perbarui User' : 'Tambah User'}</span>
                </button>
              </div>

              {/* Pengaturan Toggle Edit Fase pada Form User */}
              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#0B2545] uppercase tracking-wide">
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
                    className="text-[11px] font-semibold text-slate-600 hover:text-[#0B2545] inline-flex items-center gap-1 cursor-pointer"
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
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-white border-slate-200 text-slate-500'
                        }`}
                      >
                        <span className="truncate">{ph.label}</span>
                        <span className="inline-flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold uppercase">
                            {enabled ? 'Aktif' : 'Tidak'}
                          </span>
                          <span
                            className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                              enabled ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
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

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userForm.aktif}
                    onChange={(e) => setUserForm({ ...userForm, aktif: e.target.checked })}
                    className="rounded border-slate-300"
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
                    className="rounded border-slate-300"
                  />
                  <span>Wajib ganti password saat login pertama</span>
                </label>
              </div>
              {userError && (
                <div role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {userError}
                </div>
              )}
            </form>

            {/* Daftar User + Toggle Manual Fase Edit per User */}
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
              {users.map((u) => {
                const isSelf = u.username.toLowerCase() === currentUsername.toLowerCase();
                const resolvedPerms = resolveUserPhasePermissions(u.role, u.phasePermissions);
                const defaultPerms = getDefaultPhasePermissions(u.role);
                const isCustom = !arePhasePermissionsEqual(resolvedPerms, defaultPerms);
                const lockSelfAdminToggles = isSelf && u.role === 'Admin';

                return (
                  <div
                    key={u.username}
                    data-testid={`user-row-${u.username}`}
                    className="p-4 space-y-3 text-xs bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono-code font-semibold text-[#0B2545]">
                            {u.username}
                          </span>
                          <span className="font-medium text-slate-900">{u.nama}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[#0B2545] font-semibold text-[11px]">
                            {u.role}
                          </span>
                          {isCustom && (
                            <span className="px-1.5 py-0.5 rounded bg-orange-50 text-[#D97719] border border-orange-200 text-[10px] font-semibold">
                              Fase Custom
                            </span>
                          )}
                          {isSelf && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                              Sedang Login
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            u.aktif
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {u.aktif ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEditUser(u)}
                          aria-label={`Edit user ${u.username}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleToggleUserActive(u)}
                            aria-label={`${u.aktif ? 'Nonaktifkan' : 'Aktifkan'} user ${u.username}`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                              u.aktif
                                ? 'bg-red-50 hover:bg-red-100 text-red-700'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{u.aktif ? 'Nonaktifkan' : 'Aktifkan'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Panel Toggle Fase Edit Manual per User */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          Akses Edit Fase Manual:
                        </span>
                        {isCustom && !lockSelfAdminToggles && (
                          <button
                            type="button"
                            onClick={() => handleResetUserPhasesToDefault(u)}
                            aria-label={`Reset fase default ${u.username}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B2545] hover:text-[#F28C28] cursor-pointer"
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
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100/70'
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              <span className="truncate">{ph.label}</span>
                              <span className="inline-flex items-center gap-1 shrink-0">
                                <span
                                  className={`text-[10px] font-bold ${
                                    enabled ? 'text-emerald-700' : 'text-slate-400'
                                  }`}
                                >
                                  {enabled ? 'Aktif' : 'Tidak'}
                                </span>
                                <span
                                  className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                                    enabled
                                      ? 'bg-emerald-600 justify-end'
                                      : 'bg-slate-300 justify-start'
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
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B2545]">
                <ShieldCheck className="w-4 h-4 text-[#F28C28]" />
                <span>Matriks Batasan Pengguna Aplikasi</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(['Admin', 'Checker', 'Drafter', 'Operasional', 'Manajer'] as const).map((roleKey) => {
                  const info = ROLE_LIMITS_INFO[roleKey];
                  return (
                    <div
                      key={roleKey}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5"
                    >
                      <div className="text-xs font-bold text-[#0B2545]">{info.title}</div>
                      <p className="text-[11px] text-slate-700 leading-relaxed">{info.summary}</p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
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
            <h3 className="text-sm font-semibold text-[#0B2545]">Pengaturan Sistem</h3>
            <form onSubmit={handleSettingsSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ID Folder Induk Google Drive
                  </label>
                  <input
                    type="text"
                    value={driveId}
                    onChange={(e) => setDriveId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-code"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Penerima Notifikasi Harian (pisahkan koma)
                  </label>
                  <input
                    type="text"
                    value={emailsText}
                    onChange={(e) => setEmailsText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Daftar Status Shipment (pisahkan koma)
                  </label>
                  <textarea
                    rows={3}
                    value={statusText}
                    onChange={(e) => setStatusText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Item Checklist Dokumen (pisahkan koma)
                  </label>
                  <textarea
                    rows={3}
                    value={checklistText}
                    onChange={(e) => setChecklistText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-[#F28C28] hover:bg-[#D97719] text-white text-xs font-semibold cursor-pointer"
              >
                Simpan Pengaturan
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  Reset Data Simulasi Lokal
                </div>
                <div className="text-[11px] text-slate-500">
                  Mulai dari nol tanpa data contoh atau muat ulang data simulasi PTG.
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onResetDatabase('empty')}
                  className="px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 cursor-pointer"
                >
                  Kosongkan Data (Mulai dari Nol)
                </button>
                <button
                  type="button"
                  onClick={() => onResetDatabase('seed')}
                  className="px-3.5 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-800 cursor-pointer"
                >
                  Muat Data Contoh
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
