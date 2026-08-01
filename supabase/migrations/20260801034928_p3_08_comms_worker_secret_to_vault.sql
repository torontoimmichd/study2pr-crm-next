-- ============================================================================
-- P3.8 — MOVE THE comms_worker_sweep SECRET OUT OF THE CRON COMMAND INTO VAULT
-- ============================================================================
-- PROBLEM: cron job `comms_worker_sweep` (every minute, 1440 runs/day) carried
--   a 57-character worker secret in PLAINTEXT inside cron.job.command:
--       headers := '{"x-worker-secret":"s2pr_wrk_..."}'::jsonb
--   It is readable by anyone who can read the cron catalog, it lands in every
--   configuration export and screenshot, and it has never been rotated.
--
--   Direct exposure through the API was already closed in p3_06 (USAGE on the
--   cron schema was revoked from anon/authenticated). This migration removes
--   the plaintext at rest, which p3_06 did not do.
--
-- APPROACH: the secret is copied into supabase_vault by READING IT OUT OF THE
--   EXISTING COMMAND in SQL. It is never typed into this migration, never
--   printed, and never passes through a chat transcript or a log line.
--
-- The cron command becomes a call to a SECURITY DEFINER function that fetches
--   the secret from vault at run time. Same value, same behaviour - only the
--   storage location changes. This is deliberately NOT combined with rotation:
--   rotating requires the edge function's expected secret to change at the same
--   instant, and that is an env-var change outside the database. Rotating here
--   would break the worker for everything queued in between.
--
-- search_path is pinned per p3_02. `net.` and `vault.` are schema-qualified in
--   the body, so `= public` cannot break their resolution.
--
-- VERIFIED AFTER APPLYING:
--   * 0 cron commands contain the secret (was 1).
--   * vault.secrets holds comms_worker_secret; decrypted length 57, matching
--     the original exactly.
--   * Worker still fires: 5 runs in the first 5 minutes, 0 failures, last run
--     'succeeded', pg_net responses returning HTTP 200. The edge function
--     accepts the Vault-sourced secret.
--
-- STILL OPEN: the secret has NOT been rotated. It has been in plaintext since
--   inception, so it must be treated as compromised. Rotation needs the edge
--   function env var and the Vault value changed together.
--
-- ROLLBACK:
--   select cron.schedule('comms_worker_sweep','* * * * *', $$select net.http_post(
--     url:='https://ocnsavosheduqzmeyvcd.supabase.co/functions/v1/comms-worker',
--     headers:=('{"x-worker-secret":"'||(select decrypted_secret from vault.decrypted_secrets
--                where name='comms_worker_secret')||'"}')::jsonb,
--     timeout_milliseconds:=1000);$$);
--   drop function public.fn_comms_worker_sweep();
-- ============================================================================

-- 1) Copy the live secret into Vault, extracted from the existing cron command.
do $$
declare
  v_secret text;
begin
  select (regexp_match(command, 'x-worker-secret"\s*:\s*"([^"]+)"'))[1]
    into v_secret
  from cron.job
  where jobname = 'comms_worker_sweep';

  if v_secret is null or length(v_secret) < 10 then
    raise exception 'P3.8: could not extract the worker secret from the cron command - aborting rather than writing a broken job';
  end if;

  if not exists (select 1 from vault.secrets where name = 'comms_worker_secret') then
    perform vault.create_secret(
      v_secret,
      'comms_worker_secret',
      'x-worker-secret header for the comms-worker edge function. Moved out of cron.job.command (plaintext) on 2026-08-01. NOT yet rotated - the edge function env var must change in the same window.'
    );
  end if;
end $$;

-- 2) Sweep function that reads the secret at run time.
create or replace function public.fn_comms_worker_sweep()
returns bigint
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_secret text;
  v_req_id bigint;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'comms_worker_secret';

  if v_secret is null then
    raise exception 'fn_comms_worker_sweep: vault secret comms_worker_secret is missing';
  end if;

  select net.http_post(
    url                  := 'https://ocnsavosheduqzmeyvcd.supabase.co/functions/v1/comms-worker',
    headers              := jsonb_build_object('x-worker-secret', v_secret),
    timeout_milliseconds := 1000
  ) into v_req_id;

  return v_req_id;
end
$fn$;

comment on function public.fn_comms_worker_sweep() is
  'P3.8: invokes the comms-worker edge function, reading x-worker-secret from supabase_vault instead of carrying it in plaintext in cron.job.command.';

-- 3) Least privilege. NOTE: this revoke was INSUFFICIENT on its own - see
--    p3_04c. Supabase grants EXECUTE directly to anon/authenticated via
--    ALTER DEFAULT PRIVILEGES, and a direct grant is not removed by revoking
--    from PUBLIC. p3_04c revokes from the roles by name.
revoke execute on function public.fn_comms_worker_sweep() from public;

-- 4) Repoint the cron job. Same name, same schedule, no secret in the command.
select cron.schedule(
  'comms_worker_sweep',
  '* * * * *',
  $$select public.fn_comms_worker_sweep();$$
);
