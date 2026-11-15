/* Node-style request and response helpers.

   Vercel's Node runtime hands these functions `(req, res)` in the Node style,
   not a Web Request returning a Web Response. Returning a Response from a
   handler does not fail loudly: nothing ever writes to `res`, so the request
   hangs until the gateway gives up. That cost us a deployment to find, hence
   these helpers and the comment. */

export function methodOf(req) {
  return String(req.method || 'GET').toUpperCase();
}

export function cookieHeader(req) {
  const headers = req.headers || {};
  /* Node lower-cases header names; be tolerant anyway. */
  return headers.cookie || headers.Cookie || '';
}

export function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status || 200;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(payload);
}

export function sendJsonWithCookie(res, status, body, cookie) {
  res.setHeader('set-cookie', cookie);
  sendJson(res, status, body);
}

/* Vercel parses a JSON body for us when the content type says so, but not
   always, and not when the body is empty. Handle every shape. */
export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try { return JSON.parse(req.body); } catch (error) { return null; }
  }
  const chunks = [];
  try {
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
  } catch (error) {
    return null;
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    return null;
  }
}
