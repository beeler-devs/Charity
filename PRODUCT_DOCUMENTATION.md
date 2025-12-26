# TennisLife Product Documentation

**Version:** 1.0  
**Last Updated:** January 2025  
**Platform:** Progressive Web Application (PWA)

---

## Table of Contents

1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Team Management](#team-management)
4. [Match Management](#match-management)
5. [Event Management](#event-management)
6. [Personal Activities](#personal-activities)
7. [Availability System](#availability-system)
8. [Lineup Management](#lineup-management)
9. [Calendar & Scheduling](#calendar--scheduling)
10. [Messaging & Communication](#messaging--communication)
11. [Contacts Management](#contacts-management)
12. [Profile & Settings](#profile--settings)
13. [System Administration](#system-administration)
14. [Additional Features](#additional-features)

---

## Overview

TennisLife is a comprehensive Progressive Web Application designed for tennis team management, coordination, and player engagement. The app serves captains, players, and administrators with tools to manage teams, matches, events, availability, lineups, and communication.

### Key Capabilities

- **Team & Roster Management**: Create teams, manage rosters, import schedules
- **Match Coordination**: Track matches, manage lineups, enter scores
- **Event Planning**: Schedule team events and personal activities with recurring patterns
- **Availability Tracking**: Comprehensive availability system for players
- **Smart Lineup Building**: Drag-and-drop lineup builder with AI-powered suggestions
- **Calendar Integration**: Unified calendar view for all events and activities
- **Messaging**: Team chats and direct messages
- **Contact Management**: Import and manage contacts from your tennis network

---

## Core Features

### Navigation

The app features a bottom navigation bar with the following main sections:

- **Home**: Dashboard with upcoming matches and status overview
- **Calendar**: Unified calendar view (week/month) for all events
- **Activities**: Personal activities and team events
- **Availability**: Personal availability management
- **Teams**: Team list and management
- **Messages**: Team chats and direct messages
- **Contacts**: Contact address book
- **Profile**: User profile and settings

### Authentication

- Email/password authentication via Supabase Auth
- Automatic linking of roster members and event invitations on signup
- System admin role support
- User impersonation capability (admin only)

---

## Team Management

### Team Creation & Settings

**Location:** `/teams` → Create Team / `/teams/[id]/settings`

**Features:**
- Create new teams with organization, league, year, and team name
- Set team colors for visual identification
- Configure captain and co-captain roles
- Set total lines (number of courts) for matches
- Configure line match types (Singles/Doubles)
- Set default availability preferences
- Manage team-specific venues

**Team Settings Include:**
- Basic Information (name, organization, league, year)
- Team Colors (for calendar and UI)
- Roster Management
- Venue Management (team-specific venues)
- Match Configuration (total lines, match types)
- Default Availability Settings

### Roster Management

**Location:** `/teams/[id]/roster`

**Features:**
- View all roster members
- Add players manually or via CSV import
- Link roster members to app users by email
- View player details (name, email, phone, position)
- Manage active/inactive roster status
- Automatic linking of roster members when users sign up

**Roster Import:**
- CSV import support
- Automatic email matching for existing users
- Support for players not yet on the app

---

## Match Management

### Match List

**Location:** `/teams/[id]/matches`

**Features:**
- View all matches for a team
- Filter by status (upcoming, past, all)
- See match details: date, time, opponent, venue
- Quick access to lineup, availability, and scores

### Match Detail Page

**Location:** `/teams/[id]/matches/[matchId]`

**Features:**
- **Match Information:**
  - Date, time, venue
  - Opponent team details
  - Home/away status
  - Match status (upcoming, in progress, completed)

- **Availability Summary:**
  - Count of available, maybe, and unavailable players
  - Detailed player lists by availability status
  - Visual indicators for response status

- **Lineup Management:**
  - View current lineup
  - Quick access to lineup builder
  - See which players are in the lineup

- **Score Entry:**
  - Enter scores for each court/line
  - Track games won/lost per line
  - Final match result calculation

- **Match Day Checklist:**
  - 14-day, 10-day, 7-day, and 4-day task timeline
  - Send welcome email to opponent captain
  - Publish lineup to players
  - Track completion of match day tasks

### Lineup Builder

**Location:** `/teams/[id]/matches/[matchId]/lineup`

**Features:**
- **Drag-and-Drop Interface:**
  - Drag players from available list to court slots
  - Visual feedback during drag operations
  - Support for multiple courts/lines

- **Lineup Wizard™:**
  - AI-powered optimal pairing suggestions
  - Considers pair statistics (win %, games %)
  - Factors in fair play scores
  - Weighted scoring algorithm: (Win % × 0.4) + (Games % × 0.3) + (FairPlay × 0.3)
  - Generates top 3 non-overlapping pairs
  - One-click apply suggestions

- **Validation:**
  - Prevents duplicate player assignments
  - Ensures all required slots are filled
  - Visual indicators for incomplete lineups

- **Player Management:**
  - Filter by availability status
  - See player availability directly in builder
  - Remove players from lineup
  - Add players to lineup

- **Lineup Publishing:**
  - Send lineup emails to players
  - Separate emails for players in lineup vs. bench
  - Email templates with match details

### Score Entry

**Location:** `/teams/[id]/matches/[matchId]/enter-scores`

**Features:**
- Enter scores for each court/line
- Track individual game scores
- Automatic calculation of match result
- Support for different match formats
- Save and update scores

### Match History

**Location:** `/match-history`

**Features:**
- View all past matches across all teams
- Filter by team, date range, result
- See match results and scores
- Track win/loss record

---

## Event Management

### Team Events

**Location:** `/teams/[id]/events` → Create Event / `/teams/[id]/events/[eventId]`

**Features:**
- **Event Types:**
  - Practice
  - Match
  - Warm-up
  - Social/Fun
  - Other

- **Event Details:**
  - Event name
  - Date and time
  - Duration
  - Location (venue or custom)
  - Description
  - Event type badge with color coding

- **Recurring Events:**
  - Daily, weekly, or custom recurrence patterns
  - End by date, number of occurrences, or never
  - Custom recurrence: interval (e.g., every 2 weeks) with selected days
  - Edit single occurrence or entire series
  - Delete single, future, or entire series

- **Venue Selection:**
  - Choose from system-wide venues
  - Select team-specific venues
  - Add custom location
  - Default to specified venue (not custom)

- **Event Invitations:**
  - Invite team members
  - Invite non-app users via email
  - Unified search interface (name or email)
  - Visual indicators for app users vs. email-only
  - Recurrence scope selection (this occurrence, future, or all)
  - Email notifications for invitations

- **Event Management:**
  - Edit event details
  - Delete events (with scope options for recurring)
  - View attendees and invitations
  - Remove attendees/invitations
  - Send cancellation emails

### Event Detail Page

**Location:** `/teams/[id]/events/[eventId]`

**Features:**
- View complete event information
- See all attendees and invitations
- Respond to availability for event
- Edit event (if creator/captain)
- Delete event
- Manage invitations

---

## Personal Activities

### Activities List

**Location:** `/activities`

**Features:**
- View all personal activities
- Filter by activity type
- See upcoming and past activities
- Quick access to activity details

### Activity Types

**Configurable Types:**
- Scrimmage
- Lesson
- Class
- Flex League
- Booked Court
- Other

**Activity Type Configuration:**
- Location: `/settings/activity-types`
- Enable/disable activity types
- Reorder activity types (drag-and-drop)
- Customize which types appear in your app
- Each type has unique color badge

### Create/Edit Personal Activity

**Location:** `/activities` → Add Activity / `/activities/[eventId]`

**Features:**
- **Activity Details:**
  - Title
  - Activity type (with color-coded badges)
  - Date and time
  - Duration
  - Location (venue or custom)
  - Description
  - Max attendees
  - Cost

- **Recurring Activities:**
  - Daily, weekly, or custom recurrence
  - End by date, occurrences, or never
  - Custom recurrence with interval and selected days
  - Edit single occurrence or entire series
  - Delete with scope options

- **Invitations:**
  - Invite app users and non-app users
  - Search by name or email
  - Email notifications
  - Recurrence scope selection
  - Manage attendees and invitations

- **Activity Management:**
  - Edit activity details
  - Change activity type
  - Delete activities (single, future, or series)
  - Remove attendees/invitations
  - Send cancellation emails

### Activity Detail Page

**Location:** `/activities/[eventId]`

**Features:**
- Complete activity information
- Activity type badge
- Attendees and invitations list
- Edit activity (if creator)
- Delete activity with scope options
- Recurrence pattern display
- Location details

---

## Availability System

### Personal Availability

**Location:** `/availability` and `/settings/availability`

**Features:**
- **Default Availability:**
  - Set weekly availability patterns
  - Quick day selection (all days of week)
  - Time range selection (morning, afternoon, evening)
  - Detailed time slot grid (6 AM - 10 PM, 30-minute intervals)
  - Visual grid interface for fine-tuning

- **Match-Specific Availability:**
  - Respond to availability for individual matches
  - Quick responses: Available, Unavailable, Maybe, Late
  - See match date and time
  - Update response anytime

- **Event Availability:**
  - Respond to availability for team events
  - Quick response options
  - See event details

### Team Availability Grid

**Location:** `/teams/[id]/availability`

**Features:**
- **Mini-Grid View:**
  - Players in rows, events/matches in columns
  - Color-coded availability status:
    - Green: Available
    - Yellow: Maybe / Last Resort
    - Red: Unavailable
    - Gray: No Response
  - Click cells to view/update availability
  - Hover for quick status update

- **Filtering:**
  - Filter by event type
  - Filter by date range
  - Show/hide past events

- **Bulk Operations:**
  - Clear availability (admin/captain)
  - Export availability data

- **Real-time Updates:**
  - See availability changes immediately
  - Visual indicators for pending changes

---

## Lineup Management

### Lineup Builder Features

**Location:** `/teams/[id]/matches/[matchId]/lineup`

**Key Capabilities:**

1. **Drag-and-Drop Interface:**
   - Intuitive drag-and-drop for player placement
   - Visual feedback during operations
   - Support for multiple courts simultaneously

2. **Lineup Wizard™:**
   - AI-powered pairing suggestions
   - Analyzes historical pair performance
   - Considers win percentage, games percentage, and fair play scores
   - Generates optimal non-overlapping pairs
   - One-click application of suggestions

3. **Player Pool:**
   - Shows all available players
   - Filters by availability status
   - Displays player information (name, position)
   - Easy player selection

4. **Court Management:**
   - Configure number of courts/lines
   - Assign players to specific court positions
   - Visual court layout
   - Validation to prevent conflicts

5. **Lineup Publishing:**
   - Send lineup emails to players
   - Separate notifications for lineup vs. bench
   - Include match details in emails

### Lineup Statistics

- Tracks pair statistics (wins, games, matches together)
- Calculates win percentages
- Fair play score integration
- Historical performance data

---

## Calendar & Scheduling

### Calendar View

**Location:** `/calendar`

**Features:**
- **View Modes:**
  - Week view (1-4 weeks configurable)
  - Month view
  - Day view (future)

- **Event Display:**
  - Team events (color-coded by team)
  - Personal activities (dark red color)
  - Match events
  - All event types with badges

- **Filtering:**
  - Filter by team (color-coded buttons)
  - Filter by event type (color-coded buttons)
  - Toggle personal activities on/off
  - Multiple selection support

- **Event Type Badges:**
  - Match: Green
  - Practice: Blue
  - Warm-up: Orange
  - Social/Fun: Purple
  - Other: Gray

- **Activity Type Badges:**
  - Scrimmage: Green
  - Lesson: Indigo
  - Class: Teal
  - Flex League: Amber
  - Booked Court: Violet
  - Other: Gray

- **Navigation:**
  - Previous/next week/month
  - Jump to today
  - Date picker for quick navigation

- **Event Details:**
  - Click events to view details
  - See event type, time, location
  - Quick access to event pages

### Calendar Integration

- All team events appear on calendar
- Personal activities integrated
- Match dates displayed
- Color coding for visual organization
- Badge system for quick identification

---

## Messaging & Communication

### Messages List

**Location:** `/messages`

**Features:**
- View all conversations (team chats and DMs)
- See last message preview
- Unread message indicators
- Timestamp for last message
- Quick access to conversations

### Team Chat

**Location:** `/messages/[id]` (team conversations)

**Features:**
- Real-time messaging
- See all team members
- Message history
- Read receipts
- Typing indicators (future)
- File attachments (future)

### Direct Messages

**Location:** `/messages/[id]` (DM conversations)

**Features:**
- One-on-one messaging
- Private conversations
- Message history
- Read receipts

### Notifications

**Header Notifications:**
- Recent messages dropdown
- Unread message indicator
- Quick access to conversations
- Real-time updates

**Email Notifications:**
- Event invitations
- Lineup notifications
- Match reminders
- Event cancellations

---

## Contacts Management

### Contacts List

**Location:** `/contacts`

**Features:**
- View all contacts
- Search contacts
- Filter by relationship type
- See team associations
- Quick access to contact details

### Contact Import

**Location:** `/contacts` → Sync from Network

**Features:**
- **Network Sync:**
  - Import contacts from teams you're on
  - Preview potential contacts before importing
  - Select specific contacts to import
  - See which contacts already exist
  - Group by team

- **Contact Selection:**
  - Check/uncheck individual contacts
  - Select all / deselect all
  - See contact information (name, email, team)
  - Visual indicators for existing contacts

- **Automatic Import:**
  - Imports selected contacts
  - Sets relationship type to "teammate"
  - Links to profiles if user exists
  - Creates contact records

### Contact Details

**Location:** `/contacts/[id]`

**Features:**
- **Contact Information:**
  - Name, email, phone
  - Relationship type
  - Tags
  - Notes

- **Team Associations:**
  - "Teams Together" section
  - Shows all teams you were on together
  - Displays league, year, and team name
  - Organized by organization

- **Contact Management:**
  - Edit contact details
  - Delete contact
  - Add tags
  - Update relationship type

### Contact Management

- Add contacts manually
- Edit contact information
- Delete contacts
- Tag contacts
- Set relationship types
- Add notes

---

## Profile & Settings

### User Profile

**Location:** `/profile`

**Features:**
- **Profile Information:**
  - Full name
  - Email address
  - Phone number
  - Profile photo (future)

- **Settings Access:**
  - Default Availability
  - Activity Types Configuration
  - Account settings
  - Notification preferences

### Default Availability Settings

**Location:** `/settings/availability`

**Features:**
- Set weekly availability patterns
- Quick day selection
- Time range selection
- Detailed time slot grid
- Save as default for all matches/events

### Activity Types Configuration

**Location:** `/settings/activity-types`

**Features:**
- Enable/disable activity types
- Reorder activity types (drag-and-drop)
- Customize which types appear
- Each type has unique color badge
- Save preferences

### User Profile View

**Location:** `/users/[id]`

**Features:**
- View other users' public profiles
- See teams in common
- Contact information (if shared)

---

## System Administration

### Admin Dashboard

**Location:** `/admin`

**Features:**
- System-wide administration
- Access to venue management
- User management
- System settings

**Access:**
- System admin role required
- Designated in user profile

### Venue Management

**Location:** `/admin/venues`

**Features:**
- **Venue CRUD:**
  - Create system-wide venues
  - Edit venue information
  - Delete venues
  - Activate/deactivate venues

- **Venue Details:**
  - Name
  - Address
  - Google Maps link
  - Region (geographic organization)
  - Default court time (in minutes)
  - Active status

- **Venue Features:**
  - Filter by region
  - Search venues
  - View all venues (active and inactive)
  - Set default court time (15-180 minutes)
  - Pre-configured venues: Tennis Center Sand Point, Nordstrom Tennis Center, Amy Yee Tennis Center (75 minutes)

### User Management

**Location:** `/admin/users`

**Features:**
- View all users
- Edit user profiles
- Manage system admin roles
- View user activity
- Impersonation capability (for support)

---

## Additional Features

### Rules Guru (AI Assistant)

**Location:** `/rules`

**Features:**
- AI-powered tennis rules assistant
- Powered by OpenAI GPT-4
- Answers questions about:
  - USTA regulations
  - Friend at Court 2025
  - SACT CUP Bylaws
- Quick rule buttons for common questions
- Chat interface
- Context-aware responses

**Quick Rules:**
- What is a let serve?
- Foot fault rules
- Tie-break scoring
- Time between points
- Code violation penalties

### Play Features (Coming Soon)

**Location:** `/play`

**Features:**
- **Find a Partner:**
  - Search for available players
  - Match by skill level
  - Location-based search

- **Find a Fourth:**
  - Post requests for doubles players
  - Find players needing a fourth

- **Find Opponents:**
  - Challenge other teams
  - Schedule friendly matches

*Note: These features are planned but not yet implemented.*

### Match Day Checklist

**Features:**
- 14-day, 10-day, 7-day, and 4-day task timeline
- Send welcome email to opponent captain
- Publish lineup to players
- Track task completion
- Visual progress indicators

### Email Templates

The app includes several email templates:

1. **Auto-Welcome Email:**
   - Sent to opponent captain
   - Includes match details
   - Manual trigger via checklist

2. **Lineup Playing Email:**
   - Sent to players in lineup
   - Includes match details and lineup
   - Confirmation of playing status

3. **Lineup Bench Email:**
   - Sent to players not in lineup
   - Notification of bench status
   - Match details included

4. **Event Invitation Email:**
   - Sent when inviting to events/activities
   - Includes event details
   - Works for app users and non-app users

5. **Event Canceled Email:**
   - Sent when removed from event
   - Notification of cancellation
   - Event details included

### Recurring Events System

**Unified Recurrence Logic:**
- Shared recurrence utilities for all event types
- Consistent implementation across:
  - Team events
  - Personal activities
  - Any future event types

**Recurrence Patterns:**
- Daily
- Weekly
- Custom (with interval and selected days)

**End Conditions:**
- End by date
- End by number of occurrences
- Never end (with reasonable limit)

**Custom Recurrence:**
- Set interval (e.g., every 2 weeks)
- Select time unit (day, week, month, year)
- For weekly: select specific days of week
- Maintains same day of week for intervals

**Recurrence Management:**
- Edit single occurrence
- Edit entire series
- Delete single occurrence
- Delete future occurrences
- Delete entire series

### Location/Venue System

**Unified Location Selector:**
- Shared component for all event types
- Consistent venue selection
- Support for system-wide and team-specific venues
- Custom location option
- Default to specified venue (not custom)

**Venue Features:**
- System-wide venues (managed by admins)
- Team-specific venues (managed by captains)
- Default court time per venue
- Google Maps integration
- Region organization

### Event Invitations

**Unified Invitation System:**
- Works for team events and personal activities
- Invite app users and non-app users
- Search by name or email
- Visual indicators for user status
- Email notifications
- Recurrence scope selection

**Invitation Management:**
- Accept/decline invitations
- View invitation status
- Remove invitations (creators)
- Send cancellation emails

### Contact Sync

**Network-Based Contact Import:**
- Import contacts from teams you're on
- Preview before importing
- Select specific contacts
- Automatic relationship tagging
- Link to user profiles
- Support for multiple teams per contact

---

## Technical Features

### Progressive Web App (PWA)

- Installable on mobile devices
- Offline capability (future)
- Push notifications (future)
- App-like experience

### Real-time Updates

- Real-time messaging
- Live availability updates
- Instant notification delivery
- Real-time calendar updates

### Data Security

- Row Level Security (RLS) in Supabase
- User authentication required
- Role-based access control
- Secure API endpoints

### Performance

- Optimized database queries
- Efficient data loading
- Lazy loading where appropriate
- Caching strategies

---

## User Roles & Permissions

### Regular User

- Create and manage personal activities
- Respond to availability
- View team information
- Participate in team chats
- Manage contacts

### Team Captain

- All regular user permissions
- Create and edit team events
- Manage team roster
- Build and publish lineups
- Enter match scores
- Manage team availability
- Send lineup emails

### Co-Captain

- Same permissions as captain
- Can perform all captain functions

### System Admin

- All user permissions
- Manage system-wide venues
- Manage all users
- View system-wide data
- Impersonation capability

---

## Mobile Experience

### Responsive Design

- Optimized for mobile devices
- Touch-friendly interfaces
- Bottom navigation for easy access
- Swipe gestures (where applicable)

### Mobile-Specific Features

- Bottom navigation bar
- Touch-optimized drag-and-drop
- Mobile-friendly forms
- Responsive calendar views
- Optimized availability grids

---

## Future Enhancements

### Planned Features

- **Play Features:**
  - Find a Partner
  - Find a Fourth
  - Find Opponents

- **Enhanced Messaging:**
  - File attachments
  - Typing indicators
  - Message reactions

- **Advanced Statistics:**
  - Player performance tracking
  - Team statistics
  - Historical data analysis

- **Offline Support:**
  - Offline mode
  - Data synchronization
  - Offline availability responses

- **Push Notifications:**
  - Match reminders
  - Availability requests
  - Message notifications

---

## Support & Resources

### Getting Help

- In-app help (future)
- User documentation
- Support email
- FAQ section (future)

### Training Resources

- User guides (future)
- Video tutorials (future)
- Best practices documentation

---

## Version History

### Version 1.0 (Current)

- Initial release
- Core team management features
- Match and event management
- Availability system
- Lineup builder
- Calendar integration
- Messaging system
- Contact management
- Personal activities
- Recurring events
- Event invitations
- System administration
- Rules Guru AI assistant

---

## Appendix

### Technical Specification

For complete technical documentation including database schema, API endpoints, component architecture, business logic, and implementation details, see **[TECHNICAL_SPECIFICATION.md](./TECHNICAL_SPECIFICATION.md)**.

The technical specification includes:
- Complete database schema with all tables, columns, relationships, constraints, indexes, and RLS policies
- All API endpoints with request/response formats
- Component architecture and UI patterns
- Business logic and algorithms (lineup wizard, recurrence generation, contact sync, etc.)
- Authentication and authorization flows
- State management patterns
- Real-time features implementation
- Email service integration
- File structure and organization
- Configuration and environment setup
- Data models and TypeScript types
- UI/UX patterns and design system
- Complete workflows and user journeys
- Error handling strategies
- Performance optimizations
- Testing recommendations
- Deployment checklist

This technical specification is designed to be comprehensive enough to rebuild the entire application from scratch.

### Keyboard Shortcuts

- *Coming soon*

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Maintained By:** TennisLife Development Team

