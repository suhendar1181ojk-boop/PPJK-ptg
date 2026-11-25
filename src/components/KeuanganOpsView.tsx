import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Lock,
  MessageCircle,
  Paperclip,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  Importir,
  KategoriPengeluaranOps,
  MetodePembayaranOps,
  Pengaturan,
  PengeluaranOpsFilterCriteria,
  PengeluaranOpsItem,
  SessionUser,
  Shipment,
  StatusPengeluaranOps,
  UserAccount,
} from '../types/ppjk';
import {
  buildTandaTerimaOpsWhatsappUrl,
  computePengeluaranOpsSummary,
  filterPengeluaranOps,
  formatRupiahOps,
  getStatusPengeluaranMeta,
  hasBuktiPengeluaran,
  KATEGORI_PENGELUARAN_OPS,
  METODE_PEMBAYARAN_OPS,
  NON_OS_KODE,
  prepareProofFileDataUrl,
  STATUS_PENGELUARAN_OPS,
  validatePengeluaranOpsInput,
  type PengeluaranOpsInputPayload,
} from '../utils/pengeluaranOpsLogic';
import {
  exportPengeluaranOpsToExcel,
  exportPengeluaranOpsToPDF,
  exportTandaTerimaOpsPDF,
} from '../utils/exportUtils';
import { canPerformAction, canUserViewKeuanganOps, getPpjkIdentity } from '../utils/ppjkLogic';
import { describeRegisteredDriveDestination } from '../utils/googleDriveFolderLogic';
import { useCardCollapse } from '../contexts/CardCollapseContext';
import { CardWindowToggleButton, ModuleCardBatchToggle } from './CardWindowControls';
import { DklPrintModal } from './DklPrintModal';
import { createPlaceholderNonOsShipment } from '../utils/dklCoverLogic';

interface KeuanganOpsViewProps {
  items: PengeluaranOpsItem[];
  shipments: Shipment[];
  importirs?: Importir[];
  users: UserAccount[];
  pengaturan: Pengaturan;
  session: SessionUser;
  googleDriveEmail?: string;
  initialFilterKodeOs?: string;
  onSavePengeluaran: (
    payload: PengeluaranOpsInputPayload,
    isNew: boolean,
    proofFile?: File
  ) => Promise<void>;
  onDeletePengeluaran: (id: string) => Promise<void>;
  onOpenShipmentDetail: (kodeOs: string) => void;
}

type KeuanganSubTab = 'list' | 'by-dokumen' | 'by-petugas';

interface FormDraftState {
  id?: string;
  kodePengeluaran?: string;
  noTandaTerima?: string;
  kodeOs: string;
  tanggal: string;
  kategori: KategoriPengeluaranOps;
  keterangan: string;
  nominal: string;
  metodePembayaran: MetodePembayaranOps;
  statusPengeluaran: StatusPengeluaranOps;
  petugasOps: string;
  diberikanOleh: string;
  buktiNamaFile: string;
  buktiMimeType: string;
  buktiDataUrl: string;
  buktiLinkDrive: string;
  driveFileId: string;
  source?: 'google-drive' | 'offline-local' | 'simulasi';
  catatanAudit: string;
}

