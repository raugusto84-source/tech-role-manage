export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      achievement_rewards: {
        Row: {
          achievement_id: string
          created_at: string
          id: string
          reward_data: Json | null
          reward_message: string | null
          reward_type: Database["public"]["Enums"]["reward_type"]
          reward_value: number | null
        }
        Insert: {
          achievement_id: string
          created_at?: string
          id?: string
          reward_data?: Json | null
          reward_message?: string | null
          reward_type: Database["public"]["Enums"]["reward_type"]
          reward_value?: number | null
        }
        Update: {
          achievement_id?: string
          created_at?: string
          id?: string
          reward_data?: Json | null
          reward_message?: string | null
          reward_type?: Database["public"]["Enums"]["reward_type"]
          reward_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "achievement_rewards_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          achievement_type: Database["public"]["Enums"]["achievement_type"]
          comparison_operator: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_active: boolean
          name: string
          target_value: number
          time_period: string | null
          updated_at: string
        }
        Insert: {
          achievement_type: Database["public"]["Enums"]["achievement_type"]
          comparison_operator?: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_active?: boolean
          name: string
          target_value: number
          time_period?: string | null
          updated_at?: string
        }
        Update: {
          achievement_type?: Database["public"]["Enums"]["achievement_type"]
          comparison_operator?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          target_value?: number
          time_period?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      attendance_adjustments: {
        Row: {
          adjusted_by: string
          adjustment_type: string
          attendance_record_id: string
          created_at: string
          id: string
          new_value: string | null
          original_value: string | null
          reason: string
        }
        Insert: {
          adjusted_by: string
          adjustment_type: string
          attendance_record_id: string
          created_at?: string
          id?: string
          new_value?: string | null
          original_value?: string | null
          reason: string
        }
        Update: {
          adjusted_by?: string
          adjustment_type?: string
          attendance_record_id?: string
          created_at?: string
          id?: string
          new_value?: string | null
          original_value?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_adjustments_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          approved_at: string | null
          approved_by: string | null
          break_end: string | null
          break_start: string | null
          check_in_location: Json | null
          check_in_photo_url: string | null
          check_out_location: Json | null
          check_out_photo_url: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
          overtime_hours: number | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          total_hours: number | null
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          approved_at?: string | null
          approved_by?: string | null
          break_end?: string | null
          break_start?: string | null
          check_in_location?: Json | null
          check_in_photo_url?: string | null
          check_out_location?: Json | null
          check_out_photo_url?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          total_hours?: number | null
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          approved_at?: string | null
          approved_by?: string | null
          break_end?: string | null
          break_start?: string | null
          check_in_location?: Json | null
          check_in_photo_url?: string | null
          check_out_location?: Json | null
          check_out_photo_url?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          total_hours?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      auto_quotes: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          diagnostic_session_id: string | null
          estimated_hours: number | null
          estimated_price: number | null
          id: string
          quote_details: Json | null
          service_category_id: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          diagnostic_session_id?: string | null
          estimated_hours?: number | null
          estimated_price?: number | null
          id?: string
          quote_details?: Json | null
          service_category_id?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          diagnostic_session_id?: string | null
          estimated_hours?: number | null
          estimated_price?: number | null
          id?: string
          quote_details?: Json | null
          service_category_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_quotes_service_category_id_fkey"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_url: string | null
          chat_room_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          message_text: string
          message_type: string | null
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          chat_room_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_text: string
          message_type?: string | null
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          chat_room_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_text?: string
          message_type?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      chat_rooms: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          related_id: string
          room_type: string
          staff_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          related_id: string
          room_type: string
          staff_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          related_id?: string
          room_type?: string
          staff_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cleaning_task_assignments: {
        Row: {
          assigned_by: string | null
          assigned_to: string
          completed_at: string | null
          completion_photos: string[] | null
          created_at: string
          due_date: string
          id: string
          notes: string | null
          quality_score: number | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_template_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to: string
          completed_at?: string | null
          completion_photos?: string[] | null
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          quality_score?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_template_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string
          completed_at?: string | null
          completion_photos?: string[] | null
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          quality_score?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_task_assignments_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "cleaning_tasks_template"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_tasks_template: {
        Row: {
          category: Database["public"]["Enums"]["task_5s_category"]
          created_at: string
          created_by: string | null
          description: string
          estimated_duration_minutes: number
          frequency_days: number
          id: string
          instructions: string | null
          is_active: boolean
          location: string
          name: string
          priority: Database["public"]["Enums"]["task_priority"]
          required_tools: string[] | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["task_5s_category"]
          created_at?: string
          created_by?: string | null
          description: string
          estimated_duration_minutes?: number
          frequency_days?: number
          id?: string
          instructions?: string | null
          is_active?: boolean
          location: string
          name: string
          priority?: Database["public"]["Enums"]["task_priority"]
          required_tools?: string[] | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["task_5s_category"]
          created_at?: string
          created_by?: string | null
          description?: string
          estimated_duration_minutes?: number
          frequency_days?: number
          id?: string
          instructions?: string | null
          is_active?: boolean
          location?: string
          name?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          required_tools?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      client_diagnostics: {
        Row: {
          answer: string
          client_email: string | null
          created_at: string
          diagnosis_result: Json | null
          id: string
          question_id: string
          question_text: string
          service_type_id: string
          session_id: string
        }
        Insert: {
          answer: string
          client_email?: string | null
          created_at?: string
          diagnosis_result?: Json | null
          id?: string
          question_id: string
          question_text: string
          service_type_id: string
          session_id?: string
        }
        Update: {
          answer?: string
          client_email?: string | null
          created_at?: string
          diagnosis_result?: Json | null
          id?: string
          question_id?: string
          question_text?: string
          service_type_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_diagnostics_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_trees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_diagnostics_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      client_referrals: {
        Row: {
          created_at: string
          id: string
          referral_bonus_given: number | null
          referral_code: string
          referred_client_id: string
          referrer_client_id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          referral_bonus_given?: number | null
          referral_code: string
          referred_client_id: string
          referrer_client_id: string
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          referral_bonus_given?: number | null
          referral_code?: string
          referred_client_id?: string
          referrer_client_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_referrals_referred_client_id_fkey"
            columns: ["referred_client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_referrals_referrer_client_id_fkey"
            columns: ["referrer_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_requests: {
        Row: {
          assigned_to_visit_id: string | null
          created_at: string
          id: string
          policy_id: string
          priority: string
          request_description: string
          requested_by: string
          requested_for_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to_visit_id?: string | null
          created_at?: string
          id?: string
          policy_id: string
          priority?: string
          request_description: string
          requested_by: string
          requested_for_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to_visit_id?: string | null
          created_at?: string
          id?: string
          policy_id?: string
          priority?: string
          request_description?: string
          requested_by?: string
          requested_for_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_requests_assigned_to_visit_id_fkey"
            columns: ["assigned_to_visit_id"]
            isOneToOne: false
            referencedRelation: "policy_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_requests_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_rewards: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_new_client: boolean | null
          new_client_discount_used: boolean | null
          total_cashback: number | null
          total_points: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_new_client?: boolean | null
          new_client_discount_used?: boolean | null
          total_cashback?: number | null
          total_points?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_new_client?: boolean | null
          new_client_discount_used?: boolean | null
          total_cashback?: number | null
          total_points?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_rewards_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string
          client_number: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          address: string
          client_number: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string
          client_number?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      delivery_signatures: {
        Row: {
          client_name: string
          client_signature_data: string
          created_at: string
          delivery_date: string
          id: string
          observations: string | null
          order_id: string
        }
        Insert: {
          client_name: string
          client_signature_data: string
          created_at?: string
          delivery_date?: string
          id?: string
          observations?: string | null
          order_id: string
        }
        Update: {
          client_name?: string
          client_signature_data?: string
          created_at?: string
          delivery_date?: string
          id?: string
          observations?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_signatures_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_signatures_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_questions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          question: string
          question_order: number
          service_type: Database["public"]["Enums"]["service_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          question_order: number
          service_type: Database["public"]["Enums"]["service_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          question_order?: number
          service_type?: Database["public"]["Enums"]["service_type"]
        }
        Relationships: []
      }
      diagnostic_trees: {
        Row: {
          created_at: string
          created_by: string | null
          estimated_hours: number | null
          estimated_price: number | null
          final_diagnosis: Json | null
          id: string
          is_active: boolean
          options: Json | null
          parent_question_id: string | null
          question_order: number
          question_text: string
          question_type: string
          service_category_id: string | null
          service_type_id: string
          trigger_answer: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          estimated_hours?: number | null
          estimated_price?: number | null
          final_diagnosis?: Json | null
          id?: string
          is_active?: boolean
          options?: Json | null
          parent_question_id?: string | null
          question_order?: number
          question_text: string
          question_type?: string
          service_category_id?: string | null
          service_type_id: string
          trigger_answer?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          estimated_hours?: number | null
          estimated_price?: number | null
          final_diagnosis?: Json | null
          id?: string
          is_active?: boolean
          options?: Json | null
          parent_question_id?: string | null
          question_order?: number
          question_text?: string
          question_type?: string
          service_category_id?: string | null
          service_type_id?: string
          trigger_answer?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_trees_parent_question_id_fkey"
            columns: ["parent_question_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_trees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_trees_service_category_id_fkey"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_trees_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_payments: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          employee_id: string
          employee_name: string
          id: string
          payment_date: string
          payment_method: string | null
          payment_type: string
          status: string
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_id: string
          employee_name: string
          id?: string
          payment_date?: string
          payment_method?: string | null
          payment_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_id?: string
          employee_name?: string
          id?: string
          payment_date?: string
          payment_method?: string | null
          payment_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          expense_number: string
          id: string
          payment_method: string | null
          project_id: string | null
          receipt_url: string | null
          status: string
          supplier_id: string | null
          taxable_amount: number | null
          updated_at: string
          vat_amount: number | null
          vat_rate: number | null
          withdrawal_status: string
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          expense_number: string
          id?: string
          payment_method?: string | null
          project_id?: string | null
          receipt_url?: string | null
          status?: string
          supplier_id?: string | null
          taxable_amount?: number | null
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number | null
          withdrawal_status?: string
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          expense_number?: string
          id?: string
          payment_method?: string | null
          project_id?: string | null
          receipt_url?: string | null
          status?: string
          supplier_id?: string | null
          taxable_amount?: number | null
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number | null
          withdrawal_status?: string
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_history: {
        Row: {
          account_type: string | null
          amount: number
          created_at: string
          id: string
          operation_date: string
          operation_description: string
          operation_type: string
          performed_by: string | null
          record_data: Json
          record_id: string
          table_name: string
        }
        Insert: {
          account_type?: string | null
          amount: number
          created_at?: string
          id?: string
          operation_date?: string
          operation_description: string
          operation_type: string
          performed_by?: string | null
          record_data: Json
          record_id: string
          table_name: string
        }
        Update: {
          account_type?: string | null
          amount?: number
          created_at?: string
          id?: string
          operation_date?: string
          operation_description?: string
          operation_type?: string
          performed_by?: string | null
          record_data?: Json
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      fiscal_withdrawals: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          income_id: string
          order_id: string | null
          updated_at: string
          withdrawal_status: string
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          income_id: string
          order_id?: string | null
          updated_at?: string
          withdrawal_status?: string
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          income_id?: string
          order_id?: string | null
          updated_at?: string
          withdrawal_status?: string
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Relationships: []
      }
      fixed_expenses: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          active: boolean
          amount: number
          created_at: string
          created_by: string | null
          day_of_month: number | null
          description: string
          frequency: string
          id: string
          last_run_date: string | null
          next_run_date: string
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active?: boolean
          amount: number
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          description: string
          frequency?: string
          id?: string
          last_run_date?: string | null
          next_run_date?: string
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active?: boolean
          amount?: number
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          description?: string
          frequency?: string
          id?: string
          last_run_date?: string | null
          next_run_date?: string
          payment_method?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fixed_incomes: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          active: boolean
          amount: number
          created_at: string
          created_by: string | null
          day_of_month: number
          description: string
          frequency: string
          id: string
          last_run_date: string | null
          next_run_date: string
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active?: boolean
          amount: number
          created_at?: string
          created_by?: string | null
          day_of_month?: number
          description: string
          frequency?: string
          id?: string
          last_run_date?: string | null
          next_run_date?: string
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active?: boolean
          amount?: number
          created_at?: string
          created_by?: string | null
          day_of_month?: number
          description?: string
          frequency?: string
          id?: string
          last_run_date?: string | null
          next_run_date?: string
          payment_method?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      incomes: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          amount: number
          category: string
          client_name: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          income_date: string
          income_number: string
          payment_method: string | null
          project_id: string | null
          status: string
          taxable_amount: number | null
          updated_at: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          amount: number
          category: string
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          income_date?: string
          income_number: string
          payment_method?: string | null
          project_id?: string | null
          status?: string
          taxable_amount?: number | null
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          amount?: number
          category?: string
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          income_date?: string
          income_number?: string
          payment_method?: string | null
          project_id?: string | null
          status?: string
          taxable_amount?: number | null
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "incomes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reports: {
        Row: {
          created_at: string
          email_sent_at: string | null
          id: string
          policy_id: string
          report_month: number
          report_pdf_url: string | null
          report_year: number
          total_actions: number
          total_cost_avoided: number
          total_visits: number
        }
        Insert: {
          created_at?: string
          email_sent_at?: string | null
          id?: string
          policy_id: string
          report_month: number
          report_pdf_url?: string | null
          report_year: number
          total_actions?: number
          total_cost_avoided?: number
          total_visits?: number
        }
        Update: {
          created_at?: string
          email_sent_at?: string | null
          id?: string
          policy_id?: string
          report_month?: number
          report_pdf_url?: string | null
          report_year?: number
          total_actions?: number
          total_cost_avoided?: number
          total_visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_reports_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          order_id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          order_id: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          order_id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_chat_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_chat_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      order_diagnostics: {
        Row: {
          answer: string
          created_at: string
          id: string
          order_id: string
          question: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          order_id: string
          question: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          order_id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_diagnostics_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_diagnostics_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          item_type: string
          order_id: string
          profit_margin_rate: number
          quantity: number
          service_description: string | null
          service_name: string
          service_type_id: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          unit_base_price: number
          unit_cost_price: number
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_type?: string
          order_id: string
          profit_margin_rate?: number
          quantity?: number
          service_description?: string | null
          service_name: string
          service_type_id: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          unit_base_price: number
          unit_cost_price: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_type?: string
          order_id?: string
          profit_margin_rate?: number
          quantity?: number
          service_description?: string | null
          service_name?: string
          service_type_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total_amount?: number
          unit_base_price?: number
          unit_cost_price?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          order_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          order_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          order_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_notes_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          client_name: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          income_id: string | null
          order_id: string
          order_number: string
          payment_amount: number
          payment_date: string
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          client_name: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          income_id?: string | null
          order_id: string
          order_number: string
          payment_amount: number
          payment_date?: string
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          client_name?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          income_id?: string | null
          order_id?: string
          order_number?: string
          payment_amount?: number
          payment_date?: string
          payment_method?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_requests: {
        Row: {
          assigned_to: string | null
          client_address: string
          client_email: string
          client_name: string
          client_phone: string | null
          created_at: string
          failure_description: string
          id: string
          preferred_delivery_date: string | null
          requested_date: string
          service_description: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_address: string
          client_email: string
          client_name: string
          client_phone?: string | null
          created_at?: string
          failure_description: string
          id?: string
          preferred_delivery_date?: string | null
          requested_date?: string
          service_description: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_address?: string
          client_email?: string
          client_name?: string
          client_phone?: string | null
          created_at?: string
          failure_description?: string
          id?: string
          preferred_delivery_date?: string | null
          requested_date?: string
          service_description?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_satisfaction_surveys: {
        Row: {
          client_id: string
          created_at: string
          general_comments: string | null
          id: string
          order_id: string
          service_quality: number | null
          service_time: number | null
          updated_at: string
          would_recommend: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          general_comments?: string | null
          id?: string
          order_id: string
          service_quality?: number | null
          service_time?: number | null
          updated_at?: string
          would_recommend?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          general_comments?: string | null
          id?: string
          order_id?: string
          service_quality?: number | null
          service_time?: number | null
          updated_at?: string
          would_recommend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_satisfaction_surveys_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_satisfaction_surveys_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "pending_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      order_signatures: {
        Row: {
          id: string
          order_id: string
          signature_data: string
          signature_type: string
          signed_at: string
          signed_by: string
        }
        Insert: {
          id?: string
          order_id: string
          signature_data: string
          signature_type: string
          signed_at?: string
          signed_by: string
        }
        Update: {
          id?: string
          order_id?: string
          signature_data?: string
          signature_type?: string
          signed_at?: string
          signed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_signatures_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_signatures_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_logs: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_status: Database["public"]["Enums"]["order_status"]
          notes: string | null
          order_id: string
          previous_status: Database["public"]["Enums"]["order_status"] | null
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_status: Database["public"]["Enums"]["order_status"]
          notes?: string | null
          order_id: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_status?: Database["public"]["Enums"]["order_status"]
          notes?: string | null
          order_id?: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      order_support_technicians: {
        Row: {
          created_at: string
          id: string
          order_id: string
          reduction_percentage: number
          technician_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          reduction_percentage?: number
          technician_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          reduction_percentage?: number
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_support_technicians_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_support_technicians_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_support_technicians_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_technician: string | null
          assignment_reason: string | null
          average_service_time: number | null
          client_approval: boolean | null
          client_approval_notes: string | null
          client_approved_at: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          delivery_date: string
          diagnosis_completed: boolean
          estimated_cost: number | null
          evidence_photos: string[] | null
          failure_description: string
          final_signature_url: string | null
          id: string
          initial_signature_url: string | null
          order_number: string
          pdf_url: string | null
          requested_date: string | null
          service_type: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          assigned_technician?: string | null
          assignment_reason?: string | null
          average_service_time?: number | null
          client_approval?: boolean | null
          client_approval_notes?: string | null
          client_approved_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_date: string
          diagnosis_completed?: boolean
          estimated_cost?: number | null
          evidence_photos?: string[] | null
          failure_description: string
          final_signature_url?: string | null
          id?: string
          initial_signature_url?: string | null
          order_number: string
          pdf_url?: string | null
          requested_date?: string | null
          service_type: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          assigned_technician?: string | null
          assignment_reason?: string | null
          average_service_time?: number | null
          client_approval?: boolean | null
          client_approval_notes?: string | null
          client_approved_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          diagnosis_completed?: boolean
          estimated_cost?: number | null
          evidence_photos?: string[] | null
          failure_description?: string
          final_signature_url?: string | null
          id?: string
          initial_signature_url?: string | null
          order_number?: string
          pdf_url?: string | null
          requested_date?: string | null
          service_type?: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_type_fkey"
            columns: ["service_type"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string
          payment_number: string
          sale_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method: string
          payment_number: string
          sale_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string
          payment_number?: string
          sale_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payrolls: {
        Row: {
          base_salary: number
          bonus_amount: number | null
          bonus_description: string | null
          bonuses: number | null
          created_at: string
          created_by: string | null
          deductions: number | null
          employee_id: string | null
          employee_name: string
          extra_payments: number | null
          id: string
          net_salary: number
          payment_date: string | null
          period_month: number
          period_week: number | null
          period_year: number
          status: string
          updated_at: string
        }
        Insert: {
          base_salary: number
          bonus_amount?: number | null
          bonus_description?: string | null
          bonuses?: number | null
          created_at?: string
          created_by?: string | null
          deductions?: number | null
          employee_id?: string | null
          employee_name: string
          extra_payments?: number | null
          id?: string
          net_salary: number
          payment_date?: string | null
          period_month: number
          period_week?: number | null
          period_year: number
          status?: string
          updated_at?: string
        }
        Update: {
          base_salary?: number
          bonus_amount?: number | null
          bonus_description?: string | null
          bonuses?: number | null
          created_at?: string
          created_by?: string | null
          deductions?: number | null
          employee_id?: string | null
          employee_name?: string
          extra_payments?: number | null
          id?: string
          net_salary?: number
          payment_date?: string | null
          period_month?: number
          period_week?: number | null
          period_year?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      policies: {
        Row: {
          client_email: string
          client_name: string
          client_phone: string | null
          contract_type: string
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          monthly_cost: number
          policy_number: string
          property_address: string
          service_description: string
          start_date: string
          status: string
          updated_at: string
          visit_frequency: number
        }
        Insert: {
          client_email: string
          client_name: string
          client_phone?: string | null
          contract_type: string
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          monthly_cost: number
          policy_number: string
          property_address: string
          service_description: string
          start_date: string
          status?: string
          updated_at?: string
          visit_frequency: number
        }
        Update: {
          client_email?: string
          client_name?: string
          client_phone?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          monthly_cost?: number
          policy_number?: string
          property_address?: string
          service_description?: string
          start_date?: string
          status?: string
          updated_at?: string
          visit_frequency?: number
        }
        Relationships: []
      }
      policy_visits: {
        Row: {
          actual_date: string | null
          cost_avoided: number | null
          created_at: string
          duration_minutes: number | null
          id: string
          policy_id: string
          scheduled_date: string
          status: string
          technician_id: string | null
          updated_at: string
          visit_notes: string | null
          visit_type: string
        }
        Insert: {
          actual_date?: string | null
          cost_avoided?: number | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          policy_id: string
          scheduled_date: string
          status?: string
          technician_id?: string | null
          updated_at?: string
          visit_notes?: string | null
          visit_type: string
        }
        Update: {
          actual_date?: string | null
          cost_avoided?: number | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          policy_id?: string
          scheduled_date?: string
          status?: string
          technician_id?: string | null
          updated_at?: string
          visit_notes?: string | null
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_visits_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      profit_margin_configs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          margin_percentage: number
          max_price: number
          min_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          margin_percentage: number
          max_price: number
          min_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          margin_percentage?: number
          max_price?: number
          min_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          actual_cost: number | null
          budget: number | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          project_name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          budget?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          project_name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          budget?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          project_name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          concept: string
          created_at: string
          created_by: string | null
          expense_id: string | null
          fiscal_withdrawal_id: string | null
          has_invoice: boolean
          id: string
          invoice_number: string | null
          payment_method: string | null
          purchase_date: string
          purchase_number: string
          supplier_id: string | null
          supplier_name: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          concept: string
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          fiscal_withdrawal_id?: string | null
          has_invoice?: boolean
          id?: string
          invoice_number?: string | null
          payment_method?: string | null
          purchase_date?: string
          purchase_number?: string
          supplier_id?: string | null
          supplier_name: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          concept?: string
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          fiscal_withdrawal_id?: string | null
          has_invoice?: boolean
          id?: string
          invoice_number?: string | null
          payment_method?: string | null
          purchase_date?: string
          purchase_number?: string
          supplier_id?: string | null
          supplier_name?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_fiscal_withdrawal_id_fkey"
            columns: ["fiscal_withdrawal_id"]
            isOneToOne: false
            referencedRelation: "fiscal_withdrawals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_follow_ups: {
        Row: {
          completed: boolean
          created_at: string
          created_by: string | null
          follow_up_date: string
          follow_up_type: string
          id: string
          notes: string | null
          quote_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          created_by?: string | null
          follow_up_date?: string
          follow_up_type: string
          id?: string
          notes?: string | null
          quote_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          created_by?: string | null
          follow_up_date?: string
          follow_up_type?: string
          id?: string
          notes?: string | null
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_follow_ups_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_item_taxes: {
        Row: {
          created_at: string
          id: string
          quote_item_id: string
          tax_amount: number
          tax_name: string
          tax_rate: number
          tax_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          quote_item_id: string
          tax_amount: number
          tax_name: string
          tax_rate: number
          tax_type: string
        }
        Update: {
          created_at?: string
          id?: string
          quote_item_id?: string
          tax_amount?: number
          tax_name?: string
          tax_rate?: number
          tax_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_item_taxes_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_custom: boolean
          name: string
          quantity: number
          quote_id: string
          service_type_id: string | null
          subtotal: number
          total: number
          unit_price: number
          updated_at: string
          vat_amount: number
          vat_rate: number
          withholding_amount: number | null
          withholding_rate: number | null
          withholding_type: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_custom?: boolean
          name: string
          quantity?: number
          quote_id: string
          service_type_id?: string | null
          subtotal?: number
          total?: number
          unit_price?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
          withholding_amount?: number | null
          withholding_rate?: number | null
          withholding_type?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_custom?: boolean
          name?: string
          quantity?: number
          quote_id?: string
          service_type_id?: string | null
          subtotal?: number
          total?: number
          unit_price?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
          withholding_amount?: number | null
          withholding_rate?: number | null
          withholding_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          assigned_to: string | null
          client_company: string | null
          client_email: string
          client_name: string
          client_phone: string | null
          created_at: string
          created_by: string | null
          estimated_amount: number | null
          final_decision_date: string | null
          follow_up_date: string | null
          id: string
          is_automatic_sale: boolean
          marketing_channel: Database["public"]["Enums"]["marketing_channel"]
          notes: string | null
          quote_number: string
          quote_sent_at: string | null
          request_date: string
          response_deadline: string
          sale_type: Database["public"]["Enums"]["sale_type"]
          service_description: string
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          assigned_to?: string | null
          client_company?: string | null
          client_email: string
          client_name: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          estimated_amount?: number | null
          final_decision_date?: string | null
          follow_up_date?: string | null
          id?: string
          is_automatic_sale?: boolean
          marketing_channel: Database["public"]["Enums"]["marketing_channel"]
          notes?: string | null
          quote_number: string
          quote_sent_at?: string | null
          request_date?: string
          response_deadline?: string
          sale_type?: Database["public"]["Enums"]["sale_type"]
          service_description: string
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          assigned_to?: string | null
          client_company?: string | null
          client_email?: string
          client_name?: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          estimated_amount?: number | null
          final_decision_date?: string | null
          follow_up_date?: string | null
          id?: string
          is_automatic_sale?: boolean
          marketing_channel?: Database["public"]["Enums"]["marketing_channel"]
          notes?: string | null
          quote_number?: string
          quote_sent_at?: string | null
          request_date?: string
          response_deadline?: string
          sale_type?: Database["public"]["Enums"]["sale_type"]
          service_description?: string
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      recurring_payrolls: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          active: boolean
          base_salary: number
          created_at: string
          created_by: string | null
          cutoff_weekday: number
          day_of_month: number | null
          default_bonus: number | null
          employee_name: string
          frequency: string
          id: string
          last_run_date: string | null
          net_salary: number
          next_run_date: string
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active?: boolean
          base_salary: number
          created_at?: string
          created_by?: string | null
          cutoff_weekday?: number
          day_of_month?: number | null
          default_bonus?: number | null
          employee_name: string
          frequency?: string
          id?: string
          last_run_date?: string | null
          net_salary: number
          next_run_date?: string
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active?: boolean
          base_salary?: number
          created_at?: string
          created_by?: string | null
          cutoff_weekday?: number
          day_of_month?: number | null
          default_bonus?: number | null
          employee_name?: string
          frequency?: string
          id?: string
          last_run_date?: string | null
          net_salary?: number
          next_run_date?: string
          payment_method?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reward_transactions: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          description: string
          expires_at: string | null
          id: string
          order_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          description: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          description?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount: number
          client_email: string | null
          client_name: string
          created_at: string
          id: string
          project_id: string | null
          sale_date: string
          sale_number: string
          service_type: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          client_email?: string | null
          client_name: string
          created_at?: string
          id?: string
          project_id?: string | null
          sale_date?: string
          sale_number: string
          service_type: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          client_email?: string | null
          client_name?: string
          created_at?: string
          id?: string
          project_id?: string | null
          sale_date?: string
          sale_number?: string
          service_type?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_knowledge: {
        Row: {
          category_id: string
          created_at: string
          id: string
          knowledge_level: number
          notes: string | null
          salesperson_id: string
          specialization_products: string[] | null
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          knowledge_level?: number
          notes?: string | null
          salesperson_id: string
          specialization_products?: string[] | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          knowledge_level?: number
          notes?: string | null
          salesperson_id?: string
          specialization_products?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_knowledge_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "sales_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_products: {
        Row: {
          brand: string | null
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          model: string | null
          name: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "sales_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_satisfaction_surveys: {
        Row: {
          client_id: string
          created_at: string
          general_comments: string | null
          id: string
          overall_recommendation: number | null
          quote_id: string
          sales_attitude: number | null
          sales_comments: string | null
          sales_customer_service: number | null
          sales_knowledge: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          general_comments?: string | null
          id?: string
          overall_recommendation?: number | null
          quote_id: string
          sales_attitude?: number | null
          sales_comments?: string | null
          sales_customer_service?: number | null
          sales_knowledge?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          general_comments?: string | null
          id?: string
          overall_recommendation?: number | null
          quote_id?: string
          sales_attitude?: number | null
          sales_comments?: string | null
          sales_customer_service?: number | null
          sales_knowledge?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sales_skills: {
        Row: {
          certifications: string[] | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          sales_product_id: string
          salesperson_id: string
          skill_level: number
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          certifications?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          sales_product_id: string
          salesperson_id: string
          skill_level?: number
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          certifications?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          sales_product_id?: string
          salesperson_id?: string
          skill_level?: number
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_skills_sales_product_id_fkey"
            columns: ["sales_product_id"]
            isOneToOne: false
            referencedRelation: "sales_products"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_surveys: {
        Row: {
          client_email: string
          client_name: string
          created_at: string
          id: string
          is_completed: boolean
          order_id: string
          responded_at: string | null
          sent_at: string | null
          survey_token: string
          updated_at: string
        }
        Insert: {
          client_email: string
          client_name: string
          created_at?: string
          id?: string
          is_completed?: boolean
          order_id: string
          responded_at?: string | null
          sent_at?: string | null
          survey_token: string
          updated_at?: string
        }
        Update: {
          client_email?: string
          client_name?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          order_id?: string
          responded_at?: string | null
          sent_at?: string | null
          survey_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      service_types: {
        Row: {
          base_price: number | null
          category: string | null
          cost_price: number | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          is_active: boolean
          item_type: string | null
          max_quantity: number | null
          min_quantity: number | null
          name: string
          profit_margin_tiers: Json | null
          shared_time: boolean
          unit: string | null
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          base_price?: number | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          item_type?: string | null
          max_quantity?: number | null
          min_quantity?: number | null
          name: string
          profit_margin_tiers?: Json | null
          shared_time?: boolean
          unit?: string | null
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          base_price?: number | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          item_type?: string | null
          max_quantity?: number | null
          min_quantity?: number | null
          name?: string
          profit_margin_tiers?: Json | null
          shared_time?: boolean
          unit?: string | null
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          phone: string | null
          status: string
          supplier_name: string
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          status?: string
          supplier_name: string
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          status?: string
          supplier_name?: string
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      survey_recommendations: {
        Row: {
          average_rating: number
          created_at: string
          created_by: string | null
          id: string
          is_implemented: boolean
          period_month: number
          period_year: number
          priority_level: string
          recommendation_text: string
          total_responses: number
          updated_at: string
        }
        Insert: {
          average_rating: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_implemented?: boolean
          period_month: number
          period_year: number
          priority_level?: string
          recommendation_text: string
          total_responses: number
          updated_at?: string
        }
        Update: {
          average_rating?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_implemented?: boolean
          period_month?: number
          period_year?: number
          priority_level?: string
          recommendation_text?: string
          total_responses?: number
          updated_at?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          question_text: string
          question_type: string
          rating: number
          survey_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          question_text: string
          question_type: string
          rating: number
          survey_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          question_text?: string
          question_type?: string
          rating?: number
          survey_id?: string
        }
        Relationships: []
      }
      task_completion_history: {
        Row: {
          assignee_name: string
          assignment_id: string
          category: Database["public"]["Enums"]["task_5s_category"]
          completed_at: string
          created_at: string
          duration_minutes: number | null
          id: string
          location: string
          notes: string | null
          quality_score: number | null
          task_name: string
        }
        Insert: {
          assignee_name: string
          assignment_id: string
          category: Database["public"]["Enums"]["task_5s_category"]
          completed_at: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          location: string
          notes?: string | null
          quality_score?: number | null
          task_name: string
        }
        Update: {
          assignee_name?: string
          assignment_id?: string
          category?: Database["public"]["Enums"]["task_5s_category"]
          completed_at?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          location?: string
          notes?: string | null
          quality_score?: number | null
          task_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completion_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "cleaning_task_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_definitions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          tax_name: string
          tax_rate: number
          tax_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          tax_name: string
          tax_rate: number
          tax_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          tax_name?: string
          tax_rate?: number
          tax_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      technical_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      technical_knowledge: {
        Row: {
          category_id: string
          certifications: string[] | null
          created_at: string
          id: string
          months_experience: number | null
          notes: string | null
          skill_level: number
          specialization_products: string[] | null
          technician_id: string
          updated_at: string
          years_experience: number
        }
        Insert: {
          category_id: string
          certifications?: string[] | null
          created_at?: string
          id?: string
          months_experience?: number | null
          notes?: string | null
          skill_level?: number
          specialization_products?: string[] | null
          technician_id: string
          updated_at?: string
          years_experience?: number
        }
        Update: {
          category_id?: string
          certifications?: string[] | null
          created_at?: string
          id?: string
          months_experience?: number | null
          notes?: string | null
          skill_level?: number
          specialization_products?: string[] | null
          technician_id?: string
          updated_at?: string
          years_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "technical_knowledge_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "technical_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_products: {
        Row: {
          brand: string | null
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          model: string | null
          name: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "technical_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_satisfaction_surveys: {
        Row: {
          client_id: string
          created_at: string
          general_comments: string | null
          id: string
          order_id: string
          overall_recommendation: number | null
          technician_attitude: number | null
          technician_comments: string | null
          technician_customer_service: number | null
          technician_knowledge: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          general_comments?: string | null
          id?: string
          order_id: string
          overall_recommendation?: number | null
          technician_attitude?: number | null
          technician_comments?: string | null
          technician_customer_service?: number | null
          technician_knowledge?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          general_comments?: string | null
          id?: string
          order_id?: string
          overall_recommendation?: number | null
          technician_attitude?: number | null
          technician_comments?: string | null
          technician_customer_service?: number | null
          technician_knowledge?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      technician_skills: {
        Row: {
          certifications: string[] | null
          created_at: string
          id: string
          notes: string | null
          service_type_id: string
          skill_level: number
          technician_id: string
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          certifications?: string[] | null
          created_at?: string
          id?: string
          notes?: string | null
          service_type_id: string
          skill_level?: number
          technician_id: string
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          certifications?: string[] | null
          created_at?: string
          id?: string
          notes?: string | null
          service_type_id?: string
          skill_level?: number
          technician_id?: string
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_technician_skills_service_type"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_skills_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_workload: {
        Row: {
          created_at: string
          estimated_hours: number
          id: string
          is_shared_service: boolean
          order_id: string
          service_type_id: string
          status: string
          technician_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estimated_hours?: number
          id?: string
          is_shared_service?: boolean
          order_id: string
          service_type_id: string
          status?: string
          technician_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estimated_hours?: number
          id?: string
          is_shared_service?: boolean
          order_id?: string
          service_type_id?: string
          status?: string
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_technician_workload_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_technician_workload_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      time_records: {
        Row: {
          check_in_location: Json | null
          check_in_time: string | null
          check_out_location: Json | null
          check_out_time: string | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          status: string
          total_hours: number | null
          updated_at: string
          work_date: string
        }
        Insert: {
          check_in_location?: Json | null
          check_in_time?: string | null
          check_out_location?: Json | null
          check_out_time?: string | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          status?: string
          total_hours?: number | null
          updated_at?: string
          work_date?: string
        }
        Update: {
          check_in_location?: Json | null
          check_in_time?: string | null
          check_out_location?: Json | null
          check_out_time?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          status?: string
          total_hours?: number | null
          updated_at?: string
          work_date?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          actual_value: number | null
          earned_at: string
          id: string
          period_end: string | null
          period_start: string | null
          reward_claimed: boolean
          reward_claimed_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          actual_value?: number | null
          earned_at?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          reward_claimed?: boolean
          reward_claimed_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          actual_value?: number | null
          earned_at?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          reward_claimed?: boolean
          reward_claimed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenance: {
        Row: {
          cost: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          invoice_number: string | null
          maintenance_date: string
          maintenance_type: Database["public"]["Enums"]["maintenance_type"]
          mileage_at_service: number
          next_service_date: string | null
          next_service_mileage: number | null
          notes: string | null
          parts_replaced: string[] | null
          provider: string | null
          updated_at: string
          vehicle_id: string
          warranty_until: string | null
        }
        Insert: {
          cost?: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          invoice_number?: string | null
          maintenance_date: string
          maintenance_type: Database["public"]["Enums"]["maintenance_type"]
          mileage_at_service: number
          next_service_date?: string | null
          next_service_mileage?: number | null
          notes?: string | null
          parts_replaced?: string[] | null
          provider?: string | null
          updated_at?: string
          vehicle_id: string
          warranty_until?: string | null
        }
        Update: {
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          invoice_number?: string | null
          maintenance_date?: string
          maintenance_type?: Database["public"]["Enums"]["maintenance_type"]
          mileage_at_service?: number
          next_service_date?: string | null
          next_service_mileage?: number | null
          notes?: string | null
          parts_replaced?: string[] | null
          provider?: string | null
          updated_at?: string
          vehicle_id?: string
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_reminders: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          is_completed: boolean
          notes: string | null
          reminder_date: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          is_completed?: boolean
          notes?: string | null
          reminder_date: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          is_completed?: boolean
          notes?: string | null
          reminder_date?: string
          reminder_type?: Database["public"]["Enums"]["reminder_type"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_reminders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_routes: {
        Row: {
          created_at: string
          created_by: string | null
          distance_km: number
          driver_name: string | null
          efficiency_km_per_liter: number | null
          end_location: string
          end_mileage: number
          end_time: string | null
          fuel_consumed: number | null
          id: string
          notes: string | null
          purpose: string | null
          related_visits: string[] | null
          route_date: string
          route_name: string
          start_location: string
          start_mileage: number
          start_time: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          distance_km: number
          driver_name?: string | null
          efficiency_km_per_liter?: number | null
          end_location: string
          end_mileage: number
          end_time?: string | null
          fuel_consumed?: number | null
          id?: string
          notes?: string | null
          purpose?: string | null
          related_visits?: string[] | null
          route_date: string
          route_name: string
          start_location: string
          start_mileage: number
          start_time?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          distance_km?: number
          driver_name?: string | null
          efficiency_km_per_liter?: number | null
          end_location?: string
          end_mileage?: number
          end_time?: string | null
          fuel_consumed?: number | null
          id?: string
          notes?: string | null
          purpose?: string | null
          related_visits?: string[] | null
          route_date?: string
          route_name?: string
          start_location?: string
          start_mileage?: number
          start_time?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          assigned_technician: string | null
          brand: string
          created_at: string
          created_by: string | null
          current_mileage: number
          estimated_consumption: number
          fuel_type: string
          id: string
          insurance_expiry: string | null
          license_plate: string
          model: string
          purchase_date: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          assigned_technician?: string | null
          brand: string
          created_at?: string
          created_by?: string | null
          current_mileage?: number
          estimated_consumption: number
          fuel_type?: string
          id?: string
          insurance_expiry?: string | null
          license_plate: string
          model: string
          purchase_date?: string | null
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          assigned_technician?: string | null
          brand?: string
          created_at?: string
          created_by?: string | null
          current_mileage?: number
          estimated_consumption?: number
          fuel_type?: string
          id?: string
          insurance_expiry?: string | null
          license_plate?: string
          model?: string
          purchase_date?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      visit_actions: {
        Row: {
          action_description: string
          action_type: string
          after_photo_url: string | null
          before_photo_url: string | null
          created_at: string
          id: string
          materials_used: string | null
          time_spent_minutes: number | null
          visit_id: string
        }
        Insert: {
          action_description: string
          action_type: string
          after_photo_url?: string | null
          before_photo_url?: string | null
          created_at?: string
          id?: string
          materials_used?: string | null
          time_spent_minutes?: number | null
          visit_id: string
        }
        Update: {
          action_description?: string
          action_type?: string
          after_photo_url?: string | null
          before_photo_url?: string | null
          created_at?: string
          id?: string
          materials_used?: string | null
          time_spent_minutes?: number | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_actions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "policy_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_signatures: {
        Row: {
          action_id: string | null
          id: string
          signature_data: string
          signature_type: string
          signed_at: string
          signed_by: string
          visit_id: string
        }
        Insert: {
          action_id?: string | null
          id?: string
          signature_data: string
          signature_type: string
          signed_at?: string
          signed_by: string
          visit_id: string
        }
        Update: {
          action_id?: string | null
          id?: string
          signature_data?: string
          signature_type?: string
          signed_at?: string
          signed_by?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_signatures_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "visit_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_signatures_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "policy_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          created_at: string
          days_worked: number
          employee_id: string
          generated_at: string
          generated_by: string | null
          id: string
          overtime_hours: number
          regular_hours: number
          report_data: Json | null
          total_hours: number
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          days_worked?: number
          employee_id: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          overtime_hours?: number
          regular_hours?: number
          report_data?: Json | null
          total_hours?: number
          week_end_date: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          days_worked?: number
          employee_id?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          overtime_hours?: number
          regular_hours?: number
          report_data?: Json | null
          total_hours?: number
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: []
      }
      whatsapp_notifications: {
        Row: {
          client_email: string
          client_whatsapp: string
          created_at: string
          error_message: string | null
          id: string
          message_content: string
          message_type: string
          related_id: string
          related_type: string
          sent_at: string
          status: string
        }
        Insert: {
          client_email: string
          client_whatsapp: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_content: string
          message_type: string
          related_id: string
          related_type: string
          sent_at?: string
          status?: string
        }
        Update: {
          client_email?: string
          client_whatsapp?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_content?: string
          message_type?: string
          related_id?: string
          related_type?: string
          sent_at?: string
          status?: string
        }
        Relationships: []
      }
      work_schedules: {
        Row: {
          break_duration_minutes: number
          created_at: string
          created_by: string | null
          employee_id: string
          end_time: string
          id: string
          is_active: boolean
          monthly_salary: number | null
          overtime_rate_multiplier: number | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          start_time: string
          updated_at: string
          work_days: number[]
        }
        Insert: {
          break_duration_minutes?: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_time: string
          id?: string
          is_active?: boolean
          monthly_salary?: number | null
          overtime_rate_multiplier?: number | null
          shift_type?: Database["public"]["Enums"]["shift_type"]
          start_time: string
          updated_at?: string
          work_days?: number[]
        }
        Update: {
          break_duration_minutes?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_time?: string
          id?: string
          is_active?: boolean
          monthly_salary?: number | null
          overtime_rate_multiplier?: number | null
          shift_type?: Database["public"]["Enums"]["shift_type"]
          start_time?: string
          updated_at?: string
          work_days?: number[]
        }
        Relationships: []
      }
    }
    Views: {
      pending_collections: {
        Row: {
          client_email: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          delivery_date: string | null
          estimated_cost: number | null
          id: string | null
          order_number: string | null
          remaining_balance: number | null
          subtotal_without_vat: number | null
          total_paid: number | null
          total_vat_amount: number | null
          total_with_vat: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_service_skills: {
        Row: {
          certifications: string[] | null
          created_at: string | null
          id: string | null
          notes: string | null
          service_category: string | null
          service_description: string | null
          service_estimated_hours: number | null
          service_name: string | null
          service_type_id: string | null
          skill_level: number | null
          technician_id: string | null
          updated_at: string | null
          years_experience: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_technician_skills_service_type"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_skills_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_summary: {
        Row: {
          period: string | null
          vat_balance: number | null
          vat_collected: number | null
          vat_paid: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_assign_cleaning_tasks: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      calculate_order_item_pricing: {
        Args: { p_service_type_id: string; p_quantity?: number }
        Returns: {
          unit_cost_price: number
          unit_base_price: number
          profit_margin_rate: number
          subtotal: number
          vat_rate: number
          vat_amount: number
          total_amount: number
          item_type: string
        }[]
      }
      calculate_schedule_weekly_hours: {
        Args: {
          work_days: number[]
          start_time: string
          end_time: string
          break_duration_minutes: number
        }
        Returns: number
      }
      calculate_service_price: {
        Args: { p_service_id: string; p_quantity?: number }
        Returns: {
          cost_price: number
          profit_margin: number
          vat_amount: number
          final_price: number
          unit_price: number
        }[]
      }
      calculate_weekly_payroll_date: {
        Args: { base_date: string; cutoff_weekday: number }
        Returns: string
      }
      change_user_password: {
        Args: { p_user_id: string; p_new_password: string }
        Returns: Json
      }
      check_and_award_achievements: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clean_expired_rewards: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      convert_quote_to_order: {
        Args: { quote_id: string }
        Returns: Json
      }
      generate_client_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_expense_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_income_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_monthly_recommendations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_payment_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_policy_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_purchase_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_quote_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_referral_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_sale_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_survey_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_weekly_report: {
        Args: {
          p_employee_id: string
          p_week_start: string
          p_week_end: string
        }
        Returns: string
      }
      get_attendance_summary: {
        Args: { employee_uuid: string; start_date: string; end_date: string }
        Returns: {
          total_days: number
          present_days: number
          late_days: number
          absent_days: number
          total_hours: number
          overtime_hours: number
          attendance_rate: number
        }[]
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_simple_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_upcoming_reminders: {
        Args: { days_ahead?: number }
        Returns: {
          vehicle_model: string
          license_plate: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          description: string
          due_date: string
          days_until_due: number
        }[]
      }
      get_user_role_safe: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      log_financial_operation: {
        Args: {
          p_operation_type: string
          p_table_name: string
          p_record_id: string
          p_record_data: Json
          p_operation_description: string
          p_amount: number
          p_account_type?: string
          p_operation_date?: string
        }
        Returns: string
      }
      send_whatsapp_notification: {
        Args: {
          p_client_email: string
          p_message_type: string
          p_related_id: string
          p_related_type: string
          p_message_content: string
        }
        Returns: undefined
      }
      suggest_optimal_technician: {
        Args: { p_service_type_id: string; p_delivery_date?: string }
        Returns: {
          technician_id: string
          full_name: string
          current_workload: number
          skill_level: number
          years_experience: number
          score: number
          suggestion_reason: string
        }[]
      }
    }
    Enums: {
      account_type: "fiscal" | "no_fiscal"
      achievement_type:
        | "format_count"
        | "monthly_sales"
        | "profit_margin"
        | "income_threshold"
        | "custom"
      attendance_status:
        | "presente"
        | "tarde"
        | "ausente"
        | "permiso"
        | "vacaciones"
        | "incapacidad"
      maintenance_type:
        | "preventivo"
        | "correctivo"
        | "cambio_aceite"
        | "llantas"
        | "frenos"
        | "suspension"
        | "motor"
        | "transmision"
        | "otros"
      marketing_channel:
        | "web"
        | "facebook"
        | "google"
        | "referencia"
        | "telefono"
        | "email"
        | "whatsapp"
        | "otro"
      order_status:
        | "pendiente"
        | "en_proceso"
        | "finalizada"
        | "cancelada"
        | "en_camino"
        | "pendiente_aprobacion"
        | "pendiente_entrega"
      quote_status:
        | "solicitud"
        | "enviada"
        | "seguimiento"
        | "aceptada"
        | "rechazada"
        | "pendiente_aprobacion"
      reminder_type:
        | "placas"
        | "refrendo"
        | "servicio"
        | "verificacion"
        | "seguro"
      reward_type:
        | "monetary"
        | "suggestion"
        | "recommendation"
        | "unlock_feature"
      sale_type: "producto" | "servicio" | "recurrente"
      service_type:
        | "reparacion"
        | "mantenimiento"
        | "instalacion"
        | "diagnostico"
        | "garantia"
      shift_type: "matutino" | "vespertino" | "nocturno" | "flexible"
      task_5s_category: "seiri" | "seiton" | "seiso" | "seiketsu" | "shitsuke"
      task_priority: "baja" | "media" | "alta" | "critica"
      task_status: "pendiente" | "en_progreso" | "completada" | "cancelada"
      user_role:
        | "administrador"
        | "tecnico"
        | "vendedor"
        | "cliente"
        | "supervisor"
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
    Enums: {
      account_type: ["fiscal", "no_fiscal"],
      achievement_type: [
        "format_count",
        "monthly_sales",
        "profit_margin",
        "income_threshold",
        "custom",
      ],
      attendance_status: [
        "presente",
        "tarde",
        "ausente",
        "permiso",
        "vacaciones",
        "incapacidad",
      ],
      maintenance_type: [
        "preventivo",
        "correctivo",
        "cambio_aceite",
        "llantas",
        "frenos",
        "suspension",
        "motor",
        "transmision",
        "otros",
      ],
      marketing_channel: [
        "web",
        "facebook",
        "google",
        "referencia",
        "telefono",
        "email",
        "whatsapp",
        "otro",
      ],
      order_status: [
        "pendiente",
        "en_proceso",
        "finalizada",
        "cancelada",
        "en_camino",
        "pendiente_aprobacion",
        "pendiente_entrega",
      ],
      quote_status: [
        "solicitud",
        "enviada",
        "seguimiento",
        "aceptada",
        "rechazada",
        "pendiente_aprobacion",
      ],
      reminder_type: [
        "placas",
        "refrendo",
        "servicio",
        "verificacion",
        "seguro",
      ],
      reward_type: [
        "monetary",
        "suggestion",
        "recommendation",
        "unlock_feature",
      ],
      sale_type: ["producto", "servicio", "recurrente"],
      service_type: [
        "reparacion",
        "mantenimiento",
        "instalacion",
        "diagnostico",
        "garantia",
      ],
      shift_type: ["matutino", "vespertino", "nocturno", "flexible"],
      task_5s_category: ["seiri", "seiton", "seiso", "seiketsu", "shitsuke"],
      task_priority: ["baja", "media", "alta", "critica"],
      task_status: ["pendiente", "en_progreso", "completada", "cancelada"],
      user_role: [
        "administrador",
        "tecnico",
        "vendedor",
        "cliente",
        "supervisor",
      ],
    },
  },
} as const
