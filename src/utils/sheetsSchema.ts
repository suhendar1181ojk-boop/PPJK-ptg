import type {
  BillingItem,
  Catatan,
  ChecklistData,
  Customer,
  DatabaseState,
  DokumenItem,
  Importir,
  JalurType,
  KategoriPengeluaranOps,
  KontainerItem,
  LogPerubahan,
  MetodePembayaranOps,
  ModulePermissionsMap,
  Pengaturan,
  PengeluaranOpsItem,
  PhasePermissions,
  RoleModuleAccessMap,
  Shipment,
  Shipper,
  StatusPengeluaranOps,
  UserAccount,
  UserRole,
} from '../types/ppjk';
import {
  createEmptyChecklist,
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_PENGATURAN,
  reconcileAllShipmentsDerivedState,
  resolveUserPhasePermissions,
} from './ppjkLogic';

export interface SheetTabSchema {
  title: string;
  headers: string[];
}

export const SHIPMENT_SHEET_HEADERS = [
  'kodeOs',
  'kodeManualDokOs',
  'ship',
  'kodeCustomer',
  'namaCustomer',
  'tglTerimaDok',
  'terimaDokJson',
  'noPackinglist',
  'noBl',
  'statusDokumen',
  'etd',
  'eta',
  'countDownEta',
  'noCont',
  'bc11Terbit',
  'noBc11',
  'tglBc11',
  'doPelayaranStatus',
  'doBerlakuSampai',
  'doCatatanPerpanjangan',
  'doGatePassStatus',
  'doGatePassJenis',
  'doGatePassNomor',
  'truckingStatus',
  'truckingNamaSupir',
  'truckingNoPlat',
  'truckingNoHpSupir',
  'gateOutStatus',
  'gateOutTanggal',
  'gateOutCatatan',
  'suratJalanNomor',
  'suratJalanTanggal',
  'suratJalanStatus',
  'suratJalanTujuan',
  'suratJalanPenerima',
  'suratJalanCatatan',
  'suratJalanUpdatedAt',
  'billingStatus',
  'billingNomor',
  'billingTanggal',
  'billingJatuhTempo',
  'billingItemsJson',
  'billingPpnPersen',
  'billingTotal',
  'billingCatatan',
  'billingOwnerNotifiedAt',
  'billingOwnerNotifiedVia',
  'billingOwnerNotifiedBy',
  'billingCustomerSentAt',
  'billingCustomerSentVia',
  'billingCreatedBy',
  'noAju',
  'tglAju',
  'status',
  'nopen',
  'tglNopen',
  'jalur',
  'kodeImportir',
  'shipper',
  'description',
  'negaraAsal',
  'currency',
  'kurs',
  'invoice',
  'bmPdri',
  'sptnp',
  'noSppb',
  'tglSppb',
  'dokumenChecker',
  'noSptnp',
  'tglSptnp',
  'pfpb',
  'tglPfpb',
  'pfpd',
  'tglPfpd',
  'eslah',
  'tglEslah',
  'dokumenOsJson',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
] as const;

export const DATABASE_SHEET_TABS: SheetTabSchema[] = [
  { title: 'Shipments', headers: [...SHIPMENT_SHEET_HEADERS] },
  { title: 'Kontainer', headers: ['id', 'kodeOs', 'noCont', 'ukuranTipe'] },
  { title: 'Master_Customer', headers: ['kodeCustomer', 'namaCustomer', 'kontak'] },
  { title: 'Master_Importir', headers: ['kodeImportir', 'namaImportir'] },
  { title: 'Master_Shipper', headers: ['namaShipper', 'negara'] },
  {
    title: 'Users',
    headers: [
      'username',
      'passwordHash',
      'salt',
      'nama',
      'role',
      'aktif',
      'mustChangePassword',
      'phasePermissionsJson',
      'modulePermissionsJson',
    ],
  },
  {
    title: 'Log_Perubahan',
    headers: ['id', 'waktu', 'user', 'kodeOs', 'kolom', 'nilaiLama', 'nilaiBaru'],
  },
  { title: 'Catatan', headers: ['id', 'kodeOs', 'waktu', 'user', 'isi'] },
  {
    title: 'Dokumen',
    headers: [
      'id',
      'kodeOs',
      'jenisDokumen',
      'namaFile',
      'linkDrive',
      'waktuUpload',
      'user',
      'driveFileId',
      'driveFolderId',
      'source',
    ],
  },
  {
    title: 'Pengeluaran_Ops',
    headers: [
      'id',
      'kodePengeluaran',
      'noTandaTerima',
      'kodeOs',
      'noBl',
      'namaCustomer',
      'tanggal',
      'kategori',
      'keterangan',
      'nominal',
      'metodePembayaran',
      'statusPengeluaran',
      'petugasOps',
      'diberikanOleh',
      'tandaTerimaAt',
      'buktiNamaFile',
      'buktiMimeType',
      'buktiDataUrl',
      'buktiLinkDrive',
      'driveFileId',
      'source',
      'catatanAudit',
      'createdAt',
      'createdBy',
      'updatedAt',
      'updatedBy',
    ],
  },
  { title: 'Pengaturan', headers: ['key', 'value'] },
  { title: 'Sync_Metadata', headers: ['key', 'value'] },
];

export interface SpreadsheetSyncDiffSummary {
  localCounts: {
    shipments: number;
    kontainers: number;
    customers: number;
    importirs: number;
    shippers: number;
    users: number;
    dokumen: number;
    catatan: number;
    pengeluaranOps: number;
  };
  remoteCounts: {
    shipments: number;
    kontainers: number;
    customers: number;
    importirs: number;
    shippers: number;
    users: number;
    dokumen: number;
    catatan: number;
    pengeluaranOps: number;
  };
  totalLocalRows: number;
  totalRemoteRows: number;
}

