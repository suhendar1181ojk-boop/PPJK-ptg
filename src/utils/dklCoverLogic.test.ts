import assert from 'node:assert/strict';
import test from 'node:test';
import type { PengeluaranOpsItem, Shipment } from '../types/ppjk';
import {
  buildDklCoverDocument,
  classifyOpsItemToDklRow,
  DKL_STANDARD_EXPENSE_ROWS,
  recalculateDklTotals,
} from './dklCoverLogic';

function makeMockShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    kodeOs: 'OS-2611-0004',
    kodeManualDokOs: 'TN-196',
    ship: 'MV SINAR MALUKU VOY 170S',
    kodeCustomer: 'CUST-01',
    namaCustomer: 'PT Maju Jaya Ekspor Impor',
    tglTerimaDok: '2026-11-10',
    terimaDok: { items: {}, catatan: '' },
    noPackinglist: 'PL-004',
    noBl: 'OOLU27182910',
    etd: '2026-11-05',
    eta: '2026-11-12',
    countDownEta: 2,
    noCont: 'OOLU8123456',
    noAju: '000020-123456',
    tglAju: '2026-11-11',
    status: 'SPPB',
    nopen: '112233',
    tglNopen: '2026-11-12',
    jalur: 'Merah',
    kodeImportir: 'IMP-01',
    shipper: 'SHANGHAI GLOBAL LTD',
    description: 'MESIN INDUSTRI',
    negaraAsal: 'CHINA',
    currency: 'USD',
    kurs: 15800,
    invoice: 24000,
    bmPdri: 'Rp 42.500.000',
    sptnp: 'Ada',
    noSppb: 'SPPB-8899',
    tglSppb: '2026-11-14',
    dokumenChecker: 'Budi Checker',
    noSptnp: 'SPTNP-01',
    tglSptnp: '2026-11-13',
    pfpb: 'PFPB-01',
    tglPfpb: '2026-11-13',
    pfpd: 'PFPD-01',
    tglPfpd: '2026-11-13',
    eslah: 'ESL-01',
    tglEslah: '2026-11-14',
    dokumenOs: { items: {}, catatan: '' },
    createdAt: '2026-11-10T08:00:00Z',
    createdBy: 'admin',
    updatedAt: '2026-11-14T08:00:00Z',
    updatedBy: 'ops1',
    ...overrides,
  };
}

function makeExpense(overrides: Partial<PengeluaranOpsItem>): PengeluaranOpsItem {
  return {
    id: 'exp-1',
    kodePengeluaran: 'KOP-2611-0001',
    noTandaTerima: 'TT-KOP-2611-0001',
    kodeOs: 'OS-2611-0004',
    tanggal: '2026-11-12',
    kategori: 'D/O & Pelayaran',
    keterangan: 'Tebus D/O Pelayaran',
    nominal: 1650000,
    metodePembayaran: 'Transfer Bank',
    statusPengeluaran: 'Sudah Dibayar',
    petugasOps: 'Andi Ops',
    diberikanOleh: 'Rina Keuangan',
    createdAt: '2026-11-12T08:00:00Z',
    createdBy: 'ops1',
    updatedAt: '2026-11-12T08:00:00Z',
    updatedBy: 'ops1',
    ...overrides,
  };
}

test('DKL_STANDARD_EXPENSE_ROWS aligns with Modul Pengeluaran OPS categories while preserving the 6 fixed DKL items', () => {
  assert.deepEqual([...DKL_STANDARD_EXPENSE_ROWS], [
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
  ]);
});

test('classifyOpsItemToDklRow classifies all 12 revised DKL expense rows deterministically', () => {
  assert.equal(
    classifyOpsItemToDklRow({ kategori: 'Lainnya', keterangan: 'Pembayaran BM/PDRI PIB Nopen 1122' }),
    'BM/PDRI (PIB)'
  );
  assert.equal(
    classifyOpsItemToDklRow({ kategori: 'SPTNP / Denda', keterangan: 'Bayar SPTNP / Notul pabean' }),
    'SPTNP / Denda'
  );
  assert.equal(
    classifyOpsItemToDklRow({ kategori: 'D/O & Pelayaran', keterangan: 'Tebus D/O line pelayaran' }),
    'D/O & Pelayaran'
  );
  assert.equal(
    classifyOpsItemToDklRow({ kategori: 'Handling / THC / Demurrage', keterangan: 'Biaya Demurrage container 2 hari' }),
    'Handling / THC / Demurrage'
  );
  assert.equal(
    classifyOpsItemToDklRow({ kategori: 'Handling / THC / Demurrage', keterangan: 'Penumpukan / Storage SP2 JICT' }),
    'Handling / THC / Demurrage'
  );
  assert.equal(
    classifyOpsItemToDklRow({ kategori: 'Trucking / Angkutan', keterangan: 'Uang jalan tracking trailer' }),
    'Trucking / Angkutan'
  );
  assert.equal(
    classifyOpsItemToDklRow({ kategori: 'Karantina / Behandle Merah', keterangan: 'Biaya pemeriksaan fisik & Bhandle' }),
    'Pemeriksaan/Bhandle'
  );
  assert.equal(
    classifyOpsItemToDklRow({ kategori: 'Jasa Lapangan / Ops', keterangan: 'Urus respon PFPD bea cukai' }),
    'PFPD'
  );
  assert.equal(
    classifyOpsItemToDklRow({ kategori: 'Trucking / Angkutan', keterangan: 'Biaya penarikan kontainer dari depo' }),
    'Penarikan Kontainer'
  );
  assert.equal(
    classifyOpsItemToDklRow({ kategori: 'TILA / Eslah / Gate Pass', keterangan: 'Pengurusan Estlah / Kartu Gate TPS' }),
    'TILA / Eslah / Gate Pass'
  );
  assert.equal(
    classifyOpsItemToDklRow({ kategori: 'Jasa Lapangan / Ops', keterangan: 'Extra lapangan koordinasi malam' }),
    'Extra Lap.'
  );
  assert.equal(
    classifyOpsItemToDklRow({ kategori: 'Jasa Lapangan / Ops', keterangan: 'Biaya Jasa PPJK handling dokumen' }),
    'Jasa PPJK'
  );
  assert.equal(
    classifyOpsItemToDklRow({ kategori: 'Lainnya', keterangan: 'Materai & fotokopi berkas' }),
    'Lainnya'
  );
});

