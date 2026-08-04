-- ============================================================================
-- P4.6 - DATABASE-OWNED LEAD FOLLOW-UPS + PARTNER RLS REPAIR
-- ============================================================================
-- The browser used to create lead follow-up tasks after insert while the DB
-- trigger created the first-call SLA and outbound messages. That is two writers
-- for one workflow: imports/API inserts missed the browser tasks, and wording
-- changes made duplicates impossible to deduplicate reliably.
--
-- This migration makes `fn_engine_on_lead_created` the only writer:
--   staff calls: day 3, 7, 14 at 10:00 Asia/Kolkata
--   WhatsApp template queue: day 2, 4, 6, 10
--   first contact: existing two-hour SLA remains unchanged
--
-- The message codes are intentionally not seeded here. The comms worker sends
-- only active, approved templates; creating copy in a schema migration could
-- send unapproved WhatsApp content. Add/approve templates with these exact
-- names in Admin > Templates before enabling live sends:
--   LEAD_FU_D2, LEAD_FU_D4, LEAD_FU_D6, LEAD_FU_D10
--
-- Also replaces agent_partners' `USING (true)` policy. Portal users authenticate
-- too, so that policy exposed partner data and allowed edits to every signed-in
-- user.
-- ============================================================================

create or replace function public.fn_engine_on_lead_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_assignee uuid;
begin
  v_assignee := coalesce(new.assigned_to, public.fn_engine_owner());

  insert into public.tasks (
    lead_id, title, description, status_code, priority, assigned_to, created_by,
    due_at, sla_rule_code, source, kind, task_key
  )
  values
    (
      new.id,
      'First call - new lead',
      'Call the new lead within 2 hours. Auto-created by the database workflow.',
      'open', 'normal', v_assignee, public.fn_engine_owner(),
      now() + interval '2 hours', 'NEW_LEAD_FIRST_CALL', 'engine', 'phone_call', 'lead_first_call'
    ),
    (
      new.id,
      'Day 3 follow-up call',
      'Third-day call. Answer questions and offer to schedule a consultation.',
      'open', 'normal', v_assignee, public.fn_engine_owner(),
      ((current_date + 3) + time '10:00') at time zone 'Asia/Kolkata', null, 'engine', 'phone_call', 'lead_followup_call_d3'
    ),
    (
      new.id,
      'Day 7 follow-up call',
      'Week-one call. Reconfirm interest and assess whether anything changed.',
      'open', 'normal', v_assignee, public.fn_engine_owner(),
      ((current_date + 7) + time '10:00') at time zone 'Asia/Kolkata', null, 'engine', 'phone_call', 'lead_followup_call_d7'
    ),
    (
      new.id,
      'Day 14 follow-up call',
      'Two-week call. Assess progress, nurturing, waiting, or cold status.',
      'open', 'low', v_assignee, public.fn_engine_owner(),
      ((current_date + 14) + time '10:00') at time zone 'Asia/Kolkata', null, 'engine', 'phone_call', 'lead_followup_call_d14'
    );

  perform public.fn_engine_queue_message('LEAD_FU_D2',  null, new.id, null, '{}'::jsonb, now() + interval '2 days');
  perform public.fn_engine_queue_message('LEAD_FU_D4',  null, new.id, null, '{}'::jsonb, now() + interval '4 days');
  perform public.fn_engine_queue_message('LEAD_FU_D6',  null, new.id, null, '{}'::jsonb, now() + interval '6 days');
  perform public.fn_engine_queue_message('LEAD_FU_D10', null, new.id, null, '{}'::jsonb, now() + interval '10 days');

  return new;
end
$fn$;

revoke execute on function public.fn_engine_on_lead_created() from public, anon, authenticated;

drop policy if exists staff_all_agent_partners on public.agent_partners;
drop policy if exists p_agent_partners_staff_read on public.agent_partners;
drop policy if exists p_agent_partners_owner_admin_write on public.agent_partners;

create policy p_agent_partners_staff_read on public.agent_partners
  for select to authenticated
  using (public.fn_is_staff());

create policy p_agent_partners_owner_admin_write on public.agent_partners
  for all to authenticated
  using (public.fn_is_owner_admin())
  with check (public.fn_is_owner_admin());
