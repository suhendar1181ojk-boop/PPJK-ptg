import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Download,
  MapPin,
  PackageCheck,
  Printer,
  Receipt,
  Save,
  Truck,
  UserCheck,
  X,
} from 'lucide-react';
import type { Pengaturan, Shipment, StatusSuratJalanType } from '../types/ppjk';
import {
  generateSuratJalanNomor,
  normalizeStatusSuratJalan,
} from '../utils/ppjkLogic';
import { exportSuratJalanToPDF } from '../utils/exportUtils';
import { StatusSuratJalanBadge } from './Badges';

interface SuratJalanModalProps {
  shipment: Shipment;
  pengaturan?: Pengaturan;
  canEdit: boolean;
  onClose: () => void;
  onOpenBilling?: (kodeOs: string, tab?: 'owner' | 'customer') => void;
  onSaveSuratJalan: (
    kodeOs: string,
    payload: {
      suratJalanNomor: string;
      suratJalanTanggal: string;
      suratJalanStatus: StatusSuratJalanType;
      suratJalanTujuan: string;
      suratJalanPenerima: string;
      suratJalanCatatan: string;
    }
  ) => Promise<void>;
}

const TRACKING_STEPS: Array<{
  status: StatusSuratJalanType;
  title: string;
  desc: string;
}> = [
  {
    status: 'Terbit',
    title: '1. Gate-Out & SJ Terbit',
    desc: 'Kontainer keluar pelabuhan & Surat Jalan diterbitkan',
  },
  {
    status: 'Dalam Pengiriman',
    title: '2. Dalam Pengiriman',
    desc: 'Armada trucking menuju alamat gudang tujuan',
  },
  {
    status: 'Tiba di Tujuan',
    title: '3. Tiba di Tujuan',
    desc: 'Serah terima kontainer selesai di lokasi tujuan',
  },
];

export function SuratJalanModal({
  shipment,
  pengaturan,
  canEdit,
  onClose,
  onOpenBilling,
  onSaveSuratJalan,
}: SuratJalanModalProps) {
  const defaultNomor =
    shipment.suratJalanNomor?.trim() || generateSuratJalanNomor(shipment.kodeOs);
  const defaultTanggal =
    shipment.suratJalanTanggal?.trim() ||
    shipment.gateOutTanggal?.trim() ||
    new Date().toISOString().slice(0, 10);
  const defaultStatus = normalizeStatusSuratJalan(
    shipment.suratJalanStatus,
    'Sudah',
    shipment.status
  );
  const defaultTujuan =
    shipment.suratJalanTujuan?.trim() ||
    (shipment.namaCustomer ? `Gudang ${shipment.namaCustomer}` : '');

  const [nomor, setNomor] = useState(defaultNomor);
  const [tanggal, setTanggal] = useState(defaultTanggal);
  const [statusTracking, setStatusTracking] = useState<StatusSuratJalanType>(defaultStatus);
  const [tujuan, setTujuan] = useState(defaultTujuan);
  const [penerima, setPenerima] = useState(shipment.suratJalanPenerima || '');
  const [catatan, setCatatan] = useState(
    shipment.suratJalanCatatan || shipment.gateOutCatatan || ''
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNomor(shipment.suratJalanNomor?.trim() || generateSuratJalanNomor(shipment.kodeOs));
    setTanggal(
      shipment.suratJalanTanggal?.trim() ||
        shipment.gateOutTanggal?.trim() ||
        new Date().toISOString().slice(0, 10)
    );
    setStatusTracking(
      normalizeStatusSuratJalan(shipment.suratJalanStatus, 'Sudah', shipment.status)
    );
    setTujuan(
      shipment.suratJalanTujuan?.trim() ||
        (shipment.namaCustomer ? `Gudang ${shipment.namaCustomer}` : '')
    );
    setPenerima(shipment.suratJalanPenerima || '');
    setCatatan(shipment.suratJalanCatatan || shipment.gateOutCatatan || '');
  }, [shipment]);

  const previewShipment: Shipment = {
    ...shipment,
    suratJalanNomor: nomor.trim() || defaultNomor,
    suratJalanTanggal: tanggal.trim() || defaultTanggal,
    suratJalanStatus: statusTracking,
    suratJalanTujuan: tujuan.trim() || defaultTujuan,
    suratJalanPenerima: penerima.trim(),
    suratJalanCatatan: catatan.trim(),
  };

  const activeStepIdx = TRACKING_STEPS.findIndex((s) => s.status === statusTracking);

  const inputSurfaceCls =
    'w-full min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:focus:ring-violet-500/40 focus:border-emerald-500 dark:focus:border-violet-500';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      await onSaveSuratJalan(shipment.kodeOs, {
        suratJalanNomor: nomor.trim().toUpperCase() || defaultNomor,
        suratJalanTanggal: tanggal.trim() || defaultTanggal,
        suratJalanStatus: statusTracking,
        suratJalanTujuan: tujuan.trim(),
        suratJalanPenerima: penerima.trim(),
        suratJalanCatatan: catatan.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/65 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label={`Surat Jalan & Tracking ${defaultNomor}`}
        className="w-full max-w-3xl bg-white dark:bg-[#111625] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#0B2545] dark:bg-[#0D111C] text-white flex items-center justify-between gap-3 border-b border-white/10 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <ClipboardList className="w-4 h-4 text-emerald-400 shrink-0" />
              <h3 className="text-sm font-bold tracking-tight">
                Surat Jalan &amp; Tracking Pengiriman · {nomor || defaultNomor}
              </h3>
              <StatusSuratJalanBadge
                suratJalanStatus={statusTracking}
                gateOutStatus="Sudah"
                shipmentStatus={shipment.status}
              />
            </div>
            <p className="text-[11px] text-white/75 dark:text-slate-400 mt-0.5 truncate">
              {shipment.kodeOs} · {shipment.namaCustomer} · Kontainer: {shipment.noCont || '-'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Surat Jalan"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto">
          {/* 3-Step Visual Tracking Timeline */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-[#0B2545] dark:text-white flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Progress Tracking Surat Jalan</span>
              </div>
              {shipment.gateOutTanggal && (
                <span className="text-[11px] font-mono-code text-slate-600 dark:text-slate-300">
                  Gate-Out Pelabuhan: {shipment.gateOutTanggal}
                </span>
              )}
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
              role="radiogroup"
              aria-label="Status Tracking Surat Jalan"
            >
              {TRACKING_STEPS.map((step, idx) => {
                const isSelected = statusTracking === step.status;
                const isCompleted = activeStepIdx >= idx;
                return (
                  <button
                    key={step.status}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={!canEdit}
                    onClick={() => setStatusTracking(step.status)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer disabled:cursor-default ${
                      isSelected
                        ? step.status === 'Tiba di Tujuan'
                          ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-400/40'
                          : step.status === 'Dalam Pengiriman'
                            ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-400 ring-2 ring-amber-300 dark:ring-amber-400/40'
                            : 'bg-sky-50 dark:bg-sky-500/15 border-sky-400 ring-2 ring-sky-300 dark:ring-sky-400/40'
                        : isCompleted
                          ? 'bg-emerald-50/40 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/25'
                          : 'bg-white dark:bg-[#182032] border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {step.title}
                      </span>
                      {isCompleted && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      {step.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ringkasan Dokumen & Armada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] text-xs">
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Dokumen &amp; Kontainer
              </div>
              <div className="text-slate-800 dark:text-slate-100 font-semibold">
                {shipment.namaCustomer} ({shipment.kodeCustomer})
              </div>
              <div className="font-mono-code text-[11px] text-slate-600 dark:text-slate-300">
                BL: {shipment.noBl || '-'} · Kapal: {shipment.ship || '-'}
              </div>
              <div className="font-mono-code text-[11px] text-slate-700 dark:text-slate-200">
                Cont: {shipment.noCont || '-'}
              </div>
              <div className="font-mono-code text-[11px] text-slate-500 dark:text-slate-400">
                SPPB: {shipment.noSppb || '-'} · TILA/Eslah: {shipment.doGatePassNomor || '-'}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Armada Trucking Pengantar
              </div>
              <div className="text-slate-800 dark:text-slate-100 font-semibold">
                Supir: {shipment.truckingNamaSupir || 'Belum diisi'}
              </div>
              <div className="font-mono-code text-[11px] text-slate-600 dark:text-slate-300">
                No. Plat Truk: {shipment.truckingNoPlat || '-'}
              </div>
              <div className="font-mono-code text-[11px] text-slate-600 dark:text-slate-300">
                No. HP Supir: {shipment.truckingNoHpSupir || '-'}
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                Status Shipment: {shipment.status}
              </div>
            </div>
          </div>

          {/* Form Detail Surat Jalan & Tujuan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
            <div>
              <label
                htmlFor="sjNomorInput"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Nomor Surat Jalan
              </label>
              <input
                id="sjNomorInput"
                type="text"
                disabled={!canEdit}
                value={nomor}
                onChange={(e) => setNomor(e.target.value.toUpperCase())}
                placeholder="SJ-2611-0001"
                className={`${inputSurfaceCls} font-mono-code`}
              />
            </div>

            <div>
              <label
                htmlFor="sjTanggalInput"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Tanggal Surat Jalan
              </label>
              <input
                id="sjTanggalInput"
                type="date"
                disabled={!canEdit}
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={inputSurfaceCls}
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="sjTujuanInput"
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Alamat / Gudang Tujuan Pengiriman</span>
              </label>
              <input
                id="sjTujuanInput"
                type="text"
                disabled={!canEdit}
                value={tujuan}
                onChange={(e) => setTujuan(e.target.value)}
                placeholder="Contoh: Gudang PT Nusantara, Kawasan Industri MM2100 Bekasi"
                className={inputSurfaceCls}
              />
            </div>

            <div>
              <label
                htmlFor="sjPenerimaInput"
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                <UserCheck className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                <span>Nama Penerima / PIC Gudang</span>
              </label>
              <input
                id="sjPenerimaInput"
                type="text"
                disabled={!canEdit}
                value={penerima}
                onChange={(e) => setPenerima(e.target.value)}
                placeholder="Contoh: Bpk. Wahyu (Kepala Gudang)"
                className={inputSurfaceCls}
              />
            </div>

            <div>
              <label
                htmlFor="sjCatatanInput"
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                <PackageCheck className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                <span>Catatan Tracking / No. Segel</span>
              </label>
              <input
                id="sjCatatanInput"
                type="text"
                disabled={!canEdit}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Contoh: Segel pelayaran utuh, estimasi tiba 17:00"
                className={inputSurfaceCls}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportSuratJalanToPDF(previewShipment, pengaturan)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-xs font-semibold text-emerald-800 dark:text-emerald-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF Surat Jalan</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak</span>
              </button>
              {onOpenBilling && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBilling(shipment.kodeOs, 'owner');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-xs font-semibold text-amber-800 dark:text-amber-200 cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Info Owner &amp; Penagihan</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
              >
                Tutup
              </button>
              {canEdit && (
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] hover:opacity-95 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Tracking Surat Jalan'}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
