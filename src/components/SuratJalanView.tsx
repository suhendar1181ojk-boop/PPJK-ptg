import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  LogOut,
  MapPin,
  PackageCheck,
  Receipt,
  RotateCcw,
  Search,
  Truck,
} from 'lucide-react';
import type {
  Pengaturan,
  PhasePermissions,
  Shipment,
  StatusSuratJalanType,
  UserRole,
} from '../types/ppjk';
import {
  canUserEditPhase,
  computeDoReadinessSummary,
  generateSuratJalanNomor,
  isContainerGateOut,
  isSppbReadyForGateOut,
  normalizeStatusDoPelayaran,
  normalizeStatusSuratJalan,
} from '../utils/ppjkLogic';
import { exportSuratJalanToPDF } from '../utils/exportUtils';
import { StatusBadge, StatusPenagihanBadge, StatusSuratJalanBadge } from './Badges';
import { SuratJalanModal } from './SuratJalanModal';
import { useCardCollapse } from '../contexts/CardCollapseContext';
import { CardWindowToggleButton, ModuleCardBatchToggle } from './CardWindowControls';

interface SuratJalanViewProps {
  shipments: Shipment[];
  pengaturan?: Pengaturan;
  userRole: UserRole;
  phasePermissions?: PhasePermissions;
  onOpenDetail: (kodeOs: string) => void;
  onOpenBilling?: (kodeOs: string, tab?: 'owner' | 'customer') => void;
  onUpdateDoPelayaran: (
    kodeOs: string,
    payload: {
      gateOutStatus?: 'Belum' | 'Sudah';
      gateOutTanggal?: string;
      bindDokumenSelesai?: boolean;
      suratJalanNomor?: string;
      suratJalanTanggal?: string;
      suratJalanStatus?: StatusSuratJalanType;
      suratJalanTujuan?: string;
      suratJalanPenerima?: string;
      suratJalanCatatan?: string;
    }
  ) => Promise<void>;
}

