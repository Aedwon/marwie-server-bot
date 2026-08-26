import {
  database,
  getSession,
  handleError,
  json,
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

    const session = await getSession(req);
    if (!session) {
      json(res, 200, { authenticated: false, login_url: '/api/auth/start' });
      return;
    }
    requireSession(session);

    const allowed = new Map(session.guilds.map((guild) => [String(guild.id), guild]));
    const sql = database();
    const snapshots = await sql`
      SELECT guild_id, snapshot_json, worker_version, updated_at
      FROM control_guild_snapshots
      ORDER BY updated_at DESC
    `;
    const guilds = [];
    for (const row of snapshots) {
      const id = String(row.guild_id);
      const oauthGuild = allowed.get(id);
      if (!oauthGuild) continue;
      const state = row.snapshot_json || {};
      guilds.push({
        id,
        name: state.guild?.name || oauthGuild.name,
        icon_url: state.guild?.icon_url || null,
        administrator: Boolean(oauthGuild.owner) || (BigInt(String(oauthGuild.permissions || '0')) & 0x8n) !== 0n,
        snapshot_updated_at: row.updated_at,
        worker_version: row.worker_version,
        online: snapshotIsFresh(row),
      });
    }

    json(res, 200, {
      authenticated: true,
      csrf_token: session.csrfToken,
      user: {
        id: session.userId,
        name: session.username,
        avatar_url: session.avatarUrl,
      },
      guilds,
      expires_at: session.expiresAt,
    });
  } catch (error) {
    handleError(res, error);
  }
}
