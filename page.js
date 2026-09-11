'use client';
import {useEffect, useState, useCallback, useMemo} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';
import {useSession} from '../../components/Session';
import {RecordForm, Drawer, Cell} from '../../components/CC';
import {useToast} from '../../components/ui';

/* ------------------------------------------------------------------ *
 * Everything the practice runs on, and all of it editable.
 *
 * One read (fn_cc_config) fills every list, and every save goes back through the
 * function that owns that table — the browser never touches a table directly.
 *
 * The lists here show what the app shows. A stage you retired is gone from this
 * screen the same way it is gone from the Leads board, unless you ask to see the
 * retired ones. Two screens disagreeing about how many stages exist is how you
 * lose faith in both.
 * ------------------------------------------------------------------ */

const BUCKETS = ['new', 'contacting', 'assessment', 'qualified', 'proposal',
  'decision_pending', 'converted', 'nurturing', 'closed_lost'];
const FEE_KINDS = ['government', 'service', 'third_party', 'biometrics', 'medical',
  'language_test', 'translation', 'courier', 'institution_deposit', 'other'];
const CURRENCIES = ['INR', 'CAD', 'AUD', 'GBP', 'USD', 'EUR', 'NZD', 'AED', 'SGD', 'PHP', 'NPR', 'LKR', 'BDT'];
const PARTIES = ['applicant', 'spouse', 'common_law_partner', 'child', 'parent', 'sibling',
  'dependant', 'sponsor', 'guardian', 'employer', 'institution', 'other'];
const APPLIES = ['applicant', 'spouse', 'child', 'parent', 'dependant', 'sponsor', 'institution', 'household', 'matter'];
const SEVERITY = ['blocking', 'warning', 'informational'];
const APPT_KINDS = ['consultation', 'assessment', 'document_collection', 'biometrics',
  'medical', 'interview', 'signing', 'review', 'other'];
const OPERATORS = ['>=', '>', '=', '<=', '<', '!=', 'in', 'not_in', 'between', 'exists'];
const LINK_KINDS = [
  {v: 'none', l: 'Nothing extra'},
  {v: 'person', l: 'Ask which client or enquiry sent them'},
  {v: 'partner', l: 'Ask which partner sent them'},
];

const versionLabel = (pv, config) => {
  const p = (config.programmes ?? []).find(x => x.id === pv.programme_id);
  return (p ? p.name + ' · ' : '') + 'v' + pv.version_no + ' ' + (pv.label ?? '') + ' (' + pv.status + ')';
};
const nameOf = (list, id) => (list ?? []).find(x => x.id === id)?.name ?? null;

