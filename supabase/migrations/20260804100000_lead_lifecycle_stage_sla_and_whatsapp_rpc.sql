-- ============================================================================
-- Lead lifecycle SSOT
--
-- The lead stage is the lifecycle state. Tasks are generated here, once, when
-- the state changes. The browser must not create stage tasks because imports,
-- RPCs and other clients would otherwise follow a different workflow.
--
-- Stage SLA policy:
--   New Enquiry  -> Contacted       3 days
--   Contacted    -> Assessed        5 days
--   Assessed     -> Proposal Sent   3 days
--   Proposal Sent-> Negotiating/decision 5 days
--   Negotiating  -> decision        7 days
-- Waiting and Nurturing are deliberate holding states. They use their own
-- review dates/cadence and do not receive an artificial 3-day escalation.
-- ============================================================================

insert into public.sla_rules
  (code, label, applies_to, target_minutes, office_hours_only, escalate_to_role, is_active, reminder_minutes)
values
  ('LEAD_NEW_TO_CONTACTED_3D', 'New enquiry not contacted in 3 days', 'lead', 4320, false, 'admin', true, 1440),
  ('LEAD_CONTACTED_TO_ASSESSMENT_5D', 'Contacted lead not assessed in 5 days', 'lead', 7200, false, 'admin', true, 1440),
  ('LEAD_ASSESSED_TO_PROPOSAL_3D', 'Assessed lead has no proposal in 3 days', 'lead', 4320, false, 'admin', true, 1440),
  ('LEAD_PROPOSAL_DECISION_5D', 'Proposal has no decision in 5 days', 'lead', 7200, false, 'admin', true, 1440),
  ('LEAD_NEGOTIATION_DECISION_7D', 'Negotiation has no decision in 7 days', 'lead', 10080, false, 'admin', true, 1440)
on conflict (code) do update set
  label = excluded.label,
  applies_to = excluded.applies_to,
  target_minutes = excluded.target_minutes,
  office_hours_only = excluded.office_hours_only,
  escalate_to_role = excluded.escalate_to_role,
  is_active = excluded.is_active,
  reminder_minutes = excluded.reminder_minutes;

create or replace function public.fn_engine_on_lead_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_assignee uuid;
  v_title text;
  v_description text;
  v_due timestamptz;
  v_sla text;
  v_key text;
