-- TennisLife PWA Database Schema
-- Supabase PostgreSQL
-- FIXED: Addresses RLS recursion, singles matches, data integrity, and optimizations

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users profile table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  ntrp_rating DECIMAL(2,1),
  avatar_url TEXT,
  availability_defaults JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  captain_id UUID REFERENCES profiles(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  co_captain_id UUID REFERENCES profiles(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  league_format TEXT CHECK (league_format IN ('USTA', 'CUP', 'FLEX')) DEFAULT 'USTA',
  season TEXT,
  rating_limit DECIMAL(2,1),
  fee_per_team DECIMAL(10,2) DEFAULT 0,
  venue_address TEXT,
  warmup_policy TEXT,
  welcome_template_id UUID,
  home_phones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roster members table
CREATE TABLE IF NOT EXISTS roster_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT,
  full_name TEXT NOT NULL,
  phone TEXT,
  ntrp_rating DECIMAL(2,1),
  role TEXT CHECK (role IN ('captain', 'co-captain', 'player')) DEFAULT 'player',
  fair_play_score INTEGER DEFAULT 100,
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  availability_defaults JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, email)
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NOT NULL,
  venue TEXT,
  venue_address TEXT,
  opponent_name TEXT NOT NULL,
  opponent_captain_name TEXT,
  opponent_captain_email TEXT,
  opponent_captain_phone TEXT,
  is_home BOOLEAN DEFAULT true,
  warm_up_status TEXT CHECK (warm_up_status IN ('booked', 'none_yet', 'no_warmup')) DEFAULT 'none_yet',
  warm_up_time TIME,
  warm_up_court TEXT,
  checklist_status JSONB DEFAULT '{"14d": false, "10d": false, "7d": false, "4d": false}'::jsonb,
  match_result TEXT CHECK (match_result IN ('win', 'loss', 'tie', 'pending')) DEFAULT 'pending',
  score_summary TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Availability table
CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roster_member_id UUID NOT NULL REFERENCES roster_members(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('available', 'unavailable', 'maybe', 'late')) NOT NULL,
  comment TEXT,
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(roster_member_id, match_id)
);

-- Lineups table
CREATE TABLE IF NOT EXISTS lineups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  court_slot INTEGER NOT NULL CHECK (court_slot >= 1 AND court_slot <= 5),
  player1_id UUID REFERENCES roster_members(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES roster_members(id) ON DELETE SET NULL,
  combined_rating DECIMAL(3,1),
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, court_slot)
);

-- Checklist templates table
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  items JSONB DEFAULT '[
    {"days": 14, "task": "Order balls", "completed": false},
    {"days": 10, "task": "Email opponent captain", "completed": false},
    {"days": 7, "task": "Book warm-up court", "completed": false},
    {"days": 4, "task": "Post lineup", "completed": false}
  ]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opponents database table
CREATE TABLE IF NOT EXISTS opponents_db (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  ntrp DECIMAL(2,1),
  notes TEXT,
  tags TEXT[],
  win_percentage DECIMAL(5,2),
  games_percentage DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('welcome', 'lineup_playing', 'lineup_bench', 'reminder', 'custom')),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT CHECK (status IN ('sent', 'failed', 'pending')) DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- My courts (user reservations)
CREATE TABLE IF NOT EXISTS court_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_name TEXT NOT NULL,
  court_number TEXT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match scores (for live scoring)
CREATE TABLE IF NOT EXISTS match_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lineup_id UUID NOT NULL REFERENCES lineups(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL CHECK (set_number >= 1 AND set_number <= 3),
  home_games INTEGER DEFAULT 0,
  away_games INTEGER DEFAULT 0,
  tiebreak_home INTEGER,
  tiebreak_away INTEGER,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lineup_id, set_number)
);

-- Player pair statistics (for Lineup Wizard)
CREATE TABLE IF NOT EXISTS pair_statistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES roster_members(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES roster_members(id) ON DELETE CASCADE,
  matches_together INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  total_games_won INTEGER DEFAULT 0,
  total_games_played INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, player1_id, player2_id)
);

