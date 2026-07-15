-- Appointments for staff calendar
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff_profiles(id) ON DELETE CASCADE NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INT DEFAULT 30,
  type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('discovery_call','phone_call','team_meeting','consultation','follow_up','other')),
  title TEXT NOT NULL,
  notes TEXT,
  related_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  related_case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  meeting_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_staff_date
  ON public.appointments(staff_id, scheduled_at);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Staff can manage their own
CREATE POLICY "p_appointments_staff_own"
  ON public.appointments
  FOR ALL
  TO authenticated
  USING (staff_id = auth.uid())
  WITH CHECK (staff_id = auth.uid());

-- Owners and admins can manage all
CREATE POLICY "p_appointments_admin_all"
  ON public.appointments
  FOR ALL
  TO authenticated
  USING (public.auth_is_owner_or_admin())
  WITH CHECK (public.auth_is_owner_or_admin());

-- Touch updated_at on update
CREATE TRIGGER trg_appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();