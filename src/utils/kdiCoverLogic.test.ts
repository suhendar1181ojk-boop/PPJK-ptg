import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pengaturan, PengeluaranOpsItem, Shipment } from '../types/ppjk';
import { DEFAULT_CHECKLIST_ITEMS, DEFAULT_PENGATURAN } from './ppjkLogic';
import {
  buildKdiCoverDocument,
  extractVoyFromShip,
  formatTanggalIndonesia,
  KDI_STANDARD_DOCUMENT_ROWS,
} from './kdiCoverLogic';

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    kodeOs: 'OS-2611-0004',
    ship: 'OOCL JAKARTA V.081',
    kodeCustomer: 'CUST-001',
    namaCustomer: 'PT Nusantara Baja Mandiri',
    tglTerimaDok: '2026-11-10',
    terimaDok: {
      items: {
        'Bill of Lading (BL)': true,
        'Commercial Invoice': true,
        'Packing List': true,
        'Certificate of Origin (COO/SKA)': true,
        'Asuransi / Polis': false,
        'Surat Kuasa & PIB Draft': false,
      },
      catatan: '',
    },
    noPackinglist: 'PL-NBM-2611-04',
    noBl: 'OOLU2689112004',
    statusDokumen: 'Ready',
    etd: '2026-11-05',
    eta: '2026-11-21',
    countDownEta: 4,
    noCont: 'OOLU3322114 (40HC)',
    bc11Terbit: true,
    noBc11: '004819',
    tglBc11: '2026-11-16',
    doPelayaranStatus: 'Sedia',
    doBerlakuSampai: '2026-11-25',
    truckingStatus: 'Sedia',
    truckingNamaSupir: 'Agus Setiawan',
    truckingNoPlat: 'B 9412 UIX',
    truckingNoHpSupir: '0812-8841-2094',
    noAju: '000020-010234-20261111-002290',
    tglAju: '2026-11-11',
    status: 'SPPB Terbit',
    nopen: '448905',
    tglNopen: '2026-11-12',
    jalur: 'MITA',
    kodeImportir: 'IMP-001',
    shipper: 'Nippon Steel Trading',
    description: 'Galvanized Steel Sheets',
    negaraAsal: 'Jepang',
    currency: 'JPY',
    kurs: 104,
    invoice: 8500000,
    bmPdri: 'Rp 118.400.000',
    sptnp: 'Tidak',
    noSppb: 'SPPB-040200/2026/11920',
    tglSppb: '2026-11-15',
    dokumenChecker: 'Rina Kusuma',
    noSptnp: '',
    tglSptnp: '',
    pfpb: 'PFPB-2026-119',
    tglPfpb: '2026-11-13',
    pfpd: 'PFPD-2026-082',
    tglPfpd: '2026-11-14',
    eslah: 'ESLAH-001',
    tglEslah: '2026-11-15',
    dokumenOs: {
      items: Object.fromEntries(DEFAULT_CHECKLIST_ITEMS.map((k) => [k, false])),
      catatan: '',
    },
    createdAt: '2026-11-10T08:00:00.000Z',
    createdBy: 'checker1',
    updatedAt: '2026-11-15T08:00:00.000Z',
    updatedBy: 'ops1',
    ...overrides,
  };
}

test('formatTanggalIndonesia converts ISO dates into Indonesian long format', () => {
  assert.equal(formatTanggalIndonesia('2023-11-21'), '21 November 2023');
  assert.equal(formatTanggalIndonesia('2026-12-08'), '8 Desember 2026');
  assert.equal(formatTanggalIndonesia(''), '');
});

test('extractVoyFromShip separates vessel name and voyage number cleanly', () => {
  assert.deepEqual(extractVoyFromShip('OOCL JAKARTA V.081'), {
    vessel: 'OOCL JAKARTA',
    voy: '081',
  });
  assert.deepEqual(extractVoyFromShip('XIN ZHAN JIANG VOY 170S'), {
    vessel: 'XIN ZHAN JIANG',
    voy: '170S',
  });
  assert.deepEqual(extractVoyFromShip('EVER GIVEN'), {
    vessel: 'EVER GIVEN',
    voy: '',
  });
});

