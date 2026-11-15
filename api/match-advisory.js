/* Stage 2 as a read-only endpoint: match an advisory against the estate and
   show the funnel, without writing anything.

   The matching itself lives in lib/matcher.js so this and the persisted agent
   run cannot drift apart. */

import { requireSession, unauthorised } from '../lib/auth.js';
import { sendJson, methodOf, readJsonBody } from '../lib/http.js';
import { instanceHost, configProblem, ServiceNowError, ConfigError } from '../lib/servicenow.js';
import { runMatch, findCustomer, SAMPLE_ADVISORY, CAVEATS } from '../lib/matcher.js';

export default async function handler(req, res) {
  if (methodOf(req) !== 'POST') { sendJson(res, 405, { error: 'Use POST.' }); return; }
  const session = requireSession(req);
  if (!session) { unauthorised(res); return; }

  const problem = configProblem();
  if (problem) { sendJson(res, 503, { error: problem }); return; }

  const body = await readJsonBody(req);
  if (body === null) { sendJson(res, 400, { error: 'Expected a JSON body.' }); return; }
  const advisory = (body && body.advisory) || SAMPLE_ADVISORY;

  if (!Array.isArray(advisory.affected) || !advisory.affected.length) {
    sendJson(res, 400, {
      error: 'The advisory needs an "affected" array of { from, to } or { exact } entries.'
    });
    return;
  }

  const started = Date.now();

  try {
    const customer = await findCustomer();
    if (!customer) {
      sendJson(res, 404, { error: 'The customer company was not found on the instance.' });
      return;
    }

    const result = await runMatch(customer, advisory);

    sendJson(res, 200, {
      ok: true,
      instance: instanceHost(),
      matchedBy: session.u,
      elapsedMs: Date.now() - started,
      advisory: {
        advisoryId: advisory.advisoryId,
        title: advisory.title,
        exploited: Boolean(advisory.exploited),
        cvss: advisory.cvss || null,
        vendor: advisory.vendor || null,
        affected: advisory.affected,
        fixed: advisory.fixed || []
      },
      funnel: result.funnel,
      exposureSignal: result.exposureSignal,
      dataGaps: result.dataGaps,
      byClass: result.byClass,
      bySite: result.bySite,
      needingAction: {
        total: result.needingAction.length,
        internetFacing: result.internetFacingCount,
        atGxpSites: result.gxpCount,
        examples: result.needingAction.slice(0, 15)
      },
      caveats: CAVEATS
    });
  } catch (error) {
    if (error instanceof ConfigError) { sendJson(res, 503, { error: error.message }); return; }
    if (error instanceof ServiceNowError) {
      sendJson(res, 502, { error: error.message, detail: error.detail });
      return;
    }
    sendJson(res, 500, {
      error: 'Matching failed: ' + (error && error.message ? error.message : 'unknown')
    });
  }
}
