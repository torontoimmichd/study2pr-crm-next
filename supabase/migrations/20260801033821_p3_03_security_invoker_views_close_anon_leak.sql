-- ============================================================================
-- P3.3 — SECURITY DEFINER VIEWS: CLOSE A LIVE anon DATA LEAK
-- ============================================================================
-- This was catalogued as a tidiness item ("convert 8 views to
-- security_invoker"). It is not. It is a live exposure, demonstrated
-- against the production database on 1 Aug 2026.
--
-- All 8 views are owned by `postgres` and default to SECURITY DEFINER, so they
-- execute with the owner's rights and BYPASS the caller's RLS entirely. All 8
-- also had SELECT granted to `anon` — the role whose API key ships inside the
-- browser bundle by design. Views in `public` are exposed by PostgREST.
--
-- MEASURED AS anon (unauthenticated), BEFORE this migration:
--     activity_log             227 rows      <-- full activity timeline
--     v_top_family_units        18 rows
--     v_recent_chain_firings     3 rows
--     v_counselor_performance    2 rows
--     v_branch_health            1 row
--     v_lead_deletions           1 row
--     v_cases_masked             0 rows      (has its own internal filter)
--     v_clients_accounts         0 rows      (ditto)
--
-- CONTROLS proving the harness discriminates rather than bypassing RLS itself:
--     clients        (base table, RLS)         -> 0 rows as anon
--     v_stage_events (already security_invoker)-> 0 rows as anon
--   If the probe had been running with RLS bypassed, those would have returned
--   18 and 17. They returned 0, so the readings above are real.
--
-- FIX, two independent layers:
--   1. security_invoker = true  -> the view now respects the QUERYING user's
--      RLS. This is the actual fix; it is the pattern already proven by
--      v_stage_events in p2a_01.
--   2. REVOKE SELECT FROM PUBLIC, re-grant to authenticated + service_role.
--      Defence in depth. Revoking from `anon` alone would do NOTHING — the
--      grant is inherited from the pseudo-role PUBLIC. That trap already cost
--      a silently-failed migration in p3_04; see p3_04b.
--
-- ON THE MASKING PAIR: the plan warned that v_cases_masked / v_clients_accounts
--   might depend on definer rights by design. Checked before touching them —
--   both have 0 application references, 0 dependent views, and 0 functions
--   mentioning them. Converting them cannot break a consumer because there is
--   no consumer. They are left in place rather than dropped so the decision
--   stays reversible.
--
-- VERIFIED AFTER APPLYING, both auth contexts:
--     anon  -> 0 rows on ALL six previously-leaking views (was 227/18/3/2/1/1)
--     staff -> UNCHANGED: activity_log 227, v_cases_masked 18,
--              v_clients_accounts 18, v_top_family_units 18,
--              v_recent_chain_firings 3, v_counselor_performance 2,
--              v_branch_health 1, v_lead_deletions 1
--   Identical to the pre-change staff baseline. Zero regression.
--
-- ROLLBACK:
--   alter view public.<name> set (security_invoker = false);
--   grant select on public.<name> to anon;
-- ============================================================================

alter view public.activity_log            set (security_invoker = true);
alter view public.v_lead_deletions        set (security_invoker = true);
alter view public.v_cases_masked          set (security_invoker = true);
alter view public.v_clients_accounts      set (security_invoker = true);
alter view public.v_recent_chain_firings  set (security_invoker = true);
alter view public.v_counselor_performance set (security_invoker = true);
alter view public.v_branch_health         set (security_invoker = true);
alter view public.v_top_family_units      set (security_invoker = true);

-- Layer 2: remove the inherited PUBLIC grant, restore only what is needed.
revoke select on public.activity_log            from public;
revoke select on public.v_lead_deletions        from public;
revoke select on public.v_cases_masked          from public;
revoke select on public.v_clients_accounts      from public;
revoke select on public.v_recent_chain_firings  from public;
revoke select on public.v_counselor_performance from public;
revoke select on public.v_branch_health         from public;
revoke select on public.v_top_family_units      from public;

grant select on public.activity_log            to authenticated, service_role;
grant select on public.v_lead_deletions        to authenticated, service_role;
grant select on public.v_cases_masked          to authenticated, service_role;
grant select on public.v_clients_accounts      to authenticated, service_role;
grant select on public.v_recent_chain_firings  to authenticated, service_role;
grant select on public.v_counselor_performance to authenticated, service_role;
grant select on public.v_branch_health         to authenticated, service_role;
grant select on public.v_top_family_units      to authenticated, service_role;
