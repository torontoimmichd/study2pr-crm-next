-- Stop the new-enquiry call sequence when a lead advances to another stage.
-- The stage-change trigger already calls this function; replacing it here keeps
-- the original migration immutable while closing the remaining reminder path.

create or replace function public.fn_engine_on_lead_stage_sla_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.lifecycle_state is distinct from new.lifecycle_state then
    update public.tasks
    set status = 'dismissed',
        completed_at = coalesce(completed_at, now()),
        closed_note = format('Closed automatically when lead moved from %s to %s.', old.lifecycle_state, new.lifecycle_state),
        updated_at = now()
    where lead_id = new.id
      and status in ('pending', 'in_progress')
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
