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
import { Loader2, Search, X, UserCheck, UserX } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
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
  const [venueCourtTimes, setVenueCourtTimes] = useState<Array<{ id: string; start_time: string }>>([])
  const [useCourtTime, setUseCourtTime] = useState(false)
  const [creatorIsOrganizer, setCreatorIsOrganizer] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id?: string; email: string; name?: string; isAppUser: boolean; source: 'profile' | 'roster' | 'contact' }>>([])
  const [searching, setSearching] = useState(false)
  const [selectedAttendees, setSelectedAttendees] = useState<Array<{ id?: string; email: string; name?: string; isAppUser: boolean }>>([])
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadTeams()
      loadActivityTypes()
      resetForm()
    }
  }, [open])

  // Load court times when venue is selected
  useEffect(() => {
    if (selectedVenueId && locationMode === 'venue') {
      loadVenueCourtTimes(selectedVenueId)
    } else {
      setVenueCourtTimes([])
      setUseCourtTime(false)
    }
  }, [selectedVenueId, locationMode])

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

  async function loadVenueCourtTimes(venueId: string) {
    if (!venueId) {
      setVenueCourtTimes([])
      return
    }

    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('venue_court_times')
        .select('id, start_time')
        .eq('venue_id', venueId)
        .order('display_order', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        // If table doesn't exist or RLS blocks access, silently fail
        // This allows the app to work even if the migration hasn't been run
        if (error.code === '42P01' || error.code === '42501') {
          console.warn('Court times table not accessible:', error.message)
        } else {
          console.error('Error loading court times:', error)
        }
        setVenueCourtTimes([])
      } else {
        setVenueCourtTimes(data || [])
      }
    } catch (error: any) {
      // Handle network errors and other exceptions
      console.error('Error loading court times:', error)
      setVenueCourtTimes([])
    }
  }

  function formatTimeForDisplay(timeString: string): string {
    // Convert TIME format (HH:MM:SS) to 12-hour format with AM/PM
    try {
      const [hours, minutes] = timeString.split(':')
      const hour = parseInt(hours, 10)
      const minute = parseInt(minutes, 10)
      const date = new Date()
      date.setHours(hour, minute, 0)
      return format(date, 'h:mm a')
    } catch {
      return timeString
    }
  }

  function formatTimeForInput(timeString: string): string {
    // Convert TIME format (HH:MM:SS) to input format (HH:MM)
    const [hours, minutes] = timeString.split(':')
    return `${hours}:${minutes}`
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
    setVenueCourtTimes([])
    setUseCourtTime(false)
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
    setCreatorIsOrganizer(false)
    setSearchQuery('')
    setSearchResults([])
    setSelectedAttendees([])
  }

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        searchUsers(searchQuery.trim())
      }, 300)
      
      return () => clearTimeout(timeoutId)
    } else {
      setSearchResults([])
    }
  }, [searchQuery])

  async function searchUsers(query: string) {
    setSearching(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setSearchResults([])
      setSearching(false)
      return
    }
    
    const searchLower = query.toLowerCase()
    const results: Array<{ id?: string; email: string; name?: string; isAppUser: boolean; source: 'profile' | 'roster' | 'contact' }> = []
    const seenUserIds = new Set<string>()
    const seenEmails = new Set<string>()
    
    // Search profiles (app users)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .or(`full_name.ilike.%${searchLower}%,email.ilike.%${searchLower}%`)
      .limit(10)
    
    if (profiles) {
      profiles.forEach(profile => {
        if (profile.id && profile.email && !seenUserIds.has(profile.id)) {
          results.push({
            id: profile.id,
            email: profile.email,
            name: profile.full_name || undefined,
            isAppUser: true,
            source: 'profile',
          })
          seenUserIds.add(profile.id)
          seenEmails.add(profile.email.toLowerCase())
        }
      })
    }
    
    // Search roster members from user's teams (includes non-app users)
    const { data: userRosterMemberships } = await supabase
      .from('roster_members')
      .select('team_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
    
    if (userRosterMemberships && userRosterMemberships.length > 0) {
      const userTeamIds = userRosterMemberships.map(rm => rm.team_id)
      
      const { data: rosterMembers } = await supabase
        .from('roster_members')
        .select('user_id, email, full_name')
        .in('team_id', userTeamIds)
        .eq('is_active', true)
        .or(`full_name.ilike.%${searchLower}%,email.ilike.%${searchLower}%`)
        .limit(10)
      
      if (rosterMembers) {
        rosterMembers.forEach(rm => {
          const emailLower = rm.email?.toLowerCase()
          if (emailLower && !seenEmails.has(emailLower)) {
            results.push({
              id: rm.user_id || undefined,
              email: rm.email,
              name: rm.full_name || undefined,
              isAppUser: !!rm.user_id,
              source: 'roster',
            })
            if (rm.user_id) seenUserIds.add(rm.user_id)
            seenEmails.add(emailLower)
          }
        })
      }
    }
    
    // Search contacts (user's personal contacts)
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, linked_profile_id')
      .eq('user_id', user.id)
      .or(`name.ilike.%${searchLower}%,email.ilike.%${searchLower}%`)
      .limit(10)
    
    if (contacts) {
      contacts.forEach(contact => {
        const emailLower = contact.email?.toLowerCase()
        if (emailLower && !seenEmails.has(emailLower)) {
          results.push({
            id: contact.linked_profile_id || undefined,
            email: contact.email,
            name: contact.name || undefined,
            isAppUser: !!contact.linked_profile_id,
            source: 'contact',
          })
          if (contact.linked_profile_id) seenUserIds.add(contact.linked_profile_id)
          seenEmails.add(emailLower)
        }
      })
    }
    
    // Sort results: app users first, then by name
    results.sort((a, b) => {
      if (a.isAppUser !== b.isAppUser) {
        return a.isAppUser ? -1 : 1
      }
      return (a.name || a.email).localeCompare(b.name || b.email)
    })
    
    setSearchResults(results)
    setSearching(false)
  }

  function handleSelectAttendee(result: { id?: string; email: string; name?: string; isAppUser: boolean }) {
    // Validate email
    const emailLower = result.email?.toLowerCase().trim()
    if (!emailLower) {
      toast({
        title: 'Invalid email',
        description: 'This contact does not have a valid email address',
        variant: 'destructive',
      })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailLower)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      })
      return
    }

    // Check if already selected
    if (selectedAttendees.some(att => att.email.toLowerCase() === emailLower)) {
      toast({
        title: 'Already selected',
        description: 'This person is already in your list',
        variant: 'default',
      })
      return
    }

    // Add to selected list
    setSelectedAttendees([...selectedAttendees, { ...result, email: emailLower }])
    
    // Clear search
    setSearchQuery('')
    setSearchResults([])
  }

  function removeSelectedAttendee(index: number) {
    setSelectedAttendees(selectedAttendees.filter((_, i) => i !== index))
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

      // Add organizer status
      baseEvent.creator_is_organizer = creatorIsOrganizer

      return baseEvent
    })

    const { data, error } = await supabase
      .from('personal_events')
      .insert(eventsToCreate)
      .select()

    if (error) {
      // Check if error is due to missing recurrence columns or organizer column
      const errorMsg = error.message.toLowerCase()
      if (errorMsg.includes('recurrence') || errorMsg.includes('schema cache') || errorMsg.includes('column') || errorMsg.includes('creator_is_organizer')) {
        toast({
          title: 'Database Schema Error',
          description: 'Please run the required migrations in your Supabase SQL Editor (personal_activities_migration.sql and add_creator_is_organizer_migration.sql).',
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

    // Add attendees to all created events
    if (data && data.length > 0) {
      const attendeesToInsert: any[] = []

      // If creator is not organizer, add them as an attendee
      if (!creatorIsOrganizer) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', user.id)
          .single()

        if (profile) {
          data.forEach(event => {
            attendeesToInsert.push({
              personal_event_id: event.id,
              user_id: user.id,
              email: profile.email,
              name: profile.full_name || null,
              availability_status: 'available',
              added_via: 'self',
            })
          })
        }
      }

      // Get creator's email to avoid duplicates
      let creatorEmail: string | null = null
      if (!creatorIsOrganizer) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.id)
          .single()
        creatorEmail = profile?.email?.toLowerCase() || null
      }

      // Add selected attendees
      selectedAttendees.forEach(attendee => {
        // Validate email before adding
        const emailLower = attendee.email?.toLowerCase().trim()
        if (!emailLower) {
          console.warn('Skipping attendee with empty email:', attendee)
          return
        }

        // Skip if this is the creator (they're already being added)
        if (creatorEmail && emailLower === creatorEmail) {
          console.log('Skipping creator as attendee (already added)')
          return
        }

        data.forEach(event => {
          attendeesToInsert.push({
            personal_event_id: event.id,
            user_id: attendee.isAppUser && attendee.id ? attendee.id : null,
            email: emailLower,
            name: attendee.name?.trim() || null,
            availability_status: 'available',
            added_via: 'direct',
          })
        })
      })

      if (attendeesToInsert.length > 0) {
        const { error: attendeeError, data: insertedAttendees } = await supabase
          .from('event_attendees')
          .insert(attendeesToInsert)
          .select()

        if (attendeeError) {
          console.error('Error adding attendees:', {
            error: attendeeError,
            message: attendeeError.message,
            details: attendeeError.details,
            hint: attendeeError.hint,
            code: attendeeError.code,
            attendeesAttempted: attendeesToInsert.length,
            sampleAttendee: attendeesToInsert[0],
          })
          toast({
            title: 'Warning',
            description: attendeeError.message || 'Activity created but some attendees could not be added',
            variant: 'default',
          })
        } else if (insertedAttendees) {
          console.log(`Successfully added ${insertedAttendees.length} attendee records`)
        }
      }
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
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time *</Label>
                  {/* Court Start Times Picker (if venue has court times) */}
                  {venueCourtTimes.length > 0 && locationMode === 'venue' && (
                    <Select
                      value={(() => {
                        if (!useCourtTime || !time) return 'custom'
                        // Check if current time matches any court time
                        const matchingCourtTime = venueCourtTimes.find(ct => formatTimeForInput(ct.start_time) === time)
                        return matchingCourtTime ? time : 'custom'
                      })()}
                      onValueChange={(value) => {
                        if (value === 'custom') {
                          setUseCourtTime(false)
                        } else {
                          setUseCourtTime(true)
                          setTime(value) // value is already in HH:MM format
                        }
                      }}
                    >
                      <SelectTrigger id="time">
                        <SelectValue placeholder="Select court start time or custom" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Custom Time</SelectItem>
                        {venueCourtTimes.map((courtTime) => {
                          const timeValue = formatTimeForInput(courtTime.start_time)
                          return (
                            <SelectItem key={courtTime.id} value={timeValue}>
                              {formatTimeForDisplay(courtTime.start_time)}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {(!venueCourtTimes.length || locationMode === 'custom' || !useCourtTime) && (
                    <Input
                      id="time"
                      type="time"
                      value={time}
                      onChange={(e) => {
                        setTime(e.target.value)
                        setUseCourtTime(false)
                      }}
                      required
                    />
                  )}
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
                    // Set duration from venue's default court time if available
                    if (venue.default_court_time) {
                      setDuration(venue.default_court_time.toString())
                    }
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

              {/* Organizer Option */}
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="creator-is-organizer"
                  checked={creatorIsOrganizer}
                  onCheckedChange={(checked) => setCreatorIsOrganizer(checked === true)}
                />
                <Label 
                  htmlFor="creator-is-organizer" 
                  className="text-sm font-normal cursor-pointer"
                >
                  I'm organizing this (not participating)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-2 mb-2">
                {creatorIsOrganizer 
                  ? "You'll be listed as the organizer and won't be included in the attendee count."
                  : "You'll be automatically added as an attendee and included in the attendee count."}
              </p>

              {/* Add Attendees Section */}
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Add Attendees (Optional)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                      {searchResults
                        .filter(result => result.email && result.email.trim()) // Filter out results without email
                        .map((result, idx) => {
                          const isAlreadySelected = selectedAttendees.some(att => att.email.toLowerCase() === result.email.toLowerCase())
                          
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelectAttendee(result)}
                              disabled={isAlreadySelected}
                              className={`w-full p-2 flex items-center gap-2 text-left ${
                                isAlreadySelected
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:bg-muted'
                              }`}
                            >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {(result.name || result.email)[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">
                                  {result.name || result.email}
                                </span>
                                {result.isAppUser ? (
                                  <Badge variant="secondary" className="text-xs">
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    App User
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    <UserX className="h-3 w-3 mr-1" />
                                    Not on App
                                  </Badge>
                                )}
                                {isAlreadySelected && (
                                  <Badge variant="default" className="text-xs">
                                    Selected
                                  </Badge>
                                )}
                              </div>
                              {result.name && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {result.email}
                                </p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Selected Attendees List */}
                {selectedAttendees.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Attendees ({selectedAttendees.length})</Label>
                    <div className="border rounded-md max-h-48 overflow-y-auto space-y-1 p-2">
                      {selectedAttendees.map((attendee, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 bg-muted rounded-md"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {(attendee.name || attendee.email)[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {attendee.name || attendee.email}
                            </div>
                            {attendee.name && (
                              <div className="text-sm text-muted-foreground truncate">
                                {attendee.email}
                              </div>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeSelectedAttendee(idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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



