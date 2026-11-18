import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderSearch,
  Globe,
  Link2,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Table2,
  Unlink,
  Upload,
} from 'lucide-react';
import type { DatabaseState } from '../types/ppjk';
import { GoogleSignInButton } from './GoogleDriveButton';
import {
  DATABASE_SHEET_TABS,
  extractSpreadsheetIdFromInput,
} from '../utils/sheetsSchema';
import {
  buildSampleGasWebAppScript,
  DEFAULT_GAS_WEBAPP_URL,
  validateGasWebAppUrl,
} from '../utils/gasWebAppLogic';
import type { SpreadsheetDriveEntry } from '../services/googleSheetsService';
import { fetchFirebaseAuthorizedDomains } from '../services/googleDriveService';
import {
  buildUnauthorizedDomainHelp,
  type GoogleAuthDomainStatus,
} from '../utils/googleAuthLogic';

interface SpreadsheetDatabaseViewProps {
  db: DatabaseState;
  driveUserEmail: string | null;
  driveConnecting: boolean;
  syncingSheets: boolean;
  syncingGasWebApp: boolean;
  darkMode: boolean;
  isAdmin: boolean;
  onConnectGoogle: () => Promise<void>;
  onDisconnectGoogle: () => Promise<void>;
  onCreateSpreadsheet: (title: string) => Promise<void>;
  onConnectExistingSpreadsheet: (spreadsheetId: string) => Promise<void>;
  onPushToSpreadsheet: (spreadsheetId?: string) => Promise<void>;
  onPullFromSpreadsheet: (spreadsheetId?: string) => Promise<void>;
  onToggleAutoSync: (enabled: boolean) => Promise<void>;
  onDisconnectSpreadsheet: () => Promise<void>;
  onListSpreadsheets: () => Promise<SpreadsheetDriveEntry[]>;
  onSaveGasWebAppConfig: (config: {
    gasWebAppUrl: string;
    gasWebAppAutoSync: boolean;
  }) => Promise<void>;
  onPullFromGasWebApp: (overrideUrl?: string) => Promise<void>;
  onPushShipmentToGasWebApp: (kodeOs?: string, overrideUrl?: string) => Promise<void>;
}

