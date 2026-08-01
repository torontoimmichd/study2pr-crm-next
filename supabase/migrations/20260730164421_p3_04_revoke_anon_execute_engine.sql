-- ============================================================================
-- PHASE 3.4 · REVOKE anon EXECUTE ON ENGINE / JOB-QUEUE FUNCTIONS
-- ============================================================================
-- FINDING: 14 SECURITY DEFINER functions were executable by the `anon` role,
--   i.e. reachable by anyone holding the public anon key (which ships in the
--   browser bundle by design).
--
-- TRIAGE (not all are equally dangerous):
--   * The 8 fn_engine_on_* / chain_fire / doc_expiry_sync / assessment_on_submit
--     functions RETURN trigger. PostgreSQL refuses to call those directly
--     ("trigger functions can only be called as triggers"), so they were never
--     truly exploitable - but there is no reason for anon to hold EXECUTE.
--   * claim_jobs / enqueue_job / finish_job are REAL exposure: they take
--     arguments and mutate the job queue. An unauthenticated caller could claim,
--     inject or complete jobs.
--   * fn_engine_*_sweep run the automation. Invoked by pg_cron as the job owner.
--
-- WHY THIS IS SAFE:
--   * Triggers do NOT check EXECUTE privilege of the current user - they run in
--     the table-owner context. Revoking does not affect any trigger.
--   * pg_cron jobs run as their owner (postgres), not as anon/authenticated.
--   * The comms-worker edge function authenticates with the SERVICE ROLE key;
--     service_role privileges are untouched below.
--   * Verified the application never calls these: the client .rpc() inventory is
--     bulk_process_prospectives, mark_case_outcome, consent_prospective_to_case,
--     decline_prospective, snooze_prospective, ensure_family_unit,
--     get_family_members, mark_conversation_read, fn_add_staff. None appear here.
--
-- SCOPE: anon loses EXECUTE on all 14. `authenticated` additionally loses the
--   three job-queue functions, which no signed-in user has any reason to call.
--   Everything else keeps `authenticated` pending app-side verification.
--
-- ROLLBACK: grant execute on function public.<name>(<args>) to anon;
-- ============================================================================

revoke execute on function public.claim_jobs(text[], integer)        from anon, authenticated;
revoke execute on function public.enqueue_job(text, jsonb)           from anon, authenticated;
revoke execute on function public.finish_job(uuid, boolean, text)    from anon, authenticated;

revoke execute on function public.fn_assessment_score(uuid)          from anon;

revoke execute on function public.fn_engine_sla_sweep()              from anon;
revoke execute on function public.fn_engine_outbox_sweep()           from anon;
revoke execute on function public.fn_engine_festival_sweep()         from anon;
revoke execute on function public.fn_engine_expiry_sweep()           from anon;

revoke execute on function public.fn_engine_on_lead_created()        from anon;
revoke execute on function public.fn_engine_on_case_created()        from anon;
revoke execute on function public.fn_engine_on_stage_change()        from anon;
revoke execute on function public.fn_engine_chain_fire()             from anon;
revoke execute on function public.fn_engine_doc_expiry_sync()        from anon;
revoke execute on function public.fn_assessment_on_submit()          from anon;
