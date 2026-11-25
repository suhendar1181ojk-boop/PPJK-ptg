import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck2,
  History,
  PackageCheck,
  Receipt,
  UserCheck,
} from 'lucide-react';
import type {
  AppView,
  LogPerubahan,
  ModulePermissionsMap,
  Shipment,
  UserRole,
} from '../types/ppjk';
import {
  computeBillingSummary,
  computeCheckerSummaries,
  computeDashboardStats,
  DEFAULT_STATUS_LIST,
  formatDashboardDateLabel,
  getShipmentProcessSignal,
  getStatusBadgeClass,
  isShipmentOutstanding,
  isUrgentMissingAju,
} from '../utils/ppjkLogic';
import { useCardCollapse } from '../contexts/CardCollapseContext';
import { CardWindowToggleButton, ModuleCardBatchToggle } from './CardWindowControls';
import {
  CountdownBadge,
  JalurBadge,
  ProcessSignalBadge,
  StatusBadge,
  StatusDokumenBadge,
} from './Badges';

Chart.register(...registerables);

interface DashboardViewProps {
  shipments: Shipment[];
  logs?: LogPerubahan[];
  statusList?: string[];
  checklistItems: string[];
  userName?: string;
  userRole?: UserRole;
  moduleAccess?: ModulePermissionsMap;
  ppjkBrandName?: string;
  darkMode?: boolean;
  onOpenDetail: (kodeOs: string) => void;
  onNavigateView?: (v: AppView) => void;
  onOpenChecker?: (checkerName: string) => void;
  onGoToOutstanding: () => void;
}

const JALUR_CONFIG: Array<{
  key: string;
  label: string;
  color: string;
  dotClass: string;
}> = [
  { key: 'Hijau', label: 'Jalur Hijau', color: '#22C55E', dotClass: 'bg-emerald-500' },
  { key: 'Kuning', label: 'Jalur Kuning', color: '#F59E0B', dotClass: 'bg-amber-400' },
  { key: 'Merah', label: 'Jalur Merah', color: '#EF4444', dotClass: 'bg-red-500' },
  { key: 'MITA', label: 'Jalur MITA', color: '#3B82F6', dotClass: 'bg-blue-500' },
  { key: 'Belum Ada', label: 'Belum Ada Jalur', color: '#64748B', dotClass: 'bg-slate-400' },
];

