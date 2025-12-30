import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCurrentUserSystemAdmin } from '@/lib/admin-utils'

/**
 * GET /api/admin/users
 * Get all users (system admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check if user is system admin
    const isAdmin = await isCurrentUserSystemAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get all profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ users: profiles })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/users
 * Create a new user (system admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check if user is system admin
    const isAdmin = await isCurrentUserSystemAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { email, password, fullName, phone, ntrpRating, isSystemAdmin } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Note: Creating auth users requires Supabase Admin API
    // Check if user already exists by checking if profile exists with this email
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json(
        { 
          error: 'A user with this email already exists in the system.',
          existingUserId: existingProfile.id
        },
        { status: 409 }
      )
    }

    // Create admin client for user creation
    const adminClient = createAdminClient()

    // Check if user exists in auth.users (but not in profiles - orphaned user)
    try {
      const { data: existingAuthUser, error: getUserError } = await adminClient.auth.admin.getUserByEmail(
        email.trim().toLowerCase()
      )

      if (existingAuthUser?.user) {
        // User exists in auth.users but not in profiles - create profile
        const { error: profileError } = await adminClient
          .from('profiles')
          .insert({
            id: existingAuthUser.user.id,
            email: email.trim().toLowerCase(),
            full_name: fullName?.trim() || null,
            phone: phone?.trim() || null,
            ntrp_rating: ntrpRating ? parseFloat(ntrpRating) : null,
            is_system_admin: isSystemAdmin || false,
          })

        if (profileError) {
          console.error('Error creating profile for existing auth user:', profileError)
          return NextResponse.json(
            { error: `User exists in auth but failed to create profile: ${profileError.message}` },
            { status: 500 }
          )
        }

        return NextResponse.json({
          user: existingAuthUser.user,
          message: 'Profile created for existing auth user',
        })
      }
    } catch (error: any) {
      // If getUserByEmail fails (e.g., user doesn't exist), continue with creation
      // This is expected for new users
      if (!error.message?.includes('User not found')) {
        console.error('Error checking for existing auth user:', error)
      }
    }

    // Create new auth user using Admin API
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password.trim(),
      email_confirm: true, // Auto-confirm email so user can sign in immediately
      user_metadata: {
        full_name: fullName?.trim() || null,
      },
    })

    if (authError) {
      // Handle specific error cases
      if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
        return NextResponse.json(
          { 
            error: 'A user with this email already exists in the authentication system.',
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: authError.message || 'Failed to create user' },
        { status: 400 }
      )
    }

    if (!newUser?.user) {
      return NextResponse.json(
        { error: 'User creation succeeded but no user data returned' },
        { status: 500 }
      )
    }

    // Create profile (trigger should handle this, but we'll ensure it exists as fallback)
    const { data: existingProfileAfterCreate, error: checkProfileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', newUser.user.id)
      .maybeSingle()

    if (checkProfileError) {
      console.error('Error checking for profile after user creation:', checkProfileError)
    }

    if (!existingProfileAfterCreate) {
      // Profile wasn't created by trigger, create it manually
      const { error: profileError } = await adminClient
        .from('profiles')
        .insert({
          id: newUser.user.id,
          email: email.trim().toLowerCase(),
          full_name: fullName?.trim() || null,
          phone: phone?.trim() || null,
          ntrp_rating: ntrpRating ? parseFloat(ntrpRating) : null,
          is_system_admin: isSystemAdmin || false,
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // User was created in auth but profile creation failed
        // This is a critical error - user exists but can't use the app
        return NextResponse.json(
          { 
            error: `User created but profile creation failed: ${profileError.message}. Please contact support.`,
            userId: newUser.user.id,
          },
          { status: 500 }
        )
      }
    } else {
      // Profile exists (created by trigger), but update it with any additional fields
      const updateData: any = {}
      if (fullName?.trim()) updateData.full_name = fullName.trim()
      if (phone?.trim()) updateData.phone = phone.trim()
      if (ntrpRating) updateData.ntrp_rating = parseFloat(ntrpRating)
      if (isSystemAdmin !== undefined) updateData.is_system_admin = isSystemAdmin

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await adminClient
          .from('profiles')
          .update(updateData)
          .eq('id', newUser.user.id)

        if (updateError) {
          console.error('Error updating profile with additional fields:', updateError)
          // Don't fail - profile exists, just couldn't update additional fields
        }
      }
    }

    return NextResponse.json({
      user: newUser.user,
      message: 'User created successfully',
    })
    //   email: email.trim(),
    //   password: password.trim(),
    //   email_confirm: true,
    //   user_metadata: {
    //     full_name: fullName?.trim() || null,
    //   }
    // })
    // 
    // if (authError) {
    //   return NextResponse.json(
    //     { error: authError.message },
    //     { status: 400 }
    //   )
    // }
    // 
    // // Create profile
    // const { error: profileError } = await supabase
    //   .from('profiles')
    //   .insert({
    //     id: newUser.user.id,
    //     email: email.trim(),
    //     full_name: fullName?.trim() || null,
    //     phone: phone?.trim() || null,
    //     ntrp_rating: ntrpRating ? parseFloat(ntrpRating) : null,
    //     is_system_admin: isSystemAdmin || false,
    //   })
    // 
    // if (profileError) {
    //   return NextResponse.json(
    //     { error: profileError.message },
    //     { status: 500 }
    //   )
    // 
    // return NextResponse.json({ user: newUser.user })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}








