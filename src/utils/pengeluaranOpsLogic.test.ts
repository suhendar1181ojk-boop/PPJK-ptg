import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTandaTerimaOpsWhatsappUrl,
  computePengeluaranOpsSummary,
  filterPengeluaranOps,
  formatRupiahOps,
  generateNextKodePengeluaran,
  generateNoTandaTerima,
  getStatusPengeluaranMeta,
  hasBuktiPengeluaran,
  validatePengeluaranOpsInput,
} from './pengeluaranOpsLogic';
import type { PengeluaranOpsItem, Shipment } from '../types/ppjk';
import { createEmptyChecklist, DEFAULT_CHECKLIST_ITEMS } from './ppjkLogic';

function makeShip(kodeOs: string, customer: string, noBl: string, billingTotal?: number): Shipment {
  return {
    kodeOs,
    ship: 'MV TEST',
    kodeCustomer: 'C-01',
    namaCustomer: customer,
    tglTerimaDok: '2026-11-10',
    terimaDok: createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS),
    noPackinglist: 'PL-1',
    noBl,
    statusDokumen: 'Ready',
    etd: '2026-11-01',
    eta: '2026-11-20',
    countDownEta: 4,
    noCont: 'CONT1',
    billingTotal,
    noAju: 'AJU1',
    tglAju: '2026-11-11',
    status: 'SPPB Terbit',
    nopen: '123456',
    tglNopen: '2026-11-12',
    jalur: 'Hijau',
    kodeImportir: 'IMP-01',
    shipper: 'Shipper',
    description: 'Cargo',
    negaraAsal: 'China',
    currency: 'USD',
    kurs: 15800,
    invoice: 10000,
    bmPdri: 'Rp 25.000.000',
    sptnp: 'Tidak',
    noSppb: 'SPPB-1',
    tglSppb: '2026-11-13',
    dokumenChecker: 'Rina Kusuma',
    noSptnp: '',
    tglSptnp: '',
    pfpb: '',
    tglPfpb: '',
    pfpd: '',
    tglPfpd: '',
    eslah: '',
    tglEslah: '',
    dokumenOs: createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS),
    createdAt: '2026-11-10T00:00:00Z',
    createdBy: 'admin',
    updatedAt: '2026-11-10T00:00:00Z',
    updatedBy: 'admin',
  };
}

function makeExpense(overrides: Partial<PengeluaranOpsItem>): PengeluaranOpsItem {
  return {
    id: overrides.id || 'kop-1',
    kodePengeluaran: overrides.kodePengeluaran || 'KOP-2611-0001',
    noTandaTerima: overrides.noTandaTerima || 'TT-KOP-2611-0001',
    kodeOs: overrides.kodeOs || 'OS-2611-0001',
    noBl: overrides.noBl || 'BL-001',
    namaCustomer: overrides.namaCustomer || 'PT Nusantara',
    tanggal: overrides.tanggal || '2026-11-15',
    kategori: overrides.kategori || 'D/O & Pelayaran',
    keterangan: overrides.keterangan || 'Biaya perpanjangan D/O Pelayaran',
    nominal: overrides.nominal ?? 1500000,
    metodePembayaran: overrides.metodePembayaran || 'Transfer Bank',
    statusPengeluaran: overrides.statusPengeluaran || 'Sudah Dibayar',
    petugasOps: overrides.petugasOps || 'Slamet Riyadi (Operasional)',
    diberikanOleh: overrides.diberikanOleh || 'Hendra Wijaya (Admin)',
    tandaTerimaAt: overrides.tandaTerimaAt || '2026-11-15T09:00:00Z',
    buktiNamaFile: overrides.buktiNamaFile,
    buktiDataUrl: overrides.buktiDataUrl,
    buktiLinkDrive: overrides.buktiLinkDrive,
    source: overrides.source,
    createdAt: overrides.createdAt || '2026-11-15T09:00:00Z',
    createdBy: overrides.createdBy || 'admin',
    updatedAt: overrides.updatedAt || '2026-11-15T09:00:00Z',
    updatedBy: overrides.updatedBy || 'admin',
  };
}