function safeJsonStringify(val: unknown, fallback = ''): string {
  try {
    return JSON.stringify(val);
  } catch {
    return fallback;
  }
}

function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  if (!raw || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toSheetStr(val: unknown): string {
  if (val === undefined || val === null) return '';
  return String(val);
}

function parseBoolCell(raw: string | undefined, fallback = false): boolean {
  if (!raw) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'ya' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'tidak' || v === 'no') return false;
  return fallback;
}

function parseNumOrEmpty(raw: string | undefined): number | '' {
  if (!raw || !raw.trim()) return '';
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : '';
}

function parseOptionalNum(raw: string | undefined): number | undefined {
  if (!raw || !raw.trim()) return undefined;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Mengekstrak Spreadsheet ID dari input mentah berupa ID maupun URL Google Sheets lengkap.
 */
export function extractSpreadsheetIdFromInput(rawInput: string): string {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return '';
  const urlMatch = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i.exec(trimmed);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  const cleanId = trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
  return cleanId.length >= 15 ? cleanId : '';
}

/**
 * Mengonversi seluruh DatabaseState ke matriks sel (2D string array) per tab Google Spreadsheet.
 */
export function serializeDatabaseToSheetMatrixMap(
  db: DatabaseState,
  updatedBy = 'system',
  syncedAt = new Date().toISOString()
): Record<string, string[][]> {
  const shipmentRows: string[][] = [
    [...SHIPMENT_SHEET_HEADERS],
    ...db.shipments.map((s) => [
      toSheetStr(s.kodeOs),
      toSheetStr(s.kodeManualDokOs),
      toSheetStr(s.ship),
      toSheetStr(s.kodeCustomer),
      toSheetStr(s.namaCustomer),
      toSheetStr(s.tglTerimaDok),
      safeJsonStringify(s.terimaDok, '{}'),
      toSheetStr(s.noPackinglist),
      toSheetStr(s.noBl),
      toSheetStr(s.statusDokumen),
      toSheetStr(s.etd),
      toSheetStr(s.eta),
      s.countDownEta === null || s.countDownEta === undefined ? '' : String(s.countDownEta),
      toSheetStr(s.noCont),
      s.bc11Terbit ? 'TRUE' : 'FALSE',
      toSheetStr(s.noBc11),
      toSheetStr(s.tglBc11),
      toSheetStr(s.doPelayaranStatus),
      toSheetStr(s.doBerlakuSampai),
      toSheetStr(s.doCatatanPerpanjangan),
      toSheetStr(s.doGatePassStatus),
      toSheetStr(s.doGatePassJenis),
      toSheetStr(s.doGatePassNomor),
      toSheetStr(s.truckingStatus),
      toSheetStr(s.truckingNamaSupir),
      toSheetStr(s.truckingNoPlat),
      toSheetStr(s.truckingNoHpSupir),
      toSheetStr(s.gateOutStatus),
      toSheetStr(s.gateOutTanggal),
      toSheetStr(s.gateOutCatatan),
      toSheetStr(s.suratJalanNomor),
      toSheetStr(s.suratJalanTanggal),
      toSheetStr(s.suratJalanStatus),
      toSheetStr(s.suratJalanTujuan),
      toSheetStr(s.suratJalanPenerima),
      toSheetStr(s.suratJalanCatatan),
      toSheetStr(s.suratJalanUpdatedAt),
      toSheetStr(s.billingStatus),
      toSheetStr(s.billingNomor),
      toSheetStr(s.billingTanggal),
      toSheetStr(s.billingJatuhTempo),
      safeJsonStringify(s.billingItems || [], '[]'),
      s.billingPpnPersen === undefined ? '' : String(s.billingPpnPersen),
      s.billingTotal === undefined ? '' : String(s.billingTotal),
      toSheetStr(s.billingCatatan),
      toSheetStr(s.billingOwnerNotifiedAt),
      toSheetStr(s.billingOwnerNotifiedVia),
      toSheetStr(s.billingOwnerNotifiedBy),
      toSheetStr(s.billingCustomerSentAt),
      toSheetStr(s.billingCustomerSentVia),
      toSheetStr(s.billingCreatedBy),
      toSheetStr(s.noAju),
      toSheetStr(s.tglAju),
      toSheetStr(s.status),
      toSheetStr(s.nopen),
      toSheetStr(s.tglNopen),
      toSheetStr(s.jalur),
      toSheetStr(s.kodeImportir),
      toSheetStr(s.shipper),
      toSheetStr(s.description),
      toSheetStr(s.negaraAsal),
      toSheetStr(s.currency),
      s.kurs === '' ? '' : String(s.kurs),
      s.invoice === '' ? '' : String(s.invoice),
      toSheetStr(s.bmPdri),
      toSheetStr(s.sptnp),
      toSheetStr(s.noSppb),
      toSheetStr(s.tglSppb),
      toSheetStr(s.dokumenChecker),
      toSheetStr(s.noSptnp),
      toSheetStr(s.tglSptnp),
      toSheetStr(s.pfpb),
      toSheetStr(s.tglPfpb),
      toSheetStr(s.pfpd),
      toSheetStr(s.tglPfpd),
      toSheetStr(s.eslah),
      toSheetStr(s.tglEslah),
      safeJsonStringify(s.dokumenOs, '{}'),
      toSheetStr(s.createdAt),
      toSheetStr(s.createdBy),
      toSheetStr(s.updatedAt),
      toSheetStr(s.updatedBy),
    ]),
  ];

  const kontainerRows: string[][] = [
    ['id', 'kodeOs', 'noCont', 'ukuranTipe'],
    ...db.kontainers.map((k) => [
      toSheetStr(k.id),
      toSheetStr(k.kodeOs),
      toSheetStr(k.noCont),
      toSheetStr(k.ukuranTipe),
    ]),
  ];

  const customerRows: string[][] = [
    ['kodeCustomer', 'namaCustomer', 'kontak'],
    ...db.customers.map((c) => [
      toSheetStr(c.kodeCustomer),
      toSheetStr(c.namaCustomer),
      toSheetStr(c.kontak),
    ]),
  ];

  const importirRows: string[][] = [
    ['kodeImportir', 'namaImportir'],
    ...db.importirs.map((i) => [toSheetStr(i.kodeImportir), toSheetStr(i.namaImportir)]),
  ];

  const shipperRows: string[][] = [
    ['namaShipper', 'negara'],
    ...db.shippers.map((sh) => [toSheetStr(sh.namaShipper), toSheetStr(sh.negara)]),
  ];

  const userRows: string[][] = [
    [
      'username',
      'passwordHash',
      'salt',
      'nama',
      'role',
      'aktif',
      'mustChangePassword',
      'phasePermissionsJson',
      'modulePermissionsJson',
    ],
    ...db.users.map((u) => [
      toSheetStr(u.username),
      toSheetStr(u.passwordHash),
      toSheetStr(u.salt),
      toSheetStr(u.nama),
      toSheetStr(u.role),
      u.aktif ? 'TRUE' : 'FALSE',
      u.mustChangePassword ? 'TRUE' : 'FALSE',
      safeJsonStringify(resolveUserPhasePermissions(u.role, u.phasePermissions), '{}'),
      u.modulePermissions && Object.keys(u.modulePermissions).length > 0
        ? safeJsonStringify(u.modulePermissions, '{}')
        : '',
    ]),
  ];

  const logRows: string[][] = [
    ['id', 'waktu', 'user', 'kodeOs', 'kolom', 'nilaiLama', 'nilaiBaru'],
    ...db.logs.map((l) => [
      toSheetStr(l.id),
      toSheetStr(l.waktu),
      toSheetStr(l.user),
      toSheetStr(l.kodeOs),
      toSheetStr(l.kolom),
      toSheetStr(l.nilaiLama),
      toSheetStr(l.nilaiBaru),
    ]),
  ];

  const catatanRows: string[][] = [
    ['id', 'kodeOs', 'waktu', 'user', 'isi'],
    ...db.catatan.map((c) => [
      toSheetStr(c.id),
      toSheetStr(c.kodeOs),
      toSheetStr(c.waktu),
      toSheetStr(c.user),
      toSheetStr(c.isi),
    ]),
  ];

  const dokumenRows: string[][] = [
    [
      'id',
      'kodeOs',
      'jenisDokumen',
      'namaFile',
      'linkDrive',
      'waktuUpload',
      'user',
      'driveFileId',
      'driveFolderId',
      'source',
    ],
    ...db.dokumen.map((d) => [
      toSheetStr(d.id),
      toSheetStr(d.kodeOs),
      toSheetStr(d.jenisDokumen),
      toSheetStr(d.namaFile),
      toSheetStr(d.linkDrive),
      toSheetStr(d.waktuUpload),
      toSheetStr(d.user),
      toSheetStr(d.driveFileId),
      toSheetStr(d.driveFolderId),
      toSheetStr(d.source),
    ]),
  ];

  const pengeluaranOpsRows: string[][] = [
    [
      'id',
      'kodePengeluaran',
      'noTandaTerima',
      'kodeOs',
      'noBl',
      'namaCustomer',
      'tanggal',
      'kategori',
      'keterangan',
      'nominal',
      'metodePembayaran',
      'statusPengeluaran',
      'petugasOps',
      'diberikanOleh',
      'tandaTerimaAt',
      'buktiNamaFile',
      'buktiMimeType',
      'buktiDataUrl',
      'buktiLinkDrive',
      'driveFileId',
      'source',
      'catatanAudit',
      'createdAt',
      'createdBy',
      'updatedAt',
      'updatedBy',
    ],
    ...(db.pengeluaranOps || []).map((p) => {
      // Google Sheets cells max 50,000 chars; strip oversized base64 DataURL only for cell safety
      const safeDataUrl =
        p.buktiDataUrl && p.buktiDataUrl.length <= 45000 ? p.buktiDataUrl : '';
      return [
        toSheetStr(p.id),
        toSheetStr(p.kodePengeluaran),
        toSheetStr(p.noTandaTerima),
        toSheetStr(p.kodeOs),
        toSheetStr(p.noBl),
        toSheetStr(p.namaCustomer),
        toSheetStr(p.tanggal),
        toSheetStr(p.kategori),
        toSheetStr(p.keterangan),
        String(Number(p.nominal) || 0),
        toSheetStr(p.metodePembayaran),
        toSheetStr(p.statusPengeluaran),
        toSheetStr(p.petugasOps),
        toSheetStr(p.diberikanOleh),
        toSheetStr(p.tandaTerimaAt),
        toSheetStr(p.buktiNamaFile),
        toSheetStr(p.buktiMimeType),
        safeDataUrl,
        toSheetStr(p.buktiLinkDrive),
        toSheetStr(p.driveFileId),
        toSheetStr(p.source),
        toSheetStr(p.catatanAudit),
        toSheetStr(p.createdAt),
        toSheetStr(p.createdBy),
        toSheetStr(p.updatedAt),
        toSheetStr(p.updatedBy),
      ];
    }),
  ];

  const pengaturanEntries: Array<[string, string]> = [
    ['seqByMonth', safeJsonStringify(db.pengaturan.seqByMonth || {}, '{}')],
    ['seqPengeluaranByMonth', safeJsonStringify(db.pengaturan.seqPengeluaranByMonth || {}, '{}')],
    ['driveParentFolderId', toSheetStr(db.pengaturan.driveParentFolderId)],
    ['statusList', safeJsonStringify(db.pengaturan.statusList || [], '[]')],
    ['jalurList', safeJsonStringify(db.pengaturan.jalurList || [], '[]')],
    ['checklistItems', safeJsonStringify(db.pengaturan.checklistItems || [], '[]')],
    ['notificationEmails', safeJsonStringify(db.pengaturan.notificationEmails || [], '[]')],
    ['ppjkBrandName', toSheetStr(db.pengaturan.ppjkBrandName)],
    ['ppjkCompanyName', toSheetStr(db.pengaturan.ppjkCompanyName)],
    ['ppjkTagline', toSheetStr(db.pengaturan.ppjkTagline)],
    ['ppjkNpwp', toSheetStr(db.pengaturan.ppjkNpwp)],
    ['ppjkAddress', toSheetStr(db.pengaturan.ppjkAddress)],
    ['ppjkPhone', toSheetStr(db.pengaturan.ppjkPhone)],
    ['ppjkEmail', toSheetStr(db.pengaturan.ppjkEmail)],
    ['ppjkWebsite', toSheetStr(db.pengaturan.ppjkWebsite)],
    ['ppjkFooterNote', toSheetStr(db.pengaturan.ppjkFooterNote)],
    [
      'ppjkLogoDataUrl',
      db.pengaturan.ppjkLogoDataUrl && db.pengaturan.ppjkLogoDataUrl.length <= 45000
        ? db.pengaturan.ppjkLogoDataUrl
        : '',
    ],
    ['ppjkLogoFileName', toSheetStr(db.pengaturan.ppjkLogoFileName)],
    [
      'ppjkKopSuratDataUrl',
      db.pengaturan.ppjkKopSuratDataUrl && db.pengaturan.ppjkKopSuratDataUrl.length <= 45000
        ? db.pengaturan.ppjkKopSuratDataUrl
        : '',
    ],
    ['ppjkKopSuratFileName', toSheetStr(db.pengaturan.ppjkKopSuratFileName)],
    ['roleModuleAccess', safeJsonStringify(db.pengaturan.roleModuleAccess || {}, '{}')],
    ['ownerName', toSheetStr(db.pengaturan.ownerName)],
    ['ownerWhatsapp', toSheetStr(db.pengaturan.ownerWhatsapp)],
    ['ownerEmail', toSheetStr(db.pengaturan.ownerEmail)],
    ['adminName', toSheetStr(db.pengaturan.adminName)],
    ['adminWhatsapp', toSheetStr(db.pengaturan.adminWhatsapp)],
    ['adminEmail', toSheetStr(db.pengaturan.adminEmail)],
    ['billingBankInfo', toSheetStr(db.pengaturan.billingBankInfo)],
    ['gasDeployPinHash', toSheetStr(db.pengaturan.gasDeployPinHash)],
    ['spreadsheetId', toSheetStr(db.pengaturan.spreadsheetId)],
    ['spreadsheetTitle', toSheetStr(db.pengaturan.spreadsheetTitle)],
    ['spreadsheetUrl', toSheetStr(db.pengaturan.spreadsheetUrl)],
    ['spreadsheetAutoSync', db.pengaturan.spreadsheetAutoSync ? 'TRUE' : 'FALSE'],
    ['spreadsheetLastSyncAt', syncedAt],
    ['spreadsheetLastSyncDirection', toSheetStr(db.pengaturan.spreadsheetLastSyncDirection || 'push')],
  ];

  const pengaturanRows: string[][] = [['key', 'value'], ...pengaturanEntries];

  const metadataRows: string[][] = [
    ['key', 'value'],
    ['schemaVersion', '1'],
    ['app', 'PTG PPJK Outstanding'],
    ['lastUpdatedAt', syncedAt],
    ['updatedBy', updatedBy],
    ['totalShipments', String(db.shipments.length)],
    ['totalKontainers', String(db.kontainers.length)],
    ['totalCustomers', String(db.customers.length)],
    ['totalImportirs', String(db.importirs.length)],
    ['totalShippers', String(db.shippers.length)],
    ['totalUsers', String(db.users.length)],
    ['totalPengeluaranOps', String((db.pengeluaranOps || []).length)],
  ];

  return {
    Shipments: shipmentRows,
    Kontainer: kontainerRows,
    Master_Customer: customerRows,
    Master_Importir: importirRows,
    Master_Shipper: shipperRows,
    Users: userRows,
    Log_Perubahan: logRows,
    Catatan: catatanRows,
    Dokumen: dokumenRows,
    Pengeluaran_Ops: pengeluaranOpsRows,
    Pengaturan: pengaturanRows,
    Sync_Metadata: metadataRows,
  };
}

function mapRowsByHeader(matrix: string[][] | undefined): Array<Record<string, string>> {
  if (!matrix || matrix.length < 2) return [];
  const headers = matrix[0].map((h) => (h || '').trim());
  const records: Array<Record<string, string>> = [];
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.every((cell) => !cell || !cell.trim())) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      obj[key] = row[c] !== undefined ? String(row[c]) : '';
    }
    records.push(obj);
  }
  return records;
}

