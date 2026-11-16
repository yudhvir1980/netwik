/* Loads the sites that are designed but not yet in the instance.

   The instance holds five of the customer's 31 sites. This builds the other 26
   by copying a loaded site of the same kind, device for device: routers,
   firewalls, switches, access points and wireless controllers, each given a
   new name, serial number, address and location. The plan lives in
   lib/estate-load.js; this file only reads, decides how much to do, and writes.

   Preview by default. Nothing is written unless the caller sends mode "apply"
   and SERVICENOW_WRITE_ENABLED is true.

   One call handles one batch of one site, because a capped function cannot
   create four hundred records in one invocation. The console calls without a
   site to get the list, then calls each site until it reports done. A device
   that already exists by name is skipped, so the load can be stopped and
   started again, and pressing the button twice creates nothing twice.

   What this does NOT load: WAN lines, relationships between devices, business
   services, and ticket history for the new sites. The response says so. */

import { requireSession, unauthorised } from '../lib/auth.js';
import { sendJson, methodOf, readJsonBody } from '../lib/http.js';
import {
  getRecords, mapLimited, instanceHost, configProblem,
  ServiceNowError, ConfigError
} from '../lib/servicenow.js';
import {
  createEstateRecord, createEstateModel, writeProblem, isWriteEnabled, WriteRefused
} from '../lib/servicenow-write.js';
import {
  MARKER, ORIGINALS, SITES, BRANCH_MODEL, targets, templateCodeFor, buildPlan, countByRole,
  legacyBranchCodes, transform, transformLocation, transformModel, matchLocation
} from '../lib/estate-load.js';

const PARENT = 'cmdb_ci_netgear';
const NOT_LOADED = [
  'WAN lines', 'relationships between devices', 'business services',
  'incidents, changes and other history for the new sites'
];

async function customer() {
  const rows = await getRecords('core_company', {
    query: 'nameLIKEveridian', fields: ['sys_id', 'name'], limit: 1
  });
  return rows.length ? rows[0] : null;
}

/* What is loaded today, read from the original edge routers: which site codes
   exist, and which router models, so sales offices get the right edge. */
async function loadedFacts(customerId) {
  const routers = await getRecords('cmdb_ci_ip_router', {
    query: 'company=' + customerId + '^' + ORIGINALS,
    fields: ['name', 'u_site_code', 'model_id', 'firmware_version', 'manufacturer', 'location'],
    limit: 100
  });
  const codes = [];
  routers.forEach(function (r) {
    const code = String(r.u_site_code || '').toUpperCase();
    if (code && codes.indexOf(code) === -1) codes.push(code);
  });

  const modelIds = [];
  routers.forEach(function (r) {
    if (r.model_id && modelIds.indexOf(r.model_id) === -1) modelIds.push(r.model_id);
  });
  const models = modelIds.length ? await getRecords('cmdb_hardware_product_model', {
    query: 'sys_idIN' + modelIds.join(','), fields: ['sys_id', 'name'], limit: 50
  }) : [];
  const modelName = {};
  models.forEach(function (m) { modelName[m.sys_id] = m.name; });
  routers.forEach(function (r) { r.modelName = modelName[r.model_id] || ''; });

  return { routers: routers, codes: codes };
}

async function siteLocations() {
  return getRecords('cmn_location', {
    query: 'u_site_tierISNOTEMPTY',
    fields: ['sys_id', 'name', 'u_site_tier', 'u_gxp', 'city', 'country'],
    limit: 500
  });
}

/* Should this sales office have an old edge router or a current one, and does
   the copy need its model changed to get there? Returns the override to apply
   to the router, or null to copy the template as it is. */