test('generateNextKodePengeluaran increments monotonically across existing items and seqPengeluaranByMonth', () => {
  const existing = [
    makeExpense({ kodePengeluaran: 'KOP-2611-0001' }),
    makeExpense({ id: 'kop-2', kodePengeluaran: 'KOP-2611-0003' }),
  ];

  const next1 = generateNextKodePengeluaran(existing, { '2611': 5 }, '2026-11-18');
  assert.equal(next1.kodePengeluaran, 'KOP-2611-0006');
  assert.equal(next1.noTandaTerima, 'TT-KOP-2611-0006');
  assert.equal(next1.monthKey, '2611');
  assert.equal(next1.nextSeq, 6);

  const nextDec = generateNextKodePengeluaran(existing, { '2611': 5 }, '2026-12-01');
  assert.equal(nextDec.kodePengeluaran, 'KOP-2612-0001');
  assert.equal(generateNoTandaTerima('kop-2612-0001'), 'TT-KOP-2612-0001');
});

test('validatePengeluaranOpsInput rejects missing required fields and zero/negative nominal', () => {
  const invalid = validatePengeluaranOpsInput({
    kodeOs: '',
    tanggal: 'invalid-date',
    keterangan: 'ab',
    nominal: 0,
    petugasOps: '',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.kodeOs);
  assert.ok(invalid.errors.tanggal);
  assert.ok(invalid.errors.keterangan);
  assert.ok(invalid.errors.nominal);
  assert.ok(invalid.errors.petugasOps);

  const valid = validatePengeluaranOpsInput({
    kodeOs: 'OS-2611-0001',
    tanggal: '2026-11-15',
    kategori: 'TILA / Eslah / Gate Pass',
    keterangan: 'TILA & Gate Pass Pelabuhan Priok',
    nominal: 450000,
    metodePembayaran: 'Uang Muka / Kasbon Ops',
    statusPengeluaran: 'Uang Muka / Kasbon',
    petugasOps: 'Slamet Riyadi (Ops)',
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test('filterPengeluaranOps filters by search, period, kodeOs, petugasOps, kategori, status, and proof', () => {
  const items: PengeluaranOpsItem[] = [
    makeExpense({
      id: '1',
      kodePengeluaran: 'KOP-2611-0001',
      kodeOs: 'OS-2611-0001',
      tanggal: '2026-11-10',
      kategori: 'D/O & Pelayaran',
      statusPengeluaran: 'Selesai / Dipertanggungjawabkan',
      petugasOps: 'Slamet Riyadi',
      buktiNamaFile: 'kwitansi_do.jpg',
    }),
    makeExpense({
      id: '2',
      kodePengeluaran: 'KOP-2611-0002',
      kodeOs: 'OS-2611-0002',
      tanggal: '2026-11-14',
      kategori: 'Karantina / Behandle Merah',
      keterangan: 'Uang muka operasional behandle jalur merah',
      statusPengeluaran: 'Uang Muka / Kasbon',
      petugasOps: 'Agus Ops',
    }),
    makeExpense({
      id: '3',
      kodePengeluaran: 'KOP-2610-0001',
      kodeOs: 'OS-2610-0009',
      tanggal: '2026-10-22',
      kategori: 'Trucking / Angkutan',
      statusPengeluaran: 'Sudah Dibayar',
      petugasOps: 'Slamet Riyadi',
      buktiLinkDrive: 'https://drive.google.com/file/d/abc/view',
    }),
  ];

  assert.equal(filterPengeluaranOps(items, { periodMode: 'month', month: '2026-11' }).length, 2);
  assert.equal(filterPengeluaranOps(items, { buktiFilter: 'missing-bukti' }).length, 1);
  assert.equal(filterPengeluaranOps(items, { buktiFilter: 'with-bukti' }).length, 2);
  assert.equal(filterPengeluaranOps(items, { petugasOps: 'Slamet Riyadi' }).length, 2);
  assert.equal(filterPengeluaranOps(items, { search: 'behandle' })[0].id, '2');
  assert.equal(filterPengeluaranOps(items, { kodeOs: 'OS-2611-0001' }).length, 1);
});

test('computePengeluaranOpsSummary aggregates KPIs, document totals vs billing, petugas totals, and kategori totals', () => {
  const ships = [
    makeShip('OS-2611-0001', 'PT Nusantara', 'BL-001', 5000000),
    makeShip('OS-2611-0002', 'PT Samudera', 'BL-002', 3500000),
  ];
  const items: PengeluaranOpsItem[] = [
    makeExpense({
      id: '1',
      kodeOs: 'OS-2611-0001',
      nominal: 1500000,
      kategori: 'D/O & Pelayaran',
      statusPengeluaran: 'Selesai / Dipertanggungjawabkan',
      petugasOps: 'Slamet Riyadi',
      buktiNamaFile: 'do.pdf',
    }),
    makeExpense({
      id: '2',
      kodeOs: 'OS-2611-0001',
      nominal: 750000,
      kategori: 'TILA / Eslah / Gate Pass',
      statusPengeluaran: 'Sudah Dibayar',
      petugasOps: 'Agus Ops',
      buktiNamaFile: 'tila.jpg',
    }),
    makeExpense({
      id: '3',
      kodeOs: 'OS-2611-0002',
      nominal: 2000000,
      kategori: 'Karantina / Behandle Merah',
      statusPengeluaran: 'Uang Muka / Kasbon',
      petugasOps: 'Slamet Riyadi',
    }),
  ];

  const summary = computePengeluaranOpsSummary(items, ships);
  assert.equal(summary.totalTransaksi, 3);
  assert.equal(summary.totalNominal, 4250000);
  assert.equal(summary.totalKasbonNominal, 2000000);
  assert.equal(summary.kasbonCount, 1);
  assert.equal(summary.totalSudahDibayarNominal, 750000);
  assert.equal(summary.totalSelesaiNominal, 1500000);
  assert.equal(summary.dokumenTercatatCount, 2);
  assert.equal(summary.denganBuktiCount, 2);
  assert.equal(summary.belumAdaBuktiCount, 1);

  const os1 = summary.byDokumen.find((d) => d.kodeOs === 'OS-2611-0001');
  assert.ok(os1);
  assert.equal(os1.totalNominal, 2250000);
  assert.equal(os1.billingTotal, 5000000);
  assert.equal(os1.selisihBilling, 2750000);

  const slamet = summary.byPetugas.find((p) => p.petugasOps === 'Slamet Riyadi');
  assert.ok(slamet);
  assert.equal(slamet.totalDiterima, 3500000);
  assert.equal(slamet.kasbonAktifNominal, 2000000);
  assert.equal(slamet.dokumenCount, 2);
});

test('WhatsApp receipt URL, proof helpers, and formatting work cleanly', () => {
  const item = makeExpense({
    kodePengeluaran: 'KOP-2611-0007',
    noTandaTerima: 'TT-KOP-2611-0007',
    nominal: 850000,
    buktiNamaFile: 'tanda_terima.jpg',
  });
  assert.equal(hasBuktiPengeluaran(item), true);
  assert.match(formatRupiahOps(850000), /850\.000/);
  assert.equal(getStatusPengeluaranMeta('Uang Muka / Kasbon').shortLabel, 'Kasbon Ops');
  const wa = buildTandaTerimaOpsWhatsappUrl(item, 'SAMUDERA PPJK', '08123456789');
  assert.match(wa, /^https:\/\/wa\.me\/628123456789\?text=/);
  assert.match(decodeURIComponent(wa), /TT-KOP-2611-0007/);
});
