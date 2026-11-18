import * as XLSX from 'xlsx';
import type {
  Customer,
  Importir,
  JalurType,
  KontainerItem,
  Shipment,
  StatusDokumenType,
} from '../types/ppjk';
import {
  calculateCountdownEta,
  createEmptyChecklist,
  DEFAULT_CHECKLIST_ITEMS,
  formatContainerSummary,
  normalizeStatusDokumen,
  validateShipmentInput,
} from './ppjkLogic';

export interface ParsedExcelShipmentRow {
  rowNumber: number;
  raw: Record<string, string>;
  shipment: Shipment;
  containers: KontainerItem[];
  matchedExistingKodeOs?: string;
  duplicateReason?: string;
  errors: string[];
  status: 'valid' | 'duplicate' | 'error';
}

export interface ParsedExcelWorkbookResult {
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rows: ParsedExcelShipmentRow[];
  validCount: number;
  duplicateCount: number;
  errorCount: number;
}

export interface ParseExcelContext {
  existingShipments: Shipment[];
  customers?: Customer[];
  importirs?: Importir[];
  checklistItems?: string[];
  statusList?: string[];
  defaultChecker?: string;
  sheetName?: string;
}

const VALID_JALUR: JalurType[] = ['Hijau', 'Kuning', 'Merah', 'MITA'];

function normalizeHeaderKey(header: string): string {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const HEADER_ALIAS_MAP: Record<string, keyof Shipment | 'statusDokumenStr'> = {
  'kode os': 'kodeOs',
  'no os': 'kodeOs',
  'dok os': 'kodeManualDokOs',
  'dok os manual': 'kodeManualDokOs',
  'kode manual dok os': 'kodeManualDokOs',
  'kode dok pemilik': 'kodeManualDokOs',
  'ship': 'ship',
  'ship vessel': 'ship',
  'vessel': 'ship',
  'kapal': 'ship',
  'pelayaran': 'ship',
  'kode customer': 'kodeCustomer',
  'kode cust': 'kodeCustomer',
  'nama customer': 'namaCustomer',
  'customer': 'namaCustomer',
  'consignee': 'namaCustomer',
  'tgl terima dok': 'tglTerimaDok',
  'tanggal terima dok': 'tglTerimaDok',
  'tgl terima': 'tglTerimaDok',
  'no packinglist': 'noPackinglist',
  'no packing list': 'noPackinglist',
  'packinglist': 'noPackinglist',
  'packing list': 'noPackinglist',
  'no bl': 'noBl',
  'no b l': 'noBl',
  'bl': 'noBl',
  'bill of lading': 'noBl',
  'status dokumen checker': 'statusDokumenStr',
  'status dokumen': 'statusDokumenStr',
  'status dok': 'statusDokumenStr',
  'etd': 'etd',
  'eta': 'eta',
  'no cont': 'noCont',
  'no kontainer': 'noCont',
  'kontainer': 'noCont',
  'container': 'noCont',
  'no container': 'noCont',
  'no bc 1 1': 'noBc11',
  'no bc11': 'noBc11',
  'bc 1 1': 'noBc11',
  'tgl bc 1 1': 'tglBc11',
  'tgl bc11': 'tglBc11',
  'no aju': 'noAju',
  'aju': 'noAju',
  'tgl aju': 'tglAju',
  'tanggal aju': 'tglAju',
  'status': 'status',
  'status shipment': 'status',
  'status pib': 'status',
  'nopen': 'nopen',
  'no nopen': 'nopen',
  'tgl nopen': 'tglNopen',
  'tanggal nopen': 'tglNopen',
  'jalur': 'jalur',
  'kode importir': 'kodeImportir',
  'kode imp': 'kodeImportir',
  'importir': 'kodeImportir',
  'shipper': 'shipper',
  'description': 'description',
  'deskripsi barang': 'description',
  'uraian barang': 'description',
  'commodity': 'description',
  'negara asal': 'negaraAsal',
  'origin': 'negaraAsal',
  'negara': 'negaraAsal',
  'currency': 'currency',
  'curr': 'currency',
  'kurs': 'kurs',
  'invoice': 'invoice',
  'nilai invoice': 'invoice',
  'bm pdri': 'bmPdri',
  'bm/pdri': 'bmPdri',
  'sptnp': 'sptnp',
  'no sppb': 'noSppb',
  'sppb': 'noSppb',
  'tgl sppb': 'tglSppb',
  'tanggal sppb': 'tglSppb',
  'dokumen checker': 'dokumenChecker',
  'checker': 'dokumenChecker',
  'no sptnp': 'noSptnp',
  'tgl sptnp': 'tglSptnp',
  'pfpb': 'pfpb',
  'tgl pfpb': 'tglPfpb',
  'pfpd': 'pfpd',
  'tgl pfpd': 'tglPfpd',
  'eslah': 'eslah',
  'tgl eslah': 'tglEslah',
};

export function excelSerialToIsoDate(serial: number): string {
  if (!Number.isFinite(serial) || serial <= 0) return '';
  // Excel epoch is 1899-12-30 (accounting for Excel's 1900 leap-year bug)
  const wholeDays = Math.floor(serial);
  const utcMs = Date.UTC(1899, 11, 30) + wholeDays * 86400000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeImportedDate(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialToIsoDate(value);
  }
  const str = String(value).trim();
  if (!str || str === '-') return '';

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Numeric string Excel serial
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    return excelSerialToIsoDate(Number(str));
  }

  return str;
}

