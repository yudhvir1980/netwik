/* Who may sign in, and the guard every protected route calls first.

   Two accounts, taken from environment variables: PASSWORD_YUDHVIR and
   PASSWORD_ADMIN. Both hold full rights for now, so there is no role model.
   Passwords are compared as SHA-256 digests through timingSafeEqual, which
   keeps the comparison constant time and length independent. */

import { createHash, timingSafeEqual } from 'node:crypto';
import { readSession } from './session.js';

const USERS = ['yudhvir', 'admin'];

function digest(value) {
  return createHash('sha256').update(String(value), 'utf8').digest();
}

function sameSecret(a, b) {
  return timingSafeEqual(digest(a), digest(b));
}

export function knownUser(username) {
  return USERS.indexOf(username) !== -1;
}

export function checkCredentials(username, password) {
  if (!knownUser(username)) return false;
  const expected = process.env['PASSWORD_' + username.toUpperCase()];
  if (!expected) return false;
  return sameSecret(password, expected);
}

/* Returns the session payload, or null. Every route that spends money or
   touches ServiceNow must call this before doing anything else. */
export function requireSession(request) {
  try {
    return readSession(request);
  } catch (error) {
    return null;
  }
}

export function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export function unauthorised() {
  return json({ error: 'Authentication required.' }, 401);
}
