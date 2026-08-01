-- ============================================================================
-- PHASE 3.6 · RESTRICT READ ACCESS TO THE pg_cron CATALOG
-- ============================================================================
-- FINDING (31 July 2026, new — not in the original certification):
--   The cron job `comms_worker_sweep` stores a worker secret in PLAINTEXT
--   inside its command:
--       headers := '{"x-worker-secret":"s2pr_wrk_****"}'::jsonb
--   and BOTH `anon` and `authenticated` held SELECT on cron.job:
--       has_table_privilege('anon','cron.job','SELECT')          = true
--       has_table_privilege('authenticated','cron.job','SELECT') = true
--
-- SEVERITY - stated precisely, not inflated:
--   PostgREST exposes only the `public` schema by default, so `cron` is very
--   probably NOT reachable through the REST API today. This is therefore an
--   over-broad grant rather than a confirmed live leak. But `anon` is the role
--   whose key ships in the browser bundle, so the moment anyone adds `cron` to
--   the exposed schemas - or calls it from a SECURITY DEFINER helper - the
--   secret is public. Same shape as the always-true policies fixed in p2a_03:
--   close it before it opens.
--
-- WHY REVOKING IS SAFE:
--   * pg_cron executes jobs as the job owner (postgres) - it does not consult
--     anon/authenticated privileges.
--   * The comms-worker edge function authenticates with the SERVICE ROLE key.
--   * No application code reads cron.job (client .rpc()/.from() inventory has
--     no reference to the cron schema).
--
-- ROLLBACK: grant select on cron.job, cron.job_run_details to anon, authenticated;
-- ============================================================================

revoke select on cron.job              from anon, authenticated;
revoke select on cron.job_run_details  from anon, authenticated;
revoke usage  on schema cron           from anon, authenticated;
