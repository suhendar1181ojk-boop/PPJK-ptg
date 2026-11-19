import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  buildGoogleUserFromDriveAbout,
  classifyGoogleAuthError,
  type GoogleAuthDomainStatus,
  GoogleAuthDomainError,
  type GoogleDriveConnectedAccount,
  isHostnameInAuthorizedDomains,
} from '../utils/googleAuthLogic';
import {
  buildDriveFolderUrl,
  DEFAULT_DRIVE_ROOT_FOLDER_NAME,
  extractDriveFolderIdFromInput,
  isValidEmailAddress,
  normalizeGmailAddress,
  sanitizeDriveDocPrefix,
} from '../utils/googleDriveFolderLogic';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
  'https://www.googleapis.com/auth/spreadsheets',
] as const;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({ prompt: 'select_account' });

interface GisTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GisClientError {
  type?: string;
  message?: string;
}

interface GisOAuth2Api {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GisTokenResponse) => void;
    error_callback?: (error: GisClientError) => void;
  }) => {
    requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
  };
  revoke?: (accessToken: string, done?: () => void) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GisOAuth2Api;
      };
    };
  }
}

// Token hanya disimpan di memori (tidak pernah disimpan di localStorage / sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;
let cachedAccount: GoogleDriveConnectedAccount | null = null;
let cachedDomainStatus: GoogleAuthDomainStatus | null = null;
let gisScriptPromise: Promise<void> | null = null;

interface AuthListenerEntry {
  onAuthSuccess?: (user: { email: string | null; displayName: string | null }, token: string) => void;
  onAuthNeedsSignIn?: (user: { email: string | null; displayName: string | null } | null) => void;
}
const authListeners = new Set<AuthListenerEntry>();

export interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

export function getFirebaseAuthConfigInfo() {
  return {
    projectId: firebaseConfig.projectId || '',
    authDomain: firebaseConfig.authDomain || '',
    apiKey: firebaseConfig.apiKey || '',
    oAuthClientId: firebaseConfig.oAuthClientId || '',
  };
}

