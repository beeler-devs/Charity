-- TennisLife PWA Database Schema
-- Supabase PostgreSQL

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
  availability_defaults JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  captain_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  co_captain_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
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
  availability_defaults JSONB DEFAULT '{}',
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
  checklist_status JSONB DEFAULT '{"14d": false, "10d": false, "7d": false, "4d": false}',
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
  ]',
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
CREATE INDEX idx_matches_team ON matches(team_id);
CREATE INDEX idx_matches_date ON matches(date);
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

-- RLS Policies

-- Profiles: Users can read all profiles, update their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Teams: Members can view teams they belong to
CREATE POLICY "Team members can view team" ON teams FOR SELECT
  USING (
    captain_id = auth.uid() OR
    co_captain_id = auth.uid() OR
    EXISTS (SELECT 1 FROM roster_members WHERE team_id = teams.id AND user_id = auth.uid())
  );
CREATE POLICY "Captains can update team" ON teams FOR UPDATE
  USING (captain_id = auth.uid() OR co_captain_id = auth.uid());
CREATE POLICY "Users can create teams" ON teams FOR INSERT WITH CHECK (captain_id = auth.uid());
CREATE POLICY "Captains can delete team" ON teams FOR DELETE
  USING (captain_id = auth.uid());

-- Roster members: Team members can view roster
CREATE POLICY "Team members can view roster" ON roster_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = roster_members.team_id
      AND (teams.captain_id = auth.uid() OR teams.co_captain_id = auth.uid() OR
           EXISTS (SELECT 1 FROM roster_members rm WHERE rm.team_id = teams.id AND rm.user_id = auth.uid()))
    )
  );
CREATE POLICY "Captains can manage roster" ON roster_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = roster_members.team_id
      AND (teams.captain_id = auth.uid() OR teams.co_captain_id = auth.uid())
    )
  );

-- Matches: Team members can view matches
CREATE POLICY "Team members can view matches" ON matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = matches.team_id
      AND (teams.captain_id = auth.uid() OR teams.co_captain_id = auth.uid() OR
           EXISTS (SELECT 1 FROM roster_members rm WHERE rm.team_id = teams.id AND rm.user_id = auth.uid()))
    )
  );
CREATE POLICY "Captains can manage matches" ON matches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = matches.team_id
      AND (teams.captain_id = auth.uid() OR teams.co_captain_id = auth.uid())
    )
  );

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

-- Lineups: Team members can view, captains can manage
CREATE POLICY "Team members can view lineups" ON lineups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN teams t ON t.id = m.team_id
      WHERE m.id = lineups.match_id
      AND (t.captain_id = auth.uid() OR t.co_captain_id = auth.uid() OR
           EXISTS (SELECT 1 FROM roster_members rm WHERE rm.team_id = t.id AND rm.user_id = auth.uid()))
    )
  );
CREATE POLICY "Captains can manage lineups" ON lineups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN teams t ON t.id = m.team_id
      WHERE m.id = lineups.match_id
      AND (t.captain_id = auth.uid() OR t.co_captain_id = auth.uid())
    )
  );

-- Court reservations: Users can manage their own
CREATE POLICY "Users can manage own reservations" ON court_reservations FOR ALL
  USING (user_id = auth.uid());

-- Functions

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
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

-- Function to calculate combined rating for lineup
CREATE OR REPLACE FUNCTION calculate_lineup_rating()
RETURNS TRIGGER AS $$
BEGIN
  SELECT
    COALESCE(p1.ntrp_rating, 0) + COALESCE(p2.ntrp_rating, 0)
  INTO NEW.combined_rating
  FROM roster_members p1, roster_members p2
  WHERE p1.id = NEW.player1_id AND p2.id = NEW.player2_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_lineup_rating_trigger
  BEFORE INSERT OR UPDATE ON lineups
  FOR EACH ROW
  WHEN (NEW.player1_id IS NOT NULL AND NEW.player2_id IS NOT NULL)
  EXECUTE FUNCTION calculate_lineup_rating();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE availability;
ALTER PUBLICATION supabase_realtime ADD TABLE lineups;
ALTER PUBLICATION supabase_realtime ADD TABLE match_scores;
