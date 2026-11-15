import type {
  BillingItem,
  Catatan,
  Customer,
  DokumenItem,
  GatePassJenisType,
  Importir,
  KontainerItem,
  LogPerubahan,
  Pengaturan,
  PhasePermissions,
  SessionUser,
  Shipment,
  Shipper,
  StatusDokumenType,
  StatusDoPelayaranType,
  StatusGateOutType,
  StatusGatePassType,
  StatusPenagihanType,
  StatusSuratJalanType,
  UserAccount,
  UserRole,
} from '../types/ppjk';
import {
  buildAutoBillingFields,
  buildAutoSuratJalanFields,
  calculateBillingTotals,
  calculateCountdownEta,
  canPerformAction,
  canUserEditAnyPhase,
  canUserEditPhase,
  computeSha256Hex,
  createEmptyChecklist,
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_PENGATURAN,
  formatContainerSummary,
  generateNextKodeOS,
  getAllowedFieldsForPermissions,
  isShipmentBillingEligible,
  normalizeGatePassJenis,
  normalizeStatusDokumen,
  normalizeStatusDoPelayaran,
  normalizeStatusGateOut,
  normalizeStatusGatePass,
  normalizeStatusPenagihan,
  normalizeStatusSuratJalan,
  normalizeStatusTrucking,
  resolveUserPhasePermissions,
  validateShipmentInput,
} from '../utils/ppjkLogic';

export interface DatabaseState {
  shipments: Shipment[];
  kontainers: KontainerItem[];
  customers: Customer[];
  importirs: Importir[];
  shippers: Shipper[];
  users: UserAccount[];
  logs: LogPerubahan[];
  catatan: Catatan[];
  dokumen: DokumenItem[];
  pengaturan: Pengaturan;
}

const DB_STORAGE_KEY = 'PTG_PPJK_DB_V1';
const SESSION_STORAGE_KEY = 'PTG_PPJK_SESSION_V1';

const VALID_ROLES: UserRole[] = [
  'Admin',
  'Checker',
  'Drafter',
  'Dokumen/Checker',
  'Operasional',
  'Manajer',
];

function formatDateOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function createSeedUsers(): Promise<UserAccount[]> {
  const mkUser = async (
    username: string,
    pass: string,
    nama: string,
    role: UserRole,
    mustChangePassword = false
  ): Promise<UserAccount> => {
    const salt = `ptg_${username}_salt2026`;
    const passwordHash = await computeSha256Hex(`${salt}:${pass}`);
    return {
      username,
      passwordHash,
      salt,
      nama,
      role,
      aktif: true,
      mustChangePassword,
      phasePermissions: resolveUserPhasePermissions(role),
    };
  };

  return Promise.all([
    mkUser('admin', 'Admin123!', 'Hendra Wijaya (Admin)', 'Admin', false),
    mkUser('checker1', 'Checker123!', 'Rina Kusuma (Checker)', 'Checker', false),
    mkUser('checker2', 'Checker123!', 'Dewi Lestari (Checker)', 'Checker', false),
    mkUser('drafter1', 'Drafter123!', 'Andi Pratama (Drafter)', 'Drafter', false),
    mkUser('ops1', 'Ops123!', 'Budi Santoso (Operasional)', 'Operasional', false),
    mkUser('manajer1', 'Manajer123!', 'Siti Rahayu (Manajer)', 'Manajer', false),
  ]);
}

