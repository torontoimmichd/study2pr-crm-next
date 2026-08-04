-- The SLA sweep was inserting synthetic trigger_codes like `SLA_ESC:<task_id>`
-- into trigger_events.trigger_code, but that column references upsell_triggers.
-- That made the cron fail every 15 minutes. SLA escalations are task events, not
-- upsell trigger events, so de-dupe by the generated SLA task instead.

create or replace function public.fn_engine_sla_sweep()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t record;
  v_n int := 0;
begin
  for v_t in
    select t.id, t.title, t.case_id, t.lead_id, r.escalate_to_role, r.label as sla_label
    from public.tasks t
    join public.sla_rules r on r.code = t.sla_rule_code and r.is_active
    where t.status_code in ('open','in_progress')
      and coalesce(t.due_at, t.due_date::timestamptz) < now()
      and not exists (
        select 1
        from public.tasks existing
        where existing.source = 'sla'
          and existing.status_code in ('open','in_progress')
          and existing.case_id is not distinct from t.case_id
          and existing.lead_id is not distinct from t.lead_id
          and existing.title = '[SLA OVERDUE] ' || t.title
      )
  loop
    insert into public.tasks (case_id, lead_id, title, description, status_code, priority,
                              assigned_to, created_by, due_at, source)
    values (v_t.case_id, v_t.lead_id,
            '[SLA OVERDUE] ' || v_t.title,
            'SLA "' || coalesce(v_t.sla_label,'') || '" missed. Original task still open - action or reassign.',
            'open','normal',
            public.fn_engine_staff_for_role(coalesce(v_t.escalate_to_role,'owner')),
            public.fn_engine_owner(), now() + interval '4 hours', 'sla');
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

alter function public.fn_engine_sla_sweep() owner to postgres;
revoke execute on function public.fn_engine_sla_sweep() from public, anon, authenticated;
grant execute on function public.fn_engine_sla_sweep() to service_role;
