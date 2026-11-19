import type { DatabaseState, KontainerItem, Shipment } from '../types/ppjk';
import {
  buildGasAddActionPayload,
  buildGasFullGetUrl,
  buildGasSyncAllActionPayload,
  type BuildGasPayloadOptions,
  type GasAddActionPayload,
  type GasSyncAllActionPayload,
  type GasUploadFileActionResult,
  parseGasUploadFileResponse,
  parseGasWebAppFullDatabaseGetResponse,
  parseGasWebAppGetResponse,
  type ParseGasFullDbResponseResult,
  type ParseGasGetResponseResult,
  validateGasWebAppUrl,
} from '../utils/gasWebAppLogic';
import {
  extractDriveFolderIdFromInput,
  GAS_UPLOAD_MAX_FILE_BYTES,
  normalizeGmailAddress,
} from '../utils/googleDriveFolderLogic';

export interface GasWebAppGetResult extends ParseGasGetResponseResult {
  url: string;
  fetchedAt: string;
  rawPayload: unknown;
}

export interface GasWebAppPostAddResult {
  url: string;
  sentAt: string;
  payload: GasAddActionPayload;
  responseBody: unknown;
}

function assertJsonTextResponse(
  rawText: string,
  responseStatus: number,
  isDevEndpoint: boolean
): unknown {
  const trimmed = (rawText || '').trim();
  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<HTML')
  ) {
    throw new Error(
      isDevEndpoint
        ? 'Endpoint /dev mengembalikan halaman login Google (HTML). Pastikan browser login dengan akun Google pemilik script atau deploy sebagai Web App (/exec) dengan akses "Anyone".'
        : 'Endpoint Apps Script mengembalikan halaman HTML bukan JSON. Periksa izin deploy Web App ("Who has access: Anyone") dan fungsi doGet/doPost.'
    );
  }

  if (!trimmed) {
    if (responseStatus >= 200 && responseStatus < 300) {
      return { ok: true };
    }
    throw new Error(`Endpoint mengembalikan respons kosong (HTTP ${responseStatus}).`);
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(
      `Respons endpoint Google Apps Script bukan format JSON valid (HTTP ${responseStatus}).`
    );
  }
}

export async function fetchGasWebAppShipments(
  url: string,
  checklistItems: string[],
  existingShipments: Shipment[] = []
): Promise<GasWebAppGetResult> {
  const validation = validateGasWebAppUrl(url);
  if (!validation.valid) {
    throw new Error(validation.error || 'URL Web App Google Apps Script tidak valid.');
  }

  let response: Response;
  try {
    response = await fetch(validation.normalizedUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    });
  } catch (err) {
    throw new Error(
      `Gagal menghubungi endpoint Google Apps Script (GET): ${
        err instanceof Error ? err.message : 'Koneksi jaringan/CORS terblokir.'
      }${
        validation.isDevEndpoint
          ? ' Catatan: Endpoint /dev hanya dapat diakses jika browser login akun pemilik script atau gunakan URL /exec.'
          : ''
      }`
    );
  }

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Endpoint Google Apps Script mengembalikan HTTP ${response.status} ${response.statusText || ''}.`
    );
  }

  const rawPayload = assertJsonTextResponse(
    rawText,
    response.status,
    validation.isDevEndpoint
  );
  const parsed = parseGasWebAppGetResponse(rawPayload, checklistItems, existingShipments);
  if (parsed.errorMessage) {
    throw new Error(parsed.errorMessage);
  }

  return {
    ...parsed,
    url: validation.normalizedUrl,
    fetchedAt: new Date().toISOString(),
    rawPayload,
  };
}

export function fileToBase64Data(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => {
      reject(new Error(`Gagal membaca file "${file.name}" untuk diupload.`));
    };
    reader.readAsDataURL(file);
  });
}

export async function postGasWebAppUploadFile(params: {
  url: string;
  file: File;
  kodeOs: string;
  jenisDokumen: string;
  parentFolderSetting?: string;
  ownerGmail?: string;
}): Promise<GasUploadFileActionResult> {
  const validation = validateGasWebAppUrl(params.url);
  if (!validation.valid) {
    throw new Error(validation.error || 'URL Web App Google Apps Script tidak valid.');
  }

  if (params.file.size > GAS_UPLOAD_MAX_FILE_BYTES) {
    throw new Error(
      `Ukuran file "${params.file.name}" melebihi batas 20 MB untuk upload via GAS Web App. Silakan gunakan "Sign in with Google" untuk upload langsung.`
    );
  }

  const base64Data = await fileToBase64Data(params.file);
  const folderId = extractDriveFolderIdFromInput(params.parentFolderSetting);
  const ownerGmail = normalizeGmailAddress(params.ownerGmail);

  let response: Response;
  try {
    response = await fetch(validation.normalizedUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'uploadFile',
        kodeOs: params.kodeOs || 'UMUM',
        jenisDokumen: params.jenisDokumen || 'Dokumen',
        fileName: params.file.name,
        mimeType: params.file.type || 'application/octet-stream',
        base64Data,
        folderId,
        ownerGmail,
      }),
    });
  } catch (err) {
    throw new Error(
      `Gagal mengupload file via Endpoint GAS ke Google Drive: ${
        err instanceof Error ? err.message : 'Koneksi jaringan/CORS terblokir.'
      }`
    );
  }

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Endpoint Google Apps Script menolak upload file (HTTP ${response.status} ${response.statusText || ''}).`
    );
  }

  const parsedBody = assertJsonTextResponse(
    rawText,
    response.status,
    validation.isDevEndpoint
  );
  const parsed = parseGasUploadFileResponse(parsedBody);
  if (!parsed.ok || !parsed.result) {
    throw new Error(parsed.errorMessage || 'Endpoint GAS gagal mengupload file ke Google Drive.');
  }

  return parsed.result;
}

