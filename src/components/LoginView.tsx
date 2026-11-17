import React, { useState } from 'react';
import { Lock, ShieldCheck, Ship, User } from 'lucide-react';
import type { Pengaturan, SessionUser } from '../types/ppjk';
import { authenticateUser, changeUserPassword } from '../services/gasSimulator';
import { getPpjkIdentity, ROLE_LIMITS_INFO } from '../utils/ppjkLogic';

interface LoginViewProps {
  onLoginSuccess: (session: SessionUser) => void;
  pengaturan?: Pengaturan;
}

const DEMO_ACCOUNTS: Array<{
  label: string;
  roleKey: keyof typeof ROLE_LIMITS_INFO;
  username: string;
  pass: string;
}> = [
  { label: 'Owner', roleKey: 'Owner', username: 'owner', pass: 'Owner123!' },
  { label: 'Admin', roleKey: 'Admin', username: 'admin', pass: 'Admin123!' },
  { label: 'Checker', roleKey: 'Checker', username: 'checker1', pass: 'Checker123!' },
  { label: 'Drafter', roleKey: 'Drafter', username: 'drafter1', pass: 'Drafter123!' },
  { label: 'Operasional', roleKey: 'Operasional', username: 'ops1', pass: 'Ops123!' },
  { label: 'Manajer', roleKey: 'Manajer', username: 'manajer1', pass: 'Manajer123!' },
];

export function LoginView({ onLoginSuccess, pengaturan }: LoginViewProps) {
  const identity = getPpjkIdentity(pengaturan);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [pendingSession, setPendingSession] = useState<SessionUser | null>(null);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [pwError, setPwError] = useState('');

  const selectedDemo = DEMO_ACCOUNTS.find(
    (a) => a.username.toLowerCase() === username.trim().toLowerCase()
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await authenticateUser(username, password);
      if (session.mustChangePassword) {
        setPendingSession(session);
        setOldPass(password);
      } else {
        onLoginSuccess(session);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingSession) return;
    setPwError('');
    try {
      const updated = await changeUserPassword(pendingSession, oldPass, newPass);
      onLoginSuccess(updated);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Gagal mengganti password.');
    }
  }

  if (pendingSession) {
    return (
      <div className="min-h-screen bg-[#0B2545] dark:bg-[#090C15] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/10 p-7 shadow-2xl">
          <div className="flex items-center gap-2.5 text-[#0B2545] dark:text-white mb-2">
            <ShieldCheck className="w-6 h-6 text-[#F28C28] dark:text-violet-400" />
            <h1 className="text-xl font-bold">Wajib Ganti Password Awal</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
            Akun Anda menggunakan password awal. Buat password baru minimal 6 karakter sebelum melanjutkan.
          </p>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="oldPassInput" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password Saat Ini
              </label>
              <input
                id="oldPassInput"
                type="password"
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40"
                required
              />
            </div>
            <div>
              <label htmlFor="newPassInput" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password Baru
              </label>
              <input
                id="newPassInput"
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40"
                required
              />
            </div>
            {pwError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 rounded-lg px-3 py-2">
                {pwError}
              </p>
            )}
            <button
              type="submit"
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white font-semibold text-sm transition-colors cursor-pointer"
            >
              Simpan Password &amp; Lanjutkan
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0B2545] dark:bg-[#090C15] flex items-center justify-center p-4 overflow-hidden">
      {/* Subtle decorative dark ambient glow */}
      <div
        aria-hidden="true"
        className="hidden dark:block pointer-events-none absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-tr from-[#7C3AED]/25 via-[#4F46E5]/10 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="hidden dark:block pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-bl from-emerald-500/10 via-[#6366F1]/10 to-transparent blur-3xl"
      />

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/10 p-7 sm:p-8 shadow-2xl">
        <div className="mb-6 flex items-start gap-3">
          {identity.logoDataUrl ? (
            <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-md shrink-0 overflow-hidden">
              <img
                src={identity.logoDataUrl}
                alt={`Logo ${identity.brandName}`}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#7C3AED] via-[#6366F1] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-violet-600/25 shrink-0">
              <Ship className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <div className="text-[11px] font-bold tracking-wider uppercase text-[#F28C28] dark:text-violet-400">
              {identity.companyName}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2545] dark:text-white mt-0.5">
              {identity.brandName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              {identity.tagline}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="loginUsername" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="loginUsername"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="loginPassword" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="loginPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40"
                required
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 rounded-xl px-3 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] dark:hover:from-[#6D28D9] dark:hover:to-[#4F46E5] disabled:opacity-60 text-white font-semibold text-sm transition-colors cursor-pointer shadow-lg shadow-violet-600/20"
          >
            {loading ? 'Memverifikasi...' : 'Masuk ke Aplikasi'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-white/[0.08]">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2.5">
            Isi cepat akun per peran (SHA-256 + Salt):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const active = acc.username === username.trim().toLowerCase();
              return (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => {
                    setUsername(acc.username);
                    setPassword(acc.pass);
                    setError('');
                  }}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl text-left transition-colors cursor-pointer truncate border ${
                    active
                      ? 'bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white border-[#0B2545] dark:border-transparent'
                      : 'bg-slate-100 dark:bg-[#182032] hover:bg-slate-200 dark:hover:bg-[#1F2940] text-slate-700 dark:text-slate-300 border-transparent dark:border-white/[0.06]'
                  }`}
                >
                  {acc.label}
                </button>
              );
            })}
          </div>
          {selectedDemo && (
            <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.06] text-[11px] space-y-1">
              <div className="font-semibold text-[#0B2545] dark:text-violet-300">
                {ROLE_LIMITS_INFO[selectedDemo.roleKey].title}
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                {ROLE_LIMITS_INFO[selectedDemo.roleKey].summary}
              </div>
              <div className="text-amber-800 dark:text-amber-300">
                <strong>Batasan:</strong> {ROLE_LIMITS_INFO[selectedDemo.roleKey].restrictions}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