function createSeedDatabase(users: UserAccount[]): DatabaseState {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const monthKey = `${yy}${mm}`;

  const fullDone = createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS);
  for (const item of DEFAULT_CHECKLIST_ITEMS) fullDone.items[item] = true;
  fullDone.catatan = 'Seluruh dokumen asli & copy lengkap.';

  const partialChk = createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS);
  partialChk.items['Bill of Lading (BL)'] = true;
  partialChk.items['Commercial Invoice'] = true;
  partialChk.items['Packing List'] = true;
  partialChk.catatan = 'Menunggu asli COO dari shipper.';

  const kontainers: KontainerItem[] = [
    { id: 'k1', kodeOs: `OS-${monthKey}-0001`, noCont: 'EGHU9012345', ukuranTipe: '40HC' },
    { id: 'k2', kodeOs: `OS-${monthKey}-0001`, noCont: 'EGHU9012346', ukuranTipe: '40HC' },
    { id: 'k3', kodeOs: `OS-${monthKey}-0002`, noCont: 'MSCU4455661', ukuranTipe: '20FT' },
    { id: 'k4', kodeOs: `OS-${monthKey}-0003`, noCont: 'CMAU7788990', ukuranTipe: '40GP' },
    { id: 'k5', kodeOs: `OS-${monthKey}-0004`, noCont: 'OOLU3322114', ukuranTipe: '40HC' },
    { id: 'k6', kodeOs: `OS-${monthKey}-0005`, noCont: 'TEMU5566778', ukuranTipe: '20FT' },
    { id: 'k7', kodeOs: `OS-${monthKey}-0006`, noCont: 'HLXU7744112', ukuranTipe: '40HC' },
    { id: 'k8', kodeOs: `OS-${monthKey}-0007`, noCont: 'ONEU8833220', ukuranTipe: '40GP' },
  ];

  const baseShipments: Shipment[] = [
    {
      kodeOs: `OS-${monthKey}-0001`,
      ship: 'MV EVER FORTUNE V.042',
      kodeCustomer: 'CUST-001',
      namaCustomer: 'PT Nusantara Baja Mandiri',
      tglTerimaDok: formatDateOffset(-6),
      terimaDok: fullDone,
      noPackinglist: 'PL-NBM-2611-01',
      noBl: 'EGLV142600891234',
      statusDokumen: 'Draft',
      etd: formatDateOffset(-9),
      eta: formatDateOffset(2),
      countDownEta: 2,
      noCont: 'EGHU9012345 (40HC), EGHU9012346 (40HC)',
      doPelayaranStatus: 'Belum',
      doBerlakuSampai: '',
      doCatatanPerpanjangan: 'Menunggu kedatangan kapal & penebusan D/O Evergreen.',
      doGatePassStatus: 'Belum',
      doGatePassJenis: '',
      doGatePassNomor: '',
      truckingStatus: 'Belum',
      truckingNamaSupir: '',
      truckingNoPlat: '',
      truckingNoHpSupir: '',
      gateOutStatus: 'Belum',
      gateOutTanggal: '',
      gateOutCatatan: '',
      noAju: '',
      tglAju: '',
      status: 'Dokumen Diterima',
      nopen: '',
      tglNopen: '',
      jalur: '',
      kodeImportir: 'IMP-001',
      shipper: 'Baosteel International Co., Ltd',
      description: 'Cold Rolled Steel Coils',
      negaraAsal: 'China',
      currency: 'USD',
      kurs: 15850,
      invoice: 68400,
      bmPdri: 'Rp 142.500.000',
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
      dokumenOs: createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS),
      createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
      createdBy: 'checker1',
      updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      updatedBy: 'checker1',
    },
    {
      kodeOs: `OS-${monthKey}-0002`,
      ship: 'MSC OSCAR V.118S',
      kodeCustomer: 'CUST-002',
      namaCustomer: 'PT Karya Elektro Indonesia',
      tglTerimaDok: formatDateOffset(-10),
      terimaDok: fullDone,
      noPackinglist: 'PL-KEI-882',
      noBl: 'MSCUJK8829102',
      statusDokumen: 'Ready',
      etd: formatDateOffset(-14),
      eta: formatDateOffset(-1),
      countDownEta: -1,
      noCont: 'MSCU4455661 (20FT)',
      doPelayaranStatus: 'Belum',
      doBerlakuSampai: formatDateOffset(-1),
      doCatatanPerpanjangan: 'Free time pelayaran habis; wajib ajukan perpanjangan D/O MSC setelah jalur merah selesai.',
      doGatePassStatus: 'Proses',
      doGatePassJenis: 'Eslah',
      doGatePassNomor: 'ESLAH-KOJA-261102',
      truckingStatus: 'Belum',
      truckingNamaSupir: '',
      truckingNoPlat: '',
      truckingNoHpSupir: '',
      gateOutStatus: 'Belum',
      gateOutTanggal: '',
      gateOutCatatan: '',
      noAju: '000020-010234-20261110-001122',
      tglAju: formatDateOffset(-3),
      status: 'Proses Pemeriksaan',
      nopen: '448120',
      tglNopen: formatDateOffset(-2),
      jalur: 'Merah',
      kodeImportir: 'IMP-002',
      shipper: 'Shenzhen Techtronics Ltd',
      description: 'Industrial Control Modules & PLC',
      negaraAsal: 'China',
      currency: 'USD',
      kurs: 15850,
      invoice: 42150,
      bmPdri: 'Rp 89.200.000',
      sptnp: 'Proses Verifikasi',
      noSppb: '',
      tglSppb: '',
      dokumenChecker: 'Rina Kusuma',
      noSptnp: '',
      tglSptnp: '',
      pfpb: 'PFPB-2026-119',
      tglPfpb: formatDateOffset(-1),
      pfpd: '',
      tglPfpd: '',
      eslah: '',
      tglEslah: '',
      dokumenOs: partialChk,
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      createdBy: 'checker1',
      updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      updatedBy: 'ops1',
    },
    {
      kodeOs: `OS-${monthKey}-0003`,
      ship: 'CMA CGM MARCO POLO',
      kodeCustomer: 'CUST-003',
      namaCustomer: 'CV Prima Kimia Sentosa',
      tglTerimaDok: formatDateOffset(-5),
      terimaDok: partialChk,
      noPackinglist: 'PL-PKS-309',
      noBl: 'CMASH9921044',
      statusDokumen: 'Ready',
      etd: formatDateOffset(-8),
      eta: formatDateOffset(5),
      countDownEta: 5,
      noCont: 'CMAU7788990 (40GP)',
      doPelayaranStatus: 'Belum',
      doBerlakuSampai: '',
      doCatatanPerpanjangan: '',
      doGatePassStatus: 'Belum',
      doGatePassJenis: '',
      doGatePassNomor: '',
      truckingStatus: 'Belum',
      truckingNamaSupir: '',
      truckingNoPlat: '',
      truckingNoHpSupir: '',
      gateOutStatus: 'Belum',
      gateOutTanggal: '',
      gateOutCatatan: '',
      noAju: '000020-010234-20261112-004411',
      tglAju: formatDateOffset(-1),
      status: 'Menunggu Jalur',
      nopen: '449012',
      tglNopen: formatDateOffset(-1),
      jalur: 'Kuning',
      kodeImportir: 'IMP-003',
      shipper: 'Formosa Polymer Corp',
      description: 'Polyethylene Resin Pellets',
      negaraAsal: 'Taiwan',
      currency: 'USD',
      kurs: 15840,
      invoice: 31800,
      bmPdri: 'Rp 52.100.000',
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
      dokumenOs: partialChk,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      createdBy: 'admin',
      updatedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      updatedBy: 'ops1',
    },
    {
      kodeOs: `OS-${monthKey}-0004`,
      ship: 'OOCL JAKARTA V.081',
      kodeCustomer: 'CUST-001',
      namaCustomer: 'PT Nusantara Baja Mandiri',
      tglTerimaDok: formatDateOffset(-4),
      terimaDok: fullDone,
      noPackinglist: 'PL-NBM-2611-04',
      noBl: 'OOLU2689112004',
      statusDokumen: 'Ready',
      etd: formatDateOffset(-6),
      eta: formatDateOffset(10),
      countDownEta: 10,
      noCont: 'OOLU3322114 (40HC)',
      doPelayaranStatus: 'Belum',
      doBerlakuSampai: formatDateOffset(2),
      doCatatanPerpanjangan: 'SPPB sudah terbit; menunggu telex release & pelunasan biaya D/O OOCL.',
      doGatePassStatus: 'Proses',
      doGatePassJenis: 'TILA (Kartu Gate)',
      doGatePassNomor: 'TILA-JICT-261104',
      truckingStatus: 'Sedia',
      truckingNamaSupir: 'Agus Setiawan',
      truckingNoPlat: 'B 9412 UIX',
      truckingNoHpSupir: '0812-8841-2094',
      gateOutStatus: 'Belum',
      gateOutTanggal: '',
      gateOutCatatan: 'Menunggu D/O OOCL & TILA JICT selesai sebelum gate-out.',
      noAju: '000020-010234-20261111-002290',
      tglAju: formatDateOffset(-2),
      status: 'SPPB Terbit',
      nopen: '448905',
      tglNopen: formatDateOffset(-2),
      jalur: 'MITA',
      kodeImportir: 'IMP-001',
      shipper: 'Nippon Steel Trading',
      description: 'Galvanized Steel Sheets',
      negaraAsal: 'Jepang',
      currency: 'JPY',
      kurs: 104,
      invoice: 8500000,
      bmPdri: 'Rp 118.400.000',
      sptnp: 'Tidak',
      noSppb: 'SPPB-040200/2026/11920',
      tglSppb: formatDateOffset(-1),
      dokumenChecker: 'Rina Kusuma',
      noSptnp: '',
      tglSptnp: '',
      pfpb: '',
      tglPfpb: '',
      pfpd: '',
      tglPfpd: '',
      eslah: '',
      tglEslah: '',
      dokumenOs: partialChk,
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      createdBy: 'checker1',
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      updatedBy: 'ops1',
    },
    {
      kodeOs: `OS-${monthKey}-0005`,
      ship: 'MAERSK RUBICON V.214',
      kodeCustomer: 'CUST-004',
      namaCustomer: 'PT Agro Pangan Sejahtera',
      tglTerimaDok: formatDateOffset(-15),
      terimaDok: fullDone,
      noPackinglist: 'PL-APS-112',
      noBl: 'MAEU99100231',
      statusDokumen: 'Ready',
      etd: formatDateOffset(-20),
      eta: formatDateOffset(-5),
      countDownEta: -5,
      noCont: 'TEMU5566778 (20FT)',
      doPelayaranStatus: 'Sedia',
      doBerlakuSampai: formatDateOffset(-6),
      doCatatanPerpanjangan: 'D/O awal Maersk sedia, kontainer sudah keluar pelabuhan.',
      doGatePassStatus: 'Sedia',
      doGatePassJenis: 'TILA (Kartu Gate)',
      doGatePassNomor: 'TILA-TPK-261105',
      truckingStatus: 'Sedia',
      truckingNamaSupir: 'Dedi Kurniawan',
      truckingNoPlat: 'B 9088 TEU',
      truckingNoHpSupir: '0813-7720-4511',
      gateOutStatus: 'Sudah',
      gateOutTanggal: formatDateOffset(-4),
      gateOutCatatan: 'Kontainer keluar gate TPK Koja & dokumen OS selesai.',
      suratJalanNomor: `SJ-${monthKey}-0005`,
      suratJalanTanggal: formatDateOffset(-4),
      suratJalanStatus: 'Tiba di Tujuan',
      suratJalanTujuan: 'Gudang PT Agro Pangan Sejahtera — Kawasan Industri Jababeka, Cikarang',
      suratJalanPenerima: 'Hendra (Kepala Gudang)',
      suratJalanCatatan: 'Kontainer TEMU5566778 tiba di gudang dalam kondisi segel utuh.',
      suratJalanUpdatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      billingStatus: 'Terkirim ke Customer',
      billingNomor: `INV-${monthKey}-0005`,
      billingTanggal: formatDateOffset(-4),
      billingJatuhTempo: formatDateOffset(10),
      billingPpnPersen: 11,
      billingTotal: 7770000,
      billingOwnerNotifiedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      billingOwnerNotifiedVia: 'WhatsApp',
      billingOwnerNotifiedBy: 'ops1',
      billingCustomerSentAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      billingCustomerSentVia: 'Email',
      billingCreatedBy: 'Hendra Wijaya (Admin)',
      billingCatatan: 'Surat Penagihan diterbitkan otomatis setelah Gate-Out & dikirim ke Finance PT Agro Pangan Sejahtera.',
      noAju: '000020-010234-20261102-000811',
      tglAju: formatDateOffset(-10),
      status: 'Selesai',
      nopen: '441203',
      tglNopen: formatDateOffset(-9),
      jalur: 'Hijau',
      kodeImportir: 'IMP-004',
      shipper: 'Bangkok Agri Export Co',
      description: 'Food Processing Machinery Parts',
      negaraAsal: 'Thailand',
      currency: 'USD',
      kurs: 15820,
      invoice: 19500,
      bmPdri: 'Rp 28.900.000',
      sptnp: 'Tidak',
      noSppb: 'SPPB-040200/2026/11004',
      tglSppb: formatDateOffset(-7),
      dokumenChecker: 'Hendra Wijaya',
      noSptnp: '',
      tglSptnp: '',
      pfpb: '',
      tglPfpb: '',
      pfpd: '',
      tglPfpd: '',
      eslah: '',
      tglEslah: '',
      dokumenOs: fullDone,
      createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
      createdBy: 'admin',
      updatedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      updatedBy: 'checker1',
    },
    {
      kodeOs: `OS-${monthKey}-0006`,
      ship: 'HAPAG EXPRESS V.309',
      kodeCustomer: 'CUST-002',
      namaCustomer: 'PT Karya Elektro Indonesia',
      tglTerimaDok: formatDateOffset(-3),
      terimaDok: fullDone,
      noPackinglist: 'PL-KEI-901',
      noBl: 'HLCUJK26110901',
      statusDokumen: 'Draft',
      etd: formatDateOffset(-6),
      eta: formatDateOffset(4),
      countDownEta: 4,
      noCont: 'HLXU7744112 (40HC)',
      bc11Terbit: true,
      noBc11: '004819',
      tglBc11: formatDateOffset(0),
      doPelayaranStatus: 'Belum',
      doBerlakuSampai: formatDateOffset(5),
      doCatatanPerpanjangan: 'BC 1.1 terbit, konfirmasi tagihan D/O Hapag-Lloyd.',
      doGatePassStatus: 'Belum',
      doGatePassJenis: 'Eslah & TILA',
      doGatePassNomor: '',
      truckingStatus: 'Belum',
      truckingNamaSupir: '',
      truckingNoPlat: '',
      truckingNoHpSupir: '',
      gateOutStatus: 'Belum',
      gateOutTanggal: '',
      gateOutCatatan: '',
      noAju: '000020-010234-20261113-005501',
      tglAju: formatDateOffset(0),
      status: 'Proses PIB/AJU',
      nopen: '',
      tglNopen: '',
      jalur: '',
      kodeImportir: 'IMP-002',
      shipper: 'Shenzhen Techtronics Ltd',
      description: 'Servo Drives & Inverters',
      negaraAsal: 'China',
      currency: 'USD',
      kurs: 15850,
      invoice: 27400,
      bmPdri: 'Rp 48.300.000',
      sptnp: 'Tidak',
      noSppb: '',
      tglSppb: '',
      dokumenChecker: 'Dewi Lestari',
      noSptnp: '',
      tglSptnp: '',
      pfpb: '',
      tglPfpb: '',
      pfpd: '',
      tglPfpd: '',
      eslah: '',
      tglEslah: '',
      dokumenOs: createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS),
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      createdBy: 'checker2',
      updatedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
      updatedBy: 'checker2',
    },
    {
      kodeOs: `OS-${monthKey}-0007`,
      ship: 'ONE HARMONY V.019E',
      kodeCustomer: 'CUST-003',
      namaCustomer: 'CV Prima Kimia Sentosa',
      tglTerimaDok: formatDateOffset(-12),
      terimaDok: fullDone,
      noPackinglist: 'PL-PKS-318',
      noBl: 'ONEYJKT26110318',
      statusDokumen: 'Ready',
      etd: formatDateOffset(-16),
      eta: formatDateOffset(-2),
      countDownEta: -2,
      noCont: 'ONEU8833220 (40GP)',
      doPelayaranStatus: 'Sedia',
      doBerlakuSampai: formatDateOffset(1),
      doCatatanPerpanjangan: 'Perpanjangan D/O ke-1 aktif dari pelayaran ONE; jadwalkan trucking keluar hari ini.',
      doGatePassStatus: 'Sedia',
      doGatePassJenis: 'Eslah & TILA',
      doGatePassNomor: 'TILA-NPCT1-261107',
      truckingStatus: 'Sedia',
      truckingNamaSupir: 'Slamet Riyadi',
      truckingNoPlat: 'B 9721 BEV',
      truckingNoHpSupir: '0811-9034-8821',
      gateOutStatus: 'Belum',
      gateOutTanggal: '',
      gateOutCatatan: 'D/O, TILA NPCT1 & Trucking siap; tinggal proses Gate-Out hari ini.',
      noAju: '000020-010234-20261105-001890',
      tglAju: formatDateOffset(-8),
      status: 'Pasca-SPPB',
      nopen: '445109',
      tglNopen: formatDateOffset(-7),
      jalur: 'Hijau',
      kodeImportir: 'IMP-003',
      shipper: 'Formosa Polymer Corp',
      description: 'Additives & Plasticizer Drums',
      negaraAsal: 'Taiwan',
      currency: 'USD',
      kurs: 15840,
      invoice: 36200,
      bmPdri: 'Rp 61.750.000',
      sptnp: 'Tidak',
      noSppb: 'SPPB-040200/2026/11488',
      tglSppb: formatDateOffset(-4),
      dokumenChecker: 'Dewi Lestari',
      noSptnp: '',
      tglSptnp: '',
      pfpb: '',
      tglPfpb: '',
      pfpd: 'PFPD-2026-082',
      tglPfpd: formatDateOffset(-3),
      eslah: '',
      tglEslah: '',
      dokumenOs: partialChk,
      createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
      createdBy: 'checker2',
      updatedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
      updatedBy: 'checker2',
    },
  ];

  return {
    shipments: baseShipments,
    kontainers,
    customers: [
      { kodeCustomer: 'CUST-001', namaCustomer: 'PT Nusantara Baja Mandiri', kontak: '021-5590-1122 / import@nusantarabaja.co.id' },
      { kodeCustomer: 'CUST-002', namaCustomer: 'PT Karya Elektro Indonesia', kontak: '021-8871-4430 / logistik@karyaelektro.id' },
      { kodeCustomer: 'CUST-003', namaCustomer: 'CV Prima Kimia Sentosa', kontak: '031-7402-991 / supply@primakimia.co.id' },
      { kodeCustomer: 'CUST-004', namaCustomer: 'PT Agro Pangan Sejahtera', kontak: '021-6502-8812 / proc@agropangan.co.id' },
    ],
    importirs: [
      { kodeImportir: 'IMP-001', namaImportir: 'PT Nusantara Baja Mandiri (API-U)' },
      { kodeImportir: 'IMP-002', namaImportir: 'PT Karya Elektro Indonesia (API-P)' },
      { kodeImportir: 'IMP-003', namaImportir: 'CV Prima Kimia Sentosa (API-U)' },
      { kodeImportir: 'IMP-004', namaImportir: 'PT Agro Pangan Sejahtera (API-P)' },
    ],
    shippers: [
      { namaShipper: 'Baosteel International Co., Ltd', negara: 'China' },
      { namaShipper: 'Shenzhen Techtronics Ltd', negara: 'China' },
      { namaShipper: 'Formosa Polymer Corp', negara: 'Taiwan' },
      { namaShipper: 'Nippon Steel Trading', negara: 'Jepang' },
      { namaShipper: 'Bangkok Agri Export Co', negara: 'Thailand' },
    ],
    users,
    logs: [
      {
        id: 'log-1',
        waktu: new Date(Date.now() - 3600000 * 4).toISOString(),
        user: 'ops1',
        kodeOs: `OS-${monthKey}-0002`,
        kolom: 'jalur',
        nilaiLama: 'Menunggu',
        nilaiBaru: 'Merah',
      },
      {
        id: 'log-2',
        waktu: new Date(Date.now() - 3600000 * 2).toISOString(),
        user: 'ops1',
        kodeOs: `OS-${monthKey}-0004`,
        kolom: 'noSppb',
        nilaiLama: '',
        nilaiBaru: 'SPPB-040200/2026/11920',
      },
    ],
    catatan: [
      {
        id: 'cat-1',
        kodeOs: `OS-${monthKey}-0001`,
        waktu: new Date(Date.now() - 3600000 * 5).toISOString(),
        user: 'Rina Kusuma (checker1)',
        isi: 'Menunggu konfirmasi HS Code akhir dari tim teknis customer sebelum submit PIB.',
      },
      {
        id: 'cat-2',
        kodeOs: `OS-${monthKey}-0002`,
        waktu: new Date(Date.now() - 3600000 * 3).toISOString(),
        user: 'Budi Santoso (ops1)',
        isi: 'Jadwal pemeriksaan fisik (behandle) di TPS Koja besok pukul 09:00 WIB.',
      },
    ],
    dokumen: [
      {
        id: 'doc-1',
        kodeOs: `OS-${monthKey}-0001`,
        jenisDokumen: 'Bill of Lading (BL)',
        namaFile: 'BL_EGLV142600891234.pdf',
        linkDrive: `https://drive.google.com/drive/folders/PTG_PPJK_DOKUMEN_ROOT`,
        waktuUpload: new Date(Date.now() - 86400000 * 5).toISOString(),
        user: 'checker1',
      },
      {
        id: 'doc-2',
        kodeOs: `OS-${monthKey}-0004`,
        jenisDokumen: 'SPPB Resmi Bea Cukai',
        namaFile: 'SPPB_11920_MITA.pdf',
        linkDrive: `https://drive.google.com/drive/folders/PTG_PPJK_DOKUMEN_ROOT`,
        waktuUpload: new Date(Date.now() - 3600000 * 2).toISOString(),
        user: 'ops1',
      },
    ],
    pengaturan: {
      ...DEFAULT_PENGATURAN,
      seqByMonth: { [monthKey]: 7 },
    },
  };
}

