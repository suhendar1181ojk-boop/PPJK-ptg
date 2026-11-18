import type {
  AppView,
  BillingItem,
  BillingSummary,
  CheckerSummary,
  ChecklistData,
  Customer,
  DashboardStats,
  DoReadinessSummary,
  GatePassJenisType,
  GlobalStatusSummary,
  Importir,
  ImportirGlobalSummary,
  ImportirSummaryItem,
  JalurType,
  KontainerItem,
  LogPerubahan,
  ModulePermissionsMap,
  NopenDailyRecapItem,
  NopenImportirRecapItem,
  NopenRecapCriteria,
  NopenRecapSummary,
  Pengaturan,
  PhasePermissions,
  RoleModuleAccessMap,
  Shipment,
  ShipmentDateFilterField,
  ShipmentPhase,
  StatusDokumenType,
  StatusDoPelayaranType,
  StatusGateOutType,
  StatusGatePassType,
  StatusPenagihanType,
  StatusSuratJalanType,
  UserAccount,
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
  ppjkBrandName: 'PTG PPJK',
  ppjkCompanyName: 'PT PTG Logistik Kepabeanan',
  ppjkTagline: 'Customs & Tracking',
  ppjkNpwp: '01.234.567.8-042.000 · Izin PPJK DJBC',
  ppjkAddress: 'Jl. Yos Sudarso Kav. 88, Tanjung Priok, Jakarta Utara',
  ppjkPhone: '(021) 4390-8811',
  ppjkEmail: 'info@ptg-ppjk.co.id',
  ppjkWebsite: 'www.ptg-ppjk.co.id',
  ppjkFooterNote: 'Dokumen resmi diterbitkan oleh sistem monitoring kepabeanan PPJK.',
  ppjkLogoDataUrl: '',
  ppjkLogoFileName: '',
  ppjkKopSuratDataUrl: '',
  ppjkKopSuratFileName: '',
  roleModuleAccess: {},
  ownerName: 'Bpk. Gunawan (Owner PTG)',
  ownerWhatsapp: '0811-8880-900',
  ownerEmail: 'owner@ptg-ppjk.co.id',
  adminName: 'Hendra Wijaya (Admin)',
  adminWhatsapp: '0812-9900-8811',
  adminEmail: 'admin.billing@ptg-ppjk.co.id',
  billingBankInfo:
    'Bank Mandiri Cab. Tanjung Priok · No. Rek: 120-00-8899123-4 a.n. PT PTG Logistik Kepabeanan',
  gasWebAppUrl:
    'https://script.google.com/macros/s/AKfycbxS0527e6Urzg4Dyipl8oJpzSCxx7DU3qAntocgwg/dev',
  gasWebAppAutoSync: true,
  gasWebAppFullSyncAuto: true,
  gasWebAppLastSyncAt: '',
  gasWebAppLastFullSyncAt: '',
  gasWebAppLastSyncDirection: '',
  gasWebAppLastSyncMessage: '',
  seqPengeluaranByMonth: {},
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
      bgClass: 'bg-slate-100 dark:bg-slate-800/80',
      textClass: 'text-slate-600 dark:text-slate-300',
      borderClass: 'border-slate-200 dark:border-slate-700',
    };
  }
  if (days > 7) {
    return {
      label: `${days} hari`,
      bgClass: 'bg-emerald-50 dark:bg-emerald-500/15',
      textClass: 'text-emerald-700 dark:text-emerald-300',
      borderClass: 'border-emerald-200 dark:border-emerald-500/35',
    };
  }
  if (days >= 4) {
    return {
      label: `${days} hari`,
      bgClass: 'bg-amber-50 dark:bg-amber-500/15',
      textClass: 'text-amber-700 dark:text-amber-300',
      borderClass: 'border-amber-200 dark:border-amber-500/35',
    };
  }
  if (days >= 0) {
    return {
      label: days === 0 ? 'Hari ini (0h)' : `${days} hari`,
      bgClass: 'bg-orange-50 dark:bg-orange-500/15',
      textClass: 'text-orange-700 dark:text-orange-300',
      borderClass: 'border-orange-200 dark:border-orange-500/35',
    };
  }
  return {
    label: `Lewat ${Math.abs(days)}h`,
    bgClass: 'bg-red-50 dark:bg-red-500/15',
    textClass: 'text-red-700 dark:text-red-300',
    borderClass: 'border-red-200 dark:border-red-500/35',
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
        bgClass: 'bg-[#2E9E5B]/12 border-[#2E9E5B]/30 dark:bg-emerald-500/15 dark:border-emerald-500/35',
        textClass: 'text-[#1F7A43] dark:text-emerald-300',
      };
    case 'Kuning':
      return {
        label: 'Kuning',
        hex: '#F2C037',
        bgClass: 'bg-[#F2C037]/18 border-[#F2C037]/45 dark:bg-yellow-500/15 dark:border-yellow-500/35',
        textClass: 'text-[#8F6800] dark:text-yellow-300',
      };
    case 'Merah':
      return {
        label: 'Merah',
        hex: '#D64545',
        bgClass: 'bg-[#D64545]/12 border-[#D64545]/30 dark:bg-red-500/15 dark:border-red-500/35',
        textClass: 'text-[#B52F2F] dark:text-red-300',
      };
    case 'MITA':
      return {
        label: 'MITA',
        hex: '#3B82F6',
        bgClass: 'bg-[#3B82F6]/12 border-[#3B82F6]/30 dark:bg-blue-500/15 dark:border-blue-500/35',
        textClass: 'text-[#1D4ED8] dark:text-blue-300',
      };
    default:
      return {
        label: 'Belum Ada',
        hex: '#94A3B8',
        bgClass: 'bg-slate-100 border-slate-200 dark:bg-slate-800/80 dark:border-slate-700',
        textClass: 'text-slate-600 dark:text-slate-300',
      };
  }
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Dokumen Diterima':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700';
    case 'Proses PIB/AJU':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/35';
    case 'Menunggu Jalur':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/35';
    case 'Proses Pemeriksaan':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35';
    case 'SPPB Terbit':
      return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/35';
    case 'Pasca-SPPB':
      return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/35';
    case 'Selesai':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/35';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700';
  }
}

export function normalizeStatusDokumen(val?: string | null): StatusDokumenType {
  return val === 'Ready' ? 'Ready' : 'Draft';
}

export function getStatusDokumenBadgeMeta(val?: string | null): {
  value: StatusDokumenType;
  label: string;
  description: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
} {
  const normalized = normalizeStatusDokumen(val);
  if (normalized === 'Ready') {
    return {
      value: 'Ready',
      label: 'Ready',
      description: 'Dokumen sudah dibuat Checker',
      bgClass: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/40',
      textClass: 'text-emerald-800 dark:text-emerald-300',
      dotClass: 'bg-emerald-600 dark:bg-emerald-400',
    };
  }
  return {
    value: 'Draft',
    label: 'Draft',
    description: 'Belum dibuat / masih Draft Checker',
    bgClass: 'bg-yellow-100 border-yellow-300 dark:bg-yellow-500/15 dark:border-yellow-400/40',
    textClass: 'text-yellow-800 dark:text-yellow-300',
    dotClass: 'bg-yellow-500 dark:bg-yellow-400',
  };
}

export function normalizeStatusDoPelayaran(val?: string | null): StatusDoPelayaranType {
  return val === 'Sedia' ? 'Sedia' : 'Belum';
}

export function getStatusDoPelayaranMeta(val?: string | null): {
  value: StatusDoPelayaranType;
  label: string;
  description: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
} {
  const normalized = normalizeStatusDoPelayaran(val);
  if (normalized === 'Sedia') {
    return {
      value: 'Sedia',
      label: 'Sedia',
      description: 'D/O Pelayaran sudah sedia — kontainer siap keluar pelabuhan',
      bgClass: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/40',
      textClass: 'text-emerald-800 dark:text-emerald-300',
      dotClass: 'bg-emerald-600 dark:bg-emerald-400',
    };
  }
  return {
    value: 'Belum',
    label: 'Belum',
    description: 'D/O Pelayaran belum sedia — kontainer belum bisa keluar pelabuhan',
    bgClass: 'bg-amber-100 border-amber-300 dark:bg-amber-500/15 dark:border-amber-400/40',
    textClass: 'text-amber-800 dark:text-amber-300',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
  };
}

export function normalizeStatusGatePass(val?: string | null): StatusGatePassType {
  if (val === 'Sedia') return 'Sedia';
  if (val === 'Proses') return 'Proses';
  return 'Belum';
}

export function normalizeGatePassJenis(val?: string | null): GatePassJenisType {
  if (val === 'Eslah' || val === 'TILA (Kartu Gate)' || val === 'Eslah & TILA') {
    return val;
  }
  return '';
}

export function getStatusGatePassMeta(val?: string | null): {
  value: StatusGatePassType;
  label: string;
  description: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
} {
  const normalized = normalizeStatusGatePass(val);
  if (normalized === 'Sedia') {
    return {
      value: 'Sedia',
      label: 'Sedia',
      description: 'Eslah / TILA (Kartu Gate) pelabuhan setempat sudah terbit & siap gate-out',
      bgClass: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/40',
      textClass: 'text-emerald-800 dark:text-emerald-300',
      dotClass: 'bg-emerald-600 dark:bg-emerald-400',
    };
  }
  if (normalized === 'Proses') {
    return {
      value: 'Proses',
      label: 'Proses',
      description: 'Pengurusan Eslah / pembuatan TILA (Kartu Gate) di pelabuhan sedang berjalan',
      bgClass: 'bg-sky-100 border-sky-300 dark:bg-sky-500/15 dark:border-sky-400/40',
      textClass: 'text-sky-800 dark:text-sky-300',
      dotClass: 'bg-sky-500 dark:bg-sky-400',
    };
  }
  return {
    value: 'Belum',
    label: 'Belum',
    description: 'Belum dilakukan pengurusan Eslah / pembuatan TILA (Kartu Gate) pelabuhan',
    bgClass: 'bg-amber-100 border-amber-300 dark:bg-amber-500/15 dark:border-amber-400/40',
    textClass: 'text-amber-800 dark:text-amber-300',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
  };
}

export function normalizeStatusTrucking(val?: string | null): StatusDoPelayaranType {
  return val === 'Sedia' ? 'Sedia' : 'Belum';
}

export function getStatusTruckingMeta(val?: string | null): {
  value: StatusDoPelayaranType;
  label: string;
  description: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
} {
  const normalized = normalizeStatusTrucking(val);
  if (normalized === 'Sedia') {
    return {
      value: 'Sedia',
      label: 'Sedia',
      description: 'Armada trucking & supir sudah tersedia untuk penarikan kontainer',
      bgClass: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/40',
      textClass: 'text-emerald-800 dark:text-emerald-300',
      dotClass: 'bg-emerald-600 dark:bg-emerald-400',
    };
  }
  return {
    value: 'Belum',
    label: 'Belum',
    description: 'Armada trucking / data supir belum tersedia',
    bgClass: 'bg-amber-100 border-amber-300 dark:bg-amber-500/15 dark:border-amber-400/40',
    textClass: 'text-amber-800 dark:text-amber-300',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
  };
}

export function normalizeStatusGateOut(
  val?: string | null,
  shipmentStatus?: string | null
): StatusGateOutType {
  if (val === 'Sudah') return 'Sudah';
  if (val === 'Belum') return 'Belum';
  return shipmentStatus === 'Selesai' ? 'Sudah' : 'Belum';
}

export function isContainerGateOut(shipment: Shipment): boolean {
  return (
    normalizeStatusGateOut(shipment.gateOutStatus, shipment.status) === 'Sudah' ||
    shipment.status === 'Selesai'
  );
}

export function getStatusGateOutMeta(
  val?: string | null,
  shipmentStatus?: string | null
): {
  value: StatusGateOutType;
  label: string;
  description: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
} {
  const normalized = normalizeStatusGateOut(val, shipmentStatus);
  if (normalized === 'Sudah') {
    return {
      value: 'Sudah',
      label: 'Sudah Gate-Out',
      description: 'Kontainer sudah keluar pelabuhan & terikat ke proses Dokumen Selesai',
      bgClass: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/40',
      textClass: 'text-emerald-800 dark:text-emerald-300',
      dotClass: 'bg-emerald-600 dark:bg-emerald-400',
    };
  }
  return {
    value: 'Belum',
    label: 'Belum Gate-Out',
    description: 'Kontainer belum keluar pelabuhan (menunggu Gate-Out menuju Dokumen Selesai)',
    bgClass: 'bg-slate-100 border-slate-300 dark:bg-slate-800/80 dark:border-slate-600',
    textClass: 'text-slate-700 dark:text-slate-300',
    dotClass: 'bg-slate-400 dark:bg-slate-400',
  };
}

