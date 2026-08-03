-- P4.4 — CARRY THE FAMILY THROUGH CONVERSION
-- MEASURED: leads with family_unit_id 14 of 26 (roles primary/spouse/parent);
-- clients with family_unit_id 0 of 19; family units holding >1 lead: 4.
-- The family structure is built during the lead stage and destroyed the moment
-- the lead converts, which is why a converted family application shows no
-- family members. p4_03 correctly backfilled 0 of 21 cases - the client had
-- nothing to give.
-- Fixed in the database, not the wizard: clients.source_lead_id already records
-- the origin lead, so the identity is recoverable on EVERY conversion path.
-- Fills only NULLs, so a deliberate correction on the client survives.
-- ROLLBACK: drop trigger trg_clients_inherit_family on public.clients;
--           drop function public.fn_inherit_family_from_lead();

create or replace function public.fn_inherit_family_from_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_unit uuid;
  v_role text;
begin
  if new.source_lead_id is null then
    return new;
  end if;

  select l.family_unit_id, l.family_role
    into v_unit, v_role
  from public.leads l
  where l.id = new.source_lead_id;

  if new.family_unit_id is null then new.family_unit_id := v_unit; end if;
  if new.family_role    is null then new.family_role    := v_role; end if;

  return new;
end
$fn$;

revoke execute on function public.fn_inherit_family_from_lead() from public, anon, authenticated;

drop trigger if exists trg_clients_inherit_family on public.clients;
create trigger trg_clients_inherit_family
  before insert or update of source_lead_id on public.clients
  for each row execute function public.fn_inherit_family_from_lead();

update public.clients c
   set family_unit_id = coalesce(c.family_unit_id, l.family_unit_id),
       family_role    = coalesce(c.family_role,    l.family_role)
  from public.leads l
 where l.id = c.source_lead_id
   and (l.family_unit_id is not null or l.family_role is not null);

update public.clients c
   set family_unit_id = coalesce(c.family_unit_id, l.family_unit_id),
       family_role    = coalesce(c.family_role,    l.family_role)
  from public.leads l
 where l.converted_client_id = c.id
   and (l.family_unit_id is not null or l.family_role is not null);

update public.cases c
   set family_unit_id = cl.family_unit_id
  from public.clients cl
 where cl.id = c.client_id
   and cl.family_unit_id is not null
   and c.family_unit_id is distinct from cl.family_unit_id;
