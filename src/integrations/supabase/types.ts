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
      affiliate_commissions: {
        Row: {
          affiliate_user_id: string
          commission_cents: number
          created_at: string
          id: string
          referred_user_id: string
          status: string
          transaction_id: string | null
        }
        Insert: {
          affiliate_user_id: string
          commission_cents: number
          created_at?: string
          id?: string
          referred_user_id: string
          status?: string
          transaction_id?: string | null
        }
        Update: {
          affiliate_user_id?: string
          commission_cents?: number
          created_at?: string
          id?: string
          referred_user_id?: string
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_pricing: {
        Row: {
          api_cost_input_per_million: number
          api_cost_output_per_million: number
          created_at: string
          id: string
          is_active: boolean
          model_id: string
          model_label: string
          resale_price_input_per_million: number
          resale_price_output_per_million: number
          updated_at: string
        }
        Insert: {
          api_cost_input_per_million?: number
          api_cost_output_per_million?: number
          created_at?: string
          id?: string
          is_active?: boolean
          model_id: string
          model_label: string
          resale_price_input_per_million?: number
          resale_price_output_per_million?: number
          updated_at?: string
        }
        Update: {
          api_cost_input_per_million?: number
          api_cost_output_per_million?: number
          created_at?: string
          id?: string
          is_active?: boolean
          model_id?: string
          model_label?: string
          resale_price_input_per_million?: number
          resale_price_output_per_million?: number
          updated_at?: string
        }
        Relationships: []
      }
      balances: {
        Row: {
          balance_cents: number
          created_at: string
          id: string
          total_deposited_cents: number
          total_spent_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_cents?: number
          created_at?: string
          id?: string
          total_deposited_cents?: number
          total_spent_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_cents?: number
          created_at?: string
          id?: string
          total_deposited_cents?: number
          total_spent_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_captures: {
        Row: {
          created_at: string
          email: string
          first_login_at: string | null
          has_paid: boolean | null
          id: string
          last_login_at: string | null
          source: string | null
          status: string
          total_paid_cents: number | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_login_at?: string | null
          has_paid?: boolean | null
          id?: string
          last_login_at?: string | null
          source?: string | null
          status?: string
          total_paid_cents?: number | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_login_at?: string | null
          has_paid?: boolean | null
          id?: string
          last_login_at?: string | null
          source?: string | null
          status?: string
          total_paid_cents?: number | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          sent_by_email: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          sent_by_email?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          sent_by_email?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          asaas_plan_id: string | null
          created_at: string
          credits_amount: number
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price_brl: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          asaas_plan_id?: string | null
          created_at?: string
          credits_amount: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price_brl: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          asaas_plan_id?: string | null
          created_at?: string
          credits_amount?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_brl?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          affiliate_code: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          pix_key: string | null
          referral_code: string | null
          referred_by: string | null
          updated_at: string
        }
        Insert: {
          affiliate_code?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          pix_key?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_code?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          pix_key?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      token_usage: {
        Row: {
          cost_cents: number
          created_at: string
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          user_id: string
        }
        Insert: {
          cost_cents?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          user_id: string
        }
        Update: {
          cost_cents?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_cents: number
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          metadata: Json | null
          payment_gateway: string | null
          payment_method: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          payment_gateway?: string | null
          payment_method?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          payment_gateway?: string | null
          payment_method?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_ai_api_keys: {
        Row: {
          api_key: string
          created_at: string
          expires_at: string
          id: string
          key_hint: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          expires_at?: string
          id?: string
          key_hint?: string
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          key_hint?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          pix_key: string
          processed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          pix_key: string
          processed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          pix_key?: string
          processed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_affiliate_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_email: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "affiliate"
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
      app_role: ["admin", "moderator", "user", "affiliate"],
    },
  },
} as const