-- Indexes for performance
CREATE INDEX idx_roster_members_team ON roster_members(team_id);
CREATE INDEX idx_roster_members_user ON roster_members(user_id);
CREATE INDEX idx_roster_members_email ON roster_members(email); -- OPTIMIZATION: For invite lookups
CREATE INDEX idx_matches_team ON matches(team_id);
CREATE INDEX idx_matches_date ON matches(date);
CREATE INDEX idx_matches_team_date ON matches(team_id, date); -- OPTIMIZATION: Composite index for team+date queries
CREATE INDEX idx_availability_match ON availability(match_id);
CREATE INDEX idx_availability_member ON availability(roster_member_id);
CREATE INDEX idx_lineups_match ON lineups(match_id);
CREATE INDEX idx_email_logs_match ON email_logs(match_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE opponents_db ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pair_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_reads ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS (FIX #1: Prevent RLS Recursion)
-- ============================================================================

-- Helper function to check team membership without triggering RLS recursion
-- SECURITY DEFINER means this function runs with the privileges of the creator (admin),
-- bypassing the RLS on the tables it queries.
CREATE OR REPLACE FUNCTION is_team_member(_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM roster_members
    WHERE team_id = _team_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is a team captain
CREATE OR REPLACE FUNCTION is_team_captain(_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM teams
    WHERE id = _team_id
    AND (captain_id = auth.uid() OR co_captain_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if two users share at least one team
CREATE OR REPLACE FUNCTION shares_team_with(_other_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM roster_members rm1
    JOIN roster_members rm2 ON rm1.team_id = rm2.team_id
    WHERE rm1.user_id = auth.uid()
    AND rm2.user_id = _other_user_id
    AND rm1.is_active = true
    AND rm2.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES (FIXED: Using helper functions to avoid recursion)
-- ============================================================================

-- Profiles: Users can read all profiles, update their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

-- Teams: Members can view teams they belong to (FIXED)
CREATE POLICY "Team members can view team" ON teams FOR SELECT
  USING (
    captain_id = auth.uid() OR
    co_captain_id = auth.uid() OR
    is_team_member(id) -- Uses the helper function to avoid recursion
  );

CREATE POLICY "Captains can update team" ON teams FOR UPDATE
  USING (captain_id = auth.uid() OR co_captain_id = auth.uid());

CREATE POLICY "Users can create teams" ON teams FOR INSERT WITH CHECK (captain_id = auth.uid());

CREATE POLICY "Captains can delete team" ON teams FOR DELETE
  USING (captain_id = auth.uid());

-- Roster members: Team members can view roster (FIXED)
CREATE POLICY "Team members can view roster" ON roster_members FOR SELECT
  USING (
    is_team_captain(team_id) OR
    is_team_member(team_id)
  );

CREATE POLICY "Captains can manage roster" ON roster_members FOR ALL
  USING ( is_team_captain(team_id) );

-- Matches: Team members can view matches (FIXED)
CREATE POLICY "Team members can view matches" ON matches FOR SELECT
  USING ( is_team_captain(team_id) OR is_team_member(team_id) );

CREATE POLICY "Captains can manage matches" ON matches FOR ALL
  USING ( is_team_captain(team_id) );

-- Availability: Members can manage their own availability
CREATE POLICY "Members can view availability" ON availability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roster_members rm
      JOIN matches m ON m.id = availability.match_id
      JOIN teams t ON t.id = m.team_id
      WHERE rm.id = availability.roster_member_id
      AND (t.captain_id = auth.uid() OR t.co_captain_id = auth.uid() OR rm.user_id = auth.uid())
    )
  );

CREATE POLICY "Members can update own availability" ON availability FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM roster_members rm
      WHERE rm.id = availability.roster_member_id AND rm.user_id = auth.uid()
    )
  );

-- Lineups: Team members can view, captains can manage (FIXED)
CREATE POLICY "Team members can view lineups" ON lineups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = lineups.match_id
      AND (is_team_captain(m.team_id) OR is_team_member(m.team_id))
    )
  );

CREATE POLICY "Captains can manage lineups" ON lineups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = lineups.match_id
      AND is_team_captain(m.team_id)
    )
  );

-- Court reservations: Users can manage their own
CREATE POLICY "Users can manage own reservations" ON court_reservations FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- RLS POLICIES FOR CHAT TABLES
-- ============================================================================

-- Conversations: Team members can view team chats, DM participants can view DMs
CREATE POLICY "Users can view team conversations" ON conversations FOR SELECT
  USING (
    kind = 'team' AND (
      is_team_captain(team_id) OR 
      is_team_member(team_id)
    )
  );

CREATE POLICY "Users can view their DM conversations" ON conversations FOR SELECT
  USING (
    kind = 'dm' AND (
      auth.uid() = dm_user1 OR 
      auth.uid() = dm_user2
    )
  );

-- Team members can create team conversations
CREATE POLICY "Team members can create team conversations" ON conversations FOR INSERT
  WITH CHECK (
    kind = 'team' AND (
      is_team_captain(team_id) OR 
      is_team_member(team_id)
    )
  );

-- Users can create DM conversations with teammates
CREATE POLICY "Users can create DM conversations" ON conversations FOR INSERT
  WITH CHECK (
    kind = 'dm' AND
    (auth.uid() = dm_user1 OR auth.uid() = dm_user2) AND
    dm_user1 < dm_user2 AND
    shares_team_with(CASE WHEN auth.uid() = dm_user1 THEN dm_user2 ELSE dm_user1 END)
  );

-- Conversations can be updated for metadata
CREATE POLICY "Conversation participants can update metadata" ON conversations FOR UPDATE
  USING (
    (kind = 'team' AND (is_team_captain(team_id) OR is_team_member(team_id))) OR
    (kind = 'dm' AND (auth.uid() = dm_user1 OR auth.uid() = dm_user2))
  );

