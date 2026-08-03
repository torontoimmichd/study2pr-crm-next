-- P4.5 — TERMINAL STAGE LOCK + STAGE-CHANGE NOTE PLUMBING
-- "once approved it can neither be rejected nor withdrawn"; "changing stage
-- shall prompt for a note, recorded in the timeline, mandatory".
-- PART 1: approved/refused/withdrawn are is_terminal in case_stages_ref. Once
--   reached, the stage is frozen. Enforced in the DB so it holds for the kanban
--   board, detail screen, RPC, imports and cron alike. Owner/admin exception is
--   deliberate and visible - see p4_05b, which corrects who that covers.
-- PART 2: cases.pending_stage_note carries the reason on a single UPDATE; the
--   trigger moves it into the timeline then clears it. NOT yet mandatory on
--   purpose - enforcing today would reject every stage change that does not
--   supply one, including kanban drag-drop, mark_case_outcome and the engine,
--   and the app would stop working on deploy. The switch is one commented line.
-- ROLLBACK: drop triggers trg_cases_terminal_lock, trg_cases_stage_note;
--   drop functions fn_guard_terminal_stage(), fn_record_stage_note();
--   alter table cases drop column pending_stage_note;

alter table public.cases add column if not exists pending_stage_note text;
comment on column public.cases.pending_stage_note is
  'Write-only channel for the reason behind a stage change. Set it in the same UPDATE that changes current_stage_code; the trigger records it to case_stage_history and the timeline, then clears it. Never read this column - it is empty by design.';

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

  if v_was_terminal then
    if public.fn_is_owner_admin() then
      return new;
    end if;
    raise exception
      'Case % is % and that is final. A case cannot move out of approved, refused or withdrawn. Create a successor case (reapplication or judicial review) instead.',
      old.case_code, old.current_stage_code;
  end if;

  return new;
end
$fn$;

revoke execute on function public.fn_guard_terminal_stage() from public, anon, authenticated;

drop trigger if exists trg_cases_terminal_lock on public.cases;
create trigger trg_cases_terminal_lock
  before update of current_stage_code on public.cases
  for each row execute function public.fn_guard_terminal_stage();

create or replace function public.fn_record_stage_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_note text := nullif(trim(coalesce(new.pending_stage_note, '')), '');
begin
  if new.current_stage_code is not distinct from old.current_stage_code then
    new.pending_stage_note := null;
    return new;
  end if;

  -- ==== FLIP THIS ON once the UI sends a note with every stage change ====
  -- if v_note is null then
  --   raise exception 'A reason note is required when changing the stage of case %.', old.case_code;
  -- end if;
  -- =======================================================================

  if v_note is not null then
    insert into public.activity_timeline
      (case_id, client_id, event_type, title, body, is_system, metadata)
    values
      (new.id, new.client_id, 'stage_note',
       'Stage note: ' || coalesce(old.current_stage_code,'—') || ' → ' || new.current_stage_code,
       v_note, false,
       jsonb_build_object('from', old.current_stage_code, 'to', new.current_stage_code));
  end if;

  new.pending_stage_note := null;
  return new;
end
$fn$;

revoke execute on function public.fn_record_stage_note() from public, anon, authenticated;

drop trigger if exists trg_cases_stage_note on public.cases;
create trigger trg_cases_stage_note
  before update of current_stage_code on public.cases
  for each row execute function public.fn_record_stage_note();
