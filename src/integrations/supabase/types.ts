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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      contact_activities: {
        Row: {
          activity_type: string
          contact_id: string
          created_at: string
          id: string
          metadata: Json
          phone_number: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          contact_id: string
          created_at?: string
          id?: string
          metadata?: Json
          phone_number?: string | null
          status?: string | null
          user_id?: string
        }
        Update: {
          activity_type?: string
          contact_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          phone_number?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string
          email: string | null
          extraction_confidence: number | null
          first_name: string | null
          follow_up_at: string | null
          follow_up_status: string
          full_name: string | null
          id: string
          import_job_id: string | null
          job_title: string | null
          last_contacted_at: string | null
          last_name: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          secondary_email: string | null
          secondary_phone: string | null
          source_filename: string | null
          source_location: string | null
          source_type: string | null
          state: string | null
          tags: string[]
          updated_at: string
          user_id: string
          verification_status: string
          website: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          extraction_confidence?: number | null
          first_name?: string | null
          follow_up_at?: string | null
          follow_up_status?: string
          full_name?: string | null
          id?: string
          import_job_id?: string | null
          job_title?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          secondary_email?: string | null
          secondary_phone?: string | null
          source_filename?: string | null
          source_location?: string | null
          source_type?: string | null
          state?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
          verification_status?: string
          website?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          extraction_confidence?: number | null
          first_name?: string | null
          follow_up_at?: string | null
          follow_up_status?: string
          full_name?: string | null
          id?: string
          import_job_id?: string | null
          job_title?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          secondary_email?: string | null
          secondary_phone?: string | null
          source_filename?: string | null
          source_location?: string | null
          source_type?: string | null
          state?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
          verification_status?: string
          website?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_tasks: {
        Row: {
          activity_id: string | null
          completed_at: string | null
          contact_id: string
          created_at: string
          due_at: string | null
          id: string
          message_template: string | null
          phone_number: string | null
          status: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          completed_at?: string | null
          contact_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          message_template?: string | null
          phone_number?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          activity_id?: string | null
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          message_template?: string | null
          phone_number?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_tasks_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "contact_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          duplicate_records: number
          error_message: string | null
          failed_records: number
          id: string
          source_filename: string | null
          source_type: string
          status: string
          successful_records: number
          total_records: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duplicate_records?: number
          error_message?: string | null
          failed_records?: number
          id?: string
          source_filename?: string | null
          source_type: string
          status?: string
          successful_records?: number
          total_records?: number
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duplicate_records?: number
          error_message?: string | null
          failed_records?: number
          id?: string
          source_filename?: string | null
          source_type?: string
          status?: string
          successful_records?: number
          total_records?: number
          user_id?: string
        }
        Relationships: []
      }
      import_records: {
        Row: {
          confidence: number | null
          contact_id: string | null
          created_at: string
          extracted_data: Json
          id: string
          import_job_id: string
          source_location: string | null
          status: string
          user_id: string
          validation_errors: Json
        }
        Insert: {
          confidence?: number | null
          contact_id?: string | null
          created_at?: string
          extracted_data: Json
          id?: string
          import_job_id: string
          source_location?: string | null
          status: string
          user_id?: string
          validation_errors?: Json
        }
        Update: {
          confidence?: number | null
          contact_id?: string | null
          created_at?: string
          extracted_data?: Json
          id?: string
          import_job_id?: string
          source_location?: string | null
          status?: string
          user_id?: string
          validation_errors?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_records_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_records_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_country: string
          display_name: string | null
          followup_template: string | null
          id: string
        }
        Insert: {
          created_at?: string
          default_country?: string
          display_name?: string | null
          followup_template?: string | null
          id: string
        }
        Update: {
          created_at?: string
          default_country?: string
          display_name?: string | null
          followup_template?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
