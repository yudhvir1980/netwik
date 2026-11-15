/* Stage 2: match an advisory against the estate.

   Deterministic code, no model call, no spend, no writes. This is the stage
   everything downstream depends on, and it is exactly the kind of work a
   language model should not be doing: comparing version strings and filtering
   several hundred records is a query, not a judgement.

   Output is a funnel rather than a number, because "412 devices are affected"
   is the answer every scanner already gives and nobody trusts. The funnel shows
   how a few hundred becomes a short list, and why each device left the set. */

import { requireSession, unauthorised } from '../lib/auth.js';
import { sendJson, methodOf, readJsonBody } from '../lib/http.js';
import {
  getRecords, mapLimited, instanceHost, configProblem,
  ServiceNowError, ConfigError
} from '../lib/servicenow.js';
import { classify, needsAttention } from '../lib/versions.js';

const VERSION_FIELD = 'firmware_version';

/* Wireless controllers are deliberately absent: they live in cmdb_ci_netgear,
   which carries no version on this instance, so they cannot be matched. The
   response says so rather than quietly leaving them out. */
const CLASSES = [
  { table: 'cmdb_ci_ip_router', label: 'SD-WAN edges' },
  { table: 'cmdb_ci_ip_firewall', label: 'Firewalls' },
  { table: 'cmdb_ci_ip_switch', label: 'Switches' },
  { table: 'cmdb_ci_wap_network', label: 'Access points' }
];

const FIELDS = [
  'sys_id', 'name', VERSION_FIELD, 'internet_facing', 'u_site_code',
  'u_device_role', 'install_status', 'operational_status', 'support_group',
  'model_id', 'manufacturer.name',
  'location.u_site_tier', 'location.u_gxp', 'location.name'
];

/* The worked example, used when the caller sends no advisory of its own. It is
   shaped like a real management-interface flaw and is clearly fictional. */
const SAMPLE_ADVISORY = {
  advisoryId: 'NETWIK-DEMO-0001',
  title: 'Authentication bypass in the web management interface',
  vendor: 'Cisco',
  cvss: 9.8,
  exploited: true,
  affected: [{ from: '17.6.1', to: '17.9.4' }, { exact: '17.12.1' }],
  fixed: ['17.9.5', '17.12.2']
};

