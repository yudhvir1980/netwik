/* GET -> who is signed in, and what the server is currently able to do.
   Public on purpose: the console page is readable by anyone, so it needs to be
   able to ask whether the viewer may run anything. Reveals no secret and no
   instance credential, only whether one is present. */

import { requireSession, json } from './_lib/auth.js';
import { isConfigured, instanceHost } from './_lib/servicenow.js';

export default async function handler(request) {
  const session = requireSession(request);
  const configured = isConfigured();
  return json({
    user: session ? session.u : null,
    liveCalls: process.env.LIVE_CALLS_ENABLED === 'true',
    serviceNowConfigured: configured,
    /* Host only, never the credential, and only to someone signed in. */
    serviceNowHost: session && configured ? instanceHost() : null
  });
}
