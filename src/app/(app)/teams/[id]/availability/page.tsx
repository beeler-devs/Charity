'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { RosterMember, Match, Availability } from '@/types/database.types'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Check, X, HelpCircle, Clock } from 'lucide-react'

interface AvailabilityGrid {
  players: RosterMember[]
  matches: Match[]
  availability: Record<string, Record<string, Availability>>
}

export default function AvailabilityPage() {
  const params = useParams()
  const teamId = params.id as string
  const [data, setData] = useState<AvailabilityGrid>({
    players: [],
    matches: [],
    availability: {},
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAvailabilityData()
  }, [teamId])

  async function loadAvailabilityData() {
    const supabase = createClient()

    // Load roster
    const { data: players } = await supabase
      .from('roster_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('full_name')

    // Load upcoming matches
    const today = new Date().toISOString().split('T')[0]
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('team_id', teamId)
      .gte('date', today)
      .order('date')
      .limit(10)

    if (!players || !matches) {
      setLoading(false)
      return
    }

    // Load availability for all combinations
    const matchIds = matches.map(m => m.id)
    const playerIds = players.map(p => p.id)

    const { data: availabilityData } = await supabase
      .from('availability')
      .select('*')
      .in('match_id', matchIds)
      .in('roster_member_id', playerIds)

    // Build availability lookup
    const availability: Record<string, Record<string, Availability>> = {}
    availabilityData?.forEach(a => {
      if (!availability[a.roster_member_id]) {
        availability[a.roster_member_id] = {}
      }
      availability[a.roster_member_id][a.match_id] = a
    })

    setData({ players, matches, availability })
    setLoading(false)
  }

  async function updateAvailability(
    playerId: string,
    matchId: string,
    status: 'available' | 'unavailable' | 'maybe' | 'late'
  ) {
    const supabase = createClient()

    const existing = data.availability[playerId]?.[matchId]

    if (existing) {
      await supabase
        .from('availability')
        .update({ status })
        .eq('id', existing.id)
    } else {
      await supabase.from('availability').insert({
        roster_member_id: playerId,
        match_id: matchId,
        status,
      })
    }

    loadAvailabilityData()
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'available':
        return <Check className="h-4 w-4 text-green-500" />
      case 'unavailable':
        return <X className="h-4 w-4 text-red-500" />
      case 'maybe':
        return <HelpCircle className="h-4 w-4 text-yellow-500" />
      case 'late':
        return <Clock className="h-4 w-4 text-orange-500" />
      default:
        return <span className="h-4 w-4 text-gray-300">-</span>
    }
  }

  const getStatusBg = (status?: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 hover:bg-green-200'
      case 'unavailable':
        return 'bg-red-100 hover:bg-red-200'
      case 'maybe':
        return 'bg-yellow-100 hover:bg-yellow-200'
      case 'late':
        return 'bg-orange-100 hover:bg-orange-200'
      default:
        return 'bg-gray-50 hover:bg-gray-100'
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
      <Header title="Availability" />

      <main className="flex-1 p-4">
        {data.matches.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No upcoming matches</p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto availability-grid">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-background p-2 text-left text-sm font-medium min-w-[120px]">
                    Player
                  </th>
                  {data.matches.map(match => (
                    <th key={match.id} className="p-2 text-center min-w-[80px]">
                      <div className="text-xs font-medium">
                        {formatDate(match.date, 'MMM d')}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {match.opponent_name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.players.map(player => (
                  <tr key={player.id} className="border-t">
                    <td className="sticky left-0 bg-background p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {player.full_name.split(' ')[0]}
                        </span>
                        {player.ntrp_rating && (
                          <Badge variant="outline" className="text-xs">
                            {player.ntrp_rating}
                          </Badge>
                        )}
                      </div>
                    </td>
                    {data.matches.map(match => {
                      const avail = data.availability[player.id]?.[match.id]
                      return (
                        <td key={match.id} className="p-1">
                          <div className="flex justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                'h-10 w-10 p-0 rounded-lg',
                                getStatusBg(avail?.status)
                              )}
                              onClick={() => {
                                const statuses: Array<'available' | 'unavailable' | 'maybe' | 'late'> =
                                  ['available', 'unavailable', 'maybe', 'late']
                                const currentIdx = statuses.indexOf(avail?.status as 'available' | 'unavailable' | 'maybe' | 'late')
                                const nextStatus = statuses[(currentIdx + 1) % statuses.length]
                                updateAvailability(player.id, match.id, nextStatus)
                              }}
                            >
                              {getStatusIcon(avail?.status)}
                            </Button>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <Card className="mt-4">
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1">
                <Check className="h-3 w-3 text-green-500" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1">
                <X className="h-3 w-3 text-red-500" />
                <span>Unavailable</span>
              </div>
              <div className="flex items-center gap-1">
                <HelpCircle className="h-3 w-3 text-yellow-500" />
                <span>Maybe</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-orange-500" />
                <span>Late</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
