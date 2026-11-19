import React, { useState } from 'react';
import { Lock, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react';
import type {
  Customer,
  DokumenItem,
  GatePassJenisType,
  Importir,
  JalurType,
  KontainerItem,
  Pengaturan,
  PendingUploadFile,
  PhasePermissions,
  Shipment,
  ShipmentPhase,
  Shipper,
  StatusDokumenType,
  StatusDoPelayaranType,
  StatusGateOutType,
  StatusGatePassType,
  UserRole,
} from '../types/ppjk';
import {
  calculateCountdownEta,
  canPerformAction,
  canUserEditPhase,
  createEmptyChecklist,
  isCheckerRole,
  normalizeGatePassJenis,
  normalizeStatusDokumen,
  normalizeStatusDoPelayaran,
  normalizeStatusGateOut,
  normalizeStatusGatePass,
  normalizeStatusTrucking,
  PHASE_META,
  validateShipmentInput,
} from '../utils/ppjkLogic';
import { GoogleSignInButton } from './GoogleDriveButton';
import { describeRegisteredDriveDestination } from '../utils/googleDriveFolderLogic';

interface ShipmentFormModalProps {
  initialShipment: Shipment | null;
  initialContainers: KontainerItem[];
  existingDocuments?: DokumenItem[];
  customers: Customer[];
  importirs: Importir[];
  shippers: Shipper[];
  pengaturan: Pengaturan;
  userRole: UserRole;
  phasePermissions?: PhasePermissions;
  currentUsername: string;
  googleDriveUserEmail?: string | null;
  driveConnecting?: boolean;
  onConnectGoogleDrive?: () => Promise<void>;
  onClose: () => void;
  onSubmit: (
    shipment: Shipment,
    containers: KontainerItem[],
    isNew: boolean,
    pendingUploads?: PendingUploadFile[]
  ) => Promise<void>;
}

const PHASES: Array<{ id: ShipmentPhase; label: string }> = [
  { id: 1, label: '1. Dokumen' },
  { id: 2, label: '2. Pelayaran' },
  { id: 3, label: '3. Customs' },
  { id: 4, label: '4. Pasca-SPPB' },
];

export function ShipmentFormModal({
  initialShipment,
  initialContainers,
  existingDocuments = [],
  customers,
  importirs,
  shippers,
  pengaturan,
  userRole,
  phasePermissions,
  currentUsername,
  googleDriveUserEmail,
  driveConnecting = false,
  onConnectGoogleDrive,
  onClose,
  onSubmit,
}: ShipmentFormModalProps) {
  const isNew = !initialShipment;
  const [phase, setPhase] = useState<ShipmentPhase>(() => {
    if (isNew) return 1;
    const firstEditable = ([1, 2, 3, 4] as ShipmentPhase[]).find((p) =>
      canUserEditPhase({ role: userRole, phasePermissions }, p)
    );
    return firstEditable || 1;
  });

  const [form, setForm] = useState<Shipment>(() => {
    if (initialShipment) {
      const cloned = JSON.parse(JSON.stringify(initialShipment)) as Shipment;
      cloned.kodeManualDokOs = cloned.kodeManualDokOs || '';
      cloned.statusDokumen = normalizeStatusDokumen(cloned.statusDokumen);
      cloned.doPelayaranStatus = normalizeStatusDoPelayaran(cloned.doPelayaranStatus);
      cloned.doGatePassStatus = normalizeStatusGatePass(cloned.doGatePassStatus);
      cloned.doGatePassJenis = normalizeGatePassJenis(cloned.doGatePassJenis);
      cloned.doGatePassNomor = cloned.doGatePassNomor || '';
      cloned.truckingStatus = normalizeStatusTrucking(cloned.truckingStatus);
      cloned.truckingNamaSupir = cloned.truckingNamaSupir || '';
      cloned.truckingNoPlat = cloned.truckingNoPlat || '';
      cloned.truckingNoHpSupir = cloned.truckingNoHpSupir || '';
      cloned.gateOutStatus = normalizeStatusGateOut(cloned.gateOutStatus, cloned.status);
      cloned.gateOutTanggal = cloned.gateOutTanggal || '';
      cloned.gateOutCatatan = cloned.gateOutCatatan || '';
      return cloned;
    }
    return {
      kodeOs: 'OTOMATIS (OS-YYMM-NNNN)',
      kodeManualDokOs: '',
      ship: '',
      kodeCustomer: '',
      namaCustomer: '',
      tglTerimaDok: new Date().toISOString().slice(0, 10),
      terimaDok: createEmptyChecklist(pengaturan.checklistItems),
      noPackinglist: '',
      noBl: '',
      statusDokumen: 'Draft',
      etd: '',
      eta: '',
      countDownEta: null,
      noCont: '',
      bc11Terbit: false,
      noBc11: '',
      tglBc11: '',
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
      noAju: '',
      tglAju: '',
      status: pengaturan.statusList[0] || 'Dokumen Diterima',
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
      dokumenOs: createEmptyChecklist(pengaturan.checklistItems),
      createdAt: '',
      createdBy: '',
      updatedAt: '',
      updatedBy: '',
    };
  });

  const [containers, setContainers] = useState<KontainerItem[]>(() =>
    initialContainers.length > 0
      ? initialContainers.map((c) => ({ ...c }))
      : [{ id: `tmp_${Date.now()}`, kodeOs: '', noCont: '', ukuranTipe: '40HC' }]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const canUpload = canPerformAction(userRole, 'upload_dokumen');
  const [uploadJenis, setUploadJenis] = useState(
    pengaturan.checklistItems[0] || 'Bill of Lading (BL)'
  );
  const [pendingUploads, setPendingUploads] = useState<PendingUploadFile[]>([]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleStageFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const added: PendingUploadFile[] = Array.from(fileList).map((f, idx) => ({
      id: `up_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      jenisDokumen: uploadJenis,
      namaFile: f.name,
      ukuranLabel: formatFileSize(f.size),
      file: f,
    }));
    setPendingUploads((prev) => [...prev, ...added]);
  };

  const updateField = <K extends keyof Shipment>(key: K, value: Shipment[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'eta') {
        next.countDownEta = calculateCountdownEta(String(value));
      }
      return next;
    });
    if (errors[key]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const handleCustomerInput = (kode: string) => {
    const normalized = kode.trim().toLowerCase();
    const found = normalized
      ? customers.find((c) => c.kodeCustomer.trim().toLowerCase() === normalized)
      : undefined;
    setForm((prev) => ({
      ...prev,
      kodeCustomer: kode,
      namaCustomer: found ? found.namaCustomer : prev.namaCustomer,
    }));
    if (errors.kodeCustomer) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.kodeCustomer;
        return copy;
      });
    }
  };

  const handleShipperSelect = (nama: string) => {
    const found = shippers.find((s) => s.namaShipper === nama);
    setForm((prev) => ({
      ...prev,
      shipper: nama,
      negaraAsal: found?.negara || prev.negaraAsal,
    }));
  };

  const toggleChecklistItem = (
    field: 'terimaDok' | 'dokumenOs',
    item: string,
    checked: boolean
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        items: {
          ...prev[field].items,
          [item]: checked,
        },
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    const validation = validateShipmentInput(form);
    if (!validation.valid) {
      setErrors(validation.errors);
      if (validation.errors.kodeCustomer || validation.errors.noBl) {
        setPhase(1);
      } else if (validation.errors.eta || validation.errors.etd) {
        setPhase(2);
      } else {
        setPhase(3);
      }
      return;
    }

    setSaving(true);
    try {
      await onSubmit(form, containers, isNew, pendingUploads);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal menyimpan shipment.');
    } finally {
      setSaving(false);
    }
  };

  const canEditPhaseForForm = (p: ShipmentPhase) => {
    if (isNew && isCheckerRole(userRole) && p === 2) {
      // Saat membuat shipment baru, Checker dapat mengisi data awal termasuk ETA (Fase 2)
      return true;
    }
    return canUserEditPhase({ role: userRole, phasePermissions }, p);
  };

  const isPhaseLocked = (p: ShipmentPhase) => !canEditPhaseForForm(p);

  const hasAnyEditablePhase = ([1, 2, 3, 4] as ShipmentPhase[]).some((p) =>
    canEditPhaseForForm(p)
  );

  const getLockBannerText = () => {
    const activeLabels = PHASE_META.filter((m) => canEditPhaseForForm(m.id)).map(
      (m) => m.label
    );
    if (activeLabels.length === 0) {
      return `Seluruh fase edit dinonaktifkan oleh Admin untuk akun Anda (${userRole}). Mode lihat saja.`;
    }
    return `Fase ini terkunci untuk akun Anda (${userRole}). Fase edit yang aktif saat ini: ${activeLabels.join(', ')}.`;
  };

  const fieldLabelCls = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1';
  const inputCls =
    'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-sm bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:bg-slate-100 dark:disabled:bg-[#111625] disabled:text-slate-500 dark:disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 dark:focus:ring-violet-500/40 focus:border-[#F28C28] dark:focus:border-violet-500';
  const boxCls =
    'p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-3';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label={isNew ? 'Tambah Shipment Baru' : `Edit Shipment ${form.kodeOs}`}
        className="w-full max-w-4xl max-h-[92vh] bg-white dark:bg-[#111625] rounded-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#0B2545] dark:bg-[#0D111C] text-white flex items-center justify-between gap-3 shrink-0 border-b border-white/10 dark:border-white/[0.08]">
          <div>
            <h2 className="text-base sm:text-lg font-bold">
              {isNew ? 'Tambah Shipment Baru' : `Edit Shipment · ${form.kodeOs}`}
            </h2>
            <p className="text-xs text-white/70 dark:text-slate-400">
              {isNew
                ? 'Kode OS akan dibuat otomatis berformat OS-YYMM-NNNN.'
                : 'Setiap perubahan kolom tercatat otomatis ke Log Perubahan.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Tabs */}
        <div className="px-6 pt-4 pb-3 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0D111C]/70 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="tablist">
            {PHASES.map((ph) => {
              const locked = isPhaseLocked(ph.id);
              const active = phase === ph.id;
              return (
                <button
                  key={ph.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPhase(ph.id)}
                  className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white border-[#0B2545] dark:border-transparent'
                      : locked
                        ? 'bg-slate-50 dark:bg-[#161D2F]/60 text-slate-500 dark:text-slate-500 border-slate-200 dark:border-white/[0.06] hover:bg-slate-100 dark:hover:bg-[#1D263C]'
                        : 'bg-white dark:bg-[#182032] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#1F2940]'
                  }`}
                >
                  {locked && <Lock className="w-3 h-3 opacity-70" />}
                  <span>{ph.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {isPhaseLocked(phase) && (
            <div className="text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 rounded-xl px-3.5 py-2.5">
              {getLockBannerText()}
            </div>
          )}

          {/* FASE 1: DOKUMEN */}
          {phase === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-500/[0.08] border border-amber-200/80 dark:border-amber-500/25">
                  <label htmlFor="kodeManualDokOsInput" className={fieldLabelCls}>
                    Dok. OS — Kode Manual Terima Dokumen (Kode Dok Pemilik)
                  </label>
                  <input
                    id="kodeManualDokOsInput"
                    type="text"
                    autoFocus={isNew && !isPhaseLocked(1)}
                    disabled={isPhaseLocked(1)}
                    value={form.kodeManualDokOs || ''}
                    onChange={(e) => updateField('kodeManualDokOs', e.target.value)}
                    placeholder="Contoh: TN-196 (kode dokumen milik pemilik / customer)"
                    className={`${inputCls} font-mono-code font-semibold`}
                  />
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                    Input awal terima dokumen · Ditampilkan pada kolom urutan ke-2 setelah Kode OS di tabel Dokumen Outstanding.
                  </p>
                </div>

                <div>
                  <label htmlFor="kodeCustomerInput" className={fieldLabelCls}>
                    Kode Customer <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    id="kodeCustomerInput"
                    type="text"
                    list="customerCodeSuggestions"
                    disabled={isPhaseLocked(1)}
                    value={form.kodeCustomer}
                    onChange={(e) => handleCustomerInput(e.target.value)}
                    placeholder="Ketik Kode Customer (mis. CUST-001)"
                    className={`${inputCls} font-mono-code`}
                  />
                  <datalist id="customerCodeSuggestions">
                    {customers.map((c) => (
                      <option key={c.kodeCustomer} value={c.kodeCustomer}>
                        {c.namaCustomer}
                      </option>
                    ))}
                  </datalist>
                  {errors.kodeCustomer && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.kodeCustomer}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="namaCustomerInput" className={fieldLabelCls}>
                    Nama Customer
                  </label>
                  <input
                    id="namaCustomerInput"
                    type="text"
                    disabled={isPhaseLocked(1)}
                    value={form.namaCustomer}
                    onChange={(e) => updateField('namaCustomer', e.target.value)}
                    placeholder="Isi manual atau otomatis dari master"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="noBlInput" className={fieldLabelCls}>
                    No. BL <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    id="noBlInput"
                    type="text"
                    disabled={isPhaseLocked(1)}
                    value={form.noBl}
                    onChange={(e) => updateField('noBl', e.target.value)}
                    placeholder="Contoh: EGLV142600891234"
                    className={`${inputCls} font-mono-code`}
                  />
                  {errors.noBl && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.noBl}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="noPackinglistInput" className={fieldLabelCls}>
                    No. Packinglist
                  </label>
                  <input
                    id="noPackinglistInput"
                    type="text"
                    disabled={isPhaseLocked(1)}
                    value={form.noPackinglist}
                    onChange={(e) => updateField('noPackinglist', e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="tglTerimaDokInput" className={fieldLabelCls}>
                    Tgl. Terima Dok
                  </label>
                  <input
                    id="tglTerimaDokInput"
                    type="date"
                    disabled={isPhaseLocked(1)}
                    value={form.tglTerimaDok}
                    onChange={(e) => updateField('tglTerimaDok', e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="dokumenCheckerInput" className={fieldLabelCls}>
                    Dokumen Checker
                  </label>
                  <input
                    id="dokumenCheckerInput"
                    type="text"
                    disabled={isPhaseLocked(1)}
                    value={form.dokumenChecker}
                    onChange={(e) => updateField('dokumenChecker', e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div className="md:col-span-2">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Status Pembuatan Dokumen oleh Checker (Draft / Ready)
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Status Dokumen Checker"
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                  >
                    {(
                      [
                        {
                          value: 'Draft' as StatusDokumenType,
                          title: 'Draft — Belum Selesai',
                          desc: 'Dokumen masih disiapkan / belum dibuat lengkap oleh Checker',
                          activeCls:
                            'bg-yellow-100 dark:bg-yellow-500/20 border-yellow-400 dark:border-yellow-500/60 text-yellow-900 dark:text-yellow-200 ring-1 ring-yellow-300 dark:ring-yellow-500/40',
                          dotCls: 'bg-yellow-500 dark:bg-yellow-400',
                        },
                        {
                          value: 'Ready' as StatusDokumenType,
                          title: 'Ready — Dokumen Siap',
                          desc: 'Dokumen sudah selesai dibuat oleh Checker dan siap diproses',
                          activeCls:
                            'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-500 dark:border-emerald-500/60 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-300 dark:ring-emerald-500/40',
                          dotCls: 'bg-emerald-600 dark:bg-emerald-400',
                        },
                      ] as const
                    ).map((opt) => {
                      const selected = normalizeStatusDokumen(form.statusDokumen) === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={isPhaseLocked(1)}
                          onClick={() => updateField('statusDokumen', opt.value)}
                          className={`text-left px-3.5 py-2.5 rounded-xl border transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                            selected
                              ? opt.activeCls
                              : 'bg-white dark:bg-[#182032] border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1F2940]'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs font-bold">
                            <span className={`w-2 h-2 rounded-full ${opt.dotCls}`} />
                            <span>{opt.title}</span>
                          </div>
                          <p className="text-[11px] opacity-80 mt-0.5">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className={boxCls}>
                <div className="text-xs font-semibold text-[#0B2545] dark:text-white">
                  Checklist Terima Dokumen
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pengaturan.checklistItems.map((item) => (
                    <label
                      key={item}
                      className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        disabled={isPhaseLocked(1)}
                        checked={Boolean(form.terimaDok?.items?.[item])}
                        onChange={(e) =>
                          toggleChecklistItem('terimaDok', item, e.target.checked)
                        }
                        className="rounded border-slate-300 dark:border-white/20"
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label htmlFor="terimaDokCatatan" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Catatan Terima Dokumen
                  </label>
                  <input
                    id="terimaDokCatatan"
                    type="text"
                    disabled={isPhaseLocked(1)}
                    value={form.terimaDok?.catatan || ''}
                    onChange={(e) =>
                      updateField('terimaDok', {
                        ...form.terimaDok,
                        catatan: e.target.value,
                      })
                    }
                    placeholder="Catatan bebas kelengkapan dokumen awal..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-[#111625]"
                  />
                </div>
              </div>

              {canUpload && (() => {
                const driveDest = describeRegisteredDriveDestination(
                  pengaturan,
                  googleDriveUserEmail
                );
                return (
                <div className={boxCls}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B2545] dark:text-white">
                      <Paperclip className="w-3.5 h-3.5 text-[#F28C28] dark:text-violet-400" />
                      <span>Upload File Dokumen Scan (Google Drive)</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {googleDriveUserEmail ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Google Drive Terhubung ({googleDriveUserEmail})
                        </span>
                      ) : (
                        <>
                          {pengaturan.gasWebAppUrl?.trim() && (
                            <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-500/30 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                              Siap Upload via Endpoint GAS
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
                      {!isNew && existingDocuments.length > 0 && (
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {existingDocuments.length} dokumen sudah tersimpan
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    data-testid="form-drive-destination-info"
                    className="px-3 py-2 rounded-lg bg-white dark:bg-[#182032] border border-slate-200 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      Tujuan Drive:{' '}
                      <strong className="text-slate-800 dark:text-white">
                        {driveDest.registeredGmail || 'Akun Google Pemilik / Terhubung'}
                      </strong>
                      {' · Folder: '}
                      <span className="font-mono-code font-semibold">{driveDest.folderLabel}</span>
                    </span>
                    {driveDest.folderUrl && (
                      <a
                        href={driveDest.folderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 dark:text-emerald-300 font-semibold hover:underline"
                      >
                        Buka Folder Drive
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-5">
                      <label htmlFor="formUploadJenis" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Jenis Dokumen
                      </label>
                      <select
                        id="formUploadJenis"
                        aria-label="Jenis dokumen upload shipment"
                        value={uploadJenis}
                        onChange={(e) => setUploadJenis(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100"
                      >
                        {pengaturan.checklistItems.map((it) => (
                          <option key={it} value={it}>
                            {it}
                          </option>
                        ))}
                        <option value="SPPB Resmi">SPPB Resmi</option>
                        <option value="SPTNP / PFPB / PFPD">SPTNP / PFPB / PFPD</option>
                        <option value="Dokumen Lainnya">Dokumen Lainnya</option>
                      </select>
                    </div>

                    <div className="sm:col-span-7">
                      <label htmlFor="formUploadFiles" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Pilih File Scan (bisa lebih dari 1 file)
                      </label>
                      <label
                        htmlFor="formUploadFiles"
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-white/15 bg-white dark:bg-[#182032] hover:border-[#F28C28] dark:hover:border-violet-400 text-xs text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
                      >
                        <span className="inline-flex items-center gap-2 truncate">
                          <Upload className="w-3.5 h-3.5 text-[#F28C28] dark:text-violet-400 shrink-0" />
                          <span className="truncate">Pilih file PDF / gambar / dokumen...</span>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-[11px] font-semibold text-[#0B2545] dark:text-white shrink-0">
                          Browse
                        </span>
                        <input
                          id="formUploadFiles"
                          type="file"
                          multiple
                          aria-label="Upload file dokumen shipment"
                          onChange={(e) => {
                            handleStageFiles(e.target.files);
                            e.currentTarget.value = '';
                          }}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>

                  {pendingUploads.length > 0 ? (
                    <div className="space-y-1.5" data-testid="staged-upload-list">
                      {pendingUploads.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#182032] border border-slate-200 dark:border-white/10 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-slate-900 dark:text-white truncate">{item.namaFile}</div>
                            {item.ukuranLabel && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {item.ukuranLabel} · Siap diupload saat simpan
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              aria-label={`Jenis file ${item.namaFile}`}
                              value={item.jenisDokumen}
                              onChange={(e) =>
                                setPendingUploads((prev) =>
                                  prev.map((p) =>
                                    p.id === item.id ? { ...p, jenisDokumen: e.target.value } : p
                                  )
                                )
                              }
                              className="px-2 py-1 rounded border border-slate-300 dark:border-white/10 text-[11px] bg-white dark:bg-[#131926] text-slate-900 dark:text-slate-100"
                            >
                              {pengaturan.checklistItems.map((it) => (
                                <option key={it} value={it}>
                                  {it}
                                </option>
                              ))}
                              <option value="SPPB Resmi">SPPB Resmi</option>
                              <option value="SPTNP / PFPB / PFPD">SPTNP / PFPB / PFPD</option>
                              <option value="Dokumen Lainnya">Dokumen Lainnya</option>
                            </select>
                            <button
                              type="button"
                              aria-label={`Hapus file ${item.namaFile}`}
                              onClick={() =>
                                setPendingUploads((prev) => prev.filter((p) => p.id !== item.id))
                              }
                              className="p-1.5 rounded bg-red-50 dark:bg-red-500/15 hover:bg-red-100 dark:hover:bg-red-500/25 text-red-700 dark:text-red-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      File yang dipilih akan otomatis masuk ke folder Kode OS di dalam folder Google Drive terdaftar saat shipment disimpan.
                    </p>
                  )}
                </div>
                );
              })()}
            </div>
          )}

          {/* FASE 2: PELAYARAN */}
          {phase === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="shipInput" className={fieldLabelCls}>
                    Ship (Nama Kapal / Voyage)
                  </label>
                  <input
                    id="shipInput"
                    type="text"
                    disabled={isPhaseLocked(2)}
                    value={form.ship}
                    onChange={(e) => updateField('ship', e.target.value)}
                    placeholder="Contoh: MV EVER FORTUNE V.042"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="etdInput" className={fieldLabelCls}>
                    ETD (Estimated Time of Departure)
                  </label>
                  <input
                    id="etdInput"
                    type="date"
                    disabled={isPhaseLocked(2)}
                    value={form.etd}
                    onChange={(e) => updateField('etd', e.target.value)}
                    className={inputCls}
                  />
                  {errors.etd && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.etd}</p>}
                </div>

                <div>
                  <label htmlFor="etaInput" className={fieldLabelCls}>
                    ETA (Estimated Time of Arrival) <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    id="etaInput"
                    type="date"
                    disabled={isPhaseLocked(2)}
                    value={form.eta}
                    onChange={(e) => updateField('eta', e.target.value)}
                    className={inputCls}
                  />
                  {errors.eta && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.eta}</p>}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    Count Down ETA otomatis:{' '}
                    <strong className="text-slate-800 dark:text-white">
                      {form.countDownEta !== null ? `${form.countDownEta} hari` : '-'}
                    </strong>
                  </p>
                </div>

                <div className={`md:col-span-2 ${boxCls}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-[#0B2545] dark:text-white">
                        Manifes / BC 1.1 (Sinyal Segera Proses)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Centang atau isi No. BC 1.1 jika manifes telah terbit untuk menyalakan sinyal segera proses.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0B2545] dark:text-violet-300 cursor-pointer">
                      <input
                        id="bc11TerbitInput"
                        type="checkbox"
                        disabled={isPhaseLocked(2)}
                        checked={Boolean(form.bc11Terbit || form.noBc11?.trim() || form.tglBc11?.trim())}
                        onChange={(e) => updateField('bc11Terbit', e.target.checked)}
                        className="rounded border-slate-300 dark:border-white/20"
                      />
                      <span>BC 1.1 Manifes Terbit</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="noBc11Input" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        No. BC 1.1 / Manifes
                      </label>
                      <input
                        id="noBc11Input"
                        type="text"
                        disabled={isPhaseLocked(2)}
                        value={form.noBc11 || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateField('noBc11', val);
                          if (val.trim()) updateField('bc11Terbit', true);
                        }}
                        placeholder="Contoh: 004819"
                        className={`${inputCls} font-mono-code`}
                      />
                    </div>
                    <div>
                      <label htmlFor="tglBc11Input" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Tgl. Terbit BC 1.1
                      </label>
                      <input
                        id="tglBc11Input"
                        type="date"
                        disabled={isPhaseLocked(2)}
                        value={form.tglBc11 || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateField('tglBc11', val);
                          if (val.trim()) updateField('bc11Terbit', true);
                        }}
                        className={inputCls}
                      />
                      {errors.tglBc11 && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.tglBc11}</p>}
                    </div>
                  </div>
                </div>

                {/* Kesiapan D/O Pelayaran & Masa Berlaku Kontainer Keluar */}
                <div className={`md:col-span-2 ${boxCls}`}>
                  <div>
                    <div className="text-xs font-semibold text-[#0B2545] dark:text-white">
                      Kesiapan D/O Pelayaran (Pengeluaran Kontainer dari Pelabuhan)
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Catat status kesiapan D/O dari pelayaran (Sedia / Belum) beserta masa berlaku &amp; catatan perpanjangan D/O.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Status D/O Pelayaran Form">
                    {(['Belum', 'Sedia'] as StatusDoPelayaranType[]).map((opt) => {
                      const active = normalizeStatusDoPelayaran(form.doPelayaranStatus) === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={isPhaseLocked(2)}
                          onClick={() => updateField('doPelayaranStatus', opt)}
                          className={`px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-60 ${
                            active
                              ? opt === 'Sedia'
                                ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-400/60 ring-2 ring-emerald-200 dark:ring-emerald-400/40'
                                : 'bg-amber-50 dark:bg-amber-500/15 border-amber-400 dark:border-amber-400/60 ring-2 ring-amber-200 dark:ring-amber-400/40'
                              : 'bg-white dark:bg-[#182032] border-slate-200 dark:border-white/10'
                          }`}
                        >
                          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                opt === 'Sedia' ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            />
                            <span>{opt === 'Sedia' ? 'Sedia (Siap Keluar)' : 'Belum Sedia'}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {opt === 'Sedia'
                              ? 'D/O sudah diterima, kontainer bisa keluar pelabuhan'
                              : 'D/O belum terbit / masih dalam proses pelayaran'}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label htmlFor="doBerlakuSampaiInput" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Masa Berlaku D/O / Batas Perpanjangan
                      </label>
                      <input
                        id="doBerlakuSampaiInput"
                        type="date"
                        disabled={isPhaseLocked(2)}
                        value={form.doBerlakuSampai || ''}
                        onChange={(e) => updateField('doBerlakuSampai', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div className="sm:col-span-7">
                      <label htmlFor="doCatatanPerpanjanganInput" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Catatan Masa Berlaku &amp; Perpanjangan D/O
                      </label>
                      <input
                        id="doCatatanPerpanjanganInput"
                        type="text"
                        disabled={isPhaseLocked(2)}
                        value={form.doCatatanPerpanjangan || ''}
                        onChange={(e) => updateField('doCatatanPerpanjangan', e.target.value)}
                        placeholder="Misal: Perpanjangan D/O ke-1 s/d 20 Nov, tagihan pelayaran lunas"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* Pengurusan Eslah / Buat TILA (Kartu Gate) */}
                  <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08] space-y-2.5">
                    <div className="text-xs font-semibold text-[#0B2545] dark:text-violet-300">
                      Pengurusan Eslah / Buat TILA (Kartu Gate Pelabuhan)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="doGatePassStatusInput" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Status Gate Pass
                        </label>
                        <select
                          id="doGatePassStatusInput"
                          disabled={isPhaseLocked(2)}
                          value={normalizeStatusGatePass(form.doGatePassStatus)}
                          onChange={(e) =>
                            updateField('doGatePassStatus', e.target.value as StatusGatePassType)
                          }
                          className={inputCls}
                        >
                          <option value="Belum">Belum Diurus</option>
                          <option value="Proses">Proses di Pelabuhan</option>
                          <option value="Sedia">Sedia (Siap Gate-Out)</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="doGatePassJenisInput" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Jenis Eslah / TILA
                        </label>
                        <select
                          id="doGatePassJenisInput"
                          disabled={isPhaseLocked(2)}
                          value={normalizeGatePassJenis(form.doGatePassJenis)}
                          onChange={(e) =>
                            updateField('doGatePassJenis', e.target.value as GatePassJenisType)
                          }
                          className={inputCls}
                        >
                          <option value="">-- Pilih Jenis --</option>
                          <option value="TILA (Kartu Gate)">TILA (Kartu Gate)</option>
                          <option value="Eslah">Eslah</option>
                          <option value="Eslah & TILA">Eslah &amp; TILA</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="doGatePassNomorInput" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          No. TILA / Kartu Gate / Eslah
                        </label>
                        <input
                          id="doGatePassNomorInput"
                          type="text"
                          disabled={isPhaseLocked(2)}
                          value={form.doGatePassNomor || ''}
                          onChange={(e) => updateField('doGatePassNomor', e.target.value)}
                          placeholder="TILA-NPCT1-261101"
                          className={`${inputCls} font-mono-code`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Kesediaan Trucking & Data Supir */}
                  <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08] space-y-2.5">
                    <div className="text-xs font-semibold text-[#0B2545] dark:text-violet-300">
                      Kesediaan Trucking &amp; Data Supir
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label htmlFor="truckingStatusInput" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Status Trucking
                        </label>
                        <select
                          id="truckingStatusInput"
                          disabled={isPhaseLocked(2)}
                          value={normalizeStatusTrucking(form.truckingStatus)}
                          onChange={(e) =>
                            updateField('truckingStatus', e.target.value as StatusDoPelayaranType)
                          }
                          className={inputCls}
                        >
                          <option value="Belum">Belum Sedia</option>
                          <option value="Sedia">Sedia (Siap Angkut)</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="truckingNamaSupirInput" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Nama Supir
                        </label>
                        <input
                          id="truckingNamaSupirInput"
                          type="text"
                          disabled={isPhaseLocked(2)}
                          value={form.truckingNamaSupir || ''}
                          onChange={(e) => updateField('truckingNamaSupir', e.target.value)}
                          placeholder="Contoh: Agus Setiawan"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label htmlFor="truckingNoPlatInput" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          No. Plat Truk
                        </label>
                        <input
                          id="truckingNoPlatInput"
                          type="text"
                          disabled={isPhaseLocked(2)}
                          value={form.truckingNoPlat || ''}
                          onChange={(e) =>
                            updateField('truckingNoPlat', e.target.value.toUpperCase())
                          }
                          placeholder="B 9482 UYW"
                          className={`${inputCls} font-mono-code`}
                        />
                      </div>
                      <div>
                        <label htmlFor="truckingNoHpSupirInput" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          No. HP Supir
                        </label>
                        <input
                          id="truckingNoHpSupirInput"
                          type="text"
                          disabled={isPhaseLocked(2)}
                          value={form.truckingNoHpSupir || ''}
                          onChange={(e) => updateField('truckingNoHpSupir', e.target.value)}
                          placeholder="0812-8890-1122"
                          className={`${inputCls} font-mono-code`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Gate-Out & Ikatan Proses Dokumen Selesai */}
                  <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08] space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-[#0B2545] dark:text-emerald-300">
                        Gate-Out Pelabuhan &amp; Ikatan Proses Dokumen Selesai
                      </div>
                      {normalizeStatusGateOut(form.gateOutStatus, form.status) === 'Sudah' && (
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Status Shipment: {form.status}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="gateOutStatusInput" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Status Gate-Out
                        </label>
                        <select
                          id="gateOutStatusInput"
                          disabled={isPhaseLocked(2)}
                          value={normalizeStatusGateOut(form.gateOutStatus, form.status)}
                          onChange={(e) => {
                            const nextVal = e.target.value as StatusGateOutType;
                            setForm((prev) => {
                              const todayIso = new Date().toISOString().slice(0, 10);
                              const next: Shipment = {
                                ...prev,
                                gateOutStatus: nextVal,
                                gateOutTanggal:
                                  nextVal === 'Sudah' && !prev.gateOutTanggal
                                    ? todayIso
                                    : prev.gateOutTanggal,
                              };
                              if (nextVal === 'Sudah' && canEditPhaseForForm(3)) {
                                next.status = 'Selesai';
                                const completedItems: Record<string, boolean> = {
                                  ...(prev.dokumenOs?.items || {}),
                                };
                                for (const item of pengaturan.checklistItems) {
                                  completedItems[item] = true;
                                }
                                next.dokumenOs = {
                                  items: completedItems,
                                  catatan:
                                    prev.dokumenOs?.catatan?.trim() ||
                                    `Otomatis dilengkapi via Gate-Out (${next.gateOutTanggal || todayIso}).`,
                                };
                              }
                              return next;
                            });
                          }}
                          className={inputCls}
                        >
                          <option value="Belum">Belum Gate-Out</option>
                          <option value="Sudah">Sudah Gate-Out (Ikat Selesai)</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="gateOutTanggalInput" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Tanggal Gate-Out
                        </label>
                        <input
                          id="gateOutTanggalInput"
                          type="date"
                          disabled={isPhaseLocked(2)}
                          value={form.gateOutTanggal || ''}
                          onChange={(e) => updateField('gateOutTanggal', e.target.value)}
                          className={inputCls}
                        />
                        {errors.gateOutTanggal && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.gateOutTanggal}</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="gateOutCatatanInput" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Catatan Gate-Out
                        </label>
                        <input
                          id="gateOutCatatanInput"
                          type="text"
                          disabled={isPhaseLocked(2)}
                          value={form.gateOutCatatan || ''}
                          onChange={(e) => updateField('gateOutCatatan', e.target.value)}
                          placeholder="Contoh: Gate-Out JICT jam 14:20"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={boxCls}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0B2545] dark:text-white">
                    Daftar Kontainer (Sheet Kontainer)
                  </span>
                  {!isPhaseLocked(2) && (
                    <button
                      type="button"
                      onClick={() =>
                        setContainers((prev) => [
                          ...prev,
                          {
                            id: `tmp_${Date.now()}_${prev.length}`,
                            kodeOs: form.kodeOs,
                            noCont: '',
                            ukuranTipe: '40HC',
                          },
                        ])
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#182032] border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1F2940] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Kontainer</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {containers.map((c, idx) => (
                    <div key={c.id} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        aria-label={`Nomor Kontainer ${idx + 1}`}
                        disabled={isPhaseLocked(2)}
                        value={c.noCont}
                        onChange={(e) =>
                          setContainers((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, noCont: e.target.value } : item
                            )
                          )
                        }
                        placeholder="No. Kontainer (mis. EGHU9012345)"
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs font-mono-code bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-[#111625]"
                      />
                      <select
                        aria-label={`Ukuran Kontainer ${idx + 1}`}
                        disabled={isPhaseLocked(2)}
                        value={c.ukuranTipe}
                        onChange={(e) =>
                          setContainers((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, ukuranTipe: e.target.value } : item
                            )
                          )
                        }
                        className="sm:w-36 px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-[#111625]"
                      >
                        <option value="20FT">20FT</option>
                        <option value="40FT">40FT</option>
                        <option value="40HC">40HC</option>
                        <option value="40GP">40GP</option>
                        <option value="LCL">LCL</option>
                      </select>
                      {!isPhaseLocked(2) && containers.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setContainers((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label={`Hapus kontainer ${idx + 1}`}
                          className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/15 hover:bg-red-100 dark:hover:bg-red-500/25 text-red-700 dark:text-red-300 text-xs font-medium cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* FASE 3: CUSTOMS */}
          {phase === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="statusSelect" className={fieldLabelCls}>
                  Status Shipment
                </label>
                <select
                  id="statusSelect"
                  disabled={isPhaseLocked(3)}
                  value={form.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  className={inputCls}
                >
                  {pengaturan.statusList.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="jalurSelect" className={fieldLabelCls}>
                  Jalur
                </label>
                <select
                  id="jalurSelect"
                  disabled={isPhaseLocked(3)}
                  value={form.jalur}
                  onChange={(e) => updateField('jalur', e.target.value as JalurType)}
                  className={inputCls}
                >
                  <option value="">-- Belum Ada Jalur --</option>
                  {pengaturan.jalurList.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="noAjuInput" className={fieldLabelCls}>
                  No. AJU
                </label>
                <input
                  id="noAjuInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.noAju}
                  onChange={(e) => updateField('noAju', e.target.value)}
                  className={`${inputCls} font-mono-code`}
                />
              </div>

              <div>
                <label htmlFor="tglAjuInput" className={fieldLabelCls}>
                  Tgl. AJU
                </label>
                <input
                  id="tglAjuInput"
                  type="date"
                  disabled={isPhaseLocked(3)}
                  value={form.tglAju}
                  onChange={(e) => updateField('tglAju', e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="nopenInput" className={fieldLabelCls}>
                  NOPEN
                </label>
                <input
                  id="nopenInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.nopen}
                  onChange={(e) => updateField('nopen', e.target.value)}
                  className={`${inputCls} font-mono-code`}
                />
              </div>

              <div>
                <label htmlFor="tglNopenInput" className={fieldLabelCls}>
                  Tgl. NOPEN
                </label>
                <input
                  id="tglNopenInput"
                  type="date"
                  disabled={isPhaseLocked(3)}
                  value={form.tglNopen}
                  onChange={(e) => updateField('tglNopen', e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="kodeImportirInput" className={fieldLabelCls}>
                  Kode Importir
                </label>
                <input
                  id="kodeImportirInput"
                  type="text"
                  list="importirCodeSuggestions"
                  disabled={isPhaseLocked(3)}
                  value={form.kodeImportir}
                  onChange={(e) => updateField('kodeImportir', e.target.value)}
                  placeholder="Ketik Kode Importir (mis. IMP-001)"
                  className={`${inputCls} font-mono-code`}
                />
                <datalist id="importirCodeSuggestions">
                  {importirs.map((i) => (
                    <option key={i.kodeImportir} value={i.kodeImportir}>
                      {i.namaImportir}
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label htmlFor="shipperSelect" className={fieldLabelCls}>
                  Shipper
                </label>
                <select
                  id="shipperSelect"
                  disabled={isPhaseLocked(3)}
                  value={form.shipper}
                  onChange={(e) => handleShipperSelect(e.target.value)}
                  className={inputCls}
                >
                  <option value="">-- Pilih Shipper --</option>
                  {shippers.map((sh) => (
                    <option key={sh.namaShipper} value={sh.namaShipper}>
                      {sh.namaShipper}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="descriptionInput" className={fieldLabelCls}>
                  Description Barang
                </label>
                <input
                  id="descriptionInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="negaraAsalInput" className={fieldLabelCls}>
                  Negara Asal
                </label>
                <input
                  id="negaraAsalInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.negaraAsal}
                  onChange={(e) => updateField('negaraAsal', e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="currencyInput" className={fieldLabelCls}>
                  Currency
                </label>
                <input
                  id="currencyInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                  placeholder="USD / EUR / JPY"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="kursInput" className={fieldLabelCls}>
                  Kurs (Angka)
                </label>
                <input
                  id="kursInput"
                  type="number"
                  step="any"
                  disabled={isPhaseLocked(3)}
                  value={form.kurs}
                  onChange={(e) =>
                    updateField('kurs', e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className={`${inputCls} tabular-nums`}
                />
                {errors.kurs && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.kurs}</p>}
              </div>

              <div>
                <label htmlFor="invoiceInput" className={fieldLabelCls}>
                  Nilai Invoice (Angka)
                </label>
                <input
                  id="invoiceInput"
                  type="number"
                  step="any"
                  disabled={isPhaseLocked(3)}
                  value={form.invoice}
                  onChange={(e) =>
                    updateField('invoice', e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className={`${inputCls} tabular-nums`}
                />
                {errors.invoice && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.invoice}</p>}
              </div>

              <div>
                <label htmlFor="bmPdriInput" className={fieldLabelCls}>
                  BM/PDRI
                </label>
                <input
                  id="bmPdriInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.bmPdri}
                  onChange={(e) => updateField('bmPdri', e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="sptnpRingkasanInput" className={fieldLabelCls}>
                  SPTNP (Ringkasan)
                </label>
                <input
                  id="sptnpRingkasanInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.sptnp}
                  onChange={(e) => updateField('sptnp', e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="noSppbInput" className={fieldLabelCls}>
                  No. SPPB
                </label>
                <input
                  id="noSppbInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.noSppb}
                  onChange={(e) => updateField('noSppb', e.target.value)}
                  className={`${inputCls} font-mono-code`}
                />
              </div>

              <div>
                <label htmlFor="tglSppbInput" className={fieldLabelCls}>
                  Tgl SPPB
                </label>
                <input
                  id="tglSppbInput"
                  type="date"
                  disabled={isPhaseLocked(3)}
                  value={form.tglSppb}
                  onChange={(e) => updateField('tglSppb', e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* FASE 4: PASCA-SPPB */}
          {phase === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="statusSelectPhase4" className={fieldLabelCls}>
                    Status Shipment (Penyelesaian Dokumen OS)
                  </label>
                  <select
                    id="statusSelectPhase4"
                    disabled={isPhaseLocked(4)}
                    value={form.status}
                    onChange={(e) => updateField('status', e.target.value)}
                    className={inputCls}
                  >
                    {pengaturan.statusList.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="noSptnpInput" className={fieldLabelCls}>
                    No. SPTNP
                  </label>
                  <input
                    id="noSptnpInput"
                    type="text"
                    disabled={isPhaseLocked(4)}
                    value={form.noSptnp}
                    onChange={(e) => updateField('noSptnp', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="tglSptnpInput" className={fieldLabelCls}>
                    Tgl. SPTNP
                  </label>
                  <input
                    id="tglSptnpInput"
                    type="date"
                    disabled={isPhaseLocked(4)}
                    value={form.tglSptnp}
                    onChange={(e) => updateField('tglSptnp', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="pfpbInput" className={fieldLabelCls}>
                    PFPB
                  </label>
                  <input
                    id="pfpbInput"
                    type="text"
                    disabled={isPhaseLocked(4)}
                    value={form.pfpb}
                    onChange={(e) => updateField('pfpb', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="tglPfpbInput" className={fieldLabelCls}>
                    Tgl. PFPB
                  </label>
                  <input
                    id="tglPfpbInput"
                    type="date"
                    disabled={isPhaseLocked(4)}
                    value={form.tglPfpb}
                    onChange={(e) => updateField('tglPfpb', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="pfpdInput" className={fieldLabelCls}>
                    PFPD
                  </label>
                  <input
                    id="pfpdInput"
                    type="text"
                    disabled={isPhaseLocked(4)}
                    value={form.pfpd}
                    onChange={(e) => updateField('pfpd', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="tglPfpdInput" className={fieldLabelCls}>
                    Tgl. PFPD
                  </label>
                  <input
                    id="tglPfpdInput"
                    type="date"
                    disabled={isPhaseLocked(4)}
                    value={form.tglPfpd}
                    onChange={(e) => updateField('tglPfpd', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="eslahInput" className={fieldLabelCls}>
                    ESLAH
                  </label>
                  <input
                    id="eslahInput"
                    type="text"
                    disabled={isPhaseLocked(4)}
                    value={form.eslah}
                    onChange={(e) => updateField('eslah', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="tglEslahInput" className={fieldLabelCls}>
                    Tgl. ESLAH
                  </label>
                  <input
                    id="tglEslahInput"
                    type="date"
                    disabled={isPhaseLocked(4)}
                    value={form.tglEslah}
                    onChange={(e) => updateField('tglEslah', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className={boxCls}>
                <div className="text-xs font-semibold text-[#0B2545] dark:text-white">
                  Checklist Dokumen OS (Penyelesaian Akhir)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pengaturan.checklistItems.map((item) => (
                    <label
                      key={item}
                      className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        disabled={isPhaseLocked(4)}
                        checked={Boolean(form.dokumenOs?.items?.[item])}
                        onChange={(e) =>
                          toggleChecklistItem('dokumenOs', item, e.target.checked)
                        }
                        className="rounded border-slate-300 dark:border-white/20"
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label htmlFor="dokumenOsCatatan" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Catatan Dokumen OS
                  </label>
                  <input
                    id="dokumenOsCatatan"
                    type="text"
                    disabled={isPhaseLocked(4)}
                    value={form.dokumenOs?.catatan || ''}
                    onChange={(e) =>
                      updateField('dokumenOs', {
                        ...form.dokumenOs,
                        catatan: e.target.value,
                      })
                    }
                    placeholder="Catatan bebas penyelesaian OS..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-[#111625]"
                  />
                </div>
              </div>
            </div>
          )}

          {submitError && (
            <div role="alert" className="text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/35 rounded-lg px-3.5 py-2.5">
              {submitError}
            </div>
          )}

          {/* Footer Navigation & Submit */}
          <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
            <div>
              {phase > 1 && (
                <button
                  type="button"
                  onClick={() => setPhase((phase - 1) as ShipmentPhase)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
                >
                  Sebelumnya
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {phase < 4 && (
                <button
                  type="button"
                  onClick={() => setPhase((phase + 1) as ShipmentPhase)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Fase Berikutnya
                </button>
              )}
              <button
                type="submit"
                disabled={saving || !hasAnyEditablePhase}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#F28C28] hover:bg-[#D97719] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] disabled:opacity-60 text-xs font-semibold text-white cursor-pointer shadow-lg shadow-violet-600/20"
              >
                {saving ? 'Menyimpan...' : 'Simpan Shipment'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