export function parseImportedNumber(value: unknown): number | '' {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : '';
  }
  const raw = String(value).trim();
  if (!raw || raw === '-') return '';
  // Strip currency labels & whitespace
  let cleaned = raw.replace(/[^0-9,.-]/g, '');
  if (!cleaned) return '';

  // Handle Indonesian/European vs US thousand/decimal separators
  const commaCount = (cleaned.match(/,/g) || []).length;
  const dotCount = (cleaned.match(/\./g) || []).length;
  if (commaCount > 0 && dotCount > 0) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (commaCount === 1 && dotCount === 0) {
    const parts = cleaned.split(',');
    if (parts[1].length === 3 && parts[0].length >= 1) {
      cleaned = cleaned.replace(',', '');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
  } else if (dotCount > 1) {
    cleaned = cleaned.replace(/\./g, '');
  } else if (dotCount === 1) {
    const parts = cleaned.split('.');
    if (parts[1].length === 3 && parts[0].length >= 1 && Number(parts[0]) >= 1) {
      // Ambiguous 15.850 -> check common IDR kurs >= 1000
      if (Number(parts[0]) >= 10 && parts[0].length <= 3) {
        cleaned = cleaned.replace('.', '');
      }
    }
  }

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : '';
}

export function parseContainerSummaryToItems(
  rawText: string,
  kodeOs = ''
): KontainerItem[] {
  const cleaned = String(rawText || '').trim();
  if (!cleaned || cleaned === '-') return [];
  const tokens = cleaned
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  return tokens.map((token, idx) => {
    const parenMatch = token.match(/^([A-Za-z0-9-]+)\s*\(([^)]+)\)$/);
    if (parenMatch) {
      return {
        id: `imp_c_${idx}`,
        kodeOs,
        noCont: parenMatch[1].trim().toUpperCase(),
        ukuranTipe: parenMatch[2].trim().toUpperCase(),
      };
    }
    const slashMatch = token.match(/^([A-Za-z0-9-]+)\s*[-/]\s*(20FT|40FT|40GP|40HC|45HC|LCL)$/i);
    if (slashMatch) {
      return {
        id: `imp_c_${idx}`,
        kodeOs,
        noCont: slashMatch[1].trim().toUpperCase(),
        ukuranTipe: slashMatch[2].trim().toUpperCase(),
      };
    }
    return {
      id: `imp_c_${idx}`,
      kodeOs,
      noCont: token.toUpperCase(),
      ukuranTipe: '40HC',
    };
  });
}

function normalizeImportedJalur(val: string): JalurType {
  const cleaned = val.trim().toLowerCase();
  if (!cleaned || cleaned === '-' || cleaned === 'belum ada') return '';
  const match = VALID_JALUR.find((j) => j.toLowerCase() === cleaned);
  return match || '';
}

