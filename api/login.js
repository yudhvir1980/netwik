/* POST { username, password } -> sets the session cookie. */

import { checkCredentials } from '../lib/auth.js';
import { issueCookie } from '../lib/session.js';
import { sendJson, sendJsonWithCookie, methodOf, readJsonBody } from '../lib/http.js';

export default async function handler(req, res) {
  if (methodOf(req) !== 'POST') {
    sendJson(res, 405, { error: 'Use POST.' });
    return;
  }

  const body = await readJsonBody(req);
  if (body === null) {
    sendJson(res, 400, { error: 'Expected a JSON body.' });
    return;
  }

  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');

  /* A blunt damper on guessing. Proper rate limiting needs somewhere to keep a
     counter, which this phase does not have, so the passwords must be long. */
  await new Promise(function (resolve) { setTimeout(resolve, 400); });

  let ok;
  try {
    ok = checkCredentials(username, password);
  } catch (error) {
    sendJson(res, 500, { error: 'Sign-in is not configured on the server.' });
    return;
  }

  if (!ok) {
    sendJson(res, 401, { error: 'Those credentials were not accepted.' });
    return;
  }

  sendJsonWithCookie(res, 200, { ok: true, user: username }, issueCookie(username));
}