/**
 * Mengonversi matriks data hasil pembacaan Google Spreadsheet kembali ke DatabaseState.
 */
export function parseSheetMatrixMapToDatabase(
  sheetsData: Record<string, string[][]>,
  fallbackDb: DatabaseState,
  overrideSpreadsheetMeta?: {
    spreadsheetId?: string;
    spreadsheetTitle?: string;
    spreadsheetUrl?: string;
    spreadsheetAutoSync?: boolean;
  }
): DatabaseState {
  // 1. Parse Pengaturan first so checklistItems is ready for shipments
  const settingsRows = mapRowsByHeader(sheetsData.Pengaturan);
  const settingsMap = new Map<string, string>();
  for (const r of settingsRows) {
    if (r.key) settingsMap.set(r.key.trim(), r.value || '');
  }

  const checklistItems = safeJsonParse<string[]>(
    settingsMap.get('checklistItems'),
    fallbackDb.pengaturan.checklistItems || DEFAULT_CHECKLIST_ITEMS
  );

  const pengaturan: Pengaturan = {
    seqByMonth: safeJsonParse<Record<string, number>>(
      settingsMap.get('seqByMonth'),
      fallbackDb.pengaturan.seqByMonth || {}
    ),
    driveParentFolderId:
      settingsMap.get('driveParentFolderId') ||
      fallbackDb.pengaturan.driveParentFolderId ||
      DEFAULT_PENGATURAN.driveParentFolderId,
    statusList: safeJsonParse<string[]>(
      settingsMap.get('statusList'),
      fallbackDb.pengaturan.statusList || DEFAULT_PENGATURAN.statusList
    ),
    jalurList: safeJsonParse<JalurType[]>(
      settingsMap.get('jalurList'),
      fallbackDb.pengaturan.jalurList || DEFAULT_PENGATURAN.jalurList
    ),
    checklistItems,
    notificationEmails: safeJsonParse<string[]>(
      settingsMap.get('notificationEmails'),
      fallbackDb.pengaturan.notificationEmails || []
    ),
    ppjkBrandName:
      settingsMap.get('ppjkBrandName') ||
      fallbackDb.pengaturan.ppjkBrandName ||
      DEFAULT_PENGATURAN.ppjkBrandName,
    ppjkCompanyName:
      settingsMap.get('ppjkCompanyName') ||
      fallbackDb.pengaturan.ppjkCompanyName ||
      DEFAULT_PENGATURAN.ppjkCompanyName,
    ppjkTagline:
      settingsMap.get('ppjkTagline') ||
      fallbackDb.pengaturan.ppjkTagline ||
      DEFAULT_PENGATURAN.ppjkTagline,
    ppjkNpwp:
      settingsMap.get('ppjkNpwp') ||
      fallbackDb.pengaturan.ppjkNpwp ||
      DEFAULT_PENGATURAN.ppjkNpwp,
    ppjkAddress:
      settingsMap.get('ppjkAddress') ||
      fallbackDb.pengaturan.ppjkAddress ||
      DEFAULT_PENGATURAN.ppjkAddress,
    ppjkPhone:
      settingsMap.get('ppjkPhone') ||
      fallbackDb.pengaturan.ppjkPhone ||
      DEFAULT_PENGATURAN.ppjkPhone,
    ppjkEmail:
      settingsMap.get('ppjkEmail') ||
      fallbackDb.pengaturan.ppjkEmail ||
      DEFAULT_PENGATURAN.ppjkEmail,
    ppjkWebsite:
      settingsMap.get('ppjkWebsite') ||
      fallbackDb.pengaturan.ppjkWebsite ||
      DEFAULT_PENGATURAN.ppjkWebsite,
    ppjkFooterNote:
      settingsMap.get('ppjkFooterNote') ||
      fallbackDb.pengaturan.ppjkFooterNote ||
      DEFAULT_PENGATURAN.ppjkFooterNote,
    ppjkLogoDataUrl:
      settingsMap.get('ppjkLogoDataUrl') ??
      fallbackDb.pengaturan.ppjkLogoDataUrl ??
      '',
    ppjkLogoFileName:
      settingsMap.get('ppjkLogoFileName') ??
      fallbackDb.pengaturan.ppjkLogoFileName ??
      '',
    ppjkKopSuratDataUrl:
      settingsMap.get('ppjkKopSuratDataUrl') ??
      fallbackDb.pengaturan.ppjkKopSuratDataUrl ??
      '',
    ppjkKopSuratFileName:
      settingsMap.get('ppjkKopSuratFileName') ??
      fallbackDb.pengaturan.ppjkKopSuratFileName ??
      '',
    roleModuleAccess: safeJsonParse<RoleModuleAccessMap>(
      settingsMap.get('roleModuleAccess'),
      fallbackDb.pengaturan.roleModuleAccess || {}
    ),
    ownerName: settingsMap.get('ownerName') || fallbackDb.pengaturan.ownerName,
    ownerWhatsapp: settingsMap.get('ownerWhatsapp') || fallbackDb.pengaturan.ownerWhatsapp,
    ownerEmail: settingsMap.get('ownerEmail') || fallbackDb.pengaturan.ownerEmail,
    adminName: settingsMap.get('adminName') || fallbackDb.pengaturan.adminName,
    adminWhatsapp: settingsMap.get('adminWhatsapp') || fallbackDb.pengaturan.adminWhatsapp,
    adminEmail: settingsMap.get('adminEmail') || fallbackDb.pengaturan.adminEmail,
    billingBankInfo: settingsMap.get('billingBankInfo') || fallbackDb.pengaturan.billingBankInfo,
    gasDeployPinHash: settingsMap.get('gasDeployPinHash') || fallbackDb.pengaturan.gasDeployPinHash,
    spreadsheetId:
      overrideSpreadsheetMeta?.spreadsheetId ||
      settingsMap.get('spreadsheetId') ||
      fallbackDb.pengaturan.spreadsheetId,
    spreadsheetTitle:
      overrideSpreadsheetMeta?.spreadsheetTitle ||
      settingsMap.get('spreadsheetTitle') ||
      fallbackDb.pengaturan.spreadsheetTitle,
    spreadsheetUrl:
      overrideSpreadsheetMeta?.spreadsheetUrl ||
      settingsMap.get('spreadsheetUrl') ||
      fallbackDb.pengaturan.spreadsheetUrl,
    spreadsheetAutoSync:
      overrideSpreadsheetMeta?.spreadsheetAutoSync !== undefined
        ? overrideSpreadsheetMeta.spreadsheetAutoSync
        : settingsMap.has('spreadsheetAutoSync')
          ? parseBoolCell(settingsMap.get('spreadsheetAutoSync'), true)
          : fallbackDb.pengaturan.spreadsheetAutoSync,
    spreadsheetLastSyncAt: new Date().toISOString(),
    spreadsheetLastSyncDirection: 'pull',
    seqPengeluaranByMonth: safeJsonParse<Record<string, number>>(
      settingsMap.get('seqPengeluaranByMonth'),
      fallbackDb.pengaturan.seqPengeluaranByMonth || {}
    ),
  };

  // 2. Parse Kontainer
  const kontainerRows = mapRowsByHeader(sheetsData.Kontainer);
  const kontainers: KontainerItem[] = sheetsData.Kontainer
    ? kontainerRows
        .filter((r) => Boolean(r.kodeOs?.trim()))
        .map((r, idx) => ({
          id: r.id?.trim() || `cont-sheet-${idx + 1}`,
          kodeOs: r.kodeOs.trim(),
          noCont: r.noCont || '',
          ukuranTipe: r.ukuranTipe || '',
        }))
    : fallbackDb.kontainers;

  // 3. Parse Shipments
  const shipmentRows = mapRowsByHeader(sheetsData.Shipments);
  const parsedShipments: Shipment[] = sheetsData.Shipments
    ? shipmentRows
        .filter((r) => Boolean(r.kodeOs?.trim()))
        .map((r) => {
          const emptyTerima = createEmptyChecklist(checklistItems);
          const emptyOs = createEmptyChecklist(checklistItems);
          const terimaDok = safeJsonParse<ChecklistData>(r.terimaDokJson, emptyTerima);
          const dokumenOs = safeJsonParse<ChecklistData>(r.dokumenOsJson, emptyOs);
          const billingItems = safeJsonParse<BillingItem[] | undefined>(
            r.billingItemsJson,
            undefined
          );
          const countDownRaw = (r.countDownEta || '').trim();
          const countDownEta =
            countDownRaw === '' || Number.isNaN(Number(countDownRaw))
              ? null
              : Number(countDownRaw);

          return {
            kodeOs: r.kodeOs.trim(),
            kodeManualDokOs: (r.kodeManualDokOs || '').trim(),
            ship: r.ship || '',
            kodeCustomer: r.kodeCustomer || '',
            namaCustomer: r.namaCustomer || '',
            tglTerimaDok: r.tglTerimaDok || '',
            terimaDok: {
              items: terimaDok?.items || emptyTerima.items,
              catatan: terimaDok?.catatan || '',
            },
            noPackinglist: r.noPackinglist || '',
            noBl: r.noBl || '',
            statusDokumen: (r.statusDokumen as Shipment['statusDokumen']) || 'Draft',
            etd: r.etd || '',
            eta: r.eta || '',
            countDownEta,
            noCont: r.noCont || '-',
            bc11Terbit: parseBoolCell(r.bc11Terbit, false),
            noBc11: r.noBc11 || '',
            tglBc11: r.tglBc11 || '',
            doPelayaranStatus: (r.doPelayaranStatus as Shipment['doPelayaranStatus']) || 'Belum',
            doBerlakuSampai: r.doBerlakuSampai || '',
            doCatatanPerpanjangan: r.doCatatanPerpanjangan || '',
            doGatePassStatus: (r.doGatePassStatus as Shipment['doGatePassStatus']) || 'Belum',
            doGatePassJenis: (r.doGatePassJenis as Shipment['doGatePassJenis']) || '',
            doGatePassNomor: r.doGatePassNomor || '',
            truckingStatus: (r.truckingStatus as Shipment['truckingStatus']) || 'Belum',
            truckingNamaSupir: r.truckingNamaSupir || '',
            truckingNoPlat: r.truckingNoPlat || '',
            truckingNoHpSupir: r.truckingNoHpSupir || '',
            gateOutStatus: (r.gateOutStatus as Shipment['gateOutStatus']) || 'Belum',
            gateOutTanggal: r.gateOutTanggal || '',
            gateOutCatatan: r.gateOutCatatan || '',
            suratJalanNomor: r.suratJalanNomor || '',
            suratJalanTanggal: r.suratJalanTanggal || '',
            suratJalanStatus: (r.suratJalanStatus as Shipment['suratJalanStatus']) || 'Belum',
            suratJalanTujuan: r.suratJalanTujuan || '',
            suratJalanPenerima: r.suratJalanPenerima || '',
            suratJalanCatatan: r.suratJalanCatatan || '',
            suratJalanUpdatedAt: r.suratJalanUpdatedAt || '',
            billingStatus: (r.billingStatus as Shipment['billingStatus']) || 'Belum',
            billingNomor: r.billingNomor || '',
            billingTanggal: r.billingTanggal || '',
            billingJatuhTempo: r.billingJatuhTempo || '',
            billingItems: Array.isArray(billingItems) && billingItems.length > 0 ? billingItems : undefined,
            billingPpnPersen: parseOptionalNum(r.billingPpnPersen),
            billingTotal: parseOptionalNum(r.billingTotal),
            billingCatatan: r.billingCatatan || '',
            billingOwnerNotifiedAt: r.billingOwnerNotifiedAt || '',
            billingOwnerNotifiedVia:
              (r.billingOwnerNotifiedVia as Shipment['billingOwnerNotifiedVia']) || '',
            billingOwnerNotifiedBy: r.billingOwnerNotifiedBy || '',
            billingCustomerSentAt: r.billingCustomerSentAt || '',
            billingCustomerSentVia:
              (r.billingCustomerSentVia as Shipment['billingCustomerSentVia']) || '',
            billingCreatedBy: r.billingCreatedBy || '',
            noAju: r.noAju || '',
            tglAju: r.tglAju || '',
            status: r.status || 'Dokumen Diterima',
            nopen: r.nopen || '',
            tglNopen: r.tglNopen || '',
            jalur: (r.jalur as JalurType) || '',
            kodeImportir: r.kodeImportir || '',
            shipper: r.shipper || '',
            description: r.description || '',
            negaraAsal: r.negaraAsal || '',
            currency: r.currency || 'USD',
            kurs: parseNumOrEmpty(r.kurs),
            invoice: parseNumOrEmpty(r.invoice),
            bmPdri: r.bmPdri || '',
            sptnp: r.sptnp || 'Tidak',
            noSppb: r.noSppb || '',
            tglSppb: r.tglSppb || '',
            dokumenChecker: r.dokumenChecker || '',
            noSptnp: r.noSptnp || '',
            tglSptnp: r.tglSptnp || '',
            pfpb: r.pfpb || '',
            tglPfpb: r.tglPfpb || '',
            pfpd: r.pfpd || '',
            tglPfpd: r.tglPfpd || '',
            eslah: r.eslah || '',
            tglEslah: r.tglEslah || '',
            dokumenOs: {
              items: dokumenOs?.items || emptyOs.items,
              catatan: dokumenOs?.catatan || '',
            },
            createdAt: r.createdAt || new Date().toISOString(),
            createdBy: r.createdBy || 'sheet-sync',
            updatedAt: r.updatedAt || new Date().toISOString(),
            updatedBy: r.updatedBy || 'sheet-sync',
          };
        })
    : fallbackDb.shipments;

  const customers: Customer[] = sheetsData.Master_Customer
    ? mapRowsByHeader(sheetsData.Master_Customer)
        .filter((r) => Boolean(r.kodeCustomer?.trim()))
        .map((r) => ({
          kodeCustomer: r.kodeCustomer.trim(),
          namaCustomer: r.namaCustomer || '',
          kontak: r.kontak || '',
        }))
    : fallbackDb.customers;

  const importirs: Importir[] = sheetsData.Master_Importir
    ? mapRowsByHeader(sheetsData.Master_Importir)
        .filter((r) => Boolean(r.kodeImportir?.trim()))
        .map((r) => ({
          kodeImportir: r.kodeImportir.trim(),
          namaImportir: r.namaImportir || '',
        }))
    : fallbackDb.importirs;

  const shippers: Shipper[] = sheetsData.Master_Shipper
    ? mapRowsByHeader(sheetsData.Master_Shipper)
        .filter((r) => Boolean(r.namaShipper?.trim()))
        .map((r) => ({
          namaShipper: r.namaShipper.trim(),
          negara: r.negara || '',
        }))
    : fallbackDb.shippers;

  const parsedUsersRaw = sheetsData.Users
    ? mapRowsByHeader(sheetsData.Users)
        .filter((r) => Boolean(r.username?.trim() && r.passwordHash?.trim()))
        .map((r) => {
          const role = (r.role?.trim() || 'Checker') as UserRole;
          const phasePermissions = safeJsonParse<PhasePermissions | undefined>(
            r.phasePermissionsJson,
            undefined
          );
          const modulePermissionsRaw = safeJsonParse<ModulePermissionsMap | undefined>(
            r.modulePermissionsJson,
            undefined
          );
          const modulePermissions =
            role === 'Owner' || !modulePermissionsRaw || Object.keys(modulePermissionsRaw).length === 0
              ? undefined
              : modulePermissionsRaw;
          return {
            username: r.username.trim(),
            passwordHash: r.passwordHash.trim(),
            salt: r.salt || '',
            nama: r.nama || r.username.trim(),
            role,
            aktif: parseBoolCell(r.aktif, true),
            mustChangePassword: parseBoolCell(r.mustChangePassword, false),
            phasePermissions: resolveUserPhasePermissions(role, phasePermissions),
            ...(modulePermissions ? { modulePermissions } : {}),
          } satisfies UserAccount;
        })
    : [];

  const users = parsedUsersRaw.length > 0 ? parsedUsersRaw : fallbackDb.users;

  const logs: LogPerubahan[] = sheetsData.Log_Perubahan
    ? mapRowsByHeader(sheetsData.Log_Perubahan)
        .filter((r) => Boolean(r.id?.trim() || r.kodeOs?.trim()))
        .map((r, idx) => ({
          id: r.id?.trim() || `log-sheet-${idx + 1}`,
          waktu: r.waktu || '',
          user: r.user || '',
          kodeOs: r.kodeOs || '',
          kolom: r.kolom || '',
          nilaiLama: r.nilaiLama || '',
          nilaiBaru: r.nilaiBaru || '',
        }))
    : fallbackDb.logs;

  const catatan: Catatan[] = sheetsData.Catatan
    ? mapRowsByHeader(sheetsData.Catatan)
        .filter((r) => Boolean(r.kodeOs?.trim() && r.isi?.trim()))
        .map((r, idx) => ({
          id: r.id?.trim() || `cat-sheet-${idx + 1}`,
          kodeOs: r.kodeOs.trim(),
          waktu: r.waktu || '',
          user: r.user || '',
          isi: r.isi || '',
        }))
    : fallbackDb.catatan;

  const dokumen: DokumenItem[] = sheetsData.Dokumen
    ? mapRowsByHeader(sheetsData.Dokumen)
        .filter((r) => Boolean(r.kodeOs?.trim() && r.namaFile?.trim()))
        .map((r, idx) => ({
          id: r.id?.trim() || `doc-sheet-${idx + 1}`,
          kodeOs: r.kodeOs.trim(),
          jenisDokumen: r.jenisDokumen || 'Dokumen Lainnya',
          namaFile: r.namaFile.trim(),
          linkDrive: r.linkDrive || '',
          waktuUpload: r.waktuUpload || '',
          user: r.user || '',
          driveFileId: r.driveFileId || undefined,
          driveFolderId: r.driveFolderId || undefined,
          source: (r.source as DokumenItem['source']) || undefined,
        }))
    : fallbackDb.dokumen;

  const pengeluaranOps: PengeluaranOpsItem[] = sheetsData.Pengeluaran_Ops
    ? mapRowsByHeader(sheetsData.Pengeluaran_Ops)
        .filter((r) => Boolean(r.kodePengeluaran?.trim() || r.keterangan?.trim()))
        .map((r, idx) => ({
          id: r.id?.trim() || `kop-sheet-${idx + 1}`,
          kodePengeluaran: r.kodePengeluaran?.trim() || `KOP-SHEET-${idx + 1}`,
          noTandaTerima: r.noTandaTerima?.trim() || '',
          kodeOs: r.kodeOs?.trim() || 'UMUM / NON-OS',
          noBl: r.noBl || '',
          namaCustomer: r.namaCustomer || '',
          tanggal: r.tanggal || '',
          kategori: (r.kategori as KategoriPengeluaranOps) || 'Lainnya',
          keterangan: r.keterangan || '',
          nominal: Number(r.nominal) || 0,
          metodePembayaran: (r.metodePembayaran as MetodePembayaranOps) || 'Kas Tunai',
          statusPengeluaran: (r.statusPengeluaran as StatusPengeluaranOps) || 'Sudah Dibayar',
          petugasOps: r.petugasOps || '',
          diberikanOleh: r.diberikanOleh || '',
          tandaTerimaAt: r.tandaTerimaAt || '',
          buktiNamaFile: r.buktiNamaFile || '',
          buktiMimeType: r.buktiMimeType || '',
          buktiDataUrl: r.buktiDataUrl || '',
          buktiLinkDrive: r.buktiLinkDrive || '',
          driveFileId: r.driveFileId || undefined,
          source: (r.source as PengeluaranOpsItem['source']) || undefined,
          catatanAudit: r.catatanAudit || '',
          createdAt: r.createdAt || new Date().toISOString(),
          createdBy: r.createdBy || 'sheet-sync',
          updatedAt: r.updatedAt || new Date().toISOString(),
          updatedBy: r.updatedBy || 'sheet-sync',
        }))
    : fallbackDb.pengeluaranOps || [];

  const reconciled = reconcileAllShipmentsDerivedState(
    parsedShipments,
    kontainers,
    pengaturan.seqByMonth
  );

  return {
    shipments: reconciled.shipments,
    kontainers,
    customers,
    importirs,
    shippers,
    users,
    logs,
    catatan,
    dokumen,
    pengeluaranOps,
    pengaturan: {
      ...pengaturan,
      seqByMonth: reconciled.seqByMonth,
    },
  };
}

