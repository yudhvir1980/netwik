/* The first auditable agent run.

   Stages 0, 2 and 3, persisted into the flow tables:

     0  intake          find or create the advisory record
     2  estate matching deterministic, from lib/matcher.js
     3  qualification   raise the questions only a person can answer

   Stage 1, reading an advisory into structure, is the first stage that needs
   Claude. It is not here yet, so the advisory arrives already structured.

   Every stage writes a row holding its input, its output and its timings, so
   the audit trail and the orchestration state are the same record. That is
   what makes a run replayable later without spending anything.

   Writes go only to the seven tables this project created. Nothing here can
   reach the CMDB, the users or the change records. */

import { requireSession, unauthorised } from '../lib/auth.js';
import { sendJson, methodOf, readJsonBody } from '../lib/http.js';
import {
  getRecords, instanceHost, configProblem, ServiceNowError, ConfigError
} from '../lib/servicenow.js';
import {
  createFlowRecord, createFlowRecords, updateFlowRecord, nowStamp, WriteRefused
} from '../lib/servicenow-write.js';
import { runMatch, findCustomer, SAMPLE_ADVISORY, CAVEATS } from '../lib/matcher.js';

/* Vulnerable items are written for devices needing action only, not for all
   755. The devices that are not vulnerable are accounted for in the stage
   output, which holds the full funnel and the reason each group left the set.
   Writing a row per device per advisory would be defensible for an auditor and
   unusable for a demo; this keeps the evidence without the volume. */
const MAX_ITEMS = 200;

function trim(value, len) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > len ? text.slice(0, len - 3) + '...' : text;
}

