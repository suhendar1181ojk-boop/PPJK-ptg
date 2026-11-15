export type UserRole =
  | 'Admin'
  | 'Checker'
  | 'Drafter'
  | 'Dokumen/Checker'
  | 'Operasional'
  | 'Manajer';

export type JalurType = '' | 'Hijau' | 'Kuning' | 'Merah' | 'MITA';

export type StatusDokumenType = 'Draft' | 'Ready';

export type StatusDoPelayaranType = 'Sedia' | 'Belum';

export type StatusGatePassType = 'Belum' | 'Proses' | 'Sedia';

export type GatePassJenisType = '' | 'TILA (Kartu Gate)' | 'Eslah' | 'Eslah & TILA';

export type StatusGateOutType = 'Belum' | 'Sudah';

export type StatusSuratJalanType = 'Belum' | 'Terbit' | 'Dalam Pengiriman' | 'Tiba di Tujuan';

export type StatusPenagihanType =
  | 'Belum'
  | 'Siap Info Owner'
  | 'Info Owner Terkirim'
  | 'Penagihan Terbit'
  | 'Terkirim ke Customer'
  | 'Lunas';

export interface BillingItem {
  id: string;
  deskripsi: string;
  qty: number;
  satuan: string;
  hargaSatuan: number;
}

export type ShipmentDateFilterField = 'eta' | 'etd' | 'tglTerimaDok' | 'tglSppb';

export interface ChecklistData {
  items: Record<string, boolean>;
  catatan: string;
}

export interface KontainerItem {
  id: string;
  kodeOs: string;
  noCont: string;
  ukuranTipe: string;
}

/**
 * 39 Kolom Utama Shipment + Status Dokumen Checker & Metadata Audit
 */
export interface Shipment {
  // 1-8: Dokumen & Customer
  kodeOs: string;           // 1. Kode OS (OS-YYMM-NNNN)
  ship: string;             // 2. Ship (Vessel / Voyage)
  kodeCustomer: string;     // 3. Kode Customer
  namaCustomer: string;     // 4. Nama Customer
  tglTerimaDok: string;     // 5. Tgl. Terima Dok (YYYY-MM-DD)
  terimaDok: ChecklistData; // 6. Terima Dok (Checklist + Catatan)
  noPackinglist: string;    // 7. No. Packinglist
  noBl: string;             // 8. No. BL
  statusDokumen?: StatusDokumenType; // Status pembuatan dokumen oleh Checker (Draft / Ready)

  // 9-12: Pelayaran & Kontainer
  etd: string;              // 9. ETD (YYYY-MM-DD)
  eta: string;              // 10. ETA (YYYY-MM-DD)
  countDownEta: number | null; // 11. Count Down ETA (auto-calculated)
  noCont: string;           // 12. No. Cont (ringkasan semua kontainer)
  bc11Terbit?: boolean;     // Penanda BC 1.1 / Manifes sudah terbit
  noBc11?: string;          // Nomor BC 1.1 / Manifes
  tglBc11?: string;         // Tanggal terbit BC 1.1 (YYYY-MM-DD)
  doPelayaranStatus?: StatusDoPelayaranType; // Status kesiapan D/O Pelayaran (Sedia / Belum)
  doBerlakuSampai?: string; // Tanggal masa berlaku / batas perpanjangan D/O (YYYY-MM-DD)
  doCatatanPerpanjangan?: string; // Catatan masa berlaku & perpanjangan D/O Pelayaran
  doGatePassStatus?: StatusGatePassType; // Status pengurusan Eslah / TILA (Kartu Gate) pelabuhan setempat
  doGatePassJenis?: GatePassJenisType; // Jenis pengurusan (TILA / Eslah / Eslah & TILA)
  doGatePassNomor?: string; // Nomor Eslah / TILA (Kartu Gate) pelabuhan setempat
  truckingStatus?: StatusDoPelayaranType; // Kesediaan armada trucking (Sedia / Belum)
  truckingNamaSupir?: string; // Nama supir truk
  truckingNoPlat?: string; // Nomor plat polisi truk
  truckingNoHpSupir?: string; // Nomor HP supir truk
  gateOutStatus?: StatusGateOutType; // Status Gate-Out kontainer keluar pelabuhan (Belum / Sudah)
  gateOutTanggal?: string; // Tanggal aktual Gate-Out kontainer (YYYY-MM-DD)
  gateOutCatatan?: string; // Catatan Gate-Out & ikatan proses dokumen selesai
  suratJalanNomor?: string; // Nomor Surat Jalan tracking pengiriman kontainer (otomatis saat Gate-Out)
  suratJalanTanggal?: string; // Tanggal penerbitan Surat Jalan (YYYY-MM-DD)
  suratJalanStatus?: StatusSuratJalanType; // Status tracking pengiriman Surat Jalan
  suratJalanTujuan?: string; // Alamat / gudang tujuan pengiriman
  suratJalanPenerima?: string; // Nama penerima / PIC di tujuan
  suratJalanCatatan?: string; // Catatan tracking / no. segel kontainer
  suratJalanUpdatedAt?: string; // Timestamp update terakhir tracking Surat Jalan

