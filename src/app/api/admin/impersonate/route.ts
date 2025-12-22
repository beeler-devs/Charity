import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserSystemAdmin } from '@/lib/admin-utils'

/**
 * POST /api/admin/impersonate
 * Start impersonating a user (system admin only)
 * Note: This requires Supabase Admin API for full functionality
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

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get target user's profile
    const { data: targetProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', userId)
      .single()

    if (profileError || !targetProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get current admin user
    const { data: { user: adminUser } } = await supabase.auth.getUser()
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 401 }
      )
    }

    // Note: Full impersonation requires Supabase Admin API to create a session
    // For now, we'll return the user info and let the client handle the state
    // In production, you would use: supabase.auth.admin.generateLink() or create a session
    
    return NextResponse.json({
      success: true,
      impersonatedUser: {
        id: targetProfile.id,
        email: targetProfile.email,
        full_name: targetProfile.full_name,
      },
      originalAdmin: {
        id: adminUser.id,
        email: adminUser.email,
      },
      // Note: For full session impersonation, implement Admin API:
      // requiresAdminAPI: true,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


