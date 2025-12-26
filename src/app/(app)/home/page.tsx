'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime, cn } from '@/lib/utils'
import { calculateMatchAvailability } from '@/lib/availability-utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Calendar,
  MapPin,
  Users,
  CheckCircle,
  Clock,
  MinusCircle,
  Trophy,
  ChevronRight,
  Check,
  X,
  HelpCircle,
  Bell,
  Megaphone
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getEventTypes, getEventTypeLabel, getEventTypeBadgeClass } from '@/lib/event-type-colors'
import { EventTypeBadge } from '@/components/events/event-type-badge'
import { ActivityTypeBadge } from '@/components/activities/activity-type-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface UpcomingMatch {
  id: string
  date: string
  time: string
  opponent_name: string
  venue: string | null
  is_home: boolean
  team_id: string
  team_name: string
  status: 'in_lineup' | 'off' | 'pending'
  partner_name?: string
  court_slot?: number
  availability?: {
    status: string
  }
}

interface UpcomingEvent {
  id: string
  date: string
  time: string
  event_name: string
  event_type?: string | null
  location: string | null
  team_id: string
  team_name: string
  availability?: {
    status: string
  }
}

type CalendarItem = (UpcomingMatch & { type: 'match' }) | (UpcomingEvent & { type: 'event' })

interface Team {
  id: string
  name: string
  league_format: string | null
  season: string | null
}

