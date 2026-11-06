/**
 * SNGP 06 — serveur applicatif.
 * Node.js natif, sans dépendance externe.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initDb, getDb, saveNow } from './store.js';
import { sessionFromRequest, matchRoute, HttpError } from './routes.js';
import { subscribe } from './events.js';
import { demarrerSimulation, arreterSimulation } from './sim.js';
import { can } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new HttpError(413, 'Requête trop volumineuse.'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, 'Corps de requête JSON invalide.'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  if (rel === '/index.html' || rel === '/') rel = '/index.html';
  const file = path.resolve(PUBLIC_DIR, '.' + rel);
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Interdit');
    return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      // Application monopage : toute autre URL est servie par index.html
      if (!path.extname(rel)) return serveStatic(req, res, '/index.html');
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Ressource introuvable');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=60',
      ETag: etag,
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');

  try {
    if (pathname === '/api/health') {
      return sendJson(res, 200, { statut: 'OK', version: getDb().meta.version, heure: new Date().toISOString() });
    }

    if (pathname === '/api/events' && req.method === 'GET') {
      const session = sessionFromRequest(req);
      if (!session) return sendJson(res, 401, { error: 'Authentification requise.' });
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 3000\n\n');
      subscribe(res);
      return;
    }

    if (pathname.startsWith('/api/')) {
      const matched = matchRoute(req.method, pathname);
      if (!matched) return sendJson(res, 404, { error: `Route inconnue : ${req.method} ${pathname}` });

      const { route, params } = matched;
      const db = getDb();
      const session = route.public ? null : sessionFromRequest(req);
      if (!route.public && !session) {
        return sendJson(res, 401, { error: 'Session expirée. Veuillez vous reconnecter.' });
      }
      const user = session ? db.users.find((u) => u.matricule === session.matricule) : null;
      if (session && (!user || !user.actif)) {
        return sendJson(res, 401, { error: 'Compte introuvable ou désactivé.' });
      }
      if (route.role && user?.role !== route.role) {
        return sendJson(res, 403, { error: 'Droits insuffisants pour accéder à cette ressource.' });
      }
      if (route.permission && !can(user.role, route.permission)) {
        return sendJson(res, 403, { error: 'Votre profil ne permet pas cette action.' });
      }

      const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {};
      const ctx = {
        req,
        res,
        params,
        query: Object.fromEntries(url.searchParams.entries()),
        body,
        user,
        session,
      };
      const result = await route.handler(ctx);
      if (result !== undefined) sendJson(res, 200, result);
      else if (!res.writableEnded) sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Méthode non autorisée.' });
    }
    serveStatic(req, res, pathname);
  } catch (err) {
    if (err instanceof HttpError) {
      sendJson(res, err.status, { error: err.message, ...err.extra });
    } else {
      console.error('[api] erreur', err);
      sendJson(res, 500, { error: 'Erreur interne du serveur. Consultez le journal du serveur.' });
    }
  }
});

initDb();
demarrerSimulation();

server.listen(PORT, HOST, () => {
  console.log(`\n  SNGP 06 — ${getDb().settings.organisation}`);
  console.log(`  Serveur démarré sur http://${HOST}:${PORT}\n`);
});

function shutdown() {
  console.log('\n[serveur] arrêt en cours…');
  arreterSimulation();
  saveNow();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
