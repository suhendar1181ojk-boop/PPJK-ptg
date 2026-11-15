import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CheckerSummary, Customer, Pengaturan, Shipment } from '../types/ppjk';
import {
  buildAutoBillingFields,
  calculateBillingTotals,
  DEFAULT_PENGATURAN,
  formatRupiah,
  generateSuratJalanNomor,
  getBillingEligibilityReason,
  getDoValidityMeta,
  getShipmentProcessSignal,
  normalizeStatusDokumen,
  normalizeStatusDoPelayaran,
  normalizeStatusGateOut,
  normalizeStatusGatePass,
  normalizeStatusPenagihan,
  normalizeStatusSuratJalan,
  normalizeStatusTrucking,
  parseCustomerContact,
} from './ppjkLogic';

export function exportShipmentsToExcel(rows: Shipment[], filename = 'PTG_PPJK_Shipment.xlsx'): void {
  const mapped = rows.map((s) => {
    const sig = getShipmentProcessSignal(s);
    return {
      'Kode OS': s.kodeOs,
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

export function exportShipmentsToCSV(rows: Shipment[], filename = 'PTG_PPJK_Shipment.csv'): void {
  const headers = [
    'Kode OS',
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
  title = 'Laporan PTG PPJK Outstanding',
  filename = 'PTG_PPJK_Laporan.pdf'
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.setTextColor(11, 37, 69);
  doc.text(title, 40, 38);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')} · Total: ${rows.length} shipment`, 40, 54);

  autoTable(doc, {
    startY: 66,
    head: [
      ['Kode OS', 'Customer', 'No. BL', 'Dok. Checker', 'ETD', 'ETA', 'CD ETA', 'Status', 'Jalur', 'No. AJU', 'Tgl SPPB'],
    ],
    body: rows.map((s) => [
      s.kodeOs,
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
  filename = 'PTG_Rekap_Checker.pdf'
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.setTextColor(11, 37, 69);
  doc.text('Rekapan Dokumen Checker & Summary Status PTG PPJK', 40, 38);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')} · Total Checker: ${checkers.length}`, 40, 54);

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

export function exportSuratJalanToPDF(shipment: Shipment): void {
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

  doc.setFillColor(11, 37, 69);
  doc.rect(0, 0, 595, 84, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('SURAT JALAN PENGIRIMAN KONTAINER', 40, 36);
  doc.setFontSize(9.5);
  doc.setTextColor(226, 232, 240);
  doc.text('PTG PPJK — Tracking Gate-Out & Pengiriman Armada', 40, 54);
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`No. SJ: ${sjNomor}`, 555, 36, { align: 'right' });
  doc.setFontSize(9.5);
  doc.text(`Tanggal: ${sjTanggal}  |  Status: ${sjStatus}`, 555, 54, { align: 'right' });

  autoTable(doc, {
    startY: 102,
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
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const auto = buildAutoBillingFields(shipment);
  const totals = calculateBillingTotals(auto.billingItems, auto.billingPpnPersen);
  const parsedContact = parseCustomerContact(customer?.kontak);
  const adminName = pengaturan?.adminName?.trim() || DEFAULT_PENGATURAN.adminName || 'Admin Billing PTG';
  const bankInfo =
    pengaturan?.billingBankInfo?.trim() ||
    DEFAULT_PENGATURAN.billingBankInfo ||
    'Bank Mandiri · PT PTG Logistik Kepabeanan';

  doc.setFillColor(11, 37, 69);
  doc.rect(0, 0, 595, 90, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.text('SURAT PENAGIHAN JASA PPJK', 40, 36);
  doc.setFontSize(9.5);
  doc.setTextColor(226, 232, 240);
  doc.text('PTG PPJK — Kepabeanan, D/O Pelayaran & Trucking Kontainer', 40, 54);
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`No. ${auto.billingNomor}`, 555, 36, { align: 'right' });
  doc.setFontSize(9);
  doc.text(`Tgl: ${auto.billingTanggal}  |  Jatuh Tempo: ${auto.billingJatuhTempo}`, 555, 54, {
    align: 'right',
  });
  doc.text(`Status: ${auto.billingStatus}`, 555, 70, { align: 'right' });

  autoTable(doc, {
    startY: 106,
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
