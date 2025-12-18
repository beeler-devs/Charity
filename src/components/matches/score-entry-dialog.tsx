'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { CourtScoreCard } from './court-score-card'
import { MatchScore, CourtResult, calculateMatchResult, generateScoreSummary, calculateSetWinner } from '@/lib/score-utils'

export interface ScoreEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  matchId: string
  teamId: string
  leagueFormat: 'CUP' | 'USTA' | 'FLEX'
  onScoresSaved: () => void
}

interface LineupWithPlayers {
  id: string
  court_slot: number
  player1: { id: string; full_name: string } | null
  player2: { id: string; full_name: string } | null
}

export function ScoreEntryDialog({
  open,
  onOpenChange,
  matchId,
  teamId,
  leagueFormat,
  onScoresSaved,
}: ScoreEntryDialogProps) {
  const [lineups, setLineups] = useState<LineupWithPlayers[]>([])
  const [scores, setScores] = useState<Map<string, MatchScore[]>>(new Map())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadLineups()
    }
  }, [open, matchId])

  async function loadLineups() {
    setLoading(true)
    const supabase = createClient()

    // Load lineups with player names
    const { data: lineupsData, error: lineupsError } = await supabase
      .from('lineups')
      .select(`
        id,
        court_slot,
        player1:roster_members!lineups_player1_id_fkey(id, full_name),
        player2:roster_members!lineups_player2_id_fkey(id, full_name)
      `)
      .eq('match_id', matchId)
      .eq('is_published', true)
      .order('court_slot', { ascending: true })

    if (lineupsError) {
      toast({
        title: 'Error',
        description: 'Failed to load lineups',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    if (!lineupsData || lineupsData.length === 0) {
      toast({
        title: 'No lineup',
        description: 'Please assign players to courts before entering scores',
        variant: 'destructive',
      })
      onOpenChange(false)
      setLoading(false)
      return
    }

    setLineups(lineupsData as any[])

    // Load existing scores if any
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

    setLoading(false)
  }

  function handleScoreChange(lineupId: string, newScores: MatchScore[]) {
    setScores(prev => {
      const updated = new Map(prev)
      updated.set(lineupId, newScores)
      return updated
    })
  }

  function calculateCurrentResult(): { courtsWon: number; courtsLost: number; result: 'win' | 'loss' | 'tie' | 'pending' } {
    const courtResults: CourtResult[] = []

    lineups.forEach(lineup => {
      const courtScores = scores.get(lineup.id) || []
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

    const courtsWon = courtResults.filter(c => c.won).length
    const courtsLost = courtResults.filter(c => !c.won).length

    let result: 'win' | 'loss' | 'tie' | 'pending' = 'pending'
    if (courtResults.length > 0 && courtResults.length === lineups.length) {
      result = calculateMatchResult(courtResults)
    }

    return { courtsWon, courtsLost, result }
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    try {
      // Delete existing scores
      const lineupIds = lineups.map(l => l.id)
      await supabase
        .from('match_scores')
        .delete()
        .in('lineup_id', lineupIds)

      // Insert new scores
      const allScores: MatchScore[] = []
      scores.forEach(courtScores => {
        allScores.push(...courtScores)
      })

      if (allScores.length === 0) {
        toast({
          title: 'No scores entered',
          description: 'Please enter scores for at least one court',
          variant: 'destructive',
        })
        setSaving(false)
        return
      }

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

      // Update match result and score summary
      const { courtsWon, courtsLost, result } = calculateCurrentResult()
      const scoreSummary = `${courtsWon}-${courtsLost}`

      const { error: matchError } = await supabase
        .from('matches')
        .update({
          match_result: result,
          score_summary: scoreSummary,
        })
        .eq('id', matchId)

      if (matchError) {
        toast({
          title: 'Error',
          description: `Failed to update match result: ${matchError.message}`,
          variant: 'destructive',
        })
        setSaving(false)
        return
      }

      toast({
        title: 'Scores saved',
        description: `Match result: ${result} ${scoreSummary}`,
      })

      onScoresSaved()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save scores',
        variant: 'destructive',
      })
    }

    setSaving(false)
  }

  const { courtsWon, courtsLost, result } = calculateCurrentResult()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enter Match Scores</DialogTitle>
          <DialogDescription>
            Enter the scores for each court. {leagueFormat === 'CUP' ? 'CUP format: total games won.' : 'USTA format: set-by-set scores.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading lineup...</div>
        ) : (
          <div className="space-y-4">
            {lineups.map(lineup => (
              <CourtScoreCard
                key={lineup.id}
                courtNumber={lineup.court_slot}
                player1Name={lineup.player1?.full_name || 'TBD'}
                player2Name={lineup.player2?.full_name || 'TBD'}
                mode={leagueFormat}
                lineupId={lineup.id}
                existingScores={scores.get(lineup.id) || []}
                onChange={handleScoreChange}
              />
            ))}

            {lineups.length > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-lg font-semibold">
                  Current Score: {courtsWon} - {courtsLost}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {result === 'pending' ? 'Enter all court scores to determine match result' : `Match Result: ${result.toUpperCase()}`}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading || scores.size === 0}
          >
            {saving ? 'Saving...' : 'Save Scores'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

