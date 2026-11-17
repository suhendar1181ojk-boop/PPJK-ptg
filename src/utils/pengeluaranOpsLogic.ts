import type {
  KategoriPengeluaranOps,
  MetodePembayaranOps,
  PengeluaranOpsDokumenRecap,
  PengeluaranOpsFilterCriteria,
  PengeluaranOpsItem,
  PengeluaranOpsKategoriRecap,
  PengeluaranOpsPetugasRecap,
  PengeluaranOpsSummary,
  Shipment,
  StatusPengeluaranOps,
} from '../types/ppjk';

export const KATEGORI_PENGELUARAN_OPS: KategoriPengeluaranOps[] = [
  'D/O & Pelayaran',
  'TILA / Eslah / Gate Pass',
  'Handling / THC / Demurrage',
  'Trucking / Angkutan',
  'Karantina / Behandle Merah',
  'Jasa Lapangan / Ops',
  'SPTNP / Denda',
  'Lainnya',
];

export const METODE_PEMBAYARAN_OPS: MetodePembayaranOps[] = [
  'Kas Tunai',
  'Transfer Bank',
  'Uang Muka / Kasbon Ops',
  'Reimburse',
];

export const STATUS_PENGELUARAN_OPS: StatusPengeluaranOps[] = [
  'Uang Muka / Kasbon',
  'Sudah Dibayar',
  'Selesai / Dipertanggungjawabkan',
];

export const NON_OS_KODE = 'UMUM / NON-OS';

export interface PengeluaranOpsInputPayload {
  id?: string;
  kodePengeluaran?: string;
  noTandaTerima?: string;
  kodeOs: string;
  noBl?: string;
  namaCustomer?: string;
  tanggal: string;
  kategori: KategoriPengeluaranOps;
  keterangan: string;
  nominal: number;
  metodePembayaran: MetodePembayaranOps;
  statusPengeluaran: StatusPengeluaranOps;
  petugasOps: string;
  diberikanOleh?: string;
  tandaTerimaAt?: string;
  buktiNamaFile?: string;
  buktiMimeType?: string;
  buktiDataUrl?: string;
  buktiLinkDrive?: string;
  driveFileId?: string;
  source?: 'google-drive' | 'offline-local' | 'simulasi';
  catatanAudit?: string;
}

export interface PengeluaranOpsValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function formatRupiahOps(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(safe);
}

