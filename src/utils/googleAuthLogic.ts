export interface GoogleDriveConnectedAccount {
  email: string;
  displayName: string;
  photoUrl?: string;
  authMethod: 'firebase' | 'gis';
}

export interface GoogleAuthDomainStatus {
  currentHostname: string;
  currentOrigin: string;
  projectId: string;
  oAuthClientId: string;
  authorizedDomains: string[];
  isDomainAuthorizedInFirebase: boolean;
  checkedAt: string;
  checkError?: string;
}

export interface ClassifiedGoogleAuthError {
  code: string;
  isUnauthorizedDomain: boolean;
  isPopupBlocked: boolean;
  isPopupClosed: boolean;
  isNetworkError: boolean;
  rawMessage: string;
}

export interface UnauthorizedDomainHelp {
  title: string;
  summary: string;
  currentHostname: string;
  currentOrigin: string;
  projectId: string;
  oAuthClientId: string;
  authorizedDomains: string[];
  preferredAppUrls: string[];
  firebaseConsoleUrl: string;
  gcpCredentialsUrl: string;
  steps: string[];
  gisFallbackError?: string;
}

export class GoogleAuthDomainError extends Error {
  readonly code = 'auth/unauthorized-domain';
  readonly hostname: string;
  readonly origin: string;
  readonly projectId: string;
  readonly oAuthClientId: string;
  readonly authorizedDomains: string[];
  readonly gisFallbackError?: string;

  constructor(params: {
    hostname: string;
    origin: string;
    projectId: string;
    oAuthClientId: string;
    authorizedDomains: string[];
    gisFallbackError?: string;
  }) {
    const cleanHost = params.hostname || '(tidak diketahui)';
    const msg = `Domain "${cleanHost}" belum terdaftar di Authorized Domains Firebase (${params.projectId}).${
      params.gisFallbackError ? ` Fallback Google OAuth juga gagal: ${params.gisFallbackError}` : ''
    }`;
    super(msg);
    this.name = 'GoogleAuthDomainError';
    this.hostname = cleanHost;
    this.origin = params.origin || '';
    this.projectId = params.projectId;
    this.oAuthClientId = params.oAuthClientId;
    this.authorizedDomains = params.authorizedDomains;
    this.gisFallbackError = params.gisFallbackError;
  }
}

export function isHostnameInAuthorizedDomains(
  hostname: string,
  authorizedDomains: string[]
): boolean {
  const cleanHost = (hostname || '').trim().toLowerCase();
  if (!cleanHost) return false;

  for (const rawDomain of authorizedDomains) {
    const expected = (rawDomain || '').trim().toLowerCase();
    if (!expected) continue;
    if (cleanHost === expected) return true;
    // Firebase allows subdomains of an authorized domain (except raw IPs)
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(expected) || expected.includes(':');
    if (!isIp && cleanHost.endsWith(`.${expected}`)) {
      return true;
    }
  }
  return false;
}

export function classifyGoogleAuthError(err: unknown): ClassifiedGoogleAuthError {
  const errObj = err && typeof err === 'object' ? (err as { code?: unknown; message?: unknown }) : null;
  const codeProp = typeof errObj?.code === 'string' ? errObj.code : '';
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof errObj?.message === 'string'
      ? errObj.message
      : String(err || '');
  const lower = `${codeProp} ${rawMessage}`.toLowerCase();

  const isUnauthorizedDomain =
    err instanceof GoogleAuthDomainError ||
    codeProp === 'auth/unauthorized-domain' ||
    lower.includes('auth/unauthorized-domain') ||
    lower.includes('unauthorized-domain') ||
    lower.includes('origin_mismatch') ||
    lower.includes('idpiframe_initialization_failed');

  const isPopupBlocked =
    codeProp === 'auth/popup-blocked' ||
    lower.includes('auth/popup-blocked') ||
    lower.includes('popup_failed_to_open');

  const isPopupClosed =
    codeProp === 'auth/popup-closed-by-user' ||
    codeProp === 'auth/cancelled-popup-request' ||
    lower.includes('auth/popup-closed-by-user') ||
    lower.includes('auth/cancelled-popup-request') ||
    lower.includes('popup_closed');

  const isNetworkError =
    codeProp === 'auth/network-request-failed' ||
    lower.includes('auth/network-request-failed') ||
    lower.includes('network error') ||
    lower.includes('failed to fetch');

  const derivedCode =
    codeProp ||
    (isUnauthorizedDomain
      ? 'auth/unauthorized-domain'
      : isPopupBlocked
      ? 'auth/popup-blocked'
      : isPopupClosed
      ? 'auth/popup-closed-by-user'
      : isNetworkError
      ? 'auth/network-request-failed'
      : 'auth/unknown');

  return {
    code: derivedCode,
    isUnauthorizedDomain,
    isPopupBlocked,
    isPopupClosed,
    isNetworkError,
    rawMessage,
  };
}

