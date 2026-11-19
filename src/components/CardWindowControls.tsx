import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useCardCollapse } from '../contexts/CardCollapseContext';

interface CardWindowToggleButtonProps {
  cardId: string;
  label: string;
  compact?: boolean;
  className?: string;
}

export function CardWindowToggleButton({
  cardId,
  label,
  compact = false,
  className = '',
}: CardWindowToggleButtonProps) {
  const { isCollapsed, toggleCard } = useCardCollapse();
  const collapsed = isCollapsed(cardId);
  const actionLabel = collapsed ? `Perbesar jendela ${label}` : `Perkecil jendela ${label}`;

  return (
    <button
      type="button"
      data-testid={`card-window-toggle-${cardId}`}
      aria-label={actionLabel}
      aria-expanded={!collapsed}
      title={collapsed ? 'Perbesar Jendela Kartu' : 'Perkecil Jendela Kartu'}
      onClick={(e) => {
        e.stopPropagation();
        toggleCard(cardId);
      }}
      className={`inline-flex items-center justify-center gap-1 rounded-lg border transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] dark:focus-visible:ring-violet-400 ${
        compact ? 'w-7 h-7' : 'h-7 px-2'
      } ${
        collapsed
          ? 'bg-[#0B2545]/8 dark:bg-violet-500/20 border-[#0B2545]/20 dark:border-violet-400/40 text-[#0B2545] dark:text-violet-200 hover:bg-[#0B2545]/15 dark:hover:bg-violet-500/30'
          : 'bg-slate-100/90 dark:bg-white/[0.06] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/[0.12] hover:text-slate-900 dark:hover:text-white'
      } ${className}`}
    >
      {collapsed ? (
        <Maximize2 className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <Minimize2 className="w-3.5 h-3.5 shrink-0" />
      )}
      {!compact && (
        <span className="hidden sm:inline text-[10.5px] font-semibold leading-none">
          {collapsed ? 'Perbesar' : 'Perkecil'}
        </span>
      )}
    </button>
  );
}

interface ModuleCardBatchToggleProps {
  cardIds: readonly string[];
  moduleName?: string;
  className?: string;
}

export function ModuleCardBatchToggle({
  cardIds,
  moduleName,
  className = '',
}: ModuleCardBatchToggleProps) {
  const { areAllCollapsed, countCollapsed, setMultipleCollapsed } = useCardCollapse();
  const collapsedCount = countCollapsed(cardIds);
  const allCollapsed = areAllCollapsed(cardIds);
  const targetCollapse = !allCollapsed;

  return (
    <button
      type="button"
      data-testid={
        moduleName
          ? `module-batch-collapse-${moduleName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
          : 'module-batch-collapse'
      }
      onClick={() => setMultipleCollapsed(cardIds, targetCollapse)}
      title={
        allCollapsed
          ? 'Perluas kembali semua jendela kartu pada modul ini'
          : 'Perkecil semua jendela kartu pada modul ini agar tampilan lebih ringkas'
      }
      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[11px] font-semibold transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] dark:focus-visible:ring-violet-400 ${
        collapsedCount > 0
          ? 'bg-[#0B2545]/8 dark:bg-violet-500/15 border-[#0B2545]/25 dark:border-violet-400/35 text-[#0B2545] dark:text-violet-200 hover:bg-[#0B2545]/15 dark:hover:bg-violet-500/25'
          : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#182032]'
      } ${className}`}
    >
      {allCollapsed ? (
        <Maximize2 className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <Minimize2 className="w-3.5 h-3.5 shrink-0" />
      )}
      <span className="whitespace-nowrap">
        {allCollapsed
          ? 'Perluas Semua Kartu'
          : collapsedCount > 0
            ? `Perkecil Semua (${collapsedCount} mengecil)`
            : 'Perkecil Semua Kartu'}
      </span>
    </button>
  );
}
