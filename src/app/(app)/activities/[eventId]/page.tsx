'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ActivityTypeBadge } from '@/components/activities/activity-type-badge'
import { PersonalEvent } from '@/types/database.types'
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
  Loader2,
  DollarSign,
  UserPlus,
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
import { EditPersonalEventDialog } from '@/components/activities/edit-personal-event-dialog'
import { getEffectiveUserId, getEffectiveUserEmail } from '@/lib/impersonation'

interface Attendee {
  id: string
  user_id?: string | null
  email: string
  name?: string | null
  availability_status: string
  profiles?: {
    full_name: string | null
  } | null
}

interface Invitation {
  id: string
  invitee_id?: string | null
  invitee_email: string
  invitee_name?: string | null
  status: string
  profiles?: {
    full_name: string | null
  } | null
}

export default function ActivityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const [activity, setActivity] = useState<PersonalEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCreator, setIsCreator] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [myAttendeeStatus, setMyAttendeeStatus] = useState<string | null>(null)
  const [myAttendeeId, setMyAttendeeId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (eventId) {
      loadActivityData()
    }
  }, [eventId])

  async function loadActivityData() {
    const supabase = createClient()
    setLoading(true)

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const effectiveUserId = getEffectiveUserId(user.id)
    const userProfile = await supabase.from('profiles').select('email').eq('id', effectiveUserId).single()
    const effectiveUserEmail = getEffectiveUserEmail(userProfile.data?.email || null)

    // Load activity
    const { data: activityData, error: activityError } = await supabase
      .from('personal_events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (activityError || !activityData) {
      toast({
        title: 'Error',
        description: 'Activity not found',
        variant: 'destructive',
      })
      router.back()
      setLoading(false)
      return
    }

    setActivity(activityData as PersonalEvent)

    // Check if current user is creator
    if (activityData.creator_id === effectiveUserId) {
      setIsCreator(true)
    }

    // Load attendees
    const { data: attendeesData } = await supabase
      .from('event_attendees')
      .select('*, profiles(full_name)')
      .eq('personal_event_id', eventId)
      .order('created_at', { ascending: true })

    if (attendeesData) {
      setAttendees(attendeesData as Attendee[])
      
      // Find current user's attendee status
      const myAttendee = attendeesData.find(
        (att: any) => att.user_id === effectiveUserId || att.email === effectiveUserEmail
      )
      if (myAttendee) {
        setMyAttendeeStatus(myAttendee.availability_status)
        setMyAttendeeId(myAttendee.id)
      }
    }

    // Load invitations
    const { data: invitationsData } = await supabase
      .from('event_invitations')
      .select('*, profiles(full_name)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (invitationsData) {
      setInvitations(invitationsData as Invitation[])
    }

    setLoading(false)
  }

  async function handleDeleteConfirm() {
    if (!activity) return

    setDeleting(true)
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
      setDeleting(false)
      setShowDeleteAlert(false)
    } else {
      toast({
        title: 'Activity deleted',
        description: 'The activity has been deleted successfully',
      })
      setShowDeleteAlert(false)
      router.back()
    }
  }

  async function handleRSVPChange(newStatus: string) {
    if (!activity) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const effectiveUserId = getEffectiveUserId(user.id)
    const userProfile = await supabase.from('profiles').select('email, full_name').eq('id', effectiveUserId).single()
    const effectiveUserEmail = getEffectiveUserEmail(userProfile.data?.email || null)

    if (myAttendeeId) {
      // Update existing attendee status
      const { error } = await supabase
        .from('event_attendees')
        .update({
          availability_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', myAttendeeId)

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
        return
      }
    } else {
      // Create new attendee record
      const { error } = await supabase
        .from('event_attendees')
        .insert({
          personal_event_id: eventId,
          user_id: effectiveUserId,
          email: effectiveUserEmail || userProfile.data?.email || '',
          name: userProfile.data?.full_name || null,
          availability_status: newStatus,
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

    // Reload data
    loadActivityData()
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'available':
        return 'Available'
      case 'unavailable':
        return 'Unavailable'
      case 'maybe':
        return 'Unsure'
      case 'last_resort':
        return 'Last Resort'
      default:
        return 'Not Set'
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'available':
        return <Check className="h-4 w-4 text-green-500" />
      case 'unavailable':
        return <X className="h-4 w-4 text-red-500" />
      case 'maybe':
        return <HelpCircle className="h-4 w-4 text-yellow-500" />
      case 'last_resort':
        return <HelpCircle className="h-4 w-4 text-purple-500" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!activity) {
    return null
  }

  const groupedAttendees = {
    available: attendees.filter(a => a.availability_status === 'available'),
    unavailable: attendees.filter(a => a.availability_status === 'unavailable'),
    maybe: attendees.filter(a => a.availability_status === 'maybe'),
    lastResort: attendees.filter(a => a.availability_status === 'last_resort'),
  }

  const pendingInvitations = invitations.filter(inv => inv.status === 'pending')
  const acceptedInvitations = invitations.filter(inv => inv.status === 'accepted')

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => {
            // Navigate back to calendar, preserving the saved date
            router.push('/calendar')
          }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Activity Details</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <ActivityTypeBadge activityType={activity.activity_type} />
                  <CardTitle className="text-xl">{activity.title}</CardTitle>
                </div>
              </div>
              {isCreator && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditDialog(true)}
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
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Date</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(activity.date, 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Time</p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(activity.time)}
                    {activity.duration && (
                      <span className="ml-1">
                        - {formatTime(calculateEndTime(activity.time, activity.duration))}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {activity.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Location</p>
                    <p className="text-sm text-muted-foreground">{activity.location}</p>
                  </div>
                </div>
              )}
              {activity.cost && (
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Cost</p>
                    <p className="text-sm text-muted-foreground">${activity.cost}</p>
                  </div>
                </div>
              )}
            </div>
            {activity.description && (
              <div>
                <p className="text-sm font-medium mb-2">Description</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activity.description}</p>
              </div>
            )}
            {activity.max_attendees && (
              <div>
                <p className="text-sm font-medium">Max Attendees</p>
                <p className="text-sm text-muted-foreground">{activity.max_attendees}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RSVP Section */}
        {!isCreator && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Your RSVP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {['available', 'maybe', 'unavailable', 'last_resort'].map((status) => (
                  <Button
                    key={status}
                    variant={myAttendeeStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleRSVPChange(status)}
                  >
                    {getStatusIcon(status)}
                    <span className="ml-2">{getStatusLabel(status)}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attendees Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Attendees ({attendees.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {groupedAttendees.available.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Available ({groupedAttendees.available.length})
                </p>
                <div className="space-y-2">
                  {groupedAttendees.available.map((attendee) => (
                    <div key={attendee.id} className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {(attendee.name || attendee.profiles?.full_name || attendee.email || '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">
                        {attendee.name || attendee.profiles?.full_name || attendee.email}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {groupedAttendees.maybe.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-yellow-500" />
                  Unsure ({groupedAttendees.maybe.length})
                </p>
                <div className="space-y-2">
                  {groupedAttendees.maybe.map((attendee) => (
                    <div key={attendee.id} className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {(attendee.name || attendee.profiles?.full_name || attendee.email || '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">
                        {attendee.name || attendee.profiles?.full_name || attendee.email}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {groupedAttendees.lastResort.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-purple-500" />
                  Last Resort ({groupedAttendees.lastResort.length})
                </p>
                <div className="space-y-2">
                  {groupedAttendees.lastResort.map((attendee) => (
                    <div key={attendee.id} className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {(attendee.name || attendee.profiles?.full_name || attendee.email || '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">
                        {attendee.name || attendee.profiles?.full_name || attendee.email}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {groupedAttendees.unavailable.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <X className="h-4 w-4 text-red-500" />
                  Unavailable ({groupedAttendees.unavailable.length})
                </p>
                <div className="space-y-2">
                  {groupedAttendees.unavailable.map((attendee) => (
                    <div key={attendee.id} className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {(attendee.name || attendee.profiles?.full_name || attendee.email || '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">
                        {attendee.name || attendee.profiles?.full_name || attendee.email}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {attendees.length === 0 && (
              <p className="text-sm text-muted-foreground">No attendees yet</p>
            )}
          </CardContent>
        </Card>

        {/* Invitations Section */}
        {isCreator && pendingInvitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Pending Invitations ({pendingInvitations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingInvitations.map((invitation) => (
                  <div key={invitation.id} className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {(invitation.invitee_name || invitation.invitee_email || '?').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {invitation.invitee_name || invitation.invitee_email}
                    </span>
                    <Badge variant="outline" className="ml-auto">
                      {invitation.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

      {/* Edit Dialog */}
      {showEditDialog && activity && (
        <EditPersonalEventDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          activity={activity}
          onUpdated={() => {
            setShowEditDialog(false)
            loadActivityData()
          }}
        />
      )}
    </div>
  )
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const start = new Date()
  start.setHours(hours, minutes, 0, 0)
  const end = new Date(start.getTime() + durationMinutes * 60000)
  return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
}
