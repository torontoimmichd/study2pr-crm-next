-- ============================================================================
-- P4.2 — REPAIR THE OUTCOME WRITE PATH (and stop discarding anchor dates)
-- ============================================================================
-- WHAT WAS BROKEN: public.mark_case_outcome() wrote seven columns that exist on
--   NO table in this database - decision_date, study_end_date,
--   document_expiry_date, pgwp_expiry_date, landing_date,
--   first_canadian_work_day, checklist_step - and referenced an
--   `on_case_decision` trigger that does not exist. Every call raised.
--
--   MarkOutcomePopover.tsx caught the error and fell back to a bare
--   `update cases set outcome, current_stage_code`, which DROPS every anchor
--   date the user typed, then showed "Marked approved".
--
--   Consequence, verified: cases.outcome was NULL on all 19 cases including the
--   4 sitting at stage 'approved'. An outcome had never once been recorded.
--   And expiry_items had 0 rows against 13 active alert rules - the expiry
--   engine has never had anything to work on, because its input was being
--   thrown away at the point of capture.
--
-- WHERE THE ANCHORS BELONG - decided from evidence, not invented:
--   expiry_items is already the owner of expiry dates. It carries
--   (client_id, case_id, item_type, label, expires_on, source_document_id) and
--   is already auto-populated from uploaded documents by
--   fn_engine_doc_expiry_sync. fn_engine_expiry_sweep joins it to
--   expiry_alert_rules on item_type. So expiry anchors become expiry_items
--   rows - NOT new columns on cases, which would have created a second source
--   of truth for the same fact.
--
--   But only TWO of the five UI anchors are expiries:
--       document_expiry_date  "Permit expiry"     -> expiry_items
--       pgwp_expiry_date      "PGWP expiry"       -> expiry_items (work_permit)
--   The other three are MILESTONES, not expiries - nothing expires on them:
--       study_end_date           (drives PGWP eligibility)
--       landing_date             (starts the citizenship clock)
--       first_canadian_work_day  (starts Canadian work experience)
--   Forcing those into expiry_items would fire "expiring soon" alerts on dates
--   that are not expiries. They get their own small table instead.
--
-- SIGNATURE UNCHANGED so the existing frontend starts working with no code
--   deploy. The UI already sends exactly these arguments.
--
-- VERIFIED against the live database, all cleaned up afterwards:
--   outcome recorded on the case                     PASS (was impossible)
--   'closed' leaves current_stage_code untouched     PASS
--   expiry_items created                             2 rows (DB had 0)
--   engine joins item -> rule                        document 60/30d,
--                                                    work_permit 120/60d
--   milestone stored separately                      study_end
--   refusal auto-opens an Outcome Review             PASS
--   module bucket for a refused case                 outcome_review
--   client messages queued by the test               0
--
--   The approved/refused stage paths were deliberately NOT exercised on live
--   data: fn_engine_on_stage_change queues an APP_APPROVED message and the
--   comms worker sends every minute, so testing that way would have emailed a
--   real client. 'closed' was used instead because it changes no stage, and the
--   refusal trigger was tested with trg_engine_stage_change disabled inside the
--   same transaction.
--
-- ROLLBACK:
--   drop trigger if exists trg_cases_open_outcome_review on public.cases;
--   drop function if exists public.fn_open_outcome_review_on_refusal();
--   drop table if exists public.case_milestones;
--   (and restore the previous mark_case_outcome body from git history)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Milestones: dates that matter but do not expire.
-- ---------------------------------------------------------------------------
create table if not exists public.case_milestones (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid references public.clients(id) on delete cascade,
  case_id        uuid not null references public.cases(id) on delete cascade,
  milestone_type text not null check (milestone_type in
                   ('study_end','landing','first_canadian_work_day')),
  occurred_on    date not null,
  notes          text,
  created_by     uuid references public.staff_profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (case_id, milestone_type)
);

comment on table public.case_milestones is
  'Dates that anchor future eligibility but are not expiries: study end (PGWP eligibility), landing (citizenship clock), first Canadian work day (work experience). Deliberately NOT expiry_items - those drive "expiring soon" alerts, and none of these expire.';

alter table public.case_milestones enable row level security;

drop policy if exists p_case_milestones_staff_read   on public.case_milestones;
drop policy if exists p_case_milestones_staff_write  on public.case_milestones;
drop policy if exists p_case_milestones_staff_update on public.case_milestones;

create policy p_case_milestones_staff_read on public.case_milestones
  for select to authenticated using (public.fn_is_staff());
create policy p_case_milestones_staff_write on public.case_milestones
  for insert to authenticated with check (public.fn_is_staff());
create policy p_case_milestones_staff_update on public.case_milestones
  for update to authenticated using (public.fn_is_staff()) with check (public.fn_is_staff());

-- Standing rule from p4_01b: every new relation in public needs this.
revoke all on public.case_milestones from public, anon;
grant select, insert, update on public.case_milestones to authenticated, service_role;

create index if not exists idx_case_milestones_case on public.case_milestones(case_id);