begin
  if new.lifecycle_state is not distinct from old.lifecycle_state then
    return new;
  end if;

  -- A normal stage change closes the old stage's reminder and any escalation
  -- attached to it. The task remains in history as dismissed, not deleted.
  update public.tasks
     set status_code = 'dismissed',
         completed_at = coalesce(completed_at, now()),
         closed_note = 'Stage advanced from ' || coalesce(old.lifecycle_state, 'unknown') ||
                       ' to ' || coalesce(new.lifecycle_state, 'unknown')
   where lead_id = new.id
     and task_key like 'lead_stage_sla_%'
     and status_code not in ('done', 'completed', 'cancelled', 'dismissed');

  -- The new enquiry communication sequence is only relevant while the lead is
  -- still new. Once a person is contacted, queued new-enquiry messages stop.
  if new.lifecycle_state <> 'new_enquiry' then
    update public.outbound_messages
       set status = 'cancelled',
           error_message = 'Lead advanced to ' || new.lifecycle_state || '; new-enquiry sequence stopped.'
     where related_lead_id = new.id
       and status = 'queued'
       and (template_code = 'LEAD_ACK_D0' or template_code like 'LEAD_FU_%');
  end if;

  v_assignee := coalesce(new.assigned_to, public.fn_engine_owner());

  case new.lifecycle_state
    when 'new_enquiry' then
      v_title := 'Move lead to Contacted';
      v_description := 'Make and record the first meaningful contact, or document why contact has not happened.';
      v_due := now() + interval '3 days';
      v_sla := 'LEAD_NEW_TO_CONTACTED_3D';
      v_key := 'lead_stage_sla_new_enquiry';
    when 'contacted' then
      v_title := 'Complete assessment';
      v_description := 'Send or complete the assessment and record the next step. Manager review is created if this remains unadvanced.';
      v_due := now() + interval '5 days';
      v_sla := 'LEAD_CONTACTED_TO_ASSESSMENT_5D';
      v_key := 'lead_stage_sla_contacted';
    when 'assessed' then
      v_title := 'Prepare and send proposal';
      v_description := 'Review eligibility, pathway, fees, and next action, then move the lead to Proposal Sent.';
      v_due := now() + interval '3 days';
      v_sla := 'LEAD_ASSESSED_TO_PROPOSAL_3D';
      v_key := 'lead_stage_sla_assessed';
    when 'proposal_sent' then
      v_title := 'Follow up proposal decision';
      v_description := 'Confirm the lead has reviewed the proposal, answer questions, and record the decision or objection.';
      v_due := now() + interval '5 days';
      v_sla := 'LEAD_PROPOSAL_DECISION_5D';
      v_key := 'lead_stage_sla_proposal_sent';
    when 'negotiating' then
      v_title := 'Resolve negotiation and record decision';
      v_description := 'Record the objection, agreed response, and next decision. Escalate for senior help when needed.';
      v_due := now() + interval '7 days';
      v_sla := 'LEAD_NEGOTIATION_DECISION_7D';
      v_key := 'lead_stage_sla_negotiating';
    when 'waiting' then
      v_title := 'Review waiting plan';
      v_description := 'Confirm the reason, expected date, contact frequency, and next milestone for this waiting lead.';
      v_due := coalesce(new.waiting_end_date::timestamptz, now() + interval '30 days');
      v_sla := null;
      v_key := 'lead_stage_sla_waiting';
    when 'nurturing' then
      v_title := 'Nurture review';
      v_description := 'Review the lead profile and send the next useful immigration update or check-in.';
      v_due := now() + interval '30 days';
      v_sla := null;
      v_key := 'lead_stage_sla_nurturing';
    else
      return new;
  end case;

  insert into public.tasks
    (lead_id, title, description, status_code, priority, assigned_to, created_by,
     due_at, sla_rule_code, source, kind, task_key)
  values
    (new.id, v_title, v_description, 'open',
     case when v_sla is not null then 'high' else 'low' end,
     v_assignee, public.fn_engine_owner(), v_due, v_sla, 'engine',
     case when v_sla is not null then 'follow_up' else 'other' end, v_key);

  return new;
end
$fn$;

revoke execute on function public.fn_engine_on_lead_stage_change() from public, anon, authenticated;

drop trigger if exists trg_engine_lead_stage_change on public.leads;
create trigger trg_engine_lead_stage_change
after update of lifecycle_state on public.leads
for each row execute function public.fn_engine_on_lead_stage_change();

-- Lead task creation is owned by the database (sql/53 + sql/54). Do not re-add here.

-- A staff-only RPC opens the in-app WhatsApp composer. It does not launch wa.me
-- and it does not expose a client-side INSERT policy on conversations.
create or replace function public.open_lead_whatsapp_conversation(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_phone text;
begin
  if not public.fn_is_staff() then
    raise exception 'Staff access required';
  end if;

  select phone into v_phone from public.leads where id = p_lead_id;
  if not found then raise exception 'Lead not found'; end if;
  if nullif(trim(v_phone), '') is null then raise exception 'Lead has no phone number'; end if;

  select id into v_id
  from public.conversations
  where lead_id = p_lead_id and channel = 'whatsapp'
  order by updated_at desc
  limit 1;

  if v_id is null then
    insert into public.conversations
      (org_id, channel, lead_id, assigned_to, status)
    values
      (public.default_org_id(), 'whatsapp', p_lead_id, auth.uid(), 'open')
    returning id into v_id;
  else
    update public.conversations
       set assigned_to = coalesce(assigned_to, auth.uid()),
           status = case when status = 'closed' then 'open' else status end,
           updated_at = now()
     where id = v_id;
  end if;

  return v_id;
end
$fn$;

revoke all on function public.open_lead_whatsapp_conversation(uuid) from public, anon;
grant execute on function public.open_lead_whatsapp_conversation(uuid) to authenticated, service_role;