async function edgeOverrideFor(site, plan, facts, warnings, mode) {
  if (site.tier !== 'T4') return null;
  const template = facts.routers.filter(function (r) {
    return String(r.u_site_code || '').toUpperCase() === plan.branchTemplate;
  })[0];
  if (!template) return null;

  const templateIsLegacy = /vedge/i.test(template.modelName);
  const legacy = legacyBranchCodes(plan.loadedBranch ? plan.loadedBranch.code : null, templateIsLegacy);
  const wantLegacy = legacy.indexOf(site.code) !== -1;
  if (wantLegacy === templateIsLegacy) return null;

  if (wantLegacy) {
    const old = facts.routers.filter(function (r) { return /vedge/i.test(r.modelName); })[0];
    if (!old) {
      warnings.push('No old edge router is loaded to copy, so ' + site.name + ' gets a current one.');
      return null;
    }
    return {
      model_id: old.model_id, firmware_version: old.firmware_version, manufacturer: old.manufacturer,
      modelName: old.modelName, replacesModelName: template.modelName
    };
  }

  /* A current sales-office router: the 8200 model if the instance has it. */
  const found = await getRecords('cmdb_hardware_product_model', {
    query: 'nameLIKE8200', fields: ['sys_id', 'name'], limit: 1
  });
  const current = facts.routers.filter(function (r) { return !/vedge/i.test(r.modelName); })[0];
  if (!found.length) {
    if (!current) {
      warnings.push('No current edge router model was found, so ' + site.name + ' keeps the old one.');
      return null;
    }
    /* The design's sales-office router is missing, so make it from the
       larger sites' model. Once it exists, later calls find it above. */
    let modelId = '(the new ' + BRANCH_MODEL + ' model)';
    if (mode === 'apply') {
      const source = await getRecords('cmdb_hardware_product_model', {
        query: 'sys_id=' + current.model_id, limit: 1
      });
      const made = await createEstateModel(transformModel(source[0] || {}, current.modelName), mode, MARKER);
      if (!made.ok || !made.sys_id) {
        warnings.push('Could not create the ' + BRANCH_MODEL + ' model (' + (made.error || 'no id came back')
          + '), so ' + site.name + ' gets a ' + current.modelName + '.');
        return {
          model_id: current.model_id, firmware_version: current.firmware_version, manufacturer: current.manufacturer,
          modelName: current.modelName, replacesModelName: template.modelName
        };
      }
      modelId = made.sys_id;
    } else {
      warnings.push('The ' + BRANCH_MODEL + ' model is not in the instance. The load creates it once, copied from the ' + current.modelName + '.');
    }
    return {
      model_id: modelId, firmware_version: current.firmware_version, manufacturer: current.manufacturer,
      modelName: BRANCH_MODEL, replacesModelName: template.modelName
    };
  }
  return {
    modelName: found[0].name, replacesModelName: template.modelName,
    model_id: found[0].sys_id,
    firmware_version: current ? current.firmware_version : null,
    manufacturer: current ? current.manufacturer : null
  };
}

