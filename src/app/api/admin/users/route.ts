import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    // For now, we'll return an error indicating Admin API is needed
    // In production, you would use: supabase.auth.admin.createUser()
    
    return NextResponse.json(
      { 
        error: 'User creation requires Supabase Admin API. Please implement Admin API integration or use Supabase Dashboard.',
        requiresAdminAPI: true
      },
      { status: 501 }
    )

    // TODO: When Admin API is available, uncomment and implement:
    // const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
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