export const KeuanganOpsView: React.FC<KeuanganOpsViewProps> = ({
  items,
  shipments,
  importirs = [],
  users,
  pengaturan,
  session,
  googleDriveEmail,
  initialFilterKodeOs = '',
  onSavePengeluaran,
  onDeletePengeluaran,
  onOpenShipmentDetail,
}) => {
  const canViewModule = canUserViewKeuanganOps(session, pengaturan);
  const canManage = canViewModule && canPerformAction(session.role, 'manage_pengeluaran_ops');
  const canDelete = canViewModule && canPerformAction(session.role, 'delete_pengeluaran_ops');
  const identity = useMemo(() => getPpjkIdentity(pengaturan), [pengaturan]);
  const { isCollapsed } = useCardCollapse();

  const [subTab, setSubTab] = useState<KeuanganSubTab>('list');
  const [search, setSearch] = useState('');
  const [periodMode, setPeriodMode] = useState<'all' | 'month' | 'range'>('all');
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterKodeOs, setFilterKodeOs] = useState(initialFilterKodeOs);
  const [filterPetugas, setFilterPetugas] = useState('');
  const [filterKategori, setFilterKategori] = useState<'' | KategoriPengeluaranOps>('');
  const [filterStatus, setFilterStatus] = useState<'' | StatusPengeluaranOps>('');
  const [buktiFilter, setBuktiFilter] = useState<'all' | 'with-bukti' | 'missing-bukti'>('all');

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(true);
  const [draft, setDraft] = useState<FormDraftState | null>(null);
  const [pendingProofFile, setPendingProofFile] = useState<File | undefined>(undefined);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [proofPrepNote, setProofPrepNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [previewItem, setPreviewItem] = useState<PengeluaranOpsItem | null>(null);
  const [dklTargetKodeOs, setDklTargetKodeOs] = useState<string | null>(null);

  const shipmentMap = useMemo(() => {
    const map = new Map<string, Shipment>();
    for (const s of shipments) {
      map.set(s.kodeOs.trim().toUpperCase(), s);
    }
    return map;
  }, [shipments]);

  const petugasSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) {
      if (u.aktif && (u.role === 'Operasional' || u.role === 'Checker' || u.role === 'Admin')) {
        set.add(u.nama);
      }
    }
    for (const item of items) {
      if (item.petugasOps?.trim()) set.add(item.petugasOps.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [users, items]);

  const filterCriteria: PengeluaranOpsFilterCriteria = useMemo(
    () => ({
      search,
      periodMode,
      month: monthFilter,
      dateFrom,
      dateTo,
      kodeOs: filterKodeOs,
      petugasOps: filterPetugas,
      kategori: filterKategori,
      statusPengeluaran: filterStatus,
      buktiFilter,
    }),
    [
      search,
      periodMode,
      monthFilter,
      dateFrom,
      dateTo,
      filterKodeOs,
      filterPetugas,
      filterKategori,
      filterStatus,
      buktiFilter,
    ]
  );

  const filteredItems = useMemo(
    () => filterPengeluaranOps(items, filterCriteria),
    [items, filterCriteria]
  );

  const summary = useMemo(
    () => computePengeluaranOpsSummary(filteredItems, shipments),
    [filteredItems, shipments]
  );

  const hasActiveFilters =
    Boolean(search.trim()) ||
    periodMode !== 'all' ||
    Boolean(filterKodeOs) ||
    Boolean(filterPetugas) ||
    Boolean(filterKategori) ||
    Boolean(filterStatus) ||
    buktiFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setPeriodMode('all');
    setDateFrom('');
    setDateTo('');
    setFilterKodeOs('');
    setFilterPetugas('');
    setFilterKategori('');
    setFilterStatus('');
    setBuktiFilter('all');
  };

  const openCreateModal = (presetKodeOs = '') => {
    const defaultOs =
      presetKodeOs ||
      filterKodeOs ||
      (shipments.length > 0 ? shipments[0].kodeOs : NON_OS_KODE);
    setIsNewRecord(true);
    setPendingProofFile(undefined);
    setFormErrors({});
    setProofPrepNote('');
    setDraft({
      kodeOs: defaultOs,
      tanggal: new Date().toISOString().slice(0, 10),
      kategori: 'D/O & Pelayaran',
      keterangan: '',
      nominal: '',
      metodePembayaran: 'Kas Tunai',
      statusPengeluaran: 'Sudah Dibayar',
      petugasOps: petugasSuggestions[0] || '',
      diberikanOleh: session.nama,
      buktiNamaFile: '',
      buktiMimeType: '',
      buktiDataUrl: '',
      buktiLinkDrive: '',
      driveFileId: '',
      catatanAudit: '',
    });
    setFormModalOpen(true);
  };

  const openEditModal = (item: PengeluaranOpsItem) => {
    setIsNewRecord(false);
    setPendingProofFile(undefined);
    setFormErrors({});
    setProofPrepNote('');
    setDraft({
      id: item.id,
      kodePengeluaran: item.kodePengeluaran,
      noTandaTerima: item.noTandaTerima,
      kodeOs: item.kodeOs,
      tanggal: item.tanggal,
      kategori: item.kategori,
      keterangan: item.keterangan,
      nominal: String(item.nominal),
      metodePembayaran: item.metodePembayaran,
      statusPengeluaran: item.statusPengeluaran,
      petugasOps: item.petugasOps,
      diberikanOleh: item.diberikanOleh,
      buktiNamaFile: item.buktiNamaFile || '',
      buktiMimeType: item.buktiMimeType || '',
      buktiDataUrl: item.buktiDataUrl || '',
      buktiLinkDrive: item.buktiLinkDrive || '',
      driveFileId: item.driveFileId || '',
      source: item.source,
      catatanAudit: item.catatanAudit || '',
    });
    setFormModalOpen(true);
  };

  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    setPendingProofFile(file);
    setProofPrepNote('Memproses lampiran bukti untuk penyimpanan offline/Drive...');
    const prep = await prepareProofFileDataUrl(file);
    const driveDest = describeRegisteredDriveDestination(pengaturan, googleDriveEmail);
    const canDriveUpload = driveDest.hasDirectOrGasDestination;
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            buktiNamaFile: file.name,
            buktiMimeType: file.type || 'application/octet-stream',
            buktiDataUrl: prep.dataUrl || '',
            source: canDriveUpload ? 'google-drive' : 'offline-local',
          }
        : prev
    );
    setProofPrepNote(
      prep.note ||
        (canDriveUpload
          ? `Siap upload ke folder Google Drive (${driveDest.registeredGmail || driveDest.folderLabel}) & preview offline.`
          : 'Lampiran siap disimpan secara offline-first ke IndexedDB.')
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;

    const numericNominal = Number(String(draft.nominal).replace(/[^\d]/g, ''));
    const linkedShip = shipmentMap.get(draft.kodeOs.trim().toUpperCase());

    const payload: PengeluaranOpsInputPayload = {
      id: draft.id,
      kodePengeluaran: draft.kodePengeluaran,
      noTandaTerima: draft.noTandaTerima,
      kodeOs: draft.kodeOs,
      noBl: linkedShip?.noBl || '',
      namaCustomer: linkedShip?.namaCustomer || '',
      tanggal: draft.tanggal,
      kategori: draft.kategori,
      keterangan: draft.keterangan,
      nominal: numericNominal,
      metodePembayaran: draft.metodePembayaran,
      statusPengeluaran: draft.statusPengeluaran,
      petugasOps: draft.petugasOps,
      diberikanOleh: draft.diberikanOleh,
      buktiNamaFile: draft.buktiNamaFile,
      buktiMimeType: draft.buktiMimeType,
      buktiDataUrl: draft.buktiDataUrl,
      buktiLinkDrive: draft.buktiLinkDrive,
      driveFileId: draft.driveFileId,
      source: draft.source,
      catatanAudit: draft.catatanAudit,
    };

    const validation = validatePengeluaranOpsInput(payload);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      await onSavePengeluaran(payload, isNewRecord, pendingProofFile);
      setFormModalOpen(false);
      setDraft(null);
      setPendingProofFile(undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickMarkSettled = async (item: PengeluaranOpsItem) => {
    if (!canManage) return;
    await onSavePengeluaran(
      {
        ...item,
        statusPengeluaran: 'Selesai / Dipertanggungjawabkan',
      },
      false
    );
  };

  const sortedShipments = useMemo(
    () => [...shipments].sort((a, b) => b.kodeOs.localeCompare(a.kodeOs)),
    [shipments]
  );

  const kopModuleCardIds = useMemo(() => {
    const base = [
      'kop-header-banner',
      'kop-kpi-total',
      'kop-kpi-kasbon',
      'kop-kpi-settled',
      'kop-kpi-bukti',
      'kop-filter-bar',
    ];
    if (subTab === 'list') base.push('kop-list-card');
    else if (subTab === 'by-dokumen') base.push('kop-bydoc-card');
    else if (subTab === 'by-petugas') {
      summary.byPetugas.forEach((p) => base.push(`kop-petugas-${p.petugasOps}`));
    }
    return base;
  }, [subTab, summary.byPetugas]);

  if (!canViewModule) {
    return (
      <div
        data-testid="keuangan-ops-access-denied"
        className="rounded-2xl bg-white dark:bg-[#131926] border border-amber-200 dark:border-amber-500/30 p-8 text-center space-y-3 shadow-sm"
      >
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6 text-amber-600 dark:text-amber-300" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Akses Terproteksi — Keuangan Pengeluaran Operasional
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
          Tampilan <strong>Per Dokumen OS · Bukti &amp; Tanda Terima Ops</strong> diproteksi dari akun{' '}
          <strong>{session.role}</strong> dan hanya dapat dilihat oleh{' '}
          <strong>Owner, Admin, Operasional, dan Manajer</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl bg-[#0B2545] dark:bg-violet-600/25 border border-[#0B2545]/20 dark:border-violet-500/35 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-[#F28C28] dark:text-violet-300" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Keuangan Pengeluaran Operasional
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 whitespace-nowrap">
                  Per Dokumen OS · Bukti & Tanda Terima Ops
                </span>
              </div>
              {!isCollapsed('kop-header-banner') && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Catat setiap biaya operasional per dokumen shipment beserta keterangan, petugas ops penerima dana, lampiran bukti pembayaran, serta cetak PDF Tanda Terima resmi.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
            <ModuleCardBatchToggle cardIds={kopModuleCardIds} moduleName="keuangan-ops" />
            <CardWindowToggleButton cardId="kop-header-banner" label="Header Keuangan Ops" compact />
            {!isCollapsed('kop-header-banner') && (
              <>
                <button
                  type="button"
                  data-testid="btn-cetak-dkl-header"
                  onClick={() =>
                    setDklTargetKodeOs(
                      filterKodeOs ||
                        summary.byDokumen[0]?.kodeOs ||
                        sortedShipments[0]?.kodeOs ||
                        NON_OS_KODE
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-xs font-semibold text-amber-800 dark:text-amber-200 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5 text-[#D97719] dark:text-amber-300" />
                  <span>Cetak DKL</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportPengeluaranOpsToExcel(filteredItems, summary, shipments)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Ekspor Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportPengeluaranOpsToPDF(filteredItems, summary, shipments, pengaturan)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Ekspor PDF</span>
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => openCreateModal()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B2545] dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 hover:bg-[#143764] text-white text-xs font-semibold shadow-sm cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4 text-[#F28C28] dark:text-white" />
                    <span>Catat Pengeluaran Ops</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div
        data-testid="keuangan-ops-access-banner"
        className="flex items-start gap-2.5 px-3.5 py-2 rounded-xl bg-sky-50/80 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/25 text-xs text-sky-900 dark:text-sky-200"
      >
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-300" />
        <div>
          <span className="font-semibold">Proteksi Tampilan ({session.role}):</span>{' '}
          {canManage
            ? 'Keuangan Pengeluaran Operasional (Per Dokumen OS · Bukti & Tanda Terima Ops) hanya dapat dilihat oleh Owner, Admin, Operasional, dan Manajer (terproteksi dari Checker).'
            : 'Mode lihat & pantau khusus Manajer — tampilan terproteksi dari Checker dan hanya dapat dilihat oleh Owner, Admin, Operasional, dan Manajer.'}
        </div>
      </div>

      {/* KPI Filter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 items-start">
        <div
          className={`rounded-xl p-4 border transition-all ${
            !filterStatus && buktiFilter === 'all'
              ? 'bg-white dark:bg-[#131926] border-[#0B2545]/40 dark:border-violet-500/45 shadow-sm'
              : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-white/[0.08] hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setFilterStatus('');
                setBuktiFilter('all');
              }}
              className="text-left min-w-0 flex-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Wallet className="w-4 h-4 text-[#0B2545] dark:text-violet-400 shrink-0" />
                <span className="truncate">Total Pengeluaran Ops</span>
              </div>
              <div className={`${isCollapsed('kop-kpi-total') ? 'text-base' : 'text-xl'} font-bold text-slate-900 dark:text-white mt-1.5 tabular-nums`}>
                {formatRupiahOps(summary.totalNominal)}
              </div>
            </button>
            <CardWindowToggleButton cardId="kop-kpi-total" label="Total Pengeluaran Ops" compact />
          </div>
          {!isCollapsed('kop-kpi-total') && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {summary.totalTransaksi} transaksi · {summary.dokumenTercatatCount} dokumen OS
            </div>
          )}
        </div>

        <div
          className={`rounded-xl p-4 border transition-all ${
            filterStatus === 'Uang Muka / Kasbon'
              ? 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-400 dark:border-amber-500/50 shadow-sm'
              : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-white/[0.08] hover:border-amber-300'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setFilterStatus((prev) =>
                  prev === 'Uang Muka / Kasbon' ? '' : 'Uang Muka / Kasbon'
                )
              }
              className="text-left min-w-0 flex-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                <Receipt className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">Uang Muka / Kasbon Ops</span>
              </div>
              <div className={`${isCollapsed('kop-kpi-kasbon') ? 'text-base' : 'text-xl'} font-bold text-slate-900 dark:text-white mt-1.5 tabular-nums`}>
                {formatRupiahOps(summary.totalKasbonNominal)}
              </div>
            </button>
            <CardWindowToggleButton cardId="kop-kpi-kasbon" label="Uang Muka atau Kasbon" compact />
          </div>
          {!isCollapsed('kop-kpi-kasbon') && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {summary.kasbonCount} kasbon menunggu pertanggungjawaban
            </div>
          )}
        </div>

        <div
          className={`rounded-xl p-4 border transition-all ${
            filterStatus === 'Selesai / Dipertanggungjawabkan'
              ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-400 dark:border-emerald-500/50 shadow-sm'
              : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-white/[0.08] hover:border-emerald-300'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setFilterStatus((prev) =>
                  prev === 'Selesai / Dipertanggungjawabkan'
                    ? ''
                    : 'Selesai / Dipertanggungjawabkan'
                )
              }
              className="text-left min-w-0 flex-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Sudah Dibayar & Selesai</span>
              </div>
              <div className={`${isCollapsed('kop-kpi-settled') ? 'text-base' : 'text-xl'} font-bold text-slate-900 dark:text-white mt-1.5 tabular-nums`}>
                {formatRupiahOps(summary.totalSudahDibayarNominal + summary.totalSelesaiNominal)}
              </div>
            </button>
            <CardWindowToggleButton cardId="kop-kpi-settled" label="Sudah Dibayar dan Selesai" compact />
          </div>
          {!isCollapsed('kop-kpi-settled') && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {summary.selesaiCount} selesai · {summary.sudahDibayarCount} sudah dibayar
            </div>
          )}
        </div>

        <div
          className={`rounded-xl p-4 border transition-all ${
            buktiFilter === 'missing-bukti'
              ? 'bg-rose-50/70 dark:bg-rose-500/10 border-rose-400 dark:border-rose-500/50 shadow-sm'
              : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-white/[0.08] hover:border-rose-300'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setBuktiFilter((prev) => (prev === 'missing-bukti' ? 'all' : 'missing-bukti'))
              }
              className="text-left min-w-0 flex-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <Paperclip className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                <span className="truncate">Kelengkapan Bukti / Nota</span>
              </div>
              <div className={`${isCollapsed('kop-kpi-bukti') ? 'text-base' : 'text-xl'} font-bold text-slate-900 dark:text-white mt-1.5 tabular-nums`}>
                {summary.denganBuktiCount} / {summary.totalTransaksi} Bukti
              </div>
            </button>
            <CardWindowToggleButton cardId="kop-kpi-bukti" label="Kelengkapan Bukti" compact />
          </div>
          {!isCollapsed('kop-kpi-bukti') && (
            <div className="text-[11px] text-rose-600 dark:text-rose-300 mt-1 tabular-nums">
              {summary.belumAdaBuktiCount} transaksi belum ada lampiran bukti
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar & Sub-tabs */}
      <div className="rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.08] p-4 space-y-3.5 shadow-sm">
        <div className={`flex flex-wrap items-center justify-between gap-2 ${!isCollapsed('kop-filter-bar') ? 'border-b border-slate-200 dark:border-white/[0.08] pb-3' : ''}`}>
          <div role="tablist" aria-label="Tampilan Keuangan Operasional" className="flex flex-wrap gap-1.5">
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'list'}
              onClick={() => setSubTab('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subTab === 'list'
                  ? 'bg-[#0B2545] dark:bg-violet-600 text-white'
                  : 'bg-slate-100 dark:bg-[#182032] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1F2940]'
              }`}
            >
              Daftar Pengeluaran ({filteredItems.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'by-dokumen'}
              onClick={() => setSubTab('by-dokumen')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subTab === 'by-dokumen'
                  ? 'bg-[#0B2545] dark:bg-violet-600 text-white'
                  : 'bg-slate-100 dark:bg-[#182032] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1F2940]'
              }`}
            >
              Rekap per Dokumen OS ({summary.byDokumen.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'by-petugas'}
              onClick={() => setSubTab('by-petugas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subTab === 'by-petugas'
                  ? 'bg-[#0B2545] dark:bg-violet-600 text-white'
                  : 'bg-slate-100 dark:bg-[#182032] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1F2940]'
              }`}
            >
              Rekap Petugas Ops ({summary.byPetugas.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            )}
            <CardWindowToggleButton cardId="kop-filter-bar" label="Filter Keuangan Ops" compact />
          </div>
        </div>

        {!isCollapsed('kop-filter-bar') && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
          <div className="sm:col-span-2 lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Cari pengeluaran operasional"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode KOP, tanda terima, OS, B/L, keterangan, petugas..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40"
            />
          </div>

          <select
            aria-label="Filter Kode OS"
            value={filterKodeOs}
            onChange={(e) => setFilterKodeOs(e.target.value)}
            className="lg:col-span-2 min-w-0 px-2.5 pr-7 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100 truncate"
          >
            <option value="">Semua Dokumen OS</option>
            {sortedShipments.map((s) => (
              <option key={s.kodeOs} value={s.kodeOs}>
                {s.kodeOs} · {s.namaCustomer}
              </option>
            ))}
            <option value={NON_OS_KODE}>{NON_OS_KODE}</option>
          </select>

          <select
            aria-label="Filter Petugas Ops"
            value={filterPetugas}
            onChange={(e) => setFilterPetugas(e.target.value)}
            className="lg:col-span-2 min-w-0 px-2.5 pr-7 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100 truncate"
          >
            <option value="">Semua Petugas Ops</option>
            {petugasSuggestions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Kategori Biaya"
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value as '' | KategoriPengeluaranOps)}
            className="lg:col-span-2 min-w-0 px-2.5 pr-7 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100 truncate"
          >
            <option value="">Semua Kategori</option>
            {KATEGORI_PENGELUARAN_OPS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Periode"
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value as 'all' | 'month' | 'range')}
            className="lg:col-span-2 min-w-0 px-2.5 pr-7 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100 truncate"
          >
            <option value="all">Semua Periode</option>
            <option value="month">Per Bulan</option>
            <option value="range">Rentang Tanggal</option>
          </select>
        </div>

        {(periodMode !== 'all' || filterStatus || buktiFilter !== 'all') && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            {periodMode === 'month' && (
              <input
                type="month"
                aria-label="Pilih Bulan"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
              />
            )}
            {periodMode === 'range' && (
              <>
                <input
                  type="date"
                  aria-label="Dari Tanggal"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                />
                <span className="text-slate-400">s/d</span>
                <input
                  type="date"
                  aria-label="Sampai Tanggal"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                />
              </>
            )}
            <select
              aria-label="Filter Status Pengeluaran"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as '' | StatusPengeluaranOps)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="">Semua Status</option>
              {STATUS_PENGELUARAN_OPS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter Bukti"
              value={buktiFilter}
              onChange={(e) =>
                setBuktiFilter(e.target.value as 'all' | 'with-bukti' | 'missing-bukti')
              }
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="all">Semua Lampiran Bukti</option>
              <option value="with-bukti">Sudah Ada Bukti</option>
              <option value="missing-bukti">Belum Ada Bukti</option>
            </select>
          </div>
        )}
          </>
        )}
      </div>

      {/* Sub-tab 1: Daftar Pengeluaran */}
      {subTab === 'list' && (
        <div className="rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-[#182032]/70">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Daftar Pengeluaran Operasional ({filteredItems.length} transaksi)
            </div>
            <CardWindowToggleButton cardId="kop-list-card" label="Daftar Pengeluaran" />
          </div>
          {!isCollapsed('kop-list-card') && (filteredItems.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <Wallet className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Belum ada catatan pengeluaran operasional yang cocok
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Catat biaya D/O, gate pass, behandle, atau kasbon petugas ops agar terekam rapi per dokumen.
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => openCreateModal()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B2545] dark:bg-violet-600 text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Catat Pengeluaran Ops Baru</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#182032] border-b border-slate-200 dark:border-white/[0.08] text-[10.5px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    <th className="pl-3.5 pr-2 py-2.5 whitespace-nowrap">Kode / Tanda Terima</th>
                    <th className="px-2 py-2.5">Dokumen OS & Customer</th>
                    <th className="px-2 py-2.5">Kategori & Keterangan</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap">Nominal</th>
                    <th className="px-2 py-2.5">Petugas Ops</th>
                    <th className="px-2 py-2.5">Status & Bukti</th>
                    <th className="pl-2 pr-3.5 py-2.5 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                  {filteredItems.map((item) => {
                    const statusMeta = getStatusPengeluaranMeta(item.statusPengeluaran);
                    const hasProof = hasBuktiPengeluaran(item);
                    const linkedShip = shipmentMap.get(item.kodeOs.trim().toUpperCase());

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors align-top"
                      >
                        <td className="pl-3.5 pr-2 py-2.5 whitespace-nowrap">
                          <div className="font-mono-code font-bold text-[#0B2545] dark:text-violet-300 text-[11.5px]">
                            {item.kodePengeluaran}
                          </div>
                          <div className="text-[10.5px] font-mono-code text-slate-500 dark:text-slate-400">
                            {item.noTandaTerima}
                          </div>
                          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            {item.tanggal}
                          </div>
                        </td>

                        <td className="px-2 py-2.5 max-w-[175px]">
                          {linkedShip ? (
                            <button
                              type="button"
                              onClick={() => onOpenShipmentDetail(linkedShip.kodeOs)}
                              className="font-mono-code font-semibold text-[#F28C28] dark:text-violet-300 hover:underline cursor-pointer text-left text-[11.5px]"
                            >
                              {item.kodeOs}
                            </button>
                          ) : (
                            <span className="font-mono-code font-semibold text-slate-700 dark:text-slate-300 text-[11.5px]">
                              {item.kodeOs}
                            </span>
                          )}
                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate text-[11.5px]">
                            {linkedShip?.namaCustomer || item.namaCustomer || 'Biaya Umum Operasional'}
                          </div>
                          {(linkedShip?.noBl || item.noBl) && (
                            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono-code truncate">
                              B/L: {linkedShip?.noBl || item.noBl}
                            </div>
                          )}
                        </td>

                        <td className="px-2 py-2.5 max-w-[235px]">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1D273D] text-[10.5px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                            {item.kategori}
                          </span>
                          <div className="text-slate-800 dark:text-slate-200 leading-snug text-[11.5px] line-clamp-2">
                            {item.keterangan}
                          </div>
                          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Metode: {item.metodePembayaran}
                          </div>
                        </td>

                        <td className="px-2 py-2.5 text-right whitespace-nowrap">
                          <div className="text-[13px] font-bold text-slate-900 dark:text-white tabular-nums">
                            {formatRupiahOps(item.nominal)}
                          </div>
                        </td>

                        <td className="px-2 py-2.5 max-w-[155px]">
                          <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-start gap-1 text-[11.5px]">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-snug">{item.petugasOps}</span>
                          </div>
                          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            Dari: {item.diberikanOleh}
                          </div>
                        </td>

                        <td className="px-2 py-2.5 max-w-[145px] space-y-1">
                          <div>
                            <span
                              className={`inline-block px-2 py-0.5 rounded border text-[10.5px] font-semibold whitespace-nowrap ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.shortLabel}
                            </span>
                          </div>
                          <div>
                            {hasProof ? (
                              <button
                                type="button"
                                onClick={() => setPreviewItem(item)}
                                className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer max-w-full"
                              >
                                <Paperclip className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[115px]">
                                  {item.buktiNamaFile || 'Lampiran Bukti'}
                                </span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-rose-600 dark:text-rose-300 whitespace-nowrap">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                <span>Belum ada bukti</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="pl-2 pr-3.5 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              aria-label={`Preview bukti & tanda terima ${item.kodePengeluaran}`}
                              title="Preview Tanda Terima & Bukti"
                              onClick={() => setPreviewItem(item)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#1F2940] text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Cetak PDF Tanda Terima ${item.noTandaTerima}`}
                              title="Unduh PDF Tanda Terima"
                              onClick={() =>
                                exportTandaTerimaOpsPDF(item, linkedShip, pengaturan)
                              }
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#1F2940] text-[#0B2545] dark:text-violet-300 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Lembaran DKL ${item.kodeOs}`}
                              title={`Cetak Lembaran DKL (${item.kodeOs})`}
                              onClick={() => setDklTargetKodeOs(item.kodeOs)}
                              className="p-1.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 hover:bg-amber-100 text-amber-800 dark:text-amber-300 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            {canManage &&
                              item.statusPengeluaran === 'Uang Muka / Kasbon' && (
                                <button
                                  type="button"
                                  aria-label={`Tandai selesai ${item.kodePengeluaran}`}
                                  title="Tandai Selesai / Dipertanggungjawabkan"
                                  onClick={() => handleQuickMarkSettled(item)}
                                  className="p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                                >
                                  <ClipboardCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                            {canManage && (
                              <button
                                type="button"
                                aria-label={`Edit pengeluaran ${item.kodePengeluaran}`}
                                title="Edit Pengeluaran"
                                onClick={() => openEditModal(item)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#1F2940] text-amber-600 dark:text-amber-300 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                aria-label={`Hapus pengeluaran ${item.kodePengeluaran}`}
                                title="Hapus Catatan"
                                onClick={() => onDeletePengeluaran(item.id)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-rose-50 dark:hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tab 2: Rekap per Dokumen OS */}
      {subTab === 'by-dokumen' && (
        <div className="rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-[#182032]/70">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Rekap Biaya per Dokumen OS ({summary.byDokumen.length})
            </div>
            <CardWindowToggleButton cardId="kop-bydoc-card" label="Rekap per Dokumen OS" />
          </div>
          {!isCollapsed('kop-bydoc-card') && (summary.byDokumen.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Belum ada rekap pengeluaran per dokumen OS.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#182032] border-b border-slate-200 dark:border-white/[0.08] text-[10.5px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    <th className="pl-3.5 pr-2 py-2.5 whitespace-nowrap">Dokumen OS</th>
                    <th className="px-2.5 py-2.5">Customer & B/L</th>
                    <th className="px-2.5 py-2.5 text-center whitespace-nowrap">Jml Biaya</th>
                    <th className="px-2.5 py-2.5 text-right whitespace-nowrap">Total Biaya Ops</th>
                    <th className="px-2.5 py-2.5 text-right whitespace-nowrap">Masih Kasbon</th>
                    <th className="px-2.5 py-2.5 text-right whitespace-nowrap">Tagihan Billing</th>
                    <th className="px-2.5 py-2.5 text-right whitespace-nowrap">Selisih Margin</th>
                    <th className="pl-2 pr-3.5 py-2.5 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                  {summary.byDokumen.map((doc) => {
                    const hasShip = shipmentMap.has(doc.kodeOs.trim().toUpperCase());
                    return (
                      <tr key={doc.kodeOs} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02]">
                        <td className="pl-3.5 pr-2 py-2.5 whitespace-nowrap">
                          {hasShip ? (
                            <button
                              type="button"
                              onClick={() => onOpenShipmentDetail(doc.kodeOs)}
                              className="font-mono-code font-bold text-[#F28C28] dark:text-violet-300 hover:underline cursor-pointer"
                            >
                              {doc.kodeOs}
                            </button>
                          ) : (
                            <span className="font-mono-code font-bold text-slate-700 dark:text-slate-300">
                              {doc.kodeOs}
                            </span>
                          )}
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {doc.shipStatus}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 max-w-[190px]">
                          <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {doc.namaCustomer}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-code truncate">
                            B/L: {doc.noBl}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 text-center tabular-nums whitespace-nowrap">
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {doc.jumlahTransaksi}
                          </span>
                          {doc.transaksiTanpaBukti > 0 && (
                            <div className="text-[10px] text-rose-600 dark:text-rose-300">
                              {doc.transaksiTanpaBukti} tanpa bukti
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2.5 text-right font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                          {formatRupiahOps(doc.totalNominal)}
                        </td>
                        <td className="px-2.5 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          {doc.nominalKasbon > 0 ? formatRupiahOps(doc.nominalKasbon) : '-'}
                        </td>
                        <td className="px-2.5 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {doc.billingTotal > 0 ? formatRupiahOps(doc.billingTotal) : '-'}
                        </td>
                        <td className="px-2.5 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap">
                          {doc.billingTotal > 0 ? (
                            <span
                              className={
                                doc.selisihBilling >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {formatRupiahOps(doc.selisihBilling)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="pl-2 pr-3.5 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              data-testid={`btn-cetak-dkl-${doc.kodeOs}`}
                              onClick={() => setDklTargetKodeOs(doc.kodeOs)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-[11px] font-semibold text-amber-800 dark:text-amber-200 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Cetak DKL</span>
                            </button>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => openCreateModal(doc.kodeOs)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#1F2940] text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Tambah Biaya</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tab 3: Rekap Petugas Ops */}
      {subTab === 'by-petugas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {summary.byPetugas.length === 0 ? (
            <div className="col-span-full rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.08] p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Belum ada rekap tanda terima per petugas operasional.
            </div>
          ) : (
            summary.byPetugas.map((p) => {
              const petugasCardId = `kop-petugas-${p.petugasOps}`;
              const petugasCollapsed = isCollapsed(petugasCardId);
              return (
                <div
                  key={p.petugasOps}
                  className="rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.08] p-4 space-y-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#0B2545]/10 dark:bg-violet-500/20 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-[#0B2545] dark:text-violet-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {p.petugasOps}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {p.jumlahTransaksi} Tanda Terima · {p.dokumenCount} Dokumen OS
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!petugasCollapsed && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterPetugas(p.petugasOps);
                            setSubTab('list');
                          }}
                          className="text-[11px] font-semibold text-[#F28C28] dark:text-violet-300 hover:underline cursor-pointer"
                        >
                          Rincian
                        </button>
                      )}
                      <CardWindowToggleButton cardId={petugasCardId} label={`Petugas ${p.petugasOps}`} compact />
                    </div>
                  </div>

                  {!petugasCollapsed && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-white/[0.06] text-xs">
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Total Dana Diterima
                        </div>
                        <div className="font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                          {formatRupiahOps(p.totalDiterima)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Kasbon Aktif
                        </div>
                        <div className="font-bold text-amber-600 dark:text-amber-300 tabular-nums mt-0.5">
                          {formatRupiahOps(p.kasbonAktifNominal)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Sudah Selesai/Bayar
                        </div>
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                          {formatRupiahOps(p.sudahDipertanggungjawabkanNominal)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Kelengkapan Bukti
                        </div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums mt-0.5">
                          {p.transaksiDenganBukti} ada ·{' '}
                          <span className={p.transaksiTanpaBukti > 0 ? 'text-rose-500' : ''}>
                            {p.transaksiTanpaBukti} kurang
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal Tambah / Edit Pengeluaran Ops */}
      {formModalOpen && draft && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            isNewRecord
              ? 'Catat Pengeluaran Operasional Baru'
              : `Edit Pengeluaran ${draft.kodePengeluaran}`
          }
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        >
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.1] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto">
            <div className="px-5 py-4 bg-[#0B2545] dark:bg-[#182032] border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  {isNewRecord
                    ? 'Catat Pengeluaran Operasional & Tanda Terima'
                    : `Edit Pengeluaran (${draft.kodePengeluaran})`}
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Nomor tanda terima otomatis diterbitkan agar penyerahan dana ke petugas ops tercatat rapi.
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup form pengeluaran"
                onClick={() => setFormModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="kop-kode-os"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
                  >
                    Dokumen Shipment (Kode OS) *
                  </label>
                  <select
                    id="kop-kode-os"
                    value={draft.kodeOs}
                    onChange={(e) => setDraft({ ...draft, kodeOs: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Pilih Dokumen Shipment --</option>
                    {sortedShipments.map((s) => (
                      <option key={s.kodeOs} value={s.kodeOs}>
                        {s.kodeOs} — {s.namaCustomer} (B/L: {s.noBl || '-'})
                      </option>
                    ))}
                    <option value={NON_OS_KODE}>{NON_OS_KODE} (Biaya Umum Operasional)</option>
                  </select>
                  {formErrors.kodeOs && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.kodeOs}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="kop-tanggal"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
                  >
                    Tanggal Pengeluaran *
                  </label>
                  <input
                    id="kop-tanggal"
                    type="date"
                    value={draft.tanggal}
                    onChange={(e) => setDraft({ ...draft, tanggal: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                  />
                  {formErrors.tanggal && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.tanggal}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="kop-kategori"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
                  >
                    Kategori Biaya *
                  </label>
                  <select
                    id="kop-kategori"
                    value={draft.kategori}
                    onChange={(e) =>
                      setDraft({ ...draft, kategori: e.target.value as KategoriPengeluaranOps })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                  >
                    {KATEGORI_PENGELUARAN_OPS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  {formErrors.kategori && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.kategori}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="kop-nominal"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
                  >
                    Nominal (Rp) *
                  </label>
                  <input
                    id="kop-nominal"
                    type="number"
                    min={0}
                    step={500}
                    value={draft.nominal}
                    onChange={(e) => setDraft({ ...draft, nominal: e.target.value })}
                    placeholder="Contoh: 1250000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                  {formErrors.nominal && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.nominal}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="kop-metode"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
                  >
                    Metode Pembayaran *
                  </label>
                  <select
                    id="kop-metode"
                    value={draft.metodePembayaran}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        metodePembayaran: e.target.value as MetodePembayaranOps,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                  >
                    {METODE_PEMBAYARAN_OPS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="kop-petugas"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
                  >
                    Petugas Ops Penerima (Tanda Terima) *
                  </label>
                  <input
                    id="kop-petugas"
                    type="text"
                    list="kop-petugas-list"
                    value={draft.petugasOps}
                    onChange={(e) => setDraft({ ...draft, petugasOps: e.target.value })}
                    placeholder="Nama petugas ops penerima uang"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                  />
                  <datalist id="kop-petugas-list">
                    {petugasSuggestions.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                  {formErrors.petugasOps && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.petugasOps}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="kop-status"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
                  >
                    Status Pertanggungjawaban *
                  </label>
                  <select
                    id="kop-status"
                    value={draft.statusPengeluaran}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        statusPengeluaran: e.target.value as StatusPengeluaranOps,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                  >
                    {STATUS_PENGELUARAN_OPS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="kop-keterangan"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
                  >
                    Uraian / Keterangan Pengeluaran *
                  </label>
                  <textarea
                    id="kop-keterangan"
                    rows={2}
                    value={draft.keterangan}
                    onChange={(e) => setDraft({ ...draft, keterangan: e.target.value })}
                    placeholder="Jelaskan peruntukan biaya operasional secara rinci (mis. perpanjangan D/O 5 hari, gate pass TPS Koja, dll)..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                  />
                  {formErrors.keterangan && (
                    <p className="text-[11px] text-rose-600 mt-1">{formErrors.keterangan}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="kop-pemberi"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
                  >
                    Diserahkan Oleh (Keuangan / Admin)
                  </label>
                  <input
                    id="kop-pemberi"
                    type="text"
                    value={draft.diberikanOleh}
                    onChange={(e) => setDraft({ ...draft, diberikanOleh: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="kop-audit"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
                  >
                    Catatan Audit / Tanda Terima
                  </label>
                  <input
                    id="kop-audit"
                    type="text"
                    value={draft.catatanAudit}
                    onChange={(e) => setDraft({ ...draft, catatanAudit: e.target.value })}
                    placeholder="Opsional: nomor kwitansi, nama penerima lapangan..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#182032] text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Upload Bukti Pembayaran / Tanda Terima */}
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#182032] p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-[#F28C28] dark:text-violet-400" />
                      <span>Bukti Pembayaran / Foto Tanda Terima Ops</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Unggah foto nota, struk transfer, atau tanda terima bertanda tangan — otomatis disimpan offline ke IndexedDB &amp; Google Drive{' '}
                      <strong>
                        ({describeRegisteredDriveDestination(pengaturan, googleDriveEmail).registeredGmail || 'Akun Drive Terdaftar'} · {describeRegisteredDriveDestination(pengaturan, googleDriveEmail).folderLabel})
                      </strong>.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B2545] dark:bg-violet-600 text-white text-xs font-semibold cursor-pointer hover:opacity-90">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Pilih File Bukti</span>
                    <input
                      type="file"
                      aria-label="Upload file bukti pembayaran atau tanda terima"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleProofFileChange}
                      className="sr-only"
                    />
                  </label>
                </div>

                {proofPrepNote && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    {proofPrepNote}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="kop-bukti-nama"
                      className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1"
                    >
                      Nama File / Referensi Nota
                    </label>
                    <input
                      id="kop-bukti-nama"
                      type="text"
                      value={draft.buktiNamaFile}
                      onChange={(e) => setDraft({ ...draft, buktiNamaFile: e.target.value })}
                      placeholder="Contoh: Nota_DO_Pelayaran.jpg"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#131926] text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="kop-bukti-link"
                      className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1"
                    >
                      Tautan Google Drive (Opsional)
                    </label>
                    <input
                      id="kop-bukti-link"
                      type="url"
                      value={draft.buktiLinkDrive}
                      onChange={(e) => setDraft({ ...draft, buktiLinkDrive: e.target.value })}
                      placeholder="https://drive.google.com/..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#131926] text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {draft.buktiDataUrl && draft.buktiDataUrl.startsWith('data:image/') && (
                  <div className="flex items-center gap-3 pt-1">
                    <img
                      src={draft.buktiDataUrl}
                      alt="Preview lampiran bukti pembayaran"
                      className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPendingProofFile(undefined);
                        setDraft({
                          ...draft,
                          buktiNamaFile: '',
                          buktiMimeType: '',
                          buktiDataUrl: '',
                        });
                      }}
                      className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Hapus Lampiran Foto
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1F2940] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#0B2545] dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 text-white text-xs font-semibold hover:opacity-95 disabled:opacity-60 cursor-pointer"
                >
                  {submitting
                    ? 'Menyimpan...'
                    : isNewRecord
                    ? 'Simpan & Terbitkan Tanda Terima'
                    : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview Tanda Terima & Bukti Pembayaran */}
      {previewItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview Tanda Terima ${previewItem.noTandaTerima}`}
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        >
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.1] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto">
            <div className="px-5 py-4 bg-[#0B2545] dark:bg-[#182032] border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {identity.logoDataUrl && (
                  <div className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={identity.logoDataUrl}
                      alt={`Logo ${identity.brandName}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#F28C28] dark:text-violet-300 truncate">
                    {identity.brandName} · {identity.companyName}
                  </div>
                  <h3 className="text-base font-bold text-white truncate">
                    Tanda Terima: {previewItem.noTandaTerima}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup preview tanda terima"
                onClick={() => setPreviewItem(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-[#182032] p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08]">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Kode Biaya</div>
                  <div className="font-mono-code font-bold text-slate-900 dark:text-white mt-0.5">
                    {previewItem.kodePengeluaran}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Dokumen OS</div>
                  <div className="font-mono-code font-bold text-[#F28C28] dark:text-violet-300 mt-0.5">
                    {previewItem.kodeOs}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Tanggal</div>
                  <div className="font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {previewItem.tanggal}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Nominal</div>
                  <div className="font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 tabular-nums">
                    {formatRupiahOps(previewItem.nominal)}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] divide-y divide-slate-200 dark:divide-white/[0.06]">
                {(() => {
                  const previewShip = shipmentMap.get(previewItem.kodeOs.trim().toUpperCase());
                  const resolvedCust = previewShip?.namaCustomer || previewItem.namaCustomer || '-';
                  const resolvedBl = previewShip?.noBl || previewItem.noBl;
                  return (
                    <div className="px-4 py-2.5 flex justify-between gap-4">
                      <span className="text-slate-500 dark:text-slate-400">Customer / B/L</span>
                      <span className="font-semibold text-slate-900 dark:text-white text-right">
                        {resolvedCust} {resolvedBl ? `(${resolvedBl})` : ''}
                      </span>
                    </div>
                  );
                })()}
                <div className="px-4 py-2.5 flex justify-between gap-4">
                  <span className="text-slate-500 dark:text-slate-400">Kategori Biaya</span>
                  <span className="font-semibold text-slate-900 dark:text-white text-right">
                    {previewItem.kategori}
                  </span>
                </div>
                <div className="px-4 py-2.5 flex justify-between gap-4">
                  <span className="text-slate-500 dark:text-slate-400">Keterangan</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right max-w-md">
                    {previewItem.keterangan}
                  </span>
                </div>
                <div className="px-4 py-2.5 flex justify-between gap-4">
                  <span className="text-slate-500 dark:text-slate-400">Metode & Status</span>
                  <span className="font-semibold text-slate-900 dark:text-white text-right">
                    {previewItem.metodePembayaran} · {previewItem.statusPengeluaran}
                  </span>
                </div>
                <div className="px-4 py-2.5 flex justify-between gap-4">
                  <span className="text-slate-500 dark:text-slate-400">Petugas Ops Penerima</span>
                  <span className="font-bold text-slate-900 dark:text-white text-right">
                    {previewItem.petugasOps}
                  </span>
                </div>
                <div className="px-4 py-2.5 flex justify-between gap-4">
                  <span className="text-slate-500 dark:text-slate-400">Diserahkan Oleh</span>
                  <span className="font-semibold text-slate-900 dark:text-white text-right">
                    {previewItem.diberikanOleh}
                  </span>
                </div>
                {previewItem.catatanAudit && (
                  <div className="px-4 py-2.5 flex justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Catatan Audit</span>
                    <span className="text-slate-700 dark:text-slate-300 text-right max-w-md">
                      {previewItem.catatanAudit}
                    </span>
                  </div>
                )}
              </div>

              {/* Lampiran Bukti */}
              <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#182032] p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-[#F28C28] dark:text-violet-400" />
                    <span>Bukti Pembayaran / Lampiran Tanda Terima</span>
                  </span>
                  {previewItem.buktiLinkDrive && (
                    <a
                      href={previewItem.buktiLinkDrive}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#F28C28] dark:text-violet-300 hover:underline"
                    >
                      <span>Buka di Google Drive</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {previewItem.buktiDataUrl ? (
                  previewItem.buktiDataUrl.startsWith('data:image/') ? (
                    <div className="space-y-2">
                      <img
                        src={previewItem.buktiDataUrl}
                        alt={`Bukti ${previewItem.kodePengeluaran}`}
                        className="max-h-72 rounded-lg border border-slate-200 dark:border-white/10 mx-auto object-contain bg-white"
                      />
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{previewItem.buktiNamaFile || 'Foto Bukti Tersimpan'}</span>
                        <a
                          href={previewItem.buktiDataUrl}
                          download={previewItem.buktiNamaFile || `${previewItem.kodePengeluaran}.jpg`}
                          className="inline-flex items-center gap-1 font-semibold text-[#0B2545] dark:text-violet-300 hover:underline"
                        >
                          <Download className="w-3 h-3" />
                          <span>Unduh Bukti</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-white dark:bg-[#131926] p-3 rounded-lg border border-slate-200 dark:border-white/10">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {previewItem.buktiNamaFile || 'Dokumen Bukti'}
                      </span>
                      <a
                        href={previewItem.buktiDataUrl}
                        download={previewItem.buktiNamaFile || `${previewItem.kodePengeluaran}.pdf`}
                        className="inline-flex items-center gap-1 font-semibold text-[#0B2545] dark:text-violet-300 hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh File</span>
                      </a>
                    </div>
                  )
                ) : hasBuktiPengeluaran(previewItem) ? (
                  <p className="text-slate-600 dark:text-slate-300">
                    Lampiran tercatat: <span className="font-semibold">{previewItem.buktiNamaFile}</span>
                  </p>
                ) : (
                  <p className="text-rose-600 dark:text-rose-300">
                    Belum ada file bukti pembayaran yang diunggah untuk transaksi ini.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
                <a
                  href={buildTandaTerimaOpsWhatsappUrl(previewItem, identity.brandName)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-300 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-100"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Kirim WA ke Ops</span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    exportTandaTerimaOpsPDF(
                      previewItem,
                      shipmentMap.get(previewItem.kodeOs.trim().toUpperCase()),
                      pengaturan
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B2545] dark:bg-violet-600 text-white font-semibold hover:opacity-95 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Unduh PDF Tanda Terima</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview & Print Lembaran Dasi Dana Kerja Lapangan (DKL) */}
      <DklPrintModal
        isOpen={dklTargetKodeOs !== null}
        initialKodeOs={dklTargetKodeOs || ''}
        initialShipment={
          dklTargetKodeOs
            ? shipmentMap.get(dklTargetKodeOs.trim().toUpperCase()) ||
              (dklTargetKodeOs.trim().toUpperCase() === NON_OS_KODE
                ? createPlaceholderNonOsShipment()
                : sortedShipments[0] || createPlaceholderNonOsShipment())
            : null
        }
        availableShipments={sortedShipments}
        importirs={importirs}
        pengaturan={pengaturan}
        pengeluaranOps={items}
        defaultDiserahkanOleh={session.nama}
        onClose={() => setDklTargetKodeOs(null)}
      />
    </div>
  );
};