export async function postGasWebAppVerifyDriveFolder(params: {
  url: string;
  parentFolderSetting?: string;
  ownerGmail?: string;
}): Promise<{
  rootFolderId: string;
  rootFolderName: string;
  rootFolderLink: string;
  ownerEmail?: string;
}> {
  const validation = validateGasWebAppUrl(params.url);
  if (!validation.valid) {
    throw new Error(validation.error || 'URL Web App Google Apps Script tidak valid.');
  }

  const folderId = extractDriveFolderIdFromInput(params.parentFolderSetting);
  const ownerGmail = normalizeGmailAddress(params.ownerGmail);

  let response: Response;
  try {
    response = await fetch(validation.normalizedUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'verifyDriveFolder',
        folderId,
        ownerGmail,
      }),
    });
  } catch (err) {
    throw new Error(
      `Gagal memverifikasi folder Google Drive via GAS: ${
        err instanceof Error ? err.message : 'Koneksi jaringan/CORS terblokir.'
      }`
    );
  }

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Endpoint GAS menolak verifikasi folder (HTTP ${response.status}).`
    );
  }

  const parsedBody = assertJsonTextResponse(
    rawText,
    response.status,
    validation.isDevEndpoint
  ) as Record<string, unknown>;

  const statusStr = String(parsedBody?.status || '').trim().toLowerCase();
  if (parsedBody?.ok === false || parsedBody?.success === false || statusStr === 'error') {
    throw new Error(
      String(parsedBody?.error || parsedBody?.message || 'Gagal menyiapkan folder Drive via GAS.')
    );
  }

  const rootFolderId = String(parsedBody?.rootFolderId || '').trim();
  if (!rootFolderId) {
    throw new Error('Endpoint GAS belum mendukung action verifyDriveFolder.');
  }

  return {
    rootFolderId,
    rootFolderName: String(parsedBody?.rootFolderName || 'PTG_PPJK_DOKUMEN').trim(),
    rootFolderLink:
      String(parsedBody?.rootFolderUrl || '').trim() ||
      `https://drive.google.com/drive/folders/${rootFolderId}`,
    ownerEmail: String(parsedBody?.ownerEmail || '').trim() || undefined,
  };
}

