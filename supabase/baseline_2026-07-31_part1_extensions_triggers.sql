-- ============================================================================
-- STUDY2PR — SCHEMA BASELINE  ·  PART 1 of N
-- Extensions + Triggers
-- ============================================================================
-- Generated 31 July 2026 from live project ocnsavosheduqzmeyvcd (study2pr-prod)
-- Source: PostgreSQL system catalogs via pg_get_triggerdef() — these are
--         Postgres's own authoritative definitions, byte-exact, NOT reconstructed.
--
-- WHY THIS EXISTS: `supabase db dump` requires Docker Desktop, which was not
--   installed. This file captures the objects that were scattered across ~92
--   hand-applied SQL patch files and could not otherwise be reproduced.
--
-- STATUS OF EACH PART:
--   Part 1  extensions, triggers          EXACT (pg_get_triggerdef)
--   Part 2  RLS policies                  EXACT (pg_policies expressions)
--   Part 3  functions                     EXACT (pg_get_functiondef)
--   Part 4  views + matviews              EXACT (pg_get_viewdef)
--   Part 5  tables, indexes, constraints  RECONSTRUCTED — verify against pg_dump
--
-- APPLY ORDER: extensions -> tables(5) -> functions(3) -> views(4) ->
--              triggers(1) -> policies(2)
--   (triggers and policies depend on functions and tables existing first)
--
-- ⚠ SUPERSEDED BY pg_dump: once Docker Desktop is installed, run
--     supabase db dump --linked -f supabase/baseline_schema.sql
--   and prefer that output. Keep this file for comparison.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- EXTENSIONS  (9 — note several deliberately live in `public`, which is why
--              pinning search_path in migration p3_02 had to exclude them)
-- ---------------------------------------------------------------------------
create extension if not exists btree_gin           with schema public;
create extension if not exists pg_cron             with schema pg_catalog;
create extension if not exists pg_net              with schema extensions;
create extension if not exists pg_stat_statements  with schema extensions;
create extension if not exists pg_trgm             with schema public;
create extension if not exists pgcrypto            with schema extensions;
create extension if not exists supabase_vault      with schema vault;
create extension if not exists unaccent            with schema public;
create extension if not exists "uuid-ossp"         with schema extensions;


-- ---------------------------------------------------------------------------
-- TRIGGERS  (34 in public)
-- Run AFTER tables and functions exist.
-- ---------------------------------------------------------------------------

-- app_settings
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION app_settings_set_updated_at();

-- appointments
CREATE TRIGGER trg_appointments_set_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- assessments
CREATE TRIGGER trg_assessment_submitted AFTER INSERT ON assessments FOR EACH ROW WHEN (new.status = 'submitted'::text) EXECUTE FUNCTION fn_assessment_on_submit();

-- case_applicants
CREATE TRIGGER case_applicants_updated_at BEFORE UPDATE ON case_applicants FOR EACH ROW EXECUTE FUNCTION case_applicants_set_updated_at();

-- case_documents
CREATE TRIGGER trg_case_documents_updated BEFORE UPDATE ON case_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_engine_doc_expiry AFTER INSERT OR UPDATE ON case_documents FOR EACH ROW EXECUTE FUNCTION fn_engine_doc_expiry_sync();

-- cases  (NOTE: exactly ONE updated_at trigger — the duplicate
--         trg_cases_updated_at was removed in migration p1_08)
CREATE TRIGGER trg_cases_code BEFORE INSERT ON cases FOR EACH ROW EXECUTE FUNCTION gen_case_code();
CREATE TRIGGER trg_cases_stage BEFORE UPDATE OF current_stage_code ON cases FOR EACH ROW EXECUTE FUNCTION log_stage_change();
CREATE TRIGGER trg_cases_updated BEFORE UPDATE ON cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_engine_case_created AFTER INSERT ON cases FOR EACH ROW EXECUTE FUNCTION fn_engine_on_case_created();
CREATE TRIGGER trg_engine_chain_fire AFTER UPDATE OF current_stage_code ON cases FOR EACH ROW EXECUTE FUNCTION fn_engine_chain_fire();
CREATE TRIGGER trg_engine_stage_change AFTER UPDATE OF current_stage_code ON cases FOR EACH ROW EXECUTE FUNCTION fn_engine_on_stage_change();

