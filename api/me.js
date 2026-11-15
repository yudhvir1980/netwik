/* GET -> who is signed in, and what the server is currently able to do.
   Public on purpose: the console page is readable by anyone, so it needs to be
   able to ask whether the viewer may run anything. Reveals no secret and no
   instance credential, only whether one is present. */

import { requireSession } from '../lib/auth.js';
import { sendJson } from '../lib/http.js';
import { isConfigured, instanceHost } from '../lib/servicenow.js';
import { isWriteEnabled } from '../lib/servicenow-write.js';

export default async function handler(req, res) {
  const session = requireSession(req);
  const configured = isConfigured();
  sendJson(res, 200, {
    user: session ? session.u : null,
    liveCalls: process.env.LIVE_CALLS_ENABLED === 'true',
    serviceNowConfigured: configured,
    serviceNowWriteEnabled: isWriteEnabled(),
    /* Host only, never the credential, and only to someone signed in. */
    serviceNowHost: session && configured ? instanceHost() : null
  });
}
