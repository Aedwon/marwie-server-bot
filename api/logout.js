import {
  appendSetCookie,
  clearCookie,
  CSRF_COOKIE,
  database,
  getSession,
  handleError,
  json,
  requireCsrf,
  requireSession,
  SESSION_COOKIE,
} from './_lib/control.js';

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
    const sql = database();
    await sql`DELETE FROM control_sessions WHERE session_hash = ${session.sessionHash}`;
    appendSetCookie(res, clearCookie(req, SESSION_COOKIE));
    appendSetCookie(res, clearCookie(req, CSRF_COOKIE));
    json(res, 200, { ok: true });
  } catch (error) {
    handleError(res, error);
  }
}