function readDbFromStorage(): DatabaseState | null {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DatabaseState;
  } catch {
    return null;
  }
}

function writeDbToStorage(db: DatabaseState): void {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}

export async function ensureDbInitialized(): Promise<DatabaseState> {
  const existing = readDbFromStorage();
  if (existing && Array.isArray(existing.users) && existing.users.length > 0) {
    let changed = false;
    if (!existing.users.some((u) => u.username.toLowerCase() === 'drafter1')) {
      const salt = 'ptg_drafter1_salt2026';
      const passwordHash = await computeSha256Hex(`${salt}:Drafter123!`);
      existing.users.push({
        username: 'drafter1',
        passwordHash,
        salt,
        nama: 'Andi Pratama (Drafter)',
        role: 'Drafter',
        aktif: true,
        mustChangePassword: false,
        phasePermissions: resolveUserPhasePermissions('Drafter'),
      });
      changed = true;
    }
    for (const u of existing.users) {
      if (
        !u.phasePermissions ||
        typeof u.phasePermissions.phase1 !== 'boolean' ||
        typeof u.phasePermissions.phase2 !== 'boolean' ||
        typeof u.phasePermissions.phase3 !== 'boolean' ||
        typeof u.phasePermissions.phase4 !== 'boolean'
      ) {
        u.phasePermissions = resolveUserPhasePermissions(u.role, u.phasePermissions);
        changed = true;
      }
    }
    if (!existing.pengaturan.ownerWhatsapp || !existing.pengaturan.ownerEmail || !existing.pengaturan.billingBankInfo) {
      existing.pengaturan = {
        ...DEFAULT_PENGATURAN,
        ...existing.pengaturan,
        ownerName: existing.pengaturan.ownerName || DEFAULT_PENGATURAN.ownerName,
        ownerWhatsapp: existing.pengaturan.ownerWhatsapp || DEFAULT_PENGATURAN.ownerWhatsapp,
        ownerEmail: existing.pengaturan.ownerEmail || DEFAULT_PENGATURAN.ownerEmail,
        adminName: existing.pengaturan.adminName || DEFAULT_PENGATURAN.adminName,
        adminWhatsapp: existing.pengaturan.adminWhatsapp || DEFAULT_PENGATURAN.adminWhatsapp,
        adminEmail: existing.pengaturan.adminEmail || DEFAULT_PENGATURAN.adminEmail,
        billingBankInfo: existing.pengaturan.billingBankInfo || DEFAULT_PENGATURAN.billingBankInfo,
      };
      changed = true;
    }
    if (changed) {
      writeDbToStorage(existing);
    }
    // Recalculate dynamic countdown ETA and normalize statusDokumen/D/O/Surat Jalan/Billing fields on read
    existing.shipments = existing.shipments.map((s) => {
      const normalizedGateOut = normalizeStatusGateOut(s.gateOutStatus, s.status);
      const sjPatch =
        normalizedGateOut === 'Sudah'
          ? buildAutoSuratJalanFields(s, s.gateOutTanggal || formatDateOffset(0), s.updatedAt)
          : {
              suratJalanNomor: s.suratJalanNomor || '',
              suratJalanTanggal: s.suratJalanTanggal || '',
              suratJalanStatus: normalizeStatusSuratJalan(s.suratJalanStatus, normalizedGateOut, s.status),
              suratJalanTujuan: s.suratJalanTujuan || '',
              suratJalanUpdatedAt: s.suratJalanUpdatedAt || '',
            };
      const normalizedBase: Shipment = {
        ...s,
        statusDokumen: normalizeStatusDokumen(s.statusDokumen),
        doPelayaranStatus: normalizeStatusDoPelayaran(s.doPelayaranStatus),
        doGatePassStatus: normalizeStatusGatePass(s.doGatePassStatus),
        doGatePassJenis: normalizeGatePassJenis(s.doGatePassJenis),
        truckingStatus: normalizeStatusTrucking(s.truckingStatus),
        gateOutStatus: normalizedGateOut,
        ...sjPatch,
        countDownEta: calculateCountdownEta(s.eta),
      };
      if (isShipmentBillingEligible(normalizedBase)) {
        const autoBill = buildAutoBillingFields(normalizedBase, formatDateOffset(0));
        return {
          ...normalizedBase,
          ...autoBill,
        };
      }
      return {
        ...normalizedBase,
        billingStatus: normalizeStatusPenagihan(s.billingStatus, normalizedBase),
      };
    });
    return existing;
  }
  const users = await createSeedUsers();
  const seeded = createSeedDatabase(users);
  writeDbToStorage(seeded);
  return seeded;
}

