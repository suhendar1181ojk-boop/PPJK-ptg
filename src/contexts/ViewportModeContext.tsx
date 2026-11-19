import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  VIEWPORT_MODE_CONFIGS,
  VIEWPORT_MODE_STORAGE_KEY,
  type ViewportMode,
  type ViewportModeConfig,
  detectDefaultViewportMode,
  parseStoredViewportMode,
  serializeViewportMode,
} from '../utils/viewportModeLogic';

interface ViewportModeContextValue {
  viewportMode: ViewportMode;
  config: ViewportModeConfig;
  setViewportMode: (mode: ViewportMode) => void;
  resetToAutoViewportMode: () => void;
}

const defaultMode: ViewportMode = 'desktop';

const fallbackContext: ViewportModeContextValue = {
  viewportMode: defaultMode,
  config: VIEWPORT_MODE_CONFIGS[defaultMode],
  setViewportMode: () => {},
  resetToAutoViewportMode: () => {},
};

const ViewportModeContext = createContext<ViewportModeContextValue>(fallbackContext);

function readInitialViewportMode(): ViewportMode {
  if (typeof window === 'undefined') return 'desktop';
  try {
    return parseStoredViewportMode(
      window.localStorage.getItem(VIEWPORT_MODE_STORAGE_KEY),
      window.innerWidth
    );
  } catch {
    return detectDefaultViewportMode(window.innerWidth);
  }
}

export function ViewportModeProvider({ children }: { children: React.ReactNode }) {
  const [viewportMode, setViewportModeState] = useState<ViewportMode>(readInitialViewportMode);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-viewport-mode', viewportMode);
    }
    try {
      window.localStorage.setItem(
        VIEWPORT_MODE_STORAGE_KEY,
        serializeViewportMode(viewportMode)
      );
    } catch {
      // ignore storage quota failure
    }
    // Trigger resize event after layout settles so Chart.js and responsive observers recalibrate cleanly
    const raf = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
    return () => window.cancelAnimationFrame(raf);
  }, [viewportMode]);

  const setViewportMode = useCallback((mode: ViewportMode) => {
    setViewportModeState(mode);
  }, []);

  const resetToAutoViewportMode = useCallback(() => {
    try {
      window.localStorage.removeItem(VIEWPORT_MODE_STORAGE_KEY);
    } catch {
      // ignore
    }
    const autoMode =
      typeof window !== 'undefined' ? detectDefaultViewportMode(window.innerWidth) : 'desktop';
    setViewportModeState(autoMode);
  }, []);

  const value = useMemo<ViewportModeContextValue>(
    () => ({
      viewportMode,
      config: VIEWPORT_MODE_CONFIGS[viewportMode],
      setViewportMode,
      resetToAutoViewportMode,
    }),
    [viewportMode, setViewportMode, resetToAutoViewportMode]
  );

  return (
    <ViewportModeContext.Provider value={value}>{children}</ViewportModeContext.Provider>
  );
}

export function useViewportMode(): ViewportModeContextValue {
  return useContext(ViewportModeContext);
}
