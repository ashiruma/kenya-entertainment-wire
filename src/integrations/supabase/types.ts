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
      approval_audit_log: {
        Row: {
          action: string
          actor_display_name: string | null
          actor_user_id: string
          created_at: string
          draft_id: string
          error_count: number
          from_status: string | null
          id: string
          notes: string | null
          to_status: string | null
          validation_errors: Json
          validation_warnings: Json
          warning_count: number
        }
        Insert: {
          action: string
          actor_display_name?: string | null
          actor_user_id: string
          created_at?: string
          draft_id: string
          error_count?: number
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status?: string | null
          validation_errors?: Json
          validation_warnings?: Json
          warning_count?: number
        }
        Update: {
          action?: string
          actor_display_name?: string | null
          actor_user_id?: string
          created_at?: string
          draft_id?: string
          error_count?: number
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status?: string | null
          validation_errors?: Json
          validation_warnings?: Json
          warning_count?: number
        }
        Relationships: []
      }
      discovered_stories: {
        Row: {
          author: string | null
          canonical_url: string | null
          category: string | null
          created_at: string
          dedupe_hash: string | null
          excerpt: string | null
          feed_id: string | null
          highlights: Json | null
          id: string
          image_url: string | null
          normalized_title: string | null
          preview_summary: string | null
          published_at: string | null
          raw_content: string | null
          region: string | null
          rejection_reason: string | null
          source: string
          source_url: string
          status: string
          title: string
        }
        Insert: {
          author?: string | null
          canonical_url?: string | null
          category?: string | null
          created_at?: string
          dedupe_hash?: string | null
          excerpt?: string | null
          feed_id?: string | null
          highlights?: Json | null
          id?: string
          image_url?: string | null
          normalized_title?: string | null
          preview_summary?: string | null
          published_at?: string | null
          raw_content?: string | null
          region?: string | null
          rejection_reason?: string | null
          source: string
          source_url: string
          status?: string
          title: string
        }
        Update: {
          author?: string | null
          canonical_url?: string | null
          category?: string | null
          created_at?: string
          dedupe_hash?: string | null
          excerpt?: string | null
          feed_id?: string | null
          highlights?: Json | null
          id?: string
          image_url?: string | null
          normalized_title?: string | null
          preview_summary?: string | null
          published_at?: string | null
          raw_content?: string | null
          region?: string | null
          rejection_reason?: string | null
          source?: string
          source_url?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovered_stories_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "discovery_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_feeds: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          kind: string
          last_error: string | null
          last_fetched_at: string | null
          last_item_count: number
          last_status: string | null
          name: string
          priority: number
          query: string | null
          total_accepted: number
          total_duplicates: number
          total_rejected: number
          updated_at: string
          url: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind: string
          last_error?: string | null
          last_fetched_at?: string | null
          last_item_count?: number
          last_status?: string | null
          name: string
          priority?: number
          query?: string | null
          total_accepted?: number
          total_duplicates?: number
          total_rejected?: number
          updated_at?: string
          url?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          last_error?: string | null
          last_fetched_at?: string | null
          last_item_count?: number
          last_status?: string | null
          name?: string
          priority?: number
          query?: string | null
          total_accepted?: number
          total_duplicates?: number
          total_rejected?: number
          updated_at?: string
          url?: string | null
          weight?: number
        }
        Relationships: []
      }
      discovery_runs: {
        Row: {
          created_at: string
          duplicate_count: number
          errors: Json
          feed_stats: Json
          fetched_count: number
          filtered_count: number
          finished_at: string | null
          id: string
          inserted_count: number
          rejected_count: number
          started_at: string
          status: string
          trigger: string
        }
        Insert: {
          created_at?: string
          duplicate_count?: number
          errors?: Json
          feed_stats?: Json
          fetched_count?: number
          filtered_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          rejected_count?: number
          started_at?: string
          status?: string
          trigger?: string
        }
        Update: {
          created_at?: string
          duplicate_count?: number
          errors?: Json
          feed_stats?: Json
          fetched_count?: number
          filtered_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          rejected_count?: number
          started_at?: string
          status?: string
          trigger?: string
        }
        Relationships: []
      }
      discovery_settings: {
        Row: {
          enabled: boolean
          id: boolean
          interval_minutes: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          interval_minutes?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: boolean
          interval_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      drafts: {
        Row: {
          author_id: string
          auto_publish_at: string | null
          auto_publish_enabled: boolean
          body: string | null
          byline: string | null
          category: string | null
          created_at: string
          facebook_post: string | null
          headline: string
          hero_image_url: string | null
          id: string
          idempotency_key: string | null
          instagram_post: string | null
          lede: string | null
          published_at: string | null
          region: string | null
          social_image_url: string | null
          source_story_id: string | null
          sources: Json
          status: string
          template_type: string
          twitter_post: string | null
          updated_at: string
          wordpress_last_error: string | null
          wordpress_post_id: string | null
          wordpress_post_url: string | null
          wordpress_published_at: string | null
        }
        Insert: {
          author_id: string
          auto_publish_at?: string | null
          auto_publish_enabled?: boolean
          body?: string | null
          byline?: string | null
          category?: string | null
          created_at?: string
          facebook_post?: string | null
          headline: string
          hero_image_url?: string | null
          id?: string
          idempotency_key?: string | null
          instagram_post?: string | null
          lede?: string | null
          published_at?: string | null
          region?: string | null
          social_image_url?: string | null
          source_story_id?: string | null
          sources?: Json
          status?: string
          template_type?: string
          twitter_post?: string | null
          updated_at?: string
          wordpress_last_error?: string | null
          wordpress_post_id?: string | null
          wordpress_post_url?: string | null
          wordpress_published_at?: string | null
        }
        Update: {
          author_id?: string
          auto_publish_at?: string | null
          auto_publish_enabled?: boolean
          body?: string | null
          byline?: string | null
          category?: string | null
          created_at?: string
          facebook_post?: string | null
          headline?: string
          hero_image_url?: string | null
          id?: string
          idempotency_key?: string | null
          instagram_post?: string | null
          lede?: string | null
          published_at?: string | null
          region?: string | null
          social_image_url?: string | null
          source_story_id?: string | null
          sources?: Json
          status?: string
          template_type?: string
          twitter_post?: string | null
          updated_at?: string
          wordpress_last_error?: string | null
          wordpress_post_id?: string | null
          wordpress_post_url?: string | null
          wordpress_published_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drafts_source_story_id_fkey"
            columns: ["source_story_id"]
            isOneToOne: false
            referencedRelation: "discovered_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      legend_features: {
        Row: {
          created_at: string
          draft_id: string | null
          feature_date: string
          headline: string
          hero_image_url: string | null
          id: string
          legend_id: string
          tribute: string
        }
        Insert: {
          created_at?: string
          draft_id?: string | null
          feature_date: string
          headline: string
          hero_image_url?: string | null
          id?: string
          legend_id: string
          tribute: string
        }
        Update: {
          created_at?: string
          draft_id?: string | null
          feature_date?: string
          headline?: string
          hero_image_url?: string | null
          id?: string
          legend_id?: string
          tribute?: string
        }
        Relationships: [
          {
            foreignKeyName: "legend_features_legend_id_fkey"
            columns: ["legend_id"]
            isOneToOne: false
            referencedRelation: "legends"
            referencedColumns: ["id"]
          },
        ]
      }
      legends: {
        Row: {
          active: boolean
          country: string | null
          created_at: string
          era: string | null
          field: string | null
          id: string
          image_url: string | null
          impact: string | null
          name: string
          short_bio: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          country?: string | null
          created_at?: string
          era?: string | null
          field?: string | null
          id?: string
          image_url?: string | null
          impact?: string | null
          name: string
          short_bio?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          country?: string | null
          created_at?: string
          era?: string | null
          field?: string | null
          id?: string
          image_url?: string | null
          impact?: string | null
          name?: string
          short_bio?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      newsroom_settings: {
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scrape_blocklist: {
        Row: {
          created_at: string
          domain: string
          id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      scrape_events: {
        Row: {
          created_at: string
          domain: string
          error: string | null
          id: string
          source_url: string
          status_code: number | null
          success: boolean
        }
        Insert: {
          created_at?: string
          domain: string
          error?: string | null
          id?: string
          source_url: string
          status_code?: number | null
          success?: boolean
        }
        Update: {
          created_at?: string
          domain?: string
          error?: string | null
          id?: string
          source_url?: string
          status_code?: number | null
          success?: boolean
        }
        Relationships: []
      }
      scrape_failures: {
        Row: {
          blocked: boolean
          created_at: string
          domain: string
          fail_count: number
          id: string
          last_error: string | null
          last_failed_at: string | null
          last_status_code: number | null
          last_success_at: string | null
          next_retry_at: string | null
          source_url: string
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          domain: string
          fail_count?: number
          id?: string
          last_error?: string | null
          last_failed_at?: string | null
          last_status_code?: number | null
          last_success_at?: string | null
          next_retry_at?: string | null
          source_url: string
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          domain?: string
          fail_count?: number
          id?: string
          last_error?: string | null
          last_failed_at?: string | null
          last_status_code?: number | null
          last_success_at?: string | null
          next_retry_at?: string | null
          source_url?: string
          updated_at?: string
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
      write_article_attempts: {
        Row: {
          article: Json | null
          attempt: number
          created_at: string
          error: string | null
          finished_at: string | null
          http_code: number | null
          id: string
          idempotency_key: string
          next_retry_at: string | null
          retry_after_ms: number | null
          run_id: string | null
          status: string
          story_id: string | null
          user_id: string | null
        }
        Insert: {
          article?: Json | null
          attempt?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          http_code?: number | null
          id?: string
          idempotency_key: string
          next_retry_at?: string | null
          retry_after_ms?: number | null
          run_id?: string | null
          status?: string
          story_id?: string | null
          user_id?: string | null
        }
        Update: {
          article?: Json | null
          attempt?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          http_code?: number | null
          id?: string
          idempotency_key?: string
          next_retry_at?: string | null
          retry_after_ms?: number | null
          run_id?: string | null
          status?: string
          story_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "writer"
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
      app_role: ["admin", "editor", "writer"],
    },
  },
} as const
