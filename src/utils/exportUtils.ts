import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  CheckerSummary,
  Customer,
  Importir,
  NopenRecapSummary,
  Pengaturan,
  PengeluaranOpsItem,
  PengeluaranOpsSummary,
  Shipment,
} from '../types/ppjk';
import {
  buildShipmentImportSampleRow,
  SHIPMENT_IMPORT_TEMPLATE_HEADERS,
} from './excelImportLogic';
import {
  buildKdiCoverDocument,
  type KdiCoverDocument,
  type KdiCoverOptions,
} from './kdiCoverLogic';
import {
  buildDklCoverDocument,
  type DklCoverDocument,
  type DklCoverOptions,
} from './dklCoverLogic';
import { formatRupiahOps, hasBuktiPengeluaran } from './pengeluaranOpsLogic';
import {
  buildAutoBillingFields,
  calculateBillingTotals,
  DEFAULT_PENGATURAN,
  formatRupiah,
  generateSuratJalanNomor,
  getBillingEligibilityReason,
  getDoValidityMeta,
  getPpjkIdentity,
  getShipmentProcessSignal,
  hasSptnpIssue,
  isContainerGateOut,
  isSppbReadyForGateOut,
  normalizeStatusDokumen,
  normalizeStatusDoPelayaran,
  normalizeStatusGateOut,
  normalizeStatusGatePass,
  normalizeStatusPenagihan,
  normalizeStatusSuratJalan,
  normalizeStatusTrucking,
  parseCustomerContact,
} from './ppjkLogic';

function detectPdfImageFormat(dataUrl?: string): 'PNG' | 'JPEG' | 'WEBP' | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const trimmed = dataUrl.trim();
  if (/^data:image\/png;/i.test(trimmed)) return 'PNG';
  if (/^data:image\/jpe?g;/i.test(trimmed)) return 'JPEG';
  if (/^data:image\/webp;/i.test(trimmed)) return 'WEBP';
  return null;
}

function addSafePdfImage(
  doc: jsPDF,
  dataUrl: string | undefined,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  options: { centerX?: boolean; centerY?: boolean; whiteBackdrop?: boolean } = {}
): boolean {
  const fmt = detectPdfImageFormat(dataUrl);
  if (!fmt || !dataUrl) return false;
  try {
    const props = doc.getImageProperties(dataUrl);
    const natW = Math.max(1, Number(props?.width) || maxW);
    const natH = Math.max(1, Number(props?.height) || maxH);
    const scale = Math.min(maxW / natW, maxH / natH);
    const drawW = natW * scale;
    const drawH = natH * scale;
    const drawX = options.centerX ? x + (maxW - drawW) / 2 : x;
    const drawY = options.centerY !== false ? y + (maxH - drawH) / 2 : y;
    if (options.whiteBackdrop) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x - 2, y - 2, maxW + 4, maxH + 4, 4, 4, 'F');
    }
    doc.addImage(dataUrl, fmt, drawX, drawY, drawW, drawH);
    return true;
  } catch {
    return false;
  }
}