function truthy(value) {
  const text = String(value == null ? '' : value).toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

function field(record, name) {
  const direct = record[name];
  if (direct !== undefined) return direct;
  return record[name.replace('.', '_')];
}

export default async function handler(req, res) {
  if (methodOf(req) !== 'POST') {
    sendJson(res, 405, { error: 'Use POST.' });
    return;
  }
  const session = requireSession(req);
  if (!session) { unauthorised(res); return; }

  const problem = configProblem();
  if (problem) { sendJson(res, 503, { error: problem }); return; }

  const body = await readJsonBody(req);
  if (body === null) { sendJson(res, 400, { error: 'Expected a JSON body.' }); return; }
  const advisory = (body && body.advisory) || SAMPLE_ADVISORY;
  const vendor = advisory.vendor ? String(advisory.vendor).toLowerCase().split(' ')[0] : null;

  if (!Array.isArray(advisory.affected) || !advisory.affected.length) {
    sendJson(res, 400, {
      error: 'The advisory needs an "affected" array of { from, to } or { exact } entries.'
    });
    return;
  }

  const started = Date.now();

  try {
    const companies = await getRecords('core_company', {
      query: 'nameLIKEveridian', fields: ['sys_id', 'name'], limit: 1
    });
    if (!companies.length) {
      sendJson(res, 404, { error: 'The customer company was not found on the instance.' });
      return;
    }
    const customer = companies[0];

    const perClass = await mapLimited(CLASSES, 2, async function (entry) {
      const rows = await getRecords(entry.table, {
        query: 'company=' + customer.sys_id,
        fields: FIELDS,
        limit: 2000
      });
      return { entry: entry, rows: rows };
    });

    const funnel = {
      inScopeDevices: 0,
      otherVendor: 0,
      examinedForThisVendor: 0,
      withReadableVersion: 0,
      affected: 0,
      unknownVersion: 0,
      notVulnerable: 0,
      /* Split out, because "carrying the fix" on its own reads as though a
         remediation happened. Mostly these devices were never in scope. */
      atOrAboveFixedRelease: 0,
      outsideAdvisoryScope: 0,
      retiredAndIgnored: 0
    };

    /* Sanity check on the field risk banding will lean on. If nearly every
       device claims to be internet-facing, the field is not a usable signal
       and stage 4 must not pretend otherwise. */
    const exposure = { internetFacing: 0, notInternetFacing: 0 };
    let missingSupportGroup = 0;

    const affectedDevices = [];
    const byClass = [];
    const bySite = {};

    perClass.forEach(function (group) {
      const counts = { affected: 0, fixed: 0, notAffected: 0, unknown: 0, retired: 0, otherVendor: 0 };

      group.rows.forEach(function (row) {
        /* Retired kit is not an exposure. Excluding it is the first honest
           reduction, and it is recorded rather than silently dropped. */
        const installStatus = String(field(row, 'install_status') || '');
        if (installStatus === '7' || installStatus === '8') {
          counts.retired++;
          funnel.retiredAndIgnored++;
          return;
        }

        funnel.inScopeDevices++;

        if (truthy(field(row, 'internet_facing'))) exposure.internetFacing++;
        else exposure.notInternetFacing++;

        /* An advisory belongs to one vendor. Without this check a Cisco
           advisory quoting 10.x ranges would match PAN-OS 10.2.11, which is a
           different product that merely shares a number. */
        const maker = String(field(row, 'manufacturer.name') || '');
        if (vendor && maker && maker.toLowerCase().indexOf(vendor) === -1) {
          counts.otherVendor++;
          funnel.otherVendor++;
          return;
        }

        funnel.examinedForThisVendor++;
        const version = field(row, VERSION_FIELD);
        const state = classify(version, advisory.affected, advisory.fixed);

        if (state !== 'unknown') funnel.withReadableVersion++;

        if (state === 'affected') { counts.affected++; funnel.affected++; }
        else if (state === 'fixed') {
          counts.fixed++; funnel.atOrAboveFixedRelease++; funnel.notVulnerable++;
        } else if (state === 'unknown') { counts.unknown++; funnel.unknownVersion++; }
        else { counts.notAffected++; funnel.outsideAdvisoryScope++; funnel.notVulnerable++; }

        if (!needsAttention(state)) return;
        if (!field(row, 'support_group')) missingSupportGroup++;

        const site = field(row, 'u_site_code') || field(row, 'location.name') || 'unknown';
        const gxp = truthy(field(row, 'location.u_gxp'));
        const exposed = truthy(field(row, 'internet_facing'));

        if (!bySite[site]) {
          bySite[site] = { site: site, count: 0, gxp: gxp, internetFacing: 0, tier: field(row, 'location.u_site_tier') || null };
        }
        bySite[site].count++;
        if (exposed) bySite[site].internetFacing++;

        affectedDevices.push({
          name: field(row, 'name'),
          sys_id: field(row, 'sys_id'),
          version: version,
          state: state,
          class: group.entry.label,
          site: site,
          siteTier: field(row, 'location.u_site_tier') || null,
          gxp: gxp,
          internetFacing: exposed,
          role: field(row, 'u_device_role') || null,
          supportGroup: field(row, 'support_group') || null
        });
      });

      byClass.push({
        class: group.entry.label,
        table: group.entry.table,
        examined: group.rows.length,
        otherVendor: counts.otherVendor,
        affected: counts.affected,
        atOrAboveFixedRelease: counts.fixed,
        outsideAdvisoryScope: counts.notAffected,
        unknownVersion: counts.unknown,
        retired: counts.retired
      });
    });

    /* The orderings that decide what gets done first. */
    const internetFacing = affectedDevices.filter(function (d) { return d.internetFacing; });
    const atGxpSites = affectedDevices.filter(function (d) { return d.gxp; });

    const sites = Object.keys(bySite).map(function (key) { return bySite[key]; })
      .sort(function (a, b) { return b.count - a.count; });

    sendJson(res, 200, {
      ok: true,
      instance: instanceHost(),
      matchedBy: session.u,
      elapsedMs: Date.now() - started,
      advisory: {
        advisoryId: advisory.advisoryId,
        title: advisory.title,
        exploited: Boolean(advisory.exploited),
        cvss: advisory.cvss || null,
        vendor: advisory.vendor || null,
        affected: advisory.affected,
        fixed: advisory.fixed || []
      },
      funnel: funnel,
      exposureSignal: {
        internetFacing: exposure.internetFacing,
        notInternetFacing: exposure.notInternetFacing,
        usable: exposure.notInternetFacing > 0,
        note: exposure.notInternetFacing === 0
          ? 'Every in-scope device claims to be internet-facing, which cannot '
            + 'be true of access and industrial switches inside a plant. Treat '
            + 'internet_facing as unset rather than as a risk signal until the '
            + 'data is corrected.'
          : null
      },
      dataGaps: {
        affectedDevicesWithNoSupportGroup: missingSupportGroup
      },
      byClass: byClass,
      bySite: sites,
      needingAction: {
        total: affectedDevices.length,
        internetFacing: internetFacing.length,
        atGxpSites: atGxpSites.length,
        examples: affectedDevices.slice(0, 15)
      },
      caveats: [
        'Every device here is POTENTIALLY affected. Nothing in this instance '
          + 'records whether the vulnerable feature is actually enabled, so a '
          + 'person has to qualify the set before it becomes a true exposure.',
        'Wireless controllers are excluded entirely: they sit in '
          + 'cmdb_ci_netgear, which carries no version field on this instance, '
          + 'so a controller-affecting advisory would be under-reported.',
        'Version ordering is plausible rather than authoritative. Anything '
          + 'unreadable is reported as unknown and counted as needing '
          + 'attention, never as safe.'
      ]
    });
  } catch (error) {
    if (error instanceof ConfigError) { sendJson(res, 503, { error: error.message }); return; }
    if (error instanceof ServiceNowError) {
      sendJson(res, 502, { error: error.message, detail: error.detail });
      return;
    }
    sendJson(res, 500, {
      error: 'Matching failed: ' + (error && error.message ? error.message : 'unknown')
    });
  }
}
