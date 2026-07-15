-- ============================================================
-- Migration: Lead fields + Agent Partners
-- Apply in: Supabase SQL Editor → project ocnsavosheduqzmeyvcd
-- ============================================================

-- 1. New columns on leads table
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS first_name         TEXT,
  ADD COLUMN IF NOT EXISTS last_name          TEXT,
  ADD COLUMN IF NOT EXISTS nationality        TEXT,
  ADD COLUMN IF NOT EXISTS source_person_name TEXT,
  ADD COLUMN IF NOT EXISTS interested_visa_sub_type_id UUID;

-- 2. Add destination_country to visa_types (for filtering by country of interest)
ALTER TABLE visa_types
  ADD COLUMN IF NOT EXISTS destination_country TEXT;

-- 3. Agent Partners table
CREATE TABLE IF NOT EXISTS agent_partners (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  company        TEXT,
  email          TEXT,
  phone          TEXT,
  city           TEXT,
  country        TEXT,
  commission_pct NUMERIC(5,2) DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. FK on leads → agent_partners
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS agent_partner_id UUID
  REFERENCES agent_partners(id) ON DELETE SET NULL;

-- 5. RLS for agent_partners
ALTER TABLE agent_partners ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_partners' AND policyname = 'staff_all_agent_partners'
  ) THEN
    CREATE POLICY "staff_all_agent_partners"
      ON agent_partners FOR ALL
      TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Insert "Agent / Partner" lead source (if lead_sources table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_sources') THEN
    INSERT INTO lead_sources (code, label, sort_order, is_active)
    VALUES ('agent_partner', 'Agent / Partner', 99, true)
    ON CONFLICT (code) DO NOTHING;
  END IF;
END $$;

-- Done. Tip: after running this, set destination_country on existing visa_types
-- e.g.: UPDATE visa_types SET destination_country = 'Canada' WHERE label ILIKE '%canada%';
