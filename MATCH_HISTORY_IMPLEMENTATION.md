# Match History System - Implementation Complete

## Overview
This document describes the match history and statistics system that has been implemented for CourtCaptain/TennisLife.

## Features Implemented

### 1. Database Schema
- **individual_statistics** table: Tracks player performance per team
  - matches_played, matches_won, matches_lost
  - sets_won, sets_lost
  - games_won, games_lost
  - win_percentage (auto-calculated)

- **team_statistics** table: Tracks overall team performance
  - total_matches, wins, losses, ties
  - win_percentage (auto-calculated)
  - total_games_won, total_games_lost

- **Database Triggers**: Auto-update statistics when scores are entered
  - `update_statistics_from_match()`: Updates pair and individual stats
  - `update_team_statistics()`: Updates team stats when match result is set

### 2. Score Entry System
- **ScoreEntryDialog**: Complete dialog for entering match scores
  - Supports both CUP and USTA formats
  - CUP: Single "set" with total games
  - USTA: Up to 3 sets with tiebreak support
  - Auto-calculates match result (win/loss/tie)
  
- **CourtScoreCard**: Individual court score entry component
  - Different UI for CUP vs USTA modes
  - Real-time set winner calculation
  - Visual feedback for court won/lost

- **Match Result Badge**: Displays match outcomes
  - Color-coded (green=win, red=loss, yellow=tie)
  - Shows score summary (e.g., "Won 3-0")

### 3. Score Display
- **Match Detail Page**: 
  - "Enter Scores" button (captains only, after match date)
  - Court-by-court score display
  - Match result badge

- **Past Matches Tab**: Separate tab on team matches page
  - Shows all past matches with results
  - Match result badges for each match

### 4. Statistics Display
- **Home Page**: Lifetime statistics card
  - Total matches played
  - Win/loss record
  - Win percentage
  - Displays in right column below "My Teams"

- **Profile Page**: Detailed statistics by team
  - Per-team breakdown
  - Overall totals across all teams
  - Matches, wins, losses, games won/lost

- **Team Detail Page**: Team season record
  - Win-loss-tie record
  - Win percentage
  - Breakdown by wins/losses/ties

## Files Created

### Database
1. `supabase/add_individual_statistics.sql` - Creates statistics tables
2. `supabase/add_statistics_triggers.sql` - Creates triggers for auto-updates

### Utilities
3. `src/lib/score-utils.ts` - Score calculation helpers
   - calculateMatchResult()
   - generateScoreSummary()
   - calculateSetWinner()
   - formatScoreDisplay()
   - And more validation/calculation functions

### Components
4. `src/components/matches/court-score-card.tsx` - Single court score entry
5. `src/components/matches/score-entry-dialog.tsx` - Full match score entry dialog
6. `src/components/matches/match-result-badge.tsx` - Match result display

### Updated Files
7. `src/app/(app)/teams/[id]/matches/[matchId]/page.tsx` - Added score entry
8. `src/app/(app)/teams/[id]/matches/page.tsx` - Added Past Matches tab
9. `src/app/(app)/home/page.tsx` - Added lifetime statistics
10. `src/app/(app)/profile/page.tsx` - Added individual statistics
11. `src/app/(app)/teams/[id]/page.tsx` - Added team statistics

## Setup Instructions

### 1. Run Database Migrations
```bash
# Connect to your Supabase database and run:
psql -h <your-supabase-host> -U postgres -d postgres -f supabase/add_individual_statistics.sql
psql -h <your-supabase-host> -U postgres -d postgres -f supabase/add_statistics_triggers.sql
```

Or run them through the Supabase SQL Editor:
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy contents of `add_individual_statistics.sql` and execute
4. Copy contents of `add_statistics_triggers.sql` and execute

### 2. Regenerate TypeScript Types (Optional)
```bash
npx supabase gen types typescript --project-id <your-project-id> > src/types/database.types.ts
```

### 3. Test the Flow
Follow the testing checklist below.

## Testing Checklist

### A. Score Entry (Captain)
- [ ] Navigate to a past match (date <= today)
- [ ] Click "Enter Scores" button (should only appear for captains)
- [ ] Score Entry Dialog opens
- [ ] See all courts from the lineup
- [ ] **CUP Mode**: Enter games won for each court
- [ ] **USTA Mode**: Enter sets (up to 3) with tiebreak checkboxes
- [ ] Current score updates as you enter data
- [ ] Click "Save Scores"
- [ ] Verify toast notification appears
- [ ] Verify match result badge appears on match detail page
- [ ] Verify court-by-court breakdown displays

### B. Past Matches Display
- [ ] Navigate to Team → Matches
- [ ] See two tabs: "Upcoming" and "Past"
- [ ] Click "Past" tab
- [ ] See all past matches
- [ ] Each past match shows result badge (Win/Loss/Tie)
- [ ] Click a past match to view details

### C. Statistics Display

