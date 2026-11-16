/* Loading the rest of the estate: the plan, as pure functions.

   The instance holds five of the customer's 31 sites. This module works out
   what the other 26 should contain by copying a loaded site of the same kind,
   device for device. Copying real records, rather than inventing them from a
   field list, means a new device has exactly the shape of an existing one:
   the same fields, the same support groups, the same spread of software
   versions.

   Nothing in this file talks to the instance. api/snow-load-sites.js does the
   reading and writing and calls in here for every decision, so the preview
   and the load cannot disagree.

   Every record created carries MARKER in its comments. That is how a template
   is told apart from a copy, and how the whole load can be found again. */

export const MARKER = 'Loaded by the Netwik console';

/* Not a template and not a copy: an encoded query fragment. */
export const ORIGINALS = 'commentsISEMPTY^ORcommentsNOT LIKE' + MARKER;

/* The four loaded sites confirmed by device names. The fifth, a sales office,
   is found at run time: it is whichever other site code the original routers
   carry. */
export const TEMPLATE_BY_TIER = { T0: 'DC1', T1: 'LON', T2: 'NCL', T3: 'NCL' };
export const KNOWN_LOADED = ['DC1', 'LON', 'NCL', 'PNQ'];

/* A research lab has no loaded example, so it is built from a plant: no
   factory-floor switches, more access switches, more access points. */
const LAB_COUNTS = { IES: 0, ASW: 20, AP: 200 };

/* Management systems that live in one data centre and are not part of a
   site's own kit. Never copied. */
const NOT_SITE_KIT = /^(VMAN|VMANAGE|VSMART|VSM|VBOND|VBD|PAN|PANO|PANORAMA)$/;

/* Four sales offices keep old edge routers, in the blueprint. The loaded
   office counts as one of them if its router is the old model. */
const LEGACY_BRANCHES = ['WAW', 'JNB', 'MEX', 'BOM', 'DXB'];

/* Every site in the blueprint. `needles` find an existing location record by
   name. Region prefixes follow the loaded names: EU and AS are confirmed, AM
   is my choice for the Americas. */
