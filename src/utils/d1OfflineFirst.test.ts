import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterD1Shipments,
  getInitialSeedD1Shipments,
  mergeD1ShipmentsLww,
  normalizeD1ShipmentRecord,
  patchD1RecordInList,
  softDeleteD1RecordInList,
  summarizeD1ByImporter,
  upsertD1RecordsInList,
} from './d1Contract';
import { buildShipmentsCsvContent, sanitizeCsvFormulaCell } from './exportShipmentsToCsv';
import {
  buildD1ImportTemplateCsv,
  detectCsvDelimiter,
  parseShipmentsCsvText,
} from './importShipmentsFromCsv';

test('D1 LWW merge resolves conflicts by newest updated_at and propagates deleted_at tombstones', () => {
  const localOlder = normalizeD1ShipmentRecord({
    id: 'shp_os-2611-0001',
    os_code: 'OS-2611-0001',
    importer_code: 'IMP-001',
    importer_name: 'PT Lokal Lama',
    status: 'Dokumen Diterima',
    updated_at: '2026-11-17T08:00:00.000Z',
    version: 1,
  });

  const localNewer = normalizeD1ShipmentRecord({
    id: 'shp_os-2611-0002',
    os_code: 'OS-2611-0002',
    importer_code: 'IMP-002',
    importer_name: 'PT Lokal Baru',
    status: 'SPPB Terbit',
    updated_at: '2026-11-17T12:00:00.000Z',
    version: 2,
  });

  const remoteNewerUpdate = normalizeD1ShipmentRecord({
    id: 'shp_os-2611-0001',
    os_code: 'OS-2611-0001',
    importer_code: 'IMP-001',
    importer_name: 'PT Remote Menang',
    status: 'Proses Pemeriksaan',
    updated_at: '2026-11-17T10:30:00.000Z',
    version: 2,
  });

  const remoteOlderDelete = normalizeD1ShipmentRecord({
    id: 'shp_os-2611-0002',
    os_code: 'OS-2611-0002',
    importer_code: 'IMP-002',
    importer_name: 'PT Lokal Baru',
    deleted_at: '2026-11-17T09:00:00.000Z',
    updated_at: '2026-11-17T09:00:00.000Z',
    version: 2,
  });

  const merged = mergeD1ShipmentsLww(
    [localOlder, localNewer],
    [remoteNewerUpdate, remoteOlderDelete]
  );

  const row1 = merged.find((r) => r.os_code === 'OS-2611-0001');
  const row2 = merged.find((r) => r.os_code === 'OS-2611-0002');
  assert.equal(row1?.importer_name, 'PT Remote Menang');
  assert.equal(row1?.status, 'Proses Pemeriksaan');
  // Local update at 12:00 beats remote delete at 09:00
  assert.equal(row2?.deleted_at, null);
  assert.equal(row2?.status, 'SPPB Terbit');

  // Newer remote tombstone wins cleanly
  const remoteNewerDelete = normalizeD1ShipmentRecord({
    ...localNewer,
    deleted_at: '2026-11-17T13:00:00.000Z',
    updated_at: '2026-11-17T13:00:00.000Z',
    version: 3,
  });
  const afterTombstone = mergeD1ShipmentsLww(merged, [remoteNewerDelete]);
  const activeOnly = filterD1Shipments(afterTombstone, {});
  assert.equal(
    activeOnly.some((r) => r.os_code === 'OS-2611-0002'),
    false
  );
  const sincePull = filterD1Shipments(afterTombstone, {
    since: '2026-11-17T12:30:00.000Z',
  });
  assert.equal(sincePull.length, 1);
  assert.ok(sincePull[0].deleted_at);
});

test('D1 upsert, patch, soft delete & importer summary increment versions and aggregate totals accurately', () => {
  const seed = getInitialSeedD1Shipments();
  const { next: afterUpsert, upserted } = upsertD1RecordsInList(
    seed,
    [
      {
        os_code: 'OS-2611-0099',
        importer_code: 'IMP-009',
        importer_name: 'PT Ekspor Jaya',
        bm_pdri_amount: 50000000,
        is_urgent: 1,
      },
    ],
    '2026-11-18T10:00:00.000Z'
  );
  assert.equal(upserted[0].version, 1);

  const { next: afterPatch, updated } = patchD1RecordInList(
    afterUpsert,
    upserted[0].id,
    { status: 'SPPB Terbit', doc_status: 'Ready', sppb_date: '2026-11-18' },
    '2026-11-18T11:00:00.000Z'
  );
  assert.equal(updated?.version, 2);
  assert.equal(updated?.status, 'SPPB Terbit');

  const summaryBeforeDel = summarizeD1ByImporter(afterPatch);
  const imp009 = summaryBeforeDel.find((s) => s.importer_code === 'IMP-009');
  assert.equal(imp009?.total_shipments, 1);
  assert.equal(imp009?.ready_count, 1);
  assert.equal(imp009?.total_bm_pdri, 50000000);

  const { next: afterDelete, deleted } = softDeleteD1RecordInList(
    afterPatch,
    'OS-2611-0099',
    '2026-11-18T12:00:00.000Z'
  );
  assert.equal(deleted?.version, 3);
  assert.equal(deleted?.deleted_at, '2026-11-18T12:00:00.000Z');
  assert.equal(filterD1Shipments(afterDelete, {}).some((r) => r.os_code === 'OS-2611-0099'), false);
});

