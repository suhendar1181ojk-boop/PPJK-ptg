import {
  buildDynamicManifestPayload,
  computeBrandingLogoHash,
  DEFAULT_APP_DESCRIPTION,
  derivePwaShortName,
  generateAppBrandingIconSet,
  type BrandingIconSet,
  type ServerBrandingStatus,
} from '../utils/appBrandingIcons';

let activeManifestBlobUrl: string | null = null;
let lastSyncedServerSignature = '';
let lastAppliedHeadSignature = '';

function upsertHeadLink(id: string, rel: string, href: string, type?: string): void {
  if (typeof document === 'undefined' || !document.head) return;
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  }
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = rel;
    document.head.appendChild(link);
  }
  if (link.id !== id) link.id = id;
  link.rel = rel;
  if (type) {
    link.type = type;
  } else {
    link.removeAttribute('type');
  }
  link.href = href;
}

function upsertMetaContent(name: string, content: string): void {
  if (typeof document === 'undefined' || !document.head) return;
  let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function updateManifestLinkToUrl(manifestHref: string): void {
  if (typeof document === 'undefined' || !document.head) return;
  let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  if (activeManifestBlobUrl && manifestHref !== activeManifestBlobUrl) {
    URL.revokeObjectURL(activeManifestBlobUrl);
    activeManifestBlobUrl = null;
  }
  link.href = manifestHref;
}

export async function applyBrandingToDocumentHead(params: {
  logoDataUrl: string;
  brandName?: string;
  tagline?: string;
  companyName?: string;
  serverVersion?: string;
  precomputedIcons?: BrandingIconSet | null;
}): Promise<BrandingIconSet | null> {
  if (typeof document === 'undefined') return null;

  const cleanLogo = (params.logoDataUrl || '').trim();
  const brandName = (params.brandName || '').trim() || 'PTG PPJK';
  const companyName = (params.companyName || '').trim() || 'PT PTG Logistik Kepabeanan';
  const tagline = (params.tagline || '').trim();
  const shortName = derivePwaShortName(brandName);

  document.title = `${brandName} — ${companyName}`;
  upsertMetaContent('apple-mobile-web-app-title', shortName);
  upsertMetaContent('application-name', shortName);

  const sig = `${computeBrandingLogoHash(cleanLogo, `${brandName}|${companyName}|${tagline}`)}:${params.serverVersion || ''}`;
  if (sig === lastAppliedHeadSignature && !params.precomputedIcons) {
    return null;
  }

  if (!cleanLogo) {
    upsertHeadLink('app-favicon-png', 'icon', '/pwa-192x192.png', 'image/png');
    upsertHeadLink('app-apple-touch-icon', 'apple-touch-icon', '/apple-touch-icon.png');
    updateManifestLinkToUrl('/manifest.webmanifest');
    lastAppliedHeadSignature = sig;
    return null;
  }

  const icons = params.precomputedIcons || (await generateAppBrandingIconSet(cleanLogo));
  const version = (params.serverVersion || '').trim();

  // Live favicon uses immediate PNG dataUrl so the browser tab updates instantaneously
  upsertHeadLink('app-favicon-png', 'icon', icons.favicon64, 'image/png');

  if (version) {
    upsertHeadLink(
      'app-apple-touch-icon',
      'apple-touch-icon',
      `/apple-touch-icon.png?v=${encodeURIComponent(version)}`
    );
    updateManifestLinkToUrl(`/manifest.webmanifest?v=${encodeURIComponent(version)}`);
  } else {
    upsertHeadLink('app-apple-touch-icon', 'apple-touch-icon', icons.appleTouch180);
    const manifestObj = buildDynamicManifestPayload({
      name: brandName,
      shortName,
      description: tagline || DEFAULT_APP_DESCRIPTION,
      iconUrls: {
        pwa192: icons.pwa192,
        pwa512: icons.pwa512,
        maskable512: icons.maskable512,
      },
    });
    const blob = new Blob([JSON.stringify(manifestObj)], { type: 'application/manifest+json' });
    const blobUrl = URL.createObjectURL(blob);
    if (activeManifestBlobUrl) {
      URL.revokeObjectURL(activeManifestBlobUrl);
    }
    activeManifestBlobUrl = blobUrl;
    updateManifestLinkToUrl(blobUrl);
  }

  lastAppliedHeadSignature = sig;
  return icons;
}

export async function fetchServerBrandingStatus(): Promise<ServerBrandingStatus | null> {
  if (typeof fetch === 'undefined') return null;
  try {
    const res = await fetch('/api/branding/status', {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ServerBrandingStatus;
    if (!data || typeof data.hasCustomLogo !== 'boolean') return null;
    return data;
  } catch {
    return null;
  }
}

export async function syncBrandingToServerAndHead(params: {
  logoDataUrl: string;
  brandName?: string;
  tagline?: string;
  companyName?: string;
  forceServerSync?: boolean;
}): Promise<{ synced: boolean; version: string }> {
  const cleanLogo = (params.logoDataUrl || '').trim();
  const brandName = (params.brandName || '').trim() || 'PTG PPJK';
  const companyName = (params.companyName || '').trim() || 'PT PTG Logistik Kepabeanan';
  const tagline = (params.tagline || '').trim();
  const shortName = derivePwaShortName(brandName);

  const signature = computeBrandingLogoHash(cleanLogo, `${brandName}|${tagline}|${companyName}`);

  if (!cleanLogo) {
    let synced = false;
    if (params.forceServerSync || (lastSyncedServerSignature && lastSyncedServerSignature !== signature)) {
      try {
        const res = await fetch('/api/branding/logo', { method: 'DELETE' });
        if (res.ok) {
          synced = true;
          lastSyncedServerSignature = signature;
        }
      } catch {
        // Offline mode: fallback head reset still applies
      }
    }
    await applyBrandingToDocumentHead({
      logoDataUrl: '',
      brandName,
      tagline,
      companyName,
    });
    return { synced, version: '' };
  }

  const icons = await generateAppBrandingIconSet(cleanLogo);

  // Immediately update browser tab favicon & head icons even before network resolves
  await applyBrandingToDocumentHead({
    logoDataUrl: cleanLogo,
    brandName,
    tagline,
    companyName,
    precomputedIcons: icons,
  });

  if (!params.forceServerSync && lastSyncedServerSignature === signature) {
    return { synced: true, version: signature };
  }

  try {
    const res = await fetch('/api/branding/logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandName,
        shortName,
        description: tagline || DEFAULT_APP_DESCRIPTION,
        companyName,
        logoDataUrl: cleanLogo,
        icons,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { ok?: boolean; version?: string };
      const version = json.version || signature;
      lastSyncedServerSignature = signature;
      await applyBrandingToDocumentHead({
        logoDataUrl: cleanLogo,
        brandName,
        tagline,
        companyName,
        serverVersion: version,
        precomputedIcons: icons,
      });
      return { synced: true, version };
    }
  } catch {
    // Offline fallback already applied in document head
  }

  return { synced: false, version: '' };
}
