# SINGLE SOURCE OF TRUTH — OWNERSHIP CONTRACT
**Version 1.0 · 30 July 2026 · Status: DESCRIPTIVE (what is true today), not yet PRESCRIPTIVE**

This document exists because the certification found that **9 of 15 core business
capabilities had more than one owner**. Phase 1 resolved three of them. This file records
who owns what *today*, so that nobody deletes a duplicate before proving it is unused —
and so the next developer can answer "where does this rule live?" in one place.

> **Read this before changing task creation, timelines, notes, or stage handling.**
> Every "REMOVED" line below was verified against live data before removal.

---

## Legend

| Marker | Meaning |
|---|---|
| ✅ **SSOT** | Single owner. Do not add a second writer. |
| ⚠️ **SPLIT** | Two owners exist deliberately, boundary documented. Do not delete either half yet. |
| 🔴 **CONTESTED** | Two owners, boundary NOT yet decided. Phase 2A must resolve. |

---

## 1. STAGE HISTORY (`case_stage_history`) — ✅ SSOT

| | |
|---|---|
| **Owner** | DB trigger `trg_cases_stage` → `log_stage_change()` |
| **Writes** | exactly one row per `current_stage_code` change |
| **Actor** | `changed_by = auth.uid()`; when null (cron / service_role / SQL editor / import) the row is marked `note = 'system'` |
| **Removed 2026-07-30** | client inserts in `views/CaseDetail.tsx` (`moveStage`) and `views/Cases.tsx` (kanban drag-drop) |

**Rule: never insert into `case_stage_history` from application code.** The trigger fires on
the table, so it already covers every path — detail dropdown, kanban, RPCs
(`mark_case_outcome`, `bulk_process_prospectives`, `consent_prospective_to_case`), cron
sweeps, imports and service-role writes. Verified live in both auth contexts.

*Known limitation:* you can distinguish human vs automation, but not *which* automation.
If that is needed, add a `source text` column — **do not** add a second writer.

---

## 2. CASE STAGE TIMELINE (`activity_timeline`, case scope) — ✅ SSOT

| | |
|---|---|
| **Owner** | DB trigger `trg_engine_stage_change` → `fn_engine_on_stage_change()` |
| **Event type** | `stage_change`, with `metadata {from, to}` |
| **Removed 2026-07-30** | client `writeTimeline({event_type:'case_stage_change'})` in `CaseDetail.tsx` |

The DB writer is strictly more complete — it also fires on kanban drag-drop, which the
client write never covered.

> ⚠️ **Reporting caveat (Phase 2A task):** historical rows exist under **both**
> `case_stage_change` (10 rows, client-written, ≤ 2026-07-29) and `stage_change`
> (7 case-scoped rows, trigger-written). Any stage analytics must treat both as the same
> event until a normalising view exists. **`stage_change` is also legitimately used for
> *lead* lifecycle changes (7 rows)** — do not blindly merge the two event types; scope by
> `case_id IS NOT NULL`.

---

## 3. TASK CREATION — ⚠️ SPLIT (documented boundary)

The database does **not** own all task creation. This is deliberate for now.

### DB-owned (fires on table events / cron — covers every path)
| Function | Trigger | Creates |
|---|---|---|
| `fn_engine_on_lead_created` | `leads` INSERT | **"First call — new lead"** (`sla_rule_code='NEW_LEAD_FIRST_CALL'`) |
| `fn_engine_on_case_created` | `cases` INSERT | 2 onboarding tasks |
| `fn_engine_on_stage_change` | `cases` UPDATE | biometrics, upsell, 2× refusal |
| `fn_assessment_on_submit` | `assessments` INSERT | 1 |
| `fn_engine_sla_sweep` | cron */15 | SLA escalations |
| `fn_engine_expiry_sweep` | cron 03:30 | expiry follow-ups |

### Client-owned (`src/lib/taskEngine.ts`) — **no DB equivalent, do not delete**
| Function | Called from | Status |
|---|---|---|
| `createLeadTasks` | `NewLeadDialog` | Day 1/3/7/14 follow-ups only (first-call **removed** 2026-07-30) |
| `createStageTasks` | `LeadDetail`, `LeadDetailPage` | **client-only** — lead stage tasks |
| `createCaseTasks` | `ConvertLeadWizard`, `NewCaseDialog` | overlaps `fn_engine_on_case_created` — 🔴 review in 2A |
| `createPaymentFollowUpTasks` | `GenerateInvoiceDialog` | **client-only** |
| `createCallbackTask` | `LogCallDialog` | **client-only** |
| `createCaseStageTasks` | `CaseDetail` | overlaps `fn_engine_on_stage_change` — 🔴 review in 2A |
| `createDocFollowUpTasks` | **no callers** | dead — remove in Phase 4 after re-proving |
| *(direct insert)* `NewTaskDialog.tsx:120` | manual task UI | **client-only** |

**Rule: before removing anything from `taskEngine.ts`, prove the DB has an equivalent that
fires on the same table event.** The first-call duplicate hid for months because the two
engines used *different titles*, so title-based dedup could not see the clash.

