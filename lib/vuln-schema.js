/* The tables the vulnerability flow needs, as data.

   One definition, used by both preview and apply, so what you are shown is
   exactly what gets created. Field types are ServiceNow internal types.

   Seven tables, not six. The addendum counted six and then described the stage
   rows of a run; those need their own table, so it is named here rather than
   quietly folded into something else.

   Creation order matters: a reference field cannot resolve a table that does
   not exist yet, so every table is created first and every field afterwards. */

const STR = function (len) { return { type: 'string', len: len }; };
const REF = function (table) { return { type: 'reference', ref: table }; };
const BOOL = { type: 'boolean' };
const INT = { type: 'integer' };
const DEC = { type: 'decimal' };
const DATE = { type: 'glide_date' };
const WHEN = { type: 'glide_date_time' };
const TEXT = { type: 'string', len: 4000 };

export const SCHEMA = [
  {
    name: 'u_vulnerability_advisory',
    label: 'Vulnerability Advisory',
    purpose: 'One row per vendor advisory. What the flow starts from.',
    fields: [
      ['u_advisory_id', 'Advisory ID', STR(40)],
      ['u_vendor', 'Vendor', REF('core_company')],
      ['u_title', 'Title', STR(255)],
      ['u_summary', 'Summary', TEXT],
      ['u_published', 'Published', DATE],
      ['u_received', 'Received', WHEN],
      ['u_cvss', 'CVSS', DEC],
      ['u_severity', 'Severity', STR(40)],
      ['u_exploited', 'Exploited in the wild', BOOL],
      ['u_affected_product', 'Affected product', STR(255)],
      ['u_affected_versions', 'Affected versions', STR(1000)],
      ['u_fixed_versions', 'Fixed versions', STR(1000)],
      ['u_qualifying_condition', 'Qualifying condition', STR(1000)],
      ['u_state', 'State', STR(40)],
      ['u_supersedes', 'Supersedes', REF('u_vulnerability_advisory')]
    ]
  },
  {
    name: 'u_risk_exception',
    label: 'Risk Exception',
    purpose: 'The only route by which an unremediable device leaves the open population.',
    fields: [
      ['u_advisory', 'Advisory', REF('u_vulnerability_advisory')],
      ['u_compensating_control', 'Compensating control', STR(1000)],
      ['u_justification', 'Justification', TEXT],
      ['u_requested_by', 'Requested by', REF('sys_user')],
      ['u_approved_by', 'Approved by', REF('sys_user')],
      ['u_approval_date', 'Approval date', DATE],
      ['u_expiry_date', 'Expiry date', DATE],
      ['u_review_date', 'Re-review date', DATE],
      ['u_residual_risk', 'Residual risk', STR(40)],
      ['u_device_count', 'Devices covered', INT],
      ['u_state', 'State', STR(40)]
    ]
  },
  {
    name: 'u_vulnerable_item',
    label: 'Vulnerable Item',
    purpose: 'One row per advisory per device. The join everything downstream counts and closes.',
    fields: [
      ['u_advisory', 'Advisory', REF('u_vulnerability_advisory')],
      ['u_ci', 'Configuration item', REF('cmdb_ci')],
      ['u_version', 'Version at assessment', STR(60)],
      ['u_version_matched', 'Version matched', BOOL],
      /* yes / no / unknown. Defaults to unknown on purpose: this phase cannot
         read configuration, and an unreadable answer is not evidence of safety. */
      ['u_qualified', 'Qualified', STR(20)],
      ['u_internet_facing', 'Internet facing', BOOL],
      ['u_site_code', 'Site code', STR(20)],
      ['u_gxp', 'GxP site', BOOL],
      ['u_risk_band', 'Risk band', STR(40)],
      ['u_remediation_due', 'Remediation due', DATE],
      ['u_state', 'State', STR(40)],
      ['u_exclusion_reason', 'Exclusion reason', STR(500)],
      ['u_change', 'Change', REF('change_request')],
      ['u_exception', 'Exception', REF('u_risk_exception')]
    ]
  },
  {
    name: 'u_qualification_task',
    label: 'Qualification Task',
    purpose: 'The stage 3 handoff: what only a person can confirm.',
    fields: [
      ['u_advisory', 'Advisory', REF('u_vulnerability_advisory')],
      ['u_device_group', 'Device group', STR(255)],
      ['u_condition', 'Condition to confirm', STR(1000)],
      ['u_assigned_group', 'Assigned group', REF('sys_user_group')],
      ['u_answer', 'Answer', STR(40)],
      ['u_answered_by', 'Answered by', REF('sys_user')],
      ['u_answered_at', 'Answered at', WHEN],
      ['u_state', 'State', STR(40)]
    ]
  },
  {
    name: 'u_stakeholder_notification',
    label: 'Stakeholder Notification',
    purpose: 'Evidence that the right people were told, which is what an auditor asks for.',
    fields: [
      ['u_advisory', 'Advisory', REF('u_vulnerability_advisory')],
      ['u_audience', 'Audience', REF('sys_user_group')],
      ['u_stage', 'Stage', INT],
      ['u_content', 'Content', TEXT],
      ['u_approved_by', 'Released by', REF('sys_user')],
      ['u_sent_at', 'Sent at', WHEN],
      ['u_acknowledged_by', 'Acknowledged by', REF('sys_user')]
    ]
  },
  {
    name: 'u_agent_run',
    label: 'Agent Run',
    purpose: 'Orchestration state and audit trail in one record.',
    fields: [
      ['u_advisory', 'Advisory', REF('u_vulnerability_advisory')],
      ['u_started_by', 'Started by', STR(40)],
      ['u_mode', 'Mode', STR(20)],
      ['u_state', 'State', STR(40)],
      ['u_started_at', 'Started at', WHEN],
      ['u_finished_at', 'Finished at', WHEN],
      ['u_total_usd', 'Estimated cost (USD)', DEC]
    ]
  },
  {
    name: 'u_agent_run_stage',
    label: 'Agent Run Stage',
    purpose: 'One row per stage, holding its input, output, tokens and approver.',
    fields: [
      ['u_run', 'Run', REF('u_agent_run')],
      ['u_number', 'Stage number', INT],
      ['u_name', 'Stage name', STR(100)],
      ['u_input', 'Input', TEXT],
      ['u_output', 'Output', TEXT],
      ['u_started_at', 'Started at', WHEN],
      ['u_finished_at', 'Finished at', WHEN],
      ['u_input_tokens', 'Input tokens', INT],
      ['u_output_tokens', 'Output tokens', INT],
      ['u_usd', 'Estimated cost (USD)', DEC],
      ['u_approved_by', 'Approved by', REF('sys_user')],
      ['u_state', 'State', STR(40)]
    ]
  }
];

export const TABLE_NAMES = SCHEMA.map(function (t) { return t.name; });

export function totalFields() {
  return SCHEMA.reduce(function (sum, t) { return sum + t.fields.length; }, 0);
}
