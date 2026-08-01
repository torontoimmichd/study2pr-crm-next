-- ============================================================================
-- PHASE 3.2 · PIN search_path ON SECURITY DEFINER FUNCTIONS
-- ============================================================================
-- RISK BEING CLOSED: a SECURITY DEFINER function with a mutable search_path can
--   be hijacked - a caller who can create objects in an earlier schema on the
--   path can shadow a table/function name and have it execute with the
--   definer's (elevated) privileges.
--
-- SCOPING (this is why the change is small and safe):
--   165 functions in public had a mutable search_path, but:
--     122  are EXTENSION-OWNED (pg_trgm, unaccent, btree_gin, which live in
--          public in this project). Altering those would break search/indexing -
--          EXCLUDED via pg_depend deptype='e'.
--      23  are ours but SECURITY INVOKER - they run with the caller's own
--          rights, so there is no privilege to escalate. Deferred.
--      20  are ours AND SECURITY DEFINER  <-- the actual attack surface, fixed here.
--
-- WHY `= public` IS SAFE HERE (verified, not assumed):
--   All 20 were checked for references to other schemas
--   (auth.|cron.|net.|storage.|extensions.|vault.) - ALL 20 came back clean.
--   They reference only objects in public. pg_catalog is always searched
--   implicitly, so gen_random_uuid(), now() etc. still resolve.
--
-- ALTER FUNCTION ... SET is used rather than CREATE OR REPLACE, so the function
--   bodies are untouched. Zero behaviour change.
--
-- ROLLBACK: alter function public.<name>(<args>) reset search_path;
-- ============================================================================

alter function public.bulk_process_prospectives(jsonb)                      set search_path = public;
alter function public.consent_prospective_to_case(uuid, numeric, text)      set search_path = public;
alter function public.decline_prospective(uuid, text)                       set search_path = public;
alter function public.snooze_prospective(uuid, integer)                     set search_path = public;

alter function public.ensure_family_unit(uuid)                              set search_path = public;
alter function public.ensure_family_unit(uuid, text)                        set search_path = public;
alter function public.get_family_members(uuid)                              set search_path = public;

alter function public.fn_assessment_on_submit()                             set search_path = public;
alter function public.fn_assessment_score(uuid)                             set search_path = public;

alter function public.fn_engine_chain_fire()                                set search_path = public;
alter function public.fn_engine_doc_expiry_sync()                           set search_path = public;
alter function public.fn_engine_on_case_created()                           set search_path = public;
alter function public.fn_engine_on_lead_created()                           set search_path = public;
alter function public.fn_engine_on_stage_change()                           set search_path = public;

alter function public.fn_engine_expiry_sweep()                              set search_path = public;
alter function public.fn_engine_festival_sweep()                            set search_path = public;
alter function public.fn_engine_outbox_sweep()                              set search_path = public;
alter function public.fn_engine_sla_sweep()                                 set search_path = public;

alter function public.mark_case_outcome(uuid, text, date, date, date, date, date, date) set search_path = public;
alter function public.populate_case_documents_from_rules(uuid)              set search_path = public;
