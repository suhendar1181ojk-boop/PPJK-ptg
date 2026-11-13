import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Printer,
  RotateCcw,
  Search,
} from 'lucide-react';
import type { JalurType, PhasePermissions, Shipment, UserRole } from '../types/ppjk';
import {
  canPerformAction,
  canUserEditAnyPhase,
  isShipmentOutstanding,
  isUrgentMissingAju,
} from '../utils/ppjkLogic';
import {
  exportShipmentsToCSV,
  exportShipmentsToExcel,
  exportShipmentsToPDF,
} from '../utils/exportUtils';
import { CountdownBadge, JalurBadge, StatusBadge } from './Badges';

interface ShipmentTableViewProps {
  mode: 'all' | 'outstanding';
  shipments: Shipment[];
  statusList: string[];
  jalurList: JalurType[];
  checklistItems: string[];
  userRole: UserRole;
  phasePermissions?: PhasePermissions;
  initialCheckerFilter?: string;
  onOpenDetail: (kodeOs: string) => void;
  onEditShipment: (kodeOs: string) => void;
  onCreateShipment: () => void;
}

type SortKey =
  | 'kodeOs'
  | 'dokumenChecker'
  | 'kodeCustomer'
  | 'kodeImportir'
  | 'namaCustomer'
  | 'noBl'
  | 'eta'
  | 'countDownEta'
  | 'status'
  | 'jalur'
  | 'noAju'
  | 'tglSppb';