export const SITES = [
  { code: 'DC1', prefix: 'EU', name: 'London DC1', tier: 'T0', gxp: false, city: 'Slough', country: 'United Kingdom', lat: 51.51, lon: -0.59, needles: ['DC1', 'Slough'] },
  { code: 'DC2', prefix: 'AM', name: 'Ashburn DC2', tier: 'T0', gxp: false, city: 'Ashburn', country: 'USA', lat: 39.04, lon: -77.49, needles: ['DC2', 'Ashburn'] },
  { code: 'DC3', prefix: 'AS', name: 'Singapore DC3', tier: 'T0', gxp: false, city: 'Singapore', country: 'Singapore', lat: 1.42, lon: 103.9, needles: ['DC3'] },

  { code: 'LON', prefix: 'EU', name: 'London HQ', tier: 'T1', gxp: false, city: 'London', country: 'United Kingdom', lat: 51.5, lon: -0.02, needles: ['London HQ', 'Canary Wharf'] },
  { code: 'BOS', prefix: 'AM', name: 'Boston', tier: 'T1', gxp: false, city: 'Boston', country: 'USA', lat: 42.36, lon: -71.06, needles: ['Boston'] },
  { code: 'ZRH', prefix: 'EU', name: 'Zurich', tier: 'T1', gxp: false, city: 'Zurich', country: 'Switzerland', lat: 47.38, lon: 8.54, needles: ['Zurich', 'Zürich'] },
  { code: 'SIN', prefix: 'AS', name: 'Singapore Hub', tier: 'T1', gxp: false, city: 'Singapore', country: 'Singapore', lat: 1.29, lon: 103.85, needles: ['Singapore Hub'] },

  { code: 'NCL', prefix: 'EU', name: 'Newcastle', tier: 'T2', gxp: true, city: 'Newcastle', country: 'United Kingdom', lat: 54.98, lon: -1.62, needles: ['Newcastle'] },
  { code: 'LDS', prefix: 'EU', name: 'Leeds', tier: 'T2', gxp: true, city: 'Leeds', country: 'United Kingdom', lat: 53.8, lon: -1.55, needles: ['Leeds'] },
  { code: 'ORK', prefix: 'EU', name: 'Cork', tier: 'T2', gxp: true, city: 'Cork', country: 'Ireland', lat: 51.9, lon: -8.47, needles: ['Cork'] },
  { code: 'GNT', prefix: 'EU', name: 'Ghent', tier: 'T2', gxp: true, city: 'Ghent', country: 'Belgium', lat: 51.05, lon: 3.72, needles: ['Ghent'] },
  { code: 'RAL', prefix: 'AM', name: 'Raleigh', tier: 'T2', gxp: true, city: 'Raleigh', country: 'USA', lat: 35.78, lon: -78.64, needles: ['Raleigh'] },
  { code: 'IND', prefix: 'AM', name: 'Indianapolis', tier: 'T2', gxp: true, city: 'Indianapolis', country: 'USA', lat: 39.77, lon: -86.16, needles: ['Indianapolis'] },
  { code: 'PNQ', prefix: 'AS', name: 'Pune', tier: 'T2', gxp: true, city: 'Pune', country: 'India', lat: 18.52, lon: 73.86, needles: ['Pune'] },
  { code: 'JUR', prefix: 'AS', name: 'Jurong', tier: 'T2', gxp: true, city: 'Singapore', country: 'Singapore', lat: 1.33, lon: 103.72, needles: ['Jurong'] },

  { code: 'OXF', prefix: 'EU', name: 'Oxford', tier: 'T3', gxp: false, city: 'Oxford', country: 'United Kingdom', lat: 51.75, lon: -1.26, needles: ['Oxford'] },
  { code: 'SAN', prefix: 'AM', name: 'San Diego', tier: 'T3', gxp: false, city: 'San Diego', country: 'USA', lat: 32.72, lon: -117.16, needles: ['San Diego'] },
  { code: 'SHA', prefix: 'AS', name: 'Shanghai', tier: 'T3', gxp: false, city: 'Shanghai', country: 'China', lat: 31.23, lon: 121.47, needles: ['Shanghai'] },

  { code: 'PAR', prefix: 'EU', name: 'Paris', tier: 'T4', gxp: false, city: 'Paris', country: 'France', lat: 48.86, lon: 2.35, needles: ['Paris'] },
  { code: 'MAD', prefix: 'EU', name: 'Madrid', tier: 'T4', gxp: false, city: 'Madrid', country: 'Spain', lat: 40.42, lon: -3.7, needles: ['Madrid'] },
  { code: 'MIL', prefix: 'EU', name: 'Milan', tier: 'T4', gxp: false, city: 'Milan', country: 'Italy', lat: 45.46, lon: 9.19, needles: ['Milan'] },
  { code: 'MUC', prefix: 'EU', name: 'Munich', tier: 'T4', gxp: false, city: 'Munich', country: 'Germany', lat: 48.14, lon: 11.58, needles: ['Munich'] },
  { code: 'WAW', prefix: 'EU', name: 'Warsaw', tier: 'T4', gxp: false, city: 'Warsaw', country: 'Poland', lat: 52.23, lon: 21.01, needles: ['Warsaw'] },
  { code: 'DXB', prefix: 'EU', name: 'Dubai', tier: 'T4', gxp: false, city: 'Dubai', country: 'United Arab Emirates', lat: 25.2, lon: 55.27, needles: ['Dubai'] },
  { code: 'JNB', prefix: 'EU', name: 'Johannesburg', tier: 'T4', gxp: false, city: 'Johannesburg', country: 'South Africa', lat: -26.2, lon: 28.05, needles: ['Johannesburg'] },
  { code: 'TOR', prefix: 'AM', name: 'Toronto', tier: 'T4', gxp: false, city: 'Toronto', country: 'Canada', lat: 43.65, lon: -79.38, needles: ['Toronto'] },
  { code: 'MEX', prefix: 'AM', name: 'Mexico City', tier: 'T4', gxp: false, city: 'Mexico City', country: 'Mexico', lat: 19.43, lon: -99.13, needles: ['Mexico'] },
  { code: 'SAO', prefix: 'AM', name: 'São Paulo', tier: 'T4', gxp: false, city: 'São Paulo', country: 'Brazil', lat: -23.55, lon: -46.63, needles: ['São Paulo', 'Sao Paulo'] },
  { code: 'BOM', prefix: 'AS', name: 'Mumbai', tier: 'T4', gxp: false, city: 'Mumbai', country: 'India', lat: 19.08, lon: 72.88, needles: ['Mumbai'] },
  { code: 'TYO', prefix: 'AS', name: 'Tokyo', tier: 'T4', gxp: false, city: 'Tokyo', country: 'Japan', lat: 35.68, lon: 139.69, needles: ['Tokyo'] },
  { code: 'SYD', prefix: 'AS', name: 'Sydney', tier: 'T4', gxp: false, city: 'Sydney', country: 'Australia', lat: -33.87, lon: 151.21, needles: ['Sydney'] }
];

