-- ============================================================================
-- P4.6 - DATABASE-OWNED LEAD FOLLOW-UPS + PARTNER RLS REPAIR
-- ============================================================================
-- The browser used to create lead follow-up tasks after insert while the DB
-- trigger created the first-call SLA and outbound messages. That is two writers
-- for one workflow: imports/API inserts missed the browser tasks, and wording
-- changes made duplicates impossible to deduplicate reliably.
--
-- This migration queues WhatsApp follow-ups only. Lead tasks are owned by
-- the later database ladder and single-task migrations.
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
begin
  -- Lead task creation is owned by the database (sql/53 + sql/54). Do not re-add here.

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
