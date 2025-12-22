'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus } from 'lucide-react'
import { addDays, addWeeks, format, parseISO } from 'date-fns'
import { getEventTypes } from '@/lib/event-type-colors'
import { EventType } from '@/lib/calendar-utils'
import { VenueDialog } from '@/components/teams/venue-dialog'

interface AddEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId?: string // Optional - if not provided, will show team selector
  onAdded: () => void
  availableTeams?: Array<{ id: string; name: string }> // Teams user can create events for
}

export function AddEventDialog({
  open,
  onOpenChange,
  teamId: initialTeamId,
  onAdded,
  availableTeams = [],
}: AddEventDialogProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialTeamId || '')
  const [eventName, setEventName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('60')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState<EventType>('other')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState<'daily' | 'weekly' | 'custom'>('weekly')
  const [endType, setEndType] = useState<'date' | 'occurrences'>('date')
  const [endDate, setEndDate] = useState('')
  const [occurrences, setOccurrences] = useState('')
  const [loading, setLoading] = useState(false)
  const [venues, setVenues] = useState<any[]>([])
  const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>(undefined)
  const [locationMode, setLocationMode] = useState<'venue' | 'custom'>('venue')
  const [showVenueDialog, setShowVenueDialog] = useState(false)
  const [isCaptain, setIsCaptain] = useState(false)
  const { toast } = useToast()

  // Sync selectedTeamId when initialTeamId changes
  useEffect(() => {
    if (initialTeamId) {
      setSelectedTeamId(initialTeamId)
    } else if (availableTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(availableTeams[0].id)
    }
  }, [initialTeamId, availableTeams])

  useEffect(() => {
    if (open && selectedTeamId) {
      loadVenues()
      checkCaptainStatus()
    }
  }, [open, selectedTeamId])

  async function checkCaptainStatus() {
    if (!selectedTeamId) return
    
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setIsCaptain(false)
      return
    }

    if (!selectedTeamId) return
    
    const { data: teamData } = await supabase
      .from('teams')
      .select('captain_id, co_captain_id')
      .eq('id', selectedTeamId)
      .single()

    if (teamData && (teamData.captain_id === user.id || teamData.co_captain_id === user.id)) {
      setIsCaptain(true)
    } else {
      setIsCaptain(false)
    }
  }

  async function loadVenues() {
    const supabase = createClient()
    
    // Load system-wide active venues (available to all authenticated users)
    const { data: systemVenues } = await supabase
      .from('venues')
      .select('*')
      .is('team_id', null)
      .eq('is_active', true)
      .order('region', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })

    // Load team-specific venues (available to all team members)
    const { data: teamVenues } = await supabase
      .from('venues')
      .select('*')
      .eq('team_id', selectedTeamId)
      .order('name', { ascending: true })

    const allVenues = [
      ...(systemVenues || []),
      ...(teamVenues || [])
    ]

    setVenues(allVenues)
  }

  function resetForm() {
    setEventName('')
    setDate('')
    setTime('')
    setDuration('60')
    setLocation('')
    setDescription('')
    setEventType('other')
    setIsRecurring(false)
    setRecurrencePattern('weekly')
    setEndType('date')
    setEndDate('')
    setOccurrences('')
    setSelectedVenueId(undefined)
    setLocationMode('venue')
  }

  function generateRecurringDates(startDate: string, pattern: 'daily' | 'weekly' | 'custom', endDateStr?: string, numOccurrences?: number): string[] {
    const dates: string[] = [startDate]
    // Parse the date string properly to avoid timezone issues
    // parseISO handles 'yyyy-MM-dd' format correctly in local time
    const start = parseISO(startDate)
    let current = new Date(start)
    let count = 1

    if (endDateStr) {
      const end = parseISO(endDateStr)
      while (current < end) {
        if (pattern === 'daily') {
          current = addDays(current, 1)
        } else if (pattern === 'weekly') {
          current = addWeeks(current, 1)
        }
        // For custom, we'll handle separately if needed
        if (current <= end) {
          dates.push(format(current, 'yyyy-MM-dd'))
        }
      }
    } else if (numOccurrences) {
      while (count < numOccurrences) {
        if (pattern === 'daily') {
          current = addDays(current, 1)
        } else if (pattern === 'weekly') {
          current = addWeeks(current, 1)
        }
        dates.push(format(current, 'yyyy-MM-dd'))
        count++
      }
    }

    return dates
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedTeamId) {
      toast({
        title: 'Error',
        description: 'Please select a team',
        variant: 'destructive',
      })
      return
    }

    if (!eventName || !date || !time || !eventType) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields (Event Name, Date, Time, Event Type)',
        variant: 'destructive',
      })
      return
    }

    if (isRecurring) {
      if (recurrencePattern === 'custom') {
        toast({
          title: 'Error',
          description: 'Custom recurrence patterns are not yet supported. Please use Daily or Weekly.',
          variant: 'destructive',
        })
        return
      }
      if (endType === 'date' && !endDate) {
        toast({
          title: 'Error',
          description: 'Please specify an end date for the recurring event',
          variant: 'destructive',
        })
        return
      }
      if (endType === 'occurrences' && (!occurrences || parseInt(occurrences) < 2)) {
        toast({
          title: 'Error',
          description: 'Please specify the number of occurrences (must be at least 2)',
          variant: 'destructive',
        })
        return
      }
      if (endType === 'date' && new Date(endDate) < new Date(date)) {
        toast({
          title: 'Error',
          description: 'End date must be after the start date',
          variant: 'destructive',
        })
        return
      }
    }

    setLoading(true)

    try {
      const supabase = createClient()

      // Verify user has permission (is captain)
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
        .eq('id', selectedTeamId)
        .single()

      if (!teamData || (teamData.captain_id !== user.id && teamData.co_captain_id !== user.id)) {
        toast({
          title: 'Permission denied',
          description: 'Only team captains can create events',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      // Generate dates for recurring events
      const dates = isRecurring
        ? generateRecurringDates(
            date,
            recurrencePattern,
            endType === 'date' ? endDate : undefined,
            endType === 'occurrences' ? parseInt(occurrences) : undefined
          )
        : [date]

      // Generate a unique series ID for recurring events
      const recurrenceSeriesId = isRecurring ? crypto.randomUUID() : null

      // Create events for each date
      // Build event objects conditionally based on whether recurrence columns exist
      const eventsToCreate = dates.map((eventDate, index) => {
        const baseEvent: any = {
          team_id: selectedTeamId,
          event_name: eventName,
          date: eventDate,
          time,
          duration: duration ? parseInt(duration) : 60,
          location: location || null,
          description: description || null,
          event_type: eventType || null,
        }

        // Only add recurrence fields if this is a recurring event
        // These fields may not exist in the database schema yet
        if (isRecurring && recurrenceSeriesId) {
          baseEvent.recurrence_series_id = recurrenceSeriesId
          baseEvent.recurrence_original_date = date
          baseEvent.recurrence_pattern = recurrencePattern
          if (endType === 'date') {
            baseEvent.recurrence_end_date = endDate
          } else {
            baseEvent.recurrence_occurrences = parseInt(occurrences)
          }
        }

        return baseEvent
      })

      const { error } = await supabase.from('events').insert(eventsToCreate)

      if (error) {
        // Check if error is due to missing columns
        const errorMsg = error.message.toLowerCase()
        if (errorMsg.includes('recurrence') || errorMsg.includes('event_type') || errorMsg.includes('schema cache') || errorMsg.includes('column')) {
          toast({
            title: 'Migration Required',
            description: 'Please run the recurring_events_migration.sql migration in your Supabase SQL Editor. Then run: NOTIFY pgrst, \'reload schema\';',
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Error',
            description: error.message,
            variant: 'destructive',
          })
        }
      } else {
        toast({
          title: isRecurring ? 'Recurring events created' : 'Event created',
          description: isRecurring 
            ? `${dates.length} event${dates.length > 1 ? 's' : ''} have been created successfully`
            : 'The event has been added successfully',
        })
        resetForm()
        onAdded()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create event',
        variant: 'destructive',
      })
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
          <DialogDescription>
            Create a team event like a practice, dinner, or social gathering
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Team Selection (only show if multiple teams available) */}
          {availableTeams.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="teamSelect">
                Team <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedTeamId}
                onValueChange={setSelectedTeamId}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Event Name */}
          <div className="space-y-2">
            <Label htmlFor="eventName">
              Event Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="eventName"
              placeholder="Team Practice, Dinner, etc."
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              required
            />
          </div>

          {/* Event Type */}
          <div className="space-y-2">
            <Label htmlFor="eventType">
              Event Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={eventType}
              onValueChange={(value) => setEventType(value as EventType)}
              required
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getEventTypes().map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                  value={(() => {
                    const [hour, minute] = time.split(':')
                    const hourNum = parseInt(hour || '0')
                    const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum
                    return displayHour.toString()
                  })()}
                  onValueChange={(hourStr) => {
                    const [currentHour, minute] = time.split(':')
                    const currentHourNum = parseInt(currentHour || '0')
                    const isPM = currentHourNum >= 12
                    const hourNum = parseInt(hourStr)
                    let newHour = hourNum
                    if (hourNum === 12) {
                      newHour = isPM ? 12 : 0
                    } else {
                      newHour = isPM ? hourNum + 12 : hourNum
                    }
                    setTime(`${newHour.toString().padStart(2, '0')}:${minute || '00'}`)
                  }}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Hour" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const hour = i + 1
                      return (
                        <SelectItem key={hour} value={hour.toString()}>
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
                <Select
                  value={(() => {
                    const hour = parseInt(time.split(':')[0] || '0')
                    return hour >= 12 ? 'PM' : 'AM'
                  })()}
                  onValueChange={(ampm) => {
                    const [hour, minute] = time.split(':')
                    const hourNum = parseInt(hour || '0')
                    let newHour = hourNum
                    if (ampm === 'PM' && hourNum < 12) {
                      newHour = hourNum + 12
                    } else if (ampm === 'AM' && hourNum >= 12) {
                      newHour = hourNum === 12 ? 0 : hourNum - 12
                    }
                    setTime(`${newHour.toString().padStart(2, '0')}:${minute || '00'}`)
                  }}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Select
              value={duration}
              onValueChange={setDuration}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 25 }, (_, i) => {
                  const minutes = (i + 1) * 5 // 5, 10, 15, ... 125
                  return (
                    <SelectItem key={minutes} value={minutes.toString()}>
                      {minutes} minutes
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="location">Location</Label>
              <div className="flex items-center gap-2">
                <Select value={locationMode} onValueChange={(v) => {
                  setLocationMode(v as 'venue' | 'custom')
                  if (v === 'custom') {
                    setSelectedVenueId(undefined)
                    setLocation('')
                  } else {
                    setLocation('')
                    setSelectedVenueId(undefined)
                  }
                }}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venue">Select Venue</SelectItem>
                    <SelectItem value="custom">Custom Location</SelectItem>
                  </SelectContent>
                </Select>
                {locationMode === 'venue' && isCaptain && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVenueDialog(true)}
                    title="Create a new team-specific venue"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New
                  </Button>
                )}
              </div>
            </div>

            {locationMode === 'venue' ? (
              <Select
                value={selectedVenueId || undefined}
                onValueChange={(venueId) => {
                  setSelectedVenueId(venueId)
                  const venue = venues.find(v => v.id === venueId)
                  if (venue) {
                    // Set location to venue name, optionally include address
                    setLocation(venue.address ? `${venue.name} - ${venue.address}` : venue.name)
                  }
                }}
              >
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select a venue..." />
                </SelectTrigger>
                <SelectContent>
                  {venues.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
                      No venues available
                    </div>
                  ) : (
                    <>
                      {venues.filter(v => !v.team_id).length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            System Venues
                          </div>
                          {venues
                            .filter(v => !v.team_id)
                            .map((venue) => (
                              <SelectItem key={venue.id} value={venue.id}>
                                {venue.name}
                                {venue.region && ` (${venue.region})`}
                              </SelectItem>
                            ))}
                        </>
                      )}
                      {venues.filter(v => v.team_id === selectedTeamId).length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Team Venues
                          </div>
                          {venues
                            .filter(v => v.team_id === selectedTeamId)
                            .map((venue) => (
                              <SelectItem key={venue.id} value={venue.id}>
                                {venue.name}
                              </SelectItem>
                            ))}
                        </>
                      )}
                    </>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="location"
                placeholder="Court name, restaurant, etc."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Additional details about the event..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Recurring Event Options */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRecurring"
                checked={isRecurring}
                onCheckedChange={(checked) => setIsRecurring(checked === true)}
              />
              <Label htmlFor="isRecurring" className="font-normal cursor-pointer">
                This is a recurring event
              </Label>
            </div>

            {isRecurring && (
              <div className="space-y-4 pl-6 border-l-2">
                {/* Recurrence Pattern */}
                <div className="space-y-2">
                  <Label htmlFor="recurrencePattern">Recurrence Pattern</Label>
                  <Select
                    value={recurrencePattern}
                    onValueChange={(value) => setRecurrencePattern(value as 'daily' | 'weekly' | 'custom')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* End Type Selection */}
                <div className="space-y-2">
                  <Label>End Recurrence</Label>
                  <Select value={endType} onValueChange={(value) => setEndType(value as 'date' | 'occurrences')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">On a specific date</SelectItem>
                      <SelectItem value="occurrences">After number of occurrences</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* End Date or Occurrences */}
                {endType === 'date' ? (
                  <div className="space-y-2">
                    <Label htmlFor="endDate">
                      End Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={date}
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="occurrences">
                      Number of Occurrences <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="occurrences"
                      type="number"
                      min="2"
                      value={occurrences}
                      onChange={(e) => setOccurrences(e.target.value)}
                      placeholder="e.g., 10"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      The event will repeat {occurrences ? `${occurrences} times` : 'multiple times'} starting from {date}
                    </p>
                  </div>
                )}

                {recurrencePattern === 'custom' && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Custom recurrence patterns are coming soon. For now, please use Daily or Weekly.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

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
              Create Event
            </Button>
          </DialogFooter>
        </form>

        <VenueDialog
          open={showVenueDialog}
          onOpenChange={setShowVenueDialog}
          venue={null}
          teamId={selectedTeamId}
          onSaved={() => {
            loadVenues()
            setShowVenueDialog(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

