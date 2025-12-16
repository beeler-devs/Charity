'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Team, Match } from '@/types/database.types'
import { formatDate, formatTime } from '@/lib/utils'
import {
  Users,
  Calendar,
  ClipboardList,
  Upload,
  ChevronRight,
  Settings,
  ListChecks,
  MessageCircle
} from 'lucide-react'
import { ImportScheduleDialog } from '@/components/teams/import-schedule-dialog'

export default function TeamDetailPage() {
  const params = useParams()
  const teamId = params.id as string
  const [team, setTeam] = useState<Team | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [rosterCount, setRosterCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [teamConversationId, setTeamConversationId] = useState<string | null>(null)

  useEffect(() => {
    loadTeamData()
  }, [teamId])

  async function loadTeamData() {
    const supabase = createClient()

    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()

    if (teamData) {
      setTeam(teamData)
    }

    const today = new Date().toISOString().split('T')[0]
    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .eq('team_id', teamId)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(5)

    if (matchData) {
      setMatches(matchData)
    }

    const { count } = await supabase
      .from('roster_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('is_active', true)

    setRosterCount(count || 0)

    // Load or create team conversation
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('kind', 'team')
      .eq('team_id', teamId)
      .maybeSingle()

    if (existingConv) {
      setTeamConversationId(existingConv.id)
    } else {
      // Create conversation if it doesn't exist
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          kind: 'team',
          team_id: teamId,
        })
        .select('id')
        .single()

      if (newConv) {
        setTeamConversationId(newConv.id)
      }
    }

    setLoading(false)
  }

  if (loading || !team) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={team.name} />

      <main className="flex-1 p-4 space-y-4">
        {/* Team Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge>{team.league_format}</Badge>
                  {team.season && (
                    <span className="text-sm text-muted-foreground">{team.season}</span>
                  )}
                </div>
                {team.rating_limit && (
                  <p className="text-sm text-muted-foreground">
                    Rating Limit: {team.rating_limit}
                  </p>
                )}
              </div>
              <Link href={`/teams/${teamId}/settings`}>
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Link href={`/teams/${teamId}/roster`}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <Users className="h-6 w-6 mb-2 text-primary" />
                <span className="text-sm font-medium">Roster</span>
                <span className="text-xs text-muted-foreground">{rosterCount} players</span>
              </CardContent>
            </Card>
          </Link>
          {teamConversationId && (
            <Link href={`/messages/${teamConversationId}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <MessageCircle className="h-6 w-6 mb-2 text-primary" />
                  <span className="text-sm font-medium">Team Chat</span>
                  <span className="text-xs text-muted-foreground">Messages</span>
                </CardContent>
              </Card>
            </Link>
          )}
          <Card
            className="hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => setShowImportDialog(true)}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <Upload className="h-6 w-6 mb-2 text-primary" />
              <span className="text-sm font-medium">Import</span>
              <span className="text-xs text-muted-foreground">Schedule</span>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Matches */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Upcoming Matches
            </h2>
            <Link href={`/teams/${teamId}/matches`}>
              <Button variant="ghost" size="sm" className="text-xs">
                View All
              </Button>
            </Link>
          </div>

          {matches.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">No matches scheduled</p>
                <Button size="sm" onClick={() => setShowImportDialog(true)}>
                  Import Schedule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {matches.map((match) => (
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
                            {formatDate(match.date, 'MMM d')} at {formatTime(match.time)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/teams/${teamId}/matches/${match.id}/lineup`}>
                            <Button variant="ghost" size="sm" className="text-xs">
                              <ClipboardList className="h-4 w-4 mr-1" />
                              Lineup
                            </Button>
                          </Link>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Captain Tools */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Captain Tools
          </h2>
          <div className="grid gap-2">
            <Link href={`/teams/${teamId}/availability`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ListChecks className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">Availability Grid</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </main>

      <ImportScheduleDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        teamId={teamId}
        onImported={() => {
          setShowImportDialog(false)
          loadTeamData()
        }}
      />
    </div>
  )
}
