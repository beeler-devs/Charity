import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCurrentUserSystemAdmin } from '@/lib/admin-utils'

/**
 * PUT /api/admin/users/[userId]
 * Update a user (system admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
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

    const resolvedParams = await params
    const userId = resolvedParams.userId

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const { email, fullName, phone, ntrpRating, isSystemAdmin, password } = await request.json()

    // Use admin client for password updates
    const adminClient = createAdminClient()

    // Update password if provided (requires Admin API)
    if (password && password.trim()) {
      try {
        const { error: passwordError } = await adminClient.auth.admin.updateUserById(
          userId,
          { password: password.trim() }
        )

        if (passwordError) {
          return NextResponse.json(
            { error: `Failed to update password: ${passwordError.message}` },
            { status: 500 }
          )
        }
      } catch (error: any) {
        return NextResponse.json(
          { error: `Failed to update password: ${error.message}` },
          { status: 500 }
        )
      }
    }

    // Update profile
    const updateData: any = {}
    if (fullName !== undefined) updateData.full_name = fullName?.trim() || null
    if (phone !== undefined) updateData.phone = phone?.trim() || null
    if (ntrpRating !== undefined) updateData.ntrp_rating = ntrpRating ? parseFloat(ntrpRating) : null
    if (isSystemAdmin !== undefined) updateData.is_system_admin = isSystemAdmin

    // Update email if provided (requires Admin API)
    if (email !== undefined && email.trim()) {
      try {
        const { error: emailError } = await adminClient.auth.admin.updateUserById(
          userId,
          { email: email.trim().toLowerCase() }
        )

        if (emailError) {
          return NextResponse.json(
            { error: `Failed to update email: ${emailError.message}` },
            { status: 500 }
          )
        }

        // Also update email in profile
        updateData.email = email.trim().toLowerCase()
      } catch (error: any) {
        return NextResponse.json(
          { error: `Failed to update email: ${error.message}` },
          { status: 500 }
        )
      }
    }

    // Update profile using admin client to bypass RLS
    const { error: profileError } = await adminClient
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: password ? 'User updated successfully, including password.' : 'User updated successfully.'
    })
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
  { params }: { params: Promise<{ userId: string }> }
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

    const resolvedParams = await params
    const userId = resolvedParams.userId

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Use admin client to delete from auth.users and profiles
    const adminClient = createAdminClient()

    // Delete from auth.users (requires Admin API)
    try {
      const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
      if (authError) {
        console.error('Error deleting auth user:', authError)
        // Continue to try deleting profile even if auth deletion fails
      }
    } catch (error: any) {
      console.error('Exception deleting auth user:', error)
      // Continue to try deleting profile
    }

    // Delete profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'User deleted successfully.'
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}








