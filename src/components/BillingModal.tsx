import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Landmark,
  Mail,
  MessageCircle,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Save,
  Send,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  BillingItem,
  Customer,
  Pengaturan,
  Shipment,
  StatusPenagihanType,
  UserRole,
} from '../types/ppjk';
import {
  buildAutoBillingFields,
  buildCustomerBillingMessage,
  buildDefaultBillingItems,
  buildOwnerBillingMessage,
  calculateBillingTotals,
  DEFAULT_PENGATURAN,
  formatRupiah,
  getBillingEligibilityReason,
  normalizeStatusPenagihan,
  normalizeWhatsAppNumber,
} from '../utils/ppjkLogic';
import { exportSuratPenagihanToPDF } from '../utils/exportUtils';
import { StatusPenagihanBadge } from './Badges';

interface BillingModalProps {
  shipment: Shipment;
  customer?: Customer;
  pengaturan: Pengaturan;
  userRole: UserRole;
  initialTab?: 'owner' | 'customer';
  onClose: () => void;
  onNotifyOwner: (
    kodeOs: string,
    via: 'WhatsApp' | 'Email' | 'WA & Email'
  ) => Promise<void>;
  onSaveInvoice: (
    kodeOs: string,
    payload: {
      billingNomor: string;
      billingTanggal: string;
      billingJatuhTempo: string;
      billingItems: BillingItem[];
      billingPpnPersen: number;
      billingCatatan: string;
      billingStatus: StatusPenagihanType;
      customerSentVia?: 'WhatsApp' | 'Email' | 'WA & Email' | '';
    }
  ) => Promise<void>;
}

