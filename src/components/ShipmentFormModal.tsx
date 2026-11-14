import React, { useState } from 'react';
import { Lock, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react';
import type {
  Customer,
  DokumenItem,
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
  UserRole,
} from '../types/ppjk';
import {
  calculateCountdownEta,
  canPerformAction,
  canUserEditPhase,
  createEmptyChecklist,
  isCheckerRole,
  normalizeStatusDokumen,
  PHASE_META,
  validateShipmentInput,
} from '../utils/ppjkLogic';
import { GoogleSignInButton } from './GoogleDriveButton';

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
      cloned.statusDokumen = normalizeStatusDokumen(cloned.statusDokumen);
      return cloned;
    }
    return {
      kodeOs: 'OTOMATIS (OS-YYMM-NNNN)',
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

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-3 sm:p-5 no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label={isNew ? 'Tambah Shipment Baru' : `Edit Shipment ${form.kodeOs}`}
        className="w-full max-w-4xl max-h-[92vh] bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#0B2545] text-white flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold">
              {isNew ? 'Tambah Shipment Baru' : `Edit Shipment · ${form.kodeOs}`}
            </h2>
            <p className="text-xs text-white/70">
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
        <div className="px-6 pt-4 pb-3 border-b border-slate-200 bg-slate-50 shrink-0">
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
                  className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border cursor-pointer ${
                    active
                      ? 'bg-[#0B2545] text-white border-[#0B2545]'
                      : locked
                        ? 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
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
            <div className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
              {getLockBannerText()}
            </div>
          )}

          {/* FASE 1: DOKUMEN */}
          {phase === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="kodeCustomerInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Customer <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="kodeCustomerInput"
                    type="text"
                    list="customerCodeSuggestions"
                    disabled={isPhaseLocked(1)}
                    value={form.kodeCustomer}
                    onChange={(e) => handleCustomerInput(e.target.value)}
                    placeholder="Ketik Kode Customer (mis. CUST-001)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-code bg-white disabled:bg-slate-100"
                  />
                  <datalist id="customerCodeSuggestions">
                    {customers.map((c) => (
                      <option key={c.kodeCustomer} value={c.kodeCustomer}>
                        {c.namaCustomer}
                      </option>
                    ))}
                  </datalist>
                  {errors.kodeCustomer && (
                    <p className="text-xs text-red-600 mt-1">{errors.kodeCustomer}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="namaCustomerInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Customer
                  </label>
                  <input
                    id="namaCustomerInput"
                    type="text"
                    disabled={isPhaseLocked(1)}
                    value={form.namaCustomer}
                    onChange={(e) => updateField('namaCustomer', e.target.value)}
                    placeholder="Isi manual atau otomatis dari master"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="noBlInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    No. BL <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="noBlInput"
                    type="text"
                    disabled={isPhaseLocked(1)}
                    value={form.noBl}
                    onChange={(e) => updateField('noBl', e.target.value)}
                    placeholder="Contoh: EGLV142600891234"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-code disabled:bg-slate-100"
                  />
                  {errors.noBl && (
                    <p className="text-xs text-red-600 mt-1">{errors.noBl}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="noPackinglistInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    No. Packinglist
                  </label>
                  <input
                    id="noPackinglistInput"
                    type="text"
                    disabled={isPhaseLocked(1)}
                    value={form.noPackinglist}
                    onChange={(e) => updateField('noPackinglist', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="tglTerimaDokInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tgl. Terima Dok
                  </label>
                  <input
                    id="tglTerimaDokInput"
                    type="date"
                    disabled={isPhaseLocked(1)}
                    value={form.tglTerimaDok}
                    onChange={(e) => updateField('tglTerimaDok', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="dokumenCheckerInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Dokumen Checker
                  </label>
                  <input
                    id="dokumenCheckerInput"
                    type="text"
                    disabled={isPhaseLocked(1)}
                    value={form.dokumenChecker}
                    onChange={(e) => updateField('dokumenChecker', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                          activeCls: 'bg-amber-50 border-amber-400 text-amber-900 ring-1 ring-amber-300',
                          dotCls: 'bg-amber-500',
                        },
                        {
                          value: 'Ready' as StatusDokumenType,
                          title: 'Ready — Dokumen Siap',
                          desc: 'Dokumen sudah selesai dibuat oleh Checker dan siap diproses',
                          activeCls: 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-300',
                          dotCls: 'bg-emerald-500',
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
                          className={`text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                            selected
                              ? opt.activeCls
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
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

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-semibold text-[#0B2545]">
                  Checklist Terima Dokumen
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pengaturan.checklistItems.map((item) => (
                    <label
                      key={item}
                      className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        disabled={isPhaseLocked(1)}
                        checked={Boolean(form.terimaDok?.items?.[item])}
                        onChange={(e) =>
                          toggleChecklistItem('terimaDok', item, e.target.checked)
                        }
                        className="rounded border-slate-300"
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label htmlFor="terimaDokCatatan" className="block text-[11px] font-medium text-slate-600 mb-1">
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100"
                  />
                </div>
              </div>

              {canUpload && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B2545]">
                      <Paperclip className="w-3.5 h-3.5 text-[#F28C28]" />
                      <span>Upload File Dokumen Scan (Google Drive)</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {googleDriveUserEmail ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
                          Google Drive Terhubung ({googleDriveUserEmail})
                        </span>
                      ) : onConnectGoogleDrive ? (
                        <GoogleSignInButton
                          onClick={onConnectGoogleDrive}
                          disabled={driveConnecting}
                          label={driveConnecting ? 'Menghubungkan...' : 'Sign in with Google'}
                        />
                      ) : null}
                      {!isNew && existingDocuments.length > 0 && (
                        <span className="text-[11px] font-medium text-slate-500">
                          {existingDocuments.length} dokumen sudah tersimpan
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-5">
                      <label htmlFor="formUploadJenis" className="block text-[11px] font-medium text-slate-600 mb-1">
                        Jenis Dokumen
                      </label>
                      <select
                        id="formUploadJenis"
                        aria-label="Jenis dokumen upload shipment"
                        value={uploadJenis}
                        onChange={(e) => setUploadJenis(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
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
                      <label htmlFor="formUploadFiles" className="block text-[11px] font-medium text-slate-600 mb-1">
                        Pilih File Scan (bisa lebih dari 1 file)
                      </label>
                      <label
                        htmlFor="formUploadFiles"
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-white hover:border-[#F28C28] text-xs text-slate-700 cursor-pointer transition-colors"
                      >
                        <span className="inline-flex items-center gap-2 truncate">
                          <Upload className="w-3.5 h-3.5 text-[#F28C28] shrink-0" />
                          <span className="truncate">Pilih file PDF / gambar / dokumen...</span>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-semibold text-[#0B2545] shrink-0">
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
                          className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-slate-900 truncate">{item.namaFile}</div>
                            {item.ukuranLabel && (
                              <div className="text-[11px] text-slate-500">{item.ukuranLabel} · Siap diupload saat simpan</div>
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
                              className="px-2 py-1 rounded border border-slate-300 text-[11px] bg-white"
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
                              className="p-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      File yang dipilih di sini akan otomatis masuk ke folder Kode OS di Google Drive saat shipment disimpan.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* FASE 2: PELAYARAN */}
          {phase === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="shipInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Ship (Nama Kapal / Voyage)
                  </label>
                  <input
                    id="shipInput"
                    type="text"
                    disabled={isPhaseLocked(2)}
                    value={form.ship}
                    onChange={(e) => updateField('ship', e.target.value)}
                    placeholder="Contoh: MV EVER FORTUNE V.042"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="etdInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    ETD (Estimated Time of Departure)
                  </label>
                  <input
                    id="etdInput"
                    type="date"
                    disabled={isPhaseLocked(2)}
                    value={form.etd}
                    onChange={(e) => updateField('etd', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                  {errors.etd && <p className="text-xs text-red-600 mt-1">{errors.etd}</p>}
                </div>

                <div>
                  <label htmlFor="etaInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    ETA (Estimated Time of Arrival) <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="etaInput"
                    type="date"
                    disabled={isPhaseLocked(2)}
                    value={form.eta}
                    onChange={(e) => updateField('eta', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                  {errors.eta && <p className="text-xs text-red-600 mt-1">{errors.eta}</p>}
                  <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                    Count Down ETA otomatis:{' '}
                    <strong>
                      {form.countDownEta !== null ? `${form.countDownEta} hari` : '-'}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0B2545]">
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
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
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
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-code bg-white disabled:bg-slate-100"
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
                        className="sm:w-36 px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100"
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
                          className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium cursor-pointer"
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
                <label htmlFor="statusSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Shipment
                </label>
                <select
                  id="statusSelect"
                  disabled={isPhaseLocked(3)}
                  value={form.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white disabled:bg-slate-100"
                >
                  {pengaturan.statusList.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="jalurSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                  Jalur
                </label>
                <select
                  id="jalurSelect"
                  disabled={isPhaseLocked(3)}
                  value={form.jalur}
                  onChange={(e) => updateField('jalur', e.target.value as JalurType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white disabled:bg-slate-100"
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
                <label htmlFor="noAjuInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  No. AJU
                </label>
                <input
                  id="noAjuInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.noAju}
                  onChange={(e) => updateField('noAju', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-code disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="tglAjuInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tgl. AJU
                </label>
                <input
                  id="tglAjuInput"
                  type="date"
                  disabled={isPhaseLocked(3)}
                  value={form.tglAju}
                  onChange={(e) => updateField('tglAju', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="nopenInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  NOPEN
                </label>
                <input
                  id="nopenInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.nopen}
                  onChange={(e) => updateField('nopen', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-code disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="tglNopenInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tgl. NOPEN
                </label>
                <input
                  id="tglNopenInput"
                  type="date"
                  disabled={isPhaseLocked(3)}
                  value={form.tglNopen}
                  onChange={(e) => updateField('tglNopen', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="kodeImportirInput" className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-code bg-white disabled:bg-slate-100"
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
                <label htmlFor="shipperSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                  Shipper
                </label>
                <select
                  id="shipperSelect"
                  disabled={isPhaseLocked(3)}
                  value={form.shipper}
                  onChange={(e) => handleShipperSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white disabled:bg-slate-100"
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
                <label htmlFor="descriptionInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  Description Barang
                </label>
                <input
                  id="descriptionInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="negaraAsalInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  Negara Asal
                </label>
                <input
                  id="negaraAsalInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.negaraAsal}
                  onChange={(e) => updateField('negaraAsal', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="currencyInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  Currency
                </label>
                <input
                  id="currencyInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                  placeholder="USD / EUR / JPY"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="kursInput" className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums disabled:bg-slate-100"
                />
                {errors.kurs && <p className="text-xs text-red-600 mt-1">{errors.kurs}</p>}
              </div>

              <div>
                <label htmlFor="invoiceInput" className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums disabled:bg-slate-100"
                />
                {errors.invoice && <p className="text-xs text-red-600 mt-1">{errors.invoice}</p>}
              </div>

              <div>
                <label htmlFor="bmPdriInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  BM/PDRI
                </label>
                <input
                  id="bmPdriInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.bmPdri}
                  onChange={(e) => updateField('bmPdri', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="sptnpRingkasanInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  SPTNP (Ringkasan)
                </label>
                <input
                  id="sptnpRingkasanInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.sptnp}
                  onChange={(e) => updateField('sptnp', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="noSppbInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  No. SPPB
                </label>
                <input
                  id="noSppbInput"
                  type="text"
                  disabled={isPhaseLocked(3)}
                  value={form.noSppb}
                  onChange={(e) => updateField('noSppb', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-code disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="tglSppbInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tgl SPPB
                </label>
                <input
                  id="tglSppbInput"
                  type="date"
                  disabled={isPhaseLocked(3)}
                  value={form.tglSppb}
                  onChange={(e) => updateField('tglSppb', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                />
              </div>
            </div>
          )}

          {/* FASE 4: PASCA-SPPB */}
          {phase === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="statusSelectPhase4" className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Shipment (Penyelesaian Dokumen OS)
                  </label>
                  <select
                    id="statusSelectPhase4"
                    disabled={isPhaseLocked(4)}
                    value={form.status}
                    onChange={(e) => updateField('status', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white disabled:bg-slate-100"
                  >
                    {pengaturan.statusList.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="noSptnpInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    No. SPTNP
                  </label>
                  <input
                    id="noSptnpInput"
                    type="text"
                    disabled={isPhaseLocked(4)}
                    value={form.noSptnp}
                    onChange={(e) => updateField('noSptnp', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="tglSptnpInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tgl. SPTNP
                  </label>
                  <input
                    id="tglSptnpInput"
                    type="date"
                    disabled={isPhaseLocked(4)}
                    value={form.tglSptnp}
                    onChange={(e) => updateField('tglSptnp', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="pfpbInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    PFPB
                  </label>
                  <input
                    id="pfpbInput"
                    type="text"
                    disabled={isPhaseLocked(4)}
                    value={form.pfpb}
                    onChange={(e) => updateField('pfpb', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="tglPfpbInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tgl. PFPB
                  </label>
                  <input
                    id="tglPfpbInput"
                    type="date"
                    disabled={isPhaseLocked(4)}
                    value={form.tglPfpb}
                    onChange={(e) => updateField('tglPfpb', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="pfpdInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    PFPD
                  </label>
                  <input
                    id="pfpdInput"
                    type="text"
                    disabled={isPhaseLocked(4)}
                    value={form.pfpd}
                    onChange={(e) => updateField('pfpd', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="tglPfpdInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tgl. PFPD
                  </label>
                  <input
                    id="tglPfpdInput"
                    type="date"
                    disabled={isPhaseLocked(4)}
                    value={form.tglPfpd}
                    onChange={(e) => updateField('tglPfpd', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="eslahInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    ESLAH
                  </label>
                  <input
                    id="eslahInput"
                    type="text"
                    disabled={isPhaseLocked(4)}
                    value={form.eslah}
                    onChange={(e) => updateField('eslah', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="tglEslahInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tgl. ESLAH
                  </label>
                  <input
                    id="tglEslahInput"
                    type="date"
                    disabled={isPhaseLocked(4)}
                    value={form.tglEslah}
                    onChange={(e) => updateField('tglEslah', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-semibold text-[#0B2545]">
                  Checklist Dokumen OS (Penyelesaian Akhir)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pengaturan.checklistItems.map((item) => (
                    <label
                      key={item}
                      className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        disabled={isPhaseLocked(4)}
                        checked={Boolean(form.dokumenOs?.items?.[item])}
                        onChange={(e) =>
                          toggleChecklistItem('dokumenOs', item, e.target.checked)
                        }
                        className="rounded border-slate-300"
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label htmlFor="dokumenOsCatatan" className="block text-[11px] font-medium text-slate-600 mb-1">
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {submitError && (
            <div role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {submitError}
            </div>
          )}

          {/* Footer Navigation & Submit */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              {phase > 1 && (
                <button
                  type="button"
                  onClick={() => setPhase((phase - 1) as ShipmentPhase)}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-800 cursor-pointer"
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
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Fase Berikutnya
                </button>
              )}
              <button
                type="submit"
                disabled={saving || !hasAnyEditablePhase}
                className="min-h-[42px] px-5 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] disabled:opacity-60 text-xs font-semibold text-white cursor-pointer"
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
