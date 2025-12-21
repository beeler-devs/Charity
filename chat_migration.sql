-- ============================================================================
-- Chat and Messaging Migration
-- Run this in your Supabase SQL Editor to add chat functionality
-- ============================================================================

-- ============================================================================
-- 1. Chat Tables
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_team ON conversations(team_id) WHERE kind = 'team';
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_dm ON conversations(dm_user1, dm_user2) WHERE kind = 'dm';
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC NULLS LAST);

-- Messages in conversations
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- Track read status per user per conversation
CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT TIMESTAMP 'epoch',
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_reads_user ON conversation_reads(user_id, last_read_at);

-- ============================================================================
-- 2. Enable RLS
-- ============================================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_reads ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Helper Function for Team Sharing
-- ============================================================================

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
-- 4. RLS Policies for Conversations
-- ============================================================================

-- Users can view team conversations for teams they belong to
CREATE POLICY "Users can view team conversations" ON conversations FOR SELECT
  USING (
    kind = 'team' AND (
      is_team_captain(team_id) OR 
      is_team_member(team_id)
    )
  );

-- Users can view their DM conversations
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

-- Conversation participants can update metadata
CREATE POLICY "Conversation participants can update metadata" ON conversations FOR UPDATE
  USING (
    (kind = 'team' AND (is_team_captain(team_id) OR is_team_member(team_id))) OR
    (kind = 'dm' AND (auth.uid() = dm_user1 OR auth.uid() = dm_user2))
  );

-- ============================================================================
-- 5. RLS Policies for Messages
-- ============================================================================

-- Users can view messages in accessible conversations
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

-- ============================================================================
-- 6. RLS Policies for Conversation Reads
-- ============================================================================

-- Users can view their own read status
CREATE POLICY "Users can view own read status" ON conversation_reads FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own read status
CREATE POLICY "Users can update own read status" ON conversation_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own read status
CREATE POLICY "Users can upsert own read status" ON conversation_reads FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- 7. Triggers
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

DROP TRIGGER IF EXISTS update_conversation_trigger ON messages;
CREATE TRIGGER update_conversation_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- 8. Enable Realtime
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;


