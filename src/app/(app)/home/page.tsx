'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime } from '@/lib/utils'
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
  HelpCircle
} from 'lucide-react'

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

interface Team {
  id: string
  name: string
  league_format: string | null
  season: string | null
}

export default function HomePage() {
  const [nextMatch, setNextMatch] = useState<UpcomingMatch | null>(null)
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [rosterMemberMap, setRosterMemberMap] = useState<Record<string, string>>({}) // matchId -> rosterMemberId
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
      const response = await fetch('/api/auth/link-roster-members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (data.success && data.linked > 0) {
        // Refresh the page to show the new teams
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
    const allTeams = [
      ...(memberships?.map(m => m.teams as Team).filter(Boolean) || []),
      ...(captainTeams || [])
    ]
    const uniqueTeams = allTeams.filter((team, index, self) =>
      index === self.findIndex(t => t.id === team.id)
    )
    setTeams(uniqueTeams)

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

    // Get upcoming matches for user's teams
    const today = new Date().toISOString().split('T')[0]
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
          partnerName = (userLineup.player2 as { full_name: string }).full_name
        } else if (userLineup.player1) {
          partnerName = (userLineup.player1 as { full_name: string }).full_name
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
        team_name: (match.teams as { name: string }).name,
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
    
    // Load lifetime statistics
    await loadLifetimeStats()
    
    setLoading(false)
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column - Upcoming Matches (takes 2/3 on large screens) */}
          <div className="lg:col-span-2 space-y-4">
        {/* Hero Card - Next Playing */}
        {nextMatch && nextMatch.status === 'in_lineup' ? (
          <Link href={`/teams/${nextMatch.team_id}/matches/${nextMatch.id}`}>
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-colors cursor-pointer">
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
                    <Badge variant="secondary" className="ml-auto bg-white/20 text-white">
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
                    <div className="pt-2 border-t border-white/20">
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

        {/* Upcoming Matches List */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Upcoming Matches
          </h2>

          {upcomingMatches.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-muted-foreground">No upcoming matches</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {upcomingMatches.map((match) => (
                <Link key={match.id} href={`/teams/${match.team_id}/matches/${match.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">
                              vs {match.opponent_name}
                            </span>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {match.team_name}
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
              ))}
            </div>
          )}
        </div>
          </div>

          {/* Right column - My Teams */}
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
                My Teams
              </h2>
              {teams.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No teams yet</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {teams.map((team) => (
                    <Link key={team.id} href={`/teams/${team.id}`} className="block mb-3">
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate text-sm">{team.name}</p>
                              {(team.league_format || team.season) && (
                                <div className="flex items-center gap-2 mt-1">
                                  {team.league_format && (
                                    <Badge variant="outline" className="text-xs">
                                      {team.league_format}
                                    </Badge>
                                  )}
                                  {team.season && (
                                    <span className="text-xs text-muted-foreground truncate">
                                      {team.season}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
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