test('buildKdiCoverDocument maps Kop PPJK, metadata, 20 KDI rows, and linked ops amounts', () => {
  const ship = makeShipment();
  const customPengaturan: Pengaturan = {
    ...DEFAULT_PENGATURAN,
    ppjkBrandName: 'PTG CARGO',
    ppjkCompanyName: 'PT Abirama Indo Logistik',
    ppjkAddress: 'Jl. Pelabuhan Tanjung Priok No. 1',
  };
  const ops: PengeluaranOpsItem[] = [
    {
      id: 'kop-1',
      kodePengeluaran: 'KOP-2611-0001',
      noTandaTerima: 'TT-KOP-2611-0001',
      kodeOs: 'OS-2611-0004',
      tanggal: '2026-11-15',
      kategori: 'TILA / Eslah / Gate Pass',
      keterangan: 'Gate pass SP2',
      nominal: 875000,
      metodePembayaran: 'Kas Tunai',
      statusPengeluaran: 'Selesai / Dipertanggungjawabkan',
      petugasOps: 'Slamet',
      diberikanOleh: 'Admin',
      createdAt: '2026-11-15T00:00:00Z',
      createdBy: 'admin',
      updatedAt: '2026-11-15T00:00:00Z',
      updatedBy: 'admin',
    },
  ];

  const doc = buildKdiCoverDocument(ship, {
    pengaturan: customPengaturan,
    importirs: [{ kodeImportir: 'IMP-001', namaImportir: 'PT Nusantara Baja Mandiri (API-U)' }],
    pengeluaranOps: ops,
    bc11Pos: '0042',
    sealBhdlNo: 'SL-9988',
  });

  assert.equal(doc.identity.companyName, 'PT Abirama Indo Logistik');
  assert.equal(doc.kodeOs, 'OS-2611-0004');
  assert.equal(doc.vessel, 'OOCL JAKARTA');
  assert.equal(doc.voy, '081');
  assert.equal(doc.consignee, 'PT Nusantara Baja Mandiri (API-U)');
  assert.equal(doc.etd, '5 November 2026');
  assert.equal(doc.eta, '21 November 2026');
  assert.equal(doc.rows.length, KDI_STANDARD_DOCUMENT_ROWS.length);
  assert.equal(doc.rows[0].ada, true); // INVOICE
  assert.equal(doc.rows[1].ada, true); // PACKING LIST
  assert.equal(doc.rows[2].ada, true); // BILL OF LOADING
  assert.equal(doc.rows[3].ada, false); // MARINE INSURANCE
  assert.equal(doc.rows[11].ada, true); // DELIVERY ORDER (DO)
  assert.match(doc.rows[11].keterangan, /25 November 2026/);
  assert.equal(doc.rows[13].keterangan, 'Rp. 875.000'); // PENUMPUKAN (SP2)
  assert.equal(doc.rows[17].ada, true); // BC 1.1
  assert.match(doc.rows[17].keterangan, /004819.*POS : 0042/);
  assert.equal(doc.rows[18].keterangan, 'NO : SL-9988');
  assert.equal(doc.dokumenCekListBy, 'Rina Kusuma');
});

test('buildKdiCoverDocument leaves ADA/TIDAK checkboxes blank when fillAutoStatus is false and shows Dok. OS when set', () => {
  const ship = makeShipment({ kodeManualDokOs: 'TN-196' });
  const doc = buildKdiCoverDocument(ship, { fillAutoStatus: false });
  assert.equal(doc.rows.every((r) => !r.ada && !r.tidak), true);
  assert.equal(doc.subtitleLine, 'OS : OS-2611-0004 | DOK. OS : TN-196 | SHIPMENT : OOLU2689112004');
});
