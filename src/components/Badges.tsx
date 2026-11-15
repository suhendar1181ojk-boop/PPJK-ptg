import type {
  JalurType,
  Shipment,
  StatusDokumenType,
  StatusDoPelayaranType,
  StatusGateOutType,
  StatusGatePassType,
  StatusPenagihanType,
  StatusSuratJalanType,
} from '../types/ppjk';
import {
  getCountdownBadgeMeta,
  getDoValidityMeta,
  getJalurBadgeStyle,
  getShipmentProcessSignal,
  getStatusBadgeClass,
  getStatusDokumenBadgeMeta,
  getStatusDoPelayaranMeta,
  getStatusGateOutMeta,
  getStatusGatePassMeta,
  getStatusPenagihanMeta,
  getStatusSuratJalanMeta,
  getStatusTruckingMeta,
} from '../utils/ppjkLogic';

export function CountdownBadge({ days }: { days: number | null }) {
  const meta = getCountdownBadgeMeta(days);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap tabular-nums ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
    >
      {meta.label}
    </span>
  );
}

export function JalurBadge({ jalur }: { jalur: JalurType | string }) {
  const style = getJalurBadgeStyle(jalur);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${style.bgClass} ${style.textClass}`}
    >
      {style.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls = getStatusBadgeClass(status);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap ${cls}`}
    >
      {status || 'Dokumen Diterima'}
    </span>
  );
}

export function StatusDokumenBadge({
  statusDokumen,
  onToggle,
}: {
  statusDokumen?: StatusDokumenType | string;
  onToggle?: (nextStatus: StatusDokumenType) => void;
}) {
  const meta = getStatusDokumenBadgeMeta(statusDokumen);
  const nextStatus: StatusDokumenType = meta.value === 'Ready' ? 'Draft' : 'Ready';

  if (onToggle) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(nextStatus);
        }}
        title={`${meta.description} — Klik untuk ubah ke ${nextStatus}`}
        aria-label={`Status dokumen ${meta.label}. Klik untuk ubah ke ${nextStatus}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap cursor-pointer transition-shadow hover:ring-2 hover:ring-offset-1 dark:hover:ring-offset-[#131926] ${
          meta.value === 'Ready'
            ? 'hover:ring-emerald-300 dark:hover:ring-emerald-500/50'
            : 'hover:ring-yellow-300 dark:hover:ring-yellow-400/50'
        } ${meta.bgClass} ${meta.textClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
        <span>{meta.label}</span>
      </button>
    );
  }

  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${meta.bgClass} ${meta.textClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
      <span>{meta.label}</span>
    </span>
  );
}

export function ProcessSignalBadge({
  shipment,
  compact = false,
}: {
  shipment: Shipment;
  compact?: boolean;
}) {
  const signal = getShipmentProcessSignal(shipment);
  if (!signal.active) return null;

  return (
    <span
      title={signal.detailLabel}
      data-testid="process-signal-badge"
      className={`inline-flex items-center gap-1.5 rounded-md font-bold border whitespace-nowrap bg-red-100 border-red-300 text-red-800 dark:bg-red-500/15 dark:border-red-500/45 dark:text-red-300 ${
        compact ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 dark:bg-red-400" />
      </span>
      <span>
        {compact ? `Segera Proses · ${signal.shortLabel}` : signal.detailLabel}
      </span>
    </span>
  );
}

export function StatusDoBadge({
  statusDo,
  onToggle,
}: {
  statusDo?: StatusDoPelayaranType | string;
  onToggle?: (nextStatus: StatusDoPelayaranType) => void;
}) {
  const meta = getStatusDoPelayaranMeta(statusDo);
  const nextStatus: StatusDoPelayaranType = meta.value === 'Sedia' ? 'Belum' : 'Sedia';

  if (onToggle) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(nextStatus);
        }}
        title={`${meta.description} — Klik untuk ubah ke ${nextStatus}`}
        aria-label={`Status D/O Pelayaran ${meta.label}. Klik untuk ubah ke ${nextStatus}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap cursor-pointer transition-shadow hover:ring-2 hover:ring-offset-1 dark:hover:ring-offset-[#131926] ${
          meta.value === 'Sedia'
            ? 'hover:ring-emerald-300 dark:hover:ring-emerald-500/50'
            : 'hover:ring-amber-300 dark:hover:ring-amber-400/50'
        } ${meta.bgClass} ${meta.textClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
        <span>{meta.label}</span>
      </button>
    );
  }

  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${meta.bgClass} ${meta.textClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
      <span>{meta.label}</span>
    </span>
  );
}

export function DoValidityBadge({
  doBerlakuSampai,
  shipmentStatus,
}: {
  doBerlakuSampai?: string | null;
  shipmentStatus?: string | null;
}) {
  const meta = getDoValidityMeta(doBerlakuSampai, shipmentStatus);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border leading-snug tabular-nums ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  );
}

export function StatusGatePassBadge({
  statusGatePass,
  onToggle,
}: {
  statusGatePass?: StatusGatePassType | string;
  onToggle?: (nextStatus: StatusGatePassType) => void;
}) {
  const meta = getStatusGatePassMeta(statusGatePass);
  const nextStatus: StatusGatePassType =
    meta.value === 'Belum' ? 'Proses' : meta.value === 'Proses' ? 'Sedia' : 'Belum';

  if (onToggle) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(nextStatus);
        }}
        title={`${meta.description} — Klik untuk ubah ke ${nextStatus}`}
        aria-label={`Status Eslah / TILA ${meta.label}. Klik untuk ubah ke ${nextStatus}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap cursor-pointer transition-shadow hover:ring-2 hover:ring-offset-1 dark:hover:ring-offset-[#131926] ${
          meta.value === 'Sedia'
            ? 'hover:ring-emerald-300 dark:hover:ring-emerald-500/50'
            : meta.value === 'Proses'
              ? 'hover:ring-sky-300 dark:hover:ring-sky-400/50'
              : 'hover:ring-amber-300 dark:hover:ring-amber-400/50'
        } ${meta.bgClass} ${meta.textClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
        <span>{meta.label}</span>
      </button>
    );
  }

  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${meta.bgClass} ${meta.textClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
      <span>{meta.label}</span>
    </span>
  );
}

