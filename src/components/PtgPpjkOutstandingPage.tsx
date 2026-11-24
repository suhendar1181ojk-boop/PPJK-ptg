import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  Download,
  Edit3,
  FileSpreadsheet,
  Flame,
  Lock,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { usePtgD1Sync } from '../hooks/usePtgD1Sync';
import {
  D1_STATUS_OPTIONS,
  filterD1Shipments,
  type D1ImporterSummaryRow,
  type D1ShipmentFilter,
  type D1ShipmentRecord,
} from '../utils/d1Contract';
import {
  exportLocalShipmentsToCsv,
  exportShipmentsFromD1ToCsv,
} from '../utils/exportShipmentsToCsv';
import type { SessionUser, UserAccount } from '../types/ppjk';
import {
  canUserEditShipmentRecord,
  formatRupiah,
  getCleanCheckerDisplayName,
  getJalurBadgeStyle,
  getStatusBadgeClass,
  isCheckerRole,
  isShipmentVisibleToUser,
} from '../utils/ppjkLogic';
import { useCardCollapse } from '../contexts/CardCollapseContext';
import { useViewportMode } from '../contexts/ViewportModeContext';
import { CardWindowToggleButton, ModuleCardBatchToggle } from './CardWindowControls';
import { SyncButtonBar } from './SyncButtonBar';
import { ImportShipmentCsvBox } from './ImportShipmentCsvBox';
import { ShipmentFormModal } from './d1/ShipmentFormModal';

const D1_MODULE_CARD_IDS = [
  'd1-kpi-grid',
  'd1-importer-recap',
  'd1-shipments-table',
] as const;

interface PtgPpjkOutstandingPageProps {
  currentUser?: SessionUser | null;
  users?: UserAccount[];
}

export function PtgPpjkOutstandingPage({
  currentUser = null,
  users = [],
}: PtgPpjkOutstandingPageProps = {}) {
  const {
    shipments,
    importerSummary,
    pendingCount,
    isOnline,
    status,
    formattedLastSync,
    errorMessage,
    backendMode,
    handleSync,
    saveShipment,
    deleteShipment,
    importBatchShipments,
  } = usePtgD1Sync();

  const { isCollapsed } = useCardCollapse();
  const { viewportMode } = useViewportMode();
  const isMobileMode = viewportMode === 'mobile';
  const isCheckerAccount = Boolean(currentUser && isCheckerRole(currentUser.role));

  const visibleShipments = useMemo(
    () =>
      isCheckerAccount && currentUser
        ? shipments.filter((s) =>
            isShipmentVisibleToUser({ dokumenChecker: s.checker_name, createdBy: '' }, currentUser)
          )
        : shipments,
    [shipments, isCheckerAccount, currentUser]
  );

  const visibleImporterSummary = useMemo<D1ImporterSummaryRow[]>(() => {
    if (!isCheckerAccount) return importerSummary;
    const grouped = new Map<string, D1ImporterSummaryRow>();
    for (const s of visibleShipments) {
      const key = `${s.importer_code}||${s.importer_name}`;
      const existing = grouped.get(key) || {
        importer_code: s.importer_code,
        importer_name: s.importer_name,
        total_shipments: 0,
        urgent_count: 0,
        outstanding_count: 0,
        ready_count: 0,
        total_bm_pdri: 0,
      };
      existing.total_shipments += 1;
      if (s.is_urgent === 1) existing.urgent_count += 1;
      if (!s.sppb_date && s.status !== 'Selesai') existing.outstanding_count += 1;
      if (s.doc_status === 'Ready' || s.status === 'Selesai') existing.ready_count += 1;
      existing.total_bm_pdri += Number.isFinite(s.bm_pdri_amount) ? s.bm_pdri_amount : 0;
      grouped.set(key, existing);
    }
    return Array.from(grouped.values()).sort((a, b) =>
      a.importer_code.localeCompare(b.importer_code)
    );
  }, [isCheckerAccount, importerSummary, visibleShipments]);

  const getD1RowEditAccess = (row: D1ShipmentRecord) =>
    currentUser
      ? canUserEditShipmentRecord(
          { dokumenChecker: row.checker_name, createdBy: '' },
          currentUser,
          users
        )
      : { allowed: true, reason: '' };

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [importerFilter, setImporterFilter] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<D1ShipmentRecord | null>(null);
  const [toastFeedback, setToastFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [exportingD1, setExportingD1] = useState(false);

  const activeFilter: D1ShipmentFilter = useMemo(
    () => ({
      q: searchQuery.trim(),
      status: statusFilter,
      importer_code: importerFilter,
    }),
    [searchQuery, statusFilter, importerFilter]
  );

  const filteredShipments = useMemo(
    () => filterD1Shipments(visibleShipments, activeFilter),
    [visibleShipments, activeFilter]
  );

  const metrics = useMemo(() => {
    const total = visibleShipments.length;
    const urgent = visibleShipments.filter((s) => s.is_urgent === 1).length;
    const outstanding = visibleShipments.filter(
      (s) => !s.sppb_date && s.status !== 'Selesai'
    ).length;
    const readyOrSelesai = visibleShipments.filter(
      (s) => s.doc_status === 'Ready' || s.status === 'Selesai'
    ).length;
    const totalBmPdri = visibleShipments.reduce(
      (acc, s) => acc + (Number.isFinite(s.bm_pdri_amount) ? s.bm_pdri_amount : 0),
      0
    );
    return { total, urgent, outstanding, readyOrSelesai, totalBmPdri };
  }, [visibleShipments]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setToastFeedback({ type, text });
    setTimeout(() => {
      setToastFeedback((curr) => (curr?.text === text ? null : curr));
    }, 5000);
  };

  const handleExportLocal = () => {
    const res = exportLocalShipmentsToCsv(visibleShipments, activeFilter);
    showFeedback(
      'success',
      `Ekspor CSV (Lokal IndexedDB) selesai: ${res.rowCount} baris diunduh (${res.filename}).`
    );
  };

  const handleExportD1 = async () => {
    setExportingD1(true);
    try {
      const res = await exportShipmentsFromD1ToCsv(activeFilter);
      showFeedback(
        'success',
        `Ekspor CSV (Cloudflare D1) selesai: ${res.rowCount} baris diunduh (${res.filename}).`
      );
    } catch (err) {
      showFeedback(
        'error',
        err instanceof Error
          ? err.message
          : 'Gagal mengekspor langsung dari Cloudflare D1.'
      );
    } finally {
      setExportingD1(false);
    }
  };

  const handleDeleteRow = async (row: D1ShipmentRecord) => {
    const access = getD1RowEditAccess(row);
    if (!access.allowed) {
      showFeedback('error', access.reason);
      return;
    }
    await deleteShipment(row.id);
    showFeedback(
      'success',
      `Shipment ${row.os_code} dihapus (soft delete)${isOnline ? ' & disinkronkan ke D1.' : ' di antrean offline.'}`
    );
  };

  const openAddModal = () => {
    setEditingRecord(null);
    setModalOpen(true);
  };

  const openEditModal = (row: D1ShipmentRecord) => {
    const access = getD1RowEditAccess(row);
    if (!access.allowed) {
      showFeedback('error', access.reason);
      return;
    }
    setEditingRecord(row);
    setModalOpen(true);
  };

  return (
    <div data-testid="ptg-d1-page" className="space-y-4">
      {/* Header & Action Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#0B2545] dark:bg-gradient-to-br dark:from-[#7C3AED] dark:to-[#4F46E5] flex items-center justify-center text-white shadow-sm shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Cloudflare D1 Offline-First Shipments
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cache lokal <code className="font-mono">IndexedDB (ptg_ppjk_d1_cache)</code> + antrean{' '}
              <code className="font-mono">sync_queue</code> Last-Write-Wins dengan Cloudflare Workers &amp; D1.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
          <ModuleCardBatchToggle cardIds={D1_MODULE_CARD_IDS} moduleName="cloudflare-d1" />

          <button
            type="button"
            data-testid="d1-toggle-import-btn"
            onClick={() => setShowImportBox((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              showImportBox
                ? 'bg-sky-50 dark:bg-sky-500/20 border-sky-300 dark:border-sky-500/40 text-sky-700 dark:text-sky-200'
                : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Impor CSV</span>
          </button>

          <button
            type="button"
            data-testid="d1-add-shipment-btn"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#F28C28] hover:bg-[#dc7a1b] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Shipment</span>
          </button>
        </div>
      </div>

      {/* Sync Button Bar */}
      <SyncButtonBar
        isOnline={isOnline}
        pendingCount={pendingCount}
        status={status}
        formattedLastSync={formattedLastSync}
        errorMessage={errorMessage}
        backendMode={backendMode}
        onSync={() => {
          void handleSync();
        }}
      />

      {/* Action Feedback Banner */}
      {toastFeedback && (
        <div
          role="status"
          data-testid="d1-feedback-banner"
          className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs border ${
            toastFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-200'
          }`}
        >
          <span className="flex items-center gap-2">
            {toastFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{toastFeedback.text}</span>
          </span>
        </div>
      )}

      {/* Collapsible CSV Import Box */}
      {showImportBox && (
        <ImportShipmentCsvBox
          onImportBatch={importBatchShipments}
          onClose={() => setShowImportBox(false)}
        />
      )}

      {/* KPI Summary Card (Window-collapsible) */}
      <section className="rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.08] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Ringkasan Metrik D1
            </span>
            <span className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200">
              {metrics.total} Shipment Aktif
            </span>
          </div>
          <CardWindowToggleButton cardId="d1-kpi-grid" label="Ringkasan Metrik D1" />
        </div>

        {!isCollapsed('d1-kpi-grid') && (
          <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-slate-50 dark:bg-[#0D111C] border border-slate-200/80 dark:border-white/[0.06] p-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Total Shipment Aktif
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                {metrics.total}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                Ready/Selesai: {metrics.readyOrSelesai}
              </div>
            </div>

            <div className="rounded-xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 p-3">
              <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                Outstanding (Belum SPPB)
              </div>
              <div className="mt-1 text-xl font-bold text-amber-900 dark:text-amber-200 tabular-nums">
                {metrics.outstanding}
              </div>
              <div className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-300/80">
                Menunggu SPPB / Selesai
              </div>
            </div>

            <div className="rounded-xl bg-red-50/70 dark:bg-red-500/10 border border-red-200/80 dark:border-red-500/25 p-3">
              <div className="text-[11px] font-medium text-red-700 dark:text-red-300 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                <span>Prioritas Urgent</span>
              </div>
              <div className="mt-1 text-xl font-bold text-red-800 dark:text-red-200 tabular-nums">
                {metrics.urgent}
              </div>
              <div className="mt-0.5 text-[11px] text-red-600/80 dark:text-red-300/80">
                Butuh tindak lanjut cepat
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/25 p-3">
              <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                Total Nilai BM/PDRI
              </div>
              <div className="mt-1 text-lg sm:text-xl font-bold text-emerald-900 dark:text-emerald-200 tabular-nums truncate">
                {formatRupiah(metrics.totalBmPdri)}
              </div>
              <div className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-300/80 tabular-nums">
                {visibleImporterSummary.length} Importir aktif
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Rekap Importir D1 Card */}
      <section className="rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.08] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-[#0B2545] dark:text-violet-400 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate">
              Rekap per Importir ({visibleImporterSummary.length})
            </span>
          </div>
          <CardWindowToggleButton cardId="d1-importer-recap" label="Rekap per Importir" />
        </div>

        {!isCollapsed('d1-importer-recap') && (
          <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {visibleImporterSummary.map((imp) => {
              const isSelected =
                importerFilter.toUpperCase() === imp.importer_code.toUpperCase();
              return (
                <button
                  key={`${imp.importer_code}-${imp.importer_name}`}
                  type="button"
                  onClick={() =>
                    setImporterFilter(isSelected ? '' : imp.importer_code)
                  }
                  className={`text-left rounded-xl p-3 border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0B2545]/8 dark:bg-violet-500/15 border-[#0B2545]/35 dark:border-violet-400/50'
                      : 'bg-slate-50/80 dark:bg-[#0D111C] border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-white/[0.08] text-slate-800 dark:text-slate-200">
                      {imp.importer_code}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                      {imp.total_shipments} dok
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {imp.importer_name}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>OS: {imp.outstanding_count} · Ready: {imp.ready_count}</span>
                    <span>{formatRupiah(imp.total_bm_pdri)}</span>
                  </div>
                </button>
              );
            })}
            {visibleImporterSummary.length === 0 && (
              <div className="col-span-full text-center py-4 text-xs text-slate-500 dark:text-slate-400">
                Belum ada data importir.
              </div>
            )}
          </div>
        )}
      </section>

      {/* Filters, Export Buttons & Shipments Table */}
      <section className="rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.08] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 dark:border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#0B2545] dark:text-violet-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Daftar Shipment D1 ({filteredShipments.length})
              </h3>
            </div>
            <CardWindowToggleButton cardId="d1-shipments-table" label="Tabel Shipment D1" />
          </div>

          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
            {/* Search & Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  data-testid="d1-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari OS, BL, AJU, Importir..."
                  className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
                />
              </div>

              <select
                data-testid="d1-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              >
                <option value="">Semua Status</option>
                {D1_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              <select
                data-testid="d1-importer-filter"
                value={importerFilter}
                onChange={(e) => setImporterFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              >
                <option value="">Semua Importir</option>
                {visibleImporterSummary.map((imp) => (
                  <option key={imp.importer_code} value={imp.importer_code}>
                    {imp.importer_code} — {imp.importer_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Dual CSV Export Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="d1-export-local-csv-btn"
                onClick={handleExportLocal}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor CSV (Lokal)</span>
              </button>

              <button
                type="button"
                data-testid="d1-export-remote-csv-btn"
                onClick={() => {
                  void handleExportD1();
                }}
                disabled={exportingD1 || !isOnline}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-emerald-200 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 disabled:opacity-50 text-xs font-semibold text-emerald-800 dark:text-emerald-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {exportingD1 ? 'Mengunduh...' : 'Ekspor CSV (Cloudflare D1)'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {!isCollapsed('d1-shipments-table') && (
          <>
            {/* Desktop / Tablet Table */}
            <div className={`${isMobileMode ? 'hidden' : 'hidden md:block'} overflow-x-auto`}>
              <table
                data-testid="d1-shipments-table"
                className="w-full text-left border-collapse text-xs"
              >
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#0E1320] border-b border-slate-200 dark:border-white/[0.06] text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3">Kode OS</th>
                    <th className="py-2.5 px-3">Importir &amp; Customer</th>
                    <th className="py-2.5 px-3">No. BL / AJU / NOPEN</th>
                    <th className="py-2.5 px-3">Jalur &amp; Checker</th>
                    <th className="py-2.5 px-3">ETA / SPPB</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">BM/PDRI</th>
                    <th className="py-2.5 px-3 text-center">Versi</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {filteredShipments.map((row) => {
                    const jalurMeta = getJalurBadgeStyle(row.jalur);
                    return (
                      <tr
                        key={row.id}
                        data-testid={`d1-row-${row.os_code}`}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="py-2.5 px-3 align-top whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {row.os_code}
                            </span>
                            {row.is_urgent === 1 && (
                              <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 text-[10px] font-bold">
                                URGENT
                              </span>
                            )}
                          </div>
                          {row.doc_os && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Doc: {row.doc_os}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 align-top max-w-[220px]">
                          <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {row.importer_code} · {row.importer_name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {row.customer_name || '-'}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 align-top whitespace-nowrap">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            BL: {row.bl_number || '-'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            AJU: {row.aju_number || '-'} · NOPEN: {row.nopen || '-'}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 align-top whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${jalurMeta.bgClass} ${jalurMeta.textClass}`}
                          >
                            {jalurMeta.label}
                          </span>
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {row.checker_name || 'Belum ada checker'}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 align-top whitespace-nowrap tabular-nums">
                          <div className="text-slate-800 dark:text-slate-200">
                            ETA: {row.eta_date || '-'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            SPPB: {row.sppb_date || '-'}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 align-top whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getStatusBadgeClass(row.status)}`}
                          >
                            {row.status}
                          </span>
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            Dok: {row.doc_status}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 align-top text-right whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                          {formatRupiah(row.bm_pdri_amount)}
                        </td>

                        <td className="py-2.5 px-3 align-top text-center whitespace-nowrap tabular-nums">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            v{row.version}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                          {(() => {
                            const rowAccess = getD1RowEditAccess(row);
                            if (!rowAccess.allowed) {
                              return (
                                <button
                                  type="button"
                                  disabled
                                  title={rowAccess.reason}
                                  data-testid={`d1-locked-edit-${row.os_code}`}
                                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-[11px] font-semibold text-amber-700 dark:text-amber-300 opacity-85 cursor-not-allowed"
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>Terkunci</span>
                                </button>
                              );
                            }
                            return (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  data-testid={`d1-edit-${row.os_code}`}
                                  onClick={() => openEditModal(row)}
                                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  data-testid={`d1-delete-${row.os_code}`}
                                  onClick={() => {
                                    void handleDeleteRow(row);
                                  }}
                                  aria-label={`Hapus ${row.os_code}`}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-300 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredShipments.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-10 text-center text-xs text-slate-500 dark:text-slate-400"
                      >
                        Tidak ada shipment yang cocok dengan filter saat ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div
              className={`${isMobileMode ? 'block' : 'md:hidden'} divide-y divide-slate-200 dark:divide-white/[0.06]`}
            >
              {filteredShipments.map((row) => (
                <div
                  key={row.id}
                  data-testid={`d1-mobile-card-${row.os_code}`}
                  className="p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {row.os_code}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-slate-300">
                          v{row.version}
                        </span>
                        {row.is_urgent === 1 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300">
                            URGENT
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                        {row.importer_code} · {row.importer_name}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold border shrink-0 ${getStatusBadgeClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <div>BL: {row.bl_number || '-'}</div>
                    <div>ETA: {row.eta_date || '-'}</div>
                    <div>Checker: {row.checker_name || '-'}</div>
                    <div className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                      {formatRupiah(row.bm_pdri_amount)}
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-end gap-2">
                    {(() => {
                      const rowAccess = getD1RowEditAccess(row);
                      if (!rowAccess.allowed) {
                        return (
                          <button
                            type="button"
                            disabled
                            title={rowAccess.reason}
                            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-xs font-semibold text-amber-700 dark:text-amber-300 opacity-85 cursor-not-allowed"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Terkunci</span>
                          </button>
                        );
                      }
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-slate-200 dark:border-white/[0.1] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleDeleteRow(row);
                            }}
                            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-red-200 dark:border-red-500/30 text-xs font-semibold text-red-600 dark:text-red-300 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
              {filteredShipments.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  Tidak ada shipment yang cocok dengan filter.
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {modalOpen && (
        <ShipmentFormModal
          initialRecord={editingRecord}
          defaultCheckerName={
            isCheckerAccount && currentUser ? getCleanCheckerDisplayName(currentUser.nama) : ''
          }
          lockCheckerName={isCheckerAccount}
          onClose={() => {
            setModalOpen(false);
            setEditingRecord(null);
          }}
          onSubmit={saveShipment}
        />
      )}
    </div>
  );
}
