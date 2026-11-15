# Blueprint addendum: organisations and policy for vulnerability management

Date: 15 November 2026
Extends: *ServiceNow Demo Customer Blueprint — Veridian Life Sciences* (11 November 2026), sections 3 and 5
Reason: the end-to-end vulnerability flow names stakeholders and approval authorities that the blueprint does not yet contain

These sections are written to drop into the blueprint and follow its conventions: roles rather than invented names, a table reference and a volume for each item, and the existing `VLS-` and `Netwik-` group prefixes. I have not edited the Word document itself, because its tables and image cannot be round-tripped safely.

---

## 3.1 New departments (`cmn_department`)

The blueprint has Global Technology, Manufacturing Ops, R&D, Commercial, Finance and HR. Two more are needed so that security and quality staff do not sit inside Global Technology, which would make the approval separation meaningless.

| Department | Belongs to | Why it is needed |
|---|---|---|
| Information Security | Reports to the CISO, not to the CIO | The security organisation must be able to disagree with IT about risk |
| Quality Assurance | Reports to the Chief Quality Officer | GxP validation approval cannot sit inside the team making the change |

Revised volume: 8 to 12 departments.

## 3.2 New groups (`sys_user_group`)

Eight groups. Four are approval groups, so set the group type accordingly and give each one a manager.

| Group | Type | Side | Purpose in the flow |
|---|---|---|---|
| `VLS-CTO-Office` | approval | Customer | **Sole authority to accept risk.** Signs every exception for an unremediable device |
| `VLS-Security-Operations` | itil | Customer | Owns the customer's vulnerability posture. Receives every advisory assessment and holds the risk register |
| `VLS-Command-Centre` | itil, 24x7 | Customer | The customer's round-the-clock operations bridge. Receives advisory and remediation notifications so it recognises related events |
| `VLS-SRE` | itil | Customer | Platform and application reliability. Consulted where remediation windows affect application availability |
| `VLS-QA-Validation` | approval | Customer | Approves any change to a validated GxP system. Blocks remediation at the eight regulated plants without a quality gate |
| `Netwik-Vulnerability-Management` | itil | Provider | Runs the process. The agents operate as members of this group, so their work appears under a named team |
| `CAB-Emergency` | approval | Provider and customer | Emergency change authority. The blueprint has only `CAB-Network`, which cannot convene fast enough for an exploited vulnerability |
| `Vendor-Cisco-PSIRT` / `Vendor-PaloAlto-PSIRT` | vendor | Vendor | Advisory source of record and the route for clarification questions. Count as one line, two groups |

Revised volume: about 23 groups.

## 3.3 New roles (`sys_user`)

Roles, not names, matching the blueprint's approach. The data generator assigns names.

**Customer, CTO office and security**

| Role | Group | Appears in the flow as |
|---|---|---|
| Chief Technology Officer | `VLS-CTO-Office` | Signs risk acceptance above the delegation limit |
| Head of Technology Risk | `VLS-CTO-Office` | Delegated signatory below the limit. Named approver on most exceptions |
| Chief Information Security Officer | `VLS-Security-Operations` | Escalation point. Receives the executive briefing |
| Head of Security Operations | `VLS-Security-Operations` | Day-to-day owner of the advisory assessment |
| Vulnerability Manager | `VLS-Security-Operations` | Challenges Netwik's assessment and tracks the deadline |
| Security Analyst, two of them | `VLS-Security-Operations` | Answers configuration qualification questions in phase 1 |

**Customer, operations and quality**

| Role | Group | Appears in the flow as |
|---|---|---|
| Command Centre Shift Lead, three of them | `VLS-Command-Centre` | Follow-the-sun acknowledgement of notifications |
| Head of Site Reliability | `VLS-SRE` | Consulted on remediation windows for critical applications |
| Site Reliability Lead, EMEA and AMER | `VLS-SRE` | Confirms application impact of a proposed wave |
| Quality Assurance Director | `VLS-QA-Validation` | Approves the validation approach for GxP remediation |
| Validation Lead, two of them | `VLS-QA-Validation` | Produces and signs the validation impact assessment |

**Provider**

