/* Creating tables and columns in ServiceNow.

   This is the most dangerous module in the project, so it is the narrowest.

   It can do exactly two things: create a table that does not exist, and add a
   column that does not exist. It cannot alter a table, cannot drop one, cannot
   rename anything, and cannot touch a table whose name is not in the schema
   definition. There is no code path here that deletes.

   Four guards, all of which must pass:
     1. SERVICENOW_SCHEMA_ENABLED must be exactly "true". This is deliberately
        a different switch from SERVICENOW_WRITE_ENABLED, so allowing record
        updates never implies allowing schema changes.
     2. The caller must pass apply mode. Preview is the default.
     3. The table must be named in lib/vuln-schema.js.
     4. The table name must start with u_, so nothing can be created that
        collides with a ServiceNow table.

   It is idempotent: anything that already exists is left exactly as it is and
   reported as "exists". Running it twice changes nothing the second time. */

import { apiRequest } from './servicenow.js';
import { TABLE_NAMES } from './vuln-schema.js';

export class SchemaRefused extends Error {}

export function isSchemaEnabled() {
  return process.env.SERVICENOW_SCHEMA_ENABLED === 'true';
}

export function schemaProblem(mode) {
  if (mode !== 'apply') return 'Preview only. Pass mode "apply" to create anything.';
  if (!isSchemaEnabled()) {
    return 'Schema changes are switched off. Set SERVICENOW_SCHEMA_ENABLED to '
      + 'true in the Vercel environment to allow table creation, and switch it '
      + 'back off immediately afterwards.';
  }
  return null;
}

function assertAllowed(table) {
  if (TABLE_NAMES.indexOf(table) === -1) {
    throw new SchemaRefused('Not a table this project defines: ' + table + '.');
  }
  if (table.indexOf('u_') !== 0) {
    throw new SchemaRefused('Refusing a table name that is not prefixed u_: ' + table + '.');
  }
}

async function findOne(table, query, fields) {
  const body = await apiRequest('GET', '/api/now/table/' + table, {
    params: {
      sysparm_query: query,
      sysparm_fields: fields.join(','),
      sysparm_limit: 1,
      sysparm_exclude_reference_link: 'true'
    }
  });
  const rows = (body && body.result) || [];
  return rows.length ? rows[0] : null;
}

export async function tableExists(table) {
  const row = await findOne('sys_db_object', 'name=' + table, ['sys_id', 'name', 'label']);
  return row ? { sys_id: row.sys_id, label: row.label } : null;
}

export async function fieldExists(table, element) {
  const row = await findOne('sys_dictionary',
    'name=' + table + '^element=' + element, ['sys_id', 'element', 'internal_type']);
  return row ? { sys_id: row.sys_id, type: row.internal_type } : null;
}

/* Creates the table. Returns { created } or { exists } and never both. */
export async function createTable(table, label, mode) {
  const problem = schemaProblem(mode);
  if (problem) throw new SchemaRefused(problem);
  assertAllowed(table);

  const already = await tableExists(table);
  if (already) return { table: table, outcome: 'exists', sys_id: already.sys_id };

  try {
    const body = await apiRequest('POST', '/api/now/table/sys_db_object', {
      params: { sysparm_fields: 'sys_id,name' },
      body: { name: table, label: label },
      timeoutMs: 20000
    });
    const created = body && body.result;
    return { table: table, outcome: 'created', sys_id: created && created.sys_id };
  } catch (error) {
    return {
      table: table,
      outcome: 'failed',
      error: error && error.message ? error.message : 'unknown',
      cause: error && error.detail ? error.detail.cause : null
    };
  }
}

/* Adds one column. spec is { type, len, ref } from the schema definition. */
export async function createField(table, element, label, spec, mode) {
  const problem = schemaProblem(mode);
  if (problem) throw new SchemaRefused(problem);
  assertAllowed(table);

  const already = await fieldExists(table, element);
  if (already) return { field: element, outcome: 'exists' };

  const record = {
    name: table,
    element: element,
    column_label: label,
    internal_type: spec.type,
    active: 'true',
    read_only: 'false'
  };
  if (spec.len) record.max_length = String(spec.len);
  if (spec.ref) record.reference = spec.ref;

  try {
    await apiRequest('POST', '/api/now/table/sys_dictionary', {
      params: { sysparm_fields: 'sys_id' },
      body: record,
      timeoutMs: 20000
    });
    return { field: element, outcome: 'created' };
  } catch (error) {
    return {
      field: element,
      outcome: 'failed',
      error: error && error.message ? error.message : 'unknown'
    };
  }
}