function assertSessionActive(db: DatabaseState, session: SessionUser): UserAccount {
  const found = db.users.find(
    (u) => u.username.toLowerCase() === session.username.toLowerCase()
  );
  if (!found || !found.aktif) {
    throw new Error('Akun Anda dinonaktifkan atau tidak ditemukan. Hubungi Admin.');
  }
  return found;
}

export async function syncSessionWithDb(
  session: SessionUser
): Promise<SessionUser | null> {
  const db = await ensureDbInitialized();
  const found = db.users.find(
    (u) => u.username.toLowerCase() === session.username.toLowerCase()
  );
  if (!found || !found.aktif) {
    saveStoredSession(null);
    return null;
  }
  const synced: SessionUser = {
    ...session,
    nama: found.nama,
    role: found.role,
    mustChangePassword: Boolean(found.mustChangePassword),
    phasePermissions: resolveUserPhasePermissions(found.role, found.phasePermissions),
  };
  saveStoredSession(synced);
  return synced;
}

export async function resetDatabase(mode: 'empty' | 'seed'): Promise<DatabaseState> {
  const users = await createSeedUsers();
  if (mode === 'seed') {
    const seeded = createSeedDatabase(users);
    writeDbToStorage(seeded);
    return seeded;
  }
  const emptyDb: DatabaseState = {
    shipments: [],
    kontainers: [],
    customers: [],
    importirs: [],
    shippers: [],
    users,
    logs: [],
    catatan: [],
    dokumen: [],
    pengaturan: { ...DEFAULT_PENGATURAN, seqByMonth: {} },
  };
  writeDbToStorage(emptyDb);
  return emptyDb;
}

