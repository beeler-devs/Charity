'use client'

import { useEffect, useState } from 'react'
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
import { Check, X, HelpCircle, Clock, Info, ChevronDown, ArrowLeft, Save, Filter, Users } from 'lucide-react'
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
import { getTeamColorClass } from '@/lib/team-colors'

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
  availabilityCounts: Record<string, { available: number; total: number }>
}

export default function AvailabilityPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
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
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, 'available' | 'unavailable' | 'maybe' | 'last_resort'>>>({})
  const [bulkAvailabilityDialog, setBulkAvailabilityDialog] = useState<{
    open: boolean
    type: 'row' | 'event' | null
    playerId?: string
    itemId?: string
  }>({ open: false, type: null })
  const [bulkStatus, setBulkStatus] = useState<'available' | 'unavailable' | null>(null)
  const { toast } = useToast()

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  useEffect(() => {
    loadAvailabilityData()
  }, [teamId])

  async function loadAvailabilityData() {
    const supabase = createClient()
    setLoading(true)

    // Get current user and check if captain, also load team configuration
    const { data: { user } } = await supabase.auth.getUser()
    
    // Load team configuration and name
    const { data: teamData } = await supabase
      .from('teams')
      .select('name, captain_id, co_captain_id, total_lines, line_match_types, color')
      .eq('id', teamId)
      .single()
    
    if (teamData?.name) {
      setTeamName(teamData.name)
    }
    if (teamData) {
      setTeamColor((teamData as any).color || null)
    }

    let teamTotalLines = 3 // Default to 3 courts
    let teamLineMatchTypes: string[] = []
    
    if (!user) {
      setIsCaptain(false)
    } else if (teamData) {
      const isUserCaptain = teamData.captain_id === user.id || teamData.co_captain_id === user.id
      setIsCaptain(isUserCaptain)
      
      // Get team configuration for calculating players needed
      teamTotalLines = teamData.total_lines || 3
      if (teamData.line_match_types && Array.isArray(teamData.line_match_types)) {
        teamLineMatchTypes = teamData.line_match_types
      }
    } else {
      setIsCaptain(false)
    }

    // Load roster
    const { data: players } = await supabase
      .from('roster_members')
      .select('*')
      .eq('team_id', teamId)
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
      .eq('team_id', teamId)
      .gte('date', today)
      .order('date')
      .limit(20)

    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('team_id', teamId)
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
          event_type: e.event_type || null,
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
    const { data: availabilityData } = await supabase
      .from('availability')
      .select('*')
      .in('roster_member_id', playerIds)
      .or(`match_id.in.(${matchIds.join(',')}),event_id.in.(${eventIds.join(',')})`)

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
      
      // Count only players with status = 'available' (not maybe, late, etc.)
      // This will be recalculated when rendering to include pending changes
      playerIds.forEach(playerId => {
        const avail = availability[playerId]?.[itemId]
        if (avail && avail.status === 'available') {
          available++
        }
      })
      
      // For events, use total team members (for practices, show X/Y format)
      // For matches, use the calculated playersNeeded
      const totalNeeded = item.type === 'match' 
        ? playersNeeded 
        : (item.type === 'event' && (item as any).event_type === 'practice' 
          ? playerIds.length // For practices, use total team members
          : 1) // Other events default to 1
      availabilityCounts[itemId] = { available, total: totalNeeded }
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
    status: 'available' | 'unavailable' | 'maybe' | 'late' | 'last_resort'
  ) {
    try {
      if (!isCaptain) {
        toast({
          title: 'Permission Denied',
          description: 'Only captains can set availability for other players',
          variant: 'destructive',
        })
        return
      }

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
      for (const [playerId, itemChanges] of Object.entries(pendingChanges)) {
        for (const [itemId, status] of Object.entries(itemChanges)) {
          const existing = data.availability[playerId]?.[itemId]
          
          // Determine if this is a match or event
          const item = data.items.find(i => i.id === itemId)
          const isMatch = item?.type === 'match'

          try {
            if (existing) {
              // Update existing availability record
              const { error } = await supabase
                .from('availability')
                .update({ status })
                .eq('id', existing.id)
              
              if (error) {
                console.error('Error updating availability:', error)
                errors.push(`${playerId}-${itemId}: ${error.message}`)
              }
            } else {
              // Insert new availability record
              const insertData: any = {
                roster_member_id: playerId,
                status,
              }
              
              if (isMatch) {
                insertData.match_id = itemId
              } else {
                insertData.event_id = itemId
              }
              
              const { error } = await supabase
                .from('availability')
                .insert(insertData)
              
              if (error) {
                console.error('Error inserting availability:', error)
                errors.push(`${playerId}-${itemId}: ${error.message}`)
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
        await loadAvailabilityData()
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

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'available':
        return <Check className="h-4 w-4 text-green-500" />
      case 'unavailable':
        return <X className="h-4 w-4 text-red-500" />
      case 'maybe':
        return <HelpCircle className="h-4 w-4 text-yellow-500" />
      case 'late':
        return <Clock className="h-4 w-4 text-orange-500" />
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

      <main className="flex-1 p-4 pt-2">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" onClick={() => router.back()} size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          {isCaptain && Object.keys(pendingChanges).length > 0 && (
            <Button 
              onClick={saveAllChanges} 
              disabled={saving}
              className="ml-auto"
              size="sm"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : `Save ${Object.values(pendingChanges).reduce((sum, changes) => sum + Object.keys(changes).length, 0)} Change(s)`}
            </Button>
          )}
        </div>

        {/* Event Type Filter */}
        <Card className="mb-4">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm font-medium">Show:</Label>
              <div className="flex items-center gap-2 flex-wrap">
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
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                {/* First header row: Column names */}
                <tr className="border-b">
                  <th className="sticky left-0 bg-background p-2 text-left text-sm font-medium border-r min-w-[150px] z-10">
                    PLAYER
                  </th>
                  <th className="p-2 text-center text-sm font-medium border-r min-w-[120px] bg-gray-50">
                    HISTORY
                  </th>
                  {getDisplayedItems().map((item, index) => {
                    const eventType = item.type === 'event' ? ((item as any).event_type || 'other') : null
                    const isPractice = eventType === 'practice'
                    const isWarmup = eventType === 'warmup'
                    const isSocial = eventType === 'social'
                    const isOther = eventType === 'other' || !eventType
                    return (
                      <th 
                        key={item.id} 
                        className={cn(
                          "p-2 text-center text-sm font-medium border-r min-w-[140px] relative border-l-4",
                          item.type === 'match' 
                            ? "bg-gray-50 border-l-gray-500"
                            : isPractice
                            ? "bg-blue-50 border-l-blue-500"
                            : isWarmup
                            ? "bg-orange-50 border-l-orange-500"
                            : isSocial
                            ? "bg-pink-50 border-l-pink-500"
                            : isOther
                            ? cn("bg-gray-50", getTeamColorClass(item.team_id, 'border', teamColor))
                            : cn("bg-gray-50", getTeamColorClass(item.team_id, 'border', teamColor))
                        )}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {item.type === 'match' ? (
                            <Badge variant="default" className="text-xs">MATCH {index + 1} {(item as Match).is_home ? '(H)' : '(A)'}</Badge>
                          ) : isPractice ? (
                            <Badge variant="default" className="text-xs bg-blue-500 text-white">PRACTICE {index + 1}</Badge>
                          ) : isWarmup ? (
                            <Badge variant="default" className="text-xs bg-orange-500 text-white">WARMUP {index + 1}</Badge>
                          ) : isSocial ? (
                            <Badge variant="default" className="text-xs bg-pink-500 text-white">SOCIAL {index + 1}</Badge>
                          ) : eventType ? (
                            <Badge variant="secondary" className={cn("text-xs", getEventTypeBadgeClass(eventType as any))}>
                              {getEventTypeLabel(eventType as any)} {index + 1}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-800">
                              EVENT {index + 1}
                            </Badge>
                          )}
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
                    const baseCount = data.availabilityCounts[item.id] || { available: 0, total: data.players.length }
                    
                    // Recalculate available count including pending changes
                    let availableCount = baseCount.available
                    data.players.forEach(player => {
                      const pendingStatus = pendingChanges[player.id]?.[item.id]
                      const savedStatus = data.availability[player.id]?.[item.id]?.status
                      
                      if (pendingStatus) {
                        // Adjust count based on pending change
                        if (savedStatus === 'available' && pendingStatus !== 'available') {
                          availableCount-- // Was available, now not
                        } else if (savedStatus !== 'available' && pendingStatus === 'available') {
                          availableCount++ // Was not available, now is
                        }
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
                        <div className="text-xs font-medium mb-1 text-left px-1">
                          {dateTimeText}
                        </div>
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
                        <div className="text-xs font-medium text-left px-1">
                          {displayName}
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
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(player.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center hover:bg-blue-600"
                              >
                                <Info className="h-3 w-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64">
                              <div className="space-y-2 text-sm">
                                <div>
                                  <strong>Name:</strong> {player.full_name}
                                </div>
                                {player.email && (
                                  <div>
                                    <strong>Email:</strong> {player.email}
                                  </div>
                                )}
                                {player.phone && (
                                  <div>
                                    <strong>Phone:</strong> {player.phone}
                                  </div>
                                )}
                                {player.ntrp_rating && (
                                  <div>
                                    <strong>NTRP:</strong> {player.ntrp_rating}
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
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
                        <div>- Played {player.stats.matchesPlayed} of {getDisplayedItems().filter(i => i.type === 'match').length}</div>
                        <div>- {player.stats.matchesWon} wins / {player.stats.matchesLost} loss</div>
                        <div>- Avail {player.stats.availabilityCount} of {getDisplayedItems().length}</div>
                      </div>
                    </td>
                    
                    {/* Item columns */}
                    {getDisplayedItems().map(item => {
                      const avail = data.availability[player.id]?.[item.id]
                      const pendingStatus = pendingChanges[player.id]?.[item.id]
                      // Show pending status if available, otherwise show saved status
                      const status = pendingStatus || avail?.status
                      const hasPendingChange = !!pendingStatus
                      const popoverKey = `${player.id}-${item.id}`
                      const isOpen = openPopovers[popoverKey] || false
                      
                      return (
                        <td key={item.id} className="p-2 text-center border-r">
                          {isCaptain ? (
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
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
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
      </main>
    </div>
  )
}
