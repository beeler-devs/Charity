'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook to check if the current user is a captain or co-captain of a team.
 * 
 * Captain status is assumed to remain constant throughout the season unless:
 * - A new captain is added
 * - A captain is demoted to player
 * - A captain is removed from the roster
 * 
 * In those cases, permissions should be re-checked on pages that render differently for captains.
 * The hook listens for 'roster-changed' events to automatically refresh captain status.
 * 
 * @param teamId - The team ID to check captain status for
 * @returns Object with isCaptain boolean, loading state, and refresh function
 */
export function useIsCaptain(teamId: string | null | undefined) {
  const [isCaptain, setIsCaptain] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkCaptainStatus = useCallback(async () => {
    if (!teamId) {
      setIsCaptain(false)
      setLoading(false)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setIsCaptain(false)
      setLoading(false)
      return
    }

    const { data: teamData } = await supabase
      .from('teams')
      .select('captain_id, co_captain_id')
      .eq('id', teamId)
      .single()

    if (teamData && (teamData.captain_id === user.id || teamData.co_captain_id === user.id)) {
      setIsCaptain(true)
    } else {
      setIsCaptain(false)
    }
    
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    checkCaptainStatus()

    // Listen for roster changes that might affect captain status
    const handleRosterChange = (event: CustomEvent<{ teamId?: string }>) => {
      // If no teamId specified, or if it matches this team, refresh
      if (!event.detail.teamId || event.detail.teamId === teamId) {
        checkCaptainStatus()
      }
    }

    window.addEventListener('roster-changed' as any, handleRosterChange as EventListener)

    return () => {
      window.removeEventListener('roster-changed' as any, handleRosterChange as EventListener)
    }
  }, [checkCaptainStatus, teamId])

  return {
    isCaptain,
    loading,
    refresh: checkCaptainStatus,
  }
}

/**
 * Helper function to trigger a roster change event.
 * Call this after roster operations that might affect captain status:
 * - Adding a player (who might be made captain)
 * - Removing a player (who might be captain)
 * - Updating a player's role (demoting captain)
 * - Updating team captain/co-captain settings
 * 
 * @param teamId - Optional team ID to target specific team, or undefined to refresh all
 */
export function triggerRosterChange(teamId?: string) {
  window.dispatchEvent(new CustomEvent('roster-changed', { detail: { teamId } }))
}

