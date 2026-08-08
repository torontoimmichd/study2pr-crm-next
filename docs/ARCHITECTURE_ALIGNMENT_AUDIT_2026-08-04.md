# Architecture Alignment Audit - 2026-08-04

## Scope and evidence

This compares the current `main` repository, the production migration ledger for
Supabase project `ocnsavosheduqzmeyvcd`, and the operational direction in:

- `Immigration_CRM_Lifecycle_Architecture_v1.docx`
- `Study2PR_Program_Architecture_and_Flow.md`
- `Sprint2_Plan_v2_Profile_Intelligence.md`
- the current production-work handoff and Phase 3 plan

Production migration history matches the repository through
`20260804040500_p4_06_lead_followups_database_owned`. The production dashboard
returns HTTP 200 from Vercel. The active database cron jobs include the engine
SLA, expiry, outbox, festival, and comms worker sweeps. The WhatsApp webhook,
comms worker, and wa-send Edge Functions are active.

## Direction: correct foundation, incomplete operating system

PostgreSQL/Supabase is the right foundation for this CRM. The strongest recent
decisions are database-owned workflow triggers, versioned migrations, RLS,
case lineage instead of copying a refused file, and a real communications event
store. Those choices can support a serious immigration practice.

The application is not yet "indestructible". Its main weakness is that the
database foundation and the staff UI are at different stages of completion.
Several planned rules are present only as tables/functions, or are enforced in
one screen but bypassed by another screen.

## What is implemented and aligned

1. Schema and deployment discipline
   - Local and production migration ledgers match.
   - The repository contains current migrations for communications, outcomes,
     family conversion/linking, terminal case stages, and database-owned lead
     follow-ups.
   - The live database has `family_units`, `case_outcome_reviews`,
     `lead_nurture_targets`, `program_eligibility_rules`, `conversations`,
     `communication_events`, `case_documents`, `entity_notes`,
     `assessment_forms`, and `questionnaire_responses`.

2. Refusal, withdrawal, approval, and judicial review model
   - A refused application is kept as its original case. It is not copied or
     moved into a duplicate "Completed" table.
   - `case_outcome_reviews` supports close file, reapplication,
     appeal/reconsideration, and judicial review with an explicit successor
     case relationship.
   - Judicial review has separate notification-date and location inputs, and
     computes the 15-day/60-day filing deadline.
   - Approved, refused, and withdrawn case stages are terminal at the database
     level (with a deliberate owner/admin correction path).

3. Family foundation and conversion
   - Leads and clients have family-unit support, and conversion migrations carry
     family links forward.
   - New Lead can create family leads; conversion UI contains per-applicant
     application and fee data.
   - Lead detail no longer lists the primary lead as its own family member.

4. Communications backend
   - The live Comms Hub has a conversation/event model, realtime inbox, an
     inbound webhook, a worker, delivery tracking, contact identities, media
     storage, and a 24-hour WhatsApp-window guard.
   - The Edge Function sources are now retained in the repository rather than
     existing only in production.

5. Lead follow-up ownership
   - Lead tasks are owned by the database ladder and single-task migrations
     (`sql/53` and `sql/54`); browser and older trigger writers are removed.
   - A new lead receives one high-priority `lead_first_call` task due in two
     working hours. Later tasks are created just in time by the ladder.
   - The database queues hooks for Day 2, Day 4, Day 6, and Day 10 WhatsApp
     content rather than creating immediate manual tasks.

6. Notes and task ergonomics
   - Lead detail notes save to the real lead notes field.
   - The main lead-detail task view hides future tasks until they are due.
   - The notification bell can complete a task or snooze it for 1, 3, 7, or 15
     days.
   - The primary case-detail stage-change path asks for a note and writes it to
     the timeline through `pending_stage_note`.

## Gaps that block the intended operating model

### P0 - fix before adding more workflow automation

1. Mandatory stage notes are bypassable.
   - `src/views/Cases.tsx` Kanban drag-drop updates `current_stage_code` with
     no `pending_stage_note`.
   - The database note guard is intentionally commented out in migration
     `20260803093512_p4_05_terminal_stage_lock_and_stage_note.sql`.
   - `MarkOutcomePopover` also has a direct-update fallback that does not
     collect a reason.
   - Result: the rule "every stage change requires a recorded note" is not true
     across the application. Provide one shared stage-change dialog/RPC, route
     every UI path through it, then enable the database guard.

