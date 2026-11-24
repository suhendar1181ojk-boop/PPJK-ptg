import {
  cleanNumber,
  cleanText,
  normalizeD1ShipmentRecord,
  normalizeUrgentFlag,
  type D1ShipmentRecord,
} from './d1Contract';

export interface CsvImportSkippedRow {
  rowNumber: number;
  osCode: string;
  reason: string;
}

export interface CsvImportParseResult {
  detectedDelimiter: ';' | ',';
  totalDataRows: number;
  validRows: D1ShipmentRecord[];
  skippedRows: CsvImportSkippedRow[];
  errors: string[];
}

const HEADER_ALIAS_MAP: Record<string, keyof D1ShipmentRecord> = {
  id: 'id',
  os_code: 'os_code',
  kode_os: 'os_code',
  kodeos: 'os_code',
  doc_os: 'doc_os',
  kode_manual_dok_os: 'doc_os',
  importer_code: 'importer_code',
  kode_importir: 'importer_code',
  kodeimportir: 'importer_code',
  importer_name: 'importer_name',
  nama_importir: 'importer_name',
  namaimportir: 'importer_name',
  customer_code: 'customer_code',
  kode_customer: 'customer_code',
  customer_name: 'customer_name',
  nama_customer: 'customer_name',
  bl_number: 'bl_number',
  no_bl: 'bl_number',
  packing_list: 'packing_list',
  no_packing_list: 'packing_list',
  no_packinglist: 'packing_list',
  aju_number: 'aju_number',
  no_aju: 'aju_number',
  nopen: 'nopen',
  no_nopen: 'nopen',
  container_number: 'container_number',
  no_kontainer: 'container_number',
  no_cont: 'container_number',
  status: 'status',
  doc_status: 'doc_status',
  status_dokumen: 'doc_status',
  jalur: 'jalur',
  checker_name: 'checker_name',
  checker: 'checker_name',
  dokumen_checker: 'checker_name',
  eta_date: 'eta_date',
  eta: 'eta_date',
  etd_date: 'etd_date',
  etd: 'etd_date',
  received_date: 'received_date',
  tgl_terima_dok: 'received_date',
  sppb_date: 'sppb_date',
  tgl_sppb: 'sppb_date',
  gate_out_date: 'gate_out_date',
  tgl_gate_out: 'gate_out_date',
  bm_pdri_amount: 'bm_pdri_amount',
  bm_pdri: 'bm_pdri_amount',
  bm_pdri_rp: 'bm_pdri_amount',
  is_urgent: 'is_urgent',
  urgent: 'is_urgent',
  notes: 'notes',
  catatan: 'notes',
};

function normalizeHeaderKey(rawHeader: string): string {
  return rawHeader
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\(rp\)/g, 'rp')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function countDelimiterOutsideQuotes(line: string, delimiter: ';' | ','): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && ch === delimiter) {
      count += 1;
    }
  }
  return count;
}

export function detectCsvDelimiter(csvText: string): ';' | ',' {
  const clean = csvText.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/).find((line) => line.trim().length > 0) || '';
  const semiCount = countDelimiterOutsideQuotes(firstLine, ';');
  const commaCount = countDelimiterOutsideQuotes(firstLine, ',');
  return semiCount >= commaCount ? ';' : ',';
}

