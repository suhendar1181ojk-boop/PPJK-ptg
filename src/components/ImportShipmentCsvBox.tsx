import { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import {
  buildD1ImportTemplateCsv,
  parseShipmentsCsvText,
  type CsvImportParseResult,
} from '../utils/importShipmentsFromCsv';
import type { BatchCsvImportResult } from '../services/syncClient';
import type { D1ShipmentRecord } from '../utils/d1Contract';

interface ImportShipmentCsvBoxProps {
  onImportBatch: (rows: D1ShipmentRecord[]) => Promise<BatchCsvImportResult>;
  onClose?: () => void;
}

export function ImportShipmentCsvBox({
  onImportBatch,
  onClose,
}: ImportShipmentCsvBoxProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<CsvImportParseResult | null>(null);
  const [importSummary, setImportSummary] = useState<BatchCsvImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const handleDownloadTemplate = () => {
    const csv = buildD1ImportTemplateCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-impor-shipment-d1.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setSelectedFileName(file.name);
    setImportSummary(null);
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseShipmentsCsvText(text);
      setParseResult(parsed);

      if (parsed.errors.length === 0 && parsed.validRows.length > 0) {
        const res = await onImportBatch(parsed.validRows);
        setImportSummary(res);
      }
    } catch (err) {
      setParseResult({
        detectedDelimiter: ';',
        totalDataRows: 0,
        validRows: [],
        skippedRows: [],
        errors: [err instanceof Error ? err.message : 'Gagal membaca file CSV.'],
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      data-testid="d1-import-csv-box"
      className="rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.08] shadow-sm p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-500/30 flex items-center justify-center text-sky-700 dark:text-sky-300 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Impor Batch Shipment dari CSV
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deteksi otomatis pemisah <code className="font-mono">;</code> atau{' '}
              <code className="font-mono">,</code> · Wajib kolom{' '}
              <span className="font-semibold">os_code</span>,{' '}
              <span className="font-semibold">importer_code</span>, dan{' '}
              <span className="font-semibold">importer_name</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh Template CSV</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup panel impor CSV"
              className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 dark:border-white/[0.1] text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          data-testid="d1-csv-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            void handleFileChange(f);
            e.target.value = '';
          }}
          className="block w-full sm:w-auto text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border file:border-slate-200 dark:file:border-white/10 file:text-xs file:font-semibold file:bg-[#0B2545] file:text-white dark:file:bg-violet-600 hover:file:brightness-110 file:cursor-pointer cursor-pointer"
        />

        {importing && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400">
            <Upload className="w-3.5 h-3.5 animate-bounce" />
            Memproses CSV & mengirim batch ke D1...
          </span>
        )}

        {selectedFileName && !importing && (
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            File: <strong className="text-slate-800 dark:text-slate-200">{selectedFileName}</strong>
          </span>
        )}
      </div>

      {parseResult && (
        <div
          data-testid="d1-csv-import-summary"
          className="rounded-xl bg-slate-50 dark:bg-[#0E1320] border border-slate-200 dark:border-white/[0.06] p-3 space-y-2.5"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-white/[0.08] text-slate-700 dark:text-slate-200 font-medium">
              Delimiter terdeteksi: <code className="font-bold">{parseResult.detectedDelimiter}</code>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-semibold tabular-nums">
              Valid: {parseResult.validRows.length} baris
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold tabular-nums">
              Terlewati: {parseResult.skippedRows.length} baris
            </span>
            <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 font-semibold tabular-nums">
              Error Header/File: {parseResult.errors.length}
            </span>
          </div>

          {importSummary && (
            <div className="flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{importSummary.message}</span>
            </div>
          )}

          {parseResult.errors.length > 0 && (
            <ul className="space-y-1 text-xs text-red-600 dark:text-red-400">
              {parseResult.errors.map((errMsg, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{errMsg}</span>
                </li>
              ))}
            </ul>
          )}

          {parseResult.skippedRows.length > 0 && (
            <div className="max-h-28 overflow-y-auto text-[11px] text-amber-800 dark:text-amber-300 space-y-1 border-t border-slate-200 dark:border-white/[0.06] pt-2">
              <div className="font-semibold">Rincian baris terlewati:</div>
              {parseResult.skippedRows.slice(0, 8).map((skip, idx) => (
                <div key={idx}>
                  Baris {skip.rowNumber} ({skip.osCode}): {skip.reason}
                </div>
              ))}
              {parseResult.skippedRows.length > 8 && (
                <div>...dan {parseResult.skippedRows.length - 8} baris terlewati lainnya.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
