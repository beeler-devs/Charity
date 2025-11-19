'use client'

import { useState, useRef, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User, Loader2, BookOpen } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const quickRules = [
  'What is a let serve?',
  'Foot fault rules',
  'Tie-break scoring',
  'Time between points',
  'Code violation penalties',
]

export default function RulesPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm the Rules Guru. Ask me any tennis rules question about USTA regulations, Friend at Court 2025, or SACT CUP Bylaws. I'm here to help!",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function sendMessage(text?: string) {
    const messageText = text || input
    if (!messageText.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/rules-guru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      })

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Sorry, I could not process that question. Please try again.',
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, there was an error processing your question. Please try again.',
      }
      setMessages(prev => [...prev, errorMessage])
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Rules Guru" showNotifications={false} />

      <main className="flex-1 flex flex-col p-4">
        {/* Quick Rules */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Quick Rules</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickRules.map((rule) => (
              <Button
                key={rule}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => sendMessage(rule)}
                disabled={loading}
              >
                {rule}
              </Button>
            ))}
          </div>
        </div>

        {/* Chat Messages */}
        <Card className="flex-1 mb-4">
          <ScrollArea className="h-[400px] p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`rounded-lg px-3 py-2 max-w-[80%] ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Ask a tennis rules question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            disabled={loading}
          />
          <Button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  )
}
