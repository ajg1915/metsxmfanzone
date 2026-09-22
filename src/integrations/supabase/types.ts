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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          log_type: string
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          log_type: string
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          log_type?: string
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_login_attempts: {
        Row: {
          attempted_at: string | null
          device_fingerprint: string
          id: string
          ip_address: string | null
          success: boolean | null
        }
        Insert: {
          attempted_at?: string | null
          device_fingerprint: string
          id?: string
          ip_address?: string | null
          success?: boolean | null
        }
        Update: {
          attempted_at?: string | null
          device_fingerprint?: string
          id?: string
          ip_address?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      admin_trusted_devices: {
        Row: {
          created_at: string | null
          device_fingerprint: string
          device_name: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_fingerprint: string
          device_name?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string
          device_name?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_verification_codes: {
        Row: {
          backup_code_hash: string | null
          code_hash: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_code_hash?: string | null
          code_hash: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_code_hash?: string | null
          code_hash?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_image_history: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_url: string
          is_edited: boolean | null
          prompt: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url: string
          is_edited?: boolean | null
          prompt: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          is_edited?: boolean | null
          prompt?: string
        }
        Relationships: []
      }
      background_settings: {
        Row: {
          background_type: string
          background_value: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          page_type: string
          updated_at: string
        }
        Insert: {
          background_type: string
          background_value: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          page_type: string
          updated_at?: string
        }
        Update: {
          background_type?: string
          background_value?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          page_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          blog_post_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blog_post_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blog_post_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          approval_status: string | null
          audio_url: string | null
          category: string
          content: string
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          id: string
          is_draft: boolean
          meta_description: string | null
          published: boolean
          published_at: string | null
          scheduled_publish_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: string | null
          audio_url?: string | null
          category?: string
          content: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_draft?: boolean
          meta_description?: string | null
          published?: boolean
          published_at?: string | null
          scheduled_publish_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: string | null
          audio_url?: string | null
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_draft?: boolean
          meta_description?: string | null
          published?: boolean
          published_at?: string | null
          scheduled_publish_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_views: {
        Row: {
          blog_post_id: string | null
          id: string
          session_id: string | null
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          blog_post_id?: string | null
          id?: string
          session_id?: string | null
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          blog_post_id?: string | null
          id?: string
          session_id?: string | null
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_views_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_views_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      business_ads: {
        Row: {
          ad_description: string
          ad_image_url: string | null
          ad_title: string
          approved_by: string | null
          business_name: string
          contact_email: string
          contact_phone: string | null
          created_at: string
          id: string
          published_at: string | null
          status: string
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          ad_description: string
          ad_image_url?: string | null
          ad_title: string
          approved_by?: string | null
          business_name: string
          contact_email: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          ad_description?: string
          ad_image_url?: string | null
          ad_title?: string
          approved_by?: string | null
          business_name?: string
          contact_email?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      chat_usage: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          status: string | null
          subject: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      daily_player_predictions: {
        Row: {
          bet_amount: string | null
          confidence: number | null
          created_at: string
          description: string
          id: string
          is_pitcher: boolean | null
          payout: string | null
          player_id: number | null
          player_image_url: string | null
          player_name: string
          predicted_hr: number | null
          predicted_hr_allowed: number | null
          predicted_innings_pitched: number | null
          predicted_rbis: number | null
          predicted_runs: number | null
          predicted_saves: number | null
          predicted_sb: number | null
          predicted_strikeouts: number | null
          predicted_walks: number | null
          predicted_walks_allowed: number | null
          predicted_win_loss: string | null
          prediction_date: string
          status: string
          updated_at: string
        }
        Insert: {
          bet_amount?: string | null
          confidence?: number | null
          created_at?: string
          description: string
          id?: string
          is_pitcher?: boolean | null
          payout?: string | null
          player_id?: number | null
          player_image_url?: string | null
          player_name: string
          predicted_hr?: number | null
          predicted_hr_allowed?: number | null
          predicted_innings_pitched?: number | null
          predicted_rbis?: number | null
          predicted_runs?: number | null
          predicted_saves?: number | null
          predicted_sb?: number | null
          predicted_strikeouts?: number | null
          predicted_walks?: number | null
          predicted_walks_allowed?: number | null
          predicted_win_loss?: string | null
          prediction_date?: string
          status: string
          updated_at?: string
        }
        Update: {
          bet_amount?: string | null
          confidence?: number | null
          created_at?: string
          description?: string
          id?: string
          is_pitcher?: boolean | null
          payout?: string | null
          player_id?: number | null
          player_image_url?: string | null
          player_name?: string
          predicted_hr?: number | null
          predicted_hr_allowed?: number | null
          predicted_innings_pitched?: number | null
          predicted_rbis?: number | null
          predicted_runs?: number | null
          predicted_saves?: number | null
          predicted_sb?: number | null
          predicted_strikeouts?: number | null
          predicted_walks?: number | null
          predicted_walks_allowed?: number | null
          predicted_win_loss?: string | null
          prediction_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_confirmation_tokens: {
        Row: {
          confirmed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string
          email_from: string | null
          email_id: string | null
          email_to: string | null
          event_data: Json | null
          event_type: string
          id: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email_from?: string | null
          email_id?: string | null
          email_to?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email_from?: string | null
          email_id?: string | null
          email_to?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          subject?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_template_settings: {
        Row: {
          body_bg_color: string
          button_border_radius: string
          card_bg_color: string
          footer_text: string
          heading_color: string
          id: number
          logo_url: string
          logo_width: number
          primary_color: string
          text_color: string
          updated_at: string
        }
        Insert: {
          body_bg_color?: string
          button_border_radius?: string
          card_bg_color?: string
          footer_text?: string
          heading_color?: string
          id?: number
          logo_url?: string
          logo_width?: number
          primary_color?: string
          text_color?: string
          updated_at?: string
        }
        Update: {
          body_bg_color?: string
          button_border_radius?: string
          card_bg_color?: string
          footer_text?: string
          heading_color?: string
          id?: number
          logo_url?: string
          logo_width?: number
          primary_color?: string
          text_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string | null
          description: string | null
          event_date: string
          external_link: string | null
          id: string
          image_url: string | null
          location: string | null
          published: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_date: string
          external_link?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          published?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_date?: string
          external_link?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          published?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fcm_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          content: string
          created_at: string
          display_name: string | null
          id: string
          location: string | null
          rating: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          display_name?: string | null
          id?: string
          location?: string | null
          rating?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          display_name?: string | null
          id?: string
          location?: string | null
          rating?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      game_alerts: {
        Row: {
          alert_sound: string | null
          alert_type: string
          created_at: string
          created_by: string | null
          email_sent: boolean
          expires_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          message: string
          push_sent: boolean
          severity: string
          title: string
        }
        Insert: {
          alert_sound?: string | null
          alert_type?: string
          created_at?: string
          created_by?: string | null
          email_sent?: boolean
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          message: string
          push_sent?: boolean
          severity?: string
          title: string
        }
        Update: {
          alert_sound?: string | null
          alert_type?: string
          created_at?: string
          created_by?: string | null
          email_sent?: boolean
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          message?: string
          push_sent?: boolean
          severity?: string
          title?: string
        }
        Relationships: []
      }
      game_recaps: {
        Row: {
          author_id: string | null
          body: string | null
          created_at: string
          game_date: string | null
          hero_image_url: string | null
          highlights: Json | null
          home_away: string | null
          id: string
          mets_score: number | null
          opponent: string | null
          opponent_score: number | null
          published_at: string | null
          result: string | null
          slug: string
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          game_date?: string | null
          hero_image_url?: string | null
          highlights?: Json | null
          home_away?: string | null
          id?: string
          mets_score?: number | null
          opponent?: string | null
          opponent_score?: number | null
          published_at?: string | null
          result?: string | null
          slug: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          game_date?: string | null
          hero_image_url?: string | null
          highlights?: Json | null
          home_away?: string | null
          id?: string
          mets_score?: number | null
          opponent?: string | null
          opponent_score?: number | null
          published_at?: string | null
          result?: string | null
          slug?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      gamecast_archives: {
        Row: {
          boxscore: Json | null
          created_at: string
          decisions: Json | null
          game_date: string
          game_pk: number
          home_away: string
          id: string
          linescore: Json | null
          losing_pitcher: string | null
          mets_score: number | null
          opponent: string
          opponent_score: number | null
          plays: Json
          recap_generated: boolean
          recap_id: string | null
          result: string | null
          save_pitcher: string | null
          status: string | null
          updated_at: string
          venue: string | null
          winning_pitcher: string | null
        }
        Insert: {
          boxscore?: Json | null
          created_at?: string
          decisions?: Json | null
          game_date: string
          game_pk: number
          home_away: string
          id?: string
          linescore?: Json | null
          losing_pitcher?: string | null
          mets_score?: number | null
          opponent: string
          opponent_score?: number | null
          plays?: Json
          recap_generated?: boolean
          recap_id?: string | null
          result?: string | null
          save_pitcher?: string | null
          status?: string | null
          updated_at?: string
          venue?: string | null
          winning_pitcher?: string | null
        }
        Update: {
          boxscore?: Json | null
          created_at?: string
          decisions?: Json | null
          game_date?: string
          game_pk?: number
          home_away?: string
          id?: string
          linescore?: Json | null
          losing_pitcher?: string | null
          mets_score?: number | null
          opponent?: string
          opponent_score?: number | null
          plays?: Json
          recap_generated?: boolean
          recap_id?: string | null
          result?: string | null
          save_pitcher?: string | null
          status?: string | null
          updated_at?: string
          venue?: string | null
          winning_pitcher?: string | null
        }
        Relationships: []
      }
      gameday_announcements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          message: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      gameday_chat: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      gameday_email_settings: {
        Row: {
          enabled: boolean
          trigger_type: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          trigger_type: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      gameday_leaderboard: {
        Row: {
          correct_predictions: number
          id: string
          total_points: number
          total_predictions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_predictions?: number
          id?: string
          total_points?: number
          total_predictions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_predictions?: number
          id?: string
          total_points?: number
          total_predictions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gameday_poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gameday_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "gameday_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      gameday_polls: {
        Row: {
          correct_option_index: number | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          is_resolved: boolean
          options: Json
          points: number
          poll_type: string
          question: string
          updated_at: string
        }
        Insert: {
          correct_option_index?: number | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_resolved?: boolean
          options?: Json
          points?: number
          poll_type?: string
          question: string
          updated_at?: string
        }
        Update: {
          correct_option_index?: number | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_resolved?: boolean
          options?: Json
          points?: number
          poll_type?: string
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      gameday_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      gameday_voice_rooms: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_user_id: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          livekit_room_name: string
          max_participants: number
          name: string
          rejection_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          livekit_room_name: string
          max_participants?: number
          name: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          livekit_room_name?: string
          max_participants?: number
          name?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hero_slides: {
        Row: {
          ai_source_id: string | null
          ai_source_type: string | null
          blog_post_id: string | null
          created_at: string
          description: string
          display_order: number | null
          id: string
          image_url: string | null
          is_ai_generated: boolean | null
          is_for_members: boolean | null
          link_text: string | null
          link_url: string | null
          published: boolean | null
          show_reminder: boolean | null
          show_watch_live: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_source_id?: string | null
          ai_source_type?: string | null
          blog_post_id?: string | null
          created_at?: string
          description: string
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_ai_generated?: boolean | null
          is_for_members?: boolean | null
          link_text?: string | null
          link_url?: string | null
          published?: boolean | null
          show_reminder?: boolean | null
          show_watch_live?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_source_id?: string | null
          ai_source_type?: string | null
          blog_post_id?: string | null
          created_at?: string
          description?: string
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_ai_generated?: boolean | null
          is_for_members?: boolean | null
          link_text?: string | null
          link_url?: string | null
          published?: boolean | null
          show_reminder?: boolean | null
          show_watch_live?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hero_slides_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_slides_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      lineup_cards: {
        Row: {
          created_at: string
          game_date: string
          game_time: string
          id: string
          lineup_data: Json
          location: string | null
          notes: string | null
          opponent: string
          published: boolean
          starting_pitcher: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_date: string
          game_time: string
          id?: string
          lineup_data?: Json
          location?: string | null
          notes?: string | null
          opponent: string
          published?: boolean
          starting_pitcher?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_date?: string
          game_time?: string
          id?: string
          lineup_data?: Json
          location?: string | null
          notes?: string | null
          opponent?: string
          published?: boolean
          starting_pitcher?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      live_notifications: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          link_url: string
          message: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          link_url?: string
          message: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          link_url?: string
          message?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_stream_admin_updates: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          live_stream_id: string
          topics: string[] | null
          updated_at: string
          welcome_message: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          live_stream_id: string
          topics?: string[] | null
          updated_at?: string
          welcome_message: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          live_stream_id?: string
          topics?: string[] | null
          updated_at?: string
          welcome_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_admin_updates_live_stream_id_fkey"
            columns: ["live_stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_admin_updates_live_stream_id_fkey"
            columns: ["live_stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_chat: {
        Row: {
          content: string
          created_at: string
          id: string
          stream_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          stream_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: []
      }
      live_streams: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          assigned_pages: string[] | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          published: boolean
          scheduled_end: string | null
          scheduled_start: string | null
          status: string
          stream_url: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          viewers_count: number | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          assigned_pages?: string[] | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          published?: boolean
          scheduled_end?: string | null
          scheduled_start?: string | null
          status: string
          stream_url: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          viewers_count?: number | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          assigned_pages?: string[] | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          published?: boolean
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          stream_url?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          viewers_count?: number | null
        }
        Relationships: []
      }
      loyalty_rewards: {
        Row: {
          admin_notes: string | null
          carrier: string | null
          claim_token: string
          claimed_at: string | null
          created_at: string
          eligibility_start_date: string | null
          email_sent_at: string | null
          id: string
          opted_out_at: string | null
          phone: string | null
          reward_type: string
          shipped_at: string | null
          shipping_address1: string | null
          shipping_address2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_name: string | null
          shipping_state: string | null
          shipping_zip: string | null
          shirt_size: string | null
          status: string
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          carrier?: string | null
          claim_token?: string
          claimed_at?: string | null
          created_at?: string
          eligibility_start_date?: string | null
          email_sent_at?: string | null
          id?: string
          opted_out_at?: string | null
          phone?: string | null
          reward_type?: string
          shipped_at?: string | null
          shipping_address1?: string | null
          shipping_address2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_name?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          shirt_size?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          carrier?: string | null
          claim_token?: string
          claimed_at?: string | null
          created_at?: string
          eligibility_start_date?: string | null
          email_sent_at?: string | null
          id?: string
          opted_out_at?: string | null
          phone?: string | null
          reward_type?: string
          shipped_at?: string | null
          shipping_address1?: string | null
          shipping_address2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_name?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          shirt_size?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      media_library: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          folder: string | null
          id: string
          tags: string[] | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          folder?: string | null
          id?: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          folder?: string | null
          id?: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      mercari_listings: {
        Row: {
          category: string | null
          condition: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_sold: boolean | null
          mercari_url: string
          price: number
          published: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          condition?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_sold?: boolean | null
          mercari_url: string
          price: number
          published?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          condition?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_sold?: boolean | null
          mercari_url?: string
          price?: number
          published?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      mets_news_tracker: {
        Row: {
          created_at: string
          details: string
          id: string
          image_url: string
          player: string
          published: boolean
          time_ago: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details: string
          id?: string
          image_url: string
          player: string
          published?: boolean
          time_ago?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          image_url?: string
          player?: string
          published?: boolean
          time_ago?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          subscribed_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          subscribed_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          subscribed_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean | null
          id: string
          notification_type: string
          push_enabled: boolean | null
          sms_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean | null
          id?: string
          notification_type: string
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean | null
          id?: string
          notification_type?: string
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_csrf_tokens: {
        Row: {
          created_at: string
          expires_at: string
          platform: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          platform: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          platform?: string
          redirect_uri?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      player_of_the_month: {
        Row: {
          admin_opinion: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          month: string
          player_image_url: string | null
          player_name: string
          updated_at: string
          year: number
        }
        Insert: {
          admin_opinion: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          month: string
          player_image_url?: string | null
          player_name: string
          updated_at?: string
          year?: number
        }
        Update: {
          admin_opinion?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          month?: string
          player_image_url?: string | null
          player_name?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      player_of_the_month_votes: {
        Row: {
          created_at: string
          id: string
          player_of_the_month_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_of_the_month_id: string
          user_id: string
          vote_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          player_of_the_month_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_of_the_month_votes_player_of_the_month_id_fkey"
            columns: ["player_of_the_month_id"]
            isOneToOne: false
            referencedRelation: "player_of_the_month"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_live_stream: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_live: boolean
          title: string
          updated_at: string
          vdo_ninja_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_live?: boolean
          title?: string
          updated_at?: string
          vdo_ninja_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_live?: boolean
          title?: string
          updated_at?: string
          vdo_ninja_url?: string | null
        }
        Relationships: []
      }
      podcast_outline_templates: {
        Row: {
          author_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          name: string
          notes: string | null
          segments: Json
          show_type: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name: string
          notes?: string | null
          segments?: Json
          show_type?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name?: string
          notes?: string | null
          segments?: Json
          show_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      podcast_shows: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_featured: boolean | null
          is_live: boolean | null
          published: boolean | null
          show_date: string
          show_type: string
          thumbnail_colors: Json | null
          thumbnail_gradient: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean | null
          is_live?: boolean | null
          published?: boolean | null
          show_date: string
          show_type?: string
          thumbnail_colors?: Json | null
          thumbnail_gradient?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean | null
          is_live?: boolean | null
          published?: boolean | null
          show_date?: string
          show_type?: string
          thumbnail_colors?: Json | null
          thumbnail_gradient?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      podcaster_applications: {
        Row: {
          admin_notes: string | null
          availability: string | null
          created_at: string
          email: string
          equipment_description: string | null
          experience: string | null
          full_name: string
          id: string
          phone: string | null
          podcast_topic: string
          reviewed_at: string | null
          reviewed_by: string | null
          sample_url: string | null
          social_links: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          availability?: string | null
          created_at?: string
          email: string
          equipment_description?: string | null
          experience?: string | null
          full_name: string
          id?: string
          phone?: string | null
          podcast_topic: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_url?: string | null
          social_links?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          availability?: string | null
          created_at?: string
          email?: string
          equipment_description?: string | null
          experience?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          podcast_topic?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_url?: string | null
          social_links?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      podcasts: {
        Row: {
          audio_url: string
          created_at: string
          description: string | null
          duration: number | null
          id: string
          published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audio_url: string
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audio_url?: string
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      poll_vote_counts: {
        Row: {
          option_index: number
          poll_id: string
          updated_at: string
          vote_count: number
        }
        Insert: {
          option_index: number
          poll_id: string
          updated_at?: string
          vote_count?: number
        }
        Update: {
          option_index?: number
          poll_id?: string
          updated_at?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_vote_counts_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          options: Json
          question: string
          show_as_toast: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          options?: Json
          question: string
          show_as_toast?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          options?: Json
          question?: string
          show_as_toast?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      popup_notifications: {
        Row: {
          button_text: string | null
          button_url: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          is_active: boolean
          message: string
          show_once_per_session: boolean
          title: string
          updated_at: string
        }
        Insert: {
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          message: string
          show_once_per_session?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          message?: string
          show_once_per_session?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          image_url: string | null
          is_pinned: boolean | null
          pinned_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_pinned?: boolean | null
          pinned_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_pinned?: boolean | null
          pinned_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          email_notifications_enabled: boolean | null
          email_verified: boolean | null
          full_name: string | null
          game_notifications_enabled: boolean | null
          id: string
          phone_number: string | null
          sms_notifications_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          email_notifications_enabled?: boolean | null
          email_verified?: boolean | null
          full_name?: string | null
          game_notifications_enabled?: boolean | null
          id: string
          phone_number?: string | null
          sms_notifications_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          email_notifications_enabled?: boolean | null
          email_verified?: boolean | null
          full_name?: string | null
          game_notifications_enabled?: boolean | null
          id?: string
          phone_number?: string | null
          sms_notifications_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      radio_scheduled_shows: {
        Row: {
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          host_name: string
          id: string
          is_live: boolean
          published: boolean
          scheduled_start: string
          stream_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          host_name: string
          id?: string
          is_live?: boolean
          published?: boolean
          scheduled_start: string
          stream_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          host_name?: string
          id?: string
          is_live?: boolean
          published?: boolean
          scheduled_start?: string
          stream_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      realtime_presence: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          current_page: string
          device_type: string | null
          entry_page: string | null
          id: string
          is_authenticated: boolean | null
          last_seen_at: string
          page_type: string | null
          referrer_source: string | null
          referrer_url: string | null
          region: string | null
          session_id: string
          stream_title: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          current_page: string
          device_type?: string | null
          entry_page?: string | null
          id?: string
          is_authenticated?: boolean | null
          last_seen_at?: string
          page_type?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          session_id: string
          stream_title?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          current_page?: string
          device_type?: string | null
          entry_page?: string | null
          id?: string
          is_authenticated?: boolean | null
          last_seen_at?: string
          page_type?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          session_id?: string
          stream_title?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      replay_games: {
        Row: {
          created_at: string
          description: string | null
          embed_url: string
          game_date: string | null
          id: string
          source_url: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          embed_url: string
          game_date?: string | null
          id?: string
          source_url?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          embed_url?: string
          game_date?: string | null
          id?: string
          source_url?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      review_request_emails: {
        Row: {
          created_at: string
          id: string
          sent_at: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sent_at?: string
          subscription_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sent_at?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: []
      }
      seo_settings: {
        Row: {
          canonical_url: string | null
          created_at: string
          description: string
          id: string
          keywords: string | null
          og_description: string | null
          og_image: string | null
          og_title: string | null
          page_name: string
          page_path: string
          robots: string | null
          title: string
          twitter_card: string | null
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          description: string
          id?: string
          keywords?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          page_name: string
          page_path: string
          robots?: string | null
          title: string
          twitter_card?: string | null
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          description?: string
          id?: string
          keywords?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          page_name?: string
          page_path?: string
          robots?: string | null
          title?: string
          twitter_card?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shop_orders: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string
          id: string
          notes: string | null
          paypal_capture_id: string | null
          paypal_order_id: string | null
          product_id: string | null
          quantity: number
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_state: string | null
          shipping_zip: string | null
          status: string
          total_amount: number
          unit_price: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name: string
          id?: string
          notes?: string | null
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          product_id?: string | null
          quantity?: number
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          status?: string
          total_amount: number
          unit_price: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          id?: string
          notes?: string | null
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          product_id?: string | null
          quantity?: number
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          status?: string
          total_amount?: number
          unit_price?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          category: string | null
          compare_at_price: number | null
          condition: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          image_urls: string[] | null
          price: number
          published: boolean | null
          requires_shipping: boolean | null
          stock_quantity: number | null
          title: string
          updated_at: string
          weight_oz: number | null
        }
        Insert: {
          category?: string | null
          compare_at_price?: number | null
          condition?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          price: number
          published?: boolean | null
          requires_shipping?: boolean | null
          stock_quantity?: number | null
          title: string
          updated_at?: string
          weight_oz?: number | null
        }
        Update: {
          category?: string | null
          compare_at_price?: number | null
          condition?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          price?: number
          published?: boolean | null
          requires_shipping?: boolean | null
          stock_quantity?: number | null
          title?: string
          updated_at?: string
          weight_oz?: number | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          setting_key: string
          setting_type: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          setting_key: string
          setting_type?: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          setting_key?: string
          setting_type?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      social_media_connections: {
        Row: {
          access_token: string
          account_username: string | null
          connected_at: string
          created_at: string
          expires_at: string | null
          id: string
          page_id: string | null
          page_name: string | null
          platform: string
          refresh_token: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_username?: string | null
          connected_at?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          page_id?: string | null
          page_name?: string | null
          platform: string
          refresh_token?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_username?: string | null
          connected_at?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          page_id?: string | null
          page_name?: string | null
          platform?: string
          refresh_token?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_media_posts: {
        Row: {
          caption: string | null
          created_at: string
          error_message: string | null
          external_post_id: string | null
          external_post_url: string | null
          id: string
          platform: string
          posted_at: string | null
          status: string
          story_id: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          id?: string
          platform: string
          posted_at?: string | null
          status?: string
          story_id?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          id?: string
          platform?: string
          posted_at?: string | null
          status?: string
          story_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_posts_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      spring_training_games: {
        Row: {
          away_team: string | null
          created_at: string | null
          display_order: number | null
          game_date: string
          game_status: string | null
          game_time: string | null
          home_team: string | null
          id: string
          is_auto_generated: boolean | null
          is_home_game: boolean | null
          last_synced_at: string | null
          location: string | null
          mlb_game_pk: number | null
          opponent: string
          preview_image_url: string
          published: boolean | null
          updated_at: string | null
        }
        Insert: {
          away_team?: string | null
          created_at?: string | null
          display_order?: number | null
          game_date: string
          game_status?: string | null
          game_time?: string | null
          home_team?: string | null
          id?: string
          is_auto_generated?: boolean | null
          is_home_game?: boolean | null
          last_synced_at?: string | null
          location?: string | null
          mlb_game_pk?: number | null
          opponent: string
          preview_image_url: string
          published?: boolean | null
          updated_at?: string | null
        }
        Update: {
          away_team?: string | null
          created_at?: string | null
          display_order?: number | null
          game_date?: string
          game_status?: string | null
          game_time?: string | null
          home_team?: string | null
          id?: string
          is_auto_generated?: boolean | null
          is_home_game?: boolean | null
          last_synced_at?: string | null
          location?: string | null
          mlb_game_pk?: number | null
          opponent?: string
          preview_image_url?: string
          published?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stories: {
        Row: {
          blog_post_id: string | null
          created_at: string
          display_order: number | null
          duration: number | null
          id: string
          link_url: string | null
          media_type: string
          media_url: string | null
          published: boolean
          text_bg_style: string | null
          text_content: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          blog_post_id?: string | null
          created_at?: string
          display_order?: number | null
          duration?: number | null
          id?: string
          link_url?: string | null
          media_type: string
          media_url?: string | null
          published?: boolean
          text_bg_style?: string | null
          text_content?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          blog_post_id?: string | null
          created_at?: string
          display_order?: number | null
          duration?: number | null
          id?: string
          link_url?: string | null
          media_type?: string
          media_url?: string | null
          published?: boolean
          text_bg_style?: string | null
          text_content?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      story_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          story_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          story_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          story_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_likes: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_alerts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          message: string
          stream_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          message: string
          stream_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          message?: string
          stream_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_alerts_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_alerts_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_health_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          issue_type: string
          resolved: boolean | null
          resolved_at: string | null
          session_id: string | null
          severity: string
          stream_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          issue_type: string
          resolved?: boolean | null
          resolved_at?: string | null
          session_id?: string | null
          severity?: string
          stream_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          issue_type?: string
          resolved?: boolean | null
          resolved_at?: string | null
          session_id?: string | null
          severity?: string
          stream_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stream_health_reports_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_health_reports_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_source_status: {
        Row: {
          checked_at: string
          consecutive_failures: number
          created_at: string
          id: string
          is_up: boolean
          label: string
          last_down_at: string | null
          last_error: string | null
          last_ok_at: string | null
          source_key: string
          status_code: number | null
          updated_at: string
          url: string
        }
        Insert: {
          checked_at?: string
          consecutive_failures?: number
          created_at?: string
          id?: string
          is_up?: boolean
          label: string
          last_down_at?: string | null
          last_error?: string | null
          last_ok_at?: string | null
          source_key: string
          status_code?: number | null
          updated_at?: string
          url: string
        }
        Update: {
          checked_at?: string
          consecutive_failures?: number
          created_at?: string
          id?: string
          is_up?: boolean
          label?: string
          last_down_at?: string | null
          last_error?: string | null
          last_ok_at?: string | null
          source_key?: string
          status_code?: number | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      stream_views: {
        Row: {
          id: string
          session_id: string | null
          stream_id: string | null
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          session_id?: string | null
          stream_id?: string | null
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          session_id?: string | null
          stream_id?: string | null
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_views_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_views_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_activity: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          performed_by: string | null
          subscription_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string | null
          subscription_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string | null
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_activity_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_notifications: {
        Row: {
          created_at: string
          email_sent_to: string
          id: string
          notification_type: string
          sent_at: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_sent_to: string
          id?: string
          notification_type: string
          sent_at?: string
          subscription_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_sent_to?: string
          id?: string
          notification_type?: string
          sent_at?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_notifications_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          recorded_by: string | null
          status: string
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          recorded_by?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          recorded_by?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number | null
          cancellation_requested_at: string | null
          cancellation_status: string | null
          cancelled_at: string | null
          created_at: string | null
          currency: string | null
          end_date: string | null
          id: string
          last_payment_amount: number | null
          last_payment_date: string | null
          next_payment_amount: number | null
          next_payment_date: string | null
          notes: string | null
          payment_method: string | null
          paypal_order_id: string | null
          paypal_plan_id: string | null
          paypal_subscription_id: string | null
          plan_type: string
          start_date: string | null
          status: string
          total_payments_received: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          cancellation_requested_at?: string | null
          cancellation_status?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          end_date?: string | null
          id?: string
          last_payment_amount?: number | null
          last_payment_date?: string | null
          next_payment_amount?: number | null
          next_payment_date?: string | null
          notes?: string | null
          payment_method?: string | null
          paypal_order_id?: string | null
          paypal_plan_id?: string | null
          paypal_subscription_id?: string | null
          plan_type: string
          start_date?: string | null
          status?: string
          total_payments_received?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          cancellation_requested_at?: string | null
          cancellation_status?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          end_date?: string | null
          id?: string
          last_payment_amount?: number | null
          last_payment_date?: string | null
          next_payment_amount?: number | null
          next_payment_date?: string | null
          notes?: string | null
          payment_method?: string | null
          paypal_order_id?: string | null
          paypal_plan_id?: string | null
          paypal_subscription_id?: string | null
          plan_type?: string
          start_date?: string | null
          status?: string
          total_payments_received?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      sweepstakes_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          id: string
          is_active: boolean
          max_spins_per_user: number
          name: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          id?: string
          is_active?: boolean
          max_spins_per_user?: number
          name: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          id?: string
          is_active?: boolean
          max_spins_per_user?: number
          name?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      sweepstakes_prizes: {
        Row: {
          color: string | null
          content_url: string | null
          created_at: string
          description: string | null
          event_id: string
          icon: string | null
          id: string
          is_grand_prize: boolean
          name: string
          odds_weight: number
          prize_type: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          content_url?: string | null
          created_at?: string
          description?: string | null
          event_id: string
          icon?: string | null
          id?: string
          is_grand_prize?: boolean
          name: string
          odds_weight?: number
          prize_type?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          content_url?: string | null
          created_at?: string
          description?: string | null
          event_id?: string
          icon?: string | null
          id?: string
          is_grand_prize?: boolean
          name?: string
          odds_weight?: number
          prize_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sweepstakes_prizes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sweepstakes_events"
            referencedColumns: ["id"]
          },
        ]
      }
      sweepstakes_winners: {
        Row: {
          claimed: boolean
          claimed_at: string | null
          event_id: string
          id: string
          prize_id: string
          user_id: string
          won_at: string
        }
        Insert: {
          claimed?: boolean
          claimed_at?: string | null
          event_id: string
          id?: string
          prize_id: string
          user_id: string
          won_at?: string
        }
        Update: {
          claimed?: boolean
          claimed_at?: string | null
          event_id?: string
          id?: string
          prize_id?: string
          user_id?: string
          won_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sweepstakes_winners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sweepstakes_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sweepstakes_winners_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "sweepstakes_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      team_leaders: {
        Row: {
          category: string
          created_at: string
          id: string
          player_name: string
          stat_value: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          player_name: string
          stat_value: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          player_name?: string
          stat_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_standings: {
        Row: {
          created_at: string
          division: string
          games_back: string
          id: string
          losses: number
          position: number
          team_name: string
          updated_at: string
          wins: number
        }
        Insert: {
          created_at?: string
          division?: string
          games_back?: string
          id?: string
          losses?: number
          position?: number
          team_name: string
          updated_at?: string
          wins?: number
        }
        Update: {
          created_at?: string
          division?: string
          games_back?: string
          id?: string
          losses?: number
          position?: number
          team_name?: string
          updated_at?: string
          wins?: number
        }
        Relationships: []
      }
      tiktok_live_status: {
        Row: {
          id: number
          is_live: boolean
          stream_title: string | null
          tiktok_username: string
          updated_at: string
          updated_by: string | null
          went_live_at: string | null
        }
        Insert: {
          id?: number
          is_live?: boolean
          stream_title?: string | null
          tiktok_username?: string
          updated_at?: string
          updated_by?: string | null
          went_live_at?: string | null
        }
        Update: {
          id?: number
          is_live?: boolean
          stream_title?: string | null
          tiktok_username?: string
          updated_at?: string
          updated_by?: string | null
          went_live_at?: string | null
        }
        Relationships: []
      }
      toast_prompts: {
        Row: {
          created_at: string
          description: string
          display_order: number | null
          id: string
          is_active: boolean
          location: string
          name: string
          title: string
          trigger_condition: string | null
          trigger_type: string
          updated_at: string
          variant: string
        }
        Insert: {
          created_at?: string
          description: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          location?: string
          name: string
          title: string
          trigger_condition?: string | null
          trigger_type?: string
          updated_at?: string
          variant?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          location?: string
          name?: string
          title?: string
          trigger_condition?: string | null
          trigger_type?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      tutorial_steps: {
        Row: {
          created_at: string
          description: string
          id: string
          image_url: string | null
          is_active: boolean
          step_number: number
          target_selector: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          step_number: number
          target_selector?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          step_number?: number
          target_selector?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tv_schedules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_live: boolean | null
          network: string
          show_title: string
          time_slot: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_live?: boolean | null
          network: string
          show_title: string
          time_slot: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_live?: boolean | null
          network?: string
          show_title?: string
          time_slot?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_passkeys: {
        Row: {
          counter: number
          created_at: string | null
          credential_id: string
          device_name: string | null
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[] | null
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string | null
          credential_id: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[] | null
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string | null
          credential_id?: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_meta_tags: {
        Row: {
          attribute_type: string
          attribute_value: string
          content: string
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          attribute_type?: string
          attribute_value: string
          content: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          attribute_type?: string
          attribute_value?: string
          content?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          duration: number | null
          id: string
          published: boolean
          published_at: string | null
          thumbnail_gif_url: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_type: string
          video_url: string
          views: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          published?: boolean
          published_at?: string | null
          thumbnail_gif_url?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_type: string
          video_url: string
          views?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          published?: boolean
          published_at?: string | null
          thumbnail_gif_url?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_type?: string
          video_url?: string
          views?: number | null
        }
        Relationships: []
      }
      visitor_clicks: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          element_href: string | null
          element_label: string | null
          element_type: string | null
          id: string
          page_path: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          element_href?: string | null
          element_label?: string | null
          element_type?: string | null
          id?: string
          page_path: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          element_href?: string | null
          element_label?: string | null
          element_type?: string | null
          id?: string
          page_path?: string
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string
          type: string
          user_id: string | null
        }
        Insert: {
          challenge: string
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          type: string
          user_id?: string | null
        }
        Update: {
          challenge?: string
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      writer_applications: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          portfolio_url: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          portfolio_url?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          portfolio_url?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      blogs: {
        Row: {
          approval_status: string | null
          audio_url: string | null
          category: string | null
          content: string | null
          created_at: string | null
          excerpt: string | null
          featured_image_url: string | null
          id: string | null
          is_draft: boolean | null
          meta_description: string | null
          published: boolean | null
          published_at: string | null
          scheduled_publish_at: string | null
          slug: string | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          approval_status?: string | null
          audio_url?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string | null
          is_draft?: boolean | null
          meta_description?: string | null
          published?: boolean | null
          published_at?: string | null
          scheduled_publish_at?: string | null
          slug?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          approval_status?: string | null
          audio_url?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string | null
          is_draft?: boolean | null
          meta_description?: string | null
          published?: boolean | null
          published_at?: string | null
          scheduled_publish_at?: string | null
          slug?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_ads_public: {
        Row: {
          ad_description: string | null
          ad_image_url: string | null
          ad_title: string | null
          business_name: string | null
          created_at: string | null
          id: string | null
          published_at: string | null
          status: string | null
          website_url: string | null
        }
        Insert: {
          ad_description?: string | null
          ad_image_url?: string | null
          ad_title?: string | null
          business_name?: string | null
          created_at?: string | null
          id?: string | null
          published_at?: string | null
          status?: string | null
          website_url?: string | null
        }
        Update: {
          ad_description?: string | null
          ad_image_url?: string | null
          ad_title?: string | null
          business_name?: string | null
          created_at?: string | null
          id?: string | null
          published_at?: string | null
          status?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      feedbacks_public: {
        Row: {
          content: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          location: string | null
          rating: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          location?: string | null
          rating?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          location?: string | null
          rating?: number | null
        }
        Relationships: []
      }
      live_streams_public: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          assigned_pages: string[] | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string | null
          published: boolean | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string | null
          viewers_count: number | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          assigned_pages?: string[] | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string | null
          published?: boolean | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          viewers_count?: number | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          assigned_pages?: string[] | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string | null
          published?: boolean | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          viewers_count?: number | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_stale_presence: { Args: never; Returns: undefined }
      get_potm_vote_counts: {
        Args: { p_player_of_the_month_id: string }
        Returns: {
          vote_count: number
          vote_type: string
        }[]
      }
      get_user_subscription_safe: {
        Args: { p_user_id: string }
        Returns: {
          amount: number
          created_at: string
          currency: string
          end_date: string
          id: string
          paypal_order_id_masked: string
          paypal_subscription_id_masked: string
          plan_type: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }[]
      }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_gameday_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_writer: { Args: { _user_id: string }; Returns: boolean }
      search_members: {
        Args: { q: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          is_admin: boolean
        }[]
      }
      trigger_daily_predictions: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "writer"
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
    Enums: {
      app_role: ["admin", "moderator", "user", "writer"],
    },
  },
} as const