const SECTIONS = [
  /* ---- what you sell -------------------------------------------- */
  {
    key: 'categories', group: 'sell', label: 'Categories', singular: 'category',
    data: 'categories', table: 'service_categories', gate: 'edit_lead_config',
    cols: [['name', 'Category'], ['code', 'Code'], ['display_order', 'Order'], ['is_active', 'Active']],
    fn: 'fn_cc_save_category',
    addHint: 'The top line of the new-enquiry cascade — Study, Work, Visitor, PR, Legal, VAS.',
    fields: [
      {k: 'name', label: 'Category', required: true},
      {k: 'code', label: 'Code'},
      {k: 'display_order', label: 'Order', type: 'num', default: 100},
      {k: 'is_active', label: 'Active', type: 'bool'},
    ],
  },
  {
    key: 'subcategories', group: 'sell', label: 'Visas, permits and PR routes', singular: 'route',
    data: 'subcategories', table: 'service_subcategories', gate: 'edit_lead_config',
    cols: [['category_id', 'Category', (v, r, c) => nameOf(c.categories, v)],
           ['name', 'Route'], ['code', 'Code'], ['is_active', 'Active']],
    fn: 'fn_cc_save_subcategory',
    rowAction: {label: 'Destinations', panel: 'destinations'},
    note2: true,
    addHint: 'The second dropdown, and your catalogue of visa types — PGWP, SOWP, LMIA, study permit extension. Add as many as you file.',
    fields: [
      {k: 'category', label: 'Category', p: 'p_category', required: true, from: 'category_id',
       opts: {from: 'categories', where: c => c.is_active}},
      {k: 'name', label: 'Route', required: true, hint: 'PGWP, SOWP, LMIA, PNP, study permit extension…'},
      {k: 'code', label: 'Code'},
      {k: 'description', label: 'Description', type: 'area', wide: true},
      {k: 'programme', label: 'Default programme', p: 'p_programme', from: 'programme_id',
       opts: {from: 'programmes'}},
      {k: 'display_order', label: 'Order', type: 'num', default: 100},
      {k: 'is_active', label: 'Active', type: 'bool'},
    ],
    note: 'A sub-category offered in a country IS a visa type — PGWP in Canada. Use Destinations on a row to say where you file it; leave it empty and it is offered everywhere.',
  },
  {
    key: 'countries', group: 'sell', label: 'Destinations', singular: 'country',
    data: 'countries', table: 'programme_countries', gate: 'edit_catalogue',
    cols: [['name', 'Country'], ['iso2', 'ISO'], ['is_destination', 'Destination'],
           ['is_origin', 'Origin'], ['is_active', 'Active']],
    fn: 'fn_cc_save_country',
    addHint: 'A place you file to, or that clients come from.',
    fields: [
      {k: 'name', label: 'Country', required: true},
      {k: 'iso2', label: 'ISO2', hint: 'Two letters, e.g. CA'},
      {k: 'iso3', label: 'ISO3'},
      {k: 'display_order', label: 'Order', type: 'num', default: 100},
      {k: 'is_active', label: 'Active', type: 'bool'},
    ],
  },
  {
    key: 'programmes', group: 'sell', label: 'Routes and publishing', singular: 'route',
    data: 'programmes', table: 'programmes', gate: 'publish', readOnly: true,
    cols: [['country_id', 'Destination', (v, r, c) => nameOf(c.countries, v)],
           ['subcategory_id', 'Route', (v, r, c) => nameOf(c.subcategories, v)],
           ['family', 'Category'],
           ['id', 'Documents', (v, r, c) =>
              ((c.route_documents ?? []).find(rd => rd.programme_id === v) || {}).count ?? 0],
           ['id', 'Status', (v, r, c) => {
              const pv = (c.programme_versions ?? []).filter(x => x.programme_id === v)
                .sort((a, b) => b.version_no - a.version_no)[0];
              return pv ? pv.status : 'no version';
           }]],
    publish: true,
    rowAction: {label: 'Documents', panel: 'routedocs'},
    note: 'This board is not a second list to maintain — it is what your routes and their destinations produced. A route must be published before a file can be opened on it.',
  },

  /* ---- how work moves -------------------------------------------- */
  {
    key: 'stages', group: 'flow', label: 'Lead stages', singular: 'lead stage',
    data: 'pipeline_stages', table: 'pipeline_stages', gate: 'edit_lead_config',
    sort: (a, b) => a.sequence - b.sequence,
    cols: [['sequence', '#'], ['name', 'Stage'], ['bucket', 'Bucket'],
           ['requires_reason', 'Needs reason'], ['can_bypass', 'Skippable'], ['is_active', 'Active']],
    fn: 'fn_cc_save_pipeline_stage',
    addHint: 'A step an enquiry passes through before it becomes a file.',
    note: 'These are exactly the stages the Leads dropdown offers. Retiring one that still has enquiries in it is refused — move them first.',
    extra: (v, row, config) => ({p_pipeline: row?.pipeline_id ?? (config.pipelines?.[0]?.id ?? null)}),
    fields: [
      {k: 'name', label: 'Stage', required: true},
      {k: 'code', label: 'Code', hint: 'Left blank, it is made from the name.'},
      {k: 'sequence', label: 'Position', type: 'num'},
      {k: 'bucket', label: 'Bucket', opts: BUCKETS, hint: 'How reporting groups it.'},
      {k: 'description', label: 'Description', type: 'area', wide: true},
      {k: 'requires_reason', label: 'Always record a reason', type: 'bool', default: false},
      {k: 'requires_task', label: 'Needs a task before leaving', type: 'bool', default: false},
      {k: 'can_bypass', label: 'Can be skipped', type: 'bool', default: true},
      {k: 'is_terminal', label: 'Ends the enquiry', type: 'bool', default: false},
      {k: 'is_active', label: 'Active', type: 'bool'},
    ],
  },
  {
    key: 'workflow', group: 'flow', label: 'Application stages', singular: 'application stage',
    data: 'workflow_stages', table: 'workflow_stages', gate: 'edit_workflow',
    sort: (a, b) => a.sequence - b.sequence,
    cols: [['sequence', '#'], ['name', 'Stage'], ['skip_allowed', 'Skippable'],
           ['approver_required', 'Needs approval'], ['is_terminal', 'Terminal'], ['is_active', 'Active']],
    fn: 'fn_cc_save_stage',
    note: 'Where a lead stage ends, an application stage begins. These are the stages a file moves through after conversion.',
    extra: (v, row, config) => ({p_workflow_version: row?.workflow_version_id ?? (config.workflow_versions?.[0]?.id ?? null)}),
    fields: [
      {k: 'name', label: 'Stage', required: true},
      {k: 'description', label: 'Description', type: 'area', wide: true},
      {k: 'responsible_role_id', label: 'Owned by role', opts: {from: 'roles'}},
      {k: 'entry_condition', label: 'Entry condition'},
      {k: 'exit_condition', label: 'Exit condition'},
      {k: 'due_rule_days', label: 'Due in (days)', type: 'num'},
      {k: 'due_rule_basis', label: 'Days counted from'},
      {k: 'escalation_after_hours', label: 'Escalate after (hours)', type: 'num'},
      {k: 'skip_allowed', label: 'Can be skipped', type: 'bool'},
      {k: 'skip_requires_reason', label: 'Skipping needs a reason', type: 'bool'},
      {k: 'approver_required', label: 'Needs an approver', type: 'bool', default: false},
      {k: 'approver_role_id', label: 'Approver role', opts: {from: 'roles'}},
      {k: 'is_terminal', label: 'Ends the application', type: 'bool', default: false},
      {k: 'is_active', label: 'Active', type: 'bool'},
      {k: 'deactivated_reason', label: 'Reason, if switching off', wide: true},
    ],
  },
  {
    key: 'sources', group: 'flow', label: 'Lead sources', singular: 'lead source',
    data: 'lead_sources', table: 'lead_sources', gate: 'edit_lead_config',
    cols: [['name', 'Source'], ['channel', 'Channel'],
           ['link_kind', 'Also asks for', v => v === 'person' ? 'A client or enquiry'
             : v === 'partner' ? 'A partner' : '—'],
           ['is_active', 'Active']],
    fn: 'fn_cc_save_lead_source',
    addHint: 'Where enquiries come from — and, when it is a who rather than a what, who to ask for.',
    note: 'Set “also asks for” and the new-enquiry form adds the right picker: a past client, or a partner.',
    fields: [
      {k: 'name', label: 'Source', required: true},
      {k: 'channel', label: 'Channel', hint: 'Walk-in, referral, Meta ads…'},
      {k: 'cost_model', label: 'Cost model', opts: ['free', 'per_lead', 'per_click', 'retainer', 'commission']},
      {k: 'link_kind', label: 'Also asks for', opts: LINK_KINDS, default: 'none', wide: true},
      {k: 'is_active', label: 'Active', type: 'bool'},
    ],
  },
  {
    key: 'appointments', group: 'flow', label: 'Appointment types', singular: 'appointment type',
    data: 'appointment_types', table: 'appointment_types', gate: 'edit_catalogue',
    cols: [['name', 'Type'], ['key', 'Kind'], ['duration_minutes', 'Minutes'],
           ['reminder_hours_before', 'Remind (h)'], ['is_active', 'Active']],
    fn: 'fn_cc_save_appointment_type',
    addHint: 'Until one exists there is nothing the calendar can book.',
    fields: [
      {k: 'key', label: 'Kind', opts: APPT_KINDS, default: 'consultation', required: true},
      {k: 'name', label: 'Name', required: true},
      {k: 'duration_minutes', label: 'Minutes', type: 'num', default: 30, required: true},
      {k: 'requires_client_confirmation', label: 'Client must confirm', type: 'bool'},
      {k: 'reminder_hours_before', label: 'Remind hours before', type: 'num', default: 24},
      {k: 'location_default', label: 'Default location'},
      {k: 'is_active', label: 'Active', type: 'bool'},
    ],
  },
  {
    key: 'sla', group: 'flow', label: 'SLA and dwell clocks', singular: 'clock',
    data: 'sla_rules', table: 'sla_rules', gate: 'edit_catalogue',
    cols: [['event_key', 'Clock'], ['applies_to', 'Applies to'], ['target_minutes', 'Target (min)'],
           ['business_hours_only', 'Office hours'], ['breach_action', 'On breach'], ['is_active', 'Active']],
    fn: 'fn_cc_save_sla_rule',
    fields: [
      {k: 'version', label: 'Programme version', p: 'p_version', versionOpts: true, from: 'programme_version_id'},
      {k: 'applies_to', label: 'Applies to', required: true, hint: 'lead, application, document…'},
      {k: 'event_key', label: 'Clock', required: true, hint: 'first_contact, doc_chase…'},
      {k: 'description', label: 'Description', type: 'area', wide: true},
      {k: 'target_minutes', label: 'Target (minutes)', type: 'num', required: true},
      {k: 'business_hours_only', label: 'Office hours only', type: 'bool'},
      {k: 'warn_at_pct', label: 'Warn at (%)', type: 'num', default: 80},
      {k: 'breach_action', label: 'On breach'},
      {k: 'escalate_after_minutes', label: 'Escalate after (minutes)', type: 'num'},
      {k: 'escalate_to_role_id', label: 'Escalate to role', opts: {from: 'roles'}},
      {k: 'is_active', label: 'Active', type: 'bool'},
    ],
  },

  /* ---- what the answer is made of --------------------------------- */
  {
    key: 'rules', group: 'answer', label: 'Eligibility rules', singular: 'rule',
    data: 'eligibility_rules', table: 'eligibility_rules', gate: 'edit_catalogue',
    cols: [['code', 'Code'], ['name', 'Rule'], ['severity', 'Severity'],
           ['fact_key', 'Fact'], ['operator', 'Op'], ['is_active', 'Live']],
    fn: 'fn_cc_save_eligibility_rule',
    link: {href: '/control-centre/rules', label: 'Verify and switch on'},
    advice: {title: 'Adding a rule is not the same as switching it on',
      body: 'A rule decides what the system tells a client, so going live needs a confirmed value, an authority link and the sentence that says so. That happens on the verification screen.'},
    fields: [
      {k: 'version', label: 'Programme version', p: 'p_version', required: true, versionOpts: true, from: 'programme_version_id'},
      {k: 'code', label: 'Code', required: true},
      {k: 'name', label: 'Rule', required: true},
      {k: 'severity', label: 'Severity', opts: SEVERITY, default: 'blocking'},
      {k: 'fact_key', label: 'Fact key', required: true, hint: 'What it reads from the assessment.'},
      {k: 'operator', label: 'Operator', opts: OPERATORS, default: '>='},
      {k: 'value_kind', label: 'Value kind', opts: ['number', 'text', 'boolean', 'date', 'list'], default: 'number'},
      {k: 'compare_value', label: 'Compare with'},
      {k: 'description', label: 'Description', type: 'area', wide: true},
      {k: 'failure_message', label: 'What the client is told when it fails', type: 'area', wide: true},
      {k: 'remedy_hint', label: 'How they could fix it', type: 'area', wide: true},
      {k: 'display_order', label: 'Order', type: 'num', default: 100},
      {k: 'is_active', label: 'Live', type: 'bool', default: false},
    ],
  },
  {
    key: 'doccats', group: 'answer', label: 'Document categories', singular: 'category',
    data: 'document_categories', table: 'document_categories', gate: 'edit_catalogue',
    cols: [['country_id', 'Destination', (v, r, c) => nameOf(c.countries, v) ?? 'All countries'],
           ['name', 'Category'],
           ['id', 'Documents', (v, r, c) =>
              (c.checklist_documents ?? []).filter(d => d.doc_category_id === v && d.is_active).length],
           ['is_active', 'Active']],
    fn: 'fn_cc_save_document_category',
    addHint: 'Education documents, Experience documents, Police clearance, Insurance — whatever this country needs.',
    note: 'Categories belong to a destination, so the UK can have its own without Canada inheriting it.',
    fields: [
      {k: 'country', label: 'Destination', p: 'p_country', required: true, from: 'country_id',
       opts: {from: 'countries', where: c => c.is_active}},
      {k: 'name', label: 'Category', required: true},
      {k: 'note', label: 'Note', type: 'area', wide: true},
      {k: 'display_order', label: 'Order', type: 'num', default: 100},
      {k: 'is_active', label: 'Active', type: 'bool'},
    ],
  },
  {
    key: 'library', group: 'answer', label: 'Documents', singular: 'document',
    data: 'checklist_documents', table: 'checklist_documents', gate: 'edit_catalogue',
    cols: [['country_id', 'Destination', (v, r, c) => nameOf(c.countries, v)],
           ['doc_category_id', 'Category', (v, r, c) => nameOf(c.document_categories, v)],
           ['name', 'Document'],
           ['id', 'On routes', (v, r, c) =>
              (c.route_documents ?? []).filter(rd => (rd.document_ids ?? []).includes(v)).length],
           ['is_active', 'Active']],
    fn: 'fn_cc_save_checklist_document',
    addHint: 'One document, under one category, for one destination.',
    note: 'A document asked for on a route is the same record — "on routes" counts how many checklists it sits on. Switching one off is refused while a route still asks for it.',
    fields: [
      {k: 'country', label: 'Destination', p: 'p_country', required: true, from: 'country_id',
       opts: {from: 'countries', where: c => c.is_active}},
      {k: 'category', label: 'Category', p: 'p_category', from: 'doc_category_id',
       opts: {from: 'document_categories', where: d => d.is_active,
              label: d => d.name}},
      {k: 'name', label: 'Document', required: true},
      {k: 'code', label: 'Code'},
      {k: 'note', label: 'Why it is needed', type: 'area', wide: true},
      {k: 'display_order', label: 'Order', type: 'num', default: 100},
      {k: 'is_active', label: 'Active', type: 'bool'},
    ],
  },
  {
    key: 'requirements', group: 'answer', label: 'Document requirements', singular: 'requirement',
    data: 'requirements', table: 'requirements', gate: 'edit_catalogue',
    cols: [['name', 'Requirement'], ['applies_to', 'Applies to'], ['is_mandatory', 'Blocking'],
           ['default_due_days', 'Due in'], ['is_active', 'Active']],
    fn: 'fn_cc_save_requirement',
    fields: [
      {k: 'version', label: 'Programme version', p: 'p_version', required: true, versionOpts: true, from: 'programme_version_id'},
      {k: 'code', label: 'Code', required: true},
      {k: 'name', label: 'Requirement', required: true},
      {k: 'applies_to', label: 'Applies to', opts: APPLIES, default: 'applicant'},
      {k: 'stage', label: 'Asked at stage'},
      {k: 'why_needed', label: 'Why it is needed', type: 'area', wide: true},
      {k: 'is_mandatory', label: 'Blocks submission', type: 'bool'},
      {k: 'expiry_relevant', label: 'Expiry matters', type: 'bool', default: false},
      {k: 'min_validity_days', label: 'Minimum validity (days)', type: 'num'},
      {k: 'default_due_days', label: 'Due in (days)', type: 'num', default: 7},
      {k: 'reminder_days_csv', label: 'Reminders after (days)', p: 'p_reminder_days_csv', hint: 'e.g. 3,7,14'},
      {k: 'escalation_days', label: 'Escalate after (days)', type: 'num'},
      {k: 'accepts_file_types_csv', label: 'Accepted file types', p: 'p_accepts_file_types_csv', hint: 'e.g. pdf,jpg,png'},
      {k: 'max_file_mb', label: 'Max file size (MB)', type: 'num', default: 10},
      {k: 'reviewer_role_id', label: 'Reviewed by role', opts: {from: 'roles'}},
      {k: 'used_in_assessment', label: 'Used in the assessment', type: 'bool', default: false},
      {k: 'display_order', label: 'Order', type: 'num', default: 100},
      {k: 'is_active', label: 'Active', type: 'bool'},
    ],
    extra: () => ({p_condition_fact_key: null, p_condition_operator: null,
      p_condition_kind: null, p_condition_value: null}),
  },
  {
    key: 'fees', group: 'answer', label: 'Fees', singular: 'fee',
    data: 'fees', table: 'programme_fees', gate: 'edit_catalogue',
    cols: [['name', 'Fee'], ['fee_kind', 'Kind'], ['amount', 'Amount'], ['currency', 'Ccy'],
           ['blocks_submission', 'Blocks filing'], ['is_active', 'Active']],
    fn: 'fn_cc_save_fee',
    addHint: 'Your professional fee and the government fee. The assessment result quotes from here.',
    fields: [
      {k: 'version', label: 'Programme version', p: 'p_version', required: true, versionOpts: true, from: 'programme_version_id'},
      {k: 'name', label: 'Fee', required: true},
      {k: 'fee_kind', label: 'Kind', opts: FEE_KINDS, default: 'service'},
      {k: 'amount', label: 'Amount', type: 'num', required: true},
      {k: 'currency', label: 'Currency', opts: CURRENCIES, default: 'CAD'},
      {k: 'per_applicant', label: 'Charged per applicant', type: 'bool', default: true},
      {k: 'applies_to', label: 'Applies to', opts: PARTIES, default: 'applicant'},
      {k: 'is_mandatory', label: 'Always charged', type: 'bool'},
      {k: 'payable_stage', label: 'Payable at stage'},
      {k: 'blocks_submission', label: 'Must be paid before filing', type: 'bool', default: false},
      {k: 'notes', label: 'Notes', type: 'area', wide: true},
      {k: 'is_active', label: 'Active', type: 'bool'},
    ],
  },

  /* ---- the office ------------------------------------------------- */
  {
    key: 'branches', group: 'office', label: 'Branches', singular: 'branch',
    data: 'branches', table: 'branches', gate: 'edit_roles',
    cols: [['name', 'Branch'], ['code', 'Code'], ['city', 'City'], ['country', 'Country'],
           ['timezone', 'Timezone'], ['is_active', 'Active']],
    fn: 'fn_cc_save_branch',
    fields: [
      {k: 'name', label: 'Branch', required: true},
      {k: 'code', label: 'Code'},
      {k: 'city', label: 'City'},
      {k: 'country', label: 'Country'},
      {k: 'timezone', label: 'Timezone', hint: 'e.g. Asia/Kolkata'},
      {k: 'is_active', label: 'Active', type: 'bool'},
    ],
  },
  {
    key: 'teams', group: 'office', label: 'Teams', singular: 'team',
    data: 'teams', table: 'teams', gate: 'edit_roles',
    cols: [['name', 'Team'], ['purpose', 'Purpose'], ['is_active', 'Active']],
    fn: 'fn_cc_save_team',
    fields: [
      {k: 'branch', label: 'Branch', p: 'p_branch', opts: {from: 'branches'}, from: 'branch_id'},
      {k: 'name', label: 'Team', required: true},
      {k: 'purpose', label: 'Purpose', type: 'area', wide: true},
      {k: 'is_active', label: 'Active', type: 'bool'},
    ],
  },
];

