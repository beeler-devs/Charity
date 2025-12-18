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
import { Loader2, Save, ArrowLeft, Check, X, HelpCircle } from 'lucide-react'
import { formatTimeDisplay, calculateMatchAvailability } from '@/lib/availability-utils'
import { format } from 'date-fns'

interface Match {
  id: string
  date: string
  time: string
  opponent_name: string
  venue: string
  team_id: string
}

export default function MatchAvailabilityPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.matchId as string
  const [match, setMatch] = useState<Match | null>(null)
  const [status, setStatus] = useState<'available' | 'unavailable' | 'maybe'>('unavailable')
  const [autoCalculated, setAutoCalculated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadMatchAvailability()
  }, [matchId])

  async function loadMatchAvailability() {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // Load match details
    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (!matchData) {
      setLoading(false)
      return
    }

    setMatch(matchData)

    // Get roster member ID
    const { data: rosterMember } = await supabase
      .from('roster_members')
      .select('id')
      .eq('team_id', matchData.team_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!rosterMember) {
      setLoading(false)
      return
    }

    // Load match-specific availability if exists
    const { data: matchAvail } = await supabase
      .from('availability')
      .select('status')
      .eq('roster_member_id', rosterMember.id)
      .eq('match_id', matchId)
      .maybeSingle()

    if (matchAvail) {
      // User has already set match availability manually
      setStatus(matchAvail.status as 'available' | 'unavailable' | 'maybe')
      setAutoCalculated(false)
    } else {
      // Auto-calculate from defaults
      const { data: profile } = await supabase
        .from('profiles')
        .select('availability_defaults')
        .eq('id', user.id)
        .single()

      const calculatedStatus = calculateMatchAvailability(
        matchData.date,
        matchData.time,
        profile?.availability_defaults as Record<string, string[]> | null | undefined
      )
      setStatus(calculatedStatus)
      setAutoCalculated(true)
    }

    setLoading(false)
  }

  async function saveAvailability() {
    if (!match) return
    
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
      .eq('team_id', match.team_id)
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
      .eq('match_id', matchId)
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
          match_id: matchId,
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
        description: 'Your availability has been saved',
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
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!match) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Match Not Found" />
        <main className="flex-1 p-4 flex items-center justify-center">
          <Card>
            <CardContent className="p-6">
              <p>Match not found</p>
              <Button onClick={() => router.back()} className="mt-4">
                Go Back
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const matchDateTime = `${format(new Date(match.date), 'EEEE, MMM d, yyyy')} at ${formatTimeDisplay(match.time)}`

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="My Availability" />

      <main className="flex-1 p-4 space-y-4">
        <Button variant="ghost" onClick={() => router.back()} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Match: vs {match.opponent_name}</CardTitle>
            <CardDescription>{matchDateTime}</CardDescription>
            {match.venue && <CardDescription>{match.venue}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-6">
            {autoCalculated && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  Based on your default availability settings, you are automatically marked as{' '}
                  <span className="font-medium">{status}</span> for this match.
                  You can change this below if needed.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Label htmlFor="status">Your Availability</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as 'available' | 'unavailable' | 'maybe')}>
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
                    {status === 'available' && 'You are available'}
                    {status === 'maybe' && 'You might be available'}
                    {status === 'unavailable' && 'You are not available'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {status === 'available' && 'You can be included in the lineup'}
                    {status === 'maybe' && 'Captain will know you might be able to play'}
                    {status === 'unavailable' && 'You will not be included in the lineup'}
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
                Save Availability
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