export function getStoredSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: SessionUser | null): void {
  try {
    if (!session) localStorage.removeItem(SESSION_STORAGE_KEY);
    else localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<SessionUser> {
  const db = await ensureDbInitialized();
  const u = db.users.find(
    (item) => item.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (!u) throw new Error('Username atau password salah.');
  if (!u.aktif) throw new Error('Akun tidak aktif. Hubungi Admin.');

  const hash = await computeSha256Hex(`${u.salt}:${password}`);
  if (hash !== u.passwordHash) {
    throw new Error('Username atau password salah.');
  }

  const session: SessionUser = {
    token: `tok_${Math.random().toString(36).slice(2)}_${Date.now()}`,
    username: u.username,
    nama: u.nama,
    role: u.role,
    mustChangePassword: Boolean(u.mustChangePassword),
    expiresAt: Date.now() + 6 * 3600 * 1000,
    phasePermissions: resolveUserPhasePermissions(u.role, u.phasePermissions),
  };
  saveStoredSession(session);
  return session;
}

export async function changeUserPassword(
  session: SessionUser,
  oldPass: string,
  newPass: string
): Promise<SessionUser> {
  if (newPass.length < 6) throw new Error('Password baru minimal 6 karakter.');
  const db = await ensureDbInitialized();
  const idx = db.users.findIndex((u) => u.username === session.username);
  if (idx === -1) throw new Error('User tidak ditemukan.');

  const user = db.users[idx];
  const oldHash = await computeSha256Hex(`${user.salt}:${oldPass}`);
  if (oldHash !== user.passwordHash) {
    throw new Error('Password lama tidak sesuai.');
  }
  const newSalt = `salt_${Date.now()}`;
  const newHash = await computeSha256Hex(`${newSalt}:${newPass}`);
  db.users[idx] = {
    ...user,
    salt: newSalt,
    passwordHash: newHash,
    mustChangePassword: false,
  };
  writeDbToStorage(db);

  const updatedSession: SessionUser = { ...session, mustChangePassword: false };
  saveStoredSession(updatedSession);
  return updatedSession;
}

export async function saveShipmentRecord(
  session: SessionUser,
  input: Shipment,
  containers: KontainerItem[],
  isNew: boolean
): Promise<{ db: DatabaseState; saved: Shipment }> {
  const db = await ensureDbInitialized();
  const activeUser = assertSessionActive(db, session);
  const activePerms = resolveUserPhasePermissions(
    activeUser.role,
    activeUser.phasePermissions
  );

  if (isNew && !canPerformAction(activeUser.role, 'create_shipment')) {
    throw new Error('Akses ditolak: Anda tidak memiliki hak membuat shipment baru.');
  }
  if (!isNew && !canUserEditAnyPhase({ role: activeUser.role, phasePermissions: activePerms })) {
    throw new Error('Akses ditolak: Tidak ada fase edit yang diaktifkan Admin untuk akun Anda.');
  }

  const validation = validateShipmentInput(input);
  if (!validation.valid) {
    const firstMsg = Object.values(validation.errors)[0];
    throw new Error(firstMsg || 'Data shipment belum valid.');
  }

  const nowIso = new Date().toISOString();
  let kodeOs = input.kodeOs;
  let merged: Shipment = { ...input };
  let effectiveContainers = containers;

  if (isNew) {
    const seq = generateNextKodeOS(db.pengaturan.seqByMonth);
    kodeOs = seq.kodeOs;
    db.pengaturan.seqByMonth[seq.monthKey] = seq.nextSeq;
    merged.kodeOs = kodeOs;
    merged.createdAt = nowIso;
    merged.createdBy = activeUser.username;
  } else {
    const oldIdx = db.shipments.findIndex((s) => s.kodeOs === kodeOs);
    if (oldIdx === -1) throw new Error(`Shipment ${kodeOs} tidak ditemukan.`);
    const old = db.shipments[oldIdx];

    // Server-side RBAC berdasarkan pengaturan toggle fase manual dari Admin per user:
    const allowedFields = getAllowedFieldsForPermissions(activePerms);
    const restrictedMerged: Shipment = { ...old };
    for (const field of allowedFields) {
      (restrictedMerged as unknown as Record<string, unknown>)[field] = (
        merged as unknown as Record<string, unknown>
      )[field];
    }
    merged = restrictedMerged;
    if (!activePerms.phase2) {
      effectiveContainers = db.kontainers.filter((k) => k.kodeOs === kodeOs);
    }

    // Catat riwayat perubahan untuk tiap kolom yang berubah
    const ignored = new Set(['countDownEta', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy']);
    for (const key of Object.keys(merged) as Array<keyof Shipment>) {
      if (ignored.has(key)) continue;
      const oldVal =
        typeof old[key] === 'object' ? JSON.stringify(old[key]) : String(old[key] ?? '');
      const newVal =
        typeof merged[key] === 'object' ? JSON.stringify(merged[key]) : String(merged[key] ?? '');
      if (oldVal !== newVal) {
        db.logs.unshift({
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          waktu: nowIso,
          user: session.username,
          kodeOs,
          kolom: key,
          nilaiLama: oldVal,
          nilaiBaru: newVal,
        });
      }
    }
  }

  const validContainers = effectiveContainers
    .filter((c) => c.noCont.trim() !== '')
    .map((c, idx) => ({
      ...c,
      id: c.id || `${kodeOs}_c${idx}_${Date.now()}`,
      kodeOs,
    }));

  merged.noCont = formatContainerSummary(validContainers);
  merged.statusDokumen = normalizeStatusDokumen(merged.statusDokumen);
  merged.doPelayaranStatus = normalizeStatusDoPelayaran(merged.doPelayaranStatus);
  merged.doGatePassStatus = normalizeStatusGatePass(merged.doGatePassStatus);
  merged.doGatePassJenis = normalizeGatePassJenis(merged.doGatePassJenis);
  merged.truckingStatus = normalizeStatusTrucking(merged.truckingStatus);
  merged.gateOutStatus = normalizeStatusGateOut(merged.gateOutStatus, merged.status);
  if (merged.gateOutStatus === 'Sudah') {
    if (!merged.gateOutTanggal) {
      merged.gateOutTanggal = nowIso.slice(0, 10);
    }
    const autoSj = buildAutoSuratJalanFields(merged, merged.gateOutTanggal, nowIso);
    merged.suratJalanNomor = autoSj.suratJalanNomor;
    merged.suratJalanTanggal = autoSj.suratJalanTanggal;
    merged.suratJalanStatus = autoSj.suratJalanStatus;
    merged.suratJalanTujuan = autoSj.suratJalanTujuan;
    merged.suratJalanUpdatedAt = autoSj.suratJalanUpdatedAt;
  } else {
    merged.suratJalanStatus = normalizeStatusSuratJalan(
      merged.suratJalanStatus,
      merged.gateOutStatus,
      merged.status
    );
  }
  merged.countDownEta = calculateCountdownEta(merged.eta);
  if (isShipmentBillingEligible(merged)) {
    const autoBill = buildAutoBillingFields(merged, nowIso.slice(0, 10));
    merged.billingStatus = autoBill.billingStatus;
    merged.billingNomor = autoBill.billingNomor;
    merged.billingTanggal = autoBill.billingTanggal;
    merged.billingJatuhTempo = autoBill.billingJatuhTempo;
    merged.billingItems = autoBill.billingItems;
    merged.billingPpnPersen = autoBill.billingPpnPersen;
    merged.billingTotal = autoBill.billingTotal;
  } else {
    merged.billingStatus = normalizeStatusPenagihan(merged.billingStatus, merged);
  }
  merged.updatedAt = nowIso;
  merged.updatedBy = session.username;

  if (isNew) {
    db.shipments.unshift(merged);
    db.logs.unshift({
      id: `log_${Date.now()}`,
      waktu: nowIso,
      user: session.username,
      kodeOs,
      kolom: 'CREATE',
      nilaiLama: '-',
      nilaiBaru: `Shipment dibuat (BL: ${merged.noBl})`,
    });
  } else {
    const idx = db.shipments.findIndex((s) => s.kodeOs === kodeOs);
    db.shipments[idx] = merged;
  }

  db.kontainers = [
    ...db.kontainers.filter((k) => k.kodeOs !== kodeOs),
    ...validContainers,
  ];

  writeDbToStorage(db);
  return { db, saved: merged };
}

export async function updateShipmentStatusDokumen(
  session: SessionUser,
  kodeOs: string,
  nextStatus: StatusDokumenType
): Promise<DatabaseState> {
  const db = await ensureDbInitialized();
  const activeUser = assertSessionActive(db, session);
  const activePerms = resolveUserPhasePermissions(
    activeUser.role,
    activeUser.phasePermissions
  );
  if (!canUserEditPhase({ role: activeUser.role, phasePermissions: activePerms }, 1)) {
    throw new Error(
      'Akses ditolak: Anda tidak memiliki izin mengubah Status Dokumen Checker (Fase 1).'
    );
  }
  const idx = db.shipments.findIndex((s) => s.kodeOs === kodeOs);
  if (idx === -1) throw new Error(`Shipment ${kodeOs} tidak ditemukan.`);

  const target = db.shipments[idx];
  const oldVal = normalizeStatusDokumen(target.statusDokumen);
  const newVal = normalizeStatusDokumen(nextStatus);
  if (oldVal === newVal) return db;

  const nowIso = new Date().toISOString();
  db.shipments[idx] = {
    ...target,
    statusDokumen: newVal,
    updatedAt: nowIso,
    updatedBy: activeUser.username,
  };
  db.logs.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    waktu: nowIso,
    user: activeUser.username,
    kodeOs,
    kolom: 'statusDokumen',
    nilaiLama: oldVal,
    nilaiBaru: newVal,
  });
  writeDbToStorage(db);
  return db;
}

export async function updateShipmentBc11(
  session: SessionUser,
  kodeOs: string,
  bc11Terbit: boolean,
  noBc11?: string,
  tglBc11?: string
): Promise<DatabaseState> {
  const db = await ensureDbInitialized();
  const activeUser = assertSessionActive(db, session);
  const activePerms = resolveUserPhasePermissions(
    activeUser.role,
    activeUser.phasePermissions
  );
  if (!canUserEditPhase({ role: activeUser.role, phasePermissions: activePerms }, 2)) {
    throw new Error(
      'Akses ditolak: Anda tidak memiliki izin mengubah data Pelayaran / BC 1.1 (Fase 2).'
    );
  }
  const idx = db.shipments.findIndex((s) => s.kodeOs === kodeOs);
  if (idx === -1) throw new Error(`Shipment ${kodeOs} tidak ditemukan.`);

  const target = db.shipments[idx];
  const oldState = Boolean(target.bc11Terbit || target.noBc11?.trim() || target.tglBc11?.trim());
  const nextNo = noBc11 !== undefined ? noBc11.trim() : target.noBc11 || '';
  const nextTgl =
    tglBc11 !== undefined
      ? tglBc11.trim()
      : bc11Terbit && !target.tglBc11
      ? new Date().toISOString().slice(0, 10)
      : target.tglBc11 || '';
  const nextFlag = Boolean(bc11Terbit || nextNo || nextTgl);

  const nowIso = new Date().toISOString();
  db.shipments[idx] = {
    ...target,
    bc11Terbit: nextFlag,
    noBc11: nextNo,
    tglBc11: nextTgl,
    updatedAt: nowIso,
    updatedBy: activeUser.username,
  };
  if (oldState !== nextFlag || nextNo !== (target.noBc11 || '')) {
    db.logs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      waktu: nowIso,
      user: activeUser.username,
      kodeOs,
      kolom: 'bc11Terbit',
      nilaiLama: oldState ? `Terbit (${target.noBc11 || '-'})` : 'Belum Terbit',
      nilaiBaru: nextFlag ? `Terbit (${nextNo || '-'})` : 'Belum Terbit',
    });
  }
  writeDbToStorage(db);
  return db;
}

export async function updateShipmentDoPelayaran(
  session: SessionUser,
  kodeOs: string,
  payload: {
    statusDokumen?: StatusDokumenType;
    doPelayaranStatus?: StatusDoPelayaranType;
    doBerlakuSampai?: string;
    doCatatanPerpanjangan?: string;
    doGatePassStatus?: StatusGatePassType;
    doGatePassJenis?: GatePassJenisType;
    doGatePassNomor?: string;
    truckingStatus?: StatusDoPelayaranType;
    truckingNamaSupir?: string;
    truckingNoPlat?: string;
    truckingNoHpSupir?: string;
    gateOutStatus?: StatusGateOutType;
    gateOutTanggal?: string;
    gateOutCatatan?: string;
    bindDokumenSelesai?: boolean;
    suratJalanNomor?: string;
    suratJalanTanggal?: string;
    suratJalanStatus?: StatusSuratJalanType;
    suratJalanTujuan?: string;
    suratJalanPenerima?: string;
    suratJalanCatatan?: string;
  }
): Promise<DatabaseState> {
  const db = await ensureDbInitialized();
  const activeUser = assertSessionActive(db, session);
  const activePerms = resolveUserPhasePermissions(
    activeUser.role,
    activeUser.phasePermissions
  );
  if (!canUserEditPhase({ role: activeUser.role, phasePermissions: activePerms }, 2)) {
    throw new Error(
      'Akses ditolak: Anda tidak memiliki izin mengubah kesiapan D/O Pelayaran (Fase 2).'
    );
  }
  const idx = db.shipments.findIndex((s) => s.kodeOs === kodeOs);
  if (idx === -1) throw new Error(`Shipment ${kodeOs} tidak ditemukan.`);

  const target = db.shipments[idx];
  const oldDokStatus = normalizeStatusDokumen(target.statusDokumen);
  const nextDokStatus =
    payload.statusDokumen !== undefined && activePerms.phase1
      ? normalizeStatusDokumen(payload.statusDokumen)
      : oldDokStatus;

  const oldStatus = normalizeStatusDoPelayaran(target.doPelayaranStatus);
  const nextStatus =
    payload.doPelayaranStatus !== undefined
      ? normalizeStatusDoPelayaran(payload.doPelayaranStatus)
      : oldStatus;
  const oldExp = target.doBerlakuSampai || '';
  const nextExp =
    payload.doBerlakuSampai !== undefined ? payload.doBerlakuSampai.trim() : oldExp;
  const oldNote = target.doCatatanPerpanjangan || '';
  const nextNote =
    payload.doCatatanPerpanjangan !== undefined
      ? payload.doCatatanPerpanjangan.trim()
      : oldNote;

  const oldGateStatus = normalizeStatusGatePass(target.doGatePassStatus);
  const nextGateStatus =
    payload.doGatePassStatus !== undefined
      ? normalizeStatusGatePass(payload.doGatePassStatus)
      : oldGateStatus;
  const oldGateJenis = normalizeGatePassJenis(target.doGatePassJenis);
  const nextGateJenis =
    payload.doGatePassJenis !== undefined
      ? normalizeGatePassJenis(payload.doGatePassJenis)
      : oldGateJenis;
  const oldGateNomor = target.doGatePassNomor || '';
  const nextGateNomor =
    payload.doGatePassNomor !== undefined ? payload.doGatePassNomor.trim() : oldGateNomor;

  const oldTruckStatus = normalizeStatusTrucking(target.truckingStatus);
  const nextTruckStatus =
    payload.truckingStatus !== undefined
      ? normalizeStatusTrucking(payload.truckingStatus)
      : oldTruckStatus;
  const oldSupir = target.truckingNamaSupir || '';
  const nextSupir =
    payload.truckingNamaSupir !== undefined ? payload.truckingNamaSupir.trim() : oldSupir;
  const oldPlat = target.truckingNoPlat || '';
  const nextPlat =
    payload.truckingNoPlat !== undefined ? payload.truckingNoPlat.trim().toUpperCase() : oldPlat;
  const oldHp = target.truckingNoHpSupir || '';
  const nextHp =
    payload.truckingNoHpSupir !== undefined ? payload.truckingNoHpSupir.trim() : oldHp;

  const oldGateOutStatus = normalizeStatusGateOut(target.gateOutStatus, target.status);
  const nextGateOutStatus =
    payload.gateOutStatus !== undefined
      ? normalizeStatusGateOut(payload.gateOutStatus)
      : oldGateOutStatus;
  const oldGateOutTanggal = target.gateOutTanggal || '';
  let nextGateOutTanggal =
    payload.gateOutTanggal !== undefined ? payload.gateOutTanggal.trim() : oldGateOutTanggal;
  if (nextGateOutStatus === 'Sudah' && !nextGateOutTanggal) {
    nextGateOutTanggal = new Date().toISOString().slice(0, 10);
  }
  const oldGateOutCatatan = target.gateOutCatatan || '';
  const nextGateOutCatatan =
    payload.gateOutCatatan !== undefined ? payload.gateOutCatatan.trim() : oldGateOutCatatan;

  const shouldBindSelesai =
    nextGateOutStatus === 'Sudah' &&
    payload.bindDokumenSelesai !== false &&
    (payload.bindDokumenSelesai === true || oldGateOutStatus !== 'Sudah');

  const oldShipmentStatus = target.status;
  const nextShipmentStatus = shouldBindSelesai ? 'Selesai' : oldShipmentStatus;
  let nextDokumenOs = target.dokumenOs;
  let dokumenOsCompletedNow = false;

  if (shouldBindSelesai) {
    const checklistItems = db.pengaturan.checklistItems || DEFAULT_CHECKLIST_ITEMS;
    const prevItems = target.dokumenOs?.items || {};
    const anyMissing = checklistItems.some((item) => !prevItems[item]);
    if (anyMissing) {
      const completedItems: Record<string, boolean> = { ...prevItems };
      for (const item of checklistItems) completedItems[item] = true;
      nextDokumenOs = {
        items: completedItems,
        catatan:
          target.dokumenOs?.catatan?.trim() ||
          `Otomatis dilengkapi via Gate-Out (${nextGateOutTanggal}).`,
      };
      dokumenOsCompletedNow = true;
    }
  }

  const nowIso = new Date().toISOString();
  const oldSjNomor = target.suratJalanNomor || '';
  const oldSjTanggal = target.suratJalanTanggal || '';
  const oldSjStatus = normalizeStatusSuratJalan(
    target.suratJalanStatus,
    oldGateOutStatus,
    oldShipmentStatus
  );
  const oldSjTujuan = target.suratJalanTujuan || '';
  const oldSjPenerima = target.suratJalanPenerima || '';
  const oldSjCatatan = target.suratJalanCatatan || '';

  let nextSjNomor =
    payload.suratJalanNomor !== undefined ? payload.suratJalanNomor.trim().toUpperCase() : oldSjNomor;
  let nextSjTanggal =
    payload.suratJalanTanggal !== undefined ? payload.suratJalanTanggal.trim() : oldSjTanggal;
  let nextSjStatus: StatusSuratJalanType =
    payload.suratJalanStatus !== undefined
      ? normalizeStatusSuratJalan(payload.suratJalanStatus, nextGateOutStatus, nextShipmentStatus)
      : normalizeStatusSuratJalan(target.suratJalanStatus, nextGateOutStatus, nextShipmentStatus);
  let nextSjTujuan =
    payload.suratJalanTujuan !== undefined ? payload.suratJalanTujuan.trim() : oldSjTujuan;
  const nextSjPenerima =
    payload.suratJalanPenerima !== undefined ? payload.suratJalanPenerima.trim() : oldSjPenerima;
  const nextSjCatatan =
    payload.suratJalanCatatan !== undefined ? payload.suratJalanCatatan.trim() : oldSjCatatan;
  let nextSjUpdatedAt = target.suratJalanUpdatedAt || '';

  if (nextGateOutStatus === 'Sudah') {
    const autoSj = buildAutoSuratJalanFields(
      {
        kodeOs,
        namaCustomer: target.namaCustomer,
        gateOutTanggal: nextGateOutTanggal,
        suratJalanNomor: nextSjNomor,
        suratJalanTanggal: nextSjTanggal,
        suratJalanStatus: nextSjStatus,
        suratJalanTujuan: nextSjTujuan,
        suratJalanUpdatedAt: nextSjUpdatedAt,
      },
      nextGateOutTanggal,
      nowIso
    );
    nextSjNomor = autoSj.suratJalanNomor;
    nextSjTanggal = autoSj.suratJalanTanggal;
    nextSjStatus = autoSj.suratJalanStatus;
    nextSjTujuan = autoSj.suratJalanTujuan;
    nextSjUpdatedAt = autoSj.suratJalanUpdatedAt;
  }

  const changes: Array<[string, string, string]> = [];
  if (oldDokStatus !== nextDokStatus) changes.push(['statusDokumen', oldDokStatus, nextDokStatus]);
  if (oldStatus !== nextStatus) changes.push(['doPelayaranStatus', oldStatus, nextStatus]);
  if (oldExp !== nextExp) changes.push(['doBerlakuSampai', oldExp || '-', nextExp || '-']);
  if (oldNote !== nextNote) changes.push(['doCatatanPerpanjangan', oldNote || '-', nextNote || '-']);
  if (oldGateStatus !== nextGateStatus) changes.push(['doGatePassStatus', oldGateStatus, nextGateStatus]);
  if (oldGateJenis !== nextGateJenis) changes.push(['doGatePassJenis', oldGateJenis || '-', nextGateJenis || '-']);
  if (oldGateNomor !== nextGateNomor) changes.push(['doGatePassNomor', oldGateNomor || '-', nextGateNomor || '-']);
  if (oldTruckStatus !== nextTruckStatus) changes.push(['truckingStatus', oldTruckStatus, nextTruckStatus]);
  if (oldSupir !== nextSupir) changes.push(['truckingNamaSupir', oldSupir || '-', nextSupir || '-']);
  if (oldPlat !== nextPlat) changes.push(['truckingNoPlat', oldPlat || '-', nextPlat || '-']);
  if (oldHp !== nextHp) changes.push(['truckingNoHpSupir', oldHp || '-', nextHp || '-']);
  if (oldGateOutStatus !== nextGateOutStatus) changes.push(['gateOutStatus', oldGateOutStatus, nextGateOutStatus]);
  if (oldGateOutTanggal !== nextGateOutTanggal) changes.push(['gateOutTanggal', oldGateOutTanggal || '-', nextGateOutTanggal || '-']);
  if (oldGateOutCatatan !== nextGateOutCatatan) changes.push(['gateOutCatatan', oldGateOutCatatan || '-', nextGateOutCatatan || '-']);
  if (oldSjNomor !== nextSjNomor) changes.push(['suratJalanNomor', oldSjNomor || '-', nextSjNomor || '-']);
  if (oldSjStatus !== nextSjStatus) changes.push(['suratJalanStatus', oldSjStatus, nextSjStatus]);
  if (oldSjTujuan !== nextSjTujuan) changes.push(['suratJalanTujuan', oldSjTujuan || '-', nextSjTujuan || '-']);
  if (oldSjPenerima !== nextSjPenerima) changes.push(['suratJalanPenerima', oldSjPenerima || '-', nextSjPenerima || '-']);
  if (oldSjCatatan !== nextSjCatatan) changes.push(['suratJalanCatatan', oldSjCatatan || '-', nextSjCatatan || '-']);
  if (oldShipmentStatus !== nextShipmentStatus) {
    changes.push(['status', oldShipmentStatus, `${nextShipmentStatus} (Ikatan Gate-Out)`]);
  }
  if (dokumenOsCompletedNow) {
    changes.push(['dokumenOs', 'Belum lengkap', 'Lengkap (Ikatan Gate-Out Selesai)']);
  }

  if (changes.length === 0) {
    return db;
  }

  if (
    oldSjNomor !== nextSjNomor ||
    oldSjStatus !== nextSjStatus ||
    oldSjTujuan !== nextSjTujuan ||
    oldSjPenerima !== nextSjPenerima ||
    oldSjCatatan !== nextSjCatatan
  ) {
    nextSjUpdatedAt = nowIso;
  }

  const draftShipment: Shipment = {
    ...target,
    statusDokumen: nextDokStatus,
    doPelayaranStatus: nextStatus,
    doBerlakuSampai: nextExp,
    doCatatanPerpanjangan: nextNote,
    doGatePassStatus: nextGateStatus,
    doGatePassJenis: nextGateJenis,
    doGatePassNomor: nextGateNomor,
    truckingStatus: nextTruckStatus,
    truckingNamaSupir: nextSupir,
    truckingNoPlat: nextPlat,
    truckingNoHpSupir: nextHp,
    gateOutStatus: nextGateOutStatus,
    gateOutTanggal: nextGateOutTanggal,
    gateOutCatatan: nextGateOutCatatan,
    suratJalanNomor: nextSjNomor,
    suratJalanTanggal: nextSjTanggal,
    suratJalanStatus: nextSjStatus,
    suratJalanTujuan: nextSjTujuan,
    suratJalanPenerima: nextSjPenerima,
    suratJalanCatatan: nextSjCatatan,
    suratJalanUpdatedAt: nextSjUpdatedAt,
    status: nextShipmentStatus,
    dokumenOs: nextDokumenOs,
    updatedAt: nowIso,
    updatedBy: activeUser.username,
  };

  if (isShipmentBillingEligible(draftShipment)) {
    const prevBillingStatus = normalizeStatusPenagihan(target.billingStatus, target);
    const autoBill = buildAutoBillingFields(draftShipment, nowIso.slice(0, 10));
    draftShipment.billingStatus = autoBill.billingStatus;
    draftShipment.billingNomor = autoBill.billingNomor;
    draftShipment.billingTanggal = autoBill.billingTanggal;
    draftShipment.billingJatuhTempo = autoBill.billingJatuhTempo;
    draftShipment.billingItems = autoBill.billingItems;
    draftShipment.billingPpnPersen = autoBill.billingPpnPersen;
    draftShipment.billingTotal = autoBill.billingTotal;
    if (prevBillingStatus === 'Belum') {
      changes.push([
        'billingStatus',
        'Belum',
        `${autoBill.billingStatus} (${autoBill.billingNomor})`,
      ]);
    }
  }

  db.shipments[idx] = draftShipment;

  for (const [kolom, nilaiLama, nilaiBaru] of changes) {
    db.logs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      waktu: nowIso,
      user: activeUser.username,
      kodeOs,
      kolom,
      nilaiLama,
      nilaiBaru,
    });
  }

  writeDbToStorage(db);
  return db;
}

