export interface BrandingIconSet {
  favicon64: string;
  appleTouch180: string;
  pwa192: string;
  pwa512: string;
  maskable512: string;
}

export interface ServerBrandingStatus {
  ok?: boolean;
  hasCustomLogo: boolean;
  version: string;
  brandName: string;
  shortName: string;
  description: string;
  logoDataUrl: string;
  updatedAt?: string;
}

export interface WebAppManifestIconEntry {
  src: string;
  sizes: string;
  type: 'image/png';
  purpose: 'any' | 'maskable';
}

export interface WebAppManifestPayload {
  id: string;
  name: string;
  short_name: string;
  description: string;
  theme_color: string;
  background_color: string;
  display: 'standalone';
  start_url: string;
  scope: string;
  icons: WebAppManifestIconEntry[];
}

export const DEFAULT_APP_NAME = 'PTG PPJK';
export const DEFAULT_APP_DESCRIPTION =
  'Aplikasi offline-first & PWA monitoring dokumen impor PTG PPJK dengan penyimpanan IndexedDB dan sinkronisasi database.';

/**
 * PWA specification recommends short_name <= 12 characters so home screen labels are not truncated.
 */
export function derivePwaShortName(brandName?: string | null): string {
  const cleaned = (brandName || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return DEFAULT_APP_NAME;
  if (cleaned.length <= 12) return cleaned;
  return cleaned.slice(0, 12).trim() || DEFAULT_APP_NAME;
}

/**
 * Deterministic fast FNV-1a 32-bit hex hash for cache-busting icon/manifest URLs.
 */
export function computeBrandingLogoHash(logoDataUrl: string, brandName = ''): string {
  const input = `${brandName.trim()}::${logoDataUrl.trim()}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function parsePngDataUrlToBase64(dataUrl: unknown): string | null {
  if (typeof dataUrl !== 'string') return null;
  const trimmed = dataUrl.trim();
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(trimmed);
  if (!match || !match[1]) return null;
  return match[1];
}

export function buildDynamicManifestPayload(params: {
  name?: string;
  shortName?: string;
  description?: string;
  themeColor?: string;
  backgroundColor?: string;
  iconUrls: {
    pwa192: string;
    pwa512: string;
    maskable512: string;
  };
}): WebAppManifestPayload {
  const cleanName = (params.name || '').trim() || DEFAULT_APP_NAME;
  const cleanShort = derivePwaShortName(params.shortName || cleanName);
  const cleanDescription = (params.description || '').trim() || DEFAULT_APP_DESCRIPTION;
  return {
    id: '/',
    name: cleanName,
    short_name: cleanShort,
    description: cleanDescription,
    theme_color: params.themeColor || '#0B2545',
    background_color: params.backgroundColor || '#090C15',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    icons: [
      {
        src: params.iconUrls.pwa192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: params.iconUrls.pwa512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: params.iconUrls.maskable512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

function renderSquareIconPng(
  img: HTMLImageElement,
  size: number,
  options: { background?: string; paddingRatio: number }
): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D tidak tersedia di browser.');
  }

  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.clearRect(0, 0, size, size);
  }

  const pad = Math.round(size * Math.max(0, Math.min(0.35, options.paddingRatio)));
  const maxBox = Math.max(1, size - pad * 2);
  const srcW = Math.max(1, img.naturalWidth || img.width || 1);
  const srcH = Math.max(1, img.naturalHeight || img.height || 1);
  const scale = Math.min(maxBox / srcW, maxBox / srcH);
  const drawW = Math.max(1, Math.round(srcW * scale));
  const drawH = Math.max(1, Math.round(srcH * scale));
  const dx = Math.round((size - drawW) / 2);
  const dy = Math.round((size - drawH) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, drawW, drawH);

  return canvas.toDataURL('image/png');
}

export async function generateAppBrandingIconSet(logoDataUrl: string): Promise<BrandingIconSet> {
  if (!logoDataUrl || typeof document === 'undefined') {
    throw new Error('Logo data URL tidak valid.');
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Gagal merender gambar Logo PT untuk ikon aplikasi.'));
    el.src = logoDataUrl;
  });

  return {
    favicon64: renderSquareIconPng(img, 64, { paddingRatio: 0.06 }),
    appleTouch180: renderSquareIconPng(img, 180, {
      background: '#FFFFFF',
      paddingRatio: 0.12,
    }),
    pwa192: renderSquareIconPng(img, 192, {
      background: '#FFFFFF',
      paddingRatio: 0.10,
    }),
    pwa512: renderSquareIconPng(img, 512, {
      background: '#FFFFFF',
      paddingRatio: 0.10,
    }),
    maskable512: renderSquareIconPng(img, 512, {
      background: '#FFFFFF',
      paddingRatio: 0.16,
    }),
  };
}
