-- Lead routing rules: priority-ordered rules that auto-assign incoming leads to staff
CREATE TABLE public.lead_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  -- Match criteria (all optional; null = match any)
  match_visa_type_codes text[],          -- e.g. {'PR','PNP'}
  match_source_codes text[],             -- e.g. {'referral'}
  match_office_hours_only boolean NOT NULL DEFAULT false,
  -- Assignment target
  assign_strategy text NOT NULL DEFAULT 'specific_staff', -- 'specific_staff' | 'round_robin_role' | 'round_robin_specialty'
  assign_staff_id uuid REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  assign_role text,                      -- when round_robin_role
  assign_specialty text,                 -- when round_robin_specialty
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.staff_profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_lead_routing_rules_priority ON public.lead_routing_rules(priority) WHERE is_active = true;

ALTER TABLE public.lead_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_lead_routing_owner_admin_all ON public.lead_routing_rules
  FOR ALL TO authenticated
  USING (auth_is_owner_or_admin())
  WITH CHECK (auth_is_owner_or_admin());

CREATE POLICY p_lead_routing_staff_read ON public.lead_routing_rules
  FOR SELECT TO authenticated
  USING (is_staff());

CREATE TRIGGER trg_lead_routing_rules_updated_at
  BEFORE UPDATE ON public.lead_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Integrations config: third-party connection metadata (WhatsApp, Postmark, Razorpay, etc.)
CREATE TABLE public.integrations_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,             -- e.g. 'whatsapp_business','postmark','razorpay'
  category text NOT NULL,                -- 'messaging' | 'payments' | 'docs' | 'ingest'
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'not_connected', -- 'connected' | 'not_connected' | 'error'
  connected_as text,                     -- masked identifier (phone, email, account)
  region text,
  fees_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,  -- non-secret config (no keys)
  usage_30d integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_integrations_owner_admin_all ON public.integrations_config
  FOR ALL TO authenticated
  USING (auth_is_owner_or_admin())
  WITH CHECK (auth_is_owner_or_admin());

CREATE POLICY p_integrations_staff_read ON public.integrations_config
  FOR SELECT TO authenticated
  USING (is_staff());

CREATE TRIGGER trg_integrations_config_updated_at
  BEFORE UPDATE ON public.integrations_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- API keys: developer API access — stores PREFIX + HASH only, never raw keys
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  key_prefix text NOT NULL,              -- first 8 chars for display, e.g. 'sk_live_abc12...'
  key_hash text NOT NULL,                -- bcrypt/sha256 of full key — NEVER raw
  owner_staff_id uuid REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.staff_profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_api_keys_active ON public.api_keys(key_prefix) WHERE revoked_at IS NULL;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Owner+admin only — no general staff read because key_hash is sensitive
CREATE POLICY p_api_keys_owner_admin_all ON public.api_keys
  FOR ALL TO authenticated
  USING (auth_is_owner_or_admin())
  WITH CHECK (auth_is_owner_or_admin());


-- Outbound messages: queue for upsell triggers / scheduled sends
CREATE TABLE public.outbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,                 -- 'whatsapp' | 'email' | 'sms' | 'portal'
  template_code text,                    -- references templates table when added
  to_contact text NOT NULL,
  subject text,
  body text,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  related_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  related_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  trigger_event_id uuid REFERENCES public.trigger_events(id) ON DELETE SET NULL,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'queued', -- 'queued' | 'sent' | 'failed' | 'cancelled'
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.staff_profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_outbound_messages_status_scheduled ON public.outbound_messages(status, scheduled_for) WHERE status = 'queued';
CREATE INDEX idx_outbound_messages_case ON public.outbound_messages(related_case_id);

ALTER TABLE public.outbound_messages ENABLE ROW LEVEL SECURITY;

-- Owner+admin: full access
CREATE POLICY p_outbound_owner_admin_all ON public.outbound_messages
  FOR ALL TO authenticated
  USING (auth_is_owner_or_admin())
  WITH CHECK (auth_is_owner_or_admin());

-- Staff: read messages tied to cases they manage/advise
CREATE POLICY p_outbound_staff_read_own ON public.outbound_messages
  FOR SELECT TO authenticated
  USING (
    is_staff() AND (
      related_case_id IN (
        SELECT id FROM public.cases
        WHERE case_manager_id = auth.uid() OR senior_advisor_id = auth.uid()
      )
      OR related_lead_id IN (
        SELECT id FROM public.leads WHERE assigned_to = auth.uid()
      )
    )
  );

-- Staff can insert outbound messages for their own cases/leads (e.g. manual sends)
CREATE POLICY p_outbound_staff_insert_own ON public.outbound_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    is_staff() AND (
      related_case_id IN (
        SELECT id FROM public.cases
        WHERE case_manager_id = auth.uid() OR senior_advisor_id = auth.uid()
      )
      OR related_lead_id IN (
        SELECT id FROM public.leads WHERE assigned_to = auth.uid()
      )
    )
  );