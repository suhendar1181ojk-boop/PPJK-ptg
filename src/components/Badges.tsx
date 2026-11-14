import type { JalurType, StatusDokumenType } from '../types/ppjk';
import {
  getCountdownBadgeMeta,
  getJalurBadgeStyle,
  getStatusBadgeClass,
  getStatusDokumenBadgeMeta,
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
}: {
  statusDokumen?: StatusDokumenType | string;
}) {
  const meta = getStatusDokumenBadgeMeta(statusDokumen);
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
