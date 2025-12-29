'use client'

import { useEffect, useState, use } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { RosterMember, Match, Availability } from '@/types/database.types'
import { formatDate, formatTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Check, X, HelpCircle, Clock, ChevronDown, ArrowLeft, Save, Filter, Users, Trash2, X as XIcon, Eraser, CheckCircle2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getEventTypeLabel, getEventTypes, getEventTypeBadgeClass } from '@/lib/event-type-colors'
import { EventTypeBadge } from '@/components/events/event-type-badge'
import { getTeamColorClass } from '@/lib/team-colors'
import { useIsSystemAdmin } from '@/hooks/use-is-system-admin'
import Link from 'next/link'

interface PlayerStats {
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  availabilityCount: number
  totalMatches: number
}

type CalendarItem = Match | {
  id: string
  team_id: string
  date: string
  time: string
  event_name: string
  event_type?: string | null
  location?: string | null
  description?: string | null
  type: 'event'
}

interface AvailabilityData {
  players: Array<RosterMember & { stats: PlayerStats }>
  matches: Match[]
  events: CalendarItem[]
  items: CalendarItem[] // Combined matches and events
  availability: Record<string, Record<string, Availability>>
  availabilityCounts: Record<string, { 
    available: number
    last_resort: number
    maybe: number
    unavailable: number
    total: number 
  }>
}