export function DashboardView({
  shipments,
  logs = [],
  statusList = DEFAULT_STATUS_LIST,
  checklistItems,
  userName = 'Tim PPJK',
  ppjkBrandName = 'PTG PPJK',
  darkMode = true,
  onOpenDetail,
  onNavigateView,
  onOpenChecker,
  onGoToOutstanding,
}: DashboardViewProps) {
  const stats = computeDashboardStats(shipments, checklistItems);
  const checkerSummary = useMemo(
    () => computeCheckerSummaries(shipments, statusList, checklistItems),
    [shipments, statusList, checklistItems]
  );
  const billingSummary = useMemo(() => computeBillingSummary(shipments), [shipments]);
  const { isCollapsed } = useCardCollapse();
  const monthChartCollapsed = isCollapsed('dash-chart-month');
  const jalurChartCollapsed = isCollapsed('dash-chart-jalur');
  const customerChartCollapsed = isCollapsed('dash-chart-customer');

  const monthCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const customerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const jalurCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const monthlySeries = useMemo(() => {
    const monthMap = new Map<string, { total: number; ready: number }>();
    for (const s of shipments) {
      const m = (s.eta || s.tglTerimaDok || '').slice(0, 7) || 'Lainnya';
      const cur = monthMap.get(m) || { total: 0, ready: 0 };
      cur.total += 1;
      if (s.statusDokumen === 'Ready' || !isShipmentOutstanding(s, checklistItems)) {
        cur.ready += 1;
      }
      monthMap.set(m, cur);
    }

    if (monthMap.size > 1) {
      const entries = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      return {
        isDailyFallback: false,
        labels: entries.map(([m]) => m),
        totals: entries.map(([, v]) => v.total),
        ready: entries.map(([, v]) => v.ready),
      };
    }

    const dayMap = new Map<string, { total: number; ready: number }>();
    for (const s of shipments) {
      const d = s.eta || s.tglTerimaDok || 'Lainnya';
      const cur = dayMap.get(d) || { total: 0, ready: 0 };
      cur.total += 1;
      if (s.statusDokumen === 'Ready' || !isShipmentOutstanding(s, checklistItems)) {
        cur.ready += 1;
      }
      dayMap.set(d, cur);
    }
    const dayEntries = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (dayEntries.length === 0) {
      return { isDailyFallback: false, labels: ['Belum Ada'], totals: [0], ready: [0] };
    }
    let runningTotal = 0;
    let runningReady = 0;
    return {
      isDailyFallback: true,
      labels: dayEntries.map(([d]) => (d.length === 10 ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d)),
      totals: dayEntries.map(([, v]) => {
        runningTotal += v.total;
        return runningTotal;
      }),
      ready: dayEntries.map(([, v]) => {
        runningReady += v.ready;
        return runningReady;
      }),
    };
  }, [shipments, checklistItems]);

  useEffect(() => {
    const instances: Chart[] = [];
    const gridColor = darkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)';
    const tickColor = darkMode ? '#94A3B8' : '#475569';
    const tooltipBg = darkMode ? '#0D111C' : '#0B2545';

    if (monthCanvasRef.current) {
      const ctx = monthCanvasRef.current.getContext('2d');
      let emeraldFill: CanvasGradient | string = 'rgba(34, 197, 94, 0.16)';
      let violetFill: CanvasGradient | string = 'rgba(139, 92, 246, 0.18)';
      if (ctx) {
        const g1 = ctx.createLinearGradient(0, 0, 0, 220);
        g1.addColorStop(0, darkMode ? 'rgba(52, 211, 153, 0.30)' : 'rgba(16, 185, 129, 0.22)');
        g1.addColorStop(1, 'rgba(52, 211, 153, 0.0)');
        emeraldFill = g1;

        const g2 = ctx.createLinearGradient(0, 0, 0, 220);
        g2.addColorStop(0, darkMode ? 'rgba(139, 92, 246, 0.28)' : 'rgba(99, 102, 241, 0.20)');
        g2.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
        violetFill = g2;
      }

      instances.push(
        new Chart(monthCanvasRef.current, {
          type: 'line',
          data: {
            labels: monthlySeries.labels,
            datasets: [
              {
                label: 'Total Shipment',
                data: monthlySeries.totals,
                borderColor: '#34D399',
                backgroundColor: emeraldFill,
                fill: true,
                tension: 0.38,
                borderWidth: 2.5,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#34D399',
                pointBorderColor: darkMode ? '#0D111C' : '#FFFFFF',
                pointBorderWidth: 2,
              },
              {
                label: 'Dokumen Ready / Selesai',
                data: monthlySeries.ready,
                borderColor: '#A78BFA',
                backgroundColor: violetFill,
                fill: true,
                tension: 0.38,
                borderWidth: 2.5,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#A78BFA',
                pointBorderColor: darkMode ? '#0D111C' : '#FFFFFF',
                pointBorderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                display: true,
                position: 'top',
                align: 'end',
                labels: {
                  color: tickColor,
                  usePointStyle: true,
                  pointStyle: 'circle',
                  boxWidth: 8,
                  font: { size: 11, family: 'Poppins, sans-serif' },
                },
              },
              tooltip: {
                backgroundColor: tooltipBg,
                titleColor: '#F8FAFC',
                bodyColor: '#CBD5E1',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                padding: 10,
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: tickColor, font: { size: 11 } },
              },
              y: {
                beginAtZero: true,
                grid: { color: gridColor },
                ticks: { precision: 0, color: tickColor, font: { size: 11 } },
              },
            },
          },
        })
      );
    }

    if (customerCanvasRef.current) {
      instances.push(
        new Chart(customerCanvasRef.current, {
          type: 'bar',
          data: {
            labels:
              stats.byCustomer.length > 0
                ? stats.byCustomer.map((c) => c.customer.slice(0, 18))
                : ['Belum Ada'],
            datasets: [
              {
                label: 'Shipment',
                data: stats.byCustomer.length > 0 ? stats.byCustomer.map((c) => c.count) : [0],
                backgroundColor: darkMode ? '#8B5CF6' : '#F28C28',
                hoverBackgroundColor: darkMode ? '#A78BFA' : '#D97719',
                borderRadius: 6,
                maxBarThickness: 22,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: tooltipBg,
                titleColor: '#F8FAFC',
                bodyColor: '#CBD5E1',
              },
            },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: gridColor },
                ticks: { precision: 0, color: tickColor, font: { size: 10.5 } },
              },
              y: {
                grid: { display: false },
                ticks: { color: tickColor, font: { size: 10.5 } },
              },
            },
          },
        })
      );
    }

    if (jalurCanvasRef.current) {
      instances.push(
        new Chart(jalurCanvasRef.current, {
          type: 'doughnut',
          data: {
            labels: JALUR_CONFIG.map((j) => j.label),
            datasets: [
              {
                data: JALUR_CONFIG.map((j) => stats.byJalur[j.key] || 0),
                backgroundColor: JALUR_CONFIG.map((j) => j.color),
                borderColor: darkMode ? '#131926' : '#FFFFFF',
                borderWidth: 3,
                hoverOffset: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: tooltipBg,
                titleColor: '#F8FAFC',
                bodyColor: '#CBD5E1',
              },
            },
          },
        })
      );
    }

    return () => {
      instances.forEach((c) => c.destroy());
    };
  }, [
    shipments,
    stats.byCustomer,
    stats.byJalur,
    monthlySeries,
    darkMode,
    monthChartCollapsed,
    jalurChartCollapsed,
    customerChartCollapsed,
  ]);

  const processSignalShipments = shipments.filter(
    (s) => getShipmentProcessSignal(s).active
  );

  const urgentShipments = shipments.filter(
    (s) =>
      getShipmentProcessSignal(s).active ||
      isUrgentMissingAju(s) ||
      ((s.jalur === 'Merah' || s.jalur === 'MITA') && s.status !== 'Selesai')
  );

  const recentLogs = useMemo(
    () =>
      [...logs]
        .sort((a, b) => b.waktu.localeCompare(a.waktu))
        .slice(0, 5),
    [logs]
  );

  const [nowDate, setNowDate] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowDate(new Date());
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const currentPeriodLabel = formatDashboardDateLabel(nowDate);

  const dashboardCardIds = useMemo(() => {
    const ids = [
      'dash-kpi-total',
      'dash-kpi-outstanding',
      'dash-kpi-eta7',
      'dash-kpi-missing-aju',
      'dash-chart-month',
      'dash-chart-jalur',
      'dash-checker-table',
      'dash-status-dist',
      'dash-chart-customer',
      'dash-recent-logs',
      'dash-alerts',
    ];
    if (processSignalShipments.length > 0) ids.unshift('dash-banner-signal');
    if (billingSummary.siapInfoOwnerCount > 0) ids.unshift('dash-banner-billing');
    return ids;
  }, [processSignalShipments.length, billingSummary.siapInfoOwnerCount]);

  return (
    <div className="space-y-5">
      {/* Welcome Hero Header matching reference mockup */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Selamat Datang, {userName}
          </h2>
          <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
            Ringkasan kinerja operasional &amp; status dokumen kepabeanan <strong className="font-semibold text-slate-700 dark:text-slate-200">{ppjkBrandName}</strong> hari ini.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ModuleCardBatchToggle cardIds={dashboardCardIds} moduleName="dashboard" />
          <div
            data-testid="dashboard-current-date"
            title="Tanggal, Bulan & Tahun saat ini"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-100 shadow-xs tabular-nums whitespace-nowrap"
          >
            <Calendar className="w-3.5 h-3.5 text-[#F28C28] dark:text-violet-400 shrink-0" />
            <span className="capitalize">{currentPeriodLabel}</span>
          </div>
        </div>
      </div>

      {/* Sinyal Peringatan ETA Tiba / BC 1.1 Manifes Terbit */}
      {processSignalShipments.length > 0 && (
        <section
          aria-label="Sinyal dokumen segera proses"
          data-testid="process-signal-banner"
          className="rounded-xl border border-red-300 dark:border-red-500/40 bg-red-50/90 dark:bg-red-950/35 p-4 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 dark:bg-red-500" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-red-900 dark:text-red-200">
                  Sinyal Segera Proses: {processSignalShipments.length} Dokumen ETA Tiba / BC 1.1 Manifes Terbit
                </h3>
                {!isCollapsed('dash-banner-signal') && (
                  <p className="text-xs text-red-700 dark:text-red-300/85">
                    Kapal telah tiba (ETA &le; 0 hari) atau BC 1.1 manifes telah terbit dan belum terbit SPPB. Segera lakukan pengajuan/proses kepabeanan.
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onGoToOutstanding}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer shadow-sm"
              >
                <span>Pantau Outstanding</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <CardWindowToggleButton
                cardId="dash-banner-signal"
                label="Sinyal Segera Proses"
                compact
              />
            </div>
          </div>

          {!isCollapsed('dash-banner-signal') && (
            <div className="flex flex-wrap gap-2">
              {processSignalShipments.map((s) => {
                const sig = getShipmentProcessSignal(s);
                return (
                  <button
                    key={s.kodeOs}
                    type="button"
                    onClick={() => onOpenDetail(s.kodeOs)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#131926] border border-red-200 dark:border-red-500/35 hover:border-red-400 dark:hover:border-red-400 text-xs text-left cursor-pointer transition-colors"
                  >
                    <span className="font-mono-code font-bold text-[#0B2545] dark:text-violet-300">
                      {s.kodeOs}
                    </span>
                    <span className="text-slate-700 dark:text-slate-200 font-medium truncate max-w-[180px]">
                      {s.namaCustomer}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-200 text-[10.5px] font-bold">
                      {sig.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Notifikasi Siap Info Owner (SPPB Terbit / Gate-Out) -> Auto Penagihan Customer */}
      {billingSummary.siapInfoOwnerCount > 0 && (
        <section
          aria-label="Siap info penagihan ke Owner"
          data-testid="dashboard-billing-banner"
          className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/30 p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/35 flex items-center justify-center shrink-0">
              <Receipt className="w-4.5 h-4.5 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                {billingSummary.siapInfoOwnerCount} Dokumen SPPB / Gate-Out Siap Info Owner (WA / Email)
              </h3>
              {!isCollapsed('dash-banner-billing') && (
                <p className="text-xs text-amber-800 dark:text-amber-300/85">
                  Segera kirim notifikasi WhatsApp atau Email ke Owner agar Admin menerbitkan Surat Penagihan resmi untuk customer.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isCollapsed('dash-banner-billing') && (
              <button
                type="button"
                onClick={() => onNavigateView && onNavigateView('penagihan')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold cursor-pointer shadow-sm shrink-0"
              >
                <span>Buka Penagihan &amp; Info Owner</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <CardWindowToggleButton
              cardId="dash-banner-billing"
              label="Notifikasi Siap Info Owner"
              compact
            />
          </div>
        </section>
      )}

      {/* 4 Top KPI Summary Cards with colored corner ambient glow & decorative sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Total Shipment (Emerald Glow) */}
        <div
          className={`relative overflow-hidden bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-emerald-500/35 shadow-xs transition-all ${
            isCollapsed('dash-kpi-total') ? 'px-4 py-3' : 'p-5'
          }`}
        >
          <div
            aria-hidden="true"
            className="hidden dark:block pointer-events-none absolute -top-8 -left-8 w-28 h-28 rounded-full bg-emerald-500/15 blur-2xl"
          />
          {isCollapsed('dash-kpi-total') ? (
            <div className="relative flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                  Total Shipment:
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {stats.total}
                </span>
              </div>
              <CardWindowToggleButton cardId="dash-kpi-total" label="Total Shipment" compact />
            </div>
          ) : (
            <>
              <div className="relative flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <PackageCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">
                      Total Shipment
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {stats.total}
                    </div>
                  </div>
                </div>
                <CardWindowToggleButton cardId="dash-kpi-total" label="Total Shipment" compact />
              </div>
              <div className="relative mt-3 flex items-end justify-between gap-2">
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate">
                  {stats.readyCount} Ready · {stats.draftCount} Draft
                </div>
                <svg width="64" height="22" viewBox="0 0 64 22" fill="none" aria-hidden="true" className="shrink-0">
                  <path
                    d="M2 18 C 12 16, 18 11, 28 13 C 38 15, 46 6, 62 3"
                    stroke="#34D399"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </>
          )}
        </div>

        {/* KPI 2: Dokumen Outstanding (Sky/Blue Glow) */}
        <div
          className={`relative overflow-hidden bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-sky-500/35 shadow-xs transition-all ${
            isCollapsed('dash-kpi-outstanding') ? 'px-4 py-3' : 'p-5'
          }`}
        >
          <div
            aria-hidden="true"
            className="hidden dark:block pointer-events-none absolute -top-8 -left-8 w-28 h-28 rounded-full bg-sky-500/15 blur-2xl"
          />
          {isCollapsed('dash-kpi-outstanding') ? (
            <div className="relative flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                  Outstanding:
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {stats.outstanding}
                </span>
              </div>
              <CardWindowToggleButton
                cardId="dash-kpi-outstanding"
                label="Dokumen Outstanding"
                compact
              />
            </div>
          ) : (
            <>
              <div className="relative flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
                    <FileCheck2 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">
                      Dokumen Outstanding
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {stats.outstanding}
                    </div>
                  </div>
                </div>
                <CardWindowToggleButton
                  cardId="dash-kpi-outstanding"
                  label="Dokumen Outstanding"
                  compact
                />
              </div>
              <div className="relative mt-3 flex items-end justify-between gap-2">
                <div className="text-[11px] text-sky-600 dark:text-sky-400 font-medium truncate">
                  Belum SPPB / Dok OS
                </div>
                <svg width="64" height="22" viewBox="0 0 64 22" fill="none" aria-hidden="true" className="shrink-0">
                  <path
                    d="M2 16 C 14 18, 22 10, 32 12 C 42 14, 50 7, 62 5"
                    stroke="#38BDF8"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </>
          )}
        </div>

        {/* KPI 3: ETA 7 Hari ke Depan (Amber Glow) */}
        <div
          className={`relative overflow-hidden bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-amber-500/35 shadow-xs transition-all ${
            isCollapsed('dash-kpi-eta7') ? 'px-4 py-3' : 'p-5'
          }`}
        >
          <div
            aria-hidden="true"
            className="hidden dark:block pointer-events-none absolute -top-8 -left-8 w-28 h-28 rounded-full bg-amber-500/15 blur-2xl"
          />
          {isCollapsed('dash-kpi-eta7') ? (
            <div className="relative flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                  ETA 7 Hari:
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {stats.etaNext7Days}
                </span>
              </div>
              <CardWindowToggleButton
                cardId="dash-kpi-eta7"
                label="ETA 7 Hari ke Depan"
                compact
              />
            </div>
          ) : (
            <>
              <div className="relative flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">
                      ETA 7 Hari ke Depan
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {stats.etaNext7Days}
                    </div>
                  </div>
                </div>
                <CardWindowToggleButton
                  cardId="dash-kpi-eta7"
                  label="ETA 7 Hari ke Depan"
                  compact
                />
              </div>
              <div className="relative mt-3 flex items-end justify-between gap-2">
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium truncate">
                  Kapal tiba dalam 0–7 hari
                </div>
                <svg width="64" height="22" viewBox="0 0 64 22" fill="none" aria-hidden="true" className="shrink-0">
                  <path
                    d="M2 17 C 14 14, 24 15, 34 10 C 44 6, 52 8, 62 4"
                    stroke="#FBBF24"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </>
          )}
        </div>

        {/* KPI 4: ETA < 3 Hari Tanpa AJU (Violet Glow) */}
        <div
          className={`relative overflow-hidden bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-violet-500/35 shadow-xs transition-all ${
            isCollapsed('dash-kpi-missing-aju') ? 'px-4 py-3' : 'p-5'
          }`}
        >
          <div
            aria-hidden="true"
            className="hidden dark:block pointer-events-none absolute -top-8 -left-8 w-28 h-28 rounded-full bg-violet-500/20 blur-2xl"
          />
          {isCollapsed('dash-kpi-missing-aju') ? (
            <div className="relative flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                  Tanpa AJU (&lt;3h):
                </span>
                <span className="text-sm font-bold text-[#D64545] dark:text-red-400 tabular-nums">
                  {stats.urgentMissingAju}
                </span>
              </div>
              <CardWindowToggleButton
                cardId="dash-kpi-missing-aju"
                label="ETA Kurang 3 Hari Tanpa AJU"
                compact
              />
            </div>
          ) : (
            <>
              <div className="relative flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">
                      ETA &lt; 3 Hari Tanpa AJU
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-[#D64545] dark:text-red-400 mt-0.5 tabular-nums">
                      {stats.urgentMissingAju}
                    </div>
                  </div>
                </div>
                <CardWindowToggleButton
                  cardId="dash-kpi-missing-aju"
                  label="ETA Kurang 3 Hari Tanpa AJU"
                  compact
                />
              </div>
              <div className="relative mt-3 flex items-end justify-between gap-2">
                <div className="text-[11px] text-red-600 dark:text-violet-300 font-medium truncate">
                  {processSignalShipments.length} sinyal segera proses
                </div>
                <svg width="64" height="22" viewBox="0 0 64 22" fill="none" aria-hidden="true" className="shrink-0">
                  <path
                    d="M2 18 C 12 17, 22 14, 34 11 C 46 8, 52 9, 62 3"
                    stroke="#A78BFA"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Middle Row: Asymmetric 7:5 Dark Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-7 bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {monthlySeries.isDailyFallback
                  ? 'Tren Akumulasi Shipment (Timeline ETA)'
                  : 'Tren Shipment per Bulan'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {monthChartCollapsed
                  ? `${stats.total} total shipment · ${stats.readyCount} Ready/Selesai`
                  : 'Perbandingan total shipment masuk dan dokumen Ready/Selesai'}
              </p>
            </div>
            <CardWindowToggleButton
              cardId="dash-chart-month"
              label="Tren Shipment per Bulan"
              compact
            />
          </div>
          {!monthChartCollapsed && (
            <div className="h-60 mt-3">
              <canvas ref={monthCanvasRef} data-testid="chart-month" />
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Distribusi Jalur Kepabeanan
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {jalurChartCollapsed
                  ? `${stats.total} dokumen (H:${stats.byJalur.Hijau || 0} · K:${stats.byJalur.Kuning || 0} · M:${stats.byJalur.Merah || 0})`
                  : 'Proporsi penetapan jalur dokumen impor saat ini'}
              </p>
            </div>
            <CardWindowToggleButton
              cardId="dash-chart-jalur"
              label="Distribusi Jalur Kepabeanan"
              compact
            />
          </div>

          {!jalurChartCollapsed && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center my-auto pt-3">
              <div className="sm:col-span-6 relative h-48 flex items-center justify-center">
                <canvas ref={jalurCanvasRef} data-testid="chart-jalur" />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Total
                  </span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                    {stats.total} Dok
                  </span>
                </div>
              </div>

              <div className="sm:col-span-6 space-y-2.5">
                {JALUR_CONFIG.map((j) => {
                  const count = stats.byJalur[j.key] || 0;
                  const pct = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={j.key} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 min-w-0 text-slate-700 dark:text-slate-300">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${j.dotClass}`} />
                        <span className="truncate">{j.key}</span>
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white tabular-nums shrink-0">
                        {pct}% <span className="text-slate-400 font-normal">({count})</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Core Unified Table: Rekap Semua Checker */}
      <section
        aria-label="Rekap semua checker dalam satu tabel inti"
        data-testid="dashboard-checker-table-section"
        className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden"
      >
        <div
          className={`px-5 py-4 flex flex-wrap items-center justify-between gap-3 ${
            isCollapsed('dash-checker-table')
              ? ''
              : 'border-b border-slate-200 dark:border-white/[0.08]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Rekap Semua Checker (Tabel Inti)
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                  {checkerSummary.totalCheckers} Checker · {checkerSummary.totalDocuments} Dokumen
                </span>
              </div>
              {!isCollapsed('dash-checker-table') && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Ringkasan beban dokumen Draft, Ready, Outstanding, Selesai, serta sinyal segera proses seluruh checker. Klik baris checker untuk rincian.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-100 dark:bg-yellow-500/15 border border-yellow-300 dark:border-yellow-500/35 text-yellow-800 dark:text-yellow-300 text-[11px] font-semibold tabular-nums">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 dark:bg-yellow-400" />
              <span>Draft: {checkerSummary.totalDraft}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold tabular-nums">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              <span>Ready: {checkerSummary.totalReady}</span>
            </span>
            {!isCollapsed('dash-checker-table') && (
              <button
                type="button"
                onClick={() =>
                  onNavigateView ? onNavigateView('checker') : onGoToOutstanding()
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-violet-500/20 hover:bg-slate-200 dark:hover:bg-violet-500/30 border border-slate-200 dark:border-violet-500/30 text-xs font-semibold text-slate-800 dark:text-violet-200 cursor-pointer transition-colors"
              >
                <span>Buka Rekap Checker</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <CardWindowToggleButton
              cardId="dash-checker-table"
              label="Rekap Semua Checker"
              compact
            />
          </div>
        </div>

        {!isCollapsed('dash-checker-table') && (
          checkerSummary.checkers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Belum ada data dokumen checker untuk ditampilkan.
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-left border-collapse text-xs"
              data-testid="dashboard-checker-core-table"
            >
              <thead>
                <tr className="bg-slate-50 dark:bg-[#182032] border-b border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 text-[11px]">
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Nama Checker</th>
                  <th className="py-2.5 px-2.5 font-semibold text-center whitespace-nowrap">Total</th>
                  <th className="py-2.5 px-2.5 font-semibold text-center whitespace-nowrap">Dok. Draft</th>
                  <th className="py-2.5 px-2.5 font-semibold text-center whitespace-nowrap">Dok. Ready</th>
                  <th className="py-2.5 px-2.5 font-semibold text-center whitespace-nowrap">Outstanding</th>
                  <th className="py-2.5 px-2.5 font-semibold text-center whitespace-nowrap">Selesai</th>
                  <th className="py-2.5 px-2.5 font-semibold text-center whitespace-nowrap">Segera Proses</th>
                  <th className="py-2.5 px-2.5 font-semibold text-center whitespace-nowrap">Tanpa AJU</th>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap min-w-[120px]">Progres</th>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Distribusi Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {checkerSummary.checkers.map((c) => {
                  const initials =
                    c.checkerName === 'Belum Ditugaskan'
                      ? '?'
                      : c.checkerName
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((p) => p[0]?.toUpperCase() || '')
                          .join('');
                  const activeStatuses = checkerSummary.byStatus
                    .map((st) => ({ status: st.status, count: c.byStatus[st.status] || 0 }))
                    .filter((st) => st.count > 0);

                  return (
                    <tr
                      key={c.checkerName}
                      onClick={() => {
                        if (onOpenChecker) {
                          onOpenChecker(c.checkerName);
                        } else if (onNavigateView) {
                          onNavigateView('checker');
                        }
                      }}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                              c.checkerName === 'Belum Ditugaskan'
                                ? 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                : 'bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 text-violet-700 dark:text-violet-300'
                            }`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[170px]">
                              {c.checkerName}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 text-center font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                        {c.total}
                      </td>

                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums border ${
                            c.draftCount > 0
                              ? 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-500/35'
                              : 'bg-slate-100 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-white/[0.06]'
                          }`}
                        >
                          {c.draftCount}
                        </span>
                      </td>

                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums border ${
                            c.readyCount > 0
                              ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/35'
                              : 'bg-slate-100 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-white/[0.06]'
                          }`}
                        >
                          {c.readyCount}
                        </span>
                      </td>

                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums border ${
                            c.outstanding > 0
                              ? 'bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/35'
                              : 'bg-slate-100 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-white/[0.06]'
                          }`}
                        >
                          {c.outstanding}
                        </span>
                      </td>

                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums border ${
                            c.completed > 0
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25'
                              : 'bg-slate-100 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-white/[0.06]'
                          }`}
                        >
                          {c.completed}
                        </span>
                      </td>

                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        {c.processSignalCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/40 text-red-800 dark:text-red-300 text-[11px] font-bold tabular-nums">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400" />
                            <span>{c.processSignalCount}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                            0
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        {c.urgentMissingAju > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/35 text-amber-800 dark:text-amber-300 text-[11px] font-bold tabular-nums">
                            {c.urgentMissingAju}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                            0
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden min-w-[60px]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-violet-500"
                              style={{ width: `${c.completionRate}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums w-8 text-right">
                            {c.completionRate}%
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {activeStatuses.map((st) => (
                            <span
                              key={st.status}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium border ${getStatusBadgeClass(
                                st.status
                              )}`}
                            >
                              <span>{st.status}:</span>
                              <strong className="tabular-nums">{st.count}</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100/90 dark:bg-[#182032] border-t border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-[11.5px]">
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    Total Keseluruhan ({checkerSummary.checkers.length} Baris)
                  </td>
                  <td className="py-2.5 px-2.5 text-center tabular-nums">
                    {checkerSummary.totalDocuments}
                  </td>
                  <td className="py-2.5 px-2.5 text-center tabular-nums text-yellow-700 dark:text-yellow-300">
                    {checkerSummary.totalDraft}
                  </td>
                  <td className="py-2.5 px-2.5 text-center tabular-nums text-emerald-700 dark:text-emerald-300">
                    {checkerSummary.totalReady}
                  </td>
                  <td className="py-2.5 px-2.5 text-center tabular-nums text-sky-700 dark:text-sky-300">
                    {checkerSummary.totalOutstanding}
                  </td>
                  <td className="py-2.5 px-2.5 text-center tabular-nums text-emerald-700 dark:text-emerald-400">
                    {checkerSummary.totalCompleted}
                  </td>
                  <td className="py-2.5 px-2.5 text-center tabular-nums text-red-700 dark:text-red-300">
                    {checkerSummary.totalProcessSignal}
                  </td>
                  <td className="py-2.5 px-2.5 text-center tabular-nums text-amber-700 dark:text-amber-300">
                    {checkerSummary.totalUrgent}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums">
                    {checkerSummary.totalDocuments > 0
                      ? `${Math.round(
                          (checkerSummary.totalCompleted / checkerSummary.totalDocuments) * 100
                        )}%`
                      : '0%'}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    {checkerSummary.totalReady} Ready · {checkerSummary.totalDraft} Draft
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          )
        )}
      </section>

      {/* Bottom Asymmetric 7:5 Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left 7 Cols: Distribusi Status + Top Customer */}
        <div className="lg:col-span-7 space-y-4">
          {/* Distribusi Status Shipment + Draft/Ready indicators */}
          <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5">
            <div
              className={`flex flex-wrap items-center justify-between gap-2 ${
                isCollapsed('dash-status-dist') ? '' : 'mb-3.5'
              }`}
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Distribusi Status Shipment
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-100 dark:bg-yellow-500/15 border border-yellow-300 dark:border-yellow-500/35 text-yellow-800 dark:text-yellow-300 font-semibold tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 dark:bg-yellow-400" />
                  <span>Draft: {stats.draftCount}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/35 text-emerald-800 dark:text-emerald-300 font-semibold tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                  <span>Ready: {stats.readyCount}</span>
                </span>
                <CardWindowToggleButton
                  cardId="dash-status-dist"
                  label="Distribusi Status Shipment"
                  compact
                />
              </div>
            </div>
            {!isCollapsed('dash-status-dist') && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {Object.entries(stats.byStatus).length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 col-span-full">
                    Belum ada data status.
                  </p>
                ) : (
                  Object.entries(stats.byStatus).map(([status, count]) => (
                    <div
                      key={status}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200/80 dark:border-white/[0.06]"
                    >
                      <div className="text-[11.5px] text-slate-600 dark:text-slate-400 truncate" title={status}>
                        {status}
                      </div>
                      <div className="text-xl font-bold text-[#0B2545] dark:text-white mt-1 tabular-nums">
                        {count}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Shipment per Customer */}
          <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Shipment per Customer
                </h3>
                {customerChartCollapsed && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    {stats.byCustomer.length} customer teratas · {stats.total} total shipment
                  </p>
                )}
              </div>
              <CardWindowToggleButton
                cardId="dash-chart-customer"
                label="Shipment per Customer"
                compact
              />
            </div>
            {!customerChartCollapsed && (
              <div className="h-48 mt-3">
                <canvas ref={customerCanvasRef} data-testid="chart-customer" />
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Aktivitas Terbaru & Peringatan & Tugas */}
        <div className="lg:col-span-5 space-y-4">
          {/* Aktivitas Terbaru (Real db.logs timeline) */}
          <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5">
            <div
              className={`flex items-center justify-between gap-2 ${
                isCollapsed('dash-recent-logs') ? '' : 'mb-4'
              }`}
            >
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Aktivitas Terbaru
                </h3>
                {isCollapsed('dash-recent-logs') && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    {recentLogs.length} log aktivitas terkini
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!isCollapsed('dash-recent-logs') && (
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateView ? onNavigateView('shipments') : onGoToOutstanding()
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#F28C28] dark:text-violet-400 hover:underline cursor-pointer"
                  >
                    <span>Lihat Semua</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
                <CardWindowToggleButton
                  cardId="dash-recent-logs"
                  label="Aktivitas Terbaru"
                  compact
                />
              </div>
            </div>

            {!isCollapsed('dash-recent-logs') && (
              recentLogs.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                  Belum ada log aktivitas tercatat.
                </div>
              ) : (
                <div className="relative space-y-3">
                  {recentLogs.map((log, idx) => {
                    const toneClasses = [
                      'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
                      'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25',
                      'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/25',
                      'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
                    ];
                    const cls = toneClasses[idx % toneClasses.length];
                    const timeStr = log.waktu.includes('T')
                      ? log.waktu.slice(11, 16)
                      : log.waktu.slice(0, 10);
                    return (
                      <button
                        key={log.id}
                        type="button"
                        onClick={() => onOpenDetail(log.kodeOs)}
                        className="w-full flex items-start justify-between gap-3 p-2 -mx-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.04] text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${cls}`}
                          >
                            <History className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {log.kodeOs} · {log.kolom}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {log.user}: {log.nilaiLama || '-'} &rarr; {log.nilaiBaru || '-'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0 mt-0.5">
                          {timeStr}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Peringatan & Tugas Prioritas */}
          <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5">
            <div
              className={`flex flex-wrap items-center justify-between gap-2 ${
                isCollapsed('dash-alerts') ? '' : 'mb-3.5'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Peringatan &amp; Tugas Prioritas
                </h3>
                {urgentShipments.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-bold tabular-nums">
                    {urgentShipments.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!isCollapsed('dash-alerts') && (
                  <button
                    type="button"
                    onClick={onGoToOutstanding}
                    className="text-xs font-semibold text-[#F28C28] dark:text-violet-400 hover:underline cursor-pointer"
                  >
                    Outstanding &rarr;
                  </button>
                )}
                <CardWindowToggleButton
                  cardId="dash-alerts"
                  label="Peringatan dan Tugas Prioritas"
                  compact
                />
              </div>
            </div>

            {!isCollapsed('dash-alerts') && (
              urgentShipments.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Tidak ada shipment mendesak yang memerlukan tindakan saat ini.</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {urgentShipments.map((s) => (
                    <button
                      key={s.kodeOs}
                      type="button"
                      onClick={() => onOpenDetail(s.kodeOs)}
                      className="w-full py-3 px-2 -mx-2 flex items-start justify-between gap-2.5 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono-code text-xs font-bold text-[#0B2545] dark:text-violet-300">
                              {s.kodeOs}
                            </span>
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {s.namaCustomer}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            BL: {s.noBl} · ETA: {s.eta || '-'}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <ProcessSignalBadge shipment={s} compact />
                            <CountdownBadge days={s.countDownEta} />
                            <StatusDokumenBadge statusDokumen={s.statusDokumen} />
                            <StatusBadge status={s.status} />
                            <JalurBadge jalur={s.jalur} />
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
