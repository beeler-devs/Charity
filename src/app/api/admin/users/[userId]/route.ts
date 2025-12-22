import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserSystemAdmin } from '@/lib/admin-utils'

/**
 * PUT /api/admin/users/[userId]
 * Update a user (system admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    const { email, fullName, phone, ntrpRating, isSystemAdmin, password } = await request.json()

    // Update profile
    const updateData: any = {}
    if (fullName !== undefined) updateData.full_name = fullName?.trim() || null
    if (phone !== undefined) updateData.phone = phone?.trim() || null
    if (ntrpRating !== undefined) updateData.ntrp_rating = ntrpRating ? parseFloat(ntrpRating) : null
    if (isSystemAdmin !== undefined) updateData.is_system_admin = isSystemAdmin

    const { error: profileError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', params.userId)

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      )
    }

    // Note: Updating email and password requires Admin API
    // For now, we'll just update the profile
    if (password) {
      return NextResponse.json(
        { 
          message: 'Profile updated. Password updates require Supabase Admin API.',
          requiresAdminAPI: true
        },
        { status: 200 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/[userId]
 * Delete a user (system admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    // Note: Deleting from auth.users requires Admin API
    // For now, we'll delete the profile
    // In production, you would also delete from auth.users using Admin API
    
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', params.userId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'User profile deleted. Auth user deletion requires Admin API.'
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


