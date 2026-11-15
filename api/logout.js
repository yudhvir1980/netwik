/* POST -> clears the session cookie. */

import { sendJson, sendJsonWithCookie, methodOf } from '../lib/http.js';
import { clearCookie } from '../lib/session.js';

export default async function handler(req, res) {
  if (methodOf(req) !== 'POST') {
    sendJson(res, 405, { error: 'Use POST.' });
    return;
  }
  sendJsonWithCookie(res, 200, { ok: true }, clearCookie());
}
