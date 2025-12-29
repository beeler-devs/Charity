'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { RosterMember } from '@/types/database.types'
import { 
  Plus, 
  Upload, 
  MoreVertical, 
  Crown, 
  MessageCircle, 
  User, 
  Edit, 
  Trash2, 
  Phone, 
  ArrowLeft,
  UserPlus
} from 'lucide-react'
import { AddPlayerDialog } from '@/components/teams/add-player-dialog'
import { ImportPlayersDialog } from '@/components/teams/import-players-dialog'
import { EditPlayerDialog } from '@/components/teams/edit-player-dialog'
import { InvitePlayerDialog } from '@/components/teams/invite-player-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useIsCaptain, triggerRosterChange } from '@/hooks/use-is-captain'

export default function RosterPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
  const [roster, setRoster] = useState<RosterMember[]>([])
  const [loading, setLoading] = useState(true)
  const { isCaptain } = useIsCaptain(teamId)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<RosterMember | null>(null)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [playerToDelete, setPlayerToDelete] = useState<RosterMember | null>(null)
  const [teamName, setTeamName] = useState<string>('')
  const { toast } = useToast()

  useEffect(() => {
    loadRoster()
  }, [teamId])

async function loadRoster() {
    const supabase = createClient()

    // Load team name
    const { data: teamData } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()
    
    if (teamData) {
      setTeamName(teamData.name)
    }

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


  async function handleDeletePlayer() {
    if (!playerToDelete) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in',
        variant: 'destructive',
      })
      return
    }

    // Verify user is captain
    const { data: teamData } = await supabase
      .from('teams')
      .select('captain_id, co_captain_id')
      .eq('id', teamId)
      .single()

    if (!teamData || (teamData.captain_id !== user.id && teamData.co_captain_id !== user.id)) {
      toast({
        title: 'Permission denied',
        description: 'Only team captains can remove players',
        variant: 'destructive',
      })
      setShowDeleteAlert(false)
      setPlayerToDelete(null)
      return
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('roster_members')
      .update({ is_active: false })
      .eq('id', playerToDelete.id)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Player removed',
        description: `${playerToDelete.full_name} has been removed from the roster`,
      })
      loadRoster()
      // Trigger roster change event to refresh captain status on other pages
      triggerRosterChange(teamId)
    }

    setShowDeleteAlert(false)
    setPlayerToDelete(null)
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
        {/* Back Button */}
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" onClick={() => router.back()} size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{roster.length} Players</h2>
          {isCaptain && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowInviteDialog(true)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Invite to Join
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-1" />
                Import CSV
              </Button>
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          )}
        </div>

        {roster.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">No players on roster</p>
              {isCaptain && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Player
                </Button>
              )}
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
                        {player.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {player.phone}
                          </span>
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
                      {isCaptain && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingPlayer(player)
                              setShowEditDialog(true)
                            }}
                            title="Edit player"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setPlayerToDelete(player)
                              setShowDeleteAlert(true)
                            }}
                            title="Remove player"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
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
          // Trigger roster change event to refresh captain status on other pages
          triggerRosterChange(teamId)
        }}
      />

      <ImportPlayersDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        teamId={teamId}
        onImported={() => {
          setShowImportDialog(false)
          loadRoster()
          // Trigger roster change event to refresh captain status on other pages
          triggerRosterChange(teamId)
        }}
      />

      <EditPlayerDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        teamId={teamId}
        player={editingPlayer}
        onUpdated={() => {
          setShowEditDialog(false)
          setEditingPlayer(null)
          loadRoster()
          // Trigger roster change event to refresh captain status on other pages
          triggerRosterChange(teamId)
        }}
      />

      <InvitePlayerDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        teamId={teamId}
        teamName={teamName}
        onInvited={() => {
          loadRoster()
          // Trigger roster change event to refresh captain status on other pages
          triggerRosterChange(teamId)
        }}
      />

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Player from Roster?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{playerToDelete?.full_name}</strong> from the roster?
              This action cannot be undone, but you can add them back later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPlayerToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlayer}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remove Player
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
