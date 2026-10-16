import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_LOCAL_HOST = '127.0.0.1';
export const DEFAULT_LOCAL_PORT = 8787;

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SITE_ROOT = resolve(MODULE_DIR, '../docs-site');

const API_LOADERS = new Map([
  ['/api/action-status', () => import('../api/action-status.js')],
  ['/api/action', () => import('../api/action.js')],
  ['/api/activity', () => import('../api/activity.js')],
  ['/api/auth/callback', () => import('../api/auth/callback.js')],
  ['/api/auth/start', () => import('../api/auth/start.js')],
  ['/api/guild-state', () => import('../api/guild-state.js')],
  ['/api/logout', () => import('../api/logout.js')],
  ['/api/page-save', () => import('../api/page-save.js')],
  ['/api/session', () => import('../api/session.js')],
  ['/api/setup', () => import('../api/setup.js')],
]);

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

function jsonResponse(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function pageRoute(pathname) {
  if (pathname === '/' || pathname === '/control' || pathname.startsWith('/control/')) return 'control.html';
  if (pathname === '/commands') return 'commands.html';
  if (pathname === '/handbook') return 'index.html';
  return null;
}

function confinedPath(siteRoot, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const relative = decoded.replace(/^\/+/, '');
  const candidate = resolve(siteRoot, relative);
  if (candidate !== siteRoot && !candidate.startsWith(`${siteRoot}${sep}`)) return null;
  return candidate;
}

async function existingStaticFile(siteRoot, pathname) {
  const routedPage = pageRoute(pathname);
  if (routedPage) return resolve(siteRoot, routedPage);

  const candidate = confinedPath(siteRoot, pathname);
  if (!candidate || candidate === siteRoot) return null;
  const candidates = extname(candidate) ? [candidate] : [candidate, `${candidate}.html`];
  for (const path of candidates) {
    try {
      const info = await stat(path);
      if (info.isFile()) return path;
    } catch {
      // Try the next safe candidate.
    }
  }
  return null;
}

async function serveStatic(req, res, siteRoot, pathname) {
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end();
    return;
  }
  const filePath = await existingStaticFile(siteRoot, pathname);
  if (!filePath) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME_TYPES.get(extname(filePath).toLowerCase()) || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  });
  stream.pipe(res);
}

export function createLocalServer({ siteRoot = DEFAULT_SITE_ROOT, apiLoaders = API_LOADERS } = {}) {
  const resolvedSiteRoot = resolve(siteRoot);
  return createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', 'http://localhost');
      const pathname = requestUrl.pathname;

      if (pathname === '/healthz') {
        if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
          res.statusCode = 405;
          res.setHeader('Allow', 'GET, HEAD');
          res.end();
          return;
        }
        if (req.method === 'HEAD') {
          res.statusCode = 200;
          res.end();
        } else {
          jsonResponse(res, 200, { ok: true });
        }
        return;
      }

      if (pathname.startsWith('/api/')) {
        const loadHandler = apiLoaders.get(pathname);
        if (!loadHandler) {
          jsonResponse(res, 404, { error: 'Not found.' });
          return;
        }
        const module = await loadHandler();
        await module.default(req, res);
        return;
      }

      await serveStatic(req, res, resolvedSiteRoot, pathname);
    } catch (error) {
      console.error('Local web request failed.', error);
      if (!res.headersSent) jsonResponse(res, 500, { error: 'Local web service failed unexpectedly.' });
      else res.end();
    }
  });
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (isMainModule()) {
  const host = process.env.LOCAL_WEB_HOST?.trim() || DEFAULT_LOCAL_HOST;
  const port = Number(process.env.LOCAL_WEB_PORT || DEFAULT_LOCAL_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('LOCAL_WEB_PORT must be an integer from 1 through 65535.');
  }
  const server = createLocalServer();
  server.listen(port, host, () => {
    console.log(`Rob-bot web listening on http://${host}:${port}`);
  });
}
