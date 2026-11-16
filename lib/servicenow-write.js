/* Writing to ServiceNow. Separate module, separate switch, on purpose.

   The read client cannot write at all. Everything that changes a record goes
   through here, so "the agent changed something" can never be the accident of
   a wrong verb in a read path.

   Three guards, all of which must pass:
     1. SERVICENOW_WRITE_ENABLED must be exactly "true".
     2. The caller must pass an explicit apply mode. Preview is the default
        everywhere, so nothing changes because a button was pressed twice.
     3. Only the fields named in an allow-list per table may be written. A typo
        in a field name fails loudly rather than writing somewhere unexpected.

   This is deliberately narrow. It exists to repair known data gaps, not to be
   a general write interface. The agent flow will get its own, with the approval
   gates the use case specifies. */

import { apiRequest } from './servicenow.js';
import { TABLE_NAMES } from './vuln-schema.js';

/* Exactly which fields this module may ever touch. Anything else is refused. */
const WRITABLE = {
  cmdb_ci_ip_router: ['internet_facing'],
  cmdb_ci_ip_firewall: ['internet_facing'],
  cmdb_ci_ip_switch: ['internet_facing'],
  cmdb_ci_wap_network: ['internet_facing'],
  cmdb_ci_netgear: ['internet_facing', 'firmware_version', 'managed_by_group'],
  cmdb_hardware_product_model: ['u_end_of_support', 'u_end_of_sale']
};

export class WriteRefused extends Error {}

export function isWriteEnabled() {
  return process.env.SERVICENOW_WRITE_ENABLED === 'true';
}

export function writeProblem(mode) {
  if (mode !== 'apply') return 'Preview only. Pass mode "apply" to write.';
  if (!isWriteEnabled()) {
    return 'Writing is switched off. Set SERVICENOW_WRITE_ENABLED to true in '
      + 'the Vercel environment to allow it, and switch it back afterwards.';
  }
  return null;
}

function checkAllowed(table, fields) {
  const allowed = WRITABLE[table];
  if (!allowed) {
    throw new WriteRefused('This module may not write to ' + table + '.');
  }
  Object.keys(fields).forEach(function (field) {
    if (allowed.indexOf(field) === -1) {
      throw new WriteRefused(
        'This module may not write ' + field + ' on ' + table + '. Allowed: '
        + allowed.join(', ') + '.'
      );
    }
  });
}

/* Updates one record. Returns { ok } or { ok: false, error } rather than
   throwing, so one bad record cannot abandon a batch halfway through and
   leave the estate in a half-changed state with no report of what happened. */
export async function patchRecord(table, sysId, fields, mode) {
  const problem = writeProblem(mode);
  if (problem) throw new WriteRefused(problem);
  checkAllowed(table, fields);

  if (!sysId || !/^[0-9a-f]{32}$/i.test(String(sysId))) {
    return { ok: false, sysId: sysId, error: 'Not a valid sys_id.' };
  }

  try {
    await apiRequest('PATCH', '/api/now/table/' + encodeURIComponent(table)
      + '/' + encodeURIComponent(sysId), {
      params: { sysparm_fields: 'sys_id' },
      body: fields,
      timeoutMs: 8000
    });
    return { ok: true, sysId: sysId };
  } catch (error) {
    return {
      ok: false,
      sysId: sysId,
      error: error && error.message ? error.message : 'unknown',
      cause: error && error.detail ? error.detail.cause : null
    };
  }
}

/* Applies the same change to many records, a few at a time. Returns a tally
   rather than a list, because a batch can run to hundreds of records. */
export async function patchMany(table, sysIds, fields, mode, concurrency) {
  const limit = Math.max(1, Math.min(concurrency || 6, 10));
  const results = { attempted: sysIds.length, updated: 0, failed: 0, errors: [] };

  let next = 0;
  async function lane() {
    while (true) {
      const index = next++;
      if (index >= sysIds.length) return;
      const outcome = await patchRecord(table, sysIds[index], fields, mode);
      if (outcome.ok) {
        results.updated++;
      } else {
        results.failed++;
        if (results.errors.length < 5) {
          results.errors.push({ sysId: outcome.sysId, error: outcome.error });
        }
      }
    }
  }

  const lanes = [];
  for (let i = 0; i < Math.min(limit, sysIds.length); i++) lanes.push(lane());
  await Promise.all(lanes);
  return results;
}


/* ---- loading the rest of the estate -------------------------------------

   Creating device records for the sites that are designed but not loaded.
   This is an administrative write to the CMDB, so it sits behind the same
   switch as the repairs: SERVICENOW_WRITE_ENABLED and an explicit apply mode.

   Three further guards. Only the device classes and the location table can be
   created. Every device must belong to the customer company passed in, so a
   copy can never land on another company. And every record must carry the
   load marker, so the whole load can be found again. */

const ESTATE_TABLES = [
  'cmdb_ci_ip_router', 'cmdb_ci_ip_firewall', 'cmdb_ci_ip_switch',
  'cmdb_ci_wap_network', 'cmdb_ci_netgear'
];

