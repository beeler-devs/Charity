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
import { Loader2 } from 'lucide-react'
import { getActivityTypeLabel } from '@/lib/event-type-colors'
import { ActivityType } from '@/lib/calendar-utils'
import { getUserActivityTypes, DEFAULT_ACTIVITY_TYPES } from '@/lib/activity-type-utils'
import { PersonalEvent } from '@/types/database.types'
import { RecurrenceSelector } from '@/components/shared/recurrence-selector'
import { LocationSelector } from '@/components/shared/location-selector'
import { generateRecurringDates, RecurrencePattern, RecurrenceEndType, CustomRecurrenceData } from '@/lib/recurrence-utils'

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
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([])
  const [availableActivityTypes, setAvailableActivityTypes] = useState<Array<{ value: ActivityType; label: string }>>(DEFAULT_ACTIVITY_TYPES)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadTeams()
      loadActivityTypes()
      resetForm()
    }
  }, [open])

  async function loadActivityTypes() {
    try {
      const types = await getUserActivityTypes()
      setAvailableActivityTypes(types)
    } catch (error) {
      console.error('Error loading activity types:', error)
      // Fallback to defaults
      setAvailableActivityTypes(DEFAULT_ACTIVITY_TYPES)
    }
  }

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
    setLocationMode('venue')
    setSelectedVenueId(undefined)
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

    // Determine location - LocationSelector already sets the location text when a venue is selected
    const finalLocation = location

    // Generate dates for recurring activities
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
                    {availableActivityTypes.map((type) => (
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
              <LocationSelector
                locationMode={locationMode}
                onLocationModeChange={setLocationMode}
                selectedVenueId={selectedVenueId}
                onVenueChange={setSelectedVenueId}
                customLocation={location}
                onCustomLocationChange={setLocation}
                teamId={selectedTeamId || null}
                canCreateVenue={false}
                onVenueSelected={(venue) => {
                  if (venue) {
                    setLocation(venue.address ? `${venue.name} - ${venue.address}` : venue.name)
                  }
                }}
              />

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
                  showNeverOption={true}
                />
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
    </>
  )
}