-- ---------------------------------------------------------------------------
-- 2) Auto-open an Outcome Review whenever a case is refused, by ANY path.
--    Table-level trigger, not screen-level code, so it also covers kanban
--    drag-drop, imports, RPC and cron - the rule that caught P1.2/P1.3/P1.4.
-- ---------------------------------------------------------------------------
create or replace function public.fn_open_outcome_review_on_refusal()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.current_stage_code = 'refused'
     and old.current_stage_code is distinct from 'refused' then
    insert into public.case_outcome_reviews (case_id, opened_by)
    values (new.id, auth.uid())
    on conflict (case_id) do nothing;
  end if;
  return new;
end
$fn$;

revoke execute on function public.fn_open_outcome_review_on_refusal() from public, anon, authenticated;

drop trigger if exists trg_cases_open_outcome_review on public.cases;
create trigger trg_cases_open_outcome_review
  after update on public.cases
  for each row execute function public.fn_open_outcome_review_on_refusal();

-- ---------------------------------------------------------------------------
-- 3) The repaired RPC. Same signature, real columns, anchors preserved.
-- ---------------------------------------------------------------------------
create or replace function public.mark_case_outcome(
  p_case_id                 uuid,
  p_outcome                 text,
  p_decision_date           date,
  p_study_end_date          date default null,
  p_document_expiry_date    date default null,
  p_pgwp_expiry_date        date default null,
  p_landing_date            date default null,
  p_first_canadian_work_day date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_client   uuid;
  v_visa     text;
  v_permit   text;
  v_actor    uuid := auth.uid();
begin
  if p_outcome not in ('approved','refused','withdrawn','closed') then
    raise exception 'Invalid outcome: %. Expected approved, refused, withdrawn or closed.', p_outcome;
  end if;

  select c.client_id, lower(coalesce(vt.code, vt.label, ''))
    into v_client, v_visa
  from public.cases c
  left join public.visa_types vt on vt.id = c.visa_type_id
  where c.id = p_case_id;

  if not found then
    raise exception 'Case % not found', p_case_id;
  end if;

  -- Which expiry rule does a generic "permit expiry" belong to? Fall back to
  -- 'document', which has its own active rule, rather than guessing wrong.
  v_permit := case
    when v_visa like '%stud%' or v_visa like '%sp%'   then 'study_permit'
    when v_visa like '%work%' or v_visa like '%pgwp%'
      or v_visa like '%sowp%'                         then 'work_permit'
    else 'document'
  end;

  -- Real columns only.
  update public.cases
     set outcome           = p_outcome,
         decision_at       = coalesce(p_decision_date::timestamptz, decision_at, now()),
         current_stage_code = case
           when p_outcome in ('approved','refused','withdrawn') then p_outcome
           else current_stage_code
         end
   where id = p_case_id;

  -- Expiry anchors -> expiry_items (the engine's actual input).
  if p_document_expiry_date is not null then
    insert into public.expiry_items (client_id, case_id, item_type, label, expires_on, created_by)
    select v_client, p_case_id, v_permit,
           initcap(replace(v_permit,'_',' ')) || ' expiry', p_document_expiry_date, v_actor
    where not exists (
      select 1 from public.expiry_items e
      where e.case_id = p_case_id and e.item_type = v_permit
        and e.expires_on = p_document_expiry_date and e.is_active
    );
  end if;

  if p_pgwp_expiry_date is not null then
    insert into public.expiry_items (client_id, case_id, item_type, label, expires_on, created_by)
    select v_client, p_case_id, 'work_permit', 'PGWP expiry', p_pgwp_expiry_date, v_actor
    where not exists (
      select 1 from public.expiry_items e
      where e.case_id = p_case_id and e.item_type = 'work_permit'
        and e.expires_on = p_pgwp_expiry_date and e.is_active
    );
  end if;

  -- Milestones -> case_milestones. These are not expiries.
  if p_study_end_date is not null then
    insert into public.case_milestones (client_id, case_id, milestone_type, occurred_on, created_by)
    values (v_client, p_case_id, 'study_end', p_study_end_date, v_actor)
    on conflict (case_id, milestone_type) do update set occurred_on = excluded.occurred_on;
  end if;

  if p_landing_date is not null then
    insert into public.case_milestones (client_id, case_id, milestone_type, occurred_on, created_by)
    values (v_client, p_case_id, 'landing', p_landing_date, v_actor)
    on conflict (case_id, milestone_type) do update set occurred_on = excluded.occurred_on;
  end if;

  if p_first_canadian_work_day is not null then
    insert into public.case_milestones (client_id, case_id, milestone_type, occurred_on, created_by)
    values (v_client, p_case_id, 'first_canadian_work_day', p_first_canadian_work_day, v_actor)
    on conflict (case_id, milestone_type) do update set occurred_on = excluded.occurred_on;
  end if;
end
$fn$;

comment on function public.mark_case_outcome is
  'P4.2 repair. Previously wrote 7 non-existent columns and failed on every call, causing the UI to silently discard anchor dates. Now writes cases.outcome/decision_at, routes expiry anchors to expiry_items (the expiry engine input) and milestone anchors to case_milestones. Signature unchanged so the existing frontend works without a deploy.';

-- Callable by signed-in staff (the UI calls it); not by anon.
revoke execute on function public.mark_case_outcome(uuid,text,date,date,date,date,date,date) from public, anon;
grant  execute on function public.mark_case_outcome(uuid,text,date,date,date,date,date,date) to authenticated, service_role;
