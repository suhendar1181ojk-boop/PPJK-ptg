import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { useViewportMode } from '../contexts/ViewportModeContext';
import { VIEWPORT_MODE_CONFIGS, VIEWPORT_MODE_ORDER, type ViewportMode } from '../utils/viewportModeLogic';

const MODE_ICONS: Record<ViewportMode, typeof Monitor> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

interface ViewportModeSwitcherProps {
  className?: string;
}

export function ViewportModeSwitcher({ className = '' }: ViewportModeSwitcherProps) {
  const { viewportMode, config, setViewportMode } = useViewportMode();

  return (
    <div
      data-testid="viewport-mode-bar"
      className={`no-print border-b border-slate-200/80 dark:border-white/[0.06] bg-white/85 dark:bg-[#0D111C]/85 px-3 sm:px-6 py-2 flex items-center justify-between gap-2.5 ${className}`}
    >
      <div
        className={`items-center gap-2 text-xs text-slate-500 dark:text-slate-400 min-w-0 ${
          viewportMode === 'mobile' ? 'hidden' : 'hidden sm:flex'
        }`}
      >
        <span className="font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
          Mode Tampilan
        </span>
        <span aria-hidden="true">·</span>
        <span className="truncate text-slate-500 dark:text-slate-400">
          {config.label} ({config.widthLabel})
        </span>
      </div>

      <div
        role="group"
        aria-label="Pilih mode tampilan Desktop, Tab, atau Mobile (HP)"
        data-testid="viewport-mode-switcher"
        className={`inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#151B2B] border border-slate-200/90 dark:border-white/[0.08] gap-1 ${
          viewportMode === 'mobile' ? 'w-full justify-between' : 'w-full sm:w-auto justify-between sm:justify-start'
        }`}
      >
        {VIEWPORT_MODE_ORDER.map((mode) => {
          const item = VIEWPORT_MODE_CONFIGS[mode];
          const Icon = MODE_ICONS[mode];
          const isActive = viewportMode === mode;

          return (
            <button
              key={mode}
              type="button"
              onClick={() => setViewportMode(mode)}
              aria-pressed={isActive}
              aria-label={`Mode tampilan ${item.label}`}
              title={item.description}
              data-testid={`viewport-mode-${mode}`}
              className={`inline-flex items-center justify-center gap-1.5 min-h-[34px] px-2.5 sm:px-3 py-1.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                viewportMode === 'mobile' ? 'flex-1' : 'flex-1 sm:flex-initial'
              } ${
                isActive
                  ? 'bg-[#0B2545] text-white shadow-xs dark:bg-gradient-to-r dark:from-[#7C3AED] dark:to-[#6366F1] dark:text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-white/[0.06]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
