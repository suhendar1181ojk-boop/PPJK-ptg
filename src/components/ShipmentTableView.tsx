import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type {
  Importir,
  JalurType,
  Pengaturan,
  PengeluaranOpsItem,
  PhasePermissions,
  Shipment,
  ShipmentDateFilterField,
  StatusDokumenType,
  UserRole,
} from '../types/ppjk';
import {
  canPerformAction,
  canUserEditAnyPhase,
  canUserEditPhase,
  computeImportirSummaries,
  filterShipments,
  formatChecklistProgress,
  formatRupiah,
  getShipmentProcessSignal,
  isShipmentOutstanding,
  isUrgentMissingAju,
  normalizeStatusDokumen,
} from '../utils/ppjkLogic';
import {
  exportShipmentsToCSV,
  exportShipmentsToExcel,
  exportShipmentsToPDF,
} from '../utils/exportUtils';
import { KdiPrintModal } from './KdiPrintModal';
import {
  CountdownBadge,
  DoValidityBadge,
  JalurBadge,
  ProcessSignalBadge,
  StatusBadge,
  StatusDoBadge,
  StatusDokumenBadge,
  StatusGateOutBadge,
  StatusGatePassBadge,
  StatusPenagihanBadge,
  StatusSuratJalanBadge,
  StatusTruckingBadge,
} from './Badges';

interface ShipmentTableViewProps {
  mode: 'all' | 'outstanding';
  shipments: Shipment[];
  importirs?: Importir[];
  pengaturan?: Pengaturan;
  pengeluaranOps?: PengeluaranOpsItem[];
  statusList: string[];
  jalurList: JalurType[];
  checklistItems: string[];
  userRole: UserRole;
  phasePermissions?: PhasePermissions;
  initialCheckerFilter?: string;
  initialSearchQuery?: string;
  onOpenDetail: (kodeOs: string) => void;
  onEditShipment: (kodeOs: string) => void;
  onCreateShipment: () => void;
  onUpdateStatusDokumen?: (kodeOs: string, nextStatus: StatusDokumenType) => Promise<void>;
  onUpdateKodeManualDokOs?: (kodeOs: string, nextCode: string) => Promise<void>;
}

type SortKey =
  | 'kodeOs'
  | 'kodeManualDokOs'
  | 'dokumenChecker'
  | 'statusDokumen'
  | 'kodeCustomer'
  | 'namaCustomer'
  | 'kodeImportir'
  | 'tglTerimaDok'
  | 'noPackinglist'
  | 'noBl'
  | 'ship'
  | 'shipper'
  | 'negaraAsal'
  | 'etd'
  | 'eta'
  | 'countDownEta'
  | 'noAju'
  | 'tglAju'
  | 'nopen'
  | 'tglNopen'
  | 'status'
  | 'jalur'
  | 'currency'
  | 'kurs'
  | 'invoice'
  | 'noSppb'
  | 'tglSppb';

const DATE_FIELD_LABELS: Record<ShipmentDateFilterField, string> = {
  eta: 'ETA',
  etd: 'ETD',
  tglTerimaDok: 'Tgl. Terima Dok',
  tglSppb: 'Tgl. SPPB',
};

function formatNumberId(value: number | '' | undefined): string {
  if (value === '' || value === undefined || value === null) return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
}