2. Case stage tasks still have two writers.
   - `src/views/CaseDetail.tsx` still calls browser-side
     `createCaseStageTasks` while the database trigger
     `fn_engine_on_stage_change` also owns stage automation.
   - Five client keys do not match real stage codes, so twelve intended task
     definitions have never fired. The refused/approved definitions overlap
     semantically with database workflow.
   - Result: some stages silently do nothing; other stages can duplicate work.
     Port approved business tasks to the DB trigger, retain the urgent refusal
     SLA there, then delete the client writer and its call site.

3. WhatsApp campaign templates are not yet ready to send.
   - Production has no approved `wa_templates` named `LEAD_FU_D2`,
     `LEAD_FU_D4`, `LEAD_FU_D6`, or `LEAD_FU_D10`.
   - Therefore the new follow-up schedule is safely queued in the system but
     will not send those four messages until Meta-approved templates are
     created, mapped, and activated.
   - Do not create a real-lead test until the exact content, consent rules, and
     sending windows are approved.

### P1 - next feature release

4. Lead/client WhatsApp buttons still open external WhatsApp.
   - `OutreachDialog`, lead detail, and the integrations screen still use
     `wa.me`. This bypasses the Comms Hub and cannot give you a complete
     in-app history.
   - Build a secure `open_or_create_conversation` RPC for a lead or client,
     route the icon to `/comms`, and use `wa-send` only from that conversation.
     Do not replace this with another browser link.

5. Lead document requests/uploads are not built.
   - Case document requests and uploads work through `case_documents`.
   - The lead-detail Documents tab is a placeholder; a lead has no document
     request model that can later be carried to the converted case.
   - Add a lead-owned request/upload table and a conversion mapping, rather
     than forcing nullable `case_id` rows into `case_documents`.

6. Outcome and profile-intelligence foundations have no operational UI.
   - No source UI reads `v_case_outcomes` or `case_outcome_reviews`, so the
     Completed/Outcome Review module and judicial-review decision workflow are
     not staff-operable yet.
   - `program_eligibility_rules`, `lead_nurture_targets`, `v_assessment_summary`,
     and `v_lead_overview` exist in the schema/types but have no staff-facing
     use in `src`.
   - Build the outcome dashboard and the profile/eligibility workspace before
     adding more unrelated screens.

7. Family applications are only partially surfaced.
   - The data model and conversion work are present, but the Applications and
     Case views do not yet provide the requested "main application with family
     applications together" operational experience or a reusable action prompt
     across related applications.

### P2 - hardening and scale

8. Release gates are not strict enough.
   - `next.config.mjs` ignores TypeScript and ESLint build errors.
   - CI has a useful ratchet, but it accepts up to 34 TypeScript errors and
     does not run the Vitest suite. The local `npm test` command also did not
     complete during this audit.
   - There are 605 direct `.from()` calls, one `.range()` pagination call, and
     112 `(supabase as any)` casts. Data access is still highly scattered.

9. A dead duplicate source path remains outside the CI guard.
   - `src/components/src/components/VisaCombobox.tsx` is tracked, although the
     compiled component is `src/components/VisaCombobox.tsx`.
   - The current CI guard only checks `src/src`, so this variant can mislead a
     future upload without failing CI. Delete it and broaden the guard.

10. Architecture documents disagree with current product decisions.
   - The May lifecycle blueprint specifies a Day 0/1/3/7/10/14 sequence and
     requires call duration/emotional state. Current agreed design is calls at
     Day 3/7/14, messages at Day 2/4/6/10, and removes those two call fields.
   - `PROJECT_STATE.md` is from July 29 and contains historical claims that no
     longer describe current production.
   - Create one short, versioned operational rules document and mark older
     documents as historical. The database engine must be generated from that
     one decision set.

## Recommended build order

1. Finish P0 stage-task consolidation and universal mandatory stage notes.
2. Implement in-app WhatsApp conversation opening and then remove `wa.me`
   outreach from operational screens.
3. Add lead document requests/uploads and carry them into cases on conversion.
4. Build the Outcome Review/Completed module, including reapplication,
   appeal/reconsideration, and judicial-review successor creation.
5. Build the profile intelligence workspace: canonical assessment answers,
   15-20 eligibility filters, saved segments, nurture reasons/dates, and the
   one-year Canadian-experience milestone reminder.
6. Complete family application grouping and cross-application action prompts.
7. Harden: remove dead source paths, pay down casts/types, centralize data
   access, add pagination, and make typecheck/lint/tests real blocking gates.

## Release rule

Keep building, but release in small vertical slices. Every slice must contain:
schema migration, generated types, one UI workflow, RLS check, a test with a
non-production contact, and a rollback note. A Saturday audit is sensible, but
it should verify this fixed checklist instead of trying to rediscover what was
changed during the week.
