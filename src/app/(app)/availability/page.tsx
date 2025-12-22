'use client'

import { useEffect, useState, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatTime } from '@/lib/utils'
import { getEventTypeLabel, getEventTypeBadgeClass } from '@/lib/event-type-colors'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Check, X, HelpCircle, Clock, Save, Users, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Event, Match, Team } from '@/types/database.types'
import Link from 'next/link'

type AvailabilityStatus = 'available' | 'unavailable' | 'maybe' | 'late' | 'last_resort'

interface EventItem {
  id: string
  type: 'event' | 'match'
  name: string
  date: string
  time: string
  teamId: string
  teamName: string
  eventType?: string | null
  location?: string | null
  currentStatus?: AvailabilityStatus
}

export default function BulkAvailabilityPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [events, setEvents] = useState<EventItem[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [captainTeams, setCaptainTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all')
  const [selectedEventType, setSelectedEventType] = useState<string>('all')
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<AvailabilityStatus>('available')
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, AvailabilityStatus>>({})
  const [individualChanges, setIndividualChanges] = useState<Record<string, AvailabilityStatus>>({})

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // Get user's teams
    const { data: rosterMembers } = await supabase
      .from('roster_members')
      .select(`
        id,
        team_id,
        teams (
          id,
          name
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)

    const userTeams = rosterMembers?.map(rm => (rm.teams as Team)).filter(Boolean) || []
    setTeams(userTeams)

    // Get teams where user is captain or co-captain
    const { data: captainTeamsData } = await supabase
      .from('teams')
      .select('id, name')
      .or(`captain_id.eq.${user.id},co_captain_id.eq.${user.id}`)

    const captainTeamsList = captainTeamsData || []
    setCaptainTeams(captainTeamsList)

    if (userTeams.length === 0) {
      setLoading(false)
      return
    }

    const teamIds = userTeams.map(t => t.id)
    const rosterMemberIds = rosterMembers?.map(rm => rm.id).filter(Boolean) || []
    
    console.log('Loading availability for roster members:', rosterMemberIds)

    // Get all upcoming events
    const today = new Date().toISOString().split('T')[0]
    const { data: eventsData } = await supabase
      .from('events')
      .select(`
        id,
        event_name,
        date,
        time,
        location,
        event_type,
        team_id,
        teams (
          id,
          name
        )
      `)
      .in('team_id', teamIds)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    // Get all upcoming matches
    const { data: matchesData } = await supabase
      .from('matches')
      .select(`
        id,
        opponent_name,
        date,
        time,
        venue,
        team_id,
        teams (
          id,
          name
        )
      `)
      .in('team_id', teamIds)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    // Get existing availability
    const availMap: Record<string, AvailabilityStatus> = {}
    
    if (rosterMemberIds.length > 0) {
      const { data: availabilityData, error: availabilityError } = await supabase
        .from('availability')
        .select('*')
        .in('roster_member_id', rosterMemberIds)

      if (availabilityError) {
        console.error('Error loading availability:', availabilityError)
      } else {
        console.log('Loaded availability records:', availabilityData?.length || 0)
        
        // Build availability map
        availabilityData?.forEach(avail => {
          const itemId = avail.event_id || avail.match_id
          if (itemId) {
            availMap[itemId] = (avail.status as AvailabilityStatus) || 'unavailable'
          }
        })
        console.log('Availability map:', availMap)
      }
    } else {
      console.warn('No roster member IDs found, cannot load availability')
    }
    
    setAvailabilityMap(availMap)

    // Combine events and matches
    const allItems: EventItem[] = []

    eventsData?.forEach(event => {
      const team = event.teams as Team
      allItems.push({
        id: event.id,
        type: 'event',
        name: event.event_name,
        date: event.date,
        time: event.time,
        teamId: event.team_id,
        teamName: team.name,
        eventType: event.event_type,
        location: event.location || null,
        currentStatus: availMap[event.id],
      })
    })

    matchesData?.forEach(match => {
      const team = match.teams as Team
      allItems.push({
        id: match.id,
        type: 'match',
        name: `vs ${match.opponent_name}`,
        date: match.date,
        time: match.time,
        teamId: match.team_id,
        teamName: team.name,
        location: match.venue || null,
        currentStatus: availMap[match.id],
      })
    })

    // Sort by date and time
    allItems.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.time.localeCompare(b.time)
    })

    setEvents(allItems)
    setLoading(false)
  }

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (selectedTeamId !== 'all' && event.teamId !== selectedTeamId) {
        return false
      }
      if (selectedEventType !== 'all') {
        if (selectedEventType === 'match') {
          // If filtering for matches, only show matches
          return event.type === 'match'
        } else {
          // If filtering for event types, only show events (not matches) with that type
          if (event.type === 'match') {
            return false // Matches don't have event types
          }
          if (event.eventType !== selectedEventType) {
            return false
          }
        }
      }
      return true
    })
  }, [events, selectedTeamId, selectedEventType])

  const uniqueEventTypes = useMemo(() => {
    const types = new Set<string>()
    events.forEach(event => {
      if (event.type === 'event' && event.eventType) {
        types.add(event.eventType)
      }
    })
    return Array.from(types).sort()
  }, [events])

  function handleSelectAll() {
    if (selectedEvents.size === filteredEvents.length) {
      setSelectedEvents(new Set())
    } else {
      setSelectedEvents(new Set(filteredEvents.map(e => e.id)))
    }
  }

  function handleToggleEvent(eventId: string) {
    setSelectedEvents(prev => {
      const newSet = new Set(prev)
      if (newSet.has(eventId)) {
        newSet.delete(eventId)
      } else {
        newSet.add(eventId)
      }
      return newSet
    })
  }

  function handleIndividualStatusChange(eventId: string, status: AvailabilityStatus) {
    // Store change locally without committing to database
    setIndividualChanges(prev => {
      const newChanges = { ...prev }
      newChanges[eventId] = status
      return newChanges
    })
  }

  async function handleApplyIndividualChanges() {
    if (Object.keys(individualChanges).length === 0) {
      toast({
        title: 'No changes',
        description: 'No individual changes to apply',
      })
      return
    }

    setSaving(true)
    const supabase = createClient()

    // Get current user's roster memberships
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const { data: rosterMembers } = await supabase
      .from('roster_members')
      .select('id, team_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!rosterMembers || rosterMembers.length === 0) {
      toast({
        title: 'Error',
        description: 'No roster memberships found',
        variant: 'destructive',
      })
      setSaving(false)
      return
    }

    // Build roster member map by team
    const rosterMap = new Map<string, string>()
    rosterMembers.forEach(rm => {
      rosterMap.set(rm.team_id, rm.id)
    })

    const errors: string[] = []

    // Process all individual changes
    for (const [eventId, status] of Object.entries(individualChanges)) {
      const event = events.find(e => e.id === eventId)
      if (!event) {
        errors.push(`Event ${eventId} not found`)
        continue
      }

      const rosterMemberId = rosterMap.get(event.teamId)
      if (!rosterMemberId) {
        errors.push(`No roster membership found for team ${event.teamId}`)
        continue
      }

      // Check if availability record exists
      let existingRecord = null
      if (event.type === 'event') {
        const { data: existing } = await supabase
          .from('availability')
          .select('id')
          .eq('event_id', eventId)
          .eq('roster_member_id', rosterMemberId)
          .maybeSingle()
        existingRecord = existing
      } else {
        const { data: existing } = await supabase
          .from('availability')
          .select('id')
          .eq('match_id', eventId)
          .eq('roster_member_id', rosterMemberId)
          .maybeSingle()
        existingRecord = existing
      }

      let error = null
      if (existingRecord) {
        const { error: updateError } = await supabase
          .from('availability')
          .update({ status })
          .eq('id', existingRecord.id)
        error = updateError
      } else {
        const insertData: any = {
          roster_member_id: rosterMemberId,
          status,
        }
        if (event.type === 'event') {
          insertData.event_id = eventId
        } else {
          insertData.match_id = eventId
        }
        const { error: insertError } = await supabase
          .from('availability')
          .insert(insertData)
        error = insertError
      }

      if (error) {
        errors.push(`${event.name}: ${error.message}`)
      }
    }

    if (errors.length > 0) {
      toast({
        title: 'Error',
        description: `Failed to update some availability: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` and ${errors.length - 3} more` : ''}`,
        variant: 'destructive',
      })
      setSaving(false)
      // Still reload data to show what was saved
      await loadData()
      // Clear only successful changes
      setIndividualChanges({})
      return
    }

    toast({
      title: 'Success',
      description: `Updated availability for ${Object.keys(individualChanges).length} item(s)`,
    })

    // Clear changes and reload data
    setIndividualChanges({})
    await loadData()
    setSaving(false)
  }

  async function handleBulkUpdate() {
    if (selectedEvents.size === 0) {
      toast({
        title: 'No events selected',
        description: 'Please select at least one event to update',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    const supabase = createClient()

    // Get current user's roster memberships
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const { data: rosterMembers } = await supabase
      .from('roster_members')
      .select('id, team_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!rosterMembers || rosterMembers.length === 0) {
      toast({
        title: 'Error',
        description: 'No roster memberships found',
        variant: 'destructive',
      })
      setSaving(false)
      return
    }

    // Build roster member map by team
    const rosterMap = new Map<string, string>()
    rosterMembers.forEach(rm => {
      rosterMap.set(rm.team_id, rm.id)
    })

    // Update availability for each selected event
    const updates: Promise<any>[] = []
    const inserts: any[] = []
    const errors: string[] = []

    for (const eventId of selectedEvents) {
      const event = events.find(e => e.id === eventId)
      if (!event) {
        errors.push(`Event ${eventId} not found`)
        continue
      }

      const rosterMemberId = rosterMap.get(event.teamId)
      if (!rosterMemberId) {
        errors.push(`No roster membership found for team ${event.teamId}`)
        continue
      }

      // Check if availability record exists by querying the database
      let existingRecord = null
      if (event.type === 'event') {
        const { data: existing } = await supabase
          .from('availability')
          .select('id')
          .eq('event_id', eventId)
          .eq('roster_member_id', rosterMemberId)
          .maybeSingle()
        existingRecord = existing
      } else {
        const { data: existing } = await supabase
          .from('availability')
          .select('id')
          .eq('match_id', eventId)
          .eq('roster_member_id', rosterMemberId)
          .maybeSingle()
        existingRecord = existing
      }

      if (existingRecord) {
        // Update existing availability using the record ID
        const updateData: any = {
          status: bulkStatus,
        }

        const { error: updateError } = await supabase
          .from('availability')
          .update(updateData)
          .eq('id', existingRecord.id)

        if (updateError) {
          errors.push(`${event.name}: ${updateError.message}`)
        }
      } else {
        // Insert new availability
        const insertData: any = {
          roster_member_id: rosterMemberId,
          status: bulkStatus,
        }

        if (event.type === 'event') {
          insertData.event_id = eventId
        } else {
          insertData.match_id = eventId
        }

        const { error: insertError } = await supabase
          .from('availability')
          .insert(insertData)

        if (insertError) {
          errors.push(`${event.name}: ${insertError.message}`)
        }
      }
    }

    if (errors.length > 0) {
      toast({
        title: 'Error',
        description: `Failed to update some availability: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` and ${errors.length - 3} more` : ''}`,
        variant: 'destructive',
      })
      setSaving(false)
      // Still reload data to show what was saved
      await loadData()
      return
    }

    toast({
      title: 'Success',
      description: `Updated availability for ${selectedEvents.size} event(s)`,
    })

    // Clear selection and reload data
    setSelectedEvents(new Set())
    await loadData()
    setSaving(false)
  }

  function getStatusIcon(status?: AvailabilityStatus) {
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
        return <span className="h-4 w-4 text-gray-300">-</span>
    }
  }

  function getStatusLabel(status?: AvailabilityStatus) {
    switch (status) {
      case 'available':
        return 'Available'
      case 'unavailable':
        return 'Unavailable'
      case 'maybe':
        return 'Maybe'
      case 'late':
        return 'Running Late'
      case 'last_resort':
        return 'Last Resort'
      default:
        return 'Not Set'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Availability" />

      <main className="flex-1 p-4 space-y-4 pb-20">
        {/* Captain Team Availability Grids */}
        {captainTeams.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Availability Grids
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                As a captain, you can view and manage availability for your entire team.
              </p>
              <div className="space-y-2">
                {captainTeams.map(team => (
                  <Link key={team.id} href={`/teams/${team.id}/availability`}>
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-primary" />
                          <span className="text-sm font-medium">{team.name}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className={captainTeams.length > 0 ? "-mt-3" : ""}>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="team-filter">Team</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger id="team-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-type-filter">Event Type</Label>
                <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                  <SelectTrigger id="event-type-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="match">Matches</SelectItem>
                    {uniqueEventTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {getEventTypeLabel(type as any)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {filteredEvents.length > 0 && (
          <Card className="-mt-3">
            <CardHeader>
              <CardTitle>Bulk Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="bulk-status">Set Status For Selected Events</Label>
                  <Select value={bulkStatus} onValueChange={(value) => setBulkStatus(value as AvailabilityStatus)}>
                    <SelectTrigger id="bulk-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Available</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="maybe">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-yellow-500" />
                          <span>Maybe</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="last_resort">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-purple-500" />
                          <span>Last Resort</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="late">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <span>Running Late</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="unavailable">
                        <div className="flex items-center gap-2">
                          <X className="h-4 w-4 text-red-500" />
                          <span>Unavailable</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleBulkUpdate}
                  disabled={saving || selectedEvents.size === 0}
                  className="mt-6"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Selected ({selectedEvents.size})
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>
                  Upcoming Events ({filteredEvents.length})
                </CardTitle>
                {Object.keys(individualChanges).length > 0 && (
                  <Button
                    onClick={handleApplyIndividualChanges}
                    disabled={saving}
                    size="sm"
                    className="ml-auto"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Apply {Object.keys(individualChanges).length} Change(s)
                      </>
                    )}
                  </Button>
                )}
              </div>
              {filteredEvents.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedEvents.size === filteredEvents.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No events found. Try adjusting your filters.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredEvents.map(event => (
                  <div
                    key={event.id}
                    className={cn(
                      'flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors',
                      selectedEvents.has(event.id) && 'bg-accent border-primary'
                    )}
                  >
                    <Checkbox
                      checked={selectedEvents.has(event.id)}
                      onCheckedChange={() => handleToggleEvent(event.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{event.name}</span>
                        {event.type === 'event' && event.eventType && (
                          <Badge
                            variant="secondary"
                            className={cn('text-xs', getEventTypeBadgeClass(event.eventType as any))}
                          >
                            {getEventTypeLabel(event.eventType as any)}
                          </Badge>
                        )}
                        {event.type === 'match' && (
                          <Badge variant="default" className="text-xs">
                            Match
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {event.teamName}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDate(event.date, 'MMM d, yyyy')}</span>
                        <span>{formatTime(event.time)}</span>
                        {event.location && (
                          <span className="truncate">{event.location}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={individualChanges[event.id] || event.currentStatus || 'unavailable'}
                        onValueChange={(value) => handleIndividualStatusChange(event.id, value as AvailabilityStatus)}
                        disabled={saving}
                      >
                        <SelectTrigger className={cn(
                          "w-[140px] h-8",
                          individualChanges[event.id] && "ring-2 ring-blue-500 ring-offset-1"
                        )}>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(individualChanges[event.id] || event.currentStatus)}
                            <span className="text-sm">
                              {getStatusLabel(individualChanges[event.id] || event.currentStatus)}
                            </span>
                            {individualChanges[event.id] && (
                              <span className="text-blue-500 text-xs">*</span>
                            )}
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500" />
                              <span>Available</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="unavailable">
                            <div className="flex items-center gap-2">
                              <X className="h-4 w-4 text-red-500" />
                              <span>Unavailable</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="maybe">
                            <div className="flex items-center gap-2">
                              <HelpCircle className="h-4 w-4 text-yellow-500" />
                              <span>Maybe</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="late">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-orange-500" />
                              <span>Running Late</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="last_resort">
                            <div className="flex items-center gap-2">
                              <HelpCircle className="h-4 w-4 text-purple-500" />
                              <span>Last Resort</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