-- Messages: Users can view messages in accessible conversations
CREATE POLICY "Users can view messages in accessible conversations" ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        (c.kind = 'team' AND (is_team_captain(c.team_id) OR is_team_member(c.team_id))) OR
        (c.kind = 'dm' AND (auth.uid() = c.dm_user1 OR auth.uid() = c.dm_user2))
      )
    )
  );

-- Users can send messages in accessible conversations
CREATE POLICY "Users can send messages in accessible conversations" ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        (c.kind = 'team' AND (is_team_captain(c.team_id) OR is_team_member(c.team_id))) OR
        (c.kind = 'dm' AND (auth.uid() = c.dm_user1 OR auth.uid() = c.dm_user2))
      )
    )
  );

-- Conversation reads: Users can manage their own read status
CREATE POLICY "Users can view own read status" ON conversation_reads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own read status" ON conversation_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can upsert own read status" ON conversation_reads FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roster_members_updated_at BEFORE UPDATE ON roster_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_availability_updated_at BEFORE UPDATE ON availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lineups_updated_at BEFORE UPDATE ON lineups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FIX #2: Calculate lineup rating (handles Singles matches with NULL player2_id)
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_lineup_rating()
RETURNS TRIGGER AS $$
DECLARE
  p1_rating DECIMAL;
  p2_rating DECIMAL;
BEGIN
  -- Get Player 1 Rating
  IF NEW.player1_id IS NOT NULL THEN
    SELECT ntrp_rating INTO p1_rating
    FROM profiles
    WHERE id = (SELECT user_id FROM roster_members WHERE id = NEW.player1_id);

    -- Fallback if profile doesn't exist, check roster snapshot
    IF p1_rating IS NULL THEN
      SELECT ntrp_rating INTO p1_rating FROM roster_members WHERE id = NEW.player1_id;
    END IF;
  ELSE
    p1_rating := 0;
  END IF;

  -- Get Player 2 Rating (Handle NULL for Singles)
  IF NEW.player2_id IS NOT NULL THEN
    SELECT ntrp_rating INTO p2_rating
    FROM profiles
    WHERE id = (SELECT user_id FROM roster_members WHERE id = NEW.player2_id);

    IF p2_rating IS NULL THEN
      SELECT ntrp_rating INTO p2_rating FROM roster_members WHERE id = NEW.player2_id;
    END IF;
  ELSE
    p2_rating := 0;
  END IF;

  -- Sum them up (COALESCE handles any remaining NULLs)
  NEW.combined_rating := COALESCE(p1_rating, 0) + COALESCE(p2_rating, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_lineup_rating_trigger
  BEFORE INSERT OR UPDATE ON lineups
  FOR EACH ROW
  WHEN (NEW.player1_id IS NOT NULL) -- Only requires player1 (singles or doubles)
  EXECUTE FUNCTION calculate_lineup_rating();

-- ============================================================================
-- FIX #3: Data Integrity - Ensure roster email matches user email
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_roster_email_on_user_link()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- When user_id is being added to a roster_member, verify email matches
  IF NEW.user_id IS NOT NULL AND OLD.user_id IS NULL THEN
    SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;

    IF user_email IS NOT NULL AND NEW.email IS NOT NULL AND user_email != NEW.email THEN
      RAISE EXCEPTION 'Email mismatch: user email (%) does not match roster email (%)', user_email, NEW.email;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_roster_email_trigger
  BEFORE UPDATE ON roster_members
  FOR EACH ROW
  EXECUTE FUNCTION validate_roster_email_on_user_link();

-- ============================================================================
-- Function to create profile on user signup
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_app_meta_data->>'full_name',
      NULL
    )
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent errors if profile already exists
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- Chat and messaging tables
-- ============================================================================

-- Conversations: team-wide chats or 1:1 DMs
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind TEXT NOT NULL CHECK (kind IN ('team', 'dm')),
  
  -- For team conversations
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  
  -- For DM conversations (ordered: dm_user1 < dm_user2)
  dm_user1 UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dm_user2 UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Metadata
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT team_conversation_check CHECK (
    (kind = 'team' AND team_id IS NOT NULL AND dm_user1 IS NULL AND dm_user2 IS NULL) OR
    (kind = 'dm' AND team_id IS NULL AND dm_user1 IS NOT NULL AND dm_user2 IS NOT NULL AND dm_user1 < dm_user2)
  )
);

-- Unique indexes for conversations
CREATE UNIQUE INDEX idx_conversations_team ON conversations(team_id) WHERE kind = 'team';
CREATE UNIQUE INDEX idx_conversations_dm ON conversations(dm_user1, dm_user2) WHERE kind = 'dm';
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC NULLS LAST);

-- Messages in conversations
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- Track read status per user per conversation
CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT TIMESTAMP 'epoch',
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_conversation_reads_user ON conversation_reads(user_id, last_read_at);

-- ============================================================================
-- Chat triggers
-- ============================================================================

-- Update conversation metadata when a message is inserted
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.body, 100),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- Enable realtime for specific tables
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE availability;
ALTER PUBLICATION supabase_realtime ADD TABLE lineups;
ALTER PUBLICATION supabase_realtime ADD TABLE match_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
