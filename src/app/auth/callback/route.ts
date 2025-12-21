import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/home'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
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
        }
      } catch (linkError) {
        // Don't fail auth if linking fails - user can still log in
        console.error('Error linking roster members in callback:', linkError)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=Could not authenticate user`)
}
