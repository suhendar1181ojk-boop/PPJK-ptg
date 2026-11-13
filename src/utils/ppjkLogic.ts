import type {
  CheckerSummary,
  ChecklistData,
  DashboardStats,
  GlobalStatusSummary,
  JalurType,
  KontainerItem,
  Pengaturan,
  PhasePermissions,
  Shipment,
  ShipmentPhase,
  UserRole,
} from '../types/ppjk';

export const DEFAULT_STATUS_LIST = [
  'Dokumen Diterima',
  'Proses PIB/AJU',
  'Menunggu Jalur',
  'Proses Pemeriksaan',
  'SPPB Terbit',
  'Pasca-SPPB',
  'Selesai',
];

export const DEFAULT_JALUR_LIST: JalurType[] = ['Hijau', 'Kuning', 'Merah', 'MITA'];

export const DEFAULT_CHECKLIST_ITEMS = [
  'Bill of Lading (BL)',
  'Commercial Invoice',
  'Packing List',
  'Certificate of Origin (COO/SKA)',
  'Asuransi / Polis',
  'Surat Kuasa & PIB Draft',
];

export const DEFAULT_PENGATURAN: Pengaturan = {
  seqByMonth: {},
  driveParentFolderId: 'PTG_PPJK_DOKUMEN_ROOT',
  statusList: [...DEFAULT_STATUS_LIST],
  jalurList: [...DEFAULT_JALUR_LIST],
  checklistItems: [...DEFAULT_CHECKLIST_ITEMS],
  notificationEmails: ['operasional@ptg-ppjk.co.id', 'dokumen@ptg-ppjk.co.id'],
};

/**
 * Menghitung selisih hari antara ETA dan tanggal hari ini (YYYY-MM-DD).
 * Positif = masih tersisa N hari, 0 = hari ini, Negatif = lewat ETA.
 */
export function calculateCountdownEta(
  etaStr: string,
  referenceDate: Date = new Date()
): number | null {
  if (!etaStr || !/^\d{4}-\d{2}-\d{2}$/.test(etaStr.trim())) {
    return null;
  }
  const [y, m, d] = etaStr.trim().split('-').map(Number);
  const etaUtc = Date.UTC(y, m - 1, d);
  const refUtc = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  return Math.round((etaUtc - refUtc) / 86400000);
}

/**
 * Mengembalikan metadata badge warna untuk Count Down ETA sesuai spesifikasi:
 * Hijau (>7 hari), Kuning (4-7 hari), Oranye (0-3 hari), Merah (<0 / lewat ETA)
 */
export function getCountdownBadgeMeta(days: number | null): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  if (days === null || Number.isNaN(days)) {
    return {
      label: 'Belum diatur',
      bgClass: 'bg-slate-100',
      textClass: 'text-slate-600',
      borderClass: 'border-slate-200',
    };
  }
  if (days > 7) {
    return {
      label: `${days} hari`,
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
      borderClass: 'border-emerald-200',
    };
  }
  if (days >= 4) {
    return {
      label: `${days} hari`,
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-700',
      borderClass: 'border-amber-200',
    };
  }
  if (days >= 0) {
    return {
      label: days === 0 ? 'Hari ini (0h)' : `${days} hari`,
      bgClass: 'bg-orange-50',
      textClass: 'text-orange-700',
      borderClass: 'border-orange-200',
    };
  }
  return {
    label: `Lewat ${Math.abs(days)}h`,
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
    borderClass: 'border-red-200',
  };
}

