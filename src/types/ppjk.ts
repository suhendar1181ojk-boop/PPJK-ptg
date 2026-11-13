export type UserRole =
  | 'Admin'
  | 'Checker'
  | 'Drafter'
  | 'Dokumen/Checker'
  | 'Operasional'
  | 'Manajer';

export type JalurType = '' | 'Hijau' | 'Kuning' | 'Merah' | 'MITA';

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
 * 39 Kolom Utama Shipment + Metadata Audit
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

  // 9-12: Pelayaran & Kontainer
  etd: string;              // 9. ETD (YYYY-MM-DD)
  eta: string;              // 10. ETA (YYYY-MM-DD)
  countDownEta: number | null; // 11. Count Down ETA (auto-calculated)
  noCont: string;           // 12. No. Cont (ringkasan semua kontainer)

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
}

export interface PendingUploadFile {
  id: string;
  jenisDokumen: string;
  namaFile: string;
  ukuranLabel?: string;
}

export interface Pengaturan {
  seqByMonth: Record<string, number>;
  driveParentFolderId: string;
  statusList: string[];
  jalurList: JalurType[];
  checklistItems: string[];
  notificationEmails: string[];
}

export interface DashboardStats {
  total: number;
  outstanding: number;
  etaNext7Days: number;
  urgentMissingAju: number;
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
  urgentMissingAju: number;
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
  totalUrgent: number;
  totalCheckers: number;
  byStatus: Array<{ status: string; count: number; percentage: number }>;
  byJalur: Record<string, number>;
  checkers: CheckerSummary[];
}

export type AppView = 'dashboard' | 'checker' | 'shipments' | 'outstanding' | 'master' | 'gas';
export type ShipmentPhase = 1 | 2 | 3 | 4;
