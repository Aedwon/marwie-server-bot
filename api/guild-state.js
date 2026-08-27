import {
  controlBaseUrl,
  database,
  getSession,
  getSnapshot,
  handleError,
  HttpError,
  json,
  randomToken,
  requireGuild,
  requireSession,
  snapshotIsFresh,
  tryWakeControlWorker,
} from './_lib/control.js';

const REFRESH_BUCKET_MS = 5 * 1000;
const REFRESH_WAIT_MS = 75 * 1000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestSnapshotRefresh(session, guildId) {
  const sql = database();
  const key = `snapshot-refresh:${Math.floor(Date.now() / REFRESH_BUCKET_MS)}`;
  const actionId = randomToken(16);
  const inserted = await sql`
    INSERT INTO control_actions (
      id, guild_id, actor_id, action_type, payload_json, idempotency_key, status
    ) VALUES (
      ${actionId},
      ${guildId},
      ${session.userId},
      'refresh_snapshot',
      ${JSON.stringify({})}::json,
      ${key},
      'queued'
    )
    ON CONFLICT ON CONSTRAINT uq_control_actions_actor_idempotency DO NOTHING
    RETURNING id, status
  `;

  if (inserted[0]) return await tryWakeControlWorker();

  const existing = await sql`
    SELECT id, status
    FROM control_actions
    WHERE guild_id = ${guildId}
      AND actor_id = ${session.userId}
      AND idempotency_key = ${key}
    LIMIT 1
  `;
  if (!existing[0] || existing[0].status === 'queued') return await tryWakeControlWorker();
  return true;
}

async function waitForFreshSnapshot(guildId, wakeDelivered) {
  const deadline = Date.now() + REFRESH_WAIT_MS;
  let nextWakeRetry = Date.now() + 5 * 1000;
  let delivered = wakeDelivered;

  while (Date.now() < deadline) {
    await sleep(1000);
    const row = await getSnapshot(guildId);
    if (row && snapshotIsFresh(row)) return row;

    if (!delivered && Date.now() >= nextWakeRetry) {
      delivered = await tryWakeControlWorker();
      nextWakeRetry = Date.now() + 5 * 1000;
    }
  }
  return null;
}

function sendSnapshot(res, row) {
  json(res, 200, {
    guild_id: String(row.guild_id),
    state: row.snapshot_json,
    snapshot: {
      updated_at: row.updated_at,
      worker_version: row.worker_version,
      fresh: true,
    },
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.statusCode = 405;
      res.end();
      return;
    }
    const session = requireSession(await getSession(req, { touch: false }));
    const requestUrl = new URL(req.url, controlBaseUrl(req));
    const guildId = requestUrl.searchParams.get('guild_id');
    if (!guildId || !/^\d{1,20}$/.test(guildId)) throw new HttpError(400, 'A valid guild_id is required.');
    requireGuild(session, guildId);

    const current = await getSnapshot(guildId);
    if (current && snapshotIsFresh(current)) {
      sendSnapshot(res, current);
      return;
    }

    const wakeDelivered = await requestSnapshotRefresh(session, guildId);
    const refreshed = await waitForFreshSnapshot(guildId, wakeDelivered);
    if (!refreshed) {
      throw new HttpError(
        503,
        'Rob-bot did not publish fresh server state in time. Retry in a moment.',
      );
    }
    sendSnapshot(res, refreshed);
  } catch (error) {
    handleError(res, error);
  }
}
