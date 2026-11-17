import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileCheck2,
  FileSpreadsheet,
  IdCard,
  LogOut,
  Pencil,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Ship,
  Truck,
  X,
} from 'lucide-react';
import type {
  Customer,
  GatePassJenisType,
  KontainerItem,
  Pengaturan,
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
  calculateCountdownEta,
  canUserEditPhase,
  computeDoReadinessSummary,
  createEmptyChecklist,
  DEFAULT_CHECKLIST_ITEMS,
  type DoFilterCriteria,
  filterDoShipments,
  formatContainerSummary,
  generateSuratJalanNomor,
  isContainerGateOut,
  isShipmentBillingEligible,
  isSppbReadyForGateOut,
  normalizeGatePassJenis,
  normalizeStatusDokumen,
  normalizeStatusDoPelayaran,
  normalizeStatusGateOut,
  normalizeStatusGatePass,
  normalizeStatusSuratJalan,
  normalizeStatusTrucking,
} from '../utils/ppjkLogic';
import {
  exportDoReadinessToCSV,
  exportDoReadinessToExcel,
} from '../utils/exportUtils';
import {
  DoValidityBadge,
  StatusBadge,
  StatusDokumenBadge,
  StatusDoBadge,
  StatusGateOutBadge,
  StatusGatePassBadge,
  StatusPenagihanBadge,
  StatusSuratJalanBadge,
  StatusTruckingBadge,
} from './Badges';
import { SuratJalanModal } from './SuratJalanModal';

