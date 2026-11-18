import type {
  ChecklistData,
  DatabaseState,
  JalurType,
  KontainerItem,
  Shipment,
} from '../types/ppjk';
import {
  calculateCountdownEta,
  createEmptyChecklist,
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_STATUS_LIST,
  generateNextKodeOS,
  normalizeGatePassJenis,
  normalizeStatusDokumen,
  normalizeStatusDoPelayaran,
  normalizeStatusGateOut,
  normalizeStatusGatePass,
  normalizeStatusPenagihan,
  normalizeStatusSuratJalan,
  normalizeStatusTrucking,
} from './ppjkLogic';

export const DEFAULT_GAS_WEBAPP_URL =
  'https://script.google.com/macros/s/AKfycbxS0527e6Urzg4Dyipl8oJpzSCxx7DU3qAntocgwg/dev';

export interface GasAddActionData {
  kodeOs: string;
  kodeManualDokOs: string;
  ship: string;
  kodeCustomer: string;
  namaCustomer: string;
  tglTerimaDok: string;
  noPackinglist: string;
  noBl: string;
  statusDokumen: string;
  etd: string;
  eta: string;
  countDownEta: number | null;
  noCont: string;
  kontainerList: Array<{ noCont: string; ukuranTipe: string }>;
  bc11Terbit: boolean;
  noBc11: string;
  tglBc11: string;
  doPelayaranStatus: string;
  doBerlakuSampai: string;
  doGatePassStatus: string;
  doGatePassJenis: string;
  doGatePassNomor: string;
  truckingStatus: string;
  truckingNamaSupir: string;
  truckingNoPlat: string;
  gateOutStatus: string;
  gateOutTanggal: string;
  suratJalanNomor: string;
  suratJalanStatus: string;
  noAju: string;
  tglAju: string;
  status: string;
  nopen: string;
  tglNopen: string;
  jalur: string;
  kodeImportir: string;
  shipper: string;
  description: string;
  negaraAsal: string;
  currency: string;
  kurs: number | '';
  invoice: number | '';
  bmPdri: string;
  sptnp: string;
  noSppb: string;
  tglSppb: string;
  dokumenChecker: string;
  noSptnp: string;
  tglSptnp: string;
  pfpb: string;
  tglPfpb: string;
  pfpd: string;
  tglPfpd: string;
  eslah: string;
  tglEslah: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface GasAddActionPayload {
  action: 'add';
  data: GasAddActionData;
}

export interface GasUrlValidationResult {
  valid: boolean;
  normalizedUrl: string;
  isDevEndpoint: boolean;
  error?: string;
}

export function validateGasWebAppUrl(rawUrl: string): GasUrlValidationResult {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: '',
      isDevEndpoint: false,
      error: 'URL Web App Google Apps Script tidak boleh kosong.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      normalizedUrl: trimmed,
      isDevEndpoint: false,
      error: 'Format URL tidak valid. Gunakan URL lengkap HTTPS Google Apps Script.',
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      normalizedUrl: trimmed,
      isDevEndpoint: false,
      error: 'URL Web App Google Apps Script wajib menggunakan protokol HTTPS.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  const isGasHost =
    host === 'script.google.com' || host === 'script.googleusercontent.com';
  if (!isGasHost) {
    return {
      valid: false,
      normalizedUrl: trimmed,
      isDevEndpoint: false,
      error: 'Host URL harus berasal dari script.google.com.',
    };
  }

  const isDevEndpoint = /\/dev\/?$/i.test(parsed.pathname);
  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    isDevEndpoint,
  };
}

