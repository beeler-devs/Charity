# TennisLife Technical Specification

**Version:** 1.0  
**Last Updated:** January 2025  
**Purpose:** Complete technical documentation for rebuilding the TennisLife application from scratch

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Component Architecture](#component-architecture)
5. [Business Logic & Algorithms](#business-logic--algorithms)
6. [Authentication & Authorization](#authentication--authorization)
7. [State Management](#state-management)
8. [Real-time Features](#real-time-features)
9. [Email Service Integration](#email-service-integration)
10. [File Structure](#file-structure)
11. [Configuration & Environment](#configuration--environment)
12. [Data Models & Types](#data-models--types)
13. [UI/UX Patterns](#uiux-patterns)
14. [Workflows & User Journeys](#workflows--user-journeys)
15. [Error Handling](#error-handling)
16. [Performance Optimizations](#performance-optimizations)

---

## System Architecture

### Technology Stack

**Frontend:**
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Icons:** Lucide React
- **Date Handling:** date-fns
- **Drag & Drop:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- **State Management:** React Hooks (useState, useEffect, useMemo, useCallback)
- **Form Handling:** Native HTML forms with controlled components
- **Routing:** Next.js App Router with file-based routing

**Backend:**
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Real-time:** Supabase Realtime subscriptions
- **Storage:** Supabase Storage (future)
- **Edge Functions:** Supabase Edge Functions (Deno)

**Services:**
- **Email:** Resend API
- **AI:** OpenAI GPT-4 (Rules Guru)
- **PWA:** next-pwa

**Deployment:**
- **Hosting:** Vercel (recommended)
- **Database:** Supabase Cloud
- **CDN:** Vercel Edge Network

### Architecture Patterns

**Client-Server:**
- Client-side React components
- Server-side API routes (Next.js API routes)
- Direct Supabase client calls from client components
- Server-side Supabase client for API routes

**Data Flow:**
1. User interaction → React component
2. Component → Supabase client (direct) OR API route
3. API route → Supabase server client
4. Supabase → PostgreSQL database
5. Database triggers/RLS → Real-time updates
6. Supabase Realtime → Client components

**Component Hierarchy:**
```
App Layout
├── Header (with notifications)
├── Bottom Navigation
└── Page Components
    ├── Feature Components
    │   ├── Dialogs/Modals
    │   ├── Forms
    │   └── Lists/Grids
    └── Shared Components
        ├── UI Primitives (Button, Input, etc.)
        └── Business Logic Components
```

---

## Database Schema

### Core Tables

#### `profiles`
User profile information linked to Supabase Auth.

**Columns:**
- `id` (UUID, PRIMARY KEY) - References `auth.users(id)`
- `email` (TEXT, NOT NULL, UNIQUE)
- `full_name` (TEXT)
- `phone` (TEXT)
- `ntrp_rating` (NUMERIC)
- `is_system_admin` (BOOLEAN, DEFAULT false)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes:**
- `idx_profiles_email` on `email`
- `idx_profiles_system_admin` on `is_system_admin` WHERE `is_system_admin = true`

**RLS Policies:**
- Users can view their own profile
- Users can update their own profile
- System admins can view all profiles
- System admins can update all profiles

#### `teams`
Team/organization information.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `name` (TEXT, NOT NULL)
- `captain_id` (UUID, NOT NULL, REFERENCES profiles(id))
- `co_captain_id` (UUID, REFERENCES profiles(id))
- `organization` (TEXT) - 'USTA', 'CUP', 'UTR', etc.
- `league` (TEXT)
- `year` (INTEGER)
- `level` (TEXT)
- `flight` (TEXT)
- `division` (TEXT)
- `total_lines` (INTEGER) - Number of courts/lines
- `max_sets_per_line` (INTEGER)
- `line_match_types` (JSONB) - Array of match types per line
- `color` (TEXT) - Team color for UI
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes:**
- `idx_teams_captain_id` on `captain_id`
- `idx_teams_co_captain_id` on `co_captain_id`

**RLS Policies:**
- Team members can view their teams
- Captains/co-captains can update their teams
- System admins can view/update all teams

#### `roster_members`
Links users to teams.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `team_id` (UUID, NOT NULL, REFERENCES teams(id) ON DELETE CASCADE)
- `user_id` (UUID, REFERENCES profiles(id) ON DELETE CASCADE)
- `full_name` (TEXT, NOT NULL)
- `email` (TEXT)
- `phone` (TEXT)
- `position` (TEXT) - Player position/role
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Constraints:**
- `UNIQUE(team_id, user_id)` when user_id is not null
- `UNIQUE(team_id, email)` when user_id is null and email is not null

**Indexes:**
- `idx_roster_members_team_id` on `team_id`
- `idx_roster_members_user_id` on `user_id`
- `idx_roster_members_email` on `email`

**RLS Policies:**
- Team members can view roster members of their teams
- Captains can insert/update/delete roster members
- System admins have full access

#### `matches`
Team match information.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `team_id` (UUID, NOT NULL, REFERENCES teams(id) ON DELETE CASCADE)
- `opponent_team_name` (TEXT, NOT NULL)
- `date` (DATE, NOT NULL)
- `time` (TIME, NOT NULL)
- `venue_id` (UUID, REFERENCES venues(id))
- `venue_name` (TEXT) - Fallback if venue_id is null
- `is_home` (BOOLEAN, DEFAULT true)
- `status` (TEXT) - 'upcoming', 'in_progress', 'completed', 'canceled'
- `result` (TEXT) - 'win', 'loss', 'tie', null
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes:**
- `idx_matches_team_id` on `team_id`
- `idx_matches_date` on `date`
- `idx_matches_status` on `status`

**RLS Policies:**
- Team members can view matches for their teams
- Captains can insert/update/delete matches

#### `lineups`
Player lineups for matches.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `match_id` (UUID, NOT NULL, REFERENCES matches(id) ON DELETE CASCADE)
- `court_number` (INTEGER, NOT NULL) - 1, 2, 3, etc.
- `player1_id` (UUID, REFERENCES roster_members(id))
- `player2_id` (UUID, REFERENCES roster_members(id)) - Null for singles
- `match_type` (TEXT) - 'Singles Match', 'Doubles Match'
- `is_published` (BOOLEAN, DEFAULT false)
- `published_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Constraints:**
- `CHECK(court_number > 0)`
- At least one of player1_id or player2_id must be set

**Indexes:**
- `idx_lineups_match_id` on `match_id`
- `idx_lineups_court_number` on `(match_id, court_number)`

**RLS Policies:**
- Team members can view lineups for their team's matches
- Captains can insert/update/delete lineups

#### `court_scores`
Individual court/line scores for matches.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `match_id` (UUID, NOT NULL, REFERENCES matches(id) ON DELETE CASCADE)
- `court_number` (INTEGER, NOT NULL)
- `our_games_won` (INTEGER, DEFAULT 0)
- `their_games_won` (INTEGER, DEFAULT 0)
- `sets_won` (INTEGER, DEFAULT 0)
- `sets_lost` (INTEGER, DEFAULT 0)
- `line_result` (TEXT) - 'win', 'loss', 'tie', null
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes:**
- `idx_court_scores_match_id` on `match_id`
- `idx_court_scores_court` on `(match_id, court_number)`

**RLS Policies:**
- Team members can view scores for their team's matches
- Captains can insert/update/delete scores

#### `availability`
Player availability responses for matches and events.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `roster_member_id` (UUID, NOT NULL, REFERENCES roster_members(id) ON DELETE CASCADE)
- `match_id` (UUID, REFERENCES matches(id) ON DELETE CASCADE)
- `event_id` (UUID, REFERENCES events(id) ON DELETE CASCADE)
- `status` (TEXT, NOT NULL) - 'available', 'unavailable', 'maybe', 'late', 'last_resort'
- `notes` (TEXT)
- `responded_at` (TIMESTAMPTZ, DEFAULT NOW())
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Constraints:**
- `CHECK((match_id IS NOT NULL AND event_id IS NULL) OR (match_id IS NULL AND event_id IS NOT NULL))` - Exactly one must be set
- `UNIQUE(roster_member_id, match_id)` when match_id is not null
- `UNIQUE(roster_member_id, event_id)` when event_id is not null

**Indexes:**
- `idx_availability_roster_member_id` on `roster_member_id`
- `idx_availability_match_id` on `match_id`
- `idx_availability_event_id` on `event_id`
- `idx_availability_status` on `status`

**RLS Policies:**
- Players can view/update their own availability
- Team members can view availability for their team's matches/events
- Captains can view all availability for their team

#### `availability_defaults`
Default availability patterns for players.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `user_id` (UUID, NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE)
- `day_of_week` (INTEGER, NOT NULL) - 0=Sunday, 1=Monday, ..., 6=Saturday
- `time_slots` (TEXT[], NOT NULL) - Array of time strings (e.g., ['18:00', '18:30', '19:00'])
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Constraints:**
- `CHECK(day_of_week >= 0 AND day_of_week <= 6)`
- `UNIQUE(user_id, day_of_week)`

**Indexes:**
- `idx_availability_defaults_user_id` on `user_id`
- `idx_availability_defaults_day` on `(user_id, day_of_week)`

**RLS Policies:**
- Users can view/update their own defaults
- System admins can view all defaults

#### `events`
Team events (practices, social gatherings, etc.).

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `team_id` (UUID, NOT NULL, REFERENCES teams(id) ON DELETE CASCADE)
- `event_name` (TEXT, NOT NULL)
- `date` (DATE, NOT NULL)
- `time` (TIME, NOT NULL)
- `duration` (INTEGER) - Duration in minutes
- `location` (TEXT)
- `description` (TEXT)
- `event_type` (TEXT) - 'practice', 'match', 'warmup', 'social', 'fun', 'other'
- `recurrence_series_id` (UUID) - Links events in a recurring series
- `recurrence_original_date` (DATE) - Original date of the series
- `recurrence_pattern` (TEXT) - 'daily', 'weekly', 'custom'
- `recurrence_end_date` (DATE)
- `recurrence_occurrences` (INTEGER)
- `recurrence_custom_data` (JSONB) - Custom recurrence configuration
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes:**
- `idx_events_team_id` on `team_id`
- `idx_events_date` on `date`
- `idx_events_recurrence_series_id` on `recurrence_series_id`

**RLS Policies:**
- Team members can view events for their teams
- Captains can insert/update/delete events

**Triggers:**
- `initialize_event_availability_trigger` - Automatically creates availability records for all active roster members when an event is created

#### `personal_events`
Personal activities (scrimmages, lessons, classes, etc.).

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `creator_id` (UUID, NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE)
- `team_id` (UUID, REFERENCES teams(id) ON DELETE SET NULL) - Optional team link
- `activity_type` (TEXT, NOT NULL) - 'scrimmage', 'lesson', 'class', 'flex_league', 'booked_court', 'other'
- `title` (TEXT, NOT NULL)
- `date` (DATE, NOT NULL)
- `time` (TIME, NOT NULL)
- `duration` (INTEGER) - Duration in minutes
- `location` (TEXT)
- `description` (TEXT)
- `max_attendees` (INTEGER)
- `cost` (NUMERIC)
- `recurrence_series_id` (UUID)
- `recurrence_original_date` (DATE)
- `recurrence_pattern` (TEXT) - 'daily', 'weekly', 'custom'
- `recurrence_end_date` (DATE)
- `recurrence_occurrences` (INTEGER)
- `recurrence_custom_data` (JSONB)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes:**
- `idx_personal_events_creator_id` on `creator_id`
- `idx_personal_events_date` on `date`
- `idx_personal_events_recurrence_series_id` on `recurrence_series_id`

**RLS Policies:**
- Users can view personal events they're invited to or created
- Creators can insert/update/delete their personal events
- Uses helper functions to check invitations/attendees without RLS recursion

#### `event_invitations`
Invitations to personal events and team events.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `event_id` (UUID, NOT NULL) - Can reference personal_events or events
- `inviter_id` (UUID, NOT NULL, REFERENCES profiles(id))
- `invitee_id` (UUID, REFERENCES profiles(id)) - Null if invitee hasn't joined app
- `invitee_email` (TEXT, NOT NULL)
- `invitee_name` (TEXT)
- `status` (TEXT, NOT NULL, DEFAULT 'pending') - 'pending', 'accepted', 'declined', 'expired'
- `message` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `responded_at` (TIMESTAMPTZ)

**Indexes:**
- `idx_event_invitations_event_id` on `event_id`
- `idx_event_invitations_invitee_id` on `invitee_id`
- `idx_event_invitations_invitee_email` on `invitee_email`
- `idx_event_invitations_status` on `status`

**RLS Policies:**
- Users can view invitations sent to them (by invitee_id or invitee_email)
- Event creators can insert/update/delete invitations
- Invitees can update their own invitation status

#### `event_attendees`
Attendees of personal events.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `personal_event_id` (UUID, NOT NULL, REFERENCES personal_events(id) ON DELETE CASCADE)
- `user_id` (UUID, REFERENCES profiles(id) ON DELETE CASCADE)
- `email` (TEXT, NOT NULL)
- `name` (TEXT)
- `availability_status` (TEXT, NOT NULL, DEFAULT 'available') - 'available', 'unavailable', 'maybe', 'last_resort'
- `invited_via` (TEXT) - How they were invited
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes:**
- `idx_event_attendees_personal_event_id` on `personal_event_id`
- `idx_event_attendees_user_id` on `user_id`
- `idx_event_attendees_email` on `email`

**RLS Policies:**
- Users can view attendees for events they're invited to or created
- Event creators can insert/update/delete attendees
- Attendees can update their own status

#### `venues`
Tennis court locations (system-wide and team-specific).

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `name` (TEXT, NOT NULL)
- `address` (TEXT)
- `google_maps_link` (TEXT)
- `region` (TEXT) - Geographic region (system-level only)
- `is_active` (BOOLEAN, DEFAULT true) - System-level only
- `team_id` (UUID, REFERENCES teams(id) ON DELETE CASCADE) - Null for system-level venues
- `created_by` (UUID, REFERENCES profiles(id))
- `default_court_time` (INTEGER) - Default court time in minutes (15-180)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Constraints:**
- `CHECK(default_court_time IS NULL OR (default_court_time >= 15 AND default_court_time <= 180))`

**Indexes:**
- `idx_venues_team_id` on `team_id`
- `idx_venues_is_active` on `is_active` WHERE `is_active = true`
- `idx_venues_region` on `region`

**RLS Policies:**
- All authenticated users can view active venues
- System admins can view all venues (including inactive)
- System admins can insert/update/delete system-level venues
- Team captains can insert/update/delete team-specific venues

#### `venue_court_times`
Typical court start times for venues.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `venue_id` (UUID, NOT NULL, REFERENCES venues(id) ON DELETE CASCADE)
- `start_time` (TIME, NOT NULL) - Court start time in HH:MM:SS format
- `display_order` (INTEGER, NOT NULL, DEFAULT 0) - Order for display
- `created_at` (TIMESTAMPTZ, DEFAULT NOW(), NOT NULL)
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW(), NOT NULL)

**Constraints:**
- `UNIQUE(venue_id, start_time)` - No duplicate times per venue
- `CHECK(display_order >= 0)` - Non-negative display order

**Indexes:**
- `idx_venue_court_times_venue_id` on `venue_id`
- `idx_venue_court_times_venue_order_time` on `(venue_id, display_order, start_time)`

**RLS Policies:**
- All authenticated users can view court times for active venues
- System admins can view all court times
- System admins can insert/update/delete court times

#### `contacts`
User's contact address book.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `user_id` (UUID, NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE)
- `linked_profile_id` (UUID, REFERENCES profiles(id) ON DELETE SET NULL)
- `name` (TEXT, NOT NULL)
- `email` (TEXT)
- `phone` (TEXT)
- `address` (TEXT)
- `notes` (TEXT)
- `tags` (TEXT[]) - Array of tags
- `relationship_type` (TEXT) - 'teammate', 'opponent', 'coach', 'facility_staff', 'other'
- `source` (TEXT) - 'auto', 'manual', 'merged'
- `source_team_id` (UUID, REFERENCES teams(id) ON DELETE SET NULL)
- `source_roster_member_id` (UUID, REFERENCES roster_members(id) ON DELETE SET NULL)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes:**
- `idx_contacts_user_id` on `user_id`
- `idx_contacts_linked_profile_id` on `linked_profile_id`
- `idx_contacts_email` on `email`

**RLS Policies:**
- Users can view/insert/update/delete their own contacts

#### `conversations`
Chat conversations (team chats and direct messages).

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `kind` (TEXT, NOT NULL) - 'team' or 'dm'
- `team_id` (UUID, REFERENCES teams(id) ON DELETE CASCADE) - For team conversations
- `dm_user1` (UUID, REFERENCES profiles(id)) - For direct messages
- `dm_user2` (UUID, REFERENCES profiles(id)) - For direct messages
- `last_message_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Constraints:**
- For team conversations: `team_id` must be set, `dm_user1` and `dm_user2` must be null
- For direct messages: `team_id` must be null, both `dm_user1` and `dm_user2` must be set

**Indexes:**
- `idx_conversations_team_id` on `team_id`
- `idx_conversations_dm_users` on `(dm_user1, dm_user2)`
- `idx_conversations_last_message_at` on `last_message_at`

**RLS Policies:**
- Team members can view team conversations for their teams
- Users can view direct messages they're part of
- Team members can insert messages in team conversations
- Users can insert messages in their direct messages

#### `messages`
Individual messages in conversations.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `conversation_id` (UUID, NOT NULL, REFERENCES conversations(id) ON DELETE CASCADE)
- `sender_id` (UUID, NOT NULL, REFERENCES profiles(id))
- `body` (TEXT, NOT NULL)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes:**
- `idx_messages_conversation_id` on `conversation_id`
- `idx_messages_created_at` on `(conversation_id, created_at DESC)`

**RLS Policies:**
- Users can view messages in conversations they're part of
- Users can insert messages in conversations they're part of
- Message senders can update/delete their own messages

#### `conversation_reads`
Read receipts for conversations.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `conversation_id` (UUID, NOT NULL, REFERENCES conversations(id) ON DELETE CASCADE)
- `user_id` (UUID, NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE)
- `last_read_at` (TIMESTAMPTZ, DEFAULT NOW())
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Constraints:**
- `UNIQUE(conversation_id, user_id)`

**Indexes:**
- `idx_conversation_reads_conversation_user` on `(conversation_id, user_id)`

**RLS Policies:**
- Users can view/update their own read receipts

#### `user_activity_type_preferences`
User preferences for personal activity types.

**Columns:**
- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `user_id` (UUID, NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE)
- `activity_type` (TEXT, NOT NULL) - 'scrimmage', 'lesson', 'class', 'flex_league', 'booked_court', 'other'
- `is_enabled` (BOOLEAN, DEFAULT true)
- `display_order` (INTEGER, NOT NULL, DEFAULT 0)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Constraints:**
- `UNIQUE(user_id, activity_type)`
- `CHECK(activity_type IN ('scrimmage', 'lesson', 'class', 'flex_league', 'booked_court', 'other'))`
- `CHECK(display_order >= 0)`

**Indexes:**
- `idx_user_activity_type_preferences_user_id` on `user_id`
- `idx_user_activity_type_preferences_user_enabled_order` on `(user_id, is_enabled, display_order)` WHERE `is_enabled = true`
- `idx_user_activity_type_preferences_activity_type` on `activity_type`

**RLS Policies:**
- Users can view/insert/update/delete their own preferences

### Database Functions

#### `get_potential_contacts_from_network(target_user_id UUID)`
Returns potential contacts from teams the user is on.

**Returns:** Table with columns:
- `roster_member_id` (UUID)
- `team_id` (UUID)
- `team_name` (TEXT) - Comma-separated if multiple teams
- `profile_id` (UUID)
- `name` (TEXT)
- `email` (TEXT)
- `phone` (TEXT)
- `relationship_type` (TEXT) - Always 'teammate'
- `already_exists` (BOOLEAN)
- `existing_contact_id` (UUID)

**Logic:**
1. Finds all roster members on teams where the user is also a roster member
2. Excludes the user themselves
3. Requires either a `user_id` (linked profile) or valid email
4. Uses email username as fallback for name if full_name is missing
5. Groups by contact (profile_id or email) to handle multiple teams
6. Aggregates team names for contacts on multiple teams
7. Checks if contact already exists (by profile_id or email)

**Authorization:**
- Only the target user or system admin can call
- Validates target_user_id exists

#### `import_selected_contacts(target_user_id UUID, roster_member_ids UUID[])`
Imports selected contacts from potential contacts.

**Returns:** INTEGER (number of contacts imported)

**Logic:**
1. Validates authorization (target user or system admin)
2. For each roster_member_id:
   - Finds roster member and associated profile (if linked)
   - Creates contact record with relationship_type='teammate'
   - Links to profile if user_id exists
   - Uses email username as name fallback
3. Uses `ON CONFLICT DO NOTHING` for idempotency

**Authorization:**
- Only the target user or system admin can call
- Validates target_user_id exists

#### `link_roster_members_to_user(target_user_id UUID)`
Links roster members to a user account by email matching.

**Returns:** INTEGER (number of roster members linked)

**Logic:**
1. Gets user's email from profile
2. Finds roster members with matching email and null user_id
3. Updates roster members to set user_id
4. Sets is_active=true for newly linked members

**Authorization:**
- Only the target user or system admin can call

#### `link_event_invitations_to_user(target_user_id UUID)`
Links event invitations to a user account by email matching.

**Returns:** INTEGER (number of invitations linked)

**Logic:**
1. Gets user's email from profile
2. Finds event invitations with matching invitee_email and null invitee_id
3. Updates invitations to set invitee_id
4. Also updates event_attendees records for accepted invitations

**Authorization:**
- Only the target user or system admin can call

#### `get_user_activity_types(target_user_id UUID DEFAULT auth.uid())`
Returns user's enabled activity types ordered by display_order.

**Returns:** Table with columns from `user_activity_type_preferences`

**Logic:**
1. Checks authorization (target user or system admin)
2. If no preferences exist, calls `initialize_user_activity_type_preferences`
3. Returns preferences ordered by display_order

**Authorization:**
- Only the target user or system admin can call
- Marked as STABLE for query optimization

#### `initialize_user_activity_type_preferences(target_user_id UUID)`
Initializes default activity type preferences for a user.

**Returns:** VOID

**Logic:**
1. Validates authorization
2. Inserts default activity types with `ON CONFLICT DO NOTHING`
3. Sets display_order based on default order

**Authorization:**
- Only the target user or system admin can call

### Database Triggers

#### `trigger_update_venue_court_times_updated_at`
Automatically updates `updated_at` timestamp on `venue_court_times` table.

**When:** BEFORE UPDATE
**Condition:** Only fires if data actually changed (`OLD.* IS DISTINCT FROM NEW.*`)

#### `trigger_update_user_activity_type_preferences_updated_at`
Automatically updates `updated_at` timestamp on `user_activity_type_preferences` table.

**When:** BEFORE UPDATE

#### `initialize_event_availability_trigger`
Automatically creates availability records for all active roster members when an event is created.

**When:** AFTER INSERT on `events`
**Logic:**
1. Gets all active roster members for the event's team
2. For each roster member, checks their availability_defaults for the event's day of week
3. Creates availability record with status from defaults or 'unavailable' if no defaults

---

## API Endpoints

### Authentication Endpoints

#### `POST /api/auth/callback`
Handles Supabase auth callback after email confirmation.

**Request:** Query parameters from Supabase
**Response:**
```json
{
  "success": true,
  "user": { ... }
}
```

**Logic:**
1. Verifies auth callback
2. Creates profile if doesn't exist
3. Calls `link_roster_members_to_user` to link roster members by email
4. Calls `link_event_invitations_to_user` to link invitations by email
5. Redirects to home page

#### `POST /api/auth/link-roster-members`
Links roster members to authenticated user by email.

**Request:**
```json
{
  "userId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "linked": 5,
  "linkedInvitations": 2,
  "teams": [...],
  "message": "Successfully linked to 5 team(s) and 2 event invitation(s)"
}
```

**Authorization:** Must be authenticated and userId must match auth user

### Email Endpoints

#### `POST /api/email/send-invitation`
Sends event invitation email.

**Request:**
```json
{
  "emailData": {
    "to": "email@example.com",
    "subject": "You're invited to...",
    "body": "Email body text"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

**Authorization:** Must be authenticated
**Logic:**
1. Validates email data
2. Calls `EmailService.send()` which uses Resend API
3. Returns success/error response

#### `POST /api/email/publish-lineup`
Sends lineup emails to players.

**Request:**
```json
{
  "matchId": "uuid",
  "teamId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "emailsSent": 6
}
```

**Authorization:** Must be team captain
**Logic:**
1. Validates user is captain
2. Gets lineup and roster members
3. Sends "Lineup Playing" email to players in lineup
4. Sends "Lineup Bench" email to players not in lineup
5. Updates lineup is_published flag

### Admin Endpoints

#### `GET /api/admin/users`
Gets all users (system admin only).

**Response:**
```json
{
  "users": [...]
}
```

**Authorization:** System admin only

#### `PUT /api/admin/users/[userId]`
Updates a user (system admin only).

**Request:**
```json
{
  "email": "email@example.com",
  "fullName": "Name",
  "phone": "123-456-7890",
  "ntrpRating": "4.5",
  "isSystemAdmin": false
}
```

**Response:**
```json
{
  "success": true
}
```

**Authorization:** System admin only

#### `DELETE /api/admin/users/[userId]`
Deletes a user (system admin only).

**Response:**
```json
{
  "success": true
}
```

**Authorization:** System admin only

#### `POST /api/admin/impersonate`
Starts user impersonation (system admin only).

**Request:**
```json
{
  "userId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "impersonatedUser": { ... }
}
```

**Authorization:** System admin only
**Logic:** Stores impersonation state in localStorage

### Profile Endpoints

#### `POST /api/profile/create`
Creates a user profile.

**Request:**
```json
{
  "userId": "uuid",
  "email": "email@example.com",
  "fullName": "Name"
}
```

**Response:**
```json
{
  "success": true,
  "profile": { ... }
}
```

**Authorization:** Must be authenticated and userId must match

### Rules Guru Endpoint

#### `POST /api/rules-guru`
AI-powered tennis rules assistant.

**Request:**
```json
{
  "message": "What is a let serve?"
}
```

**Response:**
```json
{
  "response": "A let serve occurs when..."
}
```

**Logic:**
1. Uses OpenAI GPT-4 API
2. System prompt includes USTA rules, Friend at Court 2025, SACT CUP Bylaws
3. Returns AI-generated response
4. Falls back to mock response if API key not configured

---

## Component Architecture

### Page Components

All page components are in `src/app/(app)/[feature]/page.tsx`.

**Pattern:**
- Client components ('use client')
- Use `Header` component for page title
- Use `BottomNav` for navigation (via layout)
- Fetch data using Supabase client
- Manage local state with React hooks
- Handle loading and error states

**Example Structure:**
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

export default function FeaturePage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    // Fetch data
  }

  return (
    <div>
      <Header title="Feature" />
      {/* Page content */}
    </div>
  )
}
```

### Shared Components

#### `LocationSelector`
Unified component for venue/custom location selection.

**Props:**
- `locationMode: 'venue' | 'custom'`
- `onLocationModeChange: (mode) => void`
- `selectedVenueId: string | undefined`
- `onVenueChange: (venueId) => void`
- `customLocation: string`
- `onCustomLocationChange: (location) => void`
- `teamId?: string | null`
- `canCreateVenue?: boolean`
- `onVenueSelected?: (venue) => void`

**Features:**
- Loads system-wide and team-specific venues
- Shows venue dialog for creating new venues
- Calls `onVenueSelected` when venue is selected (for setting default court time)
- Default mode is 'venue'

#### `RecurrenceSelector`
Unified component for recurrence pattern selection.

**Props:**
- `isRecurring: boolean`
- `onRecurringChange: (isRecurring) => void`
- `pattern: RecurrencePattern`
- `onPatternChange: (pattern) => void`
- `endType: RecurrenceEndType`
- `onEndTypeChange: (endType) => void`
- `endDate: string`
- `onEndDateChange: (date) => void`
- `occurrences: string`
- `onOccurrencesChange: (occurrences) => void`
- `customRecurrence: CustomRecurrenceData`
- `onCustomRecurrenceChange: (data) => void`
- `startDate: string`
- `showNeverOption?: boolean`

**Features:**
- Single checkbox for "This is a recurring event"
- Pattern selection (daily, weekly, custom)
- End type selection (date, occurrences, never)
- Custom recurrence dialog integration
- Validates recurrence configuration

### Utility Functions

#### `generateRecurringDates()`
Generates array of dates for recurring events.

**Parameters:**
- `startDate: string` (YYYY-MM-DD)
- `pattern: RecurrencePattern`
- `endType: RecurrenceEndType`
- `endDate?: string`
- `numOccurrences?: number`
- `customData?: CustomRecurrenceData`

**Returns:** `string[]` (array of YYYY-MM-DD dates)

**Logic:**
- Daily: Adds 1 day for each occurrence
- Weekly: Adds 1 week for each occurrence
- Custom:
  - `timeUnit === 'day'`: Adds `interval` days
  - `timeUnit === 'week'`: Adds `interval` weeks (maintains day of week if selectedDays provided)
  - `timeUnit === 'month'`: Adds `interval` months
  - `timeUnit === 'year'`: Adds `interval` years
- End by date: Generates until end date
- End by occurrences: Generates specified number
- Never: Generates for 2 years (safety limit)

**Safety:** Maximum 1000 iterations to prevent infinite loops

#### `validateRecurrenceConfig()`
Validates recurrence configuration.

**Parameters:**
- `config: RecurrenceConfig`

**Returns:** `{ valid: boolean; error?: string }`

**Validation Rules:**
- If endType is 'date', endDate must be provided and after start date
- If endType is 'occurrences', occurrences must be > 0
- If pattern is 'custom', customData must be provided
- Custom interval must be > 0
- Selected days must be valid (0-6) if provided

#### `getTeamColor()`
Gets team color for UI display.

**Parameters:**
- `teamId: string | undefined | null`
- `savedColor?: string | null`

**Returns:** Color object with hex, name, CSS classes

**Logic:**
1. If savedColor exists, returns that color
2. Otherwise, uses hash-based color assignment from predefined palette
3. Returns default color if teamId is null/undefined

#### `getPersonalActivityColorClass()`
Gets CSS class for personal activity colors.

**Parameters:**
- `type: 'bg' | 'border' | 'text' | 'bgLight'`

**Returns:** CSS class string

**Colors:**
- Border: `border-l-red-800` (dark brick red)
- Background: `bg-red-800`
- Light background: `bg-red-50` (very light red)
- Text: `text-red-800`

#### `getEventTypeBadgeClass()`
Gets CSS class for event type badges.

**Parameters:**
- `eventType: EventType`

**Returns:** CSS class string with `!important` flags

**Colors:**
- Match: `!bg-green-600`
- Practice: `!bg-blue-600`
- Warm-up: `!bg-orange-500`
- Social/Fun: `!bg-purple-500`
- Other: `!bg-gray-600`

#### `getActivityTypeBadgeClass()`
Gets CSS class for activity type badges.

**Parameters:**
- `activityType: ActivityType`

**Returns:** CSS class string

**Colors:**
- Scrimmage: `!bg-green-600`
- Lesson: `!bg-indigo-600`
- Class: `!bg-teal-600`
- Flex League: `!bg-amber-600`
- Booked Court: `!bg-violet-600`
- Other: `!bg-gray-600`

---

## Business Logic & Algorithms

### Lineup Wizard Algorithm

**Purpose:** Generate optimal player pairings for doubles matches.

**Input:**
- `teamId: string`
- `matchId: string`
- `availablePlayers: Player[]` - Players with availability status

**Algorithm:**
1. Filter players to only those with availability 'available', 'maybe', or 'last_resort'
2. Generate all possible pairs from eligible players
3. For each pair, calculate weighted score:
   - Win percentage: `(wins / matches_together) * 100` (default 50% if no history)
   - Games percentage: `(games_won / games_played) * 100` (default 50% if no history)
   - Fair play score: Average of both players' fair_play_score
   - Weighted score: `(winPct * 0.4) + (gamesPct * 0.3) + (fairPlay * 0.3)`
4. Sort pairs by score descending
5. Select top 3 non-overlapping pairs (no player appears twice)
6. Return suggestions

**Data Source:**
- Pair statistics from `pair_statistics` table (if exists)
- Player fair play scores from roster members

### Contact Sync Algorithm

**Purpose:** Import contacts from teams user is on.

**Steps:**
1. Call `get_potential_contacts_from_network(userId)`
2. Display potential contacts grouped by team
3. User selects contacts to import
4. Call `import_selected_contacts(userId, selectedRosterMemberIds)`
5. Contacts are created with relationship_type='teammate'

**Deduplication:**
- Contacts are grouped by profile_id (if linked) or email
- If contact already exists (by profile_id or email), marked as `already_exists`
- Duplicate contacts on multiple teams are shown as single contact with multiple team names

### Recurrence Date Generation

**Algorithm:** See `generateRecurringDates()` function above.

**Key Logic:**
- Custom weekly with selected days: Maintains same day of week, adds interval weeks
- Example: Every 2 weeks on Wednesday, starting Jan 15
  - Jan 15 (Wed) → Jan 29 (Wed) → Feb 12 (Wed)
- Custom monthly: Adds interval months, preserves day of month (or last day if month shorter)
- Custom yearly: Adds interval years, preserves month and day

### Availability Default Application

**Purpose:** Apply default availability when event is created.

**Trigger:** `initialize_event_availability_trigger` on events table

**Logic:**
1. When event is inserted:
   - Get event's day of week (0=Sunday, ..., 6=Saturday)
   - For each active roster member:
     - Check if they have availability_defaults for that day
     - If yes, create availability with time_slots from defaults
     - If no defaults, create availability with status='unavailable'
2. Creates availability records with:
   - `roster_member_id`
   - `event_id`
   - `status` based on defaults or 'unavailable'
   - `responded_at` = NOW()

### Court Time Selection

**Purpose:** When venue with court times is selected, show time picker.

**Logic:**
1. When venue is selected in event creation:
   - Check if venue has court times in `venue_court_times` table
   - If yes, load court times ordered by display_order, then start_time
   - Display dropdown with court times formatted as "5:45 AM", "7:00 AM", etc.
   - Include "Custom Time" option
   - When court time selected, set event time to that value
   - When "Custom Time" selected, show regular time input

**Time Format:**
- Database: TIME type (HH:MM:SS)
- Display: 12-hour format with AM/PM (e.g., "5:45 AM")
- Input: 24-hour format (HH:MM) for time inputs

---

## Authentication & Authorization

### Authentication Flow

1. **Sign Up:**
   - User enters email and password
   - Supabase Auth creates auth user
   - Profile is created via `/api/profile/create`
   - `link_roster_members_to_user` is called to link roster members by email
   - `link_event_invitations_to_user` is called to link invitations by email
   - User is redirected to home

2. **Sign In:**
   - User enters email and password
   - Supabase Auth authenticates
   - Session is established
   - User is redirected to home

3. **Email Confirmation:**
   - User clicks confirmation link
   - Supabase Auth confirms email
   - `/api/auth/callback` is called
   - Profile creation and linking happens (same as sign up)

### Authorization Levels

**Regular User:**
- Can create/manage personal activities
- Can respond to availability
- Can view team information for teams they're on
- Can participate in team chats
- Can manage contacts

**Team Captain:**
- All regular user permissions
- Can create/edit team events
- Can manage team roster
- Can build and publish lineups
- Can enter match scores
- Can manage team availability
- Can send lineup emails

**Co-Captain:**
- Same permissions as captain

**System Admin:**
- All user permissions
- Can manage system-wide venues
- Can manage all users
- Can view system-wide data
- Can impersonate users (for support)

### RLS Policy Patterns

**View Own Data:**
```sql
CREATE POLICY "Users can view own X" ON table_name
  FOR SELECT
  USING (user_id = auth.uid());
```

**View Team Data:**
```sql
CREATE POLICY "Team members can view team X" ON table_name
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roster_members
      WHERE team_id = table_name.team_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );
```

**Captain Modify:**
```sql
CREATE POLICY "Captains can modify team X" ON table_name
  FOR INSERT/UPDATE/DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE id = table_name.team_id
        AND (captain_id = auth.uid() OR co_captain_id = auth.uid())
    )
  );
```

**System Admin:**
```sql
CREATE POLICY "System admins can manage X" ON table_name
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND is_system_admin = true
    )
  );
```

---

## State Management

### Local State Patterns

**Component State:**
- Use `useState` for local component state
- Use `useEffect` for side effects (data loading, subscriptions)
- Use `useMemo` for expensive computations
- Use `useCallback` for stable function references

**Form State:**
- Each form field has its own state variable
- Form submission validates and submits data
- Loading states prevent double submissions

**List State:**
- Arrays stored in state
- Optimistic updates for better UX
- Reload from server after mutations

### Real-time Subscriptions

**Pattern:**
```typescript
useEffect(() => {
  const supabase = createClient()
  const channel = supabase
    .channel('channel-name')
    .on('postgres_changes', {
      event: 'INSERT/UPDATE/DELETE',
      schema: 'public',
      table: 'table_name',
      filter: 'filter_condition'
    }, (payload) => {
      // Update local state
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [dependencies])
```

**Used For:**
- New messages in conversations
- Availability updates
- Event changes
- Lineup updates

### Data Fetching Patterns

**On Mount:**
```typescript
useEffect(() => {
  loadData()
}, [])
```

**On Dependency Change:**
```typescript
useEffect(() => {
  loadData()
}, [dependency1, dependency2])
```

**Manual Refresh:**
- Provide refresh button/function
- Call loadData() on user action

---

## Real-time Features

### Message Notifications

**Implementation:**
- Header component subscribes to new messages
- Checks for unread conversations every 30 seconds
- Shows unread indicator badge
- Updates recent messages dropdown in real-time

### Availability Updates

**Implementation:**
- Team availability page can subscribe to availability changes
- Real-time updates when players respond
- Visual indicators update immediately

### Event Updates

**Implementation:**
- Calendar page can subscribe to event changes
- Events appear/disappear in real-time
- Availability changes reflect immediately

---

## Email Service Integration

### EmailService Class

**Location:** `src/services/EmailService.ts`

**Methods:**
- `compileAutoWelcomeEmail()` - Welcome email to opponent captain
- `compileLineupPlayingEmail()` - Email to players in lineup
- `compileLineupBenchEmail()` - Email to players not in lineup
- `compileEventInvitationEmail()` - Event invitation email
- `compileEventCanceledEmail()` - Event cancellation email
- `send()` - Sends email via Resend API or logs in development

### Email Templates

**Auto Welcome Email:**
- Sent to opponent captain
- Includes match details (date, time, venue)
- Manual trigger via match day checklist

**Lineup Playing Email:**
- Sent to players in lineup
- Includes match details and lineup
- Confirms playing status

**Lineup Bench Email:**
- Sent to players not in lineup
- Includes match details
- Notifies bench status

**Event Invitation Email:**
- Sent when inviting to events/activities
- Includes event details
- Works for app users and non-app users
- Includes invitation message if provided

**Event Canceled Email:**
- Sent when removed from event
- Includes event details
- Notification of cancellation

### Email Sending Flow

1. Client component calls API route `/api/email/send-invitation`
2. API route verifies authentication
3. API route calls `EmailService.send()`
4. EmailService checks for `RESEND_API_KEY`
5. If in development and no key, logs to console
6. If in production, sends via Resend API
7. Returns success/error response

---

## File Structure

```
src/
├── app/
│   ├── (app)/              # App routes (with bottom nav)
│   │   ├── home/
│   │   ├── calendar/
│   │   ├── activities/
│   │   ├── availability/
│   │   ├── teams/
│   │   ├── messages/
│   │   ├── contacts/
│   │   ├── profile/
│   │   ├── settings/
│   │   └── admin/
│   ├── api/                # API routes
│   │   ├── auth/
│   │   ├── email/
│   │   ├── admin/
│   │   ├── profile/
│   │   └── rules-guru/
│   ├── auth/               # Auth pages
│   │   ├── login/
│   │   ├── signup/
│   │   └── callback/
│   └── layout.tsx          # Root layout
├── components/
│   ├── layout/              # Navigation components
│   ├── teams/               # Team-specific components
│   ├── activities/          # Activity components
│   ├── calendar/            # Calendar components
│   ├── availability/        # Availability components
│   ├── contacts/            # Contact components
│   ├── events/              # Event components
│   ├── matches/             # Match components
│   ├── shared/              # Shared business components
│   ├── admin/               # Admin components
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── supabase/            # Supabase clients
│   ├── recurrence-utils.ts # Recurrence logic
│   ├── team-colors.ts      # Team color utilities
│   ├── event-type-colors.ts # Event type styling
│   ├── activity-type-utils.ts # Activity type utilities
│   ├── calendar-utils.ts    # Calendar utilities
│   ├── availability-utils.ts # Availability utilities
│   ├── score-utils.ts      # Score calculation
│   ├── admin-utils.ts      # Admin utilities
│   └── utils.ts            # General utilities
├── services/
│   └── EmailService.ts     # Email service
├── hooks/
│   └── use-toast.ts        # Toast notifications
├── types/
│   └── database.types.ts   # TypeScript types
└── app/
    └── globals.css         # Global styles

supabase/
├── migrations/             # SQL migration files
└── functions/              # Edge functions
```

---

## Configuration & Environment

### Environment Variables

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)

**Optional:**
- `RESEND_API_KEY` - Resend API key for email sending
- `OPENAI_API_KEY` - OpenAI API key for Rules Guru
- `NEXT_PUBLIC_APP_URL` - App URL for email links

### Supabase Configuration

**Required Setup:**
1. Create Supabase project
2. Run all migration files in order
3. Configure RLS policies
4. Set up email templates (if using Supabase Auth emails)
5. Configure storage buckets (if using file uploads)

**Database Setup:**
1. Run migrations in this order:
   - Base tables (teams, profiles, etc.)
   - Events and availability tables
   - Personal events table
   - Contacts table
   - Venues and court times
   - User activity types
   - All RLS policies
   - All triggers
   - All functions

### PWA Configuration

**Manifest:**
- Icons in `/public/icons/` (72x72 through 512x512)
- Generated via Real Favicon Generator

**Service Worker:**
- Configured via next-pwa
- Caches static assets
- Offline support (future)

---

## Data Models & Types

### TypeScript Types

**Core Types:**
- `Team`, `TeamInsert`, `TeamUpdate`
- `RosterMember`, `RosterMemberInsert`, `RosterMemberUpdate`
- `Match`, `MatchInsert`, `MatchUpdate`
- `Lineup`, `LineupInsert`, `LineupUpdate`
- `Event`, `EventInsert`, `EventUpdate`
- `PersonalEvent`, `PersonalEventInsert`, `PersonalEventUpdate`
- `Availability`, `AvailabilityInsert`, `AvailabilityUpdate`
- `Contact`, `ContactInsert`, `ContactUpdate`
- `Venue`, `VenueInsert`, `VenueUpdate`
- `EventInvitation`, `EventInvitationInsert`, `EventInvitationUpdate`
- `EventAttendee`, `EventAttendeeInsert`, `EventAttendeeUpdate`

**Utility Types:**
- `RecurrencePattern` - 'daily' | 'weekly' | 'custom'
- `RecurrenceEndType` - 'date' | 'occurrences' | 'never'
- `RecurrenceTimeUnit` - 'day' | 'week' | 'month' | 'year'
- `EventType` - 'match' | 'practice' | 'warmup' | 'social' | 'fun' | 'other'
- `ActivityType` - 'scrimmage' | 'lesson' | 'class' | 'flex_league' | 'booked_court' | 'other'
- `AvailabilityStatus` - 'available' | 'unavailable' | 'maybe' | 'late' | 'last_resort'

**Interfaces:**
- `CustomRecurrenceData` - Custom recurrence configuration
- `RecurrenceConfig` - Complete recurrence configuration
- `VenueCourtTime` - Court start time for venue

---

## UI/UX Patterns

### Navigation

**Bottom Navigation:**
- Fixed at bottom of screen
- 8 main sections
- Active state highlighting
- Icons with labels

**Header:**
- Fixed at top
- Page title
- Notifications dropdown
- Admin access button (if admin)
- Impersonation banner (if impersonating)

### Dialogs/Modals

**Pattern:**
- Use shadcn/ui `Dialog` component
- Form validation before submission
- Loading states during submission
- Toast notifications for success/error
- Close on successful submission

### Forms

**Pattern:**
- Native HTML forms with `onSubmit`
- Controlled inputs (value + onChange)
- Required field indicators (*)
- Validation on submit
- Disable submit button during loading

### Lists/Grids

**Pattern:**
- Card-based layouts for items
- Hover states for interactivity
- Action buttons (edit, delete) on hover
- Empty states with helpful messages
- Loading skeletons

### Color System

**Primary Color:**
- Dark Navy: `hsl(220, 50%, 25%)`
- Used for primary buttons, links, focus rings

**Team Colors:**
- Hash-based assignment from predefined palette
- Stored per team in database
- Used for calendar, filters, badges

**Event Type Colors:**
- Match: Green
- Practice: Blue
- Warm-up: Orange
- Social/Fun: Purple
- Other: Gray

**Activity Type Colors:**
- Scrimmage: Green
- Lesson: Indigo
- Class: Teal
- Flex League: Amber
- Booked Court: Violet
- Other: Gray

**Personal Activity Color:**
- Dark Brick Red: `#991b1b` (border), `#fef2f2` (background)

---

## Workflows & User Journeys

### Creating a Team Event

1. Navigate to Teams → Select Team → Events
2. Click "Add Event"
3. Fill in event details:
   - Event name
   - Event type
   - Date and time
   - Duration (auto-filled if venue has default court time)
   - Location (select venue or custom)
   - If venue selected with court times, choose from court time picker
   - Description
4. Optionally set as recurring:
   - Check "This is a recurring event"
   - Select pattern (daily, weekly, custom)
   - Set end condition (date, occurrences, never)
   - If custom, configure interval and selected days
5. Submit
6. System creates event(s) and availability records for all roster members
7. Users receive notifications (if configured)

### Building a Lineup

1. Navigate to Match → Lineup
2. View available players (filtered by availability)
3. Option A: Use Lineup Wizard
   - Click "Lineup Wizard" button
   - System generates optimal pairings
   - Review suggestions
   - Click "Apply" to populate lineup
4. Option B: Manual Drag-and-Drop
   - Drag players from available list to court slots
   - System validates (no duplicates, all slots filled)
5. Save lineup
6. Publish lineup (sends emails to players)

### Responding to Availability

1. Navigate to Availability or Match/Event detail
2. View availability request
3. Select response:
   - Available
   - Unavailable
   - Maybe
   - Late
   - Last Resort
4. Optionally add notes
5. Submit
6. Response is saved and visible to captains

### Importing Contacts

1. Navigate to Contacts
2. Click "Sync from Network"
3. System loads potential contacts from teams
4. Review contacts grouped by team
5. Select contacts to import (or "Select All")
6. Click "Import Selected"
7. Contacts are created with relationship_type='teammate'
8. Contacts appear in contacts list

### Creating Recurring Personal Activity

1. Navigate to Activities → Add Activity
2. Fill in activity details
3. Check "This is a recurring event"
4. Select pattern:
   - Daily: Every day
   - Weekly: Every week on same day
   - Custom: Configure interval and selected days
5. Set end condition:
   - End by date: Select end date
   - End by occurrences: Enter number
   - Never: Continues indefinitely (2-year limit)
6. Submit
7. System generates all occurrences
8. Each occurrence can be edited/deleted individually

---

## Error Handling

### Client-Side Error Handling

**Pattern:**
```typescript
try {
  const { data, error } = await supabase.from('table').select()
  if (error) {
    toast({
      title: 'Error',
      description: error.message,
      variant: 'destructive',
    })
    return
  }
  // Handle success
} catch (error) {
  console.error('Unexpected error:', error)
  toast({
    title: 'Error',
    description: 'An unexpected error occurred',
    variant: 'destructive',
  })
}
```

### Server-Side Error Handling

**API Routes:**
```typescript
try {
  // Logic
  return NextResponse.json({ success: true })
} catch (error: any) {
  return NextResponse.json(
    { error: error.message || 'Internal server error' },
    { status: 500 }
  )
}
```

### Database Error Handling

**RLS Policy Errors:**
- Check error code (e.g., '42501' for insufficient privileges)
- Provide user-friendly error messages
- Log detailed errors server-side

**Constraint Violations:**
- Check error code (e.g., '23505' for unique constraint)
- Provide specific error messages
- Guide user to fix the issue

---

## Performance Optimizations

### Database Optimizations

**Indexes:**
- All foreign keys are indexed
- Composite indexes for common query patterns
- Partial indexes for filtered queries (e.g., `WHERE is_active = true`)

**Query Optimization:**
- Use `SELECT` with specific columns (not `*`)
- Use `LIMIT` for large result sets
- Use `ORDER BY` with indexed columns
- Use `EXISTS` instead of `COUNT(*)` when checking existence

### Frontend Optimizations

**Code Splitting:**
- Next.js automatic code splitting
- Dynamic imports for heavy components
- Lazy loading for dialogs

**Memoization:**
- `useMemo` for expensive computations
- `useCallback` for stable function references
- React.memo for expensive components

**Data Fetching:**
- Fetch only needed data
- Use pagination for large lists
- Cache frequently accessed data
- Debounce search inputs

### Real-time Optimizations

**Subscription Management:**
- Unsubscribe on component unmount
- Filter subscriptions to relevant data only
- Use specific filters to reduce payload size

---

## Additional Implementation Details

### Court Start Time Picker

**When Shown:**
- Venue is selected in event creation
- Venue has court times configured in `venue_court_times` table
- Location mode is 'venue' (not 'custom')

**Display:**
- Dropdown/Select component
- Shows "Custom Time" as first option
- Lists all court times in 12-hour format (e.g., "5:45 AM", "7:00 AM")
- Ordered by display_order, then start_time

**Behavior:**
- Selecting a court time sets event time to that value
- Selecting "Custom Time" shows regular time input
- If custom time is manually entered, court time picker shows "Custom Time" as selected

### Default Court Time

**When Applied:**
- Venue is selected in event creation
- Venue has `default_court_time` set
- Duration field is automatically populated

**Logic:**
- `LocationSelector` calls `onVenueSelected` callback with venue object
- Event creation dialog checks `venue.default_court_time`
- If present, sets duration state to that value

### Recurrence Series Management

**Series Identification:**
- All events in a series share the same `recurrence_series_id`
- Original event date stored in `recurrence_original_date`
- Pattern and end conditions stored on each event

**Editing:**
- Edit single occurrence: Updates only that event
- Edit series: Updates all events with same `recurrence_series_id`
- When editing series, can modify:
  - Event details (name, time, location, etc.)
  - Recurrence pattern
  - End conditions
  - Custom recurrence data

**Deletion:**
- Delete single: Deletes only that event
- Delete future: Deletes from this event onwards
- Delete series: Deletes all events with same `recurrence_series_id`

### Availability Grid

**Display:**
- Players in rows
- Events/matches in columns
- Color-coded cells:
  - Green: Available
  - Yellow: Maybe / Last Resort
  - Red: Unavailable
  - Gray: No Response

**Interaction:**
- Click cell to view/update availability
- Hover for quick status update
- Bulk operations for captains (clear availability)

### Lineup Drag-and-Drop

**Implementation:**
- Uses @dnd-kit library
- Players are draggable
- Court slots are droppable
- Visual feedback during drag
- Validation prevents conflicts

**Validation:**
- No duplicate player assignments
- All required slots must be filled
- Visual indicators for incomplete lineups

---

## Testing Recommendations

### Unit Tests

**Functions to Test:**
- `generateRecurringDates()` - All patterns and end conditions
- `validateRecurrenceConfig()` - All validation rules
- `getTeamColor()` - Hash-based color assignment
- Time formatting functions

### Integration Tests

**Flows to Test:**
- Event creation with recurrence
- Contact import flow
- Lineup wizard algorithm
- Availability default application
- Court time selection

### E2E Tests

**User Journeys:**
- Complete team creation flow
- Match creation and lineup building
- Event creation and availability responses
- Contact import and management
- Recurring event creation and editing

---

## Deployment Checklist

### Pre-Deployment

- [ ] All migrations run successfully
- [ ] RLS policies tested
- [ ] Environment variables configured
- [ ] Email service configured
- [ ] OpenAI API key configured (if using Rules Guru)
- [ ] PWA icons generated
- [ ] Error handling tested
- [ ] Performance tested

### Post-Deployment

- [ ] Verify authentication works
- [ ] Test email sending
- [ ] Verify real-time subscriptions
- [ ] Test on mobile devices
- [ ] Verify PWA installation
- [ ] Monitor error logs
- [ ] Check database performance

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Maintained By:** TennisLife Development Team

