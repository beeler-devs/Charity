'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Save, ArrowLeft, Check, X, HelpCircle, Clock } from 'lucide-react'
import { formatTimeDisplay, calculateMatchAvailability } from '@/lib/availability-utils'
import { format } from 'date-fns'

interface Event {
  id: string
  event_name: string
  date: string
  time: string
  location: string | null
  description: string | null
  team_id: string
}

export default function EventAvailabilityPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const [event, setEvent] = useState<Event | null>(null)
  const [status, setStatus] = useState<'available' | 'unavailable' | 'maybe' | 'late'>('unavailable')
  const [autoCalculated, setAutoCalculated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadEventAvailability()
  }, [eventId])

  async function loadEventAvailability() {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // Load event details
    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (!eventData) {
      setLoading(false)
      return
    }

    setEvent(eventData)

    // Get roster member ID
    const { data: rosterMember } = await supabase
      .from('roster_members')
      .select('id')
      .eq('team_id', eventData.team_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!rosterMember) {
      setLoading(false)
      return
    }

    // Load event-specific availability if exists
    const { data: eventAvail } = await supabase
      .from('availability')
      .select('status')
      .eq('roster_member_id', rosterMember.id)
      .eq('event_id', eventId)
      .maybeSingle()

    if (eventAvail) {
      // User has already set event availability (or it was auto-initialized)
      setStatus(eventAvail.status as 'available' | 'unavailable' | 'maybe' | 'late')
      setAutoCalculated(false)
    } else {
      // Fallback: Auto-calculate from defaults if availability wasn't initialized
      const { data: profile } = await supabase
        .from('profiles')
        .select('availability_defaults')
        .eq('id', user.id)
        .single()

      const calculatedStatus = calculateMatchAvailability(
        eventData.date,
        eventData.time,
        profile?.availability_defaults as Record<string, string[]> | null | undefined
      )
      setStatus(calculatedStatus)
      setAutoCalculated(true)
    }

    setLoading(false)
  }

  async function saveAvailability() {
    if (!event) return
    
    setSaving(true)
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in',
        variant: 'destructive',
      })
      setSaving(false)
      return
    }

    // Get roster member ID
    const { data: rosterMember } = await supabase
      .from('roster_members')
      .select('id')
      .eq('team_id', event.team_id)
      .eq('user_id', user.id)
      .single()

    if (!rosterMember) {
      toast({
        title: 'Error',
        description: 'You are not a member of this team',
        variant: 'destructive',
      })
      setSaving(false)
      return
    }

    // Check if availability exists
    const { data: existing } = await supabase
      .from('availability')
      .select('id')
      .eq('roster_member_id', rosterMember.id)
      .eq('event_id', eventId)
      .maybeSingle()

    let error = null
    if (existing) {
      const result = await supabase
        .from('availability')
        .update({ status })
        .eq('id', existing.id)
      error = result.error
    } else {
      const result = await supabase
        .from('availability')
        .insert({
          roster_member_id: rosterMember.id,
          event_id: eventId,
          status
        })
      error = result.error
    }

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Saved',
        description: 'Your RSVP has been saved',
      })
      router.back()
    }

    setSaving(false)
  }

  const getStatusIcon = (statusValue: string) => {
    switch (statusValue) {
      case 'available':
        return <Check className="h-5 w-5 text-green-500" />
      case 'unavailable':
        return <X className="h-5 w-5 text-red-500" />
      case 'maybe':
        return <HelpCircle className="h-5 w-5 text-yellow-500" />
      case 'late':
        return <Clock className="h-5 w-5 text-orange-500" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Event Not Found" />
        <main className="flex-1 p-4 flex items-center justify-center">
          <Card>
            <CardContent className="p-6">
              <p>Event not found</p>
              <Button onClick={() => router.back()} className="mt-4">
                Go Back
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const eventDateTime = `${format(new Date(event.date), 'EEEE, MMM d, yyyy')} at ${formatTimeDisplay(event.time)}`

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="My RSVP" />

      <main className="flex-1 p-4 space-y-4">
        <Button variant="ghost" onClick={() => router.back()} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{event.event_name}</CardTitle>
            <CardDescription>{eventDateTime}</CardDescription>
            {event.location && <CardDescription>📍 {event.location}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-6">
            {event.description && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            )}

            {autoCalculated && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  Based on your default availability settings, you are automatically marked as{' '}
                  <span className="font-medium">{status}</span> for this event.
                  You can change this below if needed.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Label htmlFor="status">Your RSVP</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as 'available' | 'unavailable' | 'maybe' | 'late')}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Available</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="maybe">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-yellow-500" />
                      <span>Maybe</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="late">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span>Running Late</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="unavailable">
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-red-500" />
                      <span>Unavailable</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                {getStatusIcon(status)}
                <div>
                  <p className="font-medium">
                    {status === 'available' && 'You will attend'}
                    {status === 'maybe' && 'You might attend'}
                    {status === 'late' && 'You will be late'}
                    {status === 'unavailable' && 'You cannot attend'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {status === 'available' && 'See you there!'}
                    {status === 'maybe' && 'Your captain will know you might be able to make it'}
                    {status === 'late' && 'Your captain will know you\'re running behind'}
                    {status === 'unavailable' && 'Your captain will know you cannot make it'}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button onClick={saveAvailability} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save RSVP
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}