const GROUP = {
  sell: 'What you sell',
  flow: 'How work moves',
  answer: 'What the answer is made of',
  office: 'The office',
};

/* ------------------------------------------------------------------ */

export default function ControlCentre() {
  const {state: session} = useSession();
  const [toast, say] = useToast();
  const [sec, setSec] = useState('categories');
  const [config, setConfig] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [panel, setPanel] = useState(null);
  const [dest, setDest] = useState(null);      // sub-category whose destinations are open
  const [showRetired, setShowRetired] = useState(false);

  const load = useCallback(async () => {
    setState('loading'); setError(null);
    const [cfg, docs] = await Promise.all([
      supabase.rpc('fn_cc_config'),
      supabase.rpc('fn_cc_documents'),
    ]);
    if (cfg.error) { setError(cfg.error.message); setState('error'); return; }
    // The document library is its own read, so it keeps its own shape rather
    // than being bolted onto the config payload.
    setConfig({...(cfg.data ?? {}),
      document_categories: docs.data?.categories ?? [],
      checklist_documents: docs.data?.documents ?? (cfg.data?.checklist_documents ?? []),
      route_documents: docs.data?.route_documents ?? []});
    setState('ready');
  }, []);

  useEffect(() => { if (session === 'member') load(); }, [session, load]);

  async function save(fn, params) {
    const {data, error: e} = await supabase.rpc(fn, params);
    if (e) throw new Error(e.message);
    return data;
  }

  async function afterSave(what) {
    setEditing(null); setPanel(null); setDest(null);
    await load();
    say('Saved', what + ' is live for everyone on the account.');
  }

  const isPeople = sec === 'people';
  const spec = SECTIONS.find(s => s.key === sec);
  const can = config?.can ?? {};

  const {rows, hidden} = useMemo(() => {
    if (!config || !spec) return {rows: [], hidden: 0};
    const all = (config[spec.data] ?? []).slice();
    const live = all.filter(r => r.is_active !== false);
    const list = showRetired ? all : live;
    return {rows: spec.sort ? list.sort(spec.sort) : list, hidden: all.length - live.length};
  }, [config, spec, showRetired]);

  const withVersionOpts = useCallback((s) => {
    if (!s) return s;
    return {...s, fields: s.fields.map(f => f.versionOpts
      ? {...f, opts: {from: 'programme_versions', label: pv => versionLabel(pv, config)}}
      : f)};
  }, [config]);

  return (<div className="page">
    <div className="phead"><div><h1>Control Centre</h1>
      <p className="sub">Everything the system runs on. What you see here is what the app uses —
        change it here and the enquiry form, the stage dropdowns and the assessment follow.</p></div>
      <span className="spacer"/>
      <button className="tbtn" onClick={load}>Refresh</button></div>

    {state === 'error'
      ? <div className="card" style={{borderTop: '2px solid var(--bad)'}}><div className="card-b">
          <div style={{fontWeight: 600, marginBottom: 6}}>Could not load the Control Centre</div>
          <p style={{margin: 0, fontSize: 13, color: 'var(--ink2)'}}>{error}</p>
          <button className="tbtn" style={{marginTop: 12}} onClick={load}>Try again</button>
        </div></div>

    : state !== 'ready'
      ? <div className="card"><div className="card-b"><div className="empty">Loading…</div></div></div>

      : <div className="cc">
        <nav className="ccnav">
          {Object.keys(GROUP).map(g => <div key={g}>
            <div className="ccgrp">{GROUP[g]}</div>
            {SECTIONS.filter(s => s.group === g).map(s =>
              <button key={s.key} className={sec === s.key ? 'on' : ''} onClick={() => setSec(s.key)}>
                {s.label}
                <span className="ccn mono">{(config[s.data] ?? []).filter(r => r.is_active !== false).length}</span>
              </button>)}
          </div>)}
          <div>
            <div className="ccgrp">Who does the work</div>
            <button className={isPeople ? 'on' : ''} onClick={() => setSec('people')}>
              Team, roles and tabs<span className="ccn mono">{(config.members ?? []).length}</span>
            </button>
          </div>
        </nav>

        <div className="ccbody">
          {isPeople
            ? <People config={config} save={save} afterSave={afterSave} say={say}
                panel={panel} setPanel={setPanel}/>
            : <Section spec={spec} rows={rows} hidden={hidden} config={config} can={can}
                showRetired={showRetired} setShowRetired={setShowRetired}
                onAdd={() => setEditing({spec: withVersionOpts(spec), row: null})}
                onEdit={row => setEditing({spec: withVersionOpts(spec), row})}
                onRowAction={row => setDest({row, panel: spec.rowAction?.panel || 'destinations'})}
                onPublish={async (row, status) => {
                  // Impact review is the one step that will not move without notes.
                  let note = 'Advanced from Control Centre';
                  if (status === 'test') {
                    note = window.prompt(
                      'Impact review notes — who is affected, what changes for files already running, ' +
                      'and what staff must do differently:', '');
                    if (note === null) return;
                  }
                  try {
                    const r = await save('fn_cc_route_advance', {p_programme: row.id, p_note: note});
                    await afterSave(r.route + ' moved from ' + r.from + ' to ' + r.to);
                  } catch (e) { say('Not advanced', e.message); }
                }}/>}
        </div>
      </div>}

    {editing
      ? <RecordForm spec={editing.spec} row={editing.row} config={config} save={save}
          onClose={() => setEditing(null)}
          onSaved={() => afterSave(editing.spec.singular.replace(/^./, c => c.toUpperCase()))}/>
      : null}

    {dest && dest.panel === 'destinations'
      ? <Destinations row={dest.row} config={config} save={save}
          onClose={() => setDest(null)} onSaved={() => afterSave('The destination list')}/>
      : null}

    {dest && dest.panel === 'routedocs'
      ? <RouteDocs row={dest.row} config={config} save={save}
          onClose={() => setDest(null)} onSaved={() => afterSave('The checklist for this route')}/>
      : null}

    {toast}
  </div>);
}

