import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGasAddActionPayload,
  buildGasFullGetUrl,
  buildGasSyncAllActionPayload,
  buildSampleGasWebAppScript,
  DEFAULT_GAS_WEBAPP_URL,
  GAS_SHIPMENT_SHEET_HEADERS,
  mergeGasFetchedShipments,
  parseGasWebAppFullDatabaseGetResponse,
  parseGasWebAppGetResponse,
  validateGasWebAppUrl,
} from './gasWebAppLogic';
import { createEmptyChecklist, DEFAULT_CHECKLIST_ITEMS, DEFAULT_PENGATURAN } from './ppjkLogic';
import type { DatabaseState, Shipment } from '../types/ppjk';

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    kodeOs: 'OS-2611-0001',
    kodeManualDokOs: 'TN-101',
    ship: 'MV EVER GREEN V.12',
    kodeCustomer: 'CUST-001',
    namaCustomer: 'PT Maju Jaya',
    tglTerimaDok: '2026-11-10',
    terimaDok: createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS),
    noPackinglist: 'PL-001',
    noBl: 'BL-998811',
    statusDokumen: 'Ready',
    etd: '2026-11-05',
    eta: '2026-11-20',
    countDownEta: 2,
    noCont: 'MSKU1234567 (40HC)',
    bc11Terbit: true,
    noBc11: '004122',
    tglBc11: '2026-11-12',
    doPelayaranStatus: 'Belum',
    noAju: '000020-123456',
    tglAju: '2026-11-11',
    status: 'Proses PIB/AJU',
    nopen: '123456',
    tglNopen: '2026-11-12',
    jalur: 'Hijau',
    kodeImportir: 'IMP-01',
    shipper: 'SHANGHAI CORP',
    description: 'MESIN INDUSTRI',
    negaraAsal: 'CHINA',
    currency: 'USD',
    kurs: 15800,
    invoice: 25000,
    bmPdri: 'Rp 15.000.000',
    sptnp: 'Tidak',
    noSppb: 'SPPB-001',
    tglSppb: '2026-11-13',
    dokumenChecker: 'Budi Checker',
    noSptnp: '',
    tglSptnp: '',
    pfpb: '',
    tglPfpb: '',
    pfpd: '',
    tglPfpd: '',
    eslah: '',
    tglEslah: '',
    dokumenOs: createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS),
    createdAt: '2026-11-10T08:00:00.000Z',
    createdBy: 'admin',
    updatedAt: '2026-11-10T08:00:00.000Z',
    updatedBy: 'admin',
    ...overrides,
  };
}

