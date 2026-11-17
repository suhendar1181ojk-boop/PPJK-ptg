import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleDatabaseFromEntries,
  buildCollectionEntries,
  computeCollectionCounts,
  enqueueCoalescedSyncTask,
  estimateDatabaseByteSize,
  formatBytesReadable,
  markSyncTaskAttempt,
  OFFLINE_DB_COLLECTIONS,
} from './offlineDbLogic';
import { DEFAULT_PENGATURAN } from './ppjkLogic';
import type { DatabaseState } from '../types/ppjk';

function createSampleDb(): DatabaseState {
  return {
    shipments: [
      {
        kodeOs: 'OS-2611-0001',
        ship: 'MV TEST',
        kodeCustomer: 'CUST-001',
        namaCustomer: 'PT Test',
        tglTerimaDok: '2026-11-10',
        terimaDok: { items: {}, catatan: '' },
        noPackinglist: 'PL-1',
        noBl: 'BL-1',
        statusDokumen: 'Ready',
        etd: '2026-11-01',
        eta: '2026-11-20',
        countDownEta: 4,
        noCont: 'CONT1',
        noAju: 'AJU1',
        tglAju: '2026-11-12',
        status: 'Menunggu Jalur',
        nopen: '123456',
        tglNopen: '2026-11-12',
        jalur: 'Hijau',
        kodeImportir: 'IMP-001',
        shipper: 'Shipper Test',
        description: 'Goods',
        negaraAsal: 'China',
        currency: 'USD',
        kurs: 15800,
        invoice: 10000,
        bmPdri: 'Rp 25.000.000',
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
        dokumenOs: { items: {}, catatan: '' },
        createdAt: '2026-11-10T00:00:00.000Z',
        createdBy: 'admin',
        updatedAt: '2026-11-10T00:00:00.000Z',
        updatedBy: 'admin',
      },
    ],
    kontainers: [{ id: 'k1', kodeOs: 'OS-2611-0001', noCont: 'CONT1', ukuranTipe: '40HC' }],
    customers: [{ kodeCustomer: 'CUST-001', namaCustomer: 'PT Test', kontak: '0811' }],
    importirs: [{ kodeImportir: 'IMP-001', namaImportir: 'PT Importir Test' }],
    shippers: [{ namaShipper: 'Shipper Test', negara: 'China' }],
    users: [
      {
        username: 'admin',
        passwordHash: 'hash',
        salt: 'salt',
        nama: 'Admin',
        role: 'Admin',
        aktif: true,
      },
    ],
    logs: [],
    catatan: [],
    dokumen: [],
    pengeluaranOps: [
      {
        id: 'kop-1',
        kodePengeluaran: 'KOP-2611-0001',
        noTandaTerima: 'TT-KOP-2611-0001',
        kodeOs: 'OS-2611-0001',
        tanggal: '2026-11-15',
        kategori: 'D/O & Pelayaran',
        keterangan: 'Perpanjangan D/O',
        nominal: 950000,
        metodePembayaran: 'Transfer Bank',
        statusPengeluaran: 'Sudah Dibayar',
        petugasOps: 'Slamet Riyadi',
        diberikanOleh: 'Admin',
        createdAt: '2026-11-15T00:00:00Z',
        createdBy: 'admin',
        updatedAt: '2026-11-15T00:00:00Z',
        updatedBy: 'admin',
      },
    ],
    pengaturan: { ...DEFAULT_PENGATURAN },
  };
}

test('buildCollectionEntries and assembleDatabaseFromEntries round-trip all 11 IndexedDB collections', () => {
  const db = createSampleDb();
  const entries = buildCollectionEntries(db, '2026-11-16T03:00:00.000Z');
  assert.equal(entries.length, OFFLINE_DB_COLLECTIONS.length);

  const restored = assembleDatabaseFromEntries(entries);
  assert.ok(restored);
  assert.equal(restored.shipments.length, 1);
  assert.equal(restored.shipments[0].kodeOs, 'OS-2611-0001');
  assert.equal(restored.kontainers.length, 1);
  assert.equal(restored.pengeluaranOps.length, 1);
  assert.equal(restored.pengeluaranOps[0].kodePengeluaran, 'KOP-2611-0001');
  assert.equal(restored.users[0].username, 'admin');
  assert.equal(assembleDatabaseFromEntries([]), null);

  // Legacy entries missing pengeluaranOps still restore safely
  const legacyEntries = entries.filter((e) => e.key !== 'pengeluaranOps');
  const legacyRestored = assembleDatabaseFromEntries(legacyEntries);
  assert.ok(legacyRestored);
  assert.deepEqual(legacyRestored.pengeluaranOps, []);
});

test('enqueueCoalescedSyncTask coalesces repeated offline mutations for the same spreadsheetId', () => {
  let queue = enqueueCoalescedSyncTask([], {
    id: 't1',
    reason: 'Simpan shipment OS-2611-0001',
    spreadsheetId: 'sheet-abc',
    queuedAt: '2026-11-16T03:00:00.000Z',
  });
  assert.equal(queue.length, 1);

  queue = enqueueCoalescedSyncTask(queue, {
    id: 't2',
    reason: 'Update D/O OS-2611-0001',
    spreadsheetId: 'sheet-abc',
    queuedAt: '2026-11-16T03:01:00.000Z',
  });
  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, 't1');
  assert.equal(queue[0].reason, 'Update D/O OS-2611-0001');

  // Different spreadsheet ID creates a separate task
  queue = enqueueCoalescedSyncTask(queue, {
    id: 't3',
    reason: 'Sync sheet B',
    spreadsheetId: 'sheet-xyz',
    queuedAt: '2026-11-16T03:02:00.000Z',
  });
  assert.equal(queue.length, 2);

  queue = markSyncTaskAttempt(queue, 't1', 'error', 'Offline');
  assert.equal(queue[0].status, 'failed');
  assert.equal(queue[0].attempts, 1);
  assert.equal(queue[0].lastError, 'Offline');

  queue = markSyncTaskAttempt(queue, 't1', 'success');
  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, 't3');
});

test('computeCollectionCounts, estimateDatabaseByteSize, and formatBytesReadable compute deterministic metrics', () => {
  const db = createSampleDb();
  const counts = computeCollectionCounts(db);
  assert.equal(counts.shipments, 1);
  assert.equal(counts.kontainers, 1);
  assert.equal(counts.pengeluaranOps, 1);
  assert.equal(counts.pengaturan, 1);

  const bytes = estimateDatabaseByteSize(db);
  assert.ok(bytes > 200);
  assert.equal(formatBytesReadable(0), '0 B');
  assert.equal(formatBytesReadable(512), '512 B');
  assert.equal(formatBytesReadable(2048), '2.0 KB');
});
