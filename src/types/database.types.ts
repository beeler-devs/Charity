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

// Personal Event types
export interface PersonalEvent {
  id: string
  creator_id: string
  team_id?: string | null
  activity_type: 'scrimmage' | 'lesson' | 'class' | 'flex_league' | 'booked_court' | 'other'
  title: string
  date: string
  time: string
  duration?: number | null
  location?: string | null
  description?: string | null
  max_attendees?: number | null
  cost?: number | null
  recurrence_series_id?: string | null
  recurrence_original_date?: string | null
  recurrence_pattern?: 'daily' | 'weekly' | 'custom' | null
  recurrence_end_date?: string | null
  recurrence_occurrences?: number | null
  recurrence_custom_data?: {
    interval: number
    timeUnit: 'day' | 'week' | 'month' | 'year'
    selectedDays?: number[] // 0=Sunday, 1=Monday, ..., 6=Saturday (for weekly patterns)
  } | null
  creator_is_organizer?: boolean | null
  created_at?: string
  updated_at?: string
}

export type PersonalEventInsert = Omit<PersonalEvent, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type PersonalEventUpdate = Partial<Omit<PersonalEvent, 'id' | 'created_at'>> & {
  updated_at?: string
}

// Event Invitation types
export interface EventInvitation {
  id: string
  event_id: string
  inviter_id: string
  invitee_id?: string | null
  invitee_email: string
  invitee_name?: string | null
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  message?: string | null
  created_at?: string
  responded_at?: string | null
}

export type EventInvitationInsert = Omit<EventInvitation, 'id' | 'created_at' | 'responded_at'> & {
  id?: string
  created_at?: string
  responded_at?: string | null
}

export type EventInvitationUpdate = Partial<Omit<EventInvitation, 'id' | 'created_at'>> & {
  responded_at?: string | null
}

// Event Attendee types
export interface EventAttendee {
  id: string
  personal_event_id: string
  user_id?: string | null
  email: string
  name?: string | null
  availability_status: 'available' | 'unavailable' | 'maybe' | 'last_resort'
  invited_via?: string | null
  added_via: 'direct' | 'invitation' | 'self'
  created_at?: string
  updated_at?: string
}

export type EventAttendeeInsert = Omit<EventAttendee, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type EventAttendeeUpdate = Partial<Omit<EventAttendee, 'id' | 'created_at'>> & {
  updated_at?: string
}

// Contact types
export interface Contact {
  id: string
  user_id: string
  linked_profile_id?: string | null
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  tags?: string[] | null
  relationship_type?: 'teammate' | 'opponent' | 'coach' | 'facility_staff' | 'other' | null
  source?: 'auto' | 'manual' | 'merged'
  source_team_id?: string | null
  source_roster_member_id?: string | null
  created_at?: string
  updated_at?: string
}

export type ContactInsert = Omit<Contact, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type ContactUpdate = Partial<Omit<Contact, 'id' | 'created_at'>> & {
  updated_at?: string
}

// Re-export for convenience
export type { Team as default }






