'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import { MatchResultBadge } from '@/components/matches/match-result-badge'
import { formatDate } from '@/lib/utils'
import { formatScoreDisplay } from '@/lib/score-utils'

interface MatchScore {
  id: string
  home_games: number
  away_games: number
  is_tiebreak: boolean
}

interface MatchListItemProps {
  matchId: string
  teamId: string
  date: string
  teamName: string
  opponentName: string
  matchResult: 'win' | 'loss' | 'tie' | null
  courtSlot: number
  partnerName: string | null
  scores: MatchScore[]
}

export function MatchListItem({
  matchId,
  teamId,
  date,
  teamName,
  opponentName,
  matchResult,
  courtSlot,
  partnerName,
  scores,
}: MatchListItemProps) {
  const hasScores = scores && scores.length > 0
  const scoreDisplay = hasScores ? formatScoreDisplay(scores) : null

  return (
    <Link href={`/teams/${teamId}/matches/${matchId}`}>
      <Card className="p-4 hover:bg-accent/50 transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Date and Team */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-medium">{formatDate(date)}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{teamName}</span>
            </div>

            {/* Opponent */}
            <div className="text-base font-semibold mb-2">
              vs {opponentName}
            </div>

            {/* Result and Score */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {matchResult ? (
                <MatchResultBadge result={matchResult} />
              ) : (
                <Badge variant="outline" className="text-xs">
                  No Score
                </Badge>
              )}
              {scoreDisplay && (
                <span className="text-sm text-muted-foreground">
                  {scoreDisplay}
                </span>
              )}
            </div>

            {/* Partner and Court */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>Court {courtSlot}</span>
              {partnerName && (
                <>
                  <span>•</span>
                  <span>w/ {partnerName}</span>
                </>
              )}
            </div>
          </div>

          {/* Arrow */}
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
        </div>
      </Card>
    </Link>
  )
}

