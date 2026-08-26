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

  if (inserted[0]) {
    return {
      action_id: inserted[0].id,
      wake_delivered: await tryWakeControlWorker(),
    };
  }

  const existing = await sql`
    SELECT id, status
    FROM control_actions
    WHERE guild_id = ${guildId}
      AND actor_id = ${session.userId}
      AND idempotency_key = ${key}
    LIMIT 1
  `;
  return {
    action_id: existing[0]?.id || null,
    wake_delivered: null,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.statusCode = 405;
      res.end();
      return;
    }
    const session = requireSession(await getSession(req));
    const requestUrl = new URL(req.url, controlBaseUrl(req));
    const guildId = requestUrl.searchParams.get('guild_id');
    if (!guildId || !/^\d{1,20}$/.test(guildId)) throw new HttpError(400, 'A valid guild_id is required.');
    requireGuild(session, guildId);

    const row = await getSnapshot(guildId);
    if (row && snapshotIsFresh(row)) {
      json(res, 200, {
        guild_id: String(row.guild_id),
        state: row.snapshot_json,
        snapshot: {
          updated_at: row.updated_at,
          worker_version: row.worker_version,
          fresh: true,
        },
        refresh_pending: false,
      });
      return;
    }

    const refresh = await requestSnapshotRefresh(session, guildId);
    json(res, 202, {
      guild_id: guildId,
      state: row?.snapshot_json || null,
      snapshot: row ? {
        updated_at: row.updated_at,
        worker_version: row.worker_version,
        fresh: false,
      } : null,
      refresh_pending: true,
      refresh_action_id: refresh.action_id,
      wake_delivered: refresh.wake_delivered,
    });
  } catch (error) {
    handleError(res, error);
  }
}
