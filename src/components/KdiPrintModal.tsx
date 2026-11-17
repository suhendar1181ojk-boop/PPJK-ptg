import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Download,
  FileText,
  Layers,
  Printer,
  RotateCcw,
  X,
} from 'lucide-react';
import type {
  Importir,
  Pengaturan,
  PengeluaranOpsItem,
  Shipment,
} from '../types/ppjk';
import {
  buildKdiCoverDocument,
  extractVoyFromShip,
  type KdiCoverRow,
} from '../utils/kdiCoverLogic';
import { exportBatchKdiCoverPDF, exportKdiCoverPDF } from '../utils/exportUtils';

interface KdiPrintModalProps {
  isOpen: boolean;
  initialShipment: Shipment | null;
  availableShipments?: Shipment[];
  importirs?: Importir[];
  pengaturan?: Pengaturan;
  pengeluaranOps?: PengeluaranOpsItem[];
  onClose: () => void;
}

export const KdiPrintModal: React.FC<KdiPrintModalProps> = ({
  isOpen,
  initialShipment,
  availableShipments = [],
  importirs = [],
  pengaturan,
  pengeluaranOps = [],
  onClose,
}) => {
  const [selectedKodeOs, setSelectedKodeOs] = useState(
    initialShipment?.kodeOs || ''
  );
  const [fillAutoStatus, setFillAutoStatus] = useState(true);
  const [voy, setVoy] = useState('');
  const [portOfLoading, setPortOfLoading] = useState('');
  const [portOfDischarge, setPortOfDischarge] = useState('TANJUNG PRIOK, Indonesia');
  const [bc11Pos, setBc11Pos] = useState('');
  const [sealBhdlNo, setSealBhdlNo] = useState('');
  const [rowEdits, setRowEdits] = useState<KdiCoverRow[] | null>(null);

  const shipmentList = useMemo(() => {
    if (availableShipments.length > 0) return availableShipments;
    return initialShipment ? [initialShipment] : [];
  }, [availableShipments, initialShipment]);

  const activeShipment = useMemo(() => {
    if (!shipmentList.length) return initialShipment;
    return (
      shipmentList.find((s) => s.kodeOs === selectedKodeOs) ||
      initialShipment ||
      shipmentList[0]
    );
  }, [shipmentList, selectedKodeOs, initialShipment]);

  useEffect(() => {
    if (isOpen && initialShipment) {
      setSelectedKodeOs(initialShipment.kodeOs);
      const parsed = extractVoyFromShip(initialShipment.ship);
      setVoy(parsed.voy);
      setPortOfLoading(initialShipment.negaraAsal || '');
      setPortOfDischarge('TANJUNG PRIOK, Indonesia');
      setBc11Pos('');
      setSealBhdlNo('');
      setRowEdits(null);
    }
  }, [isOpen, initialShipment]);

  useEffect(() => {
    if (!isOpen || !activeShipment) return;
    const parsed = extractVoyFromShip(activeShipment.ship);
    setVoy(parsed.voy);
    setPortOfLoading(activeShipment.negaraAsal || '');
    setRowEdits(null);
  }, [activeShipment?.kodeOs, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('kdi-printing');
    return () => {
      document.body.classList.remove('kdi-printing');
    };
  }, [isOpen]);

  const baseDoc = useMemo(() => {
    if (!activeShipment) return null;
    return buildKdiCoverDocument(activeShipment, {
      importirs,
      pengaturan,
      pengeluaranOps,
      voy,
      portOfLoading,
      portOfDischarge,
      bc11Pos,
      sealBhdlNo,
      fillAutoStatus,
    });
  }, [
    activeShipment,
    importirs,
    pengaturan,
    pengeluaranOps,
    voy,
    portOfLoading,
    portOfDischarge,
    bc11Pos,
    sealBhdlNo,
    fillAutoStatus,
  ]);

  const kdiDoc = useMemo(() => {
    if (!baseDoc) return null;
    if (!rowEdits) return baseDoc;
    return {
      ...baseDoc,
      rows: rowEdits,
    };
  }, [baseDoc, rowEdits]);

  if (!isOpen || !activeShipment || !kdiDoc) return null;

  const toggleBox = (rowIndex: number, target: 'ada' | 'tidak') => {
    const sourceRows = rowEdits || kdiDoc.rows;
    const next = sourceRows.map((row, idx) => {
      if (idx !== rowIndex) return row;
      if (target === 'ada') {
        const nextAda = !row.ada;
        return { ...row, ada: nextAda, tidak: nextAda ? false : row.tidak };
      }
      const nextTidak = !row.tidak;
      return { ...row, tidak: nextTidak, ada: nextTidak ? false : row.ada };
    });
    setRowEdits(next);
  };

  const updateRowField = (
    rowIndex: number,
    field: 'via' | 'keterangan' | 'terimaTgl',
    value: string
  ) => {
    const sourceRows = rowEdits || kdiDoc.rows;
    setRowEdits(
      sourceRows.map((row, idx) =>
        idx === rowIndex ? { ...row, [field]: value } : row
      )
    );
  };

  const handleDownloadSinglePdf = () => {
    exportKdiCoverPDF(activeShipment, {
      importirs,
      pengaturan,
      pengeluaranOps,
      voy,
      portOfLoading,
      portOfDischarge,
      bc11Pos,
      sealBhdlNo,
      fillAutoStatus,
      customRows: kdiDoc.rows,
    });
  };

  const handleDownloadBatchPdf = () => {
    exportBatchKdiCoverPDF(shipmentList, {
      importirs,
      pengaturan,
      pengeluaranOps,
      portOfDischarge,
      fillAutoStatus,
    });
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const initials =
    kdiDoc.identity.brandName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'PPJK';

  const metaLeftRight: Array<{
    lLabel: string;
    lVal: string;
    rLabel?: string;
    rVal?: string;
  }> = [
    { lLabel: 'CONTAINER NO.', lVal: kdiDoc.containerNo },
    { lLabel: 'BL NO.', lVal: kdiDoc.blNo, rLabel: 'TANGGAL', rVal: kdiDoc.blTanggal },
    { lLabel: 'SHIPPER', lVal: kdiDoc.shipper },
    { lLabel: 'CUSTOMER', lVal: kdiDoc.customer },
    { lLabel: 'COMMODITY', lVal: kdiDoc.commodity },
    { lLabel: 'CONSIGNEE', lVal: kdiDoc.consignee },
    { lLabel: 'VESSEL', lVal: kdiDoc.vessel, rLabel: 'VOY', rVal: kdiDoc.voy },
    { lLabel: 'E.T.D', lVal: kdiDoc.etd },
    { lLabel: 'E.T.A', lVal: kdiDoc.eta },
    { lLabel: 'PORT OF LOADING', lVal: kdiDoc.portOfLoading },
    { lLabel: 'PORT OF DISCHARGE', lVal: kdiDoc.portOfDischarge },
    {
      lLabel: 'NO. PENGAJUAN PIB',
      lVal: kdiDoc.noPengajuanPib,
      rLabel: 'TANGGAL',
      rVal: kdiDoc.tglPengajuanPib,
    },
    { lLabel: 'NO. PIB', lVal: kdiDoc.noPib, rLabel: 'TANGGAL', rVal: kdiDoc.tglPib },
    { lLabel: 'PFPB (BHDL)', lVal: kdiDoc.pfpb, rLabel: 'TANGGAL', rVal: kdiDoc.tglPfpb },
    {
      lLabel: 'PFPD (SPTNP/SPPB)',
      lVal: kdiDoc.pfpd,
      rLabel: 'TANGGAL',
      rVal: kdiDoc.tglPfpd,
    },
    { lLabel: 'SPTNP NO.', lVal: kdiDoc.sptnpNo, rLabel: 'TANGGAL', rVal: kdiDoc.tglSptnp },
    { lLabel: 'SPPB NO.', lVal: kdiDoc.sppbNo, rLabel: 'TANGGAL', rVal: kdiDoc.tglSppb },
    { lLabel: 'ESLAH OLEH', lVal: kdiDoc.eslahOleh, rLabel: 'TANGGAL', rVal: kdiDoc.tglEslah },
    { lLabel: 'TRUCKING SUPIR', lVal: kdiDoc.truckingSupir, rLabel: 'NOPOL', rVal: kdiDoc.nopol },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preview & Cetak Kelengkapan Dokumen Impor (KDI)"
      className="kdi-print-root kdi-print-backdrop fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="kdi-print-dialog bg-slate-100 dark:bg-[#0D1320] border border-slate-300 dark:border-white/10 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Toolbar (Hidden when printing) */}
        <div className="kdi-print-controls shrink-0 bg-[#0B2545] dark:bg-[#151D2F] text-white px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#F28C28]/20 border border-[#F28C28]/40 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-[#F28C28]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">
                Print Kelengkapan Dokumen Impor (KDI) — Dasi Depan Bundel MAP
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                Format A4 Portrait resmi lengkap dengan Kop PPJK & checklist 20 dokumen standar.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#0B2545] hover:bg-slate-100 text-xs font-bold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Printer</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSinglePdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F28C28] hover:bg-[#d97719] text-white text-xs font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh PDF KDI</span>
            </button>
            {shipmentList.length > 1 && (
              <button
                type="button"
                onClick={handleDownloadBatchPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Batch PDF ({shipmentList.length} OS)</span>
              </button>
            )}
            <button
              type="button"
              aria-label="Tutup modal cetak KDI"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Customization Bar (Hidden when printing) */}
        <div className="kdi-print-controls shrink-0 bg-white dark:bg-[#131926] border-b border-slate-200 dark:border-white/[0.08] px-4 sm:px-5 py-2.5 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end text-xs">
            {shipmentList.length > 1 && (
              <div className="lg:col-span-2">
                <label
                  htmlFor="kdi-select-os"
                  className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
                >
                  Pilih Dokumen OS
                </label>
                <select
                  id="kdi-select-os"
                  value={activeShipment.kodeOs}
                  onChange={(e) => setSelectedKodeOs(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                >
                  {shipmentList.map((s) => (
                    <option key={s.kodeOs} value={s.kodeOs}>
                      {s.kodeOs}
                      {s.kodeManualDokOs ? ` [${s.kodeManualDokOs}]` : ''} — {s.namaCustomer} ({s.noBl || '-'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="kdi-voy"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                VOY
              </label>
              <input
                id="kdi-voy"
                type="text"
                value={voy}
                onChange={(e) => setVoy(e.target.value)}
                placeholder="Mis. 170S"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="kdi-pod"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                Port of Discharge
              </label>
              <input
                id="kdi-pod"
                type="text"
                value={portOfDischarge}
                onChange={(e) => setPortOfDischarge(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="kdi-pos"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                Pos BC 1.1
              </label>
              <input
                id="kdi-pos"
                type="text"
                value={bc11Pos}
                onChange={(e) => setBc11Pos(e.target.value)}
                placeholder="Nomor Pos"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="kdi-seal"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                No. Seal BHDL
              </label>
              <input
                id="kdi-seal"
                type="text"
                value={sealBhdlNo}
                onChange={(e) => setSealBhdlNo(e.target.value)}
                placeholder="No. Seal"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-200 font-medium">
              <input
                type="checkbox"
                checked={fillAutoStatus}
                onChange={(e) => {
                  setFillAutoStatus(e.target.checked);
                  setRowEdits(null);
                }}
                className="rounded border-slate-300 text-[#0B2545] focus:ring-[#F28C28]"
              />
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                Isi tanda <strong>[X]</strong> otomatis dari data OS (matikan untuk cetak blanko kosong)
              </span>
            </label>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Tip: Klik kotak <strong>ADA / TIDAK</strong> di bawah untuk menyesuaikan tanda [X] sebelum cetak.
              </span>
              {rowEdits && (
                <button
                  type="button"
                  onClick={() => setRowEdits(null)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F28C28] dark:text-violet-300 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Printable A4 Sheet Area */}
        <div className="flex-1 min-h-0 p-3 sm:p-5 overflow-y-auto bg-slate-200/80 dark:bg-[#090D16]">
          <div className="kdi-sheet-paper mx-auto bg-white text-slate-900 w-full max-w-[794px] p-6 sm:p-8 rounded-sm shadow-lg border border-slate-300">
            {/* 1. KOP PPJK */}
            <div className="flex items-center gap-3.5 pb-2.5 border-b-[3px] border-[#0B2545] relative">
              <div className="w-12 h-12 rounded-lg bg-[#0B2545] border-2 border-[#F28C28] flex flex-col items-center justify-center shrink-0 text-white">
                <span className="text-sm font-extrabold leading-none">{initials}</span>
                <span className="text-[8px] font-bold text-[#F28C28] tracking-widest mt-0.5">
                  PPJK
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base sm:text-lg font-extrabold text-[#0B2545] uppercase tracking-tight leading-tight">
                  {kdiDoc.identity.companyName}
                </div>
                <div className="text-[11px] font-bold text-[#D97719]">
                  {kdiDoc.identity.brandName} · {kdiDoc.identity.tagline}
                </div>
                <div className="text-[10px] text-slate-600 leading-snug mt-0.5">
                  {kdiDoc.identity.address}
                  {kdiDoc.identity.phone ? ` | Telp: ${kdiDoc.identity.phone}` : ''}
                  {kdiDoc.identity.email ? ` | Email: ${kdiDoc.identity.email}` : ''}
                </div>
                {(kdiDoc.identity.npwp || kdiDoc.identity.website) && (
                  <div className="text-[9.5px] text-slate-500">
                    {[
                      kdiDoc.identity.npwp ? `NPWP / Izin: ${kdiDoc.identity.npwp}` : '',
                      kdiDoc.identity.website || '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                )}
              </div>
            </div>
            <div className="h-[2px] bg-[#F28C28] mb-3" />

            {/* 2. Judul Dokumen */}
            <div className="text-center mb-3">
              <h1 className="text-sm sm:text-base font-extrabold tracking-wide text-slate-950 underline underline-offset-4">
                KELENGKAPAN DOKUMEN IMPOR
              </h1>
              <div className="text-[10.5px] font-bold text-slate-700 mt-1 font-mono-code">
                {kdiDoc.subtitleLine}
              </div>
            </div>

            {/* 3. Metadata 2 Kolom */}
            <div className="grid grid-cols-1 gap-y-[2px] text-[10.5px] leading-tight mb-3 px-1">
              {metaLeftRight.map((m) => (
                <div key={m.lLabel} className="grid grid-cols-12 items-baseline gap-1">
                  <div className={m.rLabel ? 'col-span-7 grid grid-cols-12' : 'col-span-12 grid grid-cols-12'}>
                    <span className={m.rLabel ? 'col-span-5 font-bold text-slate-900' : 'col-span-3 font-bold text-slate-900'}>
                      {m.lLabel}
                    </span>
                    <span className={m.rLabel ? 'col-span-7 font-medium text-slate-800 break-words' : 'col-span-9 font-medium text-slate-800 break-words'}>
                      : {m.lVal || ''}
                    </span>
                  </div>
                  {m.rLabel && (
                    <div className="col-span-5 grid grid-cols-12">
                      <span className="col-span-4 font-bold text-slate-900">{m.rLabel}</span>
                      <span className="col-span-8 font-medium text-slate-800 break-words">
                        : {m.rVal || ''}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 4. Tabel Checklist 20 Baris */}
            <table className="kdi-checklist-table w-full border-collapse border border-slate-900 text-[10.5px]">
              <thead>
                <tr className="bg-slate-100 text-[#0B2545] font-bold text-center">
                  <th className="border border-slate-900 px-1.5 py-1.5 w-8">NO</th>
                  <th className="border border-slate-900 px-2 py-1.5 text-left w-[27%]">
                    URAIAN DOKUMEN
                  </th>
                  <th className="border border-slate-900 px-1.5 py-1.5 w-12">ADA</th>
                  <th className="border border-slate-900 px-1.5 py-1.5 w-12">TIDAK</th>
                  <th className="border border-slate-900 px-1.5 py-1.5 w-[14%]">TERIMA TGL</th>
                  <th className="border border-slate-900 px-1.5 py-1.5 w-[11%]">VIA</th>
                  <th className="border border-slate-900 px-2 py-1.5 text-left">KETERANGAN</th>
                </tr>
              </thead>
              <tbody>
                {kdiDoc.rows.map((row, idx) => (
                  <tr key={row.no} className="leading-tight">
                    <td className="border border-slate-900 px-1 py-1 text-center font-medium">
                      {row.no}
                    </td>
                    <td className="border border-slate-900 px-2 py-1 font-bold text-slate-900">
                      {row.uraian}
                    </td>
                    <td className="border border-slate-900 px-1 py-0.5 text-center">
                      <button
                        type="button"
                        aria-label={`ADA ${row.uraian}`}
                        onClick={() => toggleBox(idx, 'ada')}
                        className="inline-flex items-center justify-center w-7 h-4 border border-slate-900 bg-white text-[10px] font-extrabold text-slate-950 cursor-pointer hover:bg-slate-100"
                      >
                        {row.ada ? 'X' : ''}
                      </button>
                    </td>
                    <td className="border border-slate-900 px-1 py-0.5 text-center">
                      <button
                        type="button"
                        aria-label={`TIDAK ${row.uraian}`}
                        onClick={() => toggleBox(idx, 'tidak')}
                        className="inline-flex items-center justify-center w-7 h-4 border border-slate-900 bg-white text-[10px] font-extrabold text-slate-950 cursor-pointer hover:bg-slate-100"
                      >
                        {row.tidak ? 'X' : ''}
                      </button>
                    </td>
                    <td className="border border-slate-900 px-1 py-0.5 text-center">
                      <input
                        type="text"
                        aria-label={`Terima Tgl ${row.uraian}`}
                        value={row.terimaTgl}
                        onChange={(e) => updateRowField(idx, 'terimaTgl', e.target.value)}
                        className="w-full text-center bg-transparent text-[10px] focus:outline-none focus:bg-amber-50"
                      />
                    </td>
                    <td className="border border-slate-900 px-1 py-0.5 text-center">
                      <input
                        type="text"
                        aria-label={`Via ${row.uraian}`}
                        value={row.via}
                        onChange={(e) => updateRowField(idx, 'via', e.target.value)}
                        className="w-full text-center bg-transparent text-[10px] font-medium focus:outline-none focus:bg-amber-50"
                      />
                    </td>
                    <td className="border border-slate-900 px-1.5 py-0.5">
                      <input
                        type="text"
                        aria-label={`Keterangan ${row.uraian}`}
                        value={row.keterangan}
                        onChange={(e) => updateRowField(idx, 'keterangan', e.target.value)}
                        className="w-full bg-transparent text-[10px] focus:outline-none focus:bg-amber-50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 5. Footer Checklist & Tanda Tangan */}
            <div className="mt-4 pt-1 flex flex-wrap items-center justify-between gap-4 px-3 text-[11px] font-bold text-slate-900">
              <div>DOKUMEN CEK LIST BY : {kdiDoc.dokumenCekListBy}</div>
              <div className="pr-12">TANGGAL : {kdiDoc.tanggalCekList}</div>
            </div>
            <div className="mt-3 pt-1.5 border-t border-slate-200 text-[9px] text-slate-500 flex items-center justify-between">
              <span>
                {kdiDoc.identity.companyName} · {kdiDoc.identity.footerNote}
              </span>
              <span className="font-mono-code">{kdiDoc.kodeOs}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