async function workOnSite(site, plan, facts, customerId, mode, batch) {
  const warnings = [];
  const templateCode = templateCodeFor(site, plan.branchTemplate);
  const named = SITES.filter(function (s) { return s.code === templateCode; })[0] || plan.loadedBranch;
  const templateSite = {
    code: templateCode, name: named ? named.name : '',
    city: named ? named.city : '', needles: named ? named.needles : [], tier: named ? named.tier : ''
  };

  const [templateRows, existingRows, locations] = await Promise.all([
    getRecords(PARENT, {
      query: 'company=' + customerId + '^u_site_code=' + templateCode + '^' + ORIGINALS,
      fields: ['name', 'sys_class_name'], limit: 1500, timeoutMs: 9000
    }),
    getRecords(PARENT, {
      query: 'company=' + customerId + '^u_site_code=' + site.code,
      fields: ['name'], limit: 1500, timeoutMs: 9000
    }),
    siteLocations()
  ]);

  const built = buildPlan(templateRows, site);
  const have = {};
  existingRows.forEach(function (r) { have[String(r.name).toUpperCase()] = true; });
  const missing = built.items.filter(function (i) { return !have[i.newName.toUpperCase()]; });

  if (built.unparsed.length) {
    warnings.push(built.unparsed.length + ' devices at ' + templateCode + ' have names I cannot read and are not copied, for example ' + built.unparsed[0] + '.');
  }

  let location = matchLocation(locations, site);
  const report = {
    site: site.code, name: site.name, tier: site.tier,
    copiedFrom: templateCode,
    planned: built.items.length,
    plannedByRole: countByRole(built.items),
    alreadyThere: built.items.length - missing.length,
    missing: missing.length,
    notCopied: built.skippedRoles,
    location: location ? { found: true, name: location.name } : { found: false, willCreate: site.name },
    created: 0, failed: 0, errors: [], warnings: warnings
  };

  if (!built.items.length) {
    warnings.push('Nothing to copy: no original devices were found at ' + templateCode + '.');
    report.remaining = 0;
    report.done = true;
    return report;
  }
  if (!missing.length) { report.remaining = 0; report.done = true; return report; }

  /* One batch is one table, so the templates come back in a single read. */
  const table = missing[0].table;
  const take = missing.filter(function (i) { return i.table === table; }).slice(0, batch);
  const templates = await getRecords(table, {
    query: 'company=' + customerId + '^nameIN' + take.map(function (i) { return i.templateName; }).join(','),
    limit: take.length + 5, timeoutMs: 9000
  });
  const byName = {};
  templates.forEach(function (t) { byName[String(t.name).toUpperCase()] = t; });

  const edgeOverride = await edgeOverrideFor(site, plan, facts, warnings, mode);
  const siteIndex = SITES.map(function (s) { return s.code; }).indexOf(site.code);

  if (mode !== 'apply') {
    /* Show a router where one is still to be made, since its model and
       description are the ones most likely to be wrong. */
    const first = missing.filter(function (i) { return i.table === 'cmdb_ci_ip_router'; })[0] || take[0];
    let source = byName[first.templateName.toUpperCase()];
    if (!source) {
      const rows = await getRecords(first.table, {
        query: 'company=' + customerId + '^name=' + first.templateName, limit: 1, timeoutMs: 9000
      });
      source = rows[0];
    }
    report.sample = source ? transform(source, first, {
      customerId: customerId, site: site, siteIndex: siteIndex,
      locationId: location ? location.sys_id : '(the new location)',
      templateSite: templateSite, edgeOverride: edgeOverride
    }) : null;
    if (report.sample) {
      /* Names, not ids, for the two things a person has to judge. */
      const groupId = report.sample.support_group;
      const modelId = report.sample.model_id;
      const [groups, models] = await Promise.all([
        groupId ? getRecords('sys_user_group', { query: 'sys_id=' + groupId, fields: ['name'], limit: 1 }) : [],
        modelId && /^[0-9a-f]{32}$/i.test(modelId)
          ? getRecords('cmdb_hardware_product_model', { query: 'sys_id=' + modelId, fields: ['name'], limit: 1 }) : []
      ]);
      report.sampleGroup = groups.length ? groups[0].name : null;
      report.sampleModel = models.length ? models[0].name : (edgeOverride && first.table === 'cmdb_ci_ip_router' ? edgeOverride.modelName : null);
    }
    report.remaining = missing.length;
    report.done = false;
    return report;
  }

  /* The site needs somewhere to be before it has devices. */
  if (!location) {
    const anchor = facts.routers.filter(function (r) {
      return String(r.u_site_code || '').toUpperCase() === templateCode && r.location;
    })[0];
    const source = anchor ? await getRecords('cmn_location', {
      query: 'sys_id=' + anchor.location, limit: 1
    }) : [];
    const made = await createEstateRecord('cmn_location', transformLocation(source[0] || {}, site), mode);
    if (!made.ok) {
      report.errors.push('Could not create the location: ' + made.error);
      report.failed = 1;
      report.remaining = missing.length;
      report.done = false;
      return report;
    }
    location = { sys_id: made.sys_id, name: site.name };
    report.location = { found: false, created: site.name };
  }

  const guard = { customerId: customerId, marker: MARKER };
  const outcomes = await mapLimited(take, 6, function (item) {
    const source = byName[item.templateName.toUpperCase()];
    if (!source) return Promise.resolve({ ok: false, name: item.newName, error: 'Template ' + item.templateName + ' was not found.' });
    return createEstateRecord(table, transform(source, item, {
      customerId: customerId, site: site, siteIndex: siteIndex,
      locationId: location.sys_id, templateSite: templateSite, edgeOverride: edgeOverride
    }), mode, guard);
  });

  outcomes.forEach(function (o) {
    if (o.ok) report.created++;
    else {
      report.failed++;
      if (report.errors.length < 5) report.errors.push(o.name + ': ' + o.error);
    }
  });
  report.table = table;
  report.remaining = missing.length - report.created;
  report.done = report.remaining === 0;
  return report;
}

