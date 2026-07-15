-- Tighten staff self-update so users cannot escalate their own role
-- Drop the broad policy and replace with:
--  1) staff can update their own non-privileged columns
--  2) only owners/admins can change role / is_active
-- We achieve this with a trigger that blocks privileged column changes when actor != owner/admin.

CREATE OR REPLACE FUNCTION public.staff_profiles_block_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the row's user is updating themselves and is NOT owner/admin,
  -- forbid changes to privileged columns.
  IF auth.uid() = OLD.id AND NOT public.auth_is_owner_or_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You are not allowed to change your own role';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'You are not allowed to change your own active status';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'You cannot change the primary key';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_block_self_escalation ON public.staff_profiles;
CREATE TRIGGER trg_staff_block_self_escalation
BEFORE UPDATE ON public.staff_profiles
FOR EACH ROW
EXECUTE FUNCTION public.staff_profiles_block_self_escalation();