/* EU-LON-ASW014 -> prefix EU, code LON, role ASW, number 14, width 3. */
export function parseName(name) {
  const m = /^([A-Z]{2})-([A-Z0-9]{2,4})-([A-Z]+?)(\d+)$/.exec(String(name || '').trim().toUpperCase());
  if (!m) return null;
  return { prefix: m[1], code: m[2], role: m[3], num: Number(m[4]), width: m[4].length };
}

function pad(n, width) {
  let text = String(n);
  while (text.length < width) text = '0' + text;
  return text;
}

/* Which sites still have to be loaded, given the site codes the original
   routers carry. Returns the template for sales offices and anything that
   should stop a load before it starts. */
export function targets(originalCodes, branchLocationName) {
  const problems = [];
  const extra = originalCodes.filter(function (c) { return KNOWN_LOADED.indexOf(c) === -1; });
  let branch = null;
  if (extra.length === 1) branch = extra[0];
  else if (extra.length === 0) problems.push('No loaded sales office was found to copy, so sales offices cannot be built.');
  else problems.push('More than one unexpected site is already loaded: ' + extra.join(', ') + '. I expected exactly one sales office.');

  KNOWN_LOADED.forEach(function (c) {
    if (originalCodes.indexOf(c) === -1) problems.push('Expected a loaded site ' + c + ' to copy from, and found none.');
  });

  /* The loaded office is one of the thirteen. Find it by code, or failing
     that by the name of its location, so it is not loaded a second time. */
  let loadedBranch = null;
  if (branch) {
    loadedBranch = SITES.filter(function (s) { return s.tier === 'T4' && s.code === branch; })[0] || null;
    if (!loadedBranch && branchLocationName) {
      const hay = String(branchLocationName).toLowerCase();
      loadedBranch = SITES.filter(function (s) {
        return s.tier === 'T4' && s.needles.some(function (n) { return hay.indexOf(n.toLowerCase()) !== -1; });
      })[0] || null;
    }
    if (!loadedBranch) {
      problems.push('The loaded sales office has the code ' + branch + (branchLocationName ? ' at "' + branchLocationName + '"' : '')
        + ', which I cannot match to one of the thirteen offices. Loading now would create thirteen more, not twelve.');
    }
  }

  const list = SITES.filter(function (s) {
    if (KNOWN_LOADED.indexOf(s.code) !== -1) return false;
    if (loadedBranch && s.code === loadedBranch.code) return false;
    return true;
  });
  return { list: list, branchTemplate: branch, loadedBranch: loadedBranch, problems: problems };
}

export function templateCodeFor(site, branchTemplate) {
  return site.tier === 'T4' ? branchTemplate : TEMPLATE_BY_TIER[site.tier];
}

/* The devices one target site should hold, each paired with the loaded device
   it is copied from. `templateRows` are { name, sys_class_name } for every
   original device at the template site. */
