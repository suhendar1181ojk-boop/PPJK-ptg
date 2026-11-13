import React, { useState } from 'react';
import { Lock, ShieldCheck, User } from 'lucide-react';
import type { SessionUser } from '../types/ppjk';
import { authenticateUser, changeUserPassword } from '../services/gasSimulator';
import { ROLE_LIMITS_INFO } from '../utils/ppjkLogic';

interface LoginViewProps {
  onLoginSuccess: (session: SessionUser) => void;
}

const DEMO_ACCOUNTS: Array<{
  label: string;
  roleKey: keyof typeof ROLE_LIMITS_INFO;
  username: string;
  pass: string;
}> = [
  { label: 'Admin', roleKey: 'Admin', username: 'admin', pass: 'Admin123!' },
  { label: 'Checker', roleKey: 'Checker', username: 'checker1', pass: 'Checker123!' },
  { label: 'Drafter', roleKey: 'Drafter', username: 'drafter1', pass: 'Drafter123!' },
  { label: 'Operasional', roleKey: 'Operasional', username: 'ops1', pass: 'Ops123!' },
  { label: 'Manajer', roleKey: 'Manajer', username: 'manajer1', pass: 'Manajer123!' },
];

export function LoginView({ onLoginSuccess }: LoginViewProps) {
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
      <div className="min-h-screen bg-[#0B2545] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-7 shadow-sm">
          <div className="flex items-center gap-2.5 text-[#0B2545] mb-2">
            <ShieldCheck className="w-6 h-6 text-[#F28C28]" />
            <h1 className="text-xl font-bold">Wajib Ganti Password Awal</h1>
          </div>
          <p className="text-sm text-slate-600 mb-5">
            Akun Anda menggunakan password awal. Buat password baru minimal 6 karakter sebelum melanjutkan.
          </p>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="oldPassInput" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password Saat Ini
              </label>
              <input
                id="oldPassInput"
                type="password"
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28]"
                required
              />
            </div>
            <div>
              <label htmlFor="newPassInput" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password Baru
              </label>
              <input
                id="newPassInput"
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28]"
                required
              />
            </div>
            {pwError && (
              <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {pwError}
              </p>
            )}
            <button
              type="submit"
              className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#F28C28] hover:bg-[#D97719] text-white font-semibold text-sm transition-colors cursor-pointer"
            >
              Simpan Password &amp; Lanjutkan
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B2545] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-7 sm:p-8">
        <div className="mb-6">
          <div className="text-xs font-bold tracking-wider uppercase text-[#F28C28]">
            PTG Customs Brokerage
          </div>
          <h1 className="text-2xl font-bold text-[#0B2545] mt-1">
            PTG PPJK Outstanding
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Sistem pencatatan dan pemantauan dokumen shipment impor.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="loginUsername" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="loginUsername"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28]"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="loginPassword" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="loginPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28]"
                required
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#F28C28] hover:bg-[#D97719] disabled:opacity-60 text-white font-semibold text-sm transition-colors cursor-pointer"
          >
            {loading ? 'Memverifikasi...' : 'Masuk ke Aplikasi'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-200">
          <div className="text-xs font-medium text-slate-500 mb-2.5">
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
                  className={`px-3 py-2 text-xs font-semibold rounded-lg text-left transition-colors cursor-pointer truncate border ${
                    active
                      ? 'bg-[#0B2545] text-white border-[#0B2545]'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent'
                  }`}
                >
                  {acc.label}
                </button>
              );
            })}
          </div>
          {selectedDemo && (
            <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1">
              <div className="font-semibold text-[#0B2545]">
                {ROLE_LIMITS_INFO[selectedDemo.roleKey].title}
              </div>
              <div className="text-slate-600">
                {ROLE_LIMITS_INFO[selectedDemo.roleKey].summary}
              </div>
              <div className="text-amber-800">
                <strong>Batasan:</strong> {ROLE_LIMITS_INFO[selectedDemo.roleKey].restrictions}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
