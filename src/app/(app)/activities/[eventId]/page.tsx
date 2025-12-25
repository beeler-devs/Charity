'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { PersonalEvent, EventAttendee, EventInvitation, Profile } from '@/types/database.types'
import { formatDate, formatTime, calculateEndTime } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ActivityTypeBadge } from '@/components/activities/activity-type-badge'
import { getActivityTypes } from '@/lib/event-type-colors'
import { ActivityType } from '@/lib/calendar-utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EventInvitationDialog } from '@/components/activities/event-invitation-dialog'
import { EmailService } from '@/services/EmailService'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Check,
  X,
  HelpCircle,
  Trash2,
  Edit,
  ArrowLeft,
  UserPlus,
  DollarSign,
  Loader2,
} from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RecurrenceSelector } from '@/components/shared/recurrence-selector'

type AvailabilityStatus = 'available' | 'unavailable' | 'maybe' | 'late'

export default function PersonalEventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const [event, setEvent] = useState<PersonalEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCreator, setIsCreator] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedEvent, setEditedEvent] = useState<Partial<PersonalEvent>>({})
  const [saving, setSaving] = useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [myAttendee, setMyAttendee] = useState<EventAttendee | null>(null)
  const [attendees, setAttendees] = useState<EventAttendee[]>([])
  const [invitations, setInvitations] = useState<EventInvitation[]>([])
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [removingAttendeeId, setRemovingAttendeeId] = useState<string | null>(null)
  const [removingInvitationId, setRemovingInvitationId] = useState<string | null>(null)
  const [isRecurring, setIsRecurring] = useState(false)
  const [initialEditScope, setInitialEditScope] = useState<'series' | 'single'>('single')
  const [deleteScope, setDeleteScope] = useState<'single' | 'future' | 'series'>('single')
  const [seriesEvents, setSeriesEvents] = useState<PersonalEvent[]>([])
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadEventData()
  }, [eventId])

  async function loadEventData() {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      // Load event
      const { data: eventData } = await supabase
        .from('personal_events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (!eventData) {
        toast({
          title: 'Event not found',
          description: 'This activity could not be found.',
          variant: 'destructive',
        })
        router.push('/activities')
        return
      }

      setEvent(eventData)
      setIsCreator(eventData.creator_id === user.id)
      
      // Check if this is a recurring event
      const hasRecurrence = !!eventData.recurrence_series_id
      setIsRecurring(hasRecurrence)
      
      // If recurring, load all events in the series
      if (hasRecurrence && eventData.recurrence_series_id) {
        const { data: seriesData } = await supabase
          .from('personal_events')
          .select('*')
          .eq('recurrence_series_id', eventData.recurrence_series_id)
          .order('date', { ascending: true })
        
        if (seriesData) {
          setSeriesEvents(seriesData)
        }
      }
      
      setEditedEvent({
        title: eventData.title,
        date: eventData.date,
        time: eventData.time,
        duration: eventData.duration || null,
        location: eventData.location,
        description: eventData.description,
        activity_type: eventData.activity_type,
        max_attendees: eventData.max_attendees || null,
        cost: eventData.cost || null,
        recurrence_pattern: eventData.recurrence_pattern || null,
        recurrence_end_date: eventData.recurrence_end_date || null,
        recurrence_occurrences: eventData.recurrence_occurrences || null,
        recurrence_custom_data: eventData.recurrence_custom_data || null,
      })

      // Load attendees
      const { data: attendeesData } = await supabase
        .from('event_attendees')
        .select('*, profiles(id, full_name, email)')
        .eq('personal_event_id', eventId)
        .order('created_at', { ascending: true })

      if (attendeesData) {
        setAttendees(attendeesData)
        // Find current user's attendee record
        const myAttendeeRecord = attendeesData.find(
          (att: any) => att.user_id === user.id || att.email === (user.email || '')
        )
        setMyAttendee(myAttendeeRecord || null)
      }

      // Load invitations (if creator)
      if (eventData.creator_id === user.id) {
        const { data: invitationsData } = await supabase
          .from('event_invitations')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })

        if (invitationsData) {
          setInvitations(invitationsData)
        }
      }
    } catch (error) {
      console.error('Error loading event:', error)
      toast({
        title: 'Error',
        description: 'Failed to load activity details',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function updateRSVPStatus(status: AvailabilityStatus) {
    if (!event || !myAttendee) return

    setUpdatingStatus(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setUpdatingStatus(false)
      return
    }

    const { error } = await supabase
      .from('event_attendees')
      .update({ availability_status: status })
      .eq('id', myAttendee.id)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'RSVP updated',
        description: `Your status is now ${status}`,
      })
      loadEventData()
    }

    setUpdatingStatus(false)
  }

  async function handleSaveChanges() {
    if (!event) return

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setSaving(false)
      return
    }

    if (isRecurring && initialEditScope === 'series') {
      // Edit entire series - update all events in the series
      const seriesId = event.recurrence_series_id
      
      if (!seriesId) {
        toast({
          title: 'Error',
          description: 'Unable to find recurring series',
          variant: 'destructive',
        })
        setSaving(false)
        return
      }

      // Get all events in the series
      const { data: seriesEvents } = await supabase
        .from('personal_events')
        .select('id, date')
        .eq('recurrence_series_id', seriesId)
        .order('date', { ascending: true })

      if (!seriesEvents || seriesEvents.length === 0) {
        toast({
          title: 'Error',
          description: 'No events found in series',
          variant: 'destructive',
        })
        setSaving(false)
        return
      }

      // Build update object
      const updateData: any = {
        title: editedEvent.title,
        time: editedEvent.time,
        duration: editedEvent.duration,
        location: editedEvent.location,
        description: editedEvent.description,
        activity_type: editedEvent.activity_type,
        max_attendees: editedEvent.max_attendees,
        cost: editedEvent.cost,
        updated_at: new Date().toISOString(),
      }

      // If recurrence pattern changed, update recurrence fields
      if (editedEvent.recurrence_pattern !== undefined) {
        updateData.recurrence_pattern = editedEvent.recurrence_pattern
      }
      if (editedEvent.recurrence_end_date !== undefined) {
        updateData.recurrence_end_date = editedEvent.recurrence_end_date
      }
      if (editedEvent.recurrence_occurrences !== undefined) {
        updateData.recurrence_occurrences = editedEvent.recurrence_occurrences
      }
      if (editedEvent.recurrence_custom_data) {
        updateData.recurrence_custom_data = editedEvent.recurrence_custom_data
      }

      // Update all events in the series
      const { error } = await supabase
        .from('personal_events')
        .update(updateData)
        .eq('recurrence_series_id', seriesId)

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
        setSaving(false)
        return
      }

      toast({
        title: 'Series updated',
        description: `Updated ${seriesEvents.length} event${seriesEvents.length > 1 ? 's' : ''} in the series`,
      })
    } else {
      // Edit single event only
      const { error } = await supabase
        .from('personal_events')
        .update({
          ...editedEvent,
          activity_type: editedEvent.activity_type || 'other',
          updated_at: new Date().toISOString(),
        })
        .eq('id', eventId)

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
        setSaving(false)
        return
      }

      toast({
        title: 'Activity updated',
        description: 'Your changes have been saved',
      })
    }

    setIsEditing(false)
    loadEventData()
    setSaving(false)
  }

  async function handleDelete() {
    if (!event) return

    setDeleting(true)
    const supabase = createClient()

    try {
      if (isRecurring && event.recurrence_series_id) {
        // Handle recurring event deletion based on scope
        if (deleteScope === 'series') {
          // Delete entire series
          const { error } = await supabase
            .from('personal_events')
            .delete()
            .eq('recurrence_series_id', event.recurrence_series_id)

          if (error) {
            throw error
          }

          toast({
            title: 'Series deleted',
            description: 'All events in the series have been deleted',
          })
        } else if (deleteScope === 'future') {
          // Delete this event and all future events in the series
          const currentDate = new Date(event.date)
          const { error } = await supabase
            .from('personal_events')
            .delete()
            .eq('recurrence_series_id', event.recurrence_series_id)
            .gte('date', event.date)

          if (error) {
            throw error
          }

          toast({
            title: 'Events deleted',
            description: 'This event and all future events in the series have been deleted',
          })
        } else {
          // Delete only this occurrence
          const { error } = await supabase
            .from('personal_events')
            .delete()
            .eq('id', eventId)

          if (error) {
            throw error
          }

          toast({
            title: 'Activity deleted',
            description: 'This occurrence has been deleted',
          })
        }
      } else {
        // Non-recurring event - just delete it
        const { error } = await supabase
          .from('personal_events')
          .delete()
          .eq('id', eventId)

        if (error) {
          throw error
        }

        toast({
          title: 'Activity deleted',
          description: 'The activity has been deleted',
        })
      }

      router.push('/activities')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete activity',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setShowDeleteAlert(false)
    }
  }

  async function removeAttendee(attendeeId: string) {
    if (!event) return

    setRemovingAttendeeId(attendeeId)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setRemovingAttendeeId(null)
      return
    }

    // Get attendee details before deleting
    const { data: attendee } = await supabase
      .from('event_attendees')
      .select('*, profiles(id, full_name, email)')
      .eq('id', attendeeId)
      .single()

    if (!attendee) {
      setRemovingAttendeeId(null)
      return
    }

    // Get creator's name for email
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', event.creator_id)
      .single()

    const creatorName = creatorProfile?.full_name || 'The event organizer'

    // Delete the attendee record
    const { error } = await supabase
      .from('event_attendees')
      .delete()
      .eq('id', attendeeId)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
      setRemovingAttendeeId(null)
      return
    }

    // Send cancellation email
    const attendeeEmail = attendee.email || (attendee as any).profiles?.email
    const attendeeName = attendee.name || (attendee as any).profiles?.full_name

    if (attendeeEmail) {
      const emailData = EmailService.compileEventCanceledEmail({
        eventName: event.title,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
        inviterName: creatorName,
        inviteeName: attendeeName || undefined,
        isPersonalEvent: true,
      })

      emailData.to = attendeeEmail

      const emailResult = await EmailService.send(emailData)
      if (!emailResult.success) {
        console.error('Failed to send cancellation email:', emailResult.error)
      }
    }

    toast({
      title: 'Attendee removed',
      description: `${attendeeName || attendeeEmail} has been removed from the activity and notified via email.`,
    })

    // Reload event data to refresh the UI
    await loadEventData()
    setRemovingAttendeeId(null)
  }

  async function removeInvitation(invitationId: string) {
    if (!event) return

    setRemovingInvitationId(invitationId)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setRemovingInvitationId(null)
      return
    }

    // Get invitation details before deleting
    const { data: invitation, error: fetchError } = await supabase
      .from('event_invitations')
      .select('*')
      .eq('id', invitationId)
      .single()

    if (fetchError) {
      console.error('Error fetching invitation:', fetchError)
      toast({
        title: 'Error',
        description: 'Failed to load invitation details',
        variant: 'destructive',
      })
      setRemovingInvitationId(null)
      return
    }

    if (!invitation) {
      console.warn('Invitation not found:', invitationId)
      // Update UI anyway in case it's a stale reference
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId))
      setRemovingInvitationId(null)
      return
    }

    console.log('Removing invitation:', invitation)

    // Get creator's name for email
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', event.creator_id)
      .single()

    const creatorName = creatorProfile?.full_name || 'The event organizer'

    // If invitation was accepted, also remove the attendee record
    if (invitation.status === 'accepted') {
      // Find and delete the corresponding attendee record
      let attendeeDeleteQuery = supabase
        .from('event_attendees')
        .delete()
        .eq('personal_event_id', eventId)

      // Match by user_id if available, otherwise by email
      if (invitation.invitee_id) {
        attendeeDeleteQuery = attendeeDeleteQuery.eq('user_id', invitation.invitee_id)
      } else {
        attendeeDeleteQuery = attendeeDeleteQuery.eq('email', invitation.invitee_email)
      }

      const { error: attendeeError } = await attendeeDeleteQuery

      if (attendeeError) {
        console.error('Error removing attendee record:', attendeeError)
        // Continue anyway - we'll still remove the invitation
      }
    }

    // Check if this is a recurring event - if so, we might want to delete from all events
    // For now, just delete this specific invitation
    // TODO: Could add option to delete from all events in series
    
    // Delete the invitation record
    console.log('Attempting to delete invitation with ID:', invitationId)
    const { data: deletedData, error } = await supabase
      .from('event_invitations')
      .delete()
      .eq('id', invitationId)
      .select()

    if (error) {
      console.error('Error deleting invitation:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete invitation. Check console for details.',
        variant: 'destructive',
      })
      setRemovingInvitationId(null)
      return
    }

    // Verify deletion was successful
    if (!deletedData || deletedData.length === 0) {
      console.warn('No invitation was deleted - checking if it still exists...')
      // Check if invitation still exists
      const { data: stillExists, error: checkError } = await supabase
        .from('event_invitations')
        .select('id, event_id, invitee_email, status')
        .eq('id', invitationId)
        .single()
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error checking if invitation exists:', checkError)
      }
      
      if (stillExists) {
        console.error('Invitation still exists after delete attempt:', stillExists)
        toast({
          title: 'Error',
          description: 'Invitation could not be deleted. You may not have permission to delete this invitation.',
          variant: 'destructive',
        })
        setRemovingInvitationId(null)
        return
      } else {
        console.log('Invitation was already deleted or does not exist')
      }
    } else {
      console.log('Successfully deleted invitation:', deletedData)
    }

    // Send cancellation email (only if invitation was pending or accepted)
    if (invitation.status === 'pending' || invitation.status === 'accepted') {
      const emailData = EmailService.compileEventCanceledEmail({
        eventName: event.title,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
        inviterName: creatorName,
        inviteeName: invitation.invitee_name || undefined,
        isPersonalEvent: true,
      })

      emailData.to = invitation.invitee_email

      const emailResult = await EmailService.send(emailData)
      if (!emailResult.success) {
        console.error('Failed to send cancellation email:', emailResult.error)
      }
    }

    toast({
      title: 'Invitation removed',
      description: `${invitation.invitee_name || invitation.invitee_email} has been removed and notified via email.`,
    })

    // If deletion returned data, it was successful
    const deletionSuccessful = deletedData && deletedData.length > 0

    // Verify the invitation was actually deleted
    if (!deletionSuccessful) {
      // Double-check if it still exists
      const { data: verifyDeleted, error: verifyError } = await supabase
        .from('event_invitations')
        .select('id')
        .eq('id', invitationId)
        .maybeSingle()

      if (verifyDeleted) {
        // Invitation still exists - deletion failed
        console.error('Invitation still exists after delete - deletion may have failed due to permissions')
        toast({
          title: 'Error',
          description: 'Invitation could not be deleted. Please check your permissions or try refreshing the page.',
          variant: 'destructive',
        })
        setRemovingInvitationId(null)
        return
      }
      // If verifyDeleted is null, the invitation doesn't exist (was already deleted or never existed)
      console.log('Invitation does not exist (may have been already deleted)')
    }

    // Invitation was successfully deleted (or doesn't exist) - update UI immediately
    console.log('Updating UI - removing invitation:', invitationId)
    setInvitations(prev => {
      const beforeCount = prev.length
      const filtered = prev.filter(inv => inv.id !== invitationId)
      const afterCount = filtered.length
      console.log(`Invitations: ${beforeCount} -> ${afterCount} (removed ${beforeCount - afterCount})`)
      
      if (beforeCount === afterCount) {
        console.warn('No invitation was removed from state - invitation ID may not match')
      }
      
      return filtered
    })

    // Reload invitations list after a short delay to ensure database is updated
    setTimeout(async () => {
      try {
        const { data: refreshedInvitations } = await supabase
          .from('event_invitations')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })

        if (refreshedInvitations) {
          console.log('Refreshed invitations count:', refreshedInvitations.length)
          // Update with fresh data
          setInvitations(refreshedInvitations)
        }
      } catch (error) {
        console.error('Error reloading invitations:', error)
      }
    }, 500) // Small delay to ensure database has processed the deletion
    
    setRemovingInvitationId(null)
  }

  const getInitials = (name?: string) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const attendeesByStatus = {
    available: attendees.filter(a => a.availability_status === 'available'),
    maybe: attendees.filter(a => a.availability_status === 'maybe'),
    late: attendees.filter(a => a.availability_status === 'late'),
    unavailable: attendees.filter(a => a.availability_status === 'unavailable'),
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!event) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={event.title} />

      <main className="flex-1 p-4 space-y-4">
        {/* Back Button */}
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" onClick={() => router.back()} size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {isCreator && (
            <div className="flex gap-2">
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInviteDialog(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite
                  </Button>
                  {isRecurring ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setInitialEditScope('single')
                          setIsEditing(true)
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit This Occurrence
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setInitialEditScope('series')
                          setIsEditing(true)
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Series
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteScope('single') // Reset to safe default
                      setShowDeleteAlert(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false)
                      setEditedEvent({
                        title: event.title,
                        date: event.date,
                        time: event.time,
                        duration: event.duration || null,
                        location: event.location,
                        description: event.description,
                        activity_type: event.activity_type,
                        max_attendees: event.max_attendees || null,
                        cost: event.cost || null,
                      })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveChanges}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <Card>
            <CardHeader>
              <CardTitle>Edit Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={editedEvent.title || ''}
                  onChange={(e) => setEditedEvent({ ...editedEvent, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-activity-type">Activity Type *</Label>
                <Select
                  value={editedEvent.activity_type || 'other'}
                  onValueChange={(value) => setEditedEvent({ ...editedEvent, activity_type: value as ActivityType })}
                >
                  <SelectTrigger id="edit-activity-type">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Date *</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editedEvent.date || ''}
                    onChange={(e) => setEditedEvent({ ...editedEvent, date: e.target.value })}
                    required
                    disabled={isRecurring && initialEditScope === 'series'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-time">Time *</Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={editedEvent.time || ''}
                    onChange={(e) => setEditedEvent({ ...editedEvent, time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={editedEvent.location || ''}
                  onChange={(e) => setEditedEvent({ ...editedEvent, location: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editedEvent.description || ''}
                  onChange={(e) => setEditedEvent({ ...editedEvent, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-max-attendees">Max Attendees</Label>
                  <Input
                    id="edit-max-attendees"
                    type="number"
                    min="1"
                    value={editedEvent.max_attendees || ''}
                    onChange={(e) => setEditedEvent({ 
                      ...editedEvent, 
                      max_attendees: e.target.value ? parseInt(e.target.value) : null 
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cost">Cost per Person</Label>
                  <Input
                    id="edit-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editedEvent.cost || ''}
                    onChange={(e) => setEditedEvent({ 
                      ...editedEvent, 
                      cost: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                  />
                </div>
              </div>

              {/* Recurrence Pattern Editing - Only shown when editing series */}
              {isRecurring && initialEditScope === 'series' && event && (
                <div className="space-y-4 pt-4 border-t">
                  <p className="text-sm font-medium text-muted-foreground">
                    Note: Changing the recurrence pattern will update all future events in the series.
                  </p>
                  <RecurrenceSelector
                    isRecurring={true}
                    onRecurringChange={() => {}}
                    pattern={(editedEvent.recurrence_pattern as any) || (event.recurrence_pattern as any) || 'weekly'}
                    onPatternChange={(pattern) => {
                      setEditedEvent({ ...editedEvent, recurrence_pattern: pattern as any })
                    }}
                    endType={
                      editedEvent.recurrence_end_date 
                        ? 'date' 
                        : editedEvent.recurrence_occurrences 
                        ? 'occurrences' 
                        : event.recurrence_end_date 
                        ? 'date' 
                        : event.recurrence_occurrences 
                        ? 'occurrences' 
                        : 'never'
                    }
                    onEndTypeChange={(endType) => {
                      if (endType === 'date') {
                        setEditedEvent({ 
                          ...editedEvent, 
                          recurrence_end_date: editedEvent.recurrence_end_date || event.recurrence_end_date || '',
                          recurrence_occurrences: null
                        })
                      } else if (endType === 'occurrences') {
                        setEditedEvent({ 
                          ...editedEvent, 
                          recurrence_occurrences: editedEvent.recurrence_occurrences || event.recurrence_occurrences || null,
                          recurrence_end_date: null
                        })
                      } else {
                        setEditedEvent({ 
                          ...editedEvent, 
                          recurrence_end_date: null,
                          recurrence_occurrences: null
                        })
                      }
                    }}
                    endDate={editedEvent.recurrence_end_date || event.recurrence_end_date || ''}
                    onEndDateChange={(date) => {
                      setEditedEvent({ ...editedEvent, recurrence_end_date: date || null })
                    }}
                    occurrences={(editedEvent.recurrence_occurrences || event.recurrence_occurrences)?.toString() || ''}
                    onOccurrencesChange={(occurrences) => {
                      setEditedEvent({ ...editedEvent, recurrence_occurrences: occurrences ? parseInt(occurrences) : null })
                    }}
                    customRecurrence={(editedEvent.recurrence_custom_data || event.recurrence_custom_data) || { interval: 1, timeUnit: 'week', selectedDays: [] }}
                    onCustomRecurrenceChange={(data) => {
                      setEditedEvent({ ...editedEvent, recurrence_custom_data: data })
                    }}
                    startDate={event.recurrence_original_date || event.date}
                    showNeverOption={true}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Event Details */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ActivityTypeBadge activityType={event.activity_type} />
                    <h2 className="text-xl font-semibold">{event.title}</h2>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(event.date, 'EEEE, MMMM d, yyyy')}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {formatTime(event.time)}
                      {event.duration && ` - ${calculateEndTime(event.time, event.duration)}`}
                      {event.duration && ` (${event.duration} min)`}
                    </span>
                  </div>

                  {event.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{event.location}</span>
                    </div>
                  )}

                  {event.cost && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>${event.cost.toFixed(2)} per person</span>
                    </div>
                  )}

                  {event.max_attendees && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {attendees.length} / {event.max_attendees} attendees
                      </span>
                    </div>
                  )}

                  {event.description && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {event.description}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* RSVP Section (for invitees) */}
            {!isCreator && myAttendee && (
              <Card>
                <CardHeader>
                  <CardTitle>My RSVP</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant={myAttendee.availability_status === 'available' ? 'default' : 'outline'}
                      onClick={() => updateRSVPStatus('available')}
                      disabled={updatingStatus}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Available
                    </Button>
                    <Button
                      variant={myAttendee.availability_status === 'maybe' ? 'default' : 'outline'}
                      onClick={() => updateRSVPStatus('maybe')}
                      disabled={updatingStatus}
                    >
                      <HelpCircle className="h-4 w-4 mr-2" />
                      Tentative
                    </Button>
                    <Button
                      variant={myAttendee.availability_status === 'unavailable' ? 'default' : 'outline'}
                      onClick={() => updateRSVPStatus('unavailable')}
                      disabled={updatingStatus}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Unavailable
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Attendees Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Attendees ({attendees.length}{event.max_attendees ? ` / ${event.max_attendees}` : ''})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {attendeesByStatus.available.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="default" className="bg-green-600">
                          Available ({attendeesByStatus.available.length})
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {attendeesByStatus.available.map((attendee) => (
                          <div key={attendee.id} className="flex items-center gap-2 p-2 bg-green-50 rounded">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(attendee.name || (attendee as any).profiles?.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="text-sm font-medium">
                                {attendee.name || (attendee as any).profiles?.full_name || attendee.email}
                              </div>
                              {attendee.name && (
                                <div className="text-xs text-muted-foreground">{attendee.email}</div>
                              )}
                            </div>
                            {isCreator && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAttendee(attendee.id)}
                                disabled={removingAttendeeId === attendee.id}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                {removingAttendeeId === attendee.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {attendeesByStatus.maybe.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">
                          Tentative ({attendeesByStatus.maybe.length})
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {attendeesByStatus.maybe.map((attendee) => (
                          <div key={attendee.id} className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(attendee.name || (attendee as any).profiles?.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="text-sm font-medium">
                                {attendee.name || (attendee as any).profiles?.full_name || attendee.email}
                              </div>
                              {attendee.name && (
                                <div className="text-xs text-muted-foreground">{attendee.email}</div>
                              )}
                            </div>
                            {isCreator && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAttendee(attendee.id)}
                                disabled={removingAttendeeId === attendee.id}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                {removingAttendeeId === attendee.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {attendeesByStatus.unavailable.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive">
                          Unavailable ({attendeesByStatus.unavailable.length})
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {attendeesByStatus.unavailable.map((attendee) => (
                          <div key={attendee.id} className="flex items-center gap-2 p-2 bg-red-50 rounded">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(attendee.name || (attendee as any).profiles?.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="text-sm font-medium">
                                {attendee.name || (attendee as any).profiles?.full_name || attendee.email}
                              </div>
                              {attendee.name && (
                                <div className="text-xs text-muted-foreground">{attendee.email}</div>
                              )}
                            </div>
                            {isCreator && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAttendee(attendee.id)}
                                disabled={removingAttendeeId === attendee.id}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                {removingAttendeeId === attendee.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {attendees.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No attendees yet. {isCreator && 'Invite people to join this activity.'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Invitations (for creator) */}
            {isCreator && invitations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Invitations ({invitations.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {invitations.map((invitation) => (
                      <div key={invitation.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {invitation.invitee_name || invitation.invitee_email}
                          </div>
                          {invitation.invitee_name && (
                            <div className="text-xs text-muted-foreground">{invitation.invitee_email}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            invitation.status === 'accepted' ? 'default' :
                            invitation.status === 'declined' ? 'destructive' :
                            'secondary'
                          }>
                            {invitation.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeInvitation(invitation.id)}
                            disabled={removingInvitationId === invitation.id}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            {removingInvitationId === invitation.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      <EventInvitationDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        eventId={eventId}
        onInvited={() => {
          setShowInviteDialog(false)
          loadEventData()
        }}
      />

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRecurring ? 'Delete Recurring Activity?' : 'Delete Activity?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRecurring ? (
                <div className="space-y-4">
                  <div>
                    Are you sure you want to delete "{event.title}"? This action cannot be undone and will cancel all invitations.
                  </div>
                  <div className="space-y-3 pt-2">
                    <label className="flex items-start space-x-3 cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <input
                        type="radio"
                        name="deleteScope"
                        value="single"
                        checked={deleteScope === 'single'}
                        onChange={(e) => setDeleteScope(e.target.value as 'single' | 'future' | 'series')}
                        className="mt-1 w-4 h-4 text-primary"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Delete only this occurrence</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Only this event will be deleted. Other events in the series will remain.
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start space-x-3 cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <input
                        type="radio"
                        name="deleteScope"
                        value="future"
                        checked={deleteScope === 'future'}
                        onChange={(e) => setDeleteScope(e.target.value as 'single' | 'future' | 'series')}
                        className="mt-1 w-4 h-4 text-primary"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Delete this and all future occurrences</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          This event and all events after it in the series will be deleted.
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start space-x-3 cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <input
                        type="radio"
                        name="deleteScope"
                        value="series"
                        checked={deleteScope === 'series'}
                        onChange={(e) => setDeleteScope(e.target.value as 'single' | 'future' | 'series')}
                        className="mt-1 w-4 h-4 text-primary"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Delete entire series</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          All {seriesEvents.length} events in this series will be deleted.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                <span>
                  Are you sure you want to delete "{event.title}"? This action cannot be undone and will cancel all invitations.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}



