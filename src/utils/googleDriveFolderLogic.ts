import type { Pengaturan } from '../types/ppjk';

export const DEFAULT_DRIVE_ROOT_FOLDER_NAME = 'PTG_PPJK_DOKUMEN';
export const GAS_UPLOAD_MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export type DriveUploadStrategy = 'oauth-direct' | 'gas-webapp' | 'local-fallback';

export interface DriveUploadStrategyDecision {
  primary: DriveUploadStrategy;
  secondary: Exclude<DriveUploadStrategy, 'local-fallback'> | null;
  reason: string;
}

export function normalizeGmailAddress(raw: string | undefined | null): string {
  return (raw || '').trim().toLowerCase();
}

export function isValidEmailAddress(raw: string | undefined | null): boolean {
  const clean = normalizeGmailAddress(raw);
  if (!clean) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
}

export function extractDriveFolderIdFromInput(rawInput: string | undefined | null): string {
  const trimmed = (rawInput || '').trim();
  if (!trimmed || trimmed === 'PTG_PPJK_DOKUMEN_ROOT') {
    return '';
  }

  // URL patterns:
  // - https://drive.google.com/drive/folders/<ID>
  // - https://drive.google.com/drive/u/0/folders/<ID>?usp=sharing
  // - https://drive.google.com/open?id=<ID>
  // - https://drive.google.com/folderview?id=<ID>
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.hostname.toLowerCase().includes('google.com')) {
        return '';
      }
      const foldersMatch = parsed.pathname.match(/\/folders\/([a-zA-Z0-9_-]{15,})/);
      if (foldersMatch?.[1]) {
        return foldersMatch[1];
      }
      const idParam = parsed.searchParams.get('id') || '';
      if (/^[a-zA-Z0-9_-]{15,}$/.test(idParam.trim())) {
        return idParam.trim();
      }
      return '';
    } catch {
      return '';
    }
  }

  // Raw Google Drive folder ID (typically 28-44 chars, allow 15+ safe chars excluding default placeholder)
  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return trimmed;
  }

  return '';
}

export function buildDriveFolderUrl(folderId: string): string {
  const clean = extractDriveFolderIdFromInput(folderId);
  return clean ? `https://drive.google.com/drive/folders/${clean}` : '';
}

export function sanitizeDriveDocPrefix(jenisDokumen: string): string {
  return (jenisDokumen || '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

export function chooseGoogleDriveUploadStrategy(params: {
  hasOAuthToken: boolean;
  connectedGoogleEmail?: string | null;
  registeredGmail?: string;
  configuredFolderInput?: string;
  hasGasWebAppUrl: boolean;
}): DriveUploadStrategyDecision {
  const cleanRegistered = normalizeGmailAddress(params.registeredGmail);
  const cleanConnected = normalizeGmailAddress(params.connectedGoogleEmail);
  const folderId = extractDriveFolderIdFromInput(params.configuredFolderInput);

  if (!params.hasOAuthToken) {
    if (params.hasGasWebAppUrl) {
      return {
        primary: 'gas-webapp',
        secondary: null,
        reason: cleanRegistered
          ? `Upload langsung via Endpoint GAS ke folder Drive akun terdaftar (${cleanRegistered}).`
          : 'Upload langsung via Endpoint GAS Web App ke Google Drive pemilik script.',
      };
    }
    return {
      primary: 'local-fallback',
      secondary: null,
      reason: 'Belum Sign in with Google dan Endpoint GAS belum valid.',
    };
  }

  const emailLooksGeneric =
    !cleanConnected ||
    cleanConnected.includes('terhubung') ||
    !cleanConnected.includes('@');

  // If registered Gmail is explicitly configured and user is signed into a DIFFERENT Gmail account
  // without a shared explicit folder ID, prefer GAS Web App if configured so files land in registered Gmail's Drive.
  if (
    cleanRegistered &&
    !emailLooksGeneric &&
    cleanConnected !== cleanRegistered &&
    !folderId &&
    params.hasGasWebAppUrl
  ) {
    return {
      primary: 'gas-webapp',
      secondary: 'oauth-direct',
      reason: `Akun Google sesi (${cleanConnected}) berbeda dengan Gmail terdaftar (${cleanRegistered}); memprioritaskan Endpoint GAS milik Gmail terdaftar.`,
    };
  }

  return {
    primary: 'oauth-direct',
    secondary: params.hasGasWebAppUrl ? 'gas-webapp' : null,
    reason: folderId
      ? `Upload langsung via Google Drive API ke folder terdaftar (${folderId}).`
      : `Upload langsung via Google Drive API ke folder ${DEFAULT_DRIVE_ROOT_FOLDER_NAME}.`,
  };
}

export function describeRegisteredDriveDestination(
  pengaturan: Pick<
    Pengaturan,
    'driveOwnerGmail' | 'driveParentFolderId' | 'driveParentFolderName' | 'driveParentFolderUrl' | 'gasWebAppUrl'
  >,
  connectedGoogleEmail?: string | null
): {
  registeredGmail: string;
  folderId: string;
  folderLabel: string;
  folderUrl: string;
  hasDirectOrGasDestination: boolean;
} {
  const registeredGmail = normalizeGmailAddress(pengaturan.driveOwnerGmail);
  const folderId = extractDriveFolderIdFromInput(pengaturan.driveParentFolderId);
  const folderLabel =
    (pengaturan.driveParentFolderName || '').trim() ||
    (folderId ? `Folder ID: ${folderId}` : DEFAULT_DRIVE_ROOT_FOLDER_NAME);
  const folderUrl =
    (pengaturan.driveParentFolderUrl || '').trim() || buildDriveFolderUrl(folderId);
  const hasGas = Boolean((pengaturan.gasWebAppUrl || '').trim());

  return {
    registeredGmail:
      registeredGmail ||
      (connectedGoogleEmail && connectedGoogleEmail.includes('@')
        ? connectedGoogleEmail.trim()
        : ''),
    folderId,
    folderLabel,
    folderUrl,
    hasDirectOrGasDestination: Boolean(connectedGoogleEmail || hasGas),
  };
}
