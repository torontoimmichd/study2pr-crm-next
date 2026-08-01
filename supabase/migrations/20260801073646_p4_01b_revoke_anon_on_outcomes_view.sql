-- ============================================================================
-- P4.1b — REVOKE anon ON v_case_outcomes (correction to p4_01)
-- ============================================================================
-- p4_01 granted SELECT to authenticated and service_role and said nothing about
-- anon. That was not sufficient: Supabase's ALTER DEFAULT PRIVILEGES grants
-- SELECT on every new relation in `public` DIRECTLY to anon. Verified after
-- p4_01: has_table_privilege('anon','public.v_case_outcomes','SELECT') = true.
--
-- This is the same direct-grant trap documented in p3_04c, hit again on a brand
-- new object minutes later. It is a property of every new table and view in this
-- project, not a one-off. Any future CREATE TABLE / CREATE VIEW in `public` must
-- revoke from anon explicitly.
--
-- Real-world impact here was nil: v_case_outcomes is security_invoker, so anon
-- reads it under anon's own RLS and gets 0 rows. Revoking anyway - the principle
-- is to remove the privilege, not to rely on a second control catching it.
--
-- ROLLBACK: grant select on public.v_case_outcomes to anon;
-- ============================================================================

revoke all on public.v_case_outcomes from anon;
revoke all on public.case_outcome_reviews from anon;
