import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseState } from '../types/ppjk';
import {
  computeSpreadsheetSyncDiffSummary,
  DATABASE_SHEET_TABS,
  extractSpreadsheetIdFromInput,
  parseSheetMatrixMapToDatabase,
  serializeDatabaseToSheetMatrixMap,
} from './sheetsSchema';
import {
  createEmptyChecklist,
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_PENGATURAN,
} from './ppjkLogic';

function makeSampleDb(): DatabaseState {
  const terimaDok = createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS);
  terimaDok.items['Packinglist'] = true;
  const dokumenOs = createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS);
  dokumenOs.items['SPPB'] = true;

  return {
    shipments: [
      {
        kodeOs: 'OS-2611-0001',
        kodeManualDokOs: 'TN-196',
        ship: 'MV EVERGREEN TEST',
        kodeCustomer: 'CUST-001',
        namaCustomer: 'PT Nusantara Baja Mandiri',
        tglTerimaDok: '2026-11-10',
        terimaDok,
        noPackinglist: 'PL-001',
        noBl: 'BL-9988',
        statusDokumen: 'Ready',
        etd: '2026-11-05',
        eta: '2026-11-20',
        countDownEta: 4,
        noCont: 'EGHU1234567 (40HC)',
        bc11Terbit: true,
        noBc11: '004819',
        tglBc11: '2026-11-15',
        doPelayaranStatus: 'Sedia',
        doBerlakuSampai: '2026-11-25',
        doCatatanPerpanjangan: 'Aktif',
        doGatePassStatus: 'Sedia',
        doGatePassJenis: 'Eslah & TILA',
        doGatePassNomor: 'GP-001',
        truckingStatus: 'Sedia',
        truckingNamaSupir: 'Pak Slamet',
        truckingNoPlat: 'B 9123 TX',
        truckingNoHpSupir: '08123456789',
        gateOutStatus: 'Sudah',
        gateOutTanggal: '2026-11-16',
        gateOutCatatan: 'Keluar aman',
        suratJalanNomor: 'SJ-2611-0001',
        suratJalanTanggal: '2026-11-16',
        suratJalanStatus: 'Dalam Pengiriman',
        suratJalanTujuan: 'Gudang Cikarang',
        suratJalanPenerima: 'Andi Gudang',
        suratJalanCatatan: 'Segel utuh',
        suratJalanUpdatedAt: '2026-11-16T08:00:00Z',
        billingStatus: 'Penagihan Terbit',
        billingNomor: 'INV-2611-0001',
        billingTanggal: '2026-11-16',
        billingJatuhTempo: '2026-11-23',
        billingItems: [
          { id: 'b-1', deskripsi: 'Jasa PPJK', qty: 1, satuan: 'Dok', hargaSatuan: 3500000 },
        ],
        billingPpnPersen: 11,
        billingTotal: 3885000,
        billingCatatan: 'Term 7 hari',
        billingOwnerNotifiedAt: '2026-11-16T07:00:00Z',
        billingOwnerNotifiedVia: 'WhatsApp',
        billingOwnerNotifiedBy: 'Admin',
        billingCustomerSentAt: '',
        billingCustomerSentVia: '',
        billingCreatedBy: 'Admin',
        noAju: '000020-010234-20261111-000001',
        tglAju: '2026-11-11',
        status: 'SPPB Terbit',
        nopen: '448905',
        tglNopen: '2026-11-14',
        jalur: 'Hijau',
        kodeImportir: 'IMP-001',
        shipper: 'Shanghai Steel Ltd',
        description: 'Cold Rolled Coils',
        negaraAsal: 'China',
        currency: 'USD',
        kurs: 15850,
        invoice: 50000,
        bmPdri: 'Rp 142.500.000',
        sptnp: 'Tidak',
        noSppb: 'SPPB-040200/2026/11920',
        tglSppb: '2026-11-15',
        dokumenChecker: 'Rina Kusuma',
        noSptnp: '',
        tglSptnp: '',
        pfpb: '',
        tglPfpb: '',
        pfpd: '',
        tglPfpd: '',
        eslah: '',
        tglEslah: '',
        dokumenOs,
        createdAt: '2026-11-10T08:00:00Z',
        createdBy: 'checker1',
        updatedAt: '2026-11-16T08:00:00Z',
        updatedBy: 'admin',
      },
    ],
    kontainers: [
      { id: 'c-1', kodeOs: 'OS-2611-0001', noCont: 'EGHU1234567', ukuranTipe: '40HC' },
    ],
    customers: [
      { kodeCustomer: 'CUST-001', namaCustomer: 'PT Nusantara Baja Mandiri', kontak: '08111222333' },
    ],
    importirs: [{ kodeImportir: 'IMP-001', namaImportir: 'PT Nusantara Baja Mandiri (API-U)' }],
    shippers: [{ namaShipper: 'Shanghai Steel Ltd', negara: 'China' }],
    users: [
      {
        username: 'admin',
        passwordHash: 'abc123hash',
        salt: 'salt123',
        nama: 'Hendra Wijaya (Admin)',
        role: 'Admin',
        aktif: true,
        mustChangePassword: false,
        phasePermissions: { phase1: true, phase2: true, phase3: true, phase4: true },
        modulePermissions: { do: false, penagihan: true },
      },
    ],
    logs: [
      {
        id: 'log-1',
        waktu: '2026-11-16T08:00:00Z',
        user: 'admin',
        kodeOs: 'OS-2611-0001',
        kolom: 'status',
        nilaiLama: 'Dokumen Diterima',
        nilaiBaru: 'SPPB Terbit',
      },
    ],
    catatan: [
      {
        id: 'cat-1',
        kodeOs: 'OS-2611-0001',
        waktu: '2026-11-16T08:00:00Z',
        user: 'admin',
        isi: 'Siap pengiriman ke gudang Cikarang.',
      },
    ],
    dokumen: [
      {
        id: 'doc-1',
        kodeOs: 'OS-2611-0001',
        jenisDokumen: 'SPPB',
        namaFile: 'SPPB_11920.pdf',
        linkDrive: 'https://drive.google.com/file/d/file123/view',
        waktuUpload: '2026-11-16T08:00:00Z',
        user: 'admin',
        driveFileId: 'file123',
        source: 'google-drive',
      },
    ],
    pengeluaranOps: [
      {
        id: 'kop-1',
        kodePengeluaran: 'KOP-2611-0001',
        noTandaTerima: 'TT-KOP-2611-0001',
        kodeOs: 'OS-2611-0001',
        noBl: 'BL-9988',
        namaCustomer: 'PT Nusantara Baja Mandiri',
        tanggal: '2026-11-15',
        kategori: 'D/O & Pelayaran',
        keterangan: 'Perpanjangan D/O & Gate Pass Priok',
        nominal: 1750000,
        metodePembayaran: 'Uang Muka / Kasbon Ops',
        statusPengeluaran: 'Selesai / Dipertanggungjawabkan',
        petugasOps: 'Slamet Riyadi (Ops)',
        diberikanOleh: 'Hendra Wijaya (Admin)',
        tandaTerimaAt: '2026-11-15T09:00:00Z',
        buktiNamaFile: 'bukti_do_priok.jpg',
        source: 'offline-local',
        createdAt: '2026-11-15T09:00:00Z',
        createdBy: 'admin',
        updatedAt: '2026-11-15T10:00:00Z',
        updatedBy: 'admin',
      },
    ],
    pengaturan: {
      ...DEFAULT_PENGATURAN,
      seqByMonth: { '2611': 1 },
      seqPengeluaranByMonth: { '2611': 1 },
      spreadsheetId: '1AbCDefGhIjKlMnOpQrStUvWxYz_12345',
      spreadsheetTitle: 'PTG_PPJK_DATABASE',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1AbCDefGhIjKlMnOpQrStUvWxYz_12345/edit',
      spreadsheetAutoSync: true,
      ppjkBrandName: 'SAMUDERA PPJK',
      ppjkCompanyName: 'PT Samudera Kepabeanan',
      ppjkNpwp: '09.876.543.2-041.000',
      ppjkLogoDataUrl: 'data:image/png;base64,TESTLOGO',
      ppjkLogoFileName: 'logo-samudera.png',
      ppjkKopSuratDataUrl: 'data:image/jpeg;base64,TESTKOP',
      ppjkKopSuratFileName: 'kop-samudera.jpg',
      roleModuleAccess: {
        Checker: { do: false, master: false },
      },
      gasWebAppUrl: 'https://script.google.com/macros/s/TEST_DEPLOY_ID/exec',
      gasWebAppAutoSync: true,
      gasWebAppFullSyncAuto: false,
      gasWebAppLastFullSyncAt: '2026-11-18T09:55:00.000Z',
    },
  };
}

