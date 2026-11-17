import type {
  Importir,
  Pengaturan,
  PengeluaranOpsItem,
  Shipment,
} from '../types/ppjk';
import { getPpjkIdentity, hasSptnpIssue, type PpjkIdentity } from './ppjkLogic';

export interface KdiCoverRow {
  no: number;
  uraian: string;
  ada: boolean;
  tidak: boolean;
  terimaTgl: string;
  via: string;
  keterangan: string;
}

export interface KdiCoverOptions {
  importirs?: Importir[];
  pengaturan?: Pengaturan;
  pengeluaranOps?: PengeluaranOpsItem[];
  voy?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  bc11Pos?: string;
  sealBhdlNo?: string;
  fillAutoStatus?: boolean;
  customRows?: KdiCoverRow[];
}

export interface KdiCoverDocument {
  identity: PpjkIdentity;
  kodeOs: string;
  subtitleLine: string;
  containerNo: string;
  blNo: string;
  blTanggal: string;
  shipper: string;
  customer: string;
  commodity: string;
  consignee: string;
  vessel: string;
  voy: string;
  etd: string;
  eta: string;
  portOfLoading: string;
  portOfDischarge: string;
  noPengajuanPib: string;
  tglPengajuanPib: string;
  noPib: string;
  tglPib: string;
  pfpb: string;
  tglPfpb: string;
  pfpd: string;
  tglPfpd: string;
  sptnpNo: string;
  tglSptnp: string;
  sppbNo: string;
  tglSppb: string;
  eslahOleh: string;
  tglEslah: string;
  truckingSupir: string;
  nopol: string;
  rows: KdiCoverRow[];
  dokumenCekListBy: string;
  tanggalCekList: string;
}

export const KDI_STANDARD_DOCUMENT_ROWS: string[] = [
  'INVOICE',
  'PACKING LIST',
  'BILL OF LOADING',
  'MARINE INSURANCE',
  'FREIGHT',
  'FASILITAS :',
  'LAPORAN SURVEYOR',
  'PURCHASE ORDER',
  'SALES CONTRACT',
  'BUKTI BAYAR KE SHIPPER',
  'DEKLARASI NILAI PABEAN',
  'DELIVERY ORDER (DO)',
  'GERAKAN (BHDL)',
  'PENUMPUKAN (SP2)',
  'STPNP (NOTUL)',
  'TRUCKING',
  'LIST OFF',
  'BC 1.1',
  'SEAL BHDL',
  'NPD',
];

const BULAN_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Mengubah format tanggal ISO (YYYY-MM-DD) menjadi format formal Indonesia
 * seperti "21 November 2023" agar sesuai lembar bundel KDI.
 */
export function formatTanggalIndonesia(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return trimmed;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (monthIdx < 0 || monthIdx > 11 || !Number.isFinite(day)) return trimmed;
  return `${day} ${BULAN_ID[monthIdx]} ${year}`;
}

/**
 * Memisahkan nama kapal (Vessel) dan nomor Voyage bila tertulis dalam satu field ship.
 */
export function extractVoyFromShip(ship?: string): { vessel: string; voy: string } {
  const raw = (ship || '').trim();
  if (!raw) return { vessel: '', voy: '' };
  const voyMatch = /^(.*?)\s+(?:VOY\.?|V\.?)\s*([A-Za-z0-9./-]+)$/i.exec(raw);
  if (voyMatch) {
    return {
      vessel: voyMatch[1].trim(),
      voy: voyMatch[2].trim(),
    };
  }
  return { vessel: raw, voy: '' };
}

function formatNominalShort(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Rp.';
  return `Rp. ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(amount)}`;
}

function sumOpsByCategory(
  expenses: PengeluaranOpsItem[],
  kodeOs: string,
  categories: string[]
): number {
  const key = kodeOs.trim().toUpperCase();
  return expenses
    .filter(
      (e) =>
        (e.kodeOs || '').trim().toUpperCase() === key &&
        categories.includes(e.kategori)
    )
    .reduce((acc, e) => acc + (Number(e.nominal) || 0), 0);
}