export function ShipmentTableView({
  mode,
  shipments,
  statusList,
  jalurList,
  checklistItems,
  userRole,
  phasePermissions,
  initialCheckerFilter = '',
  onOpenDetail,
  onEditShipment,
  onCreateShipment,
}: ShipmentTableViewProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterJalur, setFilterJalur] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterChecker, setFilterChecker] = useState(initialCheckerFilter);
  const [dateField, setDateField] = useState<'eta' | 'tglTerimaDok' | 'tglSppb'>('eta');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('kodeOs');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    setFilterChecker(initialCheckerFilter);
  }, [initialCheckerFilter]);

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

  const filtered = useMemo(() => {
    let list =
      mode === 'outstanding'
        ? shipments.filter((s) => isShipmentOutstanding(s, checklistItems))
        : [...shipments];

    const q = search.trim().toLowerCase();
    list = list.filter((s) => {
      if (filterStatus && s.status !== filterStatus) return false;
      if (filterJalur && s.jalur !== filterJalur) return false;
      if (filterCustomer && s.namaCustomer !== filterCustomer) return false;
      if (filterChecker && s.dokumenChecker !== filterChecker) return false;
      if (dateFrom && (!s[dateField] || s[dateField] < dateFrom)) return false;
      if (dateTo && (!s[dateField] || s[dateField] > dateTo)) return false;

      if (q) {
        const hay = [
          s.kodeOs,
          s.dokumenChecker,
          s.kodeCustomer,
          s.kodeImportir,
          s.noBl,
          s.noAju,
          s.nopen,
          s.noCont,
          s.namaCustomer,
          s.ship,
          s.shipper,
          s.noSppb,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      let va: string | number = a[sortKey] ?? '';
      let vb: string | number = b[sortKey] ?? '';
      if (sortKey === 'countDownEta') {
        va = a.countDownEta ?? (sortAsc ? 999999 : -999999);
        vb = b.countDownEta ?? (sortAsc ? 999999 : -999999);
        return sortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va);
      }
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
    filterJalur,
    filterCustomer,
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
    setFilterJalur('');
    setFilterCustomer('');
    setFilterChecker('');
    setDateFrom('');
    setDateTo('');
  };

  const canCreate = canPerformAction(userRole, 'create_shipment');
  const canEdit = canUserEditAnyPhase({ role: userRole, phasePermissions });

  const columns: Array<{ key: SortKey; label: string }> = [
    { key: 'kodeOs', label: 'Kode OS' },
    ...(mode === 'outstanding'
      ? ([
          { key: 'dokumenChecker', label: 'Checker' },
          { key: 'kodeCustomer', label: 'Kode Customer' },
          { key: 'kodeImportir', label: 'Kode Importir' },
        ] as Array<{ key: SortKey; label: string }>)
      : []),
    { key: 'namaCustomer', label: 'Nama Customer' },
    { key: 'noBl', label: 'No. BL' },
    { key: 'eta', label: 'ETA' },
    { key: 'countDownEta', label: 'Count Down ETA' },
    { key: 'status', label: 'Status' },
    { key: 'jalur', label: 'Jalur' },
    { key: 'noAju', label: 'No. AJU' },
    { key: 'tglSppb', label: 'Tgl SPPB' },
  ];

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
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative basis-full sm:basis-auto sm:flex-1 min-w-0 sm:min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Cari shipment"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Kode OS, No. BL, No. AJU, NOPEN, No. Cont, Customer..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28]"
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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() =>
                exportShipmentsToPDF(
                  filtered,
                  mode === 'outstanding'
                    ? 'Laporan Dokumen Outstanding PTG PPJK'
                    : 'Laporan Seluruh Shipment PTG PPJK'
                )
              }
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

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <select
            aria-label="Filter Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#F28C28]"
          >
            <option value="">Semua Status</option>
            {statusList.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Jalur"
            value={filterJalur}
            onChange={(e) => setFilterJalur(e.target.value)}
            className="w-full min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#F28C28]"
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
            className="w-full min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#F28C28]"
          >
            <option value="">Semua Customer</option>
            {uniqueCustomers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Dokumen Checker"
            value={filterChecker}
            onChange={(e) => setFilterChecker(e.target.value)}
            className="w-full min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#F28C28]"
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
              setDateField(e.target.value as 'eta' | 'tglTerimaDok' | 'tglSppb')
            }
            className="w-full sm:w-auto min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          >
            <option value="eta">Filter Tgl: ETA</option>
            <option value="tglTerimaDok">Filter Tgl: Tgl Terima</option>
            <option value="tglSppb">Filter Tgl: Tgl SPPB</option>
          </select>
          <input
            type="date"
            aria-label="Tanggal mulai"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 sm:flex-none min-w-0 px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          />
          <span className="text-xs text-slate-400">s/d</span>
          <input
            type="date"
            aria-label="Tanggal akhir"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 sm:flex-none min-w-0 px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          />
          <button
            type="button"
            onClick={resetFilters}
            title="Reset Filter"
            aria-label="Reset filter"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            {shipments.length === 0
              ? 'Belum ada data shipment tercatat.'
              : 'Tidak ada shipment yang cocok dengan filter saat ini.'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {shipments.length === 0
              ? 'Tambahkan shipment pertama untuk memulai pelacakan dokumen PPJK.'
              : 'Coba ubah kata kunci pencarian atau reset filter.'}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {shipments.length > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Reset Filter
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={onCreateShipment}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] text-xs font-semibold text-white cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Shipment</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop / Tablet Compact Data Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className={`w-full text-left border-collapse ${mode === 'outstanding' ? 'text-[11.5px]' : 'text-xs'}`}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  {columns.map((col) => (
                    <th key={col.key} className={`py-2.5 ${mode === 'outstanding' ? 'px-2' : 'px-2.5'} font-semibold whitespace-nowrap`}>
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-[#0B2545] cursor-pointer"
                      >
                        <span>{col.label}</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </button>
                    </th>
                  ))}
                  <th className={`py-2.5 ${mode === 'outstanding' ? 'px-2' : 'px-2.5'} font-semibold text-right no-print`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const urgent = isUrgentMissingAju(s);
                  const cellPx = mode === 'outstanding' ? 'px-2' : 'px-2.5';
                  return (
                    <tr
                      key={s.kodeOs}
                      onClick={() => onOpenDetail(s.kodeOs)}
                      className={`cursor-pointer transition-colors ${
                        urgent
                          ? 'bg-red-50/75 hover:bg-red-100/70'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className={`py-2.5 ${cellPx} whitespace-nowrap`}>
                        <div className="font-mono-code font-semibold text-[#0B2545]">
                          {s.kodeOs}
                        </div>
                        {urgent && (
                          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 mt-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Tanpa AJU</span>
                          </div>
                        )}
                      </td>
                      {mode === 'outstanding' && (
                        <>
                          <td className={`py-2.5 ${cellPx} max-w-[115px]`}>
                            <div className="font-medium text-slate-800 truncate" title={s.dokumenChecker || '-'}>
                              {s.dokumenChecker || '-'}
                            </div>
                          </td>
                          <td className={`py-2.5 ${cellPx} font-mono-code whitespace-nowrap text-slate-700`}>
                            {s.kodeCustomer || '-'}
                          </td>
                          <td className={`py-2.5 ${cellPx} font-mono-code whitespace-nowrap text-slate-700`}>
                            {s.kodeImportir || '-'}
                          </td>
                        </>
                      )}
                      <td className={`py-2.5 ${cellPx} ${mode === 'outstanding' ? 'max-w-[140px]' : 'max-w-[165px]'}`}>
                        <div className="font-medium text-slate-900 truncate" title={s.namaCustomer}>
                          {s.namaCustomer}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate" title={s.noCont}>
                          {s.noCont || '-'}
                        </div>
                      </td>
                      <td className={`py-2.5 ${cellPx} font-mono-code whitespace-nowrap text-slate-700 max-w-[120px] truncate`} title={s.noBl}>
                        {s.noBl}
                      </td>
                      <td className={`py-2.5 ${cellPx} tabular-nums whitespace-nowrap text-slate-700`}>
                        {s.eta || '-'}
                      </td>
                      <td className={`py-2.5 ${cellPx} whitespace-nowrap`}>
                        <CountdownBadge days={s.countDownEta} />
                      </td>
                      <td className={`py-2.5 ${cellPx} whitespace-nowrap`}>
                        <StatusBadge status={s.status} />
                      </td>
                      <td className={`py-2.5 ${cellPx} whitespace-nowrap`}>
                        <JalurBadge jalur={s.jalur} />
                      </td>
                      <td className={`py-2.5 ${cellPx} font-mono-code whitespace-nowrap text-slate-700 max-w-[115px] truncate`} title={s.noAju || '-'}>
                        {s.noAju || '-'}
                      </td>
                      <td className={`py-2.5 ${cellPx} tabular-nums whitespace-nowrap text-slate-700`}>
                        {s.tglSppb || '-'}
                      </td>
                      <td
                        className="py-2.5 px-2.5 text-right whitespace-nowrap no-print"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(s.kodeOs)}
                            className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 cursor-pointer"
                          >
                            Detail
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onEditShipment(s.kodeOs)}
                              className="px-2 py-1 rounded-md bg-slate-200 hover:bg-slate-300 text-[11px] font-semibold text-slate-800 cursor-pointer"
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

          {/* Mobile Card List (< 768px) */}
          <div className="md:hidden space-y-3" data-testid="mobile-shipment-cards">
            {filtered.map((s) => {
              const urgent = isUrgentMissingAju(s);
              return (
                <div
                  key={s.kodeOs}
                  className={`rounded-xl border p-4 space-y-2.5 ${
                    urgent
                      ? 'bg-red-50/80 border-red-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono-code text-xs font-bold text-[#0B2545]">
                        {s.kodeOs}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 mt-0.5">
                        {s.namaCustomer}
                      </div>
                    </div>
                    <CountdownBadge days={s.countDownEta} />
                  </div>

                  <div className="text-xs text-slate-600 space-y-0.5">
                    {mode === 'outstanding' && (
                      <>
                        <div>
                          Checker: <span className="font-medium text-slate-800">{s.dokumenChecker || '-'}</span>
                        </div>
                        <div>
                          Kode Cust: <span className="font-mono-code text-slate-800">{s.kodeCustomer || '-'}</span> · Kode Imp:{' '}
                          <span className="font-mono-code text-slate-800">{s.kodeImportir || '-'}</span>
                        </div>
                      </>
                    )}
                    <div>
                      No. BL: <span className="font-mono-code text-slate-800">{s.noBl}</span>
                    </div>
                    <div>
                      ETA: <span className="tabular-nums text-slate-800">{s.eta || '-'}</span> · AJU:{' '}
                      <span className="font-mono-code text-slate-800">{s.noAju || '-'}</span>
                    </div>
                    <div>
                      Kontainer: {s.noCont || '-'}
                      {mode !== 'outstanding' && (
                        <>
                          {' '}· Checker: <span className="font-medium text-slate-800">{s.dokumenChecker || '-'}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {urgent && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Peringatan: ETA &lt; 3 hari tanpa No. AJU</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <StatusBadge status={s.status} />
                    <JalurBadge jalur={s.jalur} />
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(s.kodeOs)}
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      Lihat 39 Kolom
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onEditShipment(s.kodeOs)}
                        className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-[#F28C28] text-xs font-semibold text-white cursor-pointer"
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
    </div>
  );
}