  // Penagihan & Info Owner -> Admin -> Customer
  billingStatus?: StatusPenagihanType;
  billingNomor?: string; // Nomor Surat Penagihan otomatis (INV-YYMM-NNNN)
  billingTanggal?: string; // Tanggal Surat Penagihan (YYYY-MM-DD)
  billingJatuhTempo?: string; // Tanggal Jatuh Tempo (YYYY-MM-DD)
  billingItems?: BillingItem[]; // Rincian biaya jasa & reimburse PPJK
  billingPpnPersen?: number; // Tarif PPN % (mis. 11 atau 0)
  billingTotal?: number; // Total tagihan final (Rp)
  billingCatatan?: string; // Catatan / keterangan surat penagihan
  billingOwnerNotifiedAt?: string; // Timestamp info pesan WA/Email dikirim ke Owner
  billingOwnerNotifiedVia?: 'WhatsApp' | 'Email' | 'WA & Email' | '';
  billingOwnerNotifiedBy?: string;
  billingCustomerSentAt?: string; // Timestamp surat penagihan dikirim ke Customer
  billingCustomerSentVia?: 'WhatsApp' | 'Email' | 'WA & Email' | '';
  billingCreatedBy?: string; // Nama Admin penerbit surat penagihan

  // 13-29: Customs & Nilai
  noAju: string;            // 13. No. AJU
  tglAju: string;           // 14. Tgl. AJU
  status: string;           // 15. Status
  nopen: string;            // 16. NOPEN
  tglNopen: string;         // 17. Tgl. NOPEN
  jalur: JalurType;         // 18. Jalur
  kodeImportir: string;     // 19. Kode Importir
  shipper: string;          // 20. Shipper
  description: string;      // 21. Description
  negaraAsal: string;       // 22. Negara Asal
  currency: string;         // 23. Currency
  kurs: number | '';        // 24. Kurs
  invoice: number | '';     // 25. Invoice
  bmPdri: string;           // 26. BM/PDRI
  sptnp: string;            // 27. SPTNP (Ada/Tidak atau Ringkasan)
  noSppb: string;           // 28. No. SPPB
  tglSppb: string;          // 29. Tgl SPPB

  // 30-39: Pasca-SPPB & Penyelesaian OS
  dokumenChecker: string;   // 30. Dokumen Checker
  noSptnp: string;          // 31. No. SPTNP
  tglSptnp: string;         // 32. Tgl. SPTNP
  pfpb: string;             // 33. PFPB
  tglPfpb: string;          // 34. Tgl. PFPB
  pfpd: string;             // 35. PFPD
  tglPfpd: string;          // 36. Tgl. PFPD
  eslah: string;            // 37. ESLAH
  tglEslah: string;         // 38. Tgl. ESLAH
  dokumenOs: ChecklistData; // 39. Dokumen OS (Checklist + Catatan)

