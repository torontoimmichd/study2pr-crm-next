-- ============================================================================
-- P3.4c — FINISH THE JOB p3_04b STARTED: REVOKE THE **DIRECT** ROLE GRANTS
-- ============================================================================
-- p3_04b fixed a real trap: revoking EXECUTE from `anon` did nothing because
-- the privilege was inherited from the pseudo-role PUBLIC. So it revoked FROM
-- PUBLIC instead. That worked - anon is now denied on all of its targets.
--
-- But it was only half the picture, and the miss was found the same way the
-- first one was: by re-checking the privilege afterwards instead of trusting
-- "migration succeeded".
--
-- Supabase ships ALTER DEFAULT PRIVILEGES that grant EXECUTE on every new
-- function in `public` DIRECTLY to anon, authenticated and service_role. A
-- direct grant is not removed by revoking from PUBLIC. Proof, from proacl:
--
--     fn_comms_worker_sweep  {postgres=X/postgres, anon=X/postgres,
--                             authenticated=X/postgres, service_role=X/postgres}
--                                        ^^^^ no PUBLIC entry to revoke
--
-- So the two traps are mirror images, and BOTH have to be handled:
--     grant came via PUBLIC  -> revoking from anon does nothing   (p3_04b)
--     grant is direct        -> revoking from PUBLIC does nothing (here)
--
-- WHAT WAS STILL OPEN, measured before this migration:
--   authenticated = true on 10 functions p3_04b intended to close:
--     fn_engine_sla_sweep, fn_engine_outbox_sweep, fn_engine_festival_sweep,
--     fn_engine_expiry_sweep, fn_engine_on_lead_created,
--     fn_engine_on_case_created, fn_engine_on_stage_change,
--     fn_engine_chain_fire, fn_engine_doc_expiry_sync, fn_assessment_on_submit
--   anon = true on two functions never covered by p3_04 at all:
--     fn_audit_ensure_partitions  (created later, in p1_01)
--     fn_comms_worker_sweep       (created minutes ago, in p3_08)
--
-- SEVERITY, stated honestly rather than inflated:
--   * The trigger functions return `trigger`; PostgreSQL refuses to call those
--     directly, so they were never exploitable. Hygiene only.
--   * The four sweeps ARE callable. Any signed-in user - including a future
--     portal client, who authenticates as `authenticated` too - could fire the
--     outbox sweep repeatedly and push queued messages out early.
--   * fn_audit_ensure_partitions is the worst of them: SECURITY DEFINER, runs
--     CREATE TABLE as postgres, and was reachable by anon. Bounded (idempotent,
--     fixed naming) but an unauthenticated caller should not reach DDL.
--   * fn_comms_worker_sweep would let anon hammer the edge function once per
--     call. It does not return the secret.
--
-- DELIBERATELY KEPT: fn_assessment_score(uuid) stays granted to authenticated -
--   that re-grant was an intentional decision in p3_04b, not an oversight.
--
-- SAFETY: triggers execute in the table-owner context and never consult the
--   caller's EXECUTE privilege. pg_cron runs jobs as the job owner. The
--   comms-worker edge function uses the service key. All three are unaffected.
--
-- VERIFIED AFTER APPLYING: anon=false AND authenticated=false on all 16
--   engine/job/sweep functions except fn_assessment_score (authenticated=true,
--   intended). service_role retains everything it needs. Cron sweeps continued
--   running with 0 failures.
--
-- ROLLBACK: grant execute on function public.<name>(<args>) to authenticated, anon;
-- ============================================================================

revoke execute on function public.fn_engine_sla_sweep()          from public, anon, authenticated;
revoke execute on function public.fn_engine_outbox_sweep()       from public, anon, authenticated;
revoke execute on function public.fn_engine_festival_sweep()     from public, anon, authenticated;
revoke execute on function public.fn_engine_expiry_sweep()       from public, anon, authenticated;

revoke execute on function public.fn_engine_on_lead_created()    from public, anon, authenticated;
revoke execute on function public.fn_engine_on_case_created()    from public, anon, authenticated;
revoke execute on function public.fn_engine_on_stage_change()    from public, anon, authenticated;
revoke execute on function public.fn_engine_chain_fire()         from public, anon, authenticated;
revoke execute on function public.fn_engine_doc_expiry_sync()    from public, anon, authenticated;
revoke execute on function public.fn_assessment_on_submit()      from public, anon, authenticated;

revoke execute on function public.fn_audit_ensure_partitions(int) from public, anon, authenticated;
revoke execute on function public.fn_comms_worker_sweep()         from public, anon, authenticated;

-- service_role keeps what the worker and any admin tooling need.
grant execute on function public.fn_engine_outbox_sweep()         to service_role;
grant execute on function public.fn_audit_ensure_partitions(int)  to service_role;
grant execute on function public.fn_comms_worker_sweep()          to service_role;
