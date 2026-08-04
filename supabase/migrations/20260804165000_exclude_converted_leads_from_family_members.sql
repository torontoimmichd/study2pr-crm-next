-- Converted leads continue as clients/applications. Do not return the original
-- converted lead as a second family member next to its client row.

create or replace function public.get_family_members(p_family_unit_id uuid)
returns table(
  id uuid,
  lead_id uuid,
  client_id uuid,
  full_name text,
  family_role text,
  primary_application text,
  expected_revenue_cad numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.id as lead_id,
    null::uuid as client_id,
    l.full_name,
    coalesce(l.family_role, 'member') as family_role,
    null::text as primary_application,
    null::numeric as expected_revenue_cad
  from public.leads l
  where l.family_unit_id = p_family_unit_id
    and coalesce(l.lifecycle_state, '') <> 'converted'

  union all

  select
    c.id,
    null::uuid as lead_id,
    c.id as client_id,
    c.full_name,
    coalesce(c.family_role, 'member') as family_role,
    null::text as primary_application,
    null::numeric as expected_revenue_cad
  from public.clients c
  where c.family_unit_id = p_family_unit_id;
$$;

alter function public.get_family_members(uuid) owner to postgres;
grant all on function public.get_family_members(uuid) to authenticated;
grant all on function public.get_family_members(uuid) to service_role;