export function generateSuratJalanNomor(
  kodeOs: string,
  referenceDate: Date = new Date()
): string {
  const cleanOs = (kodeOs || '').trim().toUpperCase();
  if (/^OS-\d{4}-\d+$/.test(cleanOs)) {
    return cleanOs.replace(/^OS-/, 'SJ-');
  }
  const yy = String(referenceDate.getFullYear()).slice(-2);
  const mm = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const suffix = cleanOs.replace(/[^A-Z0-9]/g, '').slice(-4) || '0001';
  return `SJ-${yy}${mm}-${suffix}`;
}

export function normalizeStatusSuratJalan(
  val?: string | null,
  gateOutStatus?: StatusGateOutType | string | null,
  shipmentStatus?: string | null
): StatusSuratJalanType {
  if (val === 'Terbit' || val === 'Dalam Pengiriman' || val === 'Tiba di Tujuan') {
    return val;
  }
  if (normalizeStatusGateOut(gateOutStatus, shipmentStatus) === 'Sudah') {
    return 'Terbit';
  }
  return 'Belum';
}

export function getStatusSuratJalanMeta(
  val?: string | null,
  gateOutStatus?: StatusGateOutType | string | null,
  shipmentStatus?: string | null
): {
  value: StatusSuratJalanType;
  label: string;
  description: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
} {
  const normalized = normalizeStatusSuratJalan(val, gateOutStatus, shipmentStatus);
  switch (normalized) {
    case 'Tiba di Tujuan':
      return {
        value: 'Tiba di Tujuan',
        label: 'Tiba di Tujuan',
        description: 'Kontainer telah tiba dan diserahterimakan di gudang / lokasi tujuan',
        bgClass: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/40',
        textClass: 'text-emerald-800 dark:text-emerald-300',
        dotClass: 'bg-emerald-600 dark:bg-emerald-400',
      };
    case 'Dalam Pengiriman':
      return {
        value: 'Dalam Pengiriman',
        label: 'Dalam Pengiriman',
        description: 'Kontainer dalam perjalanan menuju alamat tujuan sesuai Surat Jalan',
        bgClass: 'bg-amber-100 border-amber-300 dark:bg-amber-500/15 dark:border-amber-400/40',
        textClass: 'text-amber-800 dark:text-amber-300',
        dotClass: 'bg-amber-500 dark:bg-amber-400',
      };
    case 'Terbit':
      return {
        value: 'Terbit',
        label: 'SJ Terbit',
        description: 'Surat Jalan telah dibuat saat Gate-Out & siap/mulai tracking pengiriman',
        bgClass: 'bg-sky-100 border-sky-300 dark:bg-sky-500/15 dark:border-sky-400/40',
        textClass: 'text-sky-800 dark:text-sky-300',
        dotClass: 'bg-sky-600 dark:bg-sky-400',
      };
    default:
      return {
        value: 'Belum',
        label: 'Belum Terbit',
        description: 'Surat Jalan akan dibuat otomatis setelah status Gate-Out ditandai Sudah',
        bgClass: 'bg-slate-100 border-slate-300 dark:bg-slate-800/80 dark:border-slate-600',
        textClass: 'text-slate-700 dark:text-slate-300',
        dotClass: 'bg-slate-400 dark:bg-slate-400',
      };
  }
}

export function buildAutoSuratJalanFields(
  shipment: Pick<
    Shipment,
    | 'kodeOs'
    | 'namaCustomer'
    | 'gateOutTanggal'
    | 'suratJalanNomor'
    | 'suratJalanTanggal'
    | 'suratJalanStatus'
    | 'suratJalanTujuan'
    | 'suratJalanUpdatedAt'
  >,
  fallbackDate: string = new Date().toISOString().slice(0, 10),
  nowIso: string = new Date().toISOString()
): {
  suratJalanNomor: string;
  suratJalanTanggal: string;
  suratJalanStatus: StatusSuratJalanType;
  suratJalanTujuan: string;
  suratJalanUpdatedAt: string;
} {
  const effectiveDate =
    (shipment.suratJalanTanggal || '').trim() ||
    (shipment.gateOutTanggal || '').trim() ||
    fallbackDate;
  const effectiveNomor =
    (shipment.suratJalanNomor || '').trim() || generateSuratJalanNomor(shipment.kodeOs);
  const effectiveStatus = normalizeStatusSuratJalan(
    shipment.suratJalanStatus,
    'Sudah',
    'Selesai'
  );
  const effectiveTujuan =
    (shipment.suratJalanTujuan || '').trim() ||
    (shipment.namaCustomer ? `Gudang ${shipment.namaCustomer}` : '');
  const effectiveUpdatedAt = (shipment.suratJalanUpdatedAt || '').trim() || nowIso;

  return {
    suratJalanNomor: effectiveNomor,
    suratJalanTanggal: effectiveDate,
    suratJalanStatus: effectiveStatus,
    suratJalanTujuan: effectiveTujuan,
    suratJalanUpdatedAt: effectiveUpdatedAt,
  };
}

export interface DoValidityMeta {
  daysLeft: number | null;
  state: 'completed' | 'expired' | 'expiring_soon' | 'valid' | 'unset';
  needsExtension: boolean;
  label: string;
  badgeClass: string;
}

export function getDoValidityMeta(
  doBerlakuSampai?: string | null,
  shipmentStatus?: string | null,
  referenceDate: Date = new Date()
): DoValidityMeta {
  if (shipmentStatus === 'Selesai') {
    return {
      daysLeft: null,
      state: 'completed',
      needsExtension: false,
      label: doBerlakuSampai ? `Selesai (${doBerlakuSampai})` : 'Kontainer Keluar / Selesai',
      badgeClass:
        'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/35 dark:text-emerald-300',
    };
  }
  const dateStr = (doBerlakuSampai || '').trim();
  if (!dateStr) {
    return {
      daysLeft: null,
      state: 'unset',
      needsExtension: false,
      label: 'Masa berlaku belum diisi',
      badgeClass:
        'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300',
    };
  }
  const daysLeft = calculateCountdownEta(dateStr, referenceDate);
  if (daysLeft === null) {
    return {
      daysLeft: null,
      state: 'unset',
      needsExtension: false,
      label: dateStr,
      badgeClass:
        'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300',
    };
  }
  if (daysLeft < 0) {
    return {
      daysLeft,
      state: 'expired',
      needsExtension: true,
      label: `Kedaluwarsa ${Math.abs(daysLeft)}h (Perlu Perpanjangan)`,
      badgeClass:
        'bg-red-100 border-red-300 text-red-800 dark:bg-red-500/20 dark:border-red-500/45 dark:text-red-300',
    };
  }
  if (daysLeft <= 2) {
    return {
      daysLeft,
      state: 'expiring_soon',
      needsExtension: true,
      label:
        daysLeft === 0
          ? 'Berakhir Hari Ini (Perpanjang!)'
          : `Sisa ${daysLeft}h (Perlu Perpanjangan)`,
      badgeClass:
        'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-500/20 dark:border-orange-500/45 dark:text-orange-300',
    };
  }
  return {
    daysLeft,
    state: 'valid',
    needsExtension: false,
    label: `Berlaku ${daysLeft} hari`,
    badgeClass:
      'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/15 dark:border-sky-500/35 dark:text-sky-300',
  };
}

export function isSppbReadyForGateOut(shipment: Shipment): boolean {
  return Boolean(
    shipment.noSppb?.trim() ||
      shipment.status === 'SPPB Terbit' ||
      shipment.status === 'Pasca-SPPB' ||
      shipment.status === 'Selesai'
  );
}

export function computeDoReadinessSummary(
  shipments: Shipment[],
  referenceDate: Date = new Date()
): DoReadinessSummary {
  let draftDokCount = 0;
  let readyDokCount = 0;
  let sediaCount = 0;
  let belumCount = 0;
  let siapKeluarCount = 0;
  let sppbMenungguDoCount = 0;
  let perluPerpanjanganCount = 0;
  let gatePassSediaCount = 0;
  let gatePassProsesCount = 0;
  let gatePassBelumCount = 0;
  let truckingSediaCount = 0;
  let truckingBelumCount = 0;
  let fullReadyGateOutCount = 0;
  let gateOutSudahCount = 0;
  let gateOutBelumCount = 0;
  let dokumenSelesaiCount = 0;
  let suratJalanTerbitCount = 0;
  let suratJalanDalamPengirimanCount = 0;
  let suratJalanTibaCount = 0;

  for (const s of shipments) {
    const dokStatus = normalizeStatusDokumen(s.statusDokumen);
    const doStatus = normalizeStatusDoPelayaran(s.doPelayaranStatus);
    const gatePassStatus = normalizeStatusGatePass(s.doGatePassStatus);
    const truckingStatus = normalizeStatusTrucking(s.truckingStatus);
    const gateOutSudah = isContainerGateOut(s);
    const sjStatus = normalizeStatusSuratJalan(
      s.suratJalanStatus,
      gateOutSudah ? 'Sudah' : 'Belum',
      s.status
    );
    const hasSppb = isSppbReadyForGateOut(s);
    const validity = getDoValidityMeta(s.doBerlakuSampai, s.status, referenceDate);

    if (dokStatus === 'Ready') readyDokCount++;
    else draftDokCount++;

    if (doStatus === 'Sedia') {
      sediaCount++;
      if (hasSppb) siapKeluarCount++;
    } else {
      belumCount++;
      if (hasSppb && s.status !== 'Selesai') {
        sppbMenungguDoCount++;
      }
    }

    if (gatePassStatus === 'Sedia') gatePassSediaCount++;
    else if (gatePassStatus === 'Proses') gatePassProsesCount++;
    else gatePassBelumCount++;

    if (truckingStatus === 'Sedia') truckingSediaCount++;
    else truckingBelumCount++;

    if (hasSppb && doStatus === 'Sedia' && gatePassStatus === 'Sedia' && truckingStatus === 'Sedia') {
      fullReadyGateOutCount++;
    }

    if (gateOutSudah) gateOutSudahCount++;
    else gateOutBelumCount++;

    if (sjStatus === 'Terbit') suratJalanTerbitCount++;
    else if (sjStatus === 'Dalam Pengiriman') suratJalanDalamPengirimanCount++;
    else if (sjStatus === 'Tiba di Tujuan') suratJalanTibaCount++;

    if (s.status === 'Selesai') dokumenSelesaiCount++;

    if (validity.needsExtension) {
      perluPerpanjanganCount++;
    }
  }

  return {
    total: shipments.length,
    draftDokCount,
    readyDokCount,
    sediaCount,
    belumCount,
    siapKeluarCount,
    sppbMenungguDoCount,
    perluPerpanjanganCount,
    gatePassSediaCount,
    gatePassProsesCount,
    gatePassBelumCount,
    truckingSediaCount,
    truckingBelumCount,
    fullReadyGateOutCount,
    gateOutSudahCount,
    gateOutBelumCount,
    dokumenSelesaiCount,
    suratJalanTerbitCount,
    suratJalanDalamPengirimanCount,
    suratJalanTibaCount,
  };
}

export interface DoFilterCriteria {
  search?: string;
  statusDokumen?: '' | StatusDokumenType;
  doStatus?: '' | StatusDoPelayaranType;
  gatePassStatus?: '' | StatusGatePassType;
  truckingStatus?: '' | StatusDoPelayaranType;
  gateOutStatus?: '' | StatusGateOutType;
  suratJalanStatus?: '' | StatusSuratJalanType;
  condition?:
    | 'all'
    | 'sppb_belum_do'
    | 'perlu_perpanjangan'
    | 'siap_keluar'
    | 'gatepass_belum'
    | 'trucking_belum'
    | 'full_ready'
    | 'gateout_sudah'
    | 'gateout_belum';
  customer?: string;
}