-- clients
CREATE TRIGGER trg_clients_code BEFORE INSERT ON clients FOR EACH ROW EXECUTE FUNCTION gen_client_code();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- countries
CREATE TRIGGER trg_countries_updated BEFORE UPDATE ON countries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- document_checklist_rules
CREATE TRIGGER document_checklist_rules_updated_at BEFORE UPDATE ON document_checklist_rules FOR EACH ROW EXECUTE FUNCTION document_checklist_rules_set_updated_at();

-- entity_notes  (guard enforces the note_type whitelist; timeline projects the
--                event into activity_timeline with body intentionally NULL)
CREATE TRIGGER trg_entity_notes_guard BEFORE INSERT OR UPDATE ON entity_notes FOR EACH ROW EXECUTE FUNCTION fn_entity_notes_guard();
CREATE TRIGGER trg_entity_notes_timeline AFTER INSERT OR UPDATE ON entity_notes FOR EACH ROW EXECUTE FUNCTION fn_entity_notes_timeline();

-- family_members
CREATE TRIGGER trg_family_members_updated BEFORE UPDATE ON family_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- finance_entries
CREATE TRIGGER trg_finance_entry_timeline AFTER INSERT ON finance_entries FOR EACH ROW EXECUTE FUNCTION fn_finance_entry_timeline();

-- integrations_config
CREATE TRIGGER trg_integrations_config_updated_at BEFORE UPDATE ON integrations_config FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- invoices
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- lead_routing_rules
CREATE TRIGGER trg_lead_routing_rules_updated_at BEFORE UPDATE ON lead_routing_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- leads  (NOTE: exactly ONE updated_at trigger — the duplicate
--         trg_leads_updated_at was removed in migration p1_08)
CREATE TRIGGER trg_engine_lead_created AFTER INSERT ON leads FOR EACH ROW EXECUTE FUNCTION fn_engine_on_lead_created();
CREATE TRIGGER trg_leads_guard_delete BEFORE DELETE ON leads FOR EACH ROW EXECUTE FUNCTION fn_leads_guard_delete();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- outbound_messages  (messaging kill-switch)
CREATE TRIGGER trg_outbox_guard BEFORE UPDATE ON outbound_messages FOR EACH ROW EXECUTE FUNCTION fn_outbox_guard();

-- questionnaire_*
CREATE TRIGGER questionnaire_responses_updated_at BEFORE UPDATE ON questionnaire_responses FOR EACH ROW EXECUTE FUNCTION questionnaire_responses_set_updated_at();
CREATE TRIGGER questionnaire_templates_updated_at BEFORE UPDATE ON questionnaire_templates FOR EACH ROW EXECUTE FUNCTION questionnaire_templates_set_updated_at();

-- staff_profiles
CREATE TRIGGER trg_staff_block_self_escalation BEFORE UPDATE ON staff_profiles FOR EACH ROW EXECUTE FUNCTION staff_profiles_block_self_escalation();
CREATE TRIGGER trg_staff_profiles_updated BEFORE UPDATE ON staff_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- tasks
CREATE TRIGGER trg_tasks_supersede AFTER INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION fn_tasks_supersede();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- visa_categories
CREATE TRIGGER trg_visa_categories_updated BEFORE UPDATE ON visa_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- SCHEDULED JOBS (pg_cron) — NOT captured by pg_dump either; recreate manually.
-- ---------------------------------------------------------------------------
-- select cron.schedule('comms_worker_sweep',          '* * * * *',    $$ ... net.http_post to comms-worker ... $$);
-- select cron.schedule('engine_outbox_sweep',         '*/5 * * * *',  $$ select public.fn_engine_outbox_sweep() $$);
-- select cron.schedule('engine_sla_sweep',            '*/15 * * * *', $$ select public.fn_engine_sla_sweep() $$);
-- select cron.schedule('engine_expiry_sweep',         '30 3 * * *',   $$ select public.fn_engine_expiry_sweep() $$);
-- select cron.schedule('engine_festival_sweep',       '0 4 * * *',    $$ select public.fn_engine_festival_sweep() $$);
-- select cron.schedule('audit_partition_maintenance', '0 0 1 * *',    $$ select public.fn_audit_ensure_partitions(6) $$);
-- Exact commands must be read from cron.job before relying on these.