export function buildGoogleUserFromDriveAbout(about: {
  emailAddress?: string;
  displayName?: string;
  photoLink?: string;
}): GoogleDriveConnectedAccount {
  const email = (about.emailAddress || '').trim();
  const displayName = (about.displayName || '').trim() || email || 'Akun Google';
  return {
    email: email || displayName,
    displayName,
    photoUrl: about.photoLink?.trim() || undefined,
    authMethod: 'gis',
  };
}

export function buildUnauthorizedDomainHelp(params: {
  currentHostname: string;
  currentOrigin: string;
  projectId: string;
  oAuthClientId?: string;
  authorizedDomains: string[];
  gisFallbackError?: string;
}): UnauthorizedDomainHelp {
  const cleanHost = (params.currentHostname || '').trim() || '(domain tidak terdeteksi)';
  const cleanOrigin = (params.currentOrigin || '').trim() || `https://${cleanHost}`;
  const cleanProject = (params.projectId || '').trim();
  const cleanClient = (params.oAuthClientId || '').trim();

  const preferredAppUrls = params.authorizedDomains
    .filter((d) => d && !d.endsWith('.firebaseapp.com') && !d.endsWith('.web.app'))
    .map((d) => `https://${d}`);

  const firebaseConsoleUrl = cleanProject
    ? `https://console.firebase.google.com/project/${encodeURIComponent(cleanProject)}/authentication/settings`
    : 'https://console.firebase.google.com/';

  const gcpCredentialsUrl = cleanProject
    ? `https://console.cloud.google.com/apis/credentials?project=${encodeURIComponent(cleanProject)}`
    : 'https://console.cloud.google.com/apis/credentials';

  const steps: string[] = [
    `Buka Firebase Console untuk project "${cleanProject || '-'}" → Authentication → Settings → Authorized domains, lalu klik "Add domain" dan masukkan: ${cleanHost}`,
    `Jika menggunakan Google Cloud OAuth Client (${cleanClient || 'OAuth Client ID'}), pastikan "${cleanOrigin}" juga ditambahkan pada Authorized JavaScript origins di menu APIs & Services → Credentials.`,
  ];

  if (preferredAppUrls.length > 0) {
    steps.push(
      `Atau buka langsung aplikasi melalui domain AI Studio yang sudah terotorisasi: ${preferredAppUrls[0]}`
    );
  }

  return {
    title: 'Domain Belum Terotorisasi untuk Login Google',
    summary: `Domain "${cleanHost}" belum terdaftar pada Authorized Domains Firebase project "${cleanProject}".`,
    currentHostname: cleanHost,
    currentOrigin: cleanOrigin,
    projectId: cleanProject,
    oAuthClientId: cleanClient,
    authorizedDomains: params.authorizedDomains,
    preferredAppUrls,
    firebaseConsoleUrl,
    gcpCredentialsUrl,
    steps,
    gisFallbackError: params.gisFallbackError,
  };
}
