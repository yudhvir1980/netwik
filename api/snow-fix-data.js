/* Repairs the three data gaps the matcher exposed.

   Preview by default. Nothing is written unless the caller asks for mode
   "apply" and SERVICENOW_WRITE_ENABLED is true, and even then only the fields
   named in the write module's allow-list can change.

   Work is done in bounded batches and the response says how many records
   remain, because a hobby-plan function cannot patch seven hundred records in
   one invocation. The console loops until there is nothing left.

   The three fixes:

   exposure     internet_facing is currently true across the estate, including
                industrial switches inside regulated plants. Set it true only
                for devices that actually terminate an internet transport.

   lifecycle    u_end_of_support and u_end_of_sale exist on the hardware models
                and are empty, so the devices nobody can ever patch cannot be
                identified. Dates written here are ILLUSTRATIVE and must never
                be presented as real vendor lifecycle data.

   controllers  Wireless controllers carry no version, so they are invisible to
                advisory matching. */

import { requireSession, unauthorised } from '../lib/auth.js';
import { sendJson, methodOf, readJsonBody } from '../lib/http.js';
import {
  getRecords, countRecords, instanceHost, configProblem,
  ServiceNowError, ConfigError
} from '../lib/servicenow.js';
import { patchMany, writeProblem, isWriteEnabled, WriteRefused } from '../lib/servicenow-write.js';

/* True only where a device genuinely terminates an internet transport. */
const EXPOSURE_RULE = [
  { table: 'cmdb_ci_ip_router', label: 'SD-WAN edges', shouldBe: true },
  { table: 'cmdb_ci_ip_firewall', label: 'Firewalls', shouldBe: true },
  { table: 'cmdb_ci_ip_switch', label: 'Switches', shouldBe: false },
  { table: 'cmdb_ci_wap_network', label: 'Access points', shouldBe: false }
];

/* Illustrative lifecycle dates, matched on model name. Today is late 2026, so
   the legacy patterns fall in the past on purpose: that is the population the
   exception path and the CTO sign-off exist for. */
const LIFECYCLE_RULES = [
  { match: /vedge|isr\s?4|2960|3850|air-cap|total access/i, sale: '2021-10-31', support: '2026-07-31', ageing: true },
  { match: /ie3400/i, sale: '2027-07-31', support: '2032-07-31' },
  { match: /catalyst 8300|c8300/i, sale: '2030-01-31', support: '2035-01-31' },
  { match: /catalyst 9500|c9500/i, sale: '2029-10-31', support: '2034-10-31' },
  { match: /catalyst 9[2348]|c9[2348]/i, sale: '2028-10-31', support: '2033-10-31' },
  { match: /pa-5[0-9]{3}|pa-3[0-9]{3}/i, sale: '2031-03-31', support: '2036-03-31' },
  { match: /./, sale: '2029-12-31', support: '2034-12-31' }
];

const CONTROLLER_VERSION = '17.9.5';

function lifecycleFor(name) {
  const text = String(name || '');
  for (let i = 0; i < LIFECYCLE_RULES.length; i++) {
    if (LIFECYCLE_RULES[i].match.test(text)) return LIFECYCLE_RULES[i];
  }
  return LIFECYCLE_RULES[LIFECYCLE_RULES.length - 1];
}

