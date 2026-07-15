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
  public: {
    Tables: {
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
            foreignKeyName: "api_keys_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
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
            foreignKeyName: "appointments_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
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
      case_documents: {
        Row: {
          case_id: string
          created_at: string | null
          deleted_at: string | null
          document_type: string
          expires_at: string | null
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
            foreignKeyName: "case_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
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
            foreignKeyName: "case_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
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
          updated_at: string | null
          visa_sub_type_id: string | null
          visa_type_id: string
        }
        Insert: {
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
          updated_at?: string | null
          visa_sub_type_id?: string | null
          visa_type_id: string
        }
        Update: {
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
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
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
      clients: {
        Row: {
          birthday_month_day: string | null
          client_code: string | null
          country_of_citizenship: string | null
          created_at: string | null
          current_residence: string | null
          date_of_birth: string | null
          email: string | null
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
            foreignKeyName: "clients_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
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
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
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
          email_type: string | null
          from_address: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          keyword_flags: string[] | null
          matched_case_id: string | null
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
          email_type?: string | null
          from_address?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          keyword_flags?: string[] | null
          matched_case_id?: string | null
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
          email_type?: string | null
          from_address?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          keyword_flags?: string[] | null
          matched_case_id?: string | null
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
            foreignKeyName: "ircc_emails_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
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
            foreignKeyName: "lead_routing_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
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
          assessment_data: Json | null
          assessment_submitted_at: string | null
          assigned_to: string | null
          converted_at: string | null
          converted_client_id: string | null
          country_of_residence: string | null
          created_at: string | null
          crs_score: number | null
          email: string | null
          first_responded_at: string | null
          first_response_due_at: string | null
          full_name: string
          id: string
          interested_visa_type_id: string | null
          lost_reason: string | null
          notes: string | null
          phone: string | null
          source_code: string | null
          source_detail: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          assessment_data?: Json | null
          assessment_submitted_at?: string | null
          assigned_to?: string | null
          converted_at?: string | null
          converted_client_id?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          crs_score?: number | null
          email?: string | null
          first_responded_at?: string | null
          first_response_due_at?: string | null
          full_name: string
          id?: string
          interested_visa_type_id?: string | null
          lost_reason?: string | null
          notes?: string | null
          phone?: string | null
          source_code?: string | null
          source_detail?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          assessment_data?: Json | null
          assessment_submitted_at?: string | null
          assigned_to?: string | null
          converted_at?: string | null
          converted_client_id?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          crs_score?: number | null
          email?: string | null
          first_responded_at?: string | null
          first_response_due_at?: string | null
          full_name?: string
          id?: string
          interested_visa_type_id?: string | null
          lost_reason?: string | null
          notes?: string | null
          phone?: string | null
          source_code?: string | null
          source_detail?: string | null
          status?: string
          updated_at?: string | null
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
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
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
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_from_staff_id_fkey"
            columns: ["from_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
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
            foreignKeyName: "outbound_messages_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
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
      sla_rules: {
        Row: {
          applies_to: string
          code: string
          escalate_to_role: string | null
          is_active: boolean | null
          label: string
          office_hours_only: boolean | null
          target_minutes: number
        }
        Insert: {
          applies_to: string
          code: string
          escalate_to_role?: string | null
          is_active?: boolean | null
          label: string
          office_hours_only?: boolean | null
          target_minutes: number
        }
        Update: {
          applies_to?: string
          code?: string
          escalate_to_role?: string | null
          is_active?: boolean | null
          label?: string
          office_hours_only?: boolean | null
          target_minutes?: number
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          phone: string | null
          role: string
          updated_at: string | null
          visa_specialties: string[] | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          phone?: string | null
          role: string
          updated_at?: string | null
          visa_specialties?: string[] | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
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
            foreignKeyName: "step_template_edits_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
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
          assigned_to: string | null
          case_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_at: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          priority: string | null
          sla_rule_code: string | null
          source: string | null
          status_code: string | null
          title: string
          trigger_event_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          sla_rule_code?: string | null
          source?: string | null
          status_code?: string | null
          title: string
          trigger_event_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          sla_rule_code?: string | null
          source?: string | null
          status_code?: string | null
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
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_code_fkey"
            columns: ["status_code"]
            isOneToOne: false
            referencedRelation: "task_statuses_ref"
            referencedColumns: ["code"]
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
            foreignKeyName: "trigger_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
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
          code: string
          govt_fee_cad: number | null
          id: string
          is_active: boolean | null
          label: string
        }
        Insert: {
          base_fee_cad?: number | null
          base_fee_inr?: number | null
          category: string
          code: string
          govt_fee_cad?: number | null
          id?: string
          is_active?: boolean | null
          label: string
        }
        Update: {
          base_fee_cad?: number | null
          base_fee_inr?: number | null
          category?: string
          code?: string
          govt_fee_cad?: number | null
          id?: string
          is_active?: boolean | null
          label?: string
        }
        Relationships: []
      }
    }
    Views: {
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
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
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
    }
    Functions: {
      auth_is_owner_or_admin: { Args: never; Returns: boolean }
      auth_is_staff: { Args: never; Returns: boolean }
      auth_role: { Args: never; Returns: string }
      is_staff: { Args: never; Returns: boolean }
      refresh_dashboard_views: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
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
  public: {
    Enums: {},
  },
} as const
