import type { KontainerItem, Shipment } from '../types/ppjk';
import {
  buildGasAddActionPayload,
  type BuildGasPayloadOptions,
  type GasAddActionPayload,
  parseGasWebAppGetResponse,
  type ParseGasGetResponseResult,
  validateGasWebAppUrl,
} from '../utils/gasWebAppLogic';

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
