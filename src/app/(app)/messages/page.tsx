'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { Team, Profile } from '@/types/database.types'
import { formatDate, formatTime } from '@/lib/utils'
import { Users, MessageCircle, ChevronRight } from 'lucide-react'

interface Conversation {
  id: string
  kind: 'team' | 'dm'
  team_id?: string
  dm_user1?: string
  dm_user2?: string
  last_message_at?: string
  last_message_preview?: string
  created_at: string
}

interface TeamConversation extends Conversation {
  team?: Team
  has_unread?: boolean
}

interface DMConversation extends Conversation {
  other_user?: Profile
  has_unread?: boolean
}

export default function MessagesPage() {
  const [teamConversations, setTeamConversations] = useState<TeamConversation[]>([])
  const [dmConversations, setDMConversations] = useState<DMConversation[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadConversations()
  }, [])

  async function loadConversations() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    // Get teams the user belongs to
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

    // Get or create team conversations
    const teamConvs: TeamConversation[] = []
    for (const team of uniqueTeams) {
      // Check if conversation exists
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('*')
        .eq('kind', 'team')
        .eq('team_id', team.id)
        .maybeSingle()

      let conversation = existingConv

      // Create if doesn't exist
      if (!conversation) {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            kind: 'team',
            team_id: team.id,
          })
          .select()
          .single()

        conversation = newConv
      }

      if (conversation) {
        // Check for unread
        const { data: readStatus } = await supabase
          .from('conversation_reads')
          .select('last_read_at')
          .eq('conversation_id', conversation.id)
          .eq('user_id', user.id)
          .maybeSingle()

        const hasUnread = conversation.last_message_at && (
          !readStatus || 
          new Date(conversation.last_message_at) > new Date(readStatus.last_read_at)
        )

        teamConvs.push({
          ...conversation,
          team,
          has_unread: hasUnread,
        })
      }
    }

    setTeamConversations(teamConvs.sort((a, b) => {
      if (!a.last_message_at) return 1
      if (!b.last_message_at) return -1
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    }))

    // Get DM conversations
    const { data: dmConvs } = await supabase
      .from('conversations')
      .select('*')
      .eq('kind', 'dm')
      .or(`dm_user1.eq.${user.id},dm_user2.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    // Resolve other user profiles
    const dmConvsWithProfiles: DMConversation[] = []
    for (const conv of dmConvs || []) {
      const otherUserId = conv.dm_user1 === user.id ? conv.dm_user2 : conv.dm_user1

      const { data: otherUser } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherUserId)
        .maybeSingle()

      // Check for unread
      const { data: readStatus } = await supabase
        .from('conversation_reads')
        .select('last_read_at')
        .eq('conversation_id', conv.id)
        .eq('user_id', user.id)
        .maybeSingle()

      const hasUnread = conv.last_message_at && (
        !readStatus || 
        new Date(conv.last_message_at) > new Date(readStatus.last_read_at)
      )

      if (otherUser) {
        dmConvsWithProfiles.push({
          ...conv,
          other_user: otherUser,
          has_unread: hasUnread,
        })
      }
    }

    setDMConversations(dmConvsWithProfiles)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Messages" />

      <main className="flex-1 p-4 space-y-6">
        {/* Team Chats */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Team Chats
          </h2>
          {teamConversations.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No team chats yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {teamConversations.map((conv) => (
                <Link key={conv.id} href={`/messages/${conv.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              <Users className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          {conv.has_unread && (
                            <div className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{conv.team?.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {conv.team?.league_format}
                            </Badge>
                          </div>
                          {conv.last_message_preview && (
                            <p className="text-sm text-muted-foreground truncate">
                              {conv.last_message_preview}
                            </p>
                          )}
                          {conv.last_message_at && (
                            <p className="text-xs text-muted-foreground">
                              {formatDate(conv.last_message_at, 'MMM d')} at {formatTime(conv.last_message_at)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Direct Messages */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Direct Messages
          </h2>
          {dmConversations.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No direct messages yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Visit a teammate's profile to start a conversation
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {dmConversations.map((conv) => (
                <Link key={conv.id} href={`/messages/${conv.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(conv.other_user?.full_name || conv.other_user?.email || 'U')}
                            </AvatarFallback>
                          </Avatar>
                          {conv.has_unread && (
                            <div className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium block truncate">
                            {conv.other_user?.full_name || conv.other_user?.email}
                          </span>
                          {conv.last_message_preview && (
                            <p className="text-sm text-muted-foreground truncate">
                              {conv.last_message_preview}
                            </p>
                          )}
                          {conv.last_message_at && (
                            <p className="text-xs text-muted-foreground">
                              {formatDate(conv.last_message_at, 'MMM d')} at {formatTime(conv.last_message_at)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

