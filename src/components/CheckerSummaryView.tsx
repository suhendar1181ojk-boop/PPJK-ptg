import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderCheck,
  Lock,
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
  UserAccount,
  UserRole,
} from '../types/ppjk';
import {
  canUserEditAnyPhase,
  canUserEditPhase,
  canUserEditShipmentRecord,
  computeCheckerSummaries,
  getShipmentProcessSignal,
  getStatusBadgeClass,
  isCheckerRole,
  isUrgentMissingAju,
  normalizeStatusDokumen,
} from '../utils/ppjkLogic';
import {
  exportCheckerSummaryToCSV,
  exportCheckerSummaryToExcel,
  exportCheckerSummaryToPDF,
} from '../utils/exportUtils';
import { useCardCollapse } from '../contexts/CardCollapseContext';
import { CardWindowToggleButton, ModuleCardBatchToggle } from './CardWindowControls';
import {
  CountdownBadge,
  JalurBadge,
  ProcessSignalBadge,
  StatusBadge,
  StatusDokumenBadge,
} from './Badges';

interface CheckerSummaryViewProps {
  shipments: Shipment[];
  statusList: string[];
  checklistItems: string[];
  userRole: UserRole;
  phasePermissions?: PhasePermissions;
  currentUserName?: string;
  currentUserUsername?: string;
  users?: UserAccount[];
  onOpenDetail: (kodeOs: string) => void;
  onEditShipment: (kodeOs: string) => void;
  onOpenCheckerInTable: (checkerName: string) => void;
  onUpdateStatusDokumen?: (kodeOs: string, nextStatus: StatusDokumenType) => Promise<void>;
  initialCheckerName?: string | null;
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
      return '#6366F1';
    case 'Proses Pemeriksaan':
      return '#D97706';
    case 'SPPB Terbit':
      return '#0D9488';
    case 'Pasca-SPPB':
      return '#F28C28';
    case 'Selesai':
      return '#22C55E';
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
  currentUserName = '',
  currentUserUsername = '',
  users = [],
  onOpenDetail,
  onEditShipment,
  onOpenCheckerInTable,
  onUpdateStatusDokumen,
  initialCheckerName = null,
}: CheckerSummaryViewProps) {
  const [search, setSearch] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
  const [selectedDocStatusFilter, setSelectedDocStatusFilter] = useState<'' | StatusDokumenType>('');
  const [conditionFilter, setConditionFilter] = useState<'all' | 'outstanding' | 'completed'>('all');
  const [selectedCheckerName, setSelectedCheckerName] = useState<string | null>(
    initialCheckerName || null
  );
  const drilldownRef = useRef<HTMLElement | null>(null);
  const { isCollapsed } = useCardCollapse();

  useEffect(() => {
    if (initialCheckerName) {
      setSelectedCheckerName(initialCheckerName);
    }
  }, [initialCheckerName]);

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
  const canEditPhase1 = canUserEditPhase({ role: userRole, phasePermissions }, 1);
  const getRowEditAccess = (s: Shipment) =>
    canUserEditShipmentRecord(
      s,
      {
        username: currentUserUsername,
        nama: currentUserName,
        role: userRole,
        phasePermissions,
      },
      users
    );
  const overallCompletion =
    summary.totalDocuments > 0
      ? Math.round((summary.totalCompleted / summary.totalDocuments) * 100)
      : 0;

  const selectCls =
    'px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#F28C28] dark:focus:border-violet-500';

  const checkerModuleCardIds = useMemo(() => {
    const ids = [
      'checker-overall-summary',
      'checker-filter-toolbar',
      ...filteredCheckers.map((c) => `checker-card-${c.checkerName}`),
    ];
    if (activeChecker) ids.push('checker-drilldown');
    return ids;
  }, [filteredCheckers, activeChecker]);

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

      {isCheckerRole(userRole) && (
        <div
          data-testid="checker-isolation-banner"
          className="rounded-xl border border-violet-200 dark:border-violet-500/35 bg-violet-50/80 dark:bg-violet-500/10 px-4 py-2.5 text-xs text-violet-900 dark:text-violet-200 flex items-center gap-2 no-print"
        >
          <UserCheck className="w-4 h-4 shrink-0" />
          <span>
            Mode Tampilan Checker: Hanya menampilkan dokumen yang dipegang atas nama akun Anda sendiri ({currentUserName || currentUserUsername}).
          </span>
        </div>
      )}

      {/* SECTION 1: REKAPAN SUMMARY SEMUA STATUS PADA SEMUA DOKUMEN */}
      <section
        aria-label="Rekapan summary semua status pada semua dokumen"
        className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#0B2545] dark:text-white">
              Rekapan Summary Semua Status (Seluruh Dokumen)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isCollapsed('checker-overall-summary')
                ? `${summary.totalDocuments} dokumen · ${summary.totalCheckers} checker · ${overallCompletion}% selesai`
                : 'Akumulasi status seluruh dokumen shipment impor. Klik kartu status untuk menyaring checker terkait.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <ModuleCardBatchToggle cardIds={checkerModuleCardIds} moduleName="checker" />
            <CardWindowToggleButton
              cardId="checker-overall-summary"
              label="Rekapan Summary Semua Status"
              compact
            />
          </div>
        </div>

        {!isCollapsed('checker-overall-summary') && (
          <>
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <div className="px-3 py-2 rounded-xl bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white flex items-center gap-2">
                <FolderCheck className="w-4 h-4 text-[#F28C28] dark:text-white" />
                <span>
                  Total Dokumen: <strong className="tabular-nums">{summary.totalDocuments}</strong>
                </span>
              </div>
              <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#182032] text-slate-800 dark:text-slate-200 border border-transparent dark:border-white/[0.08] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#0B2545] dark:text-violet-400" />
                <span>
                  Checker Aktif: <strong className="tabular-nums">{summary.totalCheckers}</strong>
                </span>
              </div>
              <div className="px-3 py-2 rounded-xl bg-orange-50 dark:bg-amber-500/15 text-orange-800 dark:text-amber-300 border border-orange-200 dark:border-amber-500/30">
                Outstanding: <strong className="tabular-nums">{summary.totalOutstanding}</strong>
              </div>
              {summary.totalProcessSignal > 0 && (
                <div className="px-3 py-2 rounded-xl bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-500/40 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 dark:bg-red-500" />
                  </span>
                  <span>
                    Segera Proses: <strong className="tabular-nums">{summary.totalProcessSignal}</strong>
                  </span>
                </div>
              )}
              <div className="px-3 py-2 rounded-xl bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-500/35">
                Dok. Draft: <strong className="tabular-nums">{summary.totalDraft}</strong>
              </div>
              <div className="px-3 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/35">
                Dok. Ready: <strong className="tabular-nums">{summary.totalReady}</strong>
              </div>
              <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                Selesai: <strong className="tabular-nums">{summary.totalCompleted}</strong> ({overallCompletion}%)
              </div>
            </div>

            {/* Stacked Status Distribution Bar */}
            {summary.totalDocuments > 0 && (
              <div className="space-y-1.5">
                <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-[#182032] overflow-hidden flex">
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
                          className="h-full transition-all duration-300 border-r border-white/40 dark:border-black/30 last:border-r-0"
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
                    ? 'bg-[#0B2545] dark:bg-gradient-to-br dark:from-[#7C3AED] dark:to-[#6366F1] text-white border-[#0B2545] dark:border-violet-400 ring-2 ring-[#F28C28]/60 dark:ring-violet-400/50'
                    : 'bg-slate-50/80 dark:bg-[#161D2F] hover:bg-slate-100 dark:hover:bg-[#1D263C] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-white/[0.07]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: isSelected ? '#F28C28' : accentHex }}
                  />
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.percentage}%
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold mt-2 tabular-nums ${
                    isSelected ? 'text-white' : 'text-[#0B2545] dark:text-white'
                  }`}
                >
                  {item.count}
                </div>
                <div
                  className={`text-xs font-medium mt-1 leading-snug ${
                    isSelected ? 'text-white/90' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {item.status}
                </div>
              </button>
            );
          })}
            </div>
          </>
        )}
      </section>

      {/* TOOLBAR FILTER & EXPORT */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0B2545] dark:text-white">
            <Search className="w-3.5 h-3.5 text-[#F28C28] dark:text-violet-400" />
            <span>Filter &amp; Ekspor Rekap Checker</span>
            {isCollapsed('checker-filter-toolbar') && (
              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 tabular-nums">
                ({filteredCheckers.length} checker tampil)
              </span>
            )}
          </div>
          <CardWindowToggleButton
            cardId="checker-filter-toolbar"
            label="Filter dan Ekspor Rekap Checker"
            compact
          />
        </div>
        {!isCollapsed('checker-filter-toolbar') && (
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Cari nama checker"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama checker..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40"
            />
          </div>

          <select
            aria-label="Filter status checker"
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className={selectCls}
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
            className={selectCls}
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
            className={selectCls}
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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={() => exportCheckerSummaryToCSV(filteredCheckers, allStatusNames)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => exportCheckerSummaryToPDF(filteredCheckers, allStatusNames)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak</span>
          </button>
        </div>
        </div>
        )}
      </div>

      {/* SECTION 2: TAMPILAN KARTU MASING-MASING NAMA CHECKER */}
      <section aria-label="Kartu ringkasan per nama checker" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#0B2545] dark:text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#F28C28] dark:text-violet-400" />
            <span>
              Daftar Kartu Dokumen Checker ({filteredCheckers.length})
            </span>
          </h3>
          {selectedStatusFilter && (
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Menampilkan checker dengan status:{' '}
              <strong className="text-[#0B2545] dark:text-violet-300">{selectedStatusFilter}</strong>
            </span>
          )}
        </div>

        {filteredCheckers.length === 0 ? (
          <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-10 text-center">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {shipments.length === 0
                ? 'Belum ada data shipment dan checker tercatat.'
                : 'Tidak ada checker yang sesuai dengan filter saat ini.'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
              const cardId = `checker-card-${checker.checkerName}`;
              const cardCollapsed = isCollapsed(cardId);
              return (
                <article
                  key={checker.checkerName}
                  data-testid={`checker-card-${checker.checkerName}`}
                  className={`bg-white dark:bg-[#131926] rounded-2xl border flex flex-col justify-between gap-4 transition-all ${
                    cardCollapsed ? 'p-4' : 'p-5'
                  } ${
                    isSelected
                      ? 'border-[#F28C28] dark:border-violet-500 ring-2 ring-[#F28C28]/25 dark:ring-violet-500/30'
                      : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Card Header: Avatar + Checker Name + Total + Minimize */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                            isUnassigned
                              ? 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                              : 'bg-[#0B2545] dark:bg-gradient-to-br dark:from-[#7C3AED] dark:to-[#6366F1] text-white'
                          }`}
                        >
                          {getInitials(checker.checkerName)}
                        </div>
                        <div className="min-w-0">
                          <h4
                            className="text-sm font-bold text-[#0B2545] dark:text-white truncate"
                            title={checker.checkerName}
                          >
                            {checker.checkerName}
                          </h4>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums truncate">
                            {cardCollapsed
                              ? `${checker.total} dok · ${checker.outstanding} OS · ${checker.completed} selesai`
                              : `${checker.total} total dokumen · ${checker.etaNext7Days} ETA ≤ 7h`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!cardCollapsed && (
                          checker.processSignalCount > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-500/40 text-[11px] font-bold shrink-0 tabular-nums">
                              <span className="relative flex h-2 w-2 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 dark:bg-red-500" />
                              </span>
                              <span>{checker.processSignalCount} Segera Proses</span>
                            </span>
                          ) : checker.urgentMissingAju > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/35 text-[11px] font-semibold shrink-0 tabular-nums">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{checker.urgentMissingAju} Urgent</span>
                            </span>
                          ) : checker.outstanding === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/35 text-[11px] font-semibold shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Lengkap</span>
                            </span>
                          ) : null
                        )}
                        <CardWindowToggleButton
                          cardId={cardId}
                          label={`Checker ${checker.checkerName}`}
                          compact
                        />
                      </div>
                    </div>

                    {!cardCollapsed && (
                    <>

                    {/* KPI Metrics Trio + Completion Progress */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200/70 dark:border-white/[0.06]">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">Total</div>
                          <div className="text-lg font-bold text-[#0B2545] dark:text-white tabular-nums">
                            {checker.total}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-orange-50/70 dark:bg-amber-500/15 border border-orange-200/70 dark:border-amber-500/30">
                          <div className="text-[11px] text-orange-800 dark:text-amber-300">Outstanding</div>
                          <div className="text-lg font-bold text-[#D97719] dark:text-amber-400 tabular-nums">
                            {checker.outstanding}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/15 border border-emerald-200/70 dark:border-emerald-500/30">
                          <div className="text-[11px] text-emerald-800 dark:text-emerald-300">Selesai</div>
                          <div className="text-lg font-bold text-[#1F7A43] dark:text-emerald-400 tabular-nums">
                            {checker.completed}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-yellow-100 dark:bg-yellow-500/15 border border-yellow-300 dark:border-yellow-500/35 text-xs text-yellow-800 dark:text-yellow-300">
                          <span className="font-medium">Dok. Draft</span>
                          <span className="font-bold tabular-nums">{checker.draftCount}</span>
                        </div>
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/35 text-xs text-emerald-800 dark:text-emerald-300">
                          <span className="font-medium">Dok. Ready</span>
                          <span className="font-bold tabular-nums">{checker.readyCount}</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                          <span>Tingkat Penyelesaian OS</span>
                          <span className="font-semibold text-[#0B2545] dark:text-white tabular-nums">
                            {checker.completionRate}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#182032] overflow-hidden">
                          <div
                            className="h-full bg-[#2E9E5B] dark:bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${checker.completionRate}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Per-Status Breakdown inside Checker Card */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
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
                                  : 'bg-slate-50/50 dark:bg-[#161D2F] text-slate-400 dark:text-slate-500 border-slate-100 dark:border-white/[0.05]'
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
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">Jalur:</span>
                      {(['Hijau', 'Kuning', 'Merah', 'MITA', 'Belum Ada'] as const).map((jl) => {
                        const count = checker.byJalur[jl] || 0;
                        if (count === 0) return null;
                        return (
                          <span
                            key={jl}
                            className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#182032] border border-transparent dark:border-white/[0.07] text-slate-700 dark:text-slate-300 text-[11px] font-medium tabular-nums"
                          >
                            {jl}: <strong>{count}</strong>
                          </span>
                        );
                      })}
                    </div>
                    </>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  {!cardCollapsed && (
                  <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex flex-wrap gap-2 no-print">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCheckerName((prev) =>
                          prev === checker.checkerName ? null : checker.checkerName
                        )
                      }
                      className={`flex-1 min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#0B2545] dark:bg-white/15 text-white'
                          : 'bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white'
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
                        className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Tabel</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  )}
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
          className="bg-white dark:bg-[#131926] rounded-2xl border border-[#F28C28]/50 dark:border-violet-500/40 p-5 space-y-4"
        >
          <div
            className={`flex flex-wrap items-center justify-between gap-3 ${
              isCollapsed('checker-drilldown')
                ? ''
                : 'border-b border-slate-100 dark:border-white/[0.08] pb-3'
            }`}
          >
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#0B2545] dark:text-white">
                Dokumen Ditangani: {activeChecker.checkerName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Menampilkan {activeCheckerShipments.length} dokumen
                {selectedStatusFilter ? ` dengan status "${selectedStatusFilter}"` : ''}. Klik baris untuk membuka detail 39 kolom.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <CardWindowToggleButton
                cardId="checker-drilldown"
                label={`Dokumen Ditangani ${activeChecker.checkerName}`}
                compact
              />
              <button
                type="button"
                onClick={() => setSelectedCheckerName(null)}
                aria-label="Tutup daftar dokumen checker"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tutup</span>
              </button>
            </div>
          </div>

          {!isCollapsed('checker-drilldown') && (
            activeCheckerShipments.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
              Tidak ada dokumen yang cocok dengan filter status saat ini.
            </p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#182032] border-b border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300">
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
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {activeCheckerShipments.map((s) => {
                      const urgent = isUrgentMissingAju(s);
                      const sig = getShipmentProcessSignal(s);
                      const rowEditAccess = getRowEditAccess(s);
                      return (
                        <tr
                          key={s.kodeOs}
                          onClick={() => onOpenDetail(s.kodeOs)}
                          className={`cursor-pointer transition-colors ${
                            urgent || sig.active
                              ? 'bg-red-50/75 dark:bg-red-950/30 hover:bg-red-100/70 dark:hover:bg-red-950/45'
                              : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono-code font-semibold text-[#0B2545] dark:text-violet-300 whitespace-nowrap">
                            <div>{s.kodeOs}</div>
                            {sig.active && (
                              <div className="mt-0.5">
                                <ProcessSignalBadge shipment={s} compact />
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                            {s.namaCustomer}
                          </td>
                          <td className="py-2.5 px-3 font-mono-code text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {s.noBl}
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {s.eta || '-'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <CountdownBadge days={s.countDownEta} />
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <StatusDokumenBadge
                              statusDokumen={s.statusDokumen}
                              onToggle={
                                canEditPhase1 && rowEditAccess.allowed && onUpdateStatusDokumen
                                  ? (next) => void onUpdateStatusDokumen(s.kodeOs, next)
                                  : undefined
                              }
                            />
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
                                className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-[11px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                              >
                                Detail
                              </button>
                              {canEdit && rowEditAccess.allowed ? (
                                <button
                                  type="button"
                                  onClick={() => onEditShipment(s.kodeOs)}
                                  className="px-2.5 py-1 rounded-md bg-slate-200 dark:bg-violet-500/20 hover:bg-slate-300 dark:hover:bg-violet-500/30 text-[11px] font-semibold text-slate-800 dark:text-violet-200 cursor-pointer"
                                >
                                  Edit
                                </button>
                              ) : !rowEditAccess.allowed ? (
                                <button
                                  type="button"
                                  disabled
                                  title={rowEditAccess.reason}
                                  data-testid={`checker-locked-edit-${s.kodeOs}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-[11px] font-semibold text-amber-700 dark:text-amber-300 cursor-not-allowed opacity-85"
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>Terkunci</span>
                                </button>
                              ) : null}
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
                {activeCheckerShipments.map((s) => {
                  const rowEditAccess = getRowEditAccess(s);
                  return (
                  <div
                    key={s.kodeOs}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#161D2F] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono-code text-xs font-bold text-[#0B2545] dark:text-violet-300">
                          {s.kodeOs}
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {s.namaCustomer}
                        </div>
                      </div>
                      <CountdownBadge days={s.countDownEta} />
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      BL: <span className="font-mono-code text-slate-800 dark:text-slate-200">{s.noBl}</span> · ETA:{' '}
                      <span className="tabular-nums text-slate-800 dark:text-slate-200">{s.eta || '-'}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <ProcessSignalBadge shipment={s} compact />
                      <StatusDokumenBadge
                        statusDokumen={s.statusDokumen}
                        onToggle={
                          canEditPhase1 && rowEditAccess.allowed && onUpdateStatusDokumen
                            ? (next) => void onUpdateStatusDokumen(s.kodeOs, next)
                            : undefined
                        }
                      />
                      <StatusBadge status={s.status} />
                      <JalurBadge jalur={s.jalur} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(s.kodeOs)}
                        className="flex-1 min-h-[40px] rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                      >
                        Lihat 39 Kolom
                      </button>
                      {canEdit && rowEditAccess.allowed ? (
                        <button
                          type="button"
                          onClick={() => onEditShipment(s.kodeOs)}
                          className="flex-1 min-h-[40px] rounded-lg bg-[#F28C28] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-xs font-semibold text-white cursor-pointer"
                        >
                          Edit
                        </button>
                      ) : !rowEditAccess.allowed ? (
                        <button
                          type="button"
                          disabled
                          title={rowEditAccess.reason}
                          className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-xs font-semibold text-amber-700 dark:text-amber-300 cursor-not-allowed opacity-85"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Terkunci</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  );
                })}
              </div>
            </>
          )
          )}
        </section>
      )}
    </div>
  );
}
