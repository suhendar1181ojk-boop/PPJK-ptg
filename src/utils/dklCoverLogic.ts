import type {
  Importir,
  Pengaturan,
  PengeluaranOpsItem,
  Shipment,
} from '../types/ppjk';
import {
  extractVoyFromShip,
  formatTanggalIndonesia,
} from './kdiCoverLogic';
import { formatRupiahOps, hasBuktiPengeluaran, NON_OS_KODE } from './pengeluaranOpsLogic';
import { getPpjkIdentity, type PpjkIdentity } from './ppjkLogic';

export const DKL_STANDARD_EXPENSE_ROWS = [
  'BM/PDRI (PIB)',
  'SPTNP / Denda',
  'D/O & Pelayaran',
  'Handling / THC / Demurrage',
  'Trucking / Angkutan',
  'Pemeriksaan/Bhandle',
  'PFPD',
  'Penarikan Kontainer',
  'TILA / Eslah / Gate Pass',
  'Extra Lap.',
  'Jasa PPJK',
  'Lainnya',
] as const;

export type DklExpenseType = (typeof DKL_STANDARD_EXPENSE_ROWS)[number];

export interface DklCoverRow {
  no: number;
  jenisBiaya: DklExpenseType;
  ada: boolean;
  tanggal: string;
  petugasVia: string;
  nominal: number;
  keterangan: string;
  jumlahTransaksi: number;
}

export interface DklCoverOptions {
  importirs?: Importir[];
  pengaturan?: Pengaturan;
  pengeluaranOps?: PengeluaranOpsItem[];
  voy?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  koordinatorLapangan?: string;
  noReferensiDkl?: string;
  diserahkanOleh?: string;
  fillAutoStatus?: boolean;
  customRows?: DklCoverRow[];
}

export interface DklCoverDocument {
  identity: PpjkIdentity;
  kodeOs: string;
  subtitleLine: string;
  containerNo: string;
  blNo: string;
  blTanggal: string;
  shipper: string;
  customer: string;
  commodity: string;
  consignee: string;
  vessel: string;
  voy: string;
  etd: string;
  eta: string;
  portOfLoading: string;
  portOfDischarge: string;
  noPengajuanPib: string;
  tglPengajuanPib: string;
  noPib: string;
  tglPib: string;
  pfpb: string;
  tglPfpb: string;
  pfpd: string;
  tglPfpd: string;
  sptnpNo: string;
  tglSptnp: string;
  sppbNo: string;
  tglSppb: string;
  eslahOleh: string;
  tglEslah: string;
  truckingSupir: string;
  nopol: string;
  noReferensiDkl: string;
  koordinatorLapangan: string;
  diserahkanOleh: string;
  tanggalCetak: string;
  rows: DklCoverRow[];
  totalNominal: number;
  totalSudahDibayar: number;
  totalKasbon: number;
  totalSelesai: number;
  totalTransaksi: number;
  totalTanpaBukti: number;
  bmPdriReferensi: string;
  billingTotalReferensi: number;
}

/**
 * Mengklasifikasikan 1 item PengeluaranOpsItem ke dalam salah satu dari 12 jenis biaya
 * Lembaran Dasi Dana Kerja Lapangan (DKL) yang selaras dengan kategori Pengeluaran OPS.
 */
