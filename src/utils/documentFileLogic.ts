import type { DokumenItem, Shipment } from '../types/ppjk';

export const MAX_LOCAL_DOC_BYTES = 5 * 1024 * 1024; // 5 MB aman untuk IndexedDB

export interface LocalDocumentPayload {
  fileDataUrl?: string;
  mimeType: string;
  fileSize: number;
  skippedReason?: string;
}

export interface DocumentDownloadDescriptor {
  kind: 'data-url' | 'remote-url' | 'generated-pdf' | 'generated-text';
  fileName: string;
  mimeType: string;
  href?: string;
  contentBytes?: Uint8Array;
  contentText?: string;
}

export function formatDocumentFileSize(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function normalizeKodeOsKey(kodeOs?: string): string {
  return (kodeOs || '').trim().toUpperCase();
}

export function groupDocumentsByKodeOs(documents: DokumenItem[]): Map<string, DokumenItem[]> {
  const map = new Map<string, DokumenItem[]>();
  for (const doc of documents) {
    const key = normalizeKodeOsKey(doc.kodeOs);
    if (!key) continue;
    const list = map.get(key);
    if (list) {
      list.push(doc);
    } else {
      map.set(key, [doc]);
    }
  }
  for (const [key, list] of map.entries()) {
    list.sort((a, b) => (b.waktuUpload || '').localeCompare(a.waktuUpload || ''));
    map.set(key, list);
  }
  return map;
}

export function getDocumentsForKodeOs(
  source: Map<string, DokumenItem[]> | DokumenItem[],
  kodeOs?: string
): DokumenItem[] {
  const key = normalizeKodeOsKey(kodeOs);
  if (!key) return [];
  if (source instanceof Map) {
    return source.get(key) || [];
  }
  return source
    .filter((d) => normalizeKodeOsKey(d.kodeOs) === key)
    .sort((a, b) => (b.waktuUpload || '').localeCompare(a.waktuUpload || ''));
}

function sanitizePdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Menghasilkan file PDF 1 halaman minimal yang valid (PDF 1.4) ketika dokumen demo/lama
 * tidak memiliki byte fileDataUrl lokal sehingga tetap bisa dibuka rapi oleh semua user.
 */
export function buildMinimalPdfBytes(lines: string[]): Uint8Array {
  const safeLines = lines.slice(0, 24).map((line) => sanitizePdfText(line));
  const streamLines = [
    'BT',
    '/F1 11 Tf',
    '48 760 Td',
    '16 TL',
    ...safeLines.map((line, idx) => (idx === 0 ? `(${line}) Tj` : `T* (${line}) Tj`)),
    'ET',
  ];
  const streamContent = `${streamLines.join('\n')}\n`;

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  const encoder = new TextEncoder();
  return encoder.encode(pdf);
}

export function buildDocumentDownloadDescriptor(
  doc: DokumenItem,
  shipment?: Shipment
): DocumentDownloadDescriptor {
  const rawName = (doc.namaFile || '').trim() || `${doc.jenisDokumen || 'dokumen'}_${doc.kodeOs}.txt`;

  if (doc.fileDataUrl && doc.fileDataUrl.startsWith('data:')) {
    return {
      kind: 'data-url',
      fileName: rawName,
      mimeType: doc.mimeType || 'application/octet-stream',
      href: doc.fileDataUrl,
    };
  }

  if (doc.driveFileId && doc.driveFileId.trim()) {
    return {
      kind: 'remote-url',
      fileName: rawName,
      mimeType: doc.mimeType || 'application/octet-stream',
      href: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(doc.driveFileId.trim())}`,
    };
  }

  const summaryLines = [
    'PTG PPJK OUTSTANDING - ARSIP DOKUMEN OS',
    '==================================================',
    `Kode OS       : ${doc.kodeOs}`,
    `Dok. OS Manual: ${shipment?.kodeManualDokOs || '-'}`,
    `Customer      : ${shipment?.namaCustomer || '-'}`,
    `No. B/L       : ${shipment?.noBl || '-'}`,
    `Jenis Dokumen : ${doc.jenisDokumen}`,
    `Nama File     : ${rawName}`,
    `Diupload Oleh : ${doc.user}`,
    `Waktu Upload  : ${doc.waktuUpload}`,
    `Link Drive    : ${doc.linkDrive || '-'}`,
  ];

  if (/\.pdf$/i.test(rawName)) {
    return {
      kind: 'generated-pdf',
      fileName: rawName,
      mimeType: 'application/pdf',
      contentBytes: buildMinimalPdfBytes(summaryLines),
    };
  }

  const txtFileName = /\.[a-z0-9]{2,5}$/i.test(rawName) ? `${rawName}.txt` : `${rawName}.txt`;
  return {
    kind: 'generated-text',
    fileName: txtFileName,
    mimeType: 'text/plain;charset=utf-8',
    contentText: `${summaryLines.join('\n')}\n`,
  };
}

export async function readShipmentFilePayload(
  file: File,
  maxBytes = MAX_LOCAL_DOC_BYTES
): Promise<LocalDocumentPayload> {
  const mimeType = file.type || 'application/octet-stream';
  const fileSize = file.size;
  if (fileSize > maxBytes) {
    return {
      mimeType,
      fileSize,
      skippedReason: `Ukuran file melebihi batas cache lokal (${formatDocumentFileSize(maxBytes)}).`,
    };
  }
  if (typeof FileReader === 'undefined') {
    return {
      mimeType,
      fileSize,
      skippedReason: 'FileReader tidak tersedia pada lingkungan ini.',
    };
  }
  const fileDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Gagal membaca file untuk penyimpanan lokal'));
    reader.readAsDataURL(file);
  });
  return {
    fileDataUrl: fileDataUrl || undefined,
    mimeType,
    fileSize,
  };
}

export function triggerDocumentDownload(doc: DokumenItem, shipment?: Shipment): void {
  if (typeof document === 'undefined') return;
  const desc = buildDocumentDownloadDescriptor(doc, shipment);

  if (desc.kind === 'data-url' && desc.href) {
    const a = document.createElement('a');
    a.href = desc.href;
    a.download = desc.fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  if (desc.kind === 'remote-url' && desc.href) {
    const a = document.createElement('a');
    a.href = desc.href;
    a.download = desc.fileName;
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  const blob =
    desc.kind === 'generated-pdf' && desc.contentBytes
      ? new Blob([desc.contentBytes.slice().buffer], { type: 'application/pdf' })
      : new Blob([desc.contentText || ''], { type: desc.mimeType || 'text/plain;charset=utf-8' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = desc.fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}
