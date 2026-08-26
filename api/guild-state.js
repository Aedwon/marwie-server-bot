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
    if (!row) throw new HttpError(503, 'Rob-bot has not published live state for that server yet.');
    json(res, 200, {
      guild_id: String(row.guild_id),
      state: row.snapshot_json,
      snapshot: {
        updated_at: row.updated_at,
        worker_version: row.worker_version,
        fresh: snapshotIsFresh(row),
      },
    });
  } catch (error) {
    handleError(res, error);
  }
}
