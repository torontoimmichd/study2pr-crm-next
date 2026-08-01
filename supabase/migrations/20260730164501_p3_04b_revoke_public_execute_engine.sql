-- ============================================================================
-- PHASE 3.4b · CORRECTION - REVOKE FROM **PUBLIC**, NOT JUST anon
-- ============================================================================
-- The previous migration (p3_04) revoked EXECUTE from `anon` and had NO EFFECT.
-- Verified immediately after applying:
--     has_function_privilege('anon','claim_jobs...','EXECUTE') = true
--
-- ROOT CAUSE: PostgreSQL grants EXECUTE on new functions to the pseudo-role
--   PUBLIC by default. `anon` and `authenticated` are members of PUBLIC, so a
--   role-level REVOKE leaves the inherited PUBLIC grant intact. The privilege
--   must be revoked FROM PUBLIC, then re-granted to the roles that genuinely
--   need it.
--
-- RE-GRANTS (deliberate, minimum necessary):
--   * service_role  -> claim_jobs / finish_job / enqueue_job. The comms-worker
--                      edge function authenticates with the service key and MUST
--                      keep working. (It also bypasses RLS, but EXECUTE is a
--                      separate privilege and would otherwise be lost.)
--   * authenticated -> fn_assessment_score(uuid) only, pending app verification.
--
-- NOT re-granted: the trigger functions. Triggers execute in the table-owner
-- context and never consult the caller's EXECUTE privilege, so they are
-- unaffected. pg_cron sweeps run as the job owner (postgres), likewise
-- unaffected.
--
-- ROLLBACK: grant execute on function public.<name>(<args>) to public;
-- ============================================================================

-- ---- job queue: real exposure --------------------------------------------
revoke execute on function public.claim_jobs(text[], integer)     from public;
revoke execute on function public.enqueue_job(text, jsonb)        from public;
revoke execute on function public.finish_job(uuid, boolean, text) from public;

grant  execute on function public.claim_jobs(text[], integer)     to service_role;
grant  execute on function public.enqueue_job(text, jsonb)        to service_role;
grant  execute on function public.finish_job(uuid, boolean, text) to service_role;

-- ---- assessment scoring ---------------------------------------------------
revoke execute on function public.fn_assessment_score(uuid) from public;
grant  execute on function public.fn_assessment_score(uuid) to authenticated, service_role;

-- ---- cron sweeps: no caller outside pg_cron --------------------------------
revoke execute on function public.fn_engine_sla_sweep()      from public;
revoke execute on function public.fn_engine_outbox_sweep()   from public;
revoke execute on function public.fn_engine_festival_sweep() from public;
revoke execute on function public.fn_engine_expiry_sweep()   from public;

-- ---- trigger functions: invoked by triggers only ---------------------------
revoke execute on function public.fn_engine_on_lead_created()  from public;
revoke execute on function public.fn_engine_on_case_created()  from public;
revoke execute on function public.fn_engine_on_stage_change()  from public;
revoke execute on function public.fn_engine_chain_fire()       from public;
revoke execute on function public.fn_engine_doc_expiry_sync()  from public;
revoke execute on function public.fn_assessment_on_submit()    from public;
