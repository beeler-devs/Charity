'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Match, Event, Team, Availability } from '@/types/database.types'
import { 
  CalendarItem, 
  getDateRangeForMonth, 
  getDateRangeForWeek,
  getPreviousMonth,
  getNextMonth,
  getPreviousWeek,
  getNextWeek,
  formatCalendarDate
} from '@/lib/calendar-utils'
import { ChevronLeft, ChevronRight, Filter, Calendar as CalendarIcon, Plus } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WeekView } from '@/components/calendar/week-view'
import { MonthView } from '@/components/calendar/month-view'
import { CalendarFilters } from '@/components/calendar/calendar-filters'
import { CalendarItemTile } from '@/components/calendar/calendar-item-tile'
import { AddEventDialog } from '@/components/teams/add-event-dialog'
import { useToast } from '@/hooks/use-toast'
import { startOfWeek, addDays } from 'date-fns'

type ViewMode = 'week' | 'month' | 'list'

interface TeamInfo {
  id: string
  name: string
  isCaptain: boolean
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [numWeeks, setNumWeeks] = useState(2)
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([])
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [showMatches, setShowMatches] = useState(true)
  const [showEvents, setShowEvents] = useState(true)
  const [loading, setLoading] = useState(true)
  const [teamsLoaded, setTeamsLoaded] = useState(false)
  const [showAddEventDialog, setShowAddEventDialog] = useState(false)
  const [selectedTeamForEvent, setSelectedTeamForEvent] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    // Only load calendar data if teams have been loaded (even if empty)
    // This prevents loading before teams are fetched
    if (teamsLoaded) {
      loadCalendarData()
    }
  }, [currentDate, viewMode, numWeeks, teams, selectedTeamIds, showMatches, showEvents, teamsLoaded])

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
        isCaptain: captainTeamIds.has(r.team_id)
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
    if (showMatches) {
      let query = supabase
        .from('matches')
        .select('*, teams!inner(id, name)')
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
          items.push({
            id: match.id,
            type: 'match',
            date: match.date,
            time: match.time,
            teamId: match.team_id,
            teamName: match.teams.name,
            name: `vs ${match.opponent_name}`,
          })
        })
      }
    }

    // Load events if enabled
    if (showEvents) {
      let query = supabase
        .from('events')
        .select('*, teams!inner(id, name)')
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
          items.push({
            id: event.id,
            type: 'event',
            date: event.date,
            time: event.time,
            teamId: event.team_id,
            teamName: event.teams.name,
            name: event.event_name,
            eventType: event.event_type || undefined,
          })
        })
      }
    }

    // Load user's availability for these items
    const { data: rosterMember } = await supabase
      .from('roster_members')
      .select('id')
      .eq('user_id', user.id)
      .in('team_id', teamIds)
      .limit(1)
      .maybeSingle()

    if (rosterMember) {
      const itemIds = items.map(i => i.id)
      
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

    setCalendarItems(items)
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

      <main className="flex-1 p-4 space-y-4">
        {/* Date Navigation */}
        <Card>
          <CardContent className="p-3">

            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
              >
                Today
              </Button>

              {canAddEvents && (
                <Button
                  size="sm"
                  onClick={handleAddEvent}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Event
                </Button>
              )}

              <CalendarFilters
                teams={teams}
                selectedTeamIds={selectedTeamIds}
                onTeamSelectionChange={setSelectedTeamIds}
                showMatches={showMatches}
                onShowMatchesChange={setShowMatches}
                showEvents={showEvents}
                onShowEventsChange={setShowEvents}
              />

              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="flex-1">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="list">List</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Weeks filter - only shown in week view */}
            {viewMode === 'week' && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground">View:</span>
                <Select value={numWeeks.toString()} onValueChange={(value) => setNumWeeks(parseInt(value))}>
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
            {/* Navigation buttons - hidden in list view */}
            {viewMode !== 'list' && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Filter Chips - Quick Access */}
        {teams.length > 1 && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground mr-1">Teams:</span>
                {teams.map((team) => {
                  const isSelected = selectedTeamIds.includes(team.id)
                  return (
                    <Button
                      key={team.id}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
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

        {/* Filters Summary */}
        {(selectedTeamIds.length !== teams.length || !showMatches || !showEvents) && (
          <div className="flex items-center gap-2 flex-wrap">
            {selectedTeamIds.length !== teams.length && (
              <Badge variant="secondary">
                {selectedTeamIds.length} of {teams.length} teams
              </Badge>
            )}
            {!showMatches && <Badge variant="secondary">Matches hidden</Badge>}
            {!showEvents && <Badge variant="secondary">Events hidden</Badge>}
          </div>
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
              calendarItems.map((item) => (
                <CalendarItemTile key={item.id} item={item} compact={false} />
              ))
            )}
          </div>
        )}
      </main>

      {selectedTeamForEvent && (
        <AddEventDialog
          open={showAddEventDialog}
          onOpenChange={(open) => {
            setShowAddEventDialog(open)
            if (!open) {
              setSelectedTeamForEvent(null)
            }
          }}
          teamId={selectedTeamForEvent}
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

