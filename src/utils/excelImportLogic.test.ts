import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  buildShipmentImportSampleRow,
  excelSerialToIsoDate,
  normalizeImportedDate,
  parseContainerSummaryToItems,
  parseImportedNumber,
  parseShipmentImportBuffer,
  SHIPMENT_IMPORT_TEMPLATE_HEADERS,
} from './excelImportLogic';
import type { Customer, Shipment } from '../types/ppjk';
import { createEmptyChecklist } from './ppjkLogic';

const sampleCustomers: Customer[] = [
  {
    kodeCustomer: 'CUST-001',
    namaCustomer: 'PT Nusantara Baja Mandiri',
    kontak: '0811111111',
  },
];

function makeExistingShipment(kodeOs: string, noBl: string): Shipment {
  return {
    kodeOs,
    ship: 'MV TEST',
    kodeCustomer: 'CUST-001',
    namaCustomer: 'PT Nusantara Baja Mandiri',
    tglTerimaDok: '2026-11-01',
    terimaDok: createEmptyChecklist(),
    noPackinglist: 'PL-1',
    noBl,
    etd: '2026-11-01',
    eta: '2026-11-10',
    countDownEta: 2,
    noCont: 'CONT1 (40HC)',
    noAju: '',
    tglAju: '',
    status: 'Dokumen Diterima',
    nopen: '',
    tglNopen: '',
    jalur: '',
    kodeImportir: 'IMP-001',
    shipper: 'Test Shipper',
    description: 'Goods',
    negaraAsal: 'China',
    currency: 'USD',
    kurs: 15800,
    invoice: 10000,
    bmPdri: '',
    sptnp: 'Tidak',
    noSppb: '',
    tglSppb: '',
    dokumenChecker: 'Rina Kusuma',
    noSptnp: '',
    tglSptnp: '',
    pfpb: '',
    tglPfpb: '',
    pfpd: '',
    tglPfpd: '',
    eslah: '',
    tglEslah: '',
    dokumenOs: createEmptyChecklist(),
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
  };
}

test('excelSerialToIsoDate & normalizeImportedDate convert Excel serials and DD/MM/YYYY cleanly', () => {
  // 46337 -> 2026-11-11 in Excel serial date
  assert.equal(excelSerialToIsoDate(46337), '2026-11-11');
  assert.equal(normalizeImportedDate('15/11/2026'), '2026-11-15');
  assert.equal(normalizeImportedDate('2026-11-20'), '2026-11-20');
  assert.equal(normalizeImportedDate(46337), '2026-11-11');
});

test('parseImportedNumber & parseContainerSummaryToItems normalize formatted values', () => {
  assert.equal(parseImportedNumber('15.850'), 15850);
  assert.equal(parseImportedNumber('USD 45,000.50'), 45000.5);
  assert.equal(parseImportedNumber('-'), '');

  const containers = parseContainerSummaryToItems('EGHU9012345 (40HC), MSCU4455661 (20FT)');
  assert.equal(containers.length, 2);
  assert.equal(containers[0].noCont, 'EGHU9012345');
  assert.equal(containers[0].ukuranTipe, '40HC');
  assert.equal(containers[1].noCont, 'MSCU4455661');
  assert.equal(containers[1].ukuranTipe, '20FT');
});

test('parseShipmentImportBuffer parses XLSX workbook and classifies valid, duplicate, and error rows', () => {
  const sample = buildShipmentImportSampleRow(new Date('2026-11-18T00:00:00Z'));
  const rowsData = [
    sample,
    {
      ...sample,
      'No. BL': 'BL-EXISTING-001',
      'Dok. OS (Manual)': 'TN-211',
    },
    {
      'Dok. OS (Manual)': 'TN-212',
      'Kode Customer': '',
      'Nama Customer': '',
      'No. BL': '',
      'ETA': '',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(rowsData, { header: SHIPMENT_IMPORT_TEMPLATE_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Import');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const res = parseShipmentImportBuffer(
    buf,
    {
      existingShipments: [makeExistingShipment('OS-2611-0001', 'BL-EXISTING-001')],
      customers: sampleCustomers,
      defaultChecker: 'Rina Kusuma',
    },
    'import-test.xlsx'
  );

  assert.equal(res.rows.length, 3);
  assert.equal(res.validCount, 1);
  assert.equal(res.duplicateCount, 1);
  assert.equal(res.errorCount, 1);
  assert.equal(res.rows[0].status, 'valid');
  assert.equal(res.rows[0].containers.length, 2);
  assert.equal(res.rows[1].status, 'duplicate');
  assert.equal(res.rows[1].matchedExistingKodeOs, 'OS-2611-0001');
  assert.equal(res.rows[2].status, 'error');
  assert.ok(res.rows[2].errors.length >= 2);
});

test('parseShipmentImportBuffer parses semicolon and comma CSV files including customer lookup', () => {
  const csvContent = [
    '\uFEFFDok. OS (Manual);Nama Customer;No. BL;ETD;ETA;No. Cont;Kurs;Invoice;Jalur',
    'TN-301;PT Nusantara Baja Mandiri;BL-CSV-001;10/11/2026;25/11/2026;"TEMU1112223 (40HC), TEMU1112224 (20FT)";15.850;32000;Hijau',
  ].join('\n');
  const bytes = new TextEncoder().encode(csvContent);

  const res = parseShipmentImportBuffer(
    bytes,
    {
      existingShipments: [],
      customers: sampleCustomers,
      defaultChecker: 'Dewi Lestari',
    },
    'upload-shipment.csv'
  );

  assert.equal(res.activeSheet, 'CSV');
  assert.equal(res.validCount, 1);
  assert.equal(res.rows[0].shipment.kodeCustomer, 'CUST-001');
  assert.equal(res.rows[0].shipment.noBl, 'BL-CSV-001');
  assert.equal(res.rows[0].shipment.etd, '2026-11-10');
  assert.equal(res.rows[0].shipment.eta, '2026-11-25');
  assert.equal(res.rows[0].shipment.jalur, 'Hijau');
  assert.equal(res.rows[0].shipment.kurs, 15850);
  assert.equal(res.rows[0].containers.length, 2);
});