function truthy(value) {
  const text = String(value == null ? '' : value).toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

async function customerId() {
  const rows = await getRecords('core_company', {
    query: 'nameLIKEveridian', fields: ['sys_id', 'name'], limit: 1
  });
  return rows.length ? rows[0] : null;
}

/* ---- exposure ---------------------------------------------------------- */

async function exposureWork(customer, batch, mode) {
  const perTable = [];
  let budget = batch;
  let remaining = 0;
  const applied = { updated: 0, failed: 0, errors: [] };

  for (let i = 0; i < EXPOSURE_RULE.length; i++) {
    const rule = EXPOSURE_RULE[i];
    const wrong = rule.shouldBe ? 'false' : 'true';
    const query = 'company=' + customer.sys_id + '^internet_facing=' + wrong;

    const total = await countRecords(rule.table, { query: query });
    perTable.push({
      table: rule.table, label: rule.label,
      shouldBe: rule.shouldBe, needingChange: total
    });

    if (total === 0) continue;
    if (budget <= 0) { remaining += total; continue; }

    const take = Math.min(budget, total);
    if (mode !== 'apply') { budget -= take; remaining += total - take; continue; }

    const rows = await getRecords(rule.table, {
      query: query, fields: ['sys_id'], limit: take
    });
    const ids = rows.map(function (r) { return r.sys_id; });
    const result = await patchMany(rule.table, ids,
      { internet_facing: rule.shouldBe ? 'true' : 'false' }, mode);

    applied.updated += result.updated;
    applied.failed += result.failed;
    result.errors.forEach(function (e) { if (applied.errors.length < 5) applied.errors.push(e); });
    budget -= take;
    remaining += total - take;
  }

  return { perTable: perTable, applied: applied, remaining: remaining };
}

/* ---- lifecycle --------------------------------------------------------- */

async function lifecycleWork(customer, mode) {
  /* Which models the estate actually uses, rather than whatever sits first in
     a table full of the instance's own demo workstations. */
  const ids = {};
  for (let i = 0; i < EXPOSURE_RULE.length; i++) {
    const rows = await getRecords(EXPOSURE_RULE[i].table, {
      query: 'company=' + customer.sys_id + '^model_idISNOTEMPTY',
      fields: ['model_id'], limit: 2000
    });
    rows.forEach(function (r) { if (r.model_id) ids[r.model_id] = true; });
  }
  const modelIds = Object.keys(ids);

  const planned = [];
  for (let i = 0; i < modelIds.length; i++) {
    const rows = await getRecords('cmdb_hardware_product_model', {
      query: 'sys_id=' + modelIds[i],
      fields: ['sys_id', 'name', 'display_name', 'u_end_of_support', 'u_end_of_sale'],
      limit: 1
    });
    if (!rows.length) continue;
    const model = rows[0];
    const name = model.name || model.display_name || '';
    const rule = lifecycleFor(name);
    const already = String(model.u_end_of_support || '').trim() !== '';
    planned.push({
      sys_id: model.sys_id,
      name: name,
      alreadySet: already,
      endOfSale: rule.sale,
      endOfSupport: rule.support,
      pastSupport: Boolean(rule.ageing)
    });
  }

  const toWrite = planned.filter(function (p) { return !p.alreadySet; });
  const applied = { updated: 0, failed: 0, errors: [] };

  if (mode === 'apply') {
    for (let i = 0; i < toWrite.length; i++) {
      const result = await patchMany('cmdb_hardware_product_model',
        [toWrite[i].sys_id],
        { u_end_of_sale: toWrite[i].endOfSale, u_end_of_support: toWrite[i].endOfSupport },
        mode, 1);
      applied.updated += result.updated;
      applied.failed += result.failed;
      result.errors.forEach(function (e) { if (applied.errors.length < 5) applied.errors.push(e); });
    }
  }

  return {
    modelsUsedByEstate: planned.length,
    needingDates: toWrite.length,
    pastEndOfSupport: planned.filter(function (p) { return p.pastSupport; }).length,
    models: planned,
    applied: applied,
    remaining: mode === 'apply' ? 0 : toWrite.length
  };
}

/* ---- controllers -------------------------------------------------------- */

async function controllerWork(customer, batch, mode) {
  const query = 'company=' + customer.sys_id + '^nameLIKEWLC^firmware_versionISEMPTY';
  const total = await countRecords('cmdb_ci_netgear', { query: query });

  const sample = await getRecords('cmdb_ci_netgear', {
    query: 'company=' + customer.sys_id + '^nameLIKEWLC',
    fields: ['sys_id', 'name', 'firmware_version'], limit: 5
  });

  const applied = { updated: 0, failed: 0, errors: [] };
  let remaining = total;

  if (mode === 'apply' && total > 0) {
    const take = Math.min(batch, total);
    const rows = await getRecords('cmdb_ci_netgear', {
      query: query, fields: ['sys_id'], limit: take
    });
    const result = await patchMany('cmdb_ci_netgear',
      rows.map(function (r) { return r.sys_id; }),
      { firmware_version: CONTROLLER_VERSION }, mode);
    applied.updated = result.updated;
    applied.failed = result.failed;
    applied.errors = result.errors;
    remaining = total - take;
  }

  return {
    controllersFound: sample.length ? total + sample.filter(function (s) {
      return String(s.firmware_version || '').trim() !== '';
    }).length : total,
    needingVersion: total,
    versionToSet: CONTROLLER_VERSION,
    examples: sample.map(function (s) { return s.name; }),
    applied: applied,
    remaining: remaining
  };
}

/* ---- handler ------------------------------------------------------------ */

export default async function handler(req, res) {
  if (methodOf(req) !== 'POST') { sendJson(res, 405, { error: 'Use POST.' }); return; }
  const session = requireSession(req);
  if (!session) { unauthorised(res); return; }

  const problem = configProblem();
  if (problem) { sendJson(res, 503, { error: problem }); return; }

  const body = await readJsonBody(req);
  if (body === null) { sendJson(res, 400, { error: 'Expected a JSON body.' }); return; }

  const fix = String((body && body.fix) || '').toLowerCase();
  const mode = (body && body.mode) === 'apply' ? 'apply' : 'preview';
  const batch = Math.max(1, Math.min(Number(body && body.batch) || 120, 300));

  if (['exposure', 'lifecycle', 'controllers'].indexOf(fix) === -1) {
    sendJson(res, 400, {
      error: 'Pass fix as "exposure", "lifecycle" or "controllers".'
    });
    return;
  }

  /* Refuse early and explain, rather than part-way through a batch. */
  if (mode === 'apply' && !isWriteEnabled()) {
    sendJson(res, 403, { error: writeProblem('apply') });
    return;
  }

  const started = Date.now();

  try {
    const customer = await customerId();
    if (!customer) {
      sendJson(res, 404, { error: 'The customer company was not found.' });
      return;
    }

    let result;
    if (fix === 'exposure') result = await exposureWork(customer, batch, mode);
    else if (fix === 'lifecycle') result = await lifecycleWork(customer, mode);
    else result = await controllerWork(customer, batch, mode);

    sendJson(res, 200, {
      ok: true,
      fix: fix,
      mode: mode,
      instance: instanceHost(),
      actionedBy: session.u,
      elapsedMs: Date.now() - started,
      result: result,
      remaining: result.remaining,
      done: result.remaining === 0,
      note: mode === 'preview'
        ? 'Nothing was written. Send mode "apply" to make these changes.'
        : null,
      caution: fix === 'lifecycle'
        ? 'These end-of-sale and end-of-support dates are illustrative, '
          + 'invented for the demo. Do not present them as real vendor '
          + 'lifecycle data.'
        : null
    });
  } catch (error) {
    if (error instanceof WriteRefused) { sendJson(res, 403, { error: error.message }); return; }
    if (error instanceof ConfigError) { sendJson(res, 503, { error: error.message }); return; }
    if (error instanceof ServiceNowError) {
      sendJson(res, 502, { error: error.message, detail: error.detail });
      return;
    }
    sendJson(res, 500, {
      error: 'Fix failed: ' + (error && error.message ? error.message : 'unknown')
    });
  }
}
