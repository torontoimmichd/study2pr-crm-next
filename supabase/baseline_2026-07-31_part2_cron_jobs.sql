-- ============================================================================
-- STUDY2PR — SCHEMA BASELINE  ·  PART 2
-- Scheduled jobs (pg_cron)
-- ============================================================================
-- Generated 31 July 2026 from live project ocnsavosheduqzmeyvcd.
--
-- WHY THIS FILE MATTERS EVEN AFTER YOU RUN pg_dump:
--   `supabase db dump` / `pg_dump` do NOT capture pg_cron schedules. They live
--   in the `cron.job` table, not in the dumped schema. If you rebuilt this
--   database from a pg_dump alone, ALL SIX automations below would silently be
--   missing — the SLA sweep, the outbox worker, expiry alerts, festival
--   greetings and audit partition maintenance would simply never run, with no
--   error to tell you.
--
-- ⚠ SECRET REDACTED — READ THIS
--   The comms_worker_sweep job embeds a plaintext worker secret in its command
--   ('x-worker-secret'). It is REDACTED below and must NOT be committed in
--   clear text. See the SECURITY note at the bottom of this file.
--   Retrieve the live value with:
--       select command from cron.job where jobname = 'comms_worker_sweep';
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Engine sweeps  (pure SQL, no secrets)
-- ---------------------------------------------------------------------------
select cron.schedule('engine_sla_sweep',      '*/15 * * * *', $$select public.fn_engine_sla_sweep()$$);
select cron.schedule('engine_outbox_sweep',   '*/5 * * * *',  $$select public.fn_engine_outbox_sweep()$$);
select cron.schedule('engine_expiry_sweep',   '30 3 * * *',   $$select public.fn_engine_expiry_sweep()$$);
select cron.schedule('engine_festival_sweep', '0 4 * * *',    $$select public.fn_engine_festival_sweep()$$);

-- ---------------------------------------------------------------------------
-- 2. Audit partition maintenance   (added by migration p1_01_restore_audit_logging)
--    Keeps 6 months of audit_log partitions ahead. Without this the audit trail
--    silently stops accepting writes once the last partition expires — which is
--    exactly the failure that left audit_log empty from inception until
--    2026-07-30.
-- ---------------------------------------------------------------------------
select cron.schedule('audit_partition_maintenance', '0 0 1 * *', $$select public.fn_audit_ensure_partitions(6)$$);

-- ---------------------------------------------------------------------------
-- 3. Comms worker  (calls the comms-worker edge function every minute)
--    ⚠ REPLACE <WORKER_SECRET> before running. Do NOT commit the real value.
-- ---------------------------------------------------------------------------
select cron.schedule(
  'comms_worker_sweep',
  '* * * * *',
  $$
  select net.http_post(
    url                 := 'https://ocnsavosheduqzmeyvcd.supabase.co/functions/v1/comms-worker',
    headers             := '{"x-worker-secret":"<WORKER_SECRET>"}'::jsonb,
    timeout_milliseconds := 1000
  );
  $$
);


-- ---------------------------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------------------------
-- select jobname, schedule, active from cron.job order by jobid;   -- expect 6, all active


-- ============================================================================
-- SECURITY NOTE  (new finding, 31 July 2026 — not in the original certification)
-- ============================================================================
-- The comms_worker_sweep command stores a worker secret in PLAINTEXT inside the
-- cron.job table.
--
-- ── SEVERITY: MEDIUM, not critical. Corrected after fuller investigation. ──
--
--   My first read of this was WRONG and is recorded here so nobody repeats it.
--   `has_table_privilege('anon','cron.job','SELECT')` returns TRUE, which looks
--   alarming — cron.job does grant SELECT to PUBLIC:
--       relacl = {supabase_admin=arwdDxtm/…, =r/…, postgres=r*/…}
--                                             ^^^ PUBLIC has SELECT
--
--   BUT has_table_privilege ignores SCHEMA-level access, and:
--       has_schema_privilege('anon','cron','USAGE')          = FALSE
--       has_schema_privilege('authenticated','cron','USAGE') = FALSE
--
--   Without USAGE on the schema, the table grant is unreachable. So `anon`
--   CANNOT read this secret today, and it is NOT exposed through the public
--   anon key. Lesson: when checking exposure, test schema USAGE as well as
--   table privilege — the table check alone gives false alarms.
--
-- ── WHAT IS STILL GENUINELY WRONG ──
--   1. The secret is in plaintext at rest, so it lands in any backup, config
--      export or support bundle that includes cron.job. This file would have
--      committed it to git had it not been redacted.
--   2. It is one config change away from being live: granting `cron` schema
--      USAGE, or adding `cron` to PostgREST's exposed schemas, makes it
--      readable with the public anon key immediately.
--   3. It cannot be rotated without editing the cron job, so in practice it
--      never gets rotated.
--
-- ── RECOMMENDED FIX (Phase 3) ──
--   `supabase_vault` is already installed. Store the secret in Vault and have
--   the cron command read it, instead of inlining it. Rotate the current value
--   at the same time — it has been sitting in plaintext and should be treated
--   as stale.
--
--   Do NOT try to fix this by revoking PUBLIC's SELECT on cron.job: that table
--   is Supabase-managed infrastructure and tampering with its ACL risks
--   breaking the dashboard's cron UI for no real gain, given schema USAGE
--   already blocks access.
-- ============================================================================