export async function postGasWebAppAddShipment(
  url: string,
  shipment: Shipment,
  containers: KontainerItem[] = [],
  options: BuildGasPayloadOptions = {}
): Promise<GasWebAppPostAddResult> {
  const validation = validateGasWebAppUrl(url);
  if (!validation.valid) {
    throw new Error(validation.error || 'URL Web App Google Apps Script tidak valid.');
  }

  const payload = buildGasAddActionPayload(shipment, containers, options);

  let response: Response;
  try {
    // Gunakan text/plain;charset=utf-8 agar menjadi simple CORS request (tanpa OPTIONS preflight yang ditolak GAS)
    response = await fetch(validation.normalizedUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(
      `Gagal mengirim data baru (POST action: 'add') ke Google Apps Script: ${
        err instanceof Error ? err.message : 'Koneksi jaringan/CORS terblokir.'
      }${
        validation.isDevEndpoint
          ? ' Pastikan akses Web App atau login Google aktif jika memakai URL /dev.'
          : ''
      }`
    );
  }

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Endpoint Google Apps Script menolak POST (HTTP ${response.status} ${response.statusText || ''}).`
    );
  }

  const parsedBody = assertJsonTextResponse(
    rawText,
    response.status,
    validation.isDevEndpoint
  );
  if (parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)) {
    const obj = parsedBody as Record<string, unknown>;
    const statusStr = String(obj.status || '').trim().toLowerCase();
    if (obj.ok === false || obj.success === false || statusStr === 'error') {
      throw new Error(
        String(obj.error || obj.message || 'Endpoint Apps Script menolak penyimpanan data.')
      );
    }
  }

  return {
    url: validation.normalizedUrl,
    sentAt: new Date().toISOString(),
    payload,
    responseBody: parsedBody,
  };
}

export interface GasWebAppPostSyncAllResult {
  url: string;
  sentAt: string;
  payload: GasSyncAllActionPayload;
  responseBody: unknown;
  tabCount: number;
  totalRows: number;
}

export async function postGasWebAppSyncAllDatabase(
  url: string,
  db: DatabaseState,
  updatedBy = 'admin'
): Promise<GasWebAppPostSyncAllResult> {
  const validation = validateGasWebAppUrl(url);
  if (!validation.valid) {
    throw new Error(validation.error || 'URL Web App Google Apps Script tidak valid.');
  }

  const syncedAt = new Date().toISOString();
  const payload = buildGasSyncAllActionPayload(db, updatedBy, syncedAt);

  let response: Response;
  try {
    response = await fetch(validation.normalizedUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(
      `Gagal mengirim seluruh 12 tab database (POST action: 'syncAll') ke Google Apps Script: ${
        err instanceof Error ? err.message : 'Koneksi jaringan/CORS terblokir.'
      }${
        validation.isDevEndpoint
          ? ' Pastikan akses Web App atau login Google aktif jika memakai URL /dev.'
          : ''
      }`
    );
  }

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Endpoint Google Apps Script menolak POST syncAll (HTTP ${response.status} ${response.statusText || ''}).`
    );
  }

  const parsedBody = assertJsonTextResponse(
    rawText,
    response.status,
    validation.isDevEndpoint
  );
  if (parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)) {
    const obj = parsedBody as Record<string, unknown>;
    const statusStr = String(obj.status || '').trim().toLowerCase();
    if (obj.ok === false || obj.success === false || statusStr === 'error') {
      throw new Error(
        String(obj.error || obj.message || 'Endpoint Apps Script menolak sinkronisasi 12 tab.')
      );
    }
  }

  const totalRows = Object.values(payload.sheets).reduce(
    (sum, matrix) => sum + Math.max(0, matrix.length - 1),
    0
  );

  return {
    url: validation.normalizedUrl,
    sentAt: syncedAt,
    payload,
    responseBody: parsedBody,
    tabCount: payload.tabs.length,
    totalRows,
  };
}

export interface GasWebAppFullGetResult extends ParseGasFullDbResponseResult {
  url: string;
  fetchedAt: string;
  rawPayload: unknown;
}

export async function fetchGasWebAppFullDatabase(
  url: string,
  fallbackDb: DatabaseState
): Promise<GasWebAppFullGetResult> {
  const validation = validateGasWebAppUrl(url);
  if (!validation.valid) {
    throw new Error(validation.error || 'URL Web App Google Apps Script tidak valid.');
  }

  const fullUrl = buildGasFullGetUrl(validation.normalizedUrl);

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    });
  } catch (err) {
    throw new Error(
      `Gagal menarik seluruh 12 tab database (GET ?mode=full) dari Google Apps Script: ${
        err instanceof Error ? err.message : 'Koneksi jaringan/CORS terblokir.'
      }`
    );
  }

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Endpoint Google Apps Script mengembalikan HTTP ${response.status} ${response.statusText || ''}.`
    );
  }

  const rawPayload = assertJsonTextResponse(
    rawText,
    response.status,
    validation.isDevEndpoint
  );
  const parsed = parseGasWebAppFullDatabaseGetResponse(rawPayload, fallbackDb);
  if (parsed.errorMessage) {
    throw new Error(parsed.errorMessage);
  }

  return {
    ...parsed,
    url: validation.normalizedUrl,
    fetchedAt: new Date().toISOString(),
    rawPayload,
  };
}