/* ------------------------------------------------------------------ */

function Section({spec, rows, hidden, config, can, onAdd, onEdit, onRowAction, onPublish, showRetired, setShowRetired}) {
  const editable = can[spec.gate];

  return (<>
    <div className="card-h" style={{border: 0, padding: '0 0 12px'}}>
      <h2 style={{fontSize: 16}}>{spec.label}</h2><span className="spacer"/>
      {hidden > 0
        ? <button className="mini" onClick={() => setShowRetired(!showRetired)}>
            {showRetired ? 'Hide' : 'Show'} {hidden} retired</button>
        : null}
      {spec.link ? <Link className="tbtn" href={spec.link.href}>{spec.link.label}</Link> : null}
      {editable && !spec.readOnly
        ? <button className="tbtn pri" onClick={onAdd}>Add {spec.singular}</button>
        : spec.readOnly ? null : <span className="tag t-mute">READ ONLY FOR YOU</span>}
    </div>

    {spec.advice
      ? <div className="advice" style={{marginBottom: 12}}>
          <div className="lbl">{spec.advice.title}</div><p>{spec.advice.body}</p></div>
      : null}

    {!rows.length
      ? <div className="card"><div className="card-b">
          <div className="empty" style={{padding: 34}}>
            <div style={{fontSize: 15, color: 'var(--ink2)', marginBottom: 6}}>Nothing here yet</div>
            <span className="mono" style={{fontSize: 12}}>{spec.table}</span> has nothing active.
            {editable && !spec.readOnly ? <div style={{marginTop: 10}}>
              <button className="tbtn pri" onClick={onAdd}>Add the first {spec.singular}</button>
            </div> : null}
          </div></div></div>

      : <div className="card"><div className="scrollx"><table className="tbl">
          <thead><tr>{spec.cols.map(c => <th key={c[0]}>{c[1]}</th>)}<th/></tr></thead>
          <tbody>{rows.map(r => <tr key={r.id}>
            {spec.cols.map((c, j) => <td key={c[0]} className={j === 0 ? 'k' : ''}
              style={r.is_active === false ? {opacity: .5} : undefined}>
              <Cell v={c[2] ? c[2](r[c[0]], r, config) : r[c[0]]}/></td>)}
            <td style={{textAlign: 'right', whiteSpace: 'nowrap'}}>
              {editable && spec.rowAction
                ? <button className="mini" style={{marginRight: 6}}
                    onClick={() => onRowAction(r)}>{spec.rowAction.label}</button>
                : null}
              {spec.publish && can.publish
                ? (() => {
                    const pv = (config.programme_versions ?? [])
                      .filter(x => x.programme_id === r.id)
                      .sort((a, b) => b.version_no - a.version_no)[0];
                    const nextOf = {draft: 'Move to test', test: 'Send for impact review',
                                    impact_review: 'Publish'};
                    const label = pv ? nextOf[pv.status] : null;
                    return label
                      ? <button className="mini pri" onClick={() => onPublish(r, pv.status)}>{label}</button>
                      : <span className="tag t-ok">LIVE</span>;
                  })()
                : null}
              {editable && !spec.readOnly
                ? <button className="mini" onClick={() => onEdit(r)}>Edit</button> : null}</td>
          </tr>)}</tbody>
        </table></div></div>}

    {spec.note ? <p className="note">{spec.note}</p> : null}
    <p className="note">Saved through <code>{spec.fn}</code>, which re-checks what you are allowed
      to change and records who changed it. Table: <span className="mono">{spec.table}</span>.</p>
  </>);
}

