/* Use case data, shared by the catalogue (index.html) and the detail page (use-case.html).
   An entry with an `id` and a `detail` object has its own page. The rest show as "Coming soon".
   Each detail needs exactly five `steps`: the run panel lights them one by one and the fifth is the approval step. */
(function () {
  'use strict';

  var PROCS = ['All', 'Incident', 'Change', 'Capacity', 'Release', 'Availability', 'Problem', 'Knowledge'];
  var DOMS = ['All', 'LAN', 'WAN', 'Wireless', 'DDI'];

  var ALL = [
    {
      id: 'wan-outage-triage',
      proc: 'Incident',
      title: 'WAN circuit outage triage',
      text: 'Groups the alarms from one outage, checks the backup path and carrier status, and opens a ticket with the diagnosis.',
      doms: ['WAN'],
      detail: {
        summary: 'The agent picks up an alarm the moment it fires, finds out what is wrong, and hands the engineer a ticket with the diagnosis and the evidence in it.',
        steps: [
          ['Alarm received', 'WAN circuit down at a branch site'],
          ['Related alarms grouped', 'Router, tunnel and site alarms become one incident'],
          ['Evidence collected', 'Device state, backup path, carrier status, last change'],
          ['Diagnosis written to the ticket', 'Carrier fault. Backup path is carrying traffic.'],
          ['Waiting for engineer approval', 'Proposed next step: raise a case with the carrier']
        ],
        ticketLabel: 'Ticket',
        ticket: 'Carrier fault on the primary circuit. Backup path is carrying traffic. Evidence attached.',
        today: [
          'An alarm fires and waits in the queue until an engineer picks it up.',
          'The engineer logs in to monitoring, the controller and the carrier portal, one after another.',
          'Recent changes and similar past incidents are checked by hand, if there is time.',
          'The ticket is written up and escalated, often with facts missing.',
          'The next team repeats the diagnosis before it acts.'
        ],
        withAgent: [
          'The agent picks up the alarm as it fires and groups related alarms into one incident.',
          'It collects device state, traffic path and carrier status from every tool at once.',
          'It checks recent changes and matching past incidents every time.',
          'It opens the ticket with a diagnosis, the evidence and a proposed next step, routed to the right team.',
          'An engineer approves or corrects the next step. The agent carries it out and keeps the ticket up to date until it closes.'
        ],
        output: {
          lines: ['$ triage alarm', 'alarms ....... grouped into one incident', 'backup ....... carrying traffic', 'cause ........ carrier fault'],
          last: 'next: raise carrier case (needs approval)',
          tone: 'amber'
        },
        context: [
          ['Playbooks', 'The triage steps senior engineers follow, written down for each type of incident.'],
          ['Site knowledge', 'Site notes, network diagrams, on-call contacts and the quirks only the team knows.'],
          ['Inventory', 'Which devices and circuits serve which site, and what depends on them.'],
          ['History', 'Past incidents, recent changes and known errors for the same devices and sites.']
        ],
        tools: [
          ['Service desk', 'ServiceNow', 'Opens, updates and routes incidents. Reads change and problem records.'],
          ['Monitoring', 'SolarWinds Orion', 'Receives alarms. Reads interface and device metrics.'],
          ['Controller', 'Cisco DNA Center', 'Reads device, client and wireless health. Runs approved actions.'],
          ['DDI', 'Infoblox', 'Reads DNS, DHCP and address records.'],
          ['Carriers', 'Carrier portal or API', 'Checks circuit status. Raises and tracks carrier cases.'],
          ['Team chat', 'Microsoft Teams', 'Asks the engineer for approval and posts updates.']
        ],
        alone: [
          'Groups related alarms into one incident',
          'Collects evidence from the tools',
          'Checks recent changes and past incidents',
          'Writes the diagnosis into the ticket',
          'Routes the ticket and notifies the owner'
        ],
        approval: [
          'Raises a case with the carrier or vendor',
          'Restarts an interface or a service',
          'Applies a fix from an approved playbook',
          'Sends an update to affected users',
          'Closes the incident'
        ],
        never: [
          'Changes a device without approval',
          'Acts on devices or sites outside its scope',
          'Invents a fix that is not in a playbook',
          'Gives a diagnosis without showing its evidence'
        ]
      }
    },
    {
      id: 'change-evaluator',
      proc: 'Change',
      title: 'Change evaluator',
      text: 'Checks each change request for a complete plan, a tested rollback, the sites affected and clashes with other changes, then gives the engineer feedback.',
      doms: ['LAN', 'WAN', 'Wireless', 'DDI'],
      detail: {
        summary: 'The agent reads every change request before the approval meeting, checks it against what is known about the network, and gives the engineer feedback while there is still time to fix the plan.',
        steps: [
          ['Change request submitted', 'Router software upgrade at two branch sites'],
          ['Plan checked', 'Steps, timing and rollback read against the change policy'],
          ['Network context checked', 'Sites affected, what depends on them, business hours'],
          ['Clashes checked', 'Another change at the same site in the same window'],
          ['Waiting for the approver', 'Proposed verdict: send back with feedback']
        ],
        ticketLabel: 'Review',
        ticket: 'Send back with feedback. The rollback is not tested. Clashes with another change at the same site in the same window.',
        today: [
          'An engineer writes the change request, often by copying an old one.',
          'Reviewers read it in the days before the approval meeting, if there is time.',
          'Checks for clashes, affected sites and rollback depend on who is reviewing.',
          'A risky change gets the same few minutes in the meeting as a routine one.',
          'Problems are found in the change window, when they cost the most.'
        ],
        withAgent: [
          'The agent reads each request as soon as it is submitted.',
          'It checks that the plan is complete and the rollback has been tested.',
          'It works out which sites and services are affected and looks for clashes with other changes.',
          'It gives the engineer a risk rating and specific feedback, with the evidence.',
          'The approver sees the review beside the request and makes the decision.'
        ],
        output: {
          lines: ['$ review change-request', 'plan ......... complete', 'rollback ..... not tested', 'clash ........ same site, same window'],
          last: 'verdict: send back with feedback',
          tone: 'amber'
        },
        context: [
          ['Change policy', 'What a complete request looks like, which changes are routine, and who approves what.'],
          ['Site knowledge', 'Which sites are critical, their business hours and the periods when changes are frozen.'],
          ['Inventory', 'Which devices and circuits serve which site, and what depends on them.'],
          ['History', 'Past changes that failed or were rolled back, and why.']
        ],
        tools: [
          ['Service desk', 'ServiceNow', 'Reads change requests and the change calendar. Writes the review onto the request.'],
          ['Controller', 'Cisco DNA Center', 'Reads device software versions and configuration.'],
          ['Monitoring', 'SolarWinds Orion', 'Reads the current health of the devices in the change.'],
          ['Team chat', 'Microsoft Teams', 'Sends the feedback to the engineer who wrote the request.']
        ],
        alone: [
          'Reads each change request',
          'Checks the plan, rollback and timing',
          'Finds affected sites and clashes',
          'Writes a risk rating and feedback onto the request'
        ],
        approval: [
          'Sends a request back to its author',
          'Marks a routine change as checked and ready for approval'
        ],
        never: [
          'Approves or rejects a change',
          'Edits the change plan',
          'Makes a change on the network',
          'Gives a rating without showing its reasons'
        ]
      }
    },
    {
      id: 'playbooks',
      proc: 'Knowledge',
      title: 'Playbooks written and run by agents',
      text: 'Turns what engineers know into a written playbook, has an engineer approve it, then follows it step by step when the problem comes up.',
      doms: ['LAN', 'WAN', 'Wireless', 'DDI'],
      detail: {
        summary: 'The agent turns what engineers know into a written playbook. An engineer reviews and approves it, and the agent then follows it step by step when the problem comes up.',
        steps: [
          ['Past incidents read', 'Tickets and notes for "site link degraded"'],
          ['Playbook drafted', 'Five steps, in the order engineers take them'],
          ['Engineer reviews and approves', 'One step corrected, then published as version 1'],
          ['Playbook run on a live incident', 'Steps 1 to 4 done. Backup network is healthy.'],
          ['Waiting for engineer approval', 'Step 5: fail over the site']
        ],
        ticketLabel: 'Agent',
        ticket: 'Playbook "site link degraded", step 5 of 5. The carrier circuit is flapping. The backup network is healthy. Failing over needs approval.',
        today: [
          'The steps for a common problem live in the heads of a few senior engineers.',
          'Written procedures exist, but they are out of date or hard to find.',
          'Each engineer handles the same problem a little differently.',
          'New engineers learn by shadowing colleagues and by getting it wrong.',
          'When a senior engineer leaves, the knowledge leaves too.'
        ],
        withAgent: [
          'The agent reads past tickets and notes, and asks engineers how they handle a problem.',
          'It drafts a playbook: the steps, the checks and who to call.',
          'An engineer corrects and approves it. The playbook is versioned like software.',
          'When the problem comes up, the agent follows the playbook step by step and shows its evidence at each one.',
          'Steps that change the network wait for approval. What is learned goes back into the playbook.'
        ],
        output: {
          lines: ['$ run playbook "site link degraded"', '1 carrier circuit .... flapping since 01:58', '2 backup network ..... healthy', '3 recent changes ..... none in 24 hours', '4 site lead .......... called'],
          last: '5 fail over the site (needs approval)',
          tone: 'amber'
        },
        context: [
          ['Past incidents', 'Tickets and notes that show what was checked, in what order, and what fixed it.'],
          ['Engineer interviews', 'What senior engineers say they look at first, and why.'],
          ['Site knowledge', 'Which sites are critical, who to call, and the quirks only the team knows.'],
          ['Process rules', 'Which steps need approval, and who is allowed to give it.']
        ],
        tools: [
          ['Service desk', 'ServiceNow', 'Reads past incidents. Records each playbook step on the ticket.'],
          ['Knowledge base', 'Confluence', 'Holds the approved playbooks and their version history.'],
          ['Monitoring', 'SolarWinds Orion', 'Runs the checks a playbook asks for.'],
          ['Controller', 'Cisco DNA Center', 'Reads device state. Runs approved actions.'],
          ['Team chat', 'Microsoft Teams', 'Asks the engineer for approval and posts updates.']
        ],
        alone: [
          'Drafts a playbook from tickets and interviews',
          'Suggests updates to a playbook after each incident',
          'Runs the steps that only read and check',
          'Records each step and its evidence on the ticket'
        ],
        approval: [
          'Publishes a new or changed playbook',
          'Runs a step that changes the network'
        ],
        never: [
          'Follows a playbook nobody approved',
          'Skips or reorders steps',
          'Changes a playbook without a record of who approved it'
        ]
      }
    },
    { proc: 'Incident', title: 'Wireless connection complaints', text: 'Works out whether a complaint comes from the access point, the radio environment, authentication or the client device.', doms: ['Wireless'] },
    { proc: 'Incident', title: 'DNS resolution failures', text: 'Tests resolution from several points, finds the failing server or record, and reports what broke and since when.', doms: ['DDI'] },
    { proc: 'Incident', title: 'Flapping ports and uplinks', text: 'Reads interface history and error counters to separate a cabling fault from a configuration or hardware fault.', doms: ['LAN'] },
    { proc: 'Change', title: 'Before and after verification', text: 'Captures network state before a change, captures it again afterwards and reports every difference that was not planned.', doms: ['LAN', 'WAN', 'Wireless'] },
    { proc: 'Change', title: 'DNS and DHCP change validation', text: 'Checks a record or scope change for conflicts and overlaps before it is applied.', doms: ['DDI'] },
    { proc: 'Capacity', title: 'Circuit utilisation forecast', text: 'Projects when each circuit will reach its limit and recommends the upgrade to order, with lead time taken into account.', doms: ['WAN'] },
    { proc: 'Capacity', title: 'Address pool exhaustion', text: 'Tracks DHCP scopes and subnets and warns before a site runs out of addresses.', doms: ['DDI'] },
    { proc: 'Capacity', title: 'Wireless density planning', text: 'Finds areas where client numbers are outgrowing the access points that serve them.', doms: ['Wireless'] },
    { proc: 'Release', title: 'Vulnerability to upgrade plan', text: 'Maps a new security advisory to the devices it affects, picks a target software version and proposes a staged rollout.', doms: ['LAN', 'WAN', 'Wireless'] },
    { proc: 'Release', title: 'Software version drift', text: 'Lists devices that have fallen behind the approved software version and groups them into upgrade batches.', doms: ['LAN', 'WAN', 'Wireless'] },
    { proc: 'Availability', title: 'Service level reporting', text: 'Calculates availability per site and service, and attributes each outage to its cause and owner.', doms: ['LAN', 'WAN', 'Wireless', 'DDI'] },
    { proc: 'Availability', title: 'Single point of failure check', text: 'Walks the topology to find sites and services that depend on one device, one link or one carrier.', doms: ['LAN', 'WAN'] },
    { proc: 'Problem', title: 'Recurring incident detection', text: 'Finds incidents that share a device, site, software version or cause and raises them as one problem record.', doms: ['LAN', 'WAN', 'Wireless', 'DDI'] },
    { proc: 'Problem', title: 'Root cause analysis draft', text: 'Assembles the timeline, evidence and likely cause for a major incident, ready for the team to review and correct.', doms: ['LAN', 'WAN', 'Wireless', 'DDI'] }
  ];

  window.NetwikData = { PROCS: PROCS, DOMS: DOMS, ALL: ALL };
})();
