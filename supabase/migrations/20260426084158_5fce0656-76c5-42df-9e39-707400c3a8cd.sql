-- Office hours configuration (one row per weekday, 0=Sun..6=Sat)
CREATE TABLE IF NOT EXISTS public.office_hours_config (
  weekday INT PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT NOT NULL DEFAULT 'America/Toronto',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.office_hours_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_office_hours_staff_read ON public.office_hours_config
  FOR SELECT TO authenticated
  USING (is_staff());

CREATE POLICY p_office_hours_owner_admin_write ON public.office_hours_config
  FOR ALL TO authenticated
  USING (auth_is_owner_or_admin())
  WITH CHECK (auth_is_owner_or_admin());

-- Public holidays
CREATE TABLE IF NOT EXISTS public.office_holidays (
  date DATE PRIMARY KEY,
  label TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'CA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.office_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_office_holidays_staff_read ON public.office_holidays
  FOR SELECT TO authenticated
  USING (is_staff());

CREATE POLICY p_office_holidays_owner_admin_write ON public.office_holidays
  FOR ALL TO authenticated
  USING (auth_is_owner_or_admin())
  WITH CHECK (auth_is_owner_or_admin());

-- Seed default office hours (Mon-Fri 9-19, Sat 10-16, Sun closed)
INSERT INTO public.office_hours_config (weekday, open_time, close_time, is_closed) VALUES
  (1, '09:00', '19:00', false),
  (2, '09:00', '19:00', false),
  (3, '09:00', '19:00', false),
  (4, '09:00', '19:00', false),
  (5, '09:00', '19:00', false),
  (6, '10:00', '16:00', false),
  (0, NULL, NULL, true)
ON CONFLICT (weekday) DO NOTHING;

-- Seed Canadian public holidays for 2026
INSERT INTO public.office_holidays (date, label, country) VALUES
  ('2026-01-01', 'New Year''s Day', 'CA'),
  ('2026-02-16', 'Family Day', 'CA'),
  ('2026-04-03', 'Good Friday', 'CA'),
  ('2026-05-18', 'Victoria Day', 'CA'),
  ('2026-07-01', 'Canada Day', 'CA'),
  ('2026-09-07', 'Labour Day', 'CA'),
  ('2026-10-12', 'Thanksgiving', 'CA'),
  ('2026-11-11', 'Remembrance Day', 'CA'),
  ('2026-12-25', 'Christmas Day', 'CA'),
  ('2026-12-28', 'Boxing Day (observed)', 'CA')
ON CONFLICT (date) DO NOTHING;