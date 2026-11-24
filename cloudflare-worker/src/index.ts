/**
 * PTG PPJK Outstanding — Cloudflare Worker + D1 REST API
 *
 * Security & Reliability:
 * - Constant-time authentication via X-API-Key or Authorization: Bearer <API_KEY>
 * - Origin-validated CORS (never emits wildcard * on authenticated routes)
 * - 100% parameterized D1 prepared statements
 * - Single & batch upserts with monotonic version increment and soft deletes
 */

interface D1Meta {
  changes?: number;
  last_row_id?: number;
}

interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: D1Meta;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface Env {
  DB: D1Database;
  API_KEY: string;
  ALLOWED_ORIGINS?: string;
}

interface ShipmentPayload {
  id?: string;
  os_code?: string;
  doc_os?: string;
  importer_code?: string;
  importer_name?: string;
  customer_code?: string;
  customer_name?: string;
  bl_number?: string;
  packing_list?: string;
  aju_number?: string;
  nopen?: string;
  container_number?: string;
  status?: string;
  doc_status?: string;
  jalur?: string;
  checker_name?: string;
  eta_date?: string;
  etd_date?: string;
  received_date?: string;
  sppb_date?: string;
  gate_out_date?: string;
  bm_pdri_amount?: number;
  is_urgent?: number | boolean;
  notes?: string;
  updated_at?: string;
  deleted_at?: string | null;
  version?: number;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function resolveAllowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (configured.includes(origin)) {
    return origin;
  }
  return null;
}

function buildCorsHeaders(request: Request, env: Env): Record<string, string> {
  const allowedOrigin = resolveAllowedOrigin(request, env);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }
  return headers;
}

function jsonResponse(
  request: Request,
  env: Env,
  data: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...buildCorsHeaders(request, env),
    },
  });
}

function verifyRequestAuth(request: Request, env: Env): boolean {
  const expectedKey = (env.API_KEY || '').trim();
  if (!expectedKey) return false;

  const headerKey = (request.headers.get('X-API-Key') || '').trim();
  if (headerKey && timingSafeEqual(headerKey, expectedKey)) {
    return true;
  }

  const authHeader = (request.headers.get('Authorization') || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken && timingSafeEqual(bearerToken, expectedKey)) {
      return true;
    }
  }

  return false;
}

function cleanText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function cleanNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function cleanUrgent(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value > 0 ? 1 : 0;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    return lower === '1' || lower === 'true' || lower === 'ya' ? 1 : 0;
  }
  return 0;
}

