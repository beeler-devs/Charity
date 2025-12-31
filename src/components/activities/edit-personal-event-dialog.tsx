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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Trash2, Search, X, UserCheck, UserX } from 'lucide-react'
import { parseISO, isBefore, format } from 'date-fns'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { PersonalEvent } from '@/types/database.types'
import { ActivityType } from '@/lib/calendar-utils'
import { getUserActivityTypes, DEFAULT_ACTIVITY_TYPES } from '@/lib/activity-type-utils'
import { LocationSelector } from '@/components/shared/location-selector'
import { RecurrenceSelector } from '@/components/shared/recurrence-selector'
import { generateRecurringDates, RecurrencePattern, RecurrenceEndType, CustomRecurrenceData } from '@/lib/recurrence-utils'
import { getEffectiveUserId } from '@/lib/impersonation'

interface EditPersonalEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: PersonalEvent | null
  onUpdated: () => void
  initialEditScope?: 'single' | 'all' | 'future'
}

export function EditPersonalEventDialog({
  open,
  onOpenChange,
  activity,
  onUpdated,
  initialEditScope,
}: EditPersonalEventDialogProps) {
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
  const [editScope, setEditScope] = useState<'single' | 'all' | 'future'>('single')
  const [seriesActivities, setSeriesActivities] = useState<PersonalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [showDeleteSeriesDialog, setShowDeleteSeriesDialog] = useState(false)
  const [deletingSeries, setDeletingSeries] = useState(false)
  const [showScopeDialog, setShowScopeDialog] = useState(false)
  const [showInitialScopeDialog, setShowInitialScopeDialog] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<any>(null)
  const [availableActivityTypes, setAvailableActivityTypes] = useState<Array<{ value: ActivityType; label: string }>>(DEFAULT_ACTIVITY_TYPES)
  const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>(undefined)
  const [locationMode, setLocationMode] = useState<'venue' | 'custom'>('venue')
  const [customLocationName, setCustomLocationName] = useState('')
  const [customLocationAddress, setCustomLocationAddress] = useState('')
  const [customLocationMapsLink, setCustomLocationMapsLink] = useState('')
  const [venues, setVenues] = useState<Array<{ id: string; name: string; address: string | null; region?: string | null }>>([])
  const [loadingVenues, setLoadingVenues] = useState(false)
  const [selectedAttendees, setSelectedAttendees] = useState<Array<{ id?: string; email: string; name?: string; isAppUser: boolean }>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id?: string; email: string; name?: string; isAppUser: boolean; source: 'profile' | 'roster' | 'contact' }>>([])
  const [searching, setSearching] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadActivityTypes()
      loadVenues().then(() => {
        // After venues are loaded, we can properly parse location
        if (activity) {
          loadExistingAttendees()
        }
      })
    }
  }, [open])

  useEffect(() => {
    if (activity && open) {
      const hasSeriesId = activity.recurrence_series_id
      
      // Show initial scope dialog if this is a recurring activity and no initial scope was provided
      if (hasSeriesId && !initialEditScope) {
        setShowInitialScopeDialog(true)
        // Still load basic data for display
        loadActivityData()
        return
      }
      
      // Load all data
      loadActivityData()
    }
  }, [activity, open, initialEditScope])

  async function loadActivityData() {
    if (!activity) return
    
    // Ensure venues are loaded first
    const loadedVenues = venues.length > 0 ? venues : await loadVenues()
    
    setTitle(activity.title || '')
    setActivityType(activity.activity_type || 'other')
    setDate(activity.date || '')
    setTime(activity.time || '')
    setDuration(activity.duration?.toString() || '60')
    setDescription(activity.description || '')
    setMaxAttendees(activity.max_attendees?.toString() || '')
    setCost(activity.cost?.toString() || '')
    setSelectedTeamId(activity.team_id || '')
    
    // Parse location - check if it's a venue or custom
    const locationText = activity.location || ''
    if (locationText) {
      // Try to find matching venue
      const matchingVenue = loadedVenues.find(v => 
        locationText.includes(v.name) || 
        (v.address && locationText.includes(v.address))
      )
      if (matchingVenue) {
        setSelectedVenueId(matchingVenue.id)
        setLocationMode('venue')
        setLocation(locationText)
      } else {
        // It's a custom location - parse it
        setLocationMode('custom')
        // Try to parse custom location fields (format: "Name|Address|MapsLink")
        const parts = locationText.split('|')
        if (parts.length >= 3) {
          setCustomLocationName(parts[0] || '')
          setCustomLocationAddress(parts[1] || '')
          setCustomLocationMapsLink(parts[2] || '')
        } else {
          setCustomLocationName(locationText)
          setCustomLocationAddress('')
          setCustomLocationMapsLink('')
        }
        setLocation(locationText)
      }
    } else {
      setLocationMode('venue')
      setCustomLocationName('')
      setCustomLocationAddress('')
      setCustomLocationMapsLink('')
    }
    
    // Check if this is part of a recurring series
    const hasSeriesId = activity.recurrence_series_id
    setIsRecurring(!!hasSeriesId)
    
    if (hasSeriesId) {
      setRecurrencePattern(activity.recurrence_pattern || 'weekly')
      if (activity.recurrence_end_date) {
        setEndType('date')
        setEndDate(activity.recurrence_end_date)
      } else if (activity.recurrence_occurrences) {
        setEndType('occurrences')
        setOccurrences(activity.recurrence_occurrences.toString())
      } else {
        setEndType('never')
      }
      if (activity.recurrence_custom_data) {
        setCustomRecurrence(activity.recurrence_custom_data as CustomRecurrenceData)
      }
      loadSeriesActivities(activity.recurrence_series_id!)
      
      // Use initialEditScope if provided
      if (initialEditScope) {
        setEditScope(initialEditScope)
      } else {
        // Determine if activity has passed
        const activityDate = parseISO(activity.date)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        if (isBefore(activityDate, today)) {
          setEditScope('all')
        } else {
          setEditScope('single')
        }
      }
    } else {
      setEditScope('single')
    }
  }

  async function loadActivityTypes() {
    try {
      const types = await getUserActivityTypes()
      setAvailableActivityTypes(types)
    } catch (error) {
      console.error('Error loading activity types:', error)
      setAvailableActivityTypes(DEFAULT_ACTIVITY_TYPES)
    }
  }

  async function loadSeriesActivities(seriesId: string) {
    if (!seriesId) return
    
    const supabase = createClient()
    const { data, error } = await supabase
      .from('personal_events')
      .select('*')
      .eq('recurrence_series_id', seriesId)
      .order('date', { ascending: true })
    
    if (error) {
      console.warn('Error loading series activities:', error.message)
      setSeriesActivities([])
    } else if (data) {
      setSeriesActivities(data as PersonalEvent[])
    }
  }

  async function loadVenues() {
    setLoadingVenues(true)
    const supabase = createClient()
    
    try {
      // Load system-wide active venues
      const { data: systemVenues } = await supabase
        .from('venues')
        .select('*')
        .is('team_id', null)
        .eq('is_active', true)
        .order('region', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true })

      // Load team-specific venues if teamId is provided
      let teamVenues: any[] = []
      const teamIdToUse = activity?.team_id || selectedTeamId
      if (teamIdToUse) {
        const { data } = await supabase
          .from('venues')
          .select('*')
          .eq('team_id', teamIdToUse)
          .order('name', { ascending: true })
        teamVenues = data || []
      }

      const allVenues = [
        ...(systemVenues || []),
        ...teamVenues
      ]

      setVenues(allVenues)
      return allVenues
    } catch (error) {
      console.error('Error loading venues:', error)
      setVenues([])
      return []
    } finally {
      setLoadingVenues(false)
    }
  }

  async function loadExistingAttendees() {
    if (!activity) return
    
    const supabase = createClient()
    const { data: attendees } = await supabase
      .from('event_attendees')
      .select('*, profiles(full_name)')
      .eq('personal_event_id', activity.id)
      .order('created_at', { ascending: true })

    if (attendees) {
      const formatted = attendees.map((att: any) => ({
        id: att.user_id || undefined,
        email: att.email,
        name: att.name || att.profiles?.full_name || undefined,
        isAppUser: !!att.user_id,
      }))
      setSelectedAttendees(formatted)
    }
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
    
    // Search roster members from user's teams
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
    
    // Search contacts
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
    const emailLower = result.email?.toLowerCase().trim()
    if (!emailLower) {
      toast({
        title: 'Invalid email',
        description: 'This contact does not have a valid email address',
        variant: 'destructive',
      })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailLower)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      })
      return
    }

    if (selectedAttendees.some(att => att.email.toLowerCase() === emailLower)) {
      toast({
        title: 'Already selected',
        description: 'This person is already in your list',
        variant: 'default',
      })
      return
    }

    setSelectedAttendees([...selectedAttendees, { ...result, email: emailLower }])
    setSearchQuery('')
    setSearchResults([])
  }

  function handleRemoveAttendee(index: number) {
    setSelectedAttendees(selectedAttendees.filter((_, i) => i !== index))
  }

  async function updateAttendees(eventId: string, attendees: Array<{ id?: string; email: string; name?: string; isAppUser: boolean }>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    // Get current attendees
    const { data: existingAttendees } = await supabase
      .from('event_attendees')
      .select('id, email, user_id')
      .eq('personal_event_id', eventId)

    const existingEmails = new Set((existingAttendees || []).map((a: any) => a.email.toLowerCase()))
    const newAttendeeEmails = new Set(attendees.map(a => a.email.toLowerCase()))

    // Remove attendees that are no longer in the list
    const toRemove = (existingAttendees || []).filter((a: any) => !newAttendeeEmails.has(a.email.toLowerCase()))
    if (toRemove.length > 0) {
      await supabase
        .from('event_attendees')
        .delete()
        .in('id', toRemove.map((a: any) => a.id))
    }

    // Add new attendees
    const toAdd = attendees.filter(a => !existingEmails.has(a.email.toLowerCase()))
    if (toAdd.length > 0) {
      const attendeesToInsert = toAdd.map(attendee => ({
        personal_event_id: eventId,
        user_id: attendee.id || null,
        email: attendee.email.toLowerCase(),
        name: attendee.name || null,
        availability_status: 'available',
        added_via: 'direct',
      }))

      await supabase
        .from('event_attendees')
        .insert(attendeesToInsert)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title || !date || !time || !activityType) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields (Title, Date, Time, Activity Type)',
        variant: 'destructive',
      })
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
          return
        }
      }

      if (endType === 'date' && !endDate) {
        toast({
          title: 'Error',
          description: 'Please specify an end date for the recurring activity',
          variant: 'destructive',
        })
        return
      }

      if (endType === 'occurrences' && (!occurrences || parseInt(occurrences) < 2)) {
        toast({
          title: 'Error',
          description: 'Please specify at least 2 occurrences for the recurring activity',
          variant: 'destructive',
        })
        return
      }
    }

    // Build location string based on mode
    let finalLocation = ''
    if (locationMode === 'venue' && selectedVenueId) {
      const venue = venues.find(v => v.id === selectedVenueId)
      if (venue) {
        finalLocation = venue.address ? `${venue.name} - ${venue.address}` : venue.name
      }
    } else if (locationMode === 'custom') {
      // Format: "Name|Address|MapsLink"
      const parts = [customLocationName, customLocationAddress, customLocationMapsLink].filter(Boolean)
      finalLocation = parts.join('|')
    }

    // Check if we're converting a single activity to recurring
    const isConvertingToRecurring = isRecurring && activity && !activity.recurrence_series_id

    // If this is a recurring activity (existing series), show scope dialog for any changes
    // This includes adding attendees, changing recurrence settings, etc.
    if (isRecurring && activity && activity.recurrence_series_id) {
      setPendingChanges({
        title,
        activityType,
        date,
        time,
        duration,
        location: finalLocation,
        description,
        maxAttendees,
        cost,
        selectedTeamId,
        recurrencePattern,
        endType,
        endDate,
        occurrences,
        customRecurrence,
        selectedAttendees,
        isConvertingToRecurring,
      })
      setShowScopeDialog(true)
      return
    }

    // If converting single to recurring, handle that separately
    if (isConvertingToRecurring) {
      await convertToRecurring(finalLocation)
      return
    }

    // For single occurrence, update directly
    setPendingChanges(null)
    await applyChanges('single', finalLocation)
  }

  async function convertToRecurring(locationValue: string) {
    if (!activity) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
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

      const effectiveUserId = getEffectiveUserId(user.id)

      if (activity.creator_id !== effectiveUserId) {
        toast({
          title: 'Permission denied',
          description: 'Only the creator can edit this activity',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      // Generate recurring dates
      const dates = generateRecurringDates(
        date,
        recurrencePattern,
        endType,
        endType === 'date' ? endDate : undefined,
        endType === 'occurrences' ? parseInt(occurrences) : undefined,
        recurrencePattern === 'custom' ? customRecurrence : undefined
      )

      // Generate a unique series ID
      const recurrenceSeriesId = crypto.randomUUID()

      // Update the current activity to be part of the series
      const updateData: any = {
        title,
        activity_type: activityType,
        date,
        time,
        duration: duration ? parseInt(duration) : null,
        location: locationValue || null,
        description: description || null,
        max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
        cost: cost ? parseFloat(cost) : null,
        team_id: selectedTeamId || null,
        recurrence_series_id: recurrenceSeriesId,
        recurrence_original_date: date,
        recurrence_pattern: recurrencePattern,
      }

      if (endType === 'date') {
        updateData.recurrence_end_date = endDate
      } else if (endType === 'occurrences') {
        updateData.recurrence_occurrences = parseInt(occurrences)
      }

      if (recurrencePattern === 'custom') {
        updateData.recurrence_custom_data = customRecurrence
      }

      // Load existing attendees from the original activity
      const { data: existingAttendees } = await supabase
        .from('event_attendees')
        .select('user_id, email, name, availability_status, added_via')
        .eq('personal_event_id', activity.id)

      // Combine existing attendees with newly selected ones (avoid duplicates)
      const allAttendees = [...selectedAttendees]
      const existingEmails = new Set(selectedAttendees.map(a => a.email.toLowerCase()))
      
      if (existingAttendees) {
        existingAttendees.forEach((att: any) => {
          const emailLower = att.email?.toLowerCase()
          if (emailLower && !existingEmails.has(emailLower)) {
            allAttendees.push({
              id: att.user_id || undefined,
              email: att.email,
              name: att.name || undefined,
              isAppUser: !!att.user_id,
            })
            existingEmails.add(emailLower)
          }
        })
      }

      // Update the current activity
      const { error: updateError } = await supabase
        .from('personal_events')
        .update(updateData)
        .eq('id', activity.id)

      if (updateError) {
        toast({
          title: 'Error',
          description: updateError.message,
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      // Create additional activities for remaining dates (skip the first date as it's the current activity)
      const remainingDates = dates.slice(1)
      if (remainingDates.length > 0) {
        const eventsToCreate = remainingDates.map((eventDate) => {
          const baseEvent: Partial<PersonalEvent> = {
            creator_id: effectiveUserId,
            team_id: selectedTeamId || null,
            activity_type: activityType,
            title,
            date: eventDate,
            time,
            duration: duration ? parseInt(duration) : null,
            location: locationValue || null,
            description: description || null,
            max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
            cost: cost ? parseFloat(cost) : null,
            recurrence_series_id: recurrenceSeriesId,
            recurrence_original_date: date,
            recurrence_pattern: recurrencePattern,
          }

          if (endType === 'date') {
            baseEvent.recurrence_end_date = endDate
          } else if (endType === 'occurrences') {
            baseEvent.recurrence_occurrences = parseInt(occurrences)
          }

          if (recurrencePattern === 'custom') {
            baseEvent.recurrence_custom_data = customRecurrence
          }

          return baseEvent
        })

        const { data: createdEvents, error: createError } = await supabase
          .from('personal_events')
          .insert(eventsToCreate)
          .select()

        if (createError) {
          toast({
            title: 'Error',
            description: `Activity updated but failed to create recurring events: ${createError.message}`,
            variant: 'destructive',
          })
          setLoading(false)
          return
        }

        // Add all attendees (existing + newly selected) to all events in the series
        if (allAttendees.length > 0) {
          const attendeesToInsert: any[] = []
          
          // Add to the updated activity (only if not already there)
          const { data: currentAttendees } = await supabase
            .from('event_attendees')
            .select('email')
            .eq('personal_event_id', activity.id)
          
          const currentAttendeeEmails = new Set((currentAttendees || []).map((a: any) => a.email?.toLowerCase()))
          
          allAttendees.forEach(attendee => {
            const emailLower = attendee.email.toLowerCase()
            if (!currentAttendeeEmails.has(emailLower)) {
              attendeesToInsert.push({
                personal_event_id: activity.id,
                user_id: attendee.id || null,
                email: emailLower,
                name: attendee.name || null,
                availability_status: 'available',
                added_via: 'direct',
              })
            }
          })

          // Add to all newly created activities
          if (createdEvents) {
            createdEvents.forEach(event => {
              allAttendees.forEach(attendee => {
                attendeesToInsert.push({
                  personal_event_id: event.id,
                  user_id: attendee.id || null,
                  email: attendee.email.toLowerCase(),
                  name: attendee.name || null,
                  availability_status: 'available',
                  added_via: 'direct',
                })
              })
            })
          }

          if (attendeesToInsert.length > 0) {
            const { error: attendeeError } = await supabase
              .from('event_attendees')
              .insert(attendeesToInsert)

            if (attendeeError) {
              console.error('Error adding attendees to recurring events:', attendeeError)
              // Don't fail the whole operation, just log the error
            }
          }
        }
      } else {
        // No additional dates, just ensure all attendees are on the current activity
        if (allAttendees.length > 0) {
          await updateAttendees(activity.id, allAttendees)
        }
      }

      toast({
        title: 'Activity converted to recurring',
        description: `Created ${dates.length} recurring activit${dates.length > 1 ? 'ies' : 'y'}.`,
      })
      onUpdated()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to convert activity to recurring',
        variant: 'destructive',
      })
    }

    setLoading(false)
  }

  async function applyChanges(scope: 'single' | 'all' | 'future', locationValue?: string) {
    if (!activity) {
      setLoading(false)
      return
    }

    setLoading(true)
    
    // Use pending changes if available (from scope dialog), otherwise use current form values
    const changes = pendingChanges || {
      title,
      activityType,
      date,
      time,
      duration,
      location: locationValue || location,
      description,
      maxAttendees,
      cost,
      selectedTeamId,
      recurrencePattern,
      endType,
      endDate,
      occurrences,
      customRecurrence,
      selectedAttendees,
    }

    try {
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

      const effectiveUserId = getEffectiveUserId(user.id)

      if (activity.creator_id !== effectiveUserId) {
        toast({
          title: 'Permission denied',
          description: 'Only the creator can edit this activity',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      const activityDate = parseISO(activity.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const isPastActivity = isBefore(activityDate, today)

      if (scope === 'single' || !isRecurring) {
        // Edit single activity only
        const updateData: any = {
          title: changes.title,
          activity_type: changes.activityType,
          date: changes.date,
          time: changes.time,
          duration: changes.duration ? parseInt(changes.duration) : null,
          location: changes.location || null,
          description: changes.description || null,
          max_attendees: changes.maxAttendees ? parseInt(changes.maxAttendees) : null,
          cost: changes.cost ? parseFloat(changes.cost) : null,
          team_id: changes.selectedTeamId || null,
        }

        const { error } = await supabase
          .from('personal_events')
          .update(updateData)
          .eq('id', activity.id)

        if (error) {
          toast({
            title: 'Error',
            description: error.message,
            variant: 'destructive',
          })
          setLoading(false)
          return
        }

        // Update attendees if provided
        if (changes.selectedAttendees && Array.isArray(changes.selectedAttendees)) {
          await updateAttendees(activity.id, changes.selectedAttendees)
        }

        toast({
          title: 'Activity updated',
          description: 'The activity has been updated successfully',
        })
        onUpdated()
        onOpenChange(false)
      } else if (scope === 'all') {
        // Edit all activities in the series
        const seriesId = activity.recurrence_series_id || crypto.randomUUID()
        
        // Get the original date from the activity (first occurrence)
        const originalDate = activity.recurrence_original_date || activity.date
        
        // Check if number of occurrences changed
        const oldOccurrences = activity.recurrence_occurrences
        const newOccurrences = changes.endType === 'occurrences' && changes.occurrences 
          ? parseInt(changes.occurrences) 
          : null
        
        // Generate new dates if occurrences changed
        let newDates: string[] = []
        if (newOccurrences && newOccurrences !== oldOccurrences) {
          newDates = generateRecurringDates(
            originalDate,
            changes.recurrencePattern || activity.recurrence_pattern || 'weekly',
            changes.endType || 'occurrences',
            undefined, // endDate not used when occurrences is set
            newOccurrences,
            changes.recurrencePattern === 'custom' && changes.customRecurrence 
              ? changes.customRecurrence 
              : (activity.recurrence_custom_data as CustomRecurrenceData | undefined)
          )
        }
        
        // Get existing activities in the series
        const { data: existingEvents } = await supabase
          .from('personal_events')
          .select('id, date')
          .eq('recurrence_series_id', seriesId)
          .order('date', { ascending: true })
        
        // Update all activities in the series
        const updateData: any = {
          title: changes.title,
          activity_type: changes.activityType,
          time: changes.time,
          duration: changes.duration ? parseInt(changes.duration) : null,
          location: changes.location || null,
          description: changes.description || null,
          max_attendees: changes.maxAttendees ? parseInt(changes.maxAttendees) : null,
          cost: changes.cost ? parseFloat(changes.cost) : null,
          team_id: changes.selectedTeamId || null,
        }

        // Always update recurrence fields if this is a recurring series
        // This ensures changes to recurrence pattern, end type, occurrences, etc. are saved
        if (changes.recurrencePattern) {
          updateData.recurrence_pattern = changes.recurrencePattern
        }
        if (changes.endType === 'date' && changes.endDate) {
          updateData.recurrence_end_date = changes.endDate
          updateData.recurrence_occurrences = null
        } else if (changes.endType === 'occurrences' && changes.occurrences) {
          updateData.recurrence_occurrences = parseInt(changes.occurrences)
          updateData.recurrence_end_date = null
        } else if (changes.endType === 'never') {
          updateData.recurrence_end_date = null
          updateData.recurrence_occurrences = null
        }
        if (changes.recurrencePattern === 'custom' && changes.customRecurrence) {
          updateData.recurrence_custom_data = changes.customRecurrence
        }

        // Update existing activities
        const { error: updateError } = await supabase
          .from('personal_events')
          .update(updateData)
          .eq('recurrence_series_id', seriesId)

        if (updateError) {
          toast({
            title: 'Error',
            description: updateError.message,
            variant: 'destructive',
          })
          setLoading(false)
          return
        }

        // Handle changes to number of occurrences
        if (newOccurrences && newOccurrences !== oldOccurrences && newDates.length > 0) {
          const existingDates = new Set((existingEvents || []).map((e: any) => e.date))
          const newDatesSet = new Set(newDates)
          
          // Find dates that need to be created (in newDates but not in existingDates)
          const datesToCreate = newDates.filter(d => !existingDates.has(d))
          
          // Find activities that should be deleted (in existingDates but not in newDates)
          // Only delete if they're in the future and have no attendees
          const datesToDelete = (existingEvents || [])
            .filter((e: any) => !newDatesSet.has(e.date))
            .map((e: any) => e.id)
          
          // Create new activities for additional dates
          if (datesToCreate.length > 0) {
            const eventsToCreate = datesToCreate.map((eventDate) => {
              const baseEvent: Partial<PersonalEvent> = {
                creator_id: effectiveUserId,
                team_id: changes.selectedTeamId || null,
                activity_type: changes.activityType,
                title: changes.title,
                date: eventDate,
                time: changes.time,
                duration: changes.duration ? parseInt(changes.duration) : null,
                location: changes.location || null,
                description: changes.description || null,
                max_attendees: changes.maxAttendees ? parseInt(changes.maxAttendees) : null,
                cost: changes.cost ? parseFloat(changes.cost) : null,
                recurrence_series_id: seriesId,
                recurrence_original_date: originalDate,
                recurrence_pattern: changes.recurrencePattern || activity.recurrence_pattern || 'weekly',
              }

              if (changes.endType === 'date' && changes.endDate) {
                baseEvent.recurrence_end_date = changes.endDate
              } else if (changes.endType === 'occurrences' && changes.occurrences) {
                baseEvent.recurrence_occurrences = parseInt(changes.occurrences)
              }

              if (changes.recurrencePattern === 'custom' && changes.customRecurrence) {
                baseEvent.recurrence_custom_data = changes.customRecurrence
              }

              return baseEvent
            })

            const { data: createdEvents, error: createError } = await supabase
              .from('personal_events')
              .insert(eventsToCreate)
              .select()

            if (createError) {
              console.error('Error creating new activities:', createError)
              toast({
                title: 'Warning',
                description: `Activities updated but failed to create ${datesToCreate.length} new activit${datesToCreate.length > 1 ? 'ies' : 'y'}`,
                variant: 'default',
              })
            } else if (createdEvents && changes.selectedAttendees && Array.isArray(changes.selectedAttendees)) {
              // Add attendees to newly created activities
              const attendeesToInsert: any[] = []
              createdEvents.forEach(event => {
                changes.selectedAttendees.forEach(attendee => {
                  attendeesToInsert.push({
                    personal_event_id: event.id,
                    user_id: attendee.id || null,
                    email: attendee.email.toLowerCase(),
                    name: attendee.name || null,
                    availability_status: 'available',
                    added_via: 'direct',
                  })
                })
              })

              if (attendeesToInsert.length > 0) {
                await supabase
                  .from('event_attendees')
                  .insert(attendeesToInsert)
              }
            }
          }

          // Delete excess activities (only future ones without attendees)
          if (datesToDelete.length > 0) {
            // Check which ones have attendees
            const { data: attendeesCheck } = await supabase
              .from('event_attendees')
              .select('personal_event_id')
              .in('personal_event_id', datesToDelete)
            
            const eventsWithAttendees = new Set((attendeesCheck || []).map((a: any) => a.personal_event_id))
            const safeToDelete = datesToDelete.filter(id => !eventsWithAttendees.has(id))
            
            if (safeToDelete.length > 0) {
              const { error: deleteError } = await supabase
                .from('personal_events')
                .delete()
                .in('id', safeToDelete)
              
              if (deleteError) {
                console.error('Error deleting excess activities:', deleteError)
              }
            }
          }
        }

        // Update attendees for all activities in series if provided
        if (changes.selectedAttendees && Array.isArray(changes.selectedAttendees)) {
          const { data: seriesEvents } = await supabase
            .from('personal_events')
            .select('id')
            .eq('recurrence_series_id', seriesId)
          
          if (seriesEvents) {
            for (const event of seriesEvents) {
              await updateAttendees(event.id, changes.selectedAttendees)
            }
          }
        }

        toast({
          title: 'Series updated',
          description: `All activities in the series have been updated successfully`,
        })
        onUpdated()
        onOpenChange(false)
      } else if (scope === 'future') {
        // Edit all future activities in the series
        const seriesId = activity.recurrence_series_id || crypto.randomUUID()
        
        // Get all future activities (including current if not past)
        const futureActivities = seriesActivities.filter(a => {
          const aDate = parseISO(a.date)
          return !isBefore(aDate, today) || a.id === activity.id
        })

        // Update future activities
        const updateData: any = {
          title: changes.title,
          activity_type: changes.activityType,
          time: changes.time,
          duration: changes.duration ? parseInt(changes.duration) : null,
          location: changes.location || null,
          description: changes.description || null,
          max_attendees: changes.maxAttendees ? parseInt(changes.maxAttendees) : null,
          cost: changes.cost ? parseFloat(changes.cost) : null,
          team_id: changes.selectedTeamId || null,
        }

        // Always update recurrence fields if this is a recurring series
        // This ensures changes to recurrence pattern, end type, occurrences, etc. are saved
        if (changes.recurrencePattern) {
          updateData.recurrence_pattern = changes.recurrencePattern
        }
        if (changes.endType === 'date' && changes.endDate) {
          updateData.recurrence_end_date = changes.endDate
          updateData.recurrence_occurrences = null
        } else if (changes.endType === 'occurrences' && changes.occurrences) {
          updateData.recurrence_occurrences = parseInt(changes.occurrences)
          updateData.recurrence_end_date = null
        } else if (changes.endType === 'never') {
          updateData.recurrence_end_date = null
          updateData.recurrence_occurrences = null
        }
        if (changes.recurrencePattern === 'custom' && changes.customRecurrence) {
          updateData.recurrence_custom_data = changes.customRecurrence
        }

        const futureActivityIds = futureActivities.map(a => a.id)
        if (futureActivityIds.length > 0) {
          const { error } = await supabase
            .from('personal_events')
            .update(updateData)
            .in('id', futureActivityIds)

          if (error) {
            toast({
              title: 'Error',
              description: error.message,
              variant: 'destructive',
            })
            setLoading(false)
            return
          }

          // Update attendees for future activities if provided
          if (changes.selectedAttendees && Array.isArray(changes.selectedAttendees)) {
            for (const eventId of futureActivityIds) {
              await updateAttendees(eventId, changes.selectedAttendees)
            }
          }

          toast({
            title: 'Future activities updated',
            description: `${futureActivityIds.length} future activit${futureActivityIds.length > 1 ? 'ies' : 'y'} have been updated successfully`,
          })
          onUpdated()
          onOpenChange(false)
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update activity',
        variant: 'destructive',
      })
    }

    setLoading(false)
    setPendingChanges(null)
    setShowScopeDialog(false)
  }

  async function updateSingleActivity() {
    if (!activity) return

    setLoading(true)
    try {
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

      const effectiveUserId = getEffectiveUserId(user.id)

      if (activity.creator_id !== effectiveUserId) {
        toast({
          title: 'Permission denied',
          description: 'Only the creator can edit this activity',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      const updateData: any = {
        title,
        activity_type: activityType,
        date,
        time,
        duration: duration ? parseInt(duration) : null,
        location: location || null,
        description: description || null,
        max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
        cost: cost ? parseFloat(cost) : null,
        team_id: selectedTeamId || null,
      }

      const { error } = await supabase
        .from('personal_events')
        .update(updateData)
        .eq('id', activity.id)

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Activity updated',
          description: 'The activity has been updated successfully',
        })
        onUpdated()
        onOpenChange(false)
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update activity',
        variant: 'destructive',
      })
    }

    setLoading(false)
  }

  async function handleDeleteSeries() {
    if (!activity) return

    setDeletingSeries(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in',
        variant: 'destructive',
      })
      setDeletingSeries(false)
      return
    }

    const effectiveUserId = getEffectiveUserId(user.id)

    if (activity.creator_id !== effectiveUserId) {
      toast({
        title: 'Permission denied',
        description: 'Only the creator can delete this series',
        variant: 'destructive',
      })
      setDeletingSeries(false)
      return
    }

    const seriesId = activity.recurrence_series_id
    if (!seriesId) {
      setDeletingSeries(false)
      return
    }

    const { error } = await supabase
      .from('personal_events')
      .delete()
      .eq('recurrence_series_id', seriesId)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Series deleted',
        description: 'The entire series has been deleted successfully',
      })
      onUpdated()
      onOpenChange(false)
    }

    setDeletingSeries(false)
    setShowDeleteSeriesDialog(false)
  }

  const isPartOfSeries = isRecurring && seriesActivities.length > 1
  const activityDate = activity ? parseISO(activity.date) : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isPastActivity = activityDate ? isBefore(activityDate, today) : false

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Activity</DialogTitle>
            <DialogDescription>
              {isPartOfSeries && !isPastActivity
                ? 'Update this activity or all activities in the series'
                : 'Update activity details'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Scrimmage, Lesson, etc."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Activity Type */}
            <div className="space-y-2">
              <Label htmlFor="activityType">
                Activity Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={activityType}
                onValueChange={(value) => setActivityType(value as ActivityType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select activity type" />
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

            <div className="grid grid-cols-3 gap-4">
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
                <Label htmlFor="time">
                  Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="15"
                  step="15"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="60"
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select
                value={locationMode === 'venue' ? (selectedVenueId || '') : 'custom'}
                onValueChange={(value) => {
                  if (value === 'custom') {
                    setLocationMode('custom')
                    setSelectedVenueId(undefined)
                  } else {
                    setLocationMode('venue')
                    setSelectedVenueId(value)
                    const venue = venues.find(v => v.id === value)
                    if (venue) {
                      setLocation(venue.address ? `${venue.name} - ${venue.address}` : venue.name)
                    }
                  }
                }}
                disabled={loadingVenues}
              >
                <SelectTrigger id="location" className="w-full">
                  <SelectValue placeholder={loadingVenues ? "Loading venues..." : "Select venue or custom location"} />
                </SelectTrigger>
                <SelectContent>
                  {venues.length > 0 && (
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
                      {selectedTeamId && venues.filter(v => v.team_id === selectedTeamId).length > 0 && (
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
                      <div className="border-t my-1" />
                    </>
                  )}
                  <SelectItem value="custom">Custom Location</SelectItem>
                </SelectContent>
              </Select>

              {/* Custom Location Fields */}
              {locationMode === 'custom' && (
                <div className="space-y-2 mt-2">
                  <Input
                    placeholder="Location name (e.g., Court 5, Restaurant Name)"
                    value={customLocationName}
                    onChange={(e) => setCustomLocationName(e.target.value)}
                  />
                  <Input
                    placeholder="Address (optional)"
                    value={customLocationAddress}
                    onChange={(e) => setCustomLocationAddress(e.target.value)}
                  />
                  <Input
                    placeholder="Google Maps link (optional)"
                    value={customLocationMapsLink}
                    onChange={(e) => setCustomLocationMapsLink(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add any additional details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Max Attendees */}
              <div className="space-y-2">
                <Label htmlFor="maxAttendees">Max Attendees</Label>
                <Input
                  id="maxAttendees"
                  type="number"
                  min="1"
                  value={maxAttendees}
                  onChange={(e) => setMaxAttendees(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              {/* Cost */}
              <div className="space-y-2">
                <Label htmlFor="cost">Cost ($)</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Recurrence Selector (always shown, allows converting single to recurring) */}
            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <Label className="text-base font-semibold">Recurrence Settings</Label>
              {isRecurring ? (
                <p className="text-xs text-muted-foreground mb-3">
                  Changes to recurrence settings will apply to the entire series when you save.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mb-3">
                  Enable recurrence to convert this single activity into a recurring series.
                </p>
              )}
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
                      .filter(result => result.email && result.email.trim())
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

                {/* Selected Attendees */}
                {selectedAttendees.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Selected Attendees ({selectedAttendees.length})</Label>
                    <div className="space-y-1">
                      {selectedAttendees.map((attendee, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 border rounded-md bg-background"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {(attendee.name || attendee.email)[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {attendee.name || attendee.email}
                            </p>
                            {attendee.name && (
                              <p className="text-xs text-muted-foreground truncate">
                                {attendee.email}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveAttendee(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recurring Activity Message (moved to bottom) */}
            {isRecurring && (
              <div className="space-y-3 p-4 bg-muted rounded-lg border-2 border-primary/20">
                <Label className="text-base font-semibold">Recurring Activity</Label>
                <p className="text-sm text-muted-foreground">
                  This is part of a recurring series. After making changes, you'll be asked whether to apply them to this occurrence, all occurrences, or only future occurrences.
                </p>
                {seriesActivities.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Series contains {seriesActivities.length} activit{seriesActivities.length > 1 ? 'ies' : 'y'}
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {isRecurring && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteSeriesDialog(true)}
                  disabled={loading || deletingSeries}
                >
                  {deletingSeries ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </>
                  )}
                </Button>
              )}
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Initial Scope Selection Dialog */}
      <AlertDialog open={showInitialScopeDialog} onOpenChange={(open) => {
        if (!open) {
          onOpenChange(false)
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Activity</AlertDialogTitle>
            <AlertDialogDescription>
              This is a recurring activity. Would you like to edit this specific occurrence or the entire series?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setEditScope('single')
                setShowInitialScopeDialog(false)
                if (activity) {
                  loadActivityData()
                }
              }}
            >
              This occurrence only
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setEditScope('all')
                setShowInitialScopeDialog(false)
                if (activity) {
                  loadActivityData()
                }
              }}
            >
              Entire series
              {seriesActivities.length > 0 && (
                <span className="ml-2 text-muted-foreground">
                  ({seriesActivities.length} activities)
                </span>
              )}
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowInitialScopeDialog(false)
              onOpenChange(false)
            }}>
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scope Selection Dialog (for series editing - shows all vs future) */}
      <AlertDialog open={showScopeDialog} onOpenChange={setShowScopeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Changes To</AlertDialogTitle>
            <AlertDialogDescription>
              You're editing the series. Choose how to apply your changes:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Button
              variant={editScope === 'future' ? 'default' : 'outline'}
              className="w-full justify-start"
              onClick={async () => {
                setEditScope('future')
                await applyChanges('future')
              }}
              disabled={loading}
            >
              All future occurrences
              {seriesActivities.length > 0 && (
                <span className="ml-2 text-muted-foreground">
                  ({seriesActivities.filter(a => {
                    const aDate = parseISO(a.date)
                    return !isBefore(aDate, today) || a.id === activity?.id
                  }).length} activities)
                </span>
              )}
            </Button>
            <Button
              variant={editScope === 'all' ? 'default' : 'outline'}
              className="w-full justify-start"
              onClick={async () => {
                setEditScope('all')
                await applyChanges('all')
              }}
              disabled={loading}
            >
              All occurrences in series
              {seriesActivities.length > 0 && (
                <span className="ml-2 text-muted-foreground">
                  ({seriesActivities.length} activities)
                </span>
              )}
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowScopeDialog(false)
              setPendingChanges(null)
            }}>
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Series Dialog */}
      <AlertDialog open={showDeleteSeriesDialog} onOpenChange={setShowDeleteSeriesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entire Series</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {seriesActivities.length} activities in this series? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSeries}
              disabled={deletingSeries}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSeries ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Series'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

