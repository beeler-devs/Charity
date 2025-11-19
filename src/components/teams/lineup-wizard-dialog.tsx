'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RosterMember } from '@/types/database.types'
import { Badge } from '@/components/ui/badge'
import { Wand2, Loader2 } from 'lucide-react'

interface PlayerWithAvailability extends RosterMember {
  availability?: 'available' | 'unavailable' | 'maybe' | 'late'
}

interface PairSuggestion {
  player1: PlayerWithAvailability
  player2: PlayerWithAvailability
  score: number
  winPct: number
  gamesPct: number
  fairPlay: number
}

interface LineupWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  availablePlayers: PlayerWithAvailability[]
  onApply: (suggestions: PairSuggestion[]) => void
}

export function LineupWizardDialog({
  open,
  onOpenChange,
  teamId,
  availablePlayers,
  onApply,
}: LineupWizardDialogProps) {
  const [suggestions, setSuggestions] = useState<PairSuggestion[]>([])
  const [loading, setLoading] = useState(false)

  async function runWizard() {
    setLoading(true)

    // Filter only available players
    const eligiblePlayers = availablePlayers.filter(
      p => p.availability === 'available' || p.availability === 'maybe' || p.availability === 'late'
    )

    // Generate all possible pairs
    const pairs: PairSuggestion[] = []

    for (let i = 0; i < eligiblePlayers.length; i++) {
      for (let j = i + 1; j < eligiblePlayers.length; j++) {
        const player1 = eligiblePlayers[i]
        const player2 = eligiblePlayers[j]

        // Mock statistics - in production, fetch from pair_statistics table
        const winPct = Math.random() * 100
        const gamesPct = Math.random() * 100
        const fairPlay = (player1.fair_play_score + player2.fair_play_score) / 2

        // Calculate weighted score
        // (Win % * 0.4) + (Games % * 0.3) + (FairPlay * 0.3)
        const score = (winPct * 0.4) + (gamesPct * 0.3) + (fairPlay * 0.3)

        pairs.push({
          player1,
          player2,
          score,
          winPct,
          gamesPct,
          fairPlay,
        })
      }
    }

    // Sort by score descending
    pairs.sort((a, b) => b.score - a.score)

    // Select top 3 non-overlapping pairs
    const selectedPairs: PairSuggestion[] = []
    const usedPlayerIds = new Set<string>()

    for (const pair of pairs) {
      if (
        !usedPlayerIds.has(pair.player1.id) &&
        !usedPlayerIds.has(pair.player2.id)
      ) {
        selectedPairs.push(pair)
        usedPlayerIds.add(pair.player1.id)
        usedPlayerIds.add(pair.player2.id)

        if (selectedPairs.length === 3) break
      }
    }

    setSuggestions(selectedPairs)
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Lineup Wizard
          </DialogTitle>
          <DialogDescription>
            Automatically generate optimal pairings based on win percentage, games percentage, and fair play scores.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {suggestions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Click below to generate suggested pairings
              </p>
              <Button onClick={runWizard} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Run Wizard
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Suggested Lineup</h4>
              {suggestions.map((pair, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Court {index + 1}</span>
                    <Badge variant="secondary">Score: {pair.score.toFixed(1)}</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{pair.player1.full_name}</span>
                      <span className="text-muted-foreground">{pair.player1.ntrp_rating}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>{pair.player2.full_name}</span>
                      <span className="text-muted-foreground">{pair.player2.ntrp_rating}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                    <span>Win: {pair.winPct.toFixed(0)}%</span>
                    <span>Games: {pair.gamesPct.toFixed(0)}%</span>
                    <span>FP: {pair.fairPlay.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {suggestions.length > 0 && (
            <Button onClick={() => onApply(suggestions)}>
              Apply Lineup
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
