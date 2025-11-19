'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Team } from '@/types/database.types'
import { Plus, Users, Calendar, ChevronRight } from 'lucide-react'
import { CreateTeamDialog } from '@/components/teams/create-team-dialog'

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  useEffect(() => {
    loadTeams()
  }, [])

  async function loadTeams() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    // Get teams where user is captain or roster member
    const { data: captainTeams } = await supabase
      .from('teams')
      .select('*')
      .or(`captain_id.eq.${user.id},co_captain_id.eq.${user.id}`)

    const { data: memberTeams } = await supabase
      .from('roster_members')
      .select('teams(*)')
      .eq('user_id', user.id)

    const allTeams = [
      ...(captainTeams || []),
      ...(memberTeams?.map(m => m.teams).filter(Boolean) as Team[] || [])
    ]

    // Remove duplicates
    const uniqueTeams = allTeams.filter((team, index, self) =>
      index === self.findIndex(t => t.id === team.id)
    )

    setTeams(uniqueTeams)
    setLoading(false)
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
      <Header title="Teams" />

      <main className="flex-1 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Teams</h2>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Team
          </Button>
        </div>

        {teams.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No teams yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a team to start managing your roster and matches
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => (
              <Link key={team.id} href={`/teams/${team.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-base">{team.name}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {team.league_format}
                          </Badge>
                        </div>
                        {team.season && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {team.season}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <CreateTeamDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={() => {
          setShowCreateDialog(false)
          loadTeams()
        }}
      />
    </div>
  )
}
