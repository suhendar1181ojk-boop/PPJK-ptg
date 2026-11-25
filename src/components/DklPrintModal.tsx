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
  buildDklCoverDocument,
  createPlaceholderNonOsShipment,
  recalculateDklTotals,
  type DklCoverRow,
} from '../utils/dklCoverLogic';
import { extractVoyFromShip } from '../utils/kdiCoverLogic';
import { formatRupiahOps, NON_OS_KODE } from '../utils/pengeluaranOpsLogic';
import { exportBatchDklCoverPDF, exportDklCoverPDF } from '../utils/exportUtils';

interface DklPrintModalProps {
  isOpen: boolean;
  initialKodeOs?: string;
  initialShipment: Shipment | null;
  availableShipments?: Shipment[];
  importirs?: Importir[];
  pengaturan?: Pengaturan;
  pengeluaranOps?: PengeluaranOpsItem[];
  defaultDiserahkanOleh?: string;
  onClose: () => void;
}

export const DklPrintModal: React.FC<DklPrintModalProps> = ({
  isOpen,
  initialKodeOs = '',
  initialShipment,
  availableShipments = [],
  importirs = [],
  pengaturan,
  pengeluaranOps = [],
  defaultDiserahkanOleh = '',
  onClose,
}) => {
  const [selectedKodeOs, setSelectedKodeOs] = useState(
    initialKodeOs || initialShipment?.kodeOs || ''
  );
  const [fillAutoStatus, setFillAutoStatus] = useState(true);
  const [voy, setVoy] = useState('');
  const [portOfDischarge, setPortOfDischarge] = useState('TANJUNG PRIOK, Indonesia');
  const [koordinatorLapangan, setKoordinatorLapangan] = useState('');
  const [noReferensiDkl, setNoReferensiDkl] = useState('');
  const [rowEdits, setRowEdits] = useState<DklCoverRow[] | null>(null);

  const shipmentList = useMemo(() => {
    const base =
      availableShipments.length > 0
        ? [...availableShipments]
        : initialShipment
        ? [initialShipment]
        : [];
    const hasNonOsExpenses = pengeluaranOps.some(
      (e) => (e.kodeOs || '').trim().toUpperCase() === NON_OS_KODE
    );
    const hasNonOsInBase = base.some(
      (s) => (s.kodeOs || '').trim().toUpperCase() === NON_OS_KODE
    );
    if ((hasNonOsExpenses || initialKodeOs === NON_OS_KODE) && !hasNonOsInBase) {
      base.push(createPlaceholderNonOsShipment());
    }
    return base;
  }, [availableShipments, initialShipment, pengeluaranOps, initialKodeOs]);

  const activeShipment = useMemo(() => {
    if (!shipmentList.length) return initialShipment;
    const key = selectedKodeOs.trim().toUpperCase();
    return (
      shipmentList.find((s) => (s.kodeOs || '').trim().toUpperCase() === key) ||
      initialShipment ||
      shipmentList[0]
    );
  }, [shipmentList, selectedKodeOs, initialShipment]);

  useEffect(() => {
    if (!isOpen) return;
    const targetOs = initialKodeOs || initialShipment?.kodeOs || shipmentList[0]?.kodeOs || '';
    setSelectedKodeOs(targetOs);
    setRowEdits(null);
  }, [isOpen, initialKodeOs, initialShipment]);

  useEffect(() => {
    if (!isOpen || !activeShipment) return;
    const parsed = extractVoyFromShip(activeShipment.ship);
    setVoy(parsed.voy);
    setPortOfDischarge('TANJUNG PRIOK, Indonesia');
    const osKey = (activeShipment.kodeOs || '').trim().toUpperCase();
    const firstOpsPetugas =
      pengeluaranOps.find(
        (e) => (e.kodeOs || '').trim().toUpperCase() === osKey && e.petugasOps?.trim()
      )?.petugasOps || '';
    setKoordinatorLapangan(firstOpsPetugas || activeShipment.dokumenChecker || '-');
    setNoReferensiDkl(
      `DKL-${(activeShipment.kodeOs || 'UMUM').replace(/^OS-/i, '').replace(/\s+\/\s+/g, '-')}`
    );
    setRowEdits(null);
  }, [activeShipment?.kodeOs, isOpen, pengeluaranOps]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('kdi-printing');
    return () => {
      document.body.classList.remove('kdi-printing');
    };
  }, [isOpen]);

  const baseDoc = useMemo(() => {
    if (!activeShipment) return null;
    return buildDklCoverDocument(activeShipment, {
      importirs,
      pengaturan,
      pengeluaranOps,
      voy,
      portOfDischarge,
      koordinatorLapangan,
      noReferensiDkl,
      diserahkanOleh: defaultDiserahkanOleh || undefined,
      fillAutoStatus,
    });
  }, [
    activeShipment,
    importirs,
    pengaturan,
    pengeluaranOps,
    voy,
    portOfDischarge,
    koordinatorLapangan,
    noReferensiDkl,
    defaultDiserahkanOleh,
    fillAutoStatus,
  ]);

  const dklDoc = useMemo(() => {
    if (!baseDoc) return null;
    if (!rowEdits) return baseDoc;
    const osKey = (activeShipment?.kodeOs || '').trim().toUpperCase();
    const matchedItems = pengeluaranOps.filter(
      (e) => (e.kodeOs || '').trim().toUpperCase() === osKey
    );
    const recalculated = recalculateDklTotals(rowEdits, matchedItems);
    return {
      ...baseDoc,
      rows: rowEdits,
      totalNominal: recalculated.totalNominal,
    };
  }, [baseDoc, rowEdits, activeShipment, pengeluaranOps]);

  if (!isOpen || !activeShipment || !dklDoc) return null;

  const toggleAda = (rowIndex: number) => {
    const sourceRows = rowEdits || dklDoc.rows;
    setRowEdits(
      sourceRows.map((row, idx) =>
        idx === rowIndex ? { ...row, ada: !row.ada } : row
      )
    );
  };

  const updateRowField = (
    rowIndex: number,
    field: 'tanggal' | 'petugasVia' | 'keterangan',
    value: string
  ) => {
    const sourceRows = rowEdits || dklDoc.rows;
    setRowEdits(
      sourceRows.map((row, idx) =>
        idx === rowIndex ? { ...row, [field]: value } : row
      )
    );
  };

  const updateRowNominal = (rowIndex: number, rawValue: string) => {
    const cleaned = rawValue.replace(/[^\d]/g, '');
    const numeric = cleaned ? Number(cleaned) : 0;
    const sourceRows = rowEdits || dklDoc.rows;
    setRowEdits(
      sourceRows.map((row, idx) =>
        idx === rowIndex
          ? { ...row, nominal: numeric, ada: numeric > 0 ? true : row.ada }
          : row
      )
    );
  };

  const handleDownloadSinglePdf = () => {
    exportDklCoverPDF(activeShipment, {
      importirs,
      pengaturan,
      pengeluaranOps,
      voy,
      portOfDischarge,
      koordinatorLapangan,
      noReferensiDkl,
      diserahkanOleh: defaultDiserahkanOleh || undefined,
      fillAutoStatus,
      customRows: dklDoc.rows,
    });
  };

  const handleDownloadBatchPdf = () => {
    exportBatchDklCoverPDF(shipmentList, {
      importirs,
      pengaturan,
      pengeluaranOps,
      portOfDischarge,
      diserahkanOleh: defaultDiserahkanOleh || undefined,
      fillAutoStatus,
    });
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const initials =
    dklDoc.identity.brandName
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
    {
      lLabel: 'CONTAINER NO.',
      lVal: dklDoc.containerNo,
      rLabel: 'NO. DKL',
      rVal: dklDoc.noReferensiDkl,
    },
    { lLabel: 'BL NO.', lVal: dklDoc.blNo, rLabel: 'TANGGAL', rVal: dklDoc.blTanggal },
    { lLabel: 'SHIPPER', lVal: dklDoc.shipper },
    { lLabel: 'CUSTOMER', lVal: dklDoc.customer },
    { lLabel: 'COMMODITY', lVal: dklDoc.commodity },
    { lLabel: 'CONSIGNEE', lVal: dklDoc.consignee },
    { lLabel: 'VESSEL', lVal: dklDoc.vessel, rLabel: 'VOY', rVal: dklDoc.voy },
    { lLabel: 'E.T.D', lVal: dklDoc.etd, rLabel: 'E.T.A', rVal: dklDoc.eta },
    { lLabel: 'PORT OF LOADING', lVal: dklDoc.portOfLoading },
    { lLabel: 'PORT OF DISCHARGE', lVal: dklDoc.portOfDischarge },
    {
      lLabel: 'NO. PENGAJUAN PIB',
      lVal: dklDoc.noPengajuanPib,
      rLabel: 'TANGGAL',
      rVal: dklDoc.tglPengajuanPib,
    },
    { lLabel: 'NO. PIB', lVal: dklDoc.noPib, rLabel: 'TANGGAL', rVal: dklDoc.tglPib },
    { lLabel: 'PFPB (BHDL)', lVal: dklDoc.pfpb, rLabel: 'TANGGAL', rVal: dklDoc.tglPfpb },
    {
      lLabel: 'PFPD (SPTNP/SPPB)',
      lVal: dklDoc.pfpd,
      rLabel: 'TANGGAL',
      rVal: dklDoc.tglPfpd,
    },
    { lLabel: 'SPTNP NO.', lVal: dklDoc.sptnpNo, rLabel: 'TANGGAL', rVal: dklDoc.tglSptnp },
    { lLabel: 'SPPB NO.', lVal: dklDoc.sppbNo, rLabel: 'TANGGAL', rVal: dklDoc.tglSppb },
    { lLabel: 'ESLAH OLEH', lVal: dklDoc.eslahOleh, rLabel: 'TANGGAL', rVal: dklDoc.tglEslah },
    { lLabel: 'TRUCKING SUPIR', lVal: dklDoc.truckingSupir, rLabel: 'NOPOL', rVal: dklDoc.nopol },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preview & Cetak Lembaran Dasi Dana Kerja Lapangan (DKL)"
      data-testid="dkl-print-modal"
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
                Print Dana Kerja Lapangan (DKL) — Lembaran Dasi Pengeluaran Per OS
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                Format A4 Portrait resmi lengkap dengan Kop PPJK &amp; 12 jenis biaya pengeluaran operasional per Dokumen OS.
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
              <span>Unduh PDF DKL</span>
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
              aria-label="Tutup modal cetak DKL"
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
            <div className={shipmentList.length > 1 ? 'lg:col-span-2' : 'lg:col-span-2'}>
              <label
                htmlFor="dkl-select-os"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                Pilih Dokumen OS
              </label>
              <select
                id="dkl-select-os"
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

            <div>
              <label
                htmlFor="dkl-no-ref"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                No. Referensi DKL
              </label>
              <input
                id="dkl-no-ref"
                type="text"
                value={noReferensiDkl}
                onChange={(e) => setNoReferensiDkl(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="dkl-koordinator"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                Pelaksana Lapangan
              </label>
              <input
                id="dkl-koordinator"
                type="text"
                value={koordinatorLapangan}
                onChange={(e) => setKoordinatorLapangan(e.target.value)}
                placeholder="Nama petugas ops"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="dkl-voy"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                VOY
              </label>
              <input
                id="dkl-voy"
                type="text"
                value={voy}
                onChange={(e) => setVoy(e.target.value)}
                placeholder="Mis. 170S"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="dkl-pod"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                Port of Discharge
              </label>
              <input
                id="dkl-pod"
                type="text"
                value={portOfDischarge}
                onChange={(e) => setPortOfDischarge(e.target.value)}
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
                Isi nominal &amp; tanda <strong>[X]</strong> otomatis dari pencatatan Keuangan Ops (matikan untuk blanko kosong)
              </span>
            </label>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Tip: Klik kotak <strong>ADA</strong> atau edit nominal langsung pada tabel sebelum cetak/unduh PDF.
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
            {dklDoc.identity.kopSuratDataUrl ? (
              <div className="mb-3">
                <div className="pb-2 border-b-[3px] border-[#0B2545]">
                  <img
                    src={dklDoc.identity.kopSuratDataUrl}
                    alt={`Kop Surat ${dklDoc.identity.companyName}`}
                    data-testid="dkl-uploaded-kop-img"
                    className="w-full max-h-28 object-contain mx-auto"
                  />
                </div>
                <div className="h-[2px] bg-[#F28C28]" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3.5 pb-2.5 border-b-[3px] border-[#0B2545] relative">
                  {dklDoc.identity.logoDataUrl ? (
                    <div className="w-14 h-14 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={dklDoc.identity.logoDataUrl}
                        alt={`Logo ${dklDoc.identity.companyName}`}
                        data-testid="dkl-uploaded-logo-img"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#0B2545] border-2 border-[#F28C28] flex flex-col items-center justify-center shrink-0 text-white">
                      <span className="text-sm font-extrabold leading-none">{initials}</span>
                      <span className="text-[8px] font-bold text-[#F28C28] tracking-widest mt-0.5">
                        PPJK
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-base sm:text-lg font-extrabold text-[#0B2545] uppercase tracking-tight leading-tight">
                      {dklDoc.identity.companyName}
                    </div>
                    <div className="text-[11px] font-bold text-[#D97719]">
                      {dklDoc.identity.brandName} · {dklDoc.identity.tagline}
                    </div>
                    <div className="text-[10px] text-slate-600 leading-snug mt-0.5">
                      {dklDoc.identity.address}
                      {dklDoc.identity.phone ? ` | Telp: ${dklDoc.identity.phone}` : ''}
                      {dklDoc.identity.email ? ` | Email: ${dklDoc.identity.email}` : ''}
                    </div>
                    {(dklDoc.identity.npwp || dklDoc.identity.website) && (
                      <div className="text-[9.5px] text-slate-500">
                        {[
                          dklDoc.identity.npwp ? `NPWP / Izin: ${dklDoc.identity.npwp}` : '',
                          dklDoc.identity.website || '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-[2px] bg-[#F28C28] mb-3" />
              </>
            )}

            {/* 2. Judul Dokumen */}
            <div className="text-center mb-3">
              <h1 className="text-sm sm:text-base font-extrabold tracking-wide text-slate-950 underline underline-offset-4">
                DANA KERJA LAPANGAN (DKL)
              </h1>
              <div className="text-[10.5px] font-bold text-slate-700 mt-1 font-mono-code">
                {dklDoc.subtitleLine}
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

            {/* 4. Tabel 13 Jenis Biaya Pengeluaran DKL */}
            <table
              data-testid="dkl-expense-table"
              className="kdi-checklist-table w-full border-collapse border border-slate-900 text-[10.5px]"
            >
              <thead>
                <tr className="bg-slate-100 text-[#0B2545] font-bold text-center">
                  <th className="border border-slate-900 px-1.5 py-1.5 w-8">NO</th>
                  <th className="border border-slate-900 px-2 py-1.5 text-left w-[24%]">
                    JENIS BIAYA PENGELUARAN
                  </th>
                  <th className="border border-slate-900 px-1.5 py-1.5 w-11">ADA</th>
                  <th className="border border-slate-900 px-1.5 py-1.5 w-[12%]">TANGGAL</th>
                  <th className="border border-slate-900 px-1.5 py-1.5 w-[14%]">PETUGAS / VIA</th>
                  <th className="border border-slate-900 px-2 py-1.5 text-right w-[15%]">
                    NOMINAL (Rp)
                  </th>
                  <th className="border border-slate-900 px-2 py-1.5 text-left">
                    KETERANGAN / TANDA TERIMA
                  </th>
                </tr>
              </thead>
              <tbody>
                {dklDoc.rows.map((row, idx) => (
                  <tr key={row.jenisBiaya} className="leading-tight">
                    <td className="border border-slate-900 px-1 py-1 text-center font-medium">
                      {row.no}
                    </td>
                    <td className="border border-slate-900 px-2 py-1 font-bold text-slate-900">
                      {row.jenisBiaya}
                    </td>
                    <td className="border border-slate-900 px-1 py-0.5 text-center">
                      <button
                        type="button"
                        aria-label={`ADA ${row.jenisBiaya}`}
                        onClick={() => toggleAda(idx)}
                        className="inline-flex items-center justify-center w-6 h-4 border border-slate-900 bg-white text-[10px] font-extrabold text-slate-950 cursor-pointer hover:bg-slate-100"
                      >
                        {row.ada ? 'X' : ''}
                      </button>
                    </td>
                    <td className="border border-slate-900 px-1 py-0.5 text-center">
                      <input
                        type="text"
                        aria-label={`Tanggal ${row.jenisBiaya}`}
                        value={row.tanggal}
                        onChange={(e) => updateRowField(idx, 'tanggal', e.target.value)}
                        className="w-full text-center bg-transparent text-[10px] tabular-nums focus:outline-none focus:bg-amber-50"
                      />
                    </td>
                    <td className="border border-slate-900 px-1 py-0.5 text-center">
                      <input
                        type="text"
                        aria-label={`Petugas ${row.jenisBiaya}`}
                        title={row.petugasVia}
                        value={row.petugasVia}
                        onChange={(e) => updateRowField(idx, 'petugasVia', e.target.value)}
                        className="print:hidden w-full text-center bg-transparent text-[9.5px] font-medium focus:outline-none focus:bg-amber-50"
                      />
                      <span className="hidden print:block whitespace-normal break-words text-[9.5px] font-medium leading-snug">
                        {row.petugasVia}
                      </span>
                    </td>
                    <td className="border border-slate-900 px-1.5 py-0.5 text-right">
                      <input
                        type="text"
                        aria-label={`Nominal ${row.jenisBiaya}`}
                        value={row.nominal > 0 ? String(row.nominal) : ''}
                        placeholder="0"
                        onChange={(e) => updateRowNominal(idx, e.target.value)}
                        className="w-full text-right bg-transparent text-[10.5px] font-bold tabular-nums focus:outline-none focus:bg-amber-50"
                      />
                    </td>
                    <td className="border border-slate-900 px-1.5 py-0.5">
                      <input
                        type="text"
                        aria-label={`Keterangan ${row.jenisBiaya}`}
                        title={row.keterangan}
                        value={row.keterangan}
                        onChange={(e) => updateRowField(idx, 'keterangan', e.target.value)}
                        className="print:hidden w-full bg-transparent text-[9.5px] focus:outline-none focus:bg-amber-50"
                      />
                      <span className="hidden print:block whitespace-normal break-words text-[9.5px] leading-snug">
                        {row.keterangan}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-extrabold text-[#0B2545]">
                  <td
                    colSpan={5}
                    className="border border-slate-900 px-2 py-1.5 text-right tracking-wide"
                  >
                    TOTAL DANA KERJA LAPANGAN (DKL)
                  </td>
                  <td
                    data-testid="dkl-total-nominal"
                    className="border border-slate-900 px-2 py-1.5 text-right tabular-nums text-[11px]"
                  >
                    {formatRupiahOps(dklDoc.totalNominal)}
                  </td>
                  <td className="border border-slate-900 px-2 py-1.5 text-[10px] font-semibold text-slate-700">
                    {dklDoc.totalTransaksi} transaksi tercatat
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Ringkasan Status Pencatatan Keuangan Ops */}
            <div className="mt-2 px-1 flex flex-wrap items-center justify-between gap-2 text-[9.5px] text-slate-700">
              <span>
                Sudah Dibayar/Selesai:{' '}
                <strong>{formatRupiahOps(dklDoc.totalSudahDibayar + dklDoc.totalSelesai)}</strong> ·
                Kasbon Ops: <strong>{formatRupiahOps(dklDoc.totalKasbon)}</strong> · Belum Ada Bukti:{' '}
                <strong>{dklDoc.totalTanpaBukti} trx</strong>
              </span>
              {dklDoc.bmPdriReferensi && (
                <span>
                  Ref BM/PDRI PIB: <strong>{dklDoc.bmPdriReferensi}</strong>
                </span>
              )}
            </div>

            {/* 5. Footer & Tanda Tangan */}
            <div className="mt-4 pt-2 grid grid-cols-3 gap-4 px-2 text-[10px] text-slate-900">
              <div>
                <div className="font-bold">DISERAHKAN OLEH (KEUANGAN/ADMIN)</div>
                <div className="mt-9 font-semibold">( {dklDoc.diserahkanOleh || '-'} )</div>
              </div>
              <div>
                <div className="font-bold">DITERIMA / PELAKSANA LAPANGAN</div>
                <div className="mt-9 font-semibold">( {dklDoc.koordinatorLapangan || '-'} )</div>
              </div>
              <div className="text-right">
                <div className="font-bold">TANGGAL : {dklDoc.tanggalCetak}</div>
                <div className="mt-9 font-semibold">MENGETAHUI / MANAJER</div>
              </div>
            </div>

            <div className="mt-3 pt-1.5 border-t border-slate-200 text-[9px] text-slate-500 flex items-center justify-between">
              <span>
                {dklDoc.identity.companyName} · {dklDoc.identity.footerNote}
              </span>
              <span className="font-mono-code">{dklDoc.kodeOs}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