| Role | Group | Appears in the flow as |
|---|---|---|
| Vulnerability Management Lead | `Netwik-Vulnerability-Management` | Accountable for the assessment Netwik issues. Approves outbound customer communication |
| Vulnerability Analyst, two of them | `Netwik-Vulnerability-Management` | Reviews and corrects agent output before it is issued |
| Security Lead | `Netwik-Security-L3` | Technical authority on firewall and perimeter exposure |

Revised volume: about 20 additional users, so 320 to 520 in total.

## 3.4 New on-call rotas (`cmn_rota`)

| Rota | Covers | Why |
|---|---|---|
| Command Centre 24x7 | Three shifts, `VLS-Command-Centre` | Lets the agent name who to notify at the hour the advisory lands |
| Vulnerability Management on-call | `Netwik-Vulnerability-Management` | An exploited advisory arriving at 02:00 needs an owner |

Revised volume: 6 rotas.

## 3.5 New schedules (`cmn_schedule`)

| Schedule | Definition | Used by |
|---|---|---|
| Emergency CAB on demand | 24x7, one hour to convene | Stage 9, emergency change path |
| Quality review window | EMEA business hours, excluding validation freezes | Stage 7, GxP quality gate |

Revised volume: 7 schedules.

## 3.6 New field on device records

| Field | Table | Values | Why |
|---|---|---|---|
| `u_exposure_zone` | Network and security device classes | internet-facing, perimeter, internal, management, operational-technology | With configuration state out of phase 1, exposure zone is the main input that narrows the affected population. Without it, risk scoring has almost nothing to work with |

## 5.1 New tables for the vulnerability flow

**Vulnerability Response is not available on the instance**, so all of these are custom tables that we own. That is settled, not provisional. Six tables, and the first two are the spine.

| Table | Purpose | Volume |
|---|---|---|
| `u_vulnerability_advisory` | One row per vendor advisory. The thing the flow starts from | 15 to 25 |
| `u_vulnerable_item` | One row per advisory per device. The join that everything downstream counts, filters and closes | Hundreds per advisory |
| `u_qualification_task` | The stage 3 handoff, since the agent cannot read configuration in this phase | One per device group per advisory |
| `u_risk_exception` | The record by which an unremediable device leaves the open population | 10 to 15 |
| `u_stakeholder_notification` | Evidence that the right people were told, which is what an auditor asks for | 6 to 10 per advisory |
| `u_agent_run` | The run record: one row per agent run, with a child row per stage holding its input, output, token usage and cost. Orchestration state and audit trail in one place | One per run |

### `u_vulnerability_advisory`

| Field | Type | Notes |
|---|---|---|
| `u_advisory_id` | String, unique | The vendor's identifier |
| `u_vendor` | Reference to `core_company` | Cisco or Palo Alto Networks |
| `u_title`, `u_summary` | String, long text | As published |
| `u_published`, `u_received` | Date/time | Received is when our flow saw it |
| `u_cvss` | Decimal | Base score |
| `u_severity` | Choice | critical, high, medium, low |
| `u_exploited` | Boolean | Observed in the wild. Drives the hard override in risk banding |
| `u_affected_product` | String | Maps to hardware model and software family |
| `u_affected_versions` | String | Normalised ranges, written by stage 1 |
| `u_fixed_versions` | String | Empty means no fix, which is the end-of-support branch |
| `u_qualifying_condition` | String | The feature or configuration that must be true for the advisory to apply. Recorded even though this phase cannot evaluate it |
| `u_state` | Choice | received, assessed, notified, planned, remediating, verified, closed |
| `u_supersedes` | Reference to itself | For the superseded-advisory pattern |

### `u_vulnerable_item`

| Field | Type | Notes |
|---|---|---|
| `u_advisory` | Reference to `u_vulnerability_advisory` | |
| `u_ci` | Reference to `cmdb_ci` | The device |
| `u_version_matched` | Boolean | Stage 2 result |
| `u_qualified` | Choice | **yes, no, unknown.** Defaults to unknown, because this phase cannot read configuration. The honest default is the whole point |
| `u_exposure_zone` | String | Copied from the device at assessment time |
| `u_risk_band` | Choice | Stage 4 result |
| `u_remediation_due` | Date | Derived from the band |
| `u_state` | Choice | open, planned, in change, remediated, excepted, not affected |
| `u_exclusion_reason` | String | Mandatory when state is not affected. An auditor reads this column before any other |
| `u_change` | Reference to `change_request` | Set by stage 9 |
| `u_exception` | Reference to `u_risk_exception` | Set by stage 13 |