function normalizeUpsertPayload(raw: ShipmentPayload, nowIso: string) {
  const osCode = cleanText(raw.os_code).toUpperCase();
  if (!osCode) {
    throw new Error('Field os_code wajib diisi.');
  }
  const id = cleanText(raw.id) || `shp_${osCode.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
  const updatedAt = cleanText(raw.updated_at) || nowIso;
  const deletedAt =
    raw.deleted_at === null || raw.deleted_at === '' || raw.deleted_at === undefined
      ? null
      : cleanText(raw.deleted_at);
  const incomingVersion = Math.max(1, Math.floor(cleanNumber(raw.version, 1)));

  return {
    id,
    os_code: osCode,
    doc_os: cleanText(raw.doc_os),
    importer_code: cleanText(raw.importer_code),
    importer_name: cleanText(raw.importer_name),
    customer_code: cleanText(raw.customer_code),
    customer_name: cleanText(raw.customer_name),
    bl_number: cleanText(raw.bl_number),
    packing_list: cleanText(raw.packing_list),
    aju_number: cleanText(raw.aju_number),
    nopen: cleanText(raw.nopen),
    container_number: cleanText(raw.container_number),
    status: cleanText(raw.status, 'Dokumen Diterima'),
    doc_status: cleanText(raw.doc_status, 'Draft'),
    jalur: cleanText(raw.jalur),
    checker_name: cleanText(raw.checker_name),
    eta_date: cleanText(raw.eta_date),
    etd_date: cleanText(raw.etd_date),
    received_date: cleanText(raw.received_date),
    sppb_date: cleanText(raw.sppb_date),
    gate_out_date: cleanText(raw.gate_out_date),
    bm_pdri_amount: cleanNumber(raw.bm_pdri_amount, 0),
    is_urgent: cleanUrgent(raw.is_urgent),
    notes: cleanText(raw.notes),
    updated_at: updatedAt,
    deleted_at: deletedAt,
    version: incomingVersion,
  };
}

const PATCH_COLUMN_SQL: Record<string, string> = {
  os_code: 'os_code = ?',
  doc_os: 'doc_os = ?',
  importer_code: 'importer_code = ?',
  importer_name: 'importer_name = ?',
  customer_code: 'customer_code = ?',
  customer_name: 'customer_name = ?',
  bl_number: 'bl_number = ?',
  packing_list: 'packing_list = ?',
  aju_number: 'aju_number = ?',
  nopen: 'nopen = ?',
  container_number: 'container_number = ?',
  status: 'status = ?',
  doc_status: 'doc_status = ?',
  jalur: 'jalur = ?',
  checker_name: 'checker_name = ?',
  eta_date: 'eta_date = ?',
  etd_date: 'etd_date = ?',
  received_date: 'received_date = ?',
  sppb_date: 'sppb_date = ?',
  gate_out_date: 'gate_out_date = ?',
  bm_pdri_amount: 'bm_pdri_amount = ?',
  is_urgent: 'is_urgent = ?',
  notes: 'notes = ?',
  deleted_at: 'deleted_at = ?',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(request, env),
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse(request, env, {
        ok: true,
        service: 'ptg-ppjk-d1-worker',
        timestamp: new Date().toISOString(),
      });
    }

    if (!verifyRequestAuth(request, env)) {
      return jsonResponse(
        request,
        env,
        { ok: false, error: 'Unauthorized: X-API-Key atau Bearer token tidak valid.' },
        401
      );
    }

    try {
      // GET /api/shipments
      if (pathname === '/api/shipments' && request.method === 'GET') {
        const q = (url.searchParams.get('q') || '').trim();
        const statusFilter = (url.searchParams.get('status') || '').trim();
        const importerCode = (url.searchParams.get('importer_code') || '').trim();
        const since = (url.searchParams.get('since') || '').trim();
        const includeDeleted = url.searchParams.get('include_deleted') === '1';

        const whereParts: string[] = [];
        const params: unknown[] = [];

        if (since) {
          // Incremental sync pull returns updated rows including tombstones (deleted_at IS NOT NULL)
          whereParts.push('updated_at > ?');
          params.push(since);
        } else if (!includeDeleted) {
          whereParts.push('deleted_at IS NULL');
        }

        if (statusFilter) {
          whereParts.push('status = ?');
          params.push(statusFilter);
        }

        if (importerCode) {
          whereParts.push('importer_code = ?');
          params.push(importerCode);
        }

        if (q) {
          const like = `%${q}%`;
          whereParts.push(
            '(os_code LIKE ? OR doc_os LIKE ? OR customer_name LIKE ? OR importer_name LIKE ? OR importer_code LIKE ? OR bl_number LIKE ? OR aju_number LIKE ? OR nopen LIKE ? OR container_number LIKE ?)'
          );
          params.push(like, like, like, like, like, like, like, like, like);
        }

        const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
        const query = `SELECT * FROM shipments ${whereSql} ORDER BY is_urgent DESC, updated_at DESC`;
        const res = await env.DB.prepare(query).bind(...params).all();

        return jsonResponse(request, env, {
          ok: true,
          shipments: res.results || [],
          synced_at: new Date().toISOString(),
        });
      }

      // GET /api/shipments/summary-importer
      if (pathname === '/api/shipments/summary-importer' && request.method === 'GET') {
        const sql = `
          SELECT
            COALESCE(NULLIF(TRIM(importer_code), ''), 'NON-IMP') AS importer_code,
            COALESCE(NULLIF(TRIM(importer_name), ''), 'Importir Umum') AS importer_name,
            COUNT(*) AS total_shipments,
            SUM(CASE WHEN is_urgent = 1 THEN 1 ELSE 0 END) AS urgent_count,
            SUM(CASE WHEN UPPER(COALESCE(doc_status, '')) = 'READY' OR UPPER(COALESCE(status, '')) = 'SELESAI' THEN 1 ELSE 0 END) AS ready_count,
            SUM(CASE WHEN COALESCE(sppb_date, '') = '' AND UPPER(COALESCE(status, '')) != 'SELESAI' THEN 1 ELSE 0 END) AS outstanding_count,
            COALESCE(SUM(bm_pdri_amount), 0) AS total_bm_pdri
          FROM shipments
          WHERE deleted_at IS NULL
          GROUP BY COALESCE(NULLIF(TRIM(importer_code), ''), 'NON-IMP'), COALESCE(NULLIF(TRIM(importer_name), ''), 'Importir Umum')
          ORDER BY total_shipments DESC, importer_code ASC
        `;
        const res = await env.DB.prepare(sql).all();
        return jsonResponse(request, env, {
          ok: true,
          summary: res.results || [],
          generated_at: new Date().toISOString(),
        });
      }

      // POST /api/shipments (single or batch upsert with monotonic version increment)
      if (pathname === '/api/shipments' && request.method === 'POST') {
        const body = (await request.json()) as
          | ShipmentPayload
          | ShipmentPayload[]
          | { shipments?: ShipmentPayload[] };

        const rawList: ShipmentPayload[] = Array.isArray(body)
          ? body
          : Array.isArray((body as { shipments?: ShipmentPayload[] }).shipments)
            ? (body as { shipments: ShipmentPayload[] }).shipments
            : [body as ShipmentPayload];

        if (rawList.length === 0) {
          return jsonResponse(request, env, { ok: false, error: 'Payload shipments kosong.' }, 400);
        }
        if (rawList.length > 500) {
          return jsonResponse(
            request,
            env,
            { ok: false, error: 'Maksimal 500 baris per batch upsert.' },
            400
          );
        }

        const nowIso = new Date().toISOString();
        const normalized = rawList.map((item) => normalizeUpsertPayload(item, nowIso));

        const statements = normalized.map((row) =>
          env.DB.prepare(
            `
            INSERT INTO shipments (
              id, os_code, doc_os, importer_code, importer_name, customer_code, customer_name,
              bl_number, packing_list, aju_number, nopen, container_number, status, doc_status,
              jalur, checker_name, eta_date, etd_date, received_date, sppb_date, gate_out_date,
              bm_pdri_amount, is_urgent, notes, updated_at, deleted_at, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(os_code) DO UPDATE SET
              doc_os = excluded.doc_os,
              importer_code = excluded.importer_code,
              importer_name = excluded.importer_name,
              customer_code = excluded.customer_code,
              customer_name = excluded.customer_name,
              bl_number = excluded.bl_number,
              packing_list = excluded.packing_list,
              aju_number = excluded.aju_number,
              nopen = excluded.nopen,
              container_number = excluded.container_number,
              status = excluded.status,
              doc_status = excluded.doc_status,
              jalur = excluded.jalur,
              checker_name = excluded.checker_name,
              eta_date = excluded.eta_date,
              etd_date = excluded.etd_date,
              received_date = excluded.received_date,
              sppb_date = excluded.sppb_date,
              gate_out_date = excluded.gate_out_date,
              bm_pdri_amount = excluded.bm_pdri_amount,
              is_urgent = excluded.is_urgent,
              notes = excluded.notes,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at,
              version = shipments.version + 1
          `
          ).bind(
            row.id,
            row.os_code,
            row.doc_os,
            row.importer_code,
            row.importer_name,
            row.customer_code,
            row.customer_name,
            row.bl_number,
            row.packing_list,
            row.aju_number,
            row.nopen,
            row.container_number,
            row.status,
            row.doc_status,
            row.jalur,
            row.checker_name,
            row.eta_date,
            row.etd_date,
            row.received_date,
            row.sppb_date,
            row.gate_out_date,
            row.bm_pdri_amount,
            row.is_urgent,
            row.notes,
            row.updated_at,
            row.deleted_at,
            row.version
          )
        );

        await env.DB.batch(statements);

        const osCodes = normalized.map((n) => n.os_code);
        const placeholders = osCodes.map(() => '?').join(', ');
        const fetched = await env.DB.prepare(
          `SELECT * FROM shipments WHERE os_code IN (${placeholders})`
        )
          .bind(...osCodes)
          .all();

        return jsonResponse(
          request,
          env,
          {
            ok: true,
            count: normalized.length,
            shipments: fetched.results || [],
            synced_at: nowIso,
          },
          200
        );
      }

      // PATCH /api/shipments/:id & DELETE /api/shipments/:id
      const idMatch = pathname.match(/^\/api\/shipments\/([^/]+)$/);
      if (idMatch) {
        const targetId = decodeURIComponent(idMatch[1]).trim();
        if (!targetId) {
          return jsonResponse(request, env, { ok: false, error: 'ID shipment tidak valid.' }, 400);
        }

        if (request.method === 'PATCH') {
          const patchBody = (await request.json()) as ShipmentPayload;
          const setClauses: string[] = [];
          const bindValues: unknown[] = [];

          for (const [key, sqlExpr] of Object.entries(PATCH_COLUMN_SQL)) {
            if (!Object.prototype.hasOwnProperty.call(patchBody, key)) continue;
            const rawVal = (patchBody as Record<string, unknown>)[key];
            setClauses.push(sqlExpr);
            if (key === 'bm_pdri_amount') {
              bindValues.push(cleanNumber(rawVal, 0));
            } else if (key === 'is_urgent') {
              bindValues.push(cleanUrgent(rawVal));
            } else if (key === 'deleted_at') {
              bindValues.push(rawVal === null || rawVal === '' ? null : cleanText(rawVal));
            } else if (key === 'os_code') {
              bindValues.push(cleanText(rawVal).toUpperCase());
            } else {
              bindValues.push(cleanText(rawVal));
            }
          }

          if (setClauses.length === 0) {
            return jsonResponse(
              request,
              env,
              { ok: false, error: 'Tidak ada kolom valid untuk diperbarui.' },
              400
            );
          }

          const nowIso = cleanText(patchBody.updated_at) || new Date().toISOString();
          setClauses.push('updated_at = ?', 'version = version + 1');
          bindValues.push(nowIso, targetId, targetId);

          const updateRes = await env.DB.prepare(
            `UPDATE shipments SET ${setClauses.join(', ')} WHERE id = ? OR os_code = ?`
          )
            .bind(...bindValues)
            .run();

          if (!updateRes.meta?.changes) {
            return jsonResponse(
              request,
              env,
              { ok: false, error: `Shipment "${targetId}" tidak ditemukan.` },
              404
            );
          }

          const updatedRow = await env.DB.prepare(
            'SELECT * FROM shipments WHERE id = ? OR os_code = ? LIMIT 1'
          )
            .bind(targetId, targetId)
            .first();

          return jsonResponse(request, env, {
            ok: true,
            shipment: updatedRow,
            synced_at: nowIso,
          });
        }

        if (request.method === 'DELETE') {
          const nowIso = new Date().toISOString();
          const delRes = await env.DB.prepare(
            `UPDATE shipments SET deleted_at = ?, updated_at = ?, version = version + 1 WHERE id = ? OR os_code = ?`
          )
            .bind(nowIso, nowIso, targetId, targetId)
            .run();

          if (!delRes.meta?.changes) {
            return jsonResponse(
              request,
              env,
              { ok: false, error: `Shipment "${targetId}" tidak ditemukan.` },
              404
            );
          }

          const deletedRow = await env.DB.prepare(
            'SELECT * FROM shipments WHERE id = ? OR os_code = ? LIMIT 1'
          )
            .bind(targetId, targetId)
            .first();

          return jsonResponse(request, env, {
            ok: true,
            deleted: true,
            shipment: deletedRow,
            synced_at: nowIso,
          });
        }
      }

      return jsonResponse(request, env, { ok: false, error: 'Endpoint tidak ditemukan.' }, 404);
    } catch (err) {
      return jsonResponse(
        request,
        env,
        {
          ok: false,
          error: err instanceof Error ? err.message : 'Terjadi kesalahan internal D1 Worker.',
        },
        500
      );
    }
  },
};
