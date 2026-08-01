-- ============================================================================
-- P4.1 — COMPLETED / OUTCOMES MODULE: schema foundation
-- ============================================================================
-- DESIGN CONSTRAINT (from the brief): the Completed module is a FILTERED VIEW
--   over the same `cases` row. Nothing is moved. Nothing is copied. Successors
--   are linked, never duplicated. The original refusal record stays immutable.
--
-- A refusal does NOT become "completed". It enters an OUTCOME REVIEW state and
--   waits for a recorded decision: close the file, reapply, seek
--   appeal/reconsideration, or escalate to judicial review. Only when work
--   actually begins is a successor case created.
--
-- JUDICIAL REVIEW DEADLINE — legal basis, verified against statute rather than
--   taken from a summary:
--     IRPA s.72(2)(b): notice must be served and the application filed within
--       15 days  — matter arising IN Canada
--       60 days  — matter arising OUTSIDE Canada
--     running from "the day on which the applicant is notified of or otherwise
--     becomes aware of the matter".
--
--   That start date is NOT the decision date. A decision made on the 1st and
--   communicated on the 9th leaves 15 days from the 9th. So the clock is driven
--   by `decision_notified_on`, stored separately from cases.decision_at.
--   Extensions exist only "for special reasons" and must be requested inside
--   the leave application; the 15-day limit is rarely extended. The deadline is
--   therefore modelled as hard, not advisory.
--
-- ROLLBACK:
--   drop view if exists public.v_case_outcomes;
--   drop trigger if exists trg_case_outcome_immutable on public.cases;
--   drop function if exists public.fn_guard_decided_case_immutable();
--   drop trigger if exists trg_outcome_review_guard on public.case_outcome_reviews;
--   drop function if exists public.fn_guard_outcome_review();
--   drop table if exists public.case_outcome_reviews;
--   alter table public.cases drop column if exists parent_case_id,
--     drop column if exists origin_case_id, drop column if exists case_kind;
--   alter table public.cases drop constraint cases_outcome_check,
--     add constraint cases_outcome_check check (outcome in
--       ('approved','refused','withdrawn','pending') or outcome is null);
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Case lineage. Linked, never copied.
-- ---------------------------------------------------------------------------
alter table public.cases
  add column if not exists parent_case_id uuid references public.cases(id) on delete set null,
  add column if not exists origin_case_id uuid references public.cases(id) on delete set null,
  add column if not exists case_kind text not null default 'primary';

do $$ begin
  alter table public.cases add constraint cases_case_kind_check
    check (case_kind in ('primary','reapplication','judicial_review','appeal_reconsideration'));
exception when duplicate_object then null; end $$;

comment on column public.cases.parent_case_id is
  'Immediate predecessor. A reapplication or judicial-review case points at the refused case it came from. Never used to copy data - the predecessor keeps its own timeline, documents, tasks and messages.';
comment on column public.cases.origin_case_id is
  'Root of the lineage chain, so a third-generation case still resolves to the original application in one hop.';
comment on column public.cases.case_kind is
  'primary | reapplication | judicial_review | appeal_reconsideration. Drives which workflow and SLA set applies.';

-- A case cannot be its own parent or origin.
do $$ begin
  alter table public.cases add constraint cases_no_self_lineage
    check (parent_case_id is distinct from id and origin_case_id is distinct from id);
exception when duplicate_object then null; end $$;

create index if not exists idx_cases_parent_case_id on public.cases(parent_case_id) where parent_case_id is not null;
create index if not exists idx_cases_origin_case_id on public.cases(origin_case_id) where origin_case_id is not null;

-- ---------------------------------------------------------------------------
-- 2) Outcome vocabulary. 'closed' added; existing values preserved.
-- ---------------------------------------------------------------------------
alter table public.cases drop constraint if exists cases_outcome_check;
alter table public.cases add constraint cases_outcome_check
  check (outcome is null or outcome in ('approved','refused','withdrawn','closed','pending'));