export function StatusTruckingBadge({
  statusTrucking,
  onToggle,
}: {
  statusTrucking?: StatusDoPelayaranType | string;
  onToggle?: (nextStatus: StatusDoPelayaranType) => void;
}) {
  const meta = getStatusTruckingMeta(statusTrucking);
  const nextStatus: StatusDoPelayaranType = meta.value === 'Sedia' ? 'Belum' : 'Sedia';

  if (onToggle) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(nextStatus);
        }}
        title={`${meta.description} — Klik untuk ubah ke ${nextStatus}`}
        aria-label={`Kesediaan Trucking ${meta.label}. Klik untuk ubah ke ${nextStatus}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap cursor-pointer transition-shadow hover:ring-2 hover:ring-offset-1 dark:hover:ring-offset-[#131926] ${
          meta.value === 'Sedia'
            ? 'hover:ring-emerald-300 dark:hover:ring-emerald-500/50'
            : 'hover:ring-amber-300 dark:hover:ring-amber-400/50'
        } ${meta.bgClass} ${meta.textClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
        <span>{meta.label}</span>
      </button>
    );
  }

  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${meta.bgClass} ${meta.textClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
      <span>{meta.label}</span>
    </span>
  );
}

export function StatusGateOutBadge({
  gateOutStatus,
  shipmentStatus,
  onToggle,
}: {
  gateOutStatus?: StatusGateOutType | string;
  shipmentStatus?: string;
  onToggle?: (nextStatus: StatusGateOutType) => void;
}) {
  const meta = getStatusGateOutMeta(gateOutStatus, shipmentStatus);
  const nextStatus: StatusGateOutType = meta.value === 'Sudah' ? 'Belum' : 'Sudah';

  if (onToggle) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(nextStatus);
        }}
        title={`${meta.description} — Klik untuk ubah ke ${nextStatus === 'Sudah' ? 'Sudah Gate-Out (Selesai)' : 'Belum Gate-Out'}`}
        aria-label={`Status Gate-Out ${meta.label}. Klik untuk ubah ke ${nextStatus}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap cursor-pointer transition-shadow hover:ring-2 hover:ring-offset-1 dark:hover:ring-offset-[#131926] ${
          meta.value === 'Sudah'
            ? 'hover:ring-emerald-300 dark:hover:ring-emerald-500/50'
            : 'hover:ring-slate-300 dark:hover:ring-slate-500/50'
        } ${meta.bgClass} ${meta.textClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
        <span>{meta.label}</span>
      </button>
    );
  }

  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${meta.bgClass} ${meta.textClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
      <span>{meta.label}</span>
    </span>
  );
}

export function StatusSuratJalanBadge({
  suratJalanStatus,
  gateOutStatus,
  shipmentStatus,
  onToggle,
}: {
  suratJalanStatus?: StatusSuratJalanType | string;
  gateOutStatus?: StatusGateOutType | string;
  shipmentStatus?: string;
  onToggle?: (nextStatus: StatusSuratJalanType) => void;
}) {
  const meta = getStatusSuratJalanMeta(suratJalanStatus, gateOutStatus, shipmentStatus);
  const nextStatus: StatusSuratJalanType =
    meta.value === 'Terbit'
      ? 'Dalam Pengiriman'
      : meta.value === 'Dalam Pengiriman'
        ? 'Tiba di Tujuan'
        : 'Terbit';

  if (onToggle && meta.value !== 'Belum') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(nextStatus);
        }}
        title={`${meta.description} — Klik untuk lanjut ke ${nextStatus}`}
        aria-label={`Status Surat Jalan ${meta.label}. Klik untuk ubah ke ${nextStatus}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap cursor-pointer transition-shadow hover:ring-2 hover:ring-offset-1 dark:hover:ring-offset-[#131926] ${
          meta.value === 'Tiba di Tujuan'
            ? 'hover:ring-emerald-300 dark:hover:ring-emerald-500/50'
            : meta.value === 'Dalam Pengiriman'
              ? 'hover:ring-amber-300 dark:hover:ring-amber-400/50'
              : 'hover:ring-sky-300 dark:hover:ring-sky-400/50'
        } ${meta.bgClass} ${meta.textClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
        <span>{meta.label}</span>
      </button>
    );
  }

  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${meta.bgClass} ${meta.textClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
      <span>{meta.label}</span>
    </span>
  );
}

export function StatusPenagihanBadge({
  billingStatus,
  shipment,
  onClick,
}: {
  billingStatus?: StatusPenagihanType | string;
  shipment?: Shipment;
  onClick?: () => void;
}) {
  const meta = getStatusPenagihanMeta(billingStatus, shipment);

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title={`${meta.description} — Klik untuk kelola Info Owner & Surat Penagihan`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap cursor-pointer transition-shadow hover:ring-2 hover:ring-offset-1 dark:hover:ring-offset-[#131926] hover:ring-violet-400/60 ${meta.bgClass} ${meta.textClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
        <span>{meta.label}</span>
      </button>
    );
  }

  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${meta.bgClass} ${meta.textClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
      <span>{meta.label}</span>
    </span>
  );
}

