import React, { useState } from 'react';
import {
  CheckSquare,
  ExternalLink,
  History,
  MessageSquare,
  Package,
  Paperclip,
  Pencil,
  Send,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  Catatan,
  DokumenItem,
  KontainerItem,
  LogPerubahan,
  PhasePermissions,
  Shipment,
  UserRole,
} from '../types/ppjk';
import {
  canPerformAction,
  canUserEditAnyPhase,
  formatChecklistProgress,
} from '../utils/ppjkLogic';
import { CountdownBadge, JalurBadge, StatusBadge } from './Badges';

interface ShipmentDetailDrawerProps {
  shipment: Shipment;
  containers: KontainerItem[];
  comments: Catatan[];
  documents: DokumenItem[];
  logs: LogPerubahan[];
  checklistItems: string[];
  userRole: UserRole;
  phasePermissions?: PhasePermissions;
  onClose: () => void;
  onEdit: (kodeOs: string) => void;
  onDelete: (kodeOs: string) => void;
  onAddComment: (kodeOs: string, isi: string) => Promise<void>;
  onUploadDocument: (kodeOs: string, jenis: string, fileName: string) => Promise<void>;
}

export function ShipmentDetailDrawer({
  shipment,
  containers,
  comments,
  documents,
  logs,
  checklistItems,
  userRole,
  phasePermissions,
  onClose,
  onEdit,
  onDelete,
  onAddComment,
  onUploadDocument,
}: ShipmentDetailDrawerProps) {
  const [noteText, setNoteText] = useState('');
  const [docJenis, setDocJenis] = useState('Bill of Lading (BL)');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [busy, setBusy] = useState(false);

  const canEdit = canUserEditAnyPhase({ role: userRole, phasePermissions });
  const canDelete = canPerformAction(userRole, 'delete_shipment');
  const canComment = canPerformAction(userRole, 'add_catatan');
  const canUpload = canPerformAction(userRole, 'upload_dokumen');

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
      await onUploadDocument(shipment.kodeOs, docJenis, selectedFileName);
      setSelectedFileName('');
    } finally {
      setBusy(false);
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
        ['3. Kode Customer', shipment.kodeCustomer],
        ['4. Nama Customer', shipment.namaCustomer],
        ['5. Tgl. Terima Dok', shipment.tglTerimaDok],
        ['7. No. Packinglist', shipment.noPackinglist],
        ['8. No. BL', shipment.noBl],
        ['30. Dokumen Checker', shipment.dokumenChecker],
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
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 flex justify-end no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label={`Detail Shipment ${shipment.kodeOs}`}
        className="w-full max-w-2xl bg-white h-full overflow-y-auto flex flex-col"
      >
        {/* Header Drawer */}
        <div className="sticky top-0 z-10 bg-[#0B2545] text-white px-6 py-4 flex items-start justify-between gap-4 border-b border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono-code text-xs font-bold text-[#F28C28]">
                {shipment.kodeOs}
              </span>
              <StatusBadge status={shipment.status} />
              <JalurBadge jalur={shipment.jalur} />
              <CountdownBadge days={shipment.countDownEta} />
            </div>
            <h2 className="text-lg font-bold text-white mt-1 truncate">
              {shipment.namaCustomer}
            </h2>
            <p className="text-xs text-white/70">
              No. BL: {shipment.noBl} · Terakhir diubah oleh {shipment.updatedBy}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(shipment.kodeOs)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] text-white text-xs font-semibold cursor-pointer"
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
          {/* 39 Kolom dikelompokkan per fase */}
          {phaseSections.map((sec) => (
            <section key={sec.title} className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B2545] border-b border-slate-200 pb-1.5">
                {sec.title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sec.fields.map(([label, val]) => (
                  <div
                    key={label}
                    className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/70"
                  >
                    <div className="text-[11px] text-slate-500">{label}</div>
                    <div className="text-xs font-semibold text-slate-900 mt-0.5 break-words tabular-nums">
                      {val === '' || val === null || val === undefined ? '-' : String(val)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Kolom 6 & 39: Checklist Terima Dok & Dokumen OS */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B2545] border-b border-slate-200 pb-1.5">
              6. Terima Dok &amp; 39. Dokumen OS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between text-xs font-semibold text-[#0B2545] mb-2">
                  <span>6. Terima Dok</span>
                  <span className="tabular-nums text-slate-500">
                    {terimaProg.checked}/{terimaProg.total}
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {checklistItems.map((it) => {
                    const ok = Boolean(shipment.terimaDok?.items?.[it]);
                    return (
                      <li key={it} className="flex items-center gap-2">
                        {ok ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        )}
                        <span className={ok ? 'text-slate-900' : 'text-slate-400'}>{it}</span>
                      </li>
                    );
                  })}
                </ul>
                {shipment.terimaDok?.catatan && (
                  <p className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                    Catatan: {shipment.terimaDok.catatan}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between text-xs font-semibold text-[#0B2545] mb-2">
                  <span>39. Dokumen OS</span>
                  <span className="tabular-nums text-slate-500">
                    {osProg.checked}/{osProg.total}
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {checklistItems.map((it) => {
                    const ok = Boolean(shipment.dokumenOs?.items?.[it]);
                    return (
                      <li key={it} className="flex items-center gap-2">
                        {ok ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        )}
                        <span className={ok ? 'text-slate-900' : 'text-slate-400'}>{it}</span>
                      </li>
                    );
                  })}
                </ul>
                {shipment.dokumenOs?.catatan && (
                  <p className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                    Catatan: {shipment.dokumenOs.catatan}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Daftar Kontainer */}
          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B2545] border-b border-slate-200 pb-1.5">
              <Package className="w-3.5 h-3.5" />
              <span>Daftar Kontainer ({containers.length})</span>
            </h3>
            {containers.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada nomor kontainer terdaftar.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {containers.map((c) => (
                  <div
                    key={c.id}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800 font-mono-code"
                  >
                    {c.noCont} · {c.ukuranTipe || '-'}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Dokumen Scan (Google Drive) */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B2545] border-b border-slate-200 pb-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              <span>Dokumen Scan Google Drive ({documents.length})</span>
            </h3>
            {documents.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada dokumen scan diunggah.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">
                        {doc.jenisDokumen} — {doc.namaFile}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Diupload oleh {doc.user} · {doc.waktuUpload.slice(0, 16).replace('T', ' ')}
                      </div>
                    </div>
                    <a
                      href={doc.linkDrive}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#F28C28] hover:underline shrink-0"
                    >
                      <span>Buka Drive</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
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
                  className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
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
                  onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name || '')}
                  className="text-xs text-slate-600 flex-1 min-w-[160px]"
                />
                <button
                  type="submit"
                  disabled={!selectedFileName || busy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B2545] hover:bg-[#133863] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>
              </form>
            )}
          </section>

          {/* Catatan / Komentar */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B2545] border-b border-slate-200 pb-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Catatan &amp; Komentar ({comments.length})</span>
            </h3>
            {comments.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada catatan pada shipment ini.</p>
            ) : (
              <div className="space-y-2">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span className="font-semibold text-slate-800">{c.user}</span>
                      <span>{c.waktu.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <p className="text-slate-700">{c.isi}</p>
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
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#F28C28]"
                />
                <button
                  type="submit"
                  disabled={!noteText.trim() || busy}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim</span>
                </button>
              </form>
            )}
          </section>

          {/* Riwayat Perubahan */}
          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B2545] border-b border-slate-200 pb-1.5">
              <History className="w-3.5 h-3.5" />
              <span>Riwayat Perubahan ({logs.length})</span>
            </h3>
            {logs.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada riwayat perubahan.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {logs.map((l) => (
                  <div
                    key={l.id}
                    className="text-[11px] text-slate-600 py-1.5 border-b border-slate-100"
                  >
                    <span className="tabular-nums text-slate-400">
                      {l.waktu.slice(0, 16).replace('T', ' ')}
                    </span>{' '}
                    · <strong className="text-slate-800">{l.user}</strong> mengubah{' '}
                    <span className="font-mono-code text-[#0B2545]">{l.kolom}</span>:{' '}
                    <span className="line-through text-slate-400">{l.nilaiLama || '-'}</span> &rarr;{' '}
                    <span className="font-medium text-slate-800">{l.nilaiBaru || '-'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