export function BillingModal({
  shipment,
  customer,
  pengaturan,
  userRole,
  initialTab = 'owner',
  onClose,
  onNotifyOwner,
  onSaveInvoice,
}: BillingModalProps) {
  const canNotifyOwner = userRole !== 'Manajer';
  const canPublishInvoice = userRole === 'Admin';

  const autoSeed = useMemo(() => buildAutoBillingFields(shipment), [shipment]);
  const ownerDraftSeed = useMemo(
    () => buildOwnerBillingMessage(shipment, pengaturan),
    [shipment, pengaturan]
  );

  const [activeTab, setActiveTab] = useState<'owner' | 'customer'>(initialTab);
  const [ownerSubject, setOwnerSubject] = useState(ownerDraftSeed.subject);
  const [ownerMessage, setOwnerMessage] = useState(ownerDraftSeed.message);
  const [copiedOwner, setCopiedOwner] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const [billingNomor, setBillingNomor] = useState(autoSeed.billingNomor);
  const [billingTanggal, setBillingTanggal] = useState(autoSeed.billingTanggal);
  const [billingJatuhTempo, setBillingJatuhTempo] = useState(autoSeed.billingJatuhTempo);
  const [billingItems, setBillingItems] = useState<BillingItem[]>(autoSeed.billingItems);
  const [billingPpnPersen, setBillingPpnPersen] = useState<number>(autoSeed.billingPpnPersen);
  const [billingCatatan, setBillingCatatan] = useState(shipment.billingCatatan || '');
  const [billingStatus, setBillingStatus] = useState<StatusPenagihanType>(() => {
    const cur = normalizeStatusPenagihan(shipment.billingStatus, shipment);
    if (cur === 'Penagihan Terbit' || cur === 'Terkirim ke Customer' || cur === 'Lunas') {
      return cur;
    }
    return 'Penagihan Terbit';
  });
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, shipment.kodeOs]);

  useEffect(() => {
    const nextAuto = buildAutoBillingFields(shipment);
    const nextOwner = buildOwnerBillingMessage(shipment, pengaturan);
    setOwnerSubject(nextOwner.subject);
    setOwnerMessage(nextOwner.message);
    setBillingNomor(nextAuto.billingNomor);
    setBillingTanggal(nextAuto.billingTanggal);
    setBillingJatuhTempo(nextAuto.billingJatuhTempo);
    setBillingItems(nextAuto.billingItems);
    setBillingPpnPersen(nextAuto.billingPpnPersen);
    setBillingCatatan(shipment.billingCatatan || '');
    const cur = normalizeStatusPenagihan(shipment.billingStatus, shipment);
    setBillingStatus(
      cur === 'Penagihan Terbit' || cur === 'Terkirim ke Customer' || cur === 'Lunas'
        ? cur
        : 'Penagihan Terbit'
    );
  }, [shipment, pengaturan]);

  const totals = useMemo(
    () => calculateBillingTotals(billingItems, billingPpnPersen),
    [billingItems, billingPpnPersen]
  );

  const previewShipment: Shipment = {
    ...shipment,
    billingNomor: billingNomor.trim().toUpperCase() || autoSeed.billingNomor,
    billingTanggal: billingTanggal.trim() || autoSeed.billingTanggal,
    billingJatuhTempo: billingJatuhTempo.trim() || autoSeed.billingJatuhTempo,
    billingItems,
    billingPpnPersen,
    billingTotal: totals.total,
    billingCatatan: billingCatatan.trim(),
    billingStatus,
  };

  const customerMsg = useMemo(
    () => buildCustomerBillingMessage(previewShipment, customer, pengaturan),
    [previewShipment, customer, pengaturan]
  );

  const ownerWaDigits = normalizeWhatsAppNumber(
    pengaturan.ownerWhatsapp || DEFAULT_PENGATURAN.ownerWhatsapp
  );
  const ownerWaUrl = ownerWaDigits
    ? `https://wa.me/${ownerWaDigits}?text=${encodeURIComponent(ownerMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(ownerMessage)}`;
  const ownerEmailTarget = (
    pengaturan.ownerEmail ||
    DEFAULT_PENGATURAN.ownerEmail ||
    ''
  ).trim();
  const ownerMailtoUrl = `mailto:${encodeURIComponent(ownerEmailTarget)}?subject=${encodeURIComponent(
    ownerSubject
  )}&body=${encodeURIComponent(ownerMessage)}`;

  const showNotice = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => setStatusFeedback(''), 3500);
  };

  const handleCopyOwnerMessage = async () => {
    try {
      await navigator.clipboard.writeText(ownerMessage);
      setCopiedOwner(true);
      showNotice('Pesan notifikasi Owner berhasil disalin.');
      setTimeout(() => setCopiedOwner(false), 2000);
    } catch {
      showNotice('Gagal menyalin otomatis. Anda dapat menyalin teks langsung dari kotak pesan.');
    }
  };

  const handleLogNotifyOwner = async (via: 'WhatsApp' | 'Email' | 'WA & Email') => {
    if (!canNotifyOwner) return;
    setNotifying(true);
    try {
      await onNotifyOwner(shipment.kodeOs, via);
      showNotice(`Status dicatat: Info Owner Terkirim via ${via}.`);
    } finally {
      setNotifying(false);
    }
  };

  const handleAddItem = () => {
    setBillingItems((prev) => [
      ...prev,
      {
        id: `${shipment.kodeOs}_item_${Date.now()}`,
        deskripsi: 'Biaya Tambahan / Storage / Demurrage',
        qty: 1,
        satuan: 'Paket',
        hargaSatuan: 500000,
      },
    ]);
  };

  const handleResetItems = () => {
    setBillingItems(buildDefaultBillingItems(shipment));
    showNotice('Item penagihan direset ke perhitungan otomatis PPJK.');
  };

  const handleSaveInvoiceSubmit = async (
    e?: React.FormEvent,
    overrideStatus?: StatusPenagihanType,
    sentVia?: 'WhatsApp' | 'Email' | 'WA & Email' | ''
  ) => {
    if (e) e.preventDefault();
    if (!canPublishInvoice) return;
    setSavingInvoice(true);
    try {
      const targetStatus = overrideStatus || billingStatus;
      await onSaveInvoice(shipment.kodeOs, {
        billingNomor: billingNomor.trim().toUpperCase() || autoSeed.billingNomor,
        billingTanggal: billingTanggal.trim() || autoSeed.billingTanggal,
        billingJatuhTempo: billingJatuhTempo.trim() || autoSeed.billingJatuhTempo,
        billingItems,
        billingPpnPersen,
        billingCatatan: billingCatatan.trim(),
        billingStatus: targetStatus,
        customerSentVia: sentVia,
      });
      setBillingStatus(targetStatus);
      showNotice(`Surat Penagihan ${billingNomor.trim().toUpperCase()} disimpan (${targetStatus}).`);
    } finally {
      setSavingInvoice(false);
    }
  };

  const inputCls =
    'w-full min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-xs bg-white dark:bg-[#182032] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500';

  const currentPersistedStatus = normalizeStatusPenagihan(shipment.billingStatus, shipment);
  const triggerReason = getBillingEligibilityReason(shipment);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/65 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label={`Info Owner & Auto Surat Penagihan ${shipment.kodeOs}`}
        className="w-full max-w-4xl bg-white dark:bg-[#111625] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#0B2545] dark:bg-[#0D111C] text-white flex items-start justify-between gap-3 border-b border-white/10 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Receipt className="w-4 h-4 text-[#F28C28] dark:text-violet-400 shrink-0" />
              <h3 className="text-sm font-bold tracking-tight">
                Info Owner &amp; Auto Surat Penagihan · {shipment.kodeOs}
              </h3>
              <StatusPenagihanBadge
                billingStatus={currentPersistedStatus}
                shipment={shipment}
              />
            </div>
            <p className="text-[11px] text-white/75 dark:text-slate-400 mt-1 truncate">
              {shipment.namaCustomer} ({shipment.kodeCustomer}) · Pemicu:{' '}
              <strong className="text-emerald-300">{triggerReason}</strong> · No. Penagihan:{' '}
              <span className="font-mono-code font-semibold text-white">{billingNomor}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal penagihan"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Tabs */}
        <div className="px-5 pt-3 pb-2 bg-slate-50 dark:bg-[#151B2B] border-b border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="billing-tab-owner"
            onClick={() => setActiveTab('owner')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
              activeTab === 'owner'
                ? 'bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white border-transparent shadow-sm'
                : 'bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#1C2438]'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>1. Info Owner (WA / Email)</span>
          </button>

          <button
            type="button"
            data-testid="billing-tab-customer"
            onClick={() => setActiveTab('customer')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
              activeTab === 'customer'
                ? 'bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white border-transparent shadow-sm'
                : 'bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#1C2438]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. Auto Surat Penagihan (Admin)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {statusFeedback && (
            <div
              role="status"
              className="px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusFeedback}</span>
            </div>
          )}

          {activeTab === 'owner' && (
            <div className="space-y-4">
              {/* Trigger & Contacts Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-1 text-xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Tujuan Info: Owner Perusahaan
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {pengaturan.ownerName || DEFAULT_PENGATURAN.ownerName}
                  </div>
                  <div className="font-mono-code text-[11px] text-emerald-700 dark:text-emerald-300">
                    WA: {pengaturan.ownerWhatsapp || DEFAULT_PENGATURAN.ownerWhatsapp}
                  </div>
                  <div className="font-mono-code text-[11px] text-sky-700 dark:text-sky-300 truncate">
                    Email: {pengaturan.ownerEmail || DEFAULT_PENGATURAN.ownerEmail}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] space-y-1 text-xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Instruksi Penagihan ke Admin PPJK
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span>{pengaturan.adminName || DEFAULT_PENGATURAN.adminName}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    Status Pemicu: <strong className="text-emerald-600 dark:text-emerald-400">{triggerReason}</strong>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {shipment.billingOwnerNotifiedAt
                      ? `Terakhir diinfo via ${shipment.billingOwnerNotifiedVia || 'WA/Email'} oleh ${shipment.billingOwnerNotifiedBy || '-'}`
                      : 'Belum dikirim info penagihan ke Owner.'}
                  </div>
                </div>
              </div>

              {/* Subject & Editable Message Preview */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
                <div>
                  <label
                    htmlFor="ownerBillingSubject"
                    className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Subjek Email Info Owner
                  </label>
                  <input
                    id="ownerBillingSubject"
                    type="text"
                    value={ownerSubject}
                    onChange={(e) => setOwnerSubject(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label
                      htmlFor="ownerBillingMessage"
                      className="text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Isi Pesan WhatsApp / Email ke Owner (Otomatis dari Data SPPB / Gate-Out)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setOwnerSubject(ownerDraftSeed.subject);
                        setOwnerMessage(ownerDraftSeed.message);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Template</span>
                    </button>
                  </div>
                  <textarea
                    id="ownerBillingMessage"
                    rows={10}
                    value={ownerMessage}
                    onChange={(e) => setOwnerMessage(e.target.value)}
                    className={`${inputCls} font-mono-code leading-relaxed`}
                  />
                </div>
              </div>

              {/* Action Buttons for Owner Notification */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={ownerWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="owner-wa-link"
                    onClick={() => {
                      if (canNotifyOwner) void handleLogNotifyOwner('WhatsApp');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Kirim WhatsApp ke Owner</span>
                  </a>

                  <a
                    href={ownerMailtoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="owner-email-link"
                    onClick={() => {
                      if (canNotifyOwner) void handleLogNotifyOwner('Email');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Kirim Email ke Owner</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => void handleCopyOwnerMessage()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {copiedOwner ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedOwner ? 'Tersalin' : 'Salin Pesan'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canNotifyOwner && (
                    <button
                      type="button"
                      disabled={notifying}
                      data-testid="mark-owner-notified-btn"
                      onClick={() => void handleLogNotifyOwner('WA & Email')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {notifying ? 'Mencatat...' : 'Tandai Info Owner Terkirim'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="go-to-auto-invoice-btn"
                    onClick={() => setActiveTab('customer')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F28C28] hover:bg-[#D97719] text-white text-xs font-semibold cursor-pointer"
                  >
                    <span>Lanjut ke Auto-Penagihan Admin</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'customer' && (
            <form onSubmit={(e) => void handleSaveInvoiceSubmit(e)} className="space-y-4">
              {!canPublishInvoice && (
                <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-xs text-amber-800 dark:text-amber-200">
                  Mode pratinjau: Hanya akun <strong>Admin</strong> yang dapat menerbitkan atau menyimpan perubahan Surat Penagihan resmi untuk customer.
                </div>
              )}

              {/* Invoice Header Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
                <div>
                  <label
                    htmlFor="billingNomorInput"
                    className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 whitespace-nowrap"
                  >
                    No. Penagihan (Auto)
                  </label>
                  <input
                    id="billingNomorInput"
                    type="text"
                    disabled={!canPublishInvoice}
                    value={billingNomor}
                    onChange={(e) => setBillingNomor(e.target.value.toUpperCase())}
                    className={`${inputCls} font-mono-code font-bold`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="billingTanggalInput"
                    className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 whitespace-nowrap"
                  >
                    Tanggal Terbit
                  </label>
                  <input
                    id="billingTanggalInput"
                    type="date"
                    disabled={!canPublishInvoice}
                    value={billingTanggal}
                    onChange={(e) => setBillingTanggal(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label
                    htmlFor="billingJatuhTempoInput"
                    className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 whitespace-nowrap"
                  >
                    Jatuh Tempo (14 Hari)
                  </label>
                  <input
                    id="billingJatuhTempoInput"
                    type="date"
                    disabled={!canPublishInvoice}
                    value={billingJatuhTempo}
                    onChange={(e) => setBillingJatuhTempo(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label
                    htmlFor="billingStatusSelect"
                    className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Status Penagihan
                  </label>
                  <select
                    id="billingStatusSelect"
                    disabled={!canPublishInvoice}
                    value={billingStatus}
                    onChange={(e) => setBillingStatus(e.target.value as StatusPenagihanType)}
                    className={inputCls}
                  >
                    <option value="Penagihan Terbit">Penagihan Terbit</option>
                    <option value="Terkirim ke Customer">Terkirim ke Customer</option>
                    <option value="Lunas">Lunas</option>
                  </select>
                </div>
              </div>

              {/* Customer Contact & Reference Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Kepada Customer
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {shipment.namaCustomer} ({shipment.kodeCustomer})
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    Kontak Master: {customer?.kontak || '-'}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Dokumen Referensi PPJK
                  </div>
                  <div className="font-mono-code text-[11px] text-slate-700 dark:text-slate-200">
                    BL: {shipment.noBl || '-'} · Cont: {shipment.noCont || '-'}
                  </div>
                  <div className="font-mono-code text-[11px] text-slate-600 dark:text-slate-300">
                    SPPB: {shipment.noSppb || '-'} · SJ: {shipment.suratJalanNomor || '-'}
                  </div>
                </div>
              </div>

              {/* Editable Itemized Billing Table */}
              <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 dark:bg-[#182032] border-b border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Rincian Jasa &amp; Biaya Penagihan
                  </span>
                  {canPublishInvoice && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetItems}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#131926] text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Item Otomatis</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Tambah Baris</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-3 space-y-2 bg-white dark:bg-[#131926]">
                  <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_68px_96px_136px_36px] gap-2 px-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <div>Uraian Jasa / Biaya</div>
                    <div className="text-center">Qty</div>
                    <div>Satuan</div>
                    <div className="text-right">Harga Satuan (Rp)</div>
                    <div className="text-right">Aksi</div>
                  </div>
                  {billingItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="grid grid-cols-12 sm:grid-cols-[minmax(0,1fr)_68px_96px_136px_36px] gap-2 items-center p-2 rounded-lg bg-slate-50 dark:bg-[#161D2F] border border-slate-200/70 dark:border-white/[0.06]"
                    >
                      <div className="col-span-12 sm:col-span-1 min-w-0">
                        <input
                          type="text"
                          aria-label={`Uraian biaya baris ${idx + 1}`}
                          disabled={!canPublishInvoice}
                          value={item.deskripsi}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBillingItems((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, deskripsi: val } : row))
                            );
                          }}
                          className={inputCls}
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-1">
                        <input
                          type="number"
                          min={0}
                          aria-label={`Qty baris ${idx + 1}`}
                          disabled={!canPublishInvoice}
                          value={item.qty}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setBillingItems((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, qty: val } : row))
                            );
                          }}
                          className={`${inputCls} tabular-nums text-center px-2`}
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-1">
                        <input
                          type="text"
                          aria-label={`Satuan baris ${idx + 1}`}
                          disabled={!canPublishInvoice}
                          value={item.satuan}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBillingItems((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, satuan: val } : row))
                            );
                          }}
                          className={`${inputCls} px-2.5`}
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-1">
                        <input
                          type="number"
                          min={0}
                          step={50000}
                          aria-label={`Harga satuan baris ${idx + 1}`}
                          disabled={!canPublishInvoice}
                          value={item.hargaSatuan}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setBillingItems((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, hargaSatuan: val } : row
                              )
                            );
                          }}
                          className={`${inputCls} tabular-nums text-right px-2.5`}
                        />
                      </div>
                      <div className="col-span-12 sm:col-span-1 flex items-center justify-between sm:justify-end gap-2">
                        <span className="sm:hidden text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                          {formatRupiah(item.qty * item.hargaSatuan)}
                        </span>
                        {canPublishInvoice && billingItems.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Hapus baris ${idx + 1}`}
                            onClick={() =>
                              setBillingItems((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals Bar */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-[#182032] border-t border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="billingPpnSelect"
                      className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap"
                    >
                      Tarif PPN:
                    </label>
                    <select
                      id="billingPpnSelect"
                      disabled={!canPublishInvoice}
                      value={billingPpnPersen}
                      onChange={(e) => setBillingPpnPersen(Number(e.target.value))}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#131926] text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      <option value={11}>PPN 11%</option>
                      <option value={0}>Non-PPN (0%)</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 sm:justify-end tabular-nums">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Subtotal: </span>
                      <strong className="text-slate-900 dark:text-white">
                        {formatRupiah(totals.subtotal)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">
                        PPN ({billingPpnPersen}%):{' '}
                      </span>
                      <strong className="text-slate-900 dark:text-white">
                        {formatRupiah(totals.ppnNominal)}
                      </strong>
                    </div>
                    <div className="px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                      Total: {formatRupiah(totals.total)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Catatan & Bank Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08]">
                  <label
                    htmlFor="billingCatatanInput"
                    className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Catatan Surat Penagihan (Opsional)
                  </label>
                  <input
                    id="billingCatatanInput"
                    type="text"
                    disabled={!canPublishInvoice}
                    value={billingCatatan}
                    onChange={(e) => setBillingCatatan(e.target.value)}
                    placeholder="Contoh: Mohon lampirkan bukti potong PPh 23"
                    className={inputCls}
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161D2F] border border-slate-200 dark:border-white/[0.08] text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    <Landmark className="w-3.5 h-3.5 text-amber-500" />
                    <span>Rekening Pembayaran Perusahaan</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    {pengaturan.billingBankInfo || DEFAULT_PENGATURAN.billingBankInfo}
                  </div>
                </div>
              </div>

              {/* Footer Actions: PDF, Print, WA/Email Customer, Submit */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportSuratPenagihanToPDF(previewShipment, customer, pengaturan)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-xs font-semibold text-emerald-800 dark:text-emerald-200 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF Surat Penagihan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#182032] hover:bg-slate-50 dark:hover:bg-[#1F2940] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak</span>
                  </button>

                  <a
                    href={customerMsg.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="customer-wa-link"
                    onClick={() => {
                      if (canPublishInvoice) {
                        void handleSaveInvoiceSubmit(
                          undefined,
                          billingStatus === 'Lunas' ? 'Lunas' : 'Terkirim ke Customer',
                          'WhatsApp'
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WA Customer</span>
                  </a>

                  <a
                    href={customerMsg.mailtoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="customer-email-link"
                    onClick={() => {
                      if (canPublishInvoice) {
                        void handleSaveInvoiceSubmit(
                          undefined,
                          billingStatus === 'Lunas' ? 'Lunas' : 'Terkirim ke Customer',
                          'Email'
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Customer</span>
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
                  >
                    Tutup
                  </button>
                  {canPublishInvoice && (
                    <button
                      type="submit"
                      disabled={savingInvoice}
                      data-testid="save-invoice-btn"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B2545] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] hover:opacity-95 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>
                        {savingInvoice ? 'Menyimpan...' : 'Simpan & Terbitkan Penagihan'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
