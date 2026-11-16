import type { DatabaseState } from '../types/ppjk';
import {
  DATABASE_SHEET_TABS,
  parseSheetMatrixMapToDatabase,
  serializeDatabaseToSheetMatrixMap,
} from '../utils/sheetsSchema';

export interface SpreadsheetMetadataInfo {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: Array<{ sheetId: number; title: string }>;
}

export interface SpreadsheetDriveEntry {
  id: string;
  name: string;
  webViewLink: string;
  modifiedTime?: string;
}

export interface SpreadsheetPushResult {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  syncedAt: string;
  writtenTabs: number;
  writtenRows: number;
}

export interface SpreadsheetPullResult {
  db: DatabaseState;
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  matchedTabs: string[];
  remoteLastUpdatedAt: string;
  remoteUpdatedBy: string;
}

async function sheetsFetchJson<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let errText = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) errText = body.error.message;
    } catch {
      // ignore json parse error
    }
    throw new Error(`Google Sheets API error: ${errText}`);
  }
  return (await res.json()) as T;
}

function quoteSheetName(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

function escapeDriveValue(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function fetchSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadataInfo> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=spreadsheetId,properties(title),spreadsheetUrl,sheets(properties(sheetId,title))`;

  const raw = await sheetsFetchJson<{
    spreadsheetId: string;
    properties?: { title?: string };
    spreadsheetUrl?: string;
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>(url, accessToken);

  return {
    spreadsheetId: raw.spreadsheetId || spreadsheetId,
    title: raw.properties?.title || 'PTG_PPJK_DATABASE',
    spreadsheetUrl:
      raw.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheets: (raw.sheets || [])
      .map((s) => ({
        sheetId: s.properties?.sheetId ?? 0,
        title: s.properties?.title || '',
      }))
      .filter((s) => Boolean(s.title)),
  };
}

export async function listUserSpreadsheets(
  accessToken: string,
  pageSize = 20
): Promise<SpreadsheetDriveEntry[]> {
  const q = `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&orderBy=modifiedTime desc&pageSize=${pageSize}&fields=files(id,name,webViewLink,modifiedTime)`;
  const data = await sheetsFetchJson<{
    files?: Array<{ id: string; name: string; webViewLink?: string; modifiedTime?: string }>;
  }>(url, accessToken);

  return (data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    webViewLink: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
    modifiedTime: f.modifiedTime,
  }));
}

export async function findDatabaseSpreadsheet(
  accessToken: string,
  title = 'PTG_PPJK_DATABASE'
): Promise<SpreadsheetDriveEntry | null> {
  const q = `mimeType='application/vnd.google-apps.spreadsheet' and name='${escapeDriveValue(
    title
  )}' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&orderBy=modifiedTime desc&pageSize=1&fields=files(id,name,webViewLink,modifiedTime)`;
  const data = await sheetsFetchJson<{
    files?: Array<{ id: string; name: string; webViewLink?: string; modifiedTime?: string }>;
  }>(url, accessToken);
  const first = data.files?.[0];
  if (!first) return null;
  return {
    id: first.id,
    name: first.name,
    webViewLink: first.webViewLink || `https://docs.google.com/spreadsheets/d/${first.id}/edit`,
    modifiedTime: first.modifiedTime,
  };
}

export async function ensureDatabaseSheetTabs(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadataInfo> {
  const meta = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingTitles = new Set(meta.sheets.map((s) => s.title));
  const missingTabs = DATABASE_SHEET_TABS.filter((tab) => !existingTitles.has(tab.title));

  if (missingTabs.length > 0) {
    const requests = missingTabs.map((tab) => ({
      addSheet: {
        properties: {
          title: tab.title,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    }));

    await sheetsFetchJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ requests }),
      }
    );

    return fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  }

  return meta;
}

export async function createDatabaseSpreadsheet(
  accessToken: string,
  title: string,
  initialDb: DatabaseState,
  updatedBy: string
): Promise<SpreadsheetPushResult> {
  const cleanTitle = (title || '').trim() || 'PTG_PPJK_DATABASE';
  const createPayload = {
    properties: {
      title: cleanTitle,
      locale: 'id_ID',
    },
    sheets: DATABASE_SHEET_TABS.map((tab) => ({
      properties: {
        title: tab.title,
        gridProperties: { frozenRowCount: 1 },
      },
    })),
  };

  const created = await sheetsFetchJson<{
    spreadsheetId: string;
    properties?: { title?: string };
    spreadsheetUrl?: string;
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    body: JSON.stringify(createPayload),
  });

  const spreadsheetId = created.spreadsheetId;
  const sheetIds = (created.sheets || [])
    .map((s) => s.properties?.sheetId)
    .filter((id): id is number => typeof id === 'number');

  // Format header rows on all newly created tabs
  if (sheetIds.length > 0) {
    const formatRequests = sheetIds.map((sheetId) => ({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.043, green: 0.145, blue: 0.271 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 10,
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    }));

    await sheetsFetchJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ requests: formatRequests }),
      }
    );
  }

  const syncedAt = new Date().toISOString();
  const dbWithMeta: DatabaseState = {
    ...initialDb,
    pengaturan: {
      ...initialDb.pengaturan,
      spreadsheetId,
      spreadsheetTitle: created.properties?.title || cleanTitle,
      spreadsheetUrl:
        created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      spreadsheetAutoSync: true,
      spreadsheetLastSyncAt: syncedAt,
      spreadsheetLastSyncDirection: 'create',
    },
  };

  const matrixMap = serializeDatabaseToSheetMatrixMap(dbWithMeta, updatedBy, syncedAt);
  const data = DATABASE_SHEET_TABS.map((tab) => ({
    range: `${quoteSheetName(tab.title)}!A1`,
    majorDimension: 'ROWS',
    values: matrixMap[tab.title] || [tab.headers],
  }));

  await sheetsFetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data,
      }),
    }
  );

  const writtenRows = data.reduce((sum, d) => sum + Math.max(0, d.values.length - 1), 0);

  return {
    spreadsheetId,
    title: dbWithMeta.pengaturan.spreadsheetTitle || cleanTitle,
    spreadsheetUrl: dbWithMeta.pengaturan.spreadsheetUrl || '',
    syncedAt,
    writtenTabs: data.length,
    writtenRows,
  };
}