export function parseCsvMatrix(csvText: string, delimiter: ';' | ','): string[][] {
  const clean = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          currentCell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (ch === '\r') {
      if (clean[i + 1] === '\n') i += 1;
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else if (ch === '\n') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}

/**
 * Strips protective leading apostrophe added during formula-safe CSV export.
 */
function stripExportFormulaQuote(val: string): string {
  const trimmed = val.trim();
  if (/^'[=+\-@]/.test(trimmed)) {
    return trimmed.slice(1);
  }
  return trimmed;
}

export function parseShipmentsCsvText(
  csvText: string,
  nowIso: string = new Date().toISOString()
): CsvImportParseResult {
  const detectedDelimiter = detectCsvDelimiter(csvText);
  const matrix = parseCsvMatrix(csvText, detectedDelimiter);

  if (matrix.length < 2) {
    return {
      detectedDelimiter,
      totalDataRows: 0,
      validRows: [],
      skippedRows: [],
      errors: [
        matrix.length === 0
          ? 'File CSV kosong atau tidak memiliki header.'
          : 'File CSV hanya berisi header tanpa baris data shipment.',
      ],
    };
  }

  const rawHeaders = matrix[0];
  const mappedFields: Array<keyof D1ShipmentRecord | null> = rawHeaders.map((header) => {
    const normalizedKey = normalizeHeaderKey(header);
    return HEADER_ALIAS_MAP[normalizedKey] || null;
  });

  const hasOsCodeCol = mappedFields.includes('os_code');
  const hasImpCodeCol = mappedFields.includes('importer_code');
  const hasImpNameCol = mappedFields.includes('importer_name');

  const headerErrors: string[] = [];
  if (!hasOsCodeCol) headerErrors.push('Kolom wajib "os_code" / "Kode OS" tidak ditemukan.');
  if (!hasImpCodeCol) {
    headerErrors.push('Kolom wajib "importer_code" / "Kode Importir" tidak ditemukan.');
  }
  if (!hasImpNameCol) {
    headerErrors.push('Kolom wajib "importer_name" / "Nama Importir" tidak ditemukan.');
  }

  if (headerErrors.length > 0) {
    return {
      detectedDelimiter,
      totalDataRows: matrix.length - 1,
      validRows: [],
      skippedRows: [],
      errors: headerErrors,
    };
  }

  const validRows: D1ShipmentRecord[] = [];
  const skippedRows: CsvImportSkippedRow[] = [];
  const seenOsCodes = new Set<string>();

  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    const rowNumber = i + 1;
    const draft: Record<string, unknown> = {};

    for (let colIdx = 0; colIdx < mappedFields.length; colIdx += 1) {
      const targetKey = mappedFields[colIdx];
      if (!targetKey) continue;
      const cellVal = stripExportFormulaQuote(row[colIdx] ?? '');
      if (targetKey === 'bm_pdri_amount') {
        draft[targetKey] = cleanNumber(cellVal, 0);
      } else if (targetKey === 'is_urgent') {
        draft[targetKey] = normalizeUrgentFlag(cellVal);
      } else {
        draft[targetKey] = cellVal;
      }
    }

    const osCode = cleanText(draft.os_code).toUpperCase();
    const importerCode = cleanText(draft.importer_code);
    const importerName = cleanText(draft.importer_name);

    const missingFields: string[] = [];
    if (!osCode) missingFields.push('os_code');
    if (!importerCode) missingFields.push('importer_code');
    if (!importerName) missingFields.push('importer_name');

    if (missingFields.length > 0) {
      skippedRows.push({
        rowNumber,
        osCode: osCode || '-',
        reason: `Kolom wajib kosong: ${missingFields.join(', ')}`,
      });
      continue;
    }

    if (seenOsCodes.has(osCode)) {
      skippedRows.push({
        rowNumber,
        osCode,
        reason: `Duplikat os_code "${osCode}" dalam file CSV yang sama.`,
      });
      continue;
    }

    seenOsCodes.add(osCode);

    try {
      const normalized = normalizeD1ShipmentRecord(
        {
          ...(draft as Partial<D1ShipmentRecord>),
          os_code: osCode,
          importer_code: importerCode,
          importer_name: importerName,
          updated_at: nowIso,
          deleted_at: null,
        },
        nowIso
      );
      validRows.push(normalized);
    } catch (err) {
      skippedRows.push({
        rowNumber,
        osCode,
        reason: err instanceof Error ? err.message : 'Format baris tidak valid.',
      });
    }
  }

  return {
    detectedDelimiter,
    totalDataRows: matrix.length - 1,
    validRows,
    skippedRows,
    errors: [],
  };
}

export function buildD1ImportTemplateCsv(): string {
  const headers = [
    'os_code',
    'doc_os',
    'importer_code',
    'importer_name',
    'customer_code',
    'customer_name',
    'bl_number',
    'packing_list',
    'aju_number',
    'nopen',
    'container_number',
    'status',
    'doc_status',
    'jalur',
    'checker_name',
    'eta_date',
    'etd_date',
    'received_date',
    'sppb_date',
    'gate_out_date',
    'bm_pdri_amount',
    'is_urgent',
    'notes',
  ];
  const sampleRow = [
    'OS-2611-0101',
    'TN-210',
    'IMP-001',
    'PT Nusantara Elektrindo',
    'CUST-001',
    'PT Maju Jaya Elektronik',
    'EGLV1429809999',
    'PL-2611-101',
    '000010-261199',
    '448999',
    'EGHU9988776 (40HC)',
    'Proses PIB/AJU',
    'Ready',
    'Hijau',
    'Budi Santoso',
    '2026-11-25',
    '2026-11-15',
    '2026-11-18',
    '',
    '',
    '75000000',
    '1',
    'Contoh baris impor CSV PTG PPJK',
  ];
  return `\uFEFF${headers.join(';')}\r\n${sampleRow.join(';')}`;
}
