import {
  database,
  getSession,
  getSnapshot,
  handleError,
  HttpError,
  json,
  parseJsonBody,
  randomToken,
  requireCsrf,
  requireGuild,
  requireSession,
  snapshotIsFresh,
  tryWakeControlWorker,
} from './_lib/control.js';
import {
  normalizeActionType,
  requireBrowserPermission,
  validateActionPayload,
} from './_lib/actions.js';

function idempotencyKey(req, body) {
  const header = req.headers['idempotency-key'];
  const value = String(body.idempotency_key || (Array.isArray(header) ? header[0] : header) || '').trim();
  if (!/^[A-Za-z0-9._:-]{8,100}$/.test(value)) {
    throw new HttpError(400, 'A valid idempotency key is required.');
  }
  return value;
}

function actionJson(row) {
  return {
    id: row.id,
    guild_id: String(row.guild_id),
    action_type: row.action_type,
    status: row.status,
    created_at: row.created_at,
  };
}

async function respondWithWake(res, status, row, duplicate) {
  if (row.status === 'queued' && !(await tryWakeControlWorker())) {
    throw new HttpError(
      503,
      'The action is safely queued, but Rob-bot could not be woken. This request can be retried without duplicating the action.',
    );
  }
  json(res, status, {
    action: actionJson(row),
    duplicate,
    wake_delivered: true,
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.statusCode = 405;
      res.end();
      return;
    }

    const session = requireSession(await getSession(req));
    requireCsrf(req, session);
    const body = await parseJsonBody(req);
    const guildId = String(body.guild_id || '').trim();
    if (!/^\d{1,20}$/.test(guildId)) throw new HttpError(400, 'A valid guild_id is required.');
    const oauthGuild = requireGuild(session, guildId);
    const actionType = normalizeActionType(body.action_type);
    requireBrowserPermission(oauthGuild, actionType);
    const payload = validateActionPayload(actionType, body.payload || {});
    const key = idempotencyKey(req, body);

    const snapshot = await getSnapshot(guildId);
    if (!snapshot || !snapshotIsFresh(snapshot)) {
      throw new HttpError(503, 'Rob-bot is not reporting fresh server state. Wait for it to reconnect before making changes.');
    }

    const sql = database();
    const rateRows = await sql`
      SELECT COUNT(*) AS count
      FROM control_actions
      WHERE guild_id = ${guildId}
        AND actor_id = ${session.userId}
        AND action_type <> 'refresh_snapshot'
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '60 seconds'
    `;
    if (Number(rateRows[0]?.count || 0) >= 20) {
      throw new HttpError(429, 'Too many control changes were requested. Wait a minute and retry.');
    }

    const actionId = randomToken(16);
    const inserted = await sql`
      INSERT INTO control_actions (
        id, guild_id, actor_id, action_type, payload_json, idempotency_key, status
      ) VALUES (
        ${actionId},
        ${guildId},
        ${session.userId},
        ${actionType},
        ${JSON.stringify(payload)}::json,
        ${key},
        'queued'
      )
      ON CONFLICT ON CONSTRAINT uq_control_actions_actor_idempotency DO NOTHING
      RETURNING id, guild_id, action_type, status, created_at
    `;

    if (inserted[0]) {
      await respondWithWake(res, 202, inserted[0], false);
      return;
    }

    const existing = await sql`
      SELECT id, guild_id, action_type, status, created_at
      FROM control_actions
      WHERE guild_id = ${guildId}
        AND actor_id = ${session.userId}
        AND idempotency_key = ${key}
      LIMIT 1
    `;
    if (!existing[0]) throw new HttpError(409, 'The action retry could not be resolved safely.');
    if (existing[0].action_type !== actionType) {
      throw new HttpError(409, 'That idempotency key was already used for a different action.');
    }
    await respondWithWake(res, 200, existing[0], true);
  } catch (error) {
    handleError(res, error);
  }
}
