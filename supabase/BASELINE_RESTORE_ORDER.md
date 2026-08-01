# SQL Baseline — Restore Order

**Captured:** 31 July 2026 (schema dump refreshed 1 Aug 2026)
**Source project:** `ocnsavosheduqzmeyvcd` (`study2pr-prod`), PostgreSQL 17.6, ap-northeast-1
**Verified against live:** 1 August 2026

---

## Read this before you restore anything

`supabase db dump` / `pg_dump` alone is **NOT a complete baseline for this database.**

A database rebuilt from `baseline_schema.sql` by itself would have **every function
defined and none of them ever firing**, and **none of the six automations running** —
silently, with no error at restore time and no error at runtime. No stage history,
no audit actor, no engine-created tasks, no timeline rows, no SLA sweep, no outbox
worker, no expiry alerts.

That is the failure mode this file exists to prevent.

**Two categories of object are missing from the dump:**

| Missing | Why the dump omits it | Recovered by |
|---|---|---|
| **34 triggers** | Not emitted by the dump as produced here | `baseline_2026-07-31_part1_extensions_triggers.sql` |
| **6 pg_cron schedules** | They live in the `cron.job` **table**, not in the schema — `pg_dump` never captures them | `baseline_2026-07-31_part2_cron_jobs.sql` |

---

## Restore order — all three files, in this sequence

```
1. baseline_schema.sql
      tables, functions, policies, views, indexes, constraints

2. baseline_2026-07-31_part1_extensions_triggers.sql
      9 extensions + the 34 triggers

3. baseline_2026-07-31_part2_cron_jobs.sql
      the 6 pg_cron schedules
```

Order matters: triggers reference functions defined in step 1, and the cron commands
call functions defined in step 1.

---

## Verified object counts (live DB vs. baseline files, 1 Aug 2026)

| Object | Live DB | `baseline_schema.sql` | `part1` | `part2` |
|---|---|---|---|---|
| Tables | 97 | **97** ✅ | — | — |
| Policies | 143 | **143** ✅ | — | — |
| Functions (ours, non-extension) | 83 | **83** ✅ | — | — |
| Views + materialized views | 25 | **25** ✅ (23 + 2 matviews) | — | — |
| Triggers (non-internal) | 34 | **0** ❌ | **34** ✅ | — |
| pg_cron jobs | 6 | **0** ❌ | — | **6** ✅ |

Counting method for triggers excludes `tgisinternal` (FK/constraint-enforcement
triggers), which Postgres recreates automatically from the constraint definitions in
step 1 and which must **not** be restored by hand.

> **Correction to earlier handoff notes:** previous documents stated **37** triggers.
> The verified live count is **34** non-internal triggers, and `part1` contains
> exactly 34. The two now agree; the "37" figure was counted with a different filter.

The dump is post-Phase-2A: it contains `v_stage_events`, the view created by
migration `p2a_01_normalize_stage_reporting`.

---

## Fidelity of each file

`part1` and `part2` were generated from PostgreSQL's own system catalogs
(`pg_get_triggerdef()`, `cron.job`) — these are byte-exact definitions produced by
Postgres, not hand-reconstructed SQL.

`baseline_schema.sql` is a `supabase db dump` (Docker + WSL were installed on
1 Aug 2026 specifically to make this possible).

> **Note on the `part1` file header:** its comment block describes an earlier,
> abandoned 5-part scheme (parts 2–5 for policies / functions / views / tables) that
> was superseded once `supabase db dump` became runnable. Ignore that header's apply
> order. **This document is the authoritative restore order.** The trigger SQL in the
> file itself is unaffected and correct.

---

## What is NOT in any of these files

- **Data.** These are schema-only. There is no row data in any of the three files.
- **Storage buckets** (5) and their policies.
- **Auth users and identities.**
- **Vault secrets.**
- **Database roles and their grants** beyond what the dump emits.

A true disaster-recovery plan needs a data backup as well. Supabase's own PITR /
daily backups cover that; these files cover the *structure*, which is what was
scattered across ~92 hand-applied patch files and could not otherwise be reproduced.

---

## Going forward

Migration history is now authoritative: **21 recorded migrations**, 12 of them from
the Phase 1–3 remediation work, each carrying rollback SQL in its header. New schema
changes should go through `supabase migration` rather than hand-applied patches, so
that this baseline does not drift again.

Re-verify these counts before relying on the baseline after any significant schema
change.
