/* Can stage 2 actually run?

   The table inspection proved the instance is reachable and broadly loaded, but
   it answered a shallower question than the flow needs. Estate matching lives or
   dies on one thing: does each network device record carry a software version we
   can compare against an advisory's affected range? Nothing else in the
   vulnerability flow matters if that field is empty.

   This also separates the loaded data from the out-of-box demo records a
   developer instance ships with, because raw table counts conflate the two and
   make every number untrustworthy.

   Reads only. Costs nothing. Needs a session. */

import { requireSession, unauthorised } from './_lib/auth.js';
import { sendJson, methodOf } from './_lib/http.js';
import {
  getRecords, countRecords, mapLimited, instanceHost, configProblem,
  ServiceNowError, ConfigError
} from './_lib/servicenow.js';

const DEVICE_CLASSES = [
  'cmdb_ci_ip_router',
  'cmdb_ci_ip_firewall',
  'cmdb_ci_ip_switch',
  'cmdb_ci_netgear',
  'cmdb_ci_wap_network'
];

/* Where a software version plausibly lives. The point is to find out which one
   this instance actually uses, rather than to assume. */
const VERSION_FIELDS = [
  'os_version', 'firmware_version', 'software_version', 'version',
  'firmware_revision', 'os', 'u_os_version', 'u_software_version',
  'u_firmware_version', 'u_version', 'u_ios_version', 'u_pan_os_version'
];

const MODEL_LIFECYCLE_FIELDS = [
  'end_of_support', 'end_of_sale', 'end_of_life', 'end_of_extended_support',
  'u_end_of_support', 'u_end_of_sale'
];

function populatedFields(record) {
  const out = [];
  Object.keys(record || {}).forEach(function (key) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      out.push(key);
    }
  });
  return out.sort();
}

function pick(record, fields) {
  const found = {};
  fields.forEach(function (field) {
    if (record && record[field] !== undefined && String(record[field]).trim() !== '') {
      found[field] = String(record[field]);
    }
  });
  return found;
}

export default async function handler(req, res) {
  if (methodOf(req) !== 'POST') {
    sendJson(res, 405, { error: 'Use POST.' });
    return;
  }
  const session = requireSession(req);
  if (!session) { unauthorised(res); return; }

  const problem = configProblem();
  if (problem) { sendJson(res, 503, { error: problem }); return; }

  const started = Date.now();

  try {
    /* Which company owns the loaded estate, so counts can be scoped to it
       rather than to a developer instance's demo records. */
    const companies = await getRecords('core_company', {
      query: 'nameLIKEveridian',
      fields: ['sys_id', 'name'],
      limit: 5
    });
    const customer = companies.length ? companies[0] : null;

    const devices = await mapLimited(DEVICE_CLASSES, 3, async function (table) {
      const report = { table: table };

      report.total = await countRecords(table);

      if (customer) {
        try {
          report.ownedByCustomer = await countRecords(table, {
            query: 'company=' + customer.sys_id
          });
        } catch (error) {
          report.ownedByCustomer = null;
        }
      }

      const sample = await getRecords(table, { limit: 3 });
      if (!sample.length) {
        report.sampled = 0;
        return report;
      }
      report.sampled = sample.length;
      report.exampleNames = sample.map(function (r) { return r.name || '(unnamed)'; });
      report.populatedFields = populatedFields(sample[0]);
      report.versionCandidates = pick(sample[0], VERSION_FIELDS);
      report.modelRef = sample[0].model_id ? 'set' : 'empty';

      /* The number that decides whether stage 2 is possible at all. */
      const usable = Object.keys(report.versionCandidates);
      if (usable.length) {
        const field = usable[0];
        report.versionFieldInUse = field;
        try {
          report.withVersion = await countRecords(table, {
            query: field + 'ISNOTEMPTY'
          });
        } catch (error) {
          report.withVersion = null;
        }
      } else {
        report.versionFieldInUse = null;
        report.withVersion = 0;
      }
      return report;
    });

    /* End-of-support dates drive the one population nobody can patch. */
    const models = await getRecords('cmdb_hardware_product_model', { limit: 3 });
    const modelReport = {
      sampled: models.length,
      populatedFields: models.length ? populatedFields(models[0]) : [],
      lifecycleFields: models.length ? pick(models[0], MODEL_LIFECYCLE_FIELDS) : {},
      exampleNames: models.map(function (m) { return m.name || m.display_name || '(unnamed)'; })
    };

    const verdict = [];
    devices.forEach(function (d) {
      if (!d.versionFieldInUse) {
        verdict.push(d.table + ': no software version field is populated, so '
          + 'advisory matching cannot run against it.');
      } else if (d.withVersion !== null && d.total && d.withVersion < d.total) {
        verdict.push(d.table + ': ' + d.withVersion + ' of ' + d.total
          + ' records carry ' + d.versionFieldInUse + '.');
      }
    });
    if (!Object.keys(modelReport.lifecycleFields).length) {
      verdict.push('cmdb_hardware_product_model: no end-of-support date is '
        + 'populated, so the devices that can never be patched cannot be identified.');
    }

    sendJson(res, 200, {
      ok: true,
      instance: instanceHost(),
      inspectedBy: session.u,
      elapsedMs: Date.now() - started,
      customer: customer ? { name: customer.name, sys_id: customer.sys_id } : null,
      devices: devices,
      hardwareModels: modelReport,
      blockers: verdict
    });
  } catch (error) {
    if (error instanceof ConfigError) { sendJson(res, 503, { error: error.message }); return; }
    if (error instanceof ServiceNowError) {
      sendJson(res, 502, { error: error.message, detail: error.detail });
      return;
    }
    sendJson(res, 500, {
      error: 'Readiness check failed: ' + (error && error.message ? error.message : 'unknown')
    });
  }
}
