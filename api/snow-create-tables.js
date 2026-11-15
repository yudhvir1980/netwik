/* Creates the tables the vulnerability flow needs.

   Preview by default: it reports what exists and what is missing without
   touching anything. Apply creates only what is missing, and is idempotent, so
   running it twice changes nothing the second time.

   Tables are created before any field, because a reference column cannot
   resolve a table that does not exist yet. If any table is still missing, a
   round does tables only and leaves fields for the next one.

   Work is chunked and the response says what remains, because roughly ninety
   creations will not fit inside one hobby-plan invocation. */

import { requireSession, unauthorised } from '../lib/auth.js';
import { sendJson, methodOf, readJsonBody } from '../lib/http.js';
import { instanceHost, configProblem, ServiceNowError, ConfigError } from '../lib/servicenow.js';
import {
  tableExists, fieldExists, createTable, createField,
  schemaProblem, isSchemaEnabled, SchemaRefused
} from '../lib/servicenow-schema.js';
import { SCHEMA, totalFields } from '../lib/vuln-schema.js';

export default async function handler(req, res) {
  if (methodOf(req) !== 'POST') { sendJson(res, 405, { error: 'Use POST.' }); return; }
  const session = requireSession(req);
  if (!session) { unauthorised(res); return; }

  const problem = configProblem();
  if (problem) { sendJson(res, 503, { error: problem }); return; }

  const body = await readJsonBody(req);
  if (body === null) { sendJson(res, 400, { error: 'Expected a JSON body.' }); return; }

  const mode = (body && body.mode) === 'apply' ? 'apply' : 'preview';
  const batch = Math.max(1, Math.min(Number(body && body.batch) || 25, 60));

  if (mode === 'apply' && !isSchemaEnabled()) {
    sendJson(res, 403, { error: schemaProblem('apply') });
    return;
  }

  const started = Date.now();

  try {
    /* What is already there. One lookup per table, then one per field only for
       tables that exist, since fields of a missing table are all missing. */
    const plan = [];
    const missingTables = [];
    let missingFieldCount = 0;

    for (let i = 0; i < SCHEMA.length; i++) {
      const spec = SCHEMA[i];
      const exists = await tableExists(spec.name);
      const entry = {
        table: spec.name,
        label: spec.label,
        purpose: spec.purpose,
        tableExists: Boolean(exists),
        fieldsDefined: spec.fields.length,
        fieldsPresent: 0,
        fieldsMissing: []
      };

      if (!exists) {
        missingTables.push(spec);
        entry.fieldsMissing = spec.fields.map(function (f) { return f[0]; });
        missingFieldCount += spec.fields.length;
      } else {
        for (let j = 0; j < spec.fields.length; j++) {
          const field = spec.fields[j];
          const present = await fieldExists(spec.name, field[0]);
          if (present) entry.fieldsPresent++;
          else { entry.fieldsMissing.push(field[0]); missingFieldCount++; }
        }
      }
      plan.push(entry);
    }

    const summary = {
      tablesDefined: SCHEMA.length,
      tablesPresent: plan.filter(function (p) { return p.tableExists; }).length,
      tablesMissing: missingTables.length,
      fieldsDefined: totalFields(),
      fieldsMissing: missingFieldCount
    };

    if (mode !== 'apply') {
      sendJson(res, 200, {
        ok: true, mode: 'preview', instance: instanceHost(),
        inspectedBy: session.u, elapsedMs: Date.now() - started,
        summary: summary, plan: plan,
        remaining: missingTables.length + missingFieldCount,
        done: missingTables.length + missingFieldCount === 0,
        note: 'Nothing was created. Send mode "apply" to create what is missing.'
      });
      return;
    }

    /* ---- apply ---- */
    const created = { tables: [], fields: [], failed: [] };
    let budget = batch;

    /* Tables first and alone: a reference column needs its target to exist. */
    if (missingTables.length) {
      for (let i = 0; i < missingTables.length && budget > 0; i++) {
        const result = await createTable(missingTables[i].name, missingTables[i].label, mode);
        budget--;
        if (result.outcome === 'created') created.tables.push(result.table);
        else if (result.outcome === 'failed') created.failed.push(result);
      }
      const remaining = (missingTables.length - created.tables.length) + missingFieldCount;
      sendJson(res, 200, {
        ok: true, mode: 'apply', phase: 'tables', instance: instanceHost(),
        actionedBy: session.u, elapsedMs: Date.now() - started,
        summary: summary, created: created,
        remaining: remaining, done: false,
        note: 'Tables are created before any field. Call again to add columns.'
      });
      return;
    }

    for (let i = 0; i < SCHEMA.length && budget > 0; i++) {
      const spec = SCHEMA[i];
      for (let j = 0; j < spec.fields.length && budget > 0; j++) {
        const field = spec.fields[j];
        const present = await fieldExists(spec.name, field[0]);
        if (present) continue;
        const result = await createField(spec.name, field[0], field[1], field[2], mode);
        budget--;
        if (result.outcome === 'created') created.fields.push(spec.name + '.' + result.field);
        else if (result.outcome === 'failed') created.failed.push(result);
      }
    }

    const stillMissing = Math.max(0, missingFieldCount - created.fields.length);

    sendJson(res, 200, {
      ok: true, mode: 'apply', phase: 'fields', instance: instanceHost(),
      actionedBy: session.u, elapsedMs: Date.now() - started,
      summary: summary, created: created,
      remaining: stillMissing, done: stillMissing === 0,
      note: created.failed.length
        ? 'Some creations failed. The usual cause is the integration user not '
          + 'holding rights over sys_db_object and sys_dictionary.'
        : null
    });
  } catch (error) {
    if (error instanceof SchemaRefused) { sendJson(res, 403, { error: error.message }); return; }
    if (error instanceof ConfigError) { sendJson(res, 503, { error: error.message }); return; }
    if (error instanceof ServiceNowError) {
      sendJson(res, 502, { error: error.message, detail: error.detail });
      return;
    }
    sendJson(res, 500, {
      error: 'Table creation failed: ' + (error && error.message ? error.message : 'unknown')
    });
  }
}
