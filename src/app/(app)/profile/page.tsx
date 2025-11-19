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
  Loader2
} from 'lucide-react'

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reservations, setReservations] = useState<CourtReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [availabilityDefaults, setAvailabilityDefaults] = useState<Record<string, boolean>>({})
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

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileData) {
      setProfile(profileData)
      setFullName(profileData.full_name || '')
      setPhone(profileData.phone || '')
      setNtrpRating(profileData.ntrp_rating?.toString() || '')
      setAvailabilityDefaults(
        (profileData.availability_defaults as Record<string, boolean>) || {}
      )
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

        {/* Master Availability */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Default Availability</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <p className="text-xs text-muted-foreground mb-3">
              Set your default availability for each day of the week
            </p>
            <div className="grid grid-cols-7 gap-2">
              {daysOfWeek.map((day) => (
                <div key={day} className="text-center">
                  <p className="text-xs font-medium mb-2">{day}</p>
                  <Switch
                    checked={availabilityDefaults[day] !== false}
                    onCheckedChange={() => toggleDayAvailability(day)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