export function ShipmentTableView({
  mode,
  shipments,
  importirs = [],
  pengaturan,
  pengeluaranOps = [],
  statusList,
  jalurList,
  checklistItems,
  userRole,
  phasePermissions,
  initialCheckerFilter = '',
  initialSearchQuery = '',
  onOpenDetail,
  onEditShipment,
  onCreateShipment,
  onUpdateStatusDokumen,
  onUpdateKodeManualDokOs,
}: ShipmentTableViewProps) {
  const [search, setSearch] = useState(initialSearchQuery);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStatusDokumen, setFilterStatusDokumen] = useState<'' | StatusDokumenType>('');
  const [onlyProcessSignal, setOnlyProcessSignal] = useState(false);
  const [filterJalur, setFilterJalur] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterImportir, setFilterImportir] = useState('');
  const [filterChecker, setFilterChecker] = useState(initialCheckerFilter);
  const [dateField, setDateField] = useState<ShipmentDateFilterField>('eta');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('kodeOs');
  const [sortAsc, setSortAsc] = useState(false);
  const [kdiPreviewShipment, setKdiPreviewShipment] = useState<Shipment | null>(null);
  const [editingManualOs, setEditingManualOs] = useState<{
    kodeOs: string;
    value: string;
  } | null>(null);
  const [savingManualOs, setSavingManualOs] = useState(false);

  useEffect(() => {
    setFilterChecker(initialCheckerFilter);
  }, [initialCheckerFilter]);

  useEffect(() => {
    if (initialSearchQuery) {
      setSearch(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  const importirNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const imp of importirs) {
      const code = (imp.kodeImportir || '').trim();
      if (code) {
        map.set(code.toUpperCase(), imp.namaImportir || '-');
      }
    }
    return map;
  }, [importirs]);

  const resolveImportirName = (kodeImportir?: string): string => {
    const code = (kodeImportir || '').trim();
    if (!code) return 'Belum Diisi';
    return importirNameMap.get(code.toUpperCase()) || '-';
  };

  const importirSummary = useMemo(
    () => computeImportirSummaries(shipments, importirs, checklistItems),
    [shipments, importirs, checklistItems]
  );

  const uniqueCustomers = useMemo(
    () =>
      Array.from(new Set(shipments.map((s) => s.namaCustomer).filter(Boolean))).sort(),
    [shipments]
  );

  const uniqueCheckers = useMemo(
    () =>
      Array.from(new Set(shipments.map((s) => s.dokumenChecker).filter(Boolean))).sort(),
    [shipments]
  );

  const processSignalTotal = useMemo(
    () =>
      filterShipments(
        shipments,
        { mode, onlyProcessSignal: true },
        checklistItems
      ).length,
    [shipments, mode, checklistItems]
  );

  const filtered = useMemo(() => {
    const list = filterShipments(
      shipments,
      {
        mode,
        search,
        filterStatus,
        filterStatusDokumen,
        onlyProcessSignal,
        filterJalur,
        filterCustomer,
        filterImportir,
        filterChecker,
        dateField,
        dateFrom,
        dateTo,
      },
      checklistItems
    );

    list.sort((a, b) => {
      if (sortKey === 'statusDokumen') {
        const va = normalizeStatusDokumen(a.statusDokumen);
        const vb = normalizeStatusDokumen(b.statusDokumen);
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      if (sortKey === 'countDownEta') {
        const va = a.countDownEta ?? (sortAsc ? 999999 : -999999);
        const vb = b.countDownEta ?? (sortAsc ? 999999 : -999999);
        return sortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va);
      }
      if (sortKey === 'kurs' || sortKey === 'invoice') {
        const va = a[sortKey] === '' || a[sortKey] === undefined ? -1 : Number(a[sortKey]);
        const vb = b[sortKey] === '' || b[sortKey] === undefined ? -1 : Number(b[sortKey]);
        return sortAsc ? va - vb : vb - va;
      }
      const va = a[sortKey] ?? '';
      const vb = b[sortKey] ?? '';
      return sortAsc
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });

    return list;
  }, [
    mode,
    shipments,
    checklistItems,
    search,
    filterStatus,
    filterStatusDokumen,
    onlyProcessSignal,
    filterJalur,
    filterCustomer,
    filterImportir,
    filterChecker,
    dateField,
    dateFrom,
    dateTo,
    sortKey,
    sortAsc,
  ]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterStatusDokumen('');
    setOnlyProcessSignal(false);
    setFilterJalur('');
    setFilterCustomer('');
    setFilterImportir('');
    setFilterChecker('');
    setDateField('eta');
    setDateFrom('');
    setDateTo('');
  };

  const handleToggleImportirFilter = (kodeImportir: string) => {
    setFilterImportir((prev) => (prev === kodeImportir ? '' : kodeImportir));
  };

  const canCreate = canPerformAction(userRole, 'create_shipment');
  const canEdit = canUserEditAnyPhase({ role: userRole, phasePermissions });
  const canEditPhase1 = canUserEditPhase({ role: userRole, phasePermissions }, 1);

  const outstandingColumns: Array<{ key: SortKey; label: string }> = [
    { key: 'kodeOs', label: 'Kode OS' },
    { key: 'kodeManualDokOs', label: 'Dok. OS' },
    { key: 'dokumenChecker', label: 'Checker' },
    { key: 'kodeCustomer', label: 'Kode Customer' },
    { key: 'kodeImportir', label: 'Kode Importir' },
    { key: 'namaCustomer', label: 'Customer' },
    { key: 'noBl', label: 'No. BL' },
    { key: 'eta', label: 'ETA / ETD' },
    { key: 'countDownEta', label: 'Countdown' },
    { key: 'statusDokumen', label: 'Status Dok' },
    { key: 'status', label: 'Status' },
    { key: 'jalur', label: 'Jalur' },
    { key: 'noAju', label: 'No. AJU' },
    { key: 'tglSppb', label: 'Tgl SPPB' },
  ];

  const handleSaveManualDokOs = async () => {
    if (!editingManualOs || !onUpdateKodeManualDokOs || savingManualOs) return;
    setSavingManualOs(true);
    try {
      await onUpdateKodeManualDokOs(editingManualOs.kodeOs, editingManualOs.value);
      setEditingManualOs(null);
    } finally {
      setSavingManualOs(false);
    }
  };

  const renderDokOsCellContent = (s: Shipment) => {
    const isEditing = editingManualOs?.kodeOs === s.kodeOs;
    if (isEditing && editingManualOs) {
      return (
        <div
          className="inline-flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            autoFocus
            aria-label={`Input Dok. OS ${s.kodeOs}`}
            value={editingManualOs.value}
            onChange={(e) =>
              setEditingManualOs({ kodeOs: s.kodeOs, value: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSaveManualDokOs();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setEditingManualOs(null);
              }
            }}
            placeholder="TN-196"
            className="w-20 px-1.5 py-0.5 rounded border border-[#F28C28] dark:border-violet-400 bg-white dark:bg-[#182032] font-mono-code text-[11px] font-semibold text-slate-900 dark:text-white focus:outline-none"
          />
          <button
            type="button"
            disabled={savingManualOs}
            aria-label={`Simpan Dok. OS ${s.kodeOs}`}
            onClick={() => void handleSaveManualDokOs()}
            className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            type="button"
            aria-label={`Batal edit Dok. OS ${s.kodeOs}`}
            onClick={() => setEditingManualOs(null)}
            className="p-1 rounded bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      );
    }

    const code = (s.kodeManualDokOs || '').trim();
    return (
      <div
        className="inline-flex items-center gap-1 group/dokos"
        onClick={(e) => {
          if (canEditPhase1 && onUpdateKodeManualDokOs) {
            e.stopPropagation();
          }
        }}
      >
        {code ? (
          <span
            title="Kode Manual Terima Dokumen (Kode Dok Pemilik)"
            className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 font-mono-code font-bold text-[#0B2545] dark:text-amber-200"
          >
            {code}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 font-mono-code">-</span>
        )}
        {canEditPhase1 && onUpdateKodeManualDokOs && (
          <button
            type="button"
            aria-label={`Ubah Dok. OS ${s.kodeOs}`}
            title="Ubah Kode Manual Terima Dokumen / Dok. OS"
            onClick={(e) => {
              e.stopPropagation();
              setEditingManualOs({ kodeOs: s.kodeOs, value: code });
            }}
            className="p-1 rounded text-slate-400 hover:text-[#0B2545] dark:hover:text-violet-300 hover:bg-slate-100 dark:hover:bg-white/10 opacity-75 group-hover/dokos:opacity-100 cursor-pointer"
          >
            <Pencil className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    );
  };

  const renderSortButton = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="inline-flex items-center gap-1 hover:text-[#0B2545] dark:hover:text-white cursor-pointer"
    >
      <span>{label}</span>
      <ArrowUpDown
        className={`w-3 h-3 shrink-0 ${
          sortKey === key
            ? 'text-[#F28C28] dark:text-violet-400'
            : 'text-slate-400 dark:text-slate-500'
        }`}
      />
    </button>
  );

  const inputSurfaceCls =
    'w-full min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40 focus:border-[#F28C28] dark:focus:border-violet-500';

  const globalJalurSum = {
    Hijau: importirSummary.items.reduce((acc, i) => acc + (i.byJalur.Hijau || 0), 0),
    Kuning: importirSummary.items.reduce((acc, i) => acc + (i.byJalur.Kuning || 0), 0),
    Merah: importirSummary.items.reduce((acc, i) => acc + (i.byJalur.Merah || 0), 0),
    MITA: importirSummary.items.reduce((acc, i) => acc + (i.byJalur.MITA || 0), 0),
    'Belum Ada': importirSummary.items.reduce((acc, i) => acc + (i.byJalur['Belum Ada'] || 0), 0),
  };

  return (
    <div className="space-y-4">
      {/* Print Header */}
      <div className="hidden print-only-header mb-4">
        <h2 className="text-lg font-bold">
          {mode === 'outstanding'
            ? 'Laporan Dokumen Outstanding PTG PPJK'
            : 'Laporan Seluruh Shipment PTG PPJK'}
        </h2>
        <p className="text-xs text-slate-600">
          Dicetak: {new Date().toLocaleString('id-ID')} · Total: {filtered.length} baris
        </p>
      </div>

      {/* Filter & Export Toolbar */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative basis-full sm:basis-auto sm:flex-1 min-w-0 sm:min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Cari shipment"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Kode OS, Dok. OS (TN-196), Kode/Nama Importir, No. BL, Packinglist, AJU, NOPEN, Kontainer, Customer..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40 focus:border-[#F28C28] dark:focus:border-violet-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                exportShipmentsToExcel(
                  filtered,
                  mode === 'outstanding' ? 'PTG_Outstanding.xlsx' : 'PTG_Semua_Shipment.xlsx'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() =>
                exportShipmentsToCSV(
                  filtered,
                  mode === 'outstanding' ? 'PTG_Outstanding.csv' : 'PTG_Semua_Shipment.csv'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() =>
                exportShipmentsToPDF(
                  filtered,
                  mode === 'outstanding'
                    ? 'Laporan Dokumen Outstanding PTG PPJK'
                    : 'Laporan Seluruh Shipment PTG PPJK',
                  mode === 'outstanding' ? 'PTG_Outstanding.pdf' : 'PTG_Semua_Shipment.pdf',
                  pengaturan
                )
              }
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
            {mode === 'outstanding' && (
              <button
                type="button"
                disabled={filtered.length === 0}
                onClick={() => {
                  if (filtered.length > 0) setKdiPreviewShipment(filtered[0]);
                }}
                title="Print Lembar Kelengkapan Dokumen Impor (KDI) / Dasi Depan Bundel MAP dengan Kop PPJK"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B2545] dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 hover:bg-[#143764] disabled:opacity-50 text-xs font-semibold text-white cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#F28C28] dark:text-white" />
                <span>Print KDI (MAP)</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <select
            aria-label="Filter Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={inputSurfaceCls}
          >
            <option value="">Semua Status</option>
            {statusList.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Status Dokumen Checker"
            value={filterStatusDokumen}
            onChange={(e) =>
              setFilterStatusDokumen(e.target.value as '' | StatusDokumenType)
            }
            className={inputSurfaceCls}
          >
            <option value="">Status Dok: Semua</option>
            <option value="Draft">Dokumen: Draft</option>
            <option value="Ready">Dokumen: Ready</option>
          </select>

          <select
            aria-label="Filter Jalur"
            value={filterJalur}
            onChange={(e) => setFilterJalur(e.target.value)}
            className={inputSurfaceCls}
          >
            <option value="">Semua Jalur</option>
            {jalurList.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Customer"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className={inputSurfaceCls}
          >
            <option value="">Semua Customer</option>
            {uniqueCustomers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Kode Importir"
            value={filterImportir}
            onChange={(e) => setFilterImportir(e.target.value)}
            className={inputSurfaceCls}
          >
            <option value="">Semua Importir</option>
            {importirSummary.items.map((item) => (
              <option key={item.kodeImportir} value={item.kodeImportir}>
                {item.kodeImportir === 'Belum Diisi'
                  ? 'Belum Diisi'
                  : `${item.kodeImportir} — ${item.namaImportir}`}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Dokumen Checker"
            value={filterChecker}
            onChange={(e) => setFilterChecker(e.target.value)}
            className={inputSurfaceCls}
          >
            <option value="">Semua Checker</option>
            {uniqueCheckers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select
            aria-label="Jenis tanggal filter"
            value={dateField}
            onChange={(e) =>
              setDateField(e.target.value as ShipmentDateFilterField)
            }
            className="w-full sm:w-auto min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="eta">Filter Tgl: ETA</option>
            <option value="etd">Filter Tgl: ETD</option>
            <option value="tglTerimaDok">Filter Tgl: Tgl Terima</option>
            <option value="tglSppb">Filter Tgl: Tgl SPPB</option>
          </select>
          <input
            type="date"
            aria-label="Tanggal mulai"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 sm:flex-none min-w-0 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100"
          />
          <span className="text-xs text-slate-400">s/d</span>
          <input
            type="date"
            aria-label="Tanggal akhir"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 sm:flex-none min-w-0 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={() => setOnlyProcessSignal((v) => !v)}
            aria-pressed={onlyProcessSignal}
            data-testid="filter-process-signal-btn"
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              onlyProcessSignal
                ? 'bg-red-600 text-white border-red-600'
                : processSignalTotal > 0
                ? 'bg-red-50 dark:bg-red-500/15 text-red-800 dark:text-red-300 border-red-300 dark:border-red-500/35 hover:bg-red-100 dark:hover:bg-red-500/25'
                : 'bg-white dark:bg-[#182032] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-[#1F2940]'
            }`}
          >
            {processSignalTotal > 0 && !onlyProcessSignal && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 dark:bg-red-500" />
              </span>
            )}
            <span>Sinyal Segera Proses ({processSignalTotal})</span>
          </button>

          <button
            type="button"
            onClick={resetFilters}
            title="Reset Filter"
            aria-label="Reset filter"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {filterImportir && (
            <button
              type="button"
              onClick={() => setFilterImportir('')}
              data-testid="active-importir-filter-badge"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0B2545] dark:text-violet-200 bg-orange-50 dark:bg-violet-500/20 border border-orange-200 dark:border-violet-500/40 rounded-md px-2.5 py-1.5 cursor-pointer"
            >
              <span>
                Importir: {filterImportir} ({filtered.length} dok)
              </span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {(dateFrom || dateTo) && (
            <span
              data-testid="active-date-range-badge"
              className="text-[11px] font-medium text-[#0B2545] dark:text-violet-200 bg-slate-100 dark:bg-violet-500/15 border border-slate-200 dark:border-violet-500/30 rounded-md px-2.5 py-1.5 tabular-nums"
            >
              Memantau {DATE_FIELD_LABELS[dateField]}: {dateFrom || '...'} s/d{' '}
              {dateTo || '...'} ({filtered.length} dokumen)
            </span>
          )}
        </div>
      </div>

      {/* Summary Kode Importir (Selalu tampil tanpa hidden di modul Semua Shipment) */}
      {mode === 'all' && importirSummary.items.length > 0 && (
        <section
          data-testid="importir-summary-section"
          className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden"
        >
          <div className="px-4 py-3.5 border-b border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-[#182032]/70">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0B2545] dark:bg-violet-500/20 text-white dark:text-violet-300 flex items-center justify-center shrink-0 mt-0.5">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0B2545] dark:text-white">
                  Summary Kode Importir
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Rekap lengkap per Kode Importir tanpa kolom tersembunyi — klik baris untuk filter tabel barisan shipment di bawah.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-200 tabular-nums">
                {importirSummary.totalImportirs} Importir Terdaftar
              </span>
              <span className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131926] text-[#0B2545] dark:text-violet-300 tabular-nums">
                {importirSummary.totalShipments} Total Shipment
              </span>
              {filterImportir && (
                <button
                  type="button"
                  onClick={() => setFilterImportir('')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F28C28] dark:bg-violet-600 text-white hover:opacity-90 cursor-pointer"
                >
                  <span>Tampilkan Semua Importir</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Desktop / Tablet Summary Table (semua kolom visible, tersusun rapih tanpa terpotong) */}
          <div className="hidden md:block overflow-x-auto">
            <table
              data-testid="importir-summary-table"
              className="w-full text-left border-collapse text-[11px]"
            >
              <thead>
                <tr className="bg-slate-50 dark:bg-[#182032] border-b border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300">
                  <th className="py-2.5 px-2 font-semibold whitespace-nowrap">Kode Importir</th>
                  <th className="py-2.5 px-2 font-semibold whitespace-nowrap">Nama Importir</th>
                  <th className="py-2.5 px-2 font-semibold whitespace-nowrap">Customer Terkait</th>
                  <th className="py-2.5 px-1.5 font-semibold text-right whitespace-nowrap">Total</th>
                  <th className="py-2.5 px-1.5 font-semibold text-right whitespace-nowrap">Draft</th>
                  <th className="py-2.5 px-1.5 font-semibold text-right whitespace-nowrap">Ready</th>
                  <th className="py-2.5 px-1.5 font-semibold text-right whitespace-nowrap">OS</th>
                  <th className="py-2.5 px-1.5 font-semibold text-right whitespace-nowrap">Selesai</th>
                  <th className="py-2.5 px-1.5 font-semibold text-right whitespace-nowrap">SPPB</th>
                  <th className="py-2.5 px-1.5 font-semibold text-right whitespace-nowrap">Gate-Out</th>
                  <th className="py-2.5 px-2 font-semibold whitespace-nowrap">Distribusi Jalur</th>
                  <th className="py-2.5 px-2.5 font-semibold text-right whitespace-nowrap">Nilai BM/PDRI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {importirSummary.items.map((item) => {
                  const isActive = filterImportir === item.kodeImportir;
                  return (
                    <tr
                      key={item.kodeImportir}
                      data-testid={`importir-summary-row-${item.kodeImportir}`}
                      onClick={() => handleToggleImportirFilter(item.kodeImportir)}
                      className={`cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-orange-50 dark:bg-violet-500/15 hover:bg-orange-100/80 dark:hover:bg-violet-500/20'
                          : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono-code font-bold border ${
                            isActive
                              ? 'bg-[#F28C28] text-white border-[#F28C28] dark:bg-violet-600 dark:border-violet-500'
                              : 'bg-slate-100 dark:bg-white/[0.07] text-[#0B2545] dark:text-violet-300 border-slate-200 dark:border-white/10'
                          }`}
                        >
                          {item.kodeImportir}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-semibold text-slate-900 dark:text-white leading-snug max-w-[165px]">
                        {item.namaImportir}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 dark:text-slate-300 leading-snug max-w-[165px]">
                        {item.customerNames.length > 0 ? item.customerNames.join(', ') : '-'}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-bold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                        {item.total}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-semibold tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">
                        {item.draftCount}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                        {item.readyCount}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-semibold tabular-nums text-orange-700 dark:text-orange-300 whitespace-nowrap">
                        {item.outstanding}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-semibold tabular-nums text-sky-700 dark:text-sky-300 whitespace-nowrap">
                        {item.completed}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-semibold tabular-nums text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                        {item.sppbCount}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-semibold tabular-nums text-teal-700 dark:text-teal-300 whitespace-nowrap">
                        {item.gateOutCount}
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 tabular-nums text-[10px] font-semibold">
                          <span title="Jalur Hijau" className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">
                            H:{item.byJalur.Hijau || 0}
                          </span>
                          <span title="Jalur Kuning" className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30">
                            K:{item.byJalur.Kuning || 0}
                          </span>
                          <span title="Jalur Merah" className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30">
                            M:{item.byJalur.Merah || 0}
                          </span>
                          <span title="Jalur MITA" className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30">
                            MT:{item.byJalur.MITA || 0}
                          </span>
                          <span title="Belum Ada Jalur" className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/[0.06] dark:text-slate-300 dark:border-white/10">
                            B:{item.byJalur['Belum Ada'] || 0}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono-code font-semibold tabular-nums text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {item.bmPdriTotal > 0 ? formatRupiah(item.bmPdriTotal) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr
                  data-testid="importir-summary-total-row"
                  className="bg-slate-100 dark:bg-[#182032] border-t-2 border-slate-300 dark:border-white/15 font-bold text-slate-900 dark:text-white"
                >
                  <td className="py-2.5 px-2 whitespace-nowrap" colSpan={3}>
                    Total Keseluruhan ({importirSummary.items.length} Kelompok Kode Importir)
                  </td>
                  <td className="py-2.5 px-1.5 text-right tabular-nums whitespace-nowrap">
                    {importirSummary.totalShipments}
                  </td>
                  <td className="py-2.5 px-1.5 text-right tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">
                    {importirSummary.totalDraft}
                  </td>
                  <td className="py-2.5 px-1.5 text-right tabular-nums text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                    {importirSummary.totalReady}
                  </td>
                  <td className="py-2.5 px-1.5 text-right tabular-nums text-orange-700 dark:text-orange-300 whitespace-nowrap">
                    {importirSummary.totalOutstanding}
                  </td>
                  <td className="py-2.5 px-1.5 text-right tabular-nums text-sky-700 dark:text-sky-300 whitespace-nowrap">
                    {importirSummary.totalCompleted}
                  </td>
                  <td className="py-2.5 px-1.5 text-right tabular-nums text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                    {importirSummary.totalSppb}
                  </td>
                  <td className="py-2.5 px-1.5 text-right tabular-nums text-teal-700 dark:text-teal-300 whitespace-nowrap">
                    {importirSummary.totalGateOut}
                  </td>
                  <td className="py-2.5 px-2 whitespace-nowrap">
                    <div className="inline-flex items-center gap-1 tabular-nums text-[10px]">
                      <span>H:{globalJalurSum.Hijau}</span>
                      <span>·</span>
                      <span>K:{globalJalurSum.Kuning}</span>
                      <span>·</span>
                      <span>M:{globalJalurSum.Merah}</span>
                      <span>·</span>
                      <span>MT:{globalJalurSum.MITA}</span>
                      <span>·</span>
                      <span>B:{globalJalurSum['Belum Ada']}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono-code tabular-nums whitespace-nowrap">
                    {importirSummary.totalBmPdri > 0
                      ? formatRupiah(importirSummary.totalBmPdri)
                      : '-'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Summary Cards (< 768px) — seluruh metrik tampil tanpa hidden */}
          <div
            data-testid="mobile-importir-summary-cards"
            className="md:hidden p-3 space-y-2.5"
          >
            {importirSummary.items.map((item) => {
              const isActive = filterImportir === item.kodeImportir;
              return (
                <button
                  key={item.kodeImportir}
                  type="button"
                  onClick={() => handleToggleImportirFilter(item.kodeImportir)}
                  className={`w-full text-left rounded-xl border p-3 space-y-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-orange-50 dark:bg-violet-500/15 border-[#F28C28] dark:border-violet-400'
                      : 'bg-slate-50/70 dark:bg-[#182032] border-slate-200 dark:border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block font-mono-code text-xs font-bold text-[#0B2545] dark:text-violet-300">
                        {item.kodeImportir}
                      </span>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">
                        {item.namaImportir}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/10 text-xs font-bold tabular-nums text-slate-900 dark:text-white shrink-0">
                      {item.total} Dok
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    Customer:{' '}
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {item.customerNames.length > 0 ? item.customerNames.join(', ') : '-'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-[11px] tabular-nums">
                    <div className="px-2 py-1 rounded bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-white/10">
                      Draft: <span className="font-bold text-amber-700 dark:text-amber-300">{item.draftCount}</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-white/10">
                      Ready: <span className="font-bold text-emerald-700 dark:text-emerald-300">{item.readyCount}</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-white/10">
                      OS: <span className="font-bold text-orange-700 dark:text-orange-300">{item.outstanding}</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-white/10">
                      Selesai: <span className="font-bold text-sky-700 dark:text-sky-300">{item.completed}</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-white/10">
                      SPPB: <span className="font-bold text-indigo-700 dark:text-indigo-300">{item.sppbCount}</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-white/10">
                      Gate-Out: <span className="font-bold text-teal-700 dark:text-teal-300">{item.gateOutCount}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 text-[10px] font-semibold tabular-nums">
                    <span>Jalur:</span>
                    <span>H:{item.byJalur.Hijau || 0}</span>
                    <span>·</span>
                    <span>K:{item.byJalur.Kuning || 0}</span>
                    <span>·</span>
                    <span>M:{item.byJalur.Merah || 0}</span>
                    <span>·</span>
                    <span>MITA:{item.byJalur.MITA || 0}</span>
                    <span>·</span>
                    <span>Belum:{item.byJalur['Belum Ada'] || 0}</span>
                  </div>

                  <div className="text-[11px] font-mono-code font-semibold text-slate-800 dark:text-slate-100">
                    Nilai BM/PDRI: {item.bmPdriTotal > 0 ? formatRupiah(item.bmPdriTotal) : '-'}
                  </div>
                </button>
              );
            })}

            {/* Mobile Total Card */}
            <div className="rounded-xl border-2 border-slate-300 dark:border-white/15 bg-slate-100 dark:bg-[#182032] p-3 space-y-1 text-xs font-bold text-slate-900 dark:text-white tabular-nums">
              <div className="flex justify-between">
                <span>Total Keseluruhan</span>
                <span>{importirSummary.totalShipments} Dok</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Draft: {importirSummary.totalDraft} · Ready: {importirSummary.totalReady} · OS:{' '}
                {importirSummary.totalOutstanding} · Selesai: {importirSummary.totalCompleted} · SPPB:{' '}
                {importirSummary.totalSppb} · Gate-Out: {importirSummary.totalGateOut}
              </div>
              <div className="text-[11px] font-mono-code">
                Nilai BM/PDRI:{' '}
                {importirSummary.totalBmPdri > 0
                  ? formatRupiah(importirSummary.totalBmPdri)
                  : '-'}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-10 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {shipments.length === 0
              ? 'Belum ada data shipment tercatat.'
              : 'Tidak ada shipment yang cocok dengan filter saat ini.'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {shipments.length === 0
              ? 'Tambahkan shipment pertama untuk memulai pelacakan dokumen PPJK.'
              : 'Coba ubah kata kunci pencarian atau reset filter.'}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {shipments.length > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
              >
                Reset Filter
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={onCreateShipment}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-xs font-semibold text-white cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Shipment</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* MODE ALL: Tabel Barisan Keseluruhan Tanpa Kolom Tersembunyi (Desktop & Tablet) */}
          {mode === 'all' ? (
            <div className="hidden md:block bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2 bg-slate-50/60 dark:bg-[#182032]/60">
                <div>
                  <h3 className="text-sm font-bold text-[#0B2545] dark:text-white">
                    Tabel Barisan Keseluruhan Shipment
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Menampilkan {filtered.length} dari {shipments.length} baris · Seluruh kolom operasional &amp; dokumen tersusun rapih tanpa kolom tersembunyi.
                  </p>
                </div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Geser horizontal untuk melihat seluruh barisan kolom (Kode OS &amp; Aksi tetap menempel)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table
                  data-testid="all-shipments-full-table"
                  className="w-max min-w-full text-left border-collapse text-[11px]"
                >
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#182032] border-b border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300">
                      <th className="py-2.5 px-2 font-semibold text-center whitespace-nowrap">
                        No.
                      </th>
                      <th className="py-2.5 px-2.5 font-semibold whitespace-nowrap md:sticky md:left-0 z-20 bg-slate-50 dark:bg-[#182032] border-r border-slate-200 dark:border-white/[0.08]">
                        {renderSortButton('kodeOs', 'Kode OS')}
                      </th>
                      <th
                        title="Kode Manual Terima Dokumen / Kode Dok Pemilik"
                        className="py-2.5 px-2 font-semibold whitespace-nowrap"
                      >
                        {renderSortButton('kodeManualDokOs', 'Dok. OS (Manual)')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('dokumenChecker', 'Checker')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('statusDokumen', 'Status Dok')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('kodeCustomer', 'Kode Customer')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('namaCustomer', 'Nama Customer')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('kodeImportir', 'Kode Importir')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        Nama Importir
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('tglTerimaDok', 'Tgl. Terima Dok')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        Terima Dok
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('noPackinglist', 'No. Packinglist')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('noBl', 'No. BL')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        BC 1.1
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('ship', 'Ship / Vessel')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('shipper', 'Shipper')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('negaraAsal', 'Negara Asal')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        Description
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        No. Kontainer
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('etd', 'ETD')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('eta', 'ETA')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('countDownEta', 'Countdown')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('noAju', 'No. AJU')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('tglAju', 'Tgl. AJU')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('nopen', 'NOPEN')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('tglNopen', 'Tgl. NOPEN')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('status', 'Status')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('jalur', 'Jalur')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('currency', 'Currency')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold text-right whitespace-nowrap">
                        {renderSortButton('kurs', 'Kurs')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold text-right whitespace-nowrap">
                        {renderSortButton('invoice', 'Nilai Invoice')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        BM / PDRI
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        SPTNP
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('noSppb', 'No. SPPB')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        {renderSortButton('tglSppb', 'Tgl. SPPB')}
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        D/O Pelayaran
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        Gate Pass &amp; Trucking
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        Gate-Out &amp; Surat Jalan
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        Penagihan
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        PFPB / PFPD / ESLAH
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        Dok. OS
                      </th>
                      <th className="py-2.5 px-2.5 font-semibold text-right whitespace-nowrap no-print md:sticky md:right-0 z-20 bg-slate-50 dark:bg-[#182032] border-l border-slate-200 dark:border-white/[0.08]">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {filtered.map((s, idx) => {
                      const urgent = isUrgentMissingAju(s);
                      const processSignal = getShipmentProcessSignal(s);
                      const isHighlighted = urgent || processSignal.active;
                      const terimaProgress = formatChecklistProgress(s.terimaDok, checklistItems);
                      const osProgress = formatChecklistProgress(s.dokumenOs, checklistItems);
                      const osOutstanding = isShipmentOutstanding(s, checklistItems);

                      const rowBgCls = isHighlighted
                        ? 'bg-red-50 dark:bg-[#24131D] hover:bg-red-100 dark:hover:bg-[#2D1724]'
                        : 'bg-white dark:bg-[#131926] hover:bg-slate-50 dark:hover:bg-[#182032]';

                      const stickyBgCls = isHighlighted
                        ? 'bg-red-50 dark:bg-[#24131D] group-hover:bg-red-100 dark:group-hover:bg-[#2D1724]'
                        : 'bg-white dark:bg-[#131926] group-hover:bg-slate-50 dark:group-hover:bg-[#182032]';

                      return (
                        <tr
                          key={s.kodeOs}
                          onClick={() => onOpenDetail(s.kodeOs)}
                          className={`group cursor-pointer transition-colors ${rowBgCls}`}
                        >
                          {/* 1. No. */}
                          <td className="py-2 px-2 text-center tabular-nums font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {idx + 1}
                          </td>

                          {/* 2. Kode OS (sticky left opaque) */}
                          <td
                            className={`py-2 px-2.5 whitespace-nowrap md:sticky md:left-0 z-10 border-r border-slate-200 dark:border-white/[0.08] transition-colors ${stickyBgCls}`}
                          >
                            <div className="font-mono-code font-semibold text-[#0B2545] dark:text-violet-300">
                              {s.kodeOs}
                            </div>
                            <div className="flex flex-col items-start gap-1 mt-0.5">
                              <ProcessSignalBadge shipment={s} compact />
                              {urgent && (
                                <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 dark:text-red-400">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Tanpa AJU</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 3. Kode Manual Terima Dokumen / Dok. OS */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            {renderDokOsCellContent(s)}
                          </td>

                          {/* 4. Checker */}
                          <td className="py-2 px-2 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                            {s.dokumenChecker || '-'}
                          </td>

                          {/* 4. Status Dok */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <StatusDokumenBadge
                              statusDokumen={s.statusDokumen}
                              onToggle={
                                canEditPhase1 && onUpdateStatusDokumen
                                  ? (next) => void onUpdateStatusDokumen(s.kodeOs, next)
                                  : undefined
                              }
                            />
                          </td>

                          {/* 5. Kode Customer */}
                          <td className="py-2 px-2 font-mono-code whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {s.kodeCustomer || '-'}
                          </td>

                          {/* 6. Nama Customer */}
                          <td className="py-2 px-2 whitespace-nowrap font-medium text-slate-900 dark:text-white">
                            {s.namaCustomer || '-'}
                          </td>

                          {/* 7. Kode Importir */}
                          <td className="py-2 px-2 font-mono-code whitespace-nowrap font-semibold text-[#0B2545] dark:text-violet-300">
                            {s.kodeImportir || '-'}
                          </td>

                          {/* 8. Nama Importir */}
                          <td className="py-2 px-2 whitespace-nowrap text-slate-700 dark:text-slate-200">
                            {resolveImportirName(s.kodeImportir)}
                          </td>

                          {/* 9. Tgl. Terima Dok */}
                          <td className="py-2 px-2 tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {s.tglTerimaDok || '-'}
                          </td>

                          {/* 10. Terima Dok */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded font-semibold tabular-nums border text-[10px] ${
                                terimaProgress.checked === terimaProgress.total
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                              }`}
                            >
                              {terimaProgress.checked}/{terimaProgress.total}
                            </span>
                            {s.terimaDok?.catatan && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[160px] truncate" title={s.terimaDok.catatan}>
                                {s.terimaDok.catatan}
                              </div>
                            )}
                          </td>

                          {/* 11. No. Packinglist */}
                          <td className="py-2 px-2 font-mono-code whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {s.noPackinglist || '-'}
                          </td>

                          {/* 12. No. BL */}
                          <td className="py-2 px-2 font-mono-code whitespace-nowrap text-slate-800 dark:text-slate-200">
                            {s.noBl || '-'}
                          </td>

                          {/* 13. BC 1.1 */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            {s.bc11Terbit || s.noBc11 ? (
                              <div>
                                <div className="font-mono-code font-semibold text-red-700 dark:text-red-400">
                                  {s.noBc11 || 'BC 1.1 Terbit'}
                                </div>
                                {s.tglBc11 && (
                                  <div className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                                    {s.tglBc11}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">-</span>
                            )}
                          </td>

                          {/* 14. Ship / Vessel */}
                          <td className="py-2 px-2 whitespace-nowrap text-slate-800 dark:text-slate-200">
                            {s.ship || '-'}
                          </td>

                          {/* 15. Shipper */}
                          <td className="py-2 px-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {s.shipper || '-'}
                          </td>

                          {/* 16. Negara Asal */}
                          <td className="py-2 px-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {s.negaraAsal || '-'}
                          </td>

                          {/* 17. Description */}
                          <td className="py-2 px-2 whitespace-nowrap text-slate-700 dark:text-slate-200">
                            {s.description || '-'}
                          </td>

                          {/* 18. No. Kontainer */}
                          <td className="py-2 px-2 font-mono-code whitespace-nowrap text-slate-700 dark:text-slate-200">
                            {s.noCont || '-'}
                          </td>

                          {/* 19. ETD */}
                          <td className="py-2 px-2 tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {s.etd || '-'}
                          </td>

                          {/* 20. ETA */}
                          <td className="py-2 px-2 tabular-nums whitespace-nowrap text-slate-800 dark:text-slate-200">
                            {s.eta || '-'}
                          </td>

                          {/* 21. Countdown */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <CountdownBadge days={s.countDownEta} />
                          </td>

                          {/* 22. No. AJU */}
                          <td className="py-2 px-2 font-mono-code whitespace-nowrap text-slate-800 dark:text-slate-200">
                            {s.noAju || '-'}
                          </td>

                          {/* 23. Tgl. AJU */}
                          <td className="py-2 px-2 tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {s.tglAju || '-'}
                          </td>

                          {/* 24. NOPEN */}
                          <td className="py-2 px-2 font-mono-code whitespace-nowrap text-slate-800 dark:text-slate-200">
                            {s.nopen || '-'}
                          </td>

                          {/* 25. Tgl. NOPEN */}
                          <td className="py-2 px-2 tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {s.tglNopen || '-'}
                          </td>

                          {/* 26. Status */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <StatusBadge status={s.status} />
                          </td>

                          {/* 27. Jalur */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <JalurBadge jalur={s.jalur} />
                          </td>

                          {/* 28. Currency */}
                          <td className="py-2 px-2 font-mono-code whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {s.currency || '-'}
                          </td>

                          {/* 29. Kurs */}
                          <td className="py-2 px-2 text-right font-mono-code tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {formatNumberId(s.kurs)}
                          </td>

                          {/* 30. Nilai Invoice */}
                          <td className="py-2 px-2 text-right font-mono-code font-semibold tabular-nums whitespace-nowrap text-slate-900 dark:text-white">
                            {formatNumberId(s.invoice)}
                          </td>

                          {/* 31. BM / PDRI */}
                          <td className="py-2 px-2 whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">
                            {s.bmPdri || '-'}
                          </td>

                          {/* 32. SPTNP */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              {s.sptnp || '-'}
                            </div>
                            {(s.noSptnp || s.tglSptnp) && (
                              <div className="text-[10px] font-mono-code text-slate-500 dark:text-slate-400">
                                {s.noSptnp || '-'} {s.tglSptnp ? `(${s.tglSptnp})` : ''}
                              </div>
                            )}
                          </td>

                          {/* 33. No. SPPB */}
                          <td className="py-2 px-2 font-mono-code whitespace-nowrap text-slate-800 dark:text-slate-200">
                            {s.noSppb || '-'}
                          </td>

                          {/* 34. Tgl. SPPB */}
                          <td className="py-2 px-2 tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {s.tglSppb || '-'}
                          </td>

                          {/* 35. D/O Pelayaran */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <StatusDoBadge statusDo={s.doPelayaranStatus} />
                              <DoValidityBadge
                                doBerlakuSampai={s.doBerlakuSampai}
                                shipmentStatus={s.status}
                              />
                            </div>
                            {s.doCatatanPerpanjangan && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[200px] truncate" title={s.doCatatanPerpanjangan}>
                                {s.doCatatanPerpanjangan}
                              </div>
                            )}
                          </td>

                          {/* 36. Gate Pass & Trucking */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <StatusGatePassBadge statusGatePass={s.doGatePassStatus} />
                              <StatusTruckingBadge statusTrucking={s.truckingStatus} />
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {s.doGatePassJenis || s.doGatePassNomor
                                ? `${s.doGatePassJenis || 'Gate Pass'}: ${s.doGatePassNomor || '-'}`
                                : 'Eslah/TILA: -'}
                              {s.truckingNamaSupir || s.truckingNoPlat
                                ? ` · ${s.truckingNamaSupir || '-'} (${s.truckingNoPlat || '-'})`
                                : ''}
                            </div>
                          </td>

                          {/* 37. Gate-Out & Surat Jalan */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <StatusGateOutBadge
                                gateOutStatus={s.gateOutStatus}
                                shipmentStatus={s.status}
                              />
                              <StatusSuratJalanBadge
                                suratJalanStatus={s.suratJalanStatus}
                                gateOutStatus={s.gateOutStatus}
                                shipmentStatus={s.status}
                              />
                            </div>
                            <div className="text-[10px] font-mono-code text-slate-500 dark:text-slate-400 mt-0.5">
                              {s.suratJalanNomor ? `${s.suratJalanNomor}` : 'SJ: -'}
                              {s.gateOutTanggal ? ` · Out: ${s.gateOutTanggal}` : ''}
                            </div>
                          </td>

                          {/* 38. Penagihan */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <StatusPenagihanBadge
                              billingStatus={s.billingStatus}
                              shipment={s}
                            />
                            {(s.billingNomor || s.billingTotal) && (
                              <div className="text-[10px] font-mono-code text-slate-500 dark:text-slate-400 mt-0.5">
                                {s.billingNomor || '-'}
                                {s.billingTotal ? ` · ${formatRupiah(s.billingTotal)}` : ''}
                              </div>
                            )}
                          </td>

                          {/* 39. PFPB / PFPD / ESLAH */}
                          <td className="py-2 px-2 whitespace-nowrap text-[10px] text-slate-600 dark:text-slate-300">
                            <div>
                              PFPB: <span className="font-mono-code">{s.pfpb || '-'}</span>{' '}
                              {s.tglPfpb ? `(${s.tglPfpb})` : ''}
                            </div>
                            <div>
                              PFPD: <span className="font-mono-code">{s.pfpd || '-'}</span>{' '}
                              {s.tglPfpd ? `(${s.tglPfpd})` : ''}
                            </div>
                            <div>
                              ESLAH: <span className="font-mono-code">{s.eslah || '-'}</span>{' '}
                              {s.tglEslah ? `(${s.tglEslah})` : ''}
                            </div>
                          </td>

                          {/* 40. Dok. OS */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded font-semibold tabular-nums border text-[10px] ${
                                !osOutstanding
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                                  : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30'
                              }`}
                            >
                              {osProgress.checked}/{osProgress.total} ·{' '}
                              {osOutstanding ? 'OS' : 'Selesai'}
                            </span>
                            {s.dokumenOs?.catatan && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[160px] truncate" title={s.dokumenOs.catatan}>
                                {s.dokumenOs.catatan}
                              </div>
                            )}
                          </td>

                          {/* 41. Aksi (sticky right opaque) */}
                          <td
                            className={`py-2 px-2.5 text-right whitespace-nowrap no-print md:sticky md:right-0 z-10 border-l border-slate-200 dark:border-white/[0.08] transition-colors ${stickyBgCls}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onOpenDetail(s.kodeOs)}
                                className="px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-[11px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                              >
                                Detail
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => onEditShipment(s.kodeOs)}
                                  className="px-2 py-1 rounded-md bg-slate-200 dark:bg-violet-500/20 hover:bg-slate-300 dark:hover:bg-violet-500/30 text-[11px] font-semibold text-slate-800 dark:text-violet-200 cursor-pointer"
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
            </div>
          ) : (
            /* MODE OUTSTANDING: Compact Operational Data Table */
            <div className="hidden md:block bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-x-auto">
              <table
                data-testid="outstanding-shipments-table"
                className="w-full text-left border-collapse text-[10.5px]"
              >
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#182032] border-b border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300">
                    {outstandingColumns.map((col) => (
                      <th key={col.key} className="py-2.5 px-1.5 font-semibold whitespace-nowrap">
                        {renderSortButton(col.key, col.label)}
                      </th>
                    ))}
                    <th className="py-2.5 px-2 font-semibold text-right no-print md:sticky md:right-0 z-10 bg-slate-50 dark:bg-[#182032] border-l border-slate-200 dark:border-white/[0.08]">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {filtered.map((s) => {
                    const urgent = isUrgentMissingAju(s);
                    const processSignal = getShipmentProcessSignal(s);
                    const isHighlighted = urgent || processSignal.active;
                    const cellPx = 'px-1.5';
                    const stickyActionBg = isHighlighted
                      ? 'bg-red-50 dark:bg-[#2A141A]'
                      : 'bg-white dark:bg-[#131926]';
                    return (
                      <tr
                        key={s.kodeOs}
                        onClick={() => onOpenDetail(s.kodeOs)}
                        className={`cursor-pointer transition-colors ${
                          isHighlighted
                            ? 'bg-red-50/75 dark:bg-red-950/30 hover:bg-red-100/70 dark:hover:bg-red-950/45'
                            : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <td className={`py-2 ${cellPx} whitespace-nowrap`}>
                          <div className="font-mono-code font-semibold text-[#0B2545] dark:text-violet-300">
                            {s.kodeOs}
                          </div>
                          <div className="flex flex-col items-start gap-1 mt-0.5">
                            <ProcessSignalBadge shipment={s} compact />
                            {urgent && (
                              <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 dark:text-red-400">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Tanpa AJU</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className={`py-2 ${cellPx} whitespace-nowrap`}>
                          {renderDokOsCellContent(s)}
                        </td>
                        <td className={`py-2 ${cellPx} max-w-[90px]`}>
                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate" title={s.dokumenChecker || '-'}>
                            {s.dokumenChecker || '-'}
                          </div>
                        </td>
                        <td className={`py-2 ${cellPx} font-mono-code whitespace-nowrap text-slate-700 dark:text-slate-300`}>
                          {s.kodeCustomer || '-'}
                        </td>
                        <td className={`py-2 ${cellPx} font-mono-code whitespace-nowrap text-slate-700 dark:text-slate-300`}>
                          {s.kodeImportir || '-'}
                        </td>
                        <td className={`py-2 ${cellPx} max-w-[105px]`}>
                          <div className="font-medium text-slate-900 dark:text-white truncate" title={s.namaCustomer}>
                            {s.namaCustomer}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={s.noCont}>
                            {s.noCont || '-'}
                          </div>
                        </td>
                        <td className={`py-2 ${cellPx} font-mono-code whitespace-nowrap text-slate-700 dark:text-slate-300 max-w-[92px]`}>
                          <div className="truncate" title={s.noBl}>
                            {s.noBl}
                          </div>
                          {(s.bc11Terbit || s.noBc11) && (
                            <div className="text-[10px] font-semibold text-red-700 dark:text-red-400 truncate">
                              BC11: {s.noBc11 || 'Terbit'}
                            </div>
                          )}
                        </td>
                        <td className={`py-2 ${cellPx} tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200`}>
                          <div>{s.eta || '-'}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            ETD: {s.etd || '-'}
                          </div>
                        </td>
                        <td className={`py-2 ${cellPx} whitespace-nowrap`}>
                          <CountdownBadge days={s.countDownEta} />
                        </td>
                        <td className={`py-2 ${cellPx} whitespace-nowrap`}>
                          <StatusDokumenBadge
                            statusDokumen={s.statusDokumen}
                            onToggle={
                              canEditPhase1 && onUpdateStatusDokumen
                                ? (next) => void onUpdateStatusDokumen(s.kodeOs, next)
                                : undefined
                            }
                          />
                        </td>
                        <td className={`py-2 ${cellPx} whitespace-nowrap`}>
                          <StatusBadge status={s.status} />
                        </td>
                        <td className={`py-2 ${cellPx} whitespace-nowrap`}>
                          <JalurBadge jalur={s.jalur} />
                        </td>
                        <td className={`py-2 ${cellPx} font-mono-code whitespace-nowrap text-slate-700 dark:text-slate-300 max-w-[86px] truncate`} title={s.noAju || '-'}>
                          {s.noAju || '-'}
                        </td>
                        <td className={`py-2 ${cellPx} tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300`}>
                          {s.tglSppb || '-'}
                        </td>
                        <td
                          className={`py-2 px-2 text-right whitespace-nowrap no-print md:sticky md:right-0 z-10 border-l border-slate-200 dark:border-white/[0.08] ${stickyActionBg}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Print KDI ${s.kodeOs}`}
                              title="Print Kelengkapan Dokumen Impor (KDI) / Dasi Depan Bundel MAP"
                              onClick={() => setKdiPreviewShipment(s)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#0B2545]/25 dark:border-violet-500/35 bg-[#0B2545]/5 dark:bg-violet-500/15 hover:bg-[#0B2545]/10 dark:hover:bg-violet-500/25 text-[11px] font-semibold text-[#0B2545] dark:text-violet-200 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" />
                              <span>KDI</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenDetail(s.kodeOs)}
                              className="px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-[11px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              Detail
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => onEditShipment(s.kodeOs)}
                                className="px-2 py-1 rounded-md bg-slate-200 dark:bg-violet-500/20 hover:bg-slate-300 dark:hover:bg-violet-500/30 text-[11px] font-semibold text-slate-800 dark:text-violet-200 cursor-pointer"
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
          )}

          {/* Mobile Card List (< 768px) */}
          <div className="md:hidden space-y-3" data-testid="mobile-shipment-cards">
            {filtered.map((s, idx) => {
              const urgent = isUrgentMissingAju(s);
              const processSignal = getShipmentProcessSignal(s);
              const isHighlighted = urgent || processSignal.active;
              const terimaProgress = formatChecklistProgress(s.terimaDok, checklistItems);
              const osProgress = formatChecklistProgress(s.dokumenOs, checklistItems);
              const osOutstanding = isShipmentOutstanding(s, checklistItems);

              return (
                <div
                  key={s.kodeOs}
                  className={`rounded-2xl border p-4 space-y-2.5 ${
                    isHighlighted
                      ? 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-500/40'
                      : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono-code text-xs font-bold text-[#0B2545] dark:text-violet-300">
                          {mode === 'all' ? `#${idx + 1} · ${s.kodeOs}` : s.kodeOs}
                        </span>
                        {s.kodeManualDokOs && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 font-mono-code text-[10px] font-bold text-[#0B2545] dark:text-amber-200">
                            Dok. OS: {s.kodeManualDokOs}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                        {s.namaCustomer}
                      </div>
                    </div>
                    <CountdownBadge days={s.countDownEta} />
                  </div>

                  {processSignal.active && (
                    <div>
                      <ProcessSignalBadge shipment={s} />
                    </div>
                  )}

                  {mode === 'all' ? (
                    <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                      <div className="grid grid-cols-1 gap-0.5 p-2 rounded-lg bg-slate-50 dark:bg-[#182032] border border-slate-200/70 dark:border-white/[0.06]">
                        <div>
                          Checker: <span className="font-semibold text-slate-800 dark:text-slate-200">{s.dokumenChecker || '-'}</span>
                        </div>
                        <div>
                          Kode Cust: <span className="font-mono-code text-slate-800 dark:text-slate-200">{s.kodeCustomer || '-'}</span>
                        </div>
                        <div>
                          Importir:{' '}
                          <span className="font-mono-code font-semibold text-[#0B2545] dark:text-violet-300">
                            {s.kodeImportir || '-'}
                          </span>{' '}
                          — <span className="text-slate-800 dark:text-slate-200">{resolveImportirName(s.kodeImportir)}</span>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <div>
                          Tgl Terima: <span className="tabular-nums text-slate-800 dark:text-slate-200">{s.tglTerimaDok || '-'}</span> · Terima Dok:{' '}
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{terimaProgress.checked}/{terimaProgress.total}</span>
                        </div>
                        <div>
                          Packinglist: <span className="font-mono-code text-slate-800 dark:text-slate-200">{s.noPackinglist || '-'}</span> · BL:{' '}
                          <span className="font-mono-code text-slate-800 dark:text-slate-200">{s.noBl || '-'}</span>
                        </div>
                        <div>
                          BC 1.1: <span className="font-mono-code text-slate-800 dark:text-slate-200">{s.bc11Terbit || s.noBc11 ? `${s.noBc11 || 'Terbit'} (${s.tglBc11 || '-'})` : '-'}</span>
                        </div>
                        <div>
                          Ship: <span className="text-slate-800 dark:text-slate-200">{s.ship || '-'}</span> · Shipper:{' '}
                          <span className="text-slate-800 dark:text-slate-200">{s.shipper || '-'}</span> ({s.negaraAsal || '-'})
                        </div>
                        <div>
                          Desc: <span className="text-slate-800 dark:text-slate-200">{s.description || '-'}</span>
                        </div>
                        <div>
                          Kontainer: <span className="font-mono-code text-slate-800 dark:text-slate-200">{s.noCont || '-'}</span>
                        </div>
                        <div>
                          ETD: <span className="tabular-nums text-slate-800 dark:text-slate-200">{s.etd || '-'}</span> · ETA:{' '}
                          <span className="tabular-nums text-slate-800 dark:text-slate-200">{s.eta || '-'}</span>
                        </div>
                        <div>
                          AJU: <span className="font-mono-code text-slate-800 dark:text-slate-200">{s.noAju || '-'}</span> ({s.tglAju || '-'}) · NOPEN:{' '}
                          <span className="font-mono-code text-slate-800 dark:text-slate-200">{s.nopen || '-'}</span> ({s.tglNopen || '-'})
                        </div>
                        <div>
                          Nilai: <span className="font-mono-code font-semibold text-slate-800 dark:text-slate-200">{s.currency || '-'} {formatNumberId(s.invoice)}</span> · Kurs:{' '}
                          <span className="tabular-nums text-slate-800 dark:text-slate-200">{formatNumberId(s.kurs)}</span> · BM/PDRI:{' '}
                          <span className="text-slate-800 dark:text-slate-200">{s.bmPdri || '-'}</span>
                        </div>
                        <div>
                          SPTNP: <span className="text-slate-800 dark:text-slate-200">{s.sptnp || '-'} {s.noSptnp ? `(${s.noSptnp})` : ''}</span> · SPPB:{' '}
                          <span className="font-mono-code text-slate-800 dark:text-slate-200">{s.noSppb || '-'}</span> ({s.tglSppb || '-'})
                        </div>
                        <div>
                          PFPB: {s.pfpb || '-'} · PFPD: {s.pfpd || '-'} · ESLAH: {s.eslah || '-'} · Dok OS:{' '}
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {osProgress.checked}/{osProgress.total} ({osOutstanding ? 'OS' : 'Selesai'})
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <StatusDoBadge statusDo={s.doPelayaranStatus} />
                        <StatusGatePassBadge statusGatePass={s.doGatePassStatus} />
                        <StatusTruckingBadge statusTrucking={s.truckingStatus} />
                        <StatusGateOutBadge gateOutStatus={s.gateOutStatus} shipmentStatus={s.status} />
                        <StatusSuratJalanBadge
                          suratJalanStatus={s.suratJalanStatus}
                          gateOutStatus={s.gateOutStatus}
                          shipmentStatus={s.status}
                        />
                        <StatusPenagihanBadge billingStatus={s.billingStatus} shipment={s} />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                      <div>
                        Checker: <span className="font-medium text-slate-800 dark:text-slate-200">{s.dokumenChecker || '-'}</span>
                      </div>
                      <div>
                        Kode Cust: <span className="font-mono-code text-slate-800 dark:text-slate-200">{s.kodeCustomer || '-'}</span> · Kode Imp:{' '}
                        <span className="font-mono-code text-slate-800 dark:text-slate-200">{s.kodeImportir || '-'}</span>
                      </div>
                      <div>
                        No. BL: <span className="font-mono-code text-slate-800 dark:text-slate-200">{s.noBl}</span>
                        {(s.bc11Terbit || s.noBc11) && (
                          <>
                            {' '}· BC 1.1: <span className="font-mono-code font-semibold text-red-700 dark:text-red-400">{s.noBc11 || 'Terbit'}</span>
                          </>
                        )}
                      </div>
                      <div>
                        ETD: <span className="tabular-nums text-slate-800 dark:text-slate-200">{s.etd || '-'}</span> · ETA:{' '}
                        <span className="tabular-nums text-slate-800 dark:text-slate-200">{s.eta || '-'}</span>
                      </div>
                      <div>
                        AJU: <span className="font-mono-code text-slate-800 dark:text-slate-200">{s.noAju || '-'}</span>
                      </div>
                      <div>
                        Kontainer: {s.noCont || '-'}
                      </div>
                    </div>
                  )}

                  {urgent && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Peringatan: ETA &lt; 3 hari tanpa No. AJU</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <StatusDokumenBadge
                      statusDokumen={s.statusDokumen}
                      onToggle={
                        canEditPhase1 && onUpdateStatusDokumen
                          ? (next) => void onUpdateStatusDokumen(s.kodeOs, next)
                          : undefined
                      }
                    />
                    <StatusBadge status={s.status} />
                    <JalurBadge jalur={s.jalur} />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                    {mode === 'outstanding' && (
                      <button
                        type="button"
                        onClick={() => setKdiPreviewShipment(s)}
                        className="inline-flex items-center justify-center gap-1 min-h-[44px] px-3 py-2 rounded-lg bg-[#0B2545] dark:bg-violet-600/25 border border-[#0B2545]/20 dark:border-violet-500/35 text-xs font-semibold text-white dark:text-violet-200 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>KDI</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenDetail(s.kodeOs)}
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      Lihat 39 Kolom
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onEditShipment(s.kodeOs)}
                        className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-[#F28C28] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-xs font-semibold text-white cursor-pointer"
                      >
                        Edit Shipment
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <KdiPrintModal
        isOpen={Boolean(kdiPreviewShipment)}
        initialShipment={kdiPreviewShipment}
        availableShipments={filtered}
        importirs={importirs}
        pengaturan={pengaturan}
        pengeluaranOps={pengeluaranOps}
        onClose={() => setKdiPreviewShipment(null)}
      />
    </div>
  );
}