export async function createEstateRecord(table, fields, mode, guard) {
  const problem = writeProblem(mode);
  if (problem) throw new WriteRefused(problem);

  const isLocation = table === 'cmn_location';
  if (!isLocation && ESTATE_TABLES.indexOf(table) === -1) {
    throw new WriteRefused('The estate load may not create records in ' + table + '.');
  }
  if (!fields || !fields.name) return { ok: false, name: null, error: 'No name.' };
  if (!isLocation) {
    if (!guard || !guard.customerId || fields.company !== guard.customerId) {
      throw new WriteRefused('The estate load only creates devices owned by the customer company.');
    }
    if (!guard.marker || String(fields.comments || '').indexOf(guard.marker) !== 0) {
      throw new WriteRefused('The estate load only creates devices that carry its marker.');
    }
  }
  Object.keys(fields).forEach(function (key) {
    if (key.indexOf('sys_') === 0) {
      throw new WriteRefused('The estate load may not set ' + key + '.');
    }
  });

  try {
    const body = await apiRequest('POST', '/api/now/table/' + encodeURIComponent(table), {
      params: { sysparm_fields: 'sys_id,name', sysparm_exclude_reference_link: 'true' },
      body: fields,
      timeoutMs: 9000
    });
    const row = body && body.result;
    return { ok: true, name: fields.name, sys_id: row && row.sys_id };
  } catch (error) {
    return {
      ok: false, name: fields.name,
      error: error && error.message ? error.message : 'unknown',
      cause: error && error.detail ? error.detail.cause : null
    };
  }
}


/* A record the design calls for and the instance lacks: the 8200 hardware
   model, or a regional site IT group. Same switch, and the record must carry
   the load marker (in comments for a model, in the description for a group)
   so it can be found again. */
const MARKED_IN = { cmdb_hardware_product_model: 'comments', sys_user_group: 'description' };

export async function createEstateModel(fields, mode, marker) {
  return createMarkedRecord('cmdb_hardware_product_model', fields, mode, marker);
}

export async function createEstateGroup(fields, mode, marker) {
  return createMarkedRecord('sys_user_group', fields, mode, marker);
}

async function createMarkedRecord(table, fields, mode, marker) {
  const problem = writeProblem(mode);
  if (problem) throw new WriteRefused(problem);
  if (!MARKED_IN[table]) throw new WriteRefused('The estate load may not create records in ' + table + '.');
  if (!fields || !fields.name) return { ok: false, error: 'No name.' };
  if (!marker || String(fields[MARKED_IN[table]] || '').indexOf(marker) !== 0) {
    throw new WriteRefused('The estate load only creates a record that carries its marker.');
  }
  Object.keys(fields).forEach(function (key) {
    if (key.indexOf('sys_') === 0) throw new WriteRefused('The estate load may not set ' + key + '.');
  });
  try {
    const body = await apiRequest('POST', '/api/now/table/' + encodeURIComponent(table), {
      params: { sysparm_fields: 'sys_id,name', sysparm_exclude_reference_link: 'true' },
      body: fields,
      timeoutMs: 9000
    });
    const row = body && body.result;
    return { ok: true, name: fields.name, sys_id: row && row.sys_id };
  } catch (error) {
    return { ok: false, name: fields.name, error: error && error.message ? error.message : 'unknown' };
  }
}


/* ---- the flow's own tables ---------------------------------------------

   Writing to the seven u_ tables this project created is the product working,
   not an administrative action, so it is not behind SERVICENOW_WRITE_ENABLED.
   That switch exists to protect ServiceNow's own data: the CMDB, the users,
   the change records. Nothing here can reach any of it.

   The guard is the table list. Only tables defined in lib/vuln-schema.js can
   be written, and that list is fixed in code rather than taken from a caller. */

function assertFlowTable(table) {
  if (TABLE_NAMES.indexOf(table) === -1) {
    throw new WriteRefused(
      'Not one of the flow tables: ' + table + '. Record creation is limited '
      + 'to the tables this project defines.'
    );
  }
}

export function nowStamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export async function createFlowRecord(table, fields) {
  assertFlowTable(table);
  try {
    const body = await apiRequest('POST', '/api/now/table/' + encodeURIComponent(table), {
      params: { sysparm_fields: 'sys_id', sysparm_exclude_reference_link: 'true' },
      body: fields,
      timeoutMs: 10000
    });
    const row = body && body.result;
    return { ok: true, sys_id: row && row.sys_id };
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : 'unknown' };
  }
}

export async function updateFlowRecord(table, sysId, fields) {
  assertFlowTable(table);
  if (!sysId) return { ok: false, error: 'No sys_id.' };
  try {
    await apiRequest('PATCH', '/api/now/table/' + encodeURIComponent(table)
      + '/' + encodeURIComponent(sysId), {
      params: { sysparm_fields: 'sys_id' },
      body: fields,
      timeoutMs: 10000
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : 'unknown' };
  }
}

/* Creates many rows with bounded concurrency. Returns a tally plus the ids,
   because the caller needs them to link stages and items together. */
export async function createFlowRecords(table, rows, concurrency) {
  assertFlowTable(table);
  const limit = Math.max(1, Math.min(concurrency || 5, 8));
  const result = { attempted: rows.length, created: 0, failed: 0, ids: [], errors: [] };
  let next = 0;
  async function lane() {
    while (true) {
      const i = next++;
      if (i >= rows.length) return;
      const outcome = await createFlowRecord(table, rows[i]);
      if (outcome.ok) { result.created++; result.ids.push(outcome.sys_id); }
      else {
        result.failed++;
        if (result.errors.length < 5) result.errors.push(outcome.error);
      }
    }
  }
  const lanes = [];
  for (let i = 0; i < Math.min(limit, rows.length); i++) lanes.push(lane());
  await Promise.all(lanes);
  return result;
}