export function getJalurBadgeStyle(jalur: JalurType | string): {
  label: string;
  hex: string;
  bgClass: string;
  textClass: string;
} {
  switch (jalur) {
    case 'Hijau':
      return {
        label: 'Hijau',
        hex: '#2E9E5B',
        bgClass: 'bg-[#2E9E5B]/12 border-[#2E9E5B]/30',
        textClass: 'text-[#1F7A43]',
      };
    case 'Kuning':
      return {
        label: 'Kuning',
        hex: '#F2C037',
        bgClass: 'bg-[#F2C037]/18 border-[#F2C037]/45',
        textClass: 'text-[#8F6800]',
      };
    case 'Merah':
      return {
        label: 'Merah',
        hex: '#D64545',
        bgClass: 'bg-[#D64545]/12 border-[#D64545]/30',
        textClass: 'text-[#B52F2F]',
      };
    case 'MITA':
      return {
        label: 'MITA',
        hex: '#3B82F6',
        bgClass: 'bg-[#3B82F6]/12 border-[#3B82F6]/30',
        textClass: 'text-[#1D4ED8]',
      };
    default:
      return {
        label: 'Belum Ada',
        hex: '#94A3B8',
        bgClass: 'bg-slate-100 border-slate-200',
        textClass: 'text-slate-600',
      };
  }
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Dokumen Diterima':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'Proses PIB/AJU':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'Menunggu Jalur':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Proses Pemeriksaan':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'SPPB Terbit':
      return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'Pasca-SPPB':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Selesai':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

/**
 * Menentukan apakah shipment masih Outstanding:
 * - Status bukan 'Selesai'
 * - ATAU belum ada No. SPPB / Tgl SPPB
 * - ATAU ada dokumen OS wajib yang belum lengkap
 */
export function isShipmentOutstanding(
  shipment: Shipment,
  checklistItems: string[] = DEFAULT_CHECKLIST_ITEMS
): boolean {
  if (shipment.status === 'Selesai') {
    const hasSppb = Boolean(shipment.noSppb?.trim() && shipment.tglSppb?.trim());
    const allOsComplete = checklistItems.every(
      (item) => Boolean(shipment.dokumenOs?.items?.[item])
    );
    return !(hasSppb && allOsComplete);
  }
  const hasSppb = Boolean(shipment.noSppb?.trim() && shipment.tglSppb?.trim());
  if (!hasSppb) return true;
  const allOsComplete = checklistItems.every(
    (item) => Boolean(shipment.dokumenOs?.items?.[item])
  );
  if (!allOsComplete) return true;
  // Jika ada SPTNP / PFPB / PFPD / ESLAH tapi status belum Selesai
  return true;
}

/**
 * Peringatan visual: ETA kurang dari 3 hari (<= 3 atau terlewat) tanpa No. AJU
 */
export function isUrgentMissingAju(
  shipment: Shipment,
  referenceDate: Date = new Date()
): boolean {
  if (shipment.status === 'Selesai') return false;
  if (shipment.noAju && shipment.noAju.trim() !== '') return false;
  const countdown = calculateCountdownEta(shipment.eta, referenceDate);
  if (countdown === null) return false;
  return countdown < 3;
}

/**
 * Generator Kode OS berformat OS-YYMM-NNNN (reset tiap bulan).
 */
export function generateNextKodeOS(
  seqByMonth: Record<string, number>,
  now: Date = new Date()
): { kodeOs: string; monthKey: string; nextSeq: number } {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const monthKey = `${yy}${mm}`;
  const current = seqByMonth[monthKey] || 0;
  const nextSeq = current + 1;
  const kodeOs = `OS-${monthKey}-${String(nextSeq).padStart(4, '0')}`;
  return { kodeOs, monthKey, nextSeq };
}

/**
 * Ringkasan daftar kontainer menjadi satu string untuk kolom No. Cont di tabel
 */
export function formatContainerSummary(containers: KontainerItem[]): string {
  const valid = containers.filter((c) => c.noCont.trim() !== '');
  if (valid.length === 0) return '-';
  return valid
    .map((c) => (c.ukuranTipe ? `${c.noCont.trim()} (${c.ukuranTipe.trim()})` : c.noCont.trim()))
    .join(', ');
}

export function createEmptyChecklist(
  items: string[] = DEFAULT_CHECKLIST_ITEMS
): ChecklistData {
  const map: Record<string, boolean> = {};
  for (const item of items) {
    map[item] = false;
  }
  return { items: map, catatan: '' };
}

export function formatChecklistProgress(
  data: ChecklistData | undefined,
  checklistItems: string[] = DEFAULT_CHECKLIST_ITEMS
): { checked: number; total: number } {
  const total = checklistItems.length;
  if (!data || !data.items) return { checked: 0, total };
  const checked = checklistItems.filter((item) => Boolean(data.items[item])).length;
  return { checked, total };
}

/**
 * Validasi input Shipment sesuai ketentuan teknis
 */
export function validateShipmentInput(
  data: Partial<Shipment>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data.kodeCustomer || !data.kodeCustomer.trim()) {
    errors.kodeCustomer = 'Kode Customer wajib diisi.';
  }
  if (!data.noBl || !data.noBl.trim()) {
    errors.noBl = 'No. BL wajib diisi.';
  }
  if (!data.eta || !data.eta.trim()) {
    errors.eta = 'Tanggal ETA wajib diisi.';
  }

  const dateFields: Array<{ key: keyof Shipment; label: string }> = [
    { key: 'tglTerimaDok', label: 'Tgl. Terima Dok' },
    { key: 'etd', label: 'ETD' },
    { key: 'eta', label: 'ETA' },
    { key: 'tglAju', label: 'Tgl. AJU' },
    { key: 'tglNopen', label: 'Tgl. NOPEN' },
    { key: 'tglSppb', label: 'Tgl. SPPB' },
    { key: 'tglSptnp', label: 'Tgl. SPTNP' },
    { key: 'tglPfpb', label: 'Tgl. PFPB' },
    { key: 'tglPfpd', label: 'Tgl. PFPD' },
    { key: 'tglEslah', label: 'Tgl. ESLAH' },
  ];

  for (const f of dateFields) {
    const val = data[f.key];
    if (typeof val === 'string' && val.trim() !== '') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
        errors[f.key] = `Format ${f.label} harus YYYY-MM-DD.`;
      }
    }
  }

  if (
    data.etd &&
    data.eta &&
    /^\d{4}-\d{2}-\d{2}$/.test(data.etd) &&
    /^\d{4}-\d{2}-\d{2}$/.test(data.eta)
  ) {
    if (data.eta < data.etd) {
      errors.eta = 'ETA tidak boleh lebih awal dari ETD.';
    }
  }

  if (data.kurs !== '' && data.kurs !== undefined && data.kurs !== null) {
    const num = Number(data.kurs);
    if (Number.isNaN(num) || num < 0) {
      errors.kurs = 'Kurs harus berupa angka valid (>= 0).';
    }
  }

  if (data.invoice !== '' && data.invoice !== undefined && data.invoice !== null) {
    const num = Number(data.invoice);
    if (Number.isNaN(num) || num < 0) {
      errors.invoice = 'Nilai Invoice harus berupa angka valid (>= 0).';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export const CHECKER_ALLOWED_FIELDS: Array<keyof Shipment> = [
  'ship', // keep read-only? No, checker Phase 1 & 4 + status
  'kodeCustomer',
  'namaCustomer',
  'tglTerimaDok',
  'terimaDok',
  'noPackinglist',
  'noBl',
  'dokumenChecker',
  'status',
  'noSptnp',
  'tglSptnp',
  'pfpb',
  'tglPfpb',
  'pfpd',
  'tglPfpd',
  'eslah',
  'tglEslah',
  'dokumenOs',
].filter((f) => f !== 'ship') as Array<keyof Shipment>;

export const DRAFTER_ALLOWED_FIELDS: Array<keyof Shipment> = [
  'ship',
  'etd',
  'eta',
  'noCont',
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
];

export const ROLE_LIMITS_INFO: Record<
  'Admin' | 'Checker' | 'Drafter' | 'Operasional' | 'Manajer',
  { title: string; summary: string; restrictions: string }
> = {
  Admin: {
    title: 'Admin (Akses Penuh)',
    summary: 'CRUD seluruh fase (1–4), hapus shipment, master data, manajemen user & pengaturan sistem.',
    restrictions: 'Tidak ada batasan fitur.',
  },
  Checker: {
    title: 'Checker (Dokumen & Pasca-SPPB)',
    summary: 'Buat shipment baru, edit Fase 1 (Dokumen) & Fase 4 (Pasca-SPPB/OS + Status), upload scan, catatan, master data.',
    restrictions: 'Fase 2 (Pelayaran) & Fase 3 (Customs) terkunci; tidak bisa hapus shipment, kelola user, atau pengaturan sistem.',
  },
  Drafter: {
    title: 'Drafter (PIB / Pelayaran & Customs)',
    summary: 'Edit Fase 2 (Pelayaran/Kontainer) & Fase 3 (AJU, NOPEN, Jalur, Nilai, SPPB, Status), upload scan, catatan.',
    restrictions: 'Tidak bisa buat/hapus shipment, Fase 1 & 4 terkunci; tidak bisa kelola master data, user, atau pengaturan.',
  },
  Operasional: {
    title: 'Operasional (Lapangan & Customs)',
    summary: 'Edit Fase 2 (Pelayaran) & Fase 3 (Customs), upload scan dokumen, dan tambah catatan.',
    restrictions: 'Tidak bisa buat/hapus shipment, Fase 1 & 4 terkunci; tidak bisa kelola master data, user, atau pengaturan.',
  },
  Manajer: {
    title: 'Manajer (Lihat & Ekspor)',
    summary: 'Pantau Dashboard, Rekap Checker, Outstanding, detail 39 kolom, serta ekspor Excel/CSV/PDF & Cetak.',
    restrictions: 'Mode baca saja (read-only): tidak bisa buat, edit, hapus shipment, upload dokumen, atau tambah catatan.',
  },
};

export function isCheckerRole(role: UserRole): boolean {
  return role === 'Checker' || role === 'Dokumen/Checker';
}

export function isDrafterOrOpsRole(role: UserRole): boolean {
  return role === 'Drafter' || role === 'Operasional';
}

/**
 * RBAC Matrix (konsisten dengan Code.gs)
 */
export function canPerformAction(
  role: UserRole,
  action:
    | 'create_shipment'
    | 'edit_shipment'
    | 'delete_shipment'
    | 'upload_dokumen'
    | 'add_catatan'
    | 'manage_master'
    | 'manage_users'
    | 'manage_settings'
    | 'view_gas_code'
    | 'export_report'
): boolean {
  switch (action) {
    case 'create_shipment':
      return role === 'Admin' || isCheckerRole(role);
    case 'delete_shipment':
      return role === 'Admin';
    case 'edit_shipment':
      return role === 'Admin' || isCheckerRole(role) || isDrafterOrOpsRole(role);
    case 'upload_dokumen':
    case 'add_catatan':
      return role === 'Admin' || isCheckerRole(role) || isDrafterOrOpsRole(role);
    case 'manage_master':
      return role === 'Admin' || isCheckerRole(role);
    case 'manage_users':
    case 'manage_settings':
    case 'view_gas_code':
      return role === 'Admin';
    case 'export_report':
      return true;
    default:
      return false;
  }
}

export const PHASE_1_FIELDS: Array<keyof Shipment> = [
  'kodeCustomer',
  'namaCustomer',
  'tglTerimaDok',
  'terimaDok',
  'noPackinglist',
  'noBl',
  'dokumenChecker',
];

export const PHASE_2_FIELDS: Array<keyof Shipment> = [
  'ship',
  'etd',
  'eta',
  'noCont',
];

export const PHASE_3_FIELDS: Array<keyof Shipment> = [
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
];

export const PHASE_4_FIELDS: Array<keyof Shipment> = [
  'status',
  'noSptnp',
  'tglSptnp',
  'pfpb',
  'tglPfpb',
  'pfpd',
  'tglPfpd',
  'eslah',
  'tglEslah',
  'dokumenOs',
];

export const PHASE_META: Array<{
  id: ShipmentPhase;
  key: keyof PhasePermissions;
  shortLabel: string;
  label: string;
}> = [
  { id: 1, key: 'phase1', shortLabel: 'F1', label: '1. Dokumen' },
  { id: 2, key: 'phase2', shortLabel: 'F2', label: '2. Pelayaran' },
  { id: 3, key: 'phase3', shortLabel: 'F3', label: '3. Customs' },
  { id: 4, key: 'phase4', shortLabel: 'F4', label: '4. Pasca-SPPB' },
];

export function getDefaultPhasePermissions(role: UserRole): PhasePermissions {
  if (role === 'Admin') {
    return { phase1: true, phase2: true, phase3: true, phase4: true };
  }
  if (isCheckerRole(role)) {
    return { phase1: true, phase2: false, phase3: false, phase4: true };
  }
  if (isDrafterOrOpsRole(role)) {
    return { phase1: false, phase2: true, phase3: true, phase4: false };
  }
  return { phase1: false, phase2: false, phase3: false, phase4: false };
}

export function resolveUserPhasePermissions(
  role: UserRole,
  custom?: Partial<PhasePermissions> | null
): PhasePermissions {
  const defaults = getDefaultPhasePermissions(role);
  if (!custom) return defaults;
  return {
    phase1: typeof custom.phase1 === 'boolean' ? custom.phase1 : defaults.phase1,
    phase2: typeof custom.phase2 === 'boolean' ? custom.phase2 : defaults.phase2,
    phase3: typeof custom.phase3 === 'boolean' ? custom.phase3 : defaults.phase3,
    phase4: typeof custom.phase4 === 'boolean' ? custom.phase4 : defaults.phase4,
  };
}

export function arePhasePermissionsEqual(
  a: PhasePermissions,
  b: PhasePermissions
): boolean {
  return (
    a.phase1 === b.phase1 &&
    a.phase2 === b.phase2 &&
    a.phase3 === b.phase3 &&
    a.phase4 === b.phase4
  );
}

export function canUserEditPhase(
  user: { role: UserRole; phasePermissions?: Partial<PhasePermissions> | null },
  phase: ShipmentPhase
): boolean {
  const resolved = resolveUserPhasePermissions(user.role, user.phasePermissions);
  return resolved[`phase${phase}`];
}

export function canUserEditAnyPhase(
  user: { role: UserRole; phasePermissions?: Partial<PhasePermissions> | null }
): boolean {
  const resolved = resolveUserPhasePermissions(user.role, user.phasePermissions);
  return resolved.phase1 || resolved.phase2 || resolved.phase3 || resolved.phase4;
}

export function getAllowedFieldsForPermissions(
  perms: PhasePermissions
): Array<keyof Shipment> {
  const set = new Set<keyof Shipment>();
  if (perms.phase1) PHASE_1_FIELDS.forEach((f) => set.add(f));
  if (perms.phase2) PHASE_2_FIELDS.forEach((f) => set.add(f));
  if (perms.phase3) PHASE_3_FIELDS.forEach((f) => set.add(f));
  if (perms.phase4) PHASE_4_FIELDS.forEach((f) => set.add(f));
  return Array.from(set);
}

export function canEditPhase(role: UserRole, phase: ShipmentPhase): boolean {
  return getDefaultPhasePermissions(role)[`phase${phase}`];
}

/**
 * Agregasi statistik Dashboard
 */
export function computeDashboardStats(
  shipments: Shipment[],
  checklistItems: string[] = DEFAULT_CHECKLIST_ITEMS,
  referenceDate: Date = new Date()
): DashboardStats {
  const byStatus: Record<string, number> = {};
  const byJalur: Record<string, number> = {
    Hijau: 0,
    Kuning: 0,
    Merah: 0,
    MITA: 0,
    'Belum Ada': 0,
  };
  const monthMap: Record<string, number> = {};
  const customerMap: Record<string, number> = {};

  let outstanding = 0;
  let etaNext7Days = 0;
  let urgentMissingAju = 0;

  for (const s of shipments) {
    const st = s.status || 'Dokumen Diterima';
    byStatus[st] = (byStatus[st] || 0) + 1;

    const jl = s.jalur || 'Belum Ada';
    byJalur[jl] = (byJalur[jl] || 0) + 1;

    if (isShipmentOutstanding(s, checklistItems)) {
      outstanding++;
    }

    const cd = calculateCountdownEta(s.eta, referenceDate);
    if (cd !== null && cd >= 0 && cd <= 7 && s.status !== 'Selesai') {
      etaNext7Days++;
    }

    if (isUrgentMissingAju(s, referenceDate)) {
      urgentMissingAju++;
    }

    const monthKey = s.eta
      ? s.eta.slice(0, 7)
      : s.tglTerimaDok
      ? s.tglTerimaDok.slice(0, 7)
      : s.createdAt.slice(0, 7);
    if (monthKey) {
      monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
    }

    const custName = s.namaCustomer || s.kodeCustomer || 'Lainnya';
    customerMap[custName] = (customerMap[custName] || 0) + 1;
  }

  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, count]) => ({ month, count }));

  const byCustomer = Object.entries(customerMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([customer, count]) => ({ customer, count }));

  return {
    total: shipments.length,
    outstanding,
    etaNext7Days,
    urgentMissingAju,
    byStatus,
    byJalur,
    byMonth,
    byCustomer,
  };
}

