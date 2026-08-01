-- ============================================================================
-- PHASE 1 · ITEM 8 — REPAIR DUPLICATE updated_at TRIGGERS
-- ============================================================================
-- ROOT CAUSE (verified): Study2PR_Supabase_Schema.sql created set_updated_at()
--   plus trg_cases_updated / trg_leads_updated. RUN_IN_SUPABASE_SQL_EDITOR.sql
--   later created set_updated_at_cases() / set_updated_at_leads() plus
--   trg_cases_updated_at / trg_leads_updated_at WITHOUT dropping the originals.
--   Result: `cases` and `leads` each fired TWO BEFORE UPDATE triggers running
--   byte-identical bodies (NEW.updated_at = now(); RETURN NEW;).
--
-- PROOF OF SAFETY (verified immediately before applying):
--   set_updated_at        -> 13 triggers across 13 tables  (canonical, retained)
--   set_updated_at_cases  ->  1 trigger  (cases.trg_cases_updated_at)  [dropped]
--   set_updated_at_leads  ->  1 trigger  (leads.trg_leads_updated_at)  [dropped]
--   Bodies confirmed identical via pg_get_functiondef. The canonical trigger
--   remains on BOTH tables, so updated_at continues to be stamped exactly as
--   before. Net effect: same outcome, one execution instead of two.
--
-- BEHAVIOUR CHANGE: none observable. updated_at is still set on every UPDATE.
--
-- ROLLBACK:
--   create function public.set_updated_at_cases() returns trigger language plpgsql
--     as $$begin new.updated_at = now(); return new; end$$;
--   create trigger trg_cases_updated_at before update on public.cases
--     for each row execute function public.set_updated_at_cases();
--   (and the equivalent pair for leads)
-- ============================================================================

drop trigger if exists trg_cases_updated_at on public.cases;
drop trigger if exists trg_leads_updated_at on public.leads;

drop function if exists public.set_updated_at_cases();
drop function if exists public.set_updated_at_leads();
