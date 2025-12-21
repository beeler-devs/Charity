'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, MessageCircle, Users, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { useIsSystemAdmin } from '@/hooks/use-is-system-admin'

interface HeaderProps {
  title: string
  showNotifications?: boolean
}

interface RecentConversation {
  conversation_id: string
  conversation_kind: 'team' | 'dm'
  conversation_title: string
  last_message: string
  last_message_time: string
  sender_name: string
  sender_initials: string
  unread?: boolean
}

export function Header({ title, showNotifications = true }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const [conversations, setConversations] = useState<RecentConversation[]>([])
  const [hasUnread, setHasUnread] = useState(false)
  const [loading, setLoading] = useState(false)
  const openRef = useRef(false)
  const router = useRouter()
  const { isAdmin } = useIsSystemAdmin()

  // Keep ref in sync with state
  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    if (open && conversations.length === 0) {
      loadRecentMessages()
    }
  }, [open])

  useEffect(() => {
    // Check for unread messages periodically
    checkUnreadMessages()
    const interval = setInterval(checkUnreadMessages, 30000) // Check every 30s
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Subscribe to new messages in realtime
    const supabase = createClient()
    
    const channel = supabase
      .channel('notifications-header')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new as any
          
          // Get current user to check if this message is relevant
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          
          // Check if message is from current user (skip own messages for notification)
          if (newMessage.sender_id === user.id) return
          
          // Always update unread indicator
          checkUnreadMessages()
          
          // If dropdown is open, reload messages to show new one
          if (openRef.current) {
            loadRecentMessages()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function checkUnreadMessages() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get user's teams from roster_members
    const { data: rosterTeams, error: rosterError } = await supabase
      .from('roster_members')
      .select('team_id')
      .eq('user_id', user.id)

    if (rosterError) {
      console.error('Error loading roster teams for unread check:', rosterError)
    }

    // Get teams where user is captain or co-captain
    const { data: captainTeams, error: captainError } = await supabase
      .from('teams')
      .select('id')
      .or(`captain_id.eq.${user.id},co_captain_id.eq.${user.id}`)

    if (captainError) {
      console.error('Error loading captain teams for unread check:', captainError)
    }

    // Combine and deduplicate team IDs
    const rosterTeamIds = rosterTeams?.map(t => t.team_id) || []
    const captainTeamIds = captainTeams?.map(t => t.id) || []
    const teamIds = [...new Set([...rosterTeamIds, ...captainTeamIds])]

    // Build the OR filter
    let conversationFilter = `dm_user1.eq.${user.id},dm_user2.eq.${user.id}`
    if (teamIds.length > 0) {
      conversationFilter = `team_id.in.(${teamIds.join(',')}),${conversationFilter}`
    }

    // Get user's conversations
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, last_message_at')
      .or(conversationFilter)
      .not('last_message_at', 'is', null)

    if (!conversations || conversations.length === 0) {
      setHasUnread(false)
      return
    }

    // Get read status
    const { data: reads } = await supabase
      .from('conversation_reads')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id)

    const readMap = new Map(reads?.map(r => [r.conversation_id, r.last_read_at]) || [])
    
    // Check if any conversation has messages newer than last read
    const unread = conversations.some(conv => {
      const lastRead = readMap.get(conv.id) || '1970-01-01'
      return conv.last_message_at && conv.last_message_at > lastRead
    })

    setHasUnread(unread)
  }

  async function loadRecentMessages() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setLoading(false)
      return
    }

    // Get user's teams from roster_members
    const { data: rosterTeams, error: rosterError } = await supabase
      .from('roster_members')
      .select('team_id')
      .eq('user_id', user.id)

    if (rosterError) {
      console.error('Error loading roster teams:', rosterError)
    }

    // Get teams where user is captain or co-captain
    const { data: captainTeams, error: captainError } = await supabase
      .from('teams')
      .select('id')
      .or(`captain_id.eq.${user.id},co_captain_id.eq.${user.id}`)

    if (captainError) {
      console.error('Error loading captain teams:', captainError)
    }

    // Combine and deduplicate team IDs
    const rosterTeamIds = rosterTeams?.map(t => t.team_id) || []
    const captainTeamIds = captainTeams?.map(t => t.id) || []
    const teamIds = [...new Set([...rosterTeamIds, ...captainTeamIds])]

    // Build the OR filter for conversations
    let conversationFilter = `dm_user1.eq.${user.id},dm_user2.eq.${user.id}`
    if (teamIds.length > 0) {
      conversationFilter = `team_id.in.(${teamIds.join(',')}),${conversationFilter}`
    }

    // Get user's conversations with last message info
    const { data: userConversations, error: convError } = await supabase
      .from('conversations')
      .select('id, kind, team_id, dm_user1, dm_user2, last_message_at, teams(name)')
      .or(conversationFilter)
      .not('last_message_at', 'is', null)
      .order('last_message_at', { ascending: false })
      .limit(10)

    if (convError) {
      console.error('Error loading conversations:', convError)
    }

    if (!userConversations || userConversations.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    // Get read status for unread indicator
    const { data: reads } = await supabase
      .from('conversation_reads')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id)

    const readMap = new Map(reads?.map(r => [r.conversation_id, r.last_read_at]) || [])

    // For each conversation, get the most recent message
    const conversationPromises = userConversations.map(async (conv) => {
      // Get the most recent message
      const { data: lastMessage } = await supabase
        .from('messages')
        .select(`
          body,
          created_at,
          sender_id,
          sender:profiles!messages_sender_id_fkey(full_name, email)
        `)
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!lastMessage) return null

      const sender = lastMessage.sender as any
      const senderName = sender?.full_name || sender?.email || 'Unknown'
      const initials = senderName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

      // Determine conversation title
      let conversationTitle = ''
      if (conv.kind === 'team') {
        conversationTitle = (conv as any).teams?.name || 'Team Chat'
      } else {
        // For DM, get the other user's name
        const otherUserId = conv.dm_user1 === user.id ? conv.dm_user2 : conv.dm_user1
        const { data: otherUser } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', otherUserId)
          .single()
        
        conversationTitle = otherUser?.full_name || otherUser?.email || 'Direct Message'
      }

      // Check if unread
      const lastRead = readMap.get(conv.id) || '1970-01-01'
      const isUnread = conv.last_message_at && conv.last_message_at > lastRead

      return {
        conversation_id: conv.id,
        conversation_kind: conv.kind,
        conversation_title: conversationTitle,
        last_message: lastMessage.body,
        last_message_time: lastMessage.created_at,
        sender_name: senderName,
        sender_initials: initials,
        unread: isUnread
      }
    })

    const processedConversations = (await Promise.all(conversationPromises)).filter(Boolean) as RecentConversation[]

    setConversations(processedConversations)
    setLoading(false)
  }

  function handleConversationClick(conversationId: string) {
    setOpen(false)
    router.push(`/messages/${conversationId}`)
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-top">
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link href="/admin">
              <Button variant="ghost" size="icon" title="System Admin">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          )}
          {showNotifications && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {hasUnread && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between border-b p-3">
                <h3 className="font-semibold text-sm">Recent Messages</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-xs"
                  onClick={() => {
                    setOpen(false)
                    router.push('/messages')
                  }}
                >
                  View All
                </Button>
              </div>
              <ScrollArea className="h-[400px]">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <MessageCircle className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No recent messages</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {conversations.map((conv) => (
                      <div
                        key={conv.conversation_id}
                        className="p-3 hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => handleConversationClick(conv.conversation_id)}
                      >
                        <div className="flex gap-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {conv.conversation_kind === 'team' ? (
                                <Users className="h-5 w-5" />
                              ) : (
                                conv.sender_initials
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2 mb-1">
                              <p className={`text-sm truncate ${conv.unread ? 'font-semibold' : 'font-medium'}`}>
                                {conv.conversation_title}
                              </p>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatDistanceToNow(new Date(conv.last_message_time), { addSuffix: true })}
                              </span>
                            </div>
                            <p className={`text-sm line-clamp-2 ${conv.unread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                              <span className="text-muted-foreground font-normal">{conv.sender_name}: </span>
                              {conv.last_message}
                            </p>
                          </div>
                          {conv.unread && (
                            <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
          )}
        </div>
      </div>
    </header>
  )
}
