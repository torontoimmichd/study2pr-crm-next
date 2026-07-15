-- Part 2 wave A: add columns required by Family CRUD and Inbox

-- 1. Family members: passport number for the dependent identification
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS passport_number text;

-- 2. IRCC emails: keyword flag chips (extracted by future Gmail integration)
ALTER TABLE public.ircc_emails
  ADD COLUMN IF NOT EXISTS keyword_flags text[] DEFAULT '{}'::text[];

-- 3. Office hours / settings KV table for the Settings → Office hours screen.
--    Single-row config table keyed by `key` (e.g. timezone, weekday hours, holidays).
CREATE TABLE IF NOT EXISTS public.office_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid
);

ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_office_settings_staff_read ON public.office_settings;
CREATE POLICY p_office_settings_staff_read
  ON public.office_settings FOR SELECT
  TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS p_office_settings_owner_admin_write ON public.office_settings;
CREATE POLICY p_office_settings_owner_admin_write
  ON public.office_settings FOR ALL
  TO authenticated
  USING (public.auth_is_owner_or_admin())
  WITH CHECK (public.auth_is_owner_or_admin());

-- Seed sensible defaults (idempotent)
INSERT INTO public.office_settings(key, value) VALUES
  ('timezone', '"Asia/Kolkata"'::jsonb),
  ('weekday_hours', '{"mon":["09:30","18:30"],"tue":["09:30","18:30"],"wed":["09:30","18:30"],"thu":["09:30","18:30"],"fri":["09:30","18:30"],"sat":["10:00","14:00"],"sun":null}'::jsonb),
  ('holidays', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
