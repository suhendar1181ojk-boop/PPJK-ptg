import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CalendarRange,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  FileText,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type { Importir, JalurType, NopenRecapCriteria, Shipment } from '../types/ppjk';
import {
  computeNopenRecapSummary,
  DEFAULT_JALUR_LIST,
  DEFAULT_STATUS_LIST,
  filterNopenRecapShipments,
  formatCurrencyTotals,
  getCurrentMonthKey,
  getMonthDateBounds,
  getPreviousMonthKey,
  getRelativeDateRange,
  hasSptnpIssue,
  isContainerGateOut,
  isSppbReadyForGateOut,
} from '../utils/ppjkLogic';
import {
  exportNopenRecapToCSV,
  exportNopenRecapToExcel,
  exportNopenRecapToPDF,
} from '../utils/exportUtils';
import { JalurBadge, StatusBadge } from './Badges';

interface NopenReportViewProps {
  shipments: Shipment[];
  importirs: Importir[];
  statusList?: string[];
  jalurList?: JalurType[];
  checklistItems: string[];
  onOpenDetail: (kodeOs: string) => void;
}

export function NopenReportView({
  shipments,
  importirs,
  statusList = DEFAULT_STATUS_LIST,
  jalurList = DEFAULT_JALUR_LIST,
  checklistItems,
  onOpenDetail,
}: NopenReportViewProps) {
  const defaultMonth = useMemo(() => getCurrentMonthKey(), []);
  const defaultBounds = useMemo(() => getMonthDateBounds(defaultMonth), [defaultMonth]);

  const [periodMode, setPeriodMode] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [dateFrom, setDateFrom] = useState<string>(defaultBounds.dateFrom);
  const [dateTo, setDateTo] = useState<string>(defaultBounds.dateTo);
  const [search, setSearch] = useState('');
  const [filterJalur, setFilterJalur] = useState<'' | JalurType | '__EMPTY__'>('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterImportir, setFilterImportir] = useState('');
  const [includeWithoutNopen, setIncludeWithoutNopen] = useState(false);

  const importirNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const imp of importirs) {
      if (imp.kodeImportir) {
        m.set(imp.kodeImportir.trim().toUpperCase(), imp.namaImportir);
      }
    }
    return m;
  }, [importirs]);

  const distinctImportirOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const imp of importirs) {
      const code = (imp.kodeImportir || '').trim();
      if (code) map.set(code, imp.namaImportir);
    }
    for (const s of shipments) {
      const code = (s.kodeImportir || '').trim();
      if (code && !map.has(code)) map.set(code, 'Importir Non-Master');
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [shipments, importirs]);

  const criteria: NopenRecapCriteria = useMemo(
    () => ({
      periodMode,
      month: selectedMonth,
      dateFrom,
      dateTo,
      search,
      filterJalur,
      filterStatus,
      filterImportir,
      includeWithoutNopen,
    }),
    [
      periodMode,
      selectedMonth,
      dateFrom,
      dateTo,
      search,
      filterJalur,
      filterStatus,
      filterImportir,
      includeWithoutNopen,
    ]
  );

  const matchedRows = useMemo(
    () => filterNopenRecapShipments(shipments, criteria),
    [shipments, criteria]
  );

  const summary = useMemo(
    () => computeNopenRecapSummary(matchedRows, importirs, checklistItems, criteria),
    [matchedRows, importirs, checklistItems, criteria]
  );

  const handleApplyMonthPreset = (monthKey: string) => {
    setPeriodMode('month');
    setSelectedMonth(monthKey);
    const bounds = getMonthDateBounds(monthKey);
    setDateFrom(bounds.dateFrom);
    setDateTo(bounds.dateTo);
  };

  const handleApplyRangePreset = (daysBack: number) => {
    const range = getRelativeDateRange(daysBack);
    setPeriodMode('range');
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
  };

  const handleSwitchMode = (nextMode: 'month' | 'range') => {
    setPeriodMode(nextMode);
    if (nextMode === 'range' && (!dateFrom || !dateTo)) {
      const bounds = getMonthDateBounds(selectedMonth);
      setDateFrom(bounds.dateFrom);
      setDateTo(bounds.dateTo);
    }
  };

  const handleResetFilters = () => {
    const m = getCurrentMonthKey();
    const b = getMonthDateBounds(m);
    setPeriodMode('month');
    setSelectedMonth(m);
    setDateFrom(b.dateFrom);
    setDateTo(b.dateTo);
    setSearch('');
    setFilterJalur('');
    setFilterStatus('');
    setFilterImportir('');
    setIncludeWithoutNopen(false);
  };

  const hasActiveFilter =
    Boolean(search) ||
    Boolean(filterJalur) ||
    Boolean(filterStatus) ||
    Boolean(filterImportir) ||
    includeWithoutNopen;

  return (
    <div className="space-y-4">
      {/* Header & Toolbar Export */}
      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#F28C28] dark:text-violet-400" />
            <span>Report Rekapan Dokumen No. NOPEN (PIB)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Rekapitulasi pendaftaran PIB berdasarkan{' '}
            <strong className="text-slate-700 dark:text-slate-200">No. NOPEN &amp; Tgl. NOPEN</strong>{' '}
            dalam periode 1 bulan penuh maupun rentang tanggal ke tanggal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportNopenRecapToExcel(matchedRows, summary, importirs)}
            disabled={matchedRows.length === 0}
            data-testid="nopen-export-excel-btn"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={() => exportNopenRecapToCSV(matchedRows, summary, importirs)}
            disabled={matchedRows.length === 0}
            data-testid="nopen-export-csv-btn"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 dark:bg-[#1A2234] dark:hover:bg-[#232D42] dark:border dark:border-white/10 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => exportNopenRecapToPDF(matchedRows, summary, importirs)}
            disabled={matchedRows.length === 0}
            data-testid="nopen-export-pdf-btn"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            data-testid="nopen-print-btn"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="hidden print:block border-b border-slate-300 pb-3 mb-3">
        <div className="text-base font-bold text-slate-900">
          PTG PPJK — LAPORAN REKAPAN DOKUMEN BERDASARKAN NO. NOPEN (PIB)
        </div>
        <div className="text-xs text-slate-700 mt-1">
          Periode: {summary.periodLabel} · Total Dokumen: {summary.totalMatched} (Terbit NOPEN:{' '}
          {summary.totalWithNopen}) · SPPB: {summary.totalSppb} · Gate-Out: {summary.totalGateOut}
        </div>
      </div>

      {/* Period Selector & Filters Panel */}
      <section
        aria-label="Filter periode report NOPEN"
        className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 space-y-3.5 no-print"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Mode Switch: 1 Bulan vs Tanggal ke Tanggal */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-[#0D111C] border border-slate-200 dark:border-white/[0.07]">
            <button
              type="button"
              onClick={() => handleSwitchMode('month')}
              data-testid="nopen-mode-month-btn"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                periodMode === 'month'
                  ? 'bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Rekap 1 Bulan</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('range')}
              data-testid="nopen-mode-range-btn"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                periodMode === 'range'
                  ? 'bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Tanggal ke Tanggal</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">
              Pintasan:
            </span>
            <button
              type="button"
              onClick={() => handleApplyMonthPreset(getCurrentMonthKey())}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => handleApplyMonthPreset(getPreviousMonthKey())}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Bulan Lalu
            </button>
            <button
              type="button"
              onClick={() => handleApplyRangePreset(7)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              7 Hari Terakhir
            </button>
            <button
              type="button"
              onClick={() => handleApplyRangePreset(30)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              30 Hari Terakhir
            </button>
          </div>
        </div>

        {/* Inputs Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
          {periodMode === 'month' ? (
            <div className="md:col-span-3">
              <label
                htmlFor="nopen-month-input"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                Pilih Bulan Rekap (1 Bulan)
              </label>
              <input
                id="nopen-month-input"
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedMonth(val);
                  if (val) {
                    const b = getMonthDateBounds(val);
                    setDateFrom(b.dateFrom);
                    setDateTo(b.dateTo);
                  }
                }}
                data-testid="nopen-month-input"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0D111C] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
          ) : (
            <>
              <div className="md:col-span-2">
                <label
                  htmlFor="nopen-date-from"
                  className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
                >
                  Dari Tanggal
                </label>
                <input
                  id="nopen-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  data-testid="nopen-date-from"
                  className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0D111C] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor="nopen-date-to"
                  className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
                >
                  Sampai Tanggal
                </label>
                <input
                  id="nopen-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  data-testid="nopen-date-to"
                  className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0D111C] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>
            </>
          )}

          {/* Search */}
          <div className={periodMode === 'month' ? 'md:col-span-3' : 'md:col-span-3'}>
            <label
              htmlFor="nopen-search-input"
              className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
            >
              Cari No. NOPEN / AJU / Customer / B/L
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="nopen-search-input"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="No. NOPEN, AJU, OS, Customer..."
                data-testid="nopen-search-input"
                className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
          </div>

          {/* Filter Jalur */}
          <div className="md:col-span-2">
            <label
              htmlFor="nopen-filter-jalur"
              className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
            >
              Jalur PIB
            </label>
            <select
              id="nopen-filter-jalur"
              value={filterJalur}
              onChange={(e) => setFilterJalur(e.target.value as '' | JalurType | '__EMPTY__')}
              className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="">Semua Jalur</option>
              {jalurList.map((j) => (
                <option key={j} value={j}>
                  Jalur {j}
                </option>
              ))}
              <option value="__EMPTY__">Belum Ada Jalur</option>
            </select>
          </div>

          {/* Filter Status */}
          <div className="md:col-span-2">
            <label
              htmlFor="nopen-filter-status"
              className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
            >
              Status Dokumen
            </label>
            <select
              id="nopen-filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="">Semua Status</option>
              {statusList.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Importir */}
          <div className={periodMode === 'month' ? 'md:col-span-2' : 'md:col-span-1'}>
            <label
              htmlFor="nopen-filter-importir"
              className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
            >
              Kode Importir
            </label>
            <select
              id="nopen-filter-importir"
              value={filterImportir}
              onChange={(e) => setFilterImportir(e.target.value)}
              className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="">Semua Importir</option>
              {distinctImportirOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} · {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bottom Option Row: Include Without NOPEN + Active Period Info + Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeWithoutNopen}
                onChange={(e) => setIncludeWithoutNopen(e.target.checked)}
                data-testid="nopen-include-empty-toggle"
                className="w-4 h-4 rounded border-slate-300 dark:border-white/20 text-violet-600 focus:ring-violet-500"
              />
              <span>Sertakan dokumen PIB / OS yang belum terbit No. NOPEN</span>
            </label>

            <span
              data-testid="nopen-period-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/30 text-[11px] font-semibold text-violet-800 dark:text-violet-200"
            >
              <Calendar className="w-3 h-3" />
              <span>Periode: {summary.periodLabel}</span>
            </span>
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </section>

      {/* 5 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-violet-500/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Dokumen NOPEN
            </span>
            <FileText className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div
            data-testid="nopen-kpi-total"
            className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums"
          >
            {summary.totalMatched}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {summary.totalWithNopen} terbit NOPEN
            {summary.totalWithoutNopen > 0 ? ` · ${summary.totalWithoutNopen} belum NOPEN` : ''}
          </div>
        </div>

        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-emerald-500/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Terbit SPPB
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
            {summary.totalSppb}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {summary.totalMatched > 0
              ? `${Math.round((summary.totalSppb / summary.totalMatched) * 100)}% sudah SPPB`
              : 'Belum ada data'}
          </div>
        </div>

        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-sky-500/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Gate-Out / Selesai
            </span>
            <Truck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-700 dark:text-sky-300 mt-1 tabular-nums">
            {summary.totalGateOut}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {summary.totalSelesai} selesai · {summary.totalOutstanding} masih OS
          </div>
        </div>

        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-amber-500/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ada SPTNP / Verif
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1 tabular-nums">
            {summary.totalSptnp}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Jalur Merah: {summary.byJalur.Merah || 0} · MITA: {summary.byJalur.MITA || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Nilai Invoice
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-2 tabular-nums leading-snug">
            {formatCurrencyTotals(summary.invoiceTotalsByCurrency)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Akumulasi periode terpilih
          </div>
        </div>
      </div>

      {/* Dual Summary Panels: Rekap Harian per Tgl. NOPEN + Rekap Importir & Jalur */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Rekap Harian per Tgl. NOPEN */}
        <section
          aria-label="Rekap harian tanggal NOPEN"
          data-testid="nopen-daily-recap"
          className="lg:col-span-6 bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Rekap Harian per Tgl. NOPEN
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Jumlah pendaftaran PIB per tanggal pada periode aktif
              </p>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
              {summary.byDay.length} Tanggal Aktif
            </span>
          </div>

          {summary.byDay.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Tidak ada dokumen pada periode ini.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-[#182032] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-white/[0.07]">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Tgl. NOPEN</th>
                    <th className="py-2 px-2.5 font-semibold text-center">Dok</th>
                    <th className="py-2 px-2.5 font-semibold text-center">Hijau</th>
                    <th className="py-2 px-2.5 font-semibold text-center">Kuning</th>
                    <th className="py-2 px-2.5 font-semibold text-center">Merah</th>
                    <th className="py-2 px-2.5 font-semibold text-center">MITA</th>
                    <th className="py-2 px-2.5 font-semibold text-center">SPPB</th>
                    <th className="py-2 px-2.5 font-semibold text-center">Gate-Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {summary.byDay.map((d) => (
                    <tr
                      key={d.date}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-2 px-3 font-mono-code font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {d.date}
                      </td>
                      <td className="py-2 px-2.5 text-center font-bold text-violet-700 dark:text-violet-300 tabular-nums">
                        {d.count}
                      </td>
                      <td className="py-2 px-2.5 text-center text-emerald-700 dark:text-emerald-300 tabular-nums">
                        {d.byJalur.Hijau || 0}
                      </td>
                      <td className="py-2 px-2.5 text-center text-amber-700 dark:text-amber-300 tabular-nums">
                        {d.byJalur.Kuning || 0}
                      </td>
                      <td className="py-2 px-2.5 text-center text-red-700 dark:text-red-300 tabular-nums">
                        {d.byJalur.Merah || 0}
                      </td>
                      <td className="py-2 px-2.5 text-center text-sky-700 dark:text-sky-300 tabular-nums">
                        {d.byJalur.MITA || 0}
                      </td>
                      <td className="py-2 px-2.5 text-center font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        {d.sppbCount}
                      </td>
                      <td className="py-2 px-2.5 text-center font-semibold text-sky-700 dark:text-sky-300 tabular-nums">
                        {d.gateOutCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right: Rekap per Kode Importir + Distribusi Jalur */}
        <section
          aria-label="Rekap importir periode NOPEN"
          data-testid="nopen-importir-recap"
          className="lg:col-span-6 bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden flex flex-col"
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span>Rekap Kode Importir Periode Ini</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Klik baris importir untuk menyaring tabel NOPEN di bawah
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold">
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                Hijau: {summary.byJalur.Hijau || 0}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300">
                Kuning: {summary.byJalur.Kuning || 0}
              </span>
              <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300">
                Merah: {summary.byJalur.Merah || 0}
              </span>
              <span className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300">
                MITA: {summary.byJalur.MITA || 0}
              </span>
            </div>
          </div>

          {summary.byImportir.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Belum ada rekap importir pada periode ini.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-[#182032] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-white/[0.07]">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Importir</th>
                    <th className="py-2 px-2.5 font-semibold text-center">Dok</th>
                    <th className="py-2 px-2.5 font-semibold text-center">SPPB</th>
                    <th className="py-2 px-2.5 font-semibold text-center">Gate-Out</th>
                    <th className="py-2 px-3 font-semibold text-right">Nilai Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {summary.byImportir.map((imp) => {
                    const isSelected =
                      filterImportir.toUpperCase() === imp.kodeImportir.toUpperCase();
                    return (
                      <tr
                        key={imp.kodeImportir}
                        onClick={() =>
                          setFilterImportir((cur) =>
                            cur.toUpperCase() === imp.kodeImportir.toUpperCase()
                              ? ''
                              : imp.kodeImportir
                          )
                        }
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-violet-50 dark:bg-violet-500/15'
                            : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        <td className="py-2 px-3">
                          <div className="font-mono-code font-bold text-[#0B2545] dark:text-violet-300">
                            {imp.kodeImportir}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                            {imp.namaImportir}
                          </div>
                        </td>
                        <td className="py-2 px-2.5 text-center font-bold text-slate-900 dark:text-white tabular-nums">
                          {imp.count}
                        </td>
                        <td className="py-2 px-2.5 text-center font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                          {imp.sppbCount}
                        </td>
                        <td className="py-2 px-2.5 text-center font-semibold text-sky-700 dark:text-sky-300 tabular-nums">
                          {imp.gateOutCount}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
                          {formatCurrencyTotals(imp.invoiceTotalsByCurrency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Main NOPEN Detail Table (Desktop) + Mobile Cards */}
      <section
        aria-label="Tabel rekapan dokumen berdasarkan No NOPEN"
        className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Daftar Dokumen PIB Berdasarkan No. NOPEN ({matchedRows.length})
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Urutan berdasarkan Tgl. NOPEN terbaru &amp; No. Pendaftaran PIB ({summary.periodLabel})
            </p>
          </div>
          {filterImportir && (
            <button
              type="button"
              onClick={() => setFilterImportir('')}
              className="px-2.5 py-1 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-200 text-[11px] font-semibold cursor-pointer"
            >
              Filter Importir: {filterImportir} ×
            </button>
          )}
        </div>

        {matchedRows.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              Tidak ada dokumen NOPEN yang sesuai dengan periode dan filter saat ini.
            </p>
            <p>
              Coba ubah bulan atau rentang tanggal, atau centang opsi{' '}
              <em>&ldquo;Sertakan dokumen PIB / OS yang belum terbit No. NOPEN&rdquo;</em>.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table
                data-testid="nopen-report-table"
                className="w-full text-left border-collapse text-xs min-w-[1220px]"
              >
                <thead className="bg-slate-50 dark:bg-[#182032] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-white/[0.08]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold text-center w-10">No</th>
                    <th className="py-2.5 px-3 font-semibold sticky left-0 z-10 bg-slate-50 dark:bg-[#182032] border-r border-slate-200/70 dark:border-white/[0.06] whitespace-nowrap">
                      No. NOPEN
                    </th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Tgl. NOPEN</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">No. AJU / Tgl</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Kode OS</th>
                    <th className="py-2.5 px-3 font-semibold">Customer &amp; Importir</th>
                    <th className="py-2.5 px-3 font-semibold">No. B/L &amp; Kontainer</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Jalur</th>
                    <th className="py-2.5 px-3 font-semibold">Status &amp; Gate-Out</th>
                    <th className="py-2.5 px-3 font-semibold">No. &amp; Tgl. SPPB</th>
                    <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                      Nilai Invoice
                    </th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">BM / PDRI</th>
                    <th className="py-2.5 px-3 font-semibold">Checker</th>
                    <th className="py-2.5 px-3 font-semibold text-center sticky right-0 z-10 bg-slate-50 dark:bg-[#182032] border-l border-slate-200/70 dark:border-white/[0.06] no-print">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {matchedRows.map((s, idx) => {
                    const impName = s.kodeImportir
                      ? importirNameMap.get(s.kodeImportir.trim().toUpperCase()) || ''
                      : '';
                    const sppbReady = isSppbReadyForGateOut(s);
                    const gateOutDone = isContainerGateOut(s);
                    const sptnpIssue = hasSptnpIssue(s);

                    return (
                      <tr
                        key={s.kodeOs}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors group"
                      >
                        <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 sticky left-0 z-10 bg-white dark:bg-[#131926] group-hover:bg-slate-50 dark:group-hover:bg-[#192133] border-r border-slate-100 dark:border-white/[0.06] whitespace-nowrap">
                          {s.nopen ? (
                            <span className="font-mono-code font-bold text-[#0B2545] dark:text-violet-300 text-[12.5px]">
                              {s.nopen}
                            </span>
                          ) : (
                            <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 text-[10.5px] font-medium">
                              Belum Terbit
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono-code text-slate-700 dark:text-slate-200 whitespace-nowrap tabular-nums">
                          {s.tglNopen || '-'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-mono-code text-[11px] text-slate-800 dark:text-slate-200">
                            {s.noAju || '-'}
                          </div>
                          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 tabular-nums">
                            {s.tglAju || '-'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(s.kodeOs)}
                            className="font-mono-code font-bold text-[#F28C28] dark:text-violet-300 hover:underline cursor-pointer"
                          >
                            {s.kodeOs}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 min-w-[200px]">
                          <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[230px]">
                            {s.namaCustomer}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[230px]">
                            {s.kodeImportir ? (
                              <>
                                <span className="font-mono-code font-semibold text-slate-700 dark:text-slate-300">
                                  {s.kodeImportir}
                                </span>
                                {impName ? ` · ${impName}` : ''}
                              </>
                            ) : (
                              'Kode Importir belum diisi'
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 min-w-[160px]">
                          <div className="font-mono-code text-[11px] text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                            {s.noBl || '-'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                            {s.noCont || '-'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <JalurBadge jalur={s.jalur} />
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap space-y-1">
                          <div>
                            <StatusBadge status={s.status} />
                          </div>
                          <div className="flex items-center gap-1">
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                gateOutDone
                                  ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {gateOutDone ? 'Sudah Gate-Out' : 'Belum Gate-Out'}
                            </span>
                            {sptnpIssue && (
                              <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                                SPTNP
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {sppbReady ? (
                            <>
                              <div className="font-mono-code text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                {s.noSppb || 'SPPB Terbit'}
                              </div>
                              <div className="text-[10.5px] text-slate-500 dark:text-slate-400 tabular-nums">
                                {s.tglSppb || '-'}
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-slate-900 dark:text-white tabular-nums">
                          {s.invoice !== ''
                            ? `${s.currency || 'USD'} ${new Intl.NumberFormat('en-US', {
                                maximumFractionDigits: 2,
                              }).format(Number(s.invoice))}`
                            : '-'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300 tabular-nums">
                          {s.bmPdri || '-'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                          {s.dokumenChecker || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center sticky right-0 z-10 bg-white dark:bg-[#131926] group-hover:bg-slate-50 dark:group-hover:bg-[#192133] border-l border-slate-100 dark:border-white/[0.06] no-print">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(s.kodeOs)}
                            title="Lihat detail 39 kolom"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-[11px] font-semibold cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div
              data-testid="mobile-nopen-report-cards"
              className="md:hidden divide-y divide-slate-100 dark:divide-white/[0.06]"
            >
              {matchedRows.map((s) => (
                <div key={s.kodeOs} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono-code text-sm font-bold text-[#0B2545] dark:text-violet-300">
                          {s.nopen ? `NOPEN ${s.nopen}` : 'Belum Ada NOPEN'}
                        </span>
                        <span className="text-[11px] font-mono-code text-slate-500 dark:text-slate-400">
                          {s.tglNopen || '-'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">
                        {s.namaCustomer}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {s.kodeOs} · Importir: {s.kodeImportir || '-'}
                      </div>
                    </div>
                    <JalurBadge jalur={s.jalur} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 dark:bg-[#0D111C] rounded-xl p-2.5 border border-slate-100 dark:border-white/[0.06]">
                    <div>
                      <div className="text-slate-400">No. AJU</div>
                      <div className="font-mono-code font-medium text-slate-700 dark:text-slate-200 truncate">
                        {s.noAju || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Nilai Invoice</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                        {s.invoice !== ''
                          ? `${s.currency || 'USD'} ${new Intl.NumberFormat('en-US', {
                              maximumFractionDigits: 2,
                            }).format(Number(s.invoice))}`
                          : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">No. SPPB</div>
                      <div className="font-mono-code text-emerald-700 dark:text-emerald-300 truncate">
                        {s.noSppb || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">BM / PDRI</div>
                      <div className="text-slate-700 dark:text-slate-200 truncate">
                        {s.bmPdri || '-'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <StatusBadge status={s.status} />
                    <button
                      type="button"
                      onClick={() => onOpenDetail(s.kodeOs)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0B2545] dark:bg-violet-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
