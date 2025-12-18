'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

interface StatisticsCardProps {
  overallStats: {
    matchesPlayed: number
    matchesWon: number
    matchesLost: number
    setsWon: number
    setsLost: number
    gamesWon: number
    gamesLost: number
    winPercentage: number
  }
  teamStats: TeamStatistics[]
}

export function StatisticsCard({ overallStats, teamStats }: StatisticsCardProps) {
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())

  const toggleTeam = (teamId: string) => {
    setExpandedTeams((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(teamId)) {
        newSet.delete(teamId)
      } else {
        newSet.add(teamId)
      }
      return newSet
    })
  }

  const formatPercentage = (value: number) => {
    return value.toFixed(1)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Your Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Statistics */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
            Overall
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {overallStats.matchesWon}-{overallStats.matchesLost}
              </p>
              <p className="text-xs text-muted-foreground">Record</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {formatPercentage(overallStats.winPercentage)}%
              </p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {overallStats.setsWon}-{overallStats.setsLost}
              </p>
              <p className="text-xs text-muted-foreground">Sets</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {overallStats.gamesWon}-{overallStats.gamesLost}
              </p>
              <p className="text-xs text-muted-foreground">Games</p>
            </div>
          </div>
        </div>

        {/* Per-Team Statistics */}
        {teamStats.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
              By Team
            </h3>
            <div className="space-y-2">
              {teamStats.map((team) => {
                const isExpanded = expandedTeams.has(team.teamId)
                return (
                  <div
                    key={team.teamId}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* Team Header */}
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-3 h-auto hover:bg-accent/50"
                      onClick={() => toggleTeam(team.teamId)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-left">
                          {team.teamName}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {team.matchesWon}-{team.matchesLost}
                        </Badge>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>

                    {/* Expanded Team Details */}
                    {isExpanded && (
                      <div className="p-3 border-t bg-accent/10">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="font-semibold">
                              {formatPercentage(team.winPercentage)}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Win Rate
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold">{team.matchesPlayed}</p>
                            <p className="text-xs text-muted-foreground">
                              Matches
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold">
                              {team.setsWon}-{team.setsLost}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Sets
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold">
                              {team.gamesWon}-{team.gamesLost}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Games
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

