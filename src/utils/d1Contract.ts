/**
 * PTG PPJK Outstanding — Pure Cloudflare D1 Contract, Mappers, LWW Merge & Edge Reducers.
 *
 * Uses strictly erasable TypeScript syntax so Node v22 native TypeScript execution (`node server.ts`)
 * and Vite/tsc share a single source of truth without compilation friction.
 */

export interface D1ShipmentRecord {
  id: string;
  os_code: string;
  doc_os: string;
  importer_code: string;
  importer_name: string;
  customer_code: string;
  customer_name: string;
  bl_number: string;
  packing_list: string;
  aju_number: string;
  nopen: string;
  container_number: string;
  status: string;
  doc_status: string;
  jalur: string;
  checker_name: string;
  eta_date: string;
  etd_date: string;
  received_date: string;
  sppb_date: string;
  gate_out_date: string;
  bm_pdri_amount: number;
  is_urgent: number;
  notes: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export type D1ShipmentInput = Partial<D1ShipmentRecord> & {
  os_code: string;
};

export type D1SyncAction = 'upsert' | 'delete';

export interface D1SyncQueueItem {
  queue_id: string;
  action: D1SyncAction;
  shipment_id: string;
  os_code: string;
  payload: D1ShipmentRecord;
  queued_at: string;
  retry_count: number;
  last_error?: string;
}

export interface D1ShipmentFilter {
  q?: string;
  status?: string;
  importer_code?: string;
  since?: string;
  include_deleted?: boolean;
}

export interface D1ImporterSummaryRow {
  importer_code: string;
  importer_name: string;
  total_shipments: number;
  urgent_count: number;
  ready_count: number;
  outstanding_count: number;
  total_bm_pdri: number;
}

export const D1_STATUS_OPTIONS = [
  'Dokumen Diterima',
  'Proses PIB/AJU',
  'Menunggu Jalur',
  'Proses Pemeriksaan',
  'SPPB Terbit',
  'Pasca-SPPB',
  'Selesai',
] as const;

export const D1_DOC_STATUS_OPTIONS = ['Draft', 'Ready'] as const;

export const D1_JALUR_OPTIONS = ['', 'Hijau', 'Kuning', 'Merah', 'MITA'] as const;

export function buildDeterministicShipmentId(osCode: string): string {
  const clean = (osCode || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return clean ? `shp_${clean}` : `shp_${Date.now()}`;
}

export function cleanText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

export function cleanNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const raw = value.replace(/[^0-9,.-]/g, '').trim();
    if (!raw) return fallback;
    // Handle Indonesian currency formatting such as "45.000.000" or "45.000.000,50"
    if (/\d\.\d{3}/.test(raw) && !raw.includes(',')) {
      const normalized = Number(raw.replace(/\./g, ''));
      if (Number.isFinite(normalized)) return normalized;
    }
    const normalized = raw.includes(',') && raw.includes('.')
      ? Number(raw.replace(/\./g, '').replace(',', '.'))
      : Number(raw.replace(/,/g, '.'));
    if (Number.isFinite(normalized)) return normalized;
  }
  return fallback;
}

export function normalizeUrgentFlag(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value > 0 ? 1 : 0;
  if (typeof value === 'string') {
    const low = value.trim().toLowerCase();
    return low === '1' || low === 'true' || low === 'ya' || low === 'urgent' ? 1 : 0;
  }
  return 0;
}

export function normalizeD1ShipmentRecord(
  input: Partial<D1ShipmentRecord> & { os_code?: string },
  nowIso: string = new Date().toISOString()
): D1ShipmentRecord {
  const osCode = cleanText(input.os_code).toUpperCase();
  if (!osCode) {
    throw new Error('Kode OS (os_code) wajib diisi.');
  }
  const id = cleanText(input.id) || buildDeterministicShipmentId(osCode);
  const deletedAt =
    input.deleted_at === null || input.deleted_at === undefined || input.deleted_at === ''
      ? null
      : cleanText(input.deleted_at);

  return {
    id,
    os_code: osCode,
    doc_os: cleanText(input.doc_os),
    importer_code: cleanText(input.importer_code),
    importer_name: cleanText(input.importer_name),
    customer_code: cleanText(input.customer_code),
    customer_name: cleanText(input.customer_name),
    bl_number: cleanText(input.bl_number),
    packing_list: cleanText(input.packing_list),
    aju_number: cleanText(input.aju_number),
    nopen: cleanText(input.nopen),
    container_number: cleanText(input.container_number),
    status: cleanText(input.status, 'Dokumen Diterima') || 'Dokumen Diterima',
    doc_status: cleanText(input.doc_status) === 'Ready' ? 'Ready' : 'Draft',
    jalur: cleanText(input.jalur),
    checker_name: cleanText(input.checker_name),
    eta_date: cleanText(input.eta_date),
    etd_date: cleanText(input.etd_date),
    received_date: cleanText(input.received_date),
    sppb_date: cleanText(input.sppb_date),
    gate_out_date: cleanText(input.gate_out_date),
    bm_pdri_amount: cleanNumber(input.bm_pdri_amount, 0),
    is_urgent: normalizeUrgentFlag(input.is_urgent),
    notes: cleanText(input.notes),
    updated_at: cleanText(input.updated_at) || nowIso,
    deleted_at: deletedAt,
    version: Math.max(1, Math.floor(cleanNumber(input.version, 1))),
  };
}

