import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseState } from '../types/ppjk';
import { DEFAULT_PENGATURAN } from './ppjkLogic';
import { serializeDatabaseToSheetMatrixMap } from './sheetsSchema';
import {
  BACKUP_FORMAT_ID,
  buildDatabaseBackupFilename,
  buildLocalBackupSnapshotRecord,
  computeBackupCounts,
  computeTotalBackupRecords,
  parseDatabaseBackupFromWorkbookSheets,
  parseDatabaseBackupJson,
  serializeDatabaseBackupJson,
  sortAndTrimLocalBackups,
} from './backupLogic';

function makeFixtureDb(): DatabaseState {
  return {
    shipments: [
      {
        kodeOs: 'OS-2611-0001',
        kodeManualDokOs: 'DOC-01',
        ship: 'MV NUSANTARA',
        kodeCustomer: 'CUST-01',
        namaCustomer: 'PT Maju Jaya',
        tglTerimaDok: '2026-11-10',
        terimaDok: { items: { 'Bill of Lading (BL)': true }, catatan: 'Lengkap' },
        noPackinglist: 'PL-001',
        noBl: 'BL-9988',
        statusDokumen: 'Ready',
        etd: '2026-11-01',
        eta: '2026-11-15',
        countDownEta: 3,
        noCont: 'MSCU1234567',
        noAju: 'AJU-01',
        tglAju: '2026-11-11',
        status: 'SPPB Terbit',
        nopen: '123456',
        tglNopen: '2026-11-12',
        jalur: 'Hijau',
        kodeImportir: 'IMP-01',
        shipper: 'SHANGHAI TRADE CO',
        description: 'Mesin Industri',
        negaraAsal: 'China',
        currency: 'USD',
        kurs: 15800,
        invoice: 25000,
        bmPdri: '15000000',
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
        dokumenOs: { items: { 'Bill of Lading (BL)': true }, catatan: '' },
        createdAt: '2026-11-10T01:00:00.000Z',
        createdBy: 'admin',
        updatedAt: '2026-11-13T02:00:00.000Z',
        updatedBy: 'admin',
      },
    ],
    kontainers: [
      { id: 'k-1', kodeOs: 'OS-2611-0001', noCont: 'MSCU1234567', ukuranTipe: '40HC' },
    ],
    customers: [
      { kodeCustomer: 'CUST-01', namaCustomer: 'PT Maju Jaya', kontak: '0811111111' },
    ],
    importirs: [{ kodeImportir: 'IMP-01', namaImportir: 'PT Importir Utama' }],
    shippers: [{ namaShipper: 'SHANGHAI TRADE CO', negara: 'China' }],
    users: [
      {
        username: 'admin',
        passwordHash: 'hash123',
        salt: 'salt123',
        nama: 'Admin Utama',
        role: 'Admin',
        aktif: true,
        mustChangePassword: false,
      },
    ],
    logs: [
      {
        id: 'log-1',
        waktu: '2026-11-10T01:00:00.000Z',
        user: 'Admin Utama',
        kodeOs: 'OS-2611-0001',
        kolom: 'Create',
        nilaiLama: '',
        nilaiBaru: 'Created',
      },
    ],
    catatan: [
      {
        id: 'cat-1',
        kodeOs: 'OS-2611-0001',
        waktu: '2026-11-10T01:05:00.000Z',
        user: 'Admin Utama',
        isi: 'Siap diproses',
      },
    ],
    dokumen: [
      {
        id: 'doc-1',
        kodeOs: 'OS-2611-0001',
        jenisDokumen: 'Bill of Lading (BL)',
        namaFile: 'BL_9988.pdf',
        linkDrive: 'https://drive.google.com/file/d/abc/view',
        waktuUpload: '2026-11-10T02:00:00.000Z',
        user: 'Admin Utama',
        driveFileId: 'abc',
        source: 'google-drive',
      },
    ],
    pengeluaranOps: [
      {
        id: 'ops-1',
        kodePengeluaran: 'KOP-2611-0001',
        noTandaTerima: 'TT-OPS-2611-0001',
        kodeOs: 'OS-2611-0001',
        namaCustomer: 'PT Maju Jaya',
        noBl: 'BL-9988',
        tanggal: '2026-11-12',
        kategori: 'D/O & Pelayaran',
        keterangan: 'Tebus DO',
        nominal: 1500000,
        metodePembayaran: 'Transfer Bank',
        statusPengeluaran: 'Sudah Dibayar',
        petugasOps: 'Agus Ops',
        diberikanOleh: 'Admin Utama',
        createdAt: '2026-11-12T03:00:00.000Z',
        createdBy: 'Admin Utama',
        updatedAt: '2026-11-12T03:00:00.000Z',
        updatedBy: 'Admin Utama',
      },
    ],
    pengaturan: {
      ...DEFAULT_PENGATURAN,
      driveOwnerGmail: 'arsip.ptg@gmail.com',
      driveParentFolderId: '1DriveFolderXYZ',
    },
  };
}