export default async function handler(req, res) {
  if (methodOf(req) !== 'POST') { sendJson(res, 405, { error: 'Use POST.' }); return; }
  const session = requireSession(req);
  if (!session) { unauthorised(res); return; }

  const problem = configProblem();
  if (problem) { sendJson(res, 503, { error: problem }); return; }

  const body = await readJsonBody(req);
  if (body === null) { sendJson(res, 400, { error: 'Expected a JSON body.' }); return; }

  const mode = (body && body.mode) === 'apply' ? 'apply' : 'preview';
  const batch = Math.max(1, Math.min(Number(body && body.batch) || 40, 60));
  const siteCode = body && body.site ? String(body.site).toUpperCase() : null;

  if (mode === 'apply' && !isWriteEnabled()) {
    sendJson(res, 403, { error: writeProblem('apply') });
    return;
  }

  const started = Date.now();

  try {
    const owner = await customer();
    if (!owner) { sendJson(res, 404, { error: 'The customer company was not found.' }); return; }

    const facts = await loadedFacts(owner.sys_id);

    /* The name of the loaded sales office's location, in case its code is not
       one I recognise. */
    const known = ['DC1', 'LON', 'NCL', 'PNQ'];
    const branchRouter = facts.routers.filter(function (r) {
      return known.indexOf(String(r.u_site_code || '').toUpperCase()) === -1 && r.location;
    })[0];
    let branchLocationName = null;
    if (branchRouter) {
      const rows = await getRecords('cmn_location', {
        query: 'sys_id=' + branchRouter.location, fields: ['name'], limit: 1
      });
      branchLocationName = rows.length ? rows[0].name : null;
    }

    const plan = targets(facts.codes, branchLocationName);
    const base = {
      ok: true, mode: mode, instance: instanceHost(), actionedBy: session.u,
      loadedToday: facts.codes,
      salesOfficeTemplate: plan.branchTemplate,
      problems: plan.problems,
      notLoadedByThis: NOT_LOADED
    };

    if (!siteCode) {
      sendJson(res, 200, Object.assign(base, {
        sites: plan.list.map(function (s) { return { code: s.code, name: s.name, tier: s.tier }; }),
        elapsedMs: Date.now() - started,
        note: 'Call again with a site code to preview or load that site.'
      }));
      return;
    }

    if (mode === 'apply' && plan.problems.length) {
      sendJson(res, 409, Object.assign(base, {
        ok: false, error: 'Not loading, because the starting point is not what I expected: ' + plan.problems.join(' ')
      }));
      return;
    }

    const site = plan.list.filter(function (s) { return s.code === siteCode; })[0];
    if (!site) {
      sendJson(res, 400, { error: siteCode + ' is not one of the sites to load.' });
      return;
    }
    if (!templateCodeFor(site, plan.branchTemplate)) {
      sendJson(res, 409, { error: 'There is no loaded site to copy ' + site.name + ' from.' });
      return;
    }

    const result = await workOnSite(site, plan, facts, owner.sys_id, mode, batch);
    sendJson(res, 200, Object.assign(base, {
      result: result,
      remaining: result.remaining,
      done: result.done,
      elapsedMs: Date.now() - started,
      note: mode === 'preview' ? 'Nothing was written. Send mode "apply" to create these records.' : null
    }));
  } catch (error) {
    if (error instanceof WriteRefused) { sendJson(res, 403, { error: error.message }); return; }
    if (error instanceof ConfigError) { sendJson(res, 503, { error: error.message }); return; }
    if (error instanceof ServiceNowError) {
      sendJson(res, 502, { error: error.message, detail: error.detail });
      return;
    }
    sendJson(res, 500, {
      error: 'Load failed: ' + (error && error.message ? error.message : 'unknown')
    });
  }
}
