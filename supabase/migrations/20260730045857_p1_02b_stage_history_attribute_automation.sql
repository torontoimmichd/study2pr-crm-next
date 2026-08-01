-- ============================================================================
-- PHASE 1 · ITEM 2b — ATTRIBUTE AUTOMATION IN STAGE HISTORY
-- ============================================================================
-- WHY: verification showed that log_stage_change() correctly captures
--   auth.uid() for user-initiated changes, but writes NULL when there is no
--   JWT — which is exactly the context of pg_cron jobs (engine_sla_sweep,
--   engine_expiry_sweep, engine_festival_sweep, engine_outbox_sweep),
--   service_role edge functions, and any background automation.
--
--   Empirically verified on 2026-07-30:
--     with JWT    -> 1 history row, 1 timeline row, changed_by = <staff uuid>
--     without JWT -> 1 history row, 1 timeline row, changed_by = NULL
--
--   NULL was also the pre-existing behaviour, so this is not a regression —
--   but "no actor" and "automation" were indistinguishable, which undermines
--   the audit trail Phase 1 exists to restore.
--
-- FIX: stamp note='system' only when there is no authenticated actor. User
--   actions keep note = NULL exactly as before. No second writer is introduced.
--   Nothing in the codebase reads case_stage_history.note (verified: zero
--   references outside the removed write sites), so this is display-neutral.
--
-- ROLLBACK: replace the note expression with a literal null.
-- ============================================================================

create or replace function public.log_stage_change()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_actor uuid := auth.uid();
begin
  if old.current_stage_code is distinct from new.current_stage_code then
    insert into public.case_stage_history
      (case_id, from_stage_code, to_stage_code, changed_by, note)
    values
      (new.id,
       old.current_stage_code,
       new.current_stage_code,
       v_actor,
       case when v_actor is null then 'system' else null end);

    new.stage_entered_at := now();
  end if;
  return new;
end
$fn$;