/**
 * Last-Write-Wins (LWW) conflict resolver using `updated_at` ISO timestamp
 * (with `version` as tie-breaker when timestamps match identically).
 */
export function pickWinnerLww(
  localRow: D1ShipmentRecord | undefined,
  remoteRow: D1ShipmentRecord
): D1ShipmentRecord {
  if (!localRow) return remoteRow;
  const localTime = Date.parse(localRow.updated_at || '');
  const remoteTime = Date.parse(remoteRow.updated_at || '');

  if (Number.isFinite(remoteTime) && Number.isFinite(localTime)) {
    if (remoteTime > localTime) return remoteRow;
    if (localTime > remoteTime) return localRow;
  } else if (remoteRow.updated_at !== localRow.updated_at) {
    return remoteRow.updated_at > localRow.updated_at ? remoteRow : localRow;
  }

  return remoteRow.version >= localRow.version ? remoteRow : localRow;
}

export function mergeD1ShipmentsLww(
  localRows: D1ShipmentRecord[],
  remoteRows: D1ShipmentRecord[]
): D1ShipmentRecord[] {
  const byKey = new Map<string, D1ShipmentRecord>();

  for (const row of localRows) {
    const key = row.id || buildDeterministicShipmentId(row.os_code);
    byKey.set(key, row);
  }

  for (const remote of remoteRows) {
    const keyById = remote.id || buildDeterministicShipmentId(remote.os_code);
    const existingById = byKey.get(keyById);
    const existingByOs =
      existingById ||
      Array.from(byKey.values()).find(
        (item) => item.os_code.toUpperCase() === remote.os_code.toUpperCase()
      );
    const mapKey = existingByOs ? existingByOs.id : keyById;
    const winner = pickWinnerLww(existingByOs, remote);
    byKey.set(mapKey, winner);
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.is_urgent !== b.is_urgent) return b.is_urgent - a.is_urgent;
    return (b.updated_at || '').localeCompare(a.updated_at || '');
  });
}