describe('gasWebAppLogic', () => {
  it('validates the exact default /dev Web App URL', () => {
    const res = validateGasWebAppUrl(DEFAULT_GAS_WEBAPP_URL);
    assert.equal(res.valid, true);
    assert.equal(res.isDevEndpoint, true);
    assert.equal(
      res.normalizedUrl,
      'https://script.google.com/macros/s/AKfycbxS0527e6Urzg4Dyipl8oJpzSCxx7DU3qAntocgwg/dev'
    );
  });

  it('rejects empty, non-HTTPS, and non-GAS URLs', () => {
    assert.equal(validateGasWebAppUrl('').valid, false);
    assert.equal(
      validateGasWebAppUrl('http://script.google.com/macros/s/abc/exec').valid,
      false
    );
    assert.equal(validateGasWebAppUrl('https://example.com/api').valid, false);
    assert.equal(
      validateGasWebAppUrl('https://script.google.com/macros/s/abc/exec').isDevEndpoint,
      false
    );
  });

  it('builds exact { action: "add", data: {...} } POST payload with all 41 summary fields', () => {
    const shipment = makeShipment({
      doPelayaranStatus: 'Sedia',
      doBerlakuSampai: '2026-11-25',
      doGatePassStatus: 'Sedia',
      doGatePassJenis: 'TILA (Kartu Gate)',
      doGatePassNomor: 'GP-7788',
      truckingStatus: 'Sedia',
      truckingNamaSupir: 'Pak Budi',
      truckingNoPlat: 'B 9123 TX',
      gateOutStatus: 'Sudah',
      gateOutTanggal: '2026-11-21',
      suratJalanNomor: 'SJ-001',
      suratJalanStatus: 'Terbit',
      billingStatus: 'Penagihan Terbit',
      billingNomor: 'INV-2026-01',
      billingTotal: 5500000,
      pfpb: 'Selesai',
      tglPfpb: '2026-11-22',
    });
    const payload = buildGasAddActionPayload(
      shipment,
      [{ id: 'c1', kodeOs: 'OS-2611-0001', noCont: 'MSKU1234567', ukuranTipe: '40HC' }],
      {
        importirs: [{ kodeImportir: 'IMP-01', namaImportir: 'PT Importir Utama' }],
        checklistItems: DEFAULT_CHECKLIST_ITEMS,
      }
    );
    assert.equal(payload.action, 'add');
    assert.equal(payload.data.kodeOs, 'OS-2611-0001');
    assert.equal(payload.data.noBl, 'BL-998811');
    assert.equal(payload.data.namaCustomer, 'PT Maju Jaya');
    assert.equal(payload.data.namaImportir, 'PT Importir Utama');
    assert.equal(payload.data.jalur, 'Hijau');
    assert.equal(payload.data.kontainerList.length, 1);
    assert.equal(payload.data.kontainerList[0].noCont, 'MSKU1234567');
    assert.match(payload.data.bc11Ringkasan, /004122/);
    assert.match(payload.data.terimaDokRingkasan, /^\d+\/\d+/);
    assert.match(payload.data.dokumenOsRingkasan, /^\d+\/\d+ · (OS|Selesai)/);
    assert.match(payload.data.doPelayaranRingkasan, /Sedia \(s\.d\. 2026-11-25\)/);
    assert.match(payload.data.gatePassTruckingRingkasan, /GP-7788/);
    assert.match(payload.data.gateOutSuratJalanRingkasan, /SJ-001/);
    assert.match(payload.data.penagihanRingkasan, /INV-2026-01/);
    assert.match(payload.data.pascaSppbRingkasan, /PFPB: Selesai \(2026-11-22\)/);
  });

  it('parses wrapped { data: [...] } and raw array GET responses with flexible headers', () => {
    const wrapped = parseGasWebAppGetResponse(
      {
        ok: true,
        data: [
          {
            'Kode OS': 'OS-2611-0099',
            'No. BL': 'COSU887766',
            'Nama Customer': 'PT Nusantara Logistik',
            Ship: 'MV COSCO HARMONY',
            ETA: '2026-11-28T00:00:00.000Z',
            'No. AJU': '000020-999111',
            Status: 'SPPB Terbit',
            Jalur: 'MITA',
            Invoice: '45000',
          },
        ],
      },
      DEFAULT_CHECKLIST_ITEMS
    );

    assert.equal(wrapped.shipments.length, 1);
    assert.equal(wrapped.shipments[0].kodeOs, 'OS-2611-0099');
    assert.equal(wrapped.shipments[0].noBl, 'COSU887766');
    assert.equal(wrapped.shipments[0].eta, '2026-11-28');
    assert.equal(wrapped.shipments[0].jalur, 'MITA');
    assert.equal(wrapped.shipments[0].invoice, 45000);

    const matrix = parseGasWebAppGetResponse(
      [
        ['kodeOs', 'noBl', 'namaCustomer', 'status'],
        ['', 'MAEU112233', 'PT Samudra', 'Menunggu Jalur'],
      ],
      DEFAULT_CHECKLIST_ITEMS
    );
    assert.equal(matrix.shipments.length, 1);
    assert.equal(matrix.shipments[0].noBl, 'MAEU112233');
  });

  it('returns errorMessage when GAS endpoint reports { ok: false } or { status: "error" }', () => {
    const errRes = parseGasWebAppGetResponse(
      { status: 'error', message: 'Tab Shipments tidak ditemukan' },
      DEFAULT_CHECKLIST_ITEMS
    );
    assert.equal(errRes.shipments.length, 0);
    assert.match(errRes.errorMessage || '', /Tab Shipments/i);
  });

  it('merges fetched shipments cleanly into DatabaseState (upserts by kodeOs/noBl and auto-generates missing kodeOs)', () => {
    const baseDb: DatabaseState = {
      shipments: [makeShipment()],
      kontainers: [],
      customers: [],
      importirs: [],
      shippers: [],
      users: [],
      logs: [],
      catatan: [],
      dokumen: [],
      pengeluaranOps: [],
      pengaturan: { ...DEFAULT_PENGATURAN },
    };

    const parsed = parseGasWebAppGetResponse(
      {
        data: [
          {
            kodeOs: 'OS-2611-0001',
            noBl: 'BL-998811',
            namaCustomer: 'PT Maju Jaya Tbk',
            status: 'SPPB Terbit',
          },
          {
            kodeOs: '',
            noBl: 'BL-BARU-002',
            namaCustomer: 'PT Lintas Laut',
            ship: 'MV LINTAS 02',
            status: 'Dokumen Diterima',
          },
        ],
      },
      DEFAULT_CHECKLIST_ITEMS,
      baseDb.shipments
    );

    const merged = mergeGasFetchedShipments(baseDb, parsed.shipments, 'admin');
    assert.equal(merged.updatedCount, 1);
    assert.equal(merged.insertedCount, 1);
    assert.equal(merged.nextDb.shipments.length, 2);

    const updatedRow = merged.nextDb.shipments.find((s) => s.kodeOs === 'OS-2611-0001');
    assert.equal(updatedRow?.namaCustomer, 'PT Maju Jaya Tbk');
    assert.equal(updatedRow?.status, 'SPPB Terbit');

    const insertedRow = merged.nextDb.shipments.find((s) => s.noBl === 'BL-BARU-002');
    assert.ok(insertedRow?.kodeOs.startsWith('OS-'));
    assert.equal(merged.nextDb.pengaturan.gasWebAppLastSyncDirection, 'get');
  });

  it('generates sample Apps Script handler matching GET & 41/82-column + 12-tab database structure', () => {
    assert.equal(GAS_SHIPMENT_SHEET_HEADERS.length, 41);
    assert.equal(GAS_SHIPMENT_SHEET_HEADERS[0], 'No.');
    assert.equal(GAS_SHIPMENT_SHEET_HEADERS[40], 'Dok. OS');

    const script = buildSampleGasWebAppScript();
    assert.match(script, /function doGet/);
    assert.match(script, /function doPost/);
    assert.match(script, /ensureDatabaseTabs_/);
    assert.match(script, /body\.action === 'syncAll'/);
    assert.match(script, /body\.action === 'initTabs'/);
    assert.match(script, /body\.action === 'appendTabRow'/);
    assert.match(script, /body\.action === 'add'/);
    assert.match(script, /build82ColShipmentRow_/);
    assert.match(script, /build41ColShipmentRow_/);
    for (const header of GAS_SHIPMENT_SHEET_HEADERS) {
      assert.ok(script.includes(header), `Expected script to include header "${header}"`);
    }
    assert.match(script, /41\. Dok\. OS/);
    for (const tabName of [
      'Shipments',
      'Kontainer',
      'Master_Customer',
      'Master_Importir',
      'Master_Shipper',
      'Users',
      'Log_Perubahan',
      'Catatan',
      'Dokumen',
      'Pengeluaran_Ops',
      'Pengaturan',
      'Sync_Metadata',
    ]) {
      assert.ok(script.includes(tabName), `Expected script to include tab "${tabName}"`);
    }
  });

  it('builds 12-tab syncAll POST payload with exact column counts and round-trips via full GET parser', () => {
    const baseDb: DatabaseState = {
      shipments: [makeShipment()],
      kontainers: [
        { id: 'c1', kodeOs: 'OS-2611-0001', noCont: 'MSKU1234567', ukuranTipe: '40HC' },
      ],
      customers: [{ kodeCustomer: 'CUST-001', namaCustomer: 'PT Maju Jaya', kontak: '0812345' }],
      importirs: [{ kodeImportir: 'IMP-01', namaImportir: 'PT Importir Utama' }],
      shippers: [{ namaShipper: 'SHANGHAI CORP', negara: 'CHINA' }],
      users: [],
      logs: [
        {
          id: 'log-1',
          waktu: '2026-11-10T08:00:00.000Z',
          user: 'admin',
          kodeOs: 'OS-2611-0001',
          kolom: 'status',
          nilaiLama: 'Draft',
          nilaiBaru: 'Proses PIB/AJU',
        },
      ],
      catatan: [
        {
          id: 'cat-1',
          kodeOs: 'OS-2611-0001',
          waktu: '2026-11-10T08:00:00.000Z',
          user: 'admin',
          isi: 'Dokumen lengkap',
        },
      ],
      dokumen: [],
      pengeluaranOps: [],
      pengaturan: { ...DEFAULT_PENGATURAN },
    };

    const payload = buildGasSyncAllActionPayload(baseDb, 'admin', '2026-11-18T10:00:00.000Z');
    assert.equal(payload.action, 'syncAll');
    assert.equal(payload.tabs.length, 12);

    const colCounts = Object.fromEntries(payload.tabs.map((t) => [t.title, t.headers.length]));
    assert.deepEqual(colCounts, {
      Shipments: 82,
      Kontainer: 4,
      Master_Customer: 3,
      Master_Importir: 2,
      Master_Shipper: 2,
      Users: 9,
      Log_Perubahan: 7,
      Catatan: 5,
      Dokumen: 10,
      Pengeluaran_Ops: 26,
      Pengaturan: 2,
      Sync_Metadata: 2,
    });

    assert.equal(
      buildGasFullGetUrl(DEFAULT_GAS_WEBAPP_URL),
      `${DEFAULT_GAS_WEBAPP_URL}?mode=full`
    );

    const emptyFallback: DatabaseState = {
      ...baseDb,
      shipments: [],
      kontainers: [],
      customers: [],
      importirs: [],
      shippers: [],
      logs: [],
      catatan: [],
    };
    const parsed = parseGasWebAppFullDatabaseGetResponse(
      { ok: true, mode: 'full', sheets: payload.sheets },
      emptyFallback
    );
    assert.equal(parsed.matchedFullTabs, true);
    assert.equal(parsed.errorMessage, undefined);
    assert.equal(parsed.nextDb.shipments.length, 1);
    assert.equal(parsed.nextDb.kontainers.length, 1);
    assert.equal(parsed.nextDb.customers.length, 1);
    assert.equal(parsed.nextDb.importirs.length, 1);
    assert.equal(parsed.nextDb.shippers.length, 1);
    assert.equal(parsed.nextDb.logs.length, 1);
    assert.equal(parsed.nextDb.catatan.length, 1);
    assert.equal(parsed.tabRowCounts.Shipments, 1);
    assert.equal(parsed.tabRowCounts.Kontainer, 1);
  });
});
