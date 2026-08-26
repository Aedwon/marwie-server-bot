import {
  controlBaseUrl,
  getSession,
  getSnapshot,
  handleError,
  HttpError,
  json,
  requireGuild,
  requireSession,
  snapshotIsFresh,
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
    const guildId = requestUrl.searchParams.get('guild_id');
    if (!guildId || !/^\d{1,20}$/.test(guildId)) throw new HttpError(400, 'A valid guild_id is required.');
    requireGuild(session, guildId);
    const row = await getSnapshot(guildId);
    if (!row) throw new HttpError(503, 'Setup discovery is not available until Rob-bot publishes server state.');
    json(res, 200, {
      guild_id: String(row.guild_id),
      setup: row.snapshot_json?.setup || null,
      snapshot_updated_at: row.updated_at,
      fresh: snapshotIsFresh(row),
    });
  } catch (error) {
    handleError(res, error);
  }
}