-- ---------------------------------------------------------------------------
-- 3) The Outcome Review record. One per case, created when a case is refused.
-- ---------------------------------------------------------------------------
create table if not exists public.case_outcome_reviews (
  id                     uuid primary key default gen_random_uuid(),
  case_id                uuid not null unique references public.cases(id) on delete cascade,

  opened_at              timestamptz not null default now(),
  opened_by              uuid references public.staff_profiles(id) on delete set null,

  refusal_reason_code    text,
  refusal_reason_notes   text,

  -- Starts the IRPA s.72(2)(b) clock. Deliberately separate from decision_at.
  decision_notified_on   date,
  matter_locale          text check (matter_locale in ('in_canada','outside_canada')),

  review_status          text not null default 'pending'
                           check (review_status in ('pending','decided')),
  chosen_path            text check (chosen_path in
                           ('close_file','reapplication','appeal_reconsideration','judicial_review')),
  path_rationale         text,

  decided_by             uuid references public.staff_profiles(id) on delete set null,
  decided_at             timestamptz,
  successor_case_id      uuid references public.cases(id) on delete set null,

  -- Judicial review gate: a JR case may only exist once counsel has accepted.
  legal_accepted_by      uuid references public.staff_profiles(id) on delete set null,
  legal_accepted_at      timestamptz,
  legal_accepted_note    text,

  -- IRPA s.72(2)(b). 15 days in Canada, 60 outside, from notification.
  jr_filing_deadline date generated always as (
    case
      when decision_notified_on is null or matter_locale is null then null
      when matter_locale = 'in_canada' then decision_notified_on + 15
      else decision_notified_on + 60
    end
  ) stored,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- A decided review must say what was decided, by whom and when.
  constraint outcome_review_decided_complete check (
    review_status = 'pending'
    or (chosen_path is not null and decided_at is not null)
  ),
  -- Judicial review requires counsel acceptance on the record first.
  constraint outcome_review_jr_needs_counsel check (
    chosen_path is distinct from 'judicial_review'
    or (legal_accepted_by is not null and legal_accepted_at is not null)
  ),
  -- Judicial review needs the deadline inputs.
  constraint outcome_review_jr_needs_clock check (
    chosen_path is distinct from 'judicial_review'
    or (decision_notified_on is not null and matter_locale is not null)
  )
);

comment on table public.case_outcome_reviews is
  'Outcome Review state for a refused case. A refusal is NOT complete until one path is recorded here. The successor case is linked via successor_case_id and created only when work begins - the refused case is never moved or copied.';
comment on column public.case_outcome_reviews.jr_filing_deadline is
  'Generated. IRPA s.72(2)(b): decision_notified_on + 15 days (matter arising in Canada) or + 60 days (outside Canada). Hard deadline - extensions require special reasons and are rarely granted for the 15-day limit.';

create index if not exists idx_outcome_reviews_pending
  on public.case_outcome_reviews(review_status) where review_status = 'pending';
create index if not exists idx_outcome_reviews_jr_deadline
  on public.case_outcome_reviews(jr_filing_deadline)
  where jr_filing_deadline is not null and review_status = 'pending';

drop trigger if exists trg_outcome_reviews_updated on public.case_outcome_reviews;
create trigger trg_outcome_reviews_updated
  before update on public.case_outcome_reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) RLS. Staff only, matching the family used everywhere else.
-- ---------------------------------------------------------------------------
alter table public.case_outcome_reviews enable row level security;

drop policy if exists p_outcome_reviews_staff_read   on public.case_outcome_reviews;
drop policy if exists p_outcome_reviews_staff_write  on public.case_outcome_reviews;
drop policy if exists p_outcome_reviews_staff_update on public.case_outcome_reviews;

create policy p_outcome_reviews_staff_read on public.case_outcome_reviews
  for select to authenticated using (public.fn_is_staff());
create policy p_outcome_reviews_staff_write on public.case_outcome_reviews
  for insert to authenticated with check (public.fn_is_staff());
create policy p_outcome_reviews_staff_update on public.case_outcome_reviews
  for update to authenticated using (public.fn_is_staff()) with check (public.fn_is_staff());

