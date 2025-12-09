export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  graphql_public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  public: {
    Tables: {
      app_config: {
        Row: {
          description: string | null;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          description?: string | null;
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          description?: string | null;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          display_order: number;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      flyer_pages: {
        Row: {
          created_at: string;
          error_message: string | null;
          flyer_id: string;
          id: string;
          original_image_path: string;
          page_number: number;
          raw_ai_data: Json | null;
          status: Database["public"]["Enums"]["flyer_status"];
          updated_at: string;
          web_image_path: string | null;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          flyer_id: string;
          id?: string;
          original_image_path: string;
          page_number: number;
          raw_ai_data?: Json | null;
          status?: Database["public"]["Enums"]["flyer_status"];
          updated_at?: string;
          web_image_path?: string | null;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          flyer_id?: string;
          id?: string;
          original_image_path?: string;
          page_number?: number;
          raw_ai_data?: Json | null;
          status?: Database["public"]["Enums"]["flyer_status"];
          updated_at?: string;
          web_image_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "flyer_pages_flyer_id_fkey";
            columns: ["flyer_id"];
            isOneToOne: false;
            referencedRelation: "flyers";
            referencedColumns: ["id"];
          },
        ];
      };
      flyers: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          status: Database["public"]["Enums"]["flyer_status"];
          store_id: string;
          updated_at: string;
          valid_from: string;
          valid_to: string;
          verified_by: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["flyer_status"];
          store_id: string;
          updated_at?: string;
          valid_from: string;
          valid_to: string;
          verified_by?: string | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["flyer_status"];
          store_id?: string;
          updated_at?: string;
          valid_from?: string;
          valid_to?: string;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "flyers_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flyers_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          bbox: Json | null;
          category_id: string;
          created_at: string;
          currency: string;
          description: string | null;
          flyer_page_id: string;
          id: string;
          name: string;
          name_tsvector: unknown;
          price: number;
          promo_conditions: string | null;
          unit: string | null;
          updated_at: string;
        };
        Insert: {
          bbox?: Json | null;
          category_id: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          flyer_page_id: string;
          id?: string;
          name: string;
          name_tsvector?: unknown;
          price: number;
          promo_conditions?: string | null;
          unit?: string | null;
          updated_at?: string;
        };
        Update: {
          bbox?: Json | null;
          category_id?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          flyer_page_id?: string;
          id?: string;
          name?: string;
          name_tsvector?: unknown;
          price?: number;
          promo_conditions?: string | null;
          unit?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_flyer_page_id_fkey";
            columns: ["flyer_page_id"];
            isOneToOne: false;
            referencedRelation: "flyer_pages";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stores: {
        Row: {
          created_at: string;
          id: string;
          logo_path: string | null;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_active_products: {
        Row: {
          bbox: Json | null;
          category_name: string | null;
          category_slug: string | null;
          created_at: string | null;
          currency: string | null;
          description: string | null;
          id: string | null;
          name: string | null;
          page_number: number | null;
          price: number | null;
          promo_conditions: string | null;
          store_logo: string | null;
          store_name: string | null;
          store_slug: string | null;
          unit: string | null;
          valid_from: string | null;
          valid_to: string | null;
          web_image_path: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      search_products: {
        Args: {
          filter_category_slug?: string;
          filter_store_slug?: string;
          limit_count?: number;
          offset_count?: number;
          search_query: string;
          sort_by?: string;
        };
        Returns: {
          bbox: Json;
          category_name: string;
          category_slug: string;
          created_at: string;
          currency: string;
          description: string;
          id: string;
          name: string;
          page_number: number;
          price: number;
          promo_conditions: string;
          relevance_score: number;
          store_logo: string;
          store_name: string;
          store_slug: string;
          unit: string;
          valid_from: string;
          valid_to: string;
          web_image_path: string;
        }[];
      };
    };
    Enums: {
      flyer_status: "draft" | "processing" | "verification" | "published";
    };
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      flyer_status: ["draft", "processing", "verification", "published"],
    },
  },
} as const;
