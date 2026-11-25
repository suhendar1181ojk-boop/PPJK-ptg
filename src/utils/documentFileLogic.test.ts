import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDocumentDownloadDescriptor,
  buildMinimalPdfBytes,
  formatDocumentFileSize,
  getDocumentsForKodeOs,
  groupDocumentsByKodeOs,
} from './documentFileLogic';
import type { DokumenItem, Shipment } from '../types/ppjk';

const sampleDocs: DokumenItem[] = [
  {
    id: 'doc-old',
    kodeOs: 'OS-2611-0001',
    jenisDokumen: 'Bill of Lading (BL)',
    namaFile: 'BL_OLD.pdf',
    linkDrive: 'https://drive.google.com/drive/folders/abc',
    waktuUpload: '2026-11-01T08:00:00.000Z',
    user: 'checker1',
  },
  {
    id: 'doc-new',
    kodeOs: 'os-2611-0001',
    jenisDokumen: 'Commercial Invoice',
    namaFile: 'INV_NEW.pdf',
    linkDrive: 'https://drive.google.com/drive/folders/abc',
    waktuUpload: '2026-11-02T09:00:00.000Z',
    user: 'checker1',
    fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQK',
    mimeType: 'application/pdf',
    fileSize: 2048,
    source: 'offline-local',
  },
  {
    id: 'doc-drive',
    kodeOs: 'OS-2611-0002',
    jenisDokumen: 'Packing List',
    namaFile: 'PL_2026.xlsx',
    linkDrive: 'https://drive.google.com/file/d/drive-file-99/view',
    driveFileId: 'drive-file-99',
    waktuUpload: '2026-11-03T10:00:00.000Z',
    user: 'admin',
    source: 'google-drive',
  },
];

test('formatDocumentFileSize formats bytes, KB, MB cleanly', () => {
  assert.equal(formatDocumentFileSize(512), '512 B');
  assert.equal(formatDocumentFileSize(4096), '4 KB');
  assert.equal(formatDocumentFileSize(2 * 1024 * 1024), '2.0 MB');
  assert.equal(formatDocumentFileSize(undefined), '');
});

test('groupDocumentsByKodeOs normalizes keys and orders newest uploads first', () => {
  const grouped = groupDocumentsByKodeOs(sampleDocs);
  const docsOs1 = getDocumentsForKodeOs(grouped, 'OS-2611-0001');
  assert.equal(docsOs1.length, 2);
  assert.equal(docsOs1[0].id, 'doc-new');
  assert.equal(docsOs1[1].id, 'doc-old');
  assert.equal(getDocumentsForKodeOs(grouped, 'OS-9999-9999').length, 0);
});

test('buildDocumentDownloadDescriptor prioritizes embedded fileDataUrl for universal offline download', () => {
  const desc = buildDocumentDownloadDescriptor(sampleDocs[1]);
  assert.equal(desc.kind, 'data-url');
  assert.equal(desc.fileName, 'INV_NEW.pdf');
  assert.equal(desc.href, 'data:application/pdf;base64,JVBERi0xLjQK');
});

test('buildDocumentDownloadDescriptor uses Google Drive export URL when driveFileId exists without local fileDataUrl', () => {
  const desc = buildDocumentDownloadDescriptor(sampleDocs[2]);
  assert.equal(desc.kind, 'remote-url');
  assert.equal(desc.fileName, 'PL_2026.xlsx');
  assert.equal(desc.href, 'https://drive.google.com/uc?export=download&id=drive-file-99');
});

test('buildDocumentDownloadDescriptor produces valid PDF bytes fallback for seeded metadata-only PDF docs', () => {
  const shipment = {
    kodeOs: 'OS-2611-0001',
    kodeManualDokOs: 'TN-196',
    namaCustomer: 'PT Maju Bersama',
    noBl: 'EGLV142600891234',
  } as Shipment;

  const desc = buildDocumentDownloadDescriptor(sampleDocs[0], shipment);
  assert.equal(desc.kind, 'generated-pdf');
  assert.equal(desc.fileName, 'BL_OLD.pdf');
  assert.ok(desc.contentBytes && desc.contentBytes.length > 100);
  const text = new TextDecoder().decode(desc.contentBytes);
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.includes('OS-2611-0001'));
  assert.ok(text.includes('TN-196'));
  assert.ok(text.includes('%%EOF'));
});

test('buildMinimalPdfBytes escapes parentheses cleanly', () => {
  const bytes = buildMinimalPdfBytes(['File (Revisi 1)']);
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.includes('File \\(Revisi 1\\)'));
});
