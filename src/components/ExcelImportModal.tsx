import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import type { Customer, Importir, Shipment } from '../types/ppjk';
import type { BatchExcelImportItem } from '../services/gasSimulator';
import {
  parseShipmentImportBuffer,
  type ParsedExcelWorkbookResult,
} from '../utils/excelImportLogic';
import {
  downloadShipmentCsvTemplate,
  downloadShipmentExcelTemplate,
} from '../utils/exportUtils';

interface ExcelImportModalProps {
  isOpen: boolean;
  existingShipments: Shipment[];
  customers?: Customer[];
  importirs?: Importir[];
  checklistItems: string[];
  statusList: string[];
  defaultChecker?: string;
  onClose: () => void;
  onConfirmImport: (
    items: BatchExcelImportItem[],
    options: { updateExisting: boolean; sourceFileName: string }
  ) => Promise<void>;
}

export function ExcelImportModal({
  isOpen,
  existingShipments,
  customers = [],
  importirs = [],
  checklistItems,
  statusList,
  defaultChecker = '',
  onClose,
  onConfirmImport,
}: ExcelImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [parseError, setParseError] = useState('');
  const [parsed, setParsed] = useState<ParsedExcelWorkbookResult | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !importing) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, importing, onClose]);

  const resetState = () => {
    setFileName('');
    setFileBuffer(null);
    setSelectedSheet('');
    setParseError('');
    setParsed(null);
    setUpdateExisting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (importing) return;
    resetState();
    onClose();
  };

  const runParse = (buf: ArrayBuffer, name: string, sheetName?: string) => {
    try {
      setParseError('');
      const result = parseShipmentImportBuffer(
        buf,
        {
          existingShipments,
          customers,
          importirs,
          checklistItems,
          statusList,
          defaultChecker,
          sheetName,
        },
        name
      );
      setParsed(result);
      setSelectedSheet(result.activeSheet);
    } catch (err) {
      setParsed(null);
      setParseError(
        err instanceof Error
          ? err.message
          : 'Gagal membaca file. Pastikan format .xlsx, .xls, atau .csv valid.'
      );
    }
  };

  const handleFileSelected = async (file: File | null | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls') && !lower.endsWith('.csv')) {
      setParseError('Format file tidak didukung. Gunakan file Excel (.xlsx, .xls) atau CSV (.csv).');
      return;
    }
    const buf = await file.arrayBuffer();
    setFileName(file.name);
    setFileBuffer(buf);
    runParse(buf, file.name);
  };

  const importableItems = useMemo<BatchExcelImportItem[]>(() => {
    if (!parsed) return [];
    return parsed.rows
      .filter((row) => row.status === 'valid' || (updateExisting && row.status === 'duplicate'))
      .map((row) => ({
        shipment: row.shipment,
        containers: row.containers,
        matchedExistingKodeOs: row.matchedExistingKodeOs,
      }));
  }, [parsed, updateExisting]);

  const handleConfirm = async () => {
    if (importableItems.length === 0 || importing) return;
    setImporting(true);
    try {
      await onConfirmImport(importableItems, {
        updateExisting,
        sourceFileName: fileName || 'Upload Excel/CSV',
      });
      resetState();
      onClose();
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan data import.'
      );
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="excel-import-modal-title"
      data-testid="excel-import-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-3 sm:p-5"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-5xl max-h-[88vh] flex flex-col bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-[#182032]/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Upload className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2
                id="excel-import-modal-title"
                className="text-sm sm:text-base font-bold text-[#0B2545] dark:text-white truncate"
              >
                Upload Data Shipment (Excel / CSV)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                Impor banyak shipment sekaligus dari file .xlsx, .xls, atau .csv ke modul Semua Shipment.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={importing}
            aria-label="Tutup modal upload Excel atau CSV"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Template Downloads & Sheet Picker */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Kolom wajib minimal: <span className="font-semibold text-slate-900 dark:text-white">Kode Customer / Nama Customer</span>,{' '}
              <span className="font-semibold text-slate-900 dark:text-white">No. BL</span>, dan{' '}
              <span className="font-semibold text-slate-900 dark:text-white">ETA</span> (YYYY-MM-DD atau DD/MM/YYYY).
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="download-excel-template-btn"
                onClick={() => downloadShipmentExcelTemplate()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-xs font-semibold text-emerald-800 dark:text-emerald-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Template Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                data-testid="download-csv-template-btn"
                onClick={() => downloadShipmentCsvTemplate()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-300 dark:border-sky-500/35 bg-sky-50 dark:bg-sky-500/15 hover:bg-sky-100 dark:hover:bg-sky-500/25 text-xs font-semibold text-sky-800 dark:text-sky-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Template CSV (.csv)</span>
              </button>
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const f = e.dataTransfer.files?.[0];
              void handleFileSelected(f);
            }}
            className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
              dragActive
                ? 'border-[#F28C28] dark:border-violet-400 bg-orange-50/70 dark:bg-violet-500/10'
                : 'border-slate-300 dark:border-white/15 bg-slate-50/70 dark:bg-[#182032]/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              data-testid="excel-csv-file-input"
              aria-label="Pilih file Excel atau CSV"
              onChange={(e) => void handleFileSelected(e.target.files?.[0])}
              className="sr-only"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/10 flex items-center justify-center text-[#0B2545] dark:text-violet-300">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {fileName ? `File dipilih: ${fileName}` : 'Seret & lepas file Excel atau CSV di sini'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Mendukung .xlsx, .xls, dan .csv (pemisah koma atau titik koma) — kompatibel dengan file hasil ekspor aplikasi.
              </div>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B2545] hover:bg-[#143764] dark:bg-violet-600 dark:hover:bg-violet-500 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{fileName ? 'Ganti File' : 'Pilih File Excel / CSV'}</span>
                </button>
                {fileName && (
                  <button
                    type="button"
                    onClick={resetState}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {parseError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/15 px-3.5 py-2.5 text-xs text-red-800 dark:text-red-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Parsed Summary & Controls */}
          {parsed && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Total Baris: </span>
                    <span className="font-bold text-slate-900 dark:text-white">{parsed.rows.length}</span>
                  </div>
                  <span className="text-slate-300 dark:text-white/15">·</span>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Siap Import: </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300" data-testid="import-valid-count">
                      {parsed.validCount}
                    </span>
                  </div>
                  <span className="text-slate-300 dark:text-white/15">·</span>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Duplikat BL/OS: </span>
                    <span className="font-bold text-amber-700 dark:text-amber-300" data-testid="import-duplicate-count">
                      {parsed.duplicateCount}
                    </span>
                  </div>
                  <span className="text-slate-300 dark:text-white/15">·</span>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Error Validasi: </span>
                    <span className="font-bold text-red-700 dark:text-red-300" data-testid="import-error-count">
                      {parsed.errorCount}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {parsed.sheetNames.length > 1 && fileBuffer && (
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
                      <span>Sheet:</span>
                      <select
                        value={selectedSheet}
                        onChange={(e) => runParse(fileBuffer, fileName, e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs font-medium text-slate-900 dark:text-white"
                      >
                        {parsed.sheetNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {parsed.duplicateCount > 0 && (
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateExisting}
                        onChange={(e) => setUpdateExisting(e.target.checked)}
                        className="rounded border-slate-300 text-[#F28C28] focus:ring-[#F28C28] dark:text-violet-500"
                      />
                      <span>Perbarui shipment yang cocok ({parsed.duplicateCount})</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="max-h-72 overflow-auto">
                  <table
                    data-testid="excel-import-preview-table"
                    className="w-full text-left border-collapse text-[11px]"
                  >
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#182032] border-b border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300">
                      <tr>
                        <th className="py-2 px-2 font-semibold whitespace-nowrap">Baris</th>
                        <th className="py-2 px-2 font-semibold whitespace-nowrap">Status</th>
                        <th className="py-2 px-2 font-semibold whitespace-nowrap">Dok. OS</th>
                        <th className="py-2 px-2 font-semibold whitespace-nowrap">Customer</th>
                        <th className="py-2 px-2 font-semibold whitespace-nowrap">Importir</th>
                        <th className="py-2 px-2 font-semibold whitespace-nowrap">No. BL</th>
                        <th className="py-2 px-2 font-semibold whitespace-nowrap">ETA</th>
                        <th className="py-2 px-2 font-semibold whitespace-nowrap">Kontainer</th>
                        <th className="py-2 px-2 font-semibold whitespace-nowrap">Jalur</th>
                        <th className="py-2 px-2 font-semibold whitespace-nowrap">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {parsed.rows.map((row) => {
                        const willUpdate = row.status === 'duplicate' && updateExisting;
                        const statusLabel =
                          row.status === 'valid'
                            ? 'Siap Import'
                            : willUpdate
                            ? `Update ${row.matchedExistingKodeOs}`
                            : row.status === 'duplicate'
                            ? 'Lewati Duplikat'
                            : 'Error';
                        const statusCls =
                          row.status === 'valid'
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : willUpdate
                            ? 'text-sky-700 dark:text-sky-300'
                            : row.status === 'duplicate'
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-red-700 dark:text-red-300';

                        return (
                          <tr
                            key={row.rowNumber}
                            className="hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                          >
                            <td className="py-2 px-2 font-mono-code tabular-nums text-slate-500 dark:text-slate-400">
                              #{row.rowNumber}
                            </td>
                            <td className={`py-2 px-2 font-semibold whitespace-nowrap ${statusCls}`}>
                              <span className="inline-flex items-center gap-1">
                                {row.status === 'valid' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                {row.status === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
                                <span>{statusLabel}</span>
                              </span>
                            </td>
                            <td className="py-2 px-2 font-mono-code text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {row.shipment.kodeManualDokOs || '-'}
                            </td>
                            <td className="py-2 px-2 text-slate-900 dark:text-white max-w-[140px] truncate" title={row.shipment.namaCustomer || row.shipment.kodeCustomer || '-'}>
                              {row.shipment.namaCustomer || row.shipment.kodeCustomer || '-'}
                            </td>
                            <td className="py-2 px-2 font-mono-code text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {row.shipment.kodeImportir || '-'}
                            </td>
                            <td className="py-2 px-2 font-mono-code text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {row.shipment.noBl || '-'}
                            </td>
                            <td className="py-2 px-2 tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {row.shipment.eta || '-'}
                            </td>
                            <td className="py-2 px-2 font-mono-code text-slate-600 dark:text-slate-300 max-w-[120px] truncate" title={row.shipment.noCont || '-'}>
                              {row.shipment.noCont || '-'}
                            </td>
                            <td className="py-2 px-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {row.shipment.jalur || '-'}
                            </td>
                            <td className="py-2 px-2 text-slate-600 dark:text-slate-300">
                              {row.errors.length > 0 ? (
                                <span className="text-red-700 dark:text-red-300 font-medium">
                                  {row.errors.join(' ')}
                                </span>
                              ) : row.duplicateReason ? (
                                <span className="text-amber-700 dark:text-amber-300">
                                  {willUpdate ? `Memperbarui ${row.matchedExistingKodeOs}` : row.duplicateReason}
                                </span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-300">Valid · Kode OS otomatis</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-[#182032]/70">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {parsed
              ? `${importableItems.length} baris siap diproses ke Semua Shipment.`
              : 'Pilih file .xlsx, .xls, atau .csv untuk melihat pratinjau data.'}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={importing}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-100 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              data-testid="confirm-excel-import-btn"
              disabled={importing || importableItems.length === 0}
              onClick={() => void handleConfirm()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                {importing
                  ? 'Mengimpor...'
                  : `Import ${importableItems.length} Shipment`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