export function computeSpreadsheetSyncDiffSummary(
  localDb: DatabaseState,
  remoteDb: DatabaseState
): SpreadsheetSyncDiffSummary {
  const localCounts = {
    shipments: localDb.shipments.length,
    kontainers: localDb.kontainers.length,
    customers: localDb.customers.length,
    importirs: localDb.importirs.length,
    shippers: localDb.shippers.length,
    users: localDb.users.length,
    dokumen: localDb.dokumen.length,
    catatan: localDb.catatan.length,
    pengeluaranOps: (localDb.pengeluaranOps || []).length,
  };
  const remoteCounts = {
    shipments: remoteDb.shipments.length,
    kontainers: remoteDb.kontainers.length,
    customers: remoteDb.customers.length,
    importirs: remoteDb.importirs.length,
    shippers: remoteDb.shippers.length,
    users: remoteDb.users.length,
    dokumen: remoteDb.dokumen.length,
    catatan: remoteDb.catatan.length,
    pengeluaranOps: (remoteDb.pengeluaranOps || []).length,
  };
  const sumObj = (o: Record<string, number>) =>
    Object.values(o).reduce((acc, n) => acc + n, 0);

  return {
    localCounts,
    remoteCounts,
    totalLocalRows: sumObj(localCounts),
    totalRemoteRows: sumObj(remoteCounts),
  };
}
