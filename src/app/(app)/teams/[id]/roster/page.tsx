'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { RosterMember } from '@/types/database.types'
import { Plus, Upload, MoreVertical, Crown, MessageCircle, User } from 'lucide-react'
import { AddPlayerDialog } from '@/components/teams/add-player-dialog'

export default function RosterPage() {
  const params = useParams()
  const teamId = params.id as string
  const [roster, setRoster] = useState<RosterMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)

  useEffect(() => {
    loadRoster()
  }, [teamId])

  async function loadRoster() {
    const supabase = createClient()

    const { data } = await supabase
      .from('roster_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('role', { ascending: true })
      .order('full_name', { ascending: true })

    if (data) {
      setRoster(data)
    }
    setLoading(false)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'captain':
        return <Badge variant="default" className="text-xs"><Crown className="h-3 w-3 mr-1" />Captain</Badge>
      case 'co-captain':
        return <Badge variant="secondary" className="text-xs">Co-Captain</Badge>
      default:
        return null
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
      <Header title="Roster" />

      <main className="flex-1 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{roster.length} Players</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {roster.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">No players on roster</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Player
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {roster.map((player) => (
              <Card key={player.id}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {player.user_id ? (
                      <Link href={`/users/${player.user_id}`}>
                        <Avatar className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(player.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                    ) : (
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                          {getInitials(player.full_name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {player.user_id ? (
                          <Link href={`/users/${player.user_id}`} className="hover:underline">
                            <span className="font-medium truncate">{player.full_name}</span>
                          </Link>
                        ) : (
                          <span className="font-medium truncate">{player.full_name}</span>
                        )}
                        {getRoleBadge(player.role)}
                        {!player.user_id && (
                          <Badge variant="outline" className="text-xs">Not on app</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {player.ntrp_rating && (
                          <span>NTRP: {player.ntrp_rating}</span>
                        )}
                        {player.email && (
                          <span className="truncate">{player.email}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {player.user_id && (
                        <Link href={`/users/${player.user_id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <User className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      <div className="text-right px-2">
                        <p className="text-xs text-muted-foreground">Fair Play</p>
                        <p className="text-sm font-medium">{player.fair_play_score}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <AddPlayerDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        teamId={teamId}
        onAdded={() => {
          setShowAddDialog(false)
          loadRoster()
        }}
      />
    </div>
  )
}
