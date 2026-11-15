/* Does the instance hold what the blueprint says it holds?

   You have told me the instance is loaded. This verifies it rather than trusting
   it, and reports the real field and table names, because the data model for the
   vulnerability flow has to be built against what is actually there.

   Costs nothing. Reads only. Needs a session because it uses the ServiceNow
   credential. */

import { requireSession, unauthorised } from './_lib/auth.js';
import { sendJson, methodOf } from './_lib/http.js';
import {
  probeTable, probeField, mapLimited, instanceHost, configProblem,
  ServiceNowError, ConfigError
} from './_lib/servicenow.js';

/* Expected counts come from the blueprint, sections 3 to 5. They are targets,
   not assertions: "close enough" is fine, "zero" is the signal worth seeing. */
const TABLES = [
  ['Foundation', 'core_company', 12],
  ['Foundation', 'cmn_location', 31],
  ['Foundation', 'cmn_department', 8],
  ['Foundation', 'sys_user', 400],
  ['Foundation', 'sys_user_group', 15],
  ['Foundation', 'cmn_schedule', 5],
  ['Foundation', 'cmn_rota', 4],

  ['Estate', 'cmdb_ci_ip_router', 65],
  ['Estate', 'cmdb_ci_ip_firewall', 42],
  ['Estate', 'cmdb_ci_ip_switch', 430],
  ['Estate', 'cmdb_ci_netgear', 30],
  ['Estate', 'cmdb_ci_wap_network', 3290],
  ['Estate', 'cmdb_ci_network_adapter', null],
  ['Estate', 'cmdb_hardware_product_model', 25],
  ['Estate', 'cmdb_rel_ci', null],
  ['Estate', 'u_cmdb_ci_circuit', 68],

  ['Services', 'cmdb_ci_service_business', 31],
  ['Services', 'cmdb_ci_service_technical', 4],
  ['Services', 'service_offering', 12],
  ['Services', 'ast_contract', 8],

  ['History', 'incident', 6500],
  ['History', 'problem', 45],
  ['History', 'change_request', 1800],
  ['History', 'change_task', null],
  ['History', 'cmdb_ci_outage', 150],
  ['History', 'contract_sla', 8],
  ['History', 'task_sla', null],
  ['History', 'kb_knowledge', 50],
  ['History', 'u_capacity_metric', 73000],
  ['History', 'em_event', 25000],

  /* Expected to be absent. These are what this flow has to create. */
  ['Vulnerability flow', 'u_vulnerability_advisory', 0],
  ['Vulnerability flow', 'u_vulnerable_item', 0],
  ['Vulnerability flow', 'u_risk_exception', 0],
  ['Vulnerability flow', 'u_qualification_task', 0],
  ['Vulnerability flow', 'u_stakeholder_notification', 0],
  ['Vulnerability flow', 'u_agent_run', 0]
];

const FIELDS = [
  ['cmn_location', 'u_site_tier'],
  ['cmn_location', 'u_gxp'],
  ['cmdb_ci_ip_router', 'u_exposure_zone'],
  ['cmdb_ci_ip_firewall', 'u_exposure_zone']
];

export default async function handler(req, res) {
  if (methodOf(req) !== 'POST') {
    sendJson(res, 405, { error: 'Use POST.' });
    return;
  }
  const session = requireSession(req);
  if (!session) { unauthorised(res); return; }

  /* Fail fast and say exactly what is wrong, rather than firing thirty probes
     at a misconfigured host and reporting the same confusing note thirty times. */
  const problem = configProblem();
  if (problem) {
    sendJson(res, 503, { error: problem });
    return;
  }

  const started = Date.now();

  try {
    const tableResults = await mapLimited(TABLES, 6, async function (entry) {
      const report = await probeTable(entry[1]);
      report.group = entry[0];
      report.expected = entry[2];
      if (report.count !== null && entry[2] !== null && entry[2] > 0) {
        const ratio = report.count / entry[2];
        report.verdict = report.count === 0 ? 'empty'
          : (ratio >= 0.5 && ratio <= 2) ? 'as expected'
          : 'unexpected volume';
      }
      return report;
    });

    const fieldResults = await mapLimited(FIELDS, 4, function (entry) {
      return probeField(entry[0], entry[1]);
    });

    const grouped = {};
    tableResults.forEach(function (row) {
      if (!grouped[row.group]) grouped[row.group] = [];
      grouped[row.group].push({
        table: row.table,
        exists: row.exists,
        readable: row.readable,
        count: row.count,
        expected: row.expected,
        verdict: row.verdict || null,
        note: row.note || null
      });
    });

    const problems = tableResults.filter(function (row) {
      if (row.group === 'Vulnerability flow') return false;
      return row.exists !== true || row.readable !== true || row.count === 0
        || row.verdict === 'unexpected volume';
    }).map(function (row) {
      return row.table + ': ' + (row.note || row.verdict
        || (row.exists === false ? 'not present' : 'count ' + row.count));
    });

    const toCreate = tableResults.filter(function (row) {
      return row.group === 'Vulnerability flow' && row.exists !== true;
    }).map(function (row) { return row.table; });

    sendJson(res, 200, {
      ok: true,
      instance: instanceHost(),
      inspectedBy: session.u,
      elapsedMs: Date.now() - started,
      tables: grouped,
      customFields: fieldResults,
      needsAttention: problems,
      tablesToCreate: toCreate
    });
  } catch (error) {
    if (error instanceof ConfigError) {
      sendJson(res, 503, { error: error.message });
      return;
    }
    if (error instanceof ServiceNowError) {
      sendJson(res, 502, { error: error.message, detail: error.detail });
      return;
    }
    sendJson(res, 500, {
      error: 'Inspection failed: ' + (error && error.message ? error.message : 'unknown')
    });
  }
}
