'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Event, RosterMember, Availability } from '@/types/database.types'
import { formatDate, formatTime } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
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
  ChevronDown
} from 'lucide-react'

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

    if (eventData) {
      setEvent(eventData)
    }

    // Check if current user is captain
    const { data: teamData } = await supabase
      .from('teams')
      .select('captain_id, co_captain_id')
      .eq('id', teamId)
      .single()

    if (teamData && user && (teamData.captain_id === user.id || teamData.co_captain_id === user.id)) {
      setIsCaptain(true)
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
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }

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
    } else {
      toast({
        title: 'Event deleted',
        description: 'The event has been deleted successfully',
      })
      router.push(`/teams/${teamId}`)
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
              <h2 className="text-lg font-semibold">{event.event_name}</h2>
              <Badge variant="secondary">Event</Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {formatDate(event.date, 'EEEE, MMMM d, yyyy')}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {formatTime(event.time)}
              </div>
              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {event.location}
                </div>
              )}
            </div>
            {event.description && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {event.description}
                </p>
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
        {isCaptain && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowEditDialog(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Event
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
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
                    {rosterMember.ntrp_rating && (
                      <Badge variant="outline" className="text-xs">
                        {rosterMember.ntrp_rating}
                      </Badge>
                    )}
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
                    {rosterMember.ntrp_rating && (
                      <Badge variant="outline" className="text-xs">
                        {rosterMember.ntrp_rating}
                      </Badge>
                    )}
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
                    {rosterMember.ntrp_rating && (
                      <Badge variant="outline" className="text-xs">
                        {rosterMember.ntrp_rating}
                      </Badge>
                    )}
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
                    {rosterMember.ntrp_rating && (
                      <Badge variant="outline" className="text-xs">
                        {rosterMember.ntrp_rating}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Edit Event Dialog */}
      {event && (
        <EditEventDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          event={event}
          teamId={teamId}
          onUpdated={() => {
            loadEventData()
            setShowEditDialog(false)
          }}
        />
      )}
    </div>
  )
}