export function buildGasAddActionPayload(
  shipment: Shipment,
  containers: KontainerItem[] = []
): GasAddActionPayload {
  const kontainerList = containers
    .filter((c) => c.noCont.trim() !== '')
    .map((c) => ({
      noCont: c.noCont.trim(),
      ukuranTipe: (c.ukuranTipe || '40HC').trim(),
    }));

  return {
    action: 'add',
    data: {
      kodeOs: shipment.kodeOs || '',
      kodeManualDokOs: shipment.kodeManualDokOs || '',
      ship: shipment.ship || '',
      kodeCustomer: shipment.kodeCustomer || '',
      namaCustomer: shipment.namaCustomer || '',
      tglTerimaDok: shipment.tglTerimaDok || '',
      noPackinglist: shipment.noPackinglist || '',
      noBl: shipment.noBl || '',
      statusDokumen: normalizeStatusDokumen(shipment.statusDokumen),
      etd: shipment.etd || '',
      eta: shipment.eta || '',
      countDownEta: shipment.countDownEta ?? null,
      noCont: shipment.noCont || '',
      kontainerList,
      bc11Terbit: Boolean(shipment.bc11Terbit || shipment.noBc11 || shipment.tglBc11),
      noBc11: shipment.noBc11 || '',
      tglBc11: shipment.tglBc11 || '',
      doPelayaranStatus: normalizeStatusDoPelayaran(shipment.doPelayaranStatus),
      doBerlakuSampai: shipment.doBerlakuSampai || '',
      doGatePassStatus: normalizeStatusGatePass(shipment.doGatePassStatus),
      doGatePassJenis: normalizeGatePassJenis(shipment.doGatePassJenis),
      doGatePassNomor: shipment.doGatePassNomor || '',
      truckingStatus: normalizeStatusTrucking(shipment.truckingStatus),
      truckingNamaSupir: shipment.truckingNamaSupir || '',
      truckingNoPlat: shipment.truckingNoPlat || '',
      gateOutStatus: normalizeStatusGateOut(shipment.gateOutStatus, shipment.status),
      gateOutTanggal: shipment.gateOutTanggal || '',
      suratJalanNomor: shipment.suratJalanNomor || '',
      suratJalanStatus: normalizeStatusSuratJalan(
        shipment.suratJalanStatus,
        shipment.gateOutStatus,
        shipment.status
      ),
      noAju: shipment.noAju || '',
      tglAju: shipment.tglAju || '',
      status: shipment.status || DEFAULT_STATUS_LIST[0],
      nopen: shipment.nopen || '',
      tglNopen: shipment.tglNopen || '',
      jalur: shipment.jalur || '',
      kodeImportir: shipment.kodeImportir || '',
      shipper: shipment.shipper || '',
      description: shipment.description || '',
      negaraAsal: shipment.negaraAsal || '',
      currency: shipment.currency || 'USD',
      kurs: shipment.kurs ?? '',
      invoice: shipment.invoice ?? '',
      bmPdri: shipment.bmPdri || '',
      sptnp: shipment.sptnp || '',
      noSppb: shipment.noSppb || '',
      tglSppb: shipment.tglSppb || '',
      dokumenChecker: shipment.dokumenChecker || '',
      noSptnp: shipment.noSptnp || '',
      tglSptnp: shipment.tglSptnp || '',
      pfpb: shipment.pfpb || '',
      tglPfpb: shipment.tglPfpb || '',
      pfpd: shipment.pfpd || '',
      tglPfpd: shipment.tglPfpd || '',
      eslah: shipment.eslah || '',
      tglEslah: shipment.tglEslah || '',
      createdAt: shipment.createdAt || new Date().toISOString(),
      createdBy: shipment.createdBy || '',
      updatedAt: shipment.updatedAt || new Date().toISOString(),
      updatedBy: shipment.updatedBy || '',
    },
  };
}

function normalizeHeaderLookupKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const GAS_FIELD_ALIASES: Record<string, string[]> = {
  kodeOs: ['kodeos', 'os', 'id'],
  kodeManualDokOs: ['kodemanualdokos', 'kodemanual', 'dokosmanual'],
  ship: ['ship', 'vessel', 'kapal', 'voyage'],
  kodeCustomer: ['kodecustomer', 'custcode', 'idcustomer'],
  namaCustomer: ['namacustomer', 'customer', 'client', 'pelanggan'],
  tglTerimaDok: ['tglterimadok', 'tanggalterimadok', 'terimadokdate'],
  noPackinglist: ['nopackinglist', 'packinglist', 'nopl'],
  noBl: ['nobl', 'bl', 'billoflading', 'hawb'],
  statusDokumen: ['statusdokumen', 'dokstatus'],
  etd: ['etd', 'tgletd'],
  eta: ['eta', 'tgleta'],
  noCont: ['nocont', 'nokontainer', 'kontainer', 'container'],
  bc11Terbit: ['bc11terbit'],
  noBc11: ['nobc11', 'bc11'],
  tglBc11: ['tglbc11', 'tanggalbc11'],
  doPelayaranStatus: ['dopelayaranstatus', 'statusdo'],
  doBerlakuSampai: ['doberlakusampai', 'expdo'],
  doGatePassStatus: ['dogatepassstatus', 'gatepassstatus'],
  doGatePassJenis: ['dogatepassjenis', 'gatepassjenis'],
  doGatePassNomor: ['dogatepassnomor', 'gatepassnomor'],
  truckingStatus: ['truckingstatus'],
  truckingNamaSupir: ['truckingnamasupir', 'namasupir'],
  truckingNoPlat: ['truckingnoplat', 'noplat'],
  gateOutStatus: ['gateoutstatus'],
  gateOutTanggal: ['gateouttanggal'],
  suratJalanNomor: ['suratjalannomor', 'nosuratjalan'],
  suratJalanStatus: ['suratjalanstatus'],
  noAju: ['noaju', 'aju', 'nomoraju'],
  tglAju: ['tglaju', 'tanggalaju'],
  status: ['status', 'statusshipment'],
  nopen: ['nopen', 'nonopen'],
  tglNopen: ['tglnopen', 'tanggalnopen'],
  jalur: ['jalur'],
  kodeImportir: ['kodeimportir', 'importir'],
  shipper: ['shipper', 'eksportir', 'pengirim'],
  description: ['description', 'deskripsi', 'uraianbarang', 'barang'],
  negaraAsal: ['negaraasal', 'origin', 'negara'],
  currency: ['currency', 'matauang', 'curr'],
  kurs: ['kurs', 'rate'],
  invoice: ['invoice', 'nilaiinvoice', 'cif'],
  bmPdri: ['bmpdri', 'bm'],
  sptnp: ['sptnp'],
  noSppb: ['nosppb', 'sppb'],
  tglSppb: ['tglsppb', 'tanggalsppb'],
  dokumenChecker: ['dokumenchecker', 'checker'],
  noSptnp: ['nosptnp'],
  tglSptnp: ['tglsptnp', 'tanggalsptnp'],
  pfpb: ['pfpb'],
  tglPfpb: ['tglpfpb', 'tanggalpfpb'],
  pfpd: ['pfpd'],
  tglPfpd: ['tglpfpd', 'tanggalpfpd'],
  eslah: ['eslah'],
  tglEslah: ['tgleslah', 'tanggaleslah'],
  createdAt: ['createdat'],
  createdBy: ['createdby'],
  updatedAt: ['updatedat'],
  updatedBy: ['updatedby'],
};

function normalizeDateString(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';
  const text = String(raw).trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const isoPrefix = text.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoPrefix) return isoPrefix[1];
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

function normalizeOptionalNumber(raw: unknown): number | '' {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : '';
  const cleaned = String(raw).replace(/[^0-9.-]/g, '');
  if (!cleaned) return '';
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : '';
}

function normalizeJalur(raw: unknown): JalurType {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'hijau') return 'Hijau';
  if (s === 'kuning') return 'Kuning';
  if (s === 'merah') return 'Merah';
  if (s === 'mita') return 'MITA';
  return '';
}

function normalizeBool(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  const s = String(raw || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'ya' || s === 'yes' || s === 'terbit';
}

function buildNormalizedFieldMap(row: Record<string, unknown>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    const normKey = normalizeHeaderLookupKey(k);
    if (normKey && !map.has(normKey)) {
      map.set(normKey, v);
    }
  }
  return map;
}