export async function fetchFirebaseAuthorizedDomains(
  forceRefresh = false
): Promise<GoogleAuthDomainStatus> {
  const currentHostname =
    typeof window !== 'undefined' ? window.location.hostname : '';
  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';

  if (!forceRefresh && cachedDomainStatus && cachedDomainStatus.currentHostname === currentHostname) {
    return cachedDomainStatus;
  }

  const cfg = getFirebaseAuthConfigInfo();
  const baseStatus: GoogleAuthDomainStatus = {
    currentHostname,
    currentOrigin,
    projectId: cfg.projectId,
    oAuthClientId: cfg.oAuthClientId,
    authorizedDomains: [],
    isDomainAuthorizedInFirebase: false,
    checkedAt: new Date().toISOString(),
  };

  if (!cfg.apiKey) {
    return {
      ...baseStatus,
      checkError: 'Konfigurasi Firebase API Key tidak tersedia.',
    };
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(cfg.apiKey)}`
    );
    if (!res.ok) {
      return {
        ...baseStatus,
        checkError: `Gagal memeriksa domain terotorisasi (HTTP ${res.status}).`,
      };
    }
    const data = (await res.json()) as { authorizedDomains?: string[] };
    const domains = Array.isArray(data.authorizedDomains) ? data.authorizedDomains : [];
    const status: GoogleAuthDomainStatus = {
      ...baseStatus,
      authorizedDomains: domains,
      isDomainAuthorizedInFirebase: isHostnameInAuthorizedDomains(currentHostname, domains),
      checkedAt: new Date().toISOString(),
    };
    cachedDomainStatus = status;
    return status;
  } catch (err) {
    return {
      ...baseStatus,
      checkError: err instanceof Error ? err.message : 'Gagal menghubungi Firebase Auth.',
    };
  }
}

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Browser environment diperlukan untuk login Google.'));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gisScriptPromise) {
    return gisScriptPromise;
  }

  gisScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Gagal memuat Google Identity Services (gsi/client).')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisScriptPromise = null;
      reject(new Error('Gagal memuat skrip Google Identity Services (accounts.google.com/gsi/client).'));
    };
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

async function fetchDriveAboutAccount(
  accessToken: string
): Promise<GoogleDriveConnectedAccount> {
  try {
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink)',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        user?: { displayName?: string; emailAddress?: string; photoLink?: string };
      };
      if (data?.user) {
        return buildGoogleUserFromDriveAbout(data.user);
      }
    }
  } catch {
    // Fallback ke identitas generik bila endpoint /about dibatasi
  }
  return {
    email: 'Google Account Terhubung',
    displayName: 'Google Account Terhubung',
    authMethod: 'gis',
  };
}

async function signInWithGisFallback(): Promise<{
  account: GoogleDriveConnectedAccount;
  accessToken: string;
}> {
  const clientId = (firebaseConfig.oAuthClientId || '').trim();
  if (!clientId) {
    throw new Error('oAuthClientId belum dikonfigurasi pada firebase-applet-config.json.');
  }

  await loadGisScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google Identity Services OAuth2 API tidak tersedia di browser.');
  }

  const accessToken = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Waktu tunggu popup OAuth Google habis.'));
      }
    }, 90_000);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      fn();
    };

    try {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(' '),
        callback: (response: GisTokenResponse) => {
          if (response?.access_token) {
            finish(() => resolve(response.access_token!));
          } else {
            const errMsg = response?.error_description || response?.error || 'Token OAuth kosong.';
            finish(() => reject(new Error(errMsg)));
          }
        },
        error_callback: (err: GisClientError) => {
          const type = err?.type || 'gis_error';
          const msg = err?.message || type;
          finish(() => reject(Object.assign(new Error(msg), { code: type })));
        },
      });
      client.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      finish(() => reject(err));
    }
  });

  const account = await fetchDriveAboutAccount(accessToken);
  return { account, accessToken };
}

function notifyAuthSuccess(account: GoogleDriveConnectedAccount, token: string) {
  const userSummary = {
    email: account.email || null,
    displayName: account.displayName || null,
  };
  for (const listener of authListeners) {
    listener.onAuthSuccess?.(userSummary, token);
  }
}

function notifyAuthNeedsSignIn() {
  for (const listener of authListeners) {
    listener.onAuthNeedsSignIn?.(null);
  }
}

export function initGoogleDriveAuth(
  onAuthSuccess?: (user: { email: string | null; displayName: string | null }, token: string) => void,
  onAuthNeedsSignIn?: (user: { email: string | null; displayName: string | null } | null) => void
): () => void {
  const entry: AuthListenerEntry = { onAuthSuccess, onAuthNeedsSignIn };
  authListeners.add(entry);

  const unsubFirebase = onAuthStateChanged(auth, (user: User | null) => {
    cachedGoogleUser = user;
    if (user && cachedAccessToken) {
      cachedAccount = {
        email: user.email || user.displayName || 'Google Drive Terhubung',
        displayName: user.displayName || user.email || 'Google Drive Terhubung',
        photoUrl: user.photoURL || undefined,
        authMethod: 'firebase',
      };
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (cachedAccount?.authMethod === 'gis' && cachedAccessToken) {
      // Sesi aktif melalui Google Identity Services fallback (tanpa Firebase session)
      onAuthSuccess?.(
        { email: cachedAccount.email, displayName: cachedAccount.displayName },
        cachedAccessToken
      );
    } else if (!isSigningIn) {
      if (!user) {
        cachedAccessToken = null;
        cachedAccount = null;
      }
      onAuthNeedsSignIn?.(user);
    }
  });

  return () => {
    authListeners.delete(entry);
    unsubFirebase();
  };
}

export async function googleDriveSignIn(): Promise<{
  user: { email: string | null; displayName: string | null };
  accessToken: string;
  authMethod: 'firebase' | 'gis';
}> {
  try {
    isSigningIn = true;
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Gagal mendapatkan token akses Google Drive dari autentikasi Google.');
      }
      cachedAccessToken = credential.accessToken;
      cachedGoogleUser = result.user;
      cachedAccount = {
        email: result.user.email || result.user.displayName || 'Google Drive Terhubung',
        displayName: result.user.displayName || result.user.email || 'Google Drive Terhubung',
        photoUrl: result.user.photoURL || undefined,
        authMethod: 'firebase',
      };
      notifyAuthSuccess(cachedAccount, cachedAccessToken);
      return {
        user: result.user,
        accessToken: cachedAccessToken,
        authMethod: 'firebase',
      };
    } catch (firebaseErr) {
      const classified = classifyGoogleAuthError(firebaseErr);
      const shouldTryGisFallback =
        classified.isUnauthorizedDomain ||
        classified.code === 'auth/operation-not-supported-in-this-environment';

      if (!shouldTryGisFallback) {
        throw firebaseErr;
      }

      // Fallback otomatis ke Google Identity Services (GIS) menggunakan OAuth Client ID
      try {
        const gisRes = await signInWithGisFallback();
        cachedAccessToken = gisRes.accessToken;
        cachedAccount = gisRes.account;
        notifyAuthSuccess(cachedAccount, cachedAccessToken);
        return {
          user: {
            email: gisRes.account.email,
            displayName: gisRes.account.displayName,
          },
          accessToken: cachedAccessToken,
          authMethod: 'gis',
        };
      } catch (gisErr) {
        const gisClassified = classifyGoogleAuthError(gisErr);
        if (gisClassified.isPopupBlocked) {
          throw gisErr;
        }
        const domainStatus = await fetchFirebaseAuthorizedDomains(true);
        throw new GoogleAuthDomainError({
          hostname: domainStatus.currentHostname,
          origin: domainStatus.currentOrigin,
          projectId: domainStatus.projectId,
          oAuthClientId: domainStatus.oAuthClientId,
          authorizedDomains: domainStatus.authorizedDomains,
          gisFallbackError: gisClassified.isPopupClosed
            ? 'Popup OAuth Google ditutup (kemungkinan origin_mismatch di Google OAuth Client).'
            : gisClassified.rawMessage,
        });
      }
    }
  } finally {
    isSigningIn = false;
  }
}

export async function googleDriveSignOut(): Promise<void> {
  const tokenToRevoke = cachedAccessToken;
  const wasGis = cachedAccount?.authMethod === 'gis';
  cachedAccessToken = null;
  cachedGoogleUser = null;
  cachedAccount = null;

  if (wasGis && tokenToRevoke && typeof window !== 'undefined') {
    try {
      window.google?.accounts?.oauth2?.revoke?.(tokenToRevoke);
    } catch {
      // ignore revoke errors
    }
  }
  await auth.signOut();
  notifyAuthNeedsSignIn();
}

export function getGoogleDriveAccessToken(): string | null {
  return cachedAccessToken;
}

export function getGoogleDriveUser(): { email: string | null; displayName: string | null } | null {
  if (cachedGoogleUser) return cachedGoogleUser;
  if (cachedAccount) {
    return { email: cachedAccount.email, displayName: cachedAccount.displayName };
  }
  return null;
}

export function getGoogleDriveAccount(): GoogleDriveConnectedAccount | null {
  return cachedAccount;
}

function escapeDriveQueryValue(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function driveFetchJson<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let errText = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) errText = body.error.message;
    } catch {
      // ignore json parse failure
    }
    if (res.status === 401) {
      cachedAccessToken = null;
    }
    throw new Error(`Google Drive API error: ${errText}`);
  }
  if (res.status === 204) {
    return {} as T;
  }
  return (await res.json()) as T;
}

export async function findOrCreateDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<{ id: string; webViewLink: string }> {
  const escapedName = escapeDriveQueryValue(folderName);
  const parentClause = parentId
    ? ` and '${escapeDriveQueryValue(parentId)}' in parents`
    : ` and 'root' in parents`;
  const q = `mimeType='application/vnd.google-apps.folder' and name='${escapedName}' and trashed=false${parentClause}`;

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,webViewLink)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const found = await driveFetchJson<{ files?: Array<{ id: string; webViewLink?: string }> }>(
    searchUrl,
    accessToken
  );

  if (found.files && found.files.length > 0) {
    const existing = found.files[0];
    return {
      id: existing.id,
      webViewLink:
        existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`,
    };
  }

  const metadata: Record<string, unknown> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const created = await driveFetchJson<{ id: string; webViewLink?: string }>(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    }
  );

  return {
    id: created.id,
    webViewLink:
      created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
  };
}

