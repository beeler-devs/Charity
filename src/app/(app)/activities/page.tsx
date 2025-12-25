'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { PersonalEvent, EventInvitation, EventAttendee } from '@/types/database.types'
import { formatDate, formatTime } from '@/lib/utils'
import { Plus, Calendar, ArrowLeft, Users, Clock, ChevronRight } from 'lucide-react'
import { AddPersonalEventDialog } from '@/components/activities/add-personal-event-dialog'
import { ActivityTypeBadge } from '@/components/activities/activity-type-badge'
import { ActivityType } from '@/lib/calendar-utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ActivityWithDetails extends PersonalEvent {
  invitation?: EventInvitation
  attendee?: EventAttendee
  attendeeCount?: number
  isCreator?: boolean
}

export default function ActivitiesPage() {
  const router = useRouter()
  const [createdActivities, setCreatedActivities] = useState<ActivityWithDetails[]>([])
  const [invitedActivities, setInvitedActivities] = useState<ActivityWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('upcoming')

  useEffect(() => {
    loadActivities()
  }, [])

  async function loadActivities() {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        setLoading(false)
        return
      }

      const today = new Date().toISOString().split('T')[0]

      // Load activities user created
      const { data: created } = await supabase
        .from('personal_events')
        .select('*')
        .eq('creator_id', user.id)
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      // Load activities user is invited to
      const { data: invitations } = await supabase
        .from('event_invitations')
        .select('*, personal_events(*)')
        .or(`invitee_id.eq.${user.id},invitee_email.eq.${(await supabase.from('profiles').select('email').eq('id', user.id).single()).data?.email}`)
        .in('status', ['pending', 'accepted'])

      // Load attendee counts for created activities
      if (created) {
        const activityIds = created.map(a => a.id)
        const { data: attendees } = await supabase
          .from('event_attendees')
          .select('personal_event_id, availability_status')
          .in('personal_event_id', activityIds)

        const attendeeCounts: Record<string, { total: number; available: number }> = {}
        attendees?.forEach(att => {
          if (!attendeeCounts[att.personal_event_id]) {
            attendeeCounts[att.personal_event_id] = { total: 0, available: 0 }
          }
          attendeeCounts[att.personal_event_id].total++
          if (att.availability_status === 'available') {
            attendeeCounts[att.personal_event_id].available++
          }
        })

        const createdWithDetails: ActivityWithDetails[] = created.map(activity => ({
          ...activity,
          isCreator: true,
          attendeeCount: attendeeCounts[activity.id]?.total || 0,
        }))
        setCreatedActivities(createdWithDetails)
      }

      // Load activities from invitations
      if (invitations) {
        const invitedWithDetails: ActivityWithDetails[] = invitations
          .map((inv: any) => ({
            ...inv.personal_events,
            invitation: inv,
            isCreator: false,
          }))
          .filter((activity: any) => activity.id) // Filter out nulls
        setInvitedActivities(invitedWithDetails)
      }
    } catch (error) {
      console.error('Error loading activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCreated = createdActivities.filter(activity => {
    if (filterType !== 'all' && activity.activity_type !== filterType) return false
    if (filterStatus === 'upcoming') {
      const today = new Date().toISOString().split('T')[0]
      return activity.date >= today
    } else {
      const today = new Date().toISOString().split('T')[0]
      return activity.date < today
    }
  })

  const filteredInvited = invitedActivities.filter(activity => {
    if (filterType !== 'all' && activity.activity_type !== filterType) return false
    if (filterStatus === 'upcoming') {
      const today = new Date().toISOString().split('T')[0]
      return activity.date >= today
    } else {
      const today = new Date().toISOString().split('T')[0]
      return activity.date < today
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Activities" />

      <main className="flex-1 p-4 space-y-4">
        {/* Back Button */}
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" onClick={() => router.back()} size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Header with Create Button */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Activities</h2>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create Activity
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="scrimmage">Scrimmage</SelectItem>
              <SelectItem value="lesson">Lesson</SelectItem>
              <SelectItem value="class">Class</SelectItem>
              <SelectItem value="flex_league">Flex League</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="past">Past</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Created Activities */}
        {filteredCreated.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Activities I Created ({filteredCreated.length})
            </h3>
            <div className="space-y-2">
              {filteredCreated.map((activity) => (
                <Link key={activity.id} href={`/activities/${activity.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <ActivityTypeBadge activityType={activity.activity_type} />
                            <span className="font-medium">{activity.title}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(activity.date, 'MMM d, yyyy')}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(activity.time)}
                            </div>
                            {activity.location && (
                              <span className="truncate">{activity.location}</span>
                            )}
                          </div>
                          {activity.attendeeCount !== undefined && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {activity.attendeeCount} attendee{activity.attendeeCount !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Invited Activities */}
        {filteredInvited.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Activities I'm Invited To ({filteredInvited.length})
            </h3>
            <div className="space-y-2">
              {filteredInvited.map((activity) => (
                <Link key={activity.id} href={`/activities/${activity.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <ActivityTypeBadge activityType={activity.activity_type} />
                            <span className="font-medium">{activity.title}</span>
                            {activity.invitation?.status === 'pending' && (
                              <Badge variant="outline" className="text-xs">Pending</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(activity.date, 'MMM d, yyyy')}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(activity.time)}
                            </div>
                            {activity.location && (
                              <span className="truncate">{activity.location}</span>
                            )}
                          </div>
                          {activity.attendee && (
                            <div className="mt-1 text-xs">
                              <Badge variant={activity.attendee.availability_status === 'available' ? 'default' : 'secondary'} className="text-xs">
                                {activity.attendee.availability_status === 'available' ? 'Available' :
                                 activity.attendee.availability_status === 'maybe' ? 'Tentative' :
                                 activity.attendee.availability_status === 'late' ? 'Late' : 'Unavailable'}
                              </Badge>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredCreated.length === 0 && filteredInvited.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No activities yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a scrimmage, lesson, class, or other tennis activity and invite others to join
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Activity
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <AddPersonalEventDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onAdded={() => {
          setShowCreateDialog(false)
          loadActivities()
        }}
      />
    </div>
  )
}


