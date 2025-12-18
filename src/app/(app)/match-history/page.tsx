'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/header'
import { StatisticsCard } from '@/components/match-history/statistics-card'
import { MatchFiltersComponent, type MatchFilters } from '@/components/match-history/match-filters'
import { MatchListItem } from '@/components/match-history/match-list-item'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Trophy } from 'lucide-react'

interface MatchScore {
  id: string
  lineup_id: string
  set_number: number
  home_games: number
  away_games: number
  is_tiebreak: boolean
}

interface MatchLineup {
  id: string
  match_id: string
  court_slot: number
  player1_id: string | null
  player2_id: string | null
  player1: { full_name: string } | null
  player2: { full_name: string } | null
  matches: {
    id: string
    date: string
    opponent_name: string
    team_id: string
    match_result: 'win' | 'loss' | 'tie' | null
    score_summary: string | null
    teams: {
      name: string
      league_format: string
    }
  }
}

interface Team {
  id: string
  name: string
}

interface TeamStatistics {
  teamId: string
  teamName: string
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  setsWon: number
  setsLost: number
  gamesWon: number
  gamesLost: number
  winPercentage: number
}

export default function MatchHistoryPage() {
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [lineups, setLineups] = useState<MatchLineup[]>([])
  const [scores, setScores] = useState<MatchScore[]>([])
  const [overallStats, setOverallStats] = useState({
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
    winPercentage: 0,
  })
  const [teamStats, setTeamStats] = useState<TeamStatistics[]>([])
  const [filters, setFilters] = useState<MatchFilters>({
    teamId: null,
    result: null,
    dateFrom: null,
    dateTo: null,
    sortBy: 'date_desc',
  })

  useEffect(() => {
    loadMatchHistory()
  }, [])

  async function loadMatchHistory() {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        console.error('No user found')
        return
      }

      // 1. Get user's roster memberships
      const { data: rosters, error: rostersError } = await supabase
        .from('roster_members')
        .select('id, team_id, teams(id, name, league_format)')
        .eq('user_id', user.id)

      if (rostersError) {
        console.error('Error fetching rosters:', rostersError)
        return
      }

      const rosterIds = rosters?.map(r => r.id) || []
      const uniqueTeams = rosters?.map(r => ({
        id: r.teams.id,
        name: r.teams.name,
      })) || []

      setTeams(uniqueTeams)

      if (rosterIds.length === 0) {
        setLoading(false)
        return
      }

      // 2. Get lineups where user played (past matches only)
      const today = new Date().toISOString().split('T')[0]
      
      const { data: lineupsData, error: lineupsError } = await supabase
        .from('lineups')
        .select(`
          id,
          match_id,
          court_slot,
          player1_id,
          player2_id,
          player1:roster_members!lineups_player1_id_fkey(full_name),
          player2:roster_members!lineups_player2_id_fkey(full_name),
          matches!inner(
            id,
            date,
            opponent_name,
            team_id,
            match_result,
            score_summary,
            teams(name, league_format)
          )
        `)
        .in('player1_id', rosterIds)

      if (lineupsError) {
        console.error('Error fetching lineups:', lineupsError)
        return
      }

      // Also get lineups where user is player2
      const { data: lineupsData2, error: lineupsError2 } = await supabase
        .from('lineups')
        .select(`
          id,
          match_id,
          court_slot,
          player1_id,
          player2_id,
          player1:roster_members!lineups_player1_id_fkey(full_name),
          player2:roster_members!lineups_player2_id_fkey(full_name),
          matches!inner(
            id,
            date,
            opponent_name,
            team_id,
            match_result,
            score_summary,
            teams(name, league_format)
          )
        `)
        .in('player2_id', rosterIds)

      if (lineupsError2) {
        console.error('Error fetching lineups (player2):', lineupsError2)
      }

      // Combine and deduplicate lineups
      const allLineups = [...(lineupsData || []), ...(lineupsData2 || [])]
      const uniqueLineups = Array.from(
        new Map(allLineups.map(lineup => [lineup.id, lineup])).values()
      )

      // Filter to only past matches and sort by date (newest first)
      const pastLineups = uniqueLineups
        .filter(lineup => lineup.matches.date < today)
        .sort((a, b) => b.matches.date.localeCompare(a.matches.date))

      setLineups(pastLineups)

      // 3. Get scores for these lineups
      const lineupIds = pastLineups.map(l => l.id)
      if (lineupIds.length > 0) {
        const { data: scoresData, error: scoresError } = await supabase
          .from('match_scores')
          .select('*')
          .in('lineup_id', lineupIds)

        if (scoresError) {
          console.error('Error fetching scores:', scoresError)
        } else {
          setScores(scoresData || [])
        }
      }

      // 4. Get individual statistics
      const { data: statsData, error: statsError } = await supabase
        .from('individual_statistics')
        .select(`
          *,
          teams(name)
        `)
        .in('player_id', rosterIds)

      if (statsError) {
        console.error('Error fetching statistics:', statsError)
      } else if (statsData) {
        // Calculate overall stats
        const overall = statsData.reduce(
          (acc, stat) => ({
            matchesPlayed: acc.matchesPlayed + (stat.matches_played || 0),
            matchesWon: acc.matchesWon + (stat.matches_won || 0),
            matchesLost: acc.matchesLost + (stat.matches_lost || 0),
            setsWon: acc.setsWon + (stat.sets_won || 0),
            setsLost: acc.setsLost + (stat.sets_lost || 0),
            gamesWon: acc.gamesWon + (stat.games_won || 0),
            gamesLost: acc.gamesLost + (stat.games_lost || 0),
          }),
          {
            matchesPlayed: 0,
            matchesWon: 0,
            matchesLost: 0,
            setsWon: 0,
            setsLost: 0,
            gamesWon: 0,
            gamesLost: 0,
          }
        )

        const winPercentage = overall.matchesPlayed > 0
          ? (overall.matchesWon / overall.matchesPlayed) * 100
          : 0

        setOverallStats({ ...overall, winPercentage })

        // Calculate per-team stats
        const teamStatsMap = new Map<string, TeamStatistics>()
        statsData.forEach((stat) => {
          const teamId = stat.team_id
          const teamName = stat.teams?.name || 'Unknown Team'
          const existing = teamStatsMap.get(teamId)

          if (existing) {
            teamStatsMap.set(teamId, {
              ...existing,
              matchesPlayed: existing.matchesPlayed + (stat.matches_played || 0),
              matchesWon: existing.matchesWon + (stat.matches_won || 0),
              matchesLost: existing.matchesLost + (stat.matches_lost || 0),
              setsWon: existing.setsWon + (stat.sets_won || 0),
              setsLost: existing.setsLost + (stat.sets_lost || 0),
              gamesWon: existing.gamesWon + (stat.games_won || 0),
              gamesLost: existing.gamesLost + (stat.games_lost || 0),
            })
          } else {
            teamStatsMap.set(teamId, {
              teamId,
              teamName,
              matchesPlayed: stat.matches_played || 0,
              matchesWon: stat.matches_won || 0,
              matchesLost: stat.matches_lost || 0,
              setsWon: stat.sets_won || 0,
              setsLost: stat.sets_lost || 0,
              gamesWon: stat.games_won || 0,
              gamesLost: stat.games_lost || 0,
              winPercentage: 0,
            })
          }
        })

        // Calculate win percentage for each team
        const teamStatsArray = Array.from(teamStatsMap.values()).map((team) => ({
          ...team,
          winPercentage:
            team.matchesPlayed > 0
              ? (team.matchesWon / team.matchesPlayed) * 100
              : 0,
        }))

        setTeamStats(teamStatsArray)
      }
    } catch (error) {
      console.error('Error loading match history:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort lineups based on current filters
  const filteredAndSortedLineups = lineups
    .filter((lineup) => {
      // Team filter
      if (filters.teamId && lineup.matches.team_id !== filters.teamId) {
        return false
      }

      // Result filter
      if (filters.result) {
        if (filters.result === 'no_score' && lineup.matches.match_result !== null) {
          return false
        } else if (filters.result !== 'no_score' && lineup.matches.match_result !== filters.result) {
          return false
        }
      }

      // Date range filters
      if (filters.dateFrom && lineup.matches.date < filters.dateFrom) {
        return false
      }
      if (filters.dateTo && lineup.matches.date > filters.dateTo) {
        return false
      }

      return true
    })
    .sort((a, b) => {
      switch (filters.sortBy) {
        case 'date_asc':
          return a.matches.date.localeCompare(b.matches.date)
        case 'date_desc':
          return b.matches.date.localeCompare(a.matches.date)
        case 'opponent_asc':
          return a.matches.opponent_name.localeCompare(b.matches.opponent_name)
        default:
          return 0
      }
    })

  // Get partner name for a lineup
  const getPartnerName = (lineup: MatchLineup, currentUserId: string): string | null => {
    const player1Name = lineup.player1?.full_name
    const player2Name = lineup.player2?.full_name

    // If both players exist, return the one that's not the current user
    // This is a simplified approach - in reality, we'd need to check roster_member user_ids
    if (player1Name && player2Name) {
      // For now, just return player2's name as the partner
      return player2Name
    }

    return player1Name || player2Name || null
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Match History" />
        <main className="flex-1 flex items-center justify-center p-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Match History" />
      <main className="flex-1 p-4 space-y-6">
        {/* Statistics Card */}
        <StatisticsCard overallStats={overallStats} teamStats={teamStats} />

        {/* Filters */}
        <MatchFiltersComponent
          teams={teams}
          filters={filters}
          onFiltersChange={setFilters}
        />

        {/* Match List */}
        <div className="space-y-3">
          {filteredAndSortedLineups.length === 0 ? (
            <Card className="p-8">
              <CardContent className="flex flex-col items-center justify-center text-center space-y-3 pt-6">
                <Trophy className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-lg mb-1">No Matches Found</h3>
                  <p className="text-sm text-muted-foreground">
                    {lineups.length === 0
                      ? "You haven't played in any matches yet."
                      : 'No matches match your current filters. Try adjusting them.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredAndSortedLineups.map((lineup) => {
              const lineupScores = scores.filter((s) => s.lineup_id === lineup.id)
              return (
                <MatchListItem
                  key={lineup.id}
                  matchId={lineup.matches.id}
                  teamId={lineup.matches.team_id}
                  date={lineup.matches.date}
                  teamName={lineup.matches.teams.name}
                  opponentName={lineup.matches.opponent_name}
                  matchResult={lineup.matches.match_result}
                  courtSlot={lineup.court_slot}
                  partnerName={getPartnerName(lineup, '')}
                  scores={lineupScores}
                />
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}

