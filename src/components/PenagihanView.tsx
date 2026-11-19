import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  MessageCircle,
  Receipt,
  RotateCcw,
  Search,
  Send,
} from 'lucide-react';
import type {
  Customer,
  Pengaturan,
  Shipment,
  StatusPenagihanType,
  UserRole,
} from '../types/ppjk';
import {
  buildAutoBillingFields,
  computeBillingSummary,
  DEFAULT_PENGATURAN,
  filterBillingShipments,
  formatRupiah,
  getBillingEligibilityReason,
  normalizeStatusPenagihan,
} from '../utils/ppjkLogic';
import {
  exportBillingSummaryToExcel,
  exportSuratPenagihanToPDF,
} from '../utils/exportUtils';
import { StatusBadge, StatusPenagihanBadge } from './Badges';
import { useCardCollapse } from '../contexts/CardCollapseContext';
import { CardWindowToggleButton, ModuleCardBatchToggle } from './CardWindowControls';

interface PenagihanViewProps {
  shipments: Shipment[];
  customers: Customer[];
  pengaturan: Pengaturan;
  userRole: UserRole;
  onOpenDetail: (kodeOs: string) => void;
  onOpenBilling: (kodeOs: string, tab?: 'owner' | 'customer') => void;
}

export function PenagihanView({
  shipments,
  customers,
  pengaturan,
  userRole,
  onOpenDetail,
  onOpenBilling,
}: PenagihanViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | StatusPenagihanType>('');

  const summary = useMemo(() => computeBillingSummary(shipments), [shipments]);

  const filtered = useMemo(
    () =>
      filterBillingShipments(shipments, {
        search,
        status: statusFilter,
        onlyEligible: true,
      }),
    [shipments, search, statusFilter]
  );

  const awaitingOwnerList = useMemo(
    () =>
      filterBillingShipments(shipments, {
        status: 'Siap Info Owner',
        onlyEligible: true,
      }),
    [shipments]
  );

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customers) map.set(c.kodeCustomer, c);
    return map;
  }, [customers]);

  const { isCollapsed } = useCardCollapse();

  const billModuleCardIds = useMemo(() => {
    const ids = [
      'bill-kpi-all',
      'bill-kpi-siap',
      'bill-kpi-notified',
      'bill-kpi-terbit',
      'bill-kpi-lunas',
      'bill-filter-toolbar',
      'bill-table-card',
    ];
    if (awaitingOwnerList.length > 0) ids.push('bill-owner-banner');
    return ids;
  }, [awaitingOwnerList.length]);

  const kpiAllCollapsed = isCollapsed('bill-kpi-all');
  const kpiSiapCollapsed = isCollapsed('bill-kpi-siap');
  const kpiNotifiedCollapsed = isCollapsed('bill-kpi-notified');
  const kpiTerbitCollapsed = isCollapsed('bill-kpi-terbit');
  const kpiLunasCollapsed = isCollapsed('bill-kpi-lunas');
  const ownerBannerCollapsed = isCollapsed('bill-owner-banner');
  const toolbarCollapsed = isCollapsed('bill-filter-toolbar');
  const tableCollapsed = isCollapsed('bill-table-card');

  const isAdmin = userRole === 'Admin';
  const ownerDisplay = pengaturan.ownerName || DEFAULT_PENGATURAN.ownerName;
  const adminDisplay = pengaturan.adminName || DEFAULT_PENGATURAN.adminName;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Info Owner (WA / Email) &amp; Auto Surat Penagihan Customer
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Setiap dokumen berstatus <strong>SPPB Terbit</strong> atau <strong>Sudah Gate-Out</strong> otomatis disiapkan pesan info ke Owner ({ownerDisplay}) untuk diterbitkan Surat Penagihan ke Customer oleh Admin ({adminDisplay}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
          <ModuleCardBatchToggle cardIds={billModuleCardIds} moduleName="penagihan" />
          <button
            type="button"
            onClick={() => exportBillingSummaryToExcel(filtered)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131926] hover:bg-slate-50 dark:hover:bg-[#1D253B] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Export Rekap Penagihan</span>
          </button>
        </div>
      </div>

      {/* 5 KPI Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3.5 items-start">
        <div
          className={`bg-white dark:bg-[#131926] rounded-2xl border p-3.5 sm:p-4 transition-colors ${
            statusFilter === ''
              ? 'border-violet-500/60 ring-1 ring-violet-500/30'
              : 'border-slate-200 dark:border-white/[0.08]'
          }`}
        >
          <div className="flex items-start justify-between gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('')}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
                <Receipt className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  Siap Ditagih
                </div>
                <div className={`${kpiAllCollapsed ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-slate-900 dark:text-white tabular-nums`}>
                  {summary.eligibleCount}
                </div>
              </div>
            </button>
            <CardWindowToggleButton cardId="bill-kpi-all" label="Siap Ditagih" compact />
          </div>
          {!kpiAllCollapsed && (
            <div className="mt-2 text-[11px] font-medium text-violet-600 dark:text-violet-300 truncate tabular-nums">
              Estimasi: {formatRupiah(summary.totalNominal)}
            </div>
          )}
        </div>

        <div
          className={`bg-white dark:bg-[#131926] rounded-2xl border p-3.5 sm:p-4 transition-colors ${
            statusFilter === 'Siap Info Owner'
              ? 'border-amber-500 ring-1 ring-amber-500/40'
              : 'border-slate-200 dark:border-amber-500/35'
          }`}
        >
          <div className="flex items-start justify-between gap-1.5">
            <button
              type="button"
              onClick={() =>
                setStatusFilter((v) => (v === 'Siap Info Owner' ? '' : 'Siap Info Owner'))
              }
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  Siap Info Owner
                </div>
                <div className={`${kpiSiapCollapsed ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-amber-700 dark:text-amber-300 tabular-nums`}>
                  {summary.siapInfoOwnerCount}
                </div>
              </div>
            </button>
            <CardWindowToggleButton cardId="bill-kpi-siap" label="Siap Info Owner" compact />
          </div>
          {!kpiSiapCollapsed && (
            <div className="mt-2 text-[11px] font-medium text-amber-600 dark:text-amber-300 truncate">
              Menunggu kirim WA / Email Owner
            </div>
          )}
        </div>

        <div
          className={`bg-white dark:bg-[#131926] rounded-2xl border p-3.5 sm:p-4 transition-colors ${
            statusFilter === 'Info Owner Terkirim'
              ? 'border-violet-500 ring-1 ring-violet-500/40'
              : 'border-slate-200 dark:border-violet-500/35'
          }`}
        >
          <div className="flex items-start justify-between gap-1.5">
            <button
              type="button"
              onClick={() =>
                setStatusFilter((v) => (v === 'Info Owner Terkirim' ? '' : 'Info Owner Terkirim'))
              }
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  Info Owner Terkirim
                </div>
                <div className={`${kpiNotifiedCollapsed ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-violet-700 dark:text-violet-300 tabular-nums`}>
                  {summary.ownerNotifiedCount}
                </div>
              </div>
            </button>
            <CardWindowToggleButton cardId="bill-kpi-notified" label="Info Owner Terkirim" compact />
          </div>
          {!kpiNotifiedCollapsed && (
            <div className="mt-2 text-[11px] font-medium text-violet-600 dark:text-violet-300 truncate">
              Menunggu Admin buat penagihan
            </div>
          )}
        </div>

        <div
          className={`bg-white dark:bg-[#131926] rounded-2xl border p-3.5 sm:p-4 transition-colors ${
            statusFilter === 'Penagihan Terbit'
              ? 'border-sky-500 ring-1 ring-sky-500/40'
              : 'border-slate-200 dark:border-sky-500/35'
          }`}
        >
          <div className="flex items-start justify-between gap-1.5">
            <button
              type="button"
              onClick={() =>
                setStatusFilter((v) => (v === 'Penagihan Terbit' ? '' : 'Penagihan Terbit'))
              }
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  Terbit / Terkirim Cust.
                </div>
                <div className={`${kpiTerbitCollapsed ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-sky-700 dark:text-sky-300 tabular-nums`}>
                  {summary.terbitCount + summary.terkirimCustomerCount}
                </div>
              </div>
            </button>
            <CardWindowToggleButton cardId="bill-kpi-terbit" label="Terbit atau Terkirim" compact />
          </div>
          {!kpiTerbitCollapsed && (
            <div className="mt-2 text-[11px] font-medium text-sky-600 dark:text-sky-300 truncate">
              {summary.terbitCount} terbit · {summary.terkirimCustomerCount} terkirim
            </div>
          )}
        </div>

        <div
          className={`col-span-2 sm:col-span-1 bg-white dark:bg-[#131926] rounded-2xl border p-3.5 sm:p-4 transition-colors ${
            statusFilter === 'Lunas'
              ? 'border-emerald-500 ring-1 ring-emerald-500/40'
              : 'border-slate-200 dark:border-emerald-500/35'
          }`}
        >
          <div className="flex items-start justify-between gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter((v) => (v === 'Lunas' ? '' : 'Lunas'))}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  Penagihan Lunas
                </div>
                <div className={`${kpiLunasCollapsed ? 'text-base' : 'text-xl'} font-bold text-emerald-700 dark:text-emerald-300 tabular-nums`}>
                  {summary.lunasCount}
                </div>
              </div>
            </button>
            <CardWindowToggleButton cardId="bill-kpi-lunas" label="Penagihan Lunas" compact />
          </div>
          {!kpiLunasCollapsed && (
            <div className="mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-300 truncate tabular-nums">
              Lunas: {formatRupiah(summary.totalLunasNominal)}
            </div>
          )}
        </div>
      </div>

      {/* Urgent Action Banner: SPPB Terbit / Gate-Out Siap Info Owner */}
      {awaitingOwnerList.length > 0 && (
        <section
          aria-label="Antrian Info Penagihan Owner"
          data-testid="billing-owner-banner"
          className="rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/30 p-4 space-y-2.5"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                {awaitingOwnerList.length} Dokumen SPPB / Gate-Out Siap Info Owner (WA / Email)
              </h3>
              {!ownerBannerCollapsed && (
                <p className="text-xs text-amber-800/90 dark:text-amber-300/85">
                  Segera kirim notifikasi WhatsApp atau Email ke Owner ({ownerDisplay}) agar Admin ({adminDisplay}) membuat Surat Penagihan untuk customer.
                </p>
              )}
            </div>
            <CardWindowToggleButton cardId="bill-owner-banner" label="Antrian Info Owner" compact />
          </div>
          {!ownerBannerCollapsed && (
            <div className="flex flex-wrap gap-2">
              {awaitingOwnerList.map((s) => (
                <button
                  key={s.kodeOs}
                  type="button"
                  onClick={() => onOpenBilling(s.kodeOs, 'owner')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#131926] border border-amber-300 dark:border-amber-500/40 hover:border-amber-500 text-xs cursor-pointer transition-colors"
                >
                  <span className="font-mono-code font-bold text-[#0B2545] dark:text-violet-300">
                    {s.kodeOs}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-100 truncate max-w-[150px]">
                    {s.namaCustomer}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10.5px] font-semibold">
                    Info Owner (WA/Email)
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Search & Status Filter Toolbar */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Pencarian &amp; Filter Penagihan
            </span>
            {toolbarCollapsed && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                · {filtered.length} dokumen
                {statusFilter ? ` · ${statusFilter}` : ''}
              </span>
            )}
          </div>
          <CardWindowToggleButton cardId="bill-filter-toolbar" label="Filter Penagihan" compact />
        </div>
        {!toolbarCollapsed && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label="Cari no penagihan, kode OS, customer, SPPB, atau surat jalan"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari No. Penagihan (INV-...), Kode OS, Customer, No. SPPB, No. SJ..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100"
              />
            </div>

            <select
              aria-label="Filter status penagihan"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | StatusPenagihanType)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100"
            >
              <option value="">Status Penagihan: Semua ({summary.eligibleCount})</option>
              <option value="Siap Info Owner">Siap Info Owner ({summary.siapInfoOwnerCount})</option>
              <option value="Info Owner Terkirim">
                Info Owner Terkirim ({summary.ownerNotifiedCount})
              </option>
              <option value="Penagihan Terbit">Penagihan Terbit ({summary.terbitCount})</option>
              <option value="Terkirim ke Customer">
                Terkirim ke Customer ({summary.terkirimCustomerCount})
              </option>
              <option value="Lunas">Lunas ({summary.lunasCount})</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* Empty State or Desktop Table + Mobile Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-10 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Belum ada dokumen penagihan yang sesuai filter saat ini.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Dokumen akan otomatis muncul di daftar ini saat berstatus SPPB Terbit atau Sudah Gate-Out.
          </p>
        </div>
      ) : (
        <>
          {/* Compact Desktop Table (fits 1440px viewport with 0 horizontal overflow) */}
          <div className="hidden md:block bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-[#182032]/70">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Daftar Dokumen Penagihan ({filtered.length})
              </div>
              <CardWindowToggleButton cardId="bill-table-card" label="Tabel Penagihan" />
            </div>
            {!tableCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs" data-testid="penagihan-table">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#182032] border-b border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 text-[11px]">
                  <th className="py-3 px-2 font-semibold whitespace-nowrap">No. Penagihan &amp; OS</th>
                  <th className="py-3 px-2 font-semibold">Customer &amp; B/L</th>
                  <th className="py-3 px-2 font-semibold">Pemicu (SPPB / Gate-Out)</th>
                  <th className="py-3 px-2 font-semibold whitespace-nowrap">Total Tagihan</th>
                  <th className="py-3 px-2 font-semibold whitespace-nowrap">Status Penagihan</th>
                  <th className="py-3 px-2 font-semibold text-right whitespace-nowrap">Aksi WA / Email / SJ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {filtered.map((s) => {
                  const auto = buildAutoBillingFields(s);
                  const st = normalizeStatusPenagihan(s.billingStatus, s);
                  const cust = customerMap.get(s.kodeCustomer);
                  return (
                    <tr
                      key={s.kodeOs}
                      onClick={() => onOpenBilling(s.kodeOs, st === 'Siap Info Owner' ? 'owner' : 'customer')}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-2 align-top whitespace-nowrap">
                        <div className="font-mono-code font-bold text-violet-700 dark:text-violet-300">
                          {auto.billingNomor}
                        </div>
                        <div className="font-mono-code text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                          {s.kodeOs}
                        </div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400">
                          JT: {auto.billingJatuhTempo}
                        </div>
                      </td>

                      <td className="py-3 px-2 align-top">
                        <div className="max-w-[160px]">
                          <div
                            title={s.namaCustomer}
                            className="font-semibold text-slate-900 dark:text-white truncate"
                          >
                            {s.namaCustomer}
                          </div>
                          <div
                            title={`BL: ${s.noBl || '-'} · Cont: ${s.noCont || '-'}`}
                            className="font-mono-code text-[10.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5"
                          >
                            BL: {s.noBl || '-'}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-2 align-top">
                        <div className="max-w-[165px] space-y-1">
                          <StatusBadge status={s.status} />
                          <div
                            title={getBillingEligibilityReason(s)}
                            className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 truncate"
                          >
                            {getBillingEligibilityReason(s)}
                          </div>
                          <div className="font-mono-code text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                            SPPB: {s.noSppb || '-'} {s.suratJalanNomor ? `· ${s.suratJalanNomor}` : ''}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-2 align-top whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatRupiah(auto.billingTotal)}
                        </div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400">
                          incl. PPN {auto.billingPpnPersen}%
                        </div>
                      </td>

                      <td className="py-3 px-2 align-top whitespace-nowrap">
                        <StatusPenagihanBadge
                          billingStatus={st}
                          shipment={s}
                          onClick={() =>
                            onOpenBilling(s.kodeOs, st === 'Siap Info Owner' ? 'owner' : 'customer')
                          }
                        />
                        {s.billingOwnerNotifiedVia && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                            Owner via {s.billingOwnerNotifiedVia}
                          </div>
                        )}
                      </td>

                      <td
                        className="py-3 px-2 align-top text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenBilling(s.kodeOs, 'owner')}
                            aria-label={`Info Owner WA Email ${s.kodeOs}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 border border-emerald-200 dark:border-emerald-500/35 text-[11px] font-semibold text-emerald-700 dark:text-emerald-200 cursor-pointer"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>Info Owner</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenBilling(s.kodeOs, 'customer')}
                            aria-label={`Surat Penagihan ${auto.billingNomor}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-50 dark:bg-violet-500/20 hover:bg-violet-100 dark:hover:bg-violet-500/30 border border-violet-200 dark:border-violet-500/35 text-[11px] font-semibold text-violet-700 dark:text-violet-200 cursor-pointer"
                          >
                            <FileText className="w-3 h-3" />
                            <span>{isAdmin ? 'Surat Tagih' : 'Lihat Tagih'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => exportSuratPenagihanToPDF(s, cust, pengaturan)}
                            aria-label={`Download PDF ${auto.billingNomor}`}
                            title="Download PDF Surat Penagihan"
                            className="inline-flex items-center justify-center p-1.5 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenDetail(s.kodeOs)}
                            className="px-1.5 py-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-[11px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden space-y-3" data-testid="mobile-penagihan-cards">
            {filtered.map((s) => {
              const auto = buildAutoBillingFields(s);
              const st = normalizeStatusPenagihan(s.billingStatus, s);
              const cust = customerMap.get(s.kodeCustomer);
              const mobCardId = `bill-mobile-${s.kodeOs}`;
              const mobCollapsed = isCollapsed(mobCardId);
              return (
                <div
                  key={s.kodeOs}
                  onClick={() =>
                    onOpenBilling(s.kodeOs, st === 'Siap Info Owner' ? 'owner' : 'customer')
                  }
                  className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200 dark:border-white/[0.08] p-4 space-y-2.5 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono-code text-xs font-bold text-violet-700 dark:text-violet-300">
                        {auto.billingNomor}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                        {s.namaCustomer}
                      </div>
                      <div className="text-[11px] font-mono-code text-slate-500 dark:text-slate-400">
                        {s.kodeOs} · {getBillingEligibilityReason(s)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <StatusPenagihanBadge billingStatus={st} shipment={s} />
                      <CardWindowToggleButton cardId={mobCardId} label={`Penagihan ${auto.billingNomor}`} compact />
                    </div>
                  </div>

                  {!mobCollapsed && (
                    <>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-white/[0.06]">
                        <span className="text-slate-500 dark:text-slate-400">
                          JT: {auto.billingJatuhTempo}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatRupiah(auto.billingTotal)}
                        </span>
                      </div>

                      <div
                        className="flex flex-wrap items-center justify-end gap-2 pt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenBilling(s.kodeOs, 'owner')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Info Owner (WA/Email)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenBilling(s.kodeOs, 'customer')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Surat Penagihan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => exportSuratPenagihanToPDF(s, cust, pengaturan)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
