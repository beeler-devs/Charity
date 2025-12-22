'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
// Types defined inline
type Event = {
  id: string
  team_id: string
  event_name: string
  date: string
  time: string
  location?: string | null
  description?: string | null
  event_type?: string | null
  duration?: number | null
  recurrence_series_id?: string | null
  recurrence_pattern?: string | null
  recurrence_end_date?: string | null
  recurrence_occurrences?: number | null
  recurrence_original_date?: string | null
  [key: string]: any
}

type RosterMember = {
  id: string
  team_id: string
  user_id?: string | null
  full_name: string
  email?: string | null
  phone?: string | null
  ntrp_rating?: number | null
  [key: string]: any
}

type Availability = {
  id: string
  roster_member_id: string
  event_id?: string | null
  match_id?: string | null
  status: string
  [key: string]: any
}
import { formatDate, formatTime } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { getEventTypeLabel, getEventTypeBadgeClass } from '@/lib/event-type-colors'
import { EditEventDialog } from '@/components/teams/edit-event-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Check,
  X,
  HelpCircle,
  Clock as LateClock,
  Trash2,
  Edit,
  ChevronDown,
  Save,
  XCircle,
  Loader2,
  Plus,
  Timer
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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

interface AttendeeInfo {
  rosterMember: RosterMember
  availability: Availability | null
}

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
  const eventId = params.eventId as string
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCaptain, setIsCaptain] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [initialEditScope, setInitialEditScope] = useState<'series' | 'single' | undefined>(undefined)
  const [isEditing, setIsEditing] = useState(false)
  const [editedEvent, setEditedEvent] = useState<Partial<Event>>({})
  const [saving, setSaving] = useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [myAvailability, setMyAvailability] = useState<Availability | null>(null)
  const [myRosterMemberId, setMyRosterMemberId] = useState<string | null>(null)
  const [attendees, setAttendees] = useState<{
    available: AttendeeInfo[]
    unavailable: AttendeeInfo[]
    maybe: AttendeeInfo[]
    late: AttendeeInfo[]
  }>({
    available: [],
    unavailable: [],
    maybe: [],
    late: []
  })
  const { toast } = useToast()

  useEffect(() => {
    loadEventData()
  }, [eventId])

  async function loadEventData() {
    const supabase = createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()
    
    // Note: recurrence_series_id and other recurrence fields may not exist in DB yet
    // They will be added via migration, but the code handles their absence gracefully

    // Check if current user is captain
    const { data: teamData } = await supabase
      .from('teams')
      .select('captain_id, co_captain_id')
      .eq('id', teamId)
      .single()

    if (teamData && user && (teamData.captain_id === user.id || teamData.co_captain_id === user.id)) {
      setIsCaptain(true)
    }

    if (eventData) {
      setEvent(eventData)
      setEditedEvent({
        event_name: eventData.event_name,
        date: eventData.date,
        time: eventData.time,
        duration: (eventData as any).duration || null,
        location: eventData.location,
        description: eventData.description,
        event_type: (eventData as any).event_type || null,
      })
    }

    // Get current user's roster member info
    if (user) {
      const { data: rosterMember } = await supabase
        .from('roster_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (rosterMember) {
        setMyRosterMemberId(rosterMember.id)

        // Get user's availability for this event
        const { data: availability } = await supabase
          .from('availability')
          .select('*')
          .eq('event_id', eventId)
          .eq('roster_member_id', rosterMember.id)
          .single()

        setMyAvailability(availability || null)
      }
    }

    // Load roster members and their availability
    const { data: rosterMembers } = await supabase
      .from('roster_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('full_name')

    const { data: availabilities } = await supabase
      .from('availability')
      .select('*')
      .eq('event_id', eventId)

    if (rosterMembers && availabilities) {
      // Create a map of availability by roster member id
      const availMap = new Map<string, Availability>()
      availabilities.forEach(a => availMap.set(a.roster_member_id, a))

      // Group attendees by status
      const grouped = {
        available: [] as AttendeeInfo[],
        unavailable: [] as AttendeeInfo[],
        maybe: [] as AttendeeInfo[],
        late: [] as AttendeeInfo[]
      }

      rosterMembers.forEach(member => {
        const avail = availMap.get(member.id) || null
        const info = { rosterMember: member, availability: avail }
        
        if (!avail || avail.status === 'unavailable') {
          grouped.unavailable.push(info)
        } else if (avail.status === 'available') {
          grouped.available.push(info)
        } else if (avail.status === 'maybe') {
          grouped.maybe.push(info)
        } else if (avail.status === 'late') {
          grouped.late.push(info)
        }
      })

      setAttendees(grouped)
    }

    setLoading(false)

    // Auto-enter edit mode for captains when event loads
    if (eventData && teamData && user && (teamData.captain_id === user.id || teamData.co_captain_id === user.id)) {
      setIsEditing(true)
    }
  }

  async function handleDeleteConfirm() {
    const supabase = createClient()

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
      setShowDeleteAlert(false)
    } else {
      toast({
        title: 'Event deleted',
        description: 'The event has been deleted successfully',
      })
      setShowDeleteAlert(false)
      // Navigate back to previous page (calendar, teams page, etc.)
      router.back()
    }
  }

  async function handleRSVPChange(newStatus: string) {
    if (!myRosterMemberId) return

    const supabase = createClient()

    // Check if availability record exists
    if (myAvailability) {
      // Update existing availability
      const { error } = await supabase
        .from('availability')
        .update({
          status: newStatus,
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', myAvailability.id)

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
        return
      }
    } else {
      // Create new availability record
      const { error } = await supabase
        .from('availability')
        .insert({
          roster_member_id: myRosterMemberId,
          event_id: eventId,
          status: newStatus,
          responded_at: new Date().toISOString(),
        })

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
        return
      }
    }

    toast({
      title: 'RSVP updated',
      description: 'Your availability has been updated',
    })

    // Reload data to refresh the UI
    loadEventData()
  }

  function getStatusLabel(status: string | undefined) {
    switch (status) {
      case 'available':
        return 'Available'
      case 'unavailable':
        return 'Unavailable'
      case 'maybe':
        return 'Maybe'
      case 'late':
        return 'Running Late'
      default:
        return 'Set RSVP'
    }
  }

  function getStatusIcon(status: string | undefined) {
    switch (status) {
      case 'available':
        return <Check className="h-4 w-4 text-green-500" />
      case 'unavailable':
        return <X className="h-4 w-4 text-red-500" />
      case 'maybe':
        return <HelpCircle className="h-4 w-4 text-yellow-500" />
      case 'late':
        return <LateClock className="h-4 w-4 text-orange-500" />
      default:
        return <ChevronDown className="h-4 w-4" />
    }
  }

  function handleStartEdit() {
    if (event) {
      setEditedEvent({
        event_name: event.event_name,
        date: event.date,
        time: event.time,
        duration: (event as any).duration || null,
        location: event.location,
        description: event.description,
        event_type: (event as any).event_type || null,
      })
      setIsEditing(true)
    }
  }

  function handleCancelEdit() {
    // Reset form to original values
    if (event) {
      setEditedEvent({
        event_name: event.event_name,
        date: event.date,
        time: event.time,
        duration: (event as any).duration || null,
        location: event.location,
        description: event.description,
        event_type: (event as any).event_type || null,
      })
    }
    setIsEditing(false)
    // Navigate back to previous page (calendar, teams page, etc.)
    router.back()
  }

  async function handleSaveChanges() {
    if (!event) return

    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('events')
      .update({
        event_name: editedEvent.event_name,
        date: editedEvent.date,
        time: editedEvent.time,
        duration: editedEvent.duration ? parseInt(editedEvent.duration.toString()) : null,
        location: editedEvent.location || null,
        description: editedEvent.description || null,
        event_type: editedEvent.event_type || null,
      })
      .eq('id', event.id)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
      setSaving(false)
    } else {
      toast({
        title: 'Event updated',
        description: 'The event has been updated successfully',
      })
      setIsEditing(false)
      setSaving(false)
      // Navigate back to previous page (calendar, teams page, etc.)
      router.back()
    }
  }

  if (loading || !event) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const totalResponses = attendees.available.length + attendees.maybe.length + attendees.late.length + attendees.unavailable.length
  const goingCount = attendees.available.length + attendees.late.length

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Event Details" />

      <main className="flex-1 p-4 space-y-4">
        {/* Event Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              {isEditing ? (
                <Input
                  value={editedEvent.event_name || ''}
                  onChange={(e) => setEditedEvent({ ...editedEvent, event_name: e.target.value })}
                  className="text-lg font-semibold"
                  placeholder="Event name"
                />
              ) : (
                <h2 className="text-lg font-semibold">{event.event_name}</h2>
              )}
              {!isEditing && (
                <Badge 
                  variant="secondary" 
                  className={(event as any).event_type ? getEventTypeBadgeClass((event as any).event_type) : ''}
                >
                  {(event as any).event_type ? getEventTypeLabel((event as any).event_type) : 'Event'}
                </Badge>
              )}
              {isEditing && (
                <Select
                  value={editedEvent.event_type || 'none'}
                  onValueChange={(value) => setEditedEvent({ ...editedEvent, event_type: value === 'none' ? null : value })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="practice">Practice</SelectItem>
                    <SelectItem value="warmup">Warmup</SelectItem>
                    <SelectItem value="fun">Fun</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground font-medium">Date:</span>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={editedEvent.date || ''}
                      onChange={(e) => setEditedEvent({ ...editedEvent, date: e.target.value })}
                      className="flex-1"
                    />
                  ) : (
                    <span>{formatDate(event.date, 'EEEE, MMMM d, yyyy')}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground font-medium">Time:</span>
                  {isEditing ? (
                    <Input
                      type="time"
                      value={editedEvent.time || ''}
                      onChange={(e) => setEditedEvent({ ...editedEvent, time: e.target.value })}
                      className="flex-1"
                    />
                  ) : (
                    <span>{formatTime(event.time)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground font-medium">Duration:</span>
                  {isEditing ? (
                    <Input
                      type="number"
                      placeholder="Duration (minutes)"
                      value={editedEvent.duration?.toString() || ''}
                      onChange={(e) => setEditedEvent({ ...editedEvent, duration: e.target.value ? parseInt(e.target.value) : null })}
                      className="flex-1"
                      min="0"
                    />
                  ) : (
                    (event as any).duration ? (
                      <span>
                        {(() => {
                          const hours = Math.floor((event as any).duration / 60)
                          const minutes = (event as any).duration % 60
                          if (hours > 0 && minutes > 0) {
                            return `${hours}h ${minutes}m`
                          } else if (hours > 0) {
                            return `${hours}h`
                          } else {
                            return `${minutes}m`
                          }
                        })()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No duration set</span>
                    )
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground font-medium">Location:</span>
                {isEditing ? (
                  <Input
                    value={editedEvent.location || ''}
                    onChange={(e) => setEditedEvent({ ...editedEvent, location: e.target.value })}
                    className="flex-1"
                    placeholder="Location"
                  />
                ) : (
                  <span>{event.location || <span className="text-muted-foreground">No location</span>}</span>
                )}
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="text-muted-foreground font-medium text-sm mb-2">Description:</div>
              {isEditing ? (
                <Textarea
                  value={editedEvent.description || ''}
                  onChange={(e) => setEditedEvent({ ...editedEvent, description: e.target.value })}
                  placeholder="Event description"
                  rows={4}
                />
              ) : (
                event.description ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {event.description}
                  </p>
                ) : (
                  <span className="text-sm text-muted-foreground">No description</span>
                )
              )}
            </div>
            {isEditing && (
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  onClick={handleSaveChanges}
                  disabled={saving || !editedEvent.event_name || !editedEvent.date || !editedEvent.time}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  variant="outline"
                  disabled={saving}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                {isCaptain && (
                  <Button
                    onClick={() => setShowDeleteAlert(true)}
                    variant="destructive"
                    disabled={saving}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/teams/${teamId}/availability`}>
            <Button variant="outline" className="w-full">
              <Users className="h-4 w-4 mr-2" />
              Availability Grid
            </Button>
          </Link>
          
          <Select
            value={myAvailability?.status || 'unavailable'}
            onValueChange={handleRSVPChange}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                {getStatusIcon(myAvailability?.status)}
                <span>{getStatusLabel(myAvailability?.status)}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Available</span>
                </div>
              </SelectItem>
              <SelectItem value="late">
                <div className="flex items-center gap-2">
                  <LateClock className="h-4 w-4 text-orange-500" />
                  <span>Running Late</span>
                </div>
              </SelectItem>
              <SelectItem value="maybe">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-yellow-500" />
                  <span>Maybe</span>
                </div>
              </SelectItem>
              <SelectItem value="unavailable">
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-500" />
                  <span>Unavailable</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Captain Actions */}
        {isCaptain && !isEditing && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleStartEdit}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Event
            </Button>
            {(event as any).recurrence_series_id && (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setInitialEditScope('series')
                    setShowEditDialog(true)
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Series
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setInitialEditScope('single')
                    setShowEditDialog(true)
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit This Occurrence
                </Button>
              </>
            )}
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => setShowDeleteAlert(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Event
            </Button>
          </div>
        )}

        {/* Attendance Summary */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Attendance Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{attendees.available.length}</div>
                <div className="text-xs text-muted-foreground">Available</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{attendees.maybe.length}</div>
                <div className="text-xs text-muted-foreground">Maybe</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{attendees.late.length}</div>
                <div className="text-xs text-muted-foreground">Late</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{attendees.unavailable.length}</div>
                <div className="text-xs text-muted-foreground">Unavailable</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t text-center">
              <div className="text-sm">
                <span className="font-semibold">{goingCount}</span> going out of {totalResponses} responses
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendees Lists */}
        {attendees.available.length > 0 && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Available ({attendees.available.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="space-y-2">
                {attendees.available.map(({ rosterMember }) => (
                  <div key={rosterMember.id} className="flex items-center justify-between text-sm">
                    <span>{rosterMember.full_name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {attendees.maybe.length > 0 && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-yellow-500" />
                Maybe ({attendees.maybe.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="space-y-2">
                {attendees.maybe.map(({ rosterMember }) => (
                  <div key={rosterMember.id} className="flex items-center justify-between text-sm">
                    <span>{rosterMember.full_name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {attendees.late.length > 0 && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <LateClock className="h-4 w-4 text-orange-500" />
                Running Late ({attendees.late.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="space-y-2">
                {attendees.late.map(({ rosterMember }) => (
                  <div key={rosterMember.id} className="flex items-center justify-between text-sm">
                    <span>{rosterMember.full_name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {attendees.unavailable.length > 0 && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <X className="h-4 w-4 text-red-500" />
                Unavailable ({attendees.unavailable.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="space-y-2">
                {attendees.unavailable.map(({ rosterMember }) => (
                  <div key={rosterMember.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{rosterMember.full_name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Make Recurring Button - only for non-recurring events */}
        {isCaptain && !isEditing && !(event as any).recurrence_series_id && (
          <Card>
            <CardContent className="p-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowEditDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Make Recurring
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Edit Event Dialog */}
      {event && (
        <EditEventDialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open)
            if (!open) {
              setInitialEditScope(undefined) // Reset when dialog closes
            }
          }}
          event={event}
          teamId={teamId}
          onUpdated={() => {
            loadEventData()
            setShowEditDialog(false)
            setInitialEditScope(undefined)
          }}
          initialEditScope={initialEditScope}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{event?.event_name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