export function SuratJalanView({
  shipments,
  pengaturan,
  userRole,
  phasePermissions,
  onOpenDetail,
  onOpenBilling,
  onUpdateDoPelayaran,
}: SuratJalanViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | StatusSuratJalanType>('');
  const [activeSjKodeOs, setActiveSjKodeOs] = useState<string | null>(null);
  const [processingKodeOs, setProcessingKodeOs] = useState<string | null>(null);
  const { isCollapsed } = useCardCollapse();

  const canEditPhase2 = canUserEditPhase({ role: userRole, phasePermissions }, 2);
  const summary = useMemo(() => computeDoReadinessSummary(shipments), [shipments]);

  const issuedShipments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shipments.filter((s) => {
      if (!isContainerGateOut(s)) return false;
      const sjStatus = normalizeStatusSuratJalan(s.suratJalanStatus, 'Sudah', s.status);
      if (statusFilter && sjStatus !== statusFilter) return false;
      if (!q) return true;
      return [
        s.kodeOs,
        s.suratJalanNomor || generateSuratJalanNomor(s.kodeOs),
        s.namaCustomer,
        s.noBl,
        s.noCont,
        s.truckingNamaSupir || '',
        s.truckingNoPlat || '',
        s.suratJalanTujuan || '',
        s.suratJalanPenerima || '',
        sjStatus,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [shipments, search, statusFilter]);

  const pendingGateOutShipments = useMemo(
    () =>
      shipments.filter(
        (s) =>
          !isContainerGateOut(s) &&
          (isSppbReadyForGateOut(s) || normalizeStatusDoPelayaran(s.doPelayaranStatus) === 'Sedia')
      ),
    [shipments]
  );

  const modalShipment = activeSjKodeOs
    ? shipments.find((s) => s.kodeOs === activeSjKodeOs) || null
    : null;

  const handleMarkGateOutAndOpenSj = async (s: Shipment) => {
    setProcessingKodeOs(s.kodeOs);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await onUpdateDoPelayaran(s.kodeOs, {
        gateOutStatus: 'Sudah',
        gateOutTanggal: s.gateOutTanggal || today,
        bindDokumenSelesai: true,
      });
      setActiveSjKodeOs(s.kodeOs);
    } finally {
      setProcessingKodeOs(null);
    }
  };

  const totalSuratJalan =
    summary.suratJalanTerbitCount +
    summary.suratJalanDalamPengirimanCount +
    summary.suratJalanTibaCount;

  const sjModuleCardIds = useMemo(() => {
    const ids = [
      'sj-kpi-total',
      'sj-kpi-terbit',
      'sj-kpi-kirim',
      'sj-kpi-tiba',
      'sj-filter-toolbar',
      'sj-table-card',
    ];
    if (canEditPhase2 && pendingGateOutShipments.length > 0) {
      ids.push('sj-ready-gateout-panel');
    }
    return ids;
  }, [canEditPhase2, pendingGateOutShipments.length]);

  const kpiTotalCollapsed = isCollapsed('sj-kpi-total');
  const kpiTerbitCollapsed = isCollapsed('sj-kpi-terbit');
  const kpiKirimCollapsed = isCollapsed('sj-kpi-kirim');
  const kpiTibaCollapsed = isCollapsed('sj-kpi-tiba');
  const readyPanelCollapsed = isCollapsed('sj-ready-gateout-panel');
  const toolbarCollapsed = isCollapsed('sj-filter-toolbar');
  const tableCollapsed = isCollapsed('sj-table-card');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Surat Jalan &amp; Tracking Pengiriman Kontainer
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Surat Jalan dibuat otomatis setiap kali pencatat menandai status Gate-Out (GetOut) selesai untuk memantau pengiriman hingga tiba di tujuan.
          </p>
        </div>
        <ModuleCardBatchToggle cardIds={sjModuleCardIds} moduleName="surat-jalan" />
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 items-start">
        <div className="relative overflow-hidden bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-violet-500/35 p-4">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('')}
              className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
                <ClipboardList className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  Total Surat Jalan Terbit
                </div>
                {kpiTotalCollapsed ? (
                  <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                    {totalSuratJalan} SJ
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {totalSuratJalan}
                  </div>
                )}
              </div>
            </button>
            <CardWindowToggleButton cardId="sj-kpi-total" label="Total Surat Jalan Terbit" compact />
          </div>
          {!kpiTotalCollapsed && (
            <div className="mt-2 text-[11px] font-medium text-violet-600 dark:text-violet-300">
              Otomatis terbit dari status Gate-Out Sudah
            </div>
          )}
        </div>

        <div className="relative overflow-hidden bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-sky-500/35 p-4">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter((v) => (v === 'Terbit' ? '' : 'Terbit'))}
              className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  SJ Baru Terbit
                </div>
                <div
                  className={`${kpiTerbitCollapsed ? 'text-base' : 'text-2xl'} font-bold text-sky-700 dark:text-sky-300 tabular-nums`}
                >
                  {summary.suratJalanTerbitCount}
                </div>
              </div>
            </button>
            <CardWindowToggleButton cardId="sj-kpi-terbit" label="SJ Baru Terbit" compact />
          </div>
          {!kpiTerbitCollapsed && (
            <div className="mt-2 text-[11px] font-medium text-sky-600 dark:text-sky-300">
              Menunggu keberangkatan armada dari pelabuhan
            </div>
          )}
        </div>

        <div className="relative overflow-hidden bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-amber-500/35 p-4">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setStatusFilter((v) => (v === 'Dalam Pengiriman' ? '' : 'Dalam Pengiriman'))
              }
              className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  Dalam Pengiriman
                </div>
                <div
                  className={`${kpiKirimCollapsed ? 'text-base' : 'text-2xl'} font-bold text-amber-700 dark:text-amber-300 tabular-nums`}
                >
                  {summary.suratJalanDalamPengirimanCount}
                </div>
              </div>
            </button>
            <CardWindowToggleButton cardId="sj-kpi-kirim" label="Dalam Pengiriman" compact />
          </div>
          {!kpiKirimCollapsed && (
            <div className="mt-2 text-[11px] font-medium text-amber-600 dark:text-amber-300">
              Sedang perjalanan menuju gudang tujuan
            </div>
          )}
        </div>

        <div className="relative overflow-hidden bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-emerald-500/35 p-4">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setStatusFilter((v) => (v === 'Tiba di Tujuan' ? '' : 'Tiba di Tujuan'))
              }
              className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <PackageCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  Tiba di Tujuan
                </div>
                <div
                  className={`${kpiTibaCollapsed ? 'text-base' : 'text-2xl'} font-bold text-emerald-700 dark:text-emerald-300 tabular-nums`}
                >
                  {summary.suratJalanTibaCount}
                </div>
              </div>
            </button>
            <CardWindowToggleButton cardId="sj-kpi-tiba" label="Tiba di Tujuan" compact />
          </div>
          {!kpiTibaCollapsed && (
            <div className="mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
              Kontainer telah diterima di gudang customer
            </div>
          )}
        </div>
      </div>

      {/* Siap Gate-Out -> Buat Surat Jalan Cepat */}
      {canEditPhase2 && pendingGateOutShipments.length > 0 && (
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-emerald-500/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Siap Gate-Out Pelabuhan ({pendingGateOutShipments.length})</span>
              </div>
              {!readyPanelCollapsed && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Klik tombol untuk menandai Gate-Out &amp; langsung menerbitkan Surat Jalan tracking.
                </p>
              )}
            </div>
            <CardWindowToggleButton
              cardId="sj-ready-gateout-panel"
              label="Siap Gate-Out Pelabuhan"
              compact
            />
          </div>
          {!readyPanelCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {pendingGateOutShipments.map((s) => (
                <div
                  key={s.kodeOs}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-code text-xs font-bold text-[#0B2545] dark:text-violet-300">
                        {s.kodeOs}
                      </span>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate mt-1">
                      {s.namaCustomer}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Cont: {s.noCont || '-'} · Supir: {s.truckingNamaSupir || '-'} ({s.truckingNoPlat || '-'})
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={processingKodeOs === s.kodeOs}
                    onClick={() => void handleMarkGateOutAndOpenSj(s)}
                    className="shrink-0 w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {processingKodeOs === s.kodeOs
                        ? 'Memproses...'
                        : 'Gate-Out & Buat SJ'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Pencarian &amp; Filter Surat Jalan
            </span>
            {toolbarCollapsed && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                · {issuedShipments.length} SJ tampil
                {statusFilter ? ` · Filter: ${statusFilter}` : ''}
              </span>
            )}
          </div>
          <CardWindowToggleButton cardId="sj-filter-toolbar" label="Filter Surat Jalan" compact />
        </div>
        {!toolbarCollapsed && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[230px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label="Cari nomor surat jalan, kode OS, customer, supir, atau plat truk"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari No. Surat Jalan, Kode OS, Customer, Kontainer, Supir, Plat, Tujuan..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100"
              />
            </div>

            <select
              aria-label="Filter status tracking surat jalan"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | StatusSuratJalanType)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100"
            >
              <option value="">Status Tracking: Semua ({totalSuratJalan})</option>
              <option value="Terbit">SJ Terbit ({summary.suratJalanTerbitCount})</option>
              <option value="Dalam Pengiriman">
                Dalam Pengiriman ({summary.suratJalanDalamPengirimanCount})
              </option>
              <option value="Tiba di Tujuan">Tiba di Tujuan ({summary.suratJalanTibaCount})</option>
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

      {/* Table / Empty */}
      {issuedShipments.length === 0 ? (
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-10 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Belum ada Surat Jalan yang sesuai filter saat ini.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Ubah status Gate-Out menjadi Sudah pada modul Kesiapan D/O untuk menerbitkan Surat Jalan secara otomatis.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-[#182032]/70">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Daftar Surat Jalan Terbit ({issuedShipments.length})
              </div>
              <CardWindowToggleButton cardId="sj-table-card" label="Tabel Surat Jalan" />
            </div>
            {!tableCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs" data-testid="surat-jalan-table">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#182032] border-b border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 text-[11px]">
                  <th className="py-3 px-2 font-semibold whitespace-nowrap">No. SJ &amp; Tgl</th>
                  <th className="py-3 px-2 font-semibold">Kode OS &amp; Customer</th>
                  <th className="py-3 px-2 font-semibold">Kontainer &amp; B/L</th>
                  <th className="py-3 px-2 font-semibold">Armada &amp; Supir</th>
                  <th className="py-3 px-2 font-semibold">Tujuan &amp; Penerima</th>
                  <th className="py-3 px-2 font-semibold whitespace-nowrap">Status Tracking</th>
                  <th className="py-3 px-2 font-semibold text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {issuedShipments.map((s) => {
                  const sjNo = s.suratJalanNomor || generateSuratJalanNomor(s.kodeOs);
                  const sjTgl = s.suratJalanTanggal || s.gateOutTanggal || '-';
                  const sjStatus = normalizeStatusSuratJalan(s.suratJalanStatus, 'Sudah', s.status);
                  return (
                    <tr
                      key={s.kodeOs}
                      onClick={() => setActiveSjKodeOs(s.kodeOs)}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"
                    >
                      <td className="py-3 px-2 align-top whitespace-nowrap">
                        <div className="font-mono-code font-bold text-emerald-700 dark:text-emerald-300">
                          {sjNo}
                        </div>
                        <div className="text-[11px] font-mono-code text-slate-500 dark:text-slate-400 mt-0.5">
                          {sjTgl}
                        </div>
                      </td>
                      <td className="py-3 px-2 align-top">
                        <div className="max-w-[125px]">
                          <div className="font-mono-code font-bold text-[#0B2545] dark:text-violet-300 truncate">
                            {s.kodeOs}
                          </div>
                          <div
                            title={s.namaCustomer}
                            className="font-semibold text-slate-900 dark:text-white truncate mt-0.5"
                          >
                            {s.namaCustomer}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 align-top">
                        <div className="max-w-[120px]">
                          <div
                            title={s.noCont || '-'}
                            className="font-mono-code font-semibold text-slate-800 dark:text-slate-200 truncate"
                          >
                            {s.noCont || '-'}
                          </div>
                          <div
                            title={`BL: ${s.noBl || '-'}`}
                            className="text-[11px] font-mono-code text-slate-500 dark:text-slate-400 mt-0.5 truncate"
                          >
                            BL: {s.noBl || '-'}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 align-top">
                        <div className="max-w-[125px]">
                          <div
                            title={s.truckingNamaSupir || 'Supir belum diisi'}
                            className="font-semibold text-slate-900 dark:text-slate-100 truncate"
                          >
                            {s.truckingNamaSupir || 'Supir belum diisi'}
                          </div>
                          <div
                            title={`${s.truckingNoPlat || '-'} · ${s.truckingNoHpSupir || '-'}`}
                            className="font-mono-code text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5"
                          >
                            {s.truckingNoPlat || '-'} · {s.truckingNoHpSupir || '-'}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 align-top">
                        <div className="max-w-[155px]">
                          <div
                            title={s.suratJalanTujuan || `Gudang ${s.namaCustomer}`}
                            className="text-slate-800 dark:text-slate-200 line-clamp-2"
                          >
                            <MapPin className="w-3 h-3 inline mr-1 text-emerald-600 dark:text-emerald-400" />
                            {s.suratJalanTujuan || `Gudang ${s.namaCustomer}`}
                          </div>
                          {s.suratJalanPenerima && (
                            <div
                              title={`PIC: ${s.suratJalanPenerima}`}
                              className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate"
                            >
                              PIC: {s.suratJalanPenerima}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 align-top whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <StatusSuratJalanBadge
                          suratJalanStatus={sjStatus}
                          gateOutStatus="Sudah"
                          shipmentStatus={s.status}
                          onToggle={
                            canEditPhase2
                              ? (next) =>
                                  void onUpdateDoPelayaran(s.kodeOs, {
                                    suratJalanStatus: next,
                                  })
                              : undefined
                          }
                        />
                      </td>
                      <td
                        className="py-3 px-2 align-top text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setActiveSjKodeOs(s.kodeOs)}
                            aria-label={`Tracking Surat Jalan ${sjNo}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 border border-emerald-200 dark:border-emerald-500/35 text-[11px] font-semibold text-emerald-700 dark:text-emerald-200 cursor-pointer"
                          >
                            <ClipboardList className="w-3 h-3" />
                            <span>Tracking</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => exportSuratJalanToPDF(s, pengaturan)}
                            aria-label={`Download PDF Surat Jalan ${sjNo}`}
                            className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-[11px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>PDF</span>
                          </button>
                          {onOpenBilling && (
                            <button
                              type="button"
                              onClick={() => onOpenBilling(s.kodeOs, 'owner')}
                              aria-label={`Info Owner & Penagihan ${s.kodeOs}`}
                              title="Kirim Info Owner (WA/Email) & Surat Penagihan"
                              className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 border border-amber-200 dark:border-amber-500/35 text-[11px] font-semibold text-amber-800 dark:text-amber-200 cursor-pointer"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Tagih</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenDetail(s.kodeOs)}
                            className="px-1.5 py-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-[11px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            Detail
                          </button>
                        </div>
                        {onOpenBilling && (
                          <div className="mt-1.5 flex justify-end">
                            <StatusPenagihanBadge
                              billingStatus={s.billingStatus}
                              shipment={s}
                              onClick={() => onOpenBilling(s.kodeOs, 'owner')}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3" data-testid="mobile-surat-jalan-cards">
            {issuedShipments.map((s) => {
              const sjNo = s.suratJalanNomor || generateSuratJalanNomor(s.kodeOs);
              const sjTgl = s.suratJalanTanggal || s.gateOutTanggal || '-';
              const sjStatus = normalizeStatusSuratJalan(s.suratJalanStatus, 'Sudah', s.status);
              const mobCardId = `sj-mobile-${s.kodeOs}`;
              const mobCollapsed = isCollapsed(mobCardId);
              return (
                <div
                  key={s.kodeOs}
                  onClick={() => setActiveSjKodeOs(s.kodeOs)}
                  className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200 dark:border-white/[0.08] p-4 space-y-2.5 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono-code text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        {sjNo}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                        {s.namaCustomer}
                      </div>
                      <div className="text-[11px] font-mono-code text-slate-500 dark:text-slate-400">
                        {s.kodeOs} · Tgl: {sjTgl}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <StatusSuratJalanBadge
                        suratJalanStatus={sjStatus}
                        gateOutStatus="Sudah"
                        shipmentStatus={s.status}
                        onToggle={
                          canEditPhase2
                            ? (next) =>
                                void onUpdateDoPelayaran(s.kodeOs, {
                                  suratJalanStatus: next,
                                })
                            : undefined
                        }
                      />
                      <CardWindowToggleButton cardId={mobCardId} label={`Surat Jalan ${sjNo}`} compact />
                    </div>
                  </div>
                  {!mobCollapsed && (
                    <>
                      <div className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                        <div className="font-mono-code">Cont: {s.noCont || '-'}</div>
                        <div>
                          Supir: <strong>{s.truckingNamaSupir || '-'}</strong> · {s.truckingNoPlat || '-'}
                        </div>
                        <div className="truncate">
                          Tujuan: {s.suratJalanTujuan || `Gudang ${s.namaCustomer}`}
                        </div>
                      </div>
                      <div
                        className="flex items-center justify-end gap-2 pt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => exportSuratJalanToPDF(s, pengaturan)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSjKodeOs(s.kodeOs)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          <span>Tracking SJ</span>
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

      {modalShipment && (
        <SuratJalanModal
          shipment={modalShipment}
          pengaturan={pengaturan}
          canEdit={canEditPhase2}
          onClose={() => setActiveSjKodeOs(null)}
          onOpenBilling={onOpenBilling}
          onSaveSuratJalan={async (kodeOs, payload) => {
            await onUpdateDoPelayaran(kodeOs, payload);
          }}
        />
      )}
    </div>
  );
}