export default function HomePage() {
  const [nextMatch, setNextMatch] = useState<UpcomingMatch | null>(null)
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [upcomingPersonalActivities, setUpcomingPersonalActivities] = useState<UpcomingPersonalActivity[]>([])
  const [allItems, setAllItems] = useState<CalendarItem[]>([])
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(['match', 'practice', 'warmup', 'social', 'other'])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [rosterMemberMap, setRosterMemberMap] = useState<Record<string, string>>({}) // matchId -> rosterMemberId
  const [teamRoster, setTeamRoster] = useState<any[]>([])
  const [teamCaptainIds, setTeamCaptainIds] = useState<{ captain_id: string | null; co_captain_id: string | null } | null>(null)
  const [teamStats, setTeamStats] = useState<{
    wins: number
    losses: number
    ties: number
    winPercentage: number
  } | null>(null)
  const [recentMatches, setRecentMatches] = useState<any[]>([])
  const [lifetimeStats, setLifetimeStats] = useState<{
    totalMatches: number
    wins: number
    losses: number
    winPercentage: number
  } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadDashboardData()
    // Check and link roster members on first load (in case they were added before account creation)
    linkRosterMembersIfNeeded()
  }, [])

  useEffect(() => {
    if (selectedTeamId) {
      loadTeamData(selectedTeamId)
    }
  }, [selectedTeamId])

  async function linkRosterMembersIfNeeded() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      // Check if user has any roster memberships
      const { data: existingRosters } = await supabase
        .from('roster_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)

      // If user already has roster memberships, no need to check
      if (existingRosters && existingRosters.length > 0) {
        return
      }

      // User has no roster memberships, try to link via API
      // This will link both roster members AND event invitations
      const response = await fetch('/api/auth/link-roster-members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (data.success && (data.linked > 0 || data.linkedInvitations > 0)) {
        // Refresh the page to show the new teams and events
        window.location.reload()
      }
    } catch (error) {
      // Silently fail - this is a background check
      console.warn('Error checking for unlinked roster members:', error)
    }
  }

  async function loadDashboardData() {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // Get user's roster memberships
    const { data: memberships } = await supabase
      .from('roster_members')
      .select(`
        id,
        team_id,
        teams (
          id,
          name,
          league_format,
          season
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)

    // Get teams where user is captain or co-captain
    const { data: captainTeams } = await supabase
      .from('teams')
      .select('id, name, league_format, season')
      .or(`captain_id.eq.${user.id},co_captain_id.eq.${user.id}`)

    // Combine and deduplicate teams
    const membershipTeams: Team[] = []
    memberships?.forEach(m => {
      const teamData = Array.isArray(m.teams) ? m.teams[0] : m.teams
      if (teamData) {
        membershipTeams.push({
          id: teamData.id,
          name: teamData.name,
          league_format: teamData.league_format,
          season: teamData.season,
          captain_id: '',
        } as Team)
      }
    })
    const allTeams = [
      ...membershipTeams,
      ...(captainTeams || [])
    ]
    const uniqueTeams = allTeams.filter((team, index, self) =>
      index === self.findIndex(t => t.id === team.id)
    )
    setTeams(uniqueTeams)
    
    // Set first team as selected by default
    if (uniqueTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(uniqueTeams[0].id)
    }

    if (!memberships || memberships.length === 0) {
      setLoading(false)
      return
    }

    const teamIds = memberships.map(m => m.team_id)
    const rosterMemberIds = memberships.map(m => m.id)
    
    // Build roster member map by team
    const rosterMap: Record<string, string> = {}
    memberships.forEach(m => {
      rosterMap[m.team_id] = m.id
    })

    // Get today's date for filtering upcoming items
    const today = new Date().toISOString().split('T')[0]

    // Get upcoming matches for user's teams
    const { data: matches } = await supabase
      .from('matches')
      .select(`
        id,
        date,
        time,
        opponent_name,
        venue,
        is_home,
        team_id,
        teams (
          name
        )
      `)
      .in('team_id', teamIds)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(10)

    if (!matches) {
      setLoading(false)
      return
    }

    // Get lineups and availability for these matches
    const matchIds = matches.map(m => m.id)

    const { data: lineups } = await supabase
      .from('lineups')
      .select(`
        match_id,
        court_slot,
        player1_id,
        player2_id,
        is_published,
        player1:roster_members!lineups_player1_id_fkey (
          id,
          full_name
        ),
        player2:roster_members!lineups_player2_id_fkey (
          id,
          full_name
        )
      `)
      .in('match_id', matchIds)
      .eq('is_published', true)

    const { data: availabilities } = await supabase
      .from('availability')
      .select('*')
      .in('match_id', matchIds)
      .in('roster_member_id', rosterMemberIds)

    // Load user's default availability for auto-calculation
    const { data: profile } = await supabase
      .from('profiles')
      .select('availability_defaults')
      .eq('id', user.id)
      .single()

    // Build match to roster member mapping
    const matchRosterMap: Record<string, string> = {}
    matches.forEach(match => {
      const rosterId = rosterMap[match.team_id]
      if (rosterId) {
        matchRosterMap[match.id] = rosterId
      }
    })
    setRosterMemberMap(matchRosterMap)
    
    // Process matches with status
    const processedMatches: UpcomingMatch[] = matches.map(match => {
      const membership = memberships.find(m => m.team_id === match.team_id)
      const memberRosterId = membership?.id

      // Check if user is in lineup
      const userLineup = lineups?.find(l =>
        l.match_id === match.id &&
        (l.player1_id === memberRosterId || l.player2_id === memberRosterId)
      )

      // Check availability response
      let availability = availabilities?.find(a =>
        a.match_id === match.id && a.roster_member_id === memberRosterId
      )
      
      // If no availability set, auto-calculate from defaults
      if (!availability) {
        const autoStatus = calculateMatchAvailability(
          match.date,
          match.time,
          profile?.availability_defaults as Record<string, string[]> | null | undefined
        )
        availability = { status: autoStatus } as any
      }

      let status: 'in_lineup' | 'off' | 'pending' = 'pending'
      let partnerName: string | undefined
      let courtSlot: number | undefined

      if (userLineup) {
        status = 'in_lineup'
        courtSlot = userLineup.court_slot
        if (userLineup.player1_id === memberRosterId && userLineup.player2) {
          const player2 = Array.isArray(userLineup.player2) ? userLineup.player2[0] : userLineup.player2
          partnerName = (player2 as any)?.full_name
        } else if (userLineup.player1) {
          const player1 = Array.isArray(userLineup.player1) ? userLineup.player1[0] : userLineup.player1
          partnerName = (player1 as any)?.full_name
        }
      } else if (lineups?.some(l => l.match_id === match.id)) {
        // Lineup posted but user not in it
        status = 'off'
      } else if (!availability) {
        status = 'pending'
      }

      return {
        id: match.id,
        date: match.date,
        time: match.time,
        opponent_name: match.opponent_name,
        venue: match.venue,
        is_home: match.is_home,
        team_id: match.team_id,
        team_name: (Array.isArray(match.teams) ? match.teams[0] : match.teams)?.name || 'Unknown',
        status,
        partner_name: partnerName,
        court_slot: courtSlot,
        availability: availability ? {
          status: availability.status
        } : undefined
      }
    })

    // Find next match where user is in lineup
    const nextInLineup = processedMatches.find(m => m.status === 'in_lineup')
    setNextMatch(nextInLineup || processedMatches[0] || null)
    setUpcomingMatches(processedMatches)
    
    // Load upcoming events
    const { data: events } = await supabase
      .from('events')
      .select(`
        id,
        date,
        time,
        event_name,
        event_type,
        location,
        team_id,
        teams (
          name
        )
      `)
      .in('team_id', teamIds)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(10)

    // Get availability for events
    const eventIds = events?.map(e => e.id) || []
    const { data: eventAvailabilities } = await supabase
      .from('availability')
      .select('*')
      .in('event_id', eventIds)
      .in('roster_member_id', rosterMemberIds)

    // Process events
    const processedEvents: UpcomingEvent[] = (events || []).map(event => {
      const membership = memberships.find(m => m.team_id === event.team_id)
      const memberRosterId = membership?.id
      
      const availability = eventAvailabilities?.find(a =>
        a.event_id === event.id && a.roster_member_id === memberRosterId
      )

      return {
        id: event.id,
        date: event.date,
        time: event.time,
        event_name: event.event_name,
        event_type: event.event_type,
        location: event.location,
        team_id: event.team_id,
        team_name: (Array.isArray(event.teams) ? event.teams[0] : event.teams)?.name || 'Unknown',
        availability: availability ? { status: availability.status } : undefined
      }
    })

    setUpcomingEvents(processedEvents)

    // Load personal activities user is invited to or created
    const userEmail = (await supabase.from('profiles').select('email').eq('id', user.id).single()).data?.email

    // Load activities user created
    const { data: createdActivities } = await supabase
      .from('personal_events')
      .select('*')
      .eq('creator_id', user.id)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    // Load activities user is invited to
    const { data: invitations } = await supabase
      .from('event_invitations')
      .select('*, personal_events(*)')
      .or(`invitee_id.eq.${user.id},invitee_email.eq.${userEmail || ''}`)
      .in('status', ['pending', 'accepted'])

    // Load attendee status for personal activities
    const personalActivityIds: string[] = []
    if (createdActivities) {
      createdActivities.forEach(a => personalActivityIds.push(a.id))
    }
    if (invitations) {
      invitations.forEach((inv: any) => {
        if (inv.personal_events && !personalActivityIds.includes(inv.personal_events.id)) {
          personalActivityIds.push(inv.personal_events.id)
        }
      })
    }

    let attendeeStatuses: Record<string, string> = {}
    if (personalActivityIds.length > 0) {
      const { data: attendees } = await supabase
        .from('event_attendees')
        .select('personal_event_id, availability_status')
        .in('personal_event_id', personalActivityIds)
        .or(`user_id.eq.${user.id},email.eq.${userEmail || ''}`)

      if (attendees) {
        attendees.forEach((att: any) => {
          attendeeStatuses[att.personal_event_id] = att.availability_status
        })
      }
    }

    const processedPersonalActivities: UpcomingPersonalActivity[] = []
    
    // Add created activities
    if (createdActivities) {
      createdActivities.forEach(activity => {
        processedPersonalActivities.push({
          id: activity.id,
          date: activity.date,
          time: activity.time,
          title: activity.title,
          activity_type: activity.activity_type,
          location: activity.location,
          team_id: activity.team_id,
        })
      })
    }

    // Add invited activities
    if (invitations) {
      invitations.forEach((inv: any) => {
        if (inv.personal_events && inv.personal_events.date >= today) {
          const existing = processedPersonalActivities.find(a => a.id === inv.personal_events.id)
          if (!existing) {
            processedPersonalActivities.push({
              id: inv.personal_events.id,
              date: inv.personal_events.date,
              time: inv.personal_events.time,
              title: inv.personal_events.title,
              activity_type: inv.personal_events.activity_type,
              location: inv.personal_events.location,
              team_id: inv.personal_events.team_id,
              availability_status: attendeeStatuses[inv.personal_events.id],
            })
          }
        }
      })
    }

    setUpcomingPersonalActivities(processedPersonalActivities)

    // Combine matches, events, and personal activities, sort by date/time
    const combined: CalendarItem[] = [
      ...processedMatches.map(m => ({ ...m, type: 'match' as const })),
      ...processedEvents.map(e => ({ ...e, type: 'event' as const })),
      ...processedPersonalActivities.map(a => ({
        id: a.id,
        type: 'personal_activity' as const,
        date: a.date,
        time: a.time,
        teamId: a.team_id || undefined,
        teamName: undefined,
        teamColor: null,
        name: a.title,
        activityType: a.activity_type as any,
        availabilityStatus: a.availability_status as any,
      }))
    ].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.time.localeCompare(b.time)
    })
    setAllItems(combined)

    // Load team-specific data if a team is selected
    if (selectedTeamId || uniqueTeams.length > 0) {
      const teamToLoad = selectedTeamId || uniqueTeams[0].id
      await loadTeamData(teamToLoad)
    }
    
    // Load lifetime statistics
    await loadLifetimeStats()
    
    // Load recent matches
    await loadRecentMatches(teamIds)
    
    setLoading(false)
  }

  async function loadTeamData(teamId: string) {
    const supabase = createClient()
    
    // Load team to get captain info
    const { data: teamData } = await supabase
      .from('teams')
      .select('captain_id, co_captain_id')
      .eq('id', teamId)
      .single()

    if (teamData) {
      setTeamCaptainIds({
        captain_id: teamData.captain_id,
        co_captain_id: teamData.co_captain_id
      })
    }
    
    // Load roster
    const { data: roster } = await supabase
      .from('roster_members')
      .select('id, full_name, email, phone, ntrp_rating, user_id')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('full_name')
    
    setTeamRoster(roster || [])

    // Load team statistics
    const { data: stats } = await supabase
      .from('team_statistics')
      .select('wins, losses, ties, win_percentage')
      .eq('team_id', teamId)
      .single()

    if (stats) {
      setTeamStats({
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        ties: stats.ties || 0,
        winPercentage: stats.win_percentage || 0
      })
    }
  }

  async function loadRecentMatches(teamIds: string[]) {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    
    const { data: matches } = await supabase
      .from('matches')
      .select(`
        id,
        date,
        opponent_name,
        is_home,
        result,
        team_id,
        teams (
          name
        )
      `)
      .in('team_id', teamIds)
      .lt('date', today)
      .not('result', 'is', null)
      .order('date', { ascending: false })
      .limit(5)

    setRecentMatches(matches || [])
  }

  async function loadLifetimeStats() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get user's roster memberships first
    const { data: rosters } = await supabase
      .from('roster_members')
      .select('id')
      .eq('user_id', user.id)

    if (!rosters || rosters.length === 0) return

    const rosterIds = rosters.map(r => r.id)

    // Get all individual statistics for this user's roster memberships
    const { data: stats } = await supabase
      .from('individual_statistics')
      .select('matches_played, matches_won, matches_lost, win_percentage')
      .in('player_id', rosterIds)

    if (stats && stats.length > 0) {
      // Aggregate stats across all teams
      const totalMatches = stats.reduce((sum, s) => sum + s.matches_played, 0)
      const totalWins = stats.reduce((sum, s) => sum + s.matches_won, 0)
      const totalLosses = stats.reduce((sum, s) => sum + s.matches_lost, 0)
      const winPercentage = totalMatches > 0 ? (totalWins / totalMatches * 100) : 0

      setLifetimeStats({
        totalMatches,
        wins: totalWins,
        losses: totalLosses,
        winPercentage: Math.round(winPercentage * 100) / 100,
      })
    }
  }

  const getStatusIcon = (status: 'in_lineup' | 'off' | 'pending') => {
    switch (status) {
      case 'in_lineup':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'off':
        return <MinusCircle className="h-5 w-5 text-gray-400" />
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusLabel = (status: 'in_lineup' | 'off' | 'pending') => {
    switch (status) {
      case 'in_lineup':
        return 'In Lineup'
      case 'off':
        return 'Off'
      case 'pending':
        return 'Pending'
    }
  }

  const getAvailabilityIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <Check className="h-3 w-3" />
      case 'maybe':
        return <HelpCircle className="h-3 w-3" />
      case 'unavailable':
        return <X className="h-3 w-3" />
      default:
        return null
    }
  }

  async function updateMatchAvailability(matchId: string, newStatus: 'available' | 'maybe' | 'unavailable') {
    const supabase = createClient()
    const rosterMemberId = rosterMemberMap[matchId]
    
    if (!rosterMemberId) {
      toast({
        title: 'Error',
        description: 'Could not find roster membership',
        variant: 'destructive',
      })
      return
    }

    // Check if availability exists
    const { data: existing } = await supabase
      .from('availability')
      .select('id')
      .eq('roster_member_id', rosterMemberId)
      .eq('match_id', matchId)
      .maybeSingle()

    let error = null
    if (existing) {
      const result = await supabase
        .from('availability')
        .update({ status: newStatus })
        .eq('id', existing.id)
      error = result.error
    } else {
      const result = await supabase
        .from('availability')
        .insert({
          roster_member_id: rosterMemberId,
          match_id: matchId,
          status: newStatus
        })
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
        description: `Availability set to ${newStatus}`,
      })
      
      // Update local state
      setUpcomingMatches(prev => prev.map(m => 
        m.id === matchId 
          ? { ...m, availability: { status: newStatus } }
          : m
      ))
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
      <Header title="TennisLife" />

      <main className="flex-1 p-4">
        {/* Announcements Section */}
        <Card className="mb-4 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Megaphone className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Announcements</h3>
                <p className="text-sm text-blue-800">
                  Welcome to TennisLife! Check your upcoming events and manage your availability.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column - Upcoming Events (takes 2/3 on large screens) */}
          <div className="lg:col-span-2 space-y-4">
        {/* Hero Card - Next Playing */}
        {nextMatch && nextMatch.status === 'in_lineup' ? (
          <Link href={`/teams/${nextMatch.team_id}/matches/${nextMatch.id}`}>
            <Card className="bg-gradient-to-br from-green-100 to-green-200 text-green-900 hover:from-green-200 hover:to-green-300 transition-colors cursor-pointer border-green-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Next Playing</CardTitle>
                  <Trophy className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">
                      {formatDate(nextMatch.date, 'EEEE, MMM d')} at {formatTime(nextMatch.time)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>vs {nextMatch.opponent_name}</span>
                    <Badge variant="outline" className={cn(
                      "ml-auto",
                      nextMatch.is_home 
                        ? "!bg-blue-100 !text-blue-700 border-blue-300" 
                        : "!bg-orange-200 !text-orange-800 border-orange-400"
                    )}>
                      {nextMatch.is_home ? 'Home' : 'Away'}
                    </Badge>
                  </div>
                  {nextMatch.venue && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm">{nextMatch.venue}</span>
                    </div>
                  )}
                  {nextMatch.partner_name && (
                    <div className="pt-2 border-t border-green-300">
                      <p className="text-sm">
                        Court {nextMatch.court_slot} with <span className="font-medium">{nextMatch.partner_name}</span>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">No Upcoming Match</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You&apos;re not currently in any lineup. Check back soon!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Event Type Filter */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Show:</span>
              <Button
                variant={(() => {
                  const allTypes = ['match', 'practice', 'warmup', 'social', 'other']
                  return allTypes.every(type => selectedEventTypes.includes(type)) ? 'default' : 'outline'
                })()}
                size="sm"
                onClick={() => {
                  // "All" means select all event types
                  const allTypes = ['match', 'practice', 'warmup', 'social', 'other']
                  setSelectedEventTypes(allTypes)
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
          </CardContent>
        </Card>

        {/* Upcoming Events List */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Upcoming Events
          </h2>

          {allItems.filter(item => {
            if (item.type === 'match') {
              return selectedEventTypes.includes('match')
            } else {
              return selectedEventTypes.includes(item.event_type || 'other')
            }
          }).length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-muted-foreground">No upcoming events</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {allItems.filter(item => {
                if (item.type === 'match') {
                  return selectedEventTypes.includes('match')
                } else {
                  return selectedEventTypes.includes(item.event_type || 'other')
                }
              }).map((item) => {
                if (item.type === 'match') {
                  const match = item as UpcomingMatch
                  return (
                    <Link key={match.id} href={`/teams/${match.team_id}/matches/${match.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="default" className="text-xs shrink-0 !bg-emerald-700 !text-white">
                              Match
                            </Badge>
                            <span className="font-medium truncate">
                              vs {match.opponent_name}
                            </span>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {match.team_name}
                            </Badge>
                            <Badge 
                              variant={match.is_home ? "default" : "outline"} 
                              className={cn(
                                "text-xs shrink-0",
                                match.is_home 
                                  ? "!bg-blue-100 !text-blue-700 border-blue-300" 
                                  : "!bg-orange-200 !text-orange-800 border-orange-400"
                              )}
                            >
                              {match.is_home ? 'Home' : 'Away'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(match.date, 'MMM d')} at {formatTime(match.time)}
                          </div>
                          {match.venue && (
                            <div className="text-xs text-muted-foreground mt-1 truncate">
                              {match.venue}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="flex items-center gap-1">
                            {getStatusIcon(match.status)}
                            <span className="text-xs text-muted-foreground">
                              {getStatusLabel(match.status)}
                            </span>
                          </div>
                          <Select
                            value={match.availability?.status || 'unavailable'}
                            onValueChange={(value) => updateMatchAvailability(match.id, value as 'available' | 'maybe' | 'unavailable')}
                          >
                            <SelectTrigger 
                              className="h-7 text-xs w-[110px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SelectValue>
                                <div className="flex items-center gap-1.5">
                                  {getAvailabilityIcon(match.availability?.status || 'unavailable')}
                                  <span className="capitalize">
                                    {match.availability?.status || 'Unavailable'}
                                  </span>
                                </div>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              <SelectItem value="available">
                                <div className="flex items-center gap-2">
                                  <Check className="h-3 w-3 text-green-500" />
                                  <span>Available</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="maybe">
                                <div className="flex items-center gap-2">
                                  <HelpCircle className="h-3 w-3 text-yellow-500" />
                                  <span>Maybe</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="unavailable">
                                <div className="flex items-center gap-2">
                                  <X className="h-3 w-3 text-red-500" />
                                  <span>Unavailable</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                  )
                } else if (item.type === 'personal_activity') {
                  const activity = item
                  const personalActivity = upcomingPersonalActivities.find(a => a.id === activity.id)
                  return (
                    <Link key={activity.id} href={`/activities/${activity.id}`}>
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <ActivityTypeBadge activityType={activity.activityType} />
                                <span className="font-medium truncate">
                                  {activity.name}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatDate(activity.date, 'MMM d')} at {formatTime(activity.time)}
                              </div>
                              {activity.teamId && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {activity.teamName}
                                </Badge>
                              )}
                            </div>
                            {personalActivity?.availability_status && (
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <Select
                                  value={personalActivity.availability_status}
                                  onValueChange={(value) => updatePersonalActivityRSVP(activity.id, value as any)}
                                >
                                  <SelectTrigger 
                                    className="h-7 text-xs w-[110px]"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <SelectValue>
                                      <div className="flex items-center gap-1.5">
                                        {getAvailabilityIcon(personalActivity.availability_status)}
                                        <span className="capitalize">
                                          {personalActivity.availability_status === 'maybe' ? 'Tentative' : personalActivity.availability_status}
                                        </span>
                                      </div>
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent onClick={(e) => e.stopPropagation()}>
                                    <SelectItem value="available">
                                      <div className="flex items-center gap-2">
                                        <Check className="h-3 w-3 text-green-500" />
                                        <span>Available</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="maybe">
                                      <div className="flex items-center gap-2">
                                        <HelpCircle className="h-3 w-3 text-yellow-500" />
                                        <span>Tentative</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="unavailable">
                                      <div className="flex items-center gap-2">
                                        <X className="h-3 w-3 text-red-500" />
                                        <span>Unavailable</span>
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                } else {
                  const event = item as UpcomingEvent
                  return (
                    <Link key={event.id} href={`/teams/${event.team_id}/events/${event.id}`}>
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <EventTypeBadge eventType={event.event_type as any} />
                                <span className="font-medium truncate">
                                  {event.event_name}
                                </span>
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {event.team_name}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatDate(event.date, 'MMM d')} at {formatTime(event.time)}
                              </div>
                              {event.location && (
                                <div className="text-xs text-muted-foreground mt-1 truncate">
                                  {event.location}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                }
              })}
            </div>
          )}
        </div>
          </div>

          {/* Right column - Team Info */}
          <div className="space-y-4">

            {/* Team Statistics */}
            {selectedTeamId && teamStats && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Team Record</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {teamStats.wins}-{teamStats.losses}
                    {teamStats.ties > 0 && `-${teamStats.ties}`}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {teamStats.winPercentage.toFixed(1)}% win rate
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Match Results */}
            {selectedTeamId && recentMatches.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
                  Recent Results
                </h2>
                <div className="space-y-2">
                  {recentMatches.map((match: any) => (
                    <Link key={match.id} href={`/teams/${match.team_id}/matches/${match.id}`}>
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                vs {match.opponent_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(match.date, 'MMM d')}
                              </div>
                            </div>
                            <Badge 
                              variant={match.result === 'won' ? 'default' : match.result === 'lost' ? 'destructive' : 'secondary'}
                              className="shrink-0"
                            >
                              {match.result === 'won' ? 'W' : match.result === 'lost' ? 'L' : 'T'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Team Roster */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
                  Roster
                </h2>
                {teams.length > 1 && (
                  <Select value={selectedTeamId || ''} onValueChange={setSelectedTeamId}>
                    <SelectTrigger className="h-7 text-xs w-auto min-w-[120px]">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {teams.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No teams yet</p>
                  </CardContent>
                </Card>
              ) : !selectedTeamId ? (
                <Card>
                  <CardContent className="py-6 text-center">
                    <p className="text-sm text-muted-foreground">Select a team to view roster</p>
                  </CardContent>
                </Card>
              ) : teamRoster.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center">
                    <p className="text-sm text-muted-foreground">No players on roster</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      {teamRoster.map((member) => {
                        const isCaptain = teamCaptainIds && member.user_id && (
                          member.user_id === teamCaptainIds.captain_id || 
                          member.user_id === teamCaptainIds.co_captain_id
                        )
                        return (
                          <div key={member.id} className="flex items-center gap-2 text-sm">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {member.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate flex-1">{member.full_name}</span>
                            {isCaptain && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                Captain
                              </Badge>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Lifetime Statistics */}
            {lifetimeStats && lifetimeStats.totalMatches > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
                  My Stats
                </h2>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Lifetime Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {lifetimeStats.wins}
                        </div>
                        <div className="text-xs text-muted-foreground">Wins</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">
                          {lifetimeStats.losses}
                        </div>
                        <div className="text-xs text-muted-foreground">Losses</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-primary">
                          {lifetimeStats.totalMatches}
                        </div>
                        <div className="text-xs text-muted-foreground">Played</div>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Win Rate</span>
                        <span className="text-lg font-bold text-primary">
                          {lifetimeStats.winPercentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {lifetimeStats.wins}-{lifetimeStats.losses} record
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