test('serializeDatabaseBackupJson and parseDatabaseBackupJson round-trip wrapped backup envelope losslessly', () => {
  const db = makeFixtureDb();
  const json = serializeDatabaseBackupJson(db, {
    createdBy: 'Hendra (Admin)',
    source: 'manual',
    label: 'Backup Harian',
    createdAt: '2026-11-19T04:30:00.000Z',
  });

  const parsed = parseDatabaseBackupJson(json);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.envelope?.format, BACKUP_FORMAT_ID);
  assert.equal(parsed.createdBy, 'Hendra (Admin)');
  assert.equal(parsed.counts?.shipments, 1);
  assert.equal(parsed.counts?.pengeluaranOps, 1);
  assert.equal(parsed.database?.shipments[0].kodeOs, 'OS-2611-0001');
  assert.equal(parsed.database?.pengaturan.driveOwnerGmail, 'arsip.ptg@gmail.com');
  assert.equal(computeTotalBackupRecords(computeBackupCounts(db)), 10);
});

test('parseDatabaseBackupJson supports raw DatabaseState JSON and rejects invalid JSON payloads', () => {
  const db = makeFixtureDb();
  const rawParsed = parseDatabaseBackupJson(JSON.stringify(db));
  assert.equal(rawParsed.ok, true);
  assert.equal(rawParsed.database?.customers[0].kodeCustomer, 'CUST-01');

  const emptyErr = parseDatabaseBackupJson('   ');
  assert.equal(emptyErr.ok, false);

  const badJsonErr = parseDatabaseBackupJson('{not valid json');
  assert.equal(badJsonErr.ok, false);

  const unrelatedErr = parseDatabaseBackupJson(JSON.stringify({ hello: 'world' }));
  assert.equal(unrelatedErr.ok, false);
});

test('parseDatabaseBackupFromWorkbookSheets restores full 12-tab Excel workbook matrices', () => {
  const db = makeFixtureDb();
  const matrices = serializeDatabaseToSheetMatrixMap(db, 'Admin');
  const emptyFallback: DatabaseState = {
    ...db,
    shipments: [],
    kontainers: [],
    customers: [],
    pengeluaranOps: [],
  };

  const restored = parseDatabaseBackupFromWorkbookSheets(matrices, emptyFallback);
  assert.equal(restored.ok, true);
  assert.equal(restored.matchedTabs?.length, 12);
  assert.equal(restored.counts?.shipments, 1);
  assert.equal(restored.counts?.kontainers, 1);
  assert.equal(restored.counts?.pengeluaranOps, 1);
  assert.equal(restored.database?.shipments[0].noBl, 'BL-9988');

  const badWorkbook = parseDatabaseBackupFromWorkbookSheets({ Sheet1: [['A']] }, emptyFallback);
  assert.equal(badWorkbook.ok, false);
});

test('buildDatabaseBackupFilename and sortAndTrimLocalBackups keep newest snapshots bounded', () => {
  const dt = new Date(2026, 10, 19, 9, 5, 7);
  assert.equal(buildDatabaseBackupFilename('json', dt), 'PTG_PPJK_BACKUP_2026-11-19_090507.json');
  assert.equal(buildDatabaseBackupFilename('xlsx', dt), 'PTG_PPJK_BACKUP_2026-11-19_090507.xlsx');

  const db = makeFixtureDb();
  const records = Array.from({ length: 12 }, (_, idx) =>
    buildLocalBackupSnapshotRecord(db, {
      id: `snap-${idx + 1}`,
      label: `Snap ${idx + 1}`,
      createdAt: `2026-11-${String(idx + 10).padStart(2, '0')}T00:00:00.000Z`,
    })
  );
  const trimmed = sortAndTrimLocalBackups(records, 10);
  assert.equal(trimmed.length, 10);
  assert.equal(trimmed[0].id, 'snap-12');
  assert.equal(trimmed[9].id, 'snap-3');
});
