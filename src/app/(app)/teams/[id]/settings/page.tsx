'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { Team } from '@/types/database.types'
import { useToast } from '@/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Save, Loader2 } from 'lucide-react'

export default function TeamSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Form state
  const [name, setName] = useState('')
  const [leagueFormat, setLeagueFormat] = useState<'USTA' | 'CUP' | 'FLEX'>('USTA')
  const [season, setSeason] = useState('')
  const [ratingLimit, setRatingLimit] = useState('')
  const [feePerTeam, setFeePerTeam] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [warmupPolicy, setWarmupPolicy] = useState('')
  const [homePhones, setHomePhones] = useState('')

  useEffect(() => {
    loadTeam()
  }, [teamId])

  async function loadTeam() {
    const supabase = createClient()

    const { data } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()

    if (data) {
      setTeam(data)
      setName(data.name)
      setLeagueFormat(data.league_format)
      setSeason(data.season || '')
      setRatingLimit(data.rating_limit?.toString() || '')
      setFeePerTeam(data.fee_per_team?.toString() || '')
      setVenueAddress(data.venue_address || '')
      setWarmupPolicy(data.warmup_policy || '')
      setHomePhones(data.home_phones || '')
    }
    setLoading(false)
  }

  async function saveSettings() {
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('teams')
      .update({
        name,
        league_format: leagueFormat,
        season: season || null,
        rating_limit: ratingLimit ? parseFloat(ratingLimit) : null,
        fee_per_team: feePerTeam ? parseFloat(feePerTeam) : 0,
        venue_address: venueAddress || null,
        warmup_policy: warmupPolicy || null,
        home_phones: homePhones || null,
      })
      .eq('id', teamId)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Settings saved',
        description: 'Team settings have been updated',
      })
    }

    setSaving(false)
  }

  if (loading || !team) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Team Settings" />

      <main className="flex-1 p-4 space-y-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>League Format</Label>
              <Select value={leagueFormat} onValueChange={(v) => setLeagueFormat(v as 'USTA' | 'CUP' | 'FLEX')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USTA">USTA</SelectItem>
                  <SelectItem value="CUP">CUP</SelectItem>
                  <SelectItem value="FLEX">FLEX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="season">Season</Label>
                <Input
                  id="season"
                  placeholder="Spring 2025"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rating">Rating Limit</Label>
                <Input
                  id="rating"
                  type="number"
                  step="0.5"
                  value={ratingLimit}
                  onChange={(e) => setRatingLimit(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Match Details</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fee">Fee Per Team ($)</Label>
              <Input
                id="fee"
                type="number"
                placeholder="25"
                value={feePerTeam}
                onChange={(e) => setFeePerTeam(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue">Venue Address</Label>
              <Textarea
                id="venue"
                placeholder="123 Tennis Court Rd..."
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warmup">Warmup Policy</Label>
              <Textarea
                id="warmup"
                placeholder="Courts available 30 min before..."
                value={warmupPolicy}
                onChange={(e) => setWarmupPolicy(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phones">Captain Phone(s)</Label>
              <Input
                id="phones"
                placeholder="(555) 123-4567"
                value={homePhones}
                onChange={(e) => setHomePhones(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" onClick={saveSettings} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </main>
    </div>
  )
}
