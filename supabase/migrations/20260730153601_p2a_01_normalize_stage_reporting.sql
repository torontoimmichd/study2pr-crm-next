-- ============================================================================
-- PHASE 2A · NORMALISE STAGE REPORTING
-- ============================================================================
-- PROBLEM (verified): case stage changes exist in activity_timeline under TWO
--   event_type values, because two writers coexisted until Phase 1:
--     'stage_change'      - written by trigger fn_engine_on_stage_change()
--                           (7 case-scoped rows, and ALSO 7 lead-scoped rows,
--                           which are a legitimately DIFFERENT business event)
--     'case_stage_change' - written by the client CaseDetail.moveStage()
--                           (10 rows, all case-scoped, ceased 2026-07-29)
--   Any report filtering one value silently loses the other. Naively merging
--   them would be WRONG, because 'stage_change' also serves LEAD lifecycle
--   changes, which must not be counted as case stage movements.
--
-- SOLUTION: an additive read-only view that normalises the vocabulary while
--   preserving scope and traceability. No data is rewritten. No writer changes.
--
-- security_invoker = true: the view respects the QUERYING user's RLS rather
--   than the view owner's. This deliberately avoids creating a 9th
--   SECURITY DEFINER view (the certification flagged 8 existing ones as an
--   RLS-bypass risk).
--
-- ROLLBACK: drop view public.v_stage_events;
-- ============================================================================

create or replace view public.v_stage_events
with (security_invoker = true) as
select
  t.id,
  t.occurred_at,
  -- scope is derived, never guessed: a case-scoped row is a CASE stage move,
  -- a lead-scoped row is a LEAD lifecycle move. They are different events.
  case when t.case_id is not null then 'case' else 'lead' end        as scope,
  t.lead_id,
  t.case_id,
  t.client_id,
  'stage_change'::text                                              as event_type,
  t.event_type                                                      as source_event_type,
  t.title,
  nullif(t.metadata ->> 'from', '')                                 as from_stage,
  nullif(t.metadata ->> 'to',   '')                                 as to_stage,
  t.actor_id,
  t.is_system
from public.activity_timeline t
where t.event_type in ('stage_change', 'case_stage_change');

comment on view public.v_stage_events is
  'Phase 2A: single normalised source for stage-change reporting. Unifies the '
  'legacy client vocabulary (case_stage_change) with the trigger vocabulary '
  '(stage_change) while preserving scope (case vs lead) and the original value '
  'in source_event_type. Query THIS, not activity_timeline, for stage analytics.';

grant select on public.v_stage_events to authenticated;
