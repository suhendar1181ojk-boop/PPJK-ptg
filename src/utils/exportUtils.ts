import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CheckerSummary, Shipment } from '../types/ppjk';

export function exportShipmentsToExcel(rows: Shipment[], filename = 'PTG_PPJK_Shipment.xlsx'): void {
  const mapped = rows.map((s) => ({
    'Kode OS': s.kodeOs,
    'Ship': s.ship,
    'Kode Customer': s.kodeCustomer,
    'Nama Customer': s.namaCustomer,
    'Tgl. Terima Dok': s.tglTerimaDok,
    'No. Packinglist': s.noPackinglist,
    'No. BL': s.noBl,
    'ETD': s.etd,
    'ETA': s.eta,
    'Count Down ETA': s.countDownEta ?? '-',
    'No. Cont': s.noCont,
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
  }));

  const ws = XLSX.utils.json_to_sheet(mapped);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Shipment');
  XLSX.writeFile(wb, filename);
}

export function exportShipmentsToCSV(rows: Shipment[], filename = 'PTG_PPJK_Shipment.csv'): void {
  const headers = [
    'Kode OS',
    'Nama Customer',
    'No. BL',
    'ETA',
    'Count Down ETA',
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
    ...rows.map((s) =>
      [
        s.kodeOs,
        s.namaCustomer,
        s.noBl,
        s.eta,
        s.countDownEta ?? '',
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
      ['Kode OS', 'Customer', 'No. BL', 'ETA', 'CD ETA', 'Status', 'Jalur', 'No. AJU', 'Tgl SPPB'],
    ],
    body: rows.map((s) => [
      s.kodeOs,
      s.namaCustomer,
      s.noBl,
      s.eta || '-',
      s.countDownEta !== null ? `${s.countDownEta}h` : '-',
      s.status,
      s.jalur || '-',
      s.noAju || '-',
      s.tglSppb || '-',
    ]),
    styles: { fontSize: 8, cellPadding: 5 },
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
