-- The previous cleanup trigger used tasks.status, but the canonical task
-- state column in this schema is tasks.status_code. A stage update invokes
-- this trigger, so the wrong column made every lead status change fail.
create or replace function public.fn_engine_on_lead_stage_sla_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.lifecycle_state is distinct from new.lifecycle_state then
    update public.tasks
    set status_code = 'dismissed',
        completed_at = coalesce(completed_at, now()),
        closed_note = format('Closed automatically when lead moved from %s to %s.', old.lifecycle_state, new.lifecycle_state),
        updated_at = now()
    where lead_id = new.id
      and status_code in ('pending', 'in_progress', 'open')
      and (
        source = 'sla'
        or task_key in ('lead_first_call', 'lead_followup_call_d3', 'lead_followup_call_d7', 'lead_followup_call_d14')
      );
  end if;
  return new;
end;
$$;

revoke all on function public.fn_engine_on_lead_stage_sla_cleanup() from public;
grant execute on function public.fn_engine_on_lead_stage_sla_cleanup() to service_role;
