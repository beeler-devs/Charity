import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/home'

  if (code) {
    const cookieStore = await cookies()
    
    // Create response first so we can set cookies on it
    const response = NextResponse.redirect(`${origin}${next}`)
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
              // Also set on the response to ensure cookies are included in redirect
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message || 'Could not authenticate user')}`)
    }
    
    if (!data.user) {
      console.error('No user data after code exchange')
      return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent('Authentication failed - no user data')}`)
    }
    
    if (data.user) {
      // Ensure profile exists after email confirmation
      // At this point, the user is fully confirmed and exists in auth.users
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking for profile in callback:', checkError)
      }

      // If profile doesn't exist, create it (fallback if trigger didn't run)
      if (!existingProfile) {
        console.log('Profile not found, creating in callback...', {
          userId: data.user.id,
          email: data.user.email,
          fullName: data.user.user_metadata?.full_name,
        })

        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: data.user.email!,
            full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || null,
          })
          .select()
          .single()

        if (profileError) {
          console.error('Failed to create profile in callback - Full error:', {
            error: profileError,
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
            code: profileError.code,
            userId: data.user.id,
          })
          // Continue anyway - user can still log in, profile can be created later
        } else {
          console.log('Profile created successfully in callback:', newProfile)
        }
      } else {
        console.log('Profile already exists, skipping creation')
      }

      // Link roster members with matching email to this user account
      // This handles the case where a captain added a player before they created an account
      try {
        // Use the database function to link roster members
        const { data: linkedCount, error: functionError } = await supabase
          .rpc('link_roster_members_to_user', { target_user_id: data.user.id })

        if (!functionError && linkedCount && linkedCount > 0) {
          console.log(`Linked ${linkedCount} roster member(s) to user ${data.user.id}`)
          
          // Check if user should be assigned as captain for any teams
          // This handles the case where a captain was intended but couldn't be set because they weren't a user yet
          try {
            // Get teams where this user is now on the roster
            const { data: linkedRosters } = await supabase
              .from('roster_members')
              .select('team_id')
              .eq('user_id', data.user.id)
              .eq('is_active', true)
            
            if (linkedRosters && linkedRosters.length > 0) {
              const teamIds = linkedRosters.map(rm => rm.team_id)
              
              // Find teams where this user is on the roster but captain_id is null
              const { data: teamsWithoutCaptain } = await supabase
                .from('teams')
                .select('id, name')
                .in('id', teamIds)
                .is('captain_id', null)
              
              // Assign user as captain for teams with no captain
              if (teamsWithoutCaptain && teamsWithoutCaptain.length > 0) {
                const teamsToUpdate = teamsWithoutCaptain.map(t => t.id)
                const { error: updateError } = await supabase
                  .from('teams')
                  .update({ captain_id: data.user.id })
                  .in('id', teamsToUpdate)
                
                if (!updateError) {
                  console.log(`Assigned user ${data.user.id} as captain for ${teamsToUpdate.length} team(s)`)
                } else {
                  console.error('Error assigning captain in callback:', updateError)
                }
              }
            }
          } catch (captainError) {
            // Don't fail auth if captain assignment fails - user can still log in
            console.error('Error assigning captain in callback:', captainError)
          }
        }
      } catch (linkError) {
        // Don't fail auth if linking fails - user can still log in
        console.error('Error linking roster members in callback:', linkError)
      }

      // Link event invitations with matching email to this user account
      // This handles the case where someone was invited to an event before they created an account
      try {
        const { data: linkedInvitations, error: invitationError } = await supabase
          .rpc('link_event_invitations_to_user', { target_user_id: data.user.id })

        if (!invitationError && linkedInvitations && linkedInvitations > 0) {
          console.log(`Linked ${linkedInvitations} event invitation(s) to user ${data.user.id}`)
        }
      } catch (invitationLinkError) {
        // Don't fail auth if linking fails - user can still log in
        console.error('Error linking event invitations in callback:', invitationLinkError)
      }

      // Return the response with cookies already set via setAll callback
      return response
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=Could not authenticate user`)
}
