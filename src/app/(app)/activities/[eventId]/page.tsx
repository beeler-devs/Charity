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
import { EventInvitationDialog } from '@/components/activities/event-invitation-dialog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

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

    const { error } = await supabase
      .from('personal_events')
      .update({
        ...editedEvent,
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

    setIsEditing(false)
    loadEventData()
    setSaving(false)
  }

  async function handleDelete() {
    if (!event) return

    const supabase = createClient()
    const { error } = await supabase
      .from('personal_events')
      .delete()
      .eq('id', eventId)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
      return
    }

    toast({
      title: 'Activity deleted',
      description: 'The activity has been deleted',
    })

    router.push('/activities')
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteAlert(true)}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Date *</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editedEvent.date || ''}
                    onChange={(e) => setEditedEvent({ ...editedEvent, date: e.target.value })}
                    required
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
                        <div>
                          <div className="text-sm font-medium">
                            {invitation.invitee_name || invitation.invitee_email}
                          </div>
                          {invitation.invitee_name && (
                            <div className="text-xs text-muted-foreground">{invitation.invitee_email}</div>
                          )}
                        </div>
                        <Badge variant={
                          invitation.status === 'accepted' ? 'default' :
                          invitation.status === 'declined' ? 'destructive' :
                          'secondary'
                        }>
                          {invitation.status}
                        </Badge>
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
            <AlertDialogTitle>Delete Activity?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{event.title}"? This action cannot be undone and will cancel all invitations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