export function buildPlan(templateRows, site) {
  const pools = {};
  const skipped = {};
  const unparsed = [];
  templateRows.forEach(function (row) {
    const p = parseName(row.name);
    if (!p) { unparsed.push(row.name); return; }
    if (NOT_SITE_KIT.test(p.role)) { skipped[p.role] = (skipped[p.role] || 0) + 1; return; }
    if (!pools[p.role]) pools[p.role] = [];
    pools[p.role].push({ name: row.name, table: row.sys_class_name, num: p.num, width: p.width });
  });

  const items = [];
  Object.keys(pools).sort().forEach(function (role) {
    const pool = pools[role].sort(function (a, b) { return a.num - b.num; });
    let count = pool.length;
    if (site.tier === 'T3' && LAB_COUNTS[role] !== undefined) count = LAB_COUNTS[role];
    const top = pool[pool.length - 1].num;
    for (let i = 0; i < count; i++) {
      const from = pool[i % pool.length];
      const num = i < pool.length ? from.num : top + (i - pool.length) + 1;
      items.push({
        role: role,
        table: from.table,
        templateName: from.name,
        newName: site.prefix + '-' + site.code + '-' + role + pad(num, from.width),
        index: items.length
      });
    }
  });
  return { items: items, skippedRoles: skipped, unparsed: unparsed };
}

export function countByRole(items) {
  const out = {};
  items.forEach(function (i) { out[i.role] = (out[i.role] || 0) + 1; });
  return out;
}

/* Which of the sales offices to load keep an old edge router. */
export function legacyBranchCodes(loadedBranchCode, loadedBranchIsLegacy) {
  const want = 4 - (loadedBranchIsLegacy ? 1 : 0);
  return LEGACY_BRANCHES.filter(function (c) { return c !== loadedBranchCode; }).slice(0, want);
}

/* A small stable hash, so a re-run produces the same serials and addresses. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function serialLike(template, name) {
  const base = String(template || '');
  const length = Math.max(base.length, 11);
  let tail = '';
  let seed = name;
  while (tail.length < length) {
    seed = seed + '#';
    tail += hash(seed).toString(36).toUpperCase();
  }
  return (base.slice(0, 3) || 'VLS') + tail.slice(0, length - 3);
}

function macLike(name) {
  const h = hash(name + '/mac').toString(16);
  const hex = ('00000000' + h).slice(-8).toUpperCase();
  return '00:1A:' + hex.slice(0, 2) + ':' + hex.slice(2, 4) + ':' + hex.slice(4, 6) + ':' + hex.slice(6, 8);
}

function escapeRegExp(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* What a kind of site is called in a description, for the one case where a
   site is copied from a different kind: a lab built from a plant. */
const KIND_LABEL = { T3: 'Research lab' };

/* A description names its site in its own words ("Slough DC1" for London
   DC1), its kind of site in brackets, and the device's model. All three can
   be wrong on a copy, so each is put right here. */
export function describe(text, tplSite, site, edgeOverride, isRouter) {
  let out = String(text);
  if (tplSite) {
    const phrases = [];
    if (tplSite.name) phrases.push(tplSite.name);
    if (tplSite.city && tplSite.code) phrases.push(tplSite.city + ' ' + tplSite.code);
    (tplSite.needles || []).forEach(function (n) { if (n.length > 3) phrases.push(n); });
    if (tplSite.city) phrases.push(tplSite.city);
    phrases.sort(function (a, b) { return b.length - a.length; });
    if (phrases.length) {
      /* One pass, longest first, so a replacement is never replaced again. */
      out = out.replace(new RegExp(phrases.map(escapeRegExp).join('|'), 'g'), site.name);
    }
    if (tplSite.tier && tplSite.tier !== site.tier && KIND_LABEL[site.tier]) {
      out = out.replace(/\([^()]*\)\s*$/, '(' + KIND_LABEL[site.tier] + ')');
    }
  }
  if (isRouter && edgeOverride && edgeOverride.modelName && edgeOverride.replacesModelName) {
    out = out.replace(new RegExp(escapeRegExp(edgeOverride.replacesModelName), 'g'), edgeOverride.modelName);
  }
  return out;
}