export default function AvailabilityPage() {
  const params = useParams()
  const router = useRouter()
  // Handle async params in Next.js 15 - useParams() returns a Promise in some contexts
  const resolvedParams = params && typeof params === 'object' && 'then' in params 
    ? use(params as Promise<{ id: string }>) 
    : (params as { id: string })
  const teamId = resolvedParams.id
  const [data, setData] = useState<AvailabilityData>({
    players: [],
    matches: [],
    events: [],
    items: [],
    availability: {},
    availabilityCounts: {},
  })
  const [isCaptain, setIsCaptain] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [teamName, setTeamName] = useState<string>('')
  const [teamColor, setTeamColor] = useState<string | null>(null)
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(['match', 'practice', 'warmup', 'other']) // Default to all
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({})
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, 'available' | 'unavailable' | 'maybe' | 'last_resort' | 'clear'>>>({})
  const [bulkAvailabilityDialog, setBulkAvailabilityDialog] = useState<{
    open: boolean
    type: 'row' | 'event' | null
    playerId?: string
    itemId?: string
  }>({ open: false, type: null })
  const [bulkStatus, setBulkStatus] = useState<'available' | 'unavailable' | null>(null)
  const { toast } = useToast()
  const { isAdmin: isSystemAdmin } = useIsSystemAdmin()
  const [availableTeams, setAvailableTeams] = useState<Array<{ id: string; name: string }>>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teamId)
  const [clearAvailabilityDialog, setClearAvailabilityDialog] = useState<{
    open: boolean
    type: 'cell' | 'column' | 'row' | 'grid' | null
    playerId?: string
    itemId?: string
  }>({ open: false, type: null })

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  async function loadAvailableTeams() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    // Get ALL teams the user is on (as roster member, captain, or co-captain)
    const { data: rosterMembers } = await supabase
      .from('roster_members')
      .select('team_id, teams(id, name)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const rosterTeamIds = new Set<string>()
    const allTeams: Array<{ id: string; name: string }> = []

    // Add teams from roster membership
    if (rosterMembers) {
      rosterMembers.forEach(rm => {
        const team = Array.isArray(rm.teams) ? rm.teams[0] : rm.teams
        if (team && !rosterTeamIds.has(team.id)) {
          rosterTeamIds.add(team.id)
          allTeams.push({ id: team.id, name: team.name })
        }
      })
    }

    // Get teams where user is captain or co-captain (may not be on roster)
    const { data: captainTeams } = await supabase
      .from('teams')
      .select('id, name')
      .or(`captain_id.eq.${user.id},co_captain_id.eq.${user.id}`)
      .order('name')

    // Add captain teams that aren't already in the list
    if (captainTeams) {
      captainTeams.forEach(team => {
        if (!rosterTeamIds.has(team.id)) {
          allTeams.push(team)
        }
      })
    }

    // Sort by name
    allTeams.sort((a, b) => a.name.localeCompare(b.name))
    setAvailableTeams(allTeams)
  }

  useEffect(() => {
    loadAvailableTeams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Save current team to localStorage when teamId changes
    if (teamId) {
      localStorage.setItem('lastViewedAvailabilityTeamId', teamId)
      // Update selectedTeamId to match teamId from URL
      if (selectedTeamId !== teamId) {
        setSelectedTeamId(teamId)
      }
      // Reload availability data when teamId changes (this will re-check captain status)
      loadAvailabilityData(teamId)
    }
  }, [teamId])

  useEffect(() => {
    if (selectedTeamId) {
      // Save selected team to localStorage
      localStorage.setItem('lastViewedAvailabilityTeamId', selectedTeamId)
      
      // If team changed, navigate to that team's availability page
      if (selectedTeamId !== teamId) {
        router.push(`/teams/${selectedTeamId}/availability`)
        return
      }
      
      loadAvailabilityData(selectedTeamId)
    }
  }, [selectedTeamId, teamId, router])

  async function loadAvailabilityData(targetTeamId: string) {
    const supabase = createClient()
    setLoading(true)

    // Get current user and check if captain, also load team configuration
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setLoading(false)
      return
    }
    
    // Load team configuration and name
    const { data: teamData } = await supabase
      .from('teams')
      .select('name, captain_id, co_captain_id, total_lines, line_match_types, color')
      .eq('id', targetTeamId)
      .single()
    
    if (!teamData) {
      setLoading(false)
      return
    }
    
    if (teamData?.name) {
      setTeamName(teamData.name)
    }
    if (teamData) {
      setTeamColor((teamData as any).color || null)
    }

    let teamTotalLines = 3 // Default to 3 courts
    let teamLineMatchTypes: string[] = []
    
    // Check if user is captain or co-captain
    // Use String() to ensure type consistency in comparison
    const userId = String(user.id)
    const captainId = teamData.captain_id ? String(teamData.captain_id) : null
    const coCaptainId = teamData.co_captain_id ? String(teamData.co_captain_id) : null
    const isUserCaptain = (captainId === userId) || (coCaptainId === userId)
    
    console.log('Captain check:', {
      userId,
      captainId,
      coCaptainId,
      isCaptain: isUserCaptain,
      captainMatch: captainId === userId,
      coCaptainMatch: coCaptainId === userId,
      teamId: targetTeamId,
      teamName: teamData.name
    })
    
    // Set captain state - this is critical for enabling editing
    setIsCaptain(isUserCaptain)
    console.log('Set isCaptain state to:', isUserCaptain)
    
    // Log state update for debugging
    if (isUserCaptain) {
      console.log('✅ User is captain/co-captain - editing should be enabled')
    } else {
      console.log('❌ User is NOT captain/co-captain - editing will be disabled')
      console.log('   If this is wrong, check:')
      console.log('   - Is user.id correct?', userId)
      console.log('   - Is captain_id correct?', captainId)
      console.log('   - Is co_captain_id correct?', coCaptainId)
    }
    
    // Verify user has access: must be captain, co-captain, or a roster member
    if (!isUserCaptain) {
      // Check if user is a roster member
      const { data: rosterMember } = await supabase
        .from('roster_members')
        .select('id')
        .eq('team_id', targetTeamId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      
      if (!rosterMember) {
        // User is not a captain, co-captain, or roster member - no access
        setLoading(false)
        return
      }
    }
    
    // Note: RLS policies should allow team members (including captains) to view all team availability
    // If availability is not showing, check RLS policies on the availability table
    
    // Get team configuration for calculating players needed
    teamTotalLines = teamData.total_lines || 3
    if (teamData.line_match_types && Array.isArray(teamData.line_match_types)) {
      teamLineMatchTypes = teamData.line_match_types
    }

    // Load roster
    const { data: players } = await supabase
      .from('roster_members')
      .select('*')
      .eq('team_id', targetTeamId)
      .eq('is_active', true)
      .order('full_name')

    if (!players || players.length === 0) {
      setLoading(false)
      return
    }

    // Load upcoming matches and events
    const today = new Date().toISOString().split('T')[0]
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('team_id', targetTeamId)
      .gte('date', today)
      .order('date')
      .limit(20)

    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('team_id', targetTeamId)
      .gte('date', today)
      .order('date')
      .limit(20)

    const playerIds = players.map(p => p.id)
    const matchIds = (matches || []).map(m => m.id)
    const eventIds = (events || []).map(e => e.id)
    
    // Combine matches and events into items array
    const allItems: CalendarItem[] = []
    if (matches) {
      matches.forEach(m => {
        allItems.push({ ...m, type: 'match' as const })
      })
    }
    if (events) {
      events.forEach(e => {
        allItems.push({ 
          ...e, 
          type: 'event' as const,
          event_type: e.event_type || 'other', // Default to 'other' if null/undefined
          event_name: e.event_name,
          team_id: e.team_id
        } as CalendarItem)
      })
    }
    
    // Sort by date and time
    allItems.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.time.localeCompare(b.time)
    })

    if (allItems.length === 0) {
      setData({
        players: players.map(p => ({ ...p, stats: { matchesPlayed: 0, matchesWon: 0, matchesLost: 0, availabilityCount: 0, totalMatches: 0 } })),
        matches: [],
        events: [],
        items: [],
        availability: {},
        availabilityCounts: {},
      })
      setLoading(false)
      return
    }

    // Load player statistics from individual_statistics table
    const { data: statsData } = await supabase
      .from('individual_statistics')
      .select('player_id, matches_played, matches_won, matches_lost')
      .in('player_id', playerIds)

    const statsMap = new Map<string, { matchesPlayed: number; matchesWon: number; matchesLost: number }>()
    statsData?.forEach(stat => {
      statsMap.set(stat.player_id, {
        matchesPlayed: stat.matches_played || 0,
        matchesWon: stat.matches_won || 0,
        matchesLost: stat.matches_lost || 0,
      })
    })

    // Load availability for all player/match and player/event combinations
    // This should load ALL availability for ALL roster members - RLS policies should allow team members to see all team availability
    const { data: availabilityData, error: availabilityError } = await supabase
      .from('availability')
      .select('*')
      .in('roster_member_id', playerIds)
      .or(`match_id.in.(${matchIds.join(',')}),event_id.in.(${eventIds.join(',')})`)
    
    if (availabilityError) {
      console.error('Error loading availability:', availabilityError)
      toast({
        title: 'Warning',
        description: 'Some availability data may not be visible due to permissions',
        variant: 'default',
      })
    }
    
    console.log(`Loaded ${availabilityData?.length || 0} availability records for ${playerIds.length} players`)

    // Build availability lookup (for both matches and events)
    const availability: Record<string, Record<string, Availability>> = {}
    availabilityData?.forEach(a => {
      const itemId = a.match_id || a.event_id
      if (!itemId) return
      
      if (!availability[a.roster_member_id]) {
        availability[a.roster_member_id] = {}
      }
      availability[a.roster_member_id][itemId] = a
    })

    // Calculate availability counts per match
    // Count how many players are available vs. how many are needed to fill the courts
    const availabilityCounts: Record<string, { available: number; total: number }> = {}
    
    // Calculate players needed based on team configuration
    // For each line, determine if it's doubles (2 players) or singles (1 player)
    const playersNeeded = teamLineMatchTypes.length > 0
      ? teamLineMatchTypes.reduce((sum, matchType) => {
          // Doubles Match or Mixed Doubles = 2 players, Singles Match = 1 player
          if (matchType === 'Singles Match') {
            return sum + 1
          } else {
            return sum + 2
          }
        }, 0)
      : teamTotalLines * 2 // Default: assume all doubles (2 players per court)
    
    // Calculate availability counts for all items (matches and events)
    allItems.forEach(item => {
      const itemId = item.id
      let available = 0
      let lastResort = 0
      let maybe = 0
      let unavailable = 0
      
      // Count players by status
      playerIds.forEach(playerId => {
        const avail = availability[playerId]?.[itemId]
        if (avail) {
          switch (avail.status) {
            case 'available':
              available++
              break
            case 'last_resort':
              lastResort++
              break
            case 'maybe':
              maybe++
              break
            case 'unavailable':
              unavailable++
              break
          }
        }
      })
      
      // For events, use total team members (for practices, show X/Y format)
      // For matches, use the calculated playersNeeded
      const totalNeeded = item.type === 'match' 
        ? playersNeeded 
        : (item.type === 'event' && (item as any).event_type === 'practice' 
          ? playerIds.length // For practices, use total team members
          : 1) // Other events default to 1
      availabilityCounts[itemId] = { 
        available, 
        last_resort: lastResort,
        maybe,
        unavailable,
        total: totalNeeded 
      }
    })

    // Calculate player stats (including availability count)
    const playersWithStats = players.map(player => {
      const stats = statsMap.get(player.id) || { matchesPlayed: 0, matchesWon: 0, matchesLost: 0 }
      const playerAvailabilities = availability[player.id] || {}
      const availabilityCount = Object.values(playerAvailabilities).filter(a => a.status === 'available').length
      
      return {
        ...player,
        stats: {
          matchesPlayed: stats.matchesPlayed,
          matchesWon: stats.matchesWon,
          matchesLost: stats.matchesLost,
          availabilityCount,
          totalMatches: allItems.length,
        }
      }
    })

    setData({
      players: playersWithStats,
      matches: matches || [],
      events: events || [],
      items: allItems,
      availability,
      availabilityCounts,
    })
    setLoading(false)
  }

  function updateAvailabilityLocal(
    playerId: string,
    itemId: string,
    status: 'available' | 'unavailable' | 'maybe' | 'last_resort' | 'clear'
  ) {
    try {
      console.log('🔄 updateAvailabilityLocal called:', {
        isCaptain,
        playerId,
        itemId,
        status,
        isCaptainType: typeof isCaptain,
        isCaptainValue: isCaptain
      })
      if (!isCaptain) {
        console.warn('❌ Permission denied - isCaptain is false/undefined')
        toast({
          title: 'Permission Denied',
          description: 'Only captains can set availability for other players',
          variant: 'destructive',
        })
        return
      }
      console.log('✅ Permission granted - proceeding with update')

      if (!playerId || !itemId) {
        console.error('Invalid playerId or itemId:', { playerId, itemId })
        toast({
          title: 'Error',
          description: 'Invalid player or item information',
          variant: 'destructive',
        })
        return
      }

      // Close the popover
      const popoverKey = `${playerId}-${itemId}`
      setOpenPopovers(prev => ({ ...prev, [popoverKey]: false }))

      // Store change in pending changes (offline)
      setPendingChanges(prev => {
        const newChanges = { ...prev }
        if (!newChanges[playerId]) {
          newChanges[playerId] = {}
        }
        newChanges[playerId][itemId] = status
        return newChanges
      })
    } catch (err) {
      console.error('Error in updateAvailabilityLocal:', err)
      toast({
        title: 'Error',
        description: `Failed to update availability: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: 'destructive',
      })
    }
  }

  function handleBulkAvailability(type: 'row' | 'event', playerId?: string, itemId?: string) {
    setBulkAvailabilityDialog({ open: true, type, playerId, itemId })
  }

  function confirmBulkAvailability() {
    if (!bulkStatus || !bulkAvailabilityDialog.type) return

    const changes: Record<string, Record<string, 'available' | 'unavailable' | 'maybe' | 'last_resort'>> = {}
    let overwriteCount = 0

    if (bulkAvailabilityDialog.type === 'row' && bulkAvailabilityDialog.playerId) {
      // Mark all items for a player
      const playerId = bulkAvailabilityDialog.playerId
      const displayedItems = getDisplayedItems()
      
      displayedItems.forEach(item => {
        const existing = data.availability[playerId]?.[item.id]
        if (existing && existing.status !== bulkStatus) {
          overwriteCount++
        }
        if (!changes[playerId]) {
          changes[playerId] = {}
        }
        changes[playerId][item.id] = bulkStatus
      })
    } else if (bulkAvailabilityDialog.type === 'event' && bulkAvailabilityDialog.itemId) {
      // Mark all players for an item
      const itemId = bulkAvailabilityDialog.itemId
      
      data.players.forEach(player => {
        const existing = data.availability[player.id]?.[itemId]
        if (existing && existing.status !== bulkStatus) {
          overwriteCount++
        }
        if (!changes[player.id]) {
          changes[player.id] = {}
        }
        changes[player.id][itemId] = bulkStatus
      })
    }

    if (overwriteCount > 0) {
      // Show warning dialog
      setBulkAvailabilityDialog(prev => ({ ...prev, open: false }))
      // For now, proceed with the change - we'll add a proper warning dialog later
      setPendingChanges(prev => {
        const newChanges = { ...prev }
        Object.keys(changes).forEach(playerId => {
          if (!newChanges[playerId]) {
            newChanges[playerId] = {}
          }
          Object.keys(changes[playerId]).forEach(itemId => {
            newChanges[playerId][itemId] = changes[playerId][itemId]
          })
        })
        return newChanges
      })
      toast({
        title: 'Bulk availability set',
        description: `Set ${overwriteCount > 0 ? `(overwrote ${overwriteCount} existing)` : ''}`,
      })
    } else {
      setPendingChanges(prev => {
        const newChanges = { ...prev }
        Object.keys(changes).forEach(playerId => {
          if (!newChanges[playerId]) {
            newChanges[playerId] = {}
          }
          Object.keys(changes[playerId]).forEach(itemId => {
            newChanges[playerId][itemId] = changes[playerId][itemId]
          })
        })
        return newChanges
      })
    }

    setBulkAvailabilityDialog({ open: false, type: null })
    setBulkStatus(null)
  }

  function getDisplayedItems(): CalendarItem[] {
    return data.items.filter(item => {
      if (item.type === 'match') {
        return selectedEventTypes.includes('match')
      } else {
        // For events, check the event_type field
        const eventType = item.event_type || 'other'
        // Return true if this event type is selected, or if 'all' is selected
        return selectedEventTypes.includes(eventType)
      }
    })
  }

  async function saveAllChanges() {
    if (!isCaptain) {
      return
    }

    if (Object.keys(pendingChanges).length === 0) {
      toast({
        title: 'No changes',
        description: 'No pending changes to save',
      })
      return
    }

    setSaving(true)
    const supabase = createClient()
    const errors: string[] = []

    try {
      // Process all pending changes
      console.log('=== SAVING ALL CHANGES ===')
      console.log('Pending changes:', JSON.stringify(pendingChanges, null, 2))
      
      for (const [playerId, itemChanges] of Object.entries(pendingChanges)) {
        for (const [itemId, status] of Object.entries(itemChanges)) {
          console.log(`\nProcessing: ${playerId}-${itemId}`)
          console.log(`  Original status from pendingChanges: "${status}" (type: ${typeof status})`)
          
          // Handle "clear" status - delete the availability record
          if (status === 'clear') {
            console.log(`  🗑️ Clearing availability for ${playerId}-${itemId}`)
            
            // Determine if this is a match or event
            const item = data.items.find(i => i.id === itemId)
            if (!item) {
              console.error(`Item not found: ${itemId}`)
              errors.push(`${playerId}-${itemId}: Match/Event not found`)
              continue
            }
            
            const isMatch = item?.type === 'match'
            
            try {
              const query = supabase
                .from('availability')
                .delete()
                .eq('roster_member_id', playerId)
              
              if (isMatch) {
                query.eq('match_id', itemId)
              } else {
                query.eq('event_id', itemId)
              }
              
              const { error } = await query
              
              if (error) {
                console.error('Error deleting availability:', error)
                errors.push(`${playerId}-${itemId}: ${error.message || 'Failed to clear availability'}`)
              } else {
                console.log(`  ✅ Successfully cleared availability`)
              }
            } catch (err) {
              console.error('Exception deleting availability:', err)
              errors.push(`${playerId}-${itemId}: ${err instanceof Error ? err.message : 'Failed to clear availability'}`)
            }
            
            continue // Skip to next item
          }
          
          // Validate status value matches database constraint
          // Valid statuses: 'available', 'unavailable', 'maybe', 'last_resort' (replaced 'late')
          const validStatuses = ['available', 'unavailable', 'maybe', 'last_resort']
          
          // Normalize the status first (trim and lowercase)
          const normalizedStatus = String(status).trim().toLowerCase()
          console.log(`  Normalized status: "${normalizedStatus}"`)
          
          // Use normalized status directly (no mapping needed)
          const statusToUse = normalizedStatus
          
          if (!validStatuses.includes(statusToUse)) {
            console.error(`  ❌ INVALID STATUS: "${normalizedStatus}"`)
            console.error('  Valid statuses:', validStatuses)
            console.error('  Status value details:', {
              original: status,
              normalized: normalizedStatus,
              stringified: JSON.stringify(status),
              length: status?.length,
              charCodes: status?.split('').map(c => c.charCodeAt(0))
            })
            errors.push(`${playerId}-${itemId}: Invalid status value "${normalizedStatus}". Must be one of: ${validStatuses.join(', ')}`)
            continue
          }
          
          console.log(`  ✅ Status validated: "${statusToUse}"`)
          
          // Validate playerId exists in roster
          const player = data.players.find(p => p.id === playerId)
          if (!player) {
            console.error(`Player not found: ${playerId}`)
            errors.push(`${playerId}-${itemId}: Player not found on roster`)
            continue
          }

          const existing = data.availability[playerId]?.[itemId]
          
          // Determine if this is a match or event
          const item = data.items.find(i => i.id === itemId)
          if (!item) {
            console.error(`Item not found: ${itemId}`)
            errors.push(`${playerId}-${itemId}: Match/Event not found`)
            continue
          }
          
          const isMatch = item?.type === 'match'

          try {
            // Always check database for existing record to avoid unique constraint violations
            let existingRecord = null
            if (isMatch) {
              const { data: existing } = await supabase
                .from('availability')
                .select('id')
                .eq('roster_member_id', playerId)
                .eq('match_id', itemId)
                .maybeSingle()
              existingRecord = existing
            } else {
              const { data: existing } = await supabase
                .from('availability')
                .select('id')
                .eq('roster_member_id', playerId)
                .eq('event_id', itemId)
                .maybeSingle()
              existingRecord = existing
            }

            if (existingRecord) {
              // Update existing availability record
              // Use statusToUse from validation above
              console.log(`  📝 Updating availability:`, {
                id: existingRecord.id,
                oldStatus: existing?.status,
                newStatus: statusToUse
              })
              
              const { error } = await supabase
                .from('availability')
                .update({ status: statusToUse })
                .eq('id', existingRecord.id)
              
              if (error) {
                console.error('Error updating availability:', {
                  message: error.message || 'Unknown error',
                  details: error.details || null,
                  hint: error.hint || null,
                  code: error.code || null,
                  fullError: JSON.stringify(error, null, 2),
                  errorObject: error,
                })
                errors.push(`${playerId}-${itemId}: ${error.message || 'Unknown error'}`)
              }
            } else {
              // Insert new availability record
              // Use statusToUse (already validated and normalized)
              const insertData: any = {
                roster_member_id: playerId,
                status: statusToUse,
              }
              
              if (isMatch) {
                insertData.match_id = itemId
              } else {
                insertData.event_id = itemId
              }
              
              // Log insert data for debugging
              console.log(`  📝 Inserting availability:`, insertData)
              
              // Insert without select to avoid RLS issues on the returned data
              const { data: insertResult, error } = await supabase
                .from('availability')
                .insert(insertData)
              
              if (error) {
                // Extract error details - Supabase errors have code, message, details, hint
                const errorCode = error?.code || 'NO_CODE'
                const errorMessage = error?.message || String(error) || 'Unknown error'
                const errorDetails = error?.details || null
                const errorHint = error?.hint || null
                
                // Log the full error structure for debugging
                console.error('=== AVAILABILITY INSERT ERROR ===')
                console.error('Error code:', errorCode)
                console.error('Error message:', errorMessage)
                console.error('Error details:', errorDetails)
                console.error('Error hint:', errorHint)
                console.error('Insert data that failed:', insertData)
                console.error('Status to use:', statusToUse)
                console.error('Normalized status:', normalizedStatus)
                console.error('Original status:', status)
                console.error('Valid statuses:', validStatuses)
                console.error('Status in valid list?', validStatuses.includes(normalizedStatus))
                console.error('================================')
                
                // Check if it's a CHECK constraint violation (code 23514)
                if (errorCode === '23514' || errorMessage.includes('check constraint') || errorMessage.includes('availability_status_check')) {
                  console.error('CHECK CONSTRAINT VIOLATION DETECTED!')
                  console.error('The status value does not match the database constraint.')
                  console.error('Attempted status:', normalizedStatus)
                  console.error('This suggests the database constraint allows different values than expected.')
                  
                  errors.push(`${playerId}-${itemId}: Database constraint violation. Status "${normalizedStatus}" is not allowed. Valid values: ${validStatuses.join(', ')}`)
                  continue
                }
                
                // Check if error is actually truthy but empty (RLS/permission issue)
                const isEmptyError = !error || 
                                    (typeof error === 'object' && 
                                     Object.keys(error).length === 0 && 
                                     !error.message && 
                                     !error.code)
                
                if (isEmptyError) {
                  console.error('Error is empty object - likely RLS/permission issue')
                  console.error('Attempted insert data:', insertData)
                  
                  // Verify user is authenticated and is captain
                  const { data: { user } } = await supabase.auth.getUser()
                  console.error('Current user:', user?.id)
                  console.error('Is captain:', isCaptain)
                  
                  // Check if roster member belongs to the team
                  const { data: rosterCheck } = await supabase
                    .from('roster_members')
                    .select('id, team_id')
                    .eq('id', playerId)
                    .single()
                  console.error('Roster member check:', rosterCheck)
                  
                  // Check team captain status
                  if (rosterCheck?.team_id) {
                    const { data: teamCheck } = await supabase
                      .from('teams')
                      .select('id, captain_id, co_captain_id')
                      .eq('id', rosterCheck.team_id)
                      .single()
                    console.error('Team check:', teamCheck)
                    console.error('Is user captain?', teamCheck?.captain_id === user?.id || teamCheck?.co_captain_id === user?.id)
                  }
                  
                  errors.push(`${playerId}-${itemId}: Permission denied. RLS policy may be blocking insert. Check console for details.`)
                  continue
                }
                
                // If it's a unique constraint violation, try to update instead
                const isDuplicateKey = errorCode === '23505' || 
                                      errorMessage?.includes('duplicate key') || 
                                      errorMessage?.includes('unique constraint') ||
                                      errorMessage?.includes('UNIQUE constraint') ||
                                      String(error).includes('duplicate') ||
                                      String(error).includes('unique')
                
                if (isDuplicateKey) {
                  // Query again to get the existing record ID
                  let existingId = null
                  if (isMatch) {
                    const { data: existing } = await supabase
                      .from('availability')
                      .select('id')
                      .eq('roster_member_id', playerId)
                      .eq('match_id', itemId)
                      .maybeSingle()
                    existingId = existing?.id
                  } else {
                    const { data: existing } = await supabase
                      .from('availability')
                      .select('id')
                      .eq('roster_member_id', playerId)
                      .eq('event_id', itemId)
                      .maybeSingle()
                    existingId = existing?.id
                  }

                  if (existingId) {
                    // Update the existing record with normalized status
                    const { error: updateError } = await supabase
                      .from('availability')
                      .update({ status: normalizedStatus })
                      .eq('id', existingId)
                    
                    if (updateError) {
                      console.error('Error updating availability after duplicate key error:', {
                        message: updateError.message || 'Unknown error',
                        details: updateError.details || null,
                        hint: updateError.hint || null,
                        code: updateError.code || null,
                      })
                      errors.push(`${playerId}-${itemId}: ${updateError.message || 'Unknown error'}`)
                    }
                  } else {
                    console.error('Error inserting availability (duplicate key but record not found):', {
                      message: error.message || 'Unknown error',
                      details: error.details || null,
                      hint: error.hint || null,
                      code: error.code || null,
                      insertData: insertData,
                      playerId: playerId,
                      itemId: itemId,
                      isMatch: isMatch,
                    })
                    errors.push(`${playerId}-${itemId}: ${error.message || 'Unknown error'}`)
                  }
                } else {
                  // Log comprehensive error information
                  const errorMessage = error?.message || String(error) || 'Unknown error'
                  const errorCode = error?.code || 'NO_CODE'
                  const errorDetails = error?.details || null
                  const errorHint = error?.hint || null
                  
                  console.error('Error inserting availability:', {
                    error: error,
                    errorType: typeof error,
                    errorString: String(error),
                    message: errorMessage,
                    details: errorDetails,
                    hint: errorHint,
                    code: errorCode,
                    fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
                    errorObject: error,
                    insertData: insertData,
                    playerId: playerId,
                    itemId: itemId,
                    isMatch: isMatch,
                    insertResult: insertResult,
                  })
                  
                  // Check if it might be an RLS/permission issue
                  if (errorCode === '42501' || errorMessage.includes('permission') || errorMessage.includes('policy') || errorMessage.includes('RLS')) {
                    errors.push(`${playerId}-${itemId}: Permission denied. You may not have permission to set availability for this player.`)
                  } else {
                    errors.push(`${playerId}-${itemId}: ${errorMessage}`)
                  }
                }
              }
            }
          } catch (err) {
            console.error('Exception saving availability:', err)
            errors.push(`${playerId}-${itemId}: ${err instanceof Error ? err.message : 'Unknown error'}`)
          }
        }
      }

      if (errors.length > 0) {
        toast({
          title: 'Error',
          description: `Failed to save ${errors.length} change(s). Check console for details.`,
          variant: 'destructive',
        })
        console.error('Availability save errors:', errors)
        setSaving(false)
      } else {
        toast({
          title: 'Saved',
          description: 'All availability changes saved successfully',
        })
        // Clear pending changes and reload data
        setPendingChanges({})
        await loadAvailabilityData(selectedTeamId)
        setSaving(false)
      }
    } catch (err) {
      console.error('Fatal error in saveAllChanges:', err)
      toast({
        title: 'Error',
        description: `Failed to save changes: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: 'destructive',
      })
      setSaving(false)
    }
  }

  // Clear availability functions (sysadmin only)
  async function clearAvailabilityCell(playerId: string, itemId: string) {
    if (!isSystemAdmin) return

    const supabase = createClient()
    const item = data.items.find(i => i.id === itemId)
    const isMatch = item?.type === 'match'

    try {
      const query = supabase
        .from('availability')
        .delete()
        .eq('roster_member_id', playerId)
      
      if (isMatch) {
        query.eq('match_id', itemId)
      } else {
        query.eq('event_id', itemId)
      }

      const { error } = await query

      if (error) {
        toast({
          title: 'Error',
          description: `Failed to clear availability: ${error.message}`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Cleared',
          description: 'Availability cleared successfully',
        })
        await loadAvailabilityData(selectedTeamId)
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: `Failed to clear availability: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: 'destructive',
      })
    }
  }

  async function clearAvailabilityColumn(itemId: string) {
    if (!isSystemAdmin) return

    const supabase = createClient()
    const item = data.items.find(i => i.id === itemId)
    const isMatch = item?.type === 'match'

    try {
      const query = supabase
        .from('availability')
        .delete()
      
      if (isMatch) {
        query.eq('match_id', itemId)
      } else {
        query.eq('event_id', itemId)
      }

      const { error } = await query

      if (error) {
        toast({
          title: 'Error',
          description: `Failed to clear column: ${error.message}`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Cleared',
          description: 'Column cleared successfully',
        })
        await loadAvailabilityData(selectedTeamId)
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: `Failed to clear column: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: 'destructive',
      })
    }
  }

  async function clearAvailabilityRow(playerId: string) {
    if (!isSystemAdmin) return

    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('availability')
        .delete()
        .eq('roster_member_id', playerId)

      if (error) {
        toast({
          title: 'Error',
          description: `Failed to clear row: ${error.message}`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Cleared',
          description: 'Row cleared successfully',
        })
        await loadAvailabilityData(selectedTeamId)
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: `Failed to clear row: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: 'destructive',
      })
    }
  }

  async function clearEntireGrid() {
    if (!isSystemAdmin) return

    const supabase = createClient()
    const playerIds = data.players.map(p => p.id)
    const matchIds = data.items.filter(i => i.type === 'match').map(i => i.id)
    const eventIds = data.items.filter(i => i.type === 'event').map(i => i.id)

    try {
      // Delete all availability for this team's players and items
      const { error } = await supabase
        .from('availability')
        .delete()
        .in('roster_member_id', playerIds)
        .or(`match_id.in.(${matchIds.join(',')}),event_id.in.(${eventIds.join(',')})`)

      if (error) {
        toast({
          title: 'Error',
          description: `Failed to clear grid: ${error.message}`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Cleared',
          description: 'Entire grid cleared successfully',
        })
        await loadAvailabilityData(selectedTeamId)
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: `Failed to clear grid: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: 'destructive',
      })
    }
  }

  function handleClearAvailability(type: 'cell' | 'column' | 'row' | 'grid', playerId?: string, itemId?: string) {
    setClearAvailabilityDialog({ open: true, type, playerId, itemId })
  }

  async function confirmClearAvailability() {
    const { type, playerId, itemId } = clearAvailabilityDialog

    if (type === 'cell' && playerId && itemId) {
      await clearAvailabilityCell(playerId, itemId)
    } else if (type === 'column' && itemId) {
      await clearAvailabilityColumn(itemId)
    } else if (type === 'row' && playerId) {
      await clearAvailabilityRow(playerId)
    } else if (type === 'grid') {
      await clearEntireGrid()
    }

    setClearAvailabilityDialog({ open: false, type: null })
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'available':
        return <Check className="h-4 w-4 text-green-500" />
      case 'unavailable':
        return <X className="h-4 w-4 text-red-500" />
      case 'maybe':
        return <HelpCircle className="h-4 w-4 text-yellow-500" />
      case 'last_resort':
        return <HelpCircle className="h-4 w-4 text-purple-500" />
      default:
        return null
    }
  }

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'available':
        return 'Available'
      case 'unavailable':
        return 'Unavailable'
      case 'maybe':
        return 'Maybe'
      case 'last_resort':
        return 'Last Resort'
      default:
        return 'Set availability'
    }
  }

  const getStatusButtonClass = (status?: string) => {
    if (!status) {
      return 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-300'
    }
    switch (status) {
      case 'available':
        return 'bg-green-100 hover:bg-green-200 text-green-700 border-green-300'
      case 'unavailable':
        return 'bg-red-100 hover:bg-red-200 text-red-700 border-red-300'
      case 'maybe':
        return 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border-yellow-300'
      case 'last_resort':
        return 'bg-purple-100 hover:bg-purple-200 text-purple-700 border-purple-300'
      default:
        return 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-300'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={teamName ? `Availability - ${teamName}` : "Availability"} />

      <main className="flex-1 p-4 pt-2 overflow-x-hidden">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.back()} size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            {/* Team Selector - Show for all users if they have multiple teams */}
            {availableTeams.length > 1 && (
              <Select value={selectedTeamId || teamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <Link href="/availability?view=bulk">
              <Button variant="outline" size="sm" title="View bulk availability for all teams">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Bulk Availability
              </Button>
            </Link>
          </div>

          {/* Sysadmin Clear Grid Button */}
          {isSystemAdmin && (
            <Button
              variant="ghost"
              onClick={() => handleClearAvailability('grid')}
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              title="Clear all availability (Admin)"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          
          {/* Save and Cancel buttons for Captains */}
          {isCaptain && (
            <div className="flex gap-2 ml-auto">
              {Object.keys(pendingChanges).length > 0 && (
                <Button 
                  variant="outline"
                  onClick={() => setPendingChanges({})}
                  disabled={saving}
                  size="sm"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              )}
              <Button 
                onClick={saveAllChanges} 
                disabled={saving || Object.keys(pendingChanges).length === 0}
                size="sm"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : Object.keys(pendingChanges).length > 0 
                  ? `Save ${Object.values(pendingChanges).reduce((sum, changes) => sum + Object.keys(changes).length, 0)} Change(s)`
                  : 'Save'}
              </Button>
            </div>
          )}
        </div>

        {/* Event Type Filter */}
        <Card className="mb-4">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm font-medium">Show:</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={selectedEventTypes.length === ['match', ...getEventTypes().map(e => e.value)].length ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const allTypes = ['match', ...getEventTypes().map(e => e.value)]
                    if (selectedEventTypes.length === allTypes.length) {
                      // If all selected, deselect all
                      setSelectedEventTypes([])
                    } else {
                      // Select all
                      setSelectedEventTypes(allTypes)
                    }
                  }}
                >
                  All
                </Button>
                <Button
                  variant={selectedEventTypes.includes('match') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (selectedEventTypes.includes('match')) {
                      setSelectedEventTypes(selectedEventTypes.filter(t => t !== 'match'))
                    } else {
                      setSelectedEventTypes([...selectedEventTypes, 'match'])
                    }
                  }}
                >
                  Matches
                </Button>
                {getEventTypes().map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={selectedEventTypes.includes(value) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (selectedEventTypes.includes(value)) {
                        setSelectedEventTypes(selectedEventTypes.filter(t => t !== value))
                      } else {
                        setSelectedEventTypes([...selectedEventTypes, value])
                      }
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {getDisplayedItems().length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No items to display</p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto w-full -mx-4 px-4" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                {/* First header row: Column names */}
                <tr className="border-b">
                  <th className="sticky left-0 bg-background p-2 text-left text-sm font-medium border-r min-w-[150px] z-10">
                    PLAYER
                  </th>
                  <th className="p-2 text-center text-sm font-medium border-r min-w-[120px] bg-background">
                    HISTORY
                  </th>
                  {getDisplayedItems().map((item, index) => {
                    // Explicitly check if item is a match or event
                    const isMatch = item.type === 'match'
                    const isEvent = item.type === 'event'
                    
                    // Get event type for events - check multiple possible locations for recurring events
                    const eventType = isEvent ? (
                      (item as any).event_type || 
                      (item as any).eventType || 
                      'other'
                    ) : null
                    const isPractice = eventType === 'practice' || (item as any).event_type === 'practice' || (item as any).eventType === 'practice'
                    const isWarmup = eventType === 'warmup'
                    const isSocial = eventType === 'social'
                    const isOther = isEvent && (eventType === 'other' || !eventType || eventType === null)
                    
                    return (
                      <th 
                        key={item.id} 
                        className={cn(
                          "p-2 text-center text-sm font-medium border-r min-w-[140px] relative border-l-4",
                          isMatch 
                            ? "bg-green-200 border-l-green-500"
                            : isPractice
                            ? "bg-blue-200 border-l-blue-500"
                            : isWarmup
                            ? "bg-orange-200 border-l-orange-500"
                            : isSocial
                            ? "bg-pink-200 border-l-pink-500"
                            :                           isOther
                            ? "bg-purple-200 border-l-purple-500"
                            : "bg-purple-200 border-l-purple-500",
                          (isEvent || isMatch) && "cursor-pointer hover:opacity-90 transition-opacity"
                        )}
                        onClick={() => {
                          if (isEvent) {
                            router.push(`/teams/${item.team_id}/events/${item.id}`)
                          } else if (isMatch) {
                            router.push(`/teams/${item.team_id}/matches/${item.id}`)
                          }
                        }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {isMatch ? (
                            <span className="text-xs font-medium text-foreground">
                              Match {index + 1} {(item as Match).is_home ? '(H)' : '(A)'}
                            </span>
                          ) : eventType ? (
                            <span className="text-xs font-medium text-foreground">
                              {getEventTypeLabel(eventType as any)}
                            </span>
                          ) : null}
                          {isCaptain && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 ml-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleBulkAvailability('event', undefined, item.id)
                              }}
                              title="Mark all players"
                            >
                              <Users className="h-3 w-3" />
                            </Button>
                          )}
                          {isSystemAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 ml-1 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleClearAvailability('column', undefined, item.id)
                              }}
                              title="Clear column (Admin)"
                            >
                              <XIcon className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
                {/* Second header row: Match details and availability counts */}
                <tr className="border-b bg-gray-50">
                  <th className="sticky left-0 bg-gray-50 p-2 border-r z-10"></th>
                  <th className="p-2 text-center text-xs text-muted-foreground border-r">
                    AVAILABLE
                  </th>
                  {getDisplayedItems().map(item => {
                    const baseCount = data.availabilityCounts[item.id] || { 
                      available: 0, 
                      last_resort: 0,
                      maybe: 0,
                      unavailable: 0,
                      total: data.players.length 
                    }
                    
                    // Recalculate counts including pending changes
                    let availableCount = baseCount.available
                    let lastResortCount = baseCount.last_resort
                    let maybeCount = baseCount.maybe
                    let unavailableCount = baseCount.unavailable
                    
                    data.players.forEach(player => {
                      const pendingStatus = pendingChanges[player.id]?.[item.id]
                      const savedStatus = data.availability[player.id]?.[item.id]?.status
                      
                      if (pendingStatus) {
                        // Remove old status from count
                        if (savedStatus === 'available') availableCount--
                        else if (savedStatus === 'last_resort') lastResortCount--
                        else if (savedStatus === 'maybe') maybeCount--
                        else if (savedStatus === 'unavailable') unavailableCount--
                        
                        // Add new status to count (unless it's 'clear')
                        if (pendingStatus === 'available') availableCount++
                        else if (pendingStatus === 'last_resort') lastResortCount++
                        else if (pendingStatus === 'maybe') maybeCount++
                        else if (pendingStatus === 'unavailable') unavailableCount++
                      }
                    })
                    
                    // Format: "Mon 1-2-26 @7:45P"
                    const dayOfWeek = formatDate(item.date, 'EEE')
                    const itemDate = formatDate(item.date, 'M-d-yy')
                    const timeStr = formatTime(item.time)
                    const timeParts = timeStr.split(':')
                    const hour = parseInt(timeParts[0])
                    const minute = timeParts[1].split(' ')[0]
                    const ampm = timeStr.includes('AM') ? 'A' : 'P'
                    const formattedTime = `${hour}:${minute}${ampm}`
                    const dateTimeText = `${dayOfWeek} ${itemDate} @${formattedTime}`
                    
                    return (
                      <th 
                        key={item.id} 
                        className={cn(
                          "p-2 border-r cursor-pointer hover:bg-gray-100 transition-colors",
                          getTeamColorClass(item.team_id, 'border', teamColor),
                          "border-l-4"
                        )}
                        onClick={() => {
                          if (item.type === 'event') {
                            router.push(`/teams/${item.team_id}/events/${item.id}`)
                          } else {
                            router.push(`/teams/${item.team_id}/matches/${item.id}`)
                          }
                        }}
                      >
                        <div className="text-xs font-medium mb-1 text-left px-1 text-foreground">
                          {dateTimeText || 'No date'}
                        </div>
                        <div className="space-y-0.5">
                          <div className={cn(
                            "text-xs font-medium",
                            availableCount >= baseCount.total ? "text-green-600" : "text-red-600"
                          )}>
                            {(() => {
                              const eventType = item.type === 'event' ? (item as any).event_type : null
                              const isPractice = eventType === 'practice'
                              // For practices, show X/Y format (available/total team members)
                              if (isPractice) {
                                return `${availableCount}/${data.players.length}`
                              }
                              // For matches and other events, show X of Y format
                              return `${availableCount} of ${baseCount.total}`
                            })()}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {lastResortCount > 0 && (
                              <div className="text-purple-600">Last Resort: {lastResortCount}</div>
                            )}
                            {maybeCount > 0 && (
                              <div className="text-yellow-600">Unsure: {maybeCount}</div>
                            )}
                            {unavailableCount > 0 && (
                              <div className="text-red-600">Not Available: {unavailableCount}</div>
                            )}
                          </div>
                        </div>
                      </th>
                    )
                  })}
                </tr>
                {/* Third header row: Opponent/Event names */}
                <tr className="border-b bg-gray-50">
                  <th className="sticky left-0 bg-gray-50 p-2 border-r z-10"></th>
                  <th className="p-2 text-center text-xs text-muted-foreground border-r"></th>
                  {getDisplayedItems().map(item => {
                    const displayName = item.type === 'match' 
                      ? ((item as Match).opponent_name || 'TBD')
                      : ((item as any).event_name || 'Event')
                    const isMatch = item.type === 'match'
                    const isHome = isMatch && (item as Match).is_home
                    const isAway = isMatch && !(item as Match).is_home
                    return (
                      <th 
                        key={item.id} 
                        className={cn(
                          "p-2 border-r cursor-pointer hover:bg-gray-100 transition-colors",
                          getTeamColorClass(item.team_id, 'border', teamColor),
                          "border-l-4"
                        )}
                        onClick={() => {
                          if (item.type === 'event') {
                            router.push(`/teams/${item.team_id}/events/${item.id}`)
                          } else {
                            router.push(`/teams/${item.team_id}/matches/${item.id}`)
                          }
                        }}
                      >
                        <div className="text-xs font-medium text-left px-1 flex items-center gap-1">
                          {displayName}
                          {isHome && (
                            <Badge variant="default" className="text-[10px] px-1 py-0 h-4 bg-teal-500 text-white">
                              Home
                            </Badge>
                          )}
                          {isAway && (
                            <Badge variant="default" className="text-[10px] px-1 py-0 h-4 bg-orange-500 text-white">
                              Away
                            </Badge>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {data.players.map(player => (
                  <tr key={player.id} className="border-b hover:bg-muted/50">
                    {/* Player column */}
                    <td className="sticky left-0 bg-background p-2 border-r z-10">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(player.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <span className="text-sm font-medium">{player.full_name}</span>
                          {isCaptain && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 ml-1"
                              onClick={() => handleBulkAvailability('row', player.id)}
                              title="Mark all events for this player"
                            >
                              <Users className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* History column */}
                    <td className="p-2 text-center text-xs border-r">
                      <div className="space-y-0.5">
                        <div>- Avail {player.stats.availabilityCount} of {getDisplayedItems().length}</div>
                      </div>
                    </td>
                    
                    {/* Item columns */}
                    {getDisplayedItems().map(item => {
                      const avail = data.availability[player.id]?.[item.id]
                      const pendingStatus = pendingChanges[player.id]?.[item.id]
                      // Show pending status if available, otherwise show saved status
                      // If pending status is 'clear', show as no status (null)
                      const status = pendingStatus === 'clear' ? null : (pendingStatus || avail?.status)
                      const hasPendingChange = !!pendingStatus
                      const popoverKey = `${player.id}-${item.id}`
                      const isOpen = openPopovers[popoverKey] || false
                      
                      return (
                        <td key={item.id} className="p-2 text-center border-r relative group">
                          {isSystemAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive z-10"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleClearAvailability('cell', player.id, item.id)
                              }}
                              title="Clear cell (Admin)"
                            >
                              <XIcon className="h-3 w-3" />
                            </Button>
                          )}
                          {(() => {
                            // Debug: Log captain status (only once per render cycle)
                            if (player.id === data.players[0]?.id && item.id === getDisplayedItems()[0]?.id) {
                              console.log('🔍 Rendering first cell:', {
                                isCaptain,
                                isCaptainType: typeof isCaptain,
                                isCaptainValue: isCaptain,
                                editingEnabled: isCaptain ? '✅ YES' : '❌ NO'
                              })
                            }
                            return isCaptain
                          })() ? (
                            <Popover open={isOpen} onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, [popoverKey]: open }))}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={cn(
                                    'w-full justify-between text-xs',
                                    getStatusButtonClass(status),
                                    hasPendingChange && 'ring-2 ring-blue-500 ring-offset-1'
                                  )}
                                >
                                  <span className="flex items-center gap-1">
                                    {getStatusIcon(status)}
                                    {getStatusLabel(status)}
                                    {hasPendingChange && <span className="text-blue-500">*</span>}
                                  </span>
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-0">
                                <div className="py-1">
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start rounded-none"
                                    onClick={() => updateAvailabilityLocal(player.id, item.id, 'available')}
                                  >
                                    <Check className="h-4 w-4 mr-2 text-green-500" />
                                    Available
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start rounded-none"
                                    onClick={() => updateAvailabilityLocal(player.id, item.id, 'unavailable')}
                                  >
                                    <X className="h-4 w-4 mr-2 text-red-500" />
                                    Unavailable
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start rounded-none"
                                    onClick={() => updateAvailabilityLocal(player.id, item.id, 'maybe')}
                                  >
                                    <HelpCircle className="h-4 w-4 mr-2 text-yellow-500" />
                                    Maybe
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start rounded-none"
                                    onClick={() => updateAvailabilityLocal(player.id, item.id, 'last_resort')}
                                  >
                                    <HelpCircle className="h-4 w-4 mr-2 text-purple-500" />
                                    Last Resort
                                  </Button>
                                  {isCaptain && (
                                    <>
                                      <div className="border-t my-1" />
                                      <Button
                                        variant="ghost"
                                        className="w-full justify-start rounded-none text-gray-600 hover:text-gray-900"
                                        onClick={() => updateAvailabilityLocal(player.id, item.id, 'clear')}
                                      >
                                        <Eraser className="h-4 w-4 mr-2 text-gray-500" />
                                        Clear Status
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            // Read-only view for non-captains - they can see all availability but can't edit
                            <div className={cn(
                              'flex items-center justify-center h-8 w-full rounded border cursor-default',
                              getStatusButtonClass(status)
                            )}>
                              {status ? (
                                <span className="flex items-center gap-1 text-xs">
                                  {getStatusIcon(status)}
                                  {getStatusLabel(status)}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">?</span>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bulk Availability Dialog */}
        <AlertDialog open={bulkAvailabilityDialog.open} onOpenChange={(open) => setBulkAvailabilityDialog({ open, type: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {bulkAvailabilityDialog.type === 'row' ? 'Set Availability for All Events' : 'Set Availability for All Players'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {bulkAvailabilityDialog.type === 'row' 
                  ? 'This will set the availability status for this player across all displayed events. Existing availability will be overwritten.'
                  : 'This will set the availability status for all players for this event. Existing availability will be overwritten.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-4">
              <Button
                variant={bulkStatus === 'available' ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setBulkStatus('available')}
              >
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Available
              </Button>
              <Button
                variant={bulkStatus === 'unavailable' ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setBulkStatus('unavailable')}
              >
                <X className="h-4 w-4 mr-2 text-red-500" />
                Unavailable
              </Button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setBulkAvailabilityDialog({ open: false, type: null })
                setBulkStatus(null)
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmBulkAvailability}
                disabled={!bulkStatus}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Clear Availability Confirmation Dialog (Sysadmin) */}
        <AlertDialog open={clearAvailabilityDialog.open} onOpenChange={(open) => {
          if (!open) setClearAvailabilityDialog({ open: false, type: null })
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Availability?</AlertDialogTitle>
              <AlertDialogDescription>
                {clearAvailabilityDialog.type === 'cell' && 'Are you sure you want to clear availability for this player and event?'}
                {clearAvailabilityDialog.type === 'column' && 'Are you sure you want to clear availability for all players for this event?'}
                {clearAvailabilityDialog.type === 'row' && 'Are you sure you want to clear availability for all events for this player?'}
                {clearAvailabilityDialog.type === 'grid' && 'Are you sure you want to clear ALL availability for this entire grid? This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmClearAvailability} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Clear
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}
