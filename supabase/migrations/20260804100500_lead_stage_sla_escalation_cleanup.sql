-- Close a manager SLA escalation when the lead advances to a new stage.
-- The original stage task is handled by the main lifecycle trigger; this small
-- trigger also closes the derived manager task, keeping the stage transition
-- atomic without rewriting the already-applied migration.

create or replace function public.fn_engine_on_lead_stage_sla_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.lifecycle_state is distinct from old.lifecycle_state then
    update public.tasks
       set status_code = 'dismissed',
           completed_at = coalesce(completed_at, now()),
           closed_note = 'Stage advanced from ' || coalesce(old.lifecycle_state, 'unknown') ||
                         ' to ' || coalesce(new.lifecycle_state, 'unknown')
     where lead_id = new.id
       and source = 'sla'
       and status_code not in ('done', 'completed', 'cancelled', 'dismissed');
  end if;
  return new;
end
$fn$;

revoke execute on function public.fn_engine_on_lead_stage_sla_cleanup() from public, anon, authenticated;

drop trigger if exists trg_engine_lead_stage_sla_cleanup on public.leads;
create trigger trg_engine_lead_stage_sla_cleanup
after update of lifecycle_state on public.leads
for each row execute function public.fn_engine_on_lead_stage_sla_cleanup();
