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
      SELECT id, guild_id, actor_id, action_type, status, result_json,
             user_error, error_reference, created_at, claimed_at, finished_at
      FROM control_actions
      WHERE id = ${id}
        AND actor_id = ${session.userId}
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
        status: row.status,
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
