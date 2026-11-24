import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cleanText,
  filterD1Shipments,
  getInitialSeedD1Shipments,
  patchD1RecordInList,
  softDeleteD1RecordInList,
  summarizeD1ByImporter,
  upsertD1RecordsInList,
  type D1ShipmentRecord,
} from './src/utils/d1Contract.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Server-only environment configuration for optional remote Cloudflare Worker proxy
const REMOTE_WORKER_BASE = (process.env.CLOUDFLARE_WORKER_URL || '').trim().replace(/\/+$/, '');
const REMOTE_API_KEY = (process.env.CLOUDFLARE_D1_API_KEY || '').trim();

function isSafeExternalWorkerUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    // Require https for non-localhost remote workers and block private/metadata IP ranges
    if (
      host === '169.254.169.254' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host === '0.0.0.0'
    ) {
      return false;
    }
    if (host !== 'localhost' && host !== '127.0.0.1' && parsed.protocol !== 'https:') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const USE_CLOUDFLARE_PROXY = Boolean(
  REMOTE_WORKER_BASE && REMOTE_API_KEY && isSafeExternalWorkerUrl(REMOTE_WORKER_BASE)
);

// Stateful D1-contract fallback store used when CLOUDFLARE_WORKER_URL is not configured
let edgeStoreShipments: D1ShipmentRecord[] = getInitialSeedD1Shipments();

