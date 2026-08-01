-- ============================================================================
-- PHASE 1 · ITEM 1 — RESTORE AUDIT LOGGING
-- ============================================================================
-- ROOT CAUSE (verified 2026-07-30):
--   public.audit_log had exactly ONE policy: p_audit_staff_read (SELECT only).
--   No INSERT policy existed, so all 94 writeAudit() call sites in the app were
--   silently rejected by RLS (lib/audit.ts swallows errors to console.warn).
--   Compounding: range partitions covered only 2026-04/05/06, so any write from
--   2026-07-01 onward additionally had no target partition.
--   Net effect: audit_log = 0 rows since inception.
--
-- BEHAVIOUR CHANGE: none to business logic. This only permits writes that the
--   application already attempts on every mutation.
--
-- ROLLBACK:
--   drop policy p_audit_staff_insert on public.audit_log;
--   select cron.unschedule('audit_partition_maintenance');
--   drop function public.fn_audit_ensure_partitions(int);
--   (partitions may be left in place; they are empty and harmless)
-- ============================================================================

-- 1) Permit staff INSERT. Mirrors the family used by the existing read policy
--    (p_audit_staff_read uses is_staff()), so no new permission vocabulary.
drop policy if exists p_audit_staff_insert on public.audit_log;
create policy p_audit_staff_insert on public.audit_log
  for insert to authenticated
  with check (public.is_staff());

-- 2) Idempotent partition maintenance. Creates current month + N ahead.
--    Direct partition access is revoked: the app only ever addresses the parent,
--    and privileges for partitioned tables are checked on the parent only.
create or replace function public.fn_audit_ensure_partitions(p_months_ahead int default 6)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_start date;
  v_end   date;
  v_name  text;
  v_made  int := 0;
begin
  for i in 0..greatest(p_months_ahead, 0) loop
    v_start := (date_trunc('month', current_date) + (i || ' months')::interval)::date;
    v_end   := (v_start + interval '1 month')::date;
    v_name  := 'audit_log_' || to_char(v_start, 'YYYY_MM');

    if not exists (
      select 1 from pg_class
      where relname = v_name and relnamespace = 'public'::regnamespace
    ) then
      execute format(
        'create table public.%I partition of public.audit_log for values from (%L) to (%L)',
        v_name, v_start, v_end);
      execute format('revoke all on public.%I from anon, authenticated', v_name);
      v_made := v_made + 1;
    end if;
  end loop;
  return v_made;
end
$fn$;

-- 3) Harden the three pre-existing partitions identically. These currently have
--    RLS enabled with ZERO policies; revoking direct API access is strictly more
--    restrictive and removes the rls_enabled_no_policy advisories.
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_inherits i on i.inhrelid = c.oid
    where i.inhparent = 'public.audit_log'::regclass
  loop
    execute format('revoke all on public.%I from anon, authenticated', r.relname);
  end loop;
end $$;

-- 4) Safety net so an audit write can NEVER be lost again, even if maintenance
--    lapses. Kept empty in normal operation by the 6-month lookahead below.
create table if not exists public.audit_log_default partition of public.audit_log default;
revoke all on public.audit_log_default from anon, authenticated;

-- 5) Materialise current month + 6 months forward.
select public.fn_audit_ensure_partitions(6);

-- 6) Monthly cron so partitions never expire again.
select cron.unschedule('audit_partition_maintenance')
where exists (select 1 from cron.job where jobname = 'audit_partition_maintenance');

select cron.schedule(
  'audit_partition_maintenance',
  '0 0 1 * *',
  $$select public.fn_audit_ensure_partitions(6)$$
);
