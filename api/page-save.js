import {
  database,
  getSession,
  handleError,
  HttpError,
  json,
  parseJsonBody,
  randomToken,
  requireCsrf,
  requireGuild,
  requireSession,
  tryWakeControlWorker,
} from './_lib/control.js';
import {
  normalizeActionType,
  requireBrowserPermission,
  validateActionPayload,
} from './_lib/actions.js';
import { pageSavePayloadMatches, validatePageSavePayload } from './_lib/page-save.js';

const ACTION_TYPE = 'save_page';

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
      'The save is safely queued, but Rob-bot could not be woken. This request can be retried without duplicating the save.',
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

    const session = requireSession(await getSession(req, { touch: false }));
    requireCsrf(req, session);
    const body = await parseJsonBody(req);
    const guildId = String(body.guild_id || '').trim();
    if (!/^\d{1,20}$/.test(guildId)) throw new HttpError(400, 'A valid guild_id is required.');
    const oauthGuild = requireGuild(session, guildId);
    const payload = validatePageSavePayload(body.payload || {}, {
      normalizeActionType,
      validateActionPayload,
      HttpError,
    });
    for (const change of payload.changes) {
      requireBrowserPermission(oauthGuild, change.action_type);
    }
    const key = idempotencyKey(req, body);

    const sql = database();
    const actionId = randomToken(16);
    const inserted = await sql`
      INSERT INTO control_actions (
        id, guild_id, actor_id, action_type, payload_json, idempotency_key, status
      )
      SELECT
        ${actionId},
        ${guildId},
        ${session.userId},
        ${ACTION_TYPE},
        ${JSON.stringify(payload)}::json,
        ${key},
        'queued'
      WHERE EXISTS (
        SELECT 1
        FROM control_guild_snapshots
        WHERE guild_id = ${guildId}
          AND updated_at <= CURRENT_TIMESTAMP
          AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '3 minutes'
      )
        AND (
          SELECT COUNT(*)
          FROM control_actions
          WHERE guild_id = ${guildId}
            AND actor_id = ${session.userId}
            AND action_type <> 'refresh_snapshot'
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '60 seconds'
        ) < 20
      ON CONFLICT ON CONSTRAINT uq_control_actions_actor_idempotency DO NOTHING
      RETURNING id, guild_id, action_type, status, created_at
    `;

    if (inserted[0]) {
      await respondWithWake(res, 202, inserted[0], false);
      return;
    }

    const existing = await sql`
      SELECT id, guild_id, action_type, status, created_at, payload_json
      FROM control_actions
      WHERE guild_id = ${guildId}
        AND actor_id = ${session.userId}
        AND idempotency_key = ${key}
      LIMIT 1
    `;
    if (existing[0]) {
      if (existing[0].action_type !== ACTION_TYPE) {
        throw new HttpError(409, 'That idempotency key was already used for a different action.');
      }
      if (!pageSavePayloadMatches(existing[0].payload_json, payload)) {
        throw new HttpError(409, 'That idempotency key was already used for a different page save.');
      }
      await respondWithWake(res, 200, existing[0], true);
      return;
    }

    const checks = await sql`
      SELECT
        EXISTS (
          SELECT 1
          FROM control_guild_snapshots
          WHERE guild_id = ${guildId}
            AND updated_at <= CURRENT_TIMESTAMP
            AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '3 minutes'
        ) AS snapshot_fresh,
        (
          SELECT COUNT(*)
          FROM control_actions
          WHERE guild_id = ${guildId}
            AND actor_id = ${session.userId}
            AND action_type <> 'refresh_snapshot'
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '60 seconds'
        ) AS rate_count
    `;
    if (!checks[0]?.snapshot_fresh) {
      throw new HttpError(503, 'Rob-bot is not reporting fresh server state. Wait for it to reconnect before saving.');
    }
    if (Number(checks[0]?.rate_count || 0) >= 20) {
      throw new HttpError(429, 'Too many control changes were requested. Wait a minute and retry.');
    }
    throw new HttpError(409, 'The page save could not be queued safely. Refresh and retry.');
  } catch (error) {
    handleError(res, error);
  }
}
