/**
 * Zero-dependency local dev server.
 *
 *   npm start          -> http://localhost:4173
 *   PORT=8080 npm start
 *   ADMIN_PASS=... npm start   (passphrase for the /admin helper)
 *
 * Serves the static site, falls back to index.html for client-side routes
 * (/perp-dex-list, /points-sheet) — mirroring the Vercel/Netlify rewrites —
 * and exposes two LOCAL-ONLY write endpoints used by /admin:
 *
 *   POST /api/dexes   { pass, dexes }          -> writes data/dexes.json
 *   POST /api/asset   { pass, dir, name, data }-> writes assets/<dir>/<name>
 *
 * These endpoints only answer on 127.0.0.1 and only when the passphrase
 * matches ADMIN_PASS (default "perpfarm"). Deployed hosts never run this file.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_PASS = process.env.ADMIN_PASS || 'perpfarm';
const MAX_BODY = 8 * 1024 * 1024; // 8 MB (images)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8',
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Cache-Control': 'no-cache', ...headers });
  res.end(body);
};

const sendJson = (res, status, obj) =>
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
  });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const isLoopback = (req) => {
  const addr = req.socket.remoteAddress || '';
  const host = String(req.headers.host || '');
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1' || /^localhost(:\d+)?$/.test(host);
};

async function handleApi(req, res, pathname) {
  if (!isLoopback(req)) return send(res, 403, 'Local only', { 'Content-Type': 'text/plain' });

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: error.message });
  }
  if (String(body.pass || '') !== ADMIN_PASS) {
    return sendJson(res, 401, { ok: false, error: 'Wrong passphrase.' });
  }

  if (pathname === '/api/dexes') {
    const dexes = body.dexes;
    if (!Array.isArray(dexes)) return sendJson(res, 400, { ok: false, error: '`dexes` must be an array.' });
    const ids = new Set();
    for (const d of dexes) {
      if (!d || typeof d !== 'object' || !d.id || !d.name) {
        return sendJson(res, 400, { ok: false, error: 'Every entry needs at least an id and a name.' });
      }
      if (ids.has(d.id)) return sendJson(res, 400, { ok: false, error: `Duplicate id: ${d.id}` });
      ids.add(d.id);
    }
    const file = path.join(ROOT, 'data', 'dexes.json');
    fs.writeFileSync(file, JSON.stringify({ $comment: DEX_COMMENT, dexes }, null, 2) + '\n');
    return sendJson(res, 200, { ok: true, count: dexes.length });
  }

  if (pathname === '/api/asset') {
    const dirs = { logos: 'logos', sheets: 'points-sheets' };
    const dir = dirs[body.dir];
    if (!dir) return sendJson(res, 400, { ok: false, error: 'dir must be "logos" or "sheets".' });
    const name = path.basename(String(body.name || ''));
    if (!/^[a-z0-9._-]+\.(png|jpe?g|webp|gif|svg)$/i.test(name)) {
      return sendJson(res, 400, { ok: false, error: 'Use a plain filename ending in .png/.jpg/.webp/.gif/.svg' });
    }
    const b64 = String(body.data || '');
    if (!/^data:image\/[a-z+.-]+;base64,/.test(b64)) {
      return sendJson(res, 400, { ok: false, error: 'Expected a base64 data URL.' });
    }
    const buf = Buffer.from(b64.split(',')[1], 'base64');
    const target = path.join(ROOT, 'assets', dir, name);
    fs.writeFileSync(target, buf);
    return sendJson(res, 200, { ok: true, path: `/assets/${dir}/${name}`, bytes: buf.length });
  }

  return sendJson(res, 404, { ok: false, error: 'Unknown endpoint' });
}

const DEX_COMMENT =
  'Single source of truth for every Perp DEX shown on the site. Add an object to this array and the DEX appears automatically on both pages (icon, link, animations and detail view). Order on the page is controlled by displayOrder.';

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith('/api/') && req.method === 'POST') {
      return await handleApi(req, res, pathname);
    }
    if (pathname.startsWith('/api/')) return sendJson(res, 405, { ok: false, error: 'POST only' });

    // Never escape the project root.
    const candidate = path.join(ROOT, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
    if (!candidate.startsWith(ROOT)) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });

    if (fs.existsSync(candidate)) {
      if (fs.statSync(candidate).isDirectory()) {
        const indexFile = path.join(candidate, 'index.html');
        if (fs.existsSync(indexFile)) return serveFile(res, indexFile);
      } else {
        return serveFile(res, candidate);
      }
    }

    // SPA fallback: /perp-dex-list, /points-sheet, /anything -> index.html
    if (!path.extname(pathname)) return serveFile(res, path.join(ROOT, 'index.html'));

    return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
  } catch (error) {
    return send(res, 500, `Server error: ${error.message}`, { 'Content-Type': 'text/plain' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Perp Farming Guide — local server`);
  console.log(`  ➜  http://localhost:${PORT}`);
  console.log(`  ➜  http://localhost:${PORT}/admin/   (passphrase: ${ADMIN_PASS})\n`);
  console.log('  Press Ctrl+C to stop.\n');
});
