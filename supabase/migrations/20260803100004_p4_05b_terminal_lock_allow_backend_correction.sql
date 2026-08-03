-- P4.5b — TERMINAL LOCK: allow backend/admin correction (corrects p4_05)
-- FOUND BY TESTING, not by reading: the guard blocked my own cleanup.
-- fn_is_owner_admin() resolves the caller from the JWT. In a backend context -
-- SQL editor, service_role edge function, psql, a migration - there is no JWT,
-- so auth.uid() is null and it returns FALSE. The owner/admin exception did not
-- apply to the very contexts where a correction actually gets made, so a
-- mis-clicked "Refused" would have been unfixable by anyone through any tool.
-- In the app the guard behaved correctly; the gap was backend-only.
-- The postgres/service_role branch is not a hole: reaching it already requires
-- privileged access that bypasses RLS. anon holds a JWT and has no UPDATE
-- policy on cases. Ordinary staff remain blocked, which is the requirement.
-- ROLLBACK: restore the p4_05 body of fn_guard_terminal_stage().

create or replace function public.fn_guard_terminal_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_was_terminal boolean;
begin
  if new.current_stage_code is not distinct from old.current_stage_code then
    return new;
  end if;

  select coalesce(is_terminal, false) into v_was_terminal
  from public.case_stages_ref where code = old.current_stage_code;

  if not v_was_terminal then
    return new;
  end if;

  if public.fn_is_owner_admin() then
    return new;
  end if;

  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  raise exception
    'Case % is % and that is final. A case cannot move out of approved, refused or withdrawn. Create a successor case (reapplication or judicial review) instead.',
    old.case_code, old.current_stage_code;
end
$fn$;

revoke execute on function public.fn_guard_terminal_stage() from public, anon, authenticated;