function normalizeImportedStatus(val: string, statusList?: string[]): string {
  const cleaned = val.trim();
  if (!cleaned) return 'Dokumen Diterima';
  if (statusList && statusList.length > 0) {
    const match = statusList.find((st) => st.toLowerCase() === cleaned.toLowerCase());
    if (match) return match;
  }
  return cleaned;
}

function decodeCsvBytesToText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  return utf8.replace(/^\uFEFF/, '');
}

function detectCsvDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine =
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) || '';
  let comma = 0;
  let semi = 0;
  let tab = 0;
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === ',') comma++;
      else if (ch === ';') semi++;
      else if (ch === '\t') tab++;
    }
  }
  if (tab > comma && tab > semi) return '\t';
  if (semi > comma) return ';';
  return ',';
}

function parseCsvTextToMatrix(text: string): unknown[][] {
  const delimiter = detectCsvDelimiter(text);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentCell += '"';
          i++;
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
      if (text[i + 1] === '\n') i++;
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
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export function parseShipmentImportBuffer(
  buffer: ArrayBuffer | Uint8Array,
  context: ParseExcelContext,
  fileName = ''
): ParsedExcelWorkbookResult {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const isCsv = /\.csv$/i.test(fileName.trim());
  let sheetNames: string[] = [];
  let activeSheet = '';
  let matrix: unknown[][] = [];

  if (isCsv) {
    const csvText = decodeCsvBytesToText(bytes);
    sheetNames = ['CSV'];
    activeSheet = 'CSV';
    matrix = parseCsvTextToMatrix(csvText);
  } else {
    const wb = XLSX.read(bytes, { type: 'array', cellDates: false });
    sheetNames = wb.SheetNames || [];
    if (sheetNames.length === 0) {
      throw new Error('File Excel/CSV tidak memiliki sheet atau tabel data.');
    }
    activeSheet =
      context.sheetName && sheetNames.includes(context.sheetName)
        ? context.sheetName
        : sheetNames[0];
    const ws = wb.Sheets[activeSheet];
    matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
      blankrows: false,
    });
  }

  if (matrix.length === 0) {
    throw new Error(`Sheet "${activeSheet}" kosong.`);
  }

  // Locate header row (first non-empty row with >= 2 cells)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const nonEmpty = (matrix[i] || []).filter((v) => String(v ?? '').trim() !== '').length;
    if (nonEmpty >= 2) {
      headerRowIdx = i;
      break;
    }
  }

  const rawHeaders = (matrix[headerRowIdx] || []).map((h) => String(h ?? '').trim());
  const headers = rawHeaders.filter(Boolean);
  const colToField = rawHeaders.map((h) => HEADER_ALIAS_MAP[normalizeHeaderKey(h)] || null);

  const customerByCode = new Map<string, Customer>();
  const customerByName = new Map<string, Customer>();
  for (const c of context.customers || []) {
    if (c.kodeCustomer) customerByCode.set(c.kodeCustomer.trim().toUpperCase(), c);
    if (c.namaCustomer) customerByName.set(c.namaCustomer.trim().toLowerCase(), c);
  }

  const existingByKodeOs = new Map<string, Shipment>();
  const existingByBl = new Map<string, Shipment>();
  for (const s of context.existingShipments || []) {
    if (s.kodeOs) existingByKodeOs.set(s.kodeOs.trim().toUpperCase(), s);
    if (s.noBl) existingByBl.set(s.noBl.trim().toUpperCase(), s);
  }

  const checklistItems =
    context.checklistItems && context.checklistItems.length > 0
      ? context.checklistItems
      : DEFAULT_CHECKLIST_ITEMS;

  const seenBlInFile = new Set<string>();
  const rows: ParsedExcelShipmentRow[] = [];

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const cells = matrix[r] || [];
    const hasAnyValue = cells.some((v) => String(v ?? '').trim() !== '');
    if (!hasAnyValue) continue;

    const rawRecord: Record<string, string> = {};
    const mappedValues: Partial<Record<keyof Shipment | 'statusDokumenStr', unknown>> = {};

    for (let c = 0; c < rawHeaders.length; c++) {
      const headerLabel = rawHeaders[c];
      if (!headerLabel) continue;
      const cellVal = cells[c];
      rawRecord[headerLabel] = cellVal === undefined || cellVal === null ? '' : String(cellVal).trim();
      const field = colToField[c];
      if (field) {
        mappedValues[field] = cellVal;
      }
    }

    const strVal = (field: keyof Shipment | 'statusDokumenStr'): string => {
      const v = mappedValues[field];
      return v === undefined || v === null ? '' : String(v).trim();
    };

    let kodeCustomer = strVal('kodeCustomer');
    let namaCustomer = strVal('namaCustomer');

    if (kodeCustomer && !namaCustomer) {
      const matchedCust = customerByCode.get(kodeCustomer.toUpperCase());
      if (matchedCust) namaCustomer = matchedCust.namaCustomer;
    } else if (namaCustomer && !kodeCustomer) {
      const matchedCust = customerByName.get(namaCustomer.toLowerCase());
      if (matchedCust) {
        kodeCustomer = matchedCust.kodeCustomer;
      } else {
        // Generate deterministic short customer code fallback if user only filled Nama Customer
        const cleanPrefix = namaCustomer
          .replace(/[^A-Za-z0-9]/g, '')
          .toUpperCase()
          .slice(0, 6);
        kodeCustomer = `CUST-${cleanPrefix || String(r).padStart(3, '0')}`;
      }
    }

    const kodeOs = strVal('kodeOs');
    const noBl = strVal('noBl');
    const etd = normalizeImportedDate(mappedValues.etd);
    const eta = normalizeImportedDate(mappedValues.eta);
    const tglTerimaDok =
      normalizeImportedDate(mappedValues.tglTerimaDok) || new Date().toISOString().slice(0, 10);
    const tglBc11 = normalizeImportedDate(mappedValues.tglBc11);
    const tglAju = normalizeImportedDate(mappedValues.tglAju);
    const tglNopen = normalizeImportedDate(mappedValues.tglNopen);
    const tglSppb = normalizeImportedDate(mappedValues.tglSppb);
    const tglSptnp = normalizeImportedDate(mappedValues.tglSptnp);
    const tglPfpb = normalizeImportedDate(mappedValues.tglPfpb);
    const tglPfpd = normalizeImportedDate(mappedValues.tglPfpd);
    const tglEslah = normalizeImportedDate(mappedValues.tglEslah);

    const rawCont = strVal('noCont');
    const containers = parseContainerSummaryToItems(rawCont, kodeOs);
    const containerSummary = containers.length > 0 ? formatContainerSummary(containers) : rawCont || '-';

    const statusDokumen: StatusDokumenType = normalizeStatusDokumen(strVal('statusDokumenStr'));
    const noBc11 = strVal('noBc11');

    const shipment: Shipment = {
      kodeOs,
      kodeManualDokOs: strVal('kodeManualDokOs'),
      ship: strVal('ship'),
      kodeCustomer,
      namaCustomer: namaCustomer || kodeCustomer,
      tglTerimaDok,
      terimaDok: createEmptyChecklist(checklistItems),
      noPackinglist: strVal('noPackinglist'),
      noBl,
      statusDokumen,
      etd,
      eta,
      countDownEta: calculateCountdownEta(eta),
      noCont: containerSummary,
      bc11Terbit: Boolean(noBc11 || tglBc11),
      noBc11,
      tglBc11,
      noAju: strVal('noAju'),
      tglAju,
      status: normalizeImportedStatus(strVal('status'), context.statusList),
      nopen: strVal('nopen'),
      tglNopen,
      jalur: normalizeImportedJalur(strVal('jalur')),
      kodeImportir: strVal('kodeImportir').toUpperCase(),
      shipper: strVal('shipper'),
      description: strVal('description'),
      negaraAsal: strVal('negaraAsal'),
      currency: strVal('currency').toUpperCase() || 'USD',
      kurs: parseImportedNumber(mappedValues.kurs),
      invoice: parseImportedNumber(mappedValues.invoice),
      bmPdri: strVal('bmPdri'),
      sptnp: strVal('sptnp') || 'Tidak',
      noSppb: strVal('noSppb'),
      tglSppb,
      dokumenChecker: strVal('dokumenChecker') || context.defaultChecker || '',
      noSptnp: strVal('noSptnp'),
      tglSptnp,
      pfpb: strVal('pfpb'),
      tglPfpb,
      pfpd: strVal('pfpd'),
      tglPfpd,
      eslah: strVal('eslah'),
      tglEslah,
      dokumenOs: createEmptyChecklist(checklistItems),
      createdAt: '',
      createdBy: '',
      updatedAt: '',
      updatedBy: '',
    };

    const validation = validateShipmentInput(shipment);
    const errors = Object.values(validation.errors);

    // Check duplicates in file or existing DB
    let matchedExistingKodeOs: string | undefined;
    let duplicateReason: string | undefined;

    if (kodeOs && existingByKodeOs.has(kodeOs.toUpperCase())) {
      const existing = existingByKodeOs.get(kodeOs.toUpperCase())!;
      matchedExistingKodeOs = existing.kodeOs;
      duplicateReason = `Kode OS ${existing.kodeOs} sudah ada`;
    } else if (noBl && existingByBl.has(noBl.toUpperCase())) {
      const existing = existingByBl.get(noBl.toUpperCase())!;
      matchedExistingKodeOs = existing.kodeOs;
      duplicateReason = `No. BL ${noBl} sudah ada (${existing.kodeOs})`;
    } else if (noBl && seenBlInFile.has(noBl.toUpperCase())) {
      errors.push(`No. BL ${noBl} duplikat di dalam file.`);
    }

    if (noBl) seenBlInFile.add(noBl.toUpperCase());

    const rowStatus: ParsedExcelShipmentRow['status'] =
      errors.length > 0 ? 'error' : duplicateReason ? 'duplicate' : 'valid';

    rows.push({
      rowNumber: r + 1,
      raw: rawRecord,
      shipment,
      containers,
      matchedExistingKodeOs,
      duplicateReason,
      errors,
      status: rowStatus,
    });
  }

  return {
    sheetNames,
    activeSheet,
    headers,
    rows,
    validCount: rows.filter((r) => r.status === 'valid').length,
    duplicateCount: rows.filter((r) => r.status === 'duplicate').length,
    errorCount: rows.filter((r) => r.status === 'error').length,
  };
}