#### Home Page
- [ ] Navigate to Home
- [ ] See "My Stats" card in right column (if you have played matches)
- [ ] Verify: Wins, Losses, Total Played
- [ ] Verify: Win Rate percentage
- [ ] Verify: W-L record display

#### Profile Page
- [ ] Navigate to Profile
- [ ] See "My Statistics" section (if you have played matches)
- [ ] Each team shows separately with stats
- [ ] If multiple teams, see "Overall" section at bottom
- [ ] Verify: Matches Played, Won, Lost, Games Won/Lost per team

#### Team Detail Page
- [ ] Navigate to a Team
- [ ] See "Season Record" card (if team has match results)
- [ ] Verify: Win-Loss-Tie record
- [ ] Verify: Win percentage badge
- [ ] Verify: Breakdown shows Played/Won/Lost/Tied

### D. Database Triggers
- [ ] Enter scores for a match
- [ ] Query `individual_statistics` table - verify both players' stats updated
- [ ] Query `pair_statistics` table - verify pair stats updated
- [ ] Query `team_statistics` table - verify team stats updated
- [ ] Enter scores for another match with same players
- [ ] Verify statistics incremented correctly (not duplicated)

### E. Edge Cases
- [ ] Try to enter scores for a future match (should not see button)
- [ ] Try to enter scores as non-captain (should not see button)
- [ ] Edit previously entered scores (click "Edit Scores" button)
- [ ] Verify statistics recalculate correctly
- [ ] Enter scores that result in a tie (equal courts won)
- [ ] Verify tie badge appears and team stats show tie count

## Database Queries for Verification

### Check Individual Statistics
```sql
SELECT 
  is.*, 
  rm.full_name, 
  t.name as team_name
FROM individual_statistics is
JOIN roster_members rm ON is.player_id = rm.id
JOIN teams t ON is.team_id = t.id
ORDER BY is.updated_at DESC
LIMIT 10;
```

### Check Pair Statistics
```sql
SELECT 
  ps.*,
  p1.full_name as player1_name,
  p2.full_name as player2_name,
  t.name as team_name
FROM pair_statistics ps
JOIN roster_members p1 ON ps.player1_id = p1.id
JOIN roster_members p2 ON ps.player2_id = p2.id
JOIN teams t ON ps.team_id = t.id
ORDER BY ps.updated_at DESC
LIMIT 10;
```

### Check Team Statistics
```sql
SELECT 
  ts.*,
  t.name as team_name
FROM team_statistics ts
JOIN teams t ON ts.team_id = t.id
ORDER BY ts.updated_at DESC;
```

### Check Match Scores
```sql
SELECT 
  ms.*,
  m.opponent_name,
  m.date,
  l.court_slot
FROM match_scores ms
JOIN lineups l ON ms.lineup_id = l.id
JOIN matches m ON l.match_id = m.id
ORDER BY ms.created_at DESC
LIMIT 20;
```

## Troubleshooting

### Statistics Not Updating
1. **Check Triggers**: Verify triggers are created
   ```sql
   SELECT trigger_name, event_object_table, action_statement 
   FROM information_schema.triggers 
   WHERE trigger_schema = 'public';
   ```

2. **Check RLS Policies**: Verify policies allow system updates
   ```sql
   SELECT * FROM pg_policies WHERE tablename IN ('individual_statistics', 'pair_statistics', 'team_statistics');
   ```

3. **Manual Trigger Test**: Insert a test score and check if stats update

### Score Entry Not Working
1. **Verify lineup exists**: Check `lineups` table for the match
2. **Verify user is captain**: Check team's captain_id or co_captain_id
3. **Check console for errors**: Open browser DevTools
4. **Verify RLS policies**: User must be team member to insert scores

### Statistics Not Displaying
1. **Check data exists**: Run the verification queries above
2. **Check roster_members**: User must have roster_member records
3. **Reload page**: Statistics load on page mount

## Performance Considerations

- Statistics are calculated via triggers, so there's no delay in UI
- Individual/pair statistics use UPSERT, preventing duplicates
- Win percentages are calculated and stored (not computed on each query)
- Statistics only load once per page view (no real-time updates needed)

## Future Enhancements

Potential additions not included in this implementation:
- [ ] Historical trends/graphs (win rate over time)
- [ ] Head-to-head records vs specific opponents
- [ ] Court-specific performance (D1 vs D2 vs D3)
- [ ] Export statistics to PDF/CSV
- [ ] Season-by-season breakdown
- [ ] Match streak tracking (current winning/losing streak)
- [ ] Advanced pair chemistry insights for Lineup Wizard

## Notes

- Statistics are immutable historical data - even if a player is removed from a roster, their statistics remain
- Editing scores will recalculate statistics (triggers handle this)
- Team statistics only count when match_result is set to win/loss/tie (not 'pending')
- RLS policies ensure users can only view statistics for teams they're members of

