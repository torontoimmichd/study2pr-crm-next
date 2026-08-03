-- P4.3 — FAMILY / GROUP APPLICATIONS: give cases a family identity
-- Root cause: leads.family_unit_id and clients.family_unit_id exist and are
-- populated, but `cases` had NO family column, so family identity was dropped
-- at conversion. family_unit_id is DERIVED from the client by trigger, not
-- typed in by whichever screen creates the case (covers wizard, import, RPC).
-- case_group_id is separate: family_unit = who these people are to each other;
-- case_group = which applications were filed as one piece of work. Members may
-- hold different visa types at different fees.
-- Full rationale in commit message. ROLLBACK: drop view v_family_overview;
-- drop trigger trg_cases_sync_family; drop function fn_sync_case_family_unit();
-- alter table cases drop column family_unit_id, drop column case_group_id;

alter table public.cases
  add column if not exists family_unit_id uuid references public.family_units(id) on delete set null,
  add column if not exists case_group_id  uuid;

comment on column public.cases.family_unit_id is
  'Derived from the case client. Maintained by trg_cases_sync_family - do not set by hand.';
comment on column public.cases.case_group_id is
  'Applications filed together as one piece of work (principal + dependants). Members may hold different visa types and different fees. Distinct from family_unit_id, which is the relationship, not the filing.';

create index if not exists idx_cases_family_unit on public.cases(family_unit_id) where family_unit_id is not null;
create index if not exists idx_cases_case_group  on public.cases(case_group_id)  where case_group_id  is not null;

create or replace function public.fn_sync_case_family_unit()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.client_id is not null then
    select cl.family_unit_id into new.family_unit_id
    from public.clients cl where cl.id = new.client_id;
  end if;
  return new;
end
$fn$;

revoke execute on function public.fn_sync_case_family_unit() from public, anon, authenticated;

drop trigger if exists trg_cases_sync_family on public.cases;
create trigger trg_cases_sync_family
  before insert or update of client_id on public.cases
  for each row execute function public.fn_sync_case_family_unit();

update public.cases c
   set family_unit_id = cl.family_unit_id
  from public.clients cl
 where cl.id = c.client_id
   and cl.family_unit_id is not null
   and c.family_unit_id is distinct from cl.family_unit_id;

create or replace view public.v_family_overview
with (security_invoker = true) as
select
  fu.id                       as family_unit_id,
  fu.unit_name,
  fu.origin_country,
  'lead'::text                as record_kind,
  l.id                        as record_id,
  l.full_name                 as person_name,
  l.family_role,
  l.lifecycle_state           as status,
  null::text                  as case_code,
  null::uuid                  as visa_type_id,
  null::numeric               as quoted_fee_inr,
  null::numeric               as total_paid_inr,
  null::uuid                  as case_group_id,
  l.created_at
from public.family_units fu
join public.leads l on l.family_unit_id = fu.id

union all

select
  fu.id,
  fu.unit_name,
  fu.origin_country,
  'application'::text,
  c.id,
  cl.full_name,
  cl.family_role,
  c.current_stage_code,
  c.case_code,
  c.visa_type_id,
  c.quoted_fee_inr,
  c.total_paid_inr,
  c.case_group_id,
  c.created_at
from public.family_units fu
join public.cases   c  on c.family_unit_id = fu.id
left join public.clients cl on cl.id = c.client_id;

comment on view public.v_family_overview is
  'A family unit with its leads and its applications in one list, so the principal applicant and dependants are visible together. Per-member visa type and fee are carried through, because family members frequently apply under different programs at different prices.';

revoke all on public.v_family_overview from public, anon;
grant select on public.v_family_overview to authenticated, service_role;