function readAliasedValue(fieldMap: Map<string, unknown>, field: string): unknown {
  const aliases = GAS_FIELD_ALIASES[field] || [normalizeHeaderLookupKey(field)];
  for (const alias of aliases) {
    if (fieldMap.has(alias)) {
      const val = fieldMap.get(alias);
      if (val !== undefined && val !== null) return val;
    }
  }
  return undefined;
}

function convert2dRowsToObjects(matrix: unknown[][]): Record<string, unknown>[] {
  if (matrix.length < 2) return [];
  const headerRow = matrix[0];
  if (!Array.isArray(headerRow)) return [];
  const headers = headerRow.map((cell) => String(cell ?? '').trim());
  const objects: Record<string, unknown>[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const obj: Record<string, unknown> = {};
    let hasAnyValue = false;
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (!header) continue;
      const value = row[c];
      if (value !== '' && value !== null && value !== undefined) {
        hasAnyValue = true;
      }
      obj[header] = value;
    }
    if (hasAnyValue) objects.push(obj);
  }
  return objects;
}

function extractRawRowsFromGetPayload(rawPayload: unknown): {
  rows: Record<string, unknown>[];
  errorMessage?: string;
} {
  if (rawPayload === null || rawPayload === undefined) {
    return { rows: [] };
  }

  if (Array.isArray(rawPayload)) {
    if (rawPayload.length > 0 && Array.isArray(rawPayload[0])) {
      return { rows: convert2dRowsToObjects(rawPayload as unknown[][]) };
    }
    return {
      rows: rawPayload.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      ),
    };
  }

  if (typeof rawPayload === 'object') {
    const obj = rawPayload as Record<string, unknown>;
    const statusStr = String(obj.status || '').trim().toLowerCase();
    if (obj.ok === false || obj.success === false || statusStr === 'error') {
      const msg =
        String(obj.error || obj.message || '').trim() ||
        'Endpoint Google Apps Script mengembalikan status error.';
      return { rows: [], errorMessage: msg };
    }

    const candidateKeys = ['data', 'items', 'shipments', 'rows', 'records', 'result', 'values'];
    for (const key of candidateKeys) {
      const candidate = obj[key];
      if (Array.isArray(candidate)) {
        if (candidate.length > 0 && Array.isArray(candidate[0])) {
          return { rows: convert2dRowsToObjects(candidate as unknown[][]) };
        }
        return {
          rows: candidate.filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === 'object' && !Array.isArray(item)
          ),
        };
      }
    }
  }

  return { rows: [] };
}

export interface ParseGasGetResponseResult {
  shipments: Shipment[];
  rawCount: number;
  skippedCount: number;
  errorMessage?: string;
}

