'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { parseCSVSchedule } from '@/lib/utils'

interface AddMatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  onAdded: () => void
}

export function AddMatchDialog({
  open,
  onOpenChange,
  teamId,
  onAdded,
}: AddMatchDialogProps) {
  // Single match form state
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [opponent, setOpponent] = useState('')
  const [isHome, setIsHome] = useState('true')
  const [venue, setVenue] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [duration, setDuration] = useState('')
  const [warmupStatus, setWarmupStatus] = useState('none_yet')
  const [warmupTime, setWarmupTime] = useState('')
  const [warmupCourt, setWarmupCourt] = useState('')

  // CSV import state
  const [csvText, setCsvText] = useState('')
  
  // Team facility state
  const [teamFacilityName, setTeamFacilityName] = useState<string | null>(null)
  const [teamFacilityAddress, setTeamFacilityAddress] = useState<string | null>(null)
  
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Load team facility when dialog opens
  useEffect(() => {
    if (open) {
      loadTeamFacility()
    }
  }, [open, teamId])

  // Update venue when isHome changes or team facility is loaded
  useEffect(() => {
    if (isHome === 'true' && teamFacilityName) {
      setVenue(teamFacilityName)
      if (teamFacilityAddress) {
        setVenueAddress(teamFacilityAddress)
      }
    } else if (isHome === 'false') {
      // Clear venue for away matches
      setVenue('')
      setVenueAddress('')
    }
  }, [isHome, teamFacilityName, teamFacilityAddress])

  async function loadTeamFacility() {
    const supabase = createClient()
    const { data: teamData } = await supabase
      .from('teams')
      .select('facility_id, facility_name')
      .eq('id', teamId)
      .single()

    if (teamData) {
      if (teamData.facility_id) {
        // Load venue details if facility_id is set
        const { data: venueData } = await supabase
          .from('venues')
          .select('name, address')
          .eq('id', teamData.facility_id)
          .single()

        if (venueData) {
          setTeamFacilityName(venueData.name)
          setTeamFacilityAddress(venueData.address || null)
        }
      } else if (teamData.facility_name) {
        // Use facility_name directly
        setTeamFacilityName(teamData.facility_name)
        setTeamFacilityAddress(null)
      } else {
        setTeamFacilityName(null)
        setTeamFacilityAddress(null)
      }
    }
  }

  function resetForm() {
    setDate('')
    setTime('')
    setOpponent('')
    setIsHome('true')
    setVenue('')
    setVenueAddress('')
    setDuration('')
    setWarmupStatus('none_yet')
    setWarmupTime('')
    setWarmupCourt('')
    setCsvText('')
  }

  async function handleAddSingleMatch(e: React.FormEvent) {
    e.preventDefault()

    if (!date || !time || !opponent) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields (Date, Time, Opponent)',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      const matchData: any = {
        team_id: teamId,
        date,
        time,
        opponent_name: opponent,
        is_home: isHome === 'true',
        venue: venue || null,
        venue_address: venueAddress || null,
        duration: duration ? parseInt(duration) : null,
        warm_up_status: warmupStatus,
        warm_up_time: warmupTime || null,
        warm_up_court: warmupCourt || null,
      }

      const { error } = await supabase.from('matches').insert(matchData)

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Match added',
          description: 'The match has been added successfully',
        })
        resetForm()
        onAdded()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add match',
        variant: 'destructive',
      })
    }

    setLoading(false)
  }

  async function handleCSVImport() {
    if (!csvText.trim()) {
      toast({
        title: 'Error',
        description: 'Please paste your schedule data',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const parsedSchedule = parseCSVSchedule(csvText)

      if (parsedSchedule.length === 0) {
        toast({
          title: 'Error',
          description: 'Could not parse any matches from the data',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      const supabase = createClient()

      // Verify user has permission
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      const { data: teamData } = await supabase
        .from('teams')
        .select('captain_id, co_captain_id')
        .eq('id', teamId)
        .single()

      if (!teamData || (teamData.captain_id !== user.id && teamData.co_captain_id !== user.id)) {
        toast({
          title: 'Permission denied',
          description: 'Only team captains can import schedules',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      const matchesToInsert = parsedSchedule.map((match) => ({
        team_id: teamId,
        date: match.date,
        time: match.time,
        opponent_name: match.opponent,
        venue: match.venue || null,
        venue_address: match.venueAddress || null,
        is_home: match.isHome ?? true,
        duration: match.duration || null,
        warm_up_status: match.warmupStatus || 'none_yet',
        warm_up_time: match.warmupTime || null,
        warm_up_court: match.warmupCourt || null,
      }))

      const { data, error } = await supabase
        .from('matches')
        .insert(matchesToInsert)
        .select()

      if (error) {
        console.error('Insert error:', error)
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        console.log(`Successfully inserted ${data?.length || parsedSchedule.length} matches`)
        toast({
          title: 'Schedule imported',
          description: `${data?.length || parsedSchedule.length} matches have been added`,
        })
        resetForm()
        onAdded()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to parse schedule data',
        variant: 'destructive',
      })
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Match</DialogTitle>
          <DialogDescription>
            Add a single match or import multiple matches from CSV
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Single Match</TabsTrigger>
            <TabsTrigger value="csv">CSV Import</TabsTrigger>
          </TabsList>

          {/* Single Match Form */}
          <TabsContent value="single">
            <form onSubmit={handleAddSingleMatch} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date">
                    Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                {/* Time */}
                <div className="space-y-2">
                  <Label>
                    Time <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={time.split(':')[0] || ''}
                      onValueChange={(hour) => {
                        const minute = time.split(':')[1] || '00'
                        setTime(`${hour}:${minute}`)
                      }}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Hour" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i.toString().padStart(2, '0')
                          return (
                            <SelectItem key={hour} value={hour}>
                              {hour}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    <span className="flex items-center">:</span>
                    <Select
                      value={time.split(':')[1] || ''}
                      onValueChange={(minute) => {
                        const hour = time.split(':')[0] || '00'
                        setTime(`${hour}:${minute}`)
                      }}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Min" />
                      </SelectTrigger>
                      <SelectContent>
                        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((minute) => (
                          <SelectItem key={minute} value={minute}>
                            {minute}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Opponent */}
              <div className="space-y-2">
                <Label htmlFor="opponent">
                  Opponent <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="opponent"
                  placeholder="Team Name"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Home/Away */}
                <div className="space-y-2">
                  <Label htmlFor="homeAway">
                    Home/Away <span className="text-destructive">*</span>
                  </Label>
                  <Select value={isHome} onValueChange={setIsHome}>
                    <SelectTrigger id="homeAway">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Home</SelectItem>
                      <SelectItem value="false">Away</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="0"
                    placeholder="90"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </div>
              </div>

              {/* Venue */}
              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <Input
                  id="venue"
                  placeholder="Court Name"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                />
              </div>

              {/* Venue Address */}
              <div className="space-y-2">
                <Label htmlFor="venueAddress">Venue Address</Label>
                <Input
                  id="venueAddress"
                  placeholder="123 Main St"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                />
              </div>

              {/* Warmup Status */}
              <div className="space-y-2">
                <Label htmlFor="warmupStatus">Warmup Status</Label>
                <Select value={warmupStatus} onValueChange={setWarmupStatus}>
                  <SelectTrigger id="warmupStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none_yet">None Yet</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="no_warmup">No Warmup</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Warmup Time and Court (conditional) */}
              {warmupStatus === 'booked' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Warmup Time</Label>
                    <div className="flex gap-2">
                      <Select
                        value={warmupTime.split(':')[0] || ''}
                        onValueChange={(hour) => {
                          const minute = warmupTime.split(':')[1] || '00'
                          setWarmupTime(`${hour}:${minute}`)
                        }}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Hour" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => {
                            const hour = i.toString().padStart(2, '0')
                            return (
                              <SelectItem key={hour} value={hour}>
                                {hour}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      <span className="flex items-center">:</span>
                      <Select
                        value={warmupTime.split(':')[1] || ''}
                        onValueChange={(minute) => {
                          const hour = warmupTime.split(':')[0] || '00'
                          setWarmupTime(`${hour}:${minute}`)
                        }}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Min" />
                        </SelectTrigger>
                        <SelectContent>
                          {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((minute) => (
                            <SelectItem key={minute} value={minute}>
                              {minute}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="warmupCourt">Warmup Court</Label>
                    <Input
                      id="warmupCourt"
                      placeholder="Court 1A"
                      value={warmupCourt}
                      onChange={(e) => setWarmupCourt(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Match
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* CSV Import */}
          <TabsContent value="csv">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Schedule Data</Label>
                <Textarea
                  placeholder={`Date,Time,Opponent,Home/Away,Venue,Venue Address,Duration,Warmup Status,Warmup Time,Warmup Court
2025-01-15,18:00,Team A,Home,Court 1,123 Main St,90,booked,17:30,Court 1A
2025-01-22,19:00,Team B,Away,Court 2,456 Oak Ave,90,none_yet,,`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Required: Date (YYYY-MM-DD), Time (HH:MM), Opponent, Home/Away
                  <br />
                  Optional: Venue, Venue Address, Duration (minutes), Warmup Status, Warmup Time, Warmup Court
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCSVImport}
                  disabled={loading || !csvText.trim()}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Import Schedule
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