export async function grantDriveFolderWriterPermission(
  accessToken: string,
  folderId: string,
  email: string
): Promise<{ shared: boolean; error?: string }> {
  const cleanEmail = normalizeGmailAddress(email);
  if (!isValidEmailAddress(cleanEmail)) {
    return { shared: false, error: 'Alamat Gmail tidak valid.' };
  }
  try {
    await driveFetchJson<Record<string, unknown>>(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        folderId
      )}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
      accessToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'writer',
          type: 'user',
          emailAddress: cleanEmail,
        }),
      }
    );
    return { shared: true };
  } catch (err) {
    return {
      shared: false,
      error: err instanceof Error ? err.message : 'Gagal membagikan akses folder ke Gmail terdaftar.',
    };
  }
}

export async function verifyDriveFolderAccess(
  accessToken: string,
  folderInput: string
): Promise<{
  id: string;
  name: string;
  webViewLink: string;
  ownerEmail?: string;
}> {
  const folderId = extractDriveFolderIdFromInput(folderInput);
  if (!folderId) {
    throw new Error(
      'ID atau URL Folder Google Drive tidak valid. Masukkan ID folder atau link https://drive.google.com/drive/folders/...'
    );
  }
  const meta = await driveFetchJson<{
    id: string;
    name?: string;
    mimeType?: string;
    webViewLink?: string;
    owners?: Array<{ emailAddress?: string }>;
  }>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      folderId
    )}?fields=id,name,mimeType,webViewLink,owners(emailAddress)&supportsAllDrives=true`,
    accessToken
  );

  if (!meta?.id || meta.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error('ID yang dimasukkan bukan merupakan folder Google Drive.');
  }

  return {
    id: meta.id,
    name: meta.name || DEFAULT_DRIVE_ROOT_FOLDER_NAME,
    webViewLink: meta.webViewLink || buildDriveFolderUrl(meta.id),
    ownerEmail: meta.owners?.[0]?.emailAddress,
  };
}

async function resolveParentDriveFolder(
  accessToken: string,
  configuredIdOrName: string,
  registeredGmail?: string
): Promise<{
  id: string;
  name: string;
  webViewLink: string;
  sharedWithGmail?: boolean;
  shareError?: string;
}> {
  const explicitId = extractDriveFolderIdFromInput(configuredIdOrName);
  if (explicitId) {
    try {
      const verified = await verifyDriveFolderAccess(accessToken, explicitId);
      return {
        id: verified.id,
        name: verified.name,
        webViewLink: verified.webViewLink,
      };
    } catch {
      // Fallback ke folder default PTG_PPJK_DOKUMEN jika ID tidak dapat diakses oleh sesi saat ini
    }
  }

  const rootFolder = await findOrCreateDriveFolder(accessToken, DEFAULT_DRIVE_ROOT_FOLDER_NAME);
  let sharedWithGmail = false;
  let shareError: string | undefined;

  const cleanRegistered = normalizeGmailAddress(registeredGmail);
  const currentEmail = normalizeGmailAddress(cachedAccount?.email);
  if (
    isValidEmailAddress(cleanRegistered) &&
    (!currentEmail || !currentEmail.includes('@') || currentEmail !== cleanRegistered)
  ) {
    const shareRes = await grantDriveFolderWriterPermission(
      accessToken,
      rootFolder.id,
      cleanRegistered
    );
    sharedWithGmail = shareRes.shared;
    shareError = shareRes.error;
  }

  return {
    id: rootFolder.id,
    name: DEFAULT_DRIVE_ROOT_FOLDER_NAME,
    webViewLink: rootFolder.webViewLink || buildDriveFolderUrl(rootFolder.id),
    sharedWithGmail,
    shareError,
  };
}

export async function ensureRegisteredDriveRootFolder(params: {
  accessToken: string;
  configuredFolderInput?: string;
  registeredGmail?: string;
}): Promise<{
  id: string;
  name: string;
  webViewLink: string;
  sharedWithGmail?: boolean;
  shareError?: string;
}> {
  const explicitId = extractDriveFolderIdFromInput(params.configuredFolderInput);
  if (explicitId) {
    const verified = await verifyDriveFolderAccess(params.accessToken, explicitId);
    let sharedWithGmail = false;
    let shareError: string | undefined;
    const cleanRegistered = normalizeGmailAddress(params.registeredGmail);
    const currentEmail = normalizeGmailAddress(cachedAccount?.email);
    if (
      isValidEmailAddress(cleanRegistered) &&
      (!currentEmail || !currentEmail.includes('@') || currentEmail !== cleanRegistered)
    ) {
      const shareRes = await grantDriveFolderWriterPermission(
        params.accessToken,
        verified.id,
        cleanRegistered
      );
      sharedWithGmail = shareRes.shared;
      shareError = shareRes.error;
    }
    return {
      id: verified.id,
      name: verified.name,
      webViewLink: verified.webViewLink,
      sharedWithGmail,
      shareError,
    };
  }
  return resolveParentDriveFolder(params.accessToken, '', params.registeredGmail);
}

export async function uploadFileToGoogleDrive(params: {
  accessToken: string;
  file: File;
  kodeOs: string;
  parentFolderSetting: string;
  jenisDokumen: string;
  registeredGmail?: string;
}): Promise<{
  fileId: string;
  name: string;
  webViewLink: string;
  folderId: string;
  rootFolderId: string;
  rootFolderName: string;
  rootFolderLink: string;
}> {
  const rootFolder = await resolveParentDriveFolder(
    params.accessToken,
    params.parentFolderSetting,
    params.registeredGmail
  );
  const osFolder = await findOrCreateDriveFolder(
    params.accessToken,
    params.kodeOs,
    rootFolder.id
  );

  const safeJenis = sanitizeDriveDocPrefix(params.jenisDokumen);
  const uploadName = safeJenis ? `${safeJenis}__${params.file.name}` : params.file.name;

  const metadata = {
    name: uploadName,
    parents: [osFolder.id],
    description: `Dokumen PPJK ${params.kodeOs} (${params.jenisDokumen})`,
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', params.file);

  const uploaded = await driveFetchJson<{
    id: string;
    name: string;
    webViewLink?: string;
  }>(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    params.accessToken,
    {
      method: 'POST',
      body: form,
    }
  );

  return {
    fileId: uploaded.id,
    name: uploaded.name || uploadName,
    webViewLink:
      uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
    folderId: osFolder.id,
    rootFolderId: rootFolder.id,
    rootFolderName: rootFolder.name,
    rootFolderLink: rootFolder.webViewLink,
  };
}

export async function listGoogleDriveFiles(params: {
  accessToken: string;
  query?: string;
  folderId?: string;
  pageSize?: number;
}): Promise<DriveFileEntry[]> {
  const clauses = ['trashed=false'];
  if (params.folderId) {
    clauses.push(`'${escapeDriveQueryValue(params.folderId)}' in parents`);
  }
  if (params.query && params.query.trim()) {
    clauses.push(`name contains '${escapeDriveQueryValue(params.query.trim())}'`);
  }

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    clauses.join(' and ')
  )}&orderBy=modifiedTime desc&pageSize=${params.pageSize || 15}&fields=files(id,name,mimeType,webViewLink,modifiedTime,size)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const data = await driveFetchJson<{ files?: DriveFileEntry[] }>(url, params.accessToken);
  return data.files || [];
}

export async function deleteGoogleDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  await driveFetchJson<Record<string, never>>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    accessToken,
    { method: 'DELETE' }
  );
}