export function parseGasWebAppGetResponse(
  rawPayload: unknown,
  checklistItems: string[] = DEFAULT_CHECKLIST_ITEMS,
  existingShipments: Shipment[] = []
): ParseGasGetResponseResult {
  const extracted = extractRawRowsFromGetPayload(rawPayload);
  if (extracted.errorMessage) {
    return {
      shipments: [],
      rawCount: 0,
      skippedCount: 0,
      errorMessage: extracted.errorMessage,
    };
  }

  const existingByKode = new Map(
    existingShipments.map((s) => [s.kodeOs.trim().toUpperCase(), s])
  );
  const nowIso = new Date().toISOString();
  const shipments: Shipment[] = [];
  let skippedCount = 0;

  for (const rawRow of extracted.rows) {
    const fieldMap = buildNormalizedFieldMap(rawRow);
    const readStr = (field: string) => {
      const v = readAliasedValue(fieldMap, field);
      return v === undefined || v === null ? '' : String(v).trim();
    };

    const kodeOs = readStr('kodeOs');
    const noBl = readStr('noBl');
    const namaCustomer = readStr('namaCustomer');
    const ship = readStr('ship');
    const noAju = readStr('noAju');

    // Skip empty placeholder rows with no identifying fields
    if (!kodeOs && !noBl && !namaCustomer && !ship && !noAju) {
      skippedCount++;
      continue;
    }

    const prev = kodeOs ? existingByKode.get(kodeOs.toUpperCase()) : undefined;
    const eta = normalizeDateString(readStr('eta')) || prev?.eta || '';
    const etd = normalizeDateString(readStr('etd')) || prev?.etd || '';
    const tglTerimaDok =
      normalizeDateString(readStr('tglTerimaDok')) || prev?.tglTerimaDok || nowIso.slice(0, 10);
    const noBc11 = readStr('noBc11') || prev?.noBc11 || '';
    const tglBc11 = normalizeDateString(readStr('tglBc11')) || prev?.tglBc11 || '';
    const bc11Val = readAliasedValue(fieldMap, 'bc11Terbit');
    const bc11Terbit =
      bc11Val !== undefined
        ? normalizeBool(bc11Val) || Boolean(noBc11 || tglBc11)
        : Boolean(prev?.bc11Terbit || noBc11 || tglBc11);

    const status = readStr('status') || prev?.status || DEFAULT_STATUS_LIST[0];
    const gateOutStatus = normalizeStatusGateOut(
      readStr('gateOutStatus') || prev?.gateOutStatus,
      status
    );

    const emptyCheck: ChecklistData = createEmptyChecklist(checklistItems);

    shipments.push({
      kodeOs,
      kodeManualDokOs: readStr('kodeManualDokOs') || prev?.kodeManualDokOs || '',
      ship: ship || prev?.ship || '-',
      kodeCustomer: readStr('kodeCustomer') || prev?.kodeCustomer || '',
      namaCustomer: namaCustomer || prev?.namaCustomer || '-',
      tglTerimaDok,
      terimaDok: prev?.terimaDok || emptyCheck,
      noPackinglist: readStr('noPackinglist') || prev?.noPackinglist || '',
      noBl: noBl || prev?.noBl || '-',
      statusDokumen: normalizeStatusDokumen(readStr('statusDokumen') || prev?.statusDokumen),
      etd,
      eta,
      countDownEta: calculateCountdownEta(eta),
      noCont: readStr('noCont') || prev?.noCont || '',
      bc11Terbit,
      noBc11,
      tglBc11,
      doPelayaranStatus: normalizeStatusDoPelayaran(
        readStr('doPelayaranStatus') || prev?.doPelayaranStatus
      ),
      doBerlakuSampai:
        normalizeDateString(readStr('doBerlakuSampai')) || prev?.doBerlakuSampai || '',
      doCatatanPerpanjangan: prev?.doCatatanPerpanjangan || '',
      doGatePassStatus: normalizeStatusGatePass(
        readStr('doGatePassStatus') || prev?.doGatePassStatus
      ),
      doGatePassJenis: normalizeGatePassJenis(
        readStr('doGatePassJenis') || prev?.doGatePassJenis
      ),
      doGatePassNomor: readStr('doGatePassNomor') || prev?.doGatePassNomor || '',
      truckingStatus: normalizeStatusTrucking(
        readStr('truckingStatus') || prev?.truckingStatus
      ),
      truckingNamaSupir: readStr('truckingNamaSupir') || prev?.truckingNamaSupir || '',
      truckingNoPlat: readStr('truckingNoPlat') || prev?.truckingNoPlat || '',
      truckingNoHpSupir: prev?.truckingNoHpSupir || '',
      gateOutStatus,
      gateOutTanggal:
        normalizeDateString(readStr('gateOutTanggal')) || prev?.gateOutTanggal || '',
      gateOutCatatan: prev?.gateOutCatatan || '',
      suratJalanNomor: readStr('suratJalanNomor') || prev?.suratJalanNomor || '',
      suratJalanTanggal: prev?.suratJalanTanggal || '',
      suratJalanStatus: normalizeStatusSuratJalan(
        readStr('suratJalanStatus') || prev?.suratJalanStatus,
        gateOutStatus,
        status
      ),
      suratJalanTujuan: prev?.suratJalanTujuan || '',
      suratJalanPenerima: prev?.suratJalanPenerima || '',
      suratJalanCatatan: prev?.suratJalanCatatan || '',
      suratJalanUpdatedAt: prev?.suratJalanUpdatedAt || '',
      billingStatus: normalizeStatusPenagihan(
        prev?.billingStatus,
        prev ? { ...prev, status, gateOutStatus } : undefined
      ),
      noAju: noAju || prev?.noAju || '',
      tglAju: normalizeDateString(readStr('tglAju')) || prev?.tglAju || '',
      status,
      nopen: readStr('nopen') || prev?.nopen || '',
      tglNopen: normalizeDateString(readStr('tglNopen')) || prev?.tglNopen || '',
      jalur: normalizeJalur(readStr('jalur')) || prev?.jalur || '',
      kodeImportir: readStr('kodeImportir') || prev?.kodeImportir || '',
      shipper: readStr('shipper') || prev?.shipper || '',
      description: readStr('description') || prev?.description || '',
      negaraAsal: readStr('negaraAsal') || prev?.negaraAsal || '',
      currency: readStr('currency') || prev?.currency || 'USD',
      kurs: normalizeOptionalNumber(readAliasedValue(fieldMap, 'kurs')) || prev?.kurs || '',
      invoice:
        normalizeOptionalNumber(readAliasedValue(fieldMap, 'invoice')) || prev?.invoice || '',
      bmPdri: readStr('bmPdri') || prev?.bmPdri || '',
      sptnp: readStr('sptnp') || prev?.sptnp || '',
      noSppb: readStr('noSppb') || prev?.noSppb || '',
      tglSppb: normalizeDateString(readStr('tglSppb')) || prev?.tglSppb || '',
      dokumenChecker: readStr('dokumenChecker') || prev?.dokumenChecker || '',
      noSptnp: readStr('noSptnp') || prev?.noSptnp || '',
      tglSptnp: normalizeDateString(readStr('tglSptnp')) || prev?.tglSptnp || '',
      pfpb: readStr('pfpb') || prev?.pfpb || '',
      tglPfpb: normalizeDateString(readStr('tglPfpb')) || prev?.tglPfpb || '',
      pfpd: readStr('pfpd') || prev?.pfpd || '',
      tglPfpd: normalizeDateString(readStr('tglPfpd')) || prev?.tglPfpd || '',
      eslah: readStr('eslah') || prev?.eslah || '',
      tglEslah: normalizeDateString(readStr('tglEslah')) || prev?.tglEslah || '',
      dokumenOs: prev?.dokumenOs || createEmptyChecklist(checklistItems),
      createdAt: readStr('createdAt') || prev?.createdAt || nowIso,
      createdBy: readStr('createdBy') || prev?.createdBy || 'gas-webapp',
      updatedAt: readStr('updatedAt') || nowIso,
      updatedBy: readStr('updatedBy') || 'gas-webapp',
    });
  }

  return {
    shipments,
    rawCount: extracted.rows.length,
    skippedCount,
  };
}

