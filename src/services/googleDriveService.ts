import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

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

// Token hanya disimpan di memori (tidak pernah disimpan di localStorage / sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;

export interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

export function initGoogleDriveAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthNeedsSignIn?: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, (user: User | null) => {
    cachedGoogleUser = user;
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (!user) {
        cachedAccessToken = null;
      }
      onAuthNeedsSignIn?.(user);
    }
  });
}

export async function googleDriveSignIn(): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses Google Drive dari autentikasi Google.');
    }
    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function googleDriveSignOut(): Promise<void> {
  cachedAccessToken = null;
  cachedGoogleUser = null;
  await auth.signOut();
}

export function getGoogleDriveAccessToken(): string | null {
  return cachedAccessToken;
}

export function getGoogleDriveUser(): User | null {
  return cachedGoogleUser;
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
  )}&fields=files(id,name,webViewLink)&pageSize=1`;

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
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
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

async function resolveParentDriveFolderId(
  accessToken: string,
  configuredIdOrName: string
): Promise<string> {
  const clean = (configuredIdOrName || '').trim();
  if (clean && clean !== 'PTG_PPJK_DOKUMEN_ROOT' && /^[a-zA-Z0-9_-]{18,}$/.test(clean)) {
    try {
      const folderMeta = await driveFetchJson<{ id: string; mimeType?: string }>(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          clean
        )}?fields=id,mimeType`,
        accessToken
      );
      if (folderMeta?.id && folderMeta.mimeType === 'application/vnd.google-apps.folder') {
        return folderMeta.id;
      }
    } catch {
      // Fallback ke folder default PTG_PPJK_DOKUMEN jika ID tidak ditemukan di akun user
    }
  }
  const rootFolder = await findOrCreateDriveFolder(accessToken, 'PTG_PPJK_DOKUMEN');
  return rootFolder.id;
}

export async function uploadFileToGoogleDrive(params: {
  accessToken: string;
  file: File;
  kodeOs: string;
  parentFolderSetting: string;
  jenisDokumen: string;
}): Promise<{
  fileId: string;
  name: string;
  webViewLink: string;
  folderId: string;
}> {
  const parentId = await resolveParentDriveFolderId(
    params.accessToken,
    params.parentFolderSetting
  );
  const osFolder = await findOrCreateDriveFolder(
    params.accessToken,
    params.kodeOs,
    parentId
  );

  const safeJenis = params.jenisDokumen.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
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
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
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
  )}&orderBy=modifiedTime desc&pageSize=${params.pageSize || 15}&fields=files(id,name,mimeType,webViewLink,modifiedTime,size)`;

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
