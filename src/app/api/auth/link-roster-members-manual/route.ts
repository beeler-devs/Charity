import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/link-roster-members-manual
 * Manually trigger roster member linking for the current user
 * Useful for debugging or fixing cases where automatic linking failed
 * 
 * This endpoint can be called by any authenticated user to link their own roster members
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
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.email) {
      return NextResponse.json(
        { 
          error: 'User email not found',
          debug: {
            userId: user.id,
            hasProfile: !!profile,
            profileEmail: profile?.email || null
          }
        },
        { status: 400 }
      )
    }

    // Check if function exists
    const { data: functionExists, error: checkError } = await supabase
      .rpc('link_roster_members_to_user', { target_user_id: user.id })

    if (checkError) {
      // Function might not exist - provide helpful error
      if (checkError.message?.includes('function') || checkError.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Database function not found. Please run the migration: link_roster_members_on_signup.sql',
            debug: {
              functionError: checkError.message,
              userId: user.id,
              userEmail: profile.email
            }
          },
          { status: 500 }
        )
      }

      console.error('Error calling link function:', checkError)
      return NextResponse.json(
        { 
          error: 'Failed to link roster members',
          debug: {
            functionError: checkError.message,
            userId: user.id,
            userEmail: profile.email
          }
        },
        { status: 500 }
      )
    }

    const count = functionExists || 0

    // Get diagnostic info about unlinked roster members
    const { data: unlinkedRosters } = await supabase
      .from('roster_members')
      .select('id, team_id, full_name, email, teams(name)')
      .ilike('email', profile.email.toLowerCase().trim())
      .is('user_id', null)
      .eq('is_active', true)

    // Get currently linked roster members
    const { data: linkedRosters } = await supabase
      .from('roster_members')
      .select('id, team_id, full_name, teams(name)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      linked: count,
      message: count > 0 
        ? `Successfully linked to ${count} team(s)` 
        : 'No unlinked roster members found',
      debug: {
        userId: user.id,
        userEmail: profile.email,
        normalizedEmail: profile.email.toLowerCase().trim(),
        unlinkedRosters: unlinkedRosters?.map(rm => ({
          id: rm.id,
          team_id: rm.team_id,
          team_name: (rm.teams as any)?.name || 'Unknown',
          email: rm.email,
          normalizedEmail: rm.email ? rm.email.toLowerCase().trim() : null
        })) || [],
        linkedRosters: linkedRosters?.map(rm => ({
          id: rm.id,
          team_id: rm.team_id,
          team_name: (rm.teams as any)?.name || 'Unknown'
        })) || []
      }
    })
  } catch (error: any) {
    console.error('Error in link-roster-members-manual:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        debug: {
          errorType: error.constructor.name,
          errorMessage: error.message
        }
      },
      { status: 500 }
    )
  }
}


