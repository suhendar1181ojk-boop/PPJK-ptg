import {
  filterD1Shipments,
  generateD1QueryUrl,
  type D1ShipmentFilter,
  type D1ShipmentRecord,
} from './d1Contract';

export const D1_CSV_EXPORT_COLUMNS: Array<{
  key: keyof D1ShipmentRecord;
  header: string;
}> = [
  { key: 'id', header: 'ID' },
  { key: 'os_code', header: 'Kode OS' },
  { key: 'doc_os', header: 'Doc OS' },
  { key: 'importer_code', header: 'Kode Importir' },
  { key: 'importer_name', header: 'Nama Importir' },
  { key: 'customer_code', header: 'Kode Customer' },
  { key: 'customer_name', header: 'Nama Customer' },
  { key: 'bl_number', header: 'No. BL' },
  { key: 'packing_list', header: 'No. Packing List' },
  { key: 'aju_number', header: 'No. AJU' },
  { key: 'nopen', header: 'NOPEN' },
  { key: 'container_number', header: 'No. Kontainer' },
  { key: 'status', header: 'Status' },
  { key: 'doc_status', header: 'Status Dokumen' },
  { key: 'jalur', header: 'Jalur' },
  { key: 'checker_name', header: 'Checker' },
  { key: 'eta_date', header: 'ETA' },
  { key: 'etd_date', header: 'ETD' },
  { key: 'received_date', header: 'Tgl. Terima Dok' },
  { key: 'sppb_date', header: 'Tgl. SPPB' },
  { key: 'gate_out_date', header: 'Tgl. Gate-Out' },
  { key: 'bm_pdri_amount', header: 'BM/PDRI (Rp)' },
  { key: 'is_urgent', header: 'Urgent' },
  { key: 'notes', header: 'Catatan' },
  { key: 'updated_at', header: 'Updated At' },
  { key: 'version', header: 'Version' },
];

const FORMULA_INJECTION_PREFIX_RE = /^[\t\r\n ]*[=+\-@]/;

/**
 * Neutralizes spreadsheet formula injection (=, +, -, @) while quoting values safely
 * for semicolon-delimited Excel-compatible CSV exports.
 */
export function sanitizeCsvFormulaCell(rawValue: unknown): string {
  if (rawValue === null || rawValue === undefined) return '';
  let text = String(rawValue);
  if (FORMULA_INJECTION_PREFIX_RE.test(text)) {
    text = `'${text}`;
  }
  const escaped = text.replace(/"/g, '""');
  if (/[;"\r\n,]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
}

export function buildShipmentsCsvContent(
  records: D1ShipmentRecord[],
  filter?: D1ShipmentFilter
): { csvContent: string; rowCount: number } {
  const filtered = filter ? filterD1Shipments(records, filter) : records.filter((r) => !r.deleted_at);
  const headerLine = D1_CSV_EXPORT_COLUMNS.map((col) => sanitizeCsvFormulaCell(col.header)).join(';');

  const lines = filtered.map((record) =>
    D1_CSV_EXPORT_COLUMNS.map((col) => {
      if (col.key === 'is_urgent') {
        return sanitizeCsvFormulaCell(record.is_urgent ? 'Ya' : 'Tidak');
      }
      return sanitizeCsvFormulaCell(record[col.key] ?? '');
    }).join(';')
  );

  // UTF-8 BOM + semicolon delimiter for seamless Excel opening in Indonesian/European locales
  const csvContent = `\uFEFF${[headerLine, ...lines].join('\r\n')}`;
  return { csvContent, rowCount: filtered.length };
}

function triggerCsvDownload(csvContent: string, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatCsvFilename(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${prefix}-${stamp}.csv`;
}

export function exportLocalShipmentsToCsv(
  records: D1ShipmentRecord[],
  filter: D1ShipmentFilter = {}
): { rowCount: number; filename: string } {
  const { csvContent, rowCount } = buildShipmentsCsvContent(records, filter);
  const filename = formatCsvFilename('ptg-ppjk-shipments-lokal');
  triggerCsvDownload(csvContent, filename);
  return { rowCount, filename };
}

export async function exportShipmentsFromD1ToCsv(
  filter: D1ShipmentFilter = {}
): Promise<{ rowCount: number; filename: string }> {
  const endpoint = generateD1QueryUrl('/api/shipments', filter);
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(
      `Gagal mengambil data dari Cloudflare D1 (${response.status}): ${errText || response.statusText}`
    );
  }
  const payload = (await response.json()) as {
    ok?: boolean;
    shipments?: D1ShipmentRecord[];
    error?: string;
  };
  if (payload.ok === false) {
    throw new Error(payload.error || 'Gagal membaca data shipment dari Cloudflare D1.');
  }
  const remoteRows = Array.isArray(payload.shipments) ? payload.shipments : [];
  const { csvContent, rowCount } = buildShipmentsCsvContent(remoteRows, filter);
  const filename = formatCsvFilename('ptg-ppjk-shipments-cloudflare-d1');
  triggerCsvDownload(csvContent, filename);
  return { rowCount, filename };
}
