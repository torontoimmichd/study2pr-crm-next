-- PHASE 2A: auth_role() -> single source of truth.
-- Verified: the "4 permission families" are one implementation behind aliases
--   (is_staff/auth_is_staff -> fn_is_staff -> fn_current_role).
-- auth_role() was the ONE divergence: it had its own lookup that OMITTED the
--   is_active filter, so a deactivated staff member would still resolve a role.
-- Proven unused before changing: 0 policies, 0 functions, 0 application code
--   references, and 0 currently-inactive staff => latent trap, no live exposure.
-- Fixed rather than dropped so any future caller inherits correct semantics.
-- ROLLBACK: create or replace function public.auth_role() returns text
--   language sql stable security definer as
--   $$ select role from staff_profiles where id = auth.uid(); $$;

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select public.fn_current_role()
$fn$;

comment on function public.auth_role() is
  'Phase 2A: thin alias over fn_current_role(), which enforces is_active. Previously had a divergent copy of the role lookup that ignored is_active.';
