import {
  appendSetCookie,
  controlBaseUrl,
  cookie,
  handleError,
  OAUTH_STATE_COOKIE,
  randomToken,
  redirect,
  requireEnv,
} from '../_lib/control.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.statusCode = 405;
      res.end();
      return;
    }

    const clientId = requireEnv('DISCORD_CLIENT_ID');
    const state = randomToken(24);
    const redirectUri = `${controlBaseUrl(req)}/api/auth/callback`;
    appendSetCookie(
      res,
      cookie(req, OAUTH_STATE_COOKIE, state, {
        maxAge: 10 * 60,
        path: '/api/auth',
        httpOnly: true,
        sameSite: 'Lax',
      }),
    );

    const authorize = new URL('https://discord.com/oauth2/authorize');
    authorize.searchParams.set('client_id', clientId);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('redirect_uri', redirectUri);
    authorize.searchParams.set('scope', 'identify guilds');
    authorize.searchParams.set('state', state);
    redirect(res, authorize.toString());
  } catch (error) {
    handleError(res, error);
  }
}
