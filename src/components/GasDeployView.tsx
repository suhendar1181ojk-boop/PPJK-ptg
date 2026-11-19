import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  KeyRound,
  Lock,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import codeGsRaw from '../../gas/Code.gs?raw';
import indexHtmlRaw from '../../gas/Index.html?raw';
import type { Pengaturan } from '../types/ppjk';
import {
  computeGasPinHash,
  validateGasPinFormat,
  verifyGasDeployPin,
} from '../utils/ppjkLogic';
import { CardWindowToggleButton, ModuleCardBatchToggle } from './CardWindowControls';
import { useCardCollapse } from '../contexts/CardCollapseContext';

interface GasDeployViewProps {
  pengaturan: Pengaturan;
  onSavePengaturan: (p: Pengaturan) => Promise<void>;
}

const MAX_PIN_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 30;

export function GasDeployView({ pengaturan, onSavePengaturan }: GasDeployViewProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  const [showChangePin, setShowChangePin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const [activeFile, setActiveFile] = useState<'code' | 'index'>('code');
  const [copied, setCopied] = useState(false);
  const { isCollapsed } = useCardCollapse();
  const gasModuleCardIds = ['gas-unlocked-banner', 'gas-code-card', 'gas-guide-card'] as const;

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = setTimeout(() => {
      setCooldownLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldownLeft]);

  const currentContent = activeFile === 'code' ? codeGsRaw : indexHtmlRaw;
  const currentFilename = activeFile === 'code' ? 'Code.gs' : 'Index.html';
  const hasCustomPin = Boolean(pengaturan.gasDeployPinHash?.trim());

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownLeft > 0) return;
    setPinError('');
    if (!pinInput.trim()) {
      setPinError('Masukkan PIN khusus Kode GAS terlebih dahulu.');
      return;
    }

    setVerifying(true);
    try {
      const ok = await verifyGasDeployPin(pinInput, pengaturan.gasDeployPinHash);
      if (ok) {
        setUnlocked(true);
        setPinInput('');
        setFailedAttempts(0);
        setCooldownLeft(0);
        setPinError('');
      } else {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        if (nextFailed >= MAX_PIN_ATTEMPTS) {
          setCooldownLeft(COOLDOWN_SECONDS);
          setFailedAttempts(0);
          setPinError(
            `PIN salah ${MAX_PIN_ATTEMPTS} kali. Akses dikunci sementara selama ${COOLDOWN_SECONDS} detik.`
          );
        } else {
          setPinError(
            `PIN khusus Kode GAS salah (${nextFailed}/${MAX_PIN_ATTEMPTS} percobaan). Akses ditolak.`
          );
        }
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleLock = () => {
    setUnlocked(false);
    setPinInput('');
    setPinError('');
    setShowChangePin(false);
    setCurrentPin('');
    setNewPin('');
    setConfirmNewPin('');
    setChangePinError('');
    setChangePinSuccess('');
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePinError('');
    setChangePinSuccess('');

    const currentValid = await verifyGasDeployPin(
      currentPin,
      pengaturan.gasDeployPinHash
    );
    if (!currentValid) {
      setChangePinError('PIN saat ini tidak sesuai.');
      return;
    }

    const fmt = validateGasPinFormat(newPin);
    if (!fmt.valid) {
      setChangePinError(fmt.error || 'Format PIN baru tidak valid.');
      return;
    }

    if (newPin.trim() !== confirmNewPin.trim()) {
      setChangePinError('Konfirmasi PIN baru tidak cocok.');
      return;
    }

    setSavingPin(true);
    try {
      const nextHash = await computeGasPinHash(newPin.trim());
      await onSavePengaturan({
        ...pengaturan,
        gasDeployPinHash: nextHash,
      });
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
      setShowChangePin(false);
      setChangePinSuccess('PIN khusus Kode GAS berhasil diperbarui dan aktif.');
      setTimeout(() => setChangePinSuccess(''), 4000);
    } catch (err) {
      setChangePinError(
        err instanceof Error ? err.message : 'Gagal menyimpan PIN baru.'
      );
    } finally {
      setSavingPin(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!unlocked) {
    return (
      <div
        data-testid="gas-pin-lock-panel"
        className="py-6 sm:py-10 flex items-center justify-center"
      >
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#161D2F] p-6 sm:p-7 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#0B2545] dark:bg-gradient-to-br dark:from-[#7C3AED] dark:to-[#6366F1] text-white flex items-center justify-center shrink-0 shadow-md">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#F28C28] dark:text-violet-400">
                  Akses Terbatas Khusus Admin
                </div>
                <h3 className="text-base font-bold text-[#0B2545] dark:text-white mt-0.5">
                  PIN Khusus Kode GAS (Deploy)
                </h3>
                {!isCollapsed('gas-pin-lock-card') && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    Kode Google Apps Script (<span className="font-mono-code">Code.gs</span> &amp;{' '}
                    <span className="font-mono-code">Index.html</span>) dikunci agar tidak dapat dibuka sembarangan. Masukkan PIN khusus untuk membuka akses.
                  </p>
                )}
              </div>
            </div>
            <CardWindowToggleButton cardId="gas-pin-lock-card" label="PIN Khusus Kode GAS" compact />
          </div>

          {!isCollapsed('gas-pin-lock-card') && (
            <>
          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="gasPinInput"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Masukkan PIN Khusus Kode GAS
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="gasPinInput"
                  data-testid="gas-pin-input"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="off"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (pinError) setPinError('');
                  }}
                  placeholder="6–12 karakter PIN khusus"
                  disabled={cooldownLeft > 0 || verifying}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-sm font-mono-code tracking-widest text-slate-900 dark:text-slate-100 placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {pinError && (
              <div
                role="alert"
                data-testid="gas-pin-error"
                className="text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 rounded-xl px-3 py-2.5"
              >
                {pinError}
                {cooldownLeft > 0 && (
                  <span className="block font-mono-code font-bold mt-1">
                    Tunggu {cooldownLeft} detik...
                  </span>
                )}
              </div>
            )}

            <button
              type="submit"
              data-testid="gas-pin-submit-btn"
              disabled={cooldownLeft > 0 || verifying}
              className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer shadow-sm"
            >
              <Unlock className="w-4 h-4" />
              <span>
                {cooldownLeft > 0
                  ? `Terkunci (${cooldownLeft}d)`
                  : verifying
                    ? 'Memverifikasi PIN...'
                    : 'Buka Kode GAS (Deploy)'}
              </span>
            </button>
          </form>

          <div className="pt-3 border-t border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Verifikasi SHA-256 · Terkunci otomatis saat keluar tab</span>
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {hasCustomPin ? 'PIN Kustom' : 'PIN Standar'}
            </span>
          </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="gas-deploy-unlocked-panel">
      <div className="flex items-center justify-end">
        <ModuleCardBatchToggle cardIds={gasModuleCardIds} moduleName="Kode GAS" />
      </div>

      {/* Security Control Header */}
      <div
        data-testid="gas-unlocked-banner"
        className="rounded-xl border border-emerald-200 dark:border-emerald-500/35 bg-emerald-50/80 dark:bg-emerald-500/10 p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 dark:bg-emerald-500/20 text-white dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Unlock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Akses Kode GAS (Deploy) Terbuka
              </div>
              {!isCollapsed('gas-unlocked-banner') && (
                <div className="text-[11px] text-emerald-800/85 dark:text-emerald-300/80">
                  Status keamanan: {hasCustomPin ? 'Menggunakan PIN Khusus Kustom' : 'Menggunakan PIN Standar Awal'} · Klik Kunci Kembali setelah selesai.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="toggle-change-gas-pin-btn"
              onClick={() => {
                setShowChangePin((v) => !v);
                setChangePinError('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-500/40 bg-white dark:bg-[#131926] hover:bg-emerald-50 dark:hover:bg-[#182032] text-xs font-semibold text-emerald-800 dark:text-emerald-200 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{showChangePin ? 'Tutup Ubah PIN' : 'Ubah PIN Khusus'}</span>
            </button>
            <button
              type="button"
              data-testid="lock-gas-btn"
              onClick={handleLock}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B2545] dark:bg-slate-800 hover:opacity-90 text-xs font-semibold text-white cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Kunci Kembali</span>
            </button>
            <CardWindowToggleButton cardId="gas-unlocked-banner" label="Kontrol Keamanan GAS" compact />
          </div>
        </div>

        {!isCollapsed('gas-unlocked-banner') && (
          <>
        {changePinSuccess && (
          <div
            data-testid="gas-pin-change-success"
            className="px-3 py-2 rounded-lg bg-white dark:bg-[#131926] border border-emerald-300 dark:border-emerald-500/40 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
          >
            {changePinSuccess}
          </div>
        )}

        {showChangePin && (
          <form
            onSubmit={handleChangePinSubmit}
            data-testid="gas-change-pin-form"
            className="pt-3 border-t border-emerald-200 dark:border-emerald-500/25 grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end"
          >
            <div>
              <label
                htmlFor="gasCurrentPinInput"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                PIN Saat Ini
              </label>
              <input
                id="gasCurrentPinInput"
                type="password"
                autoComplete="off"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="PIN lama"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs font-mono-code text-slate-900 dark:text-slate-100"
                required
              />
            </div>
            <div>
              <label
                htmlFor="gasNewPinInput"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                PIN Baru (6–12 karakter)
              </label>
              <input
                id="gasNewPinInput"
                type="password"
                autoComplete="off"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Huruf / angka"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs font-mono-code text-slate-900 dark:text-slate-100"
                required
              />
            </div>
            <div>
              <label
                htmlFor="gasConfirmPinInput"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Konfirmasi PIN Baru
              </label>
              <input
                id="gasConfirmPinInput"
                type="password"
                autoComplete="off"
                value={confirmNewPin}
                onChange={(e) => setConfirmNewPin(e.target.value)}
                placeholder="Ulangi PIN baru"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs font-mono-code text-slate-900 dark:text-slate-100"
                required
              />
            </div>
            <button
              type="submit"
              disabled={savingPin}
              className="px-4 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold cursor-pointer"
            >
              {savingPin ? 'Menyimpan...' : 'Simpan PIN Baru'}
            </button>

            {changePinError && (
              <div
                role="alert"
                className="sm:col-span-4 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 rounded-lg px-3 py-2"
              >
                {changePinError}
              </div>
            )}
          </form>
        )}
          </>
        )}
      </div>

      <div className="bg-slate-50/60 dark:bg-[#161D2F] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#0B2545] dark:text-white">
              Kode Google Apps Script Siap Deploy (2 File)
            </h2>
            {!isCollapsed('gas-code-card') && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Salin atau unduh langsung <span className="font-mono-code font-semibold text-slate-900 dark:text-violet-300">Code.gs</span> dan{' '}
                <span className="font-mono-code font-semibold text-slate-900 dark:text-violet-300">Index.html</span> ke project Google Apps Script Anda.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownload('Code.gs', codeGsRaw)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#0B2545] dark:text-violet-400" />
              <span>Unduh Code.gs</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownload('Index.html', indexHtmlRaw)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#F28C28] dark:text-emerald-400" />
              <span>Unduh Index.html</span>
            </button>
            <CardWindowToggleButton cardId="gas-code-card" label="Kode Google Apps Script" />
          </div>
        </div>

        {!isCollapsed('gas-code-card') && (
          <>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/[0.08] pb-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveFile('code')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                activeFile === 'code'
                  ? 'bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white'
                  : 'bg-white dark:bg-[#182032] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1F2940]'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Code.gs</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFile('index')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                activeFile === 'index'
                  ? 'bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white'
                  : 'bg-white dark:bg-[#182032] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1F2940]'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Index.html</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? `Tersalin (${currentFilename})` : `Salin ${currentFilename}`}</span>
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-[#0B2545] dark:bg-[#090C15] border border-transparent dark:border-white/[0.08] text-slate-100 text-xs font-mono-code overflow-x-auto max-h-[460px] leading-relaxed">
          <code>{currentContent}</code>
        </pre>
          </>
        )}
      </div>

      {/* Panduan Deploy GAS */}
      <div className="bg-slate-50/60 dark:bg-[#161D2F] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#0B2545] dark:text-white">
            Panduan Setup &amp; Deploy Google Apps Script
          </h3>
          <CardWindowToggleButton cardId="gas-guide-card" label="Panduan Setup & Deploy GAS" />
        </div>
        {!isCollapsed('gas-guide-card') && (
          <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <li>
              Buat Google Spreadsheet baru, buka menu <strong>Extensions &gt; Apps Script</strong>.
            </li>
            <li>
              Tempel isi <strong>Code.gs</strong> ke file <span className="font-mono-code">Code.gs</span>, lalu buat file HTML baru bernama <span className="font-mono-code">Index</span> (<span className="font-mono-code">Index.html</span>) dan tempel seluruh kodenya.
            </li>
            <li>
              Pilih fungsi <strong>setup</strong> di toolbar editor Apps Script lalu klik <strong>Run</strong>. Berikan izin akses (<em>Review permissions &gt; Advanced &gt; Go to project</em>) untuk Google Sheets, Drive, dan MailApp. Fungsi ini otomatis membuat 10 sheet, folder Drive induk, dan user awal <span className="font-mono-code">admin / Admin123!</span>.
            </li>
            <li>
              Jalankan fungsi <strong>installNotificationTrigger</strong> satu kali agar trigger email harian (pukul 07:30) aktif otomatis.
            </li>
            <li>
              Klik <strong>Deploy &gt; New deployment &gt; Web app</strong>, atur <em>Execute as: Me</em> dan <em>Who has access: Anyone</em> (atau sesuai organisasi Google Workspace Anda), lalu klik <strong>Deploy</strong>.
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}
