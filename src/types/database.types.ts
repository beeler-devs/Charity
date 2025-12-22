// Database types for Supabase
// This file should ideally be generated from Supabase, but is manually maintained for now

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
      teams: {
        Row: Team
        Insert: TeamInsert
        Update: TeamUpdate
      }
      [key: string]: {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
    }
  }
}

// Team type definition
export interface Team {
  id: string
  name: string
  captain_id: string
  co_captain_id?: string | null
  league_format?: string | null
  season?: string | null
  rating_limit?: number | null
  venue?: string | null
  venue_address?: string | null
  fee_per_team?: number | null
  warmup_policy?: string | null
  created_at?: string
  updated_at?: string
  // New fields from enhanced team creation form
  organization?: 'USTA' | 'CUP' | 'UTR' | null
  league?: string | null
  year?: number | null
  level?: string | null
  flight?: string | null
  division?: string | null
  facility_id?: string | null
  facility_name?: string | null
  total_lines?: number | null
  max_sets_per_line?: number | null
  line_match_types?: string[] | null // JSONB array of match types
}

export type TeamInsert = Omit<Team, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type TeamUpdate = Partial<Omit<Team, 'id' | 'created_at'>> & {
  updated_at?: string
}

// Re-export for convenience
export type { Team as default }


