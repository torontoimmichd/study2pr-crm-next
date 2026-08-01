-- ============================================================================
-- PHASE 2A · CLOSE ALWAYS-TRUE POLICIES ON CLIENT-DATA TABLES
-- ============================================================================
-- PROBLEM (verified): 4 tables holding client or configuration data granted
--   unconditional access to ANY authenticated user:
--     family_units             SELECT + INSERT + UPDATE  using (true)   18 rows
--     prospective_applications SELECT + INSERT + UPDATE  using (true)    3 rows
--     case_notes               SELECT                    using (true)    0 rows
--     app_settings             SELECT                    using (true)   15 rows
--
--   Why this matters: client-portal users authenticate with the SAME
--   'authenticated' role as staff (PortalLogin uses signInWithOtp). So an
--   always-true policy does not mean "any staff member" - it means
--   "any logged-in person, including every client".
--
-- CURRENT EXPOSURE: none. Verified 0 clients have portal_user_id set, so no
--   client can log in yet. This is a latent trap that would open the moment
--   the first portal client is onboarded - the portal UI is already built.
--
-- PROVEN SAFE BEFORE CHANGING (Phase 2A rule):
--   The client portal reads only: activity_timeline, case_documents, cases,
--   clients, staff_profiles, visa_types. It does NOT touch any of the 4 tables
--   below. Consumers of family_units / prospective_applications are all staff
--   UI (AddFamilyMemberSheet, FamilyUnitSheet, TopFamilyUnitsPanel,
--   NewLeadDialog, ApplicationsPage).
--
-- BEHAVIOUR CHANGE: none for staff (fn_is_staff() is true for any active staff
--   member). Future portal clients are correctly excluded.
--
-- NOT CHANGED (deliberately): genuine reference data stays readable -
--   case_stages_ref and task_statuses_ref (anon-readable, needed by the public
--   intake form), chain_rules, document_checklist_rules,
--   program_eligibility_rules, questionnaire_* and orgs.
--
-- ROLLBACK: recreate each policy below with `using (true)` / `with check (true)`.
-- ============================================================================

-- ---- family_units -----------------------------------------------------------
drop policy if exists "Authenticated can read family_units"   on public.family_units;
drop policy if exists "Authenticated can insert family_units" on public.family_units;
drop policy if exists "Authenticated can update family_units" on public.family_units;

create policy p_family_units_staff_read   on public.family_units
  for select to authenticated using (public.fn_is_staff());
create policy p_family_units_staff_insert on public.family_units
  for insert to authenticated with check (public.fn_is_staff());
create policy p_family_units_staff_update on public.family_units
  for update to authenticated using (public.fn_is_staff()) with check (public.fn_is_staff());

-- ---- prospective_applications ----------------------------------------------
drop policy if exists "Authenticated can read prospective_applications"   on public.prospective_applications;
drop policy if exists "Authenticated can insert prospective_applications" on public.prospective_applications;
drop policy if exists "Authenticated can update prospective_applications" on public.prospective_applications;

create policy p_prospective_staff_read   on public.prospective_applications
  for select to authenticated using (public.fn_is_staff());
create policy p_prospective_staff_insert on public.prospective_applications
  for insert to authenticated with check (public.fn_is_staff());
create policy p_prospective_staff_update on public.prospective_applications
  for update to authenticated using (public.fn_is_staff()) with check (public.fn_is_staff());

-- ---- case_notes -------------------------------------------------------------
drop policy if exists case_notes_select on public.case_notes;
create policy p_case_notes_staff_read on public.case_notes
  for select to authenticated using (public.fn_is_staff());

-- ---- app_settings (configuration, not client-facing) ------------------------
drop policy if exists p_app_settings_read on public.app_settings;
create policy p_app_settings_staff_read on public.app_settings
  for select to authenticated using (public.fn_is_staff());