export function SpreadsheetDatabaseView({
  db,
  driveUserEmail,
  driveConnecting,
  syncingSheets,
  syncingGasWebApp,
  darkMode,
  isAdmin,
  onConnectGoogle,
  onDisconnectGoogle,
  onCreateSpreadsheet,
  onConnectExistingSpreadsheet,
  onPushToSpreadsheet,
  onPullFromSpreadsheet,
  onToggleAutoSync,
  onDisconnectSpreadsheet,
  onListSpreadsheets,
  onSaveGasWebAppConfig,
  onPullFromGasWebApp,
  onPushShipmentToGasWebApp,
}: SpreadsheetDatabaseViewProps) {
  const [newSheetTitle, setNewSheetTitle] = useState(
    db.pengaturan.spreadsheetTitle || 'PTG_PPJK_DATABASE'
  );
  const [existingInput, setExistingInput] = useState(db.pengaturan.spreadsheetId || '');
  const [driveSheets, setDriveSheets] = useState<SpreadsheetDriveEntry[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [domainStatus, setDomainStatus] = useState<GoogleAuthDomainStatus | null>(null);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const savedGasUrl =
    db.pengaturan.gasWebAppUrl !== undefined
      ? db.pengaturan.gasWebAppUrl
      : DEFAULT_GAS_WEBAPP_URL;
  const savedGasAutoSync = db.pengaturan.gasWebAppAutoSync !== false;
  const [gasUrlInput, setGasUrlInput] = useState(savedGasUrl);
  const [selectedPushKodeOs, setSelectedPushKodeOs] = useState(
    db.shipments[0]?.kodeOs || ''
  );
  const [showSampleGasCode, setShowSampleGasCode] = useState(false);
  const [copiedSampleScript, setCopiedSampleScript] = useState(false);

  useEffect(() => {
    setGasUrlInput(savedGasUrl);
  }, [savedGasUrl]);

  useEffect(() => {
    if (!selectedPushKodeOs && db.shipments.length > 0) {
      setSelectedPushKodeOs(db.shipments[0].kodeOs);
    }
  }, [db.shipments, selectedPushKodeOs]);

  const checkDomainStatus = async (forceRefresh = false) => {
    setCheckingDomain(true);
    try {
      const status = await fetchFirebaseAuthorizedDomains(forceRefresh);
      setDomainStatus(status);
    } finally {
      setCheckingDomain(false);
    }
  };

  useEffect(() => {
    void checkDomainStatus(false);
  }, []);

  const linkedId = db.pengaturan.spreadsheetId || '';
  const linkedTitle = db.pengaturan.spreadsheetTitle || 'PTG_PPJK_DATABASE';
  const linkedUrl =
    db.pengaturan.spreadsheetUrl ||
    (linkedId ? `https://docs.google.com/spreadsheets/d/${linkedId}/edit` : '');
  const autoSyncEnabled = Boolean(db.pengaturan.spreadsheetAutoSync);
  const lastSyncAt = db.pengaturan.spreadsheetLastSyncAt || '';

  const gasValidation = validateGasWebAppUrl(gasUrlInput);
  const activeGasLastSyncAt = db.pengaturan.gasWebAppLastSyncAt || '';
  const activeGasLastDir = db.pengaturan.gasWebAppLastSyncDirection || '';
  const activeGasLastMsg = db.pengaturan.gasWebAppLastSyncMessage || '';

  const handleSaveGasUrlSubmit = async () => {
    const check = validateGasWebAppUrl(gasUrlInput);
    if (!check.valid) {
      await Swal.fire({
        title: 'URL Endpoint Tidak Valid',
        text: check.error || 'Periksa kembali format URL Web App Google Apps Script.',
        icon: 'warning',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
      return;
    }
    await onSaveGasWebAppConfig({
      gasWebAppUrl: check.normalizedUrl,
      gasWebAppAutoSync: savedGasAutoSync,
    });
  };

  const tabCounts: Record<string, number> = {
    Shipments: db.shipments.length,
    Kontainer: db.kontainers.length,
    Master_Customer: db.customers.length,
    Master_Importir: db.importirs.length,
    Master_Shipper: db.shippers.length,
    Users: db.users.length,
    Log_Perubahan: db.logs.length,
    Catatan: db.catatan.length,
    Dokumen: db.dokumen.length,
    Pengeluaran_Ops: (db.pengeluaranOps || []).length,
    Pengaturan: 20,
    Sync_Metadata: 10,
  };

  const formatDateTimeId = (iso: string) => {
    if (!iso) return 'Belum pernah';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleLoadDriveSpreadsheets = async () => {
    setLoadingList(true);
    try {
      const files = await onListSpreadsheets();
      setDriveSheets(files);
      if (files.length === 0) {
        await Swal.fire({
          title: 'Belum Ada File Spreadsheet',
          text: 'Tidak ditemukan file Google Spreadsheet di Google Drive Anda. Anda dapat langsung membuat file baru di bawah.',
          icon: 'info',
          background: darkMode ? '#131926' : '#ffffff',
          color: darkMode ? '#f1f5f9' : '#0f172a',
        });
      }
    } catch (err) {
      await Swal.fire({
        title: 'Gagal Memuat Daftar Spreadsheet',
        text: err instanceof Error ? err.message : 'Pastikan akun Google sudah terhubung.',
        icon: 'error',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
    } finally {
      setLoadingList(false);
    }
  };

  const handleConnectInputSubmit = async () => {
    const parsedId = extractSpreadsheetIdFromInput(existingInput);
    if (!parsedId) {
      await Swal.fire({
        title: 'ID / URL Spreadsheet Tidak Valid',
        text: 'Masukkan ID Spreadsheet atau URL lengkap Google Sheets (contoh: https://docs.google.com/spreadsheets/d/...).',
        icon: 'warning',
        background: darkMode ? '#131926' : '#ffffff',
        color: darkMode ? '#f1f5f9' : '#0f172a',
      });
      return;
    }
    await onConnectExistingSpreadsheet(parsedId);
  };

  const inputCls =
    'px-3 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40';

  return (
    <div className="space-y-5" data-testid="spreadsheet-database-view">
      {/* Header Banner */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/[0.08]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0B2545] dark:text-white">
              Database &amp; Sinkronisasi Penuh Google Spreadsheet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">
              Hubungkan aplikasi ke endpoint Web App Google Apps Script (GET daftar data &amp; POST action: &apos;add&apos;) atau sinkronkan langsung via akun Google Sheets API.
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {linkedId ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {autoSyncEnabled ? 'Auto-Sync Spreadsheet Aktif' : 'Spreadsheet Terhubung'}
              </span>
            </span>
          ) : gasValidation.valid ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Globe className="w-3.5 h-3.5" />
              <span>Endpoint GAS Terkonfigurasi</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <CloudOff className="w-3.5 h-3.5" />
              <span>Belum Terhubung ke Spreadsheet</span>
            </span>
          )}
        </div>
      </div>

      {/* Section A: Direct Google Apps Script Web App Endpoint (GET & POST action: 'add') */}
      <div
        data-testid="gas-webapp-panel"
        className="p-4 rounded-xl bg-emerald-50/50 dark:bg-[#161D2F] border border-emerald-200/80 dark:border-emerald-500/25 space-y-3.5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="text-xs font-bold text-[#0B2545] dark:text-white flex items-center gap-1.5 flex-wrap">
              <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Koneksi Endpoint Google Apps Script (Web App GET &amp; POST)</span>
              {gasValidation.valid && gasValidation.isDevEndpoint && (
                <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 text-[10px] font-semibold">
                  Mode /dev
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Mengambil daftar data melalui HTTP <code className="font-mono-code font-semibold">GET</code> dan otomatis mengirim data shipment baru via HTTP <code className="font-mono-code font-semibold">POST</code> dengan payload <code className="font-mono-code">{`{ action: 'add', data: {...} }`}</code>.
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              role="switch"
              aria-checked={savedGasAutoSync}
              data-testid="toggle-gas-webapp-autosync"
              onClick={() =>
                void onSaveGasWebAppConfig({
                  gasWebAppUrl: gasValidation.valid ? gasValidation.normalizedUrl : savedGasUrl,
                  gasWebAppAutoSync: !savedGasAutoSync,
                })
              }
              disabled={syncingGasWebApp}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors shrink-0 self-start sm:self-center ${
                savedGasAutoSync
                  ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-white dark:bg-[#182032] border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingGasWebApp ? 'animate-spin' : ''}`} />
              <span>Auto-POST Baru: {savedGasAutoSync ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="gasWebAppUrlInput"
            className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300"
          >
            URL Web App Google Apps Script
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="gasWebAppUrlInput"
              data-testid="gas-webapp-url-input"
              type="url"
              value={gasUrlInput}
              onChange={(e) => setGasUrlInput(e.target.value)}
              disabled={!isAdmin || syncingGasWebApp}
              placeholder={DEFAULT_GAS_WEBAPP_URL}
              className={`flex-1 ${inputCls} font-mono-code`}
            />
            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  data-testid="save-gas-webapp-url-btn"
                  onClick={() => void handleSaveGasUrlSubmit()}
                  disabled={syncingGasWebApp}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B2545] hover:bg-[#123663] dark:bg-violet-600 dark:hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan URL</span>
                </button>
                {gasUrlInput !== DEFAULT_GAS_WEBAPP_URL && (
                  <button
                    type="button"
                    onClick={() => setGasUrlInput(DEFAULT_GAS_WEBAPP_URL)}
                    title="Kembalikan ke URL endpoint default"
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#182032] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Default</span>
                  </button>
                )}
              </div>
            )}
          </div>
          {!gasValidation.valid && gasUrlInput.trim() !== '' && (
            <div className="text-[11px] font-medium text-red-600 dark:text-red-400">
              {gasValidation.error}
            </div>
          )}
        </div>

        {/* Action Row: GET List + POST { action: 'add', data } */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-emerald-200/70 dark:border-white/[0.08]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="gas-webapp-get-btn"
              onClick={() => void onPullFromGasWebApp(gasUrlInput)}
              disabled={!gasValidation.valid || syncingGasWebApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              <Download className={`w-3.5 h-3.5 ${syncingGasWebApp ? 'animate-pulse' : ''}`} />
              <span>{syncingGasWebApp ? 'Memproses...' : 'Ambil Data dari GAS (GET)'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              {db.shipments.length > 0 && (
                <select
                  aria-label="Pilih shipment untuk dikirim ke GAS"
                  data-testid="gas-webapp-push-select"
                  value={selectedPushKodeOs}
                  onChange={(e) => setSelectedPushKodeOs(e.target.value)}
                  className={`${inputCls} max-w-[270px]`}
                >
                  {db.shipments.slice(0, 30).map((s) => (
                    <option key={s.kodeOs} value={s.kodeOs}>
                      {s.kodeOs} — {s.noBl || s.namaCustomer}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                data-testid="gas-webapp-post-btn"
                onClick={() =>
                  void onPushShipmentToGasWebApp(
                    selectedPushKodeOs || db.shipments[0]?.kodeOs,
                    gasUrlInput
                  )
                }
                disabled={!gasValidation.valid || syncingGasWebApp || db.shipments.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim Data Baru (POST add)</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSampleGasCode((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0B2545] dark:text-violet-300 hover:underline cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showSampleGasCode ? 'Sembunyikan Contoh Code.gs' : 'Lihat Contoh Code.gs (doGet / doPost)'}</span>
          </button>
        </div>

        {(activeGasLastSyncAt || activeGasLastMsg) && (
          <div
            data-testid="gas-webapp-last-sync"
            className="px-3 py-2 rounded-lg bg-white/80 dark:bg-[#131926] border border-emerald-200/70 dark:border-white/[0.06] text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2"
          >
            <div>
              Status GAS terakhir:{' '}
              <strong>{activeGasLastSyncAt ? formatDateTimeId(activeGasLastSyncAt) : 'Baru saja'}</strong>
              {activeGasLastDir ? ` (${activeGasLastDir.toUpperCase()})` : ''}
            </div>
            {activeGasLastMsg && (
              <div className="text-emerald-700 dark:text-emerald-300 font-medium">
                {activeGasLastMsg}
              </div>
            )}
          </div>
        )}

        {showSampleGasCode && (
          <div
            data-testid="gas-sample-code-panel"
            className="p-3 rounded-xl bg-slate-900 text-slate-100 space-y-2 border border-slate-700"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono-code font-semibold text-emerald-400">
                Code.gs — Google Apps Script (doGet &amp; doPost 41 Kolom Lengkap)
              </span>
              <button
                type="button"
                onClick={() => {
                  if (navigator.clipboard?.writeText) {
                    void navigator.clipboard.writeText(buildSampleGasWebAppScript()).then(() => {
                      setCopiedSampleScript(true);
                      setTimeout(() => setCopiedSampleScript(false), 2000);
                    });
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-white cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedSampleScript ? 'Tersalin!' : 'Salin Code.gs'}</span>
              </button>
            </div>
            <pre className="max-h-[380px] overflow-auto text-[10.5px] font-mono-code leading-relaxed text-slate-200 pr-1">
              {buildSampleGasWebAppScript()}
            </pre>
          </div>
        )}
      </div>

      {/* Step 1: Google Account Auth Status */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="text-xs font-bold text-[#0B2545] dark:text-white flex items-center gap-1.5 flex-wrap">
              <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>1. Koneksi Akun Google (Google Sheets &amp; Drive)</span>
              {domainStatus && !domainStatus.checkError && (
                <span
                  data-testid="google-auth-domain-badge"
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-semibold border ${
                    domainStatus.isDomainAuthorizedInFirebase
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/35'
                      : 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/35'
                  }`}
                >
                  {domainStatus.isDomainAuthorizedInFirebase ? (
                    <ShieldCheck className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                  <span>
                    {domainStatus.isDomainAuthorizedInFirebase
                      ? `Domain Terotorisasi (${domainStatus.currentHostname})`
                      : `Domain Perlu Otorisasi / GIS (${domainStatus.currentHostname})`}
                  </span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              {driveUserEmail
                ? `Terhubung sebagai ${driveUserEmail}. Izin baca/tulis Google Spreadsheet aktif untuk sesi ini.`
                : 'Masuk dengan akun Google Anda agar aplikasi dapat membuat, membaca, dan memperbarui file Google Spreadsheet.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {driveUserEmail ? (
              <button
                type="button"
                onClick={() => void onDisconnectGoogle()}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#182032] hover:bg-slate-100 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Putuskan Akun Google
              </button>
            ) : (
              <GoogleSignInButton
                onClick={() => void onConnectGoogle()}
                disabled={driveConnecting}
                label={driveConnecting ? 'Menghubungkan...' : 'Sign in with Google'}
              />
            )}
          </div>
        </div>

        {domainStatus && !domainStatus.isDomainAuthorizedInFirebase && !driveUserEmail && (() => {
          const help = buildUnauthorizedDomainHelp({
            currentHostname: domainStatus.currentHostname,
            currentOrigin: domainStatus.currentOrigin,
            projectId: domainStatus.projectId,
            oAuthClientId: domainStatus.oAuthClientId,
            authorizedDomains: domainStatus.authorizedDomains,
          });
          return (
            <div
              data-testid="google-auth-domain-warning"
              className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-[11px] text-amber-950 dark:text-amber-200 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">
                  Info Domain: <code className="font-mono-code px-1.5 py-0.5 rounded bg-white/80 dark:bg-[#131926]">{help.currentHostname}</code> belum masuk Authorized Domains Firebase (<code className="font-mono-code">{help.projectId}</code>). Saat klik Sign in, aplikasi otomatis mencoba fallback OAuth (GIS).
                </div>
                <button
                  type="button"
                  onClick={() => void checkDomainStatus(true)}
                  disabled={checkingDomain}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-[#182032] text-[10.5px] font-semibold cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${checkingDomain ? 'animate-spin' : ''}`} />
                  <span>Cek Ulang</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard?.writeText) {
                      void navigator.clipboard.writeText(help.currentHostname).then(() => {
                        setCopiedDomain(true);
                        setTimeout(() => setCopiedDomain(false), 2000);
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#182032] border border-amber-300 dark:border-amber-500/40 font-semibold text-amber-900 dark:text-amber-200 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedDomain ? 'Domain Tersalin!' : `Salin Domain (${help.currentHostname})`}</span>
                </button>
                <a
                  href={help.firebaseConsoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  <span>Firebase Authorized Domains</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                {help.preferredAppUrls.slice(0, 1).map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B2545] hover:bg-[#123663] text-white font-semibold"
                  >
                    <span>Buka URL Terotorisasi</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Step 2: Active Linked Spreadsheet Card OR Setup Options */}
      {linkedId && (
        <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2 flex-wrap">
                <span>File Database Aktif: {linkedTitle}</span>
                {linkedUrl && (
                  <a
                    href={linkedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                  >
                    <span>Buka Google Spreadsheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="text-[11px] font-mono-code text-emerald-800/80 dark:text-emerald-300/80 break-all">
                Spreadsheet ID: {linkedId}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                Sinkronisasi terakhir: <strong>{formatDateTimeId(lastSyncAt)}</strong>
                {db.pengaturan.spreadsheetLastSyncDirection
                  ? ` (${db.pengaturan.spreadsheetLastSyncDirection.toUpperCase()})`
                  : ''}
              </div>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoSyncEnabled}
                  data-testid="toggle-spreadsheet-autosync"
                  onClick={() => void onToggleAutoSync(!autoSyncEnabled)}
                  disabled={syncingSheets}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                    autoSyncEnabled
                      ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-white dark:bg-[#182032] border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingSheets ? 'animate-spin' : ''}`} />
                  <span>Auto-Sync: {autoSyncEnabled ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void onDisconnectSpreadsheet()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-500/35 bg-white dark:bg-[#182032] hover:bg-red-50 dark:hover:bg-red-500/15 text-xs font-semibold text-red-600 dark:text-red-300 cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Putuskan</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-emerald-200/70 dark:border-emerald-500/20">
            <button
              type="button"
              data-testid="push-sheets-btn"
              onClick={() => void onPushToSpreadsheet(linkedId)}
              disabled={!driveUserEmail || syncingSheets}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{syncingSheets ? 'Menyinkronkan...' : 'Kirim Data Lokal → Spreadsheet (Push)'}</span>
            </button>

            <button
              type="button"
              data-testid="pull-sheets-btn"
              onClick={() => void onPullFromSpreadsheet(linkedId)}
              disabled={!driveUserEmail || syncingSheets}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B2545] hover:bg-[#123663] dark:bg-violet-600 dark:hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tarik Data dari Spreadsheet → Aplikasi (Pull)</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Create New or Link Existing Google Spreadsheet */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Create new database spreadsheet */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-3">
            <div className="text-xs font-bold text-[#0B2545] dark:text-white flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-[#F28C28] dark:text-violet-400" />
              <span>Buat File Google Spreadsheet Database Baru</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Membuat file Google Spreadsheet baru di Google Drive Anda dengan 11 tab database terstruktur dan langsung mengisi seluruh data saat ini.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                aria-label="Nama file Google Spreadsheet baru"
                value={newSheetTitle}
                onChange={(e) => setNewSheetTitle(e.target.value)}
                placeholder="PTG_PPJK_DATABASE"
                className={`flex-1 ${inputCls}`}
              />
              <button
                type="button"
                data-testid="create-spreadsheet-btn"
                onClick={() => void onCreateSpreadsheet(newSheetTitle)}
                disabled={!driveUserEmail || syncingSheets}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Buat &amp; Sinkronkan</span>
              </button>
            </div>
          </div>

          {/* Link existing spreadsheet */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-3">
            <div className="text-xs font-bold text-[#0B2545] dark:text-white flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Hubungkan ke Google Spreadsheet yang Sudah Ada</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Tempel URL atau ID Google Spreadsheet Anda, atau pilih langsung dari daftar file Google Drive.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                aria-label="URL atau ID Google Spreadsheet"
                value={existingInput}
                onChange={(e) => setExistingInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className={`flex-1 ${inputCls} font-mono-code`}
              />
              <button
                type="button"
                onClick={() => void handleConnectInputSubmit()}
                disabled={!driveUserEmail || syncingSheets}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B2545] hover:bg-[#123663] dark:bg-[#232D48] dark:hover:bg-[#2D395A] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Hubungkan</span>
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void handleLoadDriveSpreadsheets()}
                disabled={!driveUserEmail || loadingList}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0B2545] dark:text-violet-300 hover:underline disabled:opacity-50 cursor-pointer"
              >
                <FolderSearch className="w-3.5 h-3.5" />
                <span>
                  {loadingList ? 'Memuat daftar Google Drive...' : 'Pilih dari Google Drive Saya'}
                </span>
              </button>

              {driveSheets.length > 0 && (
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-200 dark:divide-white/[0.06] rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131926]">
                  {driveSheets.map((item) => (
                    <div
                      key={item.id}
                      className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] font-mono-code text-slate-500 dark:text-slate-400 truncate">
                          {item.id}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setExistingInput(item.id);
                          void onConnectExistingSpreadsheet(item.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] hover:bg-emerald-100 dark:hover:bg-emerald-500/25 cursor-pointer shrink-0"
                      >
                        Pilih
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Live Schema Overview */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B2545] dark:text-violet-300">
          <Table2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Struktur 11 Tab Database Google Spreadsheet</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {DATABASE_SHEET_TABS.map((tab) => (
            <div
              key={tab.title}
              className="p-3 rounded-xl border border-slate-200 dark:border-white/[0.07] bg-slate-50/70 dark:bg-[#161D2F] flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-mono-code font-semibold text-[#0B2545] dark:text-white truncate">
                  {tab.title}
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  {tab.headers.length} kolom
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#1D263E] border border-slate-200 dark:border-white/[0.08] text-[11px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {tabCounts[tab.title] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
