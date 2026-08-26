import {
  appendSetCookie,
  clearCookie,
  controlBaseUrl,
  cookie,
  CSRF_COOKIE,
  database,
  guildCanManage,
  handleError,
  hashToken,
  HttpError,
  OAUTH_STATE_COOKIE,
  parseCookies,
  randomToken,
  redirect,
  requireEnv,
  safeEqual,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from '../_lib/control.js';

async function discordJson(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new HttpError(502, 'Discord account information could not be loaded.');
  return response.json();
}

function avatarUrl(user) {
  if (!user.avatar) return null;
  const extension = String(user.avatar).startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=128`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.statusCode = 405;
      res.end();
      return;
    }

    const requestUrl = new URL(req.url, controlBaseUrl(req));
    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');
    const storedState = parseCookies(req)[OAUTH_STATE_COOKIE];
    if (!code || !state || !storedState || !safeEqual(state, storedState)) {
      throw new HttpError(400, 'Discord sign-in verification expired. Start sign-in again.');
    }

    const clientId = requireEnv('DISCORD_CLIENT_ID');
    const clientSecret = requireEnv('DISCORD_CLIENT_SECRET');
    const redirectUri = `${controlBaseUrl(req)}/api/auth/callback`;
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) throw new HttpError(502, 'Discord sign-in could not be completed.');
    const token = await tokenResponse.json();
    if (!token.access_token) throw new HttpError(502, 'Discord did not return an access token.');

    const [user, guildsRaw] = await Promise.all([
      discordJson('https://discord.com/api/v10/users/@me', token.access_token),
      discordJson('https://discord.com/api/v10/users/@me/guilds', token.access_token),
    ]);
    const guilds = (Array.isArray(guildsRaw) ? guildsRaw : [])
      .filter(guildCanManage)
      .map((guild) => ({
        id: String(guild.id),
        name: String(guild.name || 'Discord server'),
        icon: guild.icon || null,
        owner: Boolean(guild.owner),
        permissions: String(guild.permissions || '0'),
      }));

    const rawSession = randomToken(32);
    const rawCsrf = randomToken(32);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const sql = database();
    await sql`
      DELETE FROM control_sessions
      WHERE expires_at <= CURRENT_TIMESTAMP
    `;
    await sql`
      INSERT INTO control_sessions (
        session_hash, csrf_hash, user_id, username, avatar_url, guilds_json, expires_at
      ) VALUES (
        ${hashToken(rawSession)},
        ${hashToken(rawCsrf)},
        ${String(user.id)},
        ${String(user.global_name || user.username || 'Discord user')},
        ${avatarUrl(user)},
        ${JSON.stringify(guilds)}::json,
        ${expiresAt}
      )
    `;

    appendSetCookie(
      res,
      cookie(req, SESSION_COOKIE, rawSession, {
        maxAge: SESSION_TTL_MS / 1000,
        httpOnly: true,
        sameSite: 'Lax',
      }),
    );
    appendSetCookie(
      res,
      cookie(req, CSRF_COOKIE, rawCsrf, {
        maxAge: SESSION_TTL_MS / 1000,
        httpOnly: true,
        sameSite: 'Lax',
      }),
    );
    appendSetCookie(res, clearCookie(req, OAUTH_STATE_COOKIE, '/api/auth'));
    redirect(res, `${controlBaseUrl(req)}/control`);
  } catch (error) {
    appendSetCookie(res, clearCookie(req, OAUTH_STATE_COOKIE, '/api/auth'));
    handleError(res, error);
  }
}