export interface MergeGasShipmentsResult {
  nextDb: DatabaseState;
  insertedCount: number;
  updatedCount: number;
  totalRemote: number;
}

export function mergeGasFetchedShipments(
  existingDb: DatabaseState,
  fetchedShipments: Shipment[],
  actorUsername = 'gas-webapp'
): MergeGasShipmentsResult {
  const nextShipments = [...existingDb.shipments];
  const nextSeqByMonth = { ...(existingDb.pengaturan.seqByMonth || {}) };
  const existingKodeSet = new Set<string>();
  for (const s of nextShipments) {
    const code = (s.kodeOs || '').trim().toUpperCase();
    if (!code) continue;
    existingKodeSet.add(code);
    const m = code.match(/^OS-(\d{4})-(\d{4})$/);
    if (m) {
      const monthKey = m[1];
      const seqNum = Number(m[2]);
      if (seqNum > (nextSeqByMonth[monthKey] || 0)) {
        nextSeqByMonth[monthKey] = seqNum;
      }
    }
  }
  const nowIso = new Date().toISOString();

  let insertedCount = 0;
  let updatedCount = 0;

  for (const incoming of fetchedShipments) {
    let idx = -1;
    if (incoming.kodeOs.trim()) {
      const targetKode = incoming.kodeOs.trim().toUpperCase();
      idx = nextShipments.findIndex((s) => s.kodeOs.trim().toUpperCase() === targetKode);
    }
    if (idx === -1 && incoming.noBl.trim() && incoming.noBl.trim() !== '-') {
      const targetBl = incoming.noBl.trim().toUpperCase();
      idx = nextShipments.findIndex((s) => s.noBl.trim().toUpperCase() === targetBl);
    }

    if (idx !== -1) {
      const prev = nextShipments[idx];
      nextShipments[idx] = {
        ...prev,
        ...incoming,
        kodeOs: prev.kodeOs,
        terimaDok: prev.terimaDok,
        dokumenOs: prev.dokumenOs,
        createdAt: prev.createdAt || incoming.createdAt || nowIso,
        createdBy: prev.createdBy || incoming.createdBy || actorUsername,
        updatedAt: nowIso,
        updatedBy: actorUsername,
      };
      updatedCount++;
    } else {
      let assignedKodeOs = incoming.kodeOs.trim();
      if (!assignedKodeOs || existingKodeSet.has(assignedKodeOs.toUpperCase())) {
        let seq = generateNextKodeOS(nextSeqByMonth);
        nextSeqByMonth[seq.monthKey] = seq.nextSeq;
        while (existingKodeSet.has(seq.kodeOs.toUpperCase())) {
          seq = generateNextKodeOS(nextSeqByMonth);
          nextSeqByMonth[seq.monthKey] = seq.nextSeq;
        }
        assignedKodeOs = seq.kodeOs;
      }
      existingKodeSet.add(assignedKodeOs.toUpperCase());
      nextShipments.unshift({
        ...incoming,
        kodeOs: assignedKodeOs,
        updatedAt: nowIso,
        updatedBy: actorUsername,
      });
      insertedCount++;
    }
  }

  const nextLogs = [
    {
      id: `log_gas_get_${Date.now()}`,
      waktu: nowIso,
      user: actorUsername,
      kodeOs: 'GAS-WEBAPP',
      kolom: 'GAS_GET_SYNC',
      nilaiLama: `${existingDb.shipments.length} shipment`,
      nilaiBaru: `GET ${fetchedShipments.length} baris (${insertedCount} baru, ${updatedCount} diperbarui)`,
    },
    ...existingDb.logs,
  ].slice(0, 500);

  return {
    nextDb: {
      ...existingDb,
      shipments: nextShipments,
      logs: nextLogs,
      pengaturan: {
        ...existingDb.pengaturan,
        seqByMonth: nextSeqByMonth,
        gasWebAppLastSyncAt: nowIso,
        gasWebAppLastSyncDirection: 'get',
        gasWebAppLastSyncMessage: `Berhasil mengambil ${fetchedShipments.length} baris (${insertedCount} baru, ${updatedCount} diperbarui).`,
      },
    },
    insertedCount,
    updatedCount,
    totalRemote: fetchedShipments.length,
  };
}

export function buildSampleGasWebAppScript(): string {
  return `// Tempel pada Google Apps Script (Code.gs) di Spreadsheet Anda
const SHEET_NAME = 'Shipments';

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return ContentService.createTextOutput(JSON.stringify({ ok: true, data: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const headers = values[0];
  const data = values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  if (body.action === 'add' && body.data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    const d = body.data;
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['kodeOs', 'noBl', 'namaCustomer', 'ship', 'eta', 'noAju', 'status', 'jalur', 'dokumenChecker', 'createdAt']);
    }
    sheet.appendRow([d.kodeOs || '', d.noBl || '', d.namaCustomer || '', d.ship || '', d.eta || '', d.noAju || '', d.status || '', d.jalur || '', d.dokumenChecker || '', d.createdAt || new Date().toISOString()]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, status: 'success', kodeOs: d.kodeOs || '' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Action tidak dikenali' }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
}
