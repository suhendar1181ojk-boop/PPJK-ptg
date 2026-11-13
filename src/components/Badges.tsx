import type { JalurType } from '../types/ppjk';
import {
  getCountdownBadgeMeta,
  getJalurBadgeStyle,
  getStatusBadgeClass,
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