export async function pushDatabaseToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  db: DatabaseState,
  updatedBy: string
): Promise<SpreadsheetPushResult> {
  const meta = await ensureDatabaseSheetTabs(accessToken, spreadsheetId);
  const syncedAt = new Date().toISOString();

  const dbWithMeta: DatabaseState = {
    ...db,
    pengaturan: {
      ...db.pengaturan,
      spreadsheetId: meta.spreadsheetId,
      spreadsheetTitle: meta.title,
      spreadsheetUrl: meta.spreadsheetUrl,
      spreadsheetLastSyncAt: syncedAt,
      spreadsheetLastSyncDirection: 'push',
    },
  };

  const matrixMap = serializeDatabaseToSheetMatrixMap(dbWithMeta, updatedBy, syncedAt);
  const clearRanges = DATABASE_SHEET_TABS.map((tab) => `${quoteSheetName(tab.title)}!A:ZZ`);

  await sheetsFetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      meta.spreadsheetId
    )}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ ranges: clearRanges }),
    }
  );

  const data = DATABASE_SHEET_TABS.map((tab) => ({
    range: `${quoteSheetName(tab.title)}!A1`,
    majorDimension: 'ROWS',
    values: matrixMap[tab.title] || [tab.headers],
  }));

  await sheetsFetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      meta.spreadsheetId
    )}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data,
      }),
    }
  );

  const writtenRows = data.reduce((sum, d) => sum + Math.max(0, d.values.length - 1), 0);

  return {
    spreadsheetId: meta.spreadsheetId,
    title: meta.title,
    spreadsheetUrl: meta.spreadsheetUrl,
    syncedAt,
    writtenTabs: data.length,
    writtenRows,
  };
}

export async function pullDatabaseFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  fallbackDb: DatabaseState
): Promise<SpreadsheetPullResult> {
  const meta = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  const availableTitles = new Set(meta.sheets.map((s) => s.title));
  const matchedTabs = DATABASE_SHEET_TABS.map((t) => t.title).filter((title) =>
    availableTitles.has(title)
  );

  if (matchedTabs.length === 0) {
    throw new Error(
      `Spreadsheet "${meta.title}" belum memiliki tab database PTG PPJK (mis. Shipments, Kontainer, Master_Customer). Gunakan "Buat / Inisialisasi Tab Database" terlebih dahulu.`
    );
  }

  const rangeParams = matchedTabs
    .map((t) => `ranges=${encodeURIComponent(`${quoteSheetName(t)}!A:ZZ`)}`)
    .join('&');

  const batchRes = await sheetsFetchJson<{
    valueRanges?: Array<{ range?: string; values?: string[][] }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      meta.spreadsheetId
    )}/values:batchGet?${rangeParams}`,
    accessToken
  );

  const sheetsData: Record<string, string[][]> = {};
  (batchRes.valueRanges || []).forEach((vr, idx) => {
    const tabTitle = matchedTabs[idx];
    if (tabTitle && Array.isArray(vr.values)) {
      sheetsData[tabTitle] = vr.values;
    }
  });

  const parsedDb = parseSheetMatrixMapToDatabase(sheetsData, fallbackDb, {
    spreadsheetId: meta.spreadsheetId,
    spreadsheetTitle: meta.title,
    spreadsheetUrl: meta.spreadsheetUrl,
  });

  let remoteLastUpdatedAt = '';
  let remoteUpdatedBy = '';
  const metaRows = sheetsData.Sync_Metadata || [];
  for (let i = 1; i < metaRows.length; i++) {
    const k = (metaRows[i]?.[0] || '').trim();
    const v = (metaRows[i]?.[1] || '').trim();
    if (k === 'lastUpdatedAt') remoteLastUpdatedAt = v;
    if (k === 'updatedBy') remoteUpdatedBy = v;
  }

  return {
    db: parsedDb,
    spreadsheetId: meta.spreadsheetId,
    title: meta.title,
    spreadsheetUrl: meta.spreadsheetUrl,
    matchedTabs,
    remoteLastUpdatedAt,
    remoteUpdatedBy,
  };
}