  // Audit Metadata
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Customer {
  kodeCustomer: string;
  namaCustomer: string;
  kontak: string;
}

export interface Importir {
  kodeImportir: string;
  namaImportir: string;
}

export interface Shipper {
  namaShipper: string;
  negara: string;
}

export interface PhasePermissions {
  phase1: boolean; // 1. Dokumen
  phase2: boolean; // 2. Pelayaran
  phase3: boolean; // 3. Customs
  phase4: boolean; // 4. Pasca-SPPB
}

export interface UserAccount {
  username: string;
  passwordHash: string;
  salt: string;
  nama: string;
  role: UserRole;
  aktif: boolean;
  mustChangePassword?: boolean;
  phasePermissions?: PhasePermissions;
}

export interface SessionUser {
  token: string;
  username: string;
  nama: string;
  role: UserRole;
  mustChangePassword: boolean;
  expiresAt: number;
  phasePermissions?: PhasePermissions;
}

export interface LogPerubahan {
  id: string;
  waktu: string;
  user: string;
  kodeOs: string;
  kolom: string;
  nilaiLama: string;
  nilaiBaru: string;
}

export interface Catatan {
  id: string;
  kodeOs: string;
  waktu: string;
  user: string;
  isi: string;
}

export interface DokumenItem {
  id: string;
  kodeOs: string;
  jenisDokumen: string;
  namaFile: string;
  linkDrive: string;
  waktuUpload: string;
  user: string;
  driveFileId?: string;
  driveFolderId?: string;
  source?: 'google-drive' | 'simulasi';
}

export interface PendingUploadFile {
  id: string;
  jenisDokumen: string;
  namaFile: string;
  ukuranLabel?: string;
  file?: File;
}

export interface Pengaturan {
  seqByMonth: Record<string, number>;
  driveParentFolderId: string;
  statusList: string[];
  jalurList: JalurType[];
  checklistItems: string[];
  notificationEmails: string[];
  ownerName?: string;
  ownerWhatsapp?: string;
  ownerEmail?: string;
  adminName?: string;
  adminWhatsapp?: string;
  adminEmail?: string;
  billingBankInfo?: string;
  gasDeployPinHash?: string;
}

export interface DashboardStats {
  total: number;
  outstanding: number;
  draftCount: number;
  readyCount: number;
  etaNext7Days: number;
  urgentMissingAju: number;
  urgentProcessSignal: number;
  byStatus: Record<string, number>;
  byJalur: Record<string, number>;
  byMonth: Array<{ month: string; count: number }>;
  byCustomer: Array<{ customer: string; count: number }>;
}

export interface CheckerSummary {
  checkerName: string;
  total: number;
  outstanding: number;
  completed: number;
  draftCount: number;
  readyCount: number;
  urgentMissingAju: number;
  processSignalCount: number;
  etaNext7Days: number;
  completionRate: number;
  byStatus: Record<string, number>;
  byJalur: Record<string, number>;
  shipments: Shipment[];
}

export interface GlobalStatusSummary {
  totalDocuments: number;
  totalOutstanding: number;
  totalCompleted: number;
  totalDraft: number;
  totalReady: number;
  totalUrgent: number;
  totalProcessSignal: number;
  totalCheckers: number;
  byStatus: Array<{ status: string; count: number; percentage: number }>;
  byJalur: Record<string, number>;
  checkers: CheckerSummary[];
}

export interface DoReadinessSummary {
  total: number;
  draftDokCount: number;
  readyDokCount: number;
  sediaCount: number;
  belumCount: number;
  siapKeluarCount: number;
  sppbMenungguDoCount: number;
  perluPerpanjanganCount: number;
  gatePassSediaCount: number;
  gatePassProsesCount: number;
  gatePassBelumCount: number;
  truckingSediaCount: number;
  truckingBelumCount: number;
  fullReadyGateOutCount: number;
  gateOutSudahCount: number;
  gateOutBelumCount: number;
  dokumenSelesaiCount: number;
  suratJalanTerbitCount: number;
  suratJalanDalamPengirimanCount: number;
  suratJalanTibaCount: number;
}

export interface BillingSummary {
  eligibleCount: number;
  siapInfoOwnerCount: number;
  ownerNotifiedCount: number;
  terbitCount: number;
  terkirimCustomerCount: number;
  lunasCount: number;
  totalNominal: number;
  totalLunasNominal: number;
}

export interface ImportirSummaryItem {
  kodeImportir: string;
  namaImportir: string;
  total: number;
  draftCount: number;
  readyCount: number;
  outstanding: number;
  completed: number;
  sppbCount: number;
  gateOutCount: number;
  processSignalCount: number;
  byJalur: Record<string, number>;
  bmPdriTotal: number;
  customerNames: string[];
}

export interface ImportirGlobalSummary {
  totalImportirs: number;
  totalShipments: number;
  totalDraft: number;
  totalReady: number;
  totalOutstanding: number;
  totalCompleted: number;
  totalSppb: number;
  totalGateOut: number;
  totalProcessSignal: number;
  totalBmPdri: number;
  items: ImportirSummaryItem[];
}

export interface NopenRecapCriteria {
  periodMode: 'month' | 'range';
  month?: string; // YYYY-MM
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  search?: string;
  filterJalur?: '' | JalurType | '__EMPTY__';
  filterStatus?: string;
  filterImportir?: string;
  includeWithoutNopen?: boolean;
}

export interface NopenDailyRecapItem {
  date: string;
  count: number;
  sppbCount: number;
  gateOutCount: number;
  sptnpCount: number;
  byJalur: Record<string, number>;
}

export interface NopenImportirRecapItem {
  kodeImportir: string;
  namaImportir: string;
  count: number;
  sppbCount: number;
  gateOutCount: number;
  bmPdriTotal: number;
}

export interface NopenRecapSummary {
  periodMode: 'month' | 'range';
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  totalMatched: number;
  totalWithNopen: number;
  totalWithoutNopen: number;
  totalSppb: number;
  totalGateOut: number;
  totalSelesai: number;
  totalOutstanding: number;
  totalSptnp: number;
  byJalur: Record<string, number>;
  totalBmPdri: number;
  byDay: NopenDailyRecapItem[];
  byImportir: NopenImportirRecapItem[];
}

export type AppView =
  | 'dashboard'
  | 'checker'
  | 'do'
  | 'surat-jalan'
  | 'penagihan'
  | 'report-nopen'
  | 'shipments'
  | 'outstanding'
  | 'master';
export type ShipmentPhase = 1 | 2 | 3 | 4;
