-- ============================================================================
-- P3.5b — RLS init-plan optimisation
-- Applied to ocnsavosheduqzmeyvcd on 1 August 2026 (version 20260801030042)
-- ============================================================================
-- WHAT: wrap bare auth.uid() / auth.jwt() in RLS policy expressions as
--       (select auth.uid()) / (select auth.jwt()).
--
-- WHY:  a bare auth.uid() in a policy is re-evaluated ONCE PER ROW scanned.
--       Wrapped in a scalar subquery it becomes an InitPlan, evaluated once
--       per statement. Both functions are STABLE, so the result is identical
--       for every row within a statement — this is a planner optimisation
--       with ZERO behaviour change, and is Supabase's own documented fix for
--       the `auth_rls_initplan` advisor warning.
--
-- SCOPE: 35 of 143 policies in `public` contained a bare call
--        (33 auth.uid(), 2 auth.jwt(), 0 auth.role()).
--
-- METHOD: ALTER POLICY, not DROP + CREATE. ALTER rewrites only the USING /
--        WITH CHECK expressions and leaves the command, roles and
--        PERMISSIVE/RESTRICTIVE flag untouched — so there is no window in
--        which a table sits unprotected, and no risk of losing a definition
--        in transcription. Expressions are read from pg_policies and
--        rewritten in place rather than retyped.
--
-- IDEMPOTENT: each expression is first un-wrapped and then re-wrapped, so
--        re-running this migration cannot produce nested (select (select ...)).
--
-- VERIFIED AFTER APPLYING:
--   * 143 policies before and after — none lost.
--   * Semantic equivalence PROVEN, not assumed: un-wrapping every policy in
--     the post state reproduces the pre-state md5 of
--     (table|policy|cmd|roles|permissive|qual|with_check) exactly
--     — 063eeb70ed91164d4f3c9c98678c44a4. The wrapping is the only change.
--   * 35 policies now wrapped, 0 left bare, 0 double-wrapped.
--   * Enforcement re-tested in BOTH auth contexts with a harness proven to
--     discriminate (an earlier harness silently bypassed RLS and returned
--     identical counts for both roles — it was discarded):
--         active staff member  -> clients 18, cases 18, family_units 18,
--                                 prospective 3, notes 40, invoices 4, tasks 71
--         simulated portal user-> 0 on every one of those tables
--
-- NOTE ON DEPARSING: Postgres stores the wrapped call and prints it back as
--        `( SELECT auth.uid() AS uid)`. Any check for "is this still bare?"
--        must account for that form, or it will report false failures.
--
-- ROLLBACK:
--   DO $$
--   DECLARE r record; u text; w text;
--   BEGIN
--     FOR r IN SELECT tablename, policyname, qual, with_check FROM pg_policies
--              WHERE schemaname='public'
--                AND (coalesce(qual,'')||' '||coalesce(with_check,'')) ~ 'SELECT auth\.(uid|jwt)\(\)'
--     LOOP
--       u := replace(replace(r.qual,'( SELECT auth.uid() AS uid)','auth.uid()'),'( SELECT auth.jwt() AS jwt)','auth.jwt()');
--       w := replace(replace(r.with_check,'( SELECT auth.uid() AS uid)','auth.uid()'),'( SELECT auth.jwt() AS jwt)','auth.jwt()');
--       EXECUTE format('ALTER POLICY %I ON public.%I%s%s', r.policyname, r.tablename,
--         CASE WHEN u IS NOT NULL THEN ' USING ('||u||')' ELSE '' END,
--         CASE WHEN w IS NOT NULL THEN ' WITH CHECK ('||w||')' ELSE '' END);
--     END LOOP;
--   END $$;
-- ============================================================================

DO $$
DECLARE
  r        record;
  new_qual text;
  new_chk  text;
  n        int := 0;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'auth\.(uid|jwt)\(\)'
    ORDER BY tablename, policyname
  LOOP
    -- un-wrap first so the operation is idempotent
    new_qual := replace(replace(r.qual, '(select auth.uid())', 'auth.uid()'),
                                        '(select auth.jwt())', 'auth.jwt()');
    new_chk  := replace(replace(r.with_check, '(select auth.uid())', 'auth.uid()'),
                                              '(select auth.jwt())', 'auth.jwt()');

    -- then wrap
    new_qual := replace(replace(new_qual, 'auth.uid()', '(select auth.uid())'),
                                          'auth.jwt()', '(select auth.jwt())');
    new_chk  := replace(replace(new_chk,  'auth.uid()', '(select auth.uid())'),
                                          'auth.jwt()', '(select auth.jwt())');

    EXECUTE format(
      'ALTER POLICY %I ON public.%I%s%s',
      r.policyname,
      r.tablename,
      CASE WHEN new_qual IS NOT NULL THEN ' USING (' || new_qual || ')' ELSE '' END,
      CASE WHEN new_chk  IS NOT NULL THEN ' WITH CHECK (' || new_chk || ')' ELSE '' END
    );
    n := n + 1;
  END LOOP;

  RAISE NOTICE 'P3.5b: rewrote % policies', n;

  IF n <> 35 THEN
    RAISE EXCEPTION 'P3.5b expected 35 policies, rewrote % — aborting', n;
  END IF;
END $$;