/* Which destinations a sub-category is offered for. */
function Destinations({row, config, save, onClose, onSaved}) {
  const current = (config.subcategory_countries ?? [])
    .filter(x => x.subcategory_id === row.id).map(x => x.country_id);
  const [picked, setPicked] = useState(() => {
    const m = {}; current.forEach(id => { m[id] = true; }); return m;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const countries = (config.countries ?? []).filter(c => c.is_active && c.is_destination !== false);
  const ids = Object.keys(picked).filter(k => picked[k]);

  async function submit() {
    setBusy(true); setErr(null);
    try { await save('fn_cc_subcategory_countries', {p_subcategory: row.id, p_country_ids: ids}); onSaved(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  return (<Drawer title="Where this is offered" sub={row.name} onClose={onClose}
    footer={<>{err ? <p className="drawer-err">{err}</p> : <span className="spacer"/>}
      <button className="tbtn" onClick={onClose} disabled={busy}>Cancel</button>
      <button className="tbtn pri" onClick={submit} disabled={busy}>
        {busy ? 'Saving…' : 'Save destinations'}</button></>}>
    <p style={{marginTop: 0, fontSize: 13.5, color: 'var(--ink2)'}}>
      Tick the destinations that offer <b>{row.name}</b>. Tick none and it is offered for every
      destination, which is what the enquiry form assumes today.</p>
    <div className="form" style={{gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))'}}>
      {countries.map(c => (
        <label key={c.id} style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5,
          color: 'var(--ink2)', cursor: 'pointer'}}>
          <input type="checkbox" style={{width: 15, height: 15}} checked={!!picked[c.id]}
            onChange={e => setPicked(p => ({...p, [c.id]: e.target.checked}))}/>
          {c.name}</label>))}
    </div>
    <p className="note">{ids.length ? ids.length + ' destination(s) selected' : 'Offered everywhere'}</p>
  </Drawer>);
}

/* What a route asks the client for. This is the same library document, so the
   count here is the count the client sees, and publishing needs at least one. */
function RouteDocs({row, config, save, onClose, onSaved}) {
  const current = ((config.route_documents ?? []).find(rd => rd.programme_id === row.id) || {}).document_ids ?? [];
  const [picked, setPicked] = useState(() => {
    const m = {}; current.forEach(id => { m[id] = true; }); return m;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // only documents for this route's destination
  const docs = (config.checklist_documents ?? [])
    .filter(d => d.is_active && d.country_id === row.country_id);
  const cats = (config.document_categories ?? [])
    .filter(c => c.is_active && (c.country_id === row.country_id || c.country_id == null));
  const ids = Object.keys(picked).filter(k => picked[k]);
  const countryName = nameOf(config.countries, row.country_id);

  async function submit() {
    setBusy(true); setErr(null);
    try { await save('fn_cc_route_documents', {p_programme: row.id, p_document_ids: ids}); onSaved(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  return (<Drawer title="What this route asks for" sub={row.name + ' · ' + (countryName ?? '')}
    onClose={onClose}
    footer={<>{err ? <p className="drawer-err">{err}</p>
      : <span className="spacer"/>}
      <button className="tbtn" onClick={onClose} disabled={busy}>Cancel</button>
      <button className="tbtn pri" onClick={submit} disabled={busy}>
        {busy ? 'Saving…' : 'Save ' + ids.length + ' document' + (ids.length === 1 ? '' : 's')}</button></>}>

    <p style={{marginTop: 0, fontSize: 13.8, color: 'var(--ink2)'}}>
      Tick what a client on <b>{row.name}</b> must provide. Each one becomes a request on their file
      with its own due date and chase schedule. A route with nothing ticked cannot be published —
      a file opened on it would ask the client for nothing.</p>

    {!docs.length
      ? <div className="empty" style={{marginTop: 16, textAlign: 'left', padding: 18}}>
          No documents exist for {countryName ?? 'this destination'} yet. Add them under
          <b> Documents</b>, filed into a category, then come back.
        </div>
      : cats.map(c => {
          const inCat = docs.filter(d => d.doc_category_id === c.id);
          if (!inCat.length) return null;
          return (<div key={c.id} style={{marginTop: 16}}>
            <div className="ccgrp" style={{padding: '0 0 6px'}}>{c.name}</div>
            <div style={{display: 'grid', gap: 5}}>
              {inCat.map(d => (
                <label key={d.id} style={{display: 'flex', alignItems: 'center', gap: 9,
                  fontSize: 13.5, color: 'var(--ink2)', cursor: 'pointer',
                  background: 'var(--panel2)', border: '1px solid var(--line)',
                  borderRadius: 8, padding: '7px 11px'}}>
                  <input type="checkbox" style={{width: 15, height: 15}} checked={!!picked[d.id]}
                    onChange={e => setPicked(x => ({...x, [d.id]: e.target.checked}))}/>
                  {d.name}</label>))}
            </div>
          </div>);
        })}

    {docs.filter(d => !cats.some(c => c.id === d.doc_category_id)).length
      ? <div style={{marginTop: 16}}>
          <div className="ccgrp" style={{padding: '0 0 6px'}}>Not yet filed</div>
          <div style={{display: 'grid', gap: 5}}>
            {docs.filter(d => !cats.some(c => c.id === d.doc_category_id)).map(d => (
              <label key={d.id} style={{display: 'flex', alignItems: 'center', gap: 9,
                fontSize: 13.5, color: 'var(--ink2)', cursor: 'pointer',
                background: 'var(--panel2)', border: '1px solid var(--line)',
                borderRadius: 8, padding: '7px 11px'}}>
                <input type="checkbox" style={{width: 15, height: 15}} checked={!!picked[d.id]}
                  onChange={e => setPicked(x => ({...x, [d.id]: e.target.checked}))}/>
                {d.name}</label>))}
          </div>
        </div>
      : null}

    <p className="note">Taking a document off a route deactivates its requirement rather than
      deleting it, so anything already requested on a live file stays intact.</p>
  </Drawer>);
}

/* ---- team, roles and tab access ---------------------------------- */

function People({config, save, afterSave, say, panel, setPanel}) {
  const can = config.can ?? {};
  const [invited, setInvited] = useState(null);
  const roleName = id => (config.roles ?? []).find(r => r.id === id)?.name ?? '—';

  return (<>
    <div className="card-h" style={{border: 0, padding: '0 0 12px'}}>
      <h2 style={{fontSize: 16}}>Team, roles and tabs</h2><span className="spacer"/>
      {can.edit_roles ? <button className="tbtn" onClick={() => setPanel('tabs')}>Tabs by role</button> : null}
      {can.invite_staff ? <button className="tbtn pri" onClick={() => setPanel('invite')}>Invite someone</button> : null}
    </div>

    {(config.invitations ?? []).length
      ? <div className="advice" style={{marginBottom: 12}}>
          <div className="lbl">Waiting to be accepted</div>
          <p>{config.invitations.map(i => i.full_name + ' (' + i.email + ')').join(', ')} — they join the
            moment they sign in with that address.</p></div>
      : null}

    <div className="card"><div className="scrollx"><table className="tbl">
      <thead><tr><th>Name</th><th>Email</th><th>Job title</th><th>Roles</th><th>Active</th></tr></thead>
      <tbody>{(config.members ?? []).map(m => <tr key={m.id}>
        <td className="k">{m.full_name}</td>
        <td className="mono" style={{fontSize: 12}}>{m.email}</td>
        <td>{m.job_title ?? <span style={{color: 'var(--ink3)'}}>—</span>}</td>
        <td>{(m.role_ids ?? []).length
          ? m.role_ids.map(id => <span key={id} className="tag t-acc" style={{marginRight: 4}}>{roleName(id)}</span>)
          : <span style={{color: 'var(--ink3)'}}>none — they can sign in and see nothing</span>}</td>
        <td><Cell v={m.is_active}/></td>
      </tr>)}</tbody>
    </table></div></div>

    <div className="card-h" style={{border: 0, padding: '18px 0 12px'}}>
      <h2 style={{fontSize: 16}}>Roles</h2></div>

    <div className="card"><div className="scrollx"><table className="tbl">
      <thead><tr><th>Role</th><th>Key</th><th>People</th><th>Permissions</th></tr></thead>
      <tbody>{(config.roles ?? []).map(r => {
        const people = (config.members ?? []).filter(m => (m.role_ids ?? []).includes(r.id));
        const perms = (config.role_permissions ?? []).filter(rp => rp.role_id === r.id).length;
        return (<tr key={r.id}>
          <td className="k">{r.name}</td>
          <td className="mono" style={{fontSize: 12}}>{r.key}</td>
          <td>{people.length ? people.map(p => p.full_name).join(', ') : <span style={{color: 'var(--ink3)'}}>nobody</span>}</td>
          <td className="mono">{perms}</td>
        </tr>);
      })}</tbody>
    </table></div></div>

    {panel === 'invite'
      ? <Invite config={config} save={save} onClose={() => setPanel(null)}
          onDone={(res) => { setInvited(res); setPanel(null); afterSave('The invitation'); }}/>
      : null}

    {panel === 'tabs'
      ? <Tabs config={config} save={save} onClose={() => setPanel(null)}
          onDone={() => afterSave('Tab access')} say={say}/>
      : null}

    {invited
      ? <Drawer title="Invitation created" sub={invited.email} onClose={() => setInvited(null)}
          footer={<><span className="spacer"/>
            <button className="tbtn pri" onClick={() => setInvited(null)}>Done</button></>}>
          <p style={{fontSize: 13.5, color: 'var(--ink2)', marginTop: 0}}>
            Email is not connected yet, so send them this link yourself. It expires
            on {new Date(invited.expires_at).toLocaleDateString()} and only works for {invited.email}.</p>
          <div className="fld"><label>Invitation link</label>
            <input readOnly value={typeof window !== 'undefined'
              ? window.location.origin + '/invite/' + invited.token : invited.token}
              onFocus={e => e.target.select()}/>
            <div className="hint">Click the box to select it, then copy.</div></div>
        </Drawer>
      : null}
  </>);
}

function Invite({config, save, onClose, onDone}) {
  const spec = {
    singular: 'person', fn: 'fn_cc_invite_member', hasId: false,
    addHint: 'They sign in with this email address.',
    note: 'A role is required. Someone invited without one can sign in and see an empty console.',
    fields: [
      {k: 'full_name', label: 'Full name', required: true},
      {k: 'email', label: 'Email', type: 'email', required: true},
      {k: 'role', label: 'Role', required: true, opts: {from: 'roles', where: r => r.is_active}},
      {k: 'job_title', label: 'Job title'},
      {k: 'employee_code', label: 'Employee code'},
      {k: 'branch', label: 'Branch', opts: {from: 'branches'}},
      {k: 'team', label: 'Team', opts: {from: 'teams'}},
      {k: 'manager', label: 'Reports to', opts: {from: 'members', label: m => m.full_name}},
      {k: 'note', label: 'Note', type: 'area', wide: true},
    ],
  };
  return <RecordForm spec={spec} row={null} config={config} onClose={onClose}
    save={async (fn, params) => { const r = await save(fn, params); onDone(r); return r; }}
    onSaved={() => {}}/>;
}

function Tabs({config, save, onClose, onDone, say}) {
  const [busy, setBusy] = useState(null);
  const modules = config.modules ?? [];
  const roles = (config.roles ?? []).filter(r => r.is_active);
  const permOf = m => (config.permissions ?? []).find(p =>
    p.resource === m.required_resource && p.action === m.required_action);
  const has = (roleId, permId) => (config.role_permissions ?? [])
    .some(rp => rp.role_id === roleId && rp.permission_id === permId);

  async function grant(role, mod) {
    const p = permOf(mod);
    if (!p) { say('Not possible', 'No permission exists for ' + mod.label + '.'); return; }
    setBusy(role.id + mod.key);
    try {
      await save('fn_cc_set_role_permission',
        {p_role: role.id, p_permission: p.id, p_scope: 'organisation', p_reason: 'Tab access from Control Centre'});
      onDone();
    } catch (e) { say('Not changed', e.message); }
    setBusy(null);
  }

  return (<Drawer title="Which tabs each role sees" onClose={onClose}
    sub="A tab appears when the role holds the permission behind it."
    footer={<><span className="spacer"/><button className="tbtn pri" onClick={onClose}>Done</button></>}>
    <div className="scrollx"><table className="tbl">
      <thead><tr><th>Tab</th>{roles.map(r => <th key={r.id}>{r.name}</th>)}</tr></thead>
      <tbody>{modules.map(m => {
        const p = permOf(m);
        return (<tr key={m.key}>
          <td className="k">{m.label}<div className="mono" style={{fontSize: 10.5, color: 'var(--ink3)'}}>
            {m.required_resource}:{m.required_action}</div></td>
          {roles.map(r => <td key={r.id}>
            {p && has(r.id, p.id)
              ? <span className="tag t-ok">YES</span>
              : <button className="mini" disabled={busy === r.id + m.key}
                  onClick={() => grant(r, m)}>Grant</button>}
          </td>)}
        </tr>);
      })}</tbody>
    </table></div>
    <p className="note">Removing a tab is a permission change with consequences elsewhere, so it is
      done from the role itself rather than here.</p>
  </Drawer>);
}
