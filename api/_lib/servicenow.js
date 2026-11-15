/* Server-side ServiceNow client. Read only, on purpose.

   Nothing in this file writes. Writes arrive later, in their own module, behind
   their own switch, so that "the agent changed something" can never be an
   accident of a wrong verb.

   Credentials come from the environment and are never logged, never returned to
   a caller and never sent to a browser. Basic authentication over HTTPS, which
   is what A8 settled as the simplest thing that works on a developer instance.

   Two failure modes matter more than the rest and are handled explicitly:
   a sleeping developer instance, which answers with an HTML holding page rather
   than JSON, and a slow instance, which would otherwise hang until the function
   duration cap kills it with no useful message. */

const DEFAULT_TIMEOUT_MS = 8000;

function config() {
  const host = (process.env.SERVICENOW_INSTANCE || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  const user = process.env.SERVICENOW_USER || '';
  const password = process.env.SERVICENOW_PASSWORD || '';
  if (!host || !user || !password) {
    const missing = [];
    if (!host) missing.push('SERVICENOW_INSTANCE');
    if (!user) missing.push('SERVICENOW_USER');
    if (!password) missing.push('SERVICENOW_PASSWORD');
    throw new ConfigError('Not configured: ' + missing.join(', '));
  }
  return { host: host, user: user, password: password };
}

export class ConfigError extends Error {}

export class ServiceNowError extends Error {
  constructor(message, detail) {
    super(message);
    this.detail = detail || {};
  }
}

function authHeader(cfg) {
  return 'Basic ' + Buffer.from(cfg.user + ':' + cfg.password).toString('base64');
}

/* The instance host, safe to show: no credential in it. */
export function instanceHost() {
  try {
    return config().host;
  } catch (error) {
    return null;
  }
}

export function isConfigured() {
  try {
    config();
    return true;
  } catch (error) {
    return false;
  }
}

async function request(path, params, options) {
  const cfg = config();
  const timeout = (options && options.timeoutMs) || DEFAULT_TIMEOUT_MS;

  const url = new URL('https://' + cfg.host + path);
  Object.keys(params || {}).forEach(function (key) {
    const value = params[key];
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeout);

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: authHeader(cfg)
      },
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (error && error.name === 'AbortError') {
      throw new ServiceNowError(
        'The instance did not answer within ' + timeout + 'ms. A developer '
        + 'instance that has been idle may be hibernating.',
        { table: path, cause: 'timeout' }
      );
    }
    throw new ServiceNowError('Could not reach the instance.', { cause: 'network' });
  }
  clearTimeout(timer);

  const contentType = response.headers.get('content-type') || '';

  /* A hibernating instance serves an HTML page, with a 200, to every request. */
  if (contentType.indexOf('json') === -1) {
    throw new ServiceNowError(
      'The instance answered with ' + (contentType || 'no content type')
      + ' rather than JSON. That is what a hibernating developer instance does; '
      + 'wake it from the developer portal and try again.',
      { status: response.status, cause: 'not-json' }
    );
  }

  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw new ServiceNowError('The instance returned malformed JSON.', { cause: 'bad-json' });
  }

  if (response.status === 401) {
    throw new ServiceNowError(
      'The instance rejected the credentials. Check the integration user.',
      { status: 401, cause: 'auth' }
    );
  }
  if (response.status === 403) {
    throw new ServiceNowError(
      'The integration user is not allowed to read that. This client only ever '
      + 'reads, so this is a missing role rather than a blocked write.',
      { status: 403, cause: 'forbidden' }
    );
  }
  if (!response.ok) {
    const detail = body && body.error ? (body.error.message || body.error.detail) : null;
    throw new ServiceNowError(
      'ServiceNow returned ' + response.status + (detail ? ': ' + detail : ''),
      { status: response.status, cause: 'http' }
    );
  }

  return body;
}

/* Rows from a table. `fields` keeps the payload small, which matters on a
   capped function. `displayValue` of 'all' returns both raw and display forms. */
export async function getRecords(table, options) {
  const opts = options || {};
  const body = await request('/api/now/table/' + encodeURIComponent(table), {
    sysparm_query: opts.query,
    sysparm_fields: opts.fields ? opts.fields.join(',') : undefined,
    sysparm_limit: opts.limit === undefined ? 20 : opts.limit,
    sysparm_offset: opts.offset,
    sysparm_display_value: opts.displayValue || 'false',
    sysparm_exclude_reference_link: 'true'
  }, opts);
  return (body && body.result) || [];
}

/* Row count through the aggregate endpoint, which is far cheaper than paging. */
export async function countRecords(table, options) {
  const opts = options || {};
  const body = await request('/api/now/stats/' + encodeURIComponent(table), {
    sysparm_count: 'true',
    sysparm_query: opts.query
  }, opts);
  const stats = body && body.result && body.result.stats;
  const count = stats && stats.count;
  return count === undefined ? null : Number(count);
}

/* Does a table exist and can we read it? Returns a small report, never throws
   for the ordinary "not there" case, because the whole point is to find out. */
export async function probeTable(table) {
  try {
    const count = await countRecords(table);
    return { table: table, exists: true, readable: true, count: count };
  } catch (error) {
    if (error instanceof ServiceNowError) {
      const cause = error.detail && error.detail.cause;
      const status = error.detail && error.detail.status;
      if (status === 404 || (cause === 'http' && status === 400)) {
        return { table: table, exists: false, readable: false, count: null };
      }
      if (cause === 'forbidden') {
        return { table: table, exists: true, readable: false, count: null, note: 'no read access' };
      }
      return { table: table, exists: null, readable: false, count: null, note: error.message };
    }
    throw error;
  }
}

/* Is a named column present on a table? Asks the dictionary, which an itil user
   may not be allowed to read, so an unknown answer is a valid answer. */
export async function probeField(table, element) {
  try {
    const rows = await getRecords('sys_dictionary', {
      query: 'name=' + table + '^element=' + element,
      fields: ['name', 'element', 'internal_type'],
      limit: 1
    });
    return { table: table, field: element, present: rows.length > 0 };
  } catch (error) {
    return {
      table: table,
      field: element,
      present: null,
      note: 'could not read sys_dictionary'
    };
  }
}

/* Small concurrency limiter: a populated instance means ~30 probes, and firing
   them all at once is rude to a developer instance. */
export async function mapLimited(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function lane() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  const lanes = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) lanes.push(lane());
  await Promise.all(lanes);
  return results;
}
