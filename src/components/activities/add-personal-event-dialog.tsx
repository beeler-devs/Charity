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
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { getActivityTypes } from '@/lib/event-type-colors'
import { ActivityType } from '@/lib/calendar-utils'
import { VenueDialog } from '@/components/teams/venue-dialog'
import { PersonalEvent } from '@/types/database.types'
import { Checkbox } from '@/components/ui/checkbox'
import { parseISO, format, addDays, addWeeks, addMonths, addYears, getDay, isBefore } from 'date-fns'
import { Calendar } from 'lucide-react'
import { CustomRecurrenceDialog } from './custom-recurrence-dialog'

interface AddPersonalEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}

export function AddPersonalEventDialog({
  open,
  onOpenChange,
  onAdded,
}: AddPersonalEventDialogProps) {
  const [title, setTitle] = useState('')
  const [activityType, setActivityType] = useState<ActivityType>('other')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('60')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [maxAttendees, setMaxAttendees] = useState('')
  const [cost, setCost] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState<'daily' | 'weekly' | 'custom'>('weekly')
  const [endType, setEndType] = useState<'date' | 'occurrences' | 'never'>('date')
  const [endDate, setEndDate] = useState('')
  const [occurrences, setOccurrences] = useState('')
  const [customRecurrence, setCustomRecurrence] = useState<{
    interval: number
    timeUnit: 'day' | 'week' | 'month' | 'year'
    selectedDays: number[]
  }>({
    interval: 1,
    timeUnit: 'week',
    selectedDays: [],
  })
  const [showCustomRecurrenceDialog, setShowCustomRecurrenceDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [venues, setVenues] = useState<any[]>([])
  const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>(undefined)
  const [locationMode, setLocationMode] = useState<'venue' | 'custom'>('custom')
  const [showVenueDialog, setShowVenueDialog] = useState(false)
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([])
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadTeams()
      loadVenues()
      resetForm()
    }
  }, [open])

  async function loadTeams() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    // Get teams where user is a member
    const { data: rosterData } = await supabase
      .from('roster_members')
      .select('team_id, teams!inner(id, name)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (rosterData) {
      const teamsList = rosterData.map((r: any) => ({
        id: r.team_id,
        name: r.teams.name,
      }))
      setTeams(teamsList)
    }
  }

  async function loadVenues() {
    const supabase = createClient()
    
    // Load system-wide active venues
    const { data: systemVenues } = await supabase
      .from('venues')
      .select('*')
      .is('team_id', null)
      .eq('is_active', true)
      .order('region', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })

    // Load team-specific venues if a team is selected
    let teamVenues: any[] = []
    if (selectedTeamId) {
      const { data } = await supabase
        .from('venues')
        .select('*')
        .eq('team_id', selectedTeamId)
        .order('name', { ascending: true })
      teamVenues = data || []
    }

    const allVenues = [
      ...(systemVenues || []),
      ...teamVenues
    ]

    setVenues(allVenues)
  }

  useEffect(() => {
    if (selectedTeamId) {
      loadVenues()
    }
  }, [selectedTeamId])

  function resetForm() {
    setTitle('')
    setActivityType('other')
    setDate('')
    setTime('')
    setDuration('60')
    setLocation('')
    setDescription('')
    setMaxAttendees('')
    setCost('')
    setSelectedTeamId('')
    setSelectedVenueId(undefined)
    setLocationMode('custom')
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
    setShowCustomRecurrenceDialog(false)
  }

  function generateRecurringDates(
    startDate: string,
    pattern: 'daily' | 'weekly' | 'custom',
    endDateStr?: string,
    numOccurrences?: number,
    customData?: { interval: number; timeUnit: 'day' | 'week' | 'month' | 'year'; selectedDays?: number[] }
  ): string[] {
    const dates: string[] = [startDate]
    const start = parseISO(startDate)
    let current = new Date(start)
    let count = 1
    const maxIterations = 1000 // Safety limit to prevent infinite loops

    if (pattern === 'custom' && customData) {
      const { interval, timeUnit, selectedDays } = customData
      
      if (endDateStr) {
        const end = parseISO(endDateStr)
        let iterations = 0
        
        while (current < end && iterations < maxIterations) {
          iterations++
          
          if (timeUnit === 'day') {
            current = addDays(current, interval)
          } else if (timeUnit === 'week') {
            if (selectedDays && selectedDays.length > 0) {
              // For weekly with selected days, find next occurrence of selected days
              let found = false
              let attempts = 0
              
              while (!found && attempts < 100) {
                attempts++
                let nextDate: Date | null = null
                const currentDayOfWeek = getDay(current)
                
                // Find the next selected day from current date
                for (const dayOfWeek of selectedDays) {
                  let dayDiff = (dayOfWeek - currentDayOfWeek + 7) % 7
                  // If it's the same day and this is the first attempt, skip to next week
                  if (dayDiff === 0 && attempts === 1) {
                    dayDiff = 7
                  }
                  const candidate = addDays(current, dayDiff || 7)
                  
                  if (candidate > current && candidate <= end) {
                    if (!nextDate || candidate < nextDate) {
                      nextDate = candidate
                    }
                  }
                }
                
                if (nextDate) {
                  current = nextDate
                  dates.push(format(current, 'yyyy-MM-dd'))
                  found = true
                } else {
                  // Move to next week interval (start of next interval week)
                  current = addWeeks(current, interval)
                  // Reset to start of that week (Sunday)
                  const dayOfWeek = getDay(current)
                  current = addDays(current, -dayOfWeek)
                }
              }
            } else {
              current = addWeeks(current, interval)
            }
          } else if (timeUnit === 'month') {
            current = addMonths(current, interval)
          } else if (timeUnit === 'year') {
            current = addYears(current, interval)
          }
          
          if (current <= end && (timeUnit !== 'week' || !selectedDays || selectedDays.length === 0)) {
            dates.push(format(current, 'yyyy-MM-dd'))
          }
        }
      } else if (numOccurrences) {
        let iterations = 0
        
        while (count < numOccurrences && iterations < maxIterations) {
          iterations++
          
          if (timeUnit === 'day') {
            current = addDays(current, interval)
          } else if (timeUnit === 'week') {
            if (selectedDays && selectedDays.length > 0) {
              // Find next occurrence of selected days
              let found = false
              let attempts = 0
              
              while (!found && attempts < 100) {
                attempts++
                let nextDate: Date | null = null
                const currentDayOfWeek = getDay(current)
                
                // Find the next selected day from current date
                for (const dayOfWeek of selectedDays) {
                  let dayDiff = (dayOfWeek - currentDayOfWeek + 7) % 7
                  // If it's the same day and this is the first attempt, skip to next week
                  if (dayDiff === 0 && attempts === 1) {
                    dayDiff = 7
                  }
                  const candidate = addDays(current, dayDiff || 7)
                  
                  if (candidate > current) {
                    if (!nextDate || candidate < nextDate) {
                      nextDate = candidate
                    }
                  }
                }
                
                if (nextDate) {
                  current = nextDate
                  dates.push(format(current, 'yyyy-MM-dd'))
                  count++
                  found = true
                } else {
                  // Move to next week interval (start of next interval week)
                  current = addWeeks(current, interval)
                  // Reset to start of that week (Sunday)
                  const dayOfWeek = getDay(current)
                  current = addDays(current, -dayOfWeek)
                }
              }
            } else {
              current = addWeeks(current, interval)
            }
          } else if (timeUnit === 'month') {
            current = addMonths(current, interval)
          } else if (timeUnit === 'year') {
            current = addYears(current, interval)
          }
          
          if (timeUnit !== 'week' || !selectedDays || selectedDays.length === 0) {
            dates.push(format(current, 'yyyy-MM-dd'))
            count++
          }
        }
      }
    } else {
      // Original logic for daily/weekly
      if (endDateStr) {
        const end = parseISO(endDateStr)
        while (current < end) {
          if (pattern === 'daily') {
            current = addDays(current, 1)
          } else if (pattern === 'weekly') {
            current = addWeeks(current, 1)
          }
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
    }

    return dates
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
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

    if (!title || !date || !time || !activityType) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields (Title, Date, Time, Activity Type)',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    if (isRecurring) {
      if (recurrencePattern === 'custom') {
        if (customRecurrence.selectedDays && customRecurrence.selectedDays.length === 0 && customRecurrence.timeUnit === 'week') {
          toast({
            title: 'Error',
            description: 'Please select at least one day for weekly recurrence',
            variant: 'destructive',
          })
          setLoading(false)
          return
        }
      }

      if (endType === 'date' && !endDate) {
        toast({
          title: 'Error',
          description: 'Please specify an end date for the recurring activity',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      if (endType === 'never' && recurrencePattern === 'custom') {
        // For "never" end type with custom, we'll generate a large number of occurrences
        // This is handled in the date generation
      }

      if (endType === 'occurrences' && (!occurrences || parseInt(occurrences) < 2)) {
        toast({
          title: 'Error',
          description: 'Please specify at least 2 occurrences for the recurring activity',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }
    }

    // Determine location
    let finalLocation = location
    if (locationMode === 'venue' && selectedVenueId) {
      const selectedVenue = venues.find(v => v.id === selectedVenueId)
      if (selectedVenue) {
        finalLocation = selectedVenue.name
        if (selectedVenue.address) {
          finalLocation += ` - ${selectedVenue.address}`
        }
      }
    }

    // Generate dates for recurring activities
    // For "never" end type, we'll generate a large number of occurrences (1000) as a practical limit
    const dates = isRecurring
      ? generateRecurringDates(
          date,
          recurrencePattern,
          endType === 'date' ? endDate : undefined,
          endType === 'occurrences' ? parseInt(occurrences) : endType === 'never' ? 1000 : undefined,
          recurrencePattern === 'custom' ? customRecurrence : undefined
        )
      : [date]

    // Generate a unique series ID for recurring activities
    const recurrenceSeriesId = isRecurring ? crypto.randomUUID() : null

    // Create events for each date
    const eventsToCreate = dates.map((eventDate) => {
      const baseEvent: Partial<PersonalEvent> = {
        creator_id: user.id,
        team_id: selectedTeamId || null,
        activity_type: activityType,
        title,
        date: eventDate,
        time,
        duration: duration ? parseInt(duration) : 60,
        location: finalLocation || null,
        description: description || null,
        max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
        cost: cost ? parseFloat(cost) : null,
      }

      // Only add recurrence fields if this is a recurring activity
      if (isRecurring && recurrenceSeriesId) {
        baseEvent.recurrence_series_id = recurrenceSeriesId
        baseEvent.recurrence_original_date = date
        baseEvent.recurrence_pattern = recurrencePattern
        if (endType === 'date') {
          baseEvent.recurrence_end_date = endDate
        } else if (endType === 'occurrences') {
          baseEvent.recurrence_occurrences = parseInt(occurrences)
        }
        // Add custom recurrence data if pattern is custom
        if (recurrencePattern === 'custom') {
          baseEvent.recurrence_custom_data = customRecurrence
        }
      }

      return baseEvent
    })

    const { data, error } = await supabase
      .from('personal_events')
      .insert(eventsToCreate)
      .select()

    if (error) {
      // Check if error is due to missing recurrence columns
      const errorMsg = error.message.toLowerCase()
      if (errorMsg.includes('recurrence') || errorMsg.includes('schema cache') || errorMsg.includes('column')) {
        toast({
          title: 'Database Schema Error',
          description: 'Please run the personal_activities_migration.sql migration in your Supabase SQL Editor. Make sure it includes the recurrence fields.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
      }
      setLoading(false)
      return
    }

    toast({
      title: isRecurring ? 'Recurring activities created' : 'Activity created',
      description: isRecurring 
        ? `Created ${dates.length} recurring activities. You can now invite people to them.`
        : 'Your activity has been created. You can now invite people to it.',
    })

    resetForm()
    onAdded()
    onOpenChange(false)
    setLoading(false)
  }

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0]

  // Generate duration options (5 minute increments from 15 to 240 minutes)
  const durationOptions = []
  for (let i = 15; i <= 240; i += 5) {
    durationOptions.push(i)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Personal Activity</DialogTitle>
            <DialogDescription>
              Create a scrimmage, lesson, class, or other tennis activity and invite others to join.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Activity Type */}
              <div className="space-y-2">
                <Label htmlFor="activity-type">Activity Type *</Label>
                <Select
                  value={activityType}
                  onValueChange={(value) => setActivityType(value as ActivityType)}
                  required
                >
                  <SelectTrigger id="activity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getActivityTypes().map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Saturday Scrimmage, Tennis Lesson with Coach"
                  required
                />
              </div>

              {/* Optional Team Link */}
              {teams.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="team-link">Link to Team (Optional)</Label>
                  <Select
                    value={selectedTeamId || 'none'}
                    onValueChange={(value) => setSelectedTeamId(value === 'none' ? '' : value)}
                  >
                    <SelectTrigger id="team-link">
                      <SelectValue placeholder="No team link" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No team link</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={today}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time *</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Select
                  value={duration}
                  onValueChange={setDuration}
                >
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {durationOptions.map((mins) => (
                      <SelectItem key={mins} value={mins.toString()}>
                        {mins} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="location">Location</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={locationMode === 'venue' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLocationMode('venue')}
                    >
                      Venue
                    </Button>
                    <Button
                      type="button"
                      variant={locationMode === 'custom' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLocationMode('custom')}
                    >
                      Custom
                    </Button>
                  </div>
                </div>

                {locationMode === 'venue' ? (
                  <div className="space-y-2">
                    <Select
                      value={selectedVenueId || undefined}
                      onValueChange={setSelectedVenueId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a venue" />
                      </SelectTrigger>
                      <SelectContent>
                        {venues.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">No venues available</div>
                        ) : (
                          venues.map((venue) => (
                            <SelectItem key={venue.id} value={venue.id}>
                              {venue.name} {venue.region ? `(${venue.region})` : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowVenueDialog(true)}
                    >
                      Add New Venue
                    </Button>
                  </div>
                ) : (
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter location"
                  />
                )}
              </div>

              {/* Max Attendees and Cost */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-attendees">Max Attendees (Optional)</Label>
                  <Input
                    id="max-attendees"
                    type="number"
                    min="1"
                    value={maxAttendees}
                    onChange={(e) => setMaxAttendees(e.target.value)}
                    placeholder="No limit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost">Cost per Person (Optional)</Label>
                  <Input
                    id="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="$0.00"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add any additional details about this activity..."
                  rows={3}
                />
              </div>

              {/* Recurring Activity Options */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isRecurring"
                    checked={isRecurring}
                    onCheckedChange={(checked) => setIsRecurring(checked === true)}
                  />
                  <Label htmlFor="isRecurring" className="font-normal cursor-pointer">
                    This is a recurring activity
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
                          <SelectItem value="never">Never</SelectItem>
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
                    ) : endType === 'occurrences' ? (
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
                          The activity will repeat {occurrences ? `${occurrences} times` : 'multiple times'} starting from {date}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        The activity will repeat indefinitely
                      </p>
                    )}

                    {recurrencePattern === 'custom' && (
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCustomRecurrenceDialog(true)}
                          className="w-full"
                        >
                          Configure Custom Recurrence
                        </Button>
                        {customRecurrence && (
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>
                              Every {customRecurrence.interval} {customRecurrence.timeUnit}{customRecurrence.interval > 1 ? 's' : ''}
                              {customRecurrence.timeUnit === 'week' && customRecurrence.selectedDays && customRecurrence.selectedDays.length > 0 && (
                                <> on {customRecurrence.selectedDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}</>
                              )}
                            </p>
                            {endType === 'date' && endDate && (
                              <p>Until {format(new Date(endDate), 'MMM d, yyyy')}</p>
                            )}
                            {endType === 'occurrences' && occurrences && (
                              <p>After {occurrences} occurrences</p>
                            )}
                            {endType === 'never' && (
                              <p>No end date</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm()
                  onOpenChange(false)
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Activity'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <VenueDialog
        open={showVenueDialog}
        onOpenChange={setShowVenueDialog}
        venue={null}
        teamId={selectedTeamId || undefined}
        onSaved={() => {
          setShowVenueDialog(false)
          loadVenues()
        }}
      />

      <CustomRecurrenceDialog
        open={showCustomRecurrenceDialog}
        onOpenChange={setShowCustomRecurrenceDialog}
        startDate={date}
        recurrence={customRecurrence}
        endType={endType}
        endDate={endDate}
        occurrences={occurrences}
        onSave={(recurrence, newEndType, newEndDate, newOccurrences) => {
          setCustomRecurrence(recurrence)
          setEndType(newEndType)
          setEndDate(newEndDate)
          setOccurrences(newOccurrences)
        }}
        onDiscard={() => {
          // Reset to defaults
          setCustomRecurrence({
            interval: 1,
            timeUnit: 'week',
            selectedDays: [],
          })
        }}
      />
    </>
  )
}