interface DoPelayaranViewProps {
  shipments: Shipment[];
  customers?: Customer[];
  checklistItems?: string[];
  pengaturan?: Pengaturan;
  currentUsername?: string;
  userRole: UserRole;
  phasePermissions?: PhasePermissions;
  canCreateShipment?: boolean;
  onOpenDetail: (kodeOs: string) => void;
  onOpenBilling?: (kodeOs: string, tab?: 'owner' | 'customer') => void;
  onUpdateStatusDokumen?: (
    kodeOs: string,
    nextStatus: StatusDokumenType
  ) => Promise<void>;
  onCreateShipmentFromDo?: (
    shipment: Shipment,
    containers: KontainerItem[]
  ) => Promise<Shipment | void>;
  onUpdateDoPelayaran: (
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

export function DoPelayaranView({
  shipments,
  customers = [],
  checklistItems = DEFAULT_CHECKLIST_ITEMS,
  pengaturan,
  currentUsername = '',
  userRole,
  phasePermissions,
  canCreateShipment = false,
  onOpenDetail,
  onOpenBilling,
  onUpdateStatusDokumen,
  onCreateShipmentFromDo,
  onUpdateDoPelayaran,
}: DoPelayaranViewProps) {
  const [search, setSearch] = useState('');
  const [filterStatusDokumen, setFilterStatusDokumen] = useState<'' | StatusDokumenType>('');
  const [filterDoStatus, setFilterDoStatus] = useState<'' | StatusDoPelayaranType>('');
  const [filterGatePassStatus, setFilterGatePassStatus] = useState<'' | StatusGatePassType>('');
  const [filterTruckingStatus, setFilterTruckingStatus] = useState<'' | StatusDoPelayaranType>('');
  const [filterGateOutStatus, setFilterGateOutStatus] = useState<'' | StatusGateOutType>('');
  const [filterCondition, setFilterCondition] = useState<NonNullable<DoFilterCriteria['condition']>>('all');
  const [filterCustomer, setFilterCustomer] = useState('');

  // State modal editor D/O shipment yang ada
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [editStatusDokumen, setEditStatusDokumen] = useState<StatusDokumenType>('Draft');
  const [editStatus, setEditStatus] = useState<StatusDoPelayaranType>('Belum');
  const [editBerlaku, setEditBerlaku] = useState('');
  const [editCatatan, setEditCatatan] = useState('');
  const [editGatePassStatus, setEditGatePassStatus] = useState<StatusGatePassType>('Belum');
  const [editGatePassJenis, setEditGatePassJenis] = useState<GatePassJenisType>('TILA (Kartu Gate)');
  const [editGatePassNomor, setEditGatePassNomor] = useState('');
  const [editTruckingStatus, setEditTruckingStatus] = useState<StatusDoPelayaranType>('Belum');
  const [editNamaSupir, setEditNamaSupir] = useState('');
  const [editNoPlat, setEditNoPlat] = useState('');
  const [editNoHpSupir, setEditNoHpSupir] = useState('');
  const [editGateOutStatus, setEditGateOutStatus] = useState<StatusGateOutType>('Belum');
  const [editGateOutTanggal, setEditGateOutTanggal] = useState('');
  const [editGateOutCatatan, setEditGateOutCatatan] = useState('');
  const [editBindSelesai, setEditBindSelesai] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSjKodeOs, setActiveSjKodeOs] = useState<string | null>(null);

  // State modal "+ Buat Catatan D/O" (Pilih Shipment Draft/Ready atau Buat Baru)
  const [createDoOpen, setCreateDoOpen] = useState(false);
  const [createTab, setCreateTab] = useState<'existing' | 'new'>('existing');
  const [pickSearch, setPickSearch] = useState('');
  const [pickDokFilter, setPickDokFilter] = useState<'' | StatusDokumenType>('');
  const [newDokStatus, setNewDokStatus] = useState<StatusDokumenType>('Draft');
  const [newKodeCustomer, setNewKodeCustomer] = useState('');
  const [newNamaCustomer, setNewNamaCustomer] = useState('');
  const [newNoBl, setNewNoBl] = useState('');
  const [newShip, setNewShip] = useState('');
  const [newEta, setNewEta] = useState(() => new Date().toISOString().slice(0, 10));
  const [newNoCont, setNewNoCont] = useState('');
  const [newUkuranCont, setNewUkuranCont] = useState('40HC');
  const [newDoStatus, setNewDoStatus] = useState<StatusDoPelayaranType>('Belum');
  const [newDoBerlaku, setNewDoBerlaku] = useState('');
  const [newDoCatatan, setNewDoCatatan] = useState('');
  const [newGatePassStatus, setNewGatePassStatus] = useState<StatusGatePassType>('Belum');
  const [newGatePassJenis, setNewGatePassJenis] = useState<GatePassJenisType>('TILA (Kartu Gate)');
  const [newGatePassNomor, setNewGatePassNomor] = useState('');
  const [newTruckingStatus, setNewTruckingStatus] = useState<StatusDoPelayaranType>('Belum');
  const [newNamaSupir, setNewNamaSupir] = useState('');
  const [newNoPlat, setNewNoPlat] = useState('');
  const [newNoHpSupir, setNewNoHpSupir] = useState('');
  const [newGateOutStatus, setNewGateOutStatus] = useState<StatusGateOutType>('Belum');
  const [newGateOutTanggal, setNewGateOutTanggal] = useState('');
  const [newGateOutCatatan, setNewGateOutCatatan] = useState('');
  const [newBindSelesai, setNewBindSelesai] = useState(true);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const canEditPhase1 = canUserEditPhase({ role: userRole, phasePermissions }, 1);
  const canEditPhase2 = canUserEditPhase({ role: userRole, phasePermissions }, 2);
  const canCreateFromDo = Boolean(canCreateShipment && onCreateShipmentFromDo);

  const summary = useMemo(() => computeDoReadinessSummary(shipments), [shipments]);

  const customerOptions = useMemo(
    () => Array.from(new Set(shipments.map((s) => s.namaCustomer).filter(Boolean))).sort(),
    [shipments]
  );

  const filtered = useMemo(
    () =>
      filterDoShipments(shipments, {
        search,
        statusDokumen: filterStatusDokumen,
        doStatus: filterDoStatus,
        gatePassStatus: filterGatePassStatus,
        truckingStatus: filterTruckingStatus,
        gateOutStatus: filterGateOutStatus,
        condition: filterCondition,
        customer: filterCustomer,
      }),
    [
      shipments,
      search,
      filterStatusDokumen,
      filterDoStatus,
      filterGatePassStatus,
      filterTruckingStatus,
      filterGateOutStatus,
      filterCondition,
      filterCustomer,
    ]
  );

  const pickableShipments = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    return shipments.filter((s) => {
      const dok = normalizeStatusDokumen(s.statusDokumen);
      if (pickDokFilter && dok !== pickDokFilter) return false;
      if (!q) return true;
      return [s.kodeOs, s.namaCustomer, s.noBl, s.noCont, s.ship, dok]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [shipments, pickSearch, pickDokFilter]);

  const openEditor = (s: Shipment) => {
    const currentGateOut = normalizeStatusGateOut(s.gateOutStatus, s.status);
    setEditingShipment(s);
    setEditStatusDokumen(normalizeStatusDokumen(s.statusDokumen));
    setEditStatus(normalizeStatusDoPelayaran(s.doPelayaranStatus));
    setEditBerlaku(s.doBerlakuSampai || '');
    setEditCatatan(s.doCatatanPerpanjangan || '');
    setEditGatePassStatus(normalizeStatusGatePass(s.doGatePassStatus));
    setEditGatePassJenis(normalizeGatePassJenis(s.doGatePassJenis) || 'TILA (Kartu Gate)');
    setEditGatePassNomor(s.doGatePassNomor || s.eslah || '');
    setEditTruckingStatus(normalizeStatusTrucking(s.truckingStatus));
    setEditNamaSupir(s.truckingNamaSupir || '');
    setEditNoPlat(s.truckingNoPlat || '');
    setEditNoHpSupir(s.truckingNoHpSupir || '');
    setEditGateOutStatus(currentGateOut);
    setEditGateOutTanggal(s.gateOutTanggal || '');
    setEditGateOutCatatan(s.gateOutCatatan || '');
    setEditBindSelesai(true);
  };

  const openCreateModal = () => {
    setCreateError('');
    setPickSearch('');
    setPickDokFilter('');
    setCreateTab(canEditPhase2 ? 'existing' : 'new');
    setNewDokStatus('Draft');
    setNewKodeCustomer('');
    setNewNamaCustomer('');
    setNewNoBl('');
    setNewShip('');
    setNewEta(new Date().toISOString().slice(0, 10));
    setNewNoCont('');
    setNewUkuranCont('40HC');
    setNewDoStatus('Belum');
    setNewDoBerlaku('');
    setNewDoCatatan('');
    setNewGatePassStatus('Belum');
    setNewGatePassJenis('TILA (Kartu Gate)');
    setNewGatePassNomor('');
    setNewTruckingStatus('Belum');
    setNewNamaSupir('');
    setNewNoPlat('');
    setNewNoHpSupir('');
    setNewGateOutStatus('Belum');
    setNewGateOutTanggal('');
    setNewGateOutCatatan('');
    setNewBindSelesai(true);
    setCreateDoOpen(true);
  };

  const handleSaveEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShipment) return;
    const targetKodeOs = editingShipment.kodeOs;
    const wasGateOut = isContainerGateOut(editingShipment);
    setSaving(true);
    try {
      await onUpdateDoPelayaran(targetKodeOs, {
        ...(canEditPhase1 ? { statusDokumen: editStatusDokumen } : {}),
        doPelayaranStatus: editStatus,
        doBerlakuSampai: editBerlaku,
        doCatatanPerpanjangan: editCatatan,
        doGatePassStatus: editGatePassStatus,
        doGatePassJenis: editGatePassJenis,
        doGatePassNomor: editGatePassNomor,
        truckingStatus: editTruckingStatus,
        truckingNamaSupir: editNamaSupir,
        truckingNoPlat: editNoPlat,
        truckingNoHpSupir: editNoHpSupir,
        gateOutStatus: editGateOutStatus,
        gateOutTanggal: editGateOutTanggal,
        gateOutCatatan: editGateOutCatatan,
        bindDokumenSelesai: editGateOutStatus === 'Sudah' ? editBindSelesai : false,
      });
      setEditingShipment(null);
      if (!wasGateOut && editGateOutStatus === 'Sudah') {
        setActiveSjKodeOs(targetKodeOs);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewDoShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateShipmentFromDo) return;
    setCreateError('');
    if (!newKodeCustomer.trim()) {
      setCreateError('Kode Customer wajib diisi.');
      return;
    }
    if (!newNoBl.trim()) {
      setCreateError('No. BL wajib diisi.');
      return;
    }
    if (!newEta.trim()) {
      setCreateError('Tanggal ETA wajib diisi.');
      return;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const shouldBindComplete = newGateOutStatus === 'Sudah' && newBindSelesai;
    const effectiveGateOutDate =
      newGateOutStatus === 'Sudah' ? newGateOutTanggal.trim() || todayIso : newGateOutTanggal.trim();

    const containers: KontainerItem[] = newNoCont.trim()
      ? [
          {
            id: `tmp_${Date.now()}`,
            kodeOs: '',
            noCont: newNoCont.trim().toUpperCase(),
            ukuranTipe: newUkuranCont,
          },
        ]
      : [];

    const completedOsChecklist = createEmptyChecklist(checklistItems);
    if (shouldBindComplete) {
      for (const item of checklistItems) {
        completedOsChecklist.items[item] = true;
      }
      completedOsChecklist.catatan = `Otomatis dilengkapi via Gate-Out (${effectiveGateOutDate}).`;
    }

    const shipmentPayload: Shipment = {
      kodeOs: 'OTOMATIS (OS-YYMM-NNNN)',
      ship: newShip.trim(),
      kodeCustomer: newKodeCustomer.trim().toUpperCase(),
      namaCustomer: newNamaCustomer.trim() || newKodeCustomer.trim().toUpperCase(),
      tglTerimaDok: todayIso,
      terimaDok: createEmptyChecklist(checklistItems),
      noPackinglist: '',
      noBl: newNoBl.trim(),
      statusDokumen: newDokStatus,
      etd: '',
      eta: newEta.trim(),
      countDownEta: calculateCountdownEta(newEta.trim()),
      noCont: formatContainerSummary(containers),
      bc11Terbit: false,
      noBc11: '',
      tglBc11: '',
      doPelayaranStatus: newDoStatus,
      doBerlakuSampai: newDoBerlaku.trim(),
      doCatatanPerpanjangan: newDoCatatan.trim(),
      doGatePassStatus: newGatePassStatus,
      doGatePassJenis: newGatePassJenis,
      doGatePassNomor: newGatePassNomor.trim(),
      truckingStatus: newTruckingStatus,
      truckingNamaSupir: newNamaSupir.trim(),
      truckingNoPlat: newNoPlat.trim().toUpperCase(),
      truckingNoHpSupir: newNoHpSupir.trim(),
      gateOutStatus: newGateOutStatus,
      gateOutTanggal: effectiveGateOutDate,
      gateOutCatatan: newGateOutCatatan.trim(),
      noAju: '',
      tglAju: '',
      status: shouldBindComplete ? 'Selesai' : 'Dokumen Diterima',
      nopen: '',
      tglNopen: '',
      jalur: '',
      kodeImportir: '',
      shipper: '',
      description: '',
      negaraAsal: '',
      currency: 'USD',
      kurs: '',
      invoice: '',
      bmPdri: '',
      sptnp: 'Tidak',
      noSppb: '',
      tglSppb: '',
      dokumenChecker: currentUsername,
      noSptnp: '',
      tglSptnp: '',
      pfpb: '',
      tglPfpb: '',
      pfpd: '',
      tglPfpd: '',
      eslah: '',
      tglEslah: '',
      dokumenOs: completedOsChecklist,
      createdAt: '',
      createdBy: '',
      updatedAt: '',
      updatedBy: '',
    };

    setCreating(true);
    try {
      const created = await onCreateShipmentFromDo(shipmentPayload, containers);
      setCreateDoOpen(false);
      if (newGateOutStatus === 'Sudah' && created && created.kodeOs) {
        setActiveSjKodeOs(created.kodeOs);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Gagal membuat catatan D/O baru.');
    } finally {
      setCreating(false);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setFilterStatusDokumen('');
    setFilterDoStatus('');
    setFilterGatePassStatus('');
    setFilterTruckingStatus('');
    setFilterGateOutStatus('');
    setFilterCondition('all');
    setFilterCustomer('');
  };

  const inputSurfaceCls =
    'w-full min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40 focus:border-[#F28C28] dark:focus:border-violet-500';

  return (
    <div className="space-y-5">
      {/* Print Header */}
      <div className="hidden print-only-header mb-4">
        <h2 className="text-lg font-bold">
          Laporan Kesiapan D/O Pelayaran, Eslah / TILA &amp; Trucking — PTG PPJK
        </h2>
        <p className="text-xs text-slate-600">
          Dicetak: {new Date().toLocaleString('id-ID')} · Total Dokumen: {filtered.length}
        </p>
      </div>

      {/* Header Intro */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 no-print">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Kesiapan D/O, Eslah / TILA (Kartu Gate), Trucking &amp; Gate-Out
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pencatatan D/O dari status Draft maupun Ready, pengurusan Eslah / TILA, trucking &amp; supir, hingga Gate-Out yang terikat ke proses Dokumen Selesai.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              setFilterCondition((v) => (v === 'full_ready' ? 'all' : 'full_ready'))
            }
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
              filterCondition === 'full_ready'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-emerald-400'
            }`}
          >
            <Anchor className="w-3.5 h-3.5 text-[#F28C28] dark:text-violet-400" />
            <span>
              {summary.fullReadyGateOutCount} Siap Gate-Out Penuh
            </span>
          </button>

          {(canEditPhase2 || canCreateFromDo) && (
            <button
              type="button"
              onClick={openCreateModal}
              data-testid="btn-buat-catatan-do"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold cursor-pointer shadow-sm dark:shadow-lg dark:shadow-violet-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Catatan D/O</span>
            </button>
          )}
        </div>
      </div>

      {/* 8 KPI Summary Cards (4x2 on xl) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="relative overflow-hidden bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-sky-500/35 p-4">
          <div
            aria-hidden="true"
            className="hidden dark:block pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-sky-500/15 blur-2xl"
          />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
              <Ship className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Semua Dokumen
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {summary.total}
              </div>
            </div>
          </div>
          <div className="relative mt-2 text-[11px] font-medium text-sky-600 dark:text-sky-400">
            {summary.siapKeluarCount} SPPB + D/O Sedia · {summary.fullReadyGateOutCount} siap keluar penuh
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setFilterStatusDokumen((v) =>
              v === 'Draft' ? 'Ready' : v === 'Ready' ? '' : 'Draft'
            )
          }
          className="relative overflow-hidden text-left bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-yellow-500/35 hover:border-yellow-400 dark:hover:border-yellow-400/60 p-4 cursor-pointer transition-colors"
        >
          <div
            aria-hidden="true"
            className="hidden dark:block pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-yellow-500/15 blur-2xl"
          />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-4.5 h-4.5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Dokumen Draft / Ready
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                <span className="text-yellow-600 dark:text-yellow-400">{summary.draftDokCount}</span>
                <span className="text-xs font-semibold text-slate-400 mx-1">Draft ·</span>
                <span className="text-emerald-600 dark:text-emerald-400">{summary.readyDokCount}</span>
                <span className="text-xs font-semibold text-slate-400 ml-1">Ready</span>
              </div>
            </div>
          </div>
          <div className="relative mt-2 text-[11px] font-medium text-yellow-700 dark:text-yellow-300">
            Klik untuk filter Draft / Ready
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterDoStatus((v) => (v === 'Sedia' ? '' : 'Sedia'))}
          className="relative overflow-hidden text-left bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-emerald-500/35 hover:border-emerald-400 dark:hover:border-emerald-400/60 p-4 cursor-pointer transition-colors"
        >
          <div
            aria-hidden="true"
            className="hidden dark:block pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-emerald-500/15 blur-2xl"
          />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                D/O Sedia (Pelayaran)
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {summary.sediaCount}
              </div>
            </div>
          </div>
          <div className="relative mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Klik untuk filter D/O Sedia
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterDoStatus((v) => (v === 'Belum' ? '' : 'Belum'))}
          className="relative overflow-hidden text-left bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-amber-500/35 hover:border-amber-400 dark:hover:border-amber-400/60 p-4 cursor-pointer transition-colors"
        >
          <div
            aria-hidden="true"
            className="hidden dark:block pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-amber-500/15 blur-2xl"
          />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Clock className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                D/O Belum Sedia
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {summary.belumCount}
              </div>
            </div>
          </div>
          <div className="relative mt-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            {summary.sppbMenungguDoCount} sudah SPPB menunggu D/O
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setFilterCondition((v) =>
              v === 'perlu_perpanjangan' ? 'all' : 'perlu_perpanjangan'
            )
          }
          className="relative overflow-hidden text-left bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-red-500/35 hover:border-red-400 dark:hover:border-red-400/60 p-4 cursor-pointer transition-colors"
        >
          <div
            aria-hidden="true"
            className="hidden dark:block pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-red-500/15 blur-2xl"
          />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
              <CalendarClock className="w-4.5 h-4.5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Perlu Perpanjangan D/O
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                {summary.perluPerpanjanganCount}
              </div>
            </div>
          </div>
          <div className="relative mt-2 text-[11px] font-medium text-red-600 dark:text-red-400">
            Berlaku &le; 2 hari atau kedaluwarsa
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setFilterCondition((v) =>
              v === 'gatepass_belum' ? 'all' : 'gatepass_belum'
            )
          }
          className="relative overflow-hidden text-left bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-violet-500/35 hover:border-violet-400 dark:hover:border-violet-400/60 p-4 cursor-pointer transition-colors"
        >
          <div
            aria-hidden="true"
            className="hidden dark:block pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-violet-500/15 blur-2xl"
          />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
              <IdCard className="w-4.5 h-4.5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Eslah / TILA (Kartu Gate)
              </div>
              <div className="text-2xl font-bold text-violet-700 dark:text-violet-300 tabular-nums">
                {summary.gatePassSediaCount}
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 ml-1">
                  / {summary.total} Sedia
                </span>
              </div>
            </div>
          </div>
          <div className="relative mt-2 text-[11px] font-medium text-violet-600 dark:text-violet-300">
            {summary.gatePassProsesCount} proses · {summary.gatePassBelumCount} belum diurus
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setFilterCondition((v) =>
              v === 'trucking_belum' ? 'all' : 'trucking_belum'
            )
          }
          className="relative overflow-hidden text-left bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-teal-500/35 hover:border-teal-400 dark:hover:border-teal-400/60 p-4 cursor-pointer transition-colors"
        >
          <div
            aria-hidden="true"
            className="hidden dark:block pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-teal-500/15 blur-2xl"
          />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0">
              <Truck className="w-4.5 h-4.5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Kesediaan Trucking
              </div>
              <div className="text-2xl font-bold text-teal-700 dark:text-teal-300 tabular-nums">
                {summary.truckingSediaCount}
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 ml-1">
                  / {summary.total} Sedia
                </span>
              </div>
            </div>
          </div>
          <div className="relative mt-2 text-[11px] font-medium text-teal-600 dark:text-teal-300">
            {summary.truckingBelumCount} armada &amp; supir belum dijadwalkan
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setFilterGateOutStatus((v) => (v === 'Sudah' ? '' : 'Sudah'))
          }
          className="relative overflow-hidden text-left bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-emerald-500/40 hover:border-emerald-400 dark:hover:border-emerald-400/70 p-4 cursor-pointer transition-colors"
        >
          <div
            aria-hidden="true"
            className="hidden dark:block pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-emerald-500/20 blur-2xl"
          />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <LogOut className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Gate-Out &amp; Ikatan Selesai
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {summary.gateOutSudahCount}
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 ml-1">
                  / {summary.total} Keluar
                </span>
              </div>
            </div>
          </div>
          <div className="relative mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
            {summary.dokumenSelesaiCount} terikat Dokumen Selesai · {summary.gateOutBelumCount} belum
          </div>
        </button>
      </div>

      {/* Filter & Export Toolbar */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[230px]">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Cari kesiapan D/O, Eslah/TILA, Trucking, dan Gate-Out"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Kode OS, Draft/Ready, Kontainer, BL, Customer, Eslah/TILA, Supir, Plat Truk..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportDoReadinessToExcel(filtered)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() => exportDoReadinessToCSV(filtered)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>
          </div>
        </div>

        {/* 2 clean 4-column rows so dropdown labels never clip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <select
            aria-label="Filter status dokumen Draft atau Ready"
            value={filterStatusDokumen}
            onChange={(e) =>
              setFilterStatusDokumen(e.target.value as '' | StatusDokumenType)
            }
            className={inputSurfaceCls}
          >
            <option value="">Dok. Checker: Semua ({summary.total})</option>
            <option value="Draft">Dok. Checker: Draft ({summary.draftDokCount})</option>
            <option value="Ready">Dok. Checker: Ready ({summary.readyDokCount})</option>
          </select>

          <select
            aria-label="Filter status D/O pelayaran"
            value={filterDoStatus}
            onChange={(e) =>
              setFilterDoStatus(e.target.value as '' | StatusDoPelayaranType)
            }
            className={inputSurfaceCls}
          >
            <option value="">Status D/O: Semua ({summary.total})</option>
            <option value="Sedia">Status D/O: Sedia ({summary.sediaCount})</option>
            <option value="Belum">Status D/O: Belum ({summary.belumCount})</option>
          </select>

          <select
            aria-label="Filter status Eslah / TILA"
            value={filterGatePassStatus}
            onChange={(e) =>
              setFilterGatePassStatus(e.target.value as '' | StatusGatePassType)
            }
            className={inputSurfaceCls}
          >
            <option value="">Eslah/TILA: Semua</option>
            <option value="Sedia">Eslah/TILA: Sedia ({summary.gatePassSediaCount})</option>
            <option value="Proses">Eslah/TILA: Proses ({summary.gatePassProsesCount})</option>
            <option value="Belum">Eslah/TILA: Belum ({summary.gatePassBelumCount})</option>
          </select>

          <select
            aria-label="Filter kesediaan trucking"
            value={filterTruckingStatus}
            onChange={(e) =>
              setFilterTruckingStatus(e.target.value as '' | StatusDoPelayaranType)
            }
            className={inputSurfaceCls}
          >
            <option value="">Trucking: Semua</option>
            <option value="Sedia">Trucking: Sedia ({summary.truckingSediaCount})</option>
            <option value="Belum">Trucking: Belum ({summary.truckingBelumCount})</option>
          </select>

          <select
            aria-label="Filter status Gate-Out"
            value={filterGateOutStatus}
            onChange={(e) =>
              setFilterGateOutStatus(e.target.value as '' | StatusGateOutType)
            }
            className={inputSurfaceCls}
          >
            <option value="">Gate-Out: Semua</option>
            <option value="Sudah">Gate-Out: Sudah / Selesai ({summary.gateOutSudahCount})</option>
            <option value="Belum">Gate-Out: Belum ({summary.gateOutBelumCount})</option>
          </select>

          <select
            aria-label="Filter kondisi pengeluaran kontainer"
            value={filterCondition}
            onChange={(e) =>
              setFilterCondition(
                e.target.value as NonNullable<DoFilterCriteria['condition']>
              )
            }
            className={inputSurfaceCls}
          >
            <option value="all">Kondisi: Semua</option>
            <option value="full_ready">
              Siap Gate-Out Penuh ({summary.fullReadyGateOutCount})
            </option>
            <option value="gateout_sudah">
              Sudah Gate-Out / Dok. Selesai ({summary.gateOutSudahCount})
            </option>
            <option value="gateout_belum">
              Belum Gate-Out ({summary.gateOutBelumCount})
            </option>
            <option value="sppb_belum_do">
              Sudah SPPB · D/O Belum ({summary.sppbMenungguDoCount})
            </option>
            <option value="perlu_perpanjangan">
              Perlu Perpanjangan D/O ({summary.perluPerpanjanganCount})
            </option>
            <option value="gatepass_belum">
              Eslah/TILA Belum Sedia ({summary.gatePassProsesCount + summary.gatePassBelumCount})
            </option>
            <option value="trucking_belum">
              Trucking Belum Sedia ({summary.truckingBelumCount})
            </option>
          </select>

          <select
            aria-label="Filter customer kesiapan D/O"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className={inputSurfaceCls}
          >
            <option value="">Customer: Semua</option>
            {customerOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              {filtered.length} dok
            </span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-10 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Tidak ada dokumen yang sesuai dengan filter kesiapan D/O, Eslah/TILA, atau Trucking saat ini.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 px-4 py-2 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        <>
          {/* Desktop / Tablet Table */}
          <div className="hidden md:block bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-x-auto">
            <table
              className="w-full text-left border-collapse text-xs"
              data-testid="do-readiness-table"
            >
              <thead>
                <tr className="bg-slate-50 dark:bg-[#182032] border-b border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 text-[11px]">
                  <th className="py-3 px-2.5 font-semibold whitespace-nowrap">Kode OS &amp; Dok</th>
                  <th className="py-3 px-2.5 font-semibold whitespace-nowrap">Customer &amp; Kontainer</th>
                  <th className="py-3 px-2.5 font-semibold whitespace-nowrap">Customs / SPPB</th>
                  <th className="py-3 px-2.5 font-semibold whitespace-nowrap">D/O &amp; Masa Berlaku</th>
                  <th className="py-3 px-2.5 font-semibold whitespace-nowrap">Eslah / TILA (Kartu Gate)</th>
                  <th className="py-3 px-2.5 font-semibold whitespace-nowrap">Kesediaan Trucking</th>
                  <th className="py-3 px-2.5 font-semibold text-right no-print whitespace-nowrap">Gate-Out &amp; Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {filtered.map((s) => {
                  const dokStatus = normalizeStatusDokumen(s.statusDokumen);
                  const doStatus = normalizeStatusDoPelayaran(s.doPelayaranStatus);
                  const gatePassStatus = normalizeStatusGatePass(s.doGatePassStatus);
                  const gatePassJenis = normalizeGatePassJenis(s.doGatePassJenis);
                  const gatePassNomor = s.doGatePassNomor || s.eslah || '';
                  const truckingStatus = normalizeStatusTrucking(s.truckingStatus);
                  const gateOutStatus = normalizeStatusGateOut(s.gateOutStatus, s.status);
                  const hasSppb = isSppbReadyForGateOut(s);
                  const sppbWaitingDo = hasSppb && doStatus === 'Belum' && s.status !== 'Selesai';
                  return (
                    <tr
                      key={s.kodeOs}
                      onClick={() => onOpenDetail(s.kodeOs)}
                      className={`cursor-pointer transition-colors ${
                        sppbWaitingDo
                          ? 'bg-amber-50/70 dark:bg-amber-950/25 hover:bg-amber-100/60 dark:hover:bg-amber-950/35'
                          : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <td className="py-3 px-2.5 whitespace-nowrap align-top">
                        <div className="font-mono-code font-bold text-[#0B2545] dark:text-violet-300">
                          {s.kodeOs}
                        </div>
                        <div className="text-[11px] font-mono-code text-slate-500 dark:text-slate-400 mt-0.5">
                          {s.noBl}
                        </div>
                        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                          <StatusDokumenBadge
                            statusDokumen={dokStatus}
                            onToggle={
                              canEditPhase1 && onUpdateStatusDokumen
                                ? (next) => void onUpdateStatusDokumen(s.kodeOs, next)
                                : undefined
                            }
                          />
                        </div>
                      </td>

                      <td className="py-3 px-2 align-top max-w-[148px]">
                        <div className="font-semibold text-slate-900 dark:text-white truncate" title={s.namaCustomer}>
                          {s.namaCustomer}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={s.ship}>
                          {s.ship || '-'}
                        </div>
                        <div className="font-mono-code text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 mt-1 break-words">
                          {s.noCont || '-'}
                        </div>
                      </td>

                      <td className="py-3 px-2 align-top min-w-[148px] max-w-[165px]">
                        <StatusBadge status={s.status} />
                        <div className="text-[10.5px] font-mono-code text-slate-500 dark:text-slate-400 mt-1 break-words">
                          {s.noSppb ? s.noSppb : 'Belum ada SPPB'}
                        </div>
                        {sppbWaitingDo && (
                          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 mt-0.5">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>SPPB siap, tunggu D/O</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-2 align-top max-w-[175px]">
                        <div
                          className="flex flex-wrap items-center gap-1.5 mb-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <StatusDoBadge
                            statusDo={doStatus}
                            onToggle={
                              canEditPhase2
                                ? (next) =>
                                    void onUpdateDoPelayaran(s.kodeOs, {
                                      doPelayaranStatus: next,
                                    })
                                : undefined
                            }
                          />
                          {s.doBerlakuSampai && (
                            <span className="font-mono-code text-[10.5px] font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                              s/d {s.doBerlakuSampai}
                            </span>
                          )}
                        </div>
                        <DoValidityBadge
                          doBerlakuSampai={s.doBerlakuSampai}
                          shipmentStatus={s.status}
                        />
                        <p
                          className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug line-clamp-2 mt-1"
                          title={s.doCatatanPerpanjangan || ''}
                        >
                          {s.doCatatanPerpanjangan || (
                            <span className="text-slate-400 dark:text-slate-500 italic">
                              Belum ada catatan perpanjangan
                            </span>
                          )}
                        </p>
                      </td>

                      <td className="py-3 px-2 align-top max-w-[155px]">
                        <div
                          className="mb-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <StatusGatePassBadge
                            statusGatePass={gatePassStatus}
                            onToggle={
                              canEditPhase2
                                ? (next) =>
                                    void onUpdateDoPelayaran(s.kodeOs, {
                                      doGatePassStatus: next,
                                    })
                                : undefined
                            }
                          />
                        </div>
                        <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
                          {gatePassJenis || 'Eslah / TILA belum dipilih'}
                        </div>
                        <div className="text-[10.5px] font-mono-code text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {gatePassNomor ? `No: ${gatePassNomor}` : 'No. belum terbit'}
                        </div>
                      </td>

                      <td className="py-3 px-2 align-top max-w-[170px]">
                        <div
                          className="mb-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <StatusTruckingBadge
                            statusTrucking={truckingStatus}
                            onToggle={
                              canEditPhase2
                                ? (next) =>
                                    void onUpdateDoPelayaran(s.kodeOs, {
                                      truckingStatus: next,
                                    })
                                : undefined
                            }
                          />
                        </div>
                        {s.truckingNamaSupir || s.truckingNoPlat || s.truckingNoHpSupir ? (
                          <div className="space-y-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              Supir: {s.truckingNamaSupir || '-'}
                            </div>
                            <div className="font-mono-code text-[10.5px] text-slate-600 dark:text-slate-300 truncate">
                              Plat: {s.truckingNoPlat || '-'}
                            </div>
                            <div className="font-mono-code text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                              HP: {s.truckingNoHpSupir || '-'}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                            Data supir &amp; plat belum diisi
                          </div>
                        )}
                      </td>

                      <td
                        className="py-3 px-2 text-right align-top whitespace-nowrap no-print"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex flex-col items-end gap-1.5">
                          <StatusGateOutBadge
                            gateOutStatus={gateOutStatus}
                            shipmentStatus={s.status}
                            onToggle={
                              canEditPhase2
                                ? async (next) => {
                                    await onUpdateDoPelayaran(s.kodeOs, {
                                      gateOutStatus: next,
                                      bindDokumenSelesai: next === 'Sudah',
                                    });
                                    if (next === 'Sudah') {
                                      setActiveSjKodeOs(s.kodeOs);
                                    }
                                  }
                                : undefined
                            }
                          />
                          {s.gateOutTanggal && (
                            <div className="text-[10px] font-mono-code text-slate-500 dark:text-slate-400 tabular-nums">
                              {s.gateOutTanggal}
                            </div>
                          )}
                          {isContainerGateOut(s) && (
                            <div className="inline-flex flex-col items-end gap-1">
                              <StatusSuratJalanBadge
                                suratJalanStatus={normalizeStatusSuratJalan(
                                  s.suratJalanStatus,
                                  gateOutStatus,
                                  s.status
                                )}
                                gateOutStatus={gateOutStatus}
                                shipmentStatus={s.status}
                                onToggle={
                                  canEditPhase2
                                    ? (nextSj) =>
                                        void onUpdateDoPelayaran(s.kodeOs, {
                                          suratJalanStatus: nextSj,
                                        })
                                    : undefined
                                }
                              />
                              <button
                                type="button"
                                onClick={() => setActiveSjKodeOs(s.kodeOs)}
                                title={`Buka Surat Jalan ${s.suratJalanNomor || generateSuratJalanNomor(s.kodeOs)}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-500/15 hover:bg-sky-100 dark:hover:bg-sky-500/25 border border-sky-200 dark:border-sky-500/35 text-[10.5px] font-semibold text-sky-700 dark:text-sky-300 cursor-pointer"
                              >
                                <ClipboardList className="w-3 h-3" />
                                <span>
                                  {s.suratJalanNomor || generateSuratJalanNomor(s.kodeOs)}
                                </span>
                              </button>
                            </div>
                          )}
                          {isContainerGateOut(s) && s.status === 'Selesai' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Ikatan Selesai</span>
                            </span>
                          )}
                          {onOpenBilling && isShipmentBillingEligible(s) && (
                            <StatusPenagihanBadge
                              billingStatus={s.billingStatus}
                              shipment={s}
                              onClick={() => onOpenBilling(s.kodeOs, 'owner')}
                            />
                          )}
                          <div className="inline-flex items-center gap-1">
                            {canEditPhase2 && (
                              <button
                                type="button"
                                onClick={() => openEditor(s)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-50 dark:bg-violet-500/20 hover:bg-violet-100 dark:hover:bg-violet-500/30 border border-violet-200 dark:border-violet-500/35 text-[11px] font-semibold text-violet-700 dark:text-violet-200 cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Atur D/O</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenDetail(s.kodeOs)}
                              className="px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-[11px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              Detail
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (< 768px) */}
          <div className="md:hidden space-y-3" data-testid="mobile-do-cards">
            {filtered.map((s) => {
              const dokStatus = normalizeStatusDokumen(s.statusDokumen);
              const doStatus = normalizeStatusDoPelayaran(s.doPelayaranStatus);
              const gatePassStatus = normalizeStatusGatePass(s.doGatePassStatus);
              const gatePassJenis = normalizeGatePassJenis(s.doGatePassJenis);
              const gatePassNomor = s.doGatePassNomor || s.eslah || '';
              const truckingStatus = normalizeStatusTrucking(s.truckingStatus);
              const gateOutStatus = normalizeStatusGateOut(s.gateOutStatus, s.status);
              return (
                <div
                  key={s.kodeOs}
                  onClick={() => onOpenDetail(s.kodeOs)}
                  className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200 dark:border-white/[0.08] p-4 space-y-2.5 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono-code text-xs font-bold text-[#0B2545] dark:text-violet-300">
                          {s.kodeOs}
                        </span>
                        <div onClick={(e) => e.stopPropagation()}>
                          <StatusDokumenBadge
                            statusDokumen={dokStatus}
                            onToggle={
                              canEditPhase1 && onUpdateStatusDokumen
                                ? (next) => void onUpdateStatusDokumen(s.kodeOs, next)
                                : undefined
                            }
                          />
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate mt-1">
                        {s.namaCustomer}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        BL: {s.noBl} · {s.ship || '-'}
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <StatusDoBadge
                        statusDo={doStatus}
                        onToggle={
                          canEditPhase2
                            ? (next) =>
                                void onUpdateDoPelayaran(s.kodeOs, {
                                  doPelayaranStatus: next,
                                })
                            : undefined
                        }
                      />
                    </div>
                  </div>

                  <div className="text-[11px] font-mono-code text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#182032] px-2.5 py-1.5 rounded-lg">
                    Cont: {s.noCont || '-'}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={s.status} />
                    <DoValidityBadge
                      doBerlakuSampai={s.doBerlakuSampai}
                      shipmentStatus={s.status}
                    />
                  </div>

                  {s.doCatatanPerpanjangan && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#161D2F] rounded-lg px-2.5 py-2 border border-slate-200/70 dark:border-white/[0.06]">
                      {s.doCatatanPerpanjangan}
                    </p>
                  )}

                  {/* Ringkasan Eslah / TILA, Trucking & Gate-Out di Mobile */}
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#161D2F] border border-slate-200/70 dark:border-white/[0.06] space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Eslah / TILA (Kartu Gate)
                        </span>
                        <div onClick={(e) => e.stopPropagation()}>
                          <StatusGatePassBadge
                            statusGatePass={gatePassStatus}
                            onToggle={
                              canEditPhase2
                                ? (next) =>
                                    void onUpdateDoPelayaran(s.kodeOs, {
                                      doGatePassStatus: next,
                                    })
                                : undefined
                            }
                          />
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-700 dark:text-slate-300">
                        {gatePassJenis || 'Belum dipilih'}
                        {gatePassNomor ? ` · No: ${gatePassNomor}` : ''}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#161D2F] border border-slate-200/70 dark:border-white/[0.06] space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Kesediaan Trucking
                        </span>
                        <div onClick={(e) => e.stopPropagation()}>
                          <StatusTruckingBadge
                            statusTrucking={truckingStatus}
                            onToggle={
                              canEditPhase2
                                ? (next) =>
                                    void onUpdateDoPelayaran(s.kodeOs, {
                                      truckingStatus: next,
                                    })
                                : undefined
                            }
                          />
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-700 dark:text-slate-300">
                        {s.truckingNamaSupir || s.truckingNoPlat || s.truckingNoHpSupir ? (
                          <span>
                            Supir: <strong>{s.truckingNamaSupir || '-'}</strong> · Plat:{' '}
                            <span className="font-mono-code">{s.truckingNoPlat || '-'}</span> · HP:{' '}
                            <span className="font-mono-code">{s.truckingNoHpSupir || '-'}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">
                            Data supir &amp; plat belum diisi
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#161D2F] border border-slate-200/70 dark:border-white/[0.06] space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Gate-Out &amp; Surat Jalan
                        </span>
                        <div onClick={(e) => e.stopPropagation()}>
                          <StatusGateOutBadge
                            gateOutStatus={gateOutStatus}
                            shipmentStatus={s.status}
                            onToggle={
                              canEditPhase2
                                ? async (next) => {
                                    await onUpdateDoPelayaran(s.kodeOs, {
                                      gateOutStatus: next,
                                      bindDokumenSelesai: next === 'Sudah',
                                    });
                                    if (next === 'Sudah') {
                                      setActiveSjKodeOs(s.kodeOs);
                                    }
                                  }
                                : undefined
                            }
                          />
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-700 dark:text-slate-300">
                        {isContainerGateOut(s) ? (
                          <span>
                            {s.gateOutTanggal ? `Tgl: ${s.gateOutTanggal} · ` : ''}
                            {s.status === 'Selesai'
                              ? 'Terikat Proses Dokumen Selesai'
                              : s.gateOutCatatan || 'Sudah keluar pelabuhan'}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">
                            Belum Gate-Out (menuju proses Dokumen Selesai)
                          </span>
                        )}
                      </div>
                      {isContainerGateOut(s) && (
                        <div
                          className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-white/[0.06]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <StatusSuratJalanBadge
                            suratJalanStatus={normalizeStatusSuratJalan(
                              s.suratJalanStatus,
                              gateOutStatus,
                              s.status
                            )}
                            gateOutStatus={gateOutStatus}
                            shipmentStatus={s.status}
                            onToggle={
                              canEditPhase2
                                ? (nextSj) =>
                                    void onUpdateDoPelayaran(s.kodeOs, {
                                      suratJalanStatus: nextSj,
                                    })
                                : undefined
                            }
                          />
                          <button
                            type="button"
                            onClick={() => setActiveSjKodeOs(s.kodeOs)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-500/35 text-[11px] font-semibold text-sky-700 dark:text-sky-300 cursor-pointer"
                          >
                            <ClipboardList className="w-3 h-3" />
                            <span>{s.suratJalanNomor || generateSuratJalanNomor(s.kodeOs)}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {canEditPhase2 && (
                    <div
                      className="flex flex-wrap justify-end gap-2 pt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isContainerGateOut(s) && (
                        <button
                          type="button"
                          onClick={() => setActiveSjKodeOs(s.kodeOs)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          <span>Surat Jalan</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditor(s)}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Atur D/O, TILA &amp; Gate-Out
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal Edit Kesiapan D/O, Eslah/TILA (Kartu Gate) & Trucking */}
      {editingShipment && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingShipment(null);
          }}
        >
          <div
            role="dialog"
            aria-label={`Atur Kesiapan D/O ${editingShipment.kodeOs}`}
            className="w-full max-w-2xl bg-white dark:bg-[#111625] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            <div className="px-5 py-4 bg-[#0B2545] dark:bg-[#0D111C] text-white flex items-center justify-between gap-3 border-b border-white/10 shrink-0">
              <div>
                <h3 className="text-sm font-bold">
                  Atur Kesiapan D/O, Eslah / TILA &amp; Trucking · {editingShipment.kodeOs}
                </h3>
                <p className="text-[11px] text-white/70 dark:text-slate-400">
                  {editingShipment.namaCustomer} · {editingShipment.noCont || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingShipment(null)}
                aria-label="Tutup modal D/O"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditor} className="p-5 space-y-5 overflow-y-auto">
              {/* Status Dokumen Checker (Draft / Ready) */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#0B2545] dark:text-white">
                    Status Dokumen Checker (Draft / Ready)
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {canEditPhase1
                      ? 'Pencatatan D/O dapat dibuat dari status Draft maupun Ready.'
                      : 'Menampilkan status dokumen dari Checker saat ini.'}
                  </p>
                </div>
                {canEditPhase1 ? (
                  <div
                    role="radiogroup"
                    aria-label="Status Dokumen Checker di Modal D/O"
                    className="inline-flex rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#101522] p-0.5"
                  >
                    {(['Draft', 'Ready'] as StatusDokumenType[]).map((opt) => {
                      const active = editStatusDokumen === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setEditStatusDokumen(opt)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                            active
                              ? opt === 'Ready'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-yellow-400 text-slate-950'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <StatusDokumenBadge statusDokumen={editStatusDokumen} />
                )}
              </div>

              {/* Section 1: D/O Pelayaran */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
                <div className="text-xs font-bold text-[#0B2545] dark:text-white flex items-center gap-1.5">
                  <Anchor className="w-3.5 h-3.5 text-[#F28C28] dark:text-violet-400" />
                  <span>1. Kesiapan D/O Pelayaran &amp; Masa Berlaku</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Status D/O Pelayaran">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={editStatus === 'Belum'}
                    onClick={() => setEditStatus('Belum')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      editStatus === 'Belum'
                        ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-400 dark:border-amber-400/60 ring-2 ring-amber-300 dark:ring-amber-400/40'
                        : 'bg-white dark:bg-[#182032] border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Belum</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      D/O belum terbit / masih diproses
                    </div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={editStatus === 'Sedia'}
                    onClick={() => setEditStatus('Sedia')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      editStatus === 'Sedia'
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-400/60 ring-2 ring-emerald-300 dark:ring-emerald-400/40'
                        : 'bg-white dark:bg-[#182032] border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Sedia</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      D/O siap untuk pengeluaran kontainer
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <label
                      htmlFor="modalDoBerlakuInput"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Masa Berlaku D/O / Batas Perpanjangan
                    </label>
                    <input
                      id="modalDoBerlakuInput"
                      type="date"
                      value={editBerlaku}
                      onChange={(e) => setEditBerlaku(e.target.value)}
                      className={inputSurfaceCls}
                    />
                  </div>
                  <div className="sm:col-span-7">
                    <label
                      htmlFor="modalDoCatatanInput"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Catatan Masa Berlaku &amp; Perpanjangan D/O
                    </label>
                    <textarea
                      id="modalDoCatatanInput"
                      rows={2}
                      value={editCatatan}
                      onChange={(e) => setEditCatatan(e.target.value)}
                      placeholder="Contoh: Perpanjangan D/O ke-1 s/d 20 Nov 2026..."
                      className={inputSurfaceCls}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Pengurusan Eslah / Buat TILA (Kartu Gate Pelabuhan Setempat) */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
                <div className="text-xs font-bold text-[#0B2545] dark:text-white flex items-center gap-1.5">
                  <IdCard className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span>2. Pengurusan Eslah / Buat TILA (Kartu Gate Pelabuhan Setempat)</span>
                </div>

                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Status Eslah atau TILA Kartu Gate">
                  {(['Belum', 'Proses', 'Sedia'] as StatusGatePassType[]).map((opt) => {
                    const active = editGatePassStatus === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setEditGatePassStatus(opt)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? opt === 'Sedia'
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-400/60 ring-2 ring-emerald-300 dark:ring-emerald-400/40'
                              : opt === 'Proses'
                                ? 'bg-sky-50 dark:bg-sky-500/15 border-sky-400 dark:border-sky-400/60 ring-2 ring-sky-300 dark:ring-sky-400/40'
                                : 'bg-amber-50 dark:bg-amber-500/15 border-amber-400 dark:border-amber-400/60 ring-2 ring-amber-300 dark:ring-amber-400/40'
                            : 'bg-white dark:bg-[#182032] border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              opt === 'Sedia'
                                ? 'bg-emerald-500'
                                : opt === 'Proses'
                                  ? 'bg-sky-500'
                                  : 'bg-amber-500'
                            }`}
                          />
                          <span>{opt}</span>
                        </div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {opt === 'Sedia'
                            ? 'Kartu gate / Eslah terbit'
                            : opt === 'Proses'
                              ? 'Sedang diurus di pelabuhan'
                              : 'Belum diurus'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="modalGatePassJenisInput"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Jenis Pengurusan Pelabuhan Setempat
                    </label>
                    <select
                      id="modalGatePassJenisInput"
                      value={editGatePassJenis}
                      onChange={(e) => setEditGatePassJenis(e.target.value as GatePassJenisType)}
                      className={inputSurfaceCls}
                    >
                      <option value="TILA (Kartu Gate)">TILA (Kartu Gate)</option>
                      <option value="Eslah">Eslah</option>
                      <option value="Eslah & TILA">Eslah &amp; TILA</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="modalGatePassNomorInput"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      No. TILA / Kartu Gate / Eslah
                    </label>
                    <input
                      id="modalGatePassNomorInput"
                      type="text"
                      value={editGatePassNomor}
                      onChange={(e) => setEditGatePassNomor(e.target.value)}
                      placeholder="Contoh: TILA-JICT-261108 / ESLAH-KOJA-09"
                      className={`${inputSurfaceCls} font-mono-code`}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Kesediaan Trucking & Data Supir */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#0B2545] dark:text-white flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>3. Kesediaan Trucking &amp; Identitas Supir</span>
                  </div>
                  <div className="inline-flex rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#101522] p-0.5" role="radiogroup" aria-label="Status Kesediaan Trucking">
                    {(['Belum', 'Sedia'] as StatusDoPelayaranType[]).map((opt) => {
                      const active = editTruckingStatus === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setEditTruckingStatus(opt)}
                          className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                            active
                              ? opt === 'Sedia'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-400 text-slate-950'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          Trucking: {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="modalTruckingSupirInput"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Nama Supir
                    </label>
                    <input
                      id="modalTruckingSupirInput"
                      type="text"
                      value={editNamaSupir}
                      onChange={(e) => {
                        setEditNamaSupir(e.target.value);
                        if (e.target.value.trim() && editNoPlat.trim()) {
                          setEditTruckingStatus('Sedia');
                        }
                      }}
                      placeholder="Contoh: Budi Hartono"
                      className={inputSurfaceCls}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="modalTruckingPlatInput"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      No. Plat Truk
                    </label>
                    <input
                      id="modalTruckingPlatInput"
                      type="text"
                      value={editNoPlat}
                      onChange={(e) => {
                        setEditNoPlat(e.target.value.toUpperCase());
                        if (e.target.value.trim() && editNamaSupir.trim()) {
                          setEditTruckingStatus('Sedia');
                        }
                      }}
                      placeholder="Contoh: B 9412 UIX"
                      className={`${inputSurfaceCls} font-mono-code uppercase`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="modalTruckingHpInput"
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>No. HP Supir</span>
                    </label>
                    <input
                      id="modalTruckingHpInput"
                      type="tel"
                      value={editNoHpSupir}
                      onChange={(e) => setEditNoHpSupir(e.target.value)}
                      placeholder="Contoh: 0812-8841-2094"
                      className={`${inputSurfaceCls} font-mono-code`}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Gate-Out (GetOut) & Ikatan Proses Dokumen Selesai */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-emerald-500/25 dark:border-emerald-500/30">
                <div className="text-xs font-bold text-[#0B2545] dark:text-white flex items-center gap-1.5">
                  <LogOut className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>4. Gate-Out Pelabuhan &amp; Ikatan Proses Dokumen Selesai</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Status Gate-Out Kontainer">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={editGateOutStatus === 'Belum'}
                    onClick={() => setEditGateOutStatus('Belum')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      editGateOutStatus === 'Belum'
                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-500 ring-2 ring-slate-300 dark:ring-slate-500/40'
                        : 'bg-white dark:bg-[#182032] border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>Belum Gate-Out</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Kontainer masih di terminal / menunggu keluar
                    </div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={editGateOutStatus === 'Sudah'}
                    onClick={() => {
                      setEditGateOutStatus('Sudah');
                      if (!editGateOutTanggal) {
                        setEditGateOutTanggal(new Date().toISOString().slice(0, 10));
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      editGateOutStatus === 'Sudah'
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-400/60 ring-2 ring-emerald-300 dark:ring-emerald-400/40'
                        : 'bg-white dark:bg-[#182032] border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Sudah Gate-Out</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Kontainer keluar &amp; ikat ke proses Dokumen Selesai
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <label
                      htmlFor="modalGateOutTanggalInput"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Tanggal Gate-Out
                    </label>
                    <input
                      id="modalGateOutTanggalInput"
                      type="date"
                      value={editGateOutTanggal}
                      onChange={(e) => setEditGateOutTanggal(e.target.value)}
                      className={inputSurfaceCls}
                    />
                  </div>
                  <div className="sm:col-span-7">
                    <label
                      htmlFor="modalGateOutCatatanInput"
                      className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Catatan Gate-Out
                    </label>
                    <input
                      id="modalGateOutCatatanInput"
                      type="text"
                      value={editGateOutCatatan}
                      onChange={(e) => setEditGateOutCatatan(e.target.value)}
                      placeholder="Contoh: Gate-Out JICT jam 14:20 via Supir Agus"
                      className={inputSurfaceCls}
                    />
                  </div>
                </div>

                {editGateOutStatus === 'Sudah' && (
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-900 dark:text-emerald-200 cursor-pointer">
                    <input
                      id="modalBindSelesaiCheckbox"
                      type="checkbox"
                      checked={editBindSelesai}
                      onChange={(e) => setEditBindSelesai(e.target.checked)}
                      className="mt-0.5 rounded border-emerald-400"
                    />
                    <span>
                      <strong>Ikat Gate-Out menjadi Proses Dokumen Selesai</strong> — otomatis mengubah Status Shipment ke <span className="font-semibold">Selesai</span> dan melengkapi Checklist Dokumen OS.
                    </span>
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setEditingShipment(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] hover:opacity-95 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Kesiapan D/O'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal "+ Buat Catatan D/O" (Dari Status Draft / Ready atau Buat Shipment+D/O Baru) */}
      {createDoOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateDoOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-label="Buat Catatan D/O dari Status Draft atau Ready"
            className="w-full max-w-2xl bg-white dark:bg-[#111625] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            <div className="px-5 py-4 bg-[#0B2545] dark:bg-[#0D111C] text-white flex items-center justify-between gap-3 border-b border-white/10 shrink-0">
              <div>
                <h3 className="text-sm font-bold">
                  Buat Catatan D/O (Status Draft &amp; Ready)
                </h3>
                <p className="text-[11px] text-white/70 dark:text-slate-400">
                  Pilih shipment berstatus Draft/Ready yang sudah ada, atau buat catatan shipment + D/O baru langsung dari modul D/O.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateDoOpen(false)}
                aria-label="Tutup modal buat catatan D/O"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {canCreateFromDo && canEditPhase2 && (
              <div className="px-5 pt-3 pb-2 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0D111C]/70 grid grid-cols-2 gap-2 shrink-0" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={createTab === 'existing'}
                  onClick={() => setCreateTab('existing')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                    createTab === 'existing'
                      ? 'bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white border-transparent'
                      : 'bg-white dark:bg-[#182032] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                  }`}
                >
                  Pilih Shipment (Draft / Ready)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={createTab === 'new'}
                  onClick={() => setCreateTab('new')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                    createTab === 'new'
                      ? 'bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white border-transparent'
                      : 'bg-white dark:bg-[#182032] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                  }`}
                >
                  Buat Baru (Draft / Ready)
                </button>
              </div>
            )}

            <div className="p-5 overflow-y-auto space-y-4">
              {createTab === 'existing' && canEditPhase2 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        aria-label="Cari shipment Draft atau Ready untuk D/O"
                        value={pickSearch}
                        onChange={(e) => setPickSearch(e.target.value)}
                        placeholder="Cari Kode OS, Customer, No. BL..."
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div className="inline-flex rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161D2F] p-0.5">
                      {(['', 'Draft', 'Ready'] as const).map((opt) => (
                        <button
                          key={opt || 'all'}
                          type="button"
                          onClick={() => setPickDokFilter(opt)}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                            pickDokFilter === opt
                              ? 'bg-[#0B2545] dark:bg-violet-600 text-white'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {opt === '' ? 'Semua' : opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-white/[0.06] border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
                    {pickableShipments.map((item) => {
                      const dok = normalizeStatusDokumen(item.statusDokumen);
                      return (
                        <button
                          key={item.kodeOs}
                          type="button"
                          onClick={() => {
                            setCreateDoOpen(false);
                            openEditor(item);
                          }}
                          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left bg-white dark:bg-[#161D2F] hover:bg-slate-50 dark:hover:bg-[#1B2439] cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono-code text-xs font-bold text-[#0B2545] dark:text-violet-300">
                                {item.kodeOs}
                              </span>
                              <StatusDokumenBadge statusDokumen={dok} />
                              <StatusDoBadge statusDo={normalizeStatusDoPelayaran(item.doPelayaranStatus)} />
                              <StatusGateOutBadge
                                gateOutStatus={normalizeStatusGateOut(item.gateOutStatus, item.status)}
                                shipmentStatus={item.status}
                              />
                            </div>
                            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate mt-1">
                              {item.namaCustomer}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              BL: {item.noBl} · {item.noCont || '-'}
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-md bg-violet-50 dark:bg-violet-500/20 text-[11px] font-semibold text-violet-700 dark:text-violet-200 shrink-0">
                            Catat D/O →
                          </span>
                        </button>
                      );
                    })}
                    {pickableShipments.length === 0 && (
                      <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        Tidak ada shipment cocok.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateNewDoShipment} className="space-y-4">
                  {/* Status Awal Dokumen Checker: Draft / Ready */}
                  <div className="space-y-2">
                    <span className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Mulai Catatan D/O dari Status Dokumen:
                    </span>
                    <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Status Dokumen Awal Catatan D/O">
                      {(['Draft', 'Ready'] as StatusDokumenType[]).map((opt) => {
                        const active = newDokStatus === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setNewDokStatus(opt)}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                              active
                                ? opt === 'Ready'
                                  ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-400/40'
                                  : 'bg-yellow-50 dark:bg-yellow-500/15 border-yellow-400 ring-2 ring-yellow-300 dark:ring-yellow-400/40'
                                : 'bg-white dark:bg-[#182032] border-slate-200 dark:border-white/10'
                            }`}
                          >
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  opt === 'Ready' ? 'bg-emerald-500' : 'bg-yellow-500'
                                }`}
                              />
                              <span>{opt}</span>
                            </div>
                            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {opt === 'Draft'
                                ? 'Buat catatan D/O lebih awal selagi dokumen Draft'
                                : 'Dokumen Checker sudah Ready dan langsung dicatat D/O'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Identitas Shipment & Kontainer */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
                    <div>
                      <label htmlFor="newDoKodeCustomer" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Kode Customer <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="newDoKodeCustomer"
                        type="text"
                        list="doCustomerSuggestions"
                        value={newKodeCustomer}
                        onChange={(e) => {
                          const code = e.target.value;
                          setNewKodeCustomer(code);
                          const match = customers.find(
                            (c) => c.kodeCustomer.trim().toLowerCase() === code.trim().toLowerCase()
                          );
                          if (match) setNewNamaCustomer(match.namaCustomer);
                        }}
                        placeholder="CUST-001"
                        className={`${inputSurfaceCls} font-mono-code`}
                      />
                      <datalist id="doCustomerSuggestions">
                        {customers.map((c) => (
                          <option key={c.kodeCustomer} value={c.kodeCustomer}>
                            {c.namaCustomer}
                          </option>
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label htmlFor="newDoNamaCustomer" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nama Customer
                      </label>
                      <input
                        id="newDoNamaCustomer"
                        type="text"
                        value={newNamaCustomer}
                        onChange={(e) => setNewNamaCustomer(e.target.value)}
                        placeholder="PT Maju Jaya"
                        className={inputSurfaceCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="newDoNoBl" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        No. BL <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="newDoNoBl"
                        type="text"
                        value={newNoBl}
                        onChange={(e) => setNewNoBl(e.target.value)}
                        placeholder="EGLV142600899999"
                        className={`${inputSurfaceCls} font-mono-code`}
                      />
                    </div>
                    <div>
                      <label htmlFor="newDoEta" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Tanggal ETA <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="newDoEta"
                        type="date"
                        value={newEta}
                        onChange={(e) => setNewEta(e.target.value)}
                        className={inputSurfaceCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="newDoShip" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Kapal / Voyage
                      </label>
                      <input
                        id="newDoShip"
                        type="text"
                        value={newShip}
                        onChange={(e) => setNewShip(e.target.value)}
                        placeholder="MV EVER FORTUNE"
                        className={inputSurfaceCls}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label htmlFor="newDoNoCont" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          No. Kontainer
                        </label>
                        <input
                          id="newDoNoCont"
                          type="text"
                          value={newNoCont}
                          onChange={(e) => setNewNoCont(e.target.value.toUpperCase())}
                          placeholder="EGHU9011223"
                          className={`${inputSurfaceCls} font-mono-code`}
                        />
                      </div>
                      <div>
                        <label htmlFor="newDoUkuranCont" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Ukuran
                        </label>
                        <select
                          id="newDoUkuranCont"
                          value={newUkuranCont}
                          onChange={(e) => setNewUkuranCont(e.target.value)}
                          className={inputSurfaceCls}
                        >
                          <option value="20FT">20FT</option>
                          <option value="40FT">40FT</option>
                          <option value="40HC">40HC</option>
                          <option value="40GP">40GP</option>
                          <option value="LCL">LCL</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Kesiapan D/O, Eslah/TILA, Trucking & Gate-Out Awal */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
                    <div>
                      <label htmlFor="newDoPelayaranStatus" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Status D/O Pelayaran
                      </label>
                      <select
                        id="newDoPelayaranStatus"
                        value={newDoStatus}
                        onChange={(e) => setNewDoStatus(e.target.value as StatusDoPelayaranType)}
                        className={inputSurfaceCls}
                      >
                        <option value="Belum">Belum Sedia</option>
                        <option value="Sedia">Sedia</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="newDoBerlaku" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Masa Berlaku D/O
                      </label>
                      <input
                        id="newDoBerlaku"
                        type="date"
                        value={newDoBerlaku}
                        onChange={(e) => setNewDoBerlaku(e.target.value)}
                        className={inputSurfaceCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="newDoGateOutStatus" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Status Gate-Out
                      </label>
                      <select
                        id="newDoGateOutStatus"
                        value={newGateOutStatus}
                        onChange={(e) => {
                          const v = e.target.value as StatusGateOutType;
                          setNewGateOutStatus(v);
                          if (v === 'Sudah' && !newGateOutTanggal) {
                            setNewGateOutTanggal(new Date().toISOString().slice(0, 10));
                          }
                        }}
                        className={inputSurfaceCls}
                      >
                        <option value="Belum">Belum Gate-Out</option>
                        <option value="Sudah">Sudah Gate-Out</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label htmlFor="newDoCatatan" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Catatan Perpanjangan / D/O
                      </label>
                      <input
                        id="newDoCatatan"
                        type="text"
                        value={newDoCatatan}
                        onChange={(e) => setNewDoCatatan(e.target.value)}
                        placeholder="Catatan kesiapan D/O atau perpanjangan..."
                        className={inputSurfaceCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="newDoGatePassStatus" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Eslah / TILA
                      </label>
                      <select
                        id="newDoGatePassStatus"
                        value={newGatePassStatus}
                        onChange={(e) => setNewGatePassStatus(e.target.value as StatusGatePassType)}
                        className={inputSurfaceCls}
                      >
                        <option value="Belum">Belum</option>
                        <option value="Proses">Proses</option>
                        <option value="Sedia">Sedia</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="newDoGatePassJenis" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Jenis Gate Pass
                      </label>
                      <select
                        id="newDoGatePassJenis"
                        value={newGatePassJenis}
                        onChange={(e) => setNewGatePassJenis(e.target.value as GatePassJenisType)}
                        className={inputSurfaceCls}
                      >
                        <option value="TILA (Kartu Gate)">TILA (Kartu Gate)</option>
                        <option value="Eslah">Eslah</option>
                        <option value="Eslah & TILA">Eslah &amp; TILA</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="newDoGatePassNomor" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        No. TILA / Eslah
                      </label>
                      <input
                        id="newDoGatePassNomor"
                        type="text"
                        value={newGatePassNomor}
                        onChange={(e) => setNewGatePassNomor(e.target.value)}
                        placeholder="TILA-JICT-..."
                        className={`${inputSurfaceCls} font-mono-code`}
                      />
                    </div>
                    <div>
                      <label htmlFor="newDoTruckingStatus" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Trucking
                      </label>
                      <select
                        id="newDoTruckingStatus"
                        value={newTruckingStatus}
                        onChange={(e) => setNewTruckingStatus(e.target.value as StatusDoPelayaranType)}
                        className={inputSurfaceCls}
                      >
                        <option value="Belum">Belum</option>
                        <option value="Sedia">Sedia</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="newDoNamaSupir" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nama Supir
                      </label>
                      <input
                        id="newDoNamaSupir"
                        type="text"
                        value={newNamaSupir}
                        onChange={(e) => setNewNamaSupir(e.target.value)}
                        placeholder="Nama supir"
                        className={inputSurfaceCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="newDoNoPlat" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        No. Plat &amp; HP
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          id="newDoNoPlat"
                          type="text"
                          aria-label="No Plat Truk Baru"
                          value={newNoPlat}
                          onChange={(e) => setNewNoPlat(e.target.value.toUpperCase())}
                          placeholder="B 9123 UIX"
                          className={`${inputSurfaceCls} font-mono-code`}
                        />
                        <input
                          id="newDoNoHpSupir"
                          type="tel"
                          aria-label="No HP Supir Baru"
                          value={newNoHpSupir}
                          onChange={(e) => setNewNoHpSupir(e.target.value)}
                          placeholder="0812..."
                          className={`${inputSurfaceCls} font-mono-code`}
                        />
                      </div>
                    </div>

                    {newGateOutStatus === 'Sudah' && (
                      <>
                        <div>
                          <label htmlFor="newDoGateOutTanggal" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Tgl. Gate-Out
                          </label>
                          <input
                            id="newDoGateOutTanggal"
                            type="date"
                            value={newGateOutTanggal}
                            onChange={(e) => setNewGateOutTanggal(e.target.value)}
                            className={inputSurfaceCls}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="newDoGateOutCatatan" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Catatan Gate-Out
                          </label>
                          <input
                            id="newDoGateOutCatatan"
                            type="text"
                            value={newGateOutCatatan}
                            onChange={(e) => setNewGateOutCatatan(e.target.value)}
                            placeholder="Catatan gate-out..."
                            className={inputSurfaceCls}
                          />
                        </div>
                        <label className="sm:col-span-3 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newBindSelesai}
                            onChange={(e) => setNewBindSelesai(e.target.checked)}
                          />
                          <span>Ikat Gate-Out menjadi Proses Dokumen Selesai</span>
                        </label>
                      </>
                    )}
                  </div>

                  {createError && (
                    <div role="alert" className="text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 rounded-lg px-3 py-2">
                      {createError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setCreateDoOpen(false)}
                      className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{creating ? 'Menyimpan...' : 'Simpan Catatan D/O Baru'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Surat Jalan & Tracking Pengiriman (Auto-open saat Gate-Out Sudah) */}
      {activeSjKodeOs && (() => {
        const sjShipment = shipments.find((item) => item.kodeOs === activeSjKodeOs);
        if (!sjShipment) return null;
        return (
          <SuratJalanModal
            shipment={sjShipment}
            pengaturan={pengaturan}
            canEdit={canEditPhase2}
            onClose={() => setActiveSjKodeOs(null)}
            onOpenBilling={onOpenBilling}
            onSaveSuratJalan={async (kodeOs, sjPayload) => {
              await onUpdateDoPelayaran(kodeOs, sjPayload);
            }}
          />
        );
      })()}
    </div>
  );
}
