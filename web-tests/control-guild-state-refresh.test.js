import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createSqliteTaggedClient } from '../api/_lib/sqlite-database.js';

const directory = mkdtempSync(join(tmpdir(), 'rob-guild-state-'));
const databasePath = join(directory, 'control.db');
const sql = createSqliteTaggedClient(databasePath);
const rawSession = 'session-token';
const rawCsrf = 'csrf-token';
const guildId = '123456789012345678';
let handler;

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    end(body = '') { this.body = String(body); },
    headers,
  };
}

function request() {
  return {
    method: 'GET',
    url: `/api/guild-state?guild_id=${guildId}`,
    headers: {
      host: 'localhost',
      cookie: `rob_control_session=${rawSession}; rob_control_csrf=${rawCsrf}`,
    },
  };
}

async function resetState() {
  await sql`DELETE FROM control_actions`;
  await sql`DELETE FROM control_guild_snapshots`;
  await sql`DELETE FROM control_sessions`;
  await sql`
    INSERT INTO control_sessions (
      session_hash, csrf_hash, user_id, username, avatar_url, guilds_json,
      created_at, last_seen_at, expires_at
    ) VALUES (
      ${hash(rawSession)}, ${hash(rawCsrf)}, ${'42'}, ${'Tester'}, ${null},
      ${JSON.stringify([{ id: guildId, name: 'Test Guild', owner: false, permissions: String(0x20n) }])}::json,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, datetime(CURRENT_TIMESTAMP, '+1 hour')
    )
  `;
}

async function invokeWithFastTimeouts() {
  const originalNow = Date.now;
  const originalSetTimeout = globalThis.setTimeout;
  let now = 1_000_000;
  Date.now = () => {
    now += 1_000;
    return now;
  };
  globalThis.setTimeout = (callback, _ms, ...args) => {
    queueMicrotask(() => callback(...args));
    return { unref() {} };
  };
  try {
    const res = responseRecorder();
    await handler(request(), res);
    return res;
  } finally {
    Date.now = originalNow;
    globalThis.setTimeout = originalSetTimeout;
  }
}

test.before(async () => {
  process.env.CONTROL_SQLITE_PATH = databasePath;
  process.env.CONTROL_WORKER_MODE = 'always_on';
  process.env.CONTROL_BASE_URL = 'http://localhost';
  delete process.env.DATABASE_URL;
  delete process.env.CONTROL_WAKE_WEBHOOK_URL;

  await sql`
    CREATE TABLE control_sessions (
      session_hash TEXT PRIMARY KEY, csrf_hash TEXT NOT NULL, user_id TEXT NOT NULL,
      username TEXT NOT NULL, avatar_url TEXT, guilds_json TEXT NOT NULL,
      created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, expires_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE control_guild_snapshots (
      guild_id TEXT PRIMARY KEY, snapshot_json TEXT NOT NULL, worker_version TEXT, updated_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE control_actions (
      id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, actor_id TEXT NOT NULL, action_type TEXT NOT NULL,
      payload_json TEXT NOT NULL, idempotency_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
      claimed_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (guild_id, actor_id, idempotency_key)
    )
  `;
  ({ default: handler } = await import(`../api/guild-state.js?test=${Date.now()}`));
});

test.after(() => {
  rmSync(directory, { recursive: true, force: true });
});

test.beforeEach(resetState);

test('fresh guild state returns 200 without queuing refresh work', async () => {
  await sql`
    INSERT INTO control_guild_snapshots (guild_id, snapshot_json, worker_version, updated_at)
    VALUES (${guildId}, ${JSON.stringify({ guild: { id: guildId, name: 'Test Guild' } })}::json, ${'test'}, CURRENT_TIMESTAMP)
  `;
  const res = responseRecorder();

  await handler(request(), res);

  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).snapshot.fresh, true);
  const actions = await sql`SELECT id FROM control_actions`;
  assert.equal(actions.length, 0);
});