test('CSV Export includes UTF-8 BOM, semicolon delimiter, active filtering, and neutralizes formula injection', () => {
  assert.equal(sanitizeCsvFormulaCell('=CMD|calc'), "'=CMD|calc");
  assert.equal(sanitizeCsvFormulaCell('+12345'), "'+12345");
  assert.equal(sanitizeCsvFormulaCell('-500'), "'-500");
  assert.equal(sanitizeCsvFormulaCell('@SUM(A1:A2)'), "'@SUM(A1:A2)");

  const dangerousRow = normalizeD1ShipmentRecord({
    os_code: 'OS-2611-0777',
    importer_code: 'IMP-777',
    importer_name: 'PT Bahaya Formula',
    notes: '=HYPERLINK("http://evil.example","Klik")',
    bl_number: '+BL-9988',
    status: 'Proses PIB/AJU',
  });
  const normalRow = normalizeD1ShipmentRecord({
    os_code: 'OS-2611-0778',
    importer_code: 'IMP-778',
    importer_name: 'PT Aman Sentosa',
    status: 'Selesai',
  });

  const { csvContent, rowCount } = buildShipmentsCsvContent([dangerousRow, normalRow], {
    status: 'Proses PIB/AJU',
  });

  assert.equal(rowCount, 1);
  assert.ok(csvContent.startsWith('\uFEFF'));
  assert.ok(csvContent.includes('Kode OS;Doc OS;Kode Importir'));
  assert.ok(csvContent.includes("'+BL-9988"));
  assert.ok(csvContent.includes("'=HYPERLINK("));
  assert.equal(csvContent.includes('OS-2611-0778'), false);
});

test('CSV Import auto-detects ; and , delimiters, validates required columns, and summarizes skipped rows', () => {
  const semiCsv = [
    'os_code;importer_code;importer_name;bl_number;bm_pdri_amount;is_urgent',
    'OS-2611-0201;IMP-010;PT Sinar Abadi;BL-201;45000000;1',
    ';IMP-011;PT Tanpa OS;BL-202;1000000;0',
    'OS-2611-0201;IMP-010;PT Duplikat;BL-203;1000000;0',
  ].join('\n');

  assert.equal(detectCsvDelimiter(semiCsv), ';');
  const parsedSemi = parseShipmentsCsvText(semiCsv, '2026-11-18T09:00:00.000Z');
  assert.equal(parsedSemi.detectedDelimiter, ';');
  assert.equal(parsedSemi.errors.length, 0);
  assert.equal(parsedSemi.validRows.length, 1);
  assert.equal(parsedSemi.skippedRows.length, 2);
  assert.equal(parsedSemi.validRows[0].os_code, 'OS-2611-0201');
  assert.equal(parsedSemi.validRows[0].bm_pdri_amount, 45000000);
  assert.equal(parsedSemi.validRows[0].is_urgent, 1);

  const commaCsv = [
    'Kode OS,Kode Importir,Nama Importir,Nama Customer,No. BL,Status,BM/PDRI (Rp)',
    'OS-2611-0301,IMP-020,"PT Maju, Bersama",PT Pelanggan,BL-301,SPPB Terbit,85000000',
    'OS-2611-0302,,PT Tanpa Kode Imp,PT Pelanggan,BL-302,Dokumen Diterima,0',
  ].join('\n');

  assert.equal(detectCsvDelimiter(commaCsv), ',');
  const parsedComma = parseShipmentsCsvText(commaCsv, '2026-11-18T09:00:00.000Z');
  assert.equal(parsedComma.detectedDelimiter, ',');
  assert.equal(parsedComma.validRows.length, 1);
  assert.equal(parsedComma.validRows[0].importer_name, 'PT Maju, Bersama');
  assert.equal(parsedComma.skippedRows.length, 1);

  // Template roundtrip passes validation cleanly
  const templateCsv = buildD1ImportTemplateCsv();
  const parsedTemplate = parseShipmentsCsvText(templateCsv, '2026-11-18T09:00:00.000Z');
  assert.equal(parsedTemplate.errors.length, 0);
  assert.equal(parsedTemplate.validRows.length, 1);
  assert.equal(parsedTemplate.skippedRows.length, 0);
});
