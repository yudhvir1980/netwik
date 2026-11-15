/* POST -> clears the session cookie. */

import { json } from './_lib/auth.js';
import { clearCookie } from './_lib/session.js';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Use POST.' }, 405);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': clearCookie()
    }
  });
}