/**
 * Agregasi rekapan summary semua status pada semua dokumen & kartu per Dokumen Checker
 */
export function computeCheckerSummaries(
  shipments: Shipment[],
  statusList: string[] = DEFAULT_STATUS_LIST,
  checklistItems: string[] = DEFAULT_CHECKLIST_ITEMS,
  referenceDate: Date = new Date()
): GlobalStatusSummary {
  const orderedStatuses = [...statusList];
  for (const s of shipments) {
    const st = (s.status || '').trim() || 'Dokumen Diterima';
    if (!orderedStatuses.includes(st)) {
      orderedStatuses.push(st);
    }
  }

  const globalStatusCounts: Record<string, number> = {};
  for (const st of orderedStatuses) {
    globalStatusCounts[st] = 0;
  }

  const globalJalurCounts: Record<string, number> = {
    Hijau: 0,
    Kuning: 0,
    Merah: 0,
    MITA: 0,
    'Belum Ada': 0,
  };

  let totalOutstanding = 0;
  let totalUrgent = 0;

  const grouped: Record<string, Shipment[]> = {};

  for (const s of shipments) {
    const st = (s.status || '').trim() || 'Dokumen Diterima';
    globalStatusCounts[st] = (globalStatusCounts[st] || 0) + 1;

    const jl = s.jalur || 'Belum Ada';
    globalJalurCounts[jl] = (globalJalurCounts[jl] || 0) + 1;

    if (isShipmentOutstanding(s, checklistItems)) {
      totalOutstanding++;
    }
    if (isUrgentMissingAju(s, referenceDate)) {
      totalUrgent++;
    }

    const checkerKey = (s.dokumenChecker || '').trim() || 'Belum Ditugaskan';
    if (!grouped[checkerKey]) grouped[checkerKey] = [];
    grouped[checkerKey].push(s);
  }

  const totalDocuments = shipments.length;
  const totalCompleted = totalDocuments - totalOutstanding;

  const byStatus = orderedStatuses.map((status) => {
    const count = globalStatusCounts[status] || 0;
    const percentage = totalDocuments > 0 ? Math.round((count / totalDocuments) * 100) : 0;
    return { status, count, percentage };
  });

  const checkers: CheckerSummary[] = Object.entries(grouped).map(([checkerName, list]) => {
    const cStatus: Record<string, number> = {};
    for (const st of orderedStatuses) {
      cStatus[st] = 0;
    }
    const cJalur: Record<string, number> = {
      Hijau: 0,
      Kuning: 0,
      Merah: 0,
      MITA: 0,
      'Belum Ada': 0,
    };

    let outstanding = 0;
    let urgentMissingAju = 0;
    let etaNext7Days = 0;

    for (const s of list) {
      const st = (s.status || '').trim() || 'Dokumen Diterima';
      cStatus[st] = (cStatus[st] || 0) + 1;

      const jl = s.jalur || 'Belum Ada';
      cJalur[jl] = (cJalur[jl] || 0) + 1;

      if (isShipmentOutstanding(s, checklistItems)) {
        outstanding++;
      }
      if (isUrgentMissingAju(s, referenceDate)) {
        urgentMissingAju++;
      }
      const cd = calculateCountdownEta(s.eta, referenceDate);
      if (cd !== null && cd >= 0 && cd <= 7 && s.status !== 'Selesai') {
        etaNext7Days++;
      }
    }

    const total = list.length;
    const completed = total - outstanding;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const sortedShipments = [...list].sort((a, b) => b.kodeOs.localeCompare(a.kodeOs));

    return {
      checkerName,
      total,
      outstanding,
      completed,
      urgentMissingAju,
      etaNext7Days,
      completionRate,
      byStatus: cStatus,
      byJalur: cJalur,
      shipments: sortedShipments,
    };
  });

  checkers.sort((a, b) => {
    if (a.checkerName === 'Belum Ditugaskan' && b.checkerName !== 'Belum Ditugaskan') return 1;
    if (b.checkerName === 'Belum Ditugaskan' && a.checkerName !== 'Belum Ditugaskan') return -1;
    if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding;
    if (b.total !== a.total) return b.total - a.total;
    return a.checkerName.localeCompare(b.checkerName);
  });

  return {
    totalDocuments,
    totalOutstanding,
    totalCompleted,
    totalUrgent,
    totalCheckers: checkers.filter((c) => c.checkerName !== 'Belum Ditugaskan').length,
    byStatus,
    byJalur: globalJalurCounts,
    checkers,
  };
}

/**
 * Menghitung SHA-256 hex digest (kompatibel di browser WebCrypto & Node crypto)
 */
export async function computeSha256Hex(input: string): Promise<string> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(input).digest('hex');
}
