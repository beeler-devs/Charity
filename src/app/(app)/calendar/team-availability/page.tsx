'use client'

import { useEffect, useState, Suspense, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { getTeamColor } from '@/lib/team-colors'
import { getEffectiveUserId } from '@/lib/impersonation'
import { Check, X, HelpCircle, ArrowLeft, Calendar, Users } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getEventTypeLabel, getEventTypeBadgeClass } from '@/lib/event-type-colors'
import { EventTypeBadge } from '@/components/events/event-type-badge'

interface TeamEvent {
  id: string
  team_id: string
  event_name?: string
  opponent_name?: string
  event_type: string | null
  type: 'event' | 'match'
  date: string
  time: string
  location: string | null
  venue?: string | null
  description?: string | null
  team_name: string
  availability_status?: string | null
  is_home?: boolean
}

function TeamAvailabilityContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Handle async searchParams in Next.js 15 - useSearchParams() returns a Promise in some contexts
  const resolvedSearchParams = searchParams && typeof searchParams === 'object' && 'then' in searchParams
    ? use(searchParams as unknown as Promise<URLSearchParams>)
    : searchParams
  const teamId = resolvedSearchParams.get('teamId')
  const [events, setEvents] = useState<TeamEvent[]>([])
  const [allEvents, setAllEvents] = useState<TeamEvent[]>([]) // Store all events for filtering
  const [teams, setTeams] = useState<Array<{ id: string; name: string; color?: string | null }>>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(teamId)
  const [showAllTeams, setShowAllTeams] = useState(false)
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(['match', 'practice', 'warmup', 'other'])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    if (showAllTeams && teams.length > 0) {
      loadAllTeamsEvents()
    } else if (selectedTeamId) {
      loadTeamEvents(selectedTeamId)
    }
  }, [selectedTeamId, showAllTeams, teams.length])

  async function loadTeams() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    // Get effective user ID (impersonated or logged-in)
    const effectiveUserId = getEffectiveUserId(user.id)

    // Get teams where user is a roster member
    const { data: rosterMembers } = await supabase
      .from('roster_members')
      .select('team_id, teams(id, name, color)')
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)

    if (rosterMembers) {
      const teamList = rosterMembers
        .map((rm: any) => {
          const team = Array.isArray(rm.teams) ? rm.teams[0] : rm.teams
          return team ? { id: team.id, name: team.name, color: team.color || null } : null
        })
        .filter((t): t is { id: string; name: string; color: string | null } => t !== null)

      setTeams(teamList)

      // If no team selected and we have teams, select the first one
      if (!selectedTeamId && teamList.length > 0) {
        setSelectedTeamId(teamList[0].id)
      }
    }
  }

  async function loadTeamEvents(teamId: string) {
    const supabase = createClient()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // Get effective user ID (impersonated or logged-in)
    const effectiveUserId = getEffectiveUserId(user.id)

    // Get roster member ID for this team
    const { data: rosterMember } = await supabase
      .from('roster_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)
      .maybeSingle()

    if (!rosterMember) {
      setLoading(false)
      return
    }

    // Get team name
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()

    // Get all future events and matches for this team
    const today = new Date().toISOString().split('T')[0]
    
    // Load events
    const { data: teamEvents } = await supabase
      .from('events')
      .select('id, event_name, event_type, date, time, location, description, team_id')
      .eq('team_id', teamId)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    // Load matches
    const { data: teamMatches } = await supabase
      .from('matches')
      .select('id, opponent_name, date, time, venue, team_id, is_home')
      .eq('team_id', teamId)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    // Combine events and matches
    const allItems: TeamEvent[] = []
    
    if (teamEvents) {
      teamEvents.forEach(event => {
        allItems.push({
          id: event.id,
          team_id: event.team_id,
          event_name: event.event_name,
          event_type: event.event_type,
          type: 'event',
          date: event.date,
          time: event.time,
          location: event.location,
          description: event.description,
          team_name: team?.name || '',
        })
      })
    }

    if (teamMatches) {
      teamMatches.forEach(match => {
        allItems.push({
          id: match.id,
          team_id: match.team_id,
          opponent_name: match.opponent_name,
          event_type: 'match',
          type: 'match',
          date: match.date,
          time: match.time,
          venue: match.venue,
          location: match.venue,
          team_name: team?.name || '',
          is_home: match.is_home,
        })
      })
    }

    // Sort by date and time
    allItems.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.time.localeCompare(b.time)
    })

    if (allItems.length === 0) {
      setEvents([])
      setLoading(false)
      return
    }

    // Get availability for all items (events and matches)
    const eventIds = allItems.filter(item => item.type === 'event').map(e => e.id)
    const matchIds = allItems.filter(item => item.type === 'match').map(m => m.id)
    
    let availabilityQuery = supabase
      .from('availability')
      .select('event_id, match_id, status')
      .eq('roster_member_id', rosterMember.id)
    
    if (eventIds.length > 0 && matchIds.length > 0) {
      availabilityQuery = availabilityQuery.or(`event_id.in.(${eventIds.join(',')}),match_id.in.(${matchIds.join(',')})`)
    } else if (eventIds.length > 0) {
      availabilityQuery = availabilityQuery.in('event_id', eventIds)
    } else if (matchIds.length > 0) {
      availabilityQuery = availabilityQuery.in('match_id', matchIds)
    }
    
    const { data: availability } = await availabilityQuery

    // Map availability to items
    const availabilityMap = new Map<string, string>()
    availability?.forEach(avail => {
      if (avail.event_id) {
        availabilityMap.set(avail.event_id, avail.status)
      }
      if (avail.match_id) {
        availabilityMap.set(avail.match_id, avail.status)
      }
    })

    // Add availability status to all items
    const itemsWithAvailability: TeamEvent[] = allItems.map(item => ({
      ...item,
      availability_status: availabilityMap.get(item.id) || null,
    }))

    setAllEvents(itemsWithAvailability)
    // Apply filters
    applyFilters(itemsWithAvailability)
    setLoading(false)
  }

  async function loadAllTeamsEvents() {
    const supabase = createClient()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || teams.length === 0) {
      setLoading(false)
      return
    }

    // Get effective user ID (impersonated or logged-in)
    const effectiveUserId = getEffectiveUserId(user.id)

    // Get roster member IDs for all teams
    const teamIds = teams.map(t => t.id)
    const { data: rosterMembers } = await supabase
      .from('roster_members')
      .select('id, team_id')
      .in('team_id', teamIds)
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)

    if (!rosterMembers || rosterMembers.length === 0) {
      setEvents([])
      setLoading(false)
      return
    }

    const rosterMemberMap = new Map<string, string>() // team_id -> roster_member_id
    rosterMembers.forEach(rm => {
      rosterMemberMap.set(rm.team_id, rm.id)
    })

    // Get team names
    const { data: teamData } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', teamIds)

    const teamNameMap = new Map<string, string>()
    teamData?.forEach(team => {
      teamNameMap.set(team.id, team.name)
    })

    // Get all future events and matches for all teams
    const today = new Date().toISOString().split('T')[0]
    
    // Load events for all teams
    const { data: teamEvents } = await supabase
      .from('events')
      .select('id, event_name, event_type, date, time, location, description, team_id')
      .in('team_id', teamIds)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    // Load matches for all teams
    const { data: teamMatches } = await supabase
      .from('matches')
      .select('id, opponent_name, date, time, venue, team_id, is_home')
      .in('team_id', teamIds)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    // Combine events and matches
    const allItems: TeamEvent[] = []
    
    if (teamEvents) {
      teamEvents.forEach(event => {
        allItems.push({
          id: event.id,
          team_id: event.team_id,
          event_name: event.event_name,
          event_type: event.event_type,
          type: 'event',
          date: event.date,
          time: event.time,
          location: event.location,
          description: event.description,
          team_name: teamNameMap.get(event.team_id) || '',
        })
      })
    }

    if (teamMatches) {
      teamMatches.forEach(match => {
        allItems.push({
          id: match.id,
          team_id: match.team_id,
          opponent_name: match.opponent_name,
          event_type: 'match',
          type: 'match',
          date: match.date,
          time: match.time,
          venue: match.venue,
          location: match.venue,
          description: null,
          team_name: teamNameMap.get(match.team_id) || '',
          is_home: match.is_home,
        })
      })
    }

    // Sort by date and time
    allItems.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.time.localeCompare(b.time)
    })

    if (allItems.length === 0) {
      setEvents([])
      setLoading(false)
      return
    }

    // Get availability for all items across all teams
    const eventIds = allItems.filter(item => item.type === 'event').map(e => e.id)
    const matchIds = allItems.filter(item => item.type === 'match').map(m => m.id)
    
    // Build availability query for all roster members
    const rosterMemberIds = Array.from(rosterMemberMap.values())
    let availabilityQuery = supabase
      .from('availability')
      .select('event_id, match_id, status, roster_member_id')
      .in('roster_member_id', rosterMemberIds)
    
    if (eventIds.length > 0 && matchIds.length > 0) {
      availabilityQuery = availabilityQuery.or(`event_id.in.(${eventIds.join(',')}),match_id.in.(${matchIds.join(',')})`)
    } else if (eventIds.length > 0) {
      availabilityQuery = availabilityQuery.in('event_id', eventIds)
    } else if (matchIds.length > 0) {
      availabilityQuery = availabilityQuery.in('match_id', matchIds)
    }
    
    const { data: availability } = await availabilityQuery

    // Map availability to items (keyed by item id and roster member id)
    const availabilityMap = new Map<string, string>() // "itemId-rosterMemberId" -> status
    availability?.forEach(avail => {
      if (avail.event_id) {
        availabilityMap.set(`${avail.event_id}-${avail.roster_member_id}`, avail.status)
      }
      if (avail.match_id) {
        availabilityMap.set(`${avail.match_id}-${avail.roster_member_id}`, avail.status)
      }
    })

    // Add availability status to all items (match by item id and team's roster member)
    const itemsWithAvailability: TeamEvent[] = allItems.map(item => {
      const rosterMemberId = rosterMemberMap.get(item.team_id)
      const availabilityKey = rosterMemberId ? `${item.id}-${rosterMemberId}` : null
      return {
        ...item,
        availability_status: availabilityKey ? availabilityMap.get(availabilityKey) || null : null,
      }
    })

    setAllEvents(itemsWithAvailability)
    // Apply filters
    applyFilters(itemsWithAvailability)
    setLoading(false)
  }

  function applyFilters(items: TeamEvent[]) {
    const filtered = items.filter(item => {
      if (item.type === 'match') {
        return selectedEventTypes.includes('match')
      } else {
        const eventType = item.event_type || 'other'
        return selectedEventTypes.includes(eventType)
      }
    })
    setEvents(filtered)
  }

  useEffect(() => {
    if (allEvents.length > 0) {
      applyFilters(allEvents)
    }
  }, [selectedEventTypes])

  async function updateAvailability(itemId: string, status: 'available' | 'unavailable' | 'maybe' | 'last_resort') {
    const supabase = createClient()
    setSaving(prev => ({ ...prev, [itemId]: true }))

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(prev => ({ ...prev, [itemId]: false }))
      return
    }

    // Find the item to determine if it's an event or match and which team it belongs to
    const item = events.find(e => e.id === itemId)
    if (!item) {
      setSaving(prev => ({ ...prev, [itemId]: false }))
      return
    }

    // Get effective user ID (impersonated or logged-in)
    const effectiveUserId = getEffectiveUserId(user.id)

    // Get roster member ID for the team this item belongs to
    const teamIdForItem = item.team_id
    const { data: rosterMember } = await supabase
      .from('roster_members')
      .select('id')
      .eq('team_id', teamIdForItem)
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)
      .maybeSingle()

    if (!rosterMember) {
      toast({
        title: 'Error',
        description: 'Could not find roster membership',
        variant: 'destructive',
      })
      setSaving(prev => ({ ...prev, [itemId]: false }))
      return
    }

    // Check if availability exists
    let existingQuery = supabase
      .from('availability')
      .select('id')
      .eq('roster_member_id', rosterMember.id)
    
    if (item.type === 'event') {
      existingQuery = existingQuery.eq('event_id', itemId)
    } else {
      existingQuery = existingQuery.eq('match_id', itemId)
    }
    
    const { data: existing } = await existingQuery.maybeSingle()

    let error = null
    if (existing) {
      const result = await supabase
        .from('availability')
        .update({ status })
        .eq('id', existing.id)
      error = result.error
    } else {
      const insertData: any = {
        roster_member_id: rosterMember.id,
        status,
      }
      
      if (item.type === 'event') {
        insertData.event_id = itemId
      } else {
        insertData.match_id = itemId
      }
      
      const result = await supabase
        .from('availability')
        .insert(insertData)
      error = result.error
    }

    setSaving(prev => ({ ...prev, [itemId]: false }))

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Updated',
        description: `Availability set to ${getStatusLabel(status)}`,
      })

      // Update local state
      setEvents(prev => prev.map(e =>
        e.id === itemId
          ? { ...e, availability_status: status }
          : e
      ))
    }
  }

  function getStatusLabel(status: string | null | undefined) {
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
        return 'Not Set'
    }
  }

  function getStatusIcon(status: string | null | undefined) {
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

  if (loading && events.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Team Availability" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-16">
      <Header title="Team Availability" />
      
      <main className="flex-1 p-4 space-y-2">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => router.back()} size="sm" className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Team Selector */}
        {teams.length > 0 && (
          <Card>
            <CardContent className="p-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground mr-1">Teams:</span>
                <Button
                  variant={showAllTeams ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setShowAllTeams(true)
                    setSelectedTeamId(null)
                  }}
                >
                  All Teams
                </Button>
                {teams.map((team) => {
                  const isSelected = showAllTeams || selectedTeamId === team.id
                  const teamColor = getTeamColor(team.id, team.color)
                  return (
                    <Button
                      key={team.id}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-7 text-xs",
                        isSelected && "text-white"
                      )}
                      style={isSelected ? {
                        backgroundColor: teamColor.hex,
                        borderColor: teamColor.hex,
                      } : {
                        borderColor: teamColor.hex,
                        color: teamColor.hex,
                      }}
                      onClick={() => {
                        setSelectedTeamId(team.id)
                        setShowAllTeams(false)
                      }}
                    >
                      {team.name}
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Event Type Filter */}
        {(selectedTeamId || showAllTeams) && (
          <Card>
            <CardContent className="p-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground mr-1">Event Types:</span>
                {['match', 'practice', 'warmup', 'other'].map((eventType) => {
                  const isSelected = selectedEventTypes.includes(eventType)
                  // Get color for event type
                  let eventColor = 'rgb(168, 85, 247)' // default purple
                  if (eventType === 'practice') {
                    eventColor = 'rgb(37, 99, 235)' // blue-600
                  } else if (eventType === 'warmup') {
                    eventColor = 'rgb(249, 115, 22)' // orange-500
                  } else if (eventType === 'match') {
                    eventColor = 'rgb(34, 197, 94)' // green-500
                  }
                  return (
                    <Button
                      key={eventType}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-7 text-xs",
                        isSelected && "text-white"
                      )}
                      style={isSelected ? {
                        backgroundColor: eventColor,
                        borderColor: eventColor,
                      } : {
                        borderColor: eventColor,
                        color: eventColor,
                      }}
                      onClick={() => {
                        if (isSelected) {
                          // Deselect if clicking a selected type (but keep at least one)
                          if (selectedEventTypes.length > 1) {
                            setSelectedEventTypes(selectedEventTypes.filter(t => t !== eventType))
                          } else {
                            toast({
                              title: 'Cannot deselect',
                              description: 'At least one event type must be selected',
                              variant: 'default',
                            })
                          }
                        } else {
                          // Add to selection
                          setSelectedEventTypes([...selectedEventTypes, eventType])
                        }
                      }}
                    >
                      {eventType === 'match' ? 'Match' : eventType.charAt(0).toUpperCase() + eventType.slice(1)}
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events List */}
        {!selectedTeamId && !showAllTeams ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Please select a team to view events</p>
            </CardContent>
          </Card>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">
                {showAllTeams ? 'No upcoming events for your teams' : 'No upcoming events for this team'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {events.map(event => (
              <Card key={event.id} className="overflow-hidden">
                <CardContent className="p-3">
                  {/* Compressed single-line layout */}
                  <div className="flex items-center gap-3">
                    {/* Left: Event/Match Info */}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      {/* Badge */}
                      {event.type === 'match' ? (
                        <Badge className="bg-emerald-700 text-white text-xs shrink-0">M</Badge>
                      ) : event.event_type && (
                        <div className="shrink-0">
                          <EventTypeBadge eventType={event.event_type} />
                        </div>
                      )}
                      
                      {/* Event/Match Name */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">
                            {event.type === 'match' 
                              ? `${event.is_home ? 'vs' : 'at'} ${event.opponent_name || 'TBD'}`
                              : event.event_name}
                          </span>
                          {showAllTeams && event.team_name && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              {event.team_name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(event.date, 'EEE M/d')}</span>
                          <span>•</span>
                          <span>{formatTime(event.time)}</span>
                          {event.location && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[120px]">{event.location}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Status and Quick Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Current Status Indicator */}
                      {event.availability_status && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded border text-xs">
                          {getStatusIcon(event.availability_status)}
                          <span className="hidden sm:inline">{getStatusLabel(event.availability_status)}</span>
                        </div>
                      )}
                      
                      {/* Quick Action Buttons - Compact */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant={event.availability_status === 'available' ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            "h-8 w-8 p-0",
                            event.availability_status === 'available' && "bg-green-600 hover:bg-green-700 text-white border-green-600"
                          )}
                          onClick={() => updateAvailability(event.id, 'available')}
                          disabled={saving[event.id]}
                          title="Available"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={event.availability_status === 'maybe' ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            "h-8 w-8 p-0",
                            event.availability_status === 'maybe' && "bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
                          )}
                          onClick={() => updateAvailability(event.id, 'maybe')}
                          disabled={saving[event.id]}
                          title="Maybe"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={event.availability_status === 'last_resort' ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            "h-8 w-8 p-0",
                            event.availability_status === 'last_resort' && "bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                          )}
                          onClick={() => updateAvailability(event.id, 'last_resort')}
                          disabled={saving[event.id]}
                          title="Last Resort"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={event.availability_status === 'unavailable' ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            "h-8 w-8 p-0",
                            event.availability_status === 'unavailable' && "bg-red-600 hover:bg-red-700 text-white border-red-600"
                          )}
                          onClick={() => updateAvailability(event.id, 'unavailable')}
                          disabled={saving[event.id]}
                          title="Unavailable"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default function TeamAvailabilityPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen">
        <Header title="Team Availability" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    }>
      <TeamAvailabilityContent />
    </Suspense>
  )
}