export const SHIPMENT_IMPORT_TEMPLATE_HEADERS = [
  'Dok. OS (Manual)',
  'Kode Customer',
  'Nama Customer',
  'Kode Importir',
  'Ship',
  'Shipper',
  'Negara Asal',
  'Description',
  'No. Packinglist',
  'No. BL',
  'Tgl. Terima Dok',
  'ETD',
  'ETA',
  'No. Cont',
  'Status Dokumen Checker',
  'Status',
  'Jalur',
  'No. AJU',
  'Tgl. AJU',
  'NOPEN',
  'Tgl. NOPEN',
  'Currency',
  'Kurs',
  'Invoice',
  'BM/PDRI',
  'No. SPPB',
  'Tgl SPPB',
  'Dokumen Checker',
];

export function buildShipmentImportSampleRow(referenceDate = new Date()): Record<string, string | number> {
  const fmt = (offsetDays: number) => {
    const d = new Date(referenceDate.getTime() + offsetDays * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return {
    'Dok. OS (Manual)': 'TN-210',
    'Kode Customer': 'CUST-001',
    'Nama Customer': 'PT Nusantara Baja Mandiri',
    'Kode Importir': 'IMP-001',
    'Ship': 'MV EVER FORTUNE V.055',
    'Shipper': 'Baosteel International Co., Ltd',
    'Negara Asal': 'China',
    'Description': 'Cold Rolled Steel Coils',
    'No. Packinglist': 'PL-NBM-2611-99',
    'No. BL': 'EGLV142600999888',
    'Tgl. Terima Dok': fmt(0),
    'ETD': fmt(-5),
    'ETA': fmt(4),
    'No. Cont': 'EGHU9099881 (40HC), EGHU9099882 (40HC)',
    'Status Dokumen Checker': 'Draft',
    'Status': 'Dokumen Diterima',
    'Jalur': '',
    'No. AJU': '',
    'Tgl. AJU': '',
    'NOPEN': '',
    'Tgl. NOPEN': '',
    'Currency': 'USD',
    'Kurs': 15850,
    'Invoice': 45000,
    'BM/PDRI': 'Rp 95.000.000',
    'No. SPPB': '',
    'Tgl SPPB': '',
    'Dokumen Checker': 'Rina Kusuma',
  };
}
