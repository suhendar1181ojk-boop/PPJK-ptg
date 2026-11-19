import React, { useState } from 'react';
import {
  Anchor,
  CheckSquare,
  ClipboardList,
  Download,
  ExternalLink,
  FolderOpen,
  History,
  MessageSquare,
  Package,
  Paperclip,
  Pencil,
  Printer,
  Receipt,
  Save,
  Send,
  Square,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import type {
  Catatan,
  DokumenItem,
  GatePassJenisType,
  KontainerItem,
  LogPerubahan,
  Pengaturan,
  PengeluaranOpsItem,
  PhasePermissions,
  Shipment,
  StatusDokumenType,
  StatusDoPelayaranType,
  StatusGateOutType,
  StatusGatePassType,
  StatusSuratJalanType,
  UserRole,
} from '../types/ppjk';
import {
  formatRupiahOps,
  getStatusPengeluaranMeta,
  hasBuktiPengeluaran,
} from '../utils/pengeluaranOpsLogic';
import { KdiPrintModal } from './KdiPrintModal';
import type { DriveFileEntry } from '../services/googleDriveService';
import {
  buildAutoBillingFields,
  canPerformAction,
  canUserEditAnyPhase,
  canUserEditPhase,
  formatChecklistProgress,
  formatRupiah,
  generateSuratJalanNomor,
  getBillingEligibilityReason,
  getShipmentProcessSignal,
  isContainerGateOut,
  isShipmentBillingEligible,
  normalizeGatePassJenis,
  normalizeStatusDokumen,
  normalizeStatusDoPelayaran,
  normalizeStatusGateOut,
  normalizeStatusGatePass,
  normalizeStatusPenagihan,
  normalizeStatusSuratJalan,
  normalizeStatusTrucking,
} from '../utils/ppjkLogic';
import {
  exportSuratJalanToPDF,
  exportTandaTerimaOpsPDF,
} from '../utils/exportUtils';
import {
  CountdownBadge,
  DoValidityBadge,
  JalurBadge,
  ProcessSignalBadge,
  StatusBadge,
  StatusDokumenBadge,
  StatusDoBadge,
  StatusGateOutBadge,
  StatusGatePassBadge,
  StatusPenagihanBadge,
  StatusSuratJalanBadge,
  StatusTruckingBadge,
} from './Badges';
import { GoogleSignInButton } from './GoogleDriveButton';
import { SuratJalanModal } from './SuratJalanModal';
import { describeRegisteredDriveDestination } from '../utils/googleDriveFolderLogic';

interface ShipmentDetailDrawerProps {
  shipment: Shipment;
  containers: KontainerItem[];
  comments: Catatan[];
  documents: DokumenItem[];
  opsExpenses?: PengeluaranOpsItem[];
  pengaturan?: Pengaturan;
  logs: LogPerubahan[];
  checklistItems: string[];
  userRole: UserRole;
  phasePermissions?: PhasePermissions;
  googleDriveUserEmail?: string | null;
  driveConnecting?: boolean;
  onConnectGoogleDrive?: () => Promise<void>;
  onListDriveFiles?: () => Promise<DriveFileEntry[]>;
  onDeleteDocument?: (doc: DokumenItem) => Promise<void>;
  onClose: () => void;
  onEdit: (kodeOs: string) => void;
  onDelete: (kodeOs: string) => void;
  onOpenBilling?: (kodeOs: string, tab?: 'owner' | 'customer') => void;
  onOpenKeuanganOps?: (kodeOs: string) => void;
  onAddComment: (kodeOs: string, isi: string) => Promise<void>;
  onUploadDocument: (
    kodeOs: string,
    jenis: string,
    fileName: string,
    file?: File
  ) => Promise<void>;
  onUpdateStatusDokumen?: (
    kodeOs: string,
    nextStatus: StatusDokumenType
  ) => Promise<void>;
  onUpdateBc11?: (
    kodeOs: string,
    bc11Terbit: boolean,
    noBc11?: string,
    tglBc11?: string
  ) => Promise<void>;
  onUpdateDoPelayaran?: (
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
  ) => Promise<void>;
}

export function ShipmentDetailDrawer({
  shipment,
  containers,
  comments,
  documents,
  opsExpenses = [],
  pengaturan,
  logs,
  checklistItems,
  userRole,
  phasePermissions,
  googleDriveUserEmail,
  driveConnecting = false,
  onConnectGoogleDrive,
  onListDriveFiles,
  onDeleteDocument,
  onClose,
  onEdit,
  onDelete,
  onOpenBilling,
  onOpenKeuanganOps,
  onAddComment,
  onUploadDocument,
  onUpdateStatusDokumen,
  onUpdateBc11,
  onUpdateDoPelayaran,
}: ShipmentDetailDrawerProps) {
  const [noteText, setNoteText] = useState('');
  const [docJenis, setDocJenis] = useState('Bill of Lading (BL)');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [updatingDocStatus, setUpdatingDocStatus] = useState(false);
  const [updatingBc11, setUpdatingBc11] = useState(false);
  const [updatingDo, setUpdatingDo] = useState(false);
  const [editingDo, setEditingDo] = useState(false);
  const [doStatusDraft, setDoStatusDraft] = useState<StatusDoPelayaranType>(
    normalizeStatusDoPelayaran(shipment.doPelayaranStatus)
  );
  const [doExpDraft, setDoExpDraft] = useState(shipment.doBerlakuSampai || '');
  const [doNoteDraft, setDoNoteDraft] = useState(shipment.doCatatanPerpanjangan || '');
  const [gatePassStatusDraft, setGatePassStatusDraft] = useState<StatusGatePassType>(
    normalizeStatusGatePass(shipment.doGatePassStatus)
  );
  const [gatePassJenisDraft, setGatePassJenisDraft] = useState<GatePassJenisType>(
    normalizeGatePassJenis(shipment.doGatePassJenis)
  );
  const [gatePassNomorDraft, setGatePassNomorDraft] = useState(shipment.doGatePassNomor || '');
  const [truckingStatusDraft, setTruckingStatusDraft] = useState<StatusDoPelayaranType>(
    normalizeStatusTrucking(shipment.truckingStatus)
  );
  const [truckingNamaDraft, setTruckingNamaDraft] = useState(shipment.truckingNamaSupir || '');
  const [truckingPlatDraft, setTruckingPlatDraft] = useState(shipment.truckingNoPlat || '');
  const [truckingHpDraft, setTruckingHpDraft] = useState(shipment.truckingNoHpSupir || '');
  const [gateOutStatusDraft, setGateOutStatusDraft] = useState<StatusGateOutType>(
    normalizeStatusGateOut(shipment.gateOutStatus, shipment.status)
  );
  const [gateOutTglDraft, setGateOutTglDraft] = useState(shipment.gateOutTanggal || '');
  const [gateOutNoteDraft, setGateOutNoteDraft] = useState(shipment.gateOutCatatan || '');
  const [bindSelesaiDraft, setBindSelesaiDraft] = useState(true);
  const [sjModalOpen, setSjModalOpen] = useState(false);
  const [kdiModalOpen, setKdiModalOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileEntry[] | null>(null);
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false);
  const [driveListError, setDriveListError] = useState('');

  const canEdit = canUserEditAnyPhase({ role: userRole, phasePermissions });
  const canEditPhase1 = canUserEditPhase({ role: userRole, phasePermissions }, 1);
  const canEditPhase2 = canUserEditPhase({ role: userRole, phasePermissions }, 2);
  const canDelete = canPerformAction(userRole, 'delete_shipment');
  const canComment = canPerformAction(userRole, 'add_catatan');
  const canUpload = canPerformAction(userRole, 'upload_dokumen');
  const currentDocStatus = normalizeStatusDokumen(shipment.statusDokumen);
  const currentDoStatus = normalizeStatusDoPelayaran(shipment.doPelayaranStatus);
  const currentGatePassStatus = normalizeStatusGatePass(shipment.doGatePassStatus);
  const currentGatePassJenis = normalizeGatePassJenis(shipment.doGatePassJenis);
  const currentTruckingStatus = normalizeStatusTrucking(shipment.truckingStatus);
  const currentGateOutStatus = normalizeStatusGateOut(shipment.gateOutStatus, shipment.status);
  const processSignal = getShipmentProcessSignal(shipment);
  const isBc11Terbit = Boolean(
    shipment.bc11Terbit || shipment.noBc11?.trim() || shipment.tglBc11?.trim()
  );

  const terimaProg = formatChecklistProgress(shipment.terimaDok, checklistItems);
  const osProg = formatChecklistProgress(shipment.dokumenOs, checklistItems);

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setBusy(true);
    try {
      await onAddComment(shipment.kodeOs, noteText);
      setNoteText('');
    } finally {
      setBusy(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFileName) return;
    setBusy(true);
    try {
      await onUploadDocument(
        shipment.kodeOs,
        docJenis,
        selectedFileName,
        selectedFile || undefined
      );
      setSelectedFile(null);
      setSelectedFileName('');
    } finally {
      setBusy(false);
    }
  };

  const handleBrowseDrive = async () => {
    if (!onListDriveFiles) return;
    setLoadingDriveFiles(true);
    setDriveListError('');
    try {
      const files = await onListDriveFiles();
      setDriveFiles(files);
    } catch (err) {
      setDriveListError(err instanceof Error ? err.message : 'Gagal memuat daftar Google Drive.');
    } finally {
      setLoadingDriveFiles(false);
    }
  };

  const phaseSections: Array<{
    title: string;
    fields: Array<[string, string | number | null | undefined]>;
  }> = [
    {
      title: 'Fase 1: Dokumen & Customer',
      fields: [
        ['1. Kode OS', shipment.kodeOs],
        ['Dok. OS (Kode Manual Pemilik)', shipment.kodeManualDokOs || '-'],
        ['3. Kode Customer', shipment.kodeCustomer],
        ['4. Nama Customer', shipment.namaCustomer],
        ['5. Tgl. Terima Dok', shipment.tglTerimaDok],
        ['7. No. Packinglist', shipment.noPackinglist],
        ['8. No. BL', shipment.noBl],
        ['30. Dokumen Checker', shipment.dokumenChecker],
        [
          'Status Dokumen (Checker)',
          currentDocStatus === 'Ready'
            ? 'Ready — Sudah Dibuat Checker'
            : 'Draft — Belum Dibuat Checker',
        ],
      ],
    },
    {
      title: 'Fase 2: Pelayaran & Kontainer',
      fields: [
        ['2. Ship / Vessel', shipment.ship],
        ['9. ETD', shipment.etd],
        ['10. ETA', shipment.eta],
        [
          '11. Count Down ETA',
          shipment.countDownEta !== null ? `${shipment.countDownEta} hari` : '-',
        ],
        ['12. No. Cont (Ringkasan)', shipment.noCont],
        ['BC 1.1 Manifes', isBc11Terbit ? 'Sudah Terbit' : 'Belum Terbit'],
        ['No. BC 1.1', shipment.noBc11],
        ['Tgl. BC 1.1', shipment.tglBc11],
        [
          'Status D/O Pelayaran',
          currentDoStatus === 'Sedia'
            ? 'Sedia — Siap Keluar Pelabuhan'
            : 'Belum — Menunggu D/O Pelayaran',
        ],
        ['Masa Berlaku D/O', shipment.doBerlakuSampai || '-'],
        ['Catatan Perpanjangan D/O', shipment.doCatatanPerpanjangan || '-'],
        [
          'Pengurusan Eslah / TILA (Kartu Gate)',
          `${currentGatePassStatus}${currentGatePassJenis ? ` · ${currentGatePassJenis}` : ''}${
            shipment.doGatePassNomor ? ` (${shipment.doGatePassNomor})` : ''
          }`,
        ],
        [
          'Kesediaan Trucking',
          currentTruckingStatus === 'Sedia'
            ? 'Sedia — Armada Siap Angkut'
            : 'Belum — Armada Belum Tersedia',
        ],
        ['Nama Supir', shipment.truckingNamaSupir || '-'],
        ['No. Plat Truk', shipment.truckingNoPlat || '-'],
        ['No. HP Supir', shipment.truckingNoHpSupir || '-'],
        [
          'Status Gate-Out Kontainer',
          currentGateOutStatus === 'Sudah'
            ? 'Sudah Gate-Out (Keluar Pelabuhan)'
            : 'Belum Gate-Out',
        ],
        ['Tgl. Gate-Out', shipment.gateOutTanggal || '-'],
        ['Catatan Gate-Out', shipment.gateOutCatatan || '-'],
        [
          'Ikatan Proses Dokumen Selesai',
          isContainerGateOut(shipment) && shipment.status === 'Selesai'
            ? 'Terikat — Dokumen Selesai'
            : 'Belum Terikat Selesai',
        ],
        [
          'No. Surat Jalan',
          isContainerGateOut(shipment)
            ? shipment.suratJalanNomor || generateSuratJalanNomor(shipment.kodeOs)
            : '-',
        ],
        ['Tgl. Surat Jalan', shipment.suratJalanTanggal || '-'],
        [
          'Status Tracking Surat Jalan',
          normalizeStatusSuratJalan(
            shipment.suratJalanStatus,
            currentGateOutStatus,
            shipment.status
          ),
        ],
        ['Tujuan Pengiriman', shipment.suratJalanTujuan || '-'],
        ['Penerima / PIC Gudang', shipment.suratJalanPenerima || '-'],
        ['Catatan Surat Jalan', shipment.suratJalanCatatan || '-'],
      ],
    },
    {
      title: 'Fase 3: Customs (AJU / NOPEN / SPPB)',
      fields: [
        ['13. No. AJU', shipment.noAju],
        ['14. Tgl. AJU', shipment.tglAju],
        ['15. Status', shipment.status],
        ['16. NOPEN', shipment.nopen],
        ['17. Tgl. NOPEN', shipment.tglNopen],
        ['18. Jalur', shipment.jalur || '-'],
        ['19. Kode Importir', shipment.kodeImportir],
        ['20. Shipper', shipment.shipper],
        ['21. Description', shipment.description],
        ['22. Negara Asal', shipment.negaraAsal],
        ['23. Currency', shipment.currency],
        ['24. Kurs', shipment.kurs],
        ['25. Invoice', shipment.invoice],
        ['26. BM/PDRI', shipment.bmPdri],
        ['27. SPTNP', shipment.sptnp],
        ['28. No. SPPB', shipment.noSppb],
        ['29. Tgl SPPB', shipment.tglSppb],
      ],
    },
    {
      title: 'Fase 4: Pasca-SPPB & Dokumen OS',
      fields: [
        ['31. No. SPTNP', shipment.noSptnp],
        ['32. Tgl. SPTNP', shipment.tglSptnp],
        ['33. PFPB', shipment.pfpb],
        ['34. Tgl. PFPB', shipment.tglPfpb],
        ['35. PFPD', shipment.pfpd],
        ['36. Tgl. PFPD', shipment.tglPfpd],
        ['37. ESLAH', shipment.eslah],
        ['38. Tgl. ESLAH', shipment.tglEslah],
      ],
    },
  ];

  return (
    <>
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex justify-end no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label={`Detail Shipment ${shipment.kodeOs}`}
        className="w-full max-w-2xl bg-white dark:bg-[#101522] h-full overflow-y-auto flex flex-col border-l border-transparent dark:border-white/10"
      >
        {/* Header Drawer */}
        <div className="sticky top-0 z-10 bg-[#0B2545] dark:bg-[#0D111C] text-white px-6 py-4 flex items-start justify-between gap-4 border-b border-white/10 dark:border-white/[0.08]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono-code text-xs font-bold text-[#F28C28] dark:text-violet-400">
                {shipment.kodeOs}
              </span>
              {shipment.kodeManualDokOs && (
                <span className="font-mono-code text-[11px] font-bold px-2 py-0.5 rounded bg-white/15 text-amber-200 border border-white/20">
                  Dok. OS: {shipment.kodeManualDokOs}
                </span>
              )}
              <ProcessSignalBadge shipment={shipment} compact />
              <StatusDokumenBadge statusDokumen={shipment.statusDokumen} />
              <StatusBadge status={shipment.status} />
              <JalurBadge jalur={shipment.jalur} />
              <CountdownBadge days={shipment.countDownEta} />
            </div>
            <h2 className="text-lg font-bold text-white mt-1 truncate">
              {shipment.namaCustomer}
            </h2>
            <p className="text-xs text-white/70 dark:text-slate-400">
              No. BL: {shipment.noBl} · Terakhir diubah oleh {shipment.updatedBy}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setKdiModalOpen(true)}
              title="Print Kelengkapan Dokumen Impor (KDI) / Dasi Depan Bundel MAP"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#F28C28]" />
              <span>Cetak KDI</span>
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(shipment.kodeOs)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(shipment.kodeOs)}
                aria-label={`Hapus ${shipment.kodeOs}`}
                className="inline-flex items-center justify-center p-2 rounded-lg bg-red-500/20 hover:bg-red-500/35 text-red-200 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup detail"
              className="inline-flex items-center justify-center p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Sinyal Segera Proses (ETA Tiba / BC 1.1 Terbit) */}
          {processSignal.active && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-500/40 flex items-start gap-3"
            >
              <span className="relative flex h-2.5 w-2.5 mt-1 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 dark:bg-red-500" />
              </span>
              <div>
                <div className="text-xs font-bold text-red-900 dark:text-red-200">
                  {processSignal.detailLabel}
                </div>
                <p className="text-[11px] text-red-700 dark:text-red-300/85 mt-0.5">
                  Segera proses pengajuan PIB/AJU dan penyelesaian kepabeanan sebelum SPPB terbit.
                </p>
              </div>
            </div>
          )}

          {/* Status Pembuatan Dokumen Checker (Draft / Ready) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-[#0B2545] dark:text-white">
                Status Dokumen Checker
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {currentDocStatus === 'Ready'
                  ? 'Dokumen sudah dibuat dan disiapkan oleh Checker.'
                  : 'Dokumen masih Draft / belum selesai dibuat oleh Checker.'}
              </p>
            </div>
            {canEditPhase1 && onUpdateStatusDokumen ? (
              <div
                role="group"
                aria-label="Ubah status dokumen checker"
                className="inline-flex rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#101522] p-0.5"
              >
                {(['Draft', 'Ready'] as const).map((opt) => {
                  const active = currentDocStatus === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={updatingDocStatus}
                      aria-pressed={active}
                      onClick={async () => {
                        if (active) return;
                        setUpdatingDocStatus(true);
                        try {
                          await onUpdateStatusDokumen(shipment.kodeOs, opt);
                        } finally {
                          setUpdatingDocStatus(false);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
                        active
                          ? opt === 'Ready'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-yellow-400 text-slate-950'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      {opt === 'Draft' ? 'Draft (Belum)' : 'Ready (Siap)'}
                    </button>
                  );
                })}
              </div>
            ) : (
              <StatusDokumenBadge statusDokumen={currentDocStatus} />
            )}
          </div>

          {/* Status BC 1.1 Manifes */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-[#0B2545] dark:text-white">
                Status BC 1.1 Manifes
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isBc11Terbit
                  ? `BC 1.1 telah terbit${shipment.noBc11 ? ` (No: ${shipment.noBc11})` : ''}${shipment.tglBc11 ? ` pada ${shipment.tglBc11}` : ''}.`
                  : 'Tandai jika BC 1.1 manifes pelayaran sudah terbit.'}
              </p>
            </div>
            {canEditPhase2 && onUpdateBc11 ? (
              <button
                type="button"
                disabled={updatingBc11}
                aria-pressed={isBc11Terbit}
                onClick={async () => {
                  setUpdatingBc11(true);
                  try {
                    await onUpdateBc11(
                      shipment.kodeOs,
                      !isBc11Terbit,
                      !isBc11Terbit ? shipment.noBc11 : '',
                      !isBc11Terbit ? shipment.tglBc11 || new Date().toISOString().slice(0, 10) : ''
                    );
                  } finally {
                    setUpdatingBc11(false);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-60 ${
                  isBc11Terbit
                    ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                    : 'bg-white dark:bg-[#182032] text-slate-700 dark:text-slate-200 border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#1F2940]'
                }`}
              >
                {isBc11Terbit ? 'BC 1.1 Terbit ✓' : 'Tandai BC 1.1 Terbit'}
              </button>
            ) : (
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                  isBc11Terbit
                    ? 'bg-red-100 dark:bg-red-500/20 border-red-300 dark:border-red-500/40 text-red-800 dark:text-red-200'
                    : 'bg-slate-100 dark:bg-white/[0.06] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                {isBc11Terbit ? 'Terbit' : 'Belum Terbit'}
              </span>
            )}
          </div>

          {/* Info Owner (WA/Email) & Auto Surat Penagihan Customer */}
          {onOpenBilling && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Receipt className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-[#0B2545] dark:text-white">
                    Info Owner (WA / Email) &amp; Penagihan Customer
                  </span>
                  <StatusPenagihanBadge
                    billingStatus={shipment.billingStatus}
                    shipment={shipment}
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isShipmentBillingEligible(shipment)
                    ? `${getBillingEligibilityReason(shipment)} · ${
                        buildAutoBillingFields(shipment).billingNomor
                      } (${formatRupiah(buildAutoBillingFields(shipment).billingTotal)})`
                    : 'Akan siap otomatis setelah status mencapai SPPB Terbit atau Sudah Gate-Out.'}
                </p>
              </div>
              {isShipmentBillingEligible(shipment) && (
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenBilling(shipment.kodeOs, 'owner')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>Info Owner</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenBilling(shipment.kodeOs, 'customer')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    <Receipt className="w-3 h-3" />
                    <span>Surat Penagihan</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Kesiapan D/O Pelayaran & Kontainer Keluar */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Anchor className="w-3.5 h-3.5 text-[#F28C28] dark:text-violet-400 shrink-0" />
                  <span className="text-xs font-bold text-[#0B2545] dark:text-white">
                    Kesiapan D/O Pelayaran &amp; Kontainer Keluar
                  </span>
                  <DoValidityBadge
                    doBerlakuSampai={shipment.doBerlakuSampai}
                    shipmentStatus={shipment.status}
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {currentDoStatus === 'Sedia'
                    ? 'D/O sudah tersedia dari pelayaran. Kontainer siap proses keluar pelabuhan (gate-out).'
                    : 'D/O pelayaran belum tersedia. Pantau masa berlaku atau catat kebutuhan perpanjangan D/O.'}
                </p>
                {shipment.doCatatanPerpanjangan && !editingDo && (
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#101522] border border-slate-200/80 dark:border-white/[0.06]">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Catatan D/O: </span>
                    {shipment.doCatatanPerpanjangan}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <StatusDoBadge
                  statusDo={currentDoStatus}
                  onToggle={
                    canEditPhase2 && onUpdateDoPelayaran && !updatingDo
                      ? async (nextStatus) => {
                          setUpdatingDo(true);
                          try {
                            await onUpdateDoPelayaran(shipment.kodeOs, {
                              doPelayaranStatus: nextStatus,
                            });
                          } finally {
                            setUpdatingDo(false);
                          }
                        }
                      : undefined
                  }
                />
                {canEditPhase2 && onUpdateDoPelayaran && !editingDo && (
                  <button
                    type="button"
                    onClick={() => {
                      setDoStatusDraft(currentDoStatus);
                      setDoExpDraft(shipment.doBerlakuSampai || '');
                      setDoNoteDraft(shipment.doCatatanPerpanjangan || '');
                      setGatePassStatusDraft(currentGatePassStatus);
                      setGatePassJenisDraft(currentGatePassJenis);
                      setGatePassNomorDraft(shipment.doGatePassNomor || '');
                      setTruckingStatusDraft(currentTruckingStatus);
                      setTruckingNamaDraft(shipment.truckingNamaSupir || '');
                      setTruckingPlatDraft(shipment.truckingNoPlat || '');
                      setTruckingHpDraft(shipment.truckingNoHpSupir || '');
                      setGateOutStatusDraft(currentGateOutStatus);
                      setGateOutTglDraft(shipment.gateOutTanggal || '');
                      setGateOutNoteDraft(shipment.gateOutCatatan || '');
                      setBindSelesaiDraft(true);
                      setEditingDo(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-100 dark:hover:bg-[#1F2940] text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3 text-[#F28C28] dark:text-violet-400" />
                    <span>Atur D/O</span>
                  </button>
                )}
              </div>
            </div>

            {!editingDo && (
              <div className="space-y-2.5 pt-2.5 border-t border-slate-200/80 dark:border-white/[0.06]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-[#101522] border border-slate-200/80 dark:border-white/[0.06] space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        Eslah / TILA (Kartu Gate)
                      </span>
                      <StatusGatePassBadge
                        statusGatePass={currentGatePassStatus}
                        onToggle={
                          canEditPhase2 && onUpdateDoPelayaran && !updatingDo
                            ? async (nextGate) => {
                                setUpdatingDo(true);
                                try {
                                  await onUpdateDoPelayaran(shipment.kodeOs, {
                                    doGatePassStatus: nextGate,
                                  });
                                } finally {
                                  setUpdatingDo(false);
                                }
                              }
                            : undefined
                        }
                      />
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      Jenis: <span className="font-semibold">{currentGatePassJenis || 'Belum dipilih'}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono-code">
                      No: {shipment.doGatePassNomor || '-'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white dark:bg-[#101522] border border-slate-200/80 dark:border-white/[0.06] space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        Kesediaan Trucking
                      </span>
                      <StatusTruckingBadge
                        statusTrucking={currentTruckingStatus}
                        onToggle={
                          canEditPhase2 && onUpdateDoPelayaran && !updatingDo
                            ? async (nextTruck) => {
                                setUpdatingDo(true);
                                try {
                                  await onUpdateDoPelayaran(shipment.kodeOs, {
                                    truckingStatus: nextTruck,
                                  });
                                } finally {
                                  setUpdatingDo(false);
                                }
                              }
                            : undefined
                        }
                      />
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      Supir: <span className="font-semibold">{shipment.truckingNamaSupir || '-'}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono-code">
                      Plat: {shipment.truckingNoPlat || '-'} · HP: {shipment.truckingNoHpSupir || '-'}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-[#101522] border border-emerald-500/25 dark:border-emerald-500/30 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        Gate-Out &amp; Ikatan Proses Dokumen Selesai
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        {isContainerGateOut(shipment)
                          ? `${shipment.gateOutTanggal ? `Tgl: ${shipment.gateOutTanggal} · ` : ''}${
                              shipment.status === 'Selesai'
                                ? 'Terikat ke Status Dokumen Selesai'
                                : shipment.gateOutCatatan || 'Kontainer sudah Gate-Out'
                            }`
                          : 'Klik badge untuk tandai Sudah Gate-Out, ikat Dokumen Selesai & terbitkan Surat Jalan.'}
                      </div>
                    </div>
                    <StatusGateOutBadge
                      gateOutStatus={currentGateOutStatus}
                      shipmentStatus={shipment.status}
                      onToggle={
                        canEditPhase2 && onUpdateDoPelayaran && !updatingDo
                          ? async (nextGateOut) => {
                              const wasGateOut = isContainerGateOut(shipment);
                              setUpdatingDo(true);
                              try {
                                await onUpdateDoPelayaran(shipment.kodeOs, {
                                  gateOutStatus: nextGateOut,
                                  bindDokumenSelesai: nextGateOut === 'Sudah',
                                });
                                if (!wasGateOut && nextGateOut === 'Sudah') {
                                  setSjModalOpen(true);
                                }
                              } finally {
                                setUpdatingDo(false);
                              }
                            }
                          : undefined
                      }
                    />
                  </div>

                  {isContainerGateOut(shipment) && (
                    <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono-code text-xs font-bold text-sky-700 dark:text-sky-300">
                            {shipment.suratJalanNomor || generateSuratJalanNomor(shipment.kodeOs)}
                          </span>
                          <StatusSuratJalanBadge
                            suratJalanStatus={shipment.suratJalanStatus}
                            gateOutStatus={currentGateOutStatus}
                            shipmentStatus={shipment.status}
                            onToggle={
                              canEditPhase2 && onUpdateDoPelayaran && !updatingDo
                                ? async (nextSj) => {
                                    setUpdatingDo(true);
                                    try {
                                      await onUpdateDoPelayaran(shipment.kodeOs, {
                                        suratJalanStatus: nextSj,
                                      });
                                    } finally {
                                      setUpdatingDo(false);
                                    }
                                  }
                                : undefined
                            }
                          />
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                          Tujuan: {shipment.suratJalanTujuan || `Gudang ${shipment.namaCustomer}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSjModalOpen(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          <ClipboardList className="w-3 h-3" />
                          <span>Buka Surat Jalan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => exportSuratJalanToPDF(shipment, pengaturan)}
                          aria-label={`Unduh PDF Surat Jalan ${shipment.suratJalanNomor || shipment.kodeOs}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-100 dark:hover:bg-[#1F2940] text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {editingDo && canEditPhase2 && onUpdateDoPelayaran && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const wasGateOut = isContainerGateOut(shipment);
                  setUpdatingDo(true);
                  try {
                    await onUpdateDoPelayaran(shipment.kodeOs, {
                      doPelayaranStatus: doStatusDraft,
                      doBerlakuSampai: doExpDraft,
                      doCatatanPerpanjangan: doNoteDraft,
                      doGatePassStatus: gatePassStatusDraft,
                      doGatePassJenis: gatePassJenisDraft,
                      doGatePassNomor: gatePassNomorDraft,
                      truckingStatus: truckingStatusDraft,
                      truckingNamaSupir: truckingNamaDraft,
                      truckingNoPlat: truckingPlatDraft,
                      truckingNoHpSupir: truckingHpDraft,
                      gateOutStatus: gateOutStatusDraft,
                      gateOutTanggal: gateOutTglDraft,
                      gateOutCatatan: gateOutNoteDraft,
                      bindDokumenSelesai:
                        gateOutStatusDraft === 'Sudah' ? bindSelesaiDraft : false,
                    });
                    setEditingDo(false);
                    if (!wasGateOut && gateOutStatusDraft === 'Sudah') {
                      setSjModalOpen(true);
                    }
                  } finally {
                    setUpdatingDo(false);
                  }
                }}
                className="pt-3 border-t border-slate-200 dark:border-white/[0.08] space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Status Kesiapan D/O
                    </label>
                    <select
                      aria-label="Status Kesiapan D/O"
                      value={doStatusDraft}
                      onChange={(e) => setDoStatusDraft(e.target.value as StatusDoPelayaranType)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="Belum">Belum — Menunggu D/O</option>
                      <option value="Sedia">Sedia — Siap Keluar Pelabuhan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Masa Berlaku D/O Sampai
                    </label>
                    <input
                      type="date"
                      aria-label="Masa Berlaku D/O Sampai"
                      value={doExpDraft}
                      onChange={(e) => setDoExpDraft(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Catatan Masa Berlaku &amp; Perpanjangan D/O
                  </label>
                  <textarea
                    rows={2}
                    aria-label="Catatan Masa Berlaku & Perpanjangan D/O"
                    value={doNoteDraft}
                    onChange={(e) => setDoNoteDraft(e.target.value)}
                    placeholder="Contoh: D/O berlaku s/d 20 Nov; perpanjangan ke-1 jika belum gate-out..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                {/* Pengurusan Eslah / TILA (Kartu Gate) */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.06] space-y-2">
                  <div className="text-[11px] font-bold text-[#0B2545] dark:text-violet-300">
                    Pengurusan Eslah / Buat TILA (Kartu Gate)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Status Gate Pass
                      </label>
                      <select
                        aria-label="Status Gate Pass Drawer"
                        value={gatePassStatusDraft}
                        onChange={(e) => setGatePassStatusDraft(e.target.value as StatusGatePassType)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="Belum">Belum</option>
                        <option value="Proses">Proses</option>
                        <option value="Sedia">Sedia</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Jenis Pengurusan
                      </label>
                      <select
                        aria-label="Jenis Gate Pass Drawer"
                        value={gatePassJenisDraft}
                        onChange={(e) => setGatePassJenisDraft(e.target.value as GatePassJenisType)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="">-- Pilih --</option>
                        <option value="TILA (Kartu Gate)">TILA (Kartu Gate)</option>
                        <option value="Eslah">Eslah</option>
                        <option value="Eslah & TILA">Eslah &amp; TILA</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        No. TILA / Eslah
                      </label>
                      <input
                        type="text"
                        aria-label="Nomor Gate Pass Drawer"
                        value={gatePassNomorDraft}
                        onChange={(e) => setGatePassNomorDraft(e.target.value)}
                        placeholder="TILA-NPCT1-..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs font-mono-code text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Kesediaan Trucking & Data Supir */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.06] space-y-2">
                  <div className="text-[11px] font-bold text-[#0B2545] dark:text-violet-300">
                    Kesediaan Trucking &amp; Data Supir
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Status Trucking
                      </label>
                      <select
                        aria-label="Status Trucking Drawer"
                        value={truckingStatusDraft}
                        onChange={(e) => setTruckingStatusDraft(e.target.value as StatusDoPelayaranType)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="Belum">Belum Sedia</option>
                        <option value="Sedia">Sedia (Siap Angkut)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Nama Supir
                      </label>
                      <input
                        type="text"
                        aria-label="Nama Supir Drawer"
                        value={truckingNamaDraft}
                        onChange={(e) => setTruckingNamaDraft(e.target.value)}
                        placeholder="Nama supir trailer"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        No. Plat Truk
                      </label>
                      <input
                        type="text"
                        aria-label="No Plat Truk Drawer"
                        value={truckingPlatDraft}
                        onChange={(e) => setTruckingPlatDraft(e.target.value.toUpperCase())}
                        placeholder="B 9123 UVX"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs font-mono-code text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        No. HP Supir
                      </label>
                      <input
                        type="text"
                        aria-label="No HP Supir Drawer"
                        value={truckingHpDraft}
                        onChange={(e) => setTruckingHpDraft(e.target.value)}
                        placeholder="0812-3456-7890"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs font-mono-code text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Gate-Out & Ikatan Proses Dokumen Selesai */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.06] space-y-2">
                  <div className="text-[11px] font-bold text-[#0B2545] dark:text-emerald-300">
                    Gate-Out Pelabuhan &amp; Ikatan Proses Dokumen Selesai
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Status Gate-Out
                      </label>
                      <select
                        aria-label="Status Gate-Out Drawer"
                        value={gateOutStatusDraft}
                        onChange={(e) => {
                          const v = e.target.value as StatusGateOutType;
                          setGateOutStatusDraft(v);
                          if (v === 'Sudah' && !gateOutTglDraft) {
                            setGateOutTglDraft(new Date().toISOString().slice(0, 10));
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="Belum">Belum Gate-Out</option>
                        <option value="Sudah">Sudah Gate-Out</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Tgl. Gate-Out
                      </label>
                      <input
                        type="date"
                        aria-label="Tanggal Gate-Out Drawer"
                        value={gateOutTglDraft}
                        onChange={(e) => setGateOutTglDraft(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Catatan Gate-Out
                      </label>
                      <input
                        type="text"
                        aria-label="Catatan Gate-Out Drawer"
                        value={gateOutNoteDraft}
                        onChange={(e) => setGateOutNoteDraft(e.target.value)}
                        placeholder="Gate-Out terminal..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  {gateOutStatusDraft === 'Sudah' && (
                    <label className="flex items-center gap-2 text-[11px] font-medium text-emerald-800 dark:text-emerald-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bindSelesaiDraft}
                        onChange={(e) => setBindSelesaiDraft(e.target.checked)}
                      />
                      <span>Ikat menjadi Proses Dokumen Selesai (ubah Status → Selesai &amp; lengkapi OS)</span>
                    </label>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingDo(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={updatingDo}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{updatingDo ? 'Menyimpan...' : 'Simpan D/O'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* 39 Kolom dikelompokkan per fase */}
          {phaseSections.map((sec) => (
            <section key={sec.title} className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B2545] dark:text-violet-300 border-b border-slate-200 dark:border-white/[0.08] pb-1.5">
                {sec.title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sec.fields.map(([label, val]) => (
                  <div
                    key={label}
                    className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#161D2F] border border-slate-200/70 dark:border-white/[0.06]"
                  >
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5 break-words tabular-nums">
                      {val === '' || val === null || val === undefined ? '-' : String(val)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Kolom 6 & 39: Checklist Terima Dok & Dokumen OS */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B2545] dark:text-violet-300 border-b border-slate-200 dark:border-white/[0.08] pb-1.5">
              6. Terima Dok &amp; 39. Dokumen OS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#161D2F]">
                <div className="flex items-center justify-between text-xs font-semibold text-[#0B2545] dark:text-white mb-2">
                  <span>6. Terima Dok</span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {terimaProg.checked}/{terimaProg.total}
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  {checklistItems.map((it) => {
                    const ok = Boolean(shipment.terimaDok?.items?.[it]);
                    return (
                      <li key={it} className="flex items-center gap-2">
                        {ok ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                        )}
                        <span className={ok ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}>
                          {it}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {shipment.terimaDok?.catatan && (
                  <p className="mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.06] text-[11px] text-slate-600 dark:text-slate-400">
                    Catatan: {shipment.terimaDok.catatan}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#161D2F]">
                <div className="flex items-center justify-between text-xs font-semibold text-[#0B2545] dark:text-white mb-2">
                  <span>39. Dokumen OS</span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {osProg.checked}/{osProg.total}
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  {checklistItems.map((it) => {
                    const ok = Boolean(shipment.dokumenOs?.items?.[it]);
                    return (
                      <li key={it} className="flex items-center gap-2">
                        {ok ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                        )}
                        <span className={ok ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}>
                          {it}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {shipment.dokumenOs?.catatan && (
                  <p className="mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.06] text-[11px] text-slate-600 dark:text-slate-400">
                    Catatan: {shipment.dokumenOs.catatan}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Daftar Kontainer */}
          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B2545] dark:text-violet-300 border-b border-slate-200 dark:border-white/[0.08] pb-1.5">
              <Package className="w-3.5 h-3.5" />
              <span>Daftar Kontainer ({containers.length})</span>
            </h3>
            {containers.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada nomor kontainer terdaftar.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {containers.map((c) => (
                  <div
                    key={c.id}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] text-xs font-medium text-slate-800 dark:text-slate-200 font-mono-code"
                  >
                    {c.noCont} · {c.ukuranTipe || '-'}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Dokumen Scan (Google Drive) */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/[0.08] pb-1.5">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B2545] dark:text-violet-300">
                <Paperclip className="w-3.5 h-3.5" />
                <span>Dokumen Scan Google Drive ({documents.length})</span>
              </h3>
              <div className="flex items-center gap-2">
                {googleDriveUserEmail ? (
                  <>
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded">
                      Drive: {googleDriveUserEmail}
                    </span>
                    {onListDriveFiles && (
                      <button
                        type="button"
                        onClick={handleBrowseDrive}
                        disabled={loadingDriveFiles}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <FolderOpen className="w-3 h-3 text-[#F28C28] dark:text-violet-400" />
                        <span>{loadingDriveFiles ? 'Memuat...' : 'Lihat File Drive'}</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {pengaturan?.gasWebAppUrl?.trim() && (
                      <span className="text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-500/30 px-2 py-0.5 rounded">
                        Via Endpoint GAS
                      </span>
                    )}
                    {onConnectGoogleDrive && (
                      <GoogleSignInButton
                        onClick={onConnectGoogleDrive}
                        disabled={driveConnecting}
                        label={driveConnecting ? 'Menghubungkan...' : 'Sign in with Google'}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            {pengaturan && (() => {
              const driveDest = describeRegisteredDriveDestination(
                pengaturan,
                googleDriveUserEmail
              );
              return (
                <div
                  data-testid="drawer-drive-destination-info"
                  className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.07] text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    Tujuan Drive:{' '}
                    <strong className="text-slate-800 dark:text-white">
                      {driveDest.registeredGmail || 'Akun Google Terhubung / Pemilik Script'}
                    </strong>
                    {' · Folder: '}
                    <span className="font-mono-code font-semibold">{driveDest.folderLabel}</span>
                    {` / ${shipment.kodeOs}`}
                  </span>
                  {driveDest.folderUrl && (
                    <a
                      href={driveDest.folderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold hover:underline"
                    >
                      <span>Buka Folder Induk</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              );
            })()}

            {driveListError && (
              <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 rounded-lg px-3 py-2">
                {driveListError}
              </div>
            )}

            {driveFiles !== null && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#0B2545] dark:text-white">
                  <span>File Terbaru di Google Drive Anda ({driveFiles.length})</span>
                  <button
                    type="button"
                    onClick={() => setDriveFiles(null)}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
                {driveFiles.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tidak ada file ditemukan di Google Drive.</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {driveFiles.map((df) => (
                      <div
                        key={df.id}
                        className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-200/70 dark:border-white/[0.06] last:border-b-0"
                      >
                        <span className="truncate text-slate-700 dark:text-slate-300">{df.name}</span>
                        {df.webViewLink && (
                          <a
                            href={df.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-semibold text-[#F28C28] dark:text-violet-400 hover:underline shrink-0"
                          >
                            Buka
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {documents.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada dokumen scan diunggah.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.07] text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                        <span className="truncate">
                          {doc.jenisDokumen} — {doc.namaFile}
                        </span>
                        {doc.source === 'google-drive' && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                            Drive
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Diupload oleh {doc.user} · {doc.waktuUpload.slice(0, 16).replace('T', ' ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={doc.linkDrive}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#F28C28] dark:text-violet-400 hover:underline shrink-0"
                      >
                        <span>Buka Drive</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      {canUpload && onDeleteDocument && (
                        <button
                          type="button"
                          onClick={() => onDeleteDocument(doc)}
                          aria-label={`Hapus dokumen ${doc.namaFile}`}
                          className="p-1.5 rounded bg-red-50 dark:bg-red-500/15 hover:bg-red-100 dark:hover:bg-red-500/25 text-red-700 dark:text-red-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canUpload && (
              <form
                onSubmit={handleUploadSubmit}
                className="flex flex-wrap items-center gap-2 pt-2"
              >
                <select
                  aria-label="Jenis dokumen upload"
                  value={docJenis}
                  onChange={(e) => setDocJenis(e.target.value)}
                  className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100"
                >
                  {checklistItems.map((it) => (
                    <option key={it} value={it}>
                      {it}
                    </option>
                  ))}
                  <option value="SPPB Resmi">SPPB Resmi</option>
                  <option value="SPTNP / PFPB / PFPD">SPTNP / PFPB / PFPD</option>
                </select>
                <input
                  type="file"
                  aria-label="Pilih file scan dokumen"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setSelectedFile(f);
                    setSelectedFileName(f?.name || '');
                  }}
                  className="text-xs text-slate-600 dark:text-slate-300 flex-1 min-w-[160px]"
                />
                <button
                  type="submit"
                  disabled={!selectedFileName || busy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B2545] hover:bg-[#133863] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{busy ? 'Mengupload...' : 'Upload'}</span>
                </button>
              </form>
            )}
          </section>

          {/* Pengeluaran Operasional Terkait Dokumen OS */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/[0.08] pb-1.5">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B2545] dark:text-violet-300">
                <Wallet className="w-3.5 h-3.5" />
                <span>
                  Pengeluaran Operasional ({opsExpenses.length}) ·{' '}
                  {formatRupiahOps(
                    opsExpenses.reduce((acc, item) => acc + (Number(item.nominal) || 0), 0)
                  )}
                </span>
              </h3>
              {onOpenKeuanganOps && (
                <button
                  type="button"
                  onClick={() => onOpenKeuanganOps(shipment.kodeOs)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0B2545] dark:bg-violet-600 text-white text-[11px] font-semibold hover:opacity-95 cursor-pointer"
                >
                  <Wallet className="w-3 h-3" />
                  <span>Kelola / Catat Biaya Ops</span>
                </button>
              )}
            </div>

            {opsExpenses.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Belum ada pengeluaran operasional tercatat untuk dokumen {shipment.kodeOs}.
              </p>
            ) : (
              <div className="space-y-2">
                {opsExpenses.map((exp) => {
                  const stMeta = getStatusPengeluaranMeta(exp.statusPengeluaran);
                  return (
                    <div
                      key={exp.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.07] text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono-code font-bold text-[#0B2545] dark:text-violet-300">
                            {exp.kodePengeluaran}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${stMeta.badgeClass}`}
                          >
                            {stMeta.shortLabel}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {exp.kategori}
                          </span>
                        </div>
                        <div className="text-slate-800 dark:text-slate-200 mt-0.5">
                          {exp.keterangan}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Ops: {exp.petugasOps} · {exp.tanggal} ·{' '}
                          {hasBuktiPengeluaran(exp)
                            ? `Bukti: ${exp.buktiNamaFile || 'Tersedia'}`
                            : 'Belum ada bukti'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatRupiahOps(exp.nominal)}
                        </span>
                        <button
                          type="button"
                          title="Cetak PDF Tanda Terima"
                          aria-label={`Unduh PDF tanda terima ${exp.noTandaTerima}`}
                          onClick={() => exportTandaTerimaOpsPDF(exp, shipment, pengaturan)}
                          className="p-1.5 rounded border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-[#1F2940] text-[#0B2545] dark:text-violet-300 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Catatan / Komentar */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B2545] dark:text-violet-300 border-b border-slate-200 dark:border-white/[0.08] pb-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Catatan &amp; Komentar ({comments.length})</span>
            </h3>
            {comments.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada catatan pada shipment ini.</p>
            ) : (
              <div className="space-y-2">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.07] text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{c.user}</span>
                      <span>{c.waktu.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">{c.isi}</p>
                  </div>
                ))}
              </div>
            )}

            {canComment && (
              <form onSubmit={handleNoteSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Tambah catatan operasional atau dokumen..."
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#F28C28] dark:focus:border-violet-500"
                />
                <button
                  type="submit"
                  disabled={!noteText.trim() || busy}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim</span>
                </button>
              </form>
            )}
          </section>

          {/* Riwayat Perubahan */}
          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B2545] dark:text-violet-300 border-b border-slate-200 dark:border-white/[0.08] pb-1.5">
              <History className="w-3.5 h-3.5" />
              <span>Riwayat Perubahan ({logs.length})</span>
            </h3>
            {logs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada riwayat perubahan.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {logs.map((l) => (
                  <div
                    key={l.id}
                    className="text-[11px] text-slate-600 dark:text-slate-400 py-1.5 border-b border-slate-100 dark:border-white/[0.06]"
                  >
                    <span className="tabular-nums text-slate-400 dark:text-slate-500">
                      {l.waktu.slice(0, 16).replace('T', ' ')}
                    </span>{' '}
                    · <strong className="text-slate-800 dark:text-slate-200">{l.user}</strong> mengubah{' '}
                    <span className="font-mono-code text-[#0B2545] dark:text-violet-300">{l.kolom}</span>:{' '}
                    <span className="line-through text-slate-400 dark:text-slate-500">{l.nilaiLama || '-'}</span> &rarr;{' '}
                    <span className="font-medium text-slate-800 dark:text-slate-200">{l.nilaiBaru || '-'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {sjModalOpen && onUpdateDoPelayaran && (
        <SuratJalanModal
          shipment={shipment}
          pengaturan={pengaturan}
          canEdit={canEditPhase2}
          onClose={() => setSjModalOpen(false)}
          onOpenBilling={onOpenBilling}
          onSaveSuratJalan={async (kodeOs, sjPayload) => {
            await onUpdateDoPelayaran(kodeOs, sjPayload);
          }}
        />
      )}
    </div>

    <KdiPrintModal
      isOpen={kdiModalOpen}
      initialShipment={shipment}
      pengaturan={pengaturan}
      pengeluaranOps={opsExpenses}
      onClose={() => setKdiModalOpen(false)}
    />
    </>
  );
}