> **Known pre-existing gap (not introduced by Phase 1):** leads created via
> `IntakeForm.tsx` never receive the Day 1/3/7/14 follow-ups, because only `NewLeadDialog`
> calls `createLeadTasks`. The DB first-call task fires on all paths. Decide in 2A whether
> the day-N cadence should move to the DB engine so every intake path behaves identically.

---

## 4. NOTES — 🔴 CONTESTED (three paths, resolve in Phase 2A)

| Path | Writes to | Timeline row | Visible in Notes panel? |
|---|---|---|---|
| `NotesPanel.tsx` (Lead + Case) | `entity_notes` | via trigger `fn_entity_notes_timeline`, body intentionally NULL | ✅ yes |
| `LeadDetailPage.saveNotes` | **`leads.notes` free-text blob** | client `writeTimeline` "Note saved" | ❌ no — different feature |
| `EntityTimeline.saveNote` | **`activity_timeline` directly** | itself, with body text | ❌ **no — never reaches `entity_notes`** |

**These are not duplicates of each other** — the middle one is the legacy single-blob notes
field, a genuinely different feature. But the third path is a real integrity split: notes
added from the timeline widget are invisible in the Notes panel.

**Do not "fix" the third path without a product decision:** routing it through
`entity_notes` would stop note text appearing in the timeline, because
`32_timeline_note_body_off.sql` deliberately turned note bodies off there.

Also note `case_notes` (0 rows) duplicates `entity_notes` (40 rows) at the schema level.

---

## 5. AUDIT (`audit_log`) — ✅ SSOT

| | |
|---|---|
| **Owner** | `src/lib/audit.ts` → `writeAudit()`, 94 call sites |
| **Enabled** | policy `p_audit_staff_insert` (added 2026-07-30); partitions to 2027-01 + default; monthly cron `audit_partition_maintenance` |
| **Verified** | first row recorded 2026-07-30 09:51 UTC after ~0 rows since inception |

The trigger-based alternative (`_audit_row_changes`, `trg_audit_*`) designed in
`00_APPLY_ALL_PENDING_UPDATED.sql` was **never installed**. Do not install it without
removing the client writer first — that would double every audit row.

*Limitation:* `actor_id` is NULL for service-role and cron writes, same as `changed_by`.

---

## 6. OTHER CAPABILITIES

| Capability | Owner | Status |
|---|---|---|
| **Communications / WhatsApp** | `outbound_messages` → cron → `comms-worker` → `wa-send` | ✅ SSOT |
| **Templates** | `messages` where `is_template = true` (managed by `AdminTemplates`) | ✅ SSOT — note the table name; `admin_templates` does **not** exist |
| **Finance ledger** | `finance_entries` + `v_case_financials` + `fn_finance_entry_timeline` | ✅ SSOT (UI recovered 2026-07-30) |
| **Eligibility / assessment** | `fn_assessment_score`, `program_eligibility_rules` | ✅ SSOT (0 rows — unused) |
| **Documents / checklist** | `case_documents` + `populate_case_documents_from_rules` | ✅ SSOT (0 rows — unused) |
| **Expiry** | `expiry_alert_rules` (13) + `fn_engine_expiry_sweep` + `/admin/expiry` | ✅ SSOT (UI recovered 2026-07-30) |
| **Permissions** | `auth_*` **and** `is_staff` **and** `fn_is_*` **and** `comm_*` | 🔴 **CONTESTED — 4 families.** Highest-value 2A target |
| **Reporting** | `Reports.tsx` + 2 matviews + 9 `v_*` views | 🔴 fragmented |

---

## 7. STANDING RULES

1. **One writer per fact.** If a DB trigger already writes it, application code must not.
2. **Table-level triggers beat screen-level code** — they cover imports, RPCs, cron and
   service-role automatically.
3. **Prove before deleting.** Grep for callers, check live row counts, and diff against
   `git HEAD` (not a ZIP — a stale ZIP nearly reverted 161 lines of `Cases.tsx`).
4. **Never add files under `src/src/`.** Nothing there compiles (`@/*` → `./src/*`) and CI
   now blocks growth. It already stranded the Notes tab, Finance tab and `/admin/expiry`.
5. **A green Vercel build does not mean types are clean** — `ignoreBuildErrors: true`.
   Trust the CI ratchet instead.

---

## 8. PHASE 2A BACKLOG (in priority order)

1. **Unify the four permission families** into one, and align the app's `StaffRole` union
   with the DB role vocabulary (they currently disagree).
2. **Decide task ownership** for the two overlapping pairs (`createCaseTasks`,
   `createCaseStageTasks`) and the intake-form day-N gap.
3. **Normalise stage reporting** — one view treating `stage_change` (case-scoped) and
   `case_stage_change` as the same event.
4. **Resolve the third notes path** (`EntityTimeline.saveNote`) — needs a product decision.
5. **Retire `case_notes`** in favour of `entity_notes`.
6. **Regenerate `types.ts`** — 6 of 6 tables sampled are missing from it, which is the root
   cause of most of the 149 remaining type errors and the 105 `(supabase as any)` casts.
