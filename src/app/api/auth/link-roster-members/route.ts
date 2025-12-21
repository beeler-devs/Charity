import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/link-roster-members
 * Links roster members to a user account when they sign up
 * This is called after user signup to automatically link them to teams
 * where their email was already added to the roster
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's email from their profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      )
    }

    // Use database function to link roster members
    // This function uses SECURITY DEFINER to bypass RLS and allow linking
    const { data: linkedCount, error: functionError } = await supabase
      .rpc('link_roster_members_to_user', { target_user_id: user.id })

    if (functionError) {
      console.error('Error linking roster members:', functionError)
      return NextResponse.json(
        { error: 'Failed to link roster members' },
        { status: 500 }
      )
    }

    const count = linkedCount || 0

    if (count === 0) {
      // No roster members to link - this is fine, user just doesn't have any pending teams
      return NextResponse.json({
        success: true,
        linked: 0,
        message: 'No teams found to link',
      })
    }

    // Get the linked roster members to return team info
    const { data: linkedRosters } = await supabase
      .from('roster_members')
      .select('id, team_id, full_name, teams(name)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      linked: count,
      teams: linkedRosters?.map(rm => ({
        roster_member_id: rm.id,
        team_id: rm.team_id,
        team_name: (rm.teams as any)?.name || 'Unknown Team',
        name: rm.full_name,
      })) || [],
      message: `Successfully linked to ${count} team(s)`,
    })
  } catch (error: any) {
    console.error('Error in link-roster-members:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

