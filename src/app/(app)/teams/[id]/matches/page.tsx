'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { Match } from '@/types/database.types'
import { formatDate, formatTime } from '@/lib/utils'
import { MatchResultBadge } from '@/components/matches/match-result-badge'
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

    // Get current user info
    const { data: { user } } = await supabase.auth.getUser()
    console.log('=== MATCHES DEBUG ===')
    console.log('1. Current user:', user?.id)
    console.log('2. Loading matches for team:', teamId)

    // Check roster membership for this team
    const { data: rosterCheck } = await supabase
      .from('roster_members')
      .select('*')
      .eq('user_id', user?.id)
      .eq('team_id', teamId)
    console.log('3. Roster membership for this team:', rosterCheck)

    // Check all roster memberships
    const { data: allRoster } = await supabase
      .from('roster_members')
      .select('team_id, role')
      .eq('user_id', user?.id)
    console.log('4. All your roster memberships:', allRoster)

    // Try to load matches
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('team_id', teamId)
      .order('date', { ascending: true })

    console.log('5. Matches query result:', { data, error, count: data?.length })

    // Try loading ALL matches you can see (without team filter)
    const { data: allYourMatches } = await supabase
      .from('matches')
      .select('team_id, opponent_name, date')
      .limit(20)
    console.log('6. ALL matches you can see (any team):', allYourMatches)

    if (error) {
      console.error('Error loading matches:', error)
    }

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

      <main className="flex-1 p-4">
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingMatches.length})
            </TabsTrigger>
            <TabsTrigger value="past">
              Past ({pastMatches.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-2">
            {upcomingMatches.length > 0 ? (
              upcomingMatches.map((match) => (
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
                          {match.venue && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {match.venue}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No upcoming matches</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-2">
            {pastMatches.length > 0 ? (
              pastMatches.map((match) => (
                <Link key={match.id} href={`/teams/${teamId}/matches/${match.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              vs {match.opponent_name}
                            </span>
                            <MatchResultBadge
                              result={match.match_result as 'win' | 'loss' | 'tie' | 'pending'}
                              scoreSummary={match.score_summary || undefined}
                            />
                            <Badge variant={match.is_home ? 'default' : 'outline'} className="text-xs">
                              {match.is_home ? 'Home' : 'Away'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(match.date, 'MMM d, yyyy')}
                          </p>
                          {match.venue && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {match.venue}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No past matches</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