export function resolveMonthKeyFromDate(dateStr?: string, fallbackDate = new Date()): string {
  if (dateStr && /^\d{4}-\d{2}/.test(dateStr.trim())) {
    const clean = dateStr.trim();
    return `${clean.slice(2, 4)}${clean.slice(5, 7)}`;
  }
  const yy = String(fallbackDate.getFullYear()).slice(-2);
  const mm = String(fallbackDate.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

/**
 * Menghasilkan kode pengeluaran operasional unik (format: KOP-YYMM-NNNN).
 */
export function generateNextKodePengeluaran(
  items: PengeluaranOpsItem[],
  seqByMonth: Record<string, number> = {},
  tanggal?: string,
  referenceDate = new Date()
): { kodePengeluaran: string; noTandaTerima: string; monthKey: string; nextSeq: number } {
  const monthKey = resolveMonthKeyFromDate(tanggal, referenceDate);
  let maxSeq = seqByMonth[monthKey] || 0;
  const pattern = new RegExp(`^KOP-${monthKey}-(\\d+)$`, 'i');

  for (const item of items) {
    const m = pattern.exec((item.kodePengeluaran || '').trim());
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  }

  const nextSeq = maxSeq + 1;
  const padded = String(nextSeq).padStart(4, '0');
  const kodePengeluaran = `KOP-${monthKey}-${padded}`;
  const noTandaTerima = `TT-${kodePengeluaran}`;
  return { kodePengeluaran, noTandaTerima, monthKey, nextSeq };
}

export function generateNoTandaTerima(kodePengeluaran: string): string {
  const clean = (kodePengeluaran || '').trim();
  if (!clean) return '';
  return clean.toUpperCase().startsWith('TT-') ? clean.toUpperCase() : `TT-${clean.toUpperCase()}`;
}

export function hasBuktiPengeluaran(item: Pick<PengeluaranOpsItem, 'buktiNamaFile' | 'buktiDataUrl' | 'buktiLinkDrive'>): boolean {
  return Boolean(
    (item.buktiDataUrl && item.buktiDataUrl.trim()) ||
      (item.buktiLinkDrive && item.buktiLinkDrive.trim()) ||
      (item.buktiNamaFile && item.buktiNamaFile.trim())
  );
}

export function validatePengeluaranOpsInput(
  input: Partial<PengeluaranOpsInputPayload>
): PengeluaranOpsValidationResult {
  const errors: Record<string, string> = {};

  if (!input.kodeOs || !input.kodeOs.trim()) {
    errors.kodeOs = 'Pilih dokumen shipment (Kode OS) atau kategori NON-OS.';
  }
  if (!input.tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(input.tanggal.trim())) {
    errors.tanggal = 'Tanggal pengeluaran wajib diisi (YYYY-MM-DD).';
  }
  if (!input.kategori || !KATEGORI_PENGELUARAN_OPS.includes(input.kategori)) {
    errors.kategori = 'Pilih kategori biaya operasional.';
  }
  if (!input.keterangan || input.keterangan.trim().length < 3) {
    errors.keterangan = 'Keterangan pengeluaran minimal 3 karakter.';
  }
  const nom = Number(input.nominal);
  if (!Number.isFinite(nom) || nom <= 0) {
    errors.nominal = 'Nominal pengeluaran harus lebih besar dari Rp 0.';
  }
  if (!input.petugasOps || input.petugasOps.trim().length < 2) {
    errors.petugasOps = 'Nama Petugas Ops penerima dana/tanda terima wajib diisi.';
  }
  if (!input.metodePembayaran || !METODE_PEMBAYARAN_OPS.includes(input.metodePembayaran)) {
    errors.metodePembayaran = 'Pilih metode pembayaran.';
  }
  if (!input.statusPengeluaran || !STATUS_PENGELUARAN_OPS.includes(input.statusPengeluaran)) {
    errors.statusPengeluaran = 'Pilih status pertanggungjawaban pengeluaran.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function getStatusPengeluaranMeta(status: StatusPengeluaranOps): {
  label: string;
  shortLabel: string;
  badgeClass: string;
} {
  switch (status) {
    case 'Selesai / Dipertanggungjawabkan':
      return {
        label: 'Selesai / Dipertanggungjawabkan',
        shortLabel: 'Selesai',
        badgeClass:
          'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
      };
    case 'Sudah Dibayar':
      return {
        label: 'Sudah Dibayar',
        shortLabel: 'Sudah Dibayar',
        badgeClass:
          'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
      };
    case 'Uang Muka / Kasbon':
    default:
      return {
        label: 'Uang Muka / Kasbon',
        shortLabel: 'Kasbon Ops',
        badgeClass:
          'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
      };
  }
}

export function filterPengeluaranOps(
  items: PengeluaranOpsItem[],
  criteria: PengeluaranOpsFilterCriteria = {}
): PengeluaranOpsItem[] {
  const q = (criteria.search || '').trim().toLowerCase();
  const periodMode = criteria.periodMode || 'all';
  const monthFilter = (criteria.month || '').trim();
  const dateFrom = (criteria.dateFrom || '').trim();
  const dateTo = (criteria.dateTo || '').trim();
  const kodeOsFilter = (criteria.kodeOs || '').trim().toUpperCase();
  const petugasFilter = (criteria.petugasOps || '').trim().toLowerCase();
  const kategoriFilter = criteria.kategori || '';
  const statusFilter = criteria.statusPengeluaran || '';
  const buktiFilter = criteria.buktiFilter || 'all';

  return items
    .filter((item) => {
      if (periodMode === 'month' && monthFilter) {
        if (!(item.tanggal || '').startsWith(monthFilter)) return false;
      } else if (periodMode === 'range') {
        if (dateFrom && (item.tanggal || '') < dateFrom) return false;
        if (dateTo && (item.tanggal || '') > dateTo) return false;
      }

      if (kodeOsFilter && (item.kodeOs || '').trim().toUpperCase() !== kodeOsFilter) {
        return false;
      }

      if (petugasFilter && (item.petugasOps || '').trim().toLowerCase() !== petugasFilter) {
        return false;
      }

      if (kategoriFilter && item.kategori !== kategoriFilter) {
        return false;
      }

      if (statusFilter && item.statusPengeluaran !== statusFilter) {
        return false;
      }

      const hasProof = hasBuktiPengeluaran(item);
      if (buktiFilter === 'with-bukti' && !hasProof) return false;
      if (buktiFilter === 'missing-bukti' && hasProof) return false;

      if (q) {
        const haystack = [
          item.kodePengeluaran,
          item.noTandaTerima,
          item.kodeOs,
          item.noBl || '',
          item.namaCustomer || '',
          item.kategori,
          item.keterangan,
          item.petugasOps,
          item.diberikanOleh,
          item.buktiNamaFile || '',
          item.catatanAudit || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const dateCmp = (b.tanggal || '').localeCompare(a.tanggal || '');
      if (dateCmp !== 0) return dateCmp;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
}

export function computePengeluaranOpsSummary(
  items: PengeluaranOpsItem[],
  shipments: Shipment[] = []
): PengeluaranOpsSummary {
  const shipmentMap = new Map<string, Shipment>();
  for (const s of shipments) {
    if (s.kodeOs) shipmentMap.set(s.kodeOs.trim().toUpperCase(), s);
  }

  let totalNominal = 0;
  let totalKasbonNominal = 0;
  let kasbonCount = 0;
  let totalSudahDibayarNominal = 0;
  let sudahDibayarCount = 0;
  let totalSelesaiNominal = 0;
  let selesaiCount = 0;
  let denganBuktiCount = 0;
  let belumAdaBuktiCount = 0;

  const docMap = new Map<string, PengeluaranOpsDokumenRecap>();
  const petugasMap = new Map<
    string,
    {
      petugasOps: string;
      jumlahTransaksi: number;
      totalDiterima: number;
      kasbonAktifNominal: number;
      sudahDipertanggungjawabkanNominal: number;
      transaksiDenganBukti: number;
      transaksiTanpaBukti: number;
      dokumenSet: Set<string>;
    }
  >();
  const katMap = new Map<KategoriPengeluaranOps, { jumlahTransaksi: number; totalNominal: number }>();

  for (const item of items) {
    const nominal = Number(item.nominal) || 0;
    totalNominal += nominal;

    const proofOk = hasBuktiPengeluaran(item);
    if (proofOk) denganBuktiCount++;
    else belumAdaBuktiCount++;

    if (item.statusPengeluaran === 'Uang Muka / Kasbon') {
      totalKasbonNominal += nominal;
      kasbonCount++;
    } else if (item.statusPengeluaran === 'Sudah Dibayar') {
      totalSudahDibayarNominal += nominal;
      sudahDibayarCount++;
    } else if (item.statusPengeluaran === 'Selesai / Dipertanggungjawabkan') {
      totalSelesaiNominal += nominal;
      selesaiCount++;
    }

    // Group by kodeOs
    const osKey = (item.kodeOs || NON_OS_KODE).trim().toUpperCase();
    const linkedShip = shipmentMap.get(osKey);
    const existingDoc = docMap.get(osKey) || {
      kodeOs: item.kodeOs || NON_OS_KODE,
      noBl: linkedShip?.noBl || item.noBl || '-',
      namaCustomer: linkedShip?.namaCustomer || item.namaCustomer || (osKey === NON_OS_KODE ? 'Biaya Umum Operasional' : '-'),
      shipStatus: linkedShip?.status || '-',
      jumlahTransaksi: 0,
      totalNominal: 0,
      nominalKasbon: 0,
      nominalSelesai: 0,
      transaksiTanpaBukti: 0,
      billingTotal: Number(linkedShip?.billingTotal) || 0,
      selisihBilling: 0,
      items: [],
    };
    existingDoc.jumlahTransaksi++;
    existingDoc.totalNominal += nominal;
    if (item.statusPengeluaran === 'Uang Muka / Kasbon') {
      existingDoc.nominalKasbon += nominal;
    } else {
      existingDoc.nominalSelesai += nominal;
    }
    if (!proofOk) existingDoc.transaksiTanpaBukti++;
    existingDoc.items.push(item);
    existingDoc.selisihBilling =
      existingDoc.billingTotal > 0 ? existingDoc.billingTotal - existingDoc.totalNominal : 0;
    docMap.set(osKey, existingDoc);

    // Group by petugasOps
    const petugasDisplay = (item.petugasOps || 'Petugas Ops').trim();
    const petugasKey = petugasDisplay.toLowerCase();
    const existingPetugas = petugasMap.get(petugasKey) || {
      petugasOps: petugasDisplay,
      jumlahTransaksi: 0,
      totalDiterima: 0,
      kasbonAktifNominal: 0,
      sudahDipertanggungjawabkanNominal: 0,
      transaksiDenganBukti: 0,
      transaksiTanpaBukti: 0,
      dokumenSet: new Set<string>(),
    };
    existingPetugas.jumlahTransaksi++;
    existingPetugas.totalDiterima += nominal;
    if (item.statusPengeluaran === 'Uang Muka / Kasbon') {
      existingPetugas.kasbonAktifNominal += nominal;
    } else {
      existingPetugas.sudahDipertanggungjawabkanNominal += nominal;
    }
    if (proofOk) existingPetugas.transaksiDenganBukti++;
    else existingPetugas.transaksiTanpaBukti++;
    existingPetugas.dokumenSet.add(osKey);
    petugasMap.set(petugasKey, existingPetugas);

    // Group by kategori
    const prevKat = katMap.get(item.kategori) || { jumlahTransaksi: 0, totalNominal: 0 };
    prevKat.jumlahTransaksi++;
    prevKat.totalNominal += nominal;
    katMap.set(item.kategori, prevKat);
  }

  const byDokumen = Array.from(docMap.values()).sort((a, b) => b.totalNominal - a.totalNominal);
  const byPetugas: PengeluaranOpsPetugasRecap[] = Array.from(petugasMap.values())
    .map((p) => ({
      petugasOps: p.petugasOps,
      jumlahTransaksi: p.jumlahTransaksi,
      totalDiterima: p.totalDiterima,
      kasbonAktifNominal: p.kasbonAktifNominal,
      sudahDipertanggungjawabkanNominal: p.sudahDipertanggungjawabkanNominal,
      transaksiDenganBukti: p.transaksiDenganBukti,
      transaksiTanpaBukti: p.transaksiTanpaBukti,
      dokumenCount: p.dokumenSet.size,
    }))
    .sort((a, b) => b.totalDiterima - a.totalDiterima);

  const byKategori: PengeluaranOpsKategoriRecap[] = Array.from(katMap.entries())
    .map(([kategori, v]) => ({
      kategori,
      jumlahTransaksi: v.jumlahTransaksi,
      totalNominal: v.totalNominal,
    }))
    .sort((a, b) => b.totalNominal - a.totalNominal);

  return {
    totalTransaksi: items.length,
    totalNominal,
    totalKasbonNominal,
    kasbonCount,
    totalSudahDibayarNominal,
    sudahDibayarCount,
    totalSelesaiNominal,
    selesaiCount,
    dokumenTercatatCount: byDokumen.length,
    denganBuktiCount,
    belumAdaBuktiCount,
    byDokumen,
    byPetugas,
    byKategori,
  };
}

export function buildTandaTerimaOpsWhatsappUrl(
  item: PengeluaranOpsItem,
  brandName = 'PTG PPJK',
  phone = ''
): string {
  const cleanPhone = (phone || '').replace(/[^\d]/g, '').replace(/^0/, '62');
  const lines = [
    `*TANDA TERIMA PENGELUARAN OPS — ${brandName}*`,
    `No. Tanda Terima: ${item.noTandaTerima}`,
    `Kode Pengeluaran: ${item.kodePengeluaran}`,
    `Dokumen / OS: ${item.kodeOs}${item.noBl ? ` (B/L: ${item.noBl})` : ''}`,
    item.namaCustomer ? `Customer: ${item.namaCustomer}` : '',
    `Tanggal: ${item.tanggal}`,
    `Kategori: ${item.kategori}`,
    `Keterangan: ${item.keterangan}`,
    `Nominal: *${formatRupiahOps(item.nominal)}*`,
    `Metode: ${item.metodePembayaran}`,
    `Petugas Ops Penerima: ${item.petugasOps}`,
    `Diserahkan Oleh: ${item.diberikanOleh}`,
    `Status: ${item.statusPengeluaran}`,
    hasBuktiPengeluaran(item)
      ? `Bukti/Lampiran: ${item.buktiNamaFile || item.buktiLinkDrive || 'Tersedia'}`
      : `Bukti/Lampiran: Mohon segera unggah nota/foto bukti pembayaran.`,
  ]
    .filter(Boolean)
    .join('\n');

  const encoded = encodeURIComponent(lines);
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

/**
 * Mengompres file gambar bukti pembayaran/tanda terima agar hemat kuota IndexedDB & localStorage.
 * Untuk PDF atau file non-gambar <= 500 KB disimpan apa adanya sebagai DataURL; jika > 500 KB, kembalikan undefined untuk fallback metadata/Drive.
 */
export async function prepareProofFileDataUrl(
  file: File,
  maxImageDimension = 1000,
  maxNonImageBytes = 500 * 1024
): Promise<{ dataUrl?: string; note?: string }> {
  if (typeof window === 'undefined' || typeof FileReader === 'undefined') {
    return {};
  }

  const readAsDataUrl = (f: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Gagal membaca file bukti'));
      reader.readAsDataURL(f);
    });

  if (file.type.startsWith('image/') && typeof document !== 'undefined') {
    try {
      const rawDataUrl = await readAsDataUrl(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Gagal memproses gambar bukti'));
        el.src = rawDataUrl;
      });
      const scale = Math.min(1, maxImageDimension / Math.max(img.width || 1, img.height || 1));
      const targetW = Math.max(1, Math.round(img.width * scale));
      const targetH = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { dataUrl: rawDataUrl };
      ctx.drawImage(img, 0, 0, targetW, targetH);
      return { dataUrl: canvas.toDataURL('image/jpeg', 0.72) };
    } catch {
      if (file.size <= maxNonImageBytes) {
        return { dataUrl: await readAsDataUrl(file) };
      }
      return { note: 'Preview lokal dilewati (file terlalu besar), metadata tersimpan.' };
    }
  }

  if (file.size <= maxNonImageBytes) {
    return { dataUrl: await readAsDataUrl(file) };
  }

  return {
    note: 'File non-gambar > 500 KB: disarankan hubungkan Google Drive agar file penuh tersimpan.',
  };
}
