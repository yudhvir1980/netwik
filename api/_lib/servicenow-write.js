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

/* Exactly which fields this module may ever touch. Anything else is refused. */
const WRITABLE = {
  cmdb_ci_ip_router: ['internet_facing'],
  cmdb_ci_ip_firewall: ['internet_facing'],
  cmdb_ci_ip_switch: ['internet_facing'],
  cmdb_ci_wap_network: ['internet_facing'],
  cmdb_ci_netgear: ['internet_facing', 'firmware_version'],
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