The other four tables keep the fields listed in the previous revision, with `u_agent_run` added.

### `u_agent_run` and `u_agent_run_stage`

| Field | Type | Notes |
|---|---|---|
| `u_advisory` | Reference | What the run is about |
| `u_started_by` | String | The console account, `yudhvir` or `admin` |
| `u_mode` | Choice | live or replay |
| `u_state` | Choice | running, complete, failed |
| `u_total_usd` | Decimal | Summed from the stages, so spend is visible rather than inferred |

Each stage row holds its number, name, input, output, start and end time, token usage, estimated cost, and the person who approved it where a gate applies. This is what makes replay free and the audit trail automatic.

## 5.2 Stakeholder notification matrix

Who is told what, and when. Every outbound item is drafted by the Communications agent and released by a person.

| Stage | Audience | Content | Released by |
|---|---|---|---|
| 1, advisory analysed | `Netwik-Vulnerability-Management` | Raw assessment, internal only | Agent, no approval |
| 2, estate matched | `VLS-Security-Operations`, `VLS-CTO-Office` | Potentially affected population, stated as provisional | Vulnerability Management Lead |
| 3, qualification raised | `VLS-Security-Operations` | The specific questions only the customer can answer | Vulnerability Management Lead |
| 4, risk banded | `VLS-Security-Operations`, `VLS-Command-Centre` | Risk bands, deadlines, what happens next | Vulnerability Management Lead |
| 4, risk banded, top band only | CISO, CTO, Head of Infrastructure | One-page executive briefing | Client Executive Director |
| 7, validation planned | `VLS-QA-Validation` | Validation impact assessment for GxP plants | Validation Lead |
| 8, waves planned | `VLS-SRE`, `VLS-Command-Centre` | Windows, expected impact, rollback position | Service Delivery Manager |
| 9, changes raised | `CAB-Network` or `CAB-Emergency` | Change records for approval | Change Manager |
| 12, verified | All of the above | Closure report, residual exposure | Vulnerability Management Lead |
| 13, exception raised | `VLS-CTO-Office`, CISO | Exception request with compensating control and expiry | Chief Technology Officer or Head of Technology Risk |
| 14, monthly | CIO, CTO, CISO | Service review pack, standing residual risk | Client Executive Director |

## 5.3 Approval authority matrix

| Decision | Proposed by | Approved by | Cannot be delegated to |
|---|---|---|---|
| Assessment issued to the customer | Agent | Vulnerability Management Lead | The agent |
| Remediation plan and wave order | Agent | Service Delivery Manager, with `VLS-SRE` consulted | The agent |
| Change to a validated GxP system | Agent | `VLS-QA-Validation`, then CAB | Netwik alone |
| Normal change | Agent | `CAB-Network` | The agent |
| Emergency change | Agent | `CAB-Emergency` | A single individual |
| Accepting unremediable risk | Agent, with options | `VLS-CTO-Office` | Netwik, at any level |
| Closing an advisory | Agent, with evidence | Vulnerability Management Lead | The agent |

## 5.4 Patterns worth planting in the new data

Consistent with how the blueprint plants patterns elsewhere.

- An exception approved a year ago that has quietly expired, so the device is open again and nobody noticed. This is the strongest single finding the agent can make.
- A GxP plant where remediation slipped past its deadline because the quality gate was never requested.
- A qualification task that was never answered, leaving devices permanently provisional.
- One advisory superseded by a later one, where remediation continued against the obsolete version.
- An exception with a compensating control recorded as free text and no evidence that the control was ever implemented.

## Assumption introduced here, for correction

The blueprint has a CIO and no CTO. To make the agreed sign-off authority work, I have split them: the CIO owns the service and commercial relationship with Netwik, and the CTO office owns technology standards and technology risk, and therefore signs risk acceptance. The CISO advises on risk but does not accept it. If you want the CIO to hold that authority instead, this is a single change here and in the statement document.