export function filterD1Shipments(
  rows: D1ShipmentRecord[],
  filter: D1ShipmentFilter = {}
): D1ShipmentRecord[] {
  const q = cleanText(filter.q).toLowerCase();
  const statusFilter = cleanText(filter.status);
  const importerCode = cleanText(filter.importer_code).toLowerCase();
  const since = cleanText(filter.since);
  const includeDeleted = Boolean(filter.include_deleted);

  return rows.filter((row) => {
    if (since) {
      if ((row.updated_at || '') <= since) return false;
    } else if (!includeDeleted && row.deleted_at) {
      return false;
    }

    if (statusFilter && row.status !== statusFilter) {
      return false;
    }

    if (importerCode && row.importer_code.toLowerCase() !== importerCode) {
      return false;
    }

    if (q) {
      const hay = [
        row.os_code,
        row.doc_os,
        row.importer_code,
        row.importer_name,
        row.customer_code,
        row.customer_name,
        row.bl_number,
        row.packing_list,
        row.aju_number,
        row.nopen,
        row.container_number,
        row.checker_name,
        row.status,
        row.doc_status,
        row.jalur,
        row.notes,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

export function summarizeD1ByImporter(rows: D1ShipmentRecord[]): D1ImporterSummaryRow[] {
  const activeRows = rows.filter((r) => !r.deleted_at);
  const grouped = new Map<string, D1ImporterSummaryRow>();

  for (const row of activeRows) {
    const code = cleanText(row.importer_code) || 'NON-IMP';
    const name = cleanText(row.importer_name) || 'Importir Umum';
    const key = `${code.toUpperCase()}::${name.toUpperCase()}`;

    const entry = grouped.get(key) || {
      importer_code: code,
      importer_name: name,
      total_shipments: 0,
      urgent_count: 0,
      ready_count: 0,
      outstanding_count: 0,
      total_bm_pdri: 0,
    };

    entry.total_shipments += 1;
    if (row.is_urgent === 1) entry.urgent_count += 1;
    if (row.doc_status === 'Ready' || row.status === 'Selesai') {
      entry.ready_count += 1;
    }
    if (!row.sppb_date && row.status !== 'Selesai') {
      entry.outstanding_count += 1;
    }
    entry.total_bm_pdri += Number.isFinite(row.bm_pdri_amount) ? row.bm_pdri_amount : 0;

    grouped.set(key, entry);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.total_shipments !== a.total_shipments) {
      return b.total_shipments - a.total_shipments;
    }
    return a.importer_code.localeCompare(b.importer_code);
  });
}

export function upsertD1RecordsInList(
  current: D1ShipmentRecord[],
  incomingList: Array<Partial<D1ShipmentRecord> & { os_code: string }>,
  nowIso: string = new Date().toISOString()
): { next: D1ShipmentRecord[]; upserted: D1ShipmentRecord[] } {
  const byOs = new Map<string, D1ShipmentRecord>();
  for (const item of current) {
    byOs.set(item.os_code.toUpperCase(), item);
  }

  const upserted: D1ShipmentRecord[] = [];
  for (const raw of incomingList) {
    const osKey = cleanText(raw.os_code).toUpperCase();
    const existing = byOs.get(osKey);
    const normalized = normalizeD1ShipmentRecord(
      {
        ...existing,
        ...raw,
        id: cleanText(raw.id) || existing?.id || buildDeterministicShipmentId(osKey),
        os_code: osKey,
        updated_at: cleanText(raw.updated_at) || nowIso,
        version: existing ? Math.max(existing.version + 1, cleanNumber(raw.version, 1)) : Math.max(1, cleanNumber(raw.version, 1)),
      },
      nowIso
    );
    byOs.set(osKey, normalized);
    upserted.push(normalized);
  }

  return {
    next: Array.from(byOs.values()).sort((a, b) =>
      (b.updated_at || '').localeCompare(a.updated_at || '')
    ),
    upserted,
  };
}

export function patchD1RecordInList(
  current: D1ShipmentRecord[],
  targetIdOrOs: string,
  patch: Partial<D1ShipmentRecord>,
  nowIso: string = new Date().toISOString()
): { next: D1ShipmentRecord[]; updated: D1ShipmentRecord | null } {
  const cleanTarget = targetIdOrOs.trim();
  let updated: D1ShipmentRecord | null = null;

  const next = current.map((item) => {
    if (item.id !== cleanTarget && item.os_code.toUpperCase() !== cleanTarget.toUpperCase()) {
      return item;
    }
    const merged = normalizeD1ShipmentRecord(
      {
        ...item,
        ...patch,
        id: item.id,
        os_code: cleanText(patch.os_code, item.os_code) || item.os_code,
        updated_at: cleanText(patch.updated_at) || nowIso,
        version: item.version + 1,
      },
      nowIso
    );
    updated = merged;
    return merged;
  });

  return { next, updated };
}

export function softDeleteD1RecordInList(
  current: D1ShipmentRecord[],
  targetIdOrOs: string,
  nowIso: string = new Date().toISOString()
): { next: D1ShipmentRecord[]; deleted: D1ShipmentRecord | null } {
  const res = patchD1RecordInList(
    current,
    targetIdOrOs,
    { deleted_at: nowIso, updated_at: nowIso },
    nowIso
  );
  return { next: res.next, deleted: res.updated };
}

export function generateD1QueryUrl(
  basePath: string,
  filter: D1ShipmentFilter = {}
): string {
  const params = new URLSearchParams();
  if (filter.q?.trim()) params.set('q', filter.q.trim());
  if (filter.status?.trim()) params.set('status', filter.status.trim());
  if (filter.importer_code?.trim()) params.set('importer_code', filter.importer_code.trim());
  if (filter.since?.trim()) params.set('since', filter.since.trim());
  if (filter.include_deleted) params.set('include_deleted', '1');
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function getInitialSeedD1Shipments(): D1ShipmentRecord[] {
  return [
    {
      id: 'shp_os-2611-0001',
      os_code: 'OS-2611-0001',
      doc_os: 'TN-196',
      importer_code: 'IMP-001',
      importer_name: 'PT Nusantara Elektrindo',
      customer_code: 'CUST-001',
      customer_name: 'PT Maju Jaya Elektronik',
      bl_number: 'EGLV1429801122',
      packing_list: 'PL-2611-001',
      aju_number: '000010-261101',
      nopen: '448120',
      container_number: 'EGHU1234567 (40HC)',
      status: 'Proses Pemeriksaan',
      doc_status: 'Ready',
      jalur: 'Merah',
      checker_name: 'Budi Santoso',
      eta_date: '2026-11-18',
      etd_date: '2026-11-08',
      received_date: '2026-11-10',
      sppb_date: '',
      gate_out_date: '',
      bm_pdri_amount: 142500000,
      is_urgent: 1,
      notes: 'Menunggu jadwal behandle fisik TPS Koja',
      updated_at: '2026-11-17T08:30:00.000Z',
      deleted_at: null,
      version: 2,
    },
    {
      id: 'shp_os-2611-0002',
      os_code: 'OS-2611-0002',
      doc_os: 'TN-197',
      importer_code: 'IMP-002',
      importer_name: 'PT Indo Mesin Industri',
      customer_code: 'CUST-002',
      customer_name: 'PT Cahaya Nusantara',
      bl_number: 'COSU6391820411',
      packing_list: 'PL-2611-002',
      aju_number: '000010-261102',
      nopen: '448215',
      container_number: 'CSNU7712340 (40HC)',
      status: 'SPPB Terbit',
      doc_status: 'Ready',
      jalur: 'Hijau',
      checker_name: 'Rina Kusuma',
      eta_date: '2026-11-16',
      etd_date: '2026-11-05',
      received_date: '2026-11-09',
      sppb_date: '2026-11-16',
      gate_out_date: '',
      bm_pdri_amount: 96400000,
      is_urgent: 0,
      notes: 'SPPB terbit, koordinasi D/O & trucking ke Cikarang',
      updated_at: '2026-11-16T14:20:00.000Z',
      deleted_at: null,
      version: 3,
    },
    {
      id: 'shp_os-2611-0003',
      os_code: 'OS-2611-0003',
      doc_os: 'TN-198',
      importer_code: 'IMP-001',
      importer_name: 'PT Nusantara Elektrindo',
      customer_code: 'CUST-003',
      customer_name: 'PT Sinar Logistik Mandiri',
      bl_number: 'MSCU8841209551',
      packing_list: 'PL-2611-003',
      aju_number: '',
      nopen: '',
      container_number: 'MSCU5581203 (20FT)',
      status: 'Dokumen Diterima',
      doc_status: 'Draft',
      jalur: '',
      checker_name: 'Budi Santoso',
      eta_date: '2026-11-19',
      etd_date: '2026-11-11',
      received_date: '2026-11-15',
      sppb_date: '',
      gate_out_date: '',
      bm_pdri_amount: 48300000,
      is_urgent: 1,
      notes: 'Segera draft PIB sebelum kapal sandar JICT',
      updated_at: '2026-11-17T09:15:00.000Z',
      deleted_at: null,
      version: 1,
    },
    {
      id: 'shp_os-2611-0004',
      os_code: 'OS-2611-0004',
      doc_os: 'TN-199',
      importer_code: 'IMP-003',
      importer_name: 'CV Prima Kimia Sejahtera',
      customer_code: 'CUST-004',
      customer_name: 'PT Graha Medika Utama',
      bl_number: 'OOCL4419203812',
      packing_list: 'PL-2611-004',
      aju_number: '000010-261104',
      nopen: '448301',
      container_number: 'OOLU9182734 (40HC)',
      status: 'Selesai',
      doc_status: 'Ready',
      jalur: 'MITA',
      checker_name: 'Dewi Lestari',
      eta_date: '2026-11-12',
      etd_date: '2026-11-02',
      received_date: '2026-11-06',
      sppb_date: '2026-11-12',
      gate_out_date: '2026-11-13',
      bm_pdri_amount: 118400000,
      is_urgent: 0,
      notes: 'Kontainer sudah gate-out & dokumen OS lengkap',
      updated_at: '2026-11-14T16:45:00.000Z',
      deleted_at: null,
      version: 4,
    },
    {
      id: 'shp_os-2611-0005',
      os_code: 'OS-2611-0005',
      doc_os: 'TN-200',
      importer_code: 'IMP-002',
      importer_name: 'PT Indo Mesin Industri',
      customer_code: 'CUST-001',
      customer_name: 'PT Maju Jaya Elektronik',
      bl_number: 'MAEU9912304118',
      packing_list: 'PL-2611-005',
      aju_number: '000010-261105',
      nopen: '448409',
      container_number: 'MSKU3019284 (40HC)',
      status: 'Menunggu Jalur',
      doc_status: 'Ready',
      jalur: 'Kuning',
      checker_name: 'Rina Kusuma',
      eta_date: '2026-11-20',
      etd_date: '2026-11-10',
      received_date: '2026-11-14',
      sppb_date: '',
      gate_out_date: '',
      bm_pdri_amount: 63900000,
      is_urgent: 0,
      notes: 'Konfirmasi respon jalur kuning & kelengkapan COO',
      updated_at: '2026-11-17T06:50:00.000Z',
      deleted_at: null,
      version: 2,
    },
  ];
}
