import {
  controlBaseUrl,
  database,
  getSession,
  handleError,
  HttpError,
  json,
  requireGuild,
  requireSession,
} from './_lib/control.js';
import { activityProjection, decodeActivityCursor, encodeActivityCursor } from './_lib/activity.js';

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
    const guildId = String(requestUrl.searchParams.get('guild_id') || '').trim();
    if (!/^\d{1,20}$/.test(guildId)) throw new HttpError(400, 'A valid guild_id is required.');
    requireGuild(session, guildId);

    const requestedLimit = Number(requestUrl.searchParams.get('limit') || 25);
    const limit = Math.min(50, Math.max(1, Number.isInteger(requestedLimit) ? requestedLimit : 25));
    const rawCursor = requestUrl.searchParams.get('cursor');
    let cursor = null;
    if (rawCursor) {
      try {
        cursor = decodeActivityCursor(rawCursor);
      } catch {
        throw new HttpError(400, 'Activity cursor is invalid.');
      }
    }

    const sql = database();
    const rows = cursor
      ? await sql`
          SELECT id, actor_id, action_type, status, payload_json, user_error, error_reference,
                 created_at, finished_at
          FROM control_actions
          WHERE guild_id = ${guildId}
            AND action_type <> 'refresh_snapshot'
            AND (
              created_at < ${cursor.created_at}::timestamptz
              OR (created_at = ${cursor.created_at}::timestamptz AND id < ${cursor.id})
            )
          ORDER BY created_at DESC, id DESC
          LIMIT ${limit + 1}
        `
      : await sql`
          SELECT id, actor_id, action_type, status, payload_json, user_error, error_reference,
                 created_at, finished_at
          FROM control_actions
          WHERE guild_id = ${guildId}
            AND action_type <> 'refresh_snapshot'
          ORDER BY created_at DESC, id DESC
          LIMIT ${limit + 1}
        `;

    const page = rows.slice(0, limit);
    const tail = page.at(-1);
    json(res, 200, {
      items: page.map(activityProjection),
      next_cursor: rows.length > limit && tail
        ? encodeActivityCursor(tail.created_at, tail.id)
        : null,
    });
  } catch (error) {
    handleError(res, error);
  }
}
