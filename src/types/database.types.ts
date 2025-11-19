export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          ntrp_rating: number | null
          avatar_url: string | null
          availability_defaults: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone?: string | null
          ntrp_rating?: number | null
          avatar_url?: string | null
          availability_defaults?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          ntrp_rating?: number | null
          avatar_url?: string | null
          availability_defaults?: Json
          created_at?: string
          updated_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          captain_id: string | null
          co_captain_id: string | null
          league_format: 'USTA' | 'CUP' | 'FLEX'
          season: string | null
          rating_limit: number | null
          fee_per_team: number
          venue_address: string | null
          warmup_policy: string | null
          welcome_template_id: string | null
          home_phones: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          captain_id?: string | null
          co_captain_id?: string | null
          league_format?: 'USTA' | 'CUP' | 'FLEX'
          season?: string | null
          rating_limit?: number | null
          fee_per_team?: number
          venue_address?: string | null
          warmup_policy?: string | null
          welcome_template_id?: string | null
          home_phones?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          captain_id?: string | null
          co_captain_id?: string | null
          league_format?: 'USTA' | 'CUP' | 'FLEX'
          season?: string | null
          rating_limit?: number | null
          fee_per_team?: number
          venue_address?: string | null
          warmup_policy?: string | null
          welcome_template_id?: string | null
          home_phones?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      roster_members: {
        Row: {
          id: string
          team_id: string
          user_id: string | null
          email: string | null
          full_name: string
          phone: string | null
          ntrp_rating: number | null
          role: 'captain' | 'co-captain' | 'player'
          fair_play_score: number
          matches_played: number
          wins: number
          availability_defaults: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id?: string | null
          email?: string | null
          full_name: string
          phone?: string | null
          ntrp_rating?: number | null
          role?: 'captain' | 'co-captain' | 'player'
          fair_play_score?: number
          matches_played?: number
          wins?: number
          availability_defaults?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string | null
          email?: string | null
          full_name?: string
          phone?: string | null
          ntrp_rating?: number | null
          role?: 'captain' | 'co-captain' | 'player'
          fair_play_score?: number
          matches_played?: number
          wins?: number
          availability_defaults?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          team_id: string
          date: string
          time: string
          venue: string | null
          venue_address: string | null
          opponent_name: string
          opponent_captain_name: string | null
          opponent_captain_email: string | null
          opponent_captain_phone: string | null
          is_home: boolean
          warm_up_status: 'booked' | 'none_yet' | 'no_warmup'
          warm_up_time: string | null
          warm_up_court: string | null
          checklist_status: Json
          match_result: 'win' | 'loss' | 'tie' | 'pending'
          score_summary: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          date: string
          time: string
          venue?: string | null
          venue_address?: string | null
          opponent_name: string
          opponent_captain_name?: string | null
          opponent_captain_email?: string | null
          opponent_captain_phone?: string | null
          is_home?: boolean
          warm_up_status?: 'booked' | 'none_yet' | 'no_warmup'
          warm_up_time?: string | null
          warm_up_court?: string | null
          checklist_status?: Json
          match_result?: 'win' | 'loss' | 'tie' | 'pending'
          score_summary?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          date?: string
          time?: string
          venue?: string | null
          venue_address?: string | null
          opponent_name?: string
          opponent_captain_name?: string | null
          opponent_captain_email?: string | null
          opponent_captain_phone?: string | null
          is_home?: boolean
          warm_up_status?: 'booked' | 'none_yet' | 'no_warmup'
          warm_up_time?: string | null
          warm_up_court?: string | null
          checklist_status?: Json
          match_result?: 'win' | 'loss' | 'tie' | 'pending'
          score_summary?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      availability: {
        Row: {
          id: string
          roster_member_id: string
          match_id: string
          status: 'available' | 'unavailable' | 'maybe' | 'late'
          comment: string | null
          responded_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          roster_member_id: string
          match_id: string
          status: 'available' | 'unavailable' | 'maybe' | 'late'
          comment?: string | null
          responded_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          roster_member_id?: string
          match_id?: string
          status?: 'available' | 'unavailable' | 'maybe' | 'late'
          comment?: string | null
          responded_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      lineups: {
        Row: {
          id: string
          match_id: string
          court_slot: number
          player1_id: string | null
          player2_id: string | null
          combined_rating: number | null
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          match_id: string
          court_slot: number
          player1_id?: string | null
          player2_id?: string | null
          combined_rating?: number | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          court_slot?: number
          player1_id?: string | null
          player2_id?: string | null
          combined_rating?: number | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      checklist_templates: {
        Row: {
          id: string
          team_id: string | null
          name: string
          items: Json
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id?: string | null
          name: string
          items?: Json
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          name?: string
          items?: Json
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      opponents_db: {
        Row: {
          id: string
          team_id: string
          player_name: string
          ntrp: number | null
          notes: string | null
          tags: string[] | null
          win_percentage: number | null
          games_percentage: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          player_name: string
          ntrp?: number | null
          notes?: string | null
          tags?: string[] | null
          win_percentage?: number | null
          games_percentage?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          player_name?: string
          ntrp?: number | null
          notes?: string | null
          tags?: string[] | null
          win_percentage?: number | null
          games_percentage?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      email_logs: {
        Row: {
          id: string
          match_id: string | null
          team_id: string | null
          type: 'welcome' | 'lineup_playing' | 'lineup_bench' | 'reminder' | 'custom'
          recipient_email: string
          recipient_name: string | null
          subject: string
          body: string
          status: 'sent' | 'failed' | 'pending'
          sent_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          match_id?: string | null
          team_id?: string | null
          type: 'welcome' | 'lineup_playing' | 'lineup_bench' | 'reminder' | 'custom'
          recipient_email: string
          recipient_name?: string | null
          subject: string
          body: string
          status?: 'sent' | 'failed' | 'pending'
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          match_id?: string | null
          team_id?: string | null
          type?: 'welcome' | 'lineup_playing' | 'lineup_bench' | 'reminder' | 'custom'
          recipient_email?: string
          recipient_name?: string | null
          subject?: string
          body?: string
          status?: 'sent' | 'failed' | 'pending'
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
      }
      court_reservations: {
        Row: {
          id: string
          user_id: string
          venue_name: string
          court_number: string | null
          date: string
          start_time: string
          end_time: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          venue_name: string
          court_number?: string | null
          date: string
          start_time: string
          end_time: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          venue_name?: string
          court_number?: string | null
          date?: string
          start_time?: string
          end_time?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      match_scores: {
        Row: {
          id: string
          lineup_id: string
          set_number: number
          home_games: number
          away_games: number
          tiebreak_home: number | null
          tiebreak_away: number | null
          is_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lineup_id: string
          set_number: number
          home_games?: number
          away_games?: number
          tiebreak_home?: number | null
          tiebreak_away?: number | null
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lineup_id?: string
          set_number?: number
          home_games?: number
          away_games?: number
          tiebreak_home?: number | null
          tiebreak_away?: number | null
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      pair_statistics: {
        Row: {
          id: string
          team_id: string
          player1_id: string
          player2_id: string
          matches_together: number
          wins: number
          total_games_won: number
          total_games_played: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          player1_id: string
          player2_id: string
          matches_together?: number
          wins?: number
          total_games_won?: number
          total_games_played?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          player1_id?: string
          player2_id?: string
          matches_together?: number
          wins?: number
          total_games_won?: number
          total_games_played?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type RosterMember = Database['public']['Tables']['roster_members']['Row']
export type Match = Database['public']['Tables']['matches']['Row']
export type Availability = Database['public']['Tables']['availability']['Row']
export type Lineup = Database['public']['Tables']['lineups']['Row']
export type ChecklistTemplate = Database['public']['Tables']['checklist_templates']['Row']
export type OpponentDB = Database['public']['Tables']['opponents_db']['Row']
export type EmailLog = Database['public']['Tables']['email_logs']['Row']
export type CourtReservation = Database['public']['Tables']['court_reservations']['Row']
export type MatchScore = Database['public']['Tables']['match_scores']['Row']
export type PairStatistics = Database['public']['Tables']['pair_statistics']['Row']

// Insert types
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type TeamInsert = Database['public']['Tables']['teams']['Insert']
export type RosterMemberInsert = Database['public']['Tables']['roster_members']['Insert']
export type MatchInsert = Database['public']['Tables']['matches']['Insert']
export type AvailabilityInsert = Database['public']['Tables']['availability']['Insert']
export type LineupInsert = Database['public']['Tables']['lineups']['Insert']

// Update types
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type TeamUpdate = Database['public']['Tables']['teams']['Update']
export type RosterMemberUpdate = Database['public']['Tables']['roster_members']['Update']
export type MatchUpdate = Database['public']['Tables']['matches']['Update']
export type AvailabilityUpdate = Database['public']['Tables']['availability']['Update']
export type LineupUpdate = Database['public']['Tables']['lineups']['Update']
