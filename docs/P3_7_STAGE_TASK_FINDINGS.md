# P3.7 — `createCaseStageTasks` vs `fn_engine_on_stage_change`

**Investigated:** 1 August 2026 · **Status:** diagnosed, **not fixed — needs a product decision**

This was the last unexamined task-duplication candidate. The same method that
caught the other two was applied: list the titles each side creates, then query
live data for both sets.

---

## Answer to the question asked: there is NO duplication

The two writers produce **completely disjoint titles**. This is not a third
instance of the defect fixed in P1.3 and Phase 2A.

| Stage code | `createCaseStageTasks` (client) | `fn_engine_on_stage_change` (DB) |
|---|---|---|
| `submission` | — *(app has no matching key)* | Biometrics check — day 28 post-submission |
| `approved` | Notify client of approval · Guide client through post-approval steps · Request referral / Google review | Upsell: *&lt;trigger label&gt;* |
| `refused` | Call client — explain refusal reasons · Assess appeal / reconsideration options | [URGENT] Refusal — senior call within 1 hour · Reapplication strategy — GCMS notes should have arrived |

No dedup rule is needed. **No change should be made on duplication grounds.**

---

## But the investigation found something larger

`createCaseStageTasks` is keyed by stage code, and **5 of its 7 keys do not
exist in `case_stages_ref`.**

```
real stage codes   intake  documents  review  submission  ircc_processing
                   decision  approved  refused  withdrawn

app engine keys    onboarding  docs_collection  application_prep  submitted
                   processing  approved  refused
                   ^^^^^^^^^^  ^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^  ^^^^^^^^^
                   ^^^^^^^^^^  <- these five can never match
```

Only `approved` and `refused` line up. The source comment directly above the
map says *"Stage codes must match the case_stages_ref table"* — they do not.

**Proven against live data, not inferred:**

| Check | Result |
|---|---|
| Task rows ever created from the 12 definitions under dead keys | **0** |
| Task rows ever created from the 5 definitions under live keys | 3 |
| Stage transitions into stages the app engine handles | 8 |
| Stage transitions into stages the app engine **misses** | **28** |

So **12 of the 17 task definitions in this function have never produced a single
row**, and 28 stage transitions passed through the client engine creating
nothing. The stage codes are near-misses of real ones (`submitted` vs
`submission`, `processing` vs `ircc_processing`, `docs_collection` vs
`documents`), which is why this looks like working code on inspection.

This is the same failure shape as the Phase 1 findings: code that appears wired
up, fails silently, and leaves no error to notice.

---

## Why this is NOT being fixed in this pass

Renaming the keys to the real stage codes is a two-line change, but it is **not
a bug fix — it is a behaviour change**. It would immediately begin creating 12
tasks per case lifecycle that the business has never actually received. Every
case currently moving through `intake → documents → review → submission →
ircc_processing → decision` would start generating work items nobody has
scheduled staff capacity for.

**The decision belongs to the business, and it is three-way:**

1. **Wire them up** — map the keys to real codes. The tasks were clearly
   intended; they were simply mis-keyed. Expect ~12 extra tasks per case.
2. **Delete them** — if the DB engine's SLA-coded tasks are the real process,
   these 12 are aspirational scaffolding and should go, taking ~200 lines with
   them.
3. **Wire up a subset** — pick which of the 12 reflect real practice.

Whichever is chosen, the stage codes must come from `case_stages_ref` rather
than being retyped, or this will drift again.

---

## Secondary note: semantic overlap on `refused`

Both writers create a "call the client about the refusal" task, under different
titles:

- client: *Call client — explain refusal reasons*
- DB: *[URGENT] Refusal — senior call within 1 hour* (SLA `ADR_RESPONSE_2HR`)

These are the same action. They do not trip any dedup because the titles differ,
so a refused case produces two calls' worth of task. The DB one carries the SLA
rule code and should win, consistent with the P1.3 precedent. Fold this into
whichever option is chosen above.