revoke all on public.case_outcome_reviews from public, anon;
grant select, insert, update on public.case_outcome_reviews to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) Guard: only owner/admin may record counsel acceptance, and a decided
--    review cannot be silently re-decided.
-- ---------------------------------------------------------------------------
create or replace function public.fn_guard_outcome_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'UPDATE' then
    if (new.legal_accepted_by is distinct from old.legal_accepted_by
        or new.legal_accepted_at is distinct from old.legal_accepted_at)
       and not public.fn_is_owner_admin() then
      raise exception 'Only owner/admin may record legal acceptance for judicial review';
    end if;

    if old.review_status = 'decided' and new.review_status = 'decided'
       and new.chosen_path is distinct from old.chosen_path
       and not public.fn_is_owner_admin() then
      raise exception 'A decided outcome review cannot be re-pathed. Reopen it explicitly.';
    end if;
  end if;

  if new.review_status = 'decided' and new.decided_at is null then
    new.decided_at := now();
  end if;
  if new.review_status = 'decided' and new.decided_by is null then
    new.decided_by := auth.uid();
  end if;

  return new;
end
$fn$;

revoke execute on function public.fn_guard_outcome_review() from public, anon, authenticated;

drop trigger if exists trg_outcome_review_guard on public.case_outcome_reviews;
create trigger trg_outcome_review_guard
  before insert or update on public.case_outcome_reviews
  for each row execute function public.fn_guard_outcome_review();

-- ---------------------------------------------------------------------------
-- 6) Immutability of the original refused case.
--    Notes and assignment may still change; the decision facts may not.
-- ---------------------------------------------------------------------------
create or replace function public.fn_guard_decided_case_immutable()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_decided boolean;
begin
  select exists (
    select 1 from public.case_outcome_reviews r
    where r.case_id = old.id and r.review_status = 'decided'
  ) into v_decided;

  if not v_decided then
    return new;
  end if;

  if new.outcome            is distinct from old.outcome
  or new.decision_at        is distinct from old.decision_at
  or new.current_stage_code is distinct from old.current_stage_code
  or new.client_id          is distinct from old.client_id
  or new.visa_type_id       is distinct from old.visa_type_id then
    raise exception
      'Case % has a decided outcome review and its decision record is immutable. Create a successor case instead of editing this one.', old.id;
  end if;

  return new;
end
$fn$;

drop trigger if exists trg_case_outcome_immutable on public.cases;
create trigger trg_case_outcome_immutable
  before update on public.cases
  for each row execute function public.fn_guard_decided_case_immutable();

-- ---------------------------------------------------------------------------
-- 7) The module's read model. security_invoker per p3_03 - no new definer view.
-- ---------------------------------------------------------------------------
create or replace view public.v_case_outcomes
with (security_invoker = true) as
select
  c.id                        as case_id,
  c.case_code,
  c.client_id,
  c.case_kind,
  c.parent_case_id,
  c.origin_case_id,
  c.current_stage_code,
  c.outcome,
  c.decision_at,
  c.case_manager_id,
  c.senior_advisor_id,
  s.is_terminal               as stage_is_terminal,
  r.id                        as outcome_review_id,
  r.review_status,
  r.chosen_path,
  r.refusal_reason_code,
  r.decision_notified_on,
  r.matter_locale,
  r.jr_filing_deadline,
  r.legal_accepted_at,
  r.successor_case_id,
  case
    when c.current_stage_code = 'refused' and (r.review_status is null or r.review_status = 'pending')
      then 'outcome_review'
    when c.current_stage_code = 'refused' and r.chosen_path = 'close_file'            then 'closed'
    when c.current_stage_code = 'refused' and r.chosen_path = 'judicial_review'       then 'judicial_review'
    when c.current_stage_code = 'refused' and r.chosen_path = 'reapplication'         then 'reapplication'
    when c.current_stage_code = 'refused' and r.chosen_path = 'appeal_reconsideration' then 'appeal_reconsideration'
    when c.current_stage_code = 'approved'  then 'approved'
    when c.current_stage_code = 'withdrawn' then 'withdrawn'
    else c.current_stage_code
  end as outcome_state,
  case
    when r.jr_filing_deadline is null then null
    else (r.jr_filing_deadline - current_date)
  end as jr_days_remaining
from public.cases c
left join public.case_stages_ref s on s.code = c.current_stage_code
left join public.case_outcome_reviews r on r.case_id = c.id;

comment on view public.v_case_outcomes is
  'Read model for the Completed/Outcomes module. A filtered projection over cases - it moves and copies nothing. outcome_state derives the module bucket; a refused case with no decided review reads as outcome_review, never as completed.';

grant select on public.v_case_outcomes to authenticated, service_role;
