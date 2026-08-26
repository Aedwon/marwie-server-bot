import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { neon } from '@neondatabase/serverless';

export const SESSION_COOKIE = 'rob_control_session';
export const CSRF_COOKIE = 'rob_control_csrf';
export const OAUTH_STATE_COOKIE = 'rob_oauth_state';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const SNAPSHOT_MAX_AGE_MS = 3 * 60 * 1000;

let sqlClient;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function database() {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL || process.env.CONTROL_DATABASE_URL;
    if (!url) throw new HttpError(503, 'Control database is not configured.');
    sqlClient = neon(url);
  }
  return sqlClient;
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new HttpError(503, `${name} is not configured.`);
  return value;
}

export function controlBaseUrl(req) {
  const configured = process.env.CONTROL_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) throw new HttpError(500, 'Could not determine control-panel origin.');
  const proto = req.headers['x-forwarded-proto'] || (String(host).startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const values = {};
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      values[key] = decodeURIComponent(value);
    } catch {
      values[key] = value;
    }
  }
  return values;
}

function secureCookie(req) {
  try {
    return new URL(controlBaseUrl(req)).protocol === 'https:';
  } catch {
    return true;
  }
}

export function cookie(req, name, value, { maxAge, path = '/', httpOnly = true, sameSite = 'Lax' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) parts.push('HttpOnly');
  if (secureCookie(req)) parts.push('Secure');
  if (Number.isFinite(maxAge)) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return parts.join('; ');
}

export function clearCookie(req, name, path = '/') {
  return cookie(req, name, '', { maxAge: 0, path });
}

export function appendSetCookie(res, value) {
  const current = res.getHeader('Set-Cookie');
  if (!current) res.setHeader('Set-Cookie', [value]);
  else if (Array.isArray(current)) res.setHeader('Set-Cookie', [...current, value]);
  else res.setHeader('Set-Cookie', [String(current), value]);
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

export function hashToken(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function guildPermissionBits(guild) {
  try {
    return BigInt(String(guild.permissions || '0'));
  } catch {
    return 0n;
  }
}

export function guildCanManage(guild) {
  const bits = guildPermissionBits(guild);
  return Boolean(guild.owner) || (bits & 0x8n) !== 0n || (bits & 0x20n) !== 0n;
}

export function guildIsAdministrator(guild) {
  return Boolean(guild.owner) || (guildPermissionBits(guild) & 0x8n) !== 0n;
}

export function sessionGuild(session, guildId) {
  const wanted = String(guildId);
  return session.guilds.find((guild) => String(guild.id) === wanted) || null;
}

export async function getSession(req, { touch = true } = {}) {
  const cookies = parseCookies(req);
  const rawSession = cookies[SESSION_COOKIE];
  const rawCsrf = cookies[CSRF_COOKIE];
  if (!rawSession || !rawCsrf) return null;

  const sql = database();
  const sessionHash = hashToken(rawSession);
  const rows = await sql`
    SELECT session_hash, csrf_hash, user_id, username, avatar_url, guilds_json,
           created_at, last_seen_at, expires_at
    FROM control_sessions
    WHERE session_hash = ${sessionHash}
      AND expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || !safeEqual(hashToken(rawCsrf), row.csrf_hash)) return null;

  if (touch) {
    await sql`
      UPDATE control_sessions
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE session_hash = ${sessionHash}
    `;
  }

  const guilds = Array.isArray(row.guilds_json) ? row.guilds_json.filter(guildCanManage) : [];
  return {
    sessionHash,
    csrfToken: rawCsrf,
    userId: Number(row.user_id),
    username: row.username,
    avatarUrl: row.avatar_url,
    guilds,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export function requireSession(session) {
  if (!session) throw new HttpError(401, 'Sign in with Discord to use Control.');
  return session;
}

export function requireGuild(session, guildId) {
  const guild = sessionGuild(session, guildId);
  if (!guild) throw new HttpError(403, 'You no longer have Manage Server access to that server.');
  return guild;
}

export function requireSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let expected;
  try {
    expected = new URL(controlBaseUrl(req)).origin;
  } catch {
    throw new HttpError(403, 'Request origin could not be verified.');
  }
  if (origin !== expected) throw new HttpError(403, 'Cross-origin control requests are not allowed.');
}

export function requireCsrf(req, session) {
  requireSameOrigin(req);
  const supplied = req.headers['x-rob-csrf'];
  if (typeof supplied !== 'string' || !safeEqual(supplied, session.csrfToken)) {
    throw new HttpError(403, 'Control session verification failed. Refresh the page and retry.');
  }
}

export async function getSnapshot(guildId) {
  const sql = database();
  const rows = await sql`
    SELECT guild_id, snapshot_json, worker_version, updated_at
    FROM control_guild_snapshots
    WHERE guild_id = ${Number(guildId)}
    LIMIT 1
  `;
  return rows[0] || null;
}

export function snapshotIsFresh(row, maxAgeMs = SNAPSHOT_MAX_AGE_MS) {
  if (!row?.updated_at) return false;
  const age = Date.now() - new Date(row.updated_at).getTime();
  return Number.isFinite(age) && age >= 0 && age <= maxAgeMs;
}

export async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      throw new HttpError(400, 'Request body must be valid JSON.');
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function redirect(res, location, status = 302) {
  res.statusCode = status;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

export function handleError(res, error) {
  if (error instanceof HttpError) {
    json(res, error.status, { error: error.message });
    return;
  }
  console.error(error);
  json(res, 500, { error: 'The control service failed unexpectedly.' });
}
