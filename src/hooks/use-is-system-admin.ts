'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * React hook to check if the current user is a system admin
 * @returns { isAdmin: boolean, loading: boolean }
 * 
 * This hook is designed to never block the app - it gracefully handles all errors
 * and defaults to non-admin status if anything fails.
 */
export function useIsSystemAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    async function checkAdmin() {
      try {
        const supabase = createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          setIsAdmin(false)
          setLoading(false)
          return
        }

        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('is_system_admin')
            .eq('id', user.id)
            .single()

          if (error) {
            // Silently handle errors - don't block the app
            // This is expected if RLS policies aren't set up yet
            console.warn('Could not check system admin status (this is OK if RLS policies need setup):', error.message)
            setIsAdmin(false)
          } else {
            setIsAdmin(profile?.is_system_admin === true)
          }
        } catch (profileError: any) {
          // Catch any unexpected errors from the profile query
          console.warn('Error querying profile for admin status:', profileError?.message || profileError)
          setIsAdmin(false)
        }
      } catch (error: any) {
        // Catch any unexpected errors (network, etc.)
        console.warn('Error in system admin check:', error?.message || error)
        setIsAdmin(false)
      } finally {
        // Always set loading to false, even on error
        setLoading(false)
      }
    }

    checkAdmin()
  }, [])

  return { isAdmin, loading }
}