test('buildDklCoverDocument aggregates only expenses for the target kodeOs and computes totals', () => {
  const shipment = makeMockShipment();
  const expenses: PengeluaranOpsItem[] = [
    makeExpense({
      id: '1',
      kodeOs: 'OS-2611-0004',
      kategori: 'D/O & Pelayaran',
      keterangan: 'Penebusan D/O Pelayaran',
      nominal: 1650000,
      statusPengeluaran: 'Sudah Dibayar',
      buktiNamaFile: 'do.jpg',
    }),
    makeExpense({
      id: '2',
      kodePengeluaran: 'KOP-2611-0002',
      noTandaTerima: 'TT-KOP-2611-0002',
      kodeOs: 'OS-2611-0004',
      kategori: 'TILA / Eslah / Gate Pass',
      keterangan: 'Pengurusan TILA & Eslah Gate Pass',
      nominal: 875000,
      statusPengeluaran: 'Uang Muka / Kasbon',
      buktiNamaFile: '',
    }),
    makeExpense({
      id: '3',
      kodeOs: 'OS-2611-9999', // Other OS must be excluded
      kategori: 'Trucking / Angkutan',
      keterangan: 'Tracking OS lain',
      nominal: 5000000,
    }),
  ];

  const doc = buildDklCoverDocument(shipment, {
    pengeluaranOps: expenses,
    importirs: [{ kodeImportir: 'IMP-01', namaImportir: 'PT Importir Sejahtera' }],
  });

  assert.equal(doc.rows.length, 12);
  assert.equal(doc.consignee, 'PT Importir Sejahtera');
  assert.equal(doc.vessel, 'MV SINAR MALUKU');
  assert.equal(doc.voy, '170S');

  const doRow = doc.rows.find((r) => r.jenisBiaya === 'D/O & Pelayaran');
  assert.equal(doRow?.ada, true);
  assert.equal(doRow?.nominal, 1650000);
  assert.match(doRow?.keterangan || '', /TT-KOP-2611-0001/);

  const eslahRow = doc.rows.find((r) => r.jenisBiaya === 'TILA / Eslah / Gate Pass');
  assert.equal(eslahRow?.ada, true);
  assert.equal(eslahRow?.nominal, 875000);

  const bmRow = doc.rows.find((r) => r.jenisBiaya === 'BM/PDRI (PIB)');
  assert.equal(bmRow?.ada, false);
  assert.equal(bmRow?.nominal, 0);
  assert.match(bmRow?.keterangan || '', /Ref PIB: Rp 42\.500\.000/);

  assert.equal(doc.totalNominal, 2525000);
  assert.equal(doc.totalSudahDibayar, 1650000);
  assert.equal(doc.totalKasbon, 875000);
  assert.equal(doc.totalTransaksi, 2);
  assert.equal(doc.totalTanpaBukti, 1);
});

test('buildDklCoverDocument supports blank mode (fillAutoStatus: false) and recalculateDklTotals', () => {
  const shipment = makeMockShipment();
  const expenses = [makeExpense({ nominal: 1500000 })];
  const blankDoc = buildDklCoverDocument(shipment, {
    pengeluaranOps: expenses,
    fillAutoStatus: false,
  });

  assert.equal(blankDoc.totalNominal, 0);
  assert.ok(blankDoc.rows.every((r) => !r.ada && r.nominal === 0 && r.keterangan === ''));

  const editedRows = blankDoc.rows.map((r, idx) =>
    idx === 0 ? { ...r, ada: true, nominal: 2000000 } : r
  );
  const recalculated = recalculateDklTotals(editedRows, expenses);
  assert.equal(recalculated.totalNominal, 2000000);
});
