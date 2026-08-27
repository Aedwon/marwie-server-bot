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
import { visibleActionStatus } from './_lib/action-status.js';

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
    const id = requestUrl.searchParams.get('id');
    if (!id || !/^[0-9a-f]{32}$/i.test(id)) throw new HttpError(400, 'A valid action id is required.');

    const sql = database();
    const rows = await sql`
      SELECT a.id, a.guild_id, a.actor_id, a.action_type, a.status, a.result_json,
             a.user_error, a.error_reference, a.created_at, a.claimed_at, a.finished_at,
             s.updated_at AS snapshot_updated_at
      FROM control_actions a
      LEFT JOIN control_guild_snapshots s ON s.guild_id = a.guild_id
      WHERE a.id = ${id}
        AND a.actor_id = ${session.userId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new HttpError(404, 'That control action was not found.');
    requireGuild(session, String(row.guild_id));
    json(res, 200, {
      action: {
        id: row.id,
        guild_id: String(row.guild_id),
        action_type: row.action_type,
        status: visibleActionStatus({
          status: row.status,
          actionType: row.action_type,
          finishedAt: row.finished_at,
          snapshotUpdatedAt: row.snapshot_updated_at,
        }),
        result: row.result_json || null,
        error: row.user_error || null,
        error_reference: row.error_reference || null,
        created_at: row.created_at,
        claimed_at: row.claimed_at,
        finished_at: row.finished_at,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
}