export async function updateShipmentBilling(
  session: SessionUser,
  kodeOs: string,
  payload: {
    action: 'notify_owner' | 'save_invoice';
    via?: 'WhatsApp' | 'Email' | 'WA & Email';
    billingNomor?: string;
    billingTanggal?: string;
    billingJatuhTempo?: string;
    billingItems?: BillingItem[];
    billingPpnPersen?: number;
    billingCatatan?: string;
    billingStatus?: StatusPenagihanType;
    customerSentVia?: 'WhatsApp' | 'Email' | 'WA & Email' | '';
  }
): Promise<DatabaseState> {
  const db = await ensureDbInitialized();
  const activeUser = assertSessionActive(db, session);

  if (activeUser.role === 'Manajer') {
    throw new Error('Akses ditolak: Mode Manajer hanya dapat melihat/ekspor laporan.');
  }
  if (payload.action === 'save_invoice' && activeUser.role !== 'Admin') {
    throw new Error(
      'Khusus Admin yang dapat menerbitkan atau mengubah Surat Penagihan resmi untuk customer.'
    );
  }

  const idx = db.shipments.findIndex((s) => s.kodeOs === kodeOs);
  if (idx === -1) throw new Error(`Shipment ${kodeOs} tidak ditemukan.`);

  const target = db.shipments[idx];
  const nowIso = new Date().toISOString();
  const autoBase = buildAutoBillingFields(target, nowIso.slice(0, 10));
  const oldStatus = normalizeStatusPenagihan(target.billingStatus, target);

  let nextShipment: Shipment = { ...target, ...autoBase };
  const logEntries: Array<[string, string, string]> = [];

  if (payload.action === 'notify_owner') {
    const via = payload.via || 'WhatsApp';
    const nextStatus: StatusPenagihanType =
      oldStatus === 'Belum' || oldStatus === 'Siap Info Owner'
        ? 'Info Owner Terkirim'
        : oldStatus;
    nextShipment = {
      ...nextShipment,
      billingStatus: nextStatus,
      billingOwnerNotifiedAt: nowIso,
      billingOwnerNotifiedVia: via,
      billingOwnerNotifiedBy: activeUser.nama,
      updatedAt: nowIso,
      updatedBy: activeUser.username,
    };
    logEntries.push([
      'Info Owner Penagihan',
      oldStatus,
      `${nextStatus} via ${via} (${autoBase.billingNomor})`,
    ]);
  } else {
    const nextItems =
      Array.isArray(payload.billingItems) && payload.billingItems.length > 0
        ? payload.billingItems.map((it, i) => ({
            id: it.id || `${kodeOs}_item_${i + 1}`,
            deskripsi: it.deskripsi.trim() || 'Biaya Jasa PPJK',
            qty: Math.max(0, Number(it.qty) || 0),
            satuan: it.satuan.trim() || 'Paket',
            hargaSatuan: Math.max(0, Number(it.hargaSatuan) || 0),
          }))
        : autoBase.billingItems;
    const nextPpn =
      typeof payload.billingPpnPersen === 'number'
        ? Math.max(0, payload.billingPpnPersen)
        : autoBase.billingPpnPersen;
    const totals = calculateBillingTotals(nextItems, nextPpn);
    const nextStatus: StatusPenagihanType =
      payload.billingStatus && payload.billingStatus !== 'Belum'
        ? payload.billingStatus
        : 'Penagihan Terbit';
    const nextNomor = (payload.billingNomor || '').trim().toUpperCase() || autoBase.billingNomor;
    const nextTanggal = (payload.billingTanggal || '').trim() || autoBase.billingTanggal;
    const nextJatuhTempo =
      (payload.billingJatuhTempo || '').trim() || autoBase.billingJatuhTempo;
    const nextCatatan =
      payload.billingCatatan !== undefined
        ? payload.billingCatatan.trim()
        : target.billingCatatan || '';

    const customerSent: {
      billingCustomerSentAt: string;
      billingCustomerSentVia: Shipment['billingCustomerSentVia'];
    } =
      nextStatus === 'Terkirim ke Customer' || nextStatus === 'Lunas'
        ? {
            billingCustomerSentAt: target.billingCustomerSentAt || nowIso,
            billingCustomerSentVia:
              payload.customerSentVia || target.billingCustomerSentVia || 'WhatsApp',
          }
        : {
            billingCustomerSentAt: target.billingCustomerSentAt || '',
            billingCustomerSentVia: target.billingCustomerSentVia || '',
          };

    nextShipment = {
      ...nextShipment,
      billingNomor: nextNomor,
      billingTanggal: nextTanggal,
      billingJatuhTempo: nextJatuhTempo,
      billingItems: nextItems,
      billingPpnPersen: nextPpn,
      billingTotal: totals.total,
      billingCatatan: nextCatatan,
      billingStatus: nextStatus,
      billingCreatedBy: activeUser.nama,
      ...customerSent,
      updatedAt: nowIso,
      updatedBy: activeUser.username,
    };
    logEntries.push([
      'Surat Penagihan Admin',
      `${oldStatus} (${target.billingNomor || '-'})`,
      `${nextStatus} (${nextNomor})`,
    ]);
  }

  db.shipments[idx] = nextShipment;
  for (const [kolom, nilaiLama, nilaiBaru] of logEntries) {
    db.logs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      waktu: nowIso,
      user: activeUser.username,
      kodeOs,
      kolom,
      nilaiLama,
      nilaiBaru,
    });
  }

  writeDbToStorage(db);
  return db;
}