export function filterDoShipments(
  shipments: Shipment[],
  criteria: DoFilterCriteria,
  referenceDate: Date = new Date()
): Shipment[] {
  const q = (criteria.search || '').trim().toLowerCase();
  return shipments.filter((s) => {
    const dokStatus = normalizeStatusDokumen(s.statusDokumen);
    const doStatus = normalizeStatusDoPelayaran(s.doPelayaranStatus);
    const gatePassStatus = normalizeStatusGatePass(s.doGatePassStatus);
    const truckingStatus = normalizeStatusTrucking(s.truckingStatus);
    const gateOutStatus = normalizeStatusGateOut(s.gateOutStatus, s.status);
    const sjStatus = normalizeStatusSuratJalan(s.suratJalanStatus, gateOutStatus, s.status);

    if (criteria.statusDokumen && dokStatus !== criteria.statusDokumen) return false;
    if (criteria.doStatus && doStatus !== criteria.doStatus) return false;
    if (criteria.gatePassStatus && gatePassStatus !== criteria.gatePassStatus) return false;
    if (criteria.truckingStatus && truckingStatus !== criteria.truckingStatus) return false;
    if (criteria.gateOutStatus && gateOutStatus !== criteria.gateOutStatus) return false;
    if (criteria.suratJalanStatus && sjStatus !== criteria.suratJalanStatus) return false;
    if (criteria.customer && s.namaCustomer !== criteria.customer) return false;

    const hasSppb = isSppbReadyForGateOut(s);
    const validity = getDoValidityMeta(s.doBerlakuSampai, s.status, referenceDate);

    if (criteria.condition === 'sppb_belum_do') {
      if (!(hasSppb && doStatus === 'Belum' && s.status !== 'Selesai')) return false;
    } else if (criteria.condition === 'perlu_perpanjangan') {
      if (!validity.needsExtension) return false;
    } else if (criteria.condition === 'siap_keluar') {
      if (!(hasSppb && doStatus === 'Sedia')) return false;
    } else if (criteria.condition === 'gatepass_belum') {
      if (gatePassStatus === 'Sedia') return false;
    } else if (criteria.condition === 'trucking_belum') {
      if (truckingStatus === 'Sedia') return false;
    } else if (criteria.condition === 'full_ready') {
      if (!(hasSppb && doStatus === 'Sedia' && gatePassStatus === 'Sedia' && truckingStatus === 'Sedia')) {
        return false;
      }
    } else if (criteria.condition === 'gateout_sudah') {
      if (gateOutStatus !== 'Sudah') return false;
    } else if (criteria.condition === 'gateout_belum') {
      if (gateOutStatus !== 'Belum') return false;
    }

    if (q) {
      const hay = [
        s.kodeOs,
        s.namaCustomer,
        s.kodeCustomer,
        dokStatus,
        s.noBl,
        s.noCont,
        s.ship,
        s.noSppb,
        doStatus,
        s.doBerlakuSampai || '',
        s.doCatatanPerpanjangan || '',
        gatePassStatus,
        s.doGatePassJenis || '',
        s.doGatePassNomor || '',
        s.eslah || '',
        truckingStatus,
        s.truckingNamaSupir || '',
        s.truckingNoPlat || '',
        s.truckingNoHpSupir || '',
        gateOutStatus,
        s.gateOutTanggal || '',
        s.gateOutCatatan || '',
        sjStatus,
        s.suratJalanNomor || '',
        s.suratJalanTanggal || '',
        s.suratJalanTujuan || '',
        s.suratJalanPenerima || '',
        s.suratJalanCatatan || '',
        s.status,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
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

export interface ShipmentProcessSignal {
  active: boolean;
  etaArrived: boolean;
  bc11Issued: boolean;
  reason: 'both' | 'eta' | 'bc11' | 'none';
  shortLabel: string;
  detailLabel: string;
}

/**
 * Menentukan sinyal peringatan segera proses jika kapal ETA sudah tiba (<= 0 hari)
 * atau BC 1.1 Manifes sudah terbit sementara dokumen belum terbit SPPB / belum Selesai.
 */
export function getShipmentProcessSignal(
  shipment: Shipment,
  referenceDate: Date = new Date()
): ShipmentProcessSignal {
  const hasSppb = Boolean(shipment.noSppb?.trim() || shipment.tglSppb?.trim());
  const isPostClearance =
    shipment.status === 'Selesai' ||
    shipment.status === 'SPPB Terbit' ||
    shipment.status === 'Pasca-SPPB' ||
    hasSppb;

  const etaDays = calculateCountdownEta(shipment.eta, referenceDate);
  const etaArrived = etaDays !== null && etaDays <= 0;
  const bc11Issued = Boolean(
    shipment.bc11Terbit || shipment.noBc11?.trim() || shipment.tglBc11?.trim()
  );

  if (isPostClearance || (!etaArrived && !bc11Issued)) {
    return {
      active: false,
      etaArrived,
      bc11Issued,
      reason: 'none',
      shortLabel: '',
      detailLabel: '',
    };
  }

  if (etaArrived && bc11Issued) {
    return {
      active: true,
      etaArrived: true,
      bc11Issued: true,
      reason: 'both',
      shortLabel: 'ETA Tiba & BC 1.1',
      detailLabel: 'Segera Proses: ETA Sudah Tiba & BC 1.1 Manifes Terbit',
    };
  }
  if (bc11Issued) {
    return {
      active: true,
      etaArrived: false,
      bc11Issued: true,
      reason: 'bc11',
      shortLabel: 'BC 1.1 Terbit',
      detailLabel: 'Segera Proses: BC 1.1 Manifes Sudah Terbit',
    };
  }
  return {
    active: true,
    etaArrived: true,
    bc11Issued: false,
    reason: 'eta',
    shortLabel: 'ETA Tiba',
    detailLabel: 'Segera Proses: Kapal / Dokumen ETA Tiba',
  };
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
    { key: 'tglBc11', label: 'Tgl. BC 1.1' },
    { key: 'tglAju', label: 'Tgl. AJU' },
    { key: 'tglNopen', label: 'Tgl. NOPEN' },
    { key: 'tglSppb', label: 'Tgl. SPPB' },
    { key: 'tglSptnp', label: 'Tgl. SPTNP' },
    { key: 'tglPfpb', label: 'Tgl. PFPB' },
    { key: 'tglPfpd', label: 'Tgl. PFPD' },
    { key: 'tglEslah', label: 'Tgl. ESLAH' },
    { key: 'gateOutTanggal', label: 'Tgl. Gate-Out' },
    { key: 'suratJalanTanggal', label: 'Tgl. Surat Jalan' },
    { key: 'billingTanggal', label: 'Tgl. Surat Penagihan' },
    { key: 'billingJatuhTempo', label: 'Tgl. Jatuh Tempo Penagihan' },
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
  'kodeManualDokOs',
  'kodeCustomer',
  'namaCustomer',
  'tglTerimaDok',
  'terimaDok',
  'noPackinglist',
  'noBl',
  'statusDokumen',
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
  'bc11Terbit',
  'noBc11',
  'tglBc11',
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
  'Owner' | 'Admin' | 'Checker' | 'Drafter' | 'Operasional' | 'Manajer',
  { title: string; summary: string; restrictions: string }
> = {
  Owner: {
    title: 'Owner (Super Admin Penuh)',
    summary:
      'Kontrol tertinggi: Setup identitas PPJK, toggle aktif/non-aktif modul terhadap seluruh peran & user, kelola semua user, CRUD semua fase (1–4), dan monitoring menyeluruh.',
    restrictions: 'Tidak ada batasan — kebal terhadap pembatasan modul & akun.',
  },
  Admin: {
    title: 'Admin (Operasional Penuh)',
    summary:
      'CRUD seluruh fase (1–4), hapus shipment, master data, manajemen user non-Owner & pengaturan sistem.',
    restrictions:
      'Tunduk pada kontrol toggle modul dari Owner; tidak dapat mengubah akun Owner atau toggle Super Admin.',
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

export function isOwnerSuperAdmin(role: UserRole): boolean {
  return role === 'Owner';
}

export function isCheckerRole(role: UserRole): boolean {
  return role === 'Checker' || role === 'Dokumen/Checker';
}

export function isDrafterOrOpsRole(role: UserRole): boolean {
  return role === 'Drafter' || role === 'Operasional';
}

/**
 * RBAC Matrix (konsisten dengan Code.gs + Owner Super Admin)
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
    | 'manage_setup'
    | 'manage_module_toggles'
    | 'manage_pengeluaran_ops'
    | 'delete_pengeluaran_ops'
    | 'view_gas_code'
    | 'export_report'
): boolean {
  if (isOwnerSuperAdmin(role)) return true;

  switch (action) {
    case 'create_shipment':
      return role === 'Admin' || isCheckerRole(role);
    case 'delete_shipment':
    case 'delete_pengeluaran_ops':
      return role === 'Admin';
    case 'edit_shipment':
      return role === 'Admin' || isCheckerRole(role) || isDrafterOrOpsRole(role);
    case 'manage_pengeluaran_ops':
      return role === 'Admin' || isCheckerRole(role) || role === 'Operasional';
    case 'upload_dokumen':
    case 'add_catatan':
      return role === 'Admin' || isCheckerRole(role) || isDrafterOrOpsRole(role);
    case 'manage_master':
      return role === 'Admin' || isCheckerRole(role);
    case 'manage_users':
    case 'manage_settings':
    case 'manage_setup':
    case 'view_gas_code':
      return role === 'Admin';
    case 'manage_module_toggles':
      return false; // Eksklusif Owner (Super Admin)
    case 'export_report':
      return true;
    default:
      return false;
  }
}

export const PHASE_1_FIELDS: Array<keyof Shipment> = [
  'kodeManualDokOs',
  'kodeCustomer',
  'namaCustomer',
  'tglTerimaDok',
  'terimaDok',
  'noPackinglist',
  'noBl',
  'statusDokumen',
  'dokumenChecker',
];

export const PHASE_2_FIELDS: Array<keyof Shipment> = [
  'ship',
  'etd',
  'eta',
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
  if (role === 'Owner' || role === 'Admin') {
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
  let draftCount = 0;
  let readyCount = 0;
  let etaNext7Days = 0;
  let urgentMissingAju = 0;
  let urgentProcessSignal = 0;

  for (const s of shipments) {
    const st = s.status || 'Dokumen Diterima';
    byStatus[st] = (byStatus[st] || 0) + 1;

    const jl = s.jalur || 'Belum Ada';
    byJalur[jl] = (byJalur[jl] || 0) + 1;

    if (normalizeStatusDokumen(s.statusDokumen) === 'Ready') {
      readyCount++;
    } else {
      draftCount++;
    }

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

    if (getShipmentProcessSignal(s, referenceDate).active) {
      urgentProcessSignal++;
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
    draftCount,
    readyCount,
    etaNext7Days,
    urgentMissingAju,
    urgentProcessSignal,
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
  let totalProcessSignal = 0;
  let totalDraft = 0;
  let totalReady = 0;

  const grouped: Record<string, Shipment[]> = {};

  for (const s of shipments) {
    const st = (s.status || '').trim() || 'Dokumen Diterima';
    globalStatusCounts[st] = (globalStatusCounts[st] || 0) + 1;

    const jl = s.jalur || 'Belum Ada';
    globalJalurCounts[jl] = (globalJalurCounts[jl] || 0) + 1;

    const docStatus = normalizeStatusDokumen(s.statusDokumen);
    if (docStatus === 'Ready') totalReady++;
    else totalDraft++;

    if (isShipmentOutstanding(s, checklistItems)) {
      totalOutstanding++;
    }
    if (isUrgentMissingAju(s, referenceDate)) {
      totalUrgent++;
    }
    if (getShipmentProcessSignal(s, referenceDate).active) {
      totalProcessSignal++;
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
    let processSignalCount = 0;
    let etaNext7Days = 0;
    let draftCount = 0;
    let readyCount = 0;

    for (const s of list) {
      const st = (s.status || '').trim() || 'Dokumen Diterima';
      cStatus[st] = (cStatus[st] || 0) + 1;

      const jl = s.jalur || 'Belum Ada';
      cJalur[jl] = (cJalur[jl] || 0) + 1;

      const docStatus = normalizeStatusDokumen(s.statusDokumen);
      if (docStatus === 'Ready') readyCount++;
      else draftCount++;

      if (isShipmentOutstanding(s, checklistItems)) {
        outstanding++;
      }
      if (isUrgentMissingAju(s, referenceDate)) {
        urgentMissingAju++;
      }
      if (getShipmentProcessSignal(s, referenceDate).active) {
        processSignalCount++;
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
      draftCount,
      readyCount,
      urgentMissingAju,
      processSignalCount,
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
    totalDraft,
    totalReady,
    totalUrgent,
    totalProcessSignal,
    totalCheckers: checkers.filter((c) => c.checkerName !== 'Belum Ditugaskan').length,
    byStatus,
    byJalur: globalJalurCounts,
    checkers,
  };
}

export interface ShipmentFilterCriteria {
  mode: 'all' | 'outstanding';
  search?: string;
  filterStatus?: string;
  filterStatusDokumen?: '' | StatusDokumenType;
  onlyProcessSignal?: boolean;
  filterJalur?: string;
  filterCustomer?: string;
  filterImportir?: string;
  filterChecker?: string;
  dateField?: ShipmentDateFilterField;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Filter murni daftar shipment berdasarkan mode, pencarian, status dokumen checker (Draft/Ready),
 * sinyal segera proses (ETA Tiba / BC 1.1 Terbit), dan rentang tanggal (ETD / ETA / Tgl Terima / Tgl SPPB).
 */
export function filterShipments(
  shipments: Shipment[],
  criteria: ShipmentFilterCriteria,
  checklistItems: string[] = DEFAULT_CHECKLIST_ITEMS
): Shipment[] {
  const baseList =
    criteria.mode === 'outstanding'
      ? shipments.filter((s) => isShipmentOutstanding(s, checklistItems))
      : [...shipments];

  const q = (criteria.search || '').trim().toLowerCase();
  const dateField: ShipmentDateFilterField = criteria.dateField || 'eta';
  const dateFrom = (criteria.dateFrom || '').trim();
  const dateTo = (criteria.dateTo || '').trim();

  return baseList.filter((s) => {
    if (criteria.filterStatus && s.status !== criteria.filterStatus) return false;
    if (
      criteria.filterStatusDokumen &&
      normalizeStatusDokumen(s.statusDokumen) !== criteria.filterStatusDokumen
    ) {
      return false;
    }
    if (criteria.onlyProcessSignal && !getShipmentProcessSignal(s).active) {
      return false;
    }
    if (criteria.filterJalur && s.jalur !== criteria.filterJalur) return false;
    if (criteria.filterCustomer && s.namaCustomer !== criteria.filterCustomer) return false;
    if (criteria.filterImportir) {
      const impCode = (s.kodeImportir || '').trim() || 'Belum Diisi';
      if (impCode !== criteria.filterImportir) return false;
    }
    if (criteria.filterChecker && s.dokumenChecker !== criteria.filterChecker) return false;

    const targetDate = s[dateField];
    if (dateFrom && (!targetDate || targetDate < dateFrom)) return false;
    if (dateTo && (!targetDate || targetDate > dateTo)) return false;

    if (q) {
      const hay = [
        s.kodeOs,
        s.kodeManualDokOs || '',
        s.dokumenChecker,
        normalizeStatusDokumen(s.statusDokumen),
        s.kodeCustomer,
        s.kodeImportir,
        s.noPackinglist || '',
        s.noBl,
        s.noBc11 || '',
        s.noAju,
        s.nopen,
        s.noCont,
        s.namaCustomer,
        s.ship,
        s.shipper,
        s.description || '',
        s.negaraAsal || '',
        s.noSppb,
        normalizeStatusDoPelayaran(s.doPelayaranStatus),
        s.doCatatanPerpanjangan || '',
        s.doGatePassNomor || '',
        s.truckingNamaSupir || '',
        s.truckingNoPlat || '',
        s.truckingNoHpSupir || '',
        normalizeStatusGateOut(s.gateOutStatus, s.status),
        s.gateOutTanggal || '',
        s.gateOutCatatan || '',
        s.suratJalanNomor || '',
        s.billingNomor || '',
        s.billingStatus || '',
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
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

// =============================================================================
// Penagihan Otomatis, Info Owner (WA & Email) & Auto Surat Penagihan Customer
// =============================================================================

export function isShipmentBillingEligible(shipment: Shipment): boolean {
  return isSppbReadyForGateOut(shipment) || isContainerGateOut(shipment);
}

export function getBillingEligibilityReason(shipment: Shipment): string {
  const gateOut = isContainerGateOut(shipment);
  const sppb = isSppbReadyForGateOut(shipment);
  if (gateOut && sppb) return 'SPPB Terbit & Sudah Gate-Out';
  if (gateOut) return 'Kontainer Sudah Gate-Out';
  if (sppb) return 'Dokumen SPPB Terbit';
  return 'Menunggu SPPB / Gate-Out';
}

export function generateSuratPenagihanNomor(
  kodeOs: string,
  referenceDate: Date = new Date()
): string {
  const cleanOs = (kodeOs || '').trim().toUpperCase();
  if (/^OS-\d{4}-\d+$/.test(cleanOs)) {
    return cleanOs.replace(/^OS-/, 'INV-');
  }
  const yy = String(referenceDate.getFullYear()).slice(-2);
  const mm = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const suffix = cleanOs.replace(/[^A-Z0-9]/g, '').slice(-4) || '0001';
  return `INV-${yy}${mm}-${suffix}`;
}

export function normalizeStatusPenagihan(
  val?: string | null,
  shipment?: Shipment
): StatusPenagihanType {
  if (
    val === 'Siap Info Owner' ||
    val === 'Info Owner Terkirim' ||
    val === 'Penagihan Terbit' ||
    val === 'Terkirim ke Customer' ||
    val === 'Lunas'
  ) {
    return val;
  }
  if (shipment && isShipmentBillingEligible(shipment)) {
    return 'Siap Info Owner';
  }
  return 'Belum';
}

export function getStatusPenagihanMeta(
  val?: string | null,
  shipment?: Shipment
): {
  value: StatusPenagihanType;
  label: string;
  description: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
} {
  const normalized = normalizeStatusPenagihan(val, shipment);
  switch (normalized) {
    case 'Lunas':
      return {
        value: 'Lunas',
        label: 'Lunas',
        description: 'Pembayaran surat penagihan customer telah diterima lunas',
        bgClass:
          'bg-emerald-100 border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/40',
        textClass: 'text-emerald-800 dark:text-emerald-300',
        dotClass: 'bg-emerald-600 dark:bg-emerald-400',
      };
    case 'Terkirim ke Customer':
      return {
        value: 'Terkirim ke Customer',
        label: 'Terkirim Customer',
        description: 'Surat Penagihan resmi sudah diterbitkan Admin dan dikirim ke Customer',
        bgClass: 'bg-indigo-100 border-indigo-300 dark:bg-indigo-500/15 dark:border-indigo-400/40',
        textClass: 'text-indigo-800 dark:text-indigo-300',
        dotClass: 'bg-indigo-600 dark:bg-indigo-400',
      };
    case 'Penagihan Terbit':
      return {
        value: 'Penagihan Terbit',
        label: 'Penagihan Terbit',
        description: 'Surat Penagihan customer telah dibuat otomatis oleh Admin',
        bgClass: 'bg-sky-100 border-sky-300 dark:bg-sky-500/15 dark:border-sky-400/40',
        textClass: 'text-sky-800 dark:text-sky-300',
        dotClass: 'bg-sky-600 dark:bg-sky-400',
      };
    case 'Info Owner Terkirim':
      return {
        value: 'Info Owner Terkirim',
        label: 'Info Owner Terkirim',
        description: 'Info WA/Email telah dikirim ke Owner — Admin siap terbitkan Surat Penagihan',
        bgClass: 'bg-violet-100 border-violet-300 dark:bg-violet-500/15 dark:border-violet-400/40',
        textClass: 'text-violet-800 dark:text-violet-300',
        dotClass: 'bg-violet-600 dark:bg-violet-400',
      };
    case 'Siap Info Owner':
      return {
        value: 'Siap Info Owner',
        label: 'Siap Info Owner',
        description: 'SPPB Terbit / Sudah Gate-Out — segera kirim info WA/Email ke Owner',
        bgClass: 'bg-amber-100 border-amber-300 dark:bg-amber-500/15 dark:border-amber-400/40',
        textClass: 'text-amber-800 dark:text-amber-300',
        dotClass: 'bg-amber-500 dark:bg-amber-400',
      };
    default:
      return {
        value: 'Belum',
        label: 'Belum Siap',
        description: 'Menunggu dokumen mencapai status SPPB Terbit atau Gate-Out',
        bgClass: 'bg-slate-100 border-slate-300 dark:bg-slate-800/80 dark:border-slate-600',
        textClass: 'text-slate-600 dark:text-slate-300',
        dotClass: 'bg-slate-400',
      };
  }
}

export function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(safe);
}

export function normalizeWhatsAppNumber(phone?: string | null): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

export function parseCustomerContact(kontak?: string | null): {
  phone: string;
  whatsappDigits: string;
  email: string;
} {
  const raw = (kontak || '').trim();
  const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch ? emailMatch[0] : '';
  const withoutEmail = email ? raw.replace(email, '') : raw;
  const phoneMatch = withoutEmail.match(/(?:\+?62|0)[0-9\s-]{6,}/);
  const phone = phoneMatch ? phoneMatch[0].trim().replace(/^[/-]+|[/-]+$/g, '').trim() : '';
  return {
    phone,
    whatsappDigits: normalizeWhatsAppNumber(phone),
    email,
  };
}

function estimateContainerCount(noCont?: string): number {
  const raw = (noCont || '').trim();
  if (!raw || raw === '-') return 1;
  return Math.max(1, raw.split(',').filter((x) => x.trim() !== '').length);
}

export function buildDefaultBillingItems(shipment: Shipment): BillingItem[] {
  const contCount = estimateContainerCount(shipment.noCont);
  const isRed = shipment.jalur === 'Merah';
  const items: BillingItem[] = [
    {
      id: `${shipment.kodeOs}_item_1`,
      deskripsi: `Jasa Kepabeanan PPJK & Pengajuan PIB (${shipment.jalur || 'Reguler'})`,
      qty: 1,
      satuan: 'Dokumen',
      hargaSatuan: isRed ? 3500000 : 2500000,
    },
    {
      id: `${shipment.kodeOs}_item_2`,
      deskripsi: 'Pengurusan D/O Pelayaran & Eslah / TILA (Kartu Gate)',
      qty: contCount,
      satuan: 'Cont',
      hargaSatuan: 1250000,
    },
    {
      id: `${shipment.kodeOs}_item_3`,
      deskripsi: 'Jasa Trucking & Handling Kontainer Pelabuhan → Gudang',
      qty: contCount,
      satuan: 'Cont',
      hargaSatuan: 2750000,
    },
    {
      id: `${shipment.kodeOs}_item_4`,
      deskripsi: 'Biaya Administrasi EDI, Materai & Dokumen OS',
      qty: 1,
      satuan: 'Paket',
      hargaSatuan: 500000,
    },
  ];
  return items;
}

export function calculateBillingTotals(
  items: BillingItem[],
  ppnPersen = 11
): { subtotal: number; ppnNominal: number; total: number } {
  const subtotal = items.reduce(
    (sum, it) => sum + Math.max(0, Number(it.qty) || 0) * Math.max(0, Number(it.hargaSatuan) || 0),
    0
  );
  const rate = Math.max(0, Number(ppnPersen) || 0);
  const ppnNominal = Math.round((subtotal * rate) / 100);
  return {
    subtotal,
    ppnNominal,
    total: subtotal + ppnNominal,
  };
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const base = /^\d{4}-\d{2}-\d{2}$/.test((isoDate || '').trim())
    ? new Date(`${isoDate.trim()}T00:00:00Z`)
    : new Date();
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function buildAutoBillingFields(
  shipment: Shipment,
  fallbackDate: string = new Date().toISOString().slice(0, 10)
): {
  billingStatus: StatusPenagihanType;
  billingNomor: string;
  billingTanggal: string;
  billingJatuhTempo: string;
  billingItems: BillingItem[];
  billingPpnPersen: number;
  billingTotal: number;
} {
  const effectiveStatus = normalizeStatusPenagihan(shipment.billingStatus, shipment);
  const effectiveNomor =
    (shipment.billingNomor || '').trim() || generateSuratPenagihanNomor(shipment.kodeOs);
  const effectiveTanggal =
    (shipment.billingTanggal || '').trim() ||
    (shipment.gateOutTanggal || '').trim() ||
    (shipment.tglSppb || '').trim() ||
    fallbackDate;
  const effectiveJatuhTempo =
    (shipment.billingJatuhTempo || '').trim() || addDaysToIsoDate(effectiveTanggal, 14);
  const effectiveItems =
    Array.isArray(shipment.billingItems) && shipment.billingItems.length > 0
      ? shipment.billingItems
      : buildDefaultBillingItems(shipment);
  const effectivePpn =
    typeof shipment.billingPpnPersen === 'number' ? shipment.billingPpnPersen : 11;
  const totals = calculateBillingTotals(effectiveItems, effectivePpn);

  return {
    billingStatus: effectiveStatus,
    billingNomor: effectiveNomor,
    billingTanggal: effectiveTanggal,
    billingJatuhTempo: effectiveJatuhTempo,
    billingItems: effectiveItems,
    billingPpnPersen: effectivePpn,
    billingTotal: totals.total,
  };
}

export function buildOwnerBillingMessage(
  shipment: Shipment,
  pengaturan: Pengaturan
): {
  subject: string;
  message: string;
  whatsappUrl: string;
  mailtoUrl: string;
  triggerLabel: string;
} {
  const auto = buildAutoBillingFields(shipment);
  const triggerLabel = getBillingEligibilityReason(shipment);
  const identity = getPpjkIdentity(pengaturan);
  const ownerName = pengaturan.ownerName?.trim() || 'Bpk/Ibu Owner';
  const adminName = pengaturan.adminName?.trim() || 'Tim Admin Billing';
  const sjPart = shipment.suratJalanNomor ? ` | No. SJ: ${shipment.suratJalanNomor}` : '';
  const subject = `[INFO PENAGIHAN ${identity.brandName}] ${shipment.kodeOs} (${triggerLabel}) - ${shipment.namaCustomer}`;
  const message = [
    `Yth. ${ownerName},`,
    ``,
    `Menginformasikan dari Sistem ${identity.brandName} bahwa dokumen berikut telah berstatus *${triggerLabel}*:`,
    `- Kode OS : ${shipment.kodeOs}`,
    `- Customer : ${shipment.namaCustomer} (${shipment.kodeCustomer})`,
    `- No. B/L : ${shipment.noBl || '-'}`,
    `- No. Cont : ${shipment.noCont || '-'}`,
    `- No. SPPB : ${shipment.noSppb || '-'} (${shipment.tglSppb || '-'})`,
    `- Gate-Out : ${isContainerGateOut(shipment) ? `Sudah (${shipment.gateOutTanggal || '-'})` : 'Belum'}${sjPart}`,
    `- Draft No. Tagihan : ${auto.billingNomor}`,
    `- Estimasi Tagihan : ${formatRupiah(auto.billingTotal)} (incl. PPN ${auto.billingPpnPersen}%)`,
    ``,
    `Mohon arahan/persetujuan Owner kepada *${adminName}* agar segera menerbitkan Surat Penagihan resmi untuk customer *${shipment.namaCustomer}* di sistem PPJK.`,
    ``,
    `Terima kasih,`,
    `Tim Operasional ${identity.brandName}`,
  ].join('\n');

  const waPhone = normalizeWhatsAppNumber(pengaturan.ownerWhatsapp);
  const whatsappUrl = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  const ownerEmail = (pengaturan.ownerEmail || '').trim();
  const mailtoUrl = `mailto:${encodeURIComponent(ownerEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(message)}`;

  return { subject, message, whatsappUrl, mailtoUrl, triggerLabel };
}

export function buildCustomerBillingMessage(
  shipment: Shipment,
  customer: Customer | undefined,
  pengaturan: Pengaturan
): {
  subject: string;
  message: string;
  whatsappUrl: string;
  mailtoUrl: string;
  customerPhone: string;
  customerEmail: string;
} {
  const auto = buildAutoBillingFields(shipment);
  const identity = getPpjkIdentity(pengaturan);
  const parsed = parseCustomerContact(customer?.kontak);
  const bankInfo =
    pengaturan.billingBankInfo?.trim() ||
    DEFAULT_PENGATURAN.billingBankInfo ||
    `Rekening resmi ${identity.companyName}`;
  const adminName = pengaturan.adminName?.trim() || `Admin Billing ${identity.brandName}`;

  const itemLines = auto.billingItems.map(
    (it, idx) =>
      `${idx + 1}. ${it.deskripsi} (${it.qty} ${it.satuan}) = ${formatRupiah(
        it.qty * it.hargaSatuan
      )}`
  );

  const subject = `Surat Penagihan Jasa PPJK ${auto.billingNomor} - ${shipment.namaCustomer} (${shipment.kodeOs})`;
  const message = [
    `Yth. Finance / Bagian Import ${shipment.namaCustomer},`,
    ``,
    `Bersama ini kami sampaikan Surat Penagihan Jasa PPJK (${identity.companyName}) & Pengeluaran Kontainer:`,
    `- No. Surat Penagihan : ${auto.billingNomor}`,
    `- Tanggal / Jatuh Tempo : ${auto.billingTanggal} / s.d. ${auto.billingJatuhTempo}`,
    `- Referensi OS / B/L : ${shipment.kodeOs} / ${shipment.noBl || '-'}`,
    `- No. Kontainer : ${shipment.noCont || '-'}`,
    `- Status : ${getBillingEligibilityReason(shipment)}`,
    ``,
    `Rincian Tagihan:`,
    ...itemLines,
    `PPN ${auto.billingPpnPersen}% + Total Tagihan : *${formatRupiah(auto.billingTotal)}*`,
    ``,
    `Pembayaran mohon ditransfer ke:`,
    `${bankInfo}`,
    ``,
    `Hormat kami,`,
    `${adminName} — ${identity.brandName}`,
  ].join('\n');

  const whatsappUrl = parsed.whatsappDigits
    ? `https://wa.me/${parsed.whatsappDigits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  const mailtoUrl = `mailto:${encodeURIComponent(parsed.email)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(message)}`;

  return {
    subject,
    message,
    whatsappUrl,
    mailtoUrl,
    customerPhone: parsed.phone,
    customerEmail: parsed.email,
  };
}

export function computeBillingSummary(shipments: Shipment[]): BillingSummary {
  let eligibleCount = 0;
  let siapInfoOwnerCount = 0;
  let ownerNotifiedCount = 0;
  let terbitCount = 0;
  let terkirimCustomerCount = 0;
  let lunasCount = 0;
  let totalNominal = 0;
  let totalLunasNominal = 0;

  for (const s of shipments) {
    if (!isShipmentBillingEligible(s)) continue;
    eligibleCount++;
    const auto = buildAutoBillingFields(s);
    const st = auto.billingStatus;
    totalNominal += auto.billingTotal;

    if (st === 'Siap Info Owner') siapInfoOwnerCount++;
    else if (st === 'Info Owner Terkirim') ownerNotifiedCount++;
    else if (st === 'Penagihan Terbit') terbitCount++;
    else if (st === 'Terkirim ke Customer') terkirimCustomerCount++;
    else if (st === 'Lunas') {
      lunasCount++;
      totalLunasNominal += auto.billingTotal;
    }
  }

  return {
    eligibleCount,
    siapInfoOwnerCount,
    ownerNotifiedCount,
    terbitCount,
    terkirimCustomerCount,
    lunasCount,
    totalNominal,
    totalLunasNominal,
  };
}

export function filterBillingShipments(
  shipments: Shipment[],
  criteria: {
    search?: string;
    status?: '' | StatusPenagihanType;
    onlyEligible?: boolean;
  }
): Shipment[] {
  const q = (criteria.search || '').trim().toLowerCase();
  return shipments.filter((s) => {
    const eligible = isShipmentBillingEligible(s);
    if (criteria.onlyEligible !== false && !eligible) return false;
    const st = normalizeStatusPenagihan(s.billingStatus, s);
    if (criteria.status && st !== criteria.status) return false;
    if (q) {
      const hay = [
        s.kodeOs,
        s.namaCustomer,
        s.kodeCustomer,
        s.noBl,
        s.noCont,
        s.noSppb,
        s.suratJalanNomor || '',
        s.billingNomor || generateSuratPenagihanNomor(s.kodeOs),
        st,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// =============================================================================
// Summary Kode Importir untuk Modul Semua Shipment
// =============================================================================

export function formatCurrencyTotals(
  totals: Array<{ currency: string; amount: number }>
): string {
  if (!totals || totals.length === 0) return '-';
  return totals
    .map(
      (t) =>
        `${t.currency} ${new Intl.NumberFormat('en-US', {
          maximumFractionDigits: 2,
        }).format(t.amount)}`
    )
    .join(' · ');
}

export function parseBmPdriAmount(raw?: string | number | null): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }
  const str = String(raw ?? '')
    .replace(/rp|idr/gi, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9.,]/g, '');
  if (!str || !/\d/.test(str)) return 0;

  const hasDot = str.includes('.');
  const hasComma = str.includes(',');
  let normalized = str;

  if (hasDot && hasComma) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      normalized = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      normalized = str.replace(/,/g, '');
    }
  } else if (hasDot) {
    const dotParts = str.split('.');
    if (dotParts.length > 2 || (dotParts.length === 2 && dotParts[1].length === 3)) {
      normalized = str.replace(/\./g, '');
    }
  } else if (hasComma) {
    const commaParts = str.split(',');
    if (commaParts.length > 2 || (commaParts.length === 2 && commaParts[1].length === 3)) {
      normalized = str.replace(/,/g, '');
    } else {
      normalized = str.replace(/,/g, '.');
    }
  }

  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

export function computeImportirSummaries(
  shipments: Shipment[],
  importirs: Importir[] = [],
  checklistItems: string[] = DEFAULT_CHECKLIST_ITEMS,
  referenceDate: Date = new Date()
): ImportirGlobalSummary {
  const nameLookup = new Map<string, string>();
  for (const imp of importirs) {
    const k = (imp.kodeImportir || '').trim();
    if (k) {
      nameLookup.set(k.toUpperCase(), imp.namaImportir || '-');
    }
  }

  const grouped = new Map<string, Shipment[]>();
  for (const s of shipments) {
    const code = (s.kodeImportir || '').trim() || 'Belum Diisi';
    const arr = grouped.get(code) || [];
    arr.push(s);
    grouped.set(code, arr);
  }

  let totalDraft = 0;
  let totalReady = 0;
  let totalOutstanding = 0;
  let totalCompleted = 0;
  let totalSppb = 0;
  let totalGateOut = 0;
  let totalProcessSignal = 0;
  let totalBmPdri = 0;

  const items: ImportirSummaryItem[] = Array.from(grouped.entries()).map(
    ([kodeImportir, list]) => {
      let draftCount = 0;
      let readyCount = 0;
      let outstanding = 0;
      let sppbCount = 0;
      let gateOutCount = 0;
      let processSignalCount = 0;
      let bmPdriTotal = 0;
      const byJalur: Record<string, number> = {
        Hijau: 0,
        Kuning: 0,
        Merah: 0,
        MITA: 0,
        'Belum Ada': 0,
      };
      const customerSet = new Set<string>();

      for (const s of list) {
        if (normalizeStatusDokumen(s.statusDokumen) === 'Ready') {
          readyCount++;
          totalReady++;
        } else {
          draftCount++;
          totalDraft++;
        }

        if (isShipmentOutstanding(s, checklistItems)) {
          outstanding++;
          totalOutstanding++;
        } else {
          totalCompleted++;
        }

        if (isSppbReadyForGateOut(s)) {
          sppbCount++;
          totalSppb++;
        }
        if (isContainerGateOut(s)) {
          gateOutCount++;
          totalGateOut++;
        }
        if (getShipmentProcessSignal(s, referenceDate).active) {
          processSignalCount++;
          totalProcessSignal++;
        }

        const jKey = s.jalur || 'Belum Ada';
        byJalur[jKey] = (byJalur[jKey] || 0) + 1;

        if (s.namaCustomer?.trim()) {
          customerSet.add(s.namaCustomer.trim());
        }

        const bmVal = parseBmPdriAmount(s.bmPdri);
        if (bmVal > 0) {
          bmPdriTotal += bmVal;
          totalBmPdri += bmVal;
        }
      }

      const resolvedName =
        kodeImportir === 'Belum Diisi'
          ? 'Kode Importir Belum Diisi'
          : nameLookup.get(kodeImportir.toUpperCase()) || 'Importir Non-Master';

      return {
        kodeImportir,
        namaImportir: resolvedName,
        total: list.length,
        draftCount,
        readyCount,
        outstanding,
        completed: list.length - outstanding,
        sppbCount,
        gateOutCount,
        processSignalCount,
        byJalur,
        bmPdriTotal,
        customerNames: Array.from(customerSet).sort(),
      };
    }
  );

  items.sort((a, b) => {
    if (a.kodeImportir === 'Belum Diisi' && b.kodeImportir !== 'Belum Diisi') return 1;
    if (b.kodeImportir === 'Belum Diisi' && a.kodeImportir !== 'Belum Diisi') return -1;
    if (b.total !== a.total) return b.total - a.total;
    return a.kodeImportir.localeCompare(b.kodeImportir);
  });

  return {
    totalImportirs: items.filter((i) => i.kodeImportir !== 'Belum Diisi').length,
    totalShipments: shipments.length,
    totalDraft,
    totalReady,
    totalOutstanding,
    totalCompleted,
    totalSppb,
    totalGateOut,
    totalProcessSignal,
    totalBmPdri,
    items,
  };
}

// =============================================================================
// Pengamanan PIN Khusus Modul Kode GAS (Deploy) di Master & Pengaturan
// =============================================================================

export const DEFAULT_GAS_DEPLOY_PIN = '250888';

export function validateGasPinFormat(pin: string): { valid: boolean; error?: string } {
  const clean = (pin || '').trim();
  if (!clean) {
    return { valid: false, error: 'PIN khusus Kode GAS wajib diisi.' };
  }
  if (clean.length < 6 || clean.length > 12) {
    return {
      valid: false,
      error: 'PIN khusus Kode GAS harus terdiri dari 6 hingga 12 karakter.',
    };
  }
  if (!/^[A-Za-z0-9]{6,12}$/.test(clean)) {
    return {
      valid: false,
      error: 'PIN khusus Kode GAS hanya boleh berisi angka atau huruf tanpa spasi/simbol.',
    };
  }
  return { valid: true };
}

export async function computeGasPinHash(pin: string): Promise<string> {
  return computeSha256Hex(`ptg_ppjk_gas_pin_v1::${(pin || '').trim()}`);
}

export async function verifyGasDeployPin(
  inputPin: string,
  storedPinHash?: string
): Promise<boolean> {
  const clean = (inputPin || '').trim();
  if (!clean) return false;
  const candidateHash = await computeGasPinHash(clean);
  const expectedHash =
    storedPinHash && storedPinHash.trim()
      ? storedPinHash.trim()
      : await computeGasPinHash(DEFAULT_GAS_DEPLOY_PIN);
  return candidateHash === expectedHash;
}

// =============================================================================
// Report Rekapan Dokumen Berdasarkan No. NOPEN / Nomor Pendaftaran PIB
// =============================================================================

function formatLocalDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthKey(refDate: Date = new Date()): string {
  const y = refDate.getFullYear();
  const m = String(refDate.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getPreviousMonthKey(refDate: Date = new Date()): string {
  const prev = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
  return getCurrentMonthKey(prev);
}

export function getMonthDateBounds(monthKey: string): { dateFrom: string; dateTo: string } {
  const match = /^(\d{4})-(\d{2})$/.exec((monthKey || '').trim());
  if (!match) {
    const fallback = getCurrentMonthKey();
    return getMonthDateBounds(fallback);
  }
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  return {
    dateFrom: `${match[1]}-${match[2]}-01`,
    dateTo: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function getRelativeDateRange(
  daysBack: number,
  refDate: Date = new Date()
): { dateFrom: string; dateTo: string } {
  const end = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const start = new Date(end.getTime());
  start.setDate(end.getDate() - Math.max(0, daysBack - 1));
  return {
    dateFrom: formatLocalDateYmd(start),
    dateTo: formatLocalDateYmd(end),
  };
}

const BULAN_ID_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function formatIndoShortDate(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd || '').trim());
  if (!match) return ymd || '-';
  const monthIdx = Number(match[2]) - 1;
  const monthShort = (BULAN_ID_NAMES[monthIdx] || match[2]).slice(0, 3);
  return `${match[3]} ${monthShort} ${match[1]}`;
}

export function resolveNopenDateRange(criteria: NopenRecapCriteria): {
  dateFrom: string;
  dateTo: string;
  monthKey: string;
} {
  if (criteria.periodMode === 'month') {
    const monthKey = /^\d{4}-\d{2}$/.test((criteria.month || '').trim())
      ? (criteria.month || '').trim()
      : getCurrentMonthKey();
    const bounds = getMonthDateBounds(monthKey);
    return { ...bounds, monthKey };
  }

  let from = (criteria.dateFrom || '').trim();
  let to = (criteria.dateTo || '').trim();
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  return {
    dateFrom: from,
    dateTo: to,
    monthKey: from ? from.slice(0, 7) : to ? to.slice(0, 7) : getCurrentMonthKey(),
  };
}

export function formatNopenPeriodLabel(criteria: NopenRecapCriteria): string {
  const resolved = resolveNopenDateRange(criteria);
  if (criteria.periodMode === 'month') {
    const m = /^(\d{4})-(\d{2})$/.exec(resolved.monthKey);
    if (m) {
      const monthName = BULAN_ID_NAMES[Number(m[2]) - 1] || m[2];
      return `Bulan ${monthName} ${m[1]} (${formatIndoShortDate(resolved.dateFrom)} – ${formatIndoShortDate(resolved.dateTo)})`;
    }
    return `Bulan ${resolved.monthKey}`;
  }

  if (resolved.dateFrom && resolved.dateTo) {
    return `${formatIndoShortDate(resolved.dateFrom)} s/d ${formatIndoShortDate(resolved.dateTo)}`;
  }
  if (resolved.dateFrom) {
    return `Mulai ${formatIndoShortDate(resolved.dateFrom)}`;
  }
  if (resolved.dateTo) {
    return `Sampai ${formatIndoShortDate(resolved.dateTo)}`;
  }
  return 'Semua Tanggal';
}

export function hasSptnpIssue(s: Shipment): boolean {
  const sptnpText = (s.sptnp || '').trim().toLowerCase();
  const hasFlag = sptnpText !== '' && sptnpText !== 'tidak' && sptnpText !== '-';
  return hasFlag || Boolean((s.noSptnp || '').trim());
}

export function filterNopenRecapShipments(
  shipments: Shipment[],
  criteria: NopenRecapCriteria
): Shipment[] {
  const resolved = resolveNopenDateRange(criteria);
  const includeWithoutNopen = Boolean(criteria.includeWithoutNopen);
  const q = (criteria.search || '').trim().toLowerCase();

  const filtered = shipments.filter((s) => {
    const nopenCode = (s.nopen || '').trim();
    const hasNopen = nopenCode !== '';
    if (!includeWithoutNopen && !hasNopen) {
      return false;
    }

    const effectiveDate = hasNopen
      ? (s.tglNopen || '').trim() || (s.tglAju || '').trim()
      : (s.tglNopen || '').trim() ||
        (s.tglAju || '').trim() ||
        (s.tglTerimaDok || '').trim() ||
        (s.eta || '').trim();

    if (!effectiveDate) {
      if (!includeWithoutNopen) return false;
      if (resolved.dateFrom || resolved.dateTo) return false;
    } else {
      if (resolved.dateFrom && effectiveDate < resolved.dateFrom) return false;
      if (resolved.dateTo && effectiveDate > resolved.dateTo) return false;
    }

    if (criteria.filterJalur === '__EMPTY__') {
      if ((s.jalur || '') !== '') return false;
    } else if (criteria.filterJalur && s.jalur !== criteria.filterJalur) {
      return false;
    }

    if (criteria.filterStatus && s.status !== criteria.filterStatus) {
      return false;
    }

    if (criteria.filterImportir) {
      const impCode = (s.kodeImportir || '').trim() || 'Belum Diisi';
      if (impCode.toUpperCase() !== criteria.filterImportir.trim().toUpperCase()) {
        return false;
      }
    }

    if (q) {
      const hay = [
        s.nopen,
        s.tglNopen,
        s.noAju,
        s.tglAju,
        s.kodeOs,
        s.namaCustomer,
        s.kodeCustomer,
        s.kodeImportir,
        s.noBl,
        s.noCont,
        s.noSppb,
        s.shipper,
        s.description,
        s.dokumenChecker,
        s.jalur,
        s.status,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    const aHas = (a.nopen || '').trim() !== '';
    const bHas = (b.nopen || '').trim() !== '';
    if (aHas !== bHas) return aHas ? -1 : 1;
    const dateA = (a.tglNopen || a.tglAju || a.tglTerimaDok || '').trim();
    const dateB = (b.tglNopen || b.tglAju || b.tglTerimaDok || '').trim();
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    const nopenCmp = (a.nopen || '').localeCompare(b.nopen || '');
    if (nopenCmp !== 0) return nopenCmp;
    return a.kodeOs.localeCompare(b.kodeOs);
  });
}

export function computeNopenRecapSummary(
  matchedShipments: Shipment[],
  importirs: Importir[] = [],
  checklistItems: string[] = DEFAULT_CHECKLIST_ITEMS,
  criteria: NopenRecapCriteria
): NopenRecapSummary {
  const resolved = resolveNopenDateRange(criteria);
  const impLookup = new Map<string, string>();
  for (const imp of importirs) {
    const k = (imp.kodeImportir || '').trim();
    if (k) impLookup.set(k.toUpperCase(), imp.namaImportir || '-');
  }

  let totalWithNopen = 0;
  let totalWithoutNopen = 0;
  let totalSppb = 0;
  let totalGateOut = 0;
  let totalSelesai = 0;
  let totalOutstanding = 0;
  let totalSptnp = 0;

  const byJalur: Record<string, number> = {
    Hijau: 0,
    Kuning: 0,
    Merah: 0,
    MITA: 0,
    'Belum Ada': 0,
  };
  let totalBmPdri = 0;

  const dayMap = new Map<
    string,
    {
      count: number;
      sppbCount: number;
      gateOutCount: number;
      sptnpCount: number;
      byJalur: Record<string, number>;
    }
  >();

  const impMap = new Map<
    string,
    {
      count: number;
      sppbCount: number;
      gateOutCount: number;
      bmPdriTotal: number;
    }
  >();

  for (const s of matchedShipments) {
    const hasNopen = (s.nopen || '').trim() !== '';
    if (hasNopen) totalWithNopen++;
    else totalWithoutNopen++;

    const sppbOk = isSppbReadyForGateOut(s);
    const gateOutOk = isContainerGateOut(s);
    const sptnpOk = hasSptnpIssue(s);
    const outstandingOk = isShipmentOutstanding(s, checklistItems);

    if (sppbOk) totalSppb++;
    if (gateOutOk) totalGateOut++;
    if (s.status === 'Selesai') totalSelesai++;
    if (outstandingOk) totalOutstanding++;
    if (sptnpOk) totalSptnp++;

    const jalurKey = s.jalur || 'Belum Ada';
    byJalur[jalurKey] = (byJalur[jalurKey] || 0) + 1;

    const bmVal = parseBmPdriAmount(s.bmPdri);
    if (bmVal > 0) {
      totalBmPdri += bmVal;
    }

    const dayKey =
      (s.tglNopen || '').trim() ||
      (s.tglAju || '').trim() ||
      (s.tglTerimaDok || '').trim() ||
      'Belum Ada Tanggal';
    const dayEntry = dayMap.get(dayKey) || {
      count: 0,
      sppbCount: 0,
      gateOutCount: 0,
      sptnpCount: 0,
      byJalur: { Hijau: 0, Kuning: 0, Merah: 0, MITA: 0, 'Belum Ada': 0 },
    };
    dayEntry.count++;
    if (sppbOk) dayEntry.sppbCount++;
    if (gateOutOk) dayEntry.gateOutCount++;
    if (sptnpOk) dayEntry.sptnpCount++;
    dayEntry.byJalur[jalurKey] = (dayEntry.byJalur[jalurKey] || 0) + 1;
    dayMap.set(dayKey, dayEntry);

    const impCode = (s.kodeImportir || '').trim() || 'Belum Diisi';
    const impEntry = impMap.get(impCode) || {
      count: 0,
      sppbCount: 0,
      gateOutCount: 0,
      bmPdriTotal: 0,
    };
    impEntry.count++;
    if (sppbOk) impEntry.sppbCount++;
    if (gateOutOk) impEntry.gateOutCount++;
    if (bmVal > 0) {
      impEntry.bmPdriTotal += bmVal;
    }
    impMap.set(impCode, impEntry);
  }

  const byDay: NopenDailyRecapItem[] = Array.from(dayMap.entries())
    .sort((a, b) => {
      if (a[0] === 'Belum Ada Tanggal') return 1;
      if (b[0] === 'Belum Ada Tanggal') return -1;
      return b[0].localeCompare(a[0]);
    })
    .map(([date, v]) => ({
      date,
      count: v.count,
      sppbCount: v.sppbCount,
      gateOutCount: v.gateOutCount,
      sptnpCount: v.sptnpCount,
      byJalur: v.byJalur,
    }));

  const byImportir: NopenImportirRecapItem[] = Array.from(impMap.entries())
    .sort((a, b) => {
      if (a[0] === 'Belum Diisi' && b[0] !== 'Belum Diisi') return 1;
      if (b[0] === 'Belum Diisi' && a[0] !== 'Belum Diisi') return -1;
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return a[0].localeCompare(b[0]);
    })
    .map(([kodeImportir, v]) => ({
      kodeImportir,
      namaImportir:
        kodeImportir === 'Belum Diisi'
          ? 'Kode Importir Belum Diisi'
          : impLookup.get(kodeImportir.toUpperCase()) || 'Importir Non-Master',
      count: v.count,
      sppbCount: v.sppbCount,
      gateOutCount: v.gateOutCount,
      bmPdriTotal: v.bmPdriTotal,
    }));

  return {
    periodMode: criteria.periodMode,
    periodLabel: formatNopenPeriodLabel(criteria),
    dateFrom: resolved.dateFrom,
    dateTo: resolved.dateTo,
    totalMatched: matchedShipments.length,
    totalWithNopen,
    totalWithoutNopen,
    totalSppb,
    totalGateOut,
    totalSelesai,
    totalOutstanding,
    totalSptnp,
    byJalur,
    totalBmPdri,
    byDay,
    byImportir,
  };
}

export interface ReconcileShipmentResult {
  shipment: Shipment;
  changed: boolean;
}

export interface ReconcileDatabaseDerivedResult {
  shipments: Shipment[];
  updatedShipmentsCount: number;
  seqByMonth: Record<string, number>;
  seqChanged: boolean;
  hasChanges: boolean;
}

/**
 * Menghitung ulang seluruh field turunan pada 1 shipment (countdown ETA, ringkasan kontainer,
 * normalisasi status dokumen/DO/gate-pass/trucking/gate-out, auto Surat Jalan & auto Penagihan).
 */
export function reconcileShipmentDerivedFields(
  shipment: Shipment,
  shipmentContainers: KontainerItem[] = [],
  referenceDate: Date = new Date()
): ReconcileShipmentResult {
  const todayIso = [
    referenceDate.getFullYear(),
    String(referenceDate.getMonth() + 1).padStart(2, '0'),
    String(referenceDate.getDate()).padStart(2, '0'),
  ].join('-');

  const normalizedGateOut = normalizeStatusGateOut(shipment.gateOutStatus, shipment.status);
  const sjPatch =
    normalizedGateOut === 'Sudah'
      ? buildAutoSuratJalanFields(
          shipment,
          shipment.gateOutTanggal || todayIso,
          shipment.updatedAt
        )
      : {
          suratJalanNomor: shipment.suratJalanNomor || '',
          suratJalanTanggal: shipment.suratJalanTanggal || '',
          suratJalanStatus: normalizeStatusSuratJalan(
            shipment.suratJalanStatus,
            normalizedGateOut,
            shipment.status
          ),
          suratJalanTujuan: shipment.suratJalanTujuan || '',
          suratJalanUpdatedAt: shipment.suratJalanUpdatedAt || '',
        };

  const nextNoCont =
    shipmentContainers.length > 0
      ? formatContainerSummary(shipmentContainers)
      : shipment.noCont || '-';

  const normalizedBase: Shipment = {
    ...shipment,
    noCont: nextNoCont,
    statusDokumen: normalizeStatusDokumen(shipment.statusDokumen),
    doPelayaranStatus: normalizeStatusDoPelayaran(shipment.doPelayaranStatus),
    doGatePassStatus: normalizeStatusGatePass(shipment.doGatePassStatus),
    doGatePassJenis: normalizeGatePassJenis(shipment.doGatePassJenis),
    truckingStatus: normalizeStatusTrucking(shipment.truckingStatus),
    gateOutStatus: normalizedGateOut,
    ...sjPatch,
    countDownEta: calculateCountdownEta(shipment.eta, referenceDate),
  };

  let finalShipment: Shipment;
  if (isShipmentBillingEligible(normalizedBase)) {
    const autoBill = buildAutoBillingFields(normalizedBase, todayIso);
    finalShipment = {
      ...normalizedBase,
      ...autoBill,
    };
  } else {
    finalShipment = {
      ...normalizedBase,
      billingStatus: normalizeStatusPenagihan(shipment.billingStatus, normalizedBase),
    };
  }

  const changed =
    finalShipment.countDownEta !== shipment.countDownEta ||
    finalShipment.noCont !== shipment.noCont ||
    finalShipment.statusDokumen !== shipment.statusDokumen ||
    finalShipment.doPelayaranStatus !== shipment.doPelayaranStatus ||
    finalShipment.doGatePassStatus !== shipment.doGatePassStatus ||
    finalShipment.doGatePassJenis !== shipment.doGatePassJenis ||
    finalShipment.truckingStatus !== shipment.truckingStatus ||
    finalShipment.gateOutStatus !== shipment.gateOutStatus ||
    (finalShipment.suratJalanNomor || '') !== (shipment.suratJalanNomor || '') ||
    (finalShipment.suratJalanTanggal || '') !== (shipment.suratJalanTanggal || '') ||
    finalShipment.suratJalanStatus !== shipment.suratJalanStatus ||
    (finalShipment.billingNomor || '') !== (shipment.billingNomor || '') ||
    (finalShipment.billingTanggal || '') !== (shipment.billingTanggal || '') ||
    finalShipment.billingStatus !== shipment.billingStatus ||
    finalShipment.billingTotal !== shipment.billingTotal;

  return {
    shipment: finalShipment,
    changed,
  };
}

/**
 * Menjaga agar seqByMonth selalu sinkron minimal sama dengan nomor urut OS-YYMM-NNNN terbesar.
 */
export function reconcileSeqByMonth(
  shipments: Shipment[],
  seqByMonth: Record<string, number> = {}
): { seqByMonth: Record<string, number>; changed: boolean } {
  const nextSeq: Record<string, number> = { ...seqByMonth };
  let changed = false;

  for (const s of shipments) {
    const match = /^OS-(\d{4})-(\d+)$/i.exec((s.kodeOs || '').trim());
    if (!match) continue;
    const monthKey = match[1];
    const seqNum = Number.parseInt(match[2], 10);
    if (!Number.isFinite(seqNum)) continue;
    if ((nextSeq[monthKey] || 0) < seqNum) {
      nextSeq[monthKey] = seqNum;
      changed = true;
    }
  }

  return { seqByMonth: nextSeq, changed };
}

/**
 * Rekonsiliasi menyeluruh seluruh shipment & sequence penomoran saat refresh/sync database.
 */
export function reconcileAllShipmentsDerivedState(
  shipments: Shipment[],
  kontainers: KontainerItem[] = [],
  seqByMonth: Record<string, number> = {},
  referenceDate: Date = new Date()
): ReconcileDatabaseDerivedResult {
  const contByOs = new Map<string, KontainerItem[]>();
  for (const k of kontainers) {
    const key = (k.kodeOs || '').trim();
    if (!key) continue;
    const list = contByOs.get(key) || [];
    list.push(k);
    contByOs.set(key, list);
  }

  let updatedShipmentsCount = 0;
  const nextShipments = shipments.map((s) => {
    const related = contByOs.get((s.kodeOs || '').trim()) || [];
    const res = reconcileShipmentDerivedFields(s, related, referenceDate);
    if (res.changed) updatedShipmentsCount++;
    return res.shipment;
  });

  const seqRes = reconcileSeqByMonth(nextShipments, seqByMonth);

  return {
    shipments: nextShipments,
    updatedShipmentsCount,
    seqByMonth: seqRes.seqByMonth,
    seqChanged: seqRes.changed,
    hasChanges: updatedShipmentsCount > 0 || seqRes.changed,
  };
}

export interface PpjkIdentity {
  brandName: string;
  companyName: string;
  tagline: string;
  npwp: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  footerNote: string;
  logoDataUrl: string;
  logoFileName: string;
  kopSuratDataUrl: string;
  kopSuratFileName: string;
}

export function getPpjkIdentity(pengaturan?: Partial<Pengaturan> | null): PpjkIdentity {
  return {
    brandName:
      pengaturan?.ppjkBrandName?.trim() || DEFAULT_PENGATURAN.ppjkBrandName || 'PTG PPJK',
    companyName:
      pengaturan?.ppjkCompanyName?.trim() ||
      DEFAULT_PENGATURAN.ppjkCompanyName ||
      'PT PTG Logistik Kepabeanan',
    tagline:
      pengaturan?.ppjkTagline?.trim() ||
      DEFAULT_PENGATURAN.ppjkTagline ||
      'Customs Brokerage & Import Tracking',
    npwp:
      pengaturan?.ppjkNpwp?.trim() ||
      DEFAULT_PENGATURAN.ppjkNpwp ||
      '01.234.567.8-041.000 · PPJK-040200/2026',
    address:
      pengaturan?.ppjkAddress?.trim() ||
      DEFAULT_PENGATURAN.ppjkAddress ||
      'Jl. Yos Sudarso Kav. 88, Tanjung Priok, Jakarta Utara 14350',
    phone:
      pengaturan?.ppjkPhone?.trim() || DEFAULT_PENGATURAN.ppjkPhone || '021-4390-8811',
    email:
      pengaturan?.ppjkEmail?.trim() ||
      DEFAULT_PENGATURAN.ppjkEmail ||
      'operasional@ptg-ppjk.co.id',
    website:
      pengaturan?.ppjkWebsite?.trim() ||
      DEFAULT_PENGATURAN.ppjkWebsite ||
      'https://ptg-ppjk.co.id',
    footerNote:
      pengaturan?.ppjkFooterNote?.trim() ||
      DEFAULT_PENGATURAN.ppjkFooterNote ||
      'Dokumen resmi operasional kepabeanan, D/O pelayaran, surat jalan & penagihan.',
    logoDataUrl: pengaturan?.ppjkLogoDataUrl?.trim() || '',
    logoFileName: pengaturan?.ppjkLogoFileName?.trim() || '',
    kopSuratDataUrl: pengaturan?.ppjkKopSuratDataUrl?.trim() || '',
    kopSuratFileName: pengaturan?.ppjkKopSuratFileName?.trim() || '',
  };
}

export type BrandingImageVariant = 'logo' | 'kop';

const ALLOWED_BRANDING_EXT_RE = /\.(png|jpe?g|webp|svg)$/i;

export function validateBrandingImageFile(file: {
  name: string;
  type?: string;
  size: number;
}): { valid: boolean; error?: string } {
  const mime = (file.type || '').toLowerCase();
  const isImageMime = mime.startsWith('image/');
  const hasImageExt = ALLOWED_BRANDING_EXT_RE.test(file.name || '');

  if (!isImageMime && !hasImageExt) {
    return {
      valid: false,
      error: 'Format file harus berupa gambar (PNG, JPG/JPEG, WebP, atau SVG).',
    };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'File gambar kosong atau tidak terbaca.' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return {
      valid: false,
      error: 'Ukuran file maksimal 10 MB sebelum kompresi otomatis.',
    };
  }
  return { valid: true };
}

export function computeFittedDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const safeW = Math.max(1, width || 1);
  const safeH = Math.max(1, height || 1);
  const scale = Math.min(1, maxWidth / safeW, maxHeight / safeH);
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

/**
 * Mengonversi dan mengoptimalkan file gambar Logo PT atau Kop Surat PPJK menjadi DataURL PNG/JPEG
 * agar kompatibel untuk tampilan UI, cetak PDF (jsPDF), penyimpanan offline, dan sinkronisasi Google Sheets.
 */
export async function prepareBrandingImageDataUrl(
  file: File,
  variant: BrandingImageVariant
): Promise<{ dataUrl: string; note?: string }> {
  const check = validateBrandingImageFile(file);
  if (!check.valid) {
    throw new Error(check.error || 'File gambar tidak valid.');
  }

  if (typeof window === 'undefined' || typeof FileReader === 'undefined') {
    throw new Error('Lingkungan browser tidak mendukung pembacaan file.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });

  if (!rawDataUrl || typeof document === 'undefined') {
    return { dataUrl: rawDataUrl };
  }

  const SHEET_SAFE_CHAR_LIMIT = 44000;
  const maxWidth = variant === 'logo' ? 320 : 1200;
  const maxHeight = variant === 'logo' ? 320 : 340;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('File gambar tidak dapat dirender.'));
      el.src = rawDataUrl;
    });

    const renderCanvas = (
      w: number,
      h: number,
      mime: 'image/png' | 'image/jpeg',
      quality?: number
    ): string => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return rawDataUrl;
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      return mime === 'image/png'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', quality ?? 0.82);
    };

    const dim1 = computeFittedDimensions(img.width, img.height, maxWidth, maxHeight);
    // Try PNG first to preserve logo transparency or crisp kop typography
    const pngDataUrl = renderCanvas(dim1.width, dim1.height, 'image/png');
    if (pngDataUrl.length <= SHEET_SAFE_CHAR_LIMIT) {
      return { dataUrl: pngDataUrl };
    }

    // Try slightly smaller PNG for transparent logo
    if (variant === 'logo') {
      const dimSmall = computeFittedDimensions(img.width, img.height, 200, 200);
      const smallPng = renderCanvas(dimSmall.width, dimSmall.height, 'image/png');
      if (smallPng.length <= SHEET_SAFE_CHAR_LIMIT) {
        return { dataUrl: smallPng };
      }
    }

    // Fallback to white-backed JPEG with adaptive quality so it fits Google Sheets & PDF cleanly
    for (const q of [0.85, 0.72, 0.58]) {
      const jpgDataUrl = renderCanvas(dim1.width, dim1.height, 'image/jpeg', q);
      if (jpgDataUrl.length <= SHEET_SAFE_CHAR_LIMIT) {
        return { dataUrl: jpgDataUrl };
      }
    }

    const dimCompact = computeFittedDimensions(
      img.width,
      img.height,
      variant === 'logo' ? 220 : 900,
      variant === 'logo' ? 220 : 260
    );
    const compactJpg = renderCanvas(dimCompact.width, dimCompact.height, 'image/jpeg', 0.65);
    return {
      dataUrl: compactJpg,
      note:
        compactJpg.length > SHEET_SAFE_CHAR_LIMIT
          ? 'Gambar tersimpan di lokal/IndexedDB (resolusi besar untuk cetak tajam).'
          : undefined,
    };
  } catch {
    if (rawDataUrl.startsWith('data:image/') && !rawDataUrl.startsWith('data:image/svg')) {
      return { dataUrl: rawDataUrl };
    }
    throw new Error('Gagal memproses file gambar. Pastikan file PNG/JPG/WebP/SVG valid.');
  }
}

export interface AppModuleMeta {
  id: AppView;
  label: string;
  shortLabel: string;
  description: string;
  category: 'Operasional' | 'Monitoring & Report' | 'Administrasi';
  ownerExclusive?: boolean;
}

export const APP_MODULE_META: AppModuleMeta[] = [
  {
    id: 'dashboard',
    label: 'Dashboard Ringkasan',
    shortLabel: 'Dashboard',
    description: 'Ringkasan KPI, grafik jalur kepabeanan, tabel inti checker & aktivitas.',
    category: 'Monitoring & Report',
  },
  {
    id: 'outstanding',
    label: 'Dokumen Outstanding',
    shortLabel: 'Outstanding',
    description: 'Pantau dokumen impor yang belum SPPB / belum lengkap.',
    category: 'Operasional',
  },
  {
    id: 'checker',
    label: 'Rekap Checker',
    shortLabel: 'Rekap Checker',
    description: 'Monitor beban dokumen Draft/Ready & penyelesaian per checker.',
    category: 'Monitoring & Report',
  },
  {
    id: 'do',
    label: 'Kesiapan D/O Pelayaran',
    shortLabel: 'Kesiapan D/O',
    description: 'Tracking D/O pelayaran, masa berlaku, Eslah/TILA & kesiapan trucking.',
    category: 'Operasional',
  },
  {
    id: 'surat-jalan',
    label: 'Surat Jalan & Gate-Out',
    shortLabel: 'Surat Jalan',
    description: 'Terbit surat jalan otomatis pasca Gate-Out & status pengiriman armada.',
    category: 'Operasional',
  },
  {
    id: 'penagihan',
    label: 'Penagihan & Info Owner',
    shortLabel: 'Penagihan & Owner',
    description: 'Notifikasi WA/Email ke Owner serta penerbitan Surat Penagihan customer.',
    category: 'Operasional',
  },
  {
    id: 'keuangan-ops',
    label: 'Keuangan Pengeluaran Ops',
    shortLabel: 'Keuangan Ops',
    description:
      'Catat biaya operasional per dokumen OS, tanda terima petugas ops & bukti pembayaran.',
    category: 'Operasional',
  },
  {
    id: 'shipments',
    label: 'Semua Data Shipment',
    shortLabel: 'Semua Shipment',
    description: 'Tabel lengkap 39 kolom data shipment, ekspor & detail transaksi.',
    category: 'Operasional',
  },
  {
    id: 'report-nopen',
    label: 'Report NOPEN (PIB)',
    shortLabel: 'Report NOPEN',
    description: 'Rekap bulanan dan rentang tanggal berdasarkan No. NOPEN & nilai BM/PDRI.',
    category: 'Monitoring & Report',
  },
  {
    id: 'master',
    label: 'Master & Pengaturan',
    shortLabel: 'Master & Pengaturan',
    description: 'Master Customer, Importir, Shipper, User, Spreadsheet DB & Kode GAS.',
    category: 'Administrasi',
  },
  {
    id: 'setup',
    label: 'Setup Identitas & Kontrol Owner',
    shortLabel: 'Setup & Kontrol',
    description: 'Identitas PPJK, kontrol toggle modul per peran/user & pemantauan aktivitas.',
    category: 'Administrasi',
    ownerExclusive: true,
  },
];

export function getDefaultModuleAccessForRole(role: UserRole): ModulePermissionsMap {
  if (role === 'Owner') {
    return {
      dashboard: true,
      outstanding: true,
      checker: true,
      do: true,
      'surat-jalan': true,
      penagihan: true,
      'keuangan-ops': true,
      shipments: true,
      'report-nopen': true,
      master: true,
      setup: true,
    };
  }
  if (role === 'Admin') {
    return {
      dashboard: true,
      outstanding: true,
      checker: true,
      do: true,
      'surat-jalan': true,
      penagihan: true,
      'keuangan-ops': true,
      shipments: true,
      'report-nopen': true,
      master: true,
      setup: false,
    };
  }
  if (role === 'Checker' || role === 'Dokumen/Checker') {
    return {
      dashboard: true,
      outstanding: true,
      checker: true,
      do: true,
      'surat-jalan': true,
      penagihan: true,
      'keuangan-ops': true,
      shipments: true,
      'report-nopen': true,
      master: true,
      setup: false,
    };
  }
  return {
    dashboard: true,
    outstanding: true,
    checker: true,
    do: true,
    'surat-jalan': true,
    penagihan: true,
    'keuangan-ops': true,
    shipments: true,
    'report-nopen': true,
    master: false,
    setup: false,
  };
}

export function resolveUserModuleAccess(
  user: { role: UserRole; modulePermissions?: ModulePermissionsMap },
  pengaturan?: Pick<Pengaturan, 'roleModuleAccess'> | null
): ModulePermissionsMap {
  if (user.role === 'Owner') {
    return getDefaultModuleAccessForRole('Owner');
  }
  const roleDefault = getDefaultModuleAccessForRole(user.role);
  const roleKey = user.role === 'Dokumen/Checker' ? 'Checker' : user.role;
  const rolePolicy = pengaturan?.roleModuleAccess?.[roleKey] || {};
  const userOverrides = user.modulePermissions || {};

  const resolved: ModulePermissionsMap = {};
  for (const mod of APP_MODULE_META) {
    if (mod.id === 'setup') {
      // Modul Setup & Kontrol Owner bisa dibuka Admin jika memang diizinkan rolePolicy/override (untuk lihat identitas), namun toggle tetap dikontrol Owner
      resolved.setup =
        typeof userOverrides.setup === 'boolean'
          ? userOverrides.setup
          : typeof rolePolicy.setup === 'boolean'
            ? rolePolicy.setup
            : roleDefault.setup ?? false;
      continue;
    }
    if (typeof userOverrides[mod.id] === 'boolean') {
      resolved[mod.id] = userOverrides[mod.id];
    } else if (typeof rolePolicy[mod.id] === 'boolean') {
      resolved[mod.id] = rolePolicy[mod.id];
    } else {
      resolved[mod.id] = roleDefault[mod.id] ?? true;
    }
  }
  return resolved;
}

export function canUserAccessModule(
  user: { role: UserRole; modulePermissions?: ModulePermissionsMap },
  moduleId: AppView,
  pengaturan?: Pick<Pengaturan, 'roleModuleAccess'> | null
): boolean {
  if (user.role === 'Owner') return true;
  const resolved = resolveUserModuleAccess(user, pengaturan);
  return resolved[moduleId] !== false;
}

export function getFirstAccessibleModule(
  user: { role: UserRole; modulePermissions?: ModulePermissionsMap },
  pengaturan?: Pick<Pengaturan, 'roleModuleAccess'> | null
): AppView | null {
  const resolved = resolveUserModuleAccess(user, pengaturan);
  for (const mod of APP_MODULE_META) {
    if (resolved[mod.id]) return mod.id;
  }
  return null;
}

export interface UserMonitoringRow {
  user: UserAccount;
  resolvedModules: ModulePermissionsMap;
  enabledModulesCount: number;
  totalModulesCount: number;
  hasCustomModuleOverrides: boolean;
  resolvedPhases: PhasePermissions;
  activePhasesCount: number;
  activityCount: number;
  lastActivityAt: string;
  lastKodeOs: string;
}

export function buildUserMonitoringRows(
  users: UserAccount[],
  logs: LogPerubahan[],
  pengaturan?: Pick<Pengaturan, 'roleModuleAccess'> | null
): UserMonitoringRow[] {
  const activityMap = new Map<
    string,
    { count: number; lastAt: string; lastKodeOs: string }
  >();
  for (const log of logs) {
    const key = (log.user || '').trim().toLowerCase();
    if (!key) continue;
    const prev = activityMap.get(key) || { count: 0, lastAt: '', lastKodeOs: '' };
    prev.count += 1;
    if (!prev.lastAt || (log.waktu && log.waktu > prev.lastAt)) {
      prev.lastAt = log.waktu;
      prev.lastKodeOs = log.kodeOs || '';
    }
    activityMap.set(key, prev);
  }

  return users.map((u) => {
    const resolvedModules = resolveUserModuleAccess(u, pengaturan);
    const controllableMods = APP_MODULE_META.filter((m) =>
      u.role === 'Owner' ? true : m.id !== 'setup'
    );
    const enabledModulesCount = controllableMods.filter((m) => resolvedModules[m.id]).length;
    const hasCustomModuleOverrides = Boolean(
      u.modulePermissions && Object.keys(u.modulePermissions).length > 0
    );
    const resolvedPhases = resolveUserPhasePermissions(u.role, u.phasePermissions);
    const activePhasesCount = (['phase1', 'phase2', 'phase3', 'phase4'] as const).filter(
      (k) => resolvedPhases[k]
    ).length;
    const stat = activityMap.get(u.username.toLowerCase()) || {
      count: 0,
      lastAt: '',
      lastKodeOs: '',
    };

    return {
      user: u,
      resolvedModules,
      enabledModulesCount,
      totalModulesCount: controllableMods.length,
      hasCustomModuleOverrides,
      resolvedPhases,
      activePhasesCount,
      activityCount: stat.count,
      lastActivityAt: stat.lastAt,
      lastKodeOs: stat.lastKodeOs,
    };
  });
}

export function validateAndDeleteUserRecord(
  users: UserAccount[],
  targetUsername: string,
  actor: { username: string; role: UserRole }
): { deletedUser: UserAccount; nextUsers: UserAccount[] } {
  if (!canPerformAction(actor.role, 'manage_users')) {
    throw new Error('Khusus Admin / Owner yang dapat menghapus akun user.');
  }

  const cleanTarget = (targetUsername || '').trim();
  if (!cleanTarget) {
    throw new Error('Username target tidak boleh kosong.');
  }

  const target = users.find(
    (u) => u.username.trim().toLowerCase() === cleanTarget.toLowerCase()
  );
  if (!target) {
    throw new Error(`User "${cleanTarget}" tidak ditemukan.`);
  }

  if (target.username.trim().toLowerCase() === (actor.username || '').trim().toLowerCase()) {
    throw new Error('Anda tidak dapat menghapus akun Anda sendiri saat sedang login.');
  }

  if (target.role === 'Owner') {
    throw new Error('Akun Owner (Super Admin) tidak boleh dihapus.');
  }

  const nextUsers = users.filter(
    (u) => u.username.trim().toLowerCase() !== target.username.trim().toLowerCase()
  );

  return { deletedUser: target, nextUsers };
}




