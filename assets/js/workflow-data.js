/* The scenario data for workflow.html.
 *
 * A scenario is a vendor plus a kind of flaw. NetwikFlow.build(vendor, flaw)
 * returns the alert and the fourteen steps for that pair, already worded.
 * The vendor decides the devices, the numbers and the plan. The flaw decides
 * the title, the severity, the feature that has to be switched on, and the
 * deadlines.
 *
 * Honesty: only Cisco with the login bypass uses real numbers. They come
 * from a match against the ServiceNow instance: 755 devices on the list, 10
 * built by another vendor, 12 on an affected version, 7 of those at
 * regulated sites, none reachable from the internet. Every other pair is
 * made up to show how the flow changes, `real` is false for them, and the
 * page says so. Do not mark another pair real without a match behind it.
 *
 * Step numbers are not indices: there is no step 7. It was withdrawn from
 * the design, and renumbering the rest would break every reference to them.
 *
 * Blocks a renderer understands:
 *   doc      a document: a title, facts, sections, or tabs of sections
 *   list     rows with a label, a note, an outcome and a tone
 *   numbers  a row of big numbers with captions
 *   grid     every device on the list, one square each
 *   note     one plain sentence that matters
 */
(function () {
  'use strict';

  var TOTAL = 755;

  var VENDORS = {
    cisco: {
      label: 'Cisco',
      name: 'Cisco',
      kit: 'switches and routers',
      affected: '17.6.1 to 17.9.4, and 17.12.1',
      fixedA: '17.9.5',
      fixedB: '17.12.2',
      running: '17.6.6',
      mine: 745, other: 10, hit: 12, regulated: 7, internet: 0,
      on: 9, off: 3, upgraded: 6, config: 2,
      sites: [
        { code: 'PNQ', name: 'Pune', reg: true, n: 5 },
        { code: 'LON', name: 'London', reg: false, n: 5 },
        { code: 'NCL', name: 'Newcastle', reg: true, n: 2 }
      ],
      shape: 'None of the twelve can be reached from the internet, so this is not a panic. Seven are at regulated sites, so they cannot simply be patched tonight.',
      bands: [
        '2 core switches at Pune. A regulated site, and the most important devices',
        '5 devices at London',
        '2 switches at Newcastle, under a change freeze'
      ],
      options: [
        { label: 'Install the fixed software', sub: '6 devices. Each restarts once, inside an agreed window', value: 'recommended', tone: 'good' },
        { label: 'Switch off {featureShort}', sub: '2 switches at Newcastle. No restart, and the risk is gone today', value: 'do now', tone: 'good' },
        { label: 'Put extra protection in front', sub: 'Limits who can reach a device while it waits for its fix', value: 'stopgap', tone: 'warn' },
        { label: 'Replace the equipment', sub: '1 edge router at London is too old. No fix will ever exist for it', value: 'must buy', tone: 'hot' },
        { label: 'Accept the risk for a limited time', sub: 'Only with senior sign-off and a review date', value: 'last resort', tone: 'hot' }
      ],
      waves: [
        { label: 'Night 1, tonight', sub: 'London: the 2 least important switches, as a trial run', value: '22:00', tone: 'good' },
        { label: 'Night 2, tomorrow', sub: 'London: their 2 partner switches', value: '22:00', tone: 'good' },
        { label: 'Night 3, Saturday', sub: 'Pune: 2 core switches, in the approved window', value: '02:00', tone: 'warn' },
        { label: 'Today, no restart', sub: 'Newcastle: switch off {featureShort} on 2 switches under the change freeze', value: 'today', tone: 'good' },
        { label: 'No fix possible', sub: 'London: 1 old edge router goes to step 13 for a senior decision', value: 'held', tone: 'hot' }
      ],
      crCount: 7,
      crMix: '6 upgrades and 1 settings change',
      crUrgent: 2,
      crSample: {
        device: 'A core switch at Pune (1 of 2)',
        when: 'Saturday 02:00, in the approved window',
        steps: [
          'Save the current settings and software so they can be put back.',
          'Move traffic to the partner switch.',
          'Install version {fixedA} and restart.',
          'Move traffic back once the checks pass.'
        ]
      },
      clashes: [
        { label: 'Other work on the same devices', sub: 'Another change is already booked on two of the London switches tomorrow night', value: 'clash', tone: 'hot' },
        { label: 'No-change period', sub: 'Saturday falls inside the quarter-end freeze at Pune', value: 'clash', tone: 'hot' },
        { label: 'How the plan was changed', sub: 'Night 2 moved back one night. Night 3 moved to the first approved window after the freeze', value: 're-planned', tone: 'warn' }
      ],
      exec: [
        { label: 'Night 1, London', sub: '2 of 2 switches upgraded', value: 'done', tone: 'good' },
        { label: 'Night 2, London', sub: '1 of 2 upgraded. The other failed to restart and was put back safely', value: 'retry', tone: 'warn' },
        { label: 'Night 2, second try', sub: 'Upgraded successfully the next night', value: 'done', tone: 'good' },
        { label: 'Night 3, Pune', sub: '2 of 2 core switches upgraded in the approved window', value: 'done', tone: 'good' },
        { label: 'Newcastle', sub: '{featureShortCap} switched off on 2 switches', value: 'done', tone: 'good' },
        { label: 'Marked done, but not changed', sub: '1 switch still showed the old version. Caught, reopened, then fixed', value: 'caught', tone: 'hot' }
      ],
      oldKit: '1 edge router at London',
      oldWhy: 'The vendor stopped supporting this model, so it will never get the fixed software.'
    },
    paloalto: {
      label: 'Palo Alto',
      name: 'Palo Alto Networks',
      kit: 'firewalls',
      affected: '10.2.0 to 10.2.8, and 11.1.0 to 11.1.2',
      fixedA: '10.2.9',
      fixedB: '11.1.3',
      running: '10.2.6',
      mine: 10, other: 745, hit: 6, regulated: 2, internet: 4,
      on: 5, off: 1, upgraded: 4, config: 0,
      sites: [
        { code: 'LON', name: 'London', reg: false, n: 3 },
        { code: 'PNQ', name: 'Pune', reg: true, n: 2 },
        { code: 'NCL', name: 'Newcastle', reg: false, n: 1 }
      ],
      shape: 'Four of the six face the internet, so this one is urgent. Two are at a regulated site, where changes need extra sign-off.',
      bands: [
        '4 firewalls facing the internet, at London and Pune',
        '1 internal firewall at Newcastle'
      ],
      options: [
        { label: 'Install the fixed software', sub: '4 firewalls. Done one at a time, so its partner keeps traffic flowing', value: 'recommended', tone: 'good' },
        { label: 'Switch off {featureShort}', sub: 'Not possible here. The business depends on it every day', value: 'ruled out', tone: 'plain' },
        { label: 'Put extra protection in front', sub: 'Limits who can reach a firewall while it waits for its fix', value: 'stopgap', tone: 'warn' },
        { label: 'Replace the equipment', sub: '1 older firewall at Newcastle is too old. No fix will ever exist for it', value: 'must buy', tone: 'hot' },
        { label: 'Accept the risk for a limited time', sub: 'Only with senior sign-off and a review date', value: 'last resort', tone: 'hot' }
      ],
      waves: [
        { label: 'Night 1, tonight', sub: 'London: the standby firewall. Traffic stays on its partner', value: '22:00', tone: 'good' },
        { label: 'Night 2, tomorrow', sub: 'London: the main firewall, after traffic moves to the upgraded one', value: '22:00', tone: 'good' },
        { label: 'Night 3, Saturday', sub: 'Pune: both firewalls, one after the other, in the approved window', value: '02:00', tone: 'warn' },
        { label: 'No fix possible', sub: 'Newcastle: 1 older firewall goes to step 13 for a senior decision', value: 'held', tone: 'hot' }
      ],
      crCount: 4,
      crMix: '4 upgrades',
      crUrgent: 4,
      crSample: {
        device: 'The standby firewall at London',
        when: 'Tonight 22:00',
        steps: [
          'Save the current settings and software so they can be put back.',
          'Confirm all traffic is on the partner firewall.',
          'Install version {fixedA} and restart.',
          'Let the pair sync, then run the checks.'
        ]
      },
      clashes: [
        { label: 'Other work on the same devices', sub: 'Another change is already booked on the London firewalls tomorrow night', value: 'clash', tone: 'hot' },
        { label: 'No-change period', sub: 'Saturday falls inside the quarter-end freeze at Pune', value: 'clash', tone: 'hot' },
        { label: 'How the plan was changed', sub: 'Night 2 moved back one night. Night 3 moved to the first approved window after the freeze', value: 're-planned', tone: 'warn' }
      ],
      exec: [
        { label: 'Night 1, London', sub: 'Standby firewall upgraded', value: 'done', tone: 'good' },
        { label: 'Night 2, London', sub: 'Main firewall failed to restart and was put back safely. Traffic stayed up on its partner', value: 'retry', tone: 'warn' },
        { label: 'Night 2, second try', sub: 'Upgraded successfully the next night', value: 'done', tone: 'good' },
        { label: 'Night 3, Pune', sub: '2 of 2 firewalls upgraded in the approved window', value: 'done', tone: 'good' },
        { label: 'Marked done, but not changed', sub: '1 firewall still showed the old version. Caught, reopened, then fixed', value: 'caught', tone: 'hot' }
      ],
      oldKit: '1 older firewall at Newcastle',
      oldWhy: 'The vendor stopped supporting this model, so it will never get the fixed software.'
    }
  };

  var FLAWS = {
    bypass: {
      label: 'Login bypass',
      plain: 'An attacker can log in to the device without a password.',
      title: 'Login bypass in the web management page',
      score: '9.8', level: 'Critical', exploited: true,
      feature: 'the web management page',
      featureShort: 'the web management page',
      harm: 'log in to the device without a password'
    },
    takeover: {
      label: 'Remote takeover',
      plain: 'An attacker can run their own commands on the device from anywhere.',
      title: 'Remote takeover through the remote access service',
      score: '10.0', level: 'Critical', exploited: true,
      feature: 'the remote access service',
      featureShort: 'the remote access service',
      harm: 'take full control of the device from anywhere'
    },
    crash: {
      label: 'Forced restart',
      plain: 'An attacker can make the device restart again and again, cutting the network off.',
      title: 'Device can be forced to restart by a crafted message',
      score: '7.5', level: 'High', exploited: false,
      feature: 'the device discovery service',
      featureShort: 'the device discovery service',
      harm: 'make the device restart again and again'
    }
  };

  var AUTONOMY = {
    agent: { label: 'Agent alone', tone: 'good' },
    engineer: { label: 'Engineer answers', tone: 'warn' },
    human: { label: 'A person approves', tone: 'warn' },
    cab: { label: 'Approval board decides', tone: 'warn' },
    people: { label: 'Engineers do the work', tone: 'warn' },
    closes: { label: 'Agent proposes, a person closes', tone: 'warn' },
    cto: { label: 'Customer CTO office decides', tone: 'warn' },
    block: { label: 'Agent stops the flow', tone: 'hot' }
  };

  var ORDER = { vendors: ['cisco', 'paloalto'], flaws: ['bypass', 'takeover', 'crash'] };

  function cap(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

  function build(vendorKey, flawKey) {
    var V = VENDORS[vendorKey] || VENDORS.cisco;
    var F = FLAWS[flawKey] || FLAWS.bypass;
    var real = V === VENDORS.cisco && F === FLAWS.bypass;
    var serial = ORDER.vendors.indexOf(vendorKey) * ORDER.flaws.length + ORDER.flaws.indexOf(flawKey) + 1;
    var ref = 'NETWIK-DEMO-000' + (serial > 0 ? serial : 1);

    /* An attacked flaw moves every deadline up one level. */
    var levels = F.exploited ? ['Critical', 'High', 'Medium'] : ['High', 'Medium', 'Low'];
    var deadlines = F.exploited ? ['48 hours', '7 days', '30 days'] : ['7 days', '30 days', '90 days'];
    var board = F.exploited ? 'emergency approval board' : 'weekly approval board';
    var fixedCount = V.upgraded + V.config;

    function fill(text) {
      return String(text)
        .replace(/\{featureShortCap\}/g, cap(F.featureShort))
        .replace(/\{featureShort\}/g, F.featureShort)
        .replace(/\{feature\}/g, F.feature)
        .replace(/\{fixedA\}/g, V.fixedA);
    }
    function rows(list) {
      return list.map(function (r) {
        return { label: fill(r.label), sub: fill(r.sub), value: r.value, tone: r.tone };
      });
    }

    var attacked = F.exploited ? 'Yes, attackers are already using it' : 'Not yet seen in attacks';
    var siteWords = V.sites.map(function (s) { return s.n + ' at ' + s.name; }).join(', ');

    var steps = [
      {
        n: 0, name: 'Receive the alert', agent: 'Intake', autonomy: 'agent', status: 'running',
        what: 'The vendor publishes a security alert. The agent picks it up, checks it is not a repeat of one already on file, and opens one record for it.',
        activity: [
          'Alert received from ' + V.name,
          'Searched the existing records for the same flaw',
          'No match found, so one new record was opened',
          'Record marked ready to be read'
        ],
        blocks: [{
          kind: 'doc', title: 'Alert record',
          facts: [
            ['Reference', ref],
            ['Title', F.title],
            ['Vendor', V.name],
            ['Severity', F.score + ' out of 10 (' + F.level + ')'],
            ['In use by attackers', attacked],
            ['Seen before', 'No. This is the first record of this flaw']
          ]
        }]
      },
      {
        n: 1, name: 'Read the alert', agent: 'Intake', autonomy: 'agent', status: 'designed',
        what: 'Vendor alerts are written for people. The agent turns the wording into clear rules a computer can check: which software versions are affected, which versions fix it, and what has to be switched on for a device to be at risk. This is the one step that needs an AI model, because it means reading and interpreting text.',
        activity: [
          'Read which versions are affected and which are fixed',
          'Worked out the right fix for each software family',
          'Noted what has to be switched on for a device to be at risk',
          'Anything unclear is marked "unknown", never "safe"'
        ],
        blocks: [{
          kind: 'list', title: 'Rules taken from the alert',
          rows: [
            { label: 'Affected versions', sub: V.affected, value: 'at risk', tone: 'hot' },
            { label: 'Fixed versions', sub: V.fixedA + ' and ' + V.fixedB + ', or later in the same family', value: 'safe', tone: 'good' },
            { label: 'Condition', sub: 'Only at risk if ' + F.feature + ' is switched on', value: 'must check', tone: 'warn' }
          ]
        }]
      },
      {
        n: 2, name: 'Find the affected devices', agent: 'Matching', autonomy: 'agent', status: 'running',
        what: 'Every device is compared with those rules. This is where most of the week normally goes when it is done by hand: exporting device lists and reading version numbers one by one. It is plain checking, so ordinary code does it, not an AI model. The reason each device is in or out is kept.',
        activity: [
          TOTAL + ' devices on the list for this customer',
          V.other + ' set aside: built by another vendor',
          V.mine + ' compared with the affected versions',
          V.hit + ' are running an affected version (' + V.running + ')',
          'Grouped by site: ' + siteWords
        ],
        blocks: [
          {
            kind: 'grid', total: TOTAL, hot: V.hit, dim: V.other,
            legend: [
              ['hot', V.hit + ' running an affected version'],
              ['clear', (V.mine - V.hit) + ' not affected, or already fixed'],
              ['dim', V.other + ' built by another vendor, so this alert does not apply']
            ]
          },
          {
            kind: 'numbers',
            items: [
              { value: V.hit, label: 'On an affected version', tone: 'hot' },
              { value: V.regulated, label: 'At a regulated site', sub: 'changes need extra sign-off', tone: 'warn' },
              { value: V.internet, label: 'Reachable from the internet', tone: V.internet ? 'hot' : 'good' }
            ]
          },
          { kind: 'note', text: V.shape }
        ],
        after: { checked: TOTAL, risk: V.hit }
      },
      {
        n: 3, name: 'Check the risky feature is on', agent: 'Matching', autonomy: 'engineer', status: 'running',
        what: 'A device on an affected version is only at risk if ' + F.feature + ' is switched on. No system the agent can read holds that fact, so it does not guess. It marks every device "not yet known" and asks an engineer.',
        activity: [
          'Looked for the setting in the records: it is not held anywhere',
          'Marked all ' + V.hit + ' devices "not yet known"',
          'Raised a task for the network engineer on duty'
        ],
        blocks: [{
          kind: 'doc', title: 'Task sent to the engineer',
          facts: [
            ['To', 'Network engineer on duty'],
            ['About', V.hit + ' ' + V.kit + ' on an affected version'],
            ['Alert', ref]
          ],
          sections: [
            { h: 'Please confirm', p: 'For each device on the attached list, is ' + F.feature + ' switched on? Answer yes or no for each one.' },
            { h: 'Why I am asking', p: 'The flaw can only be used when that feature is on. I cannot see the setting, and I will not assume the answer.' }
          ]
        }],
        decision: {
          who: 'Network engineer on duty',
          ask: 'Is ' + F.feature + ' switched on on these ' + V.hit + ' devices?',
          options: [{
            label: 'Confirm: on for ' + V.on + ', off for ' + V.off,
            note: 'the engineer has checked each device',
            outcome: 'Switched on for ' + V.on + ' of ' + V.hit + '. Those ' + V.on + ' are confirmed at risk. The other ' + V.off
              + (V.off === 1 ? ' cannot be attacked this way and drops out' : ' cannot be attacked this way and drop out')
              + ', with the reason recorded.'
          }]
        },
        after: { risk: V.on }
      },
      {
        n: 4, name: 'Rank the risk', agent: 'Risk', autonomy: 'agent', status: 'designed',
        what: 'Each confirmed device gets a risk level and a deadline. The level comes from facts anyone can check afterwards: is the flaw already being used by attackers, how important is the device, can it be reached from the internet, and is the site regulated.',
        activity: [
          F.exploited ? 'Attackers are already using this flaw, so every level goes up by one' : 'No attacks seen yet, so levels are not raised',
          V.internet ? V.internet + ' devices face the internet, so they go to the top level' : 'No device faces the internet, so nothing is raised for exposure',
          'Regulated sites get an approved window for the work, not a shorter deadline',
          V.on + ' devices ranked'
        ],
        blocks: [{
          kind: 'list', title: 'Risk levels and deadlines',
          rows: V.bands.map(function (text, i) {
            return { label: levels[i], sub: text, value: 'fix within ' + deadlines[i], tone: ['hot', 'warn', 'plain'][i] };
          })
        }]
      },
      {
        n: 5, name: 'Tell the people who need to know', agent: 'Communications', autonomy: 'human', status: 'designed',
        what: 'Different people need different messages about the same problem. The agent drafts each one from the same facts. Nothing is sent until a person approves it.',
        activity: [
          '4 messages drafted from one set of facts',
          'Checked that nothing is addressed to anyone outside the customer',
          'Held until a person approves'
        ],
        blocks: [{
          kind: 'doc', title: 'Draft messages',
          tabs: [
            {
              label: 'Service owners',
              facts: [['To', 'Owners of the affected services'], ['Subject', 'Planned network work this week: ' + F.label.toLowerCase() + ' on ' + V.name + ' ' + V.kit]],
              sections: [
                { p: V.name + ' has announced a security flaw that lets an attacker ' + F.harm + '. ' + V.on + ' of our ' + V.kit + ' are confirmed at risk.' },
                { p: 'We will fix them over the next few nights. Each device restarts once. Where a device has a partner, traffic moves to the partner first, so you should see no interruption.' },
                { p: 'You do not need to do anything. We will tell you the night before your service is touched, and again when it is done.' }
              ]
            },
            {
              label: 'Security team',
              facts: [['To', 'Security operations'], ['Subject', ref + ': ' + V.on + ' devices confirmed at risk']],
              sections: [
                { p: 'Flaw: ' + F.title + '. Severity ' + F.score + ' out of 10. ' + attacked + '.' },
                { p: 'Of ' + TOTAL + ' devices checked, ' + V.hit + ' run an affected version and ' + V.on + ' have ' + F.feature + ' switched on. ' + V.internet + ' can be reached from the internet.' },
                { p: 'Until each device is fixed, access to ' + F.feature + ' is limited to the management network. Please watch for unusual logins on the listed devices.' }
              ]
            },
            {
              label: 'Quality and compliance',
              facts: [['To', 'Quality and compliance lead'], ['Subject', 'Security fix needed on regulated systems']],
              sections: [
                { p: V.regulated + ' of the affected devices are at regulated sites. The work on them will only happen inside an approved window, and each change will carry its test results.' },
                { p: 'A full record of what was changed, who approved it and how it was tested will be ready for your review when the work is finished.' }
              ]
            },
            {
              label: 'Customer CTO office',
              facts: [['To', 'Customer CTO office'], ['Subject', 'Security flaw on ' + V.name + ' ' + V.kit + ': what we are doing']],
              sections: [
                { p: 'A flaw announced today lets an attacker ' + F.harm + '. We have checked all ' + TOTAL + ' devices. ' + V.on + ' are at risk and all have a plan.' },
                { p: 'The most urgent will be fixed within ' + deadlines[0] + '. One device is too old to be fixed. We will come to you with the choices for that one.' }
              ]
            }
          ]
        }],
        decision: {
          who: 'Duty lead',
          ask: 'Send these four messages?',
          options: [
            { label: 'Approve and send', note: 'all four go to the people named', outcome: 'Approved by the duty lead. All four messages were sent.' },
            { label: 'Send back for changes', note: 'nothing leaves yet', outcome: 'Sent back for rewording by the duty lead. The corrected drafts were approved and sent on the second pass.' }
          ]
        }
      },
      {
        n: 6, name: 'Compare the ways to fix it', agent: 'Planning', autonomy: 'agent', status: 'designed',
        what: 'Installing the fixed software is one answer, not the only one. The agent has to weigh the others as well: switching the risky feature off, putting extra protection in front, replacing equipment that is too old to fix, or accepting the risk for a limited time.',
        activity: [
          'Checked that each device is still supported by the vendor',
          '1 device is too old: the vendor will never publish a fix for it',
          'Worked out the cost and the downtime of every option'
        ],
        blocks: [{ kind: 'list', title: 'The options', rows: rows(V.options) }]
      },
      {
        n: 8, name: 'Plan the order of work', agent: 'Planning', autonomy: 'human', status: 'designed',
        what: 'The order matters more than the speed. Devices that back each other up are never upgraded on the same night. Regulated sites wait for an approved window. The least important device goes first, so a bad upgrade is found where it hurts least.',
        activity: [
          'Found the devices that back each other up and split them across nights',
          'Placed the regulated site in its approved window',
          'Put the least important devices first'
        ],
        blocks: [{ kind: 'list', title: 'Proposed plan', rows: rows(V.waves) }],
        decision: {
          who: 'Service delivery manager',
          ask: 'Approve this order of work?',
          options: [{ label: 'Approve the plan', note: 'the work is booked in this order', outcome: 'Plan approved by the service delivery manager.' }]
        }
      },
      {
        n: 9, name: 'Write the change requests', agent: 'Change', autonomy: 'cab', status: 'designed',
        what: 'Every change to a live network needs a written request: why, how, how it will be tested and how to undo it. Writing these by hand is slow and repetitive. The agent writes them from the device history, including lessons from upgrades that went wrong before. A person still approves every one.',
        activity: [
          'Read 3 earlier upgrades that failed on this model',
          'Added the undo steps those failures needed',
          V.crCount + ' change requests written: ' + V.crMix,
          V.crUrgent + ' sent to the ' + board
        ],
        blocks: [
          {
            kind: 'doc', title: 'Change request, 1 of ' + V.crCount,
            facts: [
              ['Device', V.crSample.device],
              ['When', V.crSample.when],
              ['Risk level', levels[0] + ', fix within ' + deadlines[0]]
            ],
            sections: [
              { h: 'Why', p: ref + ': ' + F.title + '. This device runs an affected version and an engineer has confirmed ' + F.feature + ' is switched on.' },
              { h: 'Steps', items: V.crSample.steps.map(fill) },
              { h: 'How it is tested', p: 'The device reports version ' + V.fixedA + ', every connection it had before is back, and its partner shows it as healthy.' },
              { h: 'How to undo it', p: 'Restart on the saved software and settings. This takes about ten minutes, and the past failures on this model show it works.' }
            ]
          },
          { kind: 'note', text: 'The other ' + (V.crCount - 1) + ' requests follow the same pattern, each written for its own device.' }
        ],
        decision: {
          who: 'Change approval board',
          ask: 'Approve these ' + V.crCount + ' change requests?',
          options: [{ label: 'Approve all ' + V.crCount, note: 'the changes can be booked', outcome: 'All ' + V.crCount + ' change requests approved by the change approval board.' }]
        }
      },
      {
        n: 10, name: 'Check for clashes', agent: 'Change', autonomy: 'block', status: 'designed',
        what: 'Before anything is booked, the agent checks the calendar. If a change clashes with other planned work, or with a period when changes are banned, it stops its own request. A clash found afterwards is an outage.',
        activity: [
          'Compared ' + V.crCount + ' changes with the change calendar',
          '2 clashes found',
          'Booking stopped',
          'Plan adjusted and checked again: no clashes left'
        ],
        blocks: [{
          kind: 'list', title: 'What it found',
          rows: rows(V.clashes).concat([{ label: 'Booking', sub: 'Stopped until both clashes were fixed, then checked again', value: 'clear', tone: 'good' }])
        }]
      },
      {
        n: 11, name: 'Track the work', agent: 'Execution', autonomy: 'people', status: 'designed',
        what: 'Engineers carry out the changes. The agent does not touch the devices. It checks each one afterwards to see that the software version really changed, instead of trusting a ticket marked "done".',
        activity: [
          'Checked the software version after every change',
          '1 device failed to restart, so the undo plan was used',
          '1 change was marked done but the version had not changed',
          'That one was reopened and sent back to the engineer'
        ],
        blocks: [{ kind: 'list', title: 'Progress', rows: rows(V.exec) }],
        after: { fixed: fixedCount }
      },
      {
        n: 12, name: 'Check again and close', agent: 'Verification', autonomy: 'closes', status: 'designed',
        what: 'The same check from step 2 is run again, with the same rules. Because it is plain checking and not opinion, the before and the after can be compared directly.',
        activity: [
          'Ran the same check again on all ' + TOTAL + ' devices',
          fixedCount + ' of ' + V.on + ' are now safe',
          '1 device still at risk: it cannot be fixed',
          'The record stays open until someone decides what to do about it'
        ],
        blocks: [
          {
            kind: 'numbers',
            items: [
              { value: V.on, label: 'Confirmed at risk', tone: 'hot' },
              { value: V.upgraded, label: 'Upgraded and checked', tone: 'good' },
              { value: V.config, label: 'Made safe by switching the feature off', tone: 'good' },
              { value: 1, label: 'Cannot be fixed', tone: 'warn' }
            ]
          },
          { kind: 'note', text: 'A person closes the record, not the agent. It cannot be closed yet, because one device has no fix.' }
        ]
      },
      {
        n: 13, name: 'Decide on the device with no fix', agent: 'Verification', autonomy: 'cto', status: 'designed',
        what: 'One device is too old for the vendor to fix. The only honest choices are to replace it, or to accept the risk for a limited time. That is not a decision for an agent, or for an engineer. It goes to a senior person at the customer, in writing, with an end date.',
        activity: [
          '1 device has no fix available',
          'Wrote up the choices and what each one costs',
          'Sent to the customer CTO office'
        ],
        blocks: [{
          kind: 'doc', title: 'Risk decision record',
          facts: [
            ['Device', V.oldKit],
            ['Why no fix', V.oldWhy],
            ['Protection for now', 'Access to ' + F.feature + ' limited to the management network'],
            ['Review', 'Every month until the device is replaced']
          ]
        }],
        decision: {
          who: 'Customer CTO office',
          ask: 'What should happen to the one device that cannot be fixed?',
          options: [
            { label: 'Accept the risk for 90 days', note: 'extra protection stays, reviewed monthly, replacement ordered', outcome: 'Risk accepted for 90 days by the customer CTO office, with extra protection in place, a monthly review and a replacement on order.' },
            { label: 'Replace it now', note: 'emergency purchase, extra protection until it arrives', outcome: 'Replacement approved as an emergency purchase by the customer CTO office. Extra protection stays in place until it arrives.' }
          ]
        }
      },
      {
        n: 14, name: 'Report and audit pack', agent: 'Reporting', autonomy: 'agent', status: 'designed',
        what: 'Every step wrote down what it was given, what it produced and who approved it, as it happened. So the report and the audit pack already exist. Nobody has to piece the story together afterwards.',
        activity: [
          'Collected the record from all 14 steps',
          'Every decision carries its reason and who made it',
          'Service review pack produced',
          'Run closed'
        ],
        blocks: [
          {
            kind: 'numbers',
            items: [
              { value: TOTAL, label: 'Devices checked' },
              { value: V.on, label: 'Confirmed at risk', tone: 'hot' },
              { value: fixedCount, label: 'Fixed and checked', tone: 'good' },
              { value: 1, label: 'Senior decision on the device with no fix', tone: 'warn' }
            ]
          },
          {
            kind: 'list', title: 'Summary',
            rows: [
              { label: 'Alert to first list of affected devices', sub: 'the check in step 2', value: 'under a minute', tone: 'good' },
              { label: 'Alert to last device fixed', sub: 'set by the change windows, not by the analysis', value: '6 days', tone: 'good' },
              { label: 'Decisions with a written reason', sub: 'every step recorded what it was given and what it produced', value: 'all', tone: 'good' },
              { label: 'Decisions made by people', sub: 'feature check, sending, order of work, change approval, risk decision', value: '5', tone: 'warn' },
              { label: 'Audit pack', sub: 'built from the run record, not put together afterwards', value: 'ready', tone: 'good' }
            ]
          }
        ]
      }
    ];

    return {
      real: real,
      vendor: V,
      flaw: F,
      alert: { ref: ref, title: F.title, vendor: V.name, severity: F.score + ' out of 10 (' + F.level + ')', attacked: attacked },
      steps: steps
    };
  }

  function options(map, order) {
    return order.map(function (key) {
      return { key: key, label: map[key].label, plain: map[key].plain || '' };
    });
  }

  window.NetwikFlow = {
    vendors: options(VENDORS, ORDER.vendors),
    flaws: options(FLAWS, ORDER.flaws),
    autonomy: AUTONOMY,
    build: build
  };
})();
