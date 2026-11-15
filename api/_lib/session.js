/* Signed session cookie. No dependencies: node:crypto only.
   A session is a base64url JSON payload plus an HMAC of it, so nothing is stored
   server side. The secret lives only in SESSION_SECRET. */

import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'nk_session';
const TTL_SECONDS = 60 * 60 * 8;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error('SESSION_SECRET is missing or shorter than 32 characters');
  }
  return value;
}

function mac(body) {
  return createHmac('sha256', secret()).update(body).digest('base64url');
}

export function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + mac(body);
}

export function verifySession(token) {
  if (typeof token !== 'string' || token.indexOf('.') === -1) return null;
  const [body, given] = token.split('.');
  if (!body || !given) return null;

  const expected = Buffer.from(mac(body));
  const supplied = Buffer.from(given);
  if (expected.length !== supplied.length) return null;
  if (!timingSafeEqual(expected, supplied)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (error) {
    return null;
  }
  if (!payload || typeof payload.exp !== 'number') return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function issueCookie(username) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const token = signSession({ u: username, exp: exp });
  return COOKIE + '=' + token
    + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + TTL_SECONDS;
}

export function clearCookie() {
  return COOKIE + '=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

export function readSession(request) {
  const header = request.headers.get('cookie') || '';
  const prefix = COOKIE + '=';
  const entry = header
    .split(';')
    .map(function (part) { return part.trim(); })
    .find(function (part) { return part.indexOf(prefix) === 0; });
  if (!entry) return null;
  return verifySession(entry.slice(prefix.length));
}
