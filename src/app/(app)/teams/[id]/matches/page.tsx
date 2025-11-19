'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Match } from '@/types/database.types'
import { formatDate, formatTime } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

export default function MatchesPage() {
  const params = useParams()
  const teamId = params.id as string
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMatches()
  }, [teamId])

  async function loadMatches() {
    const supabase = createClient()

    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('team_id', teamId)
      .order('date', { ascending: true })

    if (data) {
      setMatches(data)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const upcomingMatches = matches.filter(m => m.date >= today)
  const pastMatches = matches.filter(m => m.date < today).reverse()

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="All Matches" />

      <main className="flex-1 p-4 space-y-4">
        {/* Upcoming */}
        {upcomingMatches.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Upcoming ({upcomingMatches.length})
            </h2>
            <div className="space-y-2">
              {upcomingMatches.map((match) => (
                <Link key={match.id} href={`/teams/${teamId}/matches/${match.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              vs {match.opponent_name}
                            </span>
                            <Badge variant={match.is_home ? 'default' : 'outline'} className="text-xs">
                              {match.is_home ? 'Home' : 'Away'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(match.date, 'MMM d, yyyy')} at {formatTime(match.time)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Past */}
        {pastMatches.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Past ({pastMatches.length})
            </h2>
            <div className="space-y-2">
              {pastMatches.map((match) => (
                <Link key={match.id} href={`/teams/${teamId}/matches/${match.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer opacity-60">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              vs {match.opponent_name}
                            </span>
                            {match.match_result !== 'pending' && (
                              <Badge
                                variant={match.match_result === 'win' ? 'success' : 'destructive'}
                                className="text-xs"
                              >
                                {match.match_result?.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(match.date, 'MMM d, yyyy')}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {matches.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No matches scheduled</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
