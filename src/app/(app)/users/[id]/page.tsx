'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { Profile, Team } from '@/types/database.types'
import { MessageCircle, Users, Mail, Phone } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sharedTeams, setSharedTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingDM, setCreatingDM] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [canMessage, setCanMessage] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadProfile()
  }, [userId])

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    setCurrentUserId(user.id)

    // Don't allow viewing your own profile this way
    if (user.id === userId) {
      router.push('/profile')
      return
    }

    // Load user profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!profileData) {
      toast({
        title: 'User not found',
        variant: 'destructive',
      })
      router.push('/messages')
      return
    }

    setProfile(profileData)

    // Find shared teams
    const { data: currentUserTeams } = await supabase
      .from('roster_members')
      .select('team_id, teams(*)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const { data: otherUserTeams } = await supabase
      .from('roster_members')
      .select('team_id')
      .eq('user_id', userId)
      .eq('is_active', true)

    const otherTeamIds = new Set(otherUserTeams?.map(t => t.team_id) || [])
    const shared = currentUserTeams
      ?.filter(t => otherTeamIds.has(t.team_id))
      .map(t => t.teams)
      .filter(Boolean) as Team[] || []

    setSharedTeams(shared)
    setCanMessage(shared.length > 0)
    setLoading(false)
  }

  async function startDM() {
    if (!canMessage || creatingDM) return

    setCreatingDM(true)
    const supabase = createClient()

    // Order users consistently (lower id first)
    const [user1, user2] = [currentUserId, userId].sort()

    // Check if DM conversation already exists
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('kind', 'dm')
      .eq('dm_user1', user1)
      .eq('dm_user2', user2)
      .maybeSingle()

    if (existingConv) {
      router.push(`/messages/${existingConv.id}`)
      return
    }

    // Create new DM conversation
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        kind: 'dm',
        dm_user1: user1,
        dm_user2: user2,
      })
      .select('id')
      .single()

    if (error) {
      toast({
        title: 'Failed to start conversation',
        description: error.message,
        variant: 'destructive',
      })
      setCreatingDM(false)
      return
    }

    router.push(`/messages/${newConv.id}`)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Profile" />

      <main className="flex-1 p-4 space-y-4">
        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20 mb-4">
                <AvatarFallback className="text-xl bg-primary/10 text-primary">
                  {getInitials(profile.full_name || profile.email || 'U')}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold mb-1">
                {profile.full_name || 'No name set'}
              </h2>
              {profile.ntrp_rating && (
                <Badge variant="secondary" className="mb-2">
                  NTRP {profile.ntrp_rating}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            {profile.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{profile.email}</span>
              </div>
            )}
            {profile.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{profile.phone}</span>
              </div>
            )}
            {!profile.email && !profile.phone && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No contact information available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Shared Teams */}
        {sharedTeams.length > 0 && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Shared Teams</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="space-y-2">
                {sharedTeams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-accent/50"
                  >
                    <Users className="h-4 w-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {team.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {team.league_format}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {canMessage ? (
            <Button
              className="w-full"
              onClick={startDM}
              disabled={creatingDM}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              {creatingDM ? 'Opening chat...' : 'Send Message'}
            </Button>
          ) : (
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  You can only message teammates. Join a team together to start messaging.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

