import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCurrentUserSystemAdmin } from '@/lib/admin-utils'

/**
 * GET /api/admin/users/fix-orphaned
 * Get count of orphaned users (users in auth.users without profiles)
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

    // Use admin client to access auth.users
    const adminClient = createAdminClient()
    
    // Get all profiles to check which auth users don't have profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')

    if (profilesError) {
      console.error('Error loading profiles:', profilesError)
      return NextResponse.json(
        { error: profilesError.message || 'Failed to load profiles' },
        { status: 500 }
      )
    }

    const profileIds = new Set((profiles || []).map(p => p.id))

    // List all auth users (using Admin API) - handle pagination
    let allAuthUsers: any[] = []
    let page = 1
    const perPage = 1000
    let hasMore = true

    while (hasMore) {
      const { data: { users }, error: authError } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      })

      if (authError) {
        console.error('Error listing auth users:', authError)
        return NextResponse.json(
          { error: authError.message || 'Failed to list auth users' },
          { status: 500 }
        )
      }

      if (users && users.length > 0) {
        allAuthUsers = allAuthUsers.concat(users)
        hasMore = users.length === perPage
        page++
      } else {
        hasMore = false
      }
    }

    // Count orphaned users (in auth.users but not in profiles)
    const orphanedCount = allAuthUsers.filter(au => !profileIds.has(au.id)).length

    return NextResponse.json({
      orphanedCount,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/users/fix-orphaned
 * Fix orphaned users by creating profiles for users in auth.users without profiles
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

    // Use admin client to access auth.users
    const adminClient = createAdminClient()

    // Get all existing profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')

    if (profilesError) {
      console.error('Error loading profiles:', profilesError)
      return NextResponse.json(
        { error: profilesError.message || 'Failed to load profiles' },
        { status: 500 }
      )
    }

    const profileIds = new Set((profiles || []).map(p => p.id))

    // List all auth users (using Admin API) - handle pagination
    let allAuthUsers: any[] = []
    let page = 1
    const perPage = 1000
    let hasMore = true

    while (hasMore) {
      const { data: { users }, error: authError } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      })

      if (authError) {
        console.error('Error listing auth users:', authError)
        return NextResponse.json(
          { error: authError.message || 'Failed to list auth users' },
          { status: 500 }
        )
      }

      if (users && users.length > 0) {
        allAuthUsers = allAuthUsers.concat(users)
        hasMore = users.length === perPage
        page++
      } else {
        hasMore = false
      }
    }

    // Find orphaned users (in auth.users but not in profiles)
    const orphanedUsers = allAuthUsers.filter(au => !profileIds.has(au.id))

    if (orphanedUsers.length === 0) {
      return NextResponse.json({
        success: true,
        totalFound: 0,
        fixed: 0,
        failed: 0,
        results: [],
        message: 'No orphaned users found.',
      })
    }

    // Create profiles for orphaned users
    const results: Array<{
      user_id: string
      email: string
      created_at: string | null
      profile_created: boolean
      error_message: string | null
    }> = []

    for (const authUser of orphanedUsers) {
      const result = {
        user_id: authUser.id,
        email: authUser.email || '',
        created_at: authUser.created_at || null,
        profile_created: false,
        error_message: null as string | null,
      }

      try {
        // Create profile for orphaned user
        const { error: insertError } = await adminClient
          .from('profiles')
          .insert({
            id: authUser.id,
            email: authUser.email || '',
            full_name: authUser.user_metadata?.full_name || 
                       authUser.app_metadata?.full_name || 
                       null,
            created_at: authUser.created_at || new Date().toISOString(),
          })

        if (insertError) {
          result.error_message = insertError.message
          console.error(`Error creating profile for user ${authUser.id}:`, {
            error: insertError,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code,
            userId: authUser.id,
            email: authUser.email,
          })
        } else {
          result.profile_created = true
        }
      } catch (error: any) {
        result.error_message = error.message || 'Unknown error'
        console.error(`Exception creating profile for user ${authUser.id}:`, error)
      }

      results.push(result)
    }

    // Process results
    const fixed = results.filter(r => r.profile_created === true)
    const failed = results.filter(r => r.profile_created === false)

    return NextResponse.json({
      success: true,
      totalFound: results.length,
      fixed: fixed.length,
      failed: failed.length,
      results,
      message: `Found ${results.length} orphaned user(s). Fixed ${fixed.length}, failed ${failed.length}.`,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
