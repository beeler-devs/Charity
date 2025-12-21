import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side API route to create a user profile
 * This bypasses RLS issues that can occur with client-side inserts
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, email, fullName } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and email' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if user is authenticated and matches the userId
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json(
        { success: true, message: 'Profile already exists', profile: existingProfile },
        { status: 200 }
      )
    }

    // Create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email,
        full_name: fullName || null,
      })
      .select()
      .single()

    if (profileError) {
      console.error('Failed to create profile via API:', {
        error: profileError,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code,
        userId,
        email,
      })

      return NextResponse.json(
        { 
          error: 'Failed to create profile',
          message: profileError.message,
          details: profileError.details,
          code: profileError.code,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, profile },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error in profile creation API:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


