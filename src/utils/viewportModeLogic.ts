export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export const VIEWPORT_MODE_STORAGE_KEY = 'ptg_ppjk_viewport_mode_v1';

export interface ViewportModeConfig {
  mode: ViewportMode;
  label: string;
  shortLabel: string;
  compactLabel: string;
  targetWidthPx: number;
  widthLabel: string;
  usesDrawerSidebar: boolean;
  description: string;
}

export const VIEWPORT_MODE_ORDER: readonly ViewportMode[] = ['desktop', 'tablet', 'mobile'];

export const VIEWPORT_MODE_CONFIGS: Record<ViewportMode, ViewportModeConfig> = {
  desktop: {
    mode: 'desktop',
    label: 'Desktop',
    shortLabel: 'Desktop',
    compactLabel: 'Desktop',
    targetWidthPx: 1440,
    widthLabel: 'Layar Penuh',
    usesDrawerSidebar: false,
    description: 'Tampilan penuh desktop dengan sidebar permanen dan tabel lengkap.',
  },
  tablet: {
    mode: 'tablet',
    label: 'Tab',
    shortLabel: 'Tab',
    compactLabel: 'Tab',
    targetWidthPx: 820,
    widthLabel: '820px',
    usesDrawerSidebar: true,
    description: 'Tampilan tablet (820px) dengan navigasi drawer dan grid 2 kolom.',
  },
  mobile: {
    mode: 'mobile',
    label: 'Mobile (HP)',
    shortLabel: 'HP',
    compactLabel: 'Mobile (HP)',
    targetWidthPx: 412,
    widthLabel: '412px',
    usesDrawerSidebar: true,
    description: 'Tampilan ponsel (412px) dengan kartu ringkas 1 kolom dan menu lipat.',
  },
};

export function isValidViewportMode(value: unknown): value is ViewportMode {
  return value === 'desktop' || value === 'tablet' || value === 'mobile';
}

export function detectDefaultViewportMode(innerWidth?: number): ViewportMode {
  if (typeof innerWidth !== 'number' || !Number.isFinite(innerWidth) || innerWidth <= 0) {
    return 'desktop';
  }
  if (innerWidth < 640) return 'mobile';
  if (innerWidth < 1024) return 'tablet';
  return 'desktop';
}

export function parseStoredViewportMode(
  raw: string | null | undefined,
  fallbackInnerWidth?: number
): ViewportMode {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (isValidViewportMode(trimmed)) {
      return trimmed;
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isValidViewportMode(parsed)) {
        return parsed;
      }
    } catch {
      // fall through to width detection
    }
  }
  return detectDefaultViewportMode(fallbackInnerWidth);
}

export function serializeViewportMode(mode: ViewportMode): string {
  return mode;
}

export function getViewportModeConfig(mode: ViewportMode): ViewportModeConfig {
  return VIEWPORT_MODE_CONFIGS[mode];
}

export function getNextViewportMode(mode: ViewportMode): ViewportMode {
  const idx = VIEWPORT_MODE_ORDER.indexOf(mode);
  return VIEWPORT_MODE_ORDER[(idx + 1) % VIEWPORT_MODE_ORDER.length];
}
