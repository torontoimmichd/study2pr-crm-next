# P3.7 — Stage tasks: classification before any wiring

**Date:** 1 August 2026 · **Status:** classified, **awaiting sign-off — nothing changed yet**

Per instruction: *do not wire up or delete business workflow tasks blindly.
Classify each as active workflow, obsolete, or duplicate, then wire only the
valid ones into the single task engine.*

All 17 definitions in `createCaseStageTasks` are below. Every "duplicate" call
is backed by a live row count, not by reading the code.

---

## The trap that makes this non-obvious

`createCaseTasks` — a **different** function, fired on case creation — already
creates three tasks that are live in the database today:

| Title | Live rows |
|---|---|
| Send document checklist | 4 |
| Confirm payment arrangements | 4 |
| Week 2 — document collection status | 4 |

So simply renaming the dead stage keys to real ones would **recreate the exact
duplicate-task defect that P1.3 and Phase 2A just removed** — two writers, two
near-identical titles, dedup blind to both because the wording differs.

That is why this needed classifying rather than fixing.

---

## Classification

### ⛔ DUPLICATE — do not wire (4)

| # | Title | Duplicates | Evidence |
|---|---|---|---|
| 3 | Send full document checklist | `createCaseTasks` → "Send document checklist" | 4 live rows |
| 4 | Document collection — Week 2 review | `createCaseTasks` → "Week 2 — document collection status" | 4 live rows |
| 12 | Prepare client for biometrics / medical (if required) | DB engine → "Biometrics check — day 28 post-submission" | SLA `BIOMETRICS_CHECK_D28`, fires on `submission` |
| 16 | Call client — explain refusal reasons | DB engine → "[URGENT] Refusal — senior call within 1 hour" | SLA `ADR_RESPONSE_2HR` |

#16 is the one already firing in production. A refused case currently produces
two "call the client" tasks. The DB one carries the SLA code and wins, per the
P1.3 precedent.

### ⚠️ OVERLAPPING — needs your judgement (1)

| # | Title | Overlaps | Question |
|---|---|---|---|
| 17 | Assess appeal / reconsideration options | DB engine → "Reapplication strategy — GCMS notes should have arrived" (day 30) | Are these one step or two? The DB task assumes GCMS notes have arrived; yours may be the earlier triage. If they are two genuine steps, keep both. |

### ✅ ACTIVE WORKFLOW — no equivalent anywhere (12)

| # | Stage (real code) | Title |
|---|---|---|
| 1 | `intake` | Send client welcome pack |
| 2 | `intake` | Confirm retainer / engagement agreement signed |
| 5 | `review` | Review all documents for completeness |
| 6 | `review` | Draft application forms |
| 7 | `review` | Client review and sign-off |
| 8 | `submission` | Confirm submission receipt / acknowledgement |
| 9 | `submission` | Advise client of processing timeline |
| 10 | `submission` | Month 1 processing check-in |
| 11 | `ircc_processing` | Monitor IRCC / government portal for updates |
| 13 | `approved` | Notify client of approval |
| 14 | `approved` | Guide client through post-approval steps |
| 15 | `approved` | Request referral / Google review |

13–15 already fire today. 1–11 have never created a row.

**Note on #2:** distinct from `createCaseTasks`' "Confirm payment arrangements" —
a signed retainer and a payment plan are different compliance artefacts for a
CICC-licensed practice. Kept separate deliberately. Say if that's wrong.

### 🕳️ GAPS — no definition exists

`decision` and `withdrawn` have no task definitions on either side. `withdrawn`
in particular probably needs a file-closure / retainer-refund step.

---

## Recommended shape — one writer, not two repaired ones

Do **not** repair the client function's keys. That leaves two writers and
reopens the SSOT problem `docs/SSOT_OWNERSHIP.md` exists to prevent.

Instead:

1. Port the **9 dormant ACTIVE definitions** (#1, 2, 5–11) into
   `fn_engine_on_stage_change`, keyed off `case_stages_ref` codes.
2. Leave #13–15 (`approved`) where they are for now, or move them in the same
   pass — they already work, so this is a migration, not a fix.
3. Drop the 4 DUPLICATE definitions entirely.
4. Delete `createCaseStageTasks` and its call site in `CaseDetail.tsx` once the
   DB side covers everything, so the trigger becomes the sole writer — the same
   move that fixed P1.2, P1.3 and P1.4.

The trigger approach also covers kanban drag-drop, imports, RPC and cron
automatically. The client function only ever ran from `CaseDetail.moveStage`.

**Volume impact if approved:** ~9 additional tasks per case lifecycle, spread
across `intake → review → submission → ircc_processing`, not all at once.
Staff capacity is the real question here, not the engineering.

---

## What I need from you

For each ✅ row: **keep**, **drop**, or **reword**. For #17: one step or two?
Then this becomes a single migration plus a code deletion.
