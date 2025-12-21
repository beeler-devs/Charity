'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { Profile, CourtReservation } from '@/types/database.types'
import { formatDate, formatTime } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  LogOut,
  Save,
  Calendar,
  MapPin,
  Plus,
  Loader2,
  ChevronRight,
  Clock
} from 'lucide-react'
import Link from 'next/link'

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reservations, setReservations] = useState<CourtReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [availabilityDefaults, setAvailabilityDefaults] = useState<Record<string, boolean>>({})
  const [statistics, setStatistics] = useState<any[]>([])
  const { toast } = useToast()

  // Form state
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [ntrpRating, setNtrpRating] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error loading profile:', profileError)
      toast({
        title: 'Error loading profile',
        description: profileError.message || 'Unable to load your profile. Please refresh the page.',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    if (profileData) {
      setProfile(profileData)
      setFullName(profileData.full_name || '')
      setPhone(profileData.phone || '')
      setNtrpRating(profileData.ntrp_rating?.toString() || '')
      setAvailabilityDefaults(
        (profileData.availability_defaults as Record<string, boolean>) || {}
      )
    } else {
      toast({
        title: 'Profile not found',
        description: 'Your profile could not be loaded. Please contact support.',
        variant: 'destructive',
      })
    }

    const { data: reservationsData } = await supabase
      .from('court_reservations')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(5)

    if (reservationsData) {
      setReservations(reservationsData)
    }

    // Load individual statistics
    const { data: rosters } = await supabase
      .from('roster_members')
      .select('id, team_id, teams(name)')
      .eq('user_id', user.id)

    if (rosters && rosters.length > 0) {
      const rosterIds = rosters.map(r => r.id)
      
      const { data: statsData } = await supabase
        .from('individual_statistics')
        .select('*')
        .in('player_id', rosterIds)

      if (statsData) {
        // Combine stats with team names
        const statsWithTeams = statsData.map(stat => {
          const roster = rosters.find(r => r.id === stat.player_id)
          return {
            ...stat,
            team_name: roster?.teams?.name || 'Unknown Team',
          }
        })
        setStatistics(statsWithTeams)
      }
    }

    setLoading(false)
  }

  async function saveProfile() {
    if (!profile) return
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone || null,
        ntrp_rating: ntrpRating ? parseFloat(ntrpRating) : null,
        availability_defaults: availabilityDefaults,
      })
      .eq('id', profile.id)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Profile updated',
        description: 'Your profile has been saved',
      })
    }

    setSaving(false)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  function toggleDayAvailability(day: string) {
    setAvailabilityDefaults(prev => ({
      ...prev,
      [day]: !prev[day],
    }))
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
      <Header title="Profile" />

      <main className="flex-1 p-4 space-y-4">
        {/* Profile Header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {getInitials(fullName || profile?.email || 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="font-semibold">{fullName || 'Set your name'}</h2>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                {ntrpRating && (
                  <Badge variant="secondary" className="mt-1">
                    NTRP {ntrpRating}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rating">NTRP Rating</Label>
              <Input
                id="rating"
                type="number"
                step="0.5"
                min="2.0"
                max="7.0"
                value={ntrpRating}
                onChange={(e) => setNtrpRating(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* My Statistics */}
        {statistics.length > 0 && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">My Statistics</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="space-y-4">
                {statistics.map((stat) => (
                  <div key={stat.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{stat.team_name}</span>
                      <Badge variant="outline">
                        {stat.win_percentage?.toFixed(1)}% Win Rate
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <div className="font-bold text-primary">{stat.matches_played}</div>
                        <div className="text-muted-foreground">Played</div>
                      </div>
                      <div>
                        <div className="font-bold text-green-600">{stat.matches_won}</div>
                        <div className="text-muted-foreground">Won</div>
                      </div>
                      <div>
                        <div className="font-bold text-red-600">{stat.matches_lost}</div>
                        <div className="text-muted-foreground">Lost</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-600">{stat.games_won}/{stat.games_won + stat.games_lost}</div>
                        <div className="text-muted-foreground">Games</div>
                      </div>
                    </div>
                    {statistics.length > 1 && stat !== statistics[statistics.length - 1] && (
                      <div className="border-b mt-3" />
                    )}
                  </div>
                ))}
                
                {/* Overall totals */}
                {statistics.length > 1 && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">Overall</span>
                      <Badge>
                        {(
                          (statistics.reduce((sum, s) => sum + s.matches_won, 0) /
                            statistics.reduce((sum, s) => sum + s.matches_played, 0)) *
                          100
                        ).toFixed(1)}
                        % Win Rate
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <div className="font-bold text-primary">
                          {statistics.reduce((sum, s) => sum + s.matches_played, 0)}
                        </div>
                        <div className="text-muted-foreground">Played</div>
                      </div>
                      <div>
                        <div className="font-bold text-green-600">
                          {statistics.reduce((sum, s) => sum + s.matches_won, 0)}
                        </div>
                        <div className="text-muted-foreground">Won</div>
                      </div>
                      <div>
                        <div className="font-bold text-red-600">
                          {statistics.reduce((sum, s) => sum + s.matches_lost, 0)}
                        </div>
                        <div className="text-muted-foreground">Lost</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-600">
                          {statistics.reduce((sum, s) => sum + s.games_won, 0)}/
                          {statistics.reduce((sum, s) => sum + s.games_won + s.games_lost, 0)}
                        </div>
                        <div className="text-muted-foreground">Games</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Master Availability */}
        <Link href="/settings/availability">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Default Availability</p>
                    <p className="text-xs text-muted-foreground">
                      Set your weekly time availability
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* My Courts */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">My Courts</CardTitle>
              <Button variant="ghost" size="sm" className="h-8">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {reservations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming court reservations
              </p>
            ) : (
              <div className="space-y-3">
                {reservations.map((reservation) => (
                  <div
                    key={reservation.id}
                    className="flex items-start gap-3 text-sm"
                  >
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">{reservation.venue_name}</p>
                      <p className="text-muted-foreground">
                        {formatDate(reservation.date)} at {formatTime(reservation.start_time)}
                        {reservation.court_number && ` - Court ${reservation.court_number}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-2">
          <Button className="w-full" onClick={saveProfile} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Profile
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </main>
    </div>
  )
}
