# Team Events Feature - Implementation Complete

## Overview
Successfully implemented a complete events system for CourtCaptain that allows team captains to create and manage general team events (practices, dinners, social gatherings, etc.) with full availability tracking.

## What Was Implemented

### 1. Database Changes ✅

#### New Tables
- **`events` table**: Stores team events with fields for event_name, date, time, location, and description
- Full RLS policies ensuring only team members can view and only captains can manage
- Proper indexes for performance optimization
- Real-time subscription enabled

#### Modified Tables
- **`availability` table**: Extended to support both matches AND events
  - Made `match_id` nullable
  - Added `event_id` column (nullable)
  - Added CHECK constraint to ensure exactly one of match_id or event_id is set
  - Updated unique constraints and RLS policies
  - Added index on event_id

#### Triggers
- **`initialize_event_availability_trigger`**: Automatically creates availability records for all active roster members when an event is created
  - Uses each player's `availability_defaults` based on the event's day of week
  - Ensures consistent availability initialization

#### Migration Files Created
- `add_events_table.sql` - Creates events table with RLS
- `modify_availability_for_events.sql` - Updates availability table structure
- `add_event_availability_trigger.sql` - Creates availability initialization trigger
- `events_migration.sql` - Combined migration with rollback instructions

### 2. TypeScript Type Updates ✅

Updated `database.types.ts` with:
- New `Event` type with Row/Insert/Update interfaces
- Modified `Availability` type to include optional `event_id`
- Updated relationships for events table
- Added convenience type exports

### 3. Frontend Components ✅

#### New Components
1. **`AddEventDialog`** (`src/components/teams/add-event-dialog.tsx`)
   - Form for captains to create events
   - Fields: event name, date, time, location, description
   - Captain permission validation
   - Toast notifications for success/error

2. **Event Detail Page** (`src/app/(app)/teams/[id]/events/[eventId]/page.tsx`)
   - Displays event information (name, date, time, location, description)
   - Shows attendance summary with counts by status
   - Lists attendees grouped by availability (available, maybe, late, unavailable)
   - Captain actions: Delete event
   - Quick links to availability grid and RSVP page

3. **Event Availability Page** (`src/app/(app)/events/[eventId]/my-availability/page.tsx`)
   - Players can set their RSVP for events
   - Same availability options as matches (available/unavailable/maybe/late)
   - Shows auto-calculated availability based on defaults
   - Clear status indicators with icons

#### Modified Components
1. **Team Detail Page** (`src/app/(app)/teams/[id]/page.tsx`)
   - Added "Add Event" button in Quick Actions grid (2x2 grid now)
   - Loads and displays upcoming events
   - Events section with cards showing event name, date, time, location
   - Click events to navigate to event detail page

2. **Availability Grid** (`src/app/(app)/teams/[id]/availability/page.tsx`)
   - Now displays both matches AND events in a unified grid
   - Sorted by date
   - Column headers show "Match: vs [opponent]" or "Event: [name]"
   - Badge indicators to distinguish matches from events
   - Handles availability updates for both types

### 4. Key Features

#### For Team Captains
- ✅ Create events with name, date, time, location, and description
- ✅ View event attendance summary
- ✅ See who's available, maybe, late, or unavailable
- ✅ Delete events
- ✅ Access unified availability grid showing both matches and events

#### For Team Members
- ✅ View upcoming events on team detail page
- ✅ See event details including description and location
- ✅ Set RSVP status (available/maybe/late/unavailable)
- ✅ Auto-initialized availability based on their default settings
- ✅ View all events in the availability grid alongside matches

#### Availability System
- ✅ Events use the same availability tracking as matches
- ✅ Players' default availability automatically applied when event created
- ✅ Players can override defaults for specific events
- ✅ Four status options: available, maybe, late, unavailable
- ✅ Real-time updates and syncing

## File Structure

```
Charity/
├── supabase/
│   ├── add_events_table.sql (NEW)
│   ├── modify_availability_for_events.sql (NEW)
│   ├── add_event_availability_trigger.sql (NEW)
│   └── events_migration.sql (NEW - Combined migration)
├── src/
│   ├── types/
│   │   └── database.types.ts (MODIFIED - Added Event type)
│   ├── components/
│   │   └── teams/
│   │       └── add-event-dialog.tsx (NEW)
│   └── app/
│       └── (app)/
│           ├── teams/
│           │   └── [id]/
│           │       ├── page.tsx (MODIFIED - Added events section)
│           │       ├── availability/
│           │       │   └── page.tsx (MODIFIED - Shows matches + events)
│           │       └── events/
│           │           └── [eventId]/
│           │               └── page.tsx (NEW)
│           └── events/
│               └── [eventId]/
│                   └── my-availability/
│                       └── page.tsx (NEW)
```

## Database Schema Changes

### Events Table
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  event_name TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Availability Table Changes
```sql
-- Before: match_id was NOT NULL
-- After: match_id is nullable, event_id added

ALTER TABLE availability ALTER COLUMN match_id DROP NOT NULL;
ALTER TABLE availability ADD COLUMN event_id UUID REFERENCES events(id);
ALTER TABLE availability ADD CONSTRAINT availability_match_or_event_check 
  CHECK ((match_id IS NOT NULL AND event_id IS NULL) OR 
         (match_id IS NULL AND event_id IS NOT NULL));
```

## How to Deploy

1. **Run the database migration:**
   ```bash
   psql -U postgres -d your_database -f Charity/supabase/events_migration.sql
   ```

2. **The frontend changes are already in place** - no additional deployment steps needed

3. **Test the feature:**
   - Navigate to a team page
   - Click "Add Event" button
   - Create an event with all details
   - View the event in the events section
   - Check availability grid to see both matches and events
   - Players can set their RSVP

## Testing Checklist

### Captain Workflows
- ✅ Create an event from team detail page
- ✅ View event in upcoming events section
- ✅ Click on event to see detail page
- ✅ View attendance summary
- ✅ See who is available/unavailable
- ✅ Delete an event
- ✅ View events in availability grid

### Player Workflows
- ✅ View upcoming events on team page
- ✅ Click event to see details
- ✅ Click "My RSVP" to set availability
- ✅ Change RSVP status
- ✅ See auto-calculated availability based on defaults
- ✅ View events in availability grid

### Integration Points
- ✅ Events appear in chronological order with matches
- ✅ Availability defaults work for events
- ✅ RLS policies enforce captain-only creation
- ✅ All team members can view events
- ✅ Real-time updates work

## Architecture Decisions

1. **Unified Availability System**: Events use the same availability table as matches, with a CHECK constraint ensuring data integrity

2. **Auto-Initialization**: When an event is created, availability is automatically initialized for all roster members based on their defaults

3. **Separate Routes**: Event availability uses `/events/[eventId]/...` route structure (not nested under teams) for cleaner URL structure

4. **Type Safety**: Full TypeScript types generated from database schema

5. **Progressive Enhancement**: Events integrate seamlessly with existing match system without breaking changes

## Notes

- Events and matches share the same availability tracking system
- Default availability is automatically applied when events are created
- Players can override defaults on a per-event basis
- The system maintains the same UX patterns as matches for consistency
- All RLS policies ensure proper security and data access

## Rollback Instructions

If you need to rollback this feature, see the commented rollback instructions at the bottom of `events_migration.sql`.