export async function deleteShipmentRecord(
  session: SessionUser,
  kodeOs: string
): Promise<DatabaseState> {
  if (!canPerformAction(session.role, 'delete_shipment')) {
    throw new Error('Akses ditolak: Anda tidak diizinkan menghapus shipment.');
  }
  const db = await ensureDbInitialized();
  assertSessionActive(db, session);
  const target = db.shipments.find((s) => s.kodeOs === kodeOs);
  db.shipments = db.shipments.filter((s) => s.kodeOs !== kodeOs);
  db.kontainers = db.kontainers.filter((k) => k.kodeOs !== kodeOs);
  db.logs.unshift({
    id: `log_${Date.now()}`,
    waktu: new Date().toISOString(),
    user: session.username,
    kodeOs,
    kolom: 'DELETE',
    nilaiLama: target?.noBl || '-',
    nilaiBaru: 'Shipment dihapus',
  });
  writeDbToStorage(db);
  return db;
}

export async function addShipmentComment(
  session: SessionUser,
  kodeOs: string,
  isi: string
): Promise<DatabaseState> {
  if (!canPerformAction(session.role, 'add_catatan')) {
    throw new Error('Akses ditolak.');
  }
  const db = await ensureDbInitialized();
  assertSessionActive(db, session);
  db.catatan.push({
    id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kodeOs,
    waktu: new Date().toISOString(),
    user: `${session.nama} (${session.username})`,
    isi: isi.trim(),
  });
  writeDbToStorage(db);
  return db;
}

