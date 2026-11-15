/* The matching engine, stage 2, as a library.

   Extracted so the read-only endpoint and the persisted agent run share one
   implementation. Two copies of version-comparison logic would drift, and the
   run that writes records must agree exactly with the preview that does not.

   Deterministic: no model call, no writes, no randomness. */

import { getRecords, mapLimited } from './servicenow.js';
import { classify, needsAttention } from './versions.js';

const VERSION_FIELD = 'firmware_version';

/* Wireless controllers now carry a version, so they are matched. They live in
   cmdb_ci_netgear alongside the instance's own demo records, so they are
   selected by naming convention rather than by class. That is a heuristic, and
   the response says so: a controller named outside the convention is missed. */
const CLASSES = [
  { table: 'cmdb_ci_ip_router', label: 'SD-WAN edges' },
  { table: 'cmdb_ci_ip_firewall', label: 'Firewalls' },
  { table: 'cmdb_ci_ip_switch', label: 'Switches' },
  { table: 'cmdb_ci_wap_network', label: 'Access points' },
  { table: 'cmdb_ci_netgear', label: 'Wireless controllers', filter: 'nameLIKEWLC' }
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


export async function findCustomer() {
  const rows = await getRecords('core_company', {
    query: 'nameLIKEveridian', fields: ['sys_id', 'name'], limit: 1
  });
  return rows.length ? rows[0] : null;
}

export { SAMPLE_ADVISORY };

export async function runMatch(customer, advisory) {
  const vendor = advisory.vendor
    ? String(advisory.vendor).toLowerCase().split(' ')[0] : null;

    const perClass = await mapLimited(CLASSES, 2, async function (entry) {
      const rows = await getRecords(entry.table, {
        query: 'company=' + customer.sys_id
          + (entry.filter ? '^' + entry.filter : ''),
        fields: FIELDS,
        limit: 5000
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


    return {
      funnel: funnel,
      exposureSignal: {
        internetFacing: exposure.internetFacing,
        notInternetFacing: exposure.notInternetFacing,
        usable: exposure.notInternetFacing > 0
      },
      dataGaps: { affectedDevicesWithNoSupportGroup: missingSupportGroup },
      byClass: byClass,
      bySite: sites,
      needingAction: affectedDevices,
      internetFacingCount: internetFacing.length,
      gxpCount: atGxpSites.length
    };
}

export const CAVEATS = [
  'Every device here is POTENTIALLY affected. Nothing in this instance records '
    + 'whether the vulnerable feature is actually enabled, so a person has to '
    + 'qualify the set before it becomes a true exposure.',
  'Wireless controllers are selected from cmdb_ci_netgear by name, because that '
    + 'table also holds demo records belonging to the instance itself. A '
    + 'controller named outside the WLC convention would be missed.',
  'Version ordering is plausible rather than authoritative. Anything unreadable '
    + 'is reported as unknown and counted as needing attention, never as safe.'
];