/* One new device record from one loaded one. `ctx` carries the customer, the
   target site, its position in the site list, the location to use, the
   template site, and an optional edge override. */
export function transform(record, item, ctx) {
  const out = {};
  const tplSite = ctx.templateSite;
  const tplPrefix = (parseName(item.templateName) || {}).prefix || '';

  Object.keys(record).forEach(function (key) {
    if (key.indexOf('sys_') === 0) return;
    if (key === 'asset' || key === 'asset_tag') return;
    let value = record[key];
    if (value === null || value === undefined || value === '') return;
    if (typeof value === 'object') value = value.value;
    if (value === null || value === undefined || value === '') return;
    if (typeof value === 'string') {
      /* Text that names the template device or its site should name the new one. */
      value = value.replace(new RegExp(escapeRegExp(item.templateName), 'gi'), item.newName);
      if (tplSite && tplPrefix) {
        value = value.replace(new RegExp(escapeRegExp(tplPrefix + '-' + tplSite.code + '-'), 'g'), ctx.site.prefix + '-' + ctx.site.code + '-');
      }
      if (tplSite && tplSite.name) {
        value = value.replace(new RegExp(escapeRegExp(tplSite.name), 'g'), ctx.site.name);
      }
    }
    out[key] = value;
  });

  if (out.short_description) {
    out.short_description = describe(out.short_description, tplSite, ctx.site, ctx.edgeOverride, item.table === 'cmdb_ci_ip_router');
  }

  out.name = item.newName;
  out.company = ctx.customerId;
  out.u_site_code = ctx.site.code;
  out.location = ctx.locationId;
  out.comments = MARKER + ', copied from ' + item.templateName + '.';
  if (record.serial_number) out.serial_number = serialLike(record.serial_number, item.newName);
  if (record.ip_address) {
    out.ip_address = '10.' + (60 + ctx.siteIndex) + '.' + (10 + Math.floor(item.index / 250)) + '.' + (item.index % 250 + 1);
  }
  if (record.mac_address) out.mac_address = macLike(item.newName);

  if (ctx.edgeOverride && item.table === 'cmdb_ci_ip_router') {
    out.model_id = ctx.edgeOverride.model_id;
    if (ctx.edgeOverride.firmware_version) {
      out.firmware_version = ctx.edgeOverride.firmware_version;
      if (out.u_software_version) out.u_software_version = ctx.edgeOverride.firmware_version;
    }
    if (ctx.edgeOverride.manufacturer) out.manufacturer = ctx.edgeOverride.manufacturer;
  }
  return out;
}

/* A new site-level location, shaped like the template site's. */
export function transformLocation(record, site) {
  const out = {};
  Object.keys(record || {}).forEach(function (key) {
    if (key.indexOf('sys_') === 0) return;
    if (['parent', 'full_name', 'street', 'zip', 'state', 'phone', 'fax_phone', 'contact', 'primary_location', 'lat_long_error'].indexOf(key) !== -1) return;
    let value = record[key];
    if (value && typeof value === 'object') value = value.value;
    if (value === null || value === undefined || value === '') return;
    out[key] = value;
  });
  out.name = site.name;
  out.city = site.city;
  out.country = site.country;
  out.latitude = String(site.lat);
  out.longitude = String(site.lon);
  out.u_site_tier = site.tier;
  out.u_gxp = site.gxp ? 'true' : 'false';
  return out;
}

/* The location record for a site: same tier, name containing a needle. */
export function matchLocation(locations, site) {
  for (let n = 0; n < site.needles.length; n++) {
    const needle = site.needles[n].toLowerCase();
    const hits = locations.filter(function (l) {
      return String(l.name || '').toLowerCase().indexOf(needle) !== -1;
    });
    const sameTier = hits.filter(function (l) { return String(l.u_site_tier || '').toUpperCase() === site.tier; });
    /* A site and its floors can share a name. The shortest is the site. */
    sameTier.sort(function (a, b) { return String(a.name).length - String(b.name).length; });
    if (sameTier.length) return sameTier[0];
  }
  return null;
}