async function proxyToCloudflareWorker(req: Request, res: Response, apiPath: string): Promise<void> {
  const queryIndex = req.originalUrl.indexOf('?');
  const qs = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  const targetUrl = `${REMOTE_WORKER_BASE}${apiPath}${qs}`;

  const init: RequestInit = {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': REMOTE_API_KEY,
    },
  };

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
    init.body = JSON.stringify(req.body);
  }

  const upstream = await fetch(targetUrl, init);
  const text = await upstream.text();
  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  res.send(text);
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/d1/status', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      mode: USE_CLOUDFLARE_PROXY ? 'cloudflare-proxy' : 'local-d1-edge',
      worker_configured: USE_CLOUDFLARE_PROXY,
      total_active_shipments: edgeStoreShipments.filter((s) => !s.deleted_at).length,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/shipments', async (req: Request, res: Response) => {
    try {
      if (USE_CLOUDFLARE_PROXY) {
        await proxyToCloudflareWorker(req, res, '/api/shipments');
        return;
      }

      const filtered = filterD1Shipments(edgeStoreShipments, {
        q: typeof req.query.q === 'string' ? req.query.q : '',
        status: typeof req.query.status === 'string' ? req.query.status : '',
        importer_code: typeof req.query.importer_code === 'string' ? req.query.importer_code : '',
        since: typeof req.query.since === 'string' ? req.query.since : '',
        include_deleted: req.query.include_deleted === '1',
      }).sort((a, b) => {
        if (a.is_urgent !== b.is_urgent) return b.is_urgent - a.is_urgent;
        return (b.updated_at || '').localeCompare(a.updated_at || '');
      });

      res.json({
        ok: true,
        shipments: filtered,
        synced_at: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal mengambil data shipments D1.',
      });
    }
  });

  app.get('/api/shipments/summary-importer', async (req: Request, res: Response) => {
    try {
      if (USE_CLOUDFLARE_PROXY) {
        await proxyToCloudflareWorker(req, res, '/api/shipments/summary-importer');
        return;
      }
      res.json({
        ok: true,
        summary: summarizeD1ByImporter(edgeStoreShipments),
        generated_at: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal membuat ringkasan importir D1.',
      });
    }
  });

  app.post('/api/shipments', async (req: Request, res: Response) => {
    try {
      if (USE_CLOUDFLARE_PROXY) {
        await proxyToCloudflareWorker(req, res, '/api/shipments');
        return;
      }

      const body = req.body as
        | (Partial<D1ShipmentRecord> & { os_code?: string })
        | Array<Partial<D1ShipmentRecord> & { os_code?: string }>
        | { shipments?: Array<Partial<D1ShipmentRecord> & { os_code?: string }> };

      const rawList = Array.isArray(body)
        ? body
        : Array.isArray((body as { shipments?: unknown[] })?.shipments)
          ? (body as { shipments: Array<Partial<D1ShipmentRecord> & { os_code?: string }> }).shipments
          : [body as Partial<D1ShipmentRecord> & { os_code?: string }];

      if (!rawList.length) {
        res.status(400).json({ ok: false, error: 'Payload shipments kosong.' });
        return;
      }
      if (rawList.length > 500) {
        res.status(400).json({ ok: false, error: 'Maksimal 500 baris per batch upsert.' });
        return;
      }

      const validIncoming = rawList.map((item) => {
        const osCode = cleanText(item?.os_code).toUpperCase();
        if (!osCode) {
          throw new Error('Field os_code wajib diisi pada setiap baris shipment.');
        }
        return { ...item, os_code: osCode };
      });

      const nowIso = new Date().toISOString();
      const result = upsertD1RecordsInList(edgeStoreShipments, validIncoming, nowIso);
      edgeStoreShipments = result.next;

      res.json({
        ok: true,
        count: result.upserted.length,
        shipments: result.upserted,
        synced_at: nowIso,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal menyimpan shipment ke D1.',
      });
    }
  });

  app.patch('/api/shipments/:id', async (req: Request, res: Response) => {
    try {
      const targetId = cleanText(req.params.id);
      if (!targetId) {
        res.status(400).json({ ok: false, error: 'ID shipment tidak valid.' });
        return;
      }

      if (USE_CLOUDFLARE_PROXY) {
        await proxyToCloudflareWorker(req, res, `/api/shipments/${encodeURIComponent(targetId)}`);
        return;
      }

      const nowIso = new Date().toISOString();
      const patchBody = (req.body || {}) as Partial<D1ShipmentRecord>;
      const result = patchD1RecordInList(edgeStoreShipments, targetId, patchBody, nowIso);
      if (!result.updated) {
        res.status(404).json({ ok: false, error: `Shipment "${targetId}" tidak ditemukan.` });
        return;
      }
      edgeStoreShipments = result.next;

      res.json({
        ok: true,
        shipment: result.updated,
        synced_at: nowIso,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal memperbarui shipment D1.',
      });
    }
  });

  app.delete('/api/shipments/:id', async (req: Request, res: Response) => {
    try {
      const targetId = cleanText(req.params.id);
      if (!targetId) {
        res.status(400).json({ ok: false, error: 'ID shipment tidak valid.' });
        return;
      }

      if (USE_CLOUDFLARE_PROXY) {
        await proxyToCloudflareWorker(req, res, `/api/shipments/${encodeURIComponent(targetId)}`);
        return;
      }

      const nowIso = new Date().toISOString();
      const result = softDeleteD1RecordInList(edgeStoreShipments, targetId, nowIso);
      if (!result.deleted) {
        res.status(404).json({ ok: false, error: `Shipment "${targetId}" tidak ditemukan.` });
        return;
      }
      edgeStoreShipments = result.next;

      res.json({
        ok: true,
        deleted: true,
        shipment: result.deleted,
        synced_at: nowIso,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal menghapus (soft delete) shipment D1.',
      });
    }
  });

  const httpServer = http.createServer(app);

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      plugins: hmrDisabled
        ? [
            {
              name: 'ptg-disable-vite-client-ws',
              transform(code: string, id: string) {
                const cleanId = id.split('?')[0].replace(/\\/g, '/');
                if (cleanId.endsWith('/vite/dist/client/client.mjs')) {
                  const startMarker = 'const transport = normalizeModuleRunnerTransport(';
                  const endMarker = 'let willUnload = false;';
                  const startIdx = code.indexOf(startMarker);
                  const endIdx = code.indexOf(endMarker, startIdx);
                  if (startIdx !== -1 && endIdx !== -1) {
                    const noopTransport =
                      'const transport = normalizeModuleRunnerTransport({ async connect() {}, async disconnect() {}, send() {} });\n';
                    return {
                      code: code.slice(0, startIdx) + noopTransport + code.slice(endIdx),
                      map: null,
                    };
                  }
                }
              },
            },
          ]
        : [],
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
        ws: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output dist/index.html tidak ditemukan.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[PTG PPJK Server] Listening on http://0.0.0.0:${PORT} (${
        USE_CLOUDFLARE_PROXY ? 'Cloudflare D1 Worker Proxy' : 'Local D1 Edge Contract Store'
      })`
    );
  });
}

void startServer();
