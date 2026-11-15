/* Version comparison for the formats this estate actually uses.

   Real examples read from the instance:
     IOS XE   17.9.5a, 17.9.5, 17.12.3
     PAN-OS   10.2.11-h1

   This is deliberately a plausible comparator, not an authoritative one. No
   vendor publishes a machine-readable ordering of its release trains, so an
   agent that claims certainty here is lying. Where it cannot decide, it says so
   rather than guessing, and the flow treats "unknown" as needing a person.

   Two rules carry most of the weight:

   1. A version with a suffix is newer than the same version without one, so
      17.9.5a is newer than 17.9.5, and 10.2.11-h1 is newer than 10.2.11.
   2. A fix only applies within its own train. 17.9.5 fixing a flaw says nothing
      about 17.12.1, which needs its own fixed release. Treating a fix as global
      is the classic way to under-report exposure. */

/* Splits a version into comparable tokens: 17.9.5a -> [17, 9, 5, 'a'] and
   10.2.11-h1 -> [10, 2, 11, 'h', 1]. */
export function tokenise(version) {
  const text = String(version == null ? '' : version).trim().toLowerCase();
  if (!text) return null;
  const tokens = [];
  text.split(/[.\-_+\s]+/).forEach(function (part) {
    if (!part) return;
    const pieces = part.match(/\d+|[a-z]+/g);
    if (!pieces) return;
    pieces.forEach(function (piece) {
      tokens.push(/^\d+$/.test(piece) ? parseInt(piece, 10) : piece);
    });
  });
  return tokens.length ? tokens : null;
}

/* A real version starts with a number. Without this guard a value like "n/a"
   or "unknown" tokenises happily and then reads as not affected, which turns a
   data gap into a false assurance. It must read as unknown instead. */
export function isParseable(version) {
  const tokens = tokenise(version);
  return tokens !== null && typeof tokens[0] === 'number';
}

/* -1, 0 or 1. Returns null when either side cannot be read at all. */
export function compare(a, b) {
  if (!isParseable(a) || !isParseable(b)) return null;
  const left = tokenise(a);
  const right = tokenise(b);

  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const x = left[i];
    const y = right[i];

    /* A missing token means the shorter version is the base release, which is
       older than the same release carrying a rebuild or hotfix suffix. */
    if (x === undefined) return -1;
    if (y === undefined) return 1;

    const xNum = typeof x === 'number';
    const yNum = typeof y === 'number';
    if (xNum && yNum) {
      if (x !== y) return x < y ? -1 : 1;
      continue;
    }
    if (xNum !== yNum) return xNum ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/* The release train, used to keep a fix inside its own line: 17.9.5a -> "17.9". */
export function train(version) {
  const tokens = tokenise(version);
  if (!tokens || typeof tokens[0] !== 'number') return null;
  const second = typeof tokens[1] === 'number' ? tokens[1] : 0;
  return tokens[0] + '.' + second;
}

/* Inclusive range test. Either bound may be omitted for an open range. */
export function inRange(version, from, to) {
  if (!isParseable(version)) return null;
  if (from) {
    const low = compare(version, from);
    if (low === null) return null;
    if (low < 0) return false;
  }
  if (to) {
    const high = compare(version, to);
    if (high === null) return null;
    if (high > 0) return false;
  }
  return true;
}

/* Does this version fall inside any affected range the advisory lists?
   Each entry is { from, to } or { exact }. */
export function isAffected(version, affected) {
  if (!isParseable(version)) return null;
  const ranges = affected || [];
  for (let i = 0; i < ranges.length; i++) {
    const entry = ranges[i] || {};
    if (entry.exact) {
      if (compare(version, entry.exact) === 0) return true;
      continue;
    }
    const hit = inRange(version, entry.from, entry.to);
    if (hit === null) return null;
    if (hit) return true;
  }
  return false;
}

/* Already carrying the fix? Only a fixed release on the same train counts. */
export function isFixed(version, fixedVersions) {
  if (!isParseable(version)) return null;
  const myTrain = train(version);
  const list = fixedVersions || [];
  for (let i = 0; i < list.length; i++) {
    if (train(list[i]) !== myTrain) continue;
    const result = compare(version, list[i]);
    if (result === null) continue;
    if (result >= 0) return true;
  }
  return false;
}

/* The single call the matcher uses. Four states, with deliberate meanings:

     affected      vulnerable now, inside a range the advisory lists
     fixed         not vulnerable, and running at or above the fixed release
                   for its own train
     not-affected  not vulnerable, and outside the advisory's scope entirely
     unknown       the version could not be read, so a person must decide

   The split between 'fixed' and 'not-affected' matters at verification time,
   when the question is whether a device was remediated or was never in scope.
   Only 'affected' and 'unknown' ever need action. */
export function classify(version, affected, fixedVersions) {
  if (!isParseable(version)) return 'unknown';

  /* Affected is checked first: a release inside a listed range is vulnerable
     even if the same train has a later fixed build. */
  const hit = isAffected(version, affected);
  if (hit === null) return 'unknown';
  if (hit) return 'affected';

  return isFixed(version, fixedVersions) === true ? 'fixed' : 'not-affected';
}

/* The only question most callers have. 'unknown' counts as needing attention,
   because an unreadable version is not evidence of safety. */
export function needsAttention(state) {
  return state === 'affected' || state === 'unknown';
}