test('extractSpreadsheetIdFromInput extracts ID from URLs or raw IDs and rejects invalid values', () => {
  assert.equal(
    extractSpreadsheetIdFromInput(
      'https://docs.google.com/spreadsheets/d/1AbCDefGhIjKlMnOpQrStUvWxYz_12345/edit#gid=0'
    ),
    '1AbCDefGhIjKlMnOpQrStUvWxYz_12345'
  );
  assert.equal(
    extractSpreadsheetIdFromInput('  1AbCDefGhIjKlMnOpQrStUvWxYz_12345  '),
    '1AbCDefGhIjKlMnOpQrStUvWxYz_12345'
  );
  assert.equal(extractSpreadsheetIdFromInput('short'), '');
  assert.equal(extractSpreadsheetIdFromInput(''), '');
});

test('serializeDatabaseToSheetMatrixMap and parseSheetMatrixMapToDatabase round-trip all 12 tabs losslessly', () => {
  const sample = makeSampleDb();
  const matrixMap = serializeDatabaseToSheetMatrixMap(sample, 'admin', '2026-11-16T10:00:00Z');

  assert.equal(Object.keys(matrixMap).length, DATABASE_SHEET_TABS.length);
  assert.equal(matrixMap.Shipments.length, 2);
  assert.equal(matrixMap.Kontainer.length, 2);
  assert.equal(matrixMap.Master_Customer.length, 2);
  assert.equal(matrixMap.Users.length, 2);
  assert.equal(matrixMap.Pengeluaran_Ops.length, 2);

  // Also test resilience if columns in Shipments are reversed/reordered inside Google Sheets
  const reversedShipments = matrixMap.Shipments.map((row) => [...row].reverse());
  const parsed = parseSheetMatrixMapToDatabase(
    {
      ...matrixMap,
      Shipments: reversedShipments,
    },
    sample
  );

  assert.equal(parsed.shipments.length, 1);
  const s = parsed.shipments[0];
  assert.equal(s.kodeOs, 'OS-2611-0001');
  assert.equal(s.kodeManualDokOs, 'TN-196');
  assert.equal(s.ship, 'MV EVERGREEN TEST');
  assert.equal(s.bc11Terbit, true);
  assert.equal(s.terimaDok.items['Packinglist'], true);
  assert.equal(s.dokumenOs.items['SPPB'], true);
  assert.equal(s.billingItems?.length, 1);
  assert.equal(s.billingItems?.[0].hargaSatuan, 3500000);
  assert.equal(s.billingTotal, 3885000);
  assert.equal(s.suratJalanNomor, 'SJ-2611-0001');
  assert.equal(s.nopen, '448905');
  assert.equal(parsed.kontainers.length, 1);
  assert.equal(parsed.customers[0].namaCustomer, 'PT Nusantara Baja Mandiri');
  assert.equal(parsed.pengeluaranOps.length, 1);
  assert.equal(parsed.pengeluaranOps[0].kodePengeluaran, 'KOP-2611-0001');
  assert.equal(parsed.pengeluaranOps[0].nominal, 1750000);
  assert.equal(parsed.pengeluaranOps[0].petugasOps, 'Slamet Riyadi (Ops)');
  assert.equal(parsed.users[0].phasePermissions?.phase3, true);
  assert.deepEqual(parsed.users[0].modulePermissions, { do: false, penagihan: true });
  assert.equal(parsed.pengaturan.spreadsheetAutoSync, true);
  assert.equal(parsed.pengaturan.seqByMonth['2611'], 1);
  assert.equal(parsed.pengaturan.seqPengeluaranByMonth?.['2611'], 1);
  assert.equal(parsed.pengaturan.ppjkBrandName, 'SAMUDERA PPJK');
  assert.equal(parsed.pengaturan.ppjkCompanyName, 'PT Samudera Kepabeanan');
  assert.equal(parsed.pengaturan.ppjkNpwp, '09.876.543.2-041.000');
  assert.equal(parsed.pengaturan.ppjkLogoDataUrl, 'data:image/png;base64,TESTLOGO');
  assert.equal(parsed.pengaturan.ppjkLogoFileName, 'logo-samudera.png');
  assert.equal(parsed.pengaturan.ppjkKopSuratDataUrl, 'data:image/jpeg;base64,TESTKOP');
  assert.equal(parsed.pengaturan.ppjkKopSuratFileName, 'kop-samudera.jpg');
  assert.deepEqual(parsed.pengaturan.roleModuleAccess, {
    Checker: { do: false, master: false },
  });
  assert.equal(
    parsed.pengaturan.gasWebAppUrl,
    'https://script.google.com/macros/s/TEST_DEPLOY_ID/exec'
  );
  assert.equal(parsed.pengaturan.gasWebAppAutoSync, true);
  assert.equal(parsed.pengaturan.gasWebAppFullSyncAuto, false);
  assert.equal(parsed.pengaturan.gasWebAppLastFullSyncAt, '2026-11-18T09:55:00.000Z');

  const diff = computeSpreadsheetSyncDiffSummary(sample, parsed);
  assert.equal(diff.localCounts.shipments, 1);
  assert.equal(diff.remoteCounts.shipments, 1);
  assert.equal(diff.localCounts.pengeluaranOps, 1);
  assert.equal(diff.remoteCounts.pengeluaranOps, 1);
  assert.equal(diff.totalLocalRows, diff.totalRemoteRows);
});
