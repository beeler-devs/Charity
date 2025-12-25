'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
// Types defined inline
type Match = any
type Event = any
type Team = any
type Availability = any
import { 
  CalendarItem, 
  getDateRangeForMonth, 
  getDateRangeForWeek,
  formatCalendarDate,
  getPreviousMonth,
  getNextMonth,
  getPreviousWeek,
  getNextWeek
} from '@/lib/calendar-utils'
import { Plus, Check, X, HelpCircle, ArrowLeft, CheckSquare, Square, Save, CheckCircle2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { WeekView } from '@/components/calendar/week-view'
import { MonthView } from '@/components/calendar/month-view'
import { CalendarItemTile } from '@/components/calendar/calendar-item-tile'
import { AddEventDialog } from '@/components/teams/add-event-dialog'
import { useToast } from '@/hooks/use-toast'
import { startOfWeek, addDays } from 'date-fns'
import { getTeamColor } from '@/lib/team-colors'
import { cn } from '@/lib/utils'

type ViewMode = 'week' | 'month' | 'list'

interface TeamInfo {
  id: string
  name: string
  isCaptain: boolean
  rosterMemberId?: string
}

export default function CalendarPage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  // Initialize with default values to avoid hydration mismatch
  // Load from localStorage in useEffect after mount
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [numWeeks, setNumWeeks] = useState(3)
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([])
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(['match', 'practice', 'warmup', 'other'])
  const [showPersonalActivities, setShowPersonalActivities] = useState(true)
  const [loading, setLoading] = useState(true)
  const [teamsLoaded, setTeamsLoaded] = useState(false)
  const [showAddEventDialog, setShowAddEventDialog] = useState(false)
  const [selectedTeamForEvent, setSelectedTeamForEvent] = useState<string | null>(null)
  const [bulkSelectMode, setBulkSelectMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<'available' | 'maybe' | 'unavailable'>('available')
  const { toast } = useToast()

  // Load saved preferences from localStorage after mount (client-side only)
  // This prevents hydration mismatch between server and client
  useEffect(() => {
    const savedViewMode = localStorage.getItem('calendar-view-mode')
    if (savedViewMode && ['week', 'month', 'list'].includes(savedViewMode)) {
      setViewMode(savedViewMode as ViewMode)
    }
    const savedNumWeeks = localStorage.getItem('calendar-num-weeks')
    if (savedNumWeeks) {
      const parsed = parseInt(savedNumWeeks, 10)
      if (!isNaN(parsed) && parsed > 0) {
        setNumWeeks(parsed)
      }
    }
  }, [])

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    // Only load calendar data if teams have been loaded (even if empty)
    // This prevents loading before teams are fetched
    if (teamsLoaded) {
      loadCalendarData()
    }
  }, [currentDate, viewMode, numWeeks, teams, selectedTeamIds, selectedEventTypes, teamsLoaded, showPersonalActivities])

  async function loadTeams() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    // Get all teams user is a member of
    const { data: rosterData } = await supabase
      .from('roster_members')
      .select('team_id, teams!inner(id, name)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    // Get teams where user is captain or co-captain
    const { data: captainTeams } = await supabase
      .from('teams')
      .select('id, name, captain_id, co_captain_id')
      .or(`captain_id.eq.${user.id},co_captain_id.eq.${user.id}`)

    // Build a map of team IDs to captain status
    const captainTeamIds = new Set(
      captainTeams?.map(t => t.id) || []
    )

    if (rosterData && rosterData.length > 0) {
      const teamsList = rosterData.map((r: any) => ({
        id: r.team_id,
        name: r.teams.name,
        isCaptain: captainTeamIds.has(r.team_id),
        rosterMemberId: r.id
      }))
      setTeams(teamsList)
      // By default, show all teams
      setSelectedTeamIds(teamsList.map(t => t.id))
    } else {
      // User has no teams, set empty array
      setTeams([])
    }
    
    // Mark teams as loaded and set loading to false
    setTeamsLoaded(true)
    setLoading(false)
  }

  async function loadCalendarData() {
    if (teams.length === 0) {
      setCalendarItems([])
      setLoading(false)
      return
    }
    
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setLoading(false)
      return
    }

    // Determine date range based on view mode
    // For list view, load all upcoming items (no end date limit)
    const dateRange = viewMode === 'list'
      ? { start: new Date().toISOString().split('T')[0], end: '9999-12-31' }
      : viewMode === 'month' 
        ? getDateRangeForMonth(currentDate)
        : getDateRangeForWeek(currentDate, numWeeks)

    // Filter teams if specific teams selected
    const teamIds = selectedTeamIds.length > 0 ? selectedTeamIds : teams.map(t => t.id)

    const items: CalendarItem[] = []

    // Load matches if enabled
    if (selectedEventTypes.includes('match')) {
      let query = supabase
        .from('matches')
        .select('*, teams!inner(id, name, color)')
        .in('team_id', teamIds)
        .gte('date', dateRange.start)
      
      if (viewMode !== 'list') {
        query = query.lte('date', dateRange.end)
      }
      
      const { data: matches } = await query
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      if (matches) {
        matches.forEach((match: any) => {
          const team = Array.isArray(match.teams) ? match.teams[0] : match.teams
          items.push({
            id: match.id,
            type: 'match',
            date: match.date,
            time: match.time,
            teamId: match.team_id,
            teamName: team?.name || 'Unknown',
            teamColor: team?.color || null,
            name: `vs ${match.opponent_name}`,
            is_home: match.is_home ?? false,
          })
        })
      }
    }

    // Load events if enabled (check if any event types are selected)
    const eventTypesToLoad = selectedEventTypes.filter(t => t !== 'match')
    if (eventTypesToLoad.length > 0) {
      let query = supabase
        .from('events')
        .select('*, teams!inner(id, name, color)')
        .in('team_id', teamIds)
        .gte('date', dateRange.start)
      
      if (viewMode !== 'list') {
        query = query.lte('date', dateRange.end)
      }
      
      const { data: events } = await query
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      if (events) {
        events.forEach((event: any) => {
          const eventType = event.event_type || 'other'
          // Map event_type to filter category
          let filterCategory = 'other'
          if (eventType === 'practice') {
            filterCategory = 'practice'
          } else if (eventType === 'warmup') {
            filterCategory = 'warmup'
          } else {
            filterCategory = 'other' // social, fun, other, etc.
          }
          
          // Only include if this event type is selected
          if (selectedEventTypes.includes(filterCategory)) {
            const team = Array.isArray(event.teams) ? event.teams[0] : event.teams
            items.push({
              id: event.id,
              type: 'event',
              date: event.date,
              time: event.time,
              duration: event.duration || null,
              teamId: event.team_id,
              teamName: team?.name || 'Unknown',
              teamColor: team?.color || null,
              name: event.event_name,
              eventType: (event.event_type || 'other') as any,
            })
          }
        })
      }
    }

    // Load personal activities if enabled
    if (showPersonalActivities) {
      // Load activities user created
      const { data: createdActivities } = await supabase
        .from('personal_events')
        .select('*')
        .eq('creator_id', user.id)
        .gte('date', dateRange.start)
      
      if (viewMode !== 'list') {
        // For week/month views, also filter by end date
        const { data: createdActivitiesFiltered } = await supabase
          .from('personal_events')
          .select('*')
          .eq('creator_id', user.id)
          .gte('date', dateRange.start)
          .lte('date', dateRange.end)
          .order('date', { ascending: true })
          .order('time', { ascending: true })

        if (createdActivitiesFiltered) {
          createdActivitiesFiltered.forEach((activity: any) => {
            items.push({
              id: activity.id,
              type: 'personal_activity',
              date: activity.date,
              time: activity.time,
              duration: activity.duration || null,
              teamId: activity.team_id || undefined,
              teamName: undefined,
              teamColor: null,
              name: activity.title,
              activityType: activity.activity_type,
              creatorId: activity.creator_id,
            })
          })
        }
      } else {
        // For list view, load all upcoming
        const { data: createdActivitiesList } = await supabase
          .from('personal_events')
          .select('*')
          .eq('creator_id', user.id)
          .gte('date', dateRange.start)
          .order('date', { ascending: true })
          .order('time', { ascending: true })

        if (createdActivitiesList) {
          createdActivitiesList.forEach((activity: any) => {
            items.push({
              id: activity.id,
              type: 'personal_activity',
              date: activity.date,
              time: activity.time,
              duration: activity.duration || null,
              teamId: activity.team_id || undefined,
              teamName: undefined,
              teamColor: null,
              name: activity.title,
              activityType: activity.activity_type,
              creatorId: activity.creator_id,
            })
          })
        }
      }

      // Load activities user is invited to
      const userEmail = (await supabase.from('profiles').select('email').eq('id', user.id).single()).data?.email
      
      const { data: invitations } = await supabase
        .from('event_invitations')
        .select('*, personal_events(*)')
        .or(`invitee_id.eq.${user.id},invitee_email.eq.${userEmail || ''}`)
        .in('status', ['pending', 'accepted'])
        .gte('personal_events.date', dateRange.start)

      if (invitations) {
        invitations.forEach((inv: any) => {
          if (inv.personal_events && (!viewMode || viewMode === 'list' || inv.personal_events.date <= dateRange.end)) {
            items.push({
              id: inv.personal_events.id,
              type: 'personal_activity',
              date: inv.personal_events.date,
              time: inv.personal_events.time,
              duration: inv.personal_events.duration || null,
              teamId: inv.personal_events.team_id || undefined,
              teamName: undefined,
              teamColor: null,
              name: inv.personal_events.title,
              activityType: inv.personal_events.activity_type,
              creatorId: inv.personal_events.creator_id,
            })
          }
        })
      }

      // Load user's attendee status for personal activities
      const personalActivityIds = items.filter(i => i.type === 'personal_activity').map(i => i.id)
      if (personalActivityIds.length > 0) {
        const { data: attendees } = await supabase
          .from('event_attendees')
          .select('personal_event_id, availability_status')
          .in('personal_event_id', personalActivityIds)
          .or(`user_id.eq.${user.id},email.eq.${userEmail || ''}`)

        if (attendees) {
          attendees.forEach((att: any) => {
            const item = items.find(i => i.id === att.personal_event_id && i.type === 'personal_activity')
            if (item) {
              item.availabilityStatus = att.availability_status as any
            }
          })
        }
      }
    }

    // Load user's availability for team items
    const { data: rosterMember } = await supabase
      .from('roster_members')
      .select('id')
      .eq('user_id', user.id)
      .in('team_id', teamIds)
      .limit(1)
      .maybeSingle()

    if (rosterMember) {
      const itemIds = items.filter(i => i.type !== 'personal_activity').map(i => i.id)
      
      if (itemIds.length > 0) {
        const { data: availability } = await supabase
          .from('availability')
          .select('*')
          .eq('roster_member_id', rosterMember.id)

        if (availability) {
          // Map availability to items
          availability.forEach((avail: Availability) => {
            const itemId = avail.match_id || avail.event_id
            if (itemId) {
              const item = items.find(i => i.id === itemId)
              if (item) {
                item.availabilityStatus = avail.status as any
              }
            }
          })
        }
      }
    }

    // Load availability summaries for matches and events (for list view)
    if (viewMode === 'list' && items.length > 0) {
      const itemIds = items.map(i => i.id)
      
      // Get all roster members for the teams
      const { data: allRosterMembers } = await supabase
        .from('roster_members')
        .select('id, team_id')
        .in('team_id', teamIds)
        .eq('is_active', true)

      if (allRosterMembers) {
        const rosterMemberIds = allRosterMembers.map(rm => rm.id)
        
        // Load all availability for these items
        const matchItemIds = items.filter(i => i.type === 'match').map(i => i.id)
        const eventItemIds = items.filter(i => i.type === 'event').map(i => i.id)
        
        let availabilityQuery = supabase
          .from('availability')
          .select('*')
          .in('roster_member_id', rosterMemberIds)
        
        if (matchItemIds.length > 0 && eventItemIds.length > 0) {
          availabilityQuery = availabilityQuery.or(`match_id.in.(${matchItemIds.join(',')}),event_id.in.(${eventItemIds.join(',')})`)
        } else if (matchItemIds.length > 0) {
          availabilityQuery = availabilityQuery.in('match_id', matchItemIds)
        } else if (eventItemIds.length > 0) {
          availabilityQuery = availabilityQuery.in('event_id', eventItemIds)
        } else {
          // No items to load availability for
          const filteredItems = showPersonalActivities 
            ? items 
            : items.filter(i => i.type !== 'personal_activity')
          setCalendarItems(filteredItems)
          setLoading(false)
          return
        }
        
        const { data: allAvailability } = await availabilityQuery

        // Group availability by item and team
        const availabilityByItemAndTeam: Record<string, Record<string, Availability[]>> = {}
        
        allAvailability?.forEach(avail => {
          const itemId = avail.match_id || avail.event_id
          if (!itemId) return
          
          const item = items.find(i => i.id === itemId)
          if (!item) return
          
          const rosterMember = allRosterMembers.find(rm => rm.id === avail.roster_member_id)
          if (!rosterMember || rosterMember.team_id !== item.teamId) return
          
          if (!availabilityByItemAndTeam[itemId]) {
            availabilityByItemAndTeam[itemId] = {}
          }
          if (!availabilityByItemAndTeam[itemId][item.teamId]) {
            availabilityByItemAndTeam[itemId][item.teamId] = []
          }
          availabilityByItemAndTeam[itemId][item.teamId].push(avail)
        })

        // Calculate summaries for each item
        items.forEach(item => {
          const teamRosterMembers = allRosterMembers.filter(rm => rm.team_id === item.teamId)
          const teamAvailability = availabilityByItemAndTeam[item.id]?.[item.teamId] || []
          
          let available = 0
          let maybe = 0
          let unavailable = 0
          
          teamAvailability.forEach(avail => {
            if (avail.status === 'available') {
              available++
            } else if (avail.status === 'maybe' || avail.status === 'last_resort') {
              maybe++
            } else {
              unavailable++
            }
          })
          
          // Count non-responded as unavailable
          const respondedIds = new Set(teamAvailability.map(a => a.roster_member_id))
          unavailable += teamRosterMembers.length - respondedIds.size
          
          item.availabilitySummary = {
            available,
            maybe,
            unavailable,
            total: teamRosterMembers.length
          }
        })
      }
    }

    // Filter items based on personal activities toggle
    const filteredItems = showPersonalActivities 
      ? items 
      : items.filter(i => i.type !== 'personal_activity')

    setCalendarItems(filteredItems)
    setLoading(false)
  }

  function handlePrevious() {
    if (viewMode === 'month') {
      setCurrentDate(getPreviousMonth(currentDate))
    } else {
      setCurrentDate(getPreviousWeek(currentDate, numWeeks))
    }
  }

  function handleNext() {
    if (viewMode === 'month') {
      setCurrentDate(getNextMonth(currentDate))
    } else {
      setCurrentDate(getNextWeek(currentDate, numWeeks))
    }
  }

  function handleToday() {
    setCurrentDate(new Date())
  }

  async function updateAvailability(item: CalendarItem, rosterMemberId: string, status: 'available' | 'maybe' | 'unavailable') {
    const supabase = createClient()
    
    // Handle personal activities differently
    if (item.type === 'personal_activity') {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single()
      const userEmail = profileData?.email

      // Check if attendee record exists
      const { data: existingAttendee } = await supabase
        .from('event_attendees')
        .select('id')
        .eq('personal_event_id', item.id)
        .or(`user_id.eq.${user.id},email.eq.${userEmail || ''}`)
        .maybeSingle()

      let error = null
      if (existingAttendee) {
        const result = await supabase
          .from('event_attendees')
          .update({ availability_status: status })
          .eq('id', existingAttendee.id)
        error = result.error
      } else {
        const insertData: any = {
          personal_event_id: item.id,
          availability_status: status,
        }
        if (user.id) {
          insertData.user_id = user.id
        }
        if (userEmail) {
          insertData.email = userEmail
        }
        const result = await supabase
          .from('event_attendees')
          .insert(insertData)
        error = result.error
      }

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Updated',
          description: `Availability set to ${status}`,
        })
        loadCalendarData()
      }
      return
    }
    
    // Handle team events/matches
    // Find existing availability
    const { data: existing } = await supabase
      .from('availability')
      .select('id')
      .eq('roster_member_id', rosterMemberId)
      .eq(item.type === 'match' ? 'match_id' : 'event_id', item.id)
      .maybeSingle()

    let error = null
    if (existing) {
      const result = await supabase
        .from('availability')
        .update({ status })
        .eq('id', existing.id)
      error = result.error
    } else {
      const insertData: any = {
        roster_member_id: rosterMemberId,
        status
      }
      if (item.type === 'match') {
        insertData.match_id = item.id
      } else {
        insertData.event_id = item.id
      }
      const result = await supabase
        .from('availability')
        .insert(insertData)
      error = result.error
    }

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Updated',
        description: `Availability set to ${status}`,
      })
      // Reload calendar data to reflect the change
      loadCalendarData()
    }
  }

  function handleToggleItemSelection(itemId: string) {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  function handleSelectAll() {
    if (selectedItems.size === calendarItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(calendarItems.map(item => item.id)))
    }
  }

  async function handleBulkUpdate() {
    if (selectedItems.size === 0) {
      toast({
        title: 'No items selected',
        description: 'Please select at least one item to update',
        variant: 'destructive',
      })
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()
    const userEmail = profileData?.email

    const errors: string[] = []
    let successCount = 0

    for (const itemId of selectedItems) {
      const item = calendarItems.find(i => i.id === itemId)
      if (!item) continue

      // Handle personal activities
      if (item.type === 'personal_activity') {
        const { data: existingAttendee } = await supabase
          .from('event_attendees')
          .select('id')
          .eq('personal_event_id', itemId)
          .or(`user_id.eq.${user.id},email.eq.${userEmail || ''}`)
          .maybeSingle()

        if (existingAttendee) {
          const { error } = await supabase
            .from('event_attendees')
            .update({ availability_status: bulkStatus })
            .eq('id', existingAttendee.id)
          if (error) {
            errors.push(`${item.name}: ${error.message}`)
          } else {
            successCount++
          }
        } else {
          const insertData: any = {
            personal_event_id: itemId,
            availability_status: bulkStatus,
          }
          if (user.id) {
            insertData.user_id = user.id
          }
          if (userEmail) {
            insertData.email = userEmail
          }
          const { error } = await supabase
            .from('event_attendees')
            .insert(insertData)
          if (error) {
            errors.push(`${item.name}: ${error.message}`)
          } else {
            successCount++
          }
        }
        continue
      }

      // Handle team events/matches
      const rosterMemberId = teams.find(t => t.id === item.teamId)?.rosterMemberId
      if (!rosterMemberId) {
        errors.push(`${item.name}: No roster membership found`)
        continue
      }

      const { data: existing } = await supabase
        .from('availability')
        .select('id')
        .eq('roster_member_id', rosterMemberId)
        .eq(item.type === 'match' ? 'match_id' : 'event_id', itemId)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('availability')
          .update({ status: bulkStatus })
          .eq('id', existing.id)
        if (error) {
          errors.push(`${item.name}: ${error.message}`)
        } else {
          successCount++
        }
      } else {
        const insertData: any = {
          roster_member_id: rosterMemberId,
          status: bulkStatus,
        }
        if (item.type === 'match') {
          insertData.match_id = itemId
        } else {
          insertData.event_id = itemId
        }
        const { error } = await supabase
          .from('availability')
          .insert(insertData)
        if (error) {
          errors.push(`${item.name}: ${error.message}`)
        } else {
          successCount++
        }
      }
    }

    if (errors.length > 0) {
      toast({
        title: 'Partial Success',
        description: `Updated ${successCount} item(s). ${errors.length} error(s): ${errors.slice(0, 2).join('; ')}`,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Success',
        description: `Updated availability for ${successCount} item(s)`,
      })
    }

    setSelectedItems(new Set())
    setBulkSelectMode(false)
    loadCalendarData()
  }

  const captainTeams = teams.filter(t => t.isCaptain)
  const canAddEvents = captainTeams.length > 0

  function handleAddEvent() {
    if (captainTeams.length === 0) {
      toast({
        title: 'No teams available',
        description: 'You must be a captain or co-captain to add events',
        variant: 'destructive',
      })
      return
    }

    if (captainTeams.length === 1) {
      // Only one team, use it directly
      setSelectedTeamForEvent(captainTeams[0].id)
      setShowAddEventDialog(true)
    } else {
      // Multiple teams, need to select one
      // For now, use the first selected team or first captain team
      const teamToUse = selectedTeamIds.length > 0 && captainTeams.find(t => selectedTeamIds.includes(t.id))
        ? captainTeams.find(t => selectedTeamIds.includes(t.id))!.id
        : captainTeams[0].id
      setSelectedTeamForEvent(teamToUse)
      setShowAddEventDialog(true)
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-16">
      <Header title="Calendar" />

      <main className="flex-1 p-4 space-y-2">
        {/* Back Button */}
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" onClick={() => router.back()} size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Date Navigation */}
        <Card>
          <CardContent className="p-2">

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
              >
                Today
              </Button>

              {canAddEvents && (
                <>
                  <Button
                    size="sm"
                    onClick={handleAddEvent}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Event
                  </Button>
                  <span className="text-xs text-muted-foreground">Practice, scrimmage, social</span>
                </>
              )}
              <Button
                variant={bulkSelectMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setBulkSelectMode(!bulkSelectMode)
                  if (bulkSelectMode) {
                    setSelectedItems(new Set())
                  }
                }}
              >
                {bulkSelectMode ? (
                  <>
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Done
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-1" />
                    Bulk Select
                  </>
                )}
              </Button>

              <Tabs value={viewMode} onValueChange={(v) => {
                const newMode = v as ViewMode
                setViewMode(newMode)
                if (typeof window !== 'undefined') {
                  localStorage.setItem('calendar-view-mode', newMode)
                }
              }} className="flex-1">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="list">List</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            {/* Weeks filter - only shown in week view, right under Week tab */}
            {viewMode === 'week' && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground">Weeks:</span>
                <Select value={numWeeks.toString()} onValueChange={(value) => {
                  const weeks = parseInt(value)
                  setNumWeeks(weeks)
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('calendar-num-weeks', weeks.toString())
                  }
                }}>
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 week</SelectItem>
                    <SelectItem value="2">2 weeks</SelectItem>
                    <SelectItem value="3">3 weeks</SelectItem>
                    <SelectItem value="4">4 weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Filter Chips - Quick Access */}
        {teams.length > 1 && (
          <Card>
            <CardContent className="p-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground mr-1">Teams:</span>
                {teams.map((team) => {
                  const isSelected = selectedTeamIds.includes(team.id)
                  const teamColor = getTeamColor(team.id, team.color)
                  return (
                    <Button
                      key={team.id}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-7 text-xs",
                        isSelected && "text-white",
                        !isSelected && teamColor.textClass
                      )}
                      style={isSelected ? {
                        backgroundColor: teamColor.hex,
                        borderColor: teamColor.hex,
                      } : {
                        borderColor: teamColor.hex,
                      }}
                      onClick={() => {
                        if (isSelected) {
                          // If clicking a selected team, deselect it (but keep at least one selected)
                          if (selectedTeamIds.length > 1) {
                            setSelectedTeamIds(selectedTeamIds.filter(id => id !== team.id))
                          } else {
                            // Can't deselect the last team - show a message or prevent action
                            toast({
                              title: 'Cannot deselect',
                              description: 'At least one team must be selected',
                              variant: 'default',
                            })
                          }
                        } else {
                          // Add to selection
                          setSelectedTeamIds([...selectedTeamIds, team.id])
                        }
                      }}
                    >
                      {team.name}
                      {isSelected && selectedTeamIds.length > 1 && (
                        <span className="ml-1">×</span>
                      )}
                    </Button>
                  )
                })}
                {selectedTeamIds.length !== teams.length && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      if (selectedTeamIds.length === teams.length) {
                        setSelectedTeamIds([])
                      } else {
                        setSelectedTeamIds(teams.map(t => t.id))
                      }
                    }}
                  >
                    {selectedTeamIds.length === teams.length ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Event Type Filter */}
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
                  eventColor = 'rgb(34, 197, 94)' // green-500 (matches are typically green)
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
                        setSelectedEventTypes(selectedEventTypes.filter(t => t !== eventType))
                      } else {
                        setSelectedEventTypes([...selectedEventTypes, eventType])
                      }
                    }}
                  >
                    {eventType === 'match' ? 'Matches' : eventType === 'practice' ? 'Practice' : eventType === 'warmup' ? 'Warmup' : 'Other'}
                    {isSelected && (
                      <span className="ml-1">×</span>
                    )}
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Personal Activities Filter */}
        <Card>
          <CardContent className="p-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground mr-1">Personal Activities:</span>
              <Button
                variant={showPersonalActivities ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowPersonalActivities(!showPersonalActivities)}
              >
                {showPersonalActivities ? 'Show' : 'Hide'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Update Panel - shown when items are selected in bulk mode */}
        {bulkSelectMode && selectedItems.size > 0 && (
          <Card className="sticky top-0 z-10 bg-background border-primary">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={bulkStatus} onValueChange={(value) => setBulkStatus(value as 'available' | 'maybe' | 'unavailable')}>
                    <SelectTrigger className="w-[140px] h-8">
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
                      <SelectItem value="unavailable">
                        <div className="flex items-center gap-2">
                          <X className="h-4 w-4 text-red-500" />
                          <span>Unavailable</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleBulkUpdate}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Update All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedItems(new Set())
                      setBulkSelectMode(false)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Calendar View */}
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="text-sm text-muted-foreground mt-4">Loading calendar...</p>
            </CardContent>
          </Card>
        ) : viewMode === 'week' ? (
          <WeekView 
            currentDate={currentDate} 
            items={calendarItems} 
            numWeeks={numWeeks}
            onPrevious={handlePrevious}
            onNext={handleNext}
          />
        ) : viewMode === 'month' ? (
          <MonthView 
            currentDate={currentDate} 
            items={calendarItems}
            onPrevious={handlePrevious}
            onNext={handleNext}
          />
        ) : (
          <div className="space-y-2">
            {calendarItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No events scheduled</p>
                </CardContent>
              </Card>
            ) : (
              calendarItems.map((item) => {
                const rosterMemberId = teams.find(t => t.id === item.teamId)?.rosterMemberId
                return (
                  <Card key={item.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0" onClick={() => {
                        if (item.type === 'match') {
                          router.push(`/teams/${item.teamId}/matches/${item.id}`)
                        } else {
                          router.push(`/teams/${item.teamId}/events/${item.id}`)
                        }
                      }} style={{ cursor: 'pointer' }}>
                        <CalendarItemTile item={item} compact={false} />
                      </div>
                      {rosterMemberId && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant={item.availabilityStatus === 'available' ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={async () => {
                              await updateAvailability(item, rosterMemberId, 'available')
                            }}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant={item.availabilityStatus === 'maybe' ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={async () => {
                              await updateAvailability(item, rosterMemberId, 'maybe')
                            }}
                          >
                            <HelpCircle className="h-4 w-4 text-yellow-600" />
                          </Button>
                          <Button
                            variant={item.availabilityStatus === 'unavailable' ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={async () => {
                              await updateAvailability(item, rosterMemberId, 'unavailable')
                            }}
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        )}
      </main>

      {showAddEventDialog && (
        <AddEventDialog
          open={showAddEventDialog}
          onOpenChange={(open) => {
            setShowAddEventDialog(open)
            if (!open) {
              setSelectedTeamForEvent(null)
            }
          }}
          teamId={selectedTeamForEvent || undefined}
          availableTeams={captainTeams.map(t => ({ id: t.id, name: t.name }))}
          onAdded={() => {
            setShowAddEventDialog(false)
            setSelectedTeamForEvent(null)
            loadCalendarData()
          }}
        />
      )}
    </div>
  )
}