export default async function handler(req, res) {
  if (methodOf(req) !== 'POST') { sendJson(res, 405, { error: 'Use POST.' }); return; }
  const session = requireSession(req);
  if (!session) { unauthorised(res); return; }

  const problem = configProblem();
  if (problem) { sendJson(res, 503, { error: problem }); return; }

  const body = await readJsonBody(req);
  if (body === null) { sendJson(res, 400, { error: 'Expected a JSON body.' }); return; }

  const advisory = (body && body.advisory) || SAMPLE_ADVISORY;
  const mode = (body && body.mode) === 'apply' ? 'apply' : 'preview';

  if (!Array.isArray(advisory.affected) || !advisory.affected.length) {
    sendJson(res, 400, { error: 'The advisory needs an "affected" array.' });
    return;
  }

  const started = Date.now();
  const stages = [];

  function stage(number, name, input, output, from) {
    stages.push({
      number: number, name: name,
      input: trim(input, 3900), output: trim(output, 3900),
      startedAt: from, finishedAt: nowStamp()
    });
  }

  try {
    const customer = await findCustomer();
    if (!customer) {
      sendJson(res, 404, { error: 'The customer company was not found.' });
      return;
    }

    /* ---- stage 0: intake ------------------------------------------------ */
    let t0 = nowStamp();
    const existing = await getRecords('u_vulnerability_advisory', {
      query: 'u_advisory_id=' + advisory.advisoryId,
      fields: ['sys_id', 'u_advisory_id', 'u_state'], limit: 1
    });
    const alreadyKnown = existing.length > 0;

    /* ---- stage 2: matching ---------------------------------------------- */
    const t2 = nowStamp();
    const match = await runMatch(customer, advisory);
    const needing = match.needingAction.slice(0, MAX_ITEMS);

    /* ---- stage 3: what only a person can answer ------------------------- */
    const groups = {};
    needing.forEach(function (d) {
      const key = d.class;
      if (!groups[key]) groups[key] = { class: key, devices: 0, sites: {} };
      groups[key].devices++;
      groups[key].sites[d.site] = true;
    });
    const qualificationGroups = Object.keys(groups).map(function (k) {
      return {
        class: k,
        devices: groups[k].devices,
        sites: Object.keys(groups[k].sites)
      };
    });

    const plan = {
      advisory: alreadyKnown ? 'exists, will be reused' : 'will be created',
      vulnerableItems: needing.length,
      qualificationTasks: qualificationGroups.length,
      runRecords: 1,
      stageRecords: 3
    };

    if (mode !== 'apply') {
      sendJson(res, 200, {
        ok: true, mode: 'preview', instance: instanceHost(),
        startedBy: session.u, elapsedMs: Date.now() - started,
        advisoryId: advisory.advisoryId,
        funnel: match.funnel,
        wouldWrite: plan,
        qualificationGroups: qualificationGroups,
        needingActionExamples: needing.slice(0, 10),
        caveats: CAVEATS,
        note: 'Nothing was written. Send mode "apply" to record this run.'
      });
      return;
    }

    /* ---- apply ----------------------------------------------------------- */
    const run = await createFlowRecord('u_agent_run', {
      u_started_by: session.u,
      u_mode: 'live',
      u_state: 'running',
      u_started_at: nowStamp(),
      u_total_usd: '0'
    });
    if (!run.ok) {
      sendJson(res, 502, { error: 'Could not create the run record: ' + run.error });
      return;
    }

    let advisorySysId = alreadyKnown ? existing[0].sys_id : null;
    if (!advisorySysId) {
      const made = await createFlowRecord('u_vulnerability_advisory', {
        u_advisory_id: advisory.advisoryId,
        u_title: trim(advisory.title || '', 250),
        u_summary: trim(advisory.summary || advisory.title || '', 3900),
        u_cvss: advisory.cvss ? String(advisory.cvss) : '',
        u_severity: advisory.severity || (advisory.cvss >= 9 ? 'critical' : 'high'),
        u_exploited: advisory.exploited ? 'true' : 'false',
        u_affected_versions: trim(advisory.affected, 990),
        u_fixed_versions: trim(advisory.fixed || [], 990),
        u_qualifying_condition: trim(advisory.qualifyingCondition
          || 'Not recorded. This phase cannot read device configuration.', 990),
        u_received: nowStamp(),
        u_state: 'assessed'
      });
      advisorySysId = made.sys_id;
    }
    stage(0, 'Intake and de-duplication',
      { advisoryId: advisory.advisoryId },
      { advisory: alreadyKnown ? 'reused existing record' : 'created', sys_id: advisorySysId },
      t0);

    const itemRows = needing.map(function (d) {
      return {
        u_advisory: advisorySysId,
        u_ci: d.sys_id,
        u_version: d.version || '',
        u_version_matched: d.state === 'affected' ? 'true' : 'false',
        /* Unknown on purpose: this phase cannot read configuration, so no
           device can honestly be called qualified either way. */
        u_qualified: 'unknown',
        u_internet_facing: d.internetFacing ? 'true' : 'false',
        u_site_code: d.site || '',
        u_gxp: d.gxp ? 'true' : 'false',
        u_state: 'open',
        u_exclusion_reason: ''
      };
    });
    const items = await createFlowRecords('u_vulnerable_item', itemRows, 6);
    stage(2, 'Estate matching',
      { affectedRanges: advisory.affected, fixed: advisory.fixed },
      { funnel: match.funnel, itemsWritten: items.created, itemsFailed: items.failed },
      t2);

    const t3 = nowStamp();
    const taskRows = qualificationGroups.map(function (g) {
      return {
        u_advisory: advisorySysId,
        u_device_group: trim(g.class + ' at ' + g.sites.join(', '), 250),
        u_condition: trim(advisory.qualifyingCondition
          || 'Confirm whether the vulnerable feature is enabled on these '
             + 'devices. Until answered they are potentially affected, not '
             + 'affected.', 990),
        u_answer: '',
        u_state: 'open'
      };
    });
    const tasks = await createFlowRecords('u_qualification_task', taskRows, 4);
    stage(3, 'Configuration qualification',
      { groups: qualificationGroups },
      { tasksRaised: tasks.created, tasksFailed: tasks.failed },
      t3);

    const stageRows = stages.map(function (s) {
      return {
        u_run: run.sys_id,
        u_number: String(s.number),
        u_name: s.name,
        u_input: s.input,
        u_output: s.output,
        u_started_at: s.startedAt,
        u_finished_at: s.finishedAt,
        u_input_tokens: '0',
        u_output_tokens: '0',
        u_usd: '0',
        u_state: 'complete'
      };
    });
    const stageWrite = await createFlowRecords('u_agent_run_stage', stageRows, 3);

    const failures = items.failed + tasks.failed + stageWrite.failed;
    await updateFlowRecord('u_agent_run', run.sys_id, {
      u_advisory: advisorySysId,
      u_state: failures ? 'complete with errors' : 'complete',
      u_finished_at: nowStamp()
    });

    sendJson(res, 200, {
      ok: true, mode: 'apply', instance: instanceHost(),
      startedBy: session.u, elapsedMs: Date.now() - started,
      run: { sys_id: run.sys_id, table: 'u_agent_run' },
      advisory: { sys_id: advisorySysId, reused: alreadyKnown },
      written: {
        vulnerableItems: items.created,
        qualificationTasks: tasks.created,
        stages: stageWrite.created
      },
      failed: {
        vulnerableItems: items.failed,
        qualificationTasks: tasks.failed,
        stages: stageWrite.failed,
        errors: items.errors.concat(tasks.errors, stageWrite.errors).slice(0, 5)
      },
      funnel: match.funnel,
      caveats: CAVEATS,
      note: 'Stage 1, reading an advisory into structure, is the first stage '
        + 'that needs Claude and is not built yet. Everything here is '
        + 'deterministic and cost nothing.'
    });
  } catch (error) {
    if (error instanceof WriteRefused) { sendJson(res, 403, { error: error.message }); return; }
    if (error instanceof ConfigError) { sendJson(res, 503, { error: error.message }); return; }
    if (error instanceof ServiceNowError) {
      sendJson(res, 502, { error: error.message, detail: error.detail });
      return;
    }
    sendJson(res, 500, {
      error: 'Run failed: ' + (error && error.message ? error.message : 'unknown')
    });
  }
}
