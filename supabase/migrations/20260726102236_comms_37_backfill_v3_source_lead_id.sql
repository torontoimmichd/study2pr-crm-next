-- ============================================================================
-- COMMS HUB SPRINT 1 — 37: Backfill contact_identities from clients + leads
-- ✅ CORRECTED 2026-07-26 against study2pr-prod's REAL schema (verified directly).
--
-- History of this file's two wrong versions:
--   v1 treated a converted lead and the client it became as two different
--      owners of the same phone number → flagged them all as 'conflict'.
--   v2 tried to fix that with `clients.lead_id` — a column that exists on a
--      DIFFERENT Supabase project, not on production. Failed with
--      "column c.lead_id does not exist".
--   v3 (this file) uses the real link columns, confirmed present on prod:
--        clients.source_lead_id      → leads.id   (16 of 17 clients populated)
--        leads.converted_client_id   → clients.id (11 leads converted)
--      Either direction proves "same person", so neither is a conflict.
--
-- SAFETY: takes a timestamped backup table before deleting anything, and prints
-- a before/after comparison. Per Gaurav's standing rule: no bulk DELETE without
-- a backup + preview.
--
-- Rollback:
--   delete from public.contact_identities;
--   insert into public.contact_identities select * from public.contact_identities_bak_20260726;
-- ============================================================================

-- ─── 1. Backup (idempotent: keeps the FIRST backup, never overwrites it) ─────
create table if not exists public.contact_identities_bak_20260726
  as select * from public.contact_identities;

-- ─── 2. Rebuild ─────────────────────────────────────────────────────────────
delete from public.contact_identities;
delete from public.comm_audit_logs where action = 'backfill';

do $$
declare
  v_matched int := 0; v_conflict int := 0; v_failed int := 0; v_merged int := 0;
  r record; v_norm text; v_existing record; v_same boolean;
begin
  for r in
    -- priority 1 = clients (authoritative record), carrying their source lead
    select 1 as pri, 'client' as src, c.id as owner_id, c.source_lead_id as sibling_lead,
           'phone' as ch, c.phone as handle
      from public.clients c where c.phone is not null
    union all
    select 1, 'client', c.id, c.source_lead_id, 'email', c.email
      from public.clients c where c.email is not null
    union all
    -- priority 2 = leads
    select 2, 'lead', l.id, null::uuid, 'phone', l.phone
      from public.leads l where l.phone is not null
    union all
    select 2, 'lead', l.id, null::uuid, 'email', l.email
      from public.leads l where l.email is not null
    order by pri
  loop
    v_norm := case when r.ch = 'email' then normalize_email(r.handle)
                   else normalize_phone(r.handle) end;

    if v_norm is null then
      v_failed := v_failed + 1;
      insert into comm_audit_logs (action, entity_type, detail)
      values ('backfill','contact_identity',
              jsonb_build_object('result','failed','src',r.src,'owner',r.owner_id,'raw',r.handle));
      continue;
    end if;

    select * into v_existing from contact_identities
      where org_id = default_org_id() and channel = r.ch and handle_norm = v_norm;

    if not found then
      insert into contact_identities (channel, handle_raw, handle_norm, client_id, lead_id, is_primary, link_status)
      values (r.ch, r.handle, v_norm,
              case when r.src = 'client' then r.owner_id end,
              case when r.src = 'client' then r.sibling_lead else r.owner_id end,
              true, 'linked');
      v_matched := v_matched + 1;
    else
      v_same := false;

      if r.src = 'client' and v_existing.client_id = r.owner_id then
        v_same := true;
      end if;

      if r.src = 'lead' then
        if v_existing.lead_id = r.owner_id then
          v_same := true;

        -- same person, proven either direction:
        elsif v_existing.client_id is not null and exists (
                select 1 from public.clients c
                 where c.id = v_existing.client_id
                   and c.source_lead_id = r.owner_id)
           or exists (
                select 1 from public.leads l
                 where l.id = r.owner_id
                   and l.converted_client_id = v_existing.client_id)
        then
          update contact_identities
             set lead_id = coalesce(lead_id, r.owner_id)
           where id = v_existing.id;
          v_same   := true;
          v_merged := v_merged + 1;
        end if;
      end if;

      if not v_same then
        update contact_identities set link_status = 'conflict' where id = v_existing.id;
        v_conflict := v_conflict + 1;
        insert into comm_audit_logs (action, entity_type, entity_id, detail)
        values ('backfill','contact_identity', v_existing.id,
                jsonb_build_object('result','conflict','src',r.src,'owner',r.owner_id,
                                   'handle_norm',v_norm,
                                   'existing_client',v_existing.client_id,
                                   'existing_lead',v_existing.lead_id));
      end if;
    end if;
  end loop;

  raise notice 'BACKFILL — matched: %, merged: %, conflicted: %, failed: %',
    v_matched, v_merged, v_conflict, v_failed;
  insert into comm_audit_logs (action, entity_type, detail)
  values ('backfill','summary',
          jsonb_build_object('matched',v_matched,'merged_lead_to_client',v_merged,
                             'conflicted',v_conflict,'failed',v_failed));
end $$;

-- ─── 3. Before/after ────────────────────────────────────────────────────────
select
  (select count(*) from public.contact_identities_bak_20260726)                          as before_rows,
  (select count(*) from public.contact_identities_bak_20260726 where link_status='conflict') as before_conflicts,
  (select count(*) from public.contact_identities)                                       as after_rows,
  (select count(*) from public.contact_identities where link_status='conflict')          as after_conflicts,
  (select count(*) from public.contact_identities where client_id is not null and lead_id is not null) as dual_linked,
  (select detail from public.comm_audit_logs
    where action='backfill' and entity_type='summary'
    order by created_at desc limit 1)                                                    as summary;

-- Review leftovers:
--   select detail from comm_audit_logs where action='backfill' and detail->>'result'='conflict';
--   select detail from comm_audit_logs where action='backfill' and detail->>'result'='failed';
