-- ============================================================================
-- PHASE 1 · ITEM 2 — STAGE HISTORY: SINGLE WRITER
-- ============================================================================
-- ROOT CAUSE (verified): every case stage transition produced TWO rows in
--   public.case_stage_history — one from trigger trg_cases_stage/log_stage_change()
--   (note='auto-logged', changed_by=NULL) and one from a client-side .insert().
--   Live proof before this change: 36 rows = 18 'auto-logged' + 18 client,
--   changed_by IS NULL on exactly 18.
--
-- FIX (DB half): the trigger becomes the single writer and now captures the
--   acting user via auth.uid(), which the client row previously supplied.
--   The client-side inserts are removed in the accompanying code pack
--   (views/CaseDetail.tsx moveStage, views/Cases.tsx drag-drop).
--
-- BEHAVIOUR PRESERVED: one history row per transition, with actor attribution.
--   The trigger runs in the INVOKER's security context exactly as before
--   (deliberately NOT changed to SECURITY DEFINER), so RLS behaviour is
--   unchanged. search_path is pinned and the target is schema-qualified.
--
-- KNOWN FIDELITY NOTE: views/Cases.tsx previously stamped note='drag-drop' on
--   kanban moves. A trigger cannot observe the UI origin, so that cosmetic
--   label is no longer written. No code reads it (verified: zero references to
--   'auto-logged' or 'drag-drop' outside the write sites). If provenance is
--   wanted, Phase 2 should add a proper `source` column rather than reinstate
--   a second writer.
--
-- ROLLBACK: restore the prior body (changed_by omitted, note='auto-logged')
--   and re-add the two client inserts.
-- ============================================================================

create or replace function public.log_stage_change()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if old.current_stage_code is distinct from new.current_stage_code then
    insert into public.case_stage_history
      (case_id, from_stage_code, to_stage_code, changed_by, note)
    values
      (new.id, old.current_stage_code, new.current_stage_code, auth.uid(), null);

    new.stage_entered_at := now();
  end if;
  return new;
end
$fn$;