export function exportShipmentsToExcel(rows: Shipment[], filename = 'PTG_PPJK_Shipment.xlsx'): void {
  const mapped = rows.map((s) => {
    const sig = getShipmentProcessSignal(s);
    return {
      'Kode OS': s.kodeOs,
      'Dok. OS (Manual)': s.kodeManualDokOs || '',
      'Sinyal Proses': sig.active ? sig.detailLabel : '-',
      'Ship': s.ship,
      'Kode Customer': s.kodeCustomer,
      'Nama Customer': s.namaCustomer,
      'Tgl. Terima Dok': s.tglTerimaDok,
      'No. Packinglist': s.noPackinglist,
      'No. BL': s.noBl,
      'Status Dokumen Checker': s.statusDokumen === 'Ready' ? 'Ready' : 'Draft',
      'ETD': s.etd,
      'ETA': s.eta,
      'Count Down ETA': s.countDownEta ?? '-',
      'No. Cont': s.noCont,
      'Status D/O Pelayaran': normalizeStatusDoPelayaran(s.doPelayaranStatus),
      'Masa Berlaku D/O': s.doBerlakuSampai || '',
      'Catatan Perpanjangan D/O': s.doCatatanPerpanjangan || '',
      'Status Eslah / TILA (Kartu Gate)': normalizeStatusGatePass(s.doGatePassStatus),
      'Jenis Gate Pass': s.doGatePassJenis || '',
      'No. Eslah / TILA': s.doGatePassNomor || s.eslah || '',
      'Status Trucking': normalizeStatusTrucking(s.truckingStatus),
      'Nama Supir': s.truckingNamaSupir || '',
      'No. Plat Truk': s.truckingNoPlat || '',
      'No. HP Supir': s.truckingNoHpSupir || '',
      'Status Gate-Out': normalizeStatusGateOut(s.gateOutStatus, s.status),
      'Tgl. Gate-Out': s.gateOutTanggal || '',
      'Catatan Gate-Out': s.gateOutCatatan || '',
      'No. Surat Jalan': s.suratJalanNomor || '',
      'Tgl. Surat Jalan': s.suratJalanTanggal || '',
      'Status Tracking Surat Jalan': normalizeStatusSuratJalan(
        s.suratJalanStatus,
        s.gateOutStatus,
        s.status
      ),
      'Tujuan Surat Jalan': s.suratJalanTujuan || '',
      'Penerima Surat Jalan': s.suratJalanPenerima || '',
      'Catatan Surat Jalan': s.suratJalanCatatan || '',
      'BC 1.1 Terbit': s.bc11Terbit || s.noBc11 || s.tglBc11 ? 'Terbit' : 'Belum',
      'No. BC 1.1': s.noBc11 || '',
      'Tgl. BC 1.1': s.tglBc11 || '',
      'No. AJU': s.noAju,
      'Tgl. AJU': s.tglAju,
      'Status': s.status,
      'NOPEN': s.nopen,
      'Tgl. NOPEN': s.tglNopen,
      'Jalur': s.jalur || '-',
      'Kode Importir': s.kodeImportir,
      'Shipper': s.shipper,
      'Description': s.description,
      'Negara Asal': s.negaraAsal,
      'Currency': s.currency,
      'Kurs': s.kurs,
      'Invoice': s.invoice,
      'BM/PDRI': s.bmPdri,
      'SPTNP': s.sptnp,
      'No. SPPB': s.noSppb,
      'Tgl SPPB': s.tglSppb,
      'Dokumen Checker': s.dokumenChecker,
      'No. SPTNP': s.noSptnp,
      'Tgl. SPTNP': s.tglSptnp,
      'PFPB': s.pfpb,
      'Tgl. PFPB': s.tglPfpb,
      'PFPD': s.pfpd,
      'Tgl. PFPD': s.tglPfpd,
      'ESLAH': s.eslah,
      'Tgl. ESLAH': s.tglEslah,
      'No. Penagihan': s.billingNomor || '',
      'Status Penagihan': normalizeStatusPenagihan(s.billingStatus, s),
      'Total Penagihan (Rp)': s.billingTotal ?? '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(mapped);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Shipment');
  XLSX.writeFile(wb, filename);
}

export function downloadShipmentExcelTemplate(
  filename = 'Template-Import-Shipment-PTG.xlsx'
): void {
  const sample = buildShipmentImportSampleRow();
  const ws = XLSX.utils.json_to_sheet([sample], {
    header: SHIPMENT_IMPORT_TEMPLATE_HEADERS,
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Import Shipment');
  XLSX.writeFile(wb, filename);
}

export function downloadShipmentCsvTemplate(
  filename = 'Template-Import-Shipment-PTG.csv'
): void {
  const sample = buildShipmentImportSampleRow();
  const escapeCsv = (val: unknown) => {
    const s = String(val ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headerLine = SHIPMENT_IMPORT_TEMPLATE_HEADERS.map(escapeCsv).join(',');
  const rowLine = SHIPMENT_IMPORT_TEMPLATE_HEADERS.map((h) => escapeCsv(sample[h])).join(',');
  const blob = new Blob([`\uFEFF${headerLine}\n${rowLine}\n`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportShipmentsToCSV(rows: Shipment[], filename = 'PTG_PPJK_Shipment.csv'): void {
  const headers = [
    'Kode OS',
    'Dok. OS (Manual)',
    'Sinyal Proses',
    'Nama Customer',
    'No. BL',
    'Status Dokumen Checker',
    'ETD',
    'ETA',
    'Count Down ETA',
    'No. BC 1.1',
    'Tgl. BC 1.1',
    'Status',
    'Jalur',
    'No. AJU',
    'NOPEN',
    'No. SPPB',
    'Tgl SPPB',
    'Dokumen Checker',
    'No. Cont',
  ];

  const lines = [
    headers.join(','),
    ...rows.map((s) => {
      const sig = getShipmentProcessSignal(s);
      return [
        s.kodeOs,
        s.kodeManualDokOs || '',
        sig.active ? sig.detailLabel : '-',
        s.namaCustomer,
        s.noBl,
        s.statusDokumen === 'Ready' ? 'Ready' : 'Draft',
        s.etd,
        s.eta,
        s.countDownEta ?? '',
        s.noBc11 || '',
        s.tglBc11 || '',
        s.status,
        s.jalur,
        s.noAju,
        s.nopen,
        s.noSppb,
        s.tglSppb,
        s.dokumenChecker,
        s.noCont,
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',');
    }),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportShipmentsToPDF(
  rows: Shipment[],
  title?: string,
  filename = 'PTG_PPJK_Laporan.pdf',
  pengaturan?: Pengaturan
): void {
  const identity = getPpjkIdentity(pengaturan);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const hasLogo = addSafePdfImage(doc, identity.logoDataUrl, 40, 22, 34, 34, { whiteBackdrop: true });
  const textX = hasLogo ? 84 : 40;
  doc.setFontSize(14);
  doc.setTextColor(11, 37, 69);
  doc.text(title || `Laporan ${identity.brandName} Outstanding`, textX, 38);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${identity.companyName} · Dicetak pada: ${new Date().toLocaleString('id-ID')} · Total: ${rows.length} shipment`,
    textX,
    54
  );

  autoTable(doc, {
    startY: 66,
    head: [
      ['Kode OS', 'Dok. OS', 'Customer', 'No. BL', 'Dok. Checker', 'ETD', 'ETA', 'CD ETA', 'Status', 'Jalur', 'No. AJU', 'Tgl SPPB'],
    ],
    body: rows.map((s) => [
      s.kodeOs,
      s.kodeManualDokOs || '-',
      s.namaCustomer,
      s.noBl,
      s.statusDokumen === 'Ready' ? 'Ready' : 'Draft',
      s.etd || '-',
      s.eta || '-',
      s.countDownEta !== null ? `${s.countDownEta}h` : '-',
      s.status,
      s.jalur || '-',
      s.noAju || '-',
      s.tglSppb || '-',
    ]),
    styles: { fontSize: 7.5, cellPadding: 4.5 },
    headStyles: { fillColor: [11, 37, 69], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(filename);
}

export function exportCheckerSummaryToExcel(
  checkers: CheckerSummary[],
  statusList: string[],
  filename = 'PTG_Rekap_Checker.xlsx'
): void {
  const mapped = checkers.map((c) => {
    const row: Record<string, string | number> = {
      'Nama Checker': c.checkerName,
      'Total Dokumen': c.total,
      Outstanding: c.outstanding,
      Selesai: c.completed,
      'Penyelesaian (%)': c.completionRate,
      'ETA < 3h Tanpa AJU': c.urgentMissingAju,
    };
    for (const st of statusList) {
      row[st] = c.byStatus[st] || 0;
    }
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(mapped);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Checker');
  XLSX.writeFile(wb, filename);
}

export function exportCheckerSummaryToCSV(
  checkers: CheckerSummary[],
  statusList: string[],
  filename = 'PTG_Rekap_Checker.csv'
): void {
  const headers = [
    'Nama Checker',
    'Total Dokumen',
    'Outstanding',
    'Selesai',
    'Penyelesaian (%)',
    'ETA < 3h Tanpa AJU',
    ...statusList,
  ];
  const lines = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
    ...checkers.map((c) =>
      [
        c.checkerName,
        c.total,
        c.outstanding,
        c.completed,
        c.completionRate,
        c.urgentMissingAju,
        ...statusList.map((st) => c.byStatus[st] || 0),
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCheckerSummaryToPDF(
  checkers: CheckerSummary[],
  statusList: string[],
  filename = 'PTG_Rekap_Checker.pdf',
  pengaturan?: Pengaturan
): void {
  const identity = getPpjkIdentity(pengaturan);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const hasLogo = addSafePdfImage(doc, identity.logoDataUrl, 40, 22, 34, 34, { whiteBackdrop: true });
  const textX = hasLogo ? 84 : 40;
  doc.setFontSize(14);
  doc.setTextColor(11, 37, 69);
  doc.text(`Rekapan Dokumen Checker & Summary Status ${identity.brandName}`, textX, 38);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${identity.companyName} · Dicetak pada: ${new Date().toLocaleString('id-ID')} · Total Checker: ${checkers.length}`,
    textX,
    54
  );

  autoTable(doc, {
    startY: 66,
    head: [['Checker', 'Total', 'OS', 'Selesai', '%', ...statusList]],
    body: checkers.map((c) => [
      c.checkerName,
      c.total,
      c.outstanding,
      c.completed,
      `${c.completionRate}%`,
      ...statusList.map((st) => c.byStatus[st] || 0),
    ]),
    styles: { fontSize: 7.5, cellPadding: 4 },
    headStyles: { fillColor: [11, 37, 69], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(filename);
}

export function exportDoReadinessToExcel(
  rows: Shipment[],
  filename = 'PTG_Kesiapan_DO_Pelayaran.xlsx'
): void {
  const mapped = rows.map((s) => {
    const validity = getDoValidityMeta(s.doBerlakuSampai, s.status);
    return {
      'Kode OS': s.kodeOs,
      'Nama Customer': s.namaCustomer,
      'No. BL': s.noBl,
      'Status Dokumen (Draft/Ready)': normalizeStatusDokumen(s.statusDokumen),
      'Kapal / Pelayaran': s.ship,
      'No. Kontainer': s.noCont,
      'Status Customs': s.status,
      'No. SPPB': s.noSppb || '-',
      'Tgl SPPB': s.tglSppb || '-',
      'Status D/O Pelayaran': normalizeStatusDoPelayaran(s.doPelayaranStatus),
      'Masa Berlaku D/O': s.doBerlakuSampai || '-',
      'Status Masa Berlaku': validity.label,
      'Catatan Masa Berlaku / Perpanjangan': s.doCatatanPerpanjangan || '-',
      'Status Eslah / TILA (Kartu Gate)': normalizeStatusGatePass(s.doGatePassStatus),
      'Jenis Pengurusan': s.doGatePassJenis || '-',
      'No. Eslah / TILA (Kartu Gate)': s.doGatePassNomor || s.eslah || '-',
      'Kesediaan Trucking': normalizeStatusTrucking(s.truckingStatus),
      'Nama Supir': s.truckingNamaSupir || '-',
      'No. Plat Truk': s.truckingNoPlat || '-',
      'No. HP Supir': s.truckingNoHpSupir || '-',
      'Status Gate-Out': normalizeStatusGateOut(s.gateOutStatus, s.status),
      'Tgl. Gate-Out': s.gateOutTanggal || '-',
      'Catatan Gate-Out': s.gateOutCatatan || '-',
      'Ikatan Dokumen Selesai': s.status === 'Selesai' ? 'Selesai' : 'Belum Selesai',
      'No. Surat Jalan': s.suratJalanNomor || '-',
      'Tgl. Surat Jalan': s.suratJalanTanggal || '-',
      'Status Tracking Surat Jalan': normalizeStatusSuratJalan(
        s.suratJalanStatus,
        s.gateOutStatus,
        s.status
      ),
      'Tujuan Pengiriman': s.suratJalanTujuan || '-',
      'Penerima': s.suratJalanPenerima || '-',
      'Catatan Tracking': s.suratJalanCatatan || '-',
    };
  });
  const ws = XLSX.utils.json_to_sheet(mapped);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kesiapan DO Pelayaran');
  XLSX.writeFile(wb, filename);
}

export function exportDoReadinessToCSV(
  rows: Shipment[],
  filename = 'PTG_Kesiapan_DO_Pelayaran.csv'
): void {
  const headers = [
    'Kode OS',
    'Nama Customer',
    'No. BL',
    'Status Dokumen',
    'Kapal / Pelayaran',
    'No. Kontainer',
    'Status Customs',
    'No. SPPB',
    'Status D/O Pelayaran',
    'Masa Berlaku D/O',
    'Status Masa Berlaku',
    'Catatan Masa Berlaku / Perpanjangan',
    'Status Eslah / TILA (Kartu Gate)',
    'Jenis Pengurusan',
    'No. Eslah / TILA',
    'Kesediaan Trucking',
    'Nama Supir',
    'No. Plat Truk',
    'No. HP Supir',
    'Status Gate-Out',
    'Tgl. Gate-Out',
    'Catatan Gate-Out',
    'Ikatan Dokumen Selesai',
    'No. Surat Jalan',
    'Tgl. Surat Jalan',
    'Status Tracking Surat Jalan',
    'Tujuan Pengiriman',
    'Penerima',
  ];
  const lines = [
    headers.map((h) => `"${h}"`).join(','),
    ...rows.map((s) => {
      const validity = getDoValidityMeta(s.doBerlakuSampai, s.status);
      return [
        s.kodeOs,
        s.namaCustomer,
        s.noBl,
        normalizeStatusDokumen(s.statusDokumen),
        s.ship,
        s.noCont,
        s.status,
        s.noSppb || '-',
        normalizeStatusDoPelayaran(s.doPelayaranStatus),
        s.doBerlakuSampai || '-',
        validity.label,
        s.doCatatanPerpanjangan || '-',
        normalizeStatusGatePass(s.doGatePassStatus),
        s.doGatePassJenis || '-',
        s.doGatePassNomor || s.eslah || '-',
        normalizeStatusTrucking(s.truckingStatus),
        s.truckingNamaSupir || '-',
        s.truckingNoPlat || '-',
        s.truckingNoHpSupir || '-',
        normalizeStatusGateOut(s.gateOutStatus, s.status),
        s.gateOutTanggal || '-',
        s.gateOutCatatan || '-',
        s.status === 'Selesai' ? 'Selesai' : 'Belum Selesai',
        s.suratJalanNomor || '-',
        s.suratJalanTanggal || '-',
        normalizeStatusSuratJalan(s.suratJalanStatus, s.gateOutStatus, s.status),
        s.suratJalanTujuan || '-',
        s.suratJalanPenerima || '-',
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',');
    }),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSuratJalanToPDF(
  shipment: Shipment,
  pengaturan?: Pengaturan
): void {
  const identity = getPpjkIdentity(pengaturan);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const sjNomor = shipment.suratJalanNomor?.trim() || generateSuratJalanNomor(shipment.kodeOs);
  const sjTanggal =
    shipment.suratJalanTanggal?.trim() ||
    shipment.gateOutTanggal?.trim() ||
    new Date().toISOString().slice(0, 10);
  const sjStatus = normalizeStatusSuratJalan(
    shipment.suratJalanStatus,
    shipment.gateOutStatus,
    shipment.status
  );

  let contentStartY = 102;
  const hasKopBanner = Boolean(
    identity.kopSuratDataUrl &&
      addSafePdfImage(doc, identity.kopSuratDataUrl, 36, 14, 523, 52, { centerX: true })
  );

  if (hasKopBanner) {
    doc.setDrawColor(11, 37, 69);
    doc.setLineWidth(1.5);
    doc.line(36, 70, 559, 70);
    doc.setFillColor(11, 37, 69);
    doc.rect(36, 76, 523, 44, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13.5);
    doc.text('SURAT JALAN PENGIRIMAN KONTAINER', 48, 96);
    doc.setFontSize(8.5);
    doc.setTextColor(226, 232, 240);
    doc.text(`${identity.brandName} · Tracking Gate-Out & Armada`, 48, 110);
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`No. SJ: ${sjNomor}`, 547, 96, { align: 'right' });
    doc.setFontSize(8.5);
    doc.text(`Tanggal: ${sjTanggal}  |  Status: ${sjStatus}`, 547, 110, { align: 'right' });
    contentStartY = 132;
  } else {
    doc.setFillColor(11, 37, 69);
    doc.rect(0, 0, 595, 84, 'F');
    const hasLogo = addSafePdfImage(doc, identity.logoDataUrl, 40, 18, 46, 46, {
      whiteBackdrop: true,
    });
    const leftX = hasLogo ? 98 : 40;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(hasLogo ? 14.5 : 16);
    doc.text('SURAT JALAN PENGIRIMAN KONTAINER', leftX, 36);
    doc.setFontSize(9.5);
    doc.setTextColor(226, 232, 240);
    doc.text(`${identity.brandName} (${identity.companyName}) — Tracking Gate-Out & Armada`, leftX, 54);
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`No. SJ: ${sjNomor}`, 555, 36, { align: 'right' });
    doc.setFontSize(9.5);
    doc.text(`Tanggal: ${sjTanggal}  |  Status: ${sjStatus}`, 555, 54, { align: 'right' });
  }

  autoTable(doc, {
    startY: contentStartY,
    head: [['Informasi Shipment & Dokumen', 'Detail']],
    body: [
      ['Kode OS / Referensi', shipment.kodeOs],
      ['Customer', `${shipment.namaCustomer} (${shipment.kodeCustomer})`],
      ['No. B/L & Kapal', `${shipment.noBl || '-'} / ${shipment.ship || '-'}`],
      ['No. Kontainer', shipment.noCont || '-'],
      ['No. SPPB', shipment.noSppb ? `${shipment.noSppb} (${shipment.tglSppb || '-'})` : '-'],
      ['Eslah / TILA (Kartu Gate)', `${shipment.doGatePassJenis || '-'} · ${shipment.doGatePassNomor || '-'}`],
      ['Tanggal Gate-Out Pelabuhan', shipment.gateOutTanggal || sjTanggal],
      ['Tujuan Pengiriman', shipment.suratJalanTujuan || `Gudang ${shipment.namaCustomer}`],
      ['Penerima / PIC Gudang', shipment.suratJalanPenerima || '-'],
    ],
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [11, 37, 69], textColor: 255 },
    columnStyles: { 0: { cellWidth: 185, fontStyle: 'bold' } },
  });

  const afterMainY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 360;

  autoTable(doc, {
    startY: afterMainY + 14,
    head: [['Armada Trucking', 'Identitas Supir', 'No. HP Supir', 'Catatan Tracking / Segel']],
    body: [
      [
        shipment.truckingNoPlat || '-',
        shipment.truckingNamaSupir || '-',
        shipment.truckingNoHpSupir || '-',
        shipment.suratJalanCatatan || shipment.gateOutCatatan || '-',
      ],
    ],
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [16, 185, 129], textColor: 255 },
  });

  const signY =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 460) +
    36;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9.5);
  doc.text('Pencatat / Operasional', 90, signY, { align: 'center' });
  doc.text('Supir Armada', 295, signY, { align: 'center' });
  doc.text('Penerima / Gudang', 500, signY, { align: 'center' });

  doc.setDrawColor(148, 163, 184);
  doc.line(40, signY + 56, 145, signY + 56);
  doc.line(240, signY + 56, 350, signY + 56);
  doc.line(445, signY + 56, 555, signY + 56);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(shipment.updatedBy || 'Ops PTG', 90, signY + 69, { align: 'center' });
  doc.text(shipment.truckingNamaSupir || '(.....................)', 295, signY + 69, {
    align: 'center',
  });
  doc.text(shipment.suratJalanPenerima || '(.....................)', 500, signY + 69, {
    align: 'center',
  });

  doc.save(`${sjNomor.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`);
}

export function exportSuratPenagihanToPDF(
  shipment: Shipment,
  customer?: Customer,
  pengaturan?: Pengaturan
): void {
  const identity = getPpjkIdentity(pengaturan);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const auto = buildAutoBillingFields(shipment);
  const totals = calculateBillingTotals(auto.billingItems, auto.billingPpnPersen);
  const parsedContact = parseCustomerContact(customer?.kontak);
  const adminName = pengaturan?.adminName?.trim() || DEFAULT_PENGATURAN.adminName || 'Admin Billing PPJK';
  const bankInfo =
    pengaturan?.billingBankInfo?.trim() ||
    DEFAULT_PENGATURAN.billingBankInfo ||
    `Bank Mandiri · ${identity.companyName}`;

  let billingStartY = 106;
  const hasKopBanner = Boolean(
    identity.kopSuratDataUrl &&
      addSafePdfImage(doc, identity.kopSuratDataUrl, 36, 14, 523, 52, { centerX: true })
  );

  if (hasKopBanner) {
    doc.setDrawColor(11, 37, 69);
    doc.setLineWidth(1.5);
    doc.line(36, 70, 559, 70);
    doc.setFillColor(11, 37, 69);
    doc.rect(36, 76, 523, 46, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('SURAT PENAGIHAN JASA PPJK', 48, 96);
    doc.setFontSize(8.5);
    doc.setTextColor(226, 232, 240);
    doc.text(`${identity.brandName} — ${identity.tagline}`, 48, 111);
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`No. ${auto.billingNomor}`, 547, 94, { align: 'right' });
    doc.setFontSize(8.2);
    doc.text(`Tgl: ${auto.billingTanggal} | Jatuh Tempo: ${auto.billingJatuhTempo}`, 547, 106, {
      align: 'right',
    });
    doc.text(`Status: ${auto.billingStatus}`, 547, 117, { align: 'right' });
    billingStartY = 134;
  } else {
    doc.setFillColor(11, 37, 69);
    doc.rect(0, 0, 595, 90, 'F');
    const hasLogo = addSafePdfImage(doc, identity.logoDataUrl, 36, 20, 48, 48, {
      whiteBackdrop: true,
    });
    const leftX = hasLogo ? 96 : 40;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(hasLogo ? 15 : 17);
    doc.text('SURAT PENAGIHAN JASA PPJK', leftX, 34);
    doc.setFontSize(9.5);
    doc.setTextColor(226, 232, 240);
    doc.text(`${identity.companyName} — ${identity.tagline}`, leftX, 52);
    doc.setFontSize(8);
    doc.text(`${identity.address} · Telp: ${identity.phone} · NPWP: ${identity.npwp}`, leftX, 68);
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`No. ${auto.billingNomor}`, 555, 36, { align: 'right' });
    doc.setFontSize(9);
    doc.text(`Tgl: ${auto.billingTanggal}  |  Jatuh Tempo: ${auto.billingJatuhTempo}`, 555, 54, {
      align: 'right',
    });
    doc.text(`Status: ${auto.billingStatus}`, 555, 70, { align: 'right' });
  }

  autoTable(doc, {
    startY: billingStartY,
    head: [['Tagihan Kepada (Customer)', 'Referensi Shipment & Dokumen']],
    body: [
      [
        `${shipment.namaCustomer}\nKode: ${shipment.kodeCustomer}\nKontak: ${customer?.kontak || parsedContact.phone || parsedContact.email || '-'}`,
        `Kode OS: ${shipment.kodeOs} (${getBillingEligibilityReason(shipment)})\nNo. B/L: ${shipment.noBl || '-'} · Kapal: ${shipment.ship || '-'}\nNo. Cont: ${shipment.noCont || '-'}\nNo. SPPB: ${shipment.noSppb || '-'} · SJ: ${shipment.suratJalanNomor || '-'}`,
      ],
    ],
    styles: { fontSize: 8.8, cellPadding: 6 },
    headStyles: { fillColor: [11, 37, 69], textColor: 255 },
  });

  const afterMetaY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 220;

  autoTable(doc, {
    startY: afterMetaY + 14,
    head: [['No.', 'Uraian Jasa / Biaya PPJK', 'Qty', 'Satuan', 'Harga Satuan', 'Jumlah']],
    body: auto.billingItems.map((it, idx) => [
      String(idx + 1),
      it.deskripsi,
      String(it.qty),
      it.satuan,
      formatRupiah(it.hargaSatuan),
      formatRupiah(it.qty * it.hargaSatuan),
    ]),
    foot: [
      ['', '', '', '', 'Subtotal', formatRupiah(totals.subtotal)],
      ['', '', '', '', `PPN (${auto.billingPpnPersen}%)`, formatRupiah(totals.ppnNominal)],
      ['', '', '', '', 'TOTAL TAGIHAN', formatRupiah(totals.total)],
    ],
    styles: { fontSize: 8.8, cellPadding: 5.5 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 36, halign: 'center' },
      3: { cellWidth: 58, halign: 'center' },
      4: { cellWidth: 96, halign: 'right' },
      5: { cellWidth: 96, halign: 'right' },
    },
  });

  const afterItemsY =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 450) + 18;

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Instruksi Pembayaran / Transfer:', 40, afterItemsY);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(bankInfo, 40, afterItemsY + 14);
  if (shipment.billingCatatan) {
    doc.text(`Catatan: ${shipment.billingCatatan}`, 40, afterItemsY + 30);
  }

  const signY = afterItemsY + 62;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9.5);
  doc.text('Diterbitkan oleh (Admin PPJK)', 480, signY, { align: 'center' });
  doc.setDrawColor(148, 163, 184);
  doc.line(415, signY + 50, 545, signY + 50);
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(shipment.billingCreatedBy || adminName, 480, signY + 64, { align: 'center' });

  doc.save(`${auto.billingNomor.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`);
}

export function exportBillingSummaryToExcel(
  rows: Shipment[],
  filename = 'PTG_PPJK_Penagihan_Customer.xlsx'
): void {
  const mapped = rows.map((s) => {
    const auto = buildAutoBillingFields(s);
    return {
      'No. Penagihan': auto.billingNomor,
      'Kode OS': s.kodeOs,
      'Customer': s.namaCustomer,
      'Pemicu Penagihan': getBillingEligibilityReason(s),
      'Status Penagihan': auto.billingStatus,
      'No. SPPB': s.noSppb || '-',
      'No. Surat Jalan': s.suratJalanNomor || '-',
      'Tanggal Terbit': auto.billingTanggal,
      'Jatuh Tempo': auto.billingJatuhTempo,
      'PPN (%)': auto.billingPpnPersen,
      'Total Tagihan (Rp)': auto.billingTotal,
      'Info Owner Via': s.billingOwnerNotifiedVia || '-',
      'Info Owner Oleh': s.billingOwnerNotifiedBy || '-',
      'Kirim Customer Via': s.billingCustomerSentVia || '-',
    };
  });
  const ws = XLSX.utils.json_to_sheet(mapped);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Penagihan');
  XLSX.writeFile(wb, filename);
}

export function exportNopenRecapToExcel(
  rows: Shipment[],
  summary: NopenRecapSummary,
  importirs: Importir[] = [],
  filename?: string
): void {
  const impMap = new Map(
    importirs.map((i) => [(i.kodeImportir || '').trim().toUpperCase(), i.namaImportir])
  );

  const mainRows = rows.map((s, idx) => {
    const impName =
      impMap.get((s.kodeImportir || '').trim().toUpperCase()) || (s.kodeImportir ? 'Non-Master' : '-');
    return {
      'No.': idx + 1,
      'No. NOPEN': s.nopen || '(Belum Terbit)',
      'Tgl. NOPEN': s.tglNopen || '-',
      'No. AJU': s.noAju || '-',
      'Tgl. AJU': s.tglAju || '-',
      'Kode OS': s.kodeOs,
      'Customer': s.namaCustomer,
      'Kode Importir': s.kodeImportir || '-',
      'Nama Importir': impName,
      'Shipper': s.shipper || '-',
      'No. B/L': s.noBl || '-',
      'No. Kontainer': s.noCont || '-',
      'Jalur': s.jalur || 'Belum Ada',
      'Status PIB / OS': s.status || '-',
      'No. SPPB': s.noSppb || '-',
      'Tgl. SPPB': s.tglSppb || '-',
      'Status Gate-Out': isContainerGateOut(s) ? 'Sudah Gate-Out' : 'Belum',
      'Currency': s.currency || '-',
      'Nilai Invoice': s.invoice !== '' ? Number(s.invoice) : 0,
      'BM / PDRI': s.bmPdri || '-',
      'SPTNP': hasSptnpIssue(s) ? `${s.sptnp || 'Ada'}${s.noSptnp ? ` (${s.noSptnp})` : ''}` : 'Tidak',
      'Checker': s.dokumenChecker || '-',
    };
  });

  const dailyRows = summary.byDay.map((d) => ({
    'Tanggal NOPEN': d.date,
    'Jumlah Dokumen': d.count,
    'Terbit SPPB': d.sppbCount,
    'Sudah Gate-Out': d.gateOutCount,
    'Ada SPTNP': d.sptnpCount,
    'Jalur Hijau': d.byJalur.Hijau || 0,
    'Jalur Kuning': d.byJalur.Kuning || 0,
    'Jalur Merah': d.byJalur.Merah || 0,
    'Jalur MITA': d.byJalur.MITA || 0,
  }));

  const importirRows = summary.byImportir.map((i) => ({
    'Kode Importir': i.kodeImportir,
    'Nama Importir': i.namaImportir,
    'Jumlah NOPEN / Dok': i.count,
    'Terbit SPPB': i.sppbCount,
    'Sudah Gate-Out': i.gateOutCount,
    'Nilai BM/PDRI': i.bmPdriTotal > 0 ? formatRupiah(i.bmPdriTotal) : '-',
  }));

  const wb = XLSX.utils.book_new();
  const wsMain = XLSX.utils.json_to_sheet(mainRows);
  const wsDaily = XLSX.utils.json_to_sheet(dailyRows);
  const wsImp = XLSX.utils.json_to_sheet(importirRows);
  XLSX.utils.book_append_sheet(wb, wsMain, 'Rekap NOPEN');
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Rekap Harian');
  XLSX.utils.book_append_sheet(wb, wsImp, 'Rekap Importir');

  const safePeriod = (summary.dateFrom || summary.dateTo || 'All').replace(/[^0-9_-]/g, '');
  XLSX.writeFile(wb, filename || `PTG_PPJK_Rekap_NOPEN_${safePeriod}.xlsx`);
}

export function exportNopenRecapToCSV(
  rows: Shipment[],
  summary: NopenRecapSummary,
  importirs: Importir[] = [],
  filename?: string
): void {
  const impMap = new Map(
    importirs.map((i) => [(i.kodeImportir || '').trim().toUpperCase(), i.namaImportir])
  );
  const headers = [
    'No',
    'No NOPEN',
    'Tgl NOPEN',
    'No AJU',
    'Tgl AJU',
    'Kode OS',
    'Customer',
    'Kode Importir',
    'Nama Importir',
    'No BL',
    'Jalur',
    'Status',
    'No SPPB',
    'Tgl SPPB',
    'Gate-Out',
    'Currency',
    'Nilai Invoice',
    'BM/PDRI',
    'SPTNP',
    'Checker',
  ];
  const csvEscape = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((s, idx) =>
      [
        idx + 1,
        s.nopen || '(Belum Terbit)',
        s.tglNopen || '-',
        s.noAju || '-',
        s.tglAju || '-',
        s.kodeOs,
        s.namaCustomer,
        s.kodeImportir || '-',
        impMap.get((s.kodeImportir || '').trim().toUpperCase()) || '-',
        s.noBl || '-',
        s.jalur || 'Belum Ada',
        s.status || '-',
        s.noSppb || '-',
        s.tglSppb || '-',
        isContainerGateOut(s) ? 'Sudah' : 'Belum',
        s.currency || '-',
        s.invoice !== '' ? s.invoice : 0,
        s.bmPdri || '-',
        hasSptnpIssue(s) ? s.noSptnp || s.sptnp || 'Ada' : 'Tidak',
        s.dokumenChecker || '-',
      ]
        .map(csvEscape)
        .join(',')
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safePeriod = (summary.dateFrom || summary.dateTo || 'All').replace(/[^0-9_-]/g, '');
  a.download = filename || `PTG_PPJK_Rekap_NOPEN_${safePeriod}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportNopenRecapToPDF(
  rows: Shipment[],
  summary: NopenRecapSummary,
  importirs: Importir[] = [],
  filename?: string,
  pengaturan?: Pengaturan
): void {
  const identity = getPpjkIdentity(pengaturan);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const impMap = new Map(
    importirs.map((i) => [(i.kodeImportir || '').trim().toUpperCase(), i.namaImportir])
  );

  doc.setFillColor(11, 37, 69);
  doc.rect(0, 0, 842, 66, 'F');
  const hasLogoNopen = addSafePdfImage(doc, identity.logoDataUrl, 32, 14, 38, 38, {
    whiteBackdrop: true,
  });
  const nopenLeftX = hasLogoNopen ? 82 : 32;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(`LAPORAN REKAPAN DOKUMEN BERDASARKAN NO. NOPEN (PIB) — ${identity.brandName}`, nopenLeftX, 28);
  doc.setFontSize(9.5);
  doc.setTextColor(226, 232, 240);
  doc.text(`${identity.companyName} · Periode: ${summary.periodLabel}`, nopenLeftX, 47);
  doc.text(
    `Total Dok: ${summary.totalMatched} | Terbit NOPEN: ${summary.totalWithNopen} | SPPB: ${summary.totalSppb} | Gate-Out: ${summary.totalGateOut} | Nilai BM/PDRI: ${summary.totalBmPdri > 0 ? formatRupiah(summary.totalBmPdri) : '-'}`,
    810,
    47,
    { align: 'right' }
  );

  autoTable(doc, {
    startY: 78,
    head: [
      [
        'No',
        'No. NOPEN',
        'Tgl. NOPEN',
        'No. AJU',
        'Kode OS',
        'Customer',
        'Importir',
        'No. B/L',
        'Jalur',
        'Status',
        'No. SPPB',
        'Nilai Invoice',
        'BM/PDRI',
      ],
    ],
    body: rows.map((s, idx) => {
      const impName = impMap.get((s.kodeImportir || '').trim().toUpperCase()) || '';
      const impText = s.kodeImportir
        ? `${s.kodeImportir}${impName ? ` - ${impName}` : ''}`
        : '-';
      const invText =
        s.invoice !== ''
          ? `${s.currency || 'USD'} ${new Intl.NumberFormat('en-US', {
              maximumFractionDigits: 2,
            }).format(Number(s.invoice))}`
          : '-';
      return [
        String(idx + 1),
        s.nopen || 'Belum Terbit',
        s.tglNopen || '-',
        s.noAju || '-',
        s.kodeOs,
        s.namaCustomer,
        impText,
        s.noBl || '-',
        s.jalur || '-',
        s.status || '-',
        isSppbReadyForGateOut(s) ? s.noSppb || 'Terbit' : '-',
        invText,
        s.bmPdri || '-',
      ];
    }),
    styles: { fontSize: 7.5, cellPadding: 4 },
    headStyles: { fillColor: [11, 37, 69], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center' },
      1: { fontStyle: 'bold' },
      11: { halign: 'right' },
    },
  });

  const safePeriod = (summary.dateFrom || summary.dateTo || 'All').replace(/[^0-9_-]/g, '');
  doc.save(filename || `PTG_PPJK_Rekap_NOPEN_${safePeriod}.pdf`);
}

export function exportTandaTerimaOpsPDF(
  item: PengeluaranOpsItem,
  shipment?: Shipment,
  pengaturan?: Pengaturan
): void {
  const identity = getPpjkIdentity(pengaturan);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  let opsMetaY = 114;
  let opsTableStartY = 148;
  const hasKopOps = Boolean(
    identity.kopSuratDataUrl &&
      addSafePdfImage(doc, identity.kopSuratDataUrl, 32, 14, 531, 52, { centerX: true })
  );

  if (hasKopOps) {
    doc.setDrawColor(11, 37, 69);
    doc.setLineWidth(1.5);
    doc.line(32, 70, 563, 70);
    doc.setFillColor(11, 37, 69);
    doc.rect(32, 76, 531, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.text('TANDA TERIMA PENGELUARAN OPERASIONAL', 44, 97);
    doc.setFontSize(9);
    doc.setTextColor(242, 140, 40);
    doc.text(identity.brandName, 551, 97, { align: 'right' });
    opsMetaY = 128;
    opsTableStartY = 160;
  } else {
    doc.setFillColor(11, 37, 69);
    doc.rect(0, 0, 595, 86, 'F');
    const hasLogoOps = addSafePdfImage(doc, identity.logoDataUrl, 32, 19, 46, 46, {
      whiteBackdrop: true,
    });
    const opsLeftX = hasLogoOps ? 90 : 32;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(hasLogoOps ? 14 : 15);
    doc.text('TANDA TERIMA PENGELUARAN OPERASIONAL', opsLeftX, 34);
    doc.setFontSize(10);
    doc.setTextColor(242, 140, 40);
    doc.text(`${identity.brandName} · ${identity.companyName}`, opsLeftX, 52);
    doc.setFontSize(8.5);
    doc.setTextColor(226, 232, 240);
    doc.text(`${identity.address} | Telp: ${identity.phone}`, opsLeftX, 68);
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(`No. Tanda Terima : ${item.noTandaTerima}`, 32, opsMetaY);
  doc.text(`Kode Pengeluaran : ${item.kodePengeluaran}`, 32, opsMetaY + 16);
  doc.text(`Tanggal Transaksi : ${item.tanggal || '-'}`, 360, opsMetaY);
  doc.text(`Status : ${item.statusPengeluaran}`, 360, opsMetaY + 16);

  autoTable(doc, {
    startY: opsTableStartY,
    head: [['Informasi Dokumen & Rincian Pengeluaran', 'Keterangan']],
    body: [
      ['Dokumen / Kode OS', item.kodeOs],
      ['No. B/L', shipment?.noBl || item.noBl || '-'],
      ['Customer / Importir', shipment?.namaCustomer || item.namaCustomer || '-'],
      ['No. Kontainer', shipment?.noCont || '-'],
      ['Kategori Biaya', item.kategori],
      ['Uraian Pengeluaran', item.keterangan],
      ['Metode Pembayaran', item.metodePembayaran],
      ['Nominal Diserahkan', formatRupiahOps(item.nominal)],
      ['Petugas Ops (Penerima)', item.petugasOps],
      ['Diserahkan Oleh (Keuangan/Admin)', item.diberikanOleh],
      [
        'Bukti Pembayaran / Lampiran',
        hasBuktiPengeluaran(item)
          ? item.buktiNamaFile || item.buktiLinkDrive || 'Lampiran Bukti Tersimpan'
          : 'Belum dilampirkan — mohon unggah bukti/nota',
      ],
      ['Catatan Audit', item.catatanAudit || '-'],
    ],
    styles: { fontSize: 9.5, cellPadding: 6 },
    headStyles: { fillColor: [11, 37, 69], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 190, fontStyle: 'bold', fillColor: [248, 250, 252] },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 480;
  const sigY = Math.min(finalY + 34, 690);

  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Yang Menyerahkan (Keuangan / Admin),', 54, sigY);
  doc.text('Penerima Dana (Petugas Operasional),', 350, sigY);

  doc.line(54, sigY + 62, 224, sigY + 62);
  doc.line(350, sigY + 62, 520, sigY + 62);

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(item.diberikanOleh || '-', 54, sigY + 76);
  doc.text(item.petugasOps || '-', 350, sigY + 76);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(identity.footerNote, 32, 808);

  const safeFile = item.noTandaTerima.replace(/[^A-Za-z0-9_-]/g, '_');
  doc.save(`${safeFile}.pdf`);
}

export function exportPengeluaranOpsToPDF(
  items: PengeluaranOpsItem[],
  summary: PengeluaranOpsSummary,
  shipments: Shipment[],
  pengaturan?: Pengaturan
): void {
  const identity = getPpjkIdentity(pengaturan);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const shipMap = new Map(shipments.map((s) => [s.kodeOs.trim().toUpperCase(), s]));

  doc.setFillColor(11, 37, 69);
  doc.rect(0, 0, 842, 66, 'F');
  const hasLogoOpsRep = addSafePdfImage(doc, identity.logoDataUrl, 32, 14, 38, 38, {
    whiteBackdrop: true,
  });
  const opsRepLeftX = hasLogoOpsRep ? 82 : 32;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(`LAPORAN KEUANGAN PENGELUARAN OPERASIONAL — ${identity.brandName}`, opsRepLeftX, 28);
  doc.setFontSize(9.5);
  doc.setTextColor(226, 232, 240);
  doc.text(`${identity.companyName} · Dicetak: ${new Date().toLocaleDateString('id-ID')}`, opsRepLeftX, 47);
  doc.text(
    `Total Transaksi: ${summary.totalTransaksi} | Total Pengeluaran: ${formatRupiahOps(summary.totalNominal)} | Kasbon: ${formatRupiahOps(summary.totalKasbonNominal)} | Dok OS: ${summary.dokumenTercatatCount}`,
    810,
    47,
    { align: 'right' }
  );

  autoTable(doc, {
    startY: 78,
    head: [
      [
        'No',
        'Kode / Tanda Terima',
        'Tanggal',
        'Kode OS & Customer',
        'Kategori',
        'Keterangan',
        'Nominal',
        'Metode',
        'Petugas Ops',
        'Status',
        'Bukti',
      ],
    ],
    body: items.map((item, idx) => {
      const s = shipMap.get((item.kodeOs || '').trim().toUpperCase());
      return [
        String(idx + 1),
        `${item.kodePengeluaran}\n${item.noTandaTerima}`,
        item.tanggal || '-',
        `${item.kodeOs}\n${s?.namaCustomer || item.namaCustomer || '-'}`,
        item.kategori,
        item.keterangan,
        formatRupiahOps(item.nominal),
        item.metodePembayaran,
        item.petugasOps,
        item.statusPengeluaran,
        hasBuktiPengeluaran(item) ? item.buktiNamaFile || 'Ada Bukti' : 'Belum Ada',
      ];
    }),
    styles: { fontSize: 7.5, cellPadding: 4 },
    headStyles: { fillColor: [11, 37, 69], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      6: { halign: 'right', fontStyle: 'bold' },
    },
  });

  doc.save(`PTG_PPJK_Pengeluaran_Operasional_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportPengeluaranOpsToExcel(
  items: PengeluaranOpsItem[],
  summary: PengeluaranOpsSummary,
  shipments: Shipment[],
  filename?: string
): void {
  const shipMap = new Map(shipments.map((s) => [s.kodeOs.trim().toUpperCase(), s]));

  const listRows = items.map((item, idx) => {
    const s = shipMap.get((item.kodeOs || '').trim().toUpperCase());
    return {
      'No.': idx + 1,
      'Kode Pengeluaran': item.kodePengeluaran,
      'No. Tanda Terima': item.noTandaTerima,
      'Tanggal': item.tanggal,
      'Kode OS': item.kodeOs,
      'No. B/L': s?.noBl || item.noBl || '-',
      'Customer': s?.namaCustomer || item.namaCustomer || '-',
      'Kategori': item.kategori,
      'Keterangan': item.keterangan,
      'Nominal (Rp)': item.nominal,
      'Metode Pembayaran': item.metodePembayaran,
      'Status': item.statusPengeluaran,
      'Petugas Ops Penerima': item.petugasOps,
      'Diserahkan Oleh': item.diberikanOleh,
      'Status Bukti': hasBuktiPengeluaran(item) ? 'Ada Bukti' : 'Belum Ada Bukti',
      'Nama File Bukti': item.buktiNamaFile || '-',
      'Link Drive Bukti': item.buktiLinkDrive || '-',
      'Catatan Audit': item.catatanAudit || '-',
    };
  });

  const docRows = summary.byDokumen.map((d) => ({
    'Kode OS': d.kodeOs,
    'No. B/L': d.noBl,
    'Customer': d.namaCustomer,
    'Status Shipment': d.shipStatus,
    'Jumlah Pengeluaran': d.jumlahTransaksi,
    'Total Biaya Ops (Rp)': d.totalNominal,
    'Masih Kasbon (Rp)': d.nominalKasbon,
    'Sudah Dibayar/Selesai (Rp)': d.nominalSelesai,
    'Belum Ada Bukti': d.transaksiTanpaBukti,
    'Nilai Tagihan Billing (Rp)': d.billingTotal,
    'Selisih Margin Kotor (Rp)': d.selisihBilling,
  }));

  const petugasRows = summary.byPetugas.map((p) => ({
    'Petugas Ops': p.petugasOps,
    'Jumlah Tanda Terima': p.jumlahTransaksi,
    'Dokumen OS Ditangani': p.dokumenCount,
    'Total Dana Diterima (Rp)': p.totalDiterima,
    'Kasbon Aktif (Rp)': p.kasbonAktifNominal,
    'Sudah Dipertanggungjawabkan (Rp)': p.sudahDipertanggungjawabkanNominal,
    'Ada Bukti': p.transaksiDenganBukti,
    'Belum Ada Bukti': p.transaksiTanpaBukti,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(listRows), 'Daftar Pengeluaran');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(docRows), 'Rekap per Dokumen OS');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(petugasRows), 'Rekap Petugas Ops');

  XLSX.writeFile(
    wb,
    filename || `PTG_PPJK_Pengeluaran_Operasional_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

function truncatePdfText(text: string, maxLen: number): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(0, maxLen - 1))}…`;
}

function drawKdiCoverPage(doc: jsPDF, kdi: KdiCoverDocument): void {
  const pageWidth = 595.28;
  const marginX = 28;
  const contentWidth = pageWidth - marginX * 2;
  const { identity } = kdi;

  // 1. KOP PPJK (Header Perusahaan PPJK — Prioritaskan Kop Surat Upload jika tersedia)
  const hasKdiKopBanner = Boolean(
    identity.kopSuratDataUrl &&
      addSafePdfImage(doc, identity.kopSuratDataUrl, marginX, 16, contentWidth, 49, {
        centerX: true,
      })
  );

  if (!hasKdiKopBanner) {
    const hasKdiLogo = addSafePdfImage(doc, identity.logoDataUrl, marginX, 20, 42, 42, {
      whiteBackdrop: true,
    });

    if (!hasKdiLogo) {
      doc.setFillColor(11, 37, 69);
      doc.roundedRect(marginX, 20, 42, 42, 6, 6, 'F');
      doc.setDrawColor(242, 140, 40);
      doc.setLineWidth(1.2);
      doc.roundedRect(marginX + 2, 22, 38, 38, 4, 4, 'S');

      const initials =
        identity.brandName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('') || 'PPJK';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(initials, marginX + 21, 41, { align: 'center' });
      doc.setFontSize(6.5);
      doc.setTextColor(242, 140, 40);
      doc.text('PPJK', marginX + 21, 52, { align: 'center' });
    }

    const textX = marginX + 52;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(11, 37, 69);
    doc.text(identity.companyName.toUpperCase(), textX, 31);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(217, 119, 25);
    doc.text(`${identity.brandName} · ${identity.tagline}`, textX, 42);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const contactLine = [
      identity.address,
      identity.phone ? `Telp: ${identity.phone}` : '',
      identity.email ? `Email: ${identity.email}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    doc.text(truncatePdfText(contactLine, 98), textX, 52);

    const legalLine = [
      identity.npwp ? `NPWP / Izin: ${identity.npwp}` : '',
      identity.website || '',
    ]
      .filter(Boolean)
      .join(' · ');
    if (legalLine) {
      doc.text(truncatePdfText(legalLine, 96), textX, 61);
    }
  }

  // Garis Kop Ganda (Navy + Gold)
  doc.setDrawColor(11, 37, 69);
  doc.setLineWidth(1.6);
  doc.line(marginX, 68, pageWidth - marginX, 68);
  doc.setDrawColor(242, 140, 40);
  doc.setLineWidth(0.7);
  doc.line(marginX, 71, pageWidth - marginX, 71);

  // 2. Judul Dokumen KDI
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  const titleText = 'KELENGKAPAN DOKUMEN IMPOR';
  const titleWidth = doc.getTextWidth(titleText);
  const centerX = pageWidth / 2;
  doc.text(titleText, centerX, 86, { align: 'center' });
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.8);
  doc.line(centerX - titleWidth / 2, 88, centerX + titleWidth / 2, 88);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(truncatePdfText(kdi.subtitleLine, 92), centerX, 99, { align: 'center' });

  // 3. Blok Metadata 2 Kolom (Persis Lembar Dasi Depan Bundel MAP)
  const metaPairs: Array<{
    lLabel: string;
    lVal: string;
    rLabel?: string;
    rVal?: string;
  }> = [
    { lLabel: 'CONTAINER NO.', lVal: kdi.containerNo },
    { lLabel: 'BL NO.', lVal: kdi.blNo, rLabel: 'TANGGAL', rVal: kdi.blTanggal },
    { lLabel: 'SHIPPER', lVal: kdi.shipper },
    { lLabel: 'CUSTOMER', lVal: kdi.customer },
    { lLabel: 'COMMODITY', lVal: kdi.commodity },
    { lLabel: 'CONSIGNEE', lVal: kdi.consignee },
    { lLabel: 'VESSEL', lVal: kdi.vessel, rLabel: 'VOY', rVal: kdi.voy },
    { lLabel: 'E.T.D', lVal: kdi.etd },
    { lLabel: 'E.T.A', lVal: kdi.eta },
    { lLabel: 'PORT OF LOADING', lVal: kdi.portOfLoading },
    { lLabel: 'PORT OF DISCHARGE', lVal: kdi.portOfDischarge },
    {
      lLabel: 'NO. PENGAJUAN PIB',
      lVal: kdi.noPengajuanPib,
      rLabel: 'TANGGAL',
      rVal: kdi.tglPengajuanPib,
    },
    { lLabel: 'NO. PIB', lVal: kdi.noPib, rLabel: 'TANGGAL', rVal: kdi.tglPib },
    { lLabel: 'PFPB (BHDL)', lVal: kdi.pfpb, rLabel: 'TANGGAL', rVal: kdi.tglPfpb },
    {
      lLabel: 'PFPD (SPTNP/SPPB)',
      lVal: kdi.pfpd,
      rLabel: 'TANGGAL',
      rVal: kdi.tglPfpd,
    },
    { lLabel: 'SPTNP NO.', lVal: kdi.sptnpNo, rLabel: 'TANGGAL', rVal: kdi.tglSptnp },
    { lLabel: 'SPPB NO.', lVal: kdi.sppbNo, rLabel: 'TANGGAL', rVal: kdi.tglSppb },
    { lLabel: 'ESLAH OLEH', lVal: kdi.eslahOleh, rLabel: 'TANGGAL', rVal: kdi.tglEslah },
    { lLabel: 'TRUCKING SUPIR', lVal: kdi.truckingSupir, rLabel: 'NOPOL', rVal: kdi.nopol },
  ];

  const lLabelX = marginX + 6;
  const lColonX = marginX + 114;
  const lValX = marginX + 121;
  const rLabelX = 358;
  const rColonX = 412;
  const rValX = 419;

  let curY = 114;
  const rowStep = 11.4;
  doc.setFontSize(7.6);
  doc.setTextColor(15, 23, 42);

  for (const row of metaPairs) {
    doc.setFont('helvetica', 'bold');
    doc.text(row.lLabel, lLabelX, curY);
    doc.text(':', lColonX, curY);
    doc.setFont('helvetica', 'normal');
    doc.text(truncatePdfText(row.lVal || '', row.rLabel ? 36 : 74), lValX, curY);

    if (row.rLabel) {
      doc.setFont('helvetica', 'bold');
      doc.text(row.rLabel, rLabelX, curY);
      doc.text(':', rColonX, curY);
      doc.setFont('helvetica', 'normal');
      doc.text(truncatePdfText(row.rVal || '', 26), rValX, curY);
    }
    curY += rowStep;
  }

  // 4. Tabel Checklist 20 Baris Kelengkapan Dokumen Impor
  autoTable(doc, {
    startY: curY + 4,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: [['NO', 'URAIAN DOKUMEN', 'ADA', 'TIDAK', 'TERIMA TGL', 'VIA', 'KETERANGAN']],
    body: kdi.rows.map((r) => [
      String(r.no),
      r.uraian,
      '',
      '',
      r.terimaTgl || '',
      r.via || '',
      r.keterangan || '',
    ]),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.4,
      cellPadding: { top: 3.1, bottom: 3.1, left: 4, right: 4 },
      textColor: [15, 23, 42],
      lineColor: [30, 41, 59],
      lineWidth: 0.6,
      valign: 'middle',
      minCellHeight: 17.5,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [11, 37, 69],
      fontStyle: 'bold',
      fontSize: 7.6,
      halign: 'center',
      lineColor: [30, 41, 59],
      lineWidth: 0.8,
    },
    columnStyles: {
      0: { cellWidth: 23, halign: 'center' },
      1: { cellWidth: 145, fontStyle: 'bold' },
      2: { cellWidth: 36, halign: 'center' },
      3: { cellWidth: 36, halign: 'center' },
      4: { cellWidth: 72, halign: 'center' },
      5: { cellWidth: 60, halign: 'center' },
      6: { cellWidth: contentWidth - 372 },
    },
    didDrawCell: (hookData) => {
      if (hookData.section !== 'body') return;
      if (hookData.column.index !== 2 && hookData.column.index !== 3) return;
      const rowData = kdi.rows[hookData.row.index];
      if (!rowData) return;
      const isChecked = hookData.column.index === 2 ? rowData.ada : rowData.tidak;
      const boxW = 24;
      const boxH = 11.5;
      const bx = hookData.cell.x + (hookData.cell.width - boxW) / 2;
      const by = hookData.cell.y + (hookData.cell.height - boxH) / 2;

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.65);
      doc.rect(bx, by, boxW, boxH, 'S');
      if (isChecked) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text('X', bx + boxW / 2, by + 8.5, { align: 'center' });
      }
    },
  });

  // 5. Footer Verifikasi Dokumen & Kop Note
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ||
    730;
  const footerY = Math.min(finalY + 18, 792);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`DOKUMEN CEK LIST BY : ${kdi.dokumenCekListBy || '-'}`, marginX + 14, footerY);
  doc.text(`TANGGAL : ${kdi.tanggalCekList || ''}`, 310, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${identity.companyName} · ${identity.footerNote}`,
    marginX,
    Math.min(footerY + 20, 822)
  );
}

export function exportKdiCoverPDF(
  shipment: Shipment,
  options: KdiCoverOptions = {},
  filename?: string
): void {
  const kdi = buildKdiCoverDocument(shipment, options);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  drawKdiCoverPage(doc, kdi);
  const safeOs = shipment.kodeOs.replace(/[^A-Za-z0-9_-]/g, '_');
  doc.save(filename || `KDI_${safeOs}.pdf`);
}

export function exportBatchKdiCoverPDF(
  shipments: Shipment[],
  options: Omit<KdiCoverOptions, 'customRows'> = {},
  filename?: string
): void {
  if (shipments.length === 0) return;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  shipments.forEach((s, index) => {
    if (index > 0) doc.addPage();
    const kdi = buildKdiCoverDocument(s, options);
    drawKdiCoverPage(doc, kdi);
  });
  doc.save(filename || `KDI_Bundel_Outstanding_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function drawDklCoverPage(doc: jsPDF, dkl: DklCoverDocument): void {
  const pageWidth = 595.28;
  const marginX = 28;
  const contentWidth = pageWidth - marginX * 2;
  const { identity } = dkl;

  // 1. KOP PPJK (Prioritaskan Kop Surat Upload jika tersedia)
  const hasKopBanner = Boolean(
    identity.kopSuratDataUrl &&
      addSafePdfImage(doc, identity.kopSuratDataUrl, marginX, 16, contentWidth, 49, {
        centerX: true,
      })
  );

  if (!hasKopBanner) {
    const hasLogo = addSafePdfImage(doc, identity.logoDataUrl, marginX, 20, 42, 42, {
      whiteBackdrop: true,
    });

    if (!hasLogo) {
      doc.setFillColor(11, 37, 69);
      doc.roundedRect(marginX, 20, 42, 42, 6, 6, 'F');
      doc.setDrawColor(242, 140, 40);
      doc.setLineWidth(1.2);
      doc.roundedRect(marginX + 2, 22, 38, 38, 4, 4, 'S');

      const initials =
        identity.brandName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('') || 'PPJK';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(initials, marginX + 21, 41, { align: 'center' });
      doc.setFontSize(6.5);
      doc.setTextColor(242, 140, 40);
      doc.text('PPJK', marginX + 21, 52, { align: 'center' });
    }

    const textX = marginX + 52;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(11, 37, 69);
    doc.text(identity.companyName.toUpperCase(), textX, 31);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(217, 119, 25);
    doc.text(`${identity.brandName} · ${identity.tagline}`, textX, 42);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const contactLine = [
      identity.address,
      identity.phone ? `Telp: ${identity.phone}` : '',
      identity.email ? `Email: ${identity.email}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    doc.text(truncatePdfText(contactLine, 98), textX, 52);

    const legalLine = [
      identity.npwp ? `NPWP / Izin: ${identity.npwp}` : '',
      identity.website || '',
    ]
      .filter(Boolean)
      .join(' · ');
    if (legalLine) {
      doc.text(truncatePdfText(legalLine, 96), textX, 61);
    }
  }

  // Garis Kop Ganda
  doc.setDrawColor(11, 37, 69);
  doc.setLineWidth(1.6);
  doc.line(marginX, 68, pageWidth - marginX, 68);
  doc.setDrawColor(242, 140, 40);
  doc.setLineWidth(0.7);
  doc.line(marginX, 71, pageWidth - marginX, 71);

  // 2. Judul Dokumen DKL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  const titleText = 'DANA KERJA LAPANGAN (DKL)';
  const titleWidth = doc.getTextWidth(titleText);
  const centerX = pageWidth / 2;
  doc.text(titleText, centerX, 86, { align: 'center' });
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.8);
  doc.line(centerX - titleWidth / 2, 88, centerX + titleWidth / 2, 88);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(truncatePdfText(dkl.subtitleLine, 96), centerX, 99, { align: 'center' });

  // 3. Blok Metadata 2 Kolom
  const metaPairs: Array<{
    lLabel: string;
    lVal: string;
    rLabel?: string;
    rVal?: string;
  }> = [
    { lLabel: 'CONTAINER NO.', lVal: dkl.containerNo, rLabel: 'NO. DKL', rVal: dkl.noReferensiDkl },
    { lLabel: 'BL NO.', lVal: dkl.blNo, rLabel: 'TANGGAL', rVal: dkl.blTanggal },
    { lLabel: 'SHIPPER', lVal: dkl.shipper },
    { lLabel: 'CUSTOMER', lVal: dkl.customer },
    { lLabel: 'COMMODITY', lVal: dkl.commodity },
    { lLabel: 'CONSIGNEE', lVal: dkl.consignee },
    { lLabel: 'VESSEL', lVal: dkl.vessel, rLabel: 'VOY', rVal: dkl.voy },
    { lLabel: 'E.T.D', lVal: dkl.etd, rLabel: 'E.T.A', rVal: dkl.eta },
    { lLabel: 'PORT OF LOADING', lVal: dkl.portOfLoading },
    { lLabel: 'PORT OF DISCHARGE', lVal: dkl.portOfDischarge },
    {
      lLabel: 'NO. PENGAJUAN PIB',
      lVal: dkl.noPengajuanPib,
      rLabel: 'TANGGAL',
      rVal: dkl.tglPengajuanPib,
    },
    { lLabel: 'NO. PIB', lVal: dkl.noPib, rLabel: 'TANGGAL', rVal: dkl.tglPib },
    { lLabel: 'PFPB (BHDL)', lVal: dkl.pfpb, rLabel: 'TANGGAL', rVal: dkl.tglPfpb },
    { lLabel: 'PFPD (SPTNP/SPPB)', lVal: dkl.pfpd, rLabel: 'TANGGAL', rVal: dkl.tglPfpd },
    { lLabel: 'SPTNP NO.', lVal: dkl.sptnpNo, rLabel: 'TANGGAL', rVal: dkl.tglSptnp },
    { lLabel: 'SPPB NO.', lVal: dkl.sppbNo, rLabel: 'TANGGAL', rVal: dkl.tglSppb },
    { lLabel: 'ESLAH OLEH', lVal: dkl.eslahOleh, rLabel: 'TANGGAL', rVal: dkl.tglEslah },
    { lLabel: 'TRUCKING SUPIR', lVal: dkl.truckingSupir, rLabel: 'NOPOL', rVal: dkl.nopol },
  ];

  const lLabelX = marginX + 6;
  const lColonX = marginX + 114;
  const lValX = marginX + 121;
  const rLabelX = 358;
  const rColonX = 412;
  const rValX = 419;

  let curY = 114;
  const rowStep = 11.2;
  doc.setFontSize(7.6);
  doc.setTextColor(15, 23, 42);

  for (const row of metaPairs) {
    doc.setFont('helvetica', 'bold');
    doc.text(row.lLabel, lLabelX, curY);
    doc.text(':', lColonX, curY);
    doc.setFont('helvetica', 'normal');
    doc.text(truncatePdfText(row.lVal || '', row.rLabel ? 36 : 74), lValX, curY);

    if (row.rLabel) {
      doc.setFont('helvetica', 'bold');
      doc.text(row.rLabel, rLabelX, curY);
      doc.text(':', rColonX, curY);
      doc.setFont('helvetica', 'normal');
      doc.text(truncatePdfText(row.rVal || '', 26), rValX, curY);
    }
    curY += rowStep;
  }

  // 4. Tabel 13 Jenis Biaya Pengeluaran DKL
  autoTable(doc, {
    startY: curY + 5,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: [['NO', 'JENIS BIAYA PENGELUARAN', 'ADA', 'TANGGAL', 'PETUGAS / VIA', 'NOMINAL (Rp)', 'KETERANGAN / TANDA TERIMA']],
    body: [
      ...dkl.rows.map((r) => [
        String(r.no),
        r.jenisBiaya,
        '',
        r.tanggal || '',
        r.petugasVia || '',
        r.nominal > 0 ? formatRupiahOps(r.nominal) : '-',
        r.keterangan || '',
      ]),
      [
        '',
        'TOTAL DANA KERJA LAPANGAN (DKL)',
        '',
        '',
        '',
        formatRupiahOps(dkl.totalNominal),
        `${dkl.totalTransaksi} transaksi ops`,
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.4,
      cellPadding: { top: 3.4, bottom: 3.4, left: 4, right: 4 },
      textColor: [15, 23, 42],
      lineColor: [30, 41, 59],
      lineWidth: 0.6,
      valign: 'middle',
      minCellHeight: 19,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [11, 37, 69],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      lineColor: [30, 41, 59],
      lineWidth: 0.8,
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 118, fontStyle: 'bold' },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 58, halign: 'center' },
      4: { cellWidth: 74, halign: 'center' },
      5: { cellWidth: 78, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: contentWidth - 382 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.row.index === dkl.rows.length) {
        hookData.cell.styles.fillColor = [241, 245, 249];
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [11, 37, 69];
      }
    },
    didDrawCell: (hookData) => {
      if (hookData.section !== 'body') return;
      if (hookData.row.index >= dkl.rows.length) return;
      if (hookData.column.index !== 2) return;
      const rowData = dkl.rows[hookData.row.index];
      if (!rowData) return;
      const boxW = 20;
      const boxH = 11.5;
      const bx = hookData.cell.x + (hookData.cell.width - boxW) / 2;
      const by = hookData.cell.y + (hookData.cell.height - boxH) / 2;

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.65);
      doc.rect(bx, by, boxW, boxH, 'S');
      if (rowData.ada) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text('X', bx + boxW / 2, by + 8.5, { align: 'center' });
      }
    },
  });

  // 5. Ringkasan Status & Tanda Tangan
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ||
    660;
  const summaryY = Math.min(finalY + 14, 735);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(51, 65, 85);
  const summaryLine = [
    `Sudah Dibayar/Selesai: ${formatRupiahOps(dkl.totalSudahDibayar + dkl.totalSelesai)}`,
    `Kasbon Ops: ${formatRupiahOps(dkl.totalKasbon)}`,
    `Belum Ada Bukti: ${dkl.totalTanpaBukti} trx`,
    dkl.bmPdriReferensi ? `Ref BM/PDRI: ${dkl.bmPdriReferensi}` : '',
  ]
    .filter(Boolean)
    .join('   |   ');
  doc.text(truncatePdfText(summaryLine, 110), marginX, summaryY);

  const sigY = Math.min(summaryY + 20, 765);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(15, 23, 42);
  doc.text('DISERAHKAN OLEH (KEUANGAN/ADMIN)', marginX + 6, sigY);
  doc.text('DITERIMA / PELAKSANA LAPANGAN', marginX + 195, sigY);
  doc.text(`TANGGAL : ${dkl.tanggalCetak || ''}`, marginX + 382, sigY);

  const nameY = Math.min(sigY + 34, 804);
  doc.setFont('helvetica', 'normal');
  doc.text(`( ${dkl.diserahkanOleh || '-'} )`, marginX + 6, nameY);
  doc.text(`( ${dkl.koordinatorLapangan || '-'} )`, marginX + 195, nameY);
  doc.text('MENGETAHUI / MANAJER', marginX + 382, nameY);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${identity.companyName} · ${identity.footerNote}`,
    marginX,
    Math.min(nameY + 18, 825)
  );
}

export function exportDklCoverPDF(
  shipment: Shipment,
  options: DklCoverOptions = {},
  filename?: string
): void {
  const dkl = buildDklCoverDocument(shipment, options);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  drawDklCoverPage(doc, dkl);
  const safeOs = shipment.kodeOs.replace(/[^A-Za-z0-9_-]/g, '_');
  doc.save(filename || `DKL_${safeOs}.pdf`);
}

export function exportBatchDklCoverPDF(
  shipments: Shipment[],
  options: Omit<DklCoverOptions, 'customRows'> = {},
  filename?: string
): void {
  if (shipments.length === 0) return;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  shipments.forEach((s, index) => {
    if (index > 0) doc.addPage();
    const dkl = buildDklCoverDocument(s, options);
    drawDklCoverPage(doc, dkl);
  });
  doc.save(filename || `DKL_Bundel_Per_OS_${new Date().toISOString().slice(0, 10)}.pdf`);
}
