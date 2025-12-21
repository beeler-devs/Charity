'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Match, Team, RosterMember } from '@/types/database.types'
import { formatDate, formatTime } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { CourtScoreCard } from '@/components/matches/court-score-card'
import { MatchScore, CourtResult, calculateMatchResult, generateScoreSummary } from '@/lib/score-utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Save,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'

interface LineupWithPlayers {
  id: string
  court_slot: number
  player1_id: string | null
  player2_id: string | null
  player1: { id: string; full_name: string } | null
  player2: { id: string; full_name: string } | null
}

interface CourtSlot {
  courtNumber: number
  player1: RosterMember | null
  player2: RosterMember | null
  lineupId?: string
}

export default function EnterScoresPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
  const matchId = params.matchId as string
  const { toast } = useToast()

  const [match, setMatch] = useState<Match | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [roster, setRoster] = useState<RosterMember[]>([])
  const [lineups, setLineups] = useState<LineupWithPlayers[]>([])
  const [courts, setCourts] = useState<CourtSlot[]>([
    { courtNumber: 1, player1: null, player2: null },
    { courtNumber: 2, player1: null, player2: null },
    { courtNumber: 3, player1: null, player2: null },
  ])
  const [scores, setScores] = useState<Map<string, MatchScore[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isCaptain, setIsCaptain] = useState(false)

  useEffect(() => {
    loadData()
  }, [teamId, matchId])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/home')
      return
    }

    // Load match
    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (!matchData) {
      toast({
        title: 'Error',
        description: 'Match not found',
        variant: 'destructive',
      })
      router.back()
      return
    }

    setMatch(matchData)

    // Load team
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()

    if (!teamData) {
      toast({
        title: 'Error',
        description: 'Team not found',
        variant: 'destructive',
      })
      router.back()
      return
    }

    setTeam(teamData)

    // Check if user is captain
    const captain = teamData.captain_id === user.id || teamData.co_captain_id === user.id
    setIsCaptain(captain)

    if (!captain) {
      toast({
        title: 'Access Denied',
        description: 'Only captains can enter scores',
        variant: 'destructive',
      })
      router.back()
      return
    }

    // Load roster
    const { data: rosterData } = await supabase
      .from('roster_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('full_name')

    setRoster(rosterData || [])

    // Load existing lineups
    const { data: lineupsData } = await supabase
      .from('lineups')
      .select(`
        id,
        court_slot,
        player1_id,
        player2_id,
        player1:roster_members!lineups_player1_id_fkey(id, full_name),
        player2:roster_members!lineups_player2_id_fkey(id, full_name)
      `)
      .eq('match_id', matchId)
      .order('court_slot', { ascending: true })

    if (lineupsData && lineupsData.length > 0) {
      setLineups(lineupsData as any[])
      
      // Populate courts from existing lineups
      const newCourts: CourtSlot[] = [1, 2, 3].map(num => {
        const lineup = lineupsData.find(l => l.court_slot === num) as any
        const player1 = lineup?.player1_id
          ? rosterData?.find(p => p.id === lineup.player1_id) || null
          : null
        const player2 = lineup?.player2_id
          ? rosterData?.find(p => p.id === lineup.player2_id) || null
          : null

        return {
          courtNumber: num,
          player1,
          player2,
          lineupId: lineup?.id,
        }
      })
      setCourts(newCourts)

      // Load existing scores
      const lineupIds = lineupsData.map(l => l.id)
      const { data: existingScores } = await supabase
        .from('match_scores')
        .select('*')
        .in('lineup_id', lineupIds)

      if (existingScores && existingScores.length > 0) {
        const scoresMap = new Map<string, MatchScore[]>()
        existingScores.forEach(score => {
          const existing = scoresMap.get(score.lineup_id) || []
          scoresMap.set(score.lineup_id, [...existing, score as MatchScore])
        })
        setScores(scoresMap)
      }
    } else {
      // No lineups exist, initialize empty courts
      setCourts([
        { courtNumber: 1, player1: null, player2: null },
        { courtNumber: 2, player1: null, player2: null },
        { courtNumber: 3, player1: null, player2: null },
      ])
    }

    setLoading(false)
  }

  function handlePlayerSelect(courtIndex: number, slot: 'player1' | 'player2', playerId: string) {
    const player = roster.find(p => p.id === playerId)
    if (!player) return

    setCourts(prev => {
      const newCourts = [...prev]
      newCourts[courtIndex] = {
        ...newCourts[courtIndex],
        [slot]: player,
      }
      return newCourts
    })
  }

  const handleScoreChange = useCallback((lineupId: string, newScores: MatchScore[]) => {
    setScores(prev => {
      const updated = new Map(prev)
      updated.set(lineupId, newScores)
      return updated
    })
  }, [])

  function calculateCurrentResult(): { courtsWon: number; courtsLost: number; result: 'win' | 'loss' | 'tie' | 'pending' } {
    const courtResults: CourtResult[] = []
    const { calculateSetWinner } = require('@/lib/score-utils')

    // Calculate results for all courts that have both players and scores
    courts.forEach(court => {
      if (!court.player1 || !court.player2) return

      const lineupId = court.lineupId || `temp-${court.courtNumber}`
      const courtScores = scores.get(lineupId) || []
      if (courtScores.length === 0) return

      const sets = courtScores.map(s => ({
        homeGames: s.home_games,
        awayGames: s.away_games,
        isTiebreak: s.tiebreak_home !== null,
      }))

      const setsWon = sets.filter(set => {
        const winner = calculateSetWinner(set.homeGames, set.awayGames)
        return winner === 'home'
      }).length

      const setsLost = sets.filter(set => {
        const winner = calculateSetWinner(set.homeGames, set.awayGames)
        return winner === 'away'
      }).length

      if (setsWon > 0 || setsLost > 0) {
        courtResults.push({
          courtNumber: court.courtNumber,
          won: setsWon > setsLost,
          sets,
        })
      }
    })

    const courtsWon = courtResults.filter(c => c.won).length
    const courtsLost = courtResults.filter(c => !c.won).length

    const courtsWithScores = courts.filter(c => c.player1 && c.player2 && scores.get(c.lineupId || `temp-${c.courtNumber}`)?.length)
    let result: 'win' | 'loss' | 'tie' | 'pending' = 'pending'
    if (courtResults.length > 0 && courtResults.length === courtsWithScores.length) {
      result = calculateMatchResult(courtResults)
    }

    return { courtsWon, courtsLost, result }
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    try {
      // Step 1: Save/update lineups
      const lineupIdMap = new Map<number, string>() // Maps court number to lineup ID

      for (let i = 0; i < courts.length; i++) {
        const court = courts[i]
        if (!court.player1 || !court.player2) {
          // Skip courts without both players
          continue
        }

        if (court.lineupId) {
          // Update existing lineup
          const { error } = await supabase
            .from('lineups')
            .update({
              player1_id: court.player1.id,
              player2_id: court.player2.id,
              is_published: true, // Auto-publish when saving scores
            })
            .eq('id', court.lineupId)

          if (error) {
            toast({
              title: 'Error',
              description: `Failed to update lineup for court ${court.courtNumber}: ${error.message}`,
              variant: 'destructive',
            })
            setSaving(false)
            return
          }
          lineupIdMap.set(court.courtNumber, court.lineupId)
        } else {
          // Create new lineup
          const { data: newLineup, error } = await supabase
            .from('lineups')
            .insert({
              match_id: matchId,
              court_slot: court.courtNumber,
              player1_id: court.player1.id,
              player2_id: court.player2.id,
              is_published: true, // Auto-publish when saving scores
            })
            .select()
            .single()

          if (error) {
            toast({
              title: 'Error',
              description: `Failed to create lineup for court ${court.courtNumber}: ${error.message}`,
              variant: 'destructive',
            })
            setSaving(false)
            return
          }
          lineupIdMap.set(court.courtNumber, newLineup.id)
        }
      }

      if (lineupIdMap.size === 0) {
        toast({
          title: 'Error',
          description: 'Please assign players to at least one court',
          variant: 'destructive',
        })
        setSaving(false)
        return
      }

      const lineupIds = Array.from(lineupIdMap.values())

      // Step 2: Save scores
      // Map temporary lineup IDs to actual lineup IDs
      const tempToActualMap = new Map<string, string>()
      courts.forEach(court => {
        if (court.player1 && court.player2) {
          const tempId = `temp-${court.courtNumber}`
          const actualId = lineupIdMap.get(court.courtNumber)
          if (actualId) {
            tempToActualMap.set(tempId, actualId)
          }
        }
      })

      // Delete existing scores for these lineups
      if (lineupIds.length > 0) {
        await supabase
          .from('match_scores')
          .delete()
          .in('lineup_id', lineupIds)
      }

      // Insert new scores with actual lineup IDs
      const allScores: MatchScore[] = []
      scores.forEach((courtScores, tempLineupId) => {
        const actualLineupId = tempToActualMap.get(tempLineupId) || tempLineupId
        courtScores.forEach(score => {
          allScores.push({
            ...score,
            lineup_id: actualLineupId,
          })
        })
      })

      if (allScores.length > 0) {
        const { error: scoresError } = await supabase
          .from('match_scores')
          .insert(allScores.map(s => ({
            lineup_id: s.lineup_id,
            set_number: s.set_number,
            home_games: s.home_games,
            away_games: s.away_games,
            tiebreak_home: s.tiebreak_home,
            tiebreak_away: s.tiebreak_away,
            is_completed: s.is_completed,
          })))

        if (scoresError) {
          toast({
            title: 'Error',
            description: `Failed to save scores: ${scoresError.message}`,
            variant: 'destructive',
          })
          setSaving(false)
          return
        }
      }

      // Step 3: Update match result if scores were entered
      if (allScores.length > 0) {
        const { calculateSetWinner } = require('@/lib/score-utils')
        
        // Reload lineups to get updated IDs
        const { data: updatedLineups } = await supabase
          .from('lineups')
          .select('id, court_slot')
          .in('id', lineupIds)

        if (updatedLineups) {
          const updatedScoresMap = new Map<string, MatchScore[]>()
          allScores.forEach(score => {
            const existing = updatedScoresMap.get(score.lineup_id) || []
            updatedScoresMap.set(score.lineup_id, [...existing, score])
          })

          const courtResults: CourtResult[] = []
          updatedLineups.forEach(lineup => {
            const courtScores = updatedScoresMap.get(lineup.id) || []
            if (courtScores.length === 0) return

            const sets = courtScores.map(s => ({
              homeGames: s.home_games,
              awayGames: s.away_games,
              isTiebreak: s.tiebreak_home !== null,
            }))

            const setsWon = sets.filter(set => {
              const winner = calculateSetWinner(set.homeGames, set.awayGames)
              return winner === 'home'
            }).length

            const setsLost = sets.filter(set => {
              const winner = calculateSetWinner(set.homeGames, set.awayGames)
              return winner === 'away'
            }).length

            if (setsWon > 0 || setsLost > 0) {
              courtResults.push({
                courtNumber: lineup.court_slot,
                won: setsWon > setsLost,
                sets,
              })
            }
          })

          if (courtResults.length > 0) {
            const courtsWon = courtResults.filter(c => c.won).length
            const courtsLost = courtResults.filter(c => !c.won).length
            const result = calculateMatchResult(courtResults)
            const scoreSummary = `${courtsWon}-${courtsLost}`

            await supabase
              .from('matches')
              .update({
                match_result: result,
                score_summary: scoreSummary,
              })
              .eq('id', matchId)
          }
        }
      }

      toast({
        title: 'Success',
        description: 'Lineup and scores saved successfully',
      })

      // Update scores map with actual lineup IDs
      const updatedScoresMap = new Map<string, MatchScore[]>()
      scores.forEach((courtScores, tempLineupId) => {
        if (tempLineupId.startsWith('temp-')) {
          const courtNum = parseInt(tempLineupId.replace('temp-', ''))
          const actualId = lineupIdMap.get(courtNum)
          if (actualId) {
            updatedScoresMap.set(actualId, courtScores.map(s => ({ ...s, lineup_id: actualId })))
          }
        } else {
          updatedScoresMap.set(tempLineupId, courtScores)
        }
      })
      setScores(updatedScoresMap)

      // Reload data to show updated state
      await loadData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save',
        variant: 'destructive',
      })
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!match || !team) {
    return null
  }

  const leagueFormat = (team.league_format as 'CUP' | 'USTA' | 'FLEX') || 'USTA'
  const { courtsWon, courtsLost, result } = calculateCurrentResult()

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Enter Match Scores" />
      
      <main className="flex-1 p-4 space-y-4 max-w-4xl mx-auto w-full">
        {/* Back Button */}
        <Link href={`/teams/${teamId}/matches/${matchId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Match Details
          </Button>
        </Link>

        {/* Match Details */}
        <Card>
          <CardHeader>
            <CardTitle>Match Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{formatDate(match.date, 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{formatTime(match.time)}</span>
            </div>
            {match.venue && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{match.venue}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">vs {match.opponent_name}</span>
              <Badge variant={match.is_home ? 'default' : 'outline'}>
                {match.is_home ? 'Home' : 'Away'}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              League Format: <strong>{leagueFormat}</strong>
            </div>
          </CardContent>
        </Card>

        {/* Lineup Entry */}
        <Card>
          <CardHeader>
            <CardTitle>Lineup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {courts.map((court, index) => (
              <div key={court.courtNumber} className="border rounded-lg p-4 space-y-2">
                <Label className="text-base font-semibold">Court {court.courtNumber}</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`court-${court.courtNumber}-player1`}>Player 1</Label>
                    <Select
                      value={court.player1?.id || ''}
                      onValueChange={(value) => handlePlayerSelect(index, 'player1', value)}
                    >
                      <SelectTrigger id={`court-${court.courtNumber}-player1`}>
                        <SelectValue placeholder="Select player" />
                      </SelectTrigger>
                      <SelectContent>
                        {roster.map(player => (
                          <SelectItem key={player.id} value={player.id}>
                            {player.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`court-${court.courtNumber}-player2`}>Player 2</Label>
                    <Select
                      value={court.player2?.id || ''}
                      onValueChange={(value) => handlePlayerSelect(index, 'player2', value)}
                    >
                      <SelectTrigger id={`court-${court.courtNumber}-player2`}>
                        <SelectValue placeholder="Select player" />
                      </SelectTrigger>
                      <SelectContent>
                        {roster.map(player => (
                          <SelectItem key={player.id} value={player.id}>
                            {player.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Score Entry */}
        <Card>
          <CardHeader>
            <CardTitle>Enter Scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {courts.map((court, index) => {
              if (!court.player1 || !court.player2) {
                return (
                  <div key={court.courtNumber} className="border rounded-lg p-4 text-sm text-muted-foreground">
                    Court {court.courtNumber}: Assign players above to enter scores
                  </div>
                )
              }

              // Use existing lineup ID or create a temporary one for score entry
              const lineupId = court.lineupId || `temp-${court.courtNumber}`

              return (
                <CourtScoreCard
                  key={court.courtNumber}
                  courtNumber={court.courtNumber}
                  player1Name={court.player1.full_name || 'Unknown'}
                  player2Name={court.player2.full_name || 'Unknown'}
                  mode={leagueFormat}
                  lineupId={lineupId}
                  existingScores={scores.get(lineupId) || []}
                  onChange={handleScoreChange}
                />
              )
            })}

            {courts.some(c => c.player1 && c.player2) && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-lg font-semibold">
                  Current Score: {courtsWon} - {courtsLost}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {result === 'pending' ? 'Enter all court scores to determine match result' : `Match Result: ${result.toUpperCase()}`}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
            size="lg"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Lineup & Scores
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  )
}

