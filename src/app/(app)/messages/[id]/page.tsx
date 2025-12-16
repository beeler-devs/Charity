'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database.types'
import { formatDate, formatTime } from '@/lib/utils'
import { Send, Users } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  body: string
  created_at: string
}

interface MessageWithSender extends Message {
  sender?: Profile
}

interface Conversation {
  id: string
  kind: 'team' | 'dm'
  team_id?: string
  dm_user1?: string
  dm_user2?: string
  last_message_at?: string
  last_message_preview?: string
}

export default function ConversationPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [messageBody, setMessageBody] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [conversationTitle, setConversationTitle] = useState('Chat')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadConversation()
  }, [conversationId])

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
      markAsRead()
    }
  }, [messages])

  async function loadConversation() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    setCurrentUserId(user.id)

    // Load conversation
    const { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (!conv) {
      toast({
        title: 'Conversation not found',
        variant: 'destructive',
      })
      router.push('/messages')
      return
    }

    setConversation(conv)

    // Set title based on conversation type
    if (conv.kind === 'team') {
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', conv.team_id)
        .single()

      setConversationTitle(team?.name || 'Team Chat')
    } else if (conv.kind === 'dm') {
      const otherUserId = conv.dm_user1 === user.id ? conv.dm_user2 : conv.dm_user1
      const { data: otherUser } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', otherUserId)
        .single()

      setConversationTitle(otherUser?.full_name || otherUser?.email || 'Direct Message')
    }

    // Load messages
    await loadMessages()

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message

          // Load sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMessage.sender_id)
            .maybeSingle()

          setMessages(prev => [...prev, { ...newMessage, sender: sender || undefined }])
        }
      )
      .subscribe()

    setLoading(false)

    return () => {
      supabase.removeChannel(channel)
    }
  }

  async function loadMessages() {
    const supabase = createClient()

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (msgs) {
      // Load sender profiles
      const senderIds = [...new Set(msgs.map(m => m.sender_id).filter(Boolean))] as string[]
      const { data: senders } = await supabase
        .from('profiles')
        .select('*')
        .in('id', senderIds)

      const sendersMap = new Map(senders?.map(s => [s.id, s]) || [])

      const messagesWithSenders = msgs.map(msg => ({
        ...msg,
        sender: msg.sender_id ? sendersMap.get(msg.sender_id) : undefined,
      }))

      setMessages(messagesWithSenders)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()

    if (!messageBody.trim() || sending) return

    setSending(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        body: messageBody.trim(),
      })

    if (error) {
      toast({
        title: 'Failed to send message',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      setMessageBody('')
    }

    setSending(false)
  }

  async function markAsRead() {
    const supabase = createClient()

    await supabase
      .from('conversation_reads')
      .upsert({
        conversation_id: conversationId,
        user_id: currentUserId,
        last_read_at: new Date().toISOString(),
      })
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const getInitials = (name?: string) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const groupMessagesByDate = (messages: MessageWithSender[]) => {
    const groups: { [key: string]: MessageWithSender[] } = {}

    messages.forEach(msg => {
      const date = formatDate(msg.created_at, 'MMM d, yyyy')
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(msg)
    })

    return groups
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const messageGroups = groupMessagesByDate(messages)

  return (
    <div className="flex flex-col h-screen">
      <Header title={conversationTitle} />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {Object.keys(messageGroups).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="bg-primary/10 rounded-full p-4 mb-4">
              {conversation?.kind === 'team' ? (
                <Users className="h-8 w-8 text-primary" />
              ) : (
                <Send className="h-8 w-8 text-primary" />
              )}
            </div>
            <h3 className="font-semibold mb-2">No messages yet</h3>
            <p className="text-sm text-muted-foreground">
              Start the conversation by sending a message below
            </p>
          </div>
        ) : (
          Object.entries(messageGroups).map(([date, msgs]) => (
            <div key={date} className="space-y-3">
              <div className="flex justify-center">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {date}
                </span>
              </div>
              {msgs.map((msg, idx) => {
                const isCurrentUser = msg.sender_id === currentUserId
                const showAvatar = !isCurrentUser && (
                  idx === 0 || 
                  msgs[idx - 1]?.sender_id !== msg.sender_id
                )

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isCurrentUser && (
                      <div className="flex-shrink-0">
                        {showAvatar ? (
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(msg.sender?.full_name || msg.sender?.email)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-8" />
                        )}
                      </div>
                    )}
                    <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
                      {showAvatar && !isCurrentUser && (
                        <span className="text-xs text-muted-foreground mb-1 px-3">
                          {msg.sender?.full_name || msg.sender?.email || 'Unknown'}
                        </span>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2 ${
                          isCurrentUser
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 px-3">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="fixed bottom-16 left-0 right-0 border-t bg-background p-4">
        <form onSubmit={sendMessage} className="flex gap-2">
          <Input
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={sending || !messageBody.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

