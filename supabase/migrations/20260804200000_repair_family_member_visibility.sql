-- Keep family members visible after conversion, including records created by
-- older conversion flows that only populated converted_client_id.
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
    and (coalesce(l.lifecycle_state, '') <> 'converted' or l.converted_client_id is null)

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

-- Backfill the legacy family list for dependent clients already created by the
-- newer conversion flow. The insert is idempotent by name within a principal.
insert into public.family_members (
  principal_client_id,
  full_name,
  relationship,
  is_dependent,
  is_included_on_current_case,
  notes
)
select
  principal.id,
  member.full_name,
  coalesce(member.family_role, 'member'),
  true,
  true,
  null
from public.clients principal
join public.clients member
  on member.family_unit_id = principal.family_unit_id
 and member.id <> principal.id
where principal.family_role = 'primary'
  and not exists (
    select 1
    from public.family_members fm
    where fm.principal_client_id = principal.id
      and fm.full_name = member.full_name
  );

-- Also recover dependent leads from the old conversion path when no member
-- client was created. They remain visible as family members until converted
-- again through the corrected flow.
insert into public.family_members (
  principal_client_id,
  full_name,
  relationship,
  is_dependent,
  is_included_on_current_case,
  notes
)
select
  principal.id,
  member.full_name,
  coalesce(member.family_role, 'member'),
  true,
  true,
  member.notes
from public.clients principal
join public.leads member
  on member.family_unit_id = principal.family_unit_id
 and member.converted_client_id is null
 and member.id <> coalesce(principal.source_lead_id, '00000000-0000-0000-0000-000000000000'::uuid)
where principal.family_role = 'primary'
  and not exists (
    select 1
    from public.family_members fm
    where fm.principal_client_id = principal.id
      and fm.full_name = member.full_name
  );
