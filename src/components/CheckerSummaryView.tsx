import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderCheck,
  Printer,
  RotateCcw,
  Search,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  CheckerSummary,
  PhasePermissions,
  Shipment,
  StatusDokumenType,
  UserRole,
} from '../types/ppjk';
import {
  canUserEditAnyPhase,
  computeCheckerSummaries,
  getStatusBadgeClass,
  isUrgentMissingAju,
  normalizeStatusDokumen,
} from '../utils/ppjkLogic';
import {
  exportCheckerSummaryToCSV,
  exportCheckerSummaryToExcel,
  exportCheckerSummaryToPDF,
} from '../utils/exportUtils';
import { CountdownBadge, JalurBadge, StatusBadge, StatusDokumenBadge } from './Badges';

interface CheckerSummaryViewProps {
  shipments: Shipment[];
  statusList: string[];
  checklistItems: string[];
  userRole: UserRole;
  phasePermissions?: PhasePermissions;
  onOpenDetail: (kodeOs: string) => void;
  onEditShipment: (kodeOs: string) => void;
  onOpenCheckerInTable: (checkerName: string) => void;
}

function getInitials(name: string): string {
  if (!name || name === 'Belum Ditugaskan') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getStatusAccentBarColor(status: string): string {
  switch (status) {
    case 'Dokumen Diterima':
      return '#64748B';
    case 'Proses PIB/AJU':
      return '#0284C7';
    case 'Menunggu Jalur':
      return '#4F46E5';
    case 'Proses Pemeriksaan':
      return '#D97706';
    case 'SPPB Terbit':
      return '#0D9488';
    case 'Pasca-SPPB':
      return '#F28C28';
    case 'Selesai':
      return '#2E9E5B';
    default:
      return '#475569';
  }
}

export function CheckerSummaryView({
  shipments,
  statusList,
  checklistItems,
  userRole,
  phasePermissions,
  onOpenDetail,
  onEditShipment,
  onOpenCheckerInTable,
}: CheckerSummaryViewProps) {
  const [search, setSearch] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
  const [selectedDocStatusFilter, setSelectedDocStatusFilter] = useState<'' | StatusDokumenType>('');
  const [conditionFilter, setConditionFilter] = useState<'all' | 'outstanding' | 'completed'>('all');
  const [selectedCheckerName, setSelectedCheckerName] = useState<string | null>(null);
  const drilldownRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (selectedCheckerName && drilldownRef.current) {
      drilldownRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedCheckerName]);

  const summary = useMemo(
    () => computeCheckerSummaries(shipments, statusList, checklistItems),
    [shipments, statusList, checklistItems]
  );

  const allStatusNames = useMemo(
    () => summary.byStatus.map((item) => item.status),
    [summary.byStatus]
  );

  const filteredCheckers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summary.checkers.filter((c) => {
      if (q && !c.checkerName.toLowerCase().includes(q)) return false;
      if (selectedStatusFilter && (c.byStatus[selectedStatusFilter] || 0) === 0) return false;
      if (selectedDocStatusFilter === 'Draft' && c.draftCount === 0) return false;
      if (selectedDocStatusFilter === 'Ready' && c.readyCount === 0) return false;
      if (conditionFilter === 'outstanding' && c.outstanding === 0) return false;
      if (conditionFilter === 'completed' && c.outstanding > 0) return false;
      return true;
    });
  }, [summary.checkers, search, selectedStatusFilter, selectedDocStatusFilter, conditionFilter]);

  const activeChecker: CheckerSummary | null = useMemo(() => {
    if (!selectedCheckerName) return null;
    return (
      summary.checkers.find((c) => c.checkerName === selectedCheckerName) || null
    );
  }, [summary.checkers, selectedCheckerName]);

  const activeCheckerShipments = useMemo(() => {
    if (!activeChecker) return [];
    return activeChecker.shipments.filter((s) => {
      if (selectedStatusFilter && (s.status || 'Dokumen Diterima') !== selectedStatusFilter) {
        return false;
      }
      if (
        selectedDocStatusFilter &&
        normalizeStatusDokumen(s.statusDokumen) !== selectedDocStatusFilter
      ) {
        return false;
      }
      return true;
    });
  }, [activeChecker, selectedStatusFilter, selectedDocStatusFilter]);

  const canEdit = canUserEditAnyPhase({ role: userRole, phasePermissions });
  const overallCompletion =
    summary.totalDocuments > 0
      ? Math.round((summary.totalCompleted / summary.totalDocuments) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Print Header */}
      <div className="hidden print-only-header mb-4">
        <h2 className="text-lg font-bold">
          Rekapan Dokumen Checker &amp; Summary Semua Status — PTG PPJK
        </h2>
        <p className="text-xs text-slate-600">
          Dicetak: {new Date().toLocaleString('id-ID')} · Total Dokumen: {summary.totalDocuments} · Total Checker: {summary.totalCheckers}
        </p>
      </div>

      {/* SECTION 1: REKAPAN SUMMARY SEMUA STATUS PADA SEMUA DOKUMEN */}
      <section
        aria-label="Rekapan summary semua status pada semua dokumen"
        className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#0B2545]">
              Rekapan Summary Semua Status (Seluruh Dokumen)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Akumulasi status seluruh dokumen shipment impor. Klik kartu status untuk menyaring checker terkait.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="px-3 py-2 rounded-lg bg-[#0B2545] text-white flex items-center gap-2">
              <FolderCheck className="w-4 h-4 text-[#F28C28]" />
              <span>
                Total Dokumen: <strong className="tabular-nums">{summary.totalDocuments}</strong>
              </span>
            </div>
            <div className="px-3 py-2 rounded-lg bg-slate-100 text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0B2545]" />
              <span>
                Checker Aktif: <strong className="tabular-nums">{summary.totalCheckers}</strong>
              </span>
            </div>
            <div className="px-3 py-2 rounded-lg bg-orange-50 text-orange-800 border border-orange-200">
              Outstanding: <strong className="tabular-nums">{summary.totalOutstanding}</strong>
            </div>
            <div className="px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              Dok. Draft: <strong className="tabular-nums">{summary.totalDraft}</strong>
            </div>
            <div className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              Dok. Ready: <strong className="tabular-nums">{summary.totalReady}</strong>
            </div>
            <div className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              Selesai: <strong className="tabular-nums">{summary.totalCompleted}</strong> ({overallCompletion}%)
            </div>
          </div>
        </div>

        {/* Stacked Status Distribution Bar */}
        {summary.totalDocuments > 0 && (
          <div className="space-y-1.5">
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
              {summary.byStatus
                .filter((item) => item.count > 0)
                .map((item) => {
                  const widthPct = (item.count / summary.totalDocuments) * 100;
                  return (
                    <div
                      key={item.status}
                      title={`${item.status}: ${item.count} dokumen (${item.percentage}%)`}
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: getStatusAccentBarColor(item.status),
                      }}
                      className="h-full transition-all duration-300 border-r border-white/40 last:border-r-0"
                    />
                  );
                })}
            </div>
          </div>
        )}

        {/* Interactive Status Recap Cards */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3"
          data-testid="global-status-recap"
        >
          {summary.byStatus.map((item) => {
            const isSelected = selectedStatusFilter === item.status;
            const accentHex = getStatusAccentBarColor(item.status);
            return (
              <button
                key={item.status}
                type="button"
                onClick={() =>
                  setSelectedStatusFilter((prev) =>
                    prev === item.status ? '' : item.status
                  )
                }
                aria-pressed={isSelected}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#0B2545] text-white border-[#0B2545] ring-2 ring-[#F28C28]/60'
                    : 'bg-slate-50/80 hover:bg-slate-100 text-slate-900 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: isSelected ? '#F28C28' : accentHex }}
                  />
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      isSelected ? 'text-white/80' : 'text-slate-500'
                    }`}
                  >
                    {item.percentage}%
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold mt-2 tabular-nums ${
                    isSelected ? 'text-white' : 'text-[#0B2545]'
                  }`}
                >
                  {item.count}
                </div>
                <div
                  className={`text-xs font-medium mt-1 leading-snug ${
                    isSelected ? 'text-white/90' : 'text-slate-700'
                  }`}
                >
                  {item.status}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* TOOLBAR FILTER & EXPORT */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Cari nama checker"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama checker..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28]"
            />
          </div>

          <select
            aria-label="Filter status checker"
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#F28C28]"
          >
            <option value="">Semua Status</option>
            {allStatusNames.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter status dokumen draft atau ready"
            value={selectedDocStatusFilter}
            onChange={(e) =>
              setSelectedDocStatusFilter(e.target.value as '' | StatusDokumenType)
            }
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#F28C28]"
          >
            <option value="">Status Dok: Semua</option>
            <option value="Draft">Dokumen: Draft</option>
            <option value="Ready">Dokumen: Ready</option>
          </select>

          <select
            aria-label="Filter kondisi outstanding checker"
            value={conditionFilter}
            onChange={(e) =>
              setConditionFilter(e.target.value as 'all' | 'outstanding' | 'completed')
            }
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#F28C28]"
          >
            <option value="all">Semua Checker</option>
            <option value="outstanding">Masih Ada Outstanding</option>
            <option value="completed">Sudah Selesai Semua</option>
          </select>

          {(search || selectedStatusFilter || selectedDocStatusFilter || conditionFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedStatusFilter('');
                setSelectedDocStatusFilter('');
                setConditionFilter('all');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportCheckerSummaryToExcel(filteredCheckers, allStatusNames)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={() => exportCheckerSummaryToCSV(filteredCheckers, allStatusNames)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-sky-600" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => exportCheckerSummaryToPDF(filteredCheckers, allStatusNames)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-red-600" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-800 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: TAMPILAN KARTU MASING-MASING NAMA CHECKER */}
      <section aria-label="Kartu ringkasan per nama checker" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#0B2545] flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#F28C28]" />
            <span>
              Daftar Kartu Dokumen Checker ({filteredCheckers.length})
            </span>
          </h3>
          {selectedStatusFilter && (
            <span className="text-xs text-slate-600">
              Menampilkan checker dengan status:{' '}
              <strong className="text-[#0B2545]">{selectedStatusFilter}</strong>
            </span>
          )}
        </div>

        {filteredCheckers.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">
              {shipments.length === 0
                ? 'Belum ada data shipment dan checker tercatat.'
                : 'Tidak ada checker yang sesuai dengan filter saat ini.'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {shipments.length === 0
                ? 'Tambahkan shipment baru dan isi kolom Dokumen Checker untuk melihat kartu ringkasan.'
                : 'Ubah kata kunci pencarian atau reset filter untuk melihat seluruh checker.'}
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            data-testid="checker-cards-grid"
          >
            {filteredCheckers.map((checker) => {
              const isSelected = selectedCheckerName === checker.checkerName;
              const isUnassigned = checker.checkerName === 'Belum Ditugaskan';
              return (
                <article
                  key={checker.checkerName}
                  data-testid={`checker-card-${checker.checkerName}`}
                  className={`bg-white rounded-xl border p-5 flex flex-col justify-between gap-4 transition-all ${
                    isSelected
                      ? 'border-[#F28C28] ring-2 ring-[#F28C28]/25'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Card Header: Avatar + Checker Name + Total */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                            isUnassigned
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-[#0B2545] text-white'
                          }`}
                        >
                          {getInitials(checker.checkerName)}
                        </div>
                        <div className="min-w-0">
                          <h4
                            className="text-sm font-bold text-[#0B2545] truncate"
                            title={checker.checkerName}
                          >
                            {checker.checkerName}
                          </h4>
                          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                            {checker.total} total dokumen · {checker.etaNext7Days} ETA &le; 7h
                          </div>
                        </div>
                      </div>

                      {checker.urgentMissingAju > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold shrink-0 tabular-nums">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{checker.urgentMissingAju} Urgent</span>
                        </span>
                      ) : checker.outstanding === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Lengkap</span>
                        </span>
                      ) : null}
                    </div>

                    {/* KPI Metrics Trio + Completion Progress */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                          <div className="text-[11px] text-slate-500">Total</div>
                          <div className="text-lg font-bold text-[#0B2545] tabular-nums">
                            {checker.total}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-orange-50/70 border border-orange-200/70">
                          <div className="text-[11px] text-orange-800">Outstanding</div>
                          <div className="text-lg font-bold text-[#D97719] tabular-nums">
                            {checker.outstanding}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/70">
                          <div className="text-[11px] text-emerald-800">Selesai</div>
                          <div className="text-lg font-bold text-[#1F7A43] tabular-nums">
                            {checker.completed}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                          <span className="font-medium">Dok. Draft</span>
                          <span className="font-bold tabular-nums">{checker.draftCount}</span>
                        </div>
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                          <span className="font-medium">Dok. Ready</span>
                          <span className="font-bold tabular-nums">{checker.readyCount}</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span>Tingkat Penyelesaian OS</span>
                          <span className="font-semibold text-[#0B2545] tabular-nums">
                            {checker.completionRate}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-[#2E9E5B] rounded-full transition-all duration-300"
                            style={{ width: `${checker.completionRate}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Per-Status Breakdown inside Checker Card */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Rincian Status Dokumen
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {allStatusNames.map((st) => {
                          const cnt = checker.byStatus[st] || 0;
                          const badgeCls = getStatusBadgeClass(st);
                          return (
                            <div
                              key={st}
                              className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
                                cnt > 0
                                  ? badgeCls
                                  : 'bg-slate-50/50 text-slate-400 border-slate-100'
                              }`}
                            >
                              <span className="truncate" title={st}>
                                {st}
                              </span>
                              <span className="font-bold tabular-nums shrink-0">
                                {cnt}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Jalur Summary Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-medium text-slate-500 mr-1">Jalur:</span>
                      {(['Hijau', 'Kuning', 'Merah', 'MITA', 'Belum Ada'] as const).map((jl) => {
                        const count = checker.byJalur[jl] || 0;
                        if (count === 0) return null;
                        return (
                          <span
                            key={jl}
                            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium tabular-nums"
                          >
                            {jl}: <strong>{count}</strong>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 no-print">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCheckerName((prev) =>
                          prev === checker.checkerName ? null : checker.checkerName
                        )
                      }
                      className={`flex-1 min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#0B2545] text-white'
                          : 'bg-[#F28C28] hover:bg-[#D97719] text-white'
                      }`}
                    >
                      {isSelected
                        ? 'Tutup Daftar'
                        : `Lihat Dokumen (${checker.total})`}
                    </button>
                    {!isUnassigned && (
                      <button
                        type="button"
                        onClick={() => onOpenCheckerInTable(checker.checkerName)}
                        title="Buka di halaman Semua Shipment dengan filter checker ini"
                        className="min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Tabel</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 3: DRILL-DOWN DAFTAR SHIPMENT MILIK CHECKER TERPILIH */}
      {activeChecker && (
        <section
          ref={drilldownRef}
          aria-label={`Daftar dokumen milik ${activeChecker.checkerName}`}
          data-testid="checker-drilldown-panel"
          className="bg-white rounded-xl border border-[#F28C28]/50 p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#0B2545]">
                Dokumen Ditangani: {activeChecker.checkerName}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Menampilkan {activeCheckerShipments.length} dokumen
                {selectedStatusFilter ? ` dengan status "${selectedStatusFilter}"` : ''}. Klik baris untuk membuka detail 39 kolom.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCheckerName(null)}
              aria-label="Tutup daftar dokumen checker"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Tutup</span>
            </button>
          </div>

          {activeCheckerShipments.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Tidak ada dokumen yang cocok dengan filter status saat ini.
            </p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <th className="py-2.5 px-3 font-semibold">Kode OS</th>
                      <th className="py-2.5 px-3 font-semibold">Customer</th>
                      <th className="py-2.5 px-3 font-semibold">No. BL</th>
                      <th className="py-2.5 px-3 font-semibold">ETA</th>
                      <th className="py-2.5 px-3 font-semibold">Count Down ETA</th>
                      <th className="py-2.5 px-3 font-semibold">Status Dok</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Jalur</th>
                      <th className="py-2.5 px-3 font-semibold text-right no-print">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeCheckerShipments.map((s) => {
                      const urgent = isUrgentMissingAju(s);
                      return (
                        <tr
                          key={s.kodeOs}
                          onClick={() => onOpenDetail(s.kodeOs)}
                          className={`cursor-pointer transition-colors ${
                            urgent ? 'bg-red-50/75 hover:bg-red-100/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono-code font-semibold text-[#0B2545] whitespace-nowrap">
                            {s.kodeOs}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {s.namaCustomer}
                          </td>
                          <td className="py-2.5 px-3 font-mono-code text-slate-700 whitespace-nowrap">
                            {s.noBl}
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-slate-700 whitespace-nowrap">
                            {s.eta || '-'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <CountdownBadge days={s.countDownEta} />
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <StatusDokumenBadge statusDokumen={s.statusDokumen} />
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <StatusBadge status={s.status} />
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <JalurBadge jalur={s.jalur} />
                          </td>
                          <td
                            className="py-2.5 px-3 text-right whitespace-nowrap no-print"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenDetail(s.kodeOs)}
                                className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 cursor-pointer"
                              >
                                Detail
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => onEditShipment(s.kodeOs)}
                                  className="px-2.5 py-1 rounded-md bg-slate-200 hover:bg-slate-300 text-[11px] font-semibold text-slate-800 cursor-pointer"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-2.5">
                {activeCheckerShipments.map((s) => (
                  <div
                    key={s.kodeOs}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono-code text-xs font-bold text-[#0B2545]">
                          {s.kodeOs}
                        </div>
                        <div className="text-sm font-semibold text-slate-900">
                          {s.namaCustomer}
                        </div>
                      </div>
                      <CountdownBadge days={s.countDownEta} />
                    </div>
                    <div className="text-xs text-slate-600">
                      BL: <span className="font-mono-code">{s.noBl}</span> · ETA:{' '}
                      <span className="tabular-nums">{s.eta || '-'}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusDokumenBadge statusDokumen={s.statusDokumen} />
                      <StatusBadge status={s.status} />
                      <JalurBadge jalur={s.jalur} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(s.kodeOs)}
                        className="flex-1 min-h-[40px] rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 cursor-pointer"
                      >
                        Lihat 39 Kolom
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onEditShipment(s.kodeOs)}
                          className="flex-1 min-h-[40px] rounded-lg bg-[#F28C28] text-xs font-semibold text-white cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
