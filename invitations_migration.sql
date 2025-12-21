-- ============================================================================
-- Team Invitations Migration
-- Run this in your Supabase SQL Editor to add team invitation functionality
-- ============================================================================

-- ============================================================================
-- 1. Team Invitations Table
-- ============================================================================

-- Team invitations for inviting users to join teams
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT unique_pending_invite UNIQUE (team_id, invitee_id, status) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Remove the constraint if status is not pending (allows re-invites after decline)
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invitations_pending ON team_invitations(team_id, invitee_id) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_team_invitations_invitee ON team_invitations(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_status ON team_invitations(team_id, status);

-- ============================================================================
-- 2. Enable RLS
-- ============================================================================

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS Policies
-- ============================================================================

-- Captains can view their team's invitations
CREATE POLICY "Captains can view team invitations" ON team_invitations FOR SELECT
  USING (is_team_captain(team_id));

-- Invitees can view their own invitations
CREATE POLICY "Invitees can view their invitations" ON team_invitations FOR SELECT
  USING (invitee_id = auth.uid());

-- Only captains can create invitations for their teams
CREATE POLICY "Captains can create invitations" ON team_invitations FOR INSERT
  WITH CHECK (
    is_team_captain(team_id) AND
    inviter_id = auth.uid()
  );

-- Invitees can update their own invitations (accept/decline)
CREATE POLICY "Invitees can respond to invitations" ON team_invitations FOR UPDATE
  USING (invitee_id = auth.uid())
  WITH CHECK (
    invitee_id = auth.uid() AND
    status IN ('accepted', 'declined')
  );

-- Captains can update invitations they sent (e.g., expire them)
CREATE POLICY "Captains can update team invitations" ON team_invitations FOR UPDATE
  USING (is_team_captain(team_id));

-- ============================================================================
-- 4. Trigger: Auto-Create Roster Member on Accept
-- ============================================================================

-- Automatically create roster member when invitation is accepted
CREATE OR REPLACE FUNCTION handle_invitation_acceptance()
RETURNS TRIGGER AS $$
DECLARE
  invitee_profile profiles%ROWTYPE;
BEGIN
  -- Only proceed if status changed to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Set responded_at timestamp
    NEW.responded_at = NOW();
    
    -- Get invitee profile info
    SELECT * INTO invitee_profile FROM profiles WHERE id = NEW.invitee_id;
    
    -- Check if roster member already exists
    IF NOT EXISTS (
      SELECT 1 FROM roster_members 
      WHERE team_id = NEW.team_id 
      AND (user_id = NEW.invitee_id OR email = NEW.invitee_email)
    ) THEN
      -- Create roster member
      INSERT INTO roster_members (
        team_id,
        user_id,
        email,
        full_name,
        phone,
        ntrp_rating,
        role,
        is_active
      ) VALUES (
        NEW.team_id,
        NEW.invitee_id,
        NEW.invitee_email,
        COALESCE(invitee_profile.full_name, NEW.invitee_email),
        invitee_profile.phone,
        invitee_profile.ntrp_rating,
        'player',
        true
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS handle_invitation_acceptance_trigger ON team_invitations;
CREATE TRIGGER handle_invitation_acceptance_trigger
  BEFORE UPDATE ON team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION handle_invitation_acceptance();