/**
 * Membangun data lengkap Lembar Kelengkapan Dokumen Impor (KDI) / Dasi Depan Bundel MAP
 * untuk satu dokumen Shipment dengan Kop PPJK.
 */
export function buildKdiCoverDocument(
  shipment: Shipment,
  options: KdiCoverOptions = {}
): KdiCoverDocument {
  const identity = getPpjkIdentity(options.pengaturan);
  const fillAuto = options.fillAutoStatus !== false;
  const importirs = options.importirs || [];
  const expenses = options.pengeluaranOps || [];

  const impMatch = importirs.find(
    (imp) =>
      (imp.kodeImportir || '').trim().toUpperCase() ===
      (shipment.kodeImportir || '').trim().toUpperCase()
  );

  const { vessel, voy: parsedVoy } = extractVoyFromShip(shipment.ship);
  const voy = options.voy !== undefined ? options.voy : parsedVoy;
  const brandShort = (identity.brandName || 'PTG').split(/\s+/)[0].toUpperCase();

  const checklist = shipment.terimaDok?.items || {};
  const hasInv = Boolean(checklist['Commercial Invoice']);
  const hasPl = Boolean(checklist['Packing List'] || shipment.noPackinglist?.trim());
  const hasBl = Boolean(checklist['Bill of Lading (BL)'] || shipment.noBl?.trim());
  const hasIns = Boolean(checklist['Asuransi / Polis']);
  const hasCoo = Boolean(checklist['Certificate of Origin (COO/SKA)']);
  const hasDo = shipment.doPelayaranStatus === 'Sedia';
  const hasBc11 = Boolean(
    shipment.bc11Terbit || shipment.noBc11?.trim() || shipment.tglBc11?.trim()
  );
  const hasTrucking = Boolean(
    shipment.truckingStatus === 'Sedia' || shipment.truckingNamaSupir?.trim()
  );
  const hasSptnp = hasSptnpIssue(shipment);

  const bhdlNominal = sumOpsByCategory(expenses, shipment.kodeOs, [
    'Karantina / Behandle Merah',
  ]);
  const sp2Nominal = sumOpsByCategory(expenses, shipment.kodeOs, [
    'TILA / Eslah / Gate Pass',
    'Handling / THC / Demurrage',
  ]);
  const sptnpNominal = sumOpsByCategory(expenses, shipment.kodeOs, ['SPTNP / Denda']);

  const terimaTglFormatted = formatTanggalIndonesia(shipment.tglTerimaDok);

  const defaultRows: KdiCoverRow[] = KDI_STANDARD_DOCUMENT_ROWS.map((uraian, idx) => {
    const no = idx + 1;
    let ada = false;
    const tidak = false;
    let terimaTgl = '';
    let via = '';
    let keterangan = '';

    switch (no) {
      case 1:
        ada = fillAuto && hasInv;
        if (ada && terimaTglFormatted) terimaTgl = shipment.tglTerimaDok;
        break;
      case 2:
        ada = fillAuto && hasPl;
        if (shipment.noPackinglist?.trim()) {
          keterangan = shipment.noPackinglist.trim();
        }
        if (ada && terimaTglFormatted) terimaTgl = shipment.tglTerimaDok;
        break;
      case 3:
        ada = fillAuto && hasBl;
        if (ada && terimaTglFormatted) terimaTgl = shipment.tglTerimaDok;
        break;
      case 4:
        ada = fillAuto && hasIns;
        break;
      case 6:
        ada = fillAuto && hasCoo;
        if (hasCoo) keterangan = 'COO / SKA';
        break;
      case 11:
        via = brandShort;
        break;
      case 12:
        ada = fillAuto && hasDo;
        via = brandShort;
        keterangan = shipment.doBerlakuSampai
          ? `EXP : ${formatTanggalIndonesia(shipment.doBerlakuSampai)}`
          : 'EXP :';
        break;
      case 13:
        via = brandShort;
        keterangan = formatNominalShort(bhdlNominal);
        break;
      case 14:
        via = brandShort;
        keterangan = formatNominalShort(sp2Nominal);
        break;
      case 15:
        ada = fillAuto && hasSptnp;
        via = brandShort;
        keterangan = formatNominalShort(sptnpNominal);
        break;
      case 16:
        ada = fillAuto && hasTrucking;
        via = shipment.truckingNamaSupir?.trim() || '';
        keterangan = shipment.truckingNoPlat?.trim() || '';
        break;
      case 17:
        keterangan = 'Rp.';
        break;
      case 18:
        ada = fillAuto && hasBc11;
        via = 'PORTAL';
        keterangan = `NO : ${shipment.noBc11?.trim() || ''} , POS : ${options.bc11Pos?.trim() || ''}`.trim();
        break;
      case 19:
        keterangan = `NO : ${options.sealBhdlNo?.trim() || ''}`.trim();
        break;
      default:
        break;
    }

    return {
      no,
      uraian,
      ada,
      tidak,
      terimaTgl,
      via,
      keterangan,
    };
  });

  const rows =
    options.customRows && options.customRows.length > 0
      ? options.customRows
      : defaultRows;

  const supirLine = [shipment.truckingNamaSupir, shipment.truckingNoHpSupir]
    .filter((v) => Boolean(v && v.trim()))
    .join(' / ');

  const manualDokOs = (shipment.kodeManualDokOs || '').trim();
  const subtitleParts = [
    `OS : ${shipment.kodeOs}`,
    manualDokOs ? `DOK. OS : ${manualDokOs}` : '',
    `SHIPMENT : ${shipment.noBl || shipment.kodeCustomer || '-'}`,
  ].filter(Boolean);

  return {
    identity,
    kodeOs: shipment.kodeOs,
    subtitleLine: subtitleParts.join(' | '),
    containerNo: shipment.noCont || '',
    blNo: shipment.noBl || '',
    blTanggal: formatTanggalIndonesia(shipment.tglTerimaDok || shipment.etd),
    shipper: shipment.shipper || '',
    customer: shipment.kodeCustomer
      ? `${shipment.namaCustomer} (${shipment.kodeCustomer})`
      : shipment.namaCustomer || '',
    commodity: shipment.description || '',
    consignee: impMatch?.namaImportir || shipment.namaCustomer || '',
    vessel: vessel || shipment.ship || '',
    voy: voy || '',
    etd: formatTanggalIndonesia(shipment.etd),
    eta: formatTanggalIndonesia(shipment.eta),
    portOfLoading:
      options.portOfLoading !== undefined
        ? options.portOfLoading
        : shipment.negaraAsal || '',
    portOfDischarge:
      options.portOfDischarge !== undefined
        ? options.portOfDischarge
        : 'TANJUNG PRIOK, Indonesia',
    noPengajuanPib: shipment.noAju || '',
    tglPengajuanPib: formatTanggalIndonesia(shipment.tglAju),
    noPib: shipment.nopen || '',
    tglPib: formatTanggalIndonesia(shipment.tglNopen),
    pfpb: shipment.pfpb || '',
    tglPfpb: formatTanggalIndonesia(shipment.tglPfpb),
    pfpd: shipment.pfpd || '',
    tglPfpd: formatTanggalIndonesia(shipment.tglPfpd),
    sptnpNo: shipment.noSptnp || '',
    tglSptnp: formatTanggalIndonesia(shipment.tglSptnp),
    sppbNo: shipment.noSppb || '',
    tglSppb: formatTanggalIndonesia(shipment.tglSppb),
    eslahOleh: shipment.eslah || shipment.doGatePassNomor || '',
    tglEslah: formatTanggalIndonesia(shipment.tglEslah),
    truckingSupir: supirLine,
    nopol: shipment.truckingNoPlat || '',
    rows,
    dokumenCekListBy: shipment.dokumenChecker || '-',
    tanggalCekList: formatTanggalIndonesia(
      shipment.tglTerimaDok || new Date().toISOString().slice(0, 10)
    ),
  };
}
