// src/lib/types.ts
// Unified type definitions for lead detail, applications, family units, chain engine.
// Bridges both the existing DB schema (full_name, lifecycle_state, country_of_residence)
// and the new design-brief schema (first_name/last_name, stage, country).

export interface Lead {
  id: string;
  organization_id?: string;

  // Existing DB field
  full_name: string;

  // New design fields (may not exist in DB yet — optional)
  lead_number?: string;
  salutation?: string | null;
  first_name?: string;
  last_name?: string | null;

  email: string | null;
  phone: string | null;

  // Existing field
  country_of_residence?: string | null;
  // New design alias
  country?: string | null;
  destination_country?: string | null;

  visa_interest?: string | null;
  source?: string | null;

  // Existing: lifecycle_state; new design: stage — both supported
  lifecycle_state?: string;
  stage?: string;
  branch_code?: string | null;

  assigned_to?: string | null;
  assigned_team_member?: { id: string; full_name: string } | null;

  quoted_amount?: number | null;
  service_fee?: number | null;
  estimated_govt_fee_cad_min?: number | null;
  estimated_govt_fee_cad_max?: number | null;

  ielts_score?: string | null;
  ielts_date?: string | null;
  spouse_context?: string | null;

  family_unit_id?: string | null;
  family_role?: string | null;

  open_activities_count?: number;
  open_cases_count?: number;

  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  full_name: string;
  family_role: string;
  primary_application: string | null;
  expected_revenue_cad: number | null;
}

export interface ApplicationRow {
  id: string;
  case_number?: string | null;
  case_ref?: string | null;         // existing field alias
  application_type?: string | null;
  visa_type_name?: string | null;
  title?: string | null;
  destination?: string | null;
  country?: string | null;
  stage: string | null;
  current_stage_code?: string | null;
  checklist_step?: number | null;
  fee?: number | null;
  quoted_fee_inr?: number | null;   // existing field alias
  paid_amount?: number | null;
  estimated_processing_weeks?: number | null;
  lead_id?: string | null;
  client_id?: string | null;
  family_unit_id?: string | null;
  for_family_role?: string | null;
  outcome?: string | null;
  decision_date?: string | null;
  assigned_to?: string | null;
  source_prospective_application_id?: string | null;

  // Joined / computed
  client_name?: string | null;
  family_unit_name?: string | null;
  assigned_to_name?: string | null;
  next_task?: { title: string; due_at: string | null } | null;

  created_at?: string;
}

export interface ProspectiveAppRow {
  id: string;
  organization_id?: string;
  family_unit_id: string | null;
  for_person_id: string | null;
  for_person_type: "lead" | "client" | null;
  target_application_type: string;
  trigger_date: string;
  expires_on: string | null;
  status: "pending_counselor_action" | "converted_to_case" | "declined_by_client" | "expired" | "cancelled" | "client_contacted" | "client_consented" | "expired_missed";
  client_decision?: string | null;
  client_decision_at?: string | null;
  counselor_notes?: string | null;
  estimated_fee_cad?: number | null;
  assigned_counselor_id?: string | null;
  triggered_by_rule?: string | null;
  promoted_case_id?: string | null;

  chain_rule?: {
    rule_code: string;
    description?: string | null;
    counselor_script?: string | null;
    sla_days?: number;
    priority?: "critical" | "high" | "normal";
  } | null;

  // Joined
  for_person_name?: string | null;
  family_unit_name?: string | null;
}

export interface TimelineEvent {
  id: string;
  lead_id?: string | null;
  client_id?: string | null;
  case_id?: string | null;
  event_type: string;
  title: string;
  body?: string | null;
  description?: string | null;
  created_by?: string | null;
  is_system?: boolean;
  created_at: string;
}

export interface ChainTask {
  id: string;
  title: string;
  description?: string | null;
  assigned_to?: string;
  due_at?: string | null;
  sla_due_at?: string | null;
  priority?: "normal" | "high" | "critical" | null;
  status: string;
  source_chain_rule_id?: string | null;
  prospective_application_id?: string | null;
  lead_id?: string | null;
  case_id?: string | null;
}
