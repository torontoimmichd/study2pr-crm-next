DROP POLICY IF EXISTS p_upsell_staff ON upsell_triggers;
DROP POLICY IF EXISTS p_upsell_triggers_staff_all ON upsell_triggers;

CREATE POLICY p_upsell_triggers_admin_write ON upsell_triggers
  FOR ALL TO authenticated
  USING (auth_is_owner_or_admin())
  WITH CHECK (auth_is_owner_or_admin());

CREATE POLICY p_upsell_triggers_staff_read ON upsell_triggers
  FOR SELECT TO authenticated
  USING (is_staff());