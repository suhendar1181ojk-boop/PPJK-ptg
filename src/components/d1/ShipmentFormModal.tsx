import { useState, type FormEvent } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';
import {
  D1_DOC_STATUS_OPTIONS,
  D1_JALUR_OPTIONS,
  D1_STATUS_OPTIONS,
  type D1ShipmentInput,
  type D1ShipmentRecord,
} from '../../utils/d1Contract';

interface ShipmentFormModalProps {
  initialRecord: D1ShipmentRecord | null;
  onClose: () => void;
  onSubmit: (input: D1ShipmentInput) => Promise<D1ShipmentRecord>;
}

export function ShipmentFormModal({
  initialRecord,
  onClose,
  onSubmit,
}: ShipmentFormModalProps) {
  const isEdit = Boolean(initialRecord);

  const [osCode, setOsCode] = useState(initialRecord?.os_code || '');
  const [docOs, setDocOs] = useState(initialRecord?.doc_os || '');
  const [importerCode, setImporterCode] = useState(initialRecord?.importer_code || '');
  const [importerName, setImporterName] = useState(initialRecord?.importer_name || '');
  const [customerCode, setCustomerCode] = useState(initialRecord?.customer_code || '');
  const [customerName, setCustomerName] = useState(initialRecord?.customer_name || '');
  const [blNumber, setBlNumber] = useState(initialRecord?.bl_number || '');
  const [packingList, setPackingList] = useState(initialRecord?.packing_list || '');
  const [ajuNumber, setAjuNumber] = useState(initialRecord?.aju_number || '');
  const [nopen, setNopen] = useState(initialRecord?.nopen || '');
  const [containerNumber, setContainerNumber] = useState(
    initialRecord?.container_number || ''
  );
  const [status, setStatus] = useState(initialRecord?.status || 'Dokumen Diterima');
  const [docStatus, setDocStatus] = useState(initialRecord?.doc_status || 'Draft');
  const [jalur, setJalur] = useState(initialRecord?.jalur || '');
  const [checkerName, setCheckerName] = useState(initialRecord?.checker_name || '');
  const [etaDate, setEtaDate] = useState(initialRecord?.eta_date || '');
  const [etdDate, setEtdDate] = useState(initialRecord?.etd_date || '');
  const [receivedDate, setReceivedDate] = useState(
    initialRecord?.received_date || new Date().toISOString().slice(0, 10)
  );
  const [sppbDate, setSppbDate] = useState(initialRecord?.sppb_date || '');
  const [gateOutDate, setGateOutDate] = useState(initialRecord?.gate_out_date || '');
  const [bmPdriAmount, setBmPdriAmount] = useState(
    initialRecord ? String(initialRecord.bm_pdri_amount || 0) : '0'
  );
  const [isUrgent, setIsUrgent] = useState(Boolean(initialRecord?.is_urgent));
  const [notes, setNotes] = useState(initialRecord?.notes || '');
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    const cleanOs = osCode.trim().toUpperCase();
    const cleanImpCode = importerCode.trim();
    const cleanImpName = importerName.trim();

    if (!cleanOs) {
      setErrorText('Kode OS (os_code) wajib diisi.');
      return;
    }
    if (!cleanImpCode || !cleanImpName) {
      setErrorText('Kode Importir dan Nama Importir wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        ...(initialRecord
          ? { id: initialRecord.id, version: initialRecord.version }
          : {}),
        os_code: cleanOs,
        doc_os: docOs.trim(),
        importer_code: cleanImpCode,
        importer_name: cleanImpName,
        customer_code: customerCode.trim(),
        customer_name: customerName.trim(),
        bl_number: blNumber.trim(),
        packing_list: packingList.trim(),
        aju_number: ajuNumber.trim(),
        nopen: nopen.trim(),
        container_number: containerNumber.trim(),
        status,
        doc_status: docStatus,
        jalur,
        checker_name: checkerName.trim(),
        eta_date: etaDate,
        etd_date: etdDate,
        received_date: receivedDate,
        sppb_date: sppbDate,
        gate_out_date: gateOutDate,
        bm_pdri_amount: Math.max(0, Number(bmPdriAmount) || 0),
        is_urgent: isUrgent ? 1 : 0,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'Gagal menyimpan data shipment ke cache/D1.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="d1-shipment-modal-title"
    >
      <div
        data-testid="d1-shipment-form-modal"
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2
              id="d1-shipment-modal-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              {isEdit ? `Edit Shipment ${initialRecord?.os_code}` : 'Tambah Shipment D1 Baru'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isEdit
                ? `ID: ${initialRecord?.id} · Versi saat ini: v${initialRecord?.version} (tersimpan ke IndexedDB & antrean D1)`
                : 'Simpan offline-first ke IndexedDB dan sinkronkan otomatis ke Cloudflare D1.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal shipment"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorText && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 p-3 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorText}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Kode OS *
              </label>
              <input
                type="text"
                required
                data-testid="d1-input-os-code"
                value={osCode}
                onChange={(e) => setOsCode(e.target.value)}
                placeholder="OS-2611-0099"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Doc OS (Manual)
              </label>
              <input
                type="text"
                data-testid="d1-input-doc-os"
                value={docOs}
                onChange={(e) => setDocOs(e.target.value)}
                placeholder="TN-205"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                No. BL
              </label>
              <input
                type="text"
                data-testid="d1-input-bl-number"
                value={blNumber}
                onChange={(e) => setBlNumber(e.target.value)}
                placeholder="EGLV142980999"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Kode Importir *
              </label>
              <input
                type="text"
                required
                data-testid="d1-input-importer-code"
                value={importerCode}
                onChange={(e) => setImporterCode(e.target.value)}
                placeholder="IMP-001"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Nama Importir *
              </label>
              <input
                type="text"
                required
                data-testid="d1-input-importer-name"
                value={importerName}
                onChange={(e) => setImporterName(e.target.value)}
                placeholder="PT Nusantara Elektrindo"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Kode Customer
              </label>
              <input
                type="text"
                value={customerCode}
                onChange={(e) => setCustomerCode(e.target.value)}
                placeholder="CUST-001"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Nama Customer
              </label>
              <input
                type="text"
                data-testid="d1-input-customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="PT Maju Jaya Elektronik"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                No. Packing List
              </label>
              <input
                type="text"
                value={packingList}
                onChange={(e) => setPackingList(e.target.value)}
                placeholder="PL-2611-009"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                No. AJU
              </label>
              <input
                type="text"
                value={ajuNumber}
                onChange={(e) => setAjuNumber(e.target.value)}
                placeholder="000010-261109"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                NOPEN
              </label>
              <input
                type="text"
                value={nopen}
                onChange={(e) => setNopen(e.target.value)}
                placeholder="448512"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                No. Kontainer
              </label>
              <input
                type="text"
                value={containerNumber}
                onChange={(e) => setContainerNumber(e.target.value)}
                placeholder="EGHU1234567 (40HC)"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Status Shipment
              </label>
              <select
                data-testid="d1-input-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              >
                {D1_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Status Dokumen Checker
              </label>
              <select
                value={docStatus}
                onChange={(e) => setDocStatus(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              >
                {D1_DOC_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Jalur Kepabeanan
              </label>
              <select
                value={jalur}
                onChange={(e) => setJalur(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              >
                {D1_JALUR_OPTIONS.map((opt) => (
                  <option key={opt || 'empty'} value={opt}>
                    {opt || 'Belum Ada'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Nama Checker
              </label>
              <input
                type="text"
                value={checkerName}
                onChange={(e) => setCheckerName(e.target.value)}
                placeholder="Budi Santoso"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                BM / PDRI (Rp)
              </label>
              <input
                type="number"
                min={0}
                value={bmPdriAmount}
                onChange={(e) => setBmPdriAmount(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                ETD
              </label>
              <input
                type="date"
                value={etdDate}
                onChange={(e) => setEtdDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                ETA
              </label>
              <input
                type="date"
                value={etaDate}
                onChange={(e) => setEtaDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Tgl. Terima Dok
              </label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Tgl. SPPB
              </label>
              <input
                type="date"
                value={sppbDate}
                onChange={(e) => setSppbDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Tgl. Gate-Out
              </label>
              <input
                type="date"
                value={gateOutDate}
                onChange={(e) => setGateOutDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
              />
            </div>

            <div className="flex items-end pb-1">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#F28C28] dark:accent-violet-500"
                />
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                  Tandai Urgent / Prioritas
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Catatan Operasional
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan terkait D/O, jalur, pemeriksaan fisik, atau gate-out..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0D111C] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F28C28] dark:focus:ring-violet-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-slate-200 dark:border-white/[0.1] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              data-testid="d1-submit-shipment-btn"
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#0B2545] hover:bg-[#133866] dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] text-white text-xs font-semibold shadow-sm disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Shipment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