export async function addShipmentDocument(
  session: SessionUser,
  kodeOs: string,
  jenisDokumen: string,
  namaFile: string,
  driveMeta?: {
    linkDrive?: string;
    driveFileId?: string;
    driveFolderId?: string;
    source?: 'google-drive' | 'simulasi';
  }
): Promise<DatabaseState> {
  if (!canPerformAction(session.role, 'upload_dokumen')) {
    throw new Error('Akses ditolak.');
  }
  const db = await ensureDbInitialized();
  assertSessionActive(db, session);
  const nowIso = new Date().toISOString();
  const folderId = db.pengaturan.driveParentFolderId || 'PTG_PPJK_DOKUMEN_ROOT';
  const randSuffix = Math.random().toString(36).slice(2, 7);
  db.dokumen.push({
    id: `doc_${Date.now()}_${randSuffix}`,
    kodeOs,
    jenisDokumen,
    namaFile,
    linkDrive:
      driveMeta?.linkDrive ||
      `https://drive.google.com/drive/folders/${folderId}?q=${encodeURIComponent(kodeOs)}`,
    waktuUpload: nowIso,
    user: session.username,
    driveFileId: driveMeta?.driveFileId,
    driveFolderId: driveMeta?.driveFolderId,
    source: driveMeta?.source || (driveMeta?.driveFileId ? 'google-drive' : 'simulasi'),
  });
  db.logs.unshift({
    id: `log_${Date.now()}_${randSuffix}`,
    waktu: nowIso,
    user: session.username,
    kodeOs,
    kolom: 'DOKUMEN_UPLOAD',
    nilaiLama: '-',
    nilaiBaru: `${jenisDokumen}: ${namaFile}`,
  });
  writeDbToStorage(db);
  return db;
}

export async function deleteShipmentDocument(
  session: SessionUser,
  docId: string
): Promise<DatabaseState> {
  if (!canPerformAction(session.role, 'upload_dokumen')) {
    throw new Error('Akses ditolak.');
  }
  const db = await ensureDbInitialized();
  assertSessionActive(db, session);
  const target = db.dokumen.find((d) => d.id === docId);
  db.dokumen = db.dokumen.filter((d) => d.id !== docId);
  if (target) {
    const randSuffix = Math.random().toString(36).slice(2, 7);
    db.logs.unshift({
      id: `log_${Date.now()}_${randSuffix}`,
      waktu: new Date().toISOString(),
      user: session.username,
      kodeOs: target.kodeOs,
      kolom: 'DOKUMEN_HAPUS',
      nilaiLama: `${target.jenisDokumen}: ${target.namaFile}`,
      nilaiBaru: 'Dihapus',
    });
  }
  writeDbToStorage(db);
  return db;
}

export async function saveCustomerMaster(
  session: SessionUser,
  item: Customer
): Promise<DatabaseState> {
  if (!canPerformAction(session.role, 'manage_master')) throw new Error('Akses ditolak.');
  const db = await ensureDbInitialized();
  assertSessionActive(db, session);
  const idx = db.customers.findIndex((c) => c.kodeCustomer === item.kodeCustomer);
  if (idx >= 0) db.customers[idx] = item;
  else db.customers.push(item);
  writeDbToStorage(db);
  return db;
}

export async function deleteCustomerMaster(
  session: SessionUser,
  kodeCustomer: string
): Promise<DatabaseState> {
  if (!canPerformAction(session.role, 'manage_master')) throw new Error('Akses ditolak.');
  const db = await ensureDbInitialized();
  assertSessionActive(db, session);
  db.customers = db.customers.filter((c) => c.kodeCustomer !== kodeCustomer);
  writeDbToStorage(db);
  return db;
}

export async function saveImportirMaster(
  session: SessionUser,
  item: Importir
): Promise<DatabaseState> {
  if (!canPerformAction(session.role, 'manage_master')) throw new Error('Akses ditolak.');
  const db = await ensureDbInitialized();
  assertSessionActive(db, session);
  const idx = db.importirs.findIndex((i) => i.kodeImportir === item.kodeImportir);
  if (idx >= 0) db.importirs[idx] = item;
  else db.importirs.push(item);
  writeDbToStorage(db);
  return db;
}

export async function deleteImportirMaster(
  session: SessionUser,
  kodeImportir: string
): Promise<DatabaseState> {
  if (!canPerformAction(session.role, 'manage_master')) throw new Error('Akses ditolak.');
  const db = await ensureDbInitialized();
  assertSessionActive(db, session);
  db.importirs = db.importirs.filter((i) => i.kodeImportir !== kodeImportir);
  writeDbToStorage(db);
  return db;
}

export async function saveShipperMaster(
  session: SessionUser,
  item: Shipper
): Promise<DatabaseState> {
  if (!canPerformAction(session.role, 'manage_master')) throw new Error('Akses ditolak.');
  const db = await ensureDbInitialized();
  assertSessionActive(db, session);
  const idx = db.shippers.findIndex((s) => s.namaShipper === item.namaShipper);
  if (idx >= 0) db.shippers[idx] = item;
  else db.shippers.push(item);
  writeDbToStorage(db);
  return db;
}

export async function deleteShipperMaster(
  session: SessionUser,
  namaShipper: string
): Promise<DatabaseState> {
  if (!canPerformAction(session.role, 'manage_master')) throw new Error('Akses ditolak.');
  const db = await ensureDbInitialized();
  assertSessionActive(db, session);
  db.shippers = db.shippers.filter((s) => s.namaShipper !== namaShipper);
  writeDbToStorage(db);
  return db;
}

export async function saveUserRecord(
  session: SessionUser,
  payload: {
    username: string;
    nama: string;
    role: UserRole;
    password?: string;
    aktif: boolean;
    mustChangePassword?: boolean;
    phasePermissions?: Partial<PhasePermissions>;
  }
): Promise<DatabaseState> {
  if (!canPerformAction(session.role, 'manage_users')) throw new Error('Khusus Admin.');
  if (!VALID_ROLES.includes(payload.role)) {
    throw new Error('Peran user tidak valid.');
  }
  const cleanUsername = payload.username.trim();
  const cleanNama = payload.nama.trim();
  if (!cleanUsername || !cleanNama) {
    throw new Error('Username dan Nama Lengkap wajib diisi.');
  }
  if (cleanUsername.toLowerCase() === session.username.toLowerCase() && !payload.aktif) {
    throw new Error('Admin tidak dapat menonaktifkan akunnya sendiri saat sedang login.');
  }

  const db = await ensureDbInitialized();
  assertSessionActive(db, session);
  const idx = db.users.findIndex(
    (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
  );

  const existingPerms = idx >= 0 ? db.users[idx].phasePermissions : undefined;
  const resolvedPhasePermissions = resolveUserPhasePermissions(
    payload.role,
    payload.phasePermissions ?? existingPerms
  );

  if (idx >= 0) {
    const existing = db.users[idx];
    let salt = existing.salt;
    let passwordHash = existing.passwordHash;
    let mustChangePassword =
      payload.mustChangePassword !== undefined
        ? payload.mustChangePassword
        : existing.mustChangePassword;
    if (payload.password && payload.password.trim().length > 0) {
      if (payload.password.trim().length < 6) {
        throw new Error('Password baru minimal 6 karakter.');
      }
      salt = `salt_${Date.now()}`;
      passwordHash = await computeSha256Hex(`${salt}:${payload.password.trim()}`);
      mustChangePassword = payload.mustChangePassword ?? false;
    }
    db.users[idx] = {
      ...existing,
      nama: cleanNama,
      role: payload.role,
      aktif: payload.aktif,
      salt,
      passwordHash,
      mustChangePassword,
      phasePermissions: resolvedPhasePermissions,
    };
  } else {
    if (!payload.password || payload.password.trim().length < 6) {
      throw new Error('Password user baru minimal 6 karakter.');
    }
    const salt = `salt_${Date.now()}`;
    const passwordHash = await computeSha256Hex(`${salt}:${payload.password.trim()}`);
    db.users.push({
      username: cleanUsername,
      nama: cleanNama,
      role: payload.role,
      aktif: payload.aktif,
      salt,
      passwordHash,
      mustChangePassword: payload.mustChangePassword ?? false,
      phasePermissions: resolvedPhasePermissions,
    });
  }
  writeDbToStorage(db);

  if (cleanUsername.toLowerCase() === session.username.toLowerCase()) {
    saveStoredSession({
      ...session,
      nama: cleanNama,
      role: payload.role,
      phasePermissions: resolvedPhasePermissions,
    });
  }
  return db;
}

export async function savePengaturanRecord(
  session: SessionUser,
  pengaturan: Pengaturan
): Promise<DatabaseState> {
  if (!canPerformAction(session.role, 'manage_settings')) throw new Error('Khusus Admin.');
  const db = await ensureDbInitialized();
  assertSessionActive(db, session);
  db.pengaturan = pengaturan;
  writeDbToStorage(db);
  return db;
}
