/* The replay data for workflow.html.
 *
 * One entry per stage of the zero-day vulnerability flow, in the order the
 * flow runs them. Stage 7 is absent on purpose: it was withdrawn from the
 * design, and renumbering the rest would break every reference to them.
 *
 * The device numbers are from a real match against the ServiceNow instance:
 * 755 devices in scope, 10 belonging to another vendor, 12 affected. The
 * hours are my own estimate of the manual effort, not a measurement, and the
 * page says so.
 *
 * Shapes a renderer understands:
 *   intake    the advisory arriving and being read into fields
 *   funnel    a population draining through named reductions
 *   grid      every device in the estate, one square each
 *   gate      a question only a person can answer, and the answer
 *   rows      a list of things with a label, a note, an outcome and a tone
 *   board     the closing dashboard
 */
(function () {
  'use strict';

  var ADVISORY = {
    id: 'NETWIK-DEMO-0001',
    title: 'Authentication bypass in the web management interface',
    vendor: 'Cisco',
    cvss: '9.8',
    exploited: 'Yes, in the wild',
    affected: '17.6.1 to 17.9.4, and 17.12.1 exactly',
    fixed: '17.9.5, 17.12.2'
  };

  var STAGES = [
    {
      n: 0,
      name: 'Intake and de-duplication',
      agent: 'Advisory Intake',
      autonomy: 'agent',
      status: 'running',
      secs: 6,
      manual: 0.5,
      assisted: 0,
      head: 'An advisory arrives and is checked against what is already known.',
      body: 'The vendor publishes. The agent records it, looks for an advisory '
        + 'that already covers the same flaw, and links supersessions rather '
        + 'than opening a second investigation into one problem.',
      viz: {
        kind: 'intake',
        fields: [
          ['Advisory', ADVISORY.id],
          ['Title', ADVISORY.title],
          ['Vendor', ADVISORY.vendor],
          ['CVSS', ADVISORY.cvss],
          ['Exploited', ADVISORY.exploited]
        ]
      },
      log: [
        'intake: advisory ' + ADVISORY.id + ' received',
        'intake: searching u_vulnerability_advisory for a prior record',
        'intake: no prior record, creating one',
        'intake: state set to assessed'
      ]
    },
    {
      n: 1,
      name: 'Advisory analysis',
      agent: 'Advisory Intake',
      autonomy: 'agent',
      status: 'designed',
      secs: 7,
      manual: 2,
      assisted: 0,
      head: 'Prose becomes version ranges a machine can compare.',
      body: 'A vendor advisory is written for people. The agent turns it into '
        + 'ranges, a fixed release per train, and the condition that makes a '
        + 'device genuinely vulnerable. This is the first judgement in the '
        + 'flow, so it is the first place a model earns its place.',
      viz: {
        kind: 'rows',
        rows: [
          { label: 'Affected range', sub: '17.6.1 through 17.9.4', value: 'parsed', tone: 'hot' },
          { label: 'Affected exact', sub: '17.12.1', value: 'parsed', tone: 'hot' },
          { label: 'Fixed in train 17.9', sub: '17.9.5 and later', value: 'parsed', tone: 'good' },
          { label: 'Fixed in train 17.12', sub: '17.12.2 and later', value: 'parsed', tone: 'good' },
          { label: 'Qualifying condition', sub: 'HTTP server enabled on the management interface', value: 'noted', tone: 'warn' }
        ]
      },
      log: [
        'analysis: reading affected and fixed version text',
        'analysis: a fix applies only inside its own release train',
        'analysis: 17.9.5 does not cover a device on 17.12.1',
        'analysis: anything unreadable is returned as unknown, never as safe'
      ]
    },
    {
      n: 2,
      name: 'Estate matching',
      agent: 'Applicability',
      autonomy: 'agent',
      status: 'running',
      secs: 9,
      manual: 16,
      assisted: 0,
      head: 'Every device is compared, and the reason each one leaves the set is kept.',
      body: 'This is where most of the manual week goes: exporting an estate, '
        + 'reading versions, arguing about whether 10.2 is affected when the '
        + 'advisory is about a different vendor entirely. It is also entirely '
        + 'deterministic, which is why no model touches it.',
      viz: {
        kind: 'grid',
        total: 755,
        hot: 12,
        dim: 10,
        legend: [
          ['clear', '733 outside the advisory or already carrying the fix'],
          ['dim', '10 built by another vendor, so not comparable'],
          ['hot', '12 running 17.6.6, inside the affected range']
        ]
      },
      log: [
        'match: 755 devices in scope for the customer',
        'match: 10 excluded, manufacturer does not match the advisory vendor',
        'match: 745 examined against the parsed ranges',
        'match: 12 affected, all on 17.6.6',
        'match: 0 unreadable versions'
      ]
    },
    {
      n: 2.5,
      name: 'Where the twelve are',
      agent: 'Applicability',
      autonomy: 'agent',
      status: 'running',
      secs: 7,
      manual: 2,
      assisted: 0,
      head: 'Twelve devices, three sites, and a regulatory problem.',
      body: 'The shape of the exposure decides the whole remediation plan. '
        + 'None of these twelve faces the internet, which removes the panic. '
        + 'Seven sit at sites under regulatory validation, which removes the '
        + 'easy answer of patching tonight.',
      viz: {
        kind: 'funnel',
        rows: [
          { label: 'Devices in scope', value: 755, tone: 'plain' },
          { label: 'Built by this vendor', value: 745, tone: 'plain' },
          { label: 'Inside the affected range', value: 12, tone: 'hot' },
          { label: 'At a regulated site', value: 7, tone: 'warn' },
          { label: 'Reachable from the internet', value: 0, tone: 'good' }
        ],
        sites: [
          { label: 'PNQ', sub: 'Pune, regulated', value: 5 },
          { label: 'LON', sub: 'London', value: 5 },
          { label: 'NCL', sub: 'Newcastle, regulated', value: 2 }
        ]
      },
      log: [
        'match: grouping by site and regulatory flag',
        'match: PNQ 5, LON 5, NCL 2',
        'match: 7 of 12 at sites under validation',
        'match: 0 of 12 internet facing'
      ]
    },
    {
      n: 3,
      name: 'Configuration qualification',
      agent: 'Applicability',
      autonomy: 'engineer',
      status: 'running',
      secs: 9,
      manual: 6,
      assisted: 1,
      head: 'The agent stops, because the next fact is not in any system it can read.',
      body: 'A device inside the affected range is only vulnerable if the '
        + 'vulnerable feature is switched on. Nothing in the record says '
        + 'whether it is. So every item is written as unknown, never as '
        + 'qualified, and a task is raised naming exactly what a person must '
        + 'confirm. An agent that guessed here would be worse than useless.',
      viz: {
        kind: 'gate',
        who: 'Network engineer on duty',
        question: 'Is the HTTP management server enabled on these twelve devices?',
        options: [
          { label: 'Enabled on 9', note: 'genuinely exposed, remediate', tone: 'hot' },
          { label: 'Disabled on 3', note: 'affected version, not vulnerable', tone: 'good' }
        ],
        answer: 'Enabled on 9 of 12. Three are closed by configuration and drop out.'
      },
      log: [
        'qualify: 3 tasks raised, one per device group',
        'qualify: every item written as qualified = unknown',
        'qualify: waiting on a person',
        'qualify: answered, 9 confirmed, 3 excluded with a reason'
      ]
    },
    {
      n: 4,
      name: 'Risk scoring and banding',
      agent: 'Risk',
      autonomy: 'agent',
      status: 'designed',
      secs: 8,
      manual: 4,
      assisted: 0,
      head: 'Nine devices, three deadlines, and the reasoning written down.',
      body: 'Score from what is known: the flaw is exploited, the service '
        + 'matters, the site is regulated, the device is not exposed. The '
        + 'deadline follows from the band, and the band follows from inputs '
        + 'anyone can check afterwards.',
      viz: {
        kind: 'rows',
        rows: [
          { label: 'Critical', sub: '2 core switches at PNQ, regulated, exploited flaw', value: '48 hours', tone: 'hot' },
          { label: 'High', sub: '5 access switches at LON, no validation window needed', value: '7 days', tone: 'warn' },
          { label: 'Moderate', sub: '2 switches at NCL behind a validated change freeze', value: '30 days', tone: 'plain' }
        ]
      },
      log: [
        'risk: exploit status raises every band by one',
        'risk: 0 internet facing, so no band is raised for exposure',
        'risk: GxP sites inherit a validation window, not a shorter deadline',
        'risk: 2 critical, 5 high, 2 moderate'
      ]
    },
    {
      n: 5,
      name: 'Stakeholder notification',
      agent: 'Communications',
      autonomy: 'human',
      status: 'designed',
      secs: 8,
      manual: 3,
      assisted: 0.5,
      head: 'Four audiences, four briefings, one approval before anything leaves.',
      body: 'The same exposure reads differently to a service owner, a quality '
        + 'lead and a CTO. The agent drafts each one from the same evidence. '
        + 'Nothing is sent until a person approves it, because an agent that '
        + 'can email a regulator unprompted is not a tool I would ship.',
      viz: {
        kind: 'rows',
        rows: [
          { label: 'Service owners', sub: 'what breaks, when, and what you must do', value: 'drafted', tone: 'plain' },
          { label: 'Security operations', sub: 'the flaw, the nine devices, the compensating controls', value: 'drafted', tone: 'plain' },
          { label: 'Quality and validation', sub: 'which validated systems are touched and why', value: 'drafted', tone: 'warn' },
          { label: 'Customer CTO office', sub: 'exposure, cost, and the decision being asked for', value: 'drafted', tone: 'warn' },
          { label: 'Approval to send', sub: 'held until a person releases it', value: 'waiting', tone: 'hot' }
        ]
      },
      log: [
        'comms: 4 briefings drafted from one evidence set',
        'comms: nothing addressed outside the customer organisation',
        'comms: held for approval',
        'comms: released by the duty lead'
      ]
    },
    {
      n: 6,
      name: 'Remediation option analysis',
      agent: 'Remediation Planning',
      autonomy: 'agent',
      status: 'designed',
      secs: 8,
      manual: 5,
      assisted: 0,
      head: 'Patching is one option. The agent is required to cost the others.',
      body: 'Upgrade, disable the feature, put a control in front of it, '
        + 'replace the hardware, or accept the risk with an expiry date. A '
        + 'plan that only ever says patch everything is not a plan, and on '
        + 'ageing kit it is not even possible.',
      viz: {
        kind: 'rows',
        rows: [
          { label: 'Upgrade to 17.9.5', sub: '7 devices, a reboot each, inside a window', value: 'preferred', tone: 'good' },
          { label: 'Disable the HTTP server', sub: '2 devices, no reboot, removes the condition', value: 'immediate', tone: 'good' },
          { label: 'Access control in front', sub: 'buys time on the two under freeze', value: 'interim', tone: 'warn' },
          { label: 'Replace the hardware', sub: '1 edge router past end of support, no fix exists', value: 'procurement', tone: 'hot' },
          { label: 'Accept with an expiry', sub: 'only with CTO sign-off and a re-review date', value: 'last resort', tone: 'hot' }
        ]
      },
      log: [
        'options: checking end-of-support dates before offering an upgrade',
        'options: 1 device past end of support, no fixed release published',
        'options: disabling the feature removes the condition without a reboot',
        'options: 5 option sets produced, each costed'
      ]
    },
    {
      n: 8,
      name: 'Wave and sequence planning',
      agent: 'Remediation Planning',
      autonomy: 'human',
      status: 'designed',
      secs: 9,
      manual: 8,
      assisted: 1,
      head: 'An order that never takes both halves of a pair down at once.',
      body: 'Sequencing is where good intentions break production. High '
        + 'availability pairs go in different waves, the regulated sites wait '
        + 'for a validation window, and the lowest tier goes first so a bad '
        + 'upgrade is found on the least important device.',
      viz: {
        kind: 'rows',
        rows: [
          { label: 'Wave 1, tonight', sub: 'LON tier 3, 2 devices, canary', value: '22:00', tone: 'good' },
          { label: 'Wave 2, tomorrow', sub: 'LON tier 2, 3 devices, second half of each pair', value: '22:00', tone: 'good' },
          { label: 'Wave 3, Saturday', sub: 'PNQ tier 1, 2 devices, validation window open', value: '02:00', tone: 'warn' },
          { label: 'Wave 4, held', sub: 'NCL 2 devices, change freeze until the 28th', value: 'blocked', tone: 'hot' },
          { label: 'Approval of the order', sub: 'a person signs the sequence, not the agent', value: 'waiting', tone: 'hot' }
        ]
      },
      log: [
        'plan: 2 HA pairs detected, split across waves',
        'plan: PNQ validation window opens Saturday 02:00',
        'plan: NCL under a change freeze until the 28th',
        'plan: release record raised with 4 ordered waves'
      ]
    },
    {
      n: 9,
      name: 'Change authoring',
      agent: 'Change Authoring',
      autonomy: 'cab',
      status: 'designed',
      secs: 9,
      manual: 12,
      assisted: 1,
      head: 'Nine changes written, each with the backout that past failures taught.',
      body: 'This is the most hated hour of the job and the most mechanical. '
        + 'Justification, implementation steps, test plan, backout plan, all '
        + 'from the device history and the changes that failed on this kit '
        + 'before. A person still approves. The agent just stops it being '
        + 'written from scratch nine times.',
      viz: {
        kind: 'rows',
        rows: [
          { label: 'Justification', sub: 'advisory, CVSS, the qualified condition, the deadline', value: '9 of 9', tone: 'plain' },
          { label: 'Implementation plan', sub: 'per model, from the device history', value: '9 of 9', tone: 'plain' },
          { label: 'Test plan', sub: 'what proves the device came back correctly', value: '9 of 9', tone: 'plain' },
          { label: 'Backout plan', sub: 'drawn from 3 upgrades that failed on this model', value: '9 of 9', tone: 'good' },
          { label: 'Emergency CAB', sub: '2 critical changes need the shorter path', value: 'submitted', tone: 'warn' }
        ]
      },
      log: [
        'author: reading 3 prior failed changes on this model',
        'author: backout plan includes the image rollback those failures needed',
        'author: 9 change requests drafted',
        'author: 2 routed to emergency CAB, 7 to the standard path'
      ]
    },
    {
      n: 10,
      name: 'Collision and freeze check',
      agent: 'Change Authoring',
      autonomy: 'block',
      status: 'designed',
      secs: 8,
      manual: 3,
      assisted: 0,
      head: 'The agent blocks its own submission rather than ask a person to catch it.',
      body: 'Two of the nine devices already have a change against them this '
        + 'week. One wave lands inside a blackout nobody remembered. This is '
        + 'the one stage with the authority to stop the flow, because a '
        + 'conflict found afterwards is an outage.',
      viz: {
        kind: 'rows',
        rows: [
          { label: 'Overlapping change', sub: 'CHG0041204 touches the same two switches on Thursday', value: 'conflict', tone: 'hot' },
          { label: 'Blackout window', sub: 'quarter end freeze, PNQ, 24th to 27th', value: 'conflict', tone: 'hot' },
          { label: 'Validated system freeze', sub: 'NCL, already reflected in wave 4', value: 'known', tone: 'warn' },
          { label: 'Submission', sub: 'held until both conflicts are resolved', value: 'blocked', tone: 'hot' }
        ]
      },
      log: [
        'collide: 2 conflicts found against 9 changes',
        'collide: CHG0041204 overlaps on 2 devices',
        'collide: wave 3 lands inside the quarter end freeze at PNQ',
        'collide: submission blocked, waves resequenced, rechecked clean'
      ]
    },
    {
      n: 11,
      name: 'Execution tracking',
      agent: 'Execution',
      autonomy: 'human',
      status: 'designed',
      secs: 9,
      manual: 20,
      assisted: 8,
      head: 'People do the work. The agent watches, and notices the one that lied.',
      body: 'A device that comes back reporting the old version is the failure '
        + 'everyone misses at two in the morning. The agent reads the version '
        + 'after each change and reopens the item when the number has not '
        + 'moved, instead of trusting the change being marked complete.',
      viz: {
        kind: 'rows',
        rows: [
          { label: 'Wave 1, LON tier 3', sub: '2 devices, both on 17.9.5', value: 'complete', tone: 'good' },
          { label: 'Wave 2, LON tier 2', sub: '3 devices, 1 rolled back on a failed boot', value: '2 of 3', tone: 'warn' },
          { label: 'Wave 2 retry', sub: 'rebuilt and upgraded the following night', value: 'complete', tone: 'good' },
          { label: 'Wave 3, PNQ tier 1', sub: '2 devices inside the validation window', value: 'complete', tone: 'good' },
          { label: 'Marked done but unchanged', sub: '1 device still reporting 17.6.6, item reopened', value: 'caught', tone: 'hot' }
        ]
      },
      log: [
        'exec: reading firmware_version after each change task closes',
        'exec: 1 device failed to boot, backout plan executed',
        'exec: 1 change marked complete with the version unchanged',
        'exec: item reopened, change returned to the implementer'
      ]
    },
    {
      n: 12,
      name: 'Verification and closure',
      agent: 'Verification',
      autonomy: 'human',
      status: 'designed',
      secs: 8,
      manual: 6,
      assisted: 0.5,
      head: 'The same match, run again, on the same rules.',
      body: 'Closure is the original question asked a second time. Because '
        + 'matching is deterministic code and not a judgement, the re-scan is '
        + 'comparable to the first one by construction. Nine of nine clear. '
        + 'One item cannot be closed at all.',
      viz: {
        kind: 'funnel',
        rows: [
          { label: 'Confirmed vulnerable', value: 9, tone: 'hot' },
          { label: 'Upgraded and verified', value: 7, tone: 'good' },
          { label: 'Closed by configuration', value: 2, tone: 'good' },
          { label: 'Residual exposure', value: 0, tone: 'good' },
          { label: 'Cannot be remediated', value: 1, tone: 'warn' }
        ],
        sites: [
          { label: 'PNQ', sub: 'clear', value: 0 },
          { label: 'LON', sub: 'clear', value: 0 },
          { label: 'NCL', sub: 'clear', value: 0 }
        ]
      },
      log: [
        'verify: re-running the match on the same rules',
        'verify: 0 devices remain inside the affected range',
        'verify: 1 edge router past end of support, no fix exists',
        'verify: advisory cannot close while that item is open'
      ]
    },
    {
      n: 13,
      name: 'Exception and risk acceptance',
      agent: 'Verification',
      autonomy: 'cto',
      status: 'designed',
      secs: 8,
      manual: 4,
      assisted: 1,
      head: 'One device has no fix, so somebody senior has to own it in writing.',
      body: 'An edge router past end of support will never get a fixed '
        + 'release. The only honest outcomes are replace it or accept the '
        + 'risk, and accepting it is not a decision an agent may take, nor an '
        + 'engineer. It goes to the customer CTO organisation with an expiry '
        + 'date and a re-review, because an exception without one is just a '
        + 'forgotten hole.',
      viz: {
        kind: 'gate',
        who: 'Customer CTO organisation',
        question: 'Accept the residual risk on one unsupported edge router until it is replaced?',
        options: [
          { label: 'Accept', note: 'expires in 90 days, re-reviewed monthly', tone: 'warn' },
          { label: 'Replace', note: 'procurement raised, interim control in place', tone: 'good' }
        ],
        answer: 'Accepted for 90 days with an access control in front and a replacement ordered.'
      },
      log: [
        'except: 1 item has no remediation path',
        'except: exception record raised, expiry 90 days',
        'except: compensating control recorded',
        'except: signed by the customer CTO organisation'
      ]
    },
    {
      n: 14,
      name: 'Reporting, dashboard and audit pack',
      agent: 'Reporting',
      autonomy: 'agent',
      status: 'designed',
      secs: 9,
      manual: 10,
      assisted: 0,
      head: 'The audit pack is a by-product, not a fortnight of archaeology.',
      body: 'Every stage already wrote its input, its output and its timings '
        + 'as it ran, so the decision trail exists before anybody asks for '
        + 'it. That is the whole reason the run record and the audit record '
        + 'are the same record.',
      viz: {
        kind: 'board',
        headline: [
          { label: 'Devices assessed', value: '755' },
          { label: 'Confirmed vulnerable', value: '9' },
          { label: 'Remediated and verified', value: '9' },
          { label: 'Open exceptions', value: '1' }
        ],
        rows: [
          { label: 'Advisory to first evidence', sub: 'the match that found the twelve', value: 'under a minute', tone: 'good' },
          { label: 'Advisory to last device fixed', sub: 'bounded by change windows, not by analysis', value: '6 days', tone: 'good' },
          { label: 'Decisions with a recorded reason', sub: 'every stage wrote its own input and output', value: '100%', tone: 'good' },
          { label: 'Human approvals captured', sub: 'qualification, sending, sequencing, CAB, acceptance', value: '5', tone: 'warn' },
          { label: 'Audit pack', sub: 'assembled from the run record, not reconstructed', value: 'ready', tone: 'good' }
        ]
      },
      log: [
        'report: assembling from 14 stage records',
        'report: every decision carries its input and its output',
        'report: service review pack generated',
        'report: run closed'
      ]
    }
  ];

  var AUTONOMY = {
    agent: { label: 'Agent alone', tone: 'good' },
    engineer: { label: 'Engineer answers', tone: 'warn' },
    human: { label: 'Human approves', tone: 'warn' },
    cab: { label: 'CAB approves', tone: 'warn' },
    cto: { label: 'Customer CTO signs', tone: 'warn' },
    block: { label: 'Agent blocks', tone: 'hot' }
  };

  var totals = STAGES.reduce(function (acc, s) {
    acc.manual += s.manual;
    acc.assisted += s.assisted;
    acc.secs += s.secs;
    return acc;
  }, { manual: 0, assisted: 0, secs: 0 });

  window.NetwikFlow = {
    advisory: ADVISORY,
    stages: STAGES,
    autonomy: AUTONOMY,
    totals: totals
  };
})();
