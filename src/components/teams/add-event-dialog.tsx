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
import { format } from 'date-fns'
import { getEventTypes } from '@/lib/event-type-colors'
import { EventType } from '@/lib/calendar-utils'
import { RecurrenceSelector } from '@/components/shared/recurrence-selector'
import { LocationSelector } from '@/components/shared/location-selector'
import { generateRecurringDates, RecurrencePattern, RecurrenceEndType, CustomRecurrenceData } from '@/lib/recurrence-utils'

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
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('weekly')
  const [endType, setEndType] = useState<RecurrenceEndType>('date')
  const [endDate, setEndDate] = useState('')
  const [occurrences, setOccurrences] = useState('')
  const [customRecurrence, setCustomRecurrence] = useState<CustomRecurrenceData>({
    interval: 1,
    timeUnit: 'week',
    selectedDays: [],
  })
  const [loading, setLoading] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>(undefined)
  const [locationMode, setLocationMode] = useState<'venue' | 'custom'>('venue')
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
    setCustomRecurrence({
      interval: 1,
      timeUnit: 'week',
      selectedDays: [],
    })
    setSelectedVenueId(undefined)
    setLocationMode('venue')
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
            endType,
            endType === 'date' ? endDate : undefined,
            endType === 'occurrences' ? parseInt(occurrences) : undefined,
            recurrencePattern === 'custom' ? customRecurrence : undefined
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
          } else if (endType === 'occurrences') {
            baseEvent.recurrence_occurrences = parseInt(occurrences)
          }
          if (recurrencePattern === 'custom' && customRecurrence) {
            baseEvent.recurrence_custom_data = customRecurrence
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
          <LocationSelector
            locationMode={locationMode}
            onLocationModeChange={setLocationMode}
            selectedVenueId={selectedVenueId}
            onVenueChange={setSelectedVenueId}
            customLocation={location}
            onCustomLocationChange={setLocation}
            teamId={selectedTeamId}
            canCreateVenue={isCaptain}
            onVenueSelected={(venue) => {
              if (venue) {
                setLocation(venue.address ? `${venue.name} - ${venue.address}` : venue.name)
              }
            }}
          />

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

            <RecurrenceSelector
              isRecurring={isRecurring}
              onRecurringChange={setIsRecurring}
              pattern={recurrencePattern}
              onPatternChange={setRecurrencePattern}
              endType={endType}
              onEndTypeChange={setEndType}
              endDate={endDate}
              onEndDateChange={setEndDate}
              occurrences={occurrences}
              onOccurrencesChange={setOccurrences}
              customRecurrence={customRecurrence}
              onCustomRecurrenceChange={setCustomRecurrence}
              startDate={date}
              showNeverOption={false}
            />
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

      </DialogContent>
    </Dialog>
  )
}

