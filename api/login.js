/* POST { username, password } -> sets the session cookie. */

import { checkCredentials, json } from './_lib/auth.js';
import { issueCookie } from './_lib/session.js';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Use POST.' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const username = String((body && body.username) || '').trim().toLowerCase();
  const password = String((body && body.password) || '');

  /* A blunt damper on guessing. Proper rate limiting needs somewhere to keep a
     counter, which this phase does not have, so the passwords must be long. */
  await new Promise(function (resolve) { setTimeout(resolve, 400); });

  let ok;
  try {
    ok = checkCredentials(username, password);
  } catch (error) {
    return json({ error: 'Sign-in is not configured on the server.' }, 500);
  }

  if (!ok) {
    return json({ error: 'Those credentials were not accepted.' }, 401);
  }

  return new Response(JSON.stringify({ ok: true, user: username }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': issueCookie(username)
    }
  });
}
