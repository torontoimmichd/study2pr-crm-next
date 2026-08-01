export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _backup_clients_20260712: {
        Row: {
          birthday_month_day: string | null
          client_code: string | null
          country_of_citizenship: string | null
          created_at: string | null
          current_residence: string | null
          date_of_birth: string | null
          email: string | null
          family_role: string | null
          family_unit_id: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          notes: string | null
          onboarded_at: string | null
          phone: string | null
          portal_user_id: string | null
          preferred_language: string | null
          source_lead_id: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          birthday_month_day?: string | null
          client_code?: string | null
          country_of_citizenship?: string | null
          created_at?: string | null
          current_residence?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          portal_user_id?: string | null
          preferred_language?: string | null
          source_lead_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          birthday_month_day?: string | null
          client_code?: string | null
          country_of_citizenship?: string | null
          created_at?: string | null
          current_residence?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          portal_user_id?: string | null
          preferred_language?: string | null
          source_lead_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      _backup_clients_20260715: {
        Row: {
          birthday_month_day: string | null
          client_code: string | null
          country_of_citizenship: string | null
          created_at: string | null
          current_residence: string | null
          date_of_birth: string | null
          email: string | null
          family_role: string | null
          family_unit_id: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          notes: string | null
          onboarded_at: string | null
          phone: string | null
          portal_user_id: string | null
          preferred_language: string | null
          source_lead_id: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          birthday_month_day?: string | null
          client_code?: string | null
          country_of_citizenship?: string | null
          created_at?: string | null
          current_residence?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          portal_user_id?: string | null
          preferred_language?: string | null
          source_lead_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          birthday_month_day?: string | null
          client_code?: string | null
          country_of_citizenship?: string | null
          created_at?: string | null
          current_residence?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          portal_user_id?: string | null
          preferred_language?: string | null
          source_lead_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      _backup_clients_dupes_20260712: {
        Row: {
          birthday_month_day: string | null
          client_code: string | null
          country_of_citizenship: string | null
          created_at: string | null
          current_residence: string | null
          date_of_birth: string | null
          email: string | null
          family_role: string | null
          family_unit_id: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          notes: string | null
          onboarded_at: string | null
          phone: string | null
          portal_user_id: string | null
          preferred_language: string | null
          source_lead_id: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          birthday_month_day?: string | null
          client_code?: string | null
          country_of_citizenship?: string | null
          created_at?: string | null
          current_residence?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          portal_user_id?: string | null
          preferred_language?: string | null
          source_lead_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          birthday_month_day?: string | null
          client_code?: string | null
          country_of_citizenship?: string | null
          created_at?: string | null
          current_residence?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          portal_user_id?: string | null
          preferred_language?: string | null
          source_lead_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      _backup_clients_dupes_20260715: {
        Row: {
          birthday_month_day: string | null
          client_code: string | null
          country_of_citizenship: string | null
          created_at: string | null
          current_residence: string | null
          date_of_birth: string | null
          email: string | null
          family_role: string | null
          family_unit_id: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          notes: string | null
          onboarded_at: string | null
          phone: string | null
          portal_user_id: string | null
          preferred_language: string | null
          source_lead_id: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          birthday_month_day?: string | null
          client_code?: string | null
          country_of_citizenship?: string | null
          created_at?: string | null
          current_residence?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          portal_user_id?: string | null
          preferred_language?: string | null
          source_lead_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          birthday_month_day?: string | null
          client_code?: string | null
          country_of_citizenship?: string | null
          created_at?: string | null
          current_residence?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          portal_user_id?: string | null
          preferred_language?: string | null
          source_lead_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      _backup_leads_20260712: {
        Row: {
          agent_partner_id: string | null
          assessment_completed_at: string | null
          assessment_data: Json | null
          assessment_score: number | null
          assessment_submitted_at: string | null
          assessment_threshold_met: boolean | null
          assigned_to: string | null
          converted_at: string | null
          converted_client_id: string | null
          country_of_interest: string | null
          country_of_residence: string | null
          created_at: string | null
          created_by: string | null
          crs_score: number | null
          email: string | null
          family_role: string | null
          family_unit_id: string | null
          first_name: string | null
          first_responded_at: string | null
          first_response_due_at: string | null
          full_name: string | null
          has_ircc_invitation: boolean | null
          id: string | null
          interested_visa_sub_type_id: string | null
          interested_visa_type_id: string | null
          ircc_invitation_type: string | null
          last_name: string | null
          lifecycle_state: string | null
          lost_reason: string | null
          nationality: string | null
          notes: string | null
          phone: string | null
          referral_partner_id: string | null
          referrer_name: string | null
          source_code: string | null
          source_detail: string | null
          source_person_name: string | null
          stage_metadata: Json | null
          status: string | null
          updated_at: string | null
          waiting_contact_frequency: string | null
          waiting_end_date: string | null
          waiting_linked_milestone: string | null
          waiting_reason: string | null
          waiting_review_notes: string | null
          waiting_start_date: string | null
        }
        Insert: {
          agent_partner_id?: string | null
          assessment_completed_at?: string | null
          assessment_data?: Json | null
          assessment_score?: number | null
          assessment_submitted_at?: string | null
          assessment_threshold_met?: boolean | null
          assigned_to?: string | null
          converted_at?: string | null
          converted_client_id?: string | null
          country_of_interest?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          created_by?: string | null
          crs_score?: number | null
          email?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          first_name?: string | null
          first_responded_at?: string | null
          first_response_due_at?: string | null
          full_name?: string | null
          has_ircc_invitation?: boolean | null
          id?: string | null
          interested_visa_sub_type_id?: string | null
          interested_visa_type_id?: string | null
          ircc_invitation_type?: string | null
          last_name?: string | null
          lifecycle_state?: string | null
          lost_reason?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          referral_partner_id?: string | null
          referrer_name?: string | null
          source_code?: string | null
          source_detail?: string | null
          source_person_name?: string | null
          stage_metadata?: Json | null
          status?: string | null
          updated_at?: string | null
          waiting_contact_frequency?: string | null
          waiting_end_date?: string | null
          waiting_linked_milestone?: string | null
          waiting_reason?: string | null
          waiting_review_notes?: string | null
          waiting_start_date?: string | null
        }
        Update: {
          agent_partner_id?: string | null
          assessment_completed_at?: string | null
          assessment_data?: Json | null
          assessment_score?: number | null
          assessment_submitted_at?: string | null
          assessment_threshold_met?: boolean | null
          assigned_to?: string | null
          converted_at?: string | null
          converted_client_id?: string | null
          country_of_interest?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          created_by?: string | null
          crs_score?: number | null
          email?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          first_name?: string | null
          first_responded_at?: string | null
          first_response_due_at?: string | null
          full_name?: string | null
          has_ircc_invitation?: boolean | null
          id?: string | null
          interested_visa_sub_type_id?: string | null
          interested_visa_type_id?: string | null
          ircc_invitation_type?: string | null
          last_name?: string | null
          lifecycle_state?: string | null
          lost_reason?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          referral_partner_id?: string | null
          referrer_name?: string | null
          source_code?: string | null
          source_detail?: string | null
          source_person_name?: string | null
          stage_metadata?: Json | null
          status?: string | null
          updated_at?: string | null
          waiting_contact_frequency?: string | null
          waiting_end_date?: string | null
          waiting_linked_milestone?: string | null
          waiting_reason?: string | null
          waiting_review_notes?: string | null
          waiting_start_date?: string | null
        }
        Relationships: []
      }
      _backup_leads_20260715: {
        Row: {
          agent_partner_id: string | null
          assessment_completed_at: string | null
          assessment_data: Json | null
          assessment_score: number | null
          assessment_submitted_at: string | null
          assessment_threshold_met: boolean | null
          assigned_to: string | null
          converted_at: string | null
          converted_client_id: string | null
          country_of_interest: string | null
          country_of_residence: string | null
          created_at: string | null
          created_by: string | null
          crs_score: number | null
          email: string | null
          enquiry_client_id: string | null
          family_role: string | null
          family_unit_id: string | null
          first_name: string | null
          first_responded_at: string | null
          first_response_due_at: string | null
          full_name: string | null
          has_ircc_invitation: boolean | null
          id: string | null
          interested_category_id: string | null
          interested_country: string | null
          interested_visa_sub_type_id: string | null
          interested_visa_type_id: string | null
          ircc_invitation_type: string | null
          last_name: string | null
          lifecycle_state: string | null
          lost_reason: string | null
          nationality: string | null
          notes: string | null
          phone: string | null
          referral_partner_id: string | null
          referrer_name: string | null
          source_code: string | null
          source_detail: string | null
          source_person_name: string | null
          stage_metadata: Json | null
          status: string | null
          updated_at: string | null
          waiting_contact_frequency: string | null
          waiting_end_date: string | null
          waiting_linked_milestone: string | null
          waiting_reason: string | null
          waiting_review_notes: string | null
          waiting_start_date: string | null
        }
        Insert: {
          agent_partner_id?: string | null
          assessment_completed_at?: string | null
          assessment_data?: Json | null
          assessment_score?: number | null
          assessment_submitted_at?: string | null
          assessment_threshold_met?: boolean | null
          assigned_to?: string | null
          converted_at?: string | null
          converted_client_id?: string | null
          country_of_interest?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          created_by?: string | null
          crs_score?: number | null
          email?: string | null
          enquiry_client_id?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          first_name?: string | null
          first_responded_at?: string | null
          first_response_due_at?: string | null
          full_name?: string | null
          has_ircc_invitation?: boolean | null
          id?: string | null
          interested_category_id?: string | null
          interested_country?: string | null
          interested_visa_sub_type_id?: string | null
          interested_visa_type_id?: string | null
          ircc_invitation_type?: string | null
          last_name?: string | null
          lifecycle_state?: string | null
          lost_reason?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          referral_partner_id?: string | null
          referrer_name?: string | null
          source_code?: string | null
          source_detail?: string | null
          source_person_name?: string | null
          stage_metadata?: Json | null
          status?: string | null
          updated_at?: string | null
          waiting_contact_frequency?: string | null
          waiting_end_date?: string | null
          waiting_linked_milestone?: string | null
          waiting_reason?: string | null
          waiting_review_notes?: string | null
          waiting_start_date?: string | null
        }
        Update: {
          agent_partner_id?: string | null
          assessment_completed_at?: string | null
          assessment_data?: Json | null
          assessment_score?: number | null
          assessment_submitted_at?: string | null
          assessment_threshold_met?: boolean | null
          assigned_to?: string | null
          converted_at?: string | null
          converted_client_id?: string | null
          country_of_interest?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          created_by?: string | null
          crs_score?: number | null
          email?: string | null
          enquiry_client_id?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          first_name?: string | null
          first_responded_at?: string | null
          first_response_due_at?: string | null
          full_name?: string | null
          has_ircc_invitation?: boolean | null
          id?: string | null
          interested_category_id?: string | null
          interested_country?: string | null
          interested_visa_sub_type_id?: string | null
          interested_visa_type_id?: string | null
          ircc_invitation_type?: string | null
          last_name?: string | null
          lifecycle_state?: string | null
          lost_reason?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          referral_partner_id?: string | null
          referrer_name?: string | null
          source_code?: string | null
          source_detail?: string | null
          source_person_name?: string | null
          stage_metadata?: Json | null
          status?: string | null
          updated_at?: string | null
          waiting_contact_frequency?: string | null
          waiting_end_date?: string | null
          waiting_linked_milestone?: string | null
          waiting_reason?: string | null
          waiting_review_notes?: string | null
          waiting_start_date?: string | null
        }
        Relationships: []
      }
      _backup_visa_types_20260717: {
        Row: {
          base_fee_cad: number | null
          base_fee_inr: number | null
          category: string | null
          category_id: string | null
          code: string | null
          destination_country: string | null
          govt_fee_cad: number | null
          id: string | null
          is_active: boolean | null
          is_commission_based: boolean | null
          label: string | null
          notes: string | null
          requires_canada_residency: boolean | null
        }
        Insert: {
          base_fee_cad?: number | null
          base_fee_inr?: number | null
          category?: string | null
          category_id?: string | null
          code?: string | null
          destination_country?: string | null
          govt_fee_cad?: number | null
          id?: string | null
          is_active?: boolean | null
          is_commission_based?: boolean | null
          label?: string | null
          notes?: string | null
          requires_canada_residency?: boolean | null
        }
        Update: {
          base_fee_cad?: number | null
          base_fee_inr?: number | null
          category?: string | null
          category_id?: string | null
          code?: string | null
          destination_country?: string | null
          govt_fee_cad?: number | null
          id?: string | null
          is_active?: boolean | null
          is_commission_based?: boolean | null
          label?: string | null
          notes?: string | null
          requires_canada_residency?: boolean | null
        }
        Relationships: []
      }
      _bak_assessment_forms_20260729: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          is_default: boolean | null
          sections: Json | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          sections?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          sections?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      activity_timeline: {
        Row: {
          actor_id: string | null
          body: string | null
          case_id: string | null
          client_id: string | null
          created_at: string
          event_type: string
          id: string
          is_system: boolean
          lead_id: string | null
          metadata: Json | null
          occurred_at: string
          title: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          is_system?: boolean
          lead_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          title: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          is_system?: boolean
          lead_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_timeline_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
        ]
      }
      agent_partners: {
        Row: {
          city: string | null
          commission_pct: number | null
          company: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          commission_pct?: number | null
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          commission_pct?: number | null
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          owner_staff_id: string | null
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at?: string | null
          owner_staff_id?: string | null
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          owner_staff_id?: string | null
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "api_keys_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      applicant_relationships: {
        Row: {
          created_at: string
          from_applicant_id: string
          id: string
          notes: string | null
          relationship_type: string
          to_applicant_id: string
        }
        Insert: {
          created_at?: string
          from_applicant_id: string
          id?: string
          notes?: string | null
          relationship_type: string
          to_applicant_id: string
        }
        Update: {
          created_at?: string
          from_applicant_id?: string
          id?: string
          notes?: string | null
          relationship_type?: string
          to_applicant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applicant_relationships_from_applicant_id_fkey"
            columns: ["from_applicant_id"]
            isOneToOne: false
            referencedRelation: "case_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicant_relationships_to_applicant_id_fkey"
            columns: ["to_applicant_id"]
            isOneToOne: false
            referencedRelation: "case_applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string
          duration_min: number | null
          id: string
          meeting_link: string | null
          notes: string | null
          related_case_id: string | null
          related_lead_id: string | null
          scheduled_at: string
          staff_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_min?: number | null
          id?: string
          meeting_link?: string | null
          notes?: string | null
          related_case_id?: string | null
          related_lead_id?: string | null
          scheduled_at: string
          staff_id: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_min?: number | null
          id?: string
          meeting_link?: string | null
          notes?: string | null
          related_case_id?: string | null
          related_lead_id?: string | null
          scheduled_at?: string
          staff_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "appointments_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "appointments_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "appointments_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "appointments_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "appointments_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "appointments_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "appointments_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "appointments_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "appointments_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "appointments_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      assessment_forms: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          sections: Json
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          sections?: Json
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          sections?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      assessments: {
        Row: {
          client_id: string | null
          created_at: string
          facts: Json | null
          form_code: string | null
          id: string
          lead_id: string | null
          payload: Json
          reviewed_by: string | null
          score_results: Json | null
          scored_at: string | null
          status: string
          submitted_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          facts?: Json | null
          form_code?: string | null
          id?: string
          lead_id?: string | null
          payload?: Json
          reviewed_by?: string | null
          score_results?: Json | null
          scored_at?: string | null
          status?: string
          submitted_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          facts?: Json | null
          form_code?: string | null
          id?: string
          lead_id?: string | null
          payload?: Json
          reviewed_by?: string | null
          score_results?: Json | null
          scored_at?: string | null
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "assessments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "assessments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "assessments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "assessments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "assessments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_04: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_05: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_06: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_07: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_08: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_09: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_10: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_11: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_12: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2027_01: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2027_02: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_default: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          called_at: string
          case_id: string | null
          client_id: string | null
          created_at: string
          direction: string
          duration_seconds: number | null
          emotional_state: string | null
          id: string
          lead_id: string | null
          next_contact_at: string | null
          next_step: string | null
          notes: string | null
          notes_length: number | null
          objection: string | null
          outcome: string
          promise_made: string | null
          staff_id: string | null
        }
        Insert: {
          called_at?: string
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          emotional_state?: string | null
          id?: string
          lead_id?: string | null
          next_contact_at?: string | null
          next_step?: string | null
          notes?: string | null
          notes_length?: number | null
          objection?: string | null
          outcome?: string
          promise_made?: string | null
          staff_id?: string | null
        }
        Update: {
          called_at?: string
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          emotional_state?: string | null
          id?: string
          lead_id?: string | null
          next_contact_at?: string | null
          next_step?: string | null
          notes?: string | null
          notes_length?: number | null
          objection?: string | null
          outcome?: string
          promise_made?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "call_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "call_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "call_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "call_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "call_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "call_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "call_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      case_applicants: {
        Row: {
          applicant_role: string
          case_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          current_residence: string | null
          current_status_in_canada: string | null
          date_of_birth: string | null
          email: string | null
          exclusion_reason: string | null
          full_name: string
          gender: string | null
          id: string
          included_in_application: boolean
          is_primary: boolean
          nationality: string | null
          notes: string | null
          passport_expiry: string | null
          passport_number: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          applicant_role?: string
          case_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          current_residence?: string | null
          current_status_in_canada?: string | null
          date_of_birth?: string | null
          email?: string | null
          exclusion_reason?: string | null
          full_name: string
          gender?: string | null
          id?: string
          included_in_application?: boolean
          is_primary?: boolean
          nationality?: string | null
          notes?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          applicant_role?: string
          case_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          current_residence?: string | null
          current_status_in_canada?: string | null
          date_of_birth?: string | null
          email?: string | null
          exclusion_reason?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          included_in_application?: boolean
          is_primary?: boolean
          nationality?: string | null
          notes?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_applicants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "case_applicants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_applicants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_applicants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_applicants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "case_applicants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "case_applicants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_applicants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "case_applicants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "case_applicants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_applicants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "case_applicants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_applicants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "case_applicants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "case_applicants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "case_applicants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_applicants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "case_applicants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_applicants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      case_documents: {
        Row: {
          case_id: string
          created_at: string | null
          deleted_at: string | null
          document_type: string
          expires_at: string | null
          expires_on: string | null
          file_size_bytes: number | null
          id: string
          is_deleted: boolean | null
          mime_type: string | null
          notes: string | null
          page_count: number | null
          replaces_document_id: string | null
          status: string | null
          storage_bucket: string
          storage_path: string
          title: string
          updated_at: string | null
          uploaded_by: string | null
          uploaded_by_client_id: string | null
          verified_at: string | null
          verified_by: string | null
          version: number | null
        }
        Insert: {
          case_id: string
          created_at?: string | null
          deleted_at?: string | null
          document_type: string
          expires_at?: string | null
          expires_on?: string | null
          file_size_bytes?: number | null
          id?: string
          is_deleted?: boolean | null
          mime_type?: string | null
          notes?: string | null
          page_count?: number | null
          replaces_document_id?: string | null
          status?: string | null
          storage_bucket?: string
          storage_path: string
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
          uploaded_by_client_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
          version?: number | null
        }
        Update: {
          case_id?: string
          created_at?: string | null
          deleted_at?: string | null
          document_type?: string
          expires_at?: string | null
          expires_on?: string | null
          file_size_bytes?: number | null
          id?: string
          is_deleted?: boolean | null
          mime_type?: string | null
          notes?: string | null
          page_count?: number | null
          replaces_document_id?: string | null
          status?: string | null
          storage_bucket?: string
          storage_path?: string
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
          uploaded_by_client_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "case_documents_replaces_document_id_fkey"
            columns: ["replaces_document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_uploaded_by_client_id_fkey"
            columns: ["uploaded_by_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_uploaded_by_client_id_fkey"
            columns: ["uploaded_by_client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "case_documents_uploaded_by_client_id_fkey"
            columns: ["uploaded_by_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "case_documents_uploaded_by_client_id_fkey"
            columns: ["uploaded_by_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "case_documents_uploaded_by_client_id_fkey"
            columns: ["uploaded_by_client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_uploaded_by_client_id_fkey"
            columns: ["uploaded_by_client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "case_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "case_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      case_notes: {
        Row: {
          author_id: string | null
          body: string
          case_id: string
          created_at: string
          id: string
          is_pinned: boolean
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          case_id: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          case_id?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
        ]
      }
      case_requests: {
        Row: {
          case_id: string
          created_at: string | null
          description: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          fulfilled_note: string | null
          id: string
          request_type: string
          requested_by: string
          status: string
        }
        Insert: {
          case_id: string
          created_at?: string | null
          description: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfilled_note?: string | null
          id?: string
          request_type: string
          requested_by: string
          status?: string
        }
        Update: {
          case_id?: string
          created_at?: string | null
          description?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfilled_note?: string | null
          id?: string
          request_type?: string
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "case_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "case_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "case_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "case_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "case_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "case_requests_fulfilled_by_fkey"
            columns: ["fulfilled_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_requests_fulfilled_by_fkey"
            columns: ["fulfilled_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "case_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      case_stage_history: {
        Row: {
          case_id: string
          changed_at: string | null
          changed_by: string | null
          from_stage_code: string | null
          id: string
          note: string | null
          to_stage_code: string | null
        }
        Insert: {
          case_id: string
          changed_at?: string | null
          changed_by?: string | null
          from_stage_code?: string | null
          id?: string
          note?: string | null
          to_stage_code?: string | null
        }
        Update: {
          case_id?: string
          changed_at?: string | null
          changed_by?: string | null
          from_stage_code?: string | null
          id?: string
          note?: string | null
          to_stage_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_stage_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "case_stage_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_stage_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_stage_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_stage_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "case_stage_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "case_stage_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_stage_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "case_stage_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "case_stage_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_stage_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "case_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "case_stage_history_from_stage_code_fkey"
            columns: ["from_stage_code"]
            isOneToOne: false
            referencedRelation: "case_stages_ref"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "case_stage_history_to_stage_code_fkey"
            columns: ["to_stage_code"]
            isOneToOne: false
            referencedRelation: "case_stages_ref"
            referencedColumns: ["code"]
          },
        ]
      }
      case_stages_ref: {
        Row: {
          code: string
          is_terminal: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          code: string
          is_terminal?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          is_terminal?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      cases: {
        Row: {
          application_number: string | null
          archived_at: string | null
          case_code: string | null
          case_manager_id: string | null
          client_id: string
          created_at: string | null
          current_stage_code: string | null
          decision_at: string | null
          id: string
          is_archived: boolean | null
          notes: string | null
          outcome: string | null
          payment_plan_enabled: boolean
          payment_stages: Json | null
          priority: string | null
          quoted_fee_inr: number | null
          quoted_govt_fee_cad: number | null
          risk_level: string | null
          senior_advisor_id: string | null
          stage_entered_at: string | null
          submitted_at: string | null
          target_submission_date: string | null
          total_invoiced_inr: number | null
          total_paid_inr: number | null
          uci_number: string | null
          updated_at: string | null
          visa_sub_type_id: string | null
          visa_type_id: string
        }
        Insert: {
          application_number?: string | null
          archived_at?: string | null
          case_code?: string | null
          case_manager_id?: string | null
          client_id: string
          created_at?: string | null
          current_stage_code?: string | null
          decision_at?: string | null
          id?: string
          is_archived?: boolean | null
          notes?: string | null
          outcome?: string | null
          payment_plan_enabled?: boolean
          payment_stages?: Json | null
          priority?: string | null
          quoted_fee_inr?: number | null
          quoted_govt_fee_cad?: number | null
          risk_level?: string | null
          senior_advisor_id?: string | null
          stage_entered_at?: string | null
          submitted_at?: string | null
          target_submission_date?: string | null
          total_invoiced_inr?: number | null
          total_paid_inr?: number | null
          uci_number?: string | null
          updated_at?: string | null
          visa_sub_type_id?: string | null
          visa_type_id: string
        }
        Update: {
          application_number?: string | null
          archived_at?: string | null
          case_code?: string | null
          case_manager_id?: string | null
          client_id?: string
          created_at?: string | null
          current_stage_code?: string | null
          decision_at?: string | null
          id?: string
          is_archived?: boolean | null
          notes?: string | null
          outcome?: string | null
          payment_plan_enabled?: boolean
          payment_stages?: Json | null
          priority?: string | null
          quoted_fee_inr?: number | null
          quoted_govt_fee_cad?: number | null
          risk_level?: string | null
          senior_advisor_id?: string | null
          stage_entered_at?: string | null
          submitted_at?: string | null
          target_submission_date?: string | null
          total_invoiced_inr?: number | null
          total_paid_inr?: number | null
          uci_number?: string | null
          updated_at?: string | null
          visa_sub_type_id?: string | null
          visa_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_case_manager_id_fkey"
            columns: ["case_manager_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_case_manager_id_fkey"
            columns: ["case_manager_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cases_current_stage_code_fkey"
            columns: ["current_stage_code"]
            isOneToOne: false
            referencedRelation: "case_stages_ref"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "cases_senior_advisor_id_fkey"
            columns: ["senior_advisor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_senior_advisor_id_fkey"
            columns: ["senior_advisor_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "cases_visa_sub_type_id_fkey"
            columns: ["visa_sub_type_id"]
            isOneToOne: false
            referencedRelation: "visa_sub_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_visa_type_id_fkey"
            columns: ["visa_type_id"]
            isOneToOne: false
            referencedRelation: "visa_types"
            referencedColumns: ["id"]
          },
        ]
      }
      chain_rules: {
        Row: {
          counselor_script: string | null
          created_at: string | null
          delay_days: number | null
          description: string | null
          id: string
          is_active: boolean | null
          priority: string | null
          rule_code: string
          sla_days: number | null
          target_application_type: string
          trigger_application_type: string | null
        }
        Insert: {
          counselor_script?: string | null
          created_at?: string | null
          delay_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          priority?: string | null
          rule_code: string
          sla_days?: number | null
          target_application_type: string
          trigger_application_type?: string | null
        }
        Update: {
          counselor_script?: string | null
          created_at?: string | null
          delay_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          priority?: string | null
          rule_code?: string
          sla_days?: number | null
          target_application_type?: string
          trigger_application_type?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          birthday_month_day: string | null
          client_code: string | null
          country_of_citizenship: string | null
          created_at: string | null
          current_residence: string | null
          date_of_birth: string | null
          email: string | null
          family_role: string | null
          family_unit_id: string | null
          full_name: string
          id: string
          is_active: boolean | null
          notes: string | null
          onboarded_at: string | null
          phone: string | null
          portal_user_id: string | null
          preferred_language: string | null
          source_lead_id: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          birthday_month_day?: string | null
          client_code?: string | null
          country_of_citizenship?: string | null
          created_at?: string | null
          current_residence?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          portal_user_id?: string | null
          preferred_language?: string | null
          source_lead_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          birthday_month_day?: string | null
          client_code?: string | null
          country_of_citizenship?: string | null
          created_at?: string | null
          current_residence?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          onboarded_at?: string | null
          phone?: string | null
          portal_user_id?: string | null
          preferred_language?: string | null
          source_lead_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "v_top_family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "clients_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "clients_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "clients_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
        ]
      }
      comm_attachments: {
        Row: {
          created_at: string
          event_id: string
          file_name: string | null
          id: string
          mime_type: string | null
          org_id: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          event_id: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          org_id?: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          event_id?: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          org_id?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_attachments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "communication_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_attachments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          entity_id: string | null
          entity_type: string
          id: string
          org_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          org_id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_notifications: {
        Row: {
          body: string | null
          conversation_id: string | null
          created_at: string
          id: string
          kind: string
          org_id: string
          read_at: string | null
          staff_id: string
          title: string
        }
        Insert: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: string
          org_id?: string
          read_at?: string | null
          staff_id: string
          title: string
        }
        Update: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          org_id?: string
          read_at?: string | null
          staff_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_notifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_notifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          code: string
          flat_amount_inr: number | null
          id: string
          is_active: boolean | null
          label: string
          notes: string | null
          rate_percent: number | null
          trigger_event: string
        }
        Insert: {
          code: string
          flat_amount_inr?: number | null
          id?: string
          is_active?: boolean | null
          label: string
          notes?: string | null
          rate_percent?: number | null
          trigger_event: string
        }
        Update: {
          code?: string
          flat_amount_inr?: number | null
          id?: string
          is_active?: boolean | null
          label?: string
          notes?: string | null
          rate_percent?: number | null
          trigger_event?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount_inr: number
          case_id: string | null
          earned_at: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          paid_at: string | null
          payout_reference: string | null
          rule_code: string | null
          staff_id: string | null
          status: string | null
        }
        Insert: {
          amount_inr: number
          case_id?: string | null
          earned_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payout_reference?: string | null
          rule_code?: string | null
          staff_id?: string | null
          status?: string | null
        }
        Update: {
          amount_inr?: number
          case_id?: string | null
          earned_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payout_reference?: string | null
          rule_code?: string | null
          staff_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "commissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "commissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "commissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "commissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "commissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "commissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "commissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_rule_code_fkey"
            columns: ["rule_code"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "commissions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      communication_events: {
        Row: {
          actor_id: string | null
          body: string | null
          channel: string
          conversation_id: string
          created_at: string
          delivery_status: string | null
          direction: string
          event_type: string
          id: string
          occurred_at: string
          org_id: string
          payload: Json
          provider_message_id: string | null
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          channel: string
          conversation_id: string
          created_at?: string
          delivery_status?: string | null
          direction: string
          event_type: string
          id?: string
          occurred_at?: string
          org_id?: string
          payload?: Json
          provider_message_id?: string | null
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          channel?: string
          conversation_id?: string
          created_at?: string
          delivery_status?: string | null
          direction?: string
          event_type?: string
          id?: string
          occurred_at?: string
          org_id?: string
          payload?: Json
          provider_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "communication_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_festivals: {
        Row: {
          code: string
          is_active: boolean
          label: string
          next_date: string
          notes: string | null
          template_name: string
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          next_date: string
          notes?: string | null
          template_name: string
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          next_date?: string
          notes?: string | null
          template_name?: string
        }
        Relationships: []
      }
      contact_identities: {
        Row: {
          channel: string
          client_id: string | null
          created_at: string
          handle_norm: string
          handle_raw: string
          id: string
          is_primary: boolean
          lead_id: string | null
          link_status: string
          org_id: string
          verified_at: string | null
        }
        Insert: {
          channel: string
          client_id?: string | null
          created_at?: string
          handle_norm: string
          handle_raw: string
          id?: string
          is_primary?: boolean
          lead_id?: string | null
          link_status?: string
          org_id?: string
          verified_at?: string | null
        }
        Update: {
          channel?: string
          client_id?: string | null
          created_at?: string
          handle_norm?: string
          handle_raw?: string
          id?: string
          is_primary?: boolean
          lead_id?: string | null
          link_status?: string
          org_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_identities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_identities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "contact_identities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "contact_identities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "contact_identities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_identities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "contact_identities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_identities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "contact_identities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "contact_identities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "contact_identities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "contact_identities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_identities_bak_20260726: {
        Row: {
          channel: string | null
          client_id: string | null
          created_at: string | null
          handle_norm: string | null
          handle_raw: string | null
          id: string | null
          is_primary: boolean | null
          lead_id: string | null
          link_status: string | null
          org_id: string | null
          verified_at: string | null
        }
        Insert: {
          channel?: string | null
          client_id?: string | null
          created_at?: string | null
          handle_norm?: string | null
          handle_raw?: string | null
          id?: string | null
          is_primary?: boolean | null
          lead_id?: string | null
          link_status?: string | null
          org_id?: string | null
          verified_at?: string | null
        }
        Update: {
          channel?: string | null
          client_id?: string | null
          created_at?: string | null
          handle_norm?: string | null
          handle_raw?: string | null
          id?: string | null
          is_primary?: boolean | null
          lead_id?: string | null
          link_status?: string | null
          org_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      contact_reveal_log: {
        Row: {
          entity_id: string
          entity_type: string
          field: string
          id: string
          revealed_at: string
          staff_id: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          field: string
          id?: string
          revealed_at?: string
          staff_id: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          field?: string
          id?: string
          revealed_at?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_reveal_log_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_reveal_log_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel: string
          client_id: string | null
          contact_identity_id: string | null
          created_at: string
          id: string
          last_inbound_at: string | null
          last_outbound_at: string | null
          lead_id: string | null
          org_id: string
          sla_due_at: string | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel: string
          client_id?: string | null
          contact_identity_id?: string | null
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          lead_id?: string | null
          org_id?: string
          sla_due_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: string
          client_id?: string | null
          contact_identity_id?: string | null
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          lead_id?: string | null
          org_id?: string
          sla_due_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "conversations_contact_identity_id_fkey"
            columns: ["contact_identity_id"]
            isOneToOne: false
            referencedRelation: "contact_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      document_checklist_rules: {
        Row: {
          applicant_role: string
          category: string | null
          created_at: string
          created_by: string | null
          display_label: string
          document_code: string
          expiry_tracking: boolean
          id: string
          ircc_form_id: string | null
          is_active: boolean
          is_optional: boolean
          notes: string | null
          sort_order: number
          updated_at: string
          visa_type_code: string
        }
        Insert: {
          applicant_role?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          display_label: string
          document_code: string
          expiry_tracking?: boolean
          id?: string
          ircc_form_id?: string | null
          is_active?: boolean
          is_optional?: boolean
          notes?: string | null
          sort_order?: number
          updated_at?: string
          visa_type_code: string
        }
        Update: {
          applicant_role?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          display_label?: string
          document_code?: string
          expiry_tracking?: boolean
          id?: string
          ircc_form_id?: string | null
          is_active?: boolean
          is_optional?: boolean
          notes?: string | null
          sort_order?: number
          updated_at?: string
          visa_type_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_checklist_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_checklist_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      document_checklists: {
        Row: {
          applies_to: string | null
          document_type: string
          guidance_notes: string | null
          id: string
          is_required: boolean | null
          label: string
          sort_order: number | null
          visa_sub_type_id: string
        }
        Insert: {
          applies_to?: string | null
          document_type: string
          guidance_notes?: string | null
          id?: string
          is_required?: boolean | null
          label: string
          sort_order?: number | null
          visa_sub_type_id: string
        }
        Update: {
          applies_to?: string | null
          document_type?: string
          guidance_notes?: string | null
          id?: string
          is_required?: boolean | null
          label?: string
          sort_order?: number | null
          visa_sub_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_checklists_visa_sub_type_id_fkey"
            columns: ["visa_sub_type_id"]
            isOneToOne: false
            referencedRelation: "visa_sub_types"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_notes: {
        Row: {
          body: string
          case_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_locked: boolean
          lead_id: string | null
          locked_at: string | null
          locked_by: string | null
          migrated_from: string | null
          note_type: string
          unlocked_at: string | null
          unlocked_by: string | null
          updated_at: string
        }
        Insert: {
          body: string
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_locked?: boolean
          lead_id?: string | null
          locked_at?: string | null
          locked_by?: string | null
          migrated_from?: string | null
          note_type?: string
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_locked?: boolean
          lead_id?: string | null
          locked_at?: string | null
          locked_by?: string | null
          migrated_from?: string | null
          note_type?: string
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "entity_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "entity_notes_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "entity_notes_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      expiry_alert_rules: {
        Row: {
          alert1_days: number
          alert2_days: number
          client_template: string | null
          is_active: boolean
          item_type: string
          label: string
          task_title: string
          urgent: boolean
        }
        Insert: {
          alert1_days: number
          alert2_days: number
          client_template?: string | null
          is_active?: boolean
          item_type: string
          label: string
          task_title: string
          urgent?: boolean
        }
        Update: {
          alert1_days?: number
          alert2_days?: number
          client_template?: string | null
          is_active?: boolean
          item_type?: string
          label?: string
          task_title?: string
          urgent?: boolean
        }
        Relationships: []
      }
      expiry_items: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          expires_on: string
          id: string
          is_active: boolean
          item_type: string
          label: string | null
          notes: string | null
          source_document_id: string | null
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_on: string
          id?: string
          is_active?: boolean
          item_type: string
          label?: string | null
          notes?: string | null
          source_document_id?: string | null
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_on?: string
          id?: string
          is_active?: boolean
          item_type?: string
          label?: string | null
          notes?: string | null
          source_document_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expiry_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "expiry_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "expiry_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "expiry_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "expiry_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "expiry_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "expiry_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "expiry_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "expiry_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "expiry_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "expiry_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "expiry_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "expiry_items_item_type_fkey"
            columns: ["item_type"]
            isOneToOne: false
            referencedRelation: "expiry_alert_rules"
            referencedColumns: ["item_type"]
          },
        ]
      }
      family_members: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          full_name: string
          id: string
          is_dependent: boolean | null
          is_included_on_current_case: boolean | null
          notes: string | null
          passport_number: string | null
          principal_client_id: string
          relationship: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          full_name: string
          id?: string
          is_dependent?: boolean | null
          is_included_on_current_case?: boolean | null
          notes?: string | null
          passport_number?: string | null
          principal_client_id: string
          relationship: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          full_name?: string
          id?: string
          is_dependent?: boolean | null
          is_included_on_current_case?: boolean | null
          notes?: string | null
          passport_number?: string | null
          principal_client_id?: string
          relationship?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_principal_client_id_fkey"
            columns: ["principal_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_principal_client_id_fkey"
            columns: ["principal_client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "family_members_principal_client_id_fkey"
            columns: ["principal_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "family_members_principal_client_id_fkey"
            columns: ["principal_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "family_members_principal_client_id_fkey"
            columns: ["principal_client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_principal_client_id_fkey"
            columns: ["principal_client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
        ]
      }
      family_units: {
        Row: {
          created_at: string | null
          expected_lifetime_revenue_cad: number | null
          id: string
          lifetime_revenue_cad: number | null
          origin_country: string | null
          unit_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expected_lifetime_revenue_cad?: number | null
          id?: string
          lifetime_revenue_cad?: number | null
          origin_country?: string | null
          unit_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expected_lifetime_revenue_cad?: number | null
          id?: string
          lifetime_revenue_cad?: number | null
          origin_country?: string | null
          unit_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          amount_inr: number
          case_id: string | null
          category: string | null
          client_id: string | null
          created_at: string
          description: string | null
          direction: string
          entry_type: string
          id: string
          incurred_on: string
          metadata: Json
          paid_to: string | null
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          amount_inr: number
          case_id?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          direction?: string
          entry_type: string
          id?: string
          incurred_on?: string
          metadata?: Json
          paid_to?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          amount_inr?: number
          case_id?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          direction?: string
          entry_type?: string
          id?: string
          incurred_on?: string
          metadata?: Json
          paid_to?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "finance_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "finance_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "finance_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "finance_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "finance_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "finance_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "finance_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "finance_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "finance_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "finance_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "finance_entries_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      integrations_config: {
        Row: {
          category: string
          code: string
          connected_as: string | null
          created_at: string
          display_name: string
          fees_note: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          metadata: Json
          region: string | null
          sort_order: number
          status: string
          updated_at: string
          usage_30d: number
        }
        Insert: {
          category: string
          code: string
          connected_as?: string | null
          created_at?: string
          display_name: string
          fees_note?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          metadata?: Json
          region?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          usage_30d?: number
        }
        Update: {
          category?: string
          code?: string
          connected_as?: string | null
          created_at?: string
          display_name?: string
          fees_note?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          metadata?: Json
          region?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          usage_30d?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          case_id: string | null
          client_id: string
          created_at: string | null
          currency: string
          due_date: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          line_items: Json
          notes: string | null
          paid_total: number | null
          pdf_storage_path: string | null
          status: string | null
          subtotal: number
          tax: number | null
          total: number
          updated_at: string | null
        }
        Insert: {
          case_id?: string | null
          client_id: string
          created_at?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          line_items?: Json
          notes?: string | null
          paid_total?: number | null
          pdf_storage_path?: string | null
          status?: string | null
          subtotal: number
          tax?: number | null
          total: number
          updated_at?: string | null
        }
        Update: {
          case_id?: string | null
          client_id?: string
          created_at?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          line_items?: Json
          notes?: string | null
          paid_total?: number | null
          pdf_storage_path?: string | null
          status?: string | null
          subtotal?: number
          tax?: number | null
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
        ]
      }
      ircc_emails: {
        Row: {
          action_due_at: string | null
          attachments: Json | null
          body_html_storage_path: string | null
          body_text: string | null
          created_at: string | null
          delivery_channel: string | null
          email_type: string | null
          from_address: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          keyword_flags: string[] | null
          matched_case_id: string | null
          notification_sent_at: string | null
          processed_at: string | null
          processed_by: string | null
          received_at: string
          requires_action: boolean | null
          subject: string | null
        }
        Insert: {
          action_due_at?: string | null
          attachments?: Json | null
          body_html_storage_path?: string | null
          body_text?: string | null
          created_at?: string | null
          delivery_channel?: string | null
          email_type?: string | null
          from_address?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          keyword_flags?: string[] | null
          matched_case_id?: string | null
          notification_sent_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          received_at: string
          requires_action?: boolean | null
          subject?: string | null
        }
        Update: {
          action_due_at?: string | null
          attachments?: Json | null
          body_html_storage_path?: string | null
          body_text?: string | null
          created_at?: string | null
          delivery_channel?: string | null
          email_type?: string | null
          from_address?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          keyword_flags?: string[] | null
          matched_case_id?: string | null
          notification_sent_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          received_at?: string
          requires_action?: boolean | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ircc_emails_matched_case_id_fkey"
            columns: ["matched_case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "ircc_emails_matched_case_id_fkey"
            columns: ["matched_case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ircc_emails_matched_case_id_fkey"
            columns: ["matched_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ircc_emails_matched_case_id_fkey"
            columns: ["matched_case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ircc_emails_matched_case_id_fkey"
            columns: ["matched_case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "ircc_emails_matched_case_id_fkey"
            columns: ["matched_case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "ircc_emails_matched_case_id_fkey"
            columns: ["matched_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "ircc_emails_matched_case_id_fkey"
            columns: ["matched_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "ircc_emails_matched_case_id_fkey"
            columns: ["matched_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "ircc_emails_matched_case_id_fkey"
            columns: ["matched_case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ircc_emails_matched_case_id_fkey"
            columns: ["matched_case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "ircc_emails_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ircc_emails_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          org_id: string
          payload: Json
          run_after: string
          status: string
          type: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          org_id?: string
          payload?: Json
          run_after?: string
          status?: string
          type: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          org_id?: string
          payload?: Json
          run_after?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_deletions: {
        Row: {
          assigned_to: string | null
          deleted_at: string
          deleted_by: string | null
          deleted_by_name: string | null
          dependents: Json
          email: string | null
          full_name: string | null
          id: string
          lead_id: string
          lead_snapshot: Json
          lead_status: string | null
          phone: string | null
          reason: string
        }
        Insert: {
          assigned_to?: string | null
          deleted_at?: string
          deleted_by?: string | null
          deleted_by_name?: string | null
          dependents?: Json
          email?: string | null
          full_name?: string | null
          id?: string
          lead_id: string
          lead_snapshot: Json
          lead_status?: string | null
          phone?: string | null
          reason: string
        }
        Update: {
          assigned_to?: string | null
          deleted_at?: string
          deleted_by?: string | null
          deleted_by_name?: string | null
          dependents?: Json
          email?: string | null
          full_name?: string | null
          id?: string
          lead_id?: string
          lead_snapshot?: Json
          lead_status?: string | null
          phone?: string | null
          reason?: string
        }
        Relationships: []
      }
      lead_nurture_targets: {
        Row: {
          cap_at: string
          created_at: string
          created_by: string | null
          eligible_at: string
          id: string
          lead_id: string
          notes: string | null
          reason: string | null
          status: string
          target_program_code: string
        }
        Insert: {
          cap_at: string
          created_at?: string
          created_by?: string | null
          eligible_at: string
          id?: string
          lead_id: string
          notes?: string | null
          reason?: string | null
          status?: string
          target_program_code: string
        }
        Update: {
          cap_at?: string
          created_at?: string
          created_by?: string | null
          eligible_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          reason?: string | null
          status?: string
          target_program_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_nurture_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_nurture_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "lead_nurture_targets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_nurture_targets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_nurture_targets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "lead_nurture_targets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_nurture_targets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
        ]
      }
      lead_routing_rules: {
        Row: {
          assign_role: string | null
          assign_specialty: string | null
          assign_staff_id: string | null
          assign_strategy: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          match_office_hours_only: boolean
          match_source_codes: string[] | null
          match_visa_type_codes: string[] | null
          notes: string | null
          priority: number
          updated_at: string
        }
        Insert: {
          assign_role?: string | null
          assign_specialty?: string | null
          assign_staff_id?: string | null
          assign_strategy?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          match_office_hours_only?: boolean
          match_source_codes?: string[] | null
          match_visa_type_codes?: string[] | null
          notes?: string | null
          priority?: number
          updated_at?: string
        }
        Update: {
          assign_role?: string | null
          assign_specialty?: string | null
          assign_staff_id?: string | null
          assign_strategy?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          match_office_hours_only?: boolean
          match_source_codes?: string[] | null
          match_visa_type_codes?: string[] | null
          notes?: string | null
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_routing_rules_assign_staff_id_fkey"
            columns: ["assign_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_routing_rules_assign_staff_id_fkey"
            columns: ["assign_staff_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "lead_routing_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_routing_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          code: string
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          code: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          agent_partner_id: string | null
          assessment_completed_at: string | null
          assessment_data: Json | null
          assessment_score: number | null
          assessment_submitted_at: string | null
          assessment_threshold_met: boolean | null
          assigned_to: string | null
          converted_at: string | null
          converted_client_id: string | null
          country_of_interest: string | null
          country_of_residence: string | null
          created_at: string | null
          created_by: string | null
          crs_score: number | null
          email: string | null
          enquiry_client_id: string | null
          family_role: string | null
          family_unit_id: string | null
          first_name: string | null
          first_responded_at: string | null
          first_response_due_at: string | null
          full_name: string
          has_ircc_invitation: boolean | null
          id: string
          interested_category_id: string | null
          interested_country: string | null
          interested_visa_sub_type_id: string | null
          interested_visa_type_id: string | null
          ircc_invitation_type: string | null
          last_name: string | null
          lifecycle_state: string | null
          lost_reason: string | null
          nationality: string | null
          notes: string | null
          phone: string | null
          referral_partner_id: string | null
          referrer_name: string | null
          source_code: string | null
          source_detail: string | null
          source_person_name: string | null
          stage_metadata: Json | null
          status: string
          updated_at: string | null
          waiting_contact_frequency: string | null
          waiting_end_date: string | null
          waiting_linked_milestone: string | null
          waiting_reason: string | null
          waiting_review_notes: string | null
          waiting_start_date: string | null
        }
        Insert: {
          agent_partner_id?: string | null
          assessment_completed_at?: string | null
          assessment_data?: Json | null
          assessment_score?: number | null
          assessment_submitted_at?: string | null
          assessment_threshold_met?: boolean | null
          assigned_to?: string | null
          converted_at?: string | null
          converted_client_id?: string | null
          country_of_interest?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          created_by?: string | null
          crs_score?: number | null
          email?: string | null
          enquiry_client_id?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          first_name?: string | null
          first_responded_at?: string | null
          first_response_due_at?: string | null
          full_name: string
          has_ircc_invitation?: boolean | null
          id?: string
          interested_category_id?: string | null
          interested_country?: string | null
          interested_visa_sub_type_id?: string | null
          interested_visa_type_id?: string | null
          ircc_invitation_type?: string | null
          last_name?: string | null
          lifecycle_state?: string | null
          lost_reason?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          referral_partner_id?: string | null
          referrer_name?: string | null
          source_code?: string | null
          source_detail?: string | null
          source_person_name?: string | null
          stage_metadata?: Json | null
          status?: string
          updated_at?: string | null
          waiting_contact_frequency?: string | null
          waiting_end_date?: string | null
          waiting_linked_milestone?: string | null
          waiting_reason?: string | null
          waiting_review_notes?: string | null
          waiting_start_date?: string | null
        }
        Update: {
          agent_partner_id?: string | null
          assessment_completed_at?: string | null
          assessment_data?: Json | null
          assessment_score?: number | null
          assessment_submitted_at?: string | null
          assessment_threshold_met?: boolean | null
          assigned_to?: string | null
          converted_at?: string | null
          converted_client_id?: string | null
          country_of_interest?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          created_by?: string | null
          crs_score?: number | null
          email?: string | null
          enquiry_client_id?: string | null
          family_role?: string | null
          family_unit_id?: string | null
          first_name?: string | null
          first_responded_at?: string | null
          first_response_due_at?: string | null
          full_name?: string
          has_ircc_invitation?: boolean | null
          id?: string
          interested_category_id?: string | null
          interested_country?: string | null
          interested_visa_sub_type_id?: string | null
          interested_visa_type_id?: string | null
          ircc_invitation_type?: string | null
          last_name?: string | null
          lifecycle_state?: string | null
          lost_reason?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          referral_partner_id?: string | null
          referrer_name?: string | null
          source_code?: string | null
          source_detail?: string | null
          source_person_name?: string | null
          stage_metadata?: Json | null
          status?: string
          updated_at?: string | null
          waiting_contact_frequency?: string | null
          waiting_end_date?: string | null
          waiting_linked_milestone?: string | null
          waiting_reason?: string | null
          waiting_review_notes?: string | null
          waiting_start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_leads_converted_client"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_leads_converted_client"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "fk_leads_converted_client"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "fk_leads_converted_client"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "fk_leads_converted_client"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_leads_converted_client"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "leads_agent_partner_id_fkey"
            columns: ["agent_partner_id"]
            isOneToOne: false
            referencedRelation: "agent_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "leads_enquiry_client_id_fkey"
            columns: ["enquiry_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_enquiry_client_id_fkey"
            columns: ["enquiry_client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "leads_enquiry_client_id_fkey"
            columns: ["enquiry_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "leads_enquiry_client_id_fkey"
            columns: ["enquiry_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "leads_enquiry_client_id_fkey"
            columns: ["enquiry_client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_enquiry_client_id_fkey"
            columns: ["enquiry_client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "leads_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "v_top_family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_interested_category_id_fkey"
            columns: ["interested_category_id"]
            isOneToOne: false
            referencedRelation: "visa_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_interested_visa_type_id_fkey"
            columns: ["interested_visa_type_id"]
            isOneToOne: false
            referencedRelation: "visa_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referral_partner_id_fkey"
            columns: ["referral_partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_code_fkey"
            columns: ["source_code"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["code"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          body: string | null
          body_plain: string | null
          case_id: string | null
          channel: string
          client_id: string | null
          created_at: string | null
          direction: string
          duration_seconds: number | null
          external_message_id: string | null
          from_contact: string | null
          from_staff_id: string | null
          id: string
          is_read: boolean | null
          is_template: boolean
          last_edited_at: string | null
          last_edited_by: string | null
          lead_id: string | null
          read_at: string | null
          recording_storage_path: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          template_category: string | null
          template_id: string | null
          template_name: string | null
          template_variables: string[] | null
          to_contact: string | null
        }
        Insert: {
          attachments?: Json | null
          body?: string | null
          body_plain?: string | null
          case_id?: string | null
          channel: string
          client_id?: string | null
          created_at?: string | null
          direction: string
          duration_seconds?: number | null
          external_message_id?: string | null
          from_contact?: string | null
          from_staff_id?: string | null
          id?: string
          is_read?: boolean | null
          is_template?: boolean
          last_edited_at?: string | null
          last_edited_by?: string | null
          lead_id?: string | null
          read_at?: string | null
          recording_storage_path?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_category?: string | null
          template_id?: string | null
          template_name?: string | null
          template_variables?: string[] | null
          to_contact?: string | null
        }
        Update: {
          attachments?: Json | null
          body?: string | null
          body_plain?: string | null
          case_id?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string | null
          direction?: string
          duration_seconds?: number | null
          external_message_id?: string | null
          from_contact?: string | null
          from_staff_id?: string | null
          id?: string
          is_read?: boolean | null
          is_template?: boolean
          last_edited_at?: string | null
          last_edited_by?: string | null
          lead_id?: string | null
          read_at?: string | null
          recording_storage_path?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_category?: string | null
          template_id?: string | null
          template_name?: string | null
          template_variables?: string[] | null
          to_contact?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "messages_from_staff_id_fkey"
            columns: ["from_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_from_staff_id_fkey"
            columns: ["from_staff_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      office_holidays: {
        Row: {
          country: string
          created_at: string
          created_by: string | null
          date: string
          label: string
        }
        Insert: {
          country?: string
          created_at?: string
          created_by?: string | null
          date: string
          label: string
        }
        Update: {
          country?: string
          created_at?: string
          created_by?: string | null
          date?: string
          label?: string
        }
        Relationships: []
      }
      office_hours_config: {
        Row: {
          close_time: string | null
          is_closed: boolean
          open_time: string | null
          timezone: string
          updated_at: string
          updated_by: string | null
          weekday: number
        }
        Insert: {
          close_time?: string | null
          is_closed?: boolean
          open_time?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          weekday: number
        }
        Update: {
          close_time?: string | null
          is_closed?: boolean
          open_time?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          weekday?: number
        }
        Relationships: []
      }
      office_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      orgs: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      outbound_messages: {
        Row: {
          attempts: number
          body: string | null
          channel: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          related_case_id: string | null
          related_client_id: string | null
          related_lead_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string | null
          template_code: string | null
          to_contact: string
          trigger_event_id: string | null
          variables: Json
        }
        Insert: {
          attempts?: number
          body?: string | null
          channel: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          related_case_id?: string | null
          related_client_id?: string | null
          related_lead_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_code?: string | null
          to_contact: string
          trigger_event_id?: string | null
          variables?: Json
        }
        Update: {
          attempts?: number
          body?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          related_case_id?: string | null
          related_client_id?: string | null
          related_lead_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_code?: string | null
          to_contact?: string
          trigger_event_id?: string | null
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "outbound_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_related_case_id_fkey"
            columns: ["related_case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "outbound_messages_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "outbound_messages_trigger_event_id_fkey"
            columns: ["trigger_event_id"]
            isOneToOne: false
            referencedRelation: "trigger_events"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          invoice_id: string
          notes: string | null
          paid_at: string | null
          provider: string | null
          provider_payload: Json | null
          provider_reference: string | null
          refund_reference: string | null
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency: string
          id?: string
          invoice_id: string
          notes?: string | null
          paid_at?: string | null
          provider?: string | null
          provider_payload?: Json | null
          provider_reference?: string | null
          refund_reference?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          paid_at?: string | null
          provider?: string | null
          provider_payload?: Json | null
          provider_reference?: string | null
          refund_reference?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      program_eligibility_rules: {
        Row: {
          condition: Json
          id: string
          is_active: boolean
          label: string
          rule_code: string
          rule_type: string
          sort_order: number
          version: string
          visa_code: string
          weight: number
        }
        Insert: {
          condition: Json
          id?: string
          is_active?: boolean
          label: string
          rule_code: string
          rule_type: string
          sort_order?: number
          version?: string
          visa_code: string
          weight?: number
        }
        Update: {
          condition?: Json
          id?: string
          is_active?: boolean
          label?: string
          rule_code?: string
          rule_type?: string
          sort_order?: number
          version?: string
          visa_code?: string
          weight?: number
        }
        Relationships: []
      }
      prospective_applications: {
        Row: {
          assigned_counselor_id: string | null
          created_at: string | null
          estimated_fee_cad: number | null
          expires_on: string | null
          family_unit_id: string | null
          for_person_id: string | null
          for_person_type: string | null
          id: string
          notes: string | null
          promoted_case_id: string | null
          source_case_id: string | null
          status: string | null
          target_application_type: string
          trigger_date: string
          triggered_by_rule: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_counselor_id?: string | null
          created_at?: string | null
          estimated_fee_cad?: number | null
          expires_on?: string | null
          family_unit_id?: string | null
          for_person_id?: string | null
          for_person_type?: string | null
          id?: string
          notes?: string | null
          promoted_case_id?: string | null
          source_case_id?: string | null
          status?: string | null
          target_application_type: string
          trigger_date: string
          triggered_by_rule?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_counselor_id?: string | null
          created_at?: string | null
          estimated_fee_cad?: number | null
          expires_on?: string | null
          family_unit_id?: string | null
          for_person_id?: string | null
          for_person_type?: string | null
          id?: string
          notes?: string | null
          promoted_case_id?: string | null
          source_case_id?: string | null
          status?: string | null
          target_application_type?: string
          trigger_date?: string
          triggered_by_rule?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospective_applications_assigned_counselor_id_fkey"
            columns: ["assigned_counselor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospective_applications_assigned_counselor_id_fkey"
            columns: ["assigned_counselor_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "prospective_applications_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospective_applications_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "v_top_family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospective_applications_promoted_case_id_fkey"
            columns: ["promoted_case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "prospective_applications_promoted_case_id_fkey"
            columns: ["promoted_case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospective_applications_promoted_case_id_fkey"
            columns: ["promoted_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospective_applications_promoted_case_id_fkey"
            columns: ["promoted_case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospective_applications_promoted_case_id_fkey"
            columns: ["promoted_case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "prospective_applications_promoted_case_id_fkey"
            columns: ["promoted_case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "prospective_applications_promoted_case_id_fkey"
            columns: ["promoted_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "prospective_applications_promoted_case_id_fkey"
            columns: ["promoted_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "prospective_applications_promoted_case_id_fkey"
            columns: ["promoted_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "prospective_applications_promoted_case_id_fkey"
            columns: ["promoted_case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospective_applications_promoted_case_id_fkey"
            columns: ["promoted_case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "prospective_applications_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "prospective_applications_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospective_applications_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospective_applications_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospective_applications_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "prospective_applications_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "prospective_applications_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "prospective_applications_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "prospective_applications_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "prospective_applications_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospective_applications_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "prospective_applications_triggered_by_rule_fkey"
            columns: ["triggered_by_rule"]
            isOneToOne: false
            referencedRelation: "chain_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_questions: {
        Row: {
          auto_trigger: Json | null
          created_at: string
          default_value: Json | null
          field_code: string
          field_type: string
          help_text: string | null
          id: string
          is_required: boolean
          label: string
          options: Json | null
          placeholder: string | null
          scoring_tags: string[] | null
          section_id: string
          sort_order: number
          validation: Json | null
          visibility_rule: Json | null
        }
        Insert: {
          auto_trigger?: Json | null
          created_at?: string
          default_value?: Json | null
          field_code: string
          field_type: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          label: string
          options?: Json | null
          placeholder?: string | null
          scoring_tags?: string[] | null
          section_id: string
          sort_order?: number
          validation?: Json | null
          visibility_rule?: Json | null
        }
        Update: {
          auto_trigger?: Json | null
          created_at?: string
          default_value?: Json | null
          field_code?: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          label?: string
          options?: Json | null
          placeholder?: string | null
          scoring_tags?: string[] | null
          section_id?: string
          sort_order?: number
          validation?: Json | null
          visibility_rule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_response_items: {
        Row: {
          answered_at: string
          id: string
          is_skipped: boolean
          question_id: string
          response_id: string
          skip_reason: string | null
          value: Json | null
        }
        Insert: {
          answered_at?: string
          id?: string
          is_skipped?: boolean
          question_id: string
          response_id: string
          skip_reason?: string | null
          value?: Json | null
        }
        Update: {
          answered_at?: string
          id?: string
          is_skipped?: boolean
          question_id?: string
          response_id?: string
          skip_reason?: string | null
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_response_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_response_items_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_response_items_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "v_assessment_answers"
            referencedColumns: ["response_id"]
          },
        ]
      }
      questionnaire_responses: {
        Row: {
          applicant_id: string | null
          case_id: string | null
          completion_pct: number
          created_at: string
          id: string
          last_autosaved_at: string | null
          lead_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          score: number | null
          status: string
          submitted_at: string | null
          template_id: string
          threshold_met: boolean | null
          updated_at: string
        }
        Insert: {
          applicant_id?: string | null
          case_id?: string | null
          completion_pct?: number
          created_at?: string
          id?: string
          last_autosaved_at?: string | null
          lead_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          status?: string
          submitted_at?: string | null
          template_id: string
          threshold_met?: boolean | null
          updated_at?: string
        }
        Update: {
          applicant_id?: string | null
          case_id?: string | null
          completion_pct?: number
          created_at?: string
          id?: string
          last_autosaved_at?: string | null
          lead_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          status?: string
          submitted_at?: string | null
          template_id?: string
          threshold_met?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_responses_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "case_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_sections: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          sort_order: number
          template_id: string
          visibility_rule: Json | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          label: string
          sort_order?: number
          template_id: string
          visibility_rule?: Json | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          sort_order?: number
          template_id?: string
          visibility_rule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_templates: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_current: boolean
          label: string
          updated_at: string
          version_label: string
          visa_type_code: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_current?: boolean
          label: string
          updated_at?: string
          version_label?: string
          visa_type_code?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_current?: boolean
          label?: string
          updated_at?: string
          version_label?: string
          visa_type_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      referral_partners: {
        Row: {
          commission_rate: number | null
          commission_type: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          commission_rate?: number | null
          commission_type?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          commission_rate?: number | null
          commission_type?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sla_rules: {
        Row: {
          applies_to: string
          code: string
          escalate_to_role: string | null
          hard_deadline_action: string | null
          is_active: boolean | null
          label: string
          office_hours_only: boolean | null
          reminder_minutes: number | null
          target_minutes: number
        }
        Insert: {
          applies_to: string
          code: string
          escalate_to_role?: string | null
          hard_deadline_action?: string | null
          is_active?: boolean | null
          label: string
          office_hours_only?: boolean | null
          reminder_minutes?: number | null
          target_minutes: number
        }
        Update: {
          applies_to?: string
          code?: string
          escalate_to_role?: string | null
          hard_deadline_action?: string | null
          is_active?: boolean | null
          label?: string
          office_hours_only?: boolean | null
          reminder_minutes?: number | null
          target_minutes?: number
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          branch_code: string | null
          chain_misses_count: number | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          performance_rating: number | null
          phone: string | null
          role: string
          updated_at: string | null
          visa_specialties: string[] | null
        }
        Insert: {
          branch_code?: string | null
          chain_misses_count?: number | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          performance_rating?: number | null
          phone?: string | null
          role: string
          updated_at?: string | null
          visa_specialties?: string[] | null
        }
        Update: {
          branch_code?: string | null
          chain_misses_count?: number | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          performance_rating?: number | null
          phone?: string | null
          role?: string
          updated_at?: string | null
          visa_specialties?: string[] | null
        }
        Relationships: []
      }
      step_conditions: {
        Row: {
          action: string
          alternate_step_id: string | null
          condition: Json
          id: string
          notes: string | null
          step_template_id: string
        }
        Insert: {
          action: string
          alternate_step_id?: string | null
          condition: Json
          id?: string
          notes?: string | null
          step_template_id: string
        }
        Update: {
          action?: string
          alternate_step_id?: string | null
          condition?: Json
          id?: string
          notes?: string | null
          step_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_conditions_alternate_step_id_fkey"
            columns: ["alternate_step_id"]
            isOneToOne: false
            referencedRelation: "step_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_conditions_step_template_id_fkey"
            columns: ["step_template_id"]
            isOneToOne: false
            referencedRelation: "step_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      step_template_edits: {
        Row: {
          applied_version: number | null
          id: string
          proposed_at: string | null
          proposed_by: string | null
          proposed_change: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rollback_from_version: number | null
          status: string | null
          step_template_id: string | null
        }
        Insert: {
          applied_version?: number | null
          id?: string
          proposed_at?: string | null
          proposed_by?: string | null
          proposed_change: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rollback_from_version?: number | null
          status?: string | null
          step_template_id?: string | null
        }
        Update: {
          applied_version?: number | null
          id?: string
          proposed_at?: string | null
          proposed_by?: string | null
          proposed_change?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rollback_from_version?: number | null
          status?: string | null
          step_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "step_template_edits_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_template_edits_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "step_template_edits_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_template_edits_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "step_template_edits_step_template_id_fkey"
            columns: ["step_template_id"]
            isOneToOne: false
            referencedRelation: "step_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      step_templates: {
        Row: {
          assigned_role: string | null
          description: string | null
          due_offset_days: number | null
          id: string
          is_active: boolean | null
          sla_rule_code: string | null
          sort_order: number | null
          step_code: string
          step_type: string
          title: string
          version: number | null
          visa_sub_type_id: string | null
        }
        Insert: {
          assigned_role?: string | null
          description?: string | null
          due_offset_days?: number | null
          id?: string
          is_active?: boolean | null
          sla_rule_code?: string | null
          sort_order?: number | null
          step_code: string
          step_type?: string
          title: string
          version?: number | null
          visa_sub_type_id?: string | null
        }
        Update: {
          assigned_role?: string | null
          description?: string | null
          due_offset_days?: number | null
          id?: string
          is_active?: boolean | null
          sla_rule_code?: string | null
          sort_order?: number | null
          step_code?: string
          step_type?: string
          title?: string
          version?: number | null
          visa_sub_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "step_templates_sla_rule_code_fkey"
            columns: ["sla_rule_code"]
            isOneToOne: false
            referencedRelation: "sla_rules"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "step_templates_visa_sub_type_id_fkey"
            columns: ["visa_sub_type_id"]
            isOneToOne: false
            referencedRelation: "visa_sub_types"
            referencedColumns: ["id"]
          },
        ]
      }
      task_statuses_ref: {
        Row: {
          code: string
          is_terminal: boolean | null
          label: string
        }
        Insert: {
          code: string
          is_terminal?: boolean | null
          label: string
        }
        Update: {
          code?: string
          is_terminal?: boolean | null
          label?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_to: string | null
          case_id: string | null
          closed_note: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_at: string | null
          due_date: string | null
          id: string
          kind: string
          lead_id: string | null
          priority: string | null
          sla_rule_code: string | null
          source: string | null
          status_code: string | null
          superseded_by: string | null
          task_key: string | null
          title: string
          trigger_event_id: string | null
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_to?: string | null
          case_id?: string | null
          closed_note?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          priority?: string | null
          sla_rule_code?: string | null
          source?: string | null
          status_code?: string | null
          superseded_by?: string | null
          task_key?: string | null
          title: string
          trigger_event_id?: string | null
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_to?: string | null
          case_id?: string | null
          closed_note?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          priority?: string | null
          sla_rule_code?: string | null
          source?: string | null
          status_code?: string | null
          superseded_by?: string | null
          task_key?: string | null
          title?: string
          trigger_event_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "tasks_status_code_fkey"
            columns: ["status_code"]
            isOneToOne: false
            referencedRelation: "task_statuses_ref"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "tasks_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      trigger_events: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string | null
          created_task_id: string | null
          fired_at: string | null
          id: string
          outcome: string | null
          trigger_code: string | null
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          created_task_id?: string | null
          fired_at?: string | null
          id?: string
          outcome?: string | null
          trigger_code?: string | null
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          created_task_id?: string | null
          fired_at?: string | null
          id?: string
          outcome?: string | null
          trigger_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trigger_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "trigger_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trigger_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trigger_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trigger_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "trigger_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "trigger_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "trigger_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "trigger_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "trigger_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trigger_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "trigger_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trigger_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "trigger_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "trigger_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "trigger_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trigger_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "trigger_events_created_task_id_fkey"
            columns: ["created_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trigger_events_trigger_code_fkey"
            columns: ["trigger_code"]
            isOneToOne: false
            referencedRelation: "upsell_triggers"
            referencedColumns: ["code"]
          },
        ]
      }
      upsell_triggers: {
        Row: {
          code: string
          delay_days: number | null
          description: string | null
          is_active: boolean | null
          label: string
          offer_visa_code: string | null
          sort_order: number | null
          trigger_condition: Json
        }
        Insert: {
          code: string
          delay_days?: number | null
          description?: string | null
          is_active?: boolean | null
          label: string
          offer_visa_code?: string | null
          sort_order?: number | null
          trigger_condition: Json
        }
        Update: {
          code?: string
          delay_days?: number | null
          description?: string | null
          is_active?: boolean | null
          label?: string
          offer_visa_code?: string | null
          sort_order?: number | null
          trigger_condition?: Json
        }
        Relationships: []
      }
      visa_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      visa_sub_types: {
        Row: {
          code: string
          id: string
          is_active: boolean | null
          label: string
          processing_time_days: number | null
          visa_type_id: string | null
        }
        Insert: {
          code: string
          id?: string
          is_active?: boolean | null
          label: string
          processing_time_days?: number | null
          visa_type_id?: string | null
        }
        Update: {
          code?: string
          id?: string
          is_active?: boolean | null
          label?: string
          processing_time_days?: number | null
          visa_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visa_sub_types_visa_type_id_fkey"
            columns: ["visa_type_id"]
            isOneToOne: false
            referencedRelation: "visa_types"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_types: {
        Row: {
          base_fee_cad: number | null
          base_fee_inr: number | null
          category: string
          category_id: string | null
          code: string
          destination_country: string | null
          govt_fee_cad: number | null
          id: string
          is_active: boolean | null
          is_commission_based: boolean | null
          label: string
          notes: string | null
          requires_canada_residency: boolean | null
        }
        Insert: {
          base_fee_cad?: number | null
          base_fee_inr?: number | null
          category: string
          category_id?: string | null
          code: string
          destination_country?: string | null
          govt_fee_cad?: number | null
          id?: string
          is_active?: boolean | null
          is_commission_based?: boolean | null
          label: string
          notes?: string | null
          requires_canada_residency?: boolean | null
        }
        Update: {
          base_fee_cad?: number | null
          base_fee_inr?: number | null
          category?: string
          category_id?: string | null
          code?: string
          destination_country?: string | null
          govt_fee_cad?: number | null
          id?: string
          is_active?: boolean | null
          is_commission_based?: boolean | null
          label?: string
          notes?: string | null
          requires_canada_residency?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "visa_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "visa_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_templates: {
        Row: {
          body: string
          category: string
          id: string
          language: string
          name: string
          org_id: string
          status: string
        }
        Insert: {
          body: string
          category?: string
          id?: string
          language?: string
          name: string
          org_id?: string
          status?: string
        }
        Update: {
          body?: string
          category?: string
          id?: string
          language?: string
          name?: string
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_webhook_events: {
        Row: {
          id: string
          payload: Json
          received_at: string
          signature_ok: boolean
        }
        Insert: {
          id?: string
          payload: Json
          received_at?: string
          signature_ok: boolean
        }
        Update: {
          id?: string
          payload?: Json
          received_at?: string
          signature_ok?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      activity_log: {
        Row: {
          actor_id: string | null
          body: string | null
          case_id: string | null
          client_id: string | null
          created_at: string | null
          description: string | null
          event_type: string | null
          id: string | null
          is_system: boolean | null
          lead_id: string | null
          metadata: Json | null
          occurred_at: string | null
          title: string | null
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          event_type?: string | null
          id?: string | null
          is_system?: boolean | null
          lead_id?: string | null
          metadata?: Json | null
          occurred_at?: string | null
          title?: string | null
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          event_type?: string | null
          id?: string | null
          is_system?: boolean | null
          lead_id?: string | null
          metadata?: Json | null
          occurred_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_timeline_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
        ]
      }
      applications: {
        Row: {
          application_code: string | null
          application_id: string | null
          application_number: string | null
          archived_at: string | null
          case_code: string | null
          case_manager_id: string | null
          client_id: string | null
          created_at: string | null
          current_stage_code: string | null
          decision_at: string | null
          id: string | null
          is_archived: boolean | null
          notes: string | null
          outcome: string | null
          owner_id: string | null
          payment_plan_enabled: boolean | null
          payment_stages: Json | null
          priority: string | null
          quoted_fee_inr: number | null
          quoted_govt_fee_cad: number | null
          risk_level: string | null
          senior_advisor_id: string | null
          stage_entered_at: string | null
          submitted_at: string | null
          target_submission_date: string | null
          total_invoiced_inr: number | null
          total_paid_inr: number | null
          uci_number: string | null
          updated_at: string | null
          visa_sub_type_id: string | null
          visa_type_id: string | null
        }
        Insert: {
          application_code?: string | null
          application_id?: string | null
          application_number?: string | null
          archived_at?: string | null
          case_code?: string | null
          case_manager_id?: string | null
          client_id?: string | null
          created_at?: string | null
          current_stage_code?: string | null
          decision_at?: string | null
          id?: string | null
          is_archived?: boolean | null
          notes?: string | null
          outcome?: string | null
          owner_id?: string | null
          payment_plan_enabled?: boolean | null
          payment_stages?: Json | null
          priority?: string | null
          quoted_fee_inr?: number | null
          quoted_govt_fee_cad?: number | null
          risk_level?: string | null
          senior_advisor_id?: string | null
          stage_entered_at?: string | null
          submitted_at?: string | null
          target_submission_date?: string | null
          total_invoiced_inr?: number | null
          total_paid_inr?: number | null
          uci_number?: string | null
          updated_at?: string | null
          visa_sub_type_id?: string | null
          visa_type_id?: string | null
        }
        Update: {
          application_code?: string | null
          application_id?: string | null
          application_number?: string | null
          archived_at?: string | null
          case_code?: string | null
          case_manager_id?: string | null
          client_id?: string | null
          created_at?: string | null
          current_stage_code?: string | null
          decision_at?: string | null
          id?: string | null
          is_archived?: boolean | null
          notes?: string | null
          outcome?: string | null
          owner_id?: string | null
          payment_plan_enabled?: boolean | null
          payment_stages?: Json | null
          priority?: string | null
          quoted_fee_inr?: number | null
          quoted_govt_fee_cad?: number | null
          risk_level?: string | null
          senior_advisor_id?: string | null
          stage_entered_at?: string | null
          submitted_at?: string | null
          target_submission_date?: string | null
          total_invoiced_inr?: number | null
          total_paid_inr?: number | null
          uci_number?: string | null
          updated_at?: string | null
          visa_sub_type_id?: string | null
          visa_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_case_manager_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_case_manager_id_fkey"
            columns: ["case_manager_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_case_manager_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "cases_case_manager_id_fkey"
            columns: ["case_manager_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cases_current_stage_code_fkey"
            columns: ["current_stage_code"]
            isOneToOne: false
            referencedRelation: "case_stages_ref"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "cases_senior_advisor_id_fkey"
            columns: ["senior_advisor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_senior_advisor_id_fkey"
            columns: ["senior_advisor_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "cases_visa_sub_type_id_fkey"
            columns: ["visa_sub_type_id"]
            isOneToOne: false
            referencedRelation: "visa_sub_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_visa_type_id_fkey"
            columns: ["visa_type_id"]
            isOneToOne: false
            referencedRelation: "visa_types"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_cases_at_risk: {
        Row: {
          case_code: string | null
          case_manager_id: string | null
          case_manager_name: string | null
          client_id: string | null
          client_name: string | null
          current_stage_code: string | null
          id: string | null
          last_comm_at: string | null
          overdue_task_count: number | null
          risk_level: string | null
          target_submission_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_case_manager_id_fkey"
            columns: ["case_manager_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_case_manager_id_fkey"
            columns: ["case_manager_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cases_current_stage_code_fkey"
            columns: ["current_stage_code"]
            isOneToOne: false
            referencedRelation: "case_stages_ref"
            referencedColumns: ["code"]
          },
        ]
      }
      mv_dashboard_kpis: {
        Row: {
          active_cases: number | null
          active_leads: number | null
          cases_red_risk: number | null
          cases_yellow_risk: number | null
          mtd_approved: number | null
          mtd_collected: number | null
          mtd_invoiced: number | null
          mtd_submitted: number | null
          overdue_tasks: number | null
          refreshed_at: string | null
          sla_breaches: number | null
        }
        Relationships: []
      }
      v_application_family_chain: {
        Row: {
          application_id: string | null
          date_of_birth: string | null
          family_unit_id: string | null
          is_principal: boolean | null
          member_application_code: string | null
          member_application_id: string | null
          member_client_id: string | null
          member_name: string | null
          member_outcome: string | null
          member_role: string | null
          member_stage: string | null
          member_visa_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_current_stage_code_fkey"
            columns: ["member_stage"]
            isOneToOne: false
            referencedRelation: "case_stages_ref"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "clients_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "v_top_family_units"
            referencedColumns: ["id"]
          },
        ]
      }
      v_assessment_answers: {
        Row: {
          answer: Json | null
          answered_at: string | null
          applicant_id: string | null
          case_id: string | null
          completion_pct: number | null
          field_code: string | null
          field_type: string | null
          is_skipped: boolean | null
          lead_id: string | null
          question: string | null
          question_order: number | null
          response_id: string | null
          response_status: string | null
          scoring_tags: string[] | null
          section_code: string | null
          section_label: string | null
          section_order: number | null
          skip_reason: string | null
          template_code: string | null
          template_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_responses_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "case_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
        ]
      }
      v_assessment_summary: {
        Row: {
          assessment_id: string | null
          canada_work_start_date: string | null
          client_id: string | null
          crs_score: Json | null
          current_occupation: string | null
          facts: Json | null
          form_code: string | null
          lead_id: string | null
          noc_code: string | null
          province_scores: Json | null
          recommended_programs: Json | null
          reviewed_by: string | null
          score_results: Json | null
          scored_at: string | null
          status: string | null
          submitted_at: string | null
          teer: string | null
        }
        Insert: {
          assessment_id?: string | null
          canada_work_start_date?: never
          client_id?: string | null
          crs_score?: never
          current_occupation?: never
          facts?: Json | null
          form_code?: string | null
          lead_id?: string | null
          noc_code?: never
          province_scores?: never
          recommended_programs?: never
          reviewed_by?: string | null
          score_results?: Json | null
          scored_at?: string | null
          status?: string | null
          submitted_at?: string | null
          teer?: never
        }
        Update: {
          assessment_id?: string | null
          canada_work_start_date?: never
          client_id?: string | null
          crs_score?: never
          current_occupation?: never
          facts?: Json | null
          form_code?: string | null
          lead_id?: string | null
          noc_code?: never
          province_scores?: never
          recommended_programs?: never
          reviewed_by?: string | null
          score_results?: Json | null
          scored_at?: string | null
          status?: string | null
          submitted_at?: string | null
          teer?: never
        }
        Relationships: [
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "assessments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "assessments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "assessments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "assessments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "assessments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      v_branch_health: {
        Row: {
          avg_rating: number | null
          branch_code: string | null
          breaches_30d: number | null
          counselor_count: number | null
          pending_prospectives: number | null
        }
        Relationships: []
      }
      v_case_financials: {
        Row: {
          balance_due_inr: number | null
          case_code: string | null
          case_id: string | null
          client_id: string | null
          commissions_accrued_inr: number | null
          ledger_inflow_inr: number | null
          ledger_outflow_inr: number | null
          net_position_inr: number | null
          payments_received_inr: number | null
          quoted_fee_inr: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
        ]
      }
      v_case_notes: {
        Row: {
          body: string | null
          case_id: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          for_case_id: string | null
          id: string | null
          is_locked: boolean | null
          lead_id: string | null
          locked_at: string | null
          locked_by: string | null
          migrated_from: string | null
          note_type: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "entity_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "entity_notes_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "entity_notes_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      v_case_timeline: {
        Row: {
          actor_id: string | null
          body: string | null
          case_id: string | null
          client_id: string | null
          created_at: string | null
          event_type: string | null
          for_case_id: string | null
          id: string | null
          is_system: boolean | null
          lead_id: string | null
          metadata: Json | null
          occurred_at: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_timeline_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
        ]
      }
      v_cases_masked: {
        Row: {
          applicant: string | null
          case_code: string | null
          created_at: string | null
          current_stage_code: string | null
          id: string | null
          program: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_current_stage_code_fkey"
            columns: ["current_stage_code"]
            isOneToOne: false
            referencedRelation: "case_stages_ref"
            referencedColumns: ["code"]
          },
        ]
      }
      v_client_family_chain: {
        Row: {
          family_unit_id: string | null
          for_client_id: string | null
          is_self: boolean | null
          member_application_code: string | null
          member_application_id: string | null
          member_client_id: string | null
          member_name: string | null
          member_outcome: string | null
          member_role: string | null
          member_stage: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_current_stage_code_fkey"
            columns: ["member_stage"]
            isOneToOne: false
            referencedRelation: "case_stages_ref"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "clients_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "v_top_family_units"
            referencedColumns: ["id"]
          },
        ]
      }
      v_clients_accounts: {
        Row: {
          client_code: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          client_code?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          client_code?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
      v_contact_reveal_anomalies: {
        Row: {
          day: string | null
          distinct_records: number | null
          flag: string | null
          reveals: number | null
          staff_id: string | null
          staff_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_reveal_log_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_reveal_log_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      v_counselor_performance: {
        Row: {
          active_cases: number | null
          branch_code: string | null
          chain_misses_count: number | null
          chain_tasks_30d: number | null
          chain_tasks_on_time_30d: number | null
          counselor_id: string | null
          full_name: string | null
          pending_prospectives: number | null
          performance_rating: number | null
          revenue_90d: number | null
          sla_breaches_30d: number | null
        }
        Insert: {
          active_cases?: never
          branch_code?: string | null
          chain_misses_count?: number | null
          chain_tasks_30d?: never
          chain_tasks_on_time_30d?: never
          counselor_id?: string | null
          full_name?: string | null
          pending_prospectives?: never
          performance_rating?: number | null
          revenue_90d?: never
          sla_breaches_30d?: never
        }
        Update: {
          active_cases?: never
          branch_code?: string | null
          chain_misses_count?: number | null
          chain_tasks_30d?: never
          chain_tasks_on_time_30d?: never
          counselor_id?: string | null
          full_name?: string | null
          pending_prospectives?: never
          performance_rating?: number | null
          revenue_90d?: never
          sla_breaches_30d?: never
        }
        Relationships: []
      }
      v_followup_integrity: {
        Row: {
          assigned_to: string | null
          counselor_name: string | null
          created_at: string | null
          days_since_touch: number | null
          first_responded_at: string | null
          first_response_breached: boolean | null
          first_response_due_at: string | null
          full_name: string | null
          last_touch_at: string | null
          lead_id: string | null
          next_action_at: string | null
          next_action_overdue: boolean | null
          no_next_action: boolean | null
          open_tasks: number | null
          overdue_tasks: number | null
          source_code: string | null
          stage: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "leads_source_code_fkey"
            columns: ["source_code"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["code"]
          },
        ]
      }
      v_followup_integrity_by_staff: {
        Row: {
          active_leads: number | null
          assigned_to: string | null
          avg_days_since_touch: number | null
          counselor_name: string | null
          first_response_breaches: number | null
          leads_no_next_action: number | null
          leads_overdue: number | null
          untouched_3d: number | null
          untouched_7d: number | null
          worst_untouched_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      v_lead_deletions: {
        Row: {
          deleted_at: string | null
          deleted_by_name: string | null
          deleted_by_role: string | null
          dependents: Json | null
          email: string | null
          id: string | null
          lead_id: string | null
          lead_name: string | null
          lead_snapshot: Json | null
          lead_status: string | null
          phone: string | null
          reason: string | null
          records_destroyed: number | null
          was_assigned_to: string | null
        }
        Relationships: []
      }
      v_lead_notes: {
        Row: {
          body: string | null
          case_id: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          for_lead_id: string | null
          id: string | null
          is_locked: boolean | null
          lead_id: string | null
          locked_at: string | null
          locked_by: string | null
          migrated_from: string | null
          note_type: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "entity_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "entity_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "entity_notes_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "entity_notes_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      v_lead_overview: {
        Row: {
          assessment_id: string | null
          assessment_submitted_at: string | null
          assigned_to: string | null
          canada_work_start_date: string | null
          client_id: string | null
          crs_score: Json | null
          current_occupation: string | null
          expiring_items: Json | null
          full_name: string | null
          future_applications: Json | null
          last_completed_task_at: string | null
          last_contact_at: string | null
          lead_id: string | null
          lifecycle_state: string | null
          next_action: string | null
          next_followup_at: string | null
          noc_code: string | null
          nurture_targets: Json | null
          province_scores: Json | null
          questionnaire_completion_pct: number | null
          recommended_programs: Json | null
          teer: string | null
          waiting_end_date: string | null
          waiting_reason: string | null
          waiting_review_notes: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
        ]
      }
      v_lead_timeline: {
        Row: {
          actor_id: string | null
          body: string | null
          case_id: string | null
          client_id: string | null
          created_at: string | null
          event_type: string | null
          for_lead_id: string | null
          id: string | null
          is_system: boolean | null
          lead_id: string | null
          metadata: Json | null
          occurred_at: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_timeline_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
        ]
      }
      v_recent_chain_firings: {
        Row: {
          assigned_counselor_id: string | null
          counselor_name: string | null
          created_at: string | null
          estimated_fee_cad: number | null
          family_unit_id: string | null
          family_unit_name: string | null
          prospective_id: string | null
          rule_code: string | null
          status: string | null
          target_application_type: string | null
          trigger_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospective_applications_assigned_counselor_id_fkey"
            columns: ["assigned_counselor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospective_applications_assigned_counselor_id_fkey"
            columns: ["assigned_counselor_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "prospective_applications_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospective_applications_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "v_top_family_units"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stage_events: {
        Row: {
          actor_id: string | null
          case_id: string | null
          client_id: string | null
          event_type: string | null
          from_stage: string | null
          id: string | null
          is_system: boolean | null
          lead_id: string | null
          occurred_at: string | null
          scope: string | null
          source_event_type: string | null
          title: string | null
          to_stage: string | null
        }
        Insert: {
          actor_id?: string | null
          case_id?: string | null
          client_id?: string | null
          event_type?: never
          from_stage?: never
          id?: string | null
          is_system?: boolean | null
          lead_id?: string | null
          occurred_at?: string | null
          scope?: never
          source_event_type?: string | null
          title?: string | null
          to_stage?: never
        }
        Update: {
          actor_id?: string | null
          case_id?: string | null
          client_id?: string | null
          event_type?: never
          from_stage?: never
          id?: string | null
          is_system?: boolean | null
          lead_id?: string | null
          occurred_at?: string | null
          scope?: never
          source_event_type?: string | null
          title?: string | null
          to_stage?: never
        }
        Relationships: [
          {
            foreignKeyName: "activity_timeline_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_counselor_performance"
            referencedColumns: ["counselor_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mv_cases_at_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_financials"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_notes"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_timeline"
            referencedColumns: ["for_case_id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_cases_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_application_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_application_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["for_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_family_chain"
            referencedColumns: ["member_client_id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_followup_integrity"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_notes"
            referencedColumns: ["for_lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_overview"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "activity_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timeline"
            referencedColumns: ["for_lead_id"]
          },
        ]
      }
      v_top_family_units: {
        Row: {
          expected_lifetime_revenue_cad: number | null
          id: string | null
          lifetime_revenue_cad: number | null
          member_count: number | null
          open_prospectives: number | null
          origin_country: string | null
          unit_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_is_owner_or_admin: { Args: never; Returns: boolean }
      auth_is_staff: { Args: never; Returns: boolean }
      auth_role: { Args: never; Returns: string }
      bulk_process_prospectives: { Args: { p_decisions: Json }; Returns: Json }
      claim_jobs: {
        Args: { p_limit?: number; p_types: string[] }
        Returns: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          org_id: string
          payload: Json
          run_after: string
          status: string
          type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      comm_can_use: { Args: never; Returns: boolean }
      comm_is_manager: { Args: never; Returns: boolean }
      comm_is_reception: { Args: never; Returns: boolean }
      comm_me: { Args: never; Returns: string }
      comm_my_role: { Args: never; Returns: string }
      consent_prospective_to_case: {
        Args: {
          p_fee_quoted?: number
          p_notes?: string
          p_prospective_id: string
        }
        Returns: string
      }
      decline_prospective: {
        Args: { p_prospective_id: string; p_reason?: string }
        Returns: undefined
      }
      default_org_id: { Args: never; Returns: string }
      enqueue_job: {
        Args: { p_payload: Json; p_type: string }
        Returns: string
      }
      ensure_family_unit:
        | { Args: { p_lead_id: string }; Returns: string }
        | { Args: { p_lead_id: string; p_unit_name?: string }; Returns: string }
      finish_job: {
        Args: { p_error?: string; p_id: string; p_ok: boolean }
        Returns: undefined
      }
      fn_add_staff: {
        Args: {
          p_email: string
          p_full_name: string
          p_phone?: string
          p_role: string
        }
        Returns: string
      }
      fn_assessment_facts: { Args: { p: Json }; Returns: Json }
      fn_assessment_score: { Args: { p_id: string }; Returns: Json }
      fn_audit_ensure_partitions: {
        Args: { p_months_ahead?: number }
        Returns: number
      }
      fn_build_assessment_sections: {
        Args: { p_template_code: string }
        Returns: Json
      }
      fn_can_case: { Args: never; Returns: boolean }
      fn_can_delete_leads: { Args: never; Returns: boolean }
      fn_current_role: { Args: never; Returns: string }
      fn_delete_lead: {
        Args: { p_lead_id: string; p_reason: string }
        Returns: string
      }
      fn_engine_expiry_sweep: { Args: never; Returns: number }
      fn_engine_festival_sweep: { Args: never; Returns: number }
      fn_engine_outbox_sweep: { Args: never; Returns: number }
      fn_engine_owner: { Args: never; Returns: string }
      fn_engine_queue_message: {
        Args: {
          p_case: string
          p_client: string
          p_lead: string
          p_template: string
          p_trigger_event?: string
          p_urgent?: boolean
          p_vars?: Json
          p_when?: string
        }
        Returns: string
      }
      fn_engine_sla_sweep: { Args: never; Returns: number }
      fn_engine_staff_for_role: { Args: { p_role: string }; Returns: string }
      fn_eval_condition: { Args: { cond: Json; facts: Json }; Returns: boolean }
      fn_is_accounts: { Args: never; Returns: boolean }
      fn_is_case_mgr: { Args: never; Returns: boolean }
      fn_is_filing_ft: { Args: never; Returns: boolean }
      fn_is_filing_pt: { Args: never; Returns: boolean }
      fn_is_finance: { Args: never; Returns: boolean }
      fn_is_intake: { Args: never; Returns: boolean }
      fn_is_owner_admin: { Args: never; Returns: boolean }
      fn_is_staff: { Args: never; Returns: boolean }
      fn_messaging_is_live: { Args: never; Returns: boolean }
      fn_program_class: {
        Args: { p_code: string; p_label: string }
        Returns: string
      }
      get_family_members: {
        Args: { p_family_unit_id: string }
        Returns: {
          client_id: string
          expected_revenue_cad: number
          family_role: string
          full_name: string
          id: string
          lead_id: string
          primary_application: string
        }[]
      }
      identity_channels: { Args: { p_channel: string }; Returns: string[] }
      is_staff: { Args: never; Returns: boolean }
      mark_case_outcome: {
        Args: {
          p_case_id: string
          p_decision_date: string
          p_document_expiry_date?: string
          p_first_canadian_work_day?: string
          p_landing_date?: string
          p_outcome: string
          p_pgwp_expiry_date?: string
          p_study_end_date?: string
        }
        Returns: undefined
      }
      mark_conversation_read: {
        Args: { p_conversation: string }
        Returns: undefined
      }
      mask_email: { Args: { e: string }; Returns: string }
      mask_phone: { Args: { p: string }; Returns: string }
      normalize_email: { Args: { p: string }; Returns: string }
      normalize_phone: { Args: { p: string }; Returns: string }
      populate_case_documents_from_rules: {
        Args: { p_case_id: string }
        Returns: number
      }
      refresh_dashboard_views: { Args: never; Returns: undefined }
      resolve_identity: {
        Args: { p_channel: string; p_handle: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      snooze_prospective: {
        Args: { p_prospective_id: string; p_snooze_days?: number }
        Returns: undefined
      }
      task_acknowledge: { Args: { p_task: string }; Returns: undefined }
      task_complete: {
        Args: { p_notes?: string; p_task: string }
        Returns: undefined
      }
      task_dismiss: {
        Args: { p_reason?: string; p_task: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
      wa_window_state: { Args: { p_conversation: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