export function classifyOpsItemToDklRow(
  item: Pick<PengeluaranOpsItem, 'kategori' | 'keterangan'>
): DklExpenseType {
  const ket = (item.keterangan || '').toLowerCase();
  const kat = (item.kategori || '').trim();

  // 1. BM/PDRI (PIB)
  if (
    /\b(bm\/pdri|bm\s+pdri|pdri|bea\s+masuk|e-?billing\s+pib|pajak\s+impor)\b/i.test(ket) ||
    (/\bbm\b/i.test(ket) && /\bpib\b/i.test(ket))
  ) {
    return 'BM/PDRI (PIB)';
  }

  // 2. SPTNP / Denda
  if (
    /\b(sptnp|stpnp|notul|denda\s+pabean|kurang\s+bayar)\b/i.test(ket) ||
    kat === 'SPTNP / Denda'
  ) {
    return 'SPTNP / Denda';
  }

  // 3. TILA / Eslah / Gate Pass (dicek sebelum keyword TPS umum)
  if (
    /\b(eslah|estlah|tila|katu\s*get|kartu\s*gate|gate\s*pass|gatepass)\b/i.test(ket) ||
    kat === 'TILA / Eslah / Gate Pass'
  ) {
    return 'TILA / Eslah / Gate Pass';
  }

  // 4. Handling / THC / Demurrage
  if (
    kat === 'Handling / THC / Demurrage' ||
    /\b(demor+age|demur+age|detention|detensi|penumpukan|storage|sp2|thc|terminal\s+handling|sewa\s+lapangan|tps)\b/i.test(
      ket
    )
  ) {
    return 'Handling / THC / Demurrage';
  }

  // 5. D/O & Pelayaran
  if (
    kat === 'D/O & Pelayaran' ||
    /\b(tebus\s*d\/?o|perpanjangan\s*d\/?o|delivery\s+order)\b/i.test(ket) ||
    /(^|[\s,(])d\/?o([\s,.)]|$)/i.test(ket)
  ) {
    return 'D/O & Pelayaran';
  }

  // 6. PFPD
  if (/\bpfpd\b/i.test(ket)) {
    return 'PFPD';
  }

  // 7. Pemeriksaan/Bhandle
  if (
    kat === 'Karantina / Behandle Merah' ||
    /\b(behandle|bhandle|bhdl|pemeriksaan\s+fisik|periksa\s+fisik|jalur\s+merah|karantina|pfpb)\b/i.test(
      ket
    )
  ) {
    return 'Pemeriksaan/Bhandle';
  }

  // 8. Penarikan Kontainer (dicek sebelum Trucking / Angkutan)
  if (
    /\b(penarikan\s*(kontainer|container|cont)?|tarik\s*(kontainer|container|cont)|lift\s*(on|off)|list\s*off|empty\s+return)\b/i.test(
      ket
    )
  ) {
    return 'Penarikan Kontainer';
  }

  // 9. Trucking / Angkutan
  if (
    kat === 'Trucking / Angkutan' ||
    /\b(tracking|trucking|uang\s+jalan|trailer|armada|supir|sopir|angkutan|gate\s*-?\s*out)\b/i.test(
      ket
    )
  ) {
    return 'Trucking / Angkutan';
  }

  // 10. Jasa PPJK
  if (/\b(jasa\s+ppjk|ppjk|customs\s+clearance|biaya\s+admin\s+ppjk)\b/i.test(ket)) {
    return 'Jasa PPJK';
  }

  // 11. Extra Lap.
  if (
    kat === 'Jasa Lapangan / Ops' ||
    /\b(extra\s*lap|ekstra\s*lap|extra\s+lapangan|lembur|koordinasi\s+lap|uang\s+lapangan|operasional\s+lapangan)\b/i.test(
      ket
    )
  ) {
    return 'Extra Lap.';
  }

  // 12. Lainnya
  return 'Lainnya';
}

export function createPlaceholderNonOsShipment(): Shipment {
  const today = new Date().toISOString().slice(0, 10);
  return {
    kodeOs: NON_OS_KODE,
    ship: '-',
    kodeCustomer: 'UMUM',
    namaCustomer: 'Biaya Operasional Umum / Non-OS',
    tglTerimaDok: today,
    terimaDok: { items: {}, catatan: '' },
    noPackinglist: '',
    noBl: '-',
    etd: '',
    eta: '',
    countDownEta: null,
    noCont: '-',
    noAju: '',
    tglAju: '',
    status: 'Operasional Umum',
    nopen: '',
    tglNopen: '',
    jalur: '',
    kodeImportir: '',
    shipper: '-',
    description: 'Pengeluaran Operasional Lapangan Non-OS',
    negaraAsal: '',
    currency: 'IDR',
    kurs: '',
    invoice: '',
    bmPdri: '',
    sptnp: '',
    noSppb: '',
    tglSppb: '',
    dokumenChecker: '-',
    noSptnp: '',
    tglSptnp: '',
    pfpb: '',
    tglPfpb: '',
    pfpd: '',
    tglPfpd: '',
    eslah: '',
    tglEslah: '',
    dokumenOs: { items: {}, catatan: '' },
    createdAt: today,
    createdBy: 'system',
    updatedAt: today,
    updatedBy: 'system',
  };
}

export function recalculateDklTotals(
  rows: DklCoverRow[],
  matchedItems: PengeluaranOpsItem[] = []
): {
  totalNominal: number;
  totalSudahDibayar: number;
  totalKasbon: number;
  totalSelesai: number;
  totalTransaksi: number;
  totalTanpaBukti: number;
} {
  const totalNominal = rows.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
  let totalSudahDibayar = 0;
  let totalKasbon = 0;
  let totalSelesai = 0;
  let totalTanpaBukti = 0;

  for (const item of matchedItems) {
    const nom = Number(item.nominal) || 0;
    if (item.statusPengeluaran === 'Uang Muka / Kasbon') {
      totalKasbon += nom;
    } else if (item.statusPengeluaran === 'Sudah Dibayar') {
      totalSudahDibayar += nom;
    } else if (item.statusPengeluaran === 'Selesai / Dipertanggungjawabkan') {
      totalSelesai += nom;
    }
    if (!hasBuktiPengeluaran(item)) {
      totalTanpaBukti++;
    }
  }

  return {
    totalNominal,
    totalSudahDibayar,
    totalKasbon,
    totalSelesai,
    totalTransaksi: matchedItems.length,
    totalTanpaBukti,
  };
}

/**
 * Membangun data lengkap Lembar Dasi Dana Kerja Lapangan (DKL) per Dokumen OS
 * tersusun dari 13 jenis biaya pengeluaran sesuai pencatatan Keuangan Operasional.
 */
export function buildDklCoverDocument(
  shipment: Shipment,
  options: DklCoverOptions = {}
): DklCoverDocument {
  const identity = getPpjkIdentity(options.pengaturan);
  const fillAuto = options.fillAutoStatus !== false;
  const importirs = options.importirs || [];
  const allExpenses = options.pengeluaranOps || [];

  const osKey = (shipment.kodeOs || '').trim().toUpperCase();
  const matchedItems = allExpenses
    .filter((e) => (e.kodeOs || '').trim().toUpperCase() === osKey)
    .sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));

  const impMatch = importirs.find(
    (imp) =>
      (imp.kodeImportir || '').trim().toUpperCase() ===
      (shipment.kodeImportir || '').trim().toUpperCase()
  );

  const { vessel, voy: parsedVoy } = extractVoyFromShip(shipment.ship);
  const voy = options.voy !== undefined ? options.voy : parsedVoy;

  // Kelompokkan PengeluaranOpsItem ke 13 baris DKL
  const bucketMap = new Map<DklExpenseType, PengeluaranOpsItem[]>();
  for (const label of DKL_STANDARD_EXPENSE_ROWS) {
    bucketMap.set(label, []);
  }
  if (fillAuto) {
    for (const item of matchedItems) {
      const targetRow = classifyOpsItemToDklRow(item);
      bucketMap.get(targetRow)?.push(item);
    }
  }

  const defaultRows: DklCoverRow[] = DKL_STANDARD_EXPENSE_ROWS.map((jenisBiaya, idx) => {
    const bucket = bucketMap.get(jenisBiaya) || [];
    const nominal = bucket.reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);
    const ada = fillAuto && (bucket.length > 0 || nominal > 0);

    const uniqueDates = Array.from(
      new Set(bucket.map((b) => (b.tanggal || '').trim()).filter(Boolean))
    );
    const tanggal = uniqueDates.length > 0 ? uniqueDates[uniqueDates.length - 1] : '';

    const petugasSet = Array.from(
      new Set(bucket.map((b) => (b.petugasOps || '').trim()).filter(Boolean))
    );
    const metodeSet = Array.from(
      new Set(bucket.map((b) => (b.metodePembayaran || '').trim()).filter(Boolean))
    );
    const petugasVia =
      petugasSet.length > 0
        ? petugasSet.join(', ')
        : metodeSet.length > 0
        ? metodeSet.join(', ')
        : '';

    const keteranganParts = bucket.map((b) => {
      const tt = b.noTandaTerima ? ` [${b.noTandaTerima}]` : '';
      const kasbonTag = b.statusPengeluaran === 'Uang Muka / Kasbon' ? ' (Kasbon)' : '';
      const qtyExtra = bucket.length > 1 ? ` (${formatRupiahOps(b.nominal)})` : '';
      return `${(b.keterangan || '').trim()}${qtyExtra}${tt}${kasbonTag}`;
    });

    let keterangan = keteranganParts.join('; ');
    if (!keterangan && fillAuto && jenisBiaya === 'BM/PDRI (PIB)' && shipment.bmPdri?.trim()) {
      keterangan = `Ref PIB: ${shipment.bmPdri.trim()}`;
    }

    return {
      no: idx + 1,
      jenisBiaya,
      ada,
      tanggal,
      petugasVia,
      nominal,
      keterangan,
      jumlahTransaksi: bucket.length,
    };
  });

  const rows =
    options.customRows && options.customRows.length > 0 ? options.customRows : defaultRows;

  const totals = recalculateDklTotals(rows, matchedItems);

  const firstPetugas = matchedItems.find((i) => i.petugasOps?.trim())?.petugasOps?.trim() || '';
  const firstPemberi =
    matchedItems.find((i) => i.diberikanOleh?.trim())?.diberikanOleh?.trim() || '';

  const koordinatorLapangan =
    options.koordinatorLapangan !== undefined
      ? options.koordinatorLapangan
      : firstPetugas || shipment.dokumenChecker || '-';
  const diserahkanOleh =
    firstPemberi ||
    options.pengaturan?.adminName ||
    options.diserahkanOleh ||
    'Keuangan / Admin';

  const noReferensiDkl =
    options.noReferensiDkl !== undefined
      ? options.noReferensiDkl
      : `DKL-${(shipment.kodeOs || 'UMUM').replace(/^OS-/i, '')}`;

  const supirLine = [shipment.truckingNamaSupir, shipment.truckingNoHpSupir]
    .filter((v) => Boolean(v && v.trim()))
    .join(' / ');

  const manualDokOs = (shipment.kodeManualDokOs || '').trim();
  const subtitleParts = [
    `OS : ${shipment.kodeOs}`,
    manualDokOs ? `DOK. OS : ${manualDokOs}` : '',
    `NO. DKL : ${noReferensiDkl}`,
    `SHIPMENT : ${shipment.noBl || shipment.kodeCustomer || '-'}`,
  ].filter(Boolean);

  return {
    identity,
    kodeOs: shipment.kodeOs,
    subtitleLine: subtitleParts.join(' | '),
    containerNo: shipment.noCont || '',
    blNo: shipment.noBl || '',
    blTanggal: formatTanggalIndonesia(shipment.tglTerimaDok || shipment.etd),
    shipper: shipment.shipper || '',
    customer:
      shipment.kodeCustomer && shipment.kodeOs !== NON_OS_KODE
        ? `${shipment.namaCustomer} (${shipment.kodeCustomer})`
        : shipment.namaCustomer || '',
    commodity: shipment.description || '',
    consignee: impMatch?.namaImportir || shipment.namaCustomer || '',
    vessel: vessel || shipment.ship || '',
    voy: voy || '',
    etd: formatTanggalIndonesia(shipment.etd),
    eta: formatTanggalIndonesia(shipment.eta),
    portOfLoading:
      options.portOfLoading !== undefined
        ? options.portOfLoading
        : shipment.negaraAsal || '',
    portOfDischarge:
      options.portOfDischarge !== undefined
        ? options.portOfDischarge
        : 'TANJUNG PRIOK, Indonesia',
    noPengajuanPib: shipment.noAju || '',
    tglPengajuanPib: formatTanggalIndonesia(shipment.tglAju),
    noPib: shipment.nopen || '',
    tglPib: formatTanggalIndonesia(shipment.tglNopen),
    pfpb: shipment.pfpb || '',
    tglPfpb: formatTanggalIndonesia(shipment.tglPfpb),
    pfpd: shipment.pfpd || '',
    tglPfpd: formatTanggalIndonesia(shipment.tglPfpd),
    sptnpNo: shipment.noSptnp || '',
    tglSptnp: formatTanggalIndonesia(shipment.tglSptnp),
    sppbNo: shipment.noSppb || '',
    tglSppb: formatTanggalIndonesia(shipment.tglSppb),
    eslahOleh: shipment.eslah || shipment.doGatePassNomor || '',
    tglEslah: formatTanggalIndonesia(shipment.tglEslah),
    truckingSupir: supirLine,
    nopol: shipment.truckingNoPlat || '',
    noReferensiDkl,
    koordinatorLapangan,
    diserahkanOleh,
    tanggalCetak: formatTanggalIndonesia(
      matchedItems[matchedItems.length - 1]?.tanggal ||
        shipment.tglTerimaDok ||
        new Date().toISOString().slice(0, 10)
    ),
    rows,
    ...totals,
    bmPdriReferensi: shipment.bmPdri || '',
    billingTotalReferensi: Number(shipment.billingTotal) || 0,
  };
}
