/* Server-side ServiceNow client. Read only, on purpose.

   Nothing in this file writes. Writes arrive later, in their own module, behind
   their own switch, so that "the agent changed something" can never be an
   accident of a wrong verb.

   Credentials come from the environment and are never logged, never returned to
   a caller and never sent to a browser. Basic authentication over HTTPS, which
   is what A8 settled as the simplest thing that works on a developer instance.

   SERVICENOW_INSTANCE must be a bare hostname. It is validated rather than
   tidied up, because what people paste there is a full login URL carrying a
   username and password in the query string, and accepting that would leak the
   credential into every error message and response.

   Three failure modes are handled explicitly: a misconfigured host, a sleeping
   developer instance that answers with an HTML page instead of JSON, and a slow
   instance that would otherwise hang until the function duration cap kills it
   with no useful message. */

const DEFAULT_TIMEOUT_MS = 8000;

/* A bare hostname and nothing else. No scheme, no path, no query, no userinfo,
   no port. Anything else is rejected rather than cleaned up, because the thing
   people paste here is a full login URL with a username and password in the
   query string, and quietly accepting it leaks the credential into every error
   message and every response. */
const HOST_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/* Describes what is wrong with the configuration, or null if it is sound.
   Never includes the value itself, which may be a credential. */
export function configProblem() {
  const raw = (process.env.SERVICENOW_INSTANCE || '').trim();
  const user = process.env.SERVICENOW_USER || '';
  const password = process.env.SERVICENOW_PASSWORD || '';

  const missing = [];
  if (!raw) missing.push('SERVICENOW_INSTANCE');
  if (!user) missing.push('SERVICENOW_USER');
  if (!password) missing.push('SERVICENOW_PASSWORD');
  if (missing.length) return 'Not configured: ' + missing.join(', ') + '.';

  const host = raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '');

  if (/[?#]/.test(host) || host.indexOf('/') !== -1) {
    return 'SERVICENOW_INSTANCE must be the bare host, such as '
      + 'dev12345.service-now.com. It currently contains a path or a query '
      + 'string, which usually means a full login URL was pasted in. If that '
      + 'URL carried a user_name and user_password, treat that password as '
      + 'compromised and change it.';
  }
  if (host.indexOf('@') !== -1) {
    return 'SERVICENOW_INSTANCE contains credentials. Use the bare host only, '
      + 'and put the user and password in SERVICENOW_USER and '
      + 'SERVICENOW_PASSWORD. Treat the embedded password as compromised.';
  }
  if (!HOST_PATTERN.test(host)) {
    return 'SERVICENOW_INSTANCE is not a valid hostname. Expected something '
      + 'like dev12345.service-now.com.';
  }
  return null;
}

function config() {
  const problem = configProblem();
  if (problem) throw new ConfigError(problem);
  const host = (process.env.SERVICENOW_INSTANCE || '').trim()
    .replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return {
    host: host,
    user: process.env.SERVICENOW_USER,
    password: process.env.SERVICENOW_PASSWORD
  };
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

/* The validated bare hostname, or null. Safe to show: the validation above is
   what makes that claim true, rather than hope. */
export function instanceHost() {
  if (configProblem()) return null;
  return config().host;
}

export function isConfigured() {
  return configProblem() === null;
}

/* The single transport. Exported so the write module can reuse the error
   handling without duplicating it, and so every call to the instance goes
   through one place. Reads in this file only ever pass GET. */
export async function apiRequest(method, path, options) {
  const opts = options || {};
  const cfg = config();
  const timeout = opts.timeoutMs || DEFAULT_TIMEOUT_MS;

  const url = new URL('https://' + cfg.host + path);
  Object.keys(opts.params || {}).forEach(function (key) {
    const value = opts.params[key];
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeout);

  const headers = {
    accept: 'application/json',
    authorization: authHeader(cfg)
  };
  if (opts.body) headers['content-type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, {
      method: method,
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (error && error.name === 'AbortError') {
      throw new ServiceNowError(
        'The instance did not answer within ' + timeout + 'ms. A developer '
        + 'instance that has been idle may be hibernating.',
        { path: path, cause: 'timeout' }
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
      + ' rather than JSON, which means a web page came back instead of the '
      + 'Table API. The usual causes, in order: the developer instance is '
      + 'hibernating and needs waking from the developer portal; the '
      + 'credentials were refused and a login page was returned; or '
      + 'SERVICENOW_INSTANCE is not the bare host.',
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

function request(path, params, options) {
  return apiRequest('GET', path, {
    params: params,
    timeoutMs: options && options.timeoutMs
  });
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