test('missing guild state queues refresh and returns 202 immediately', async () => {
  const res = await invokeWithFastTimeouts();
  const body = JSON.parse(res.body);

  assert.equal(res.statusCode, 202);
  assert.equal(body.guild_id, guildId);
  assert.equal(body.status, 'refreshing');
  assert.equal(body.retry_after_ms, 1000);
  assert.equal(String(res.getHeader('Retry-After')), '1');
  const actions = await sql`SELECT action_type, status FROM control_actions`;
  assert.deepEqual(actions, [{ action_type: 'refresh_snapshot', status: 'queued' }]);
});


test('recent queued snapshot refresh is reused instead of duplicated', async () => {
  await sql`
    INSERT INTO control_actions (
      id, guild_id, actor_id, action_type, payload_json, idempotency_key, status, created_at
    ) VALUES (
      ${'existing-queued'}, ${guildId}, ${'42'}, ${'refresh_snapshot'}, ${JSON.stringify({})}::json,
      ${'older-bucket-key'}, ${'queued'}, CURRENT_TIMESTAMP
    )
  `;
  const res = responseRecorder();

  await handler(request(), res);

  assert.equal(res.statusCode, 202);
  const actions = await sql`SELECT id, status FROM control_actions ORDER BY created_at, id`;
  assert.deepEqual(actions, [{ id: 'existing-queued', status: 'queued' }]);
});

test('recent claimed snapshot refresh is reused instead of duplicated', async () => {
  await sql`
    INSERT INTO control_actions (
      id, guild_id, actor_id, action_type, payload_json, idempotency_key, status, created_at
    ) VALUES (
      ${'existing-claimed'}, ${guildId}, ${'42'}, ${'refresh_snapshot'}, ${JSON.stringify({})}::json,
      ${'older-bucket-key'}, ${'claimed'}, CURRENT_TIMESTAMP
    )
  `;
  const res = responseRecorder();

  await handler(request(), res);

  assert.equal(res.statusCode, 202);
  const actions = await sql`SELECT id, status FROM control_actions ORDER BY created_at, id`;
  assert.deepEqual(actions, [{ id: 'existing-claimed', status: 'claimed' }]);
});

test('stale claimed snapshot refresh does not suppress a new retry', async () => {
  await sql`
    INSERT INTO control_actions (
      id, guild_id, actor_id, action_type, payload_json, idempotency_key, status, created_at
    ) VALUES (
      ${'stale-claimed'}, ${guildId}, ${'42'}, ${'refresh_snapshot'}, ${JSON.stringify({})}::json,
      ${'stale-key'}, ${'claimed'}, datetime(CURRENT_TIMESTAMP, '-31 seconds')
    )
  `;
  const res = responseRecorder();

  await handler(request(), res);

  assert.equal(res.statusCode, 202);
  const actions = await sql`SELECT id FROM control_actions`;
  assert.equal(actions.length, 2);
});

test('same-bucket refresh requests remain idempotent', async () => {
  const originalNow = Date.now;
  Date.now = () => 5_000_000;
  try {
    const first = responseRecorder();
    const second = responseRecorder();
    await handler(request(), first);
    await handler(request(), second);
    assert.equal(first.statusCode, 202);
    assert.equal(second.statusCode, 202);
  } finally {
    Date.now = originalNow;
  }
  const actions = await sql`SELECT id FROM control_actions`;
  assert.equal(actions.length, 1);
});

test('webhook wake failure still returns refreshing without blocking', async () => {
  const previousMode = process.env.CONTROL_WORKER_MODE;
  const previousWebhook = process.env.CONTROL_WAKE_WEBHOOK_URL;
  process.env.CONTROL_WORKER_MODE = 'webhook';
  delete process.env.CONTROL_WAKE_WEBHOOK_URL;
  try {
    const res = responseRecorder();
    await handler(request(), res);
    assert.equal(res.statusCode, 202);
    assert.equal(JSON.parse(res.body).status, 'refreshing');
  } finally {
    process.env.CONTROL_WORKER_MODE = previousMode;
    if (previousWebhook === undefined) delete process.env.CONTROL_WAKE_WEBHOOK_URL;
    else process.env.CONTROL_WAKE_WEBHOOK_URL = previousWebhook;
  }
});
