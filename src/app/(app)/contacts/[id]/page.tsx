'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { Contact } from '@/types/database.types'
import { AddEditContactDialog } from '@/components/contacts/add-edit-contact-dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, ArrowLeft, Edit, Phone, Mail, MessageCircle, MapPin, Calendar, Trophy, Users, Zap } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'

interface TennisActivity {
  id: string
  type: 'match' | 'event' | 'personal_activity'
  title: string
  date: string
  time?: string
  location?: string
  team_name?: string
  match_result?: 'won' | 'lost' | 'tie' | null
  sets_won?: number
  sets_lost?: number
  games_won?: number
  games_lost?: number
  activity_type?: string
}

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const contactId = params.id as string
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<TennisActivity[]>([])
  const [loadingActivities, setLoadingActivities] = useState(true)
  const [sharedTeams, setSharedTeams] = useState<Array<{
    team_id: string
    team_name: string
    organization: string | null
    league: string | null
    year: number | null
  }>>([])
  const [loadingSharedTeams, setLoadingSharedTeams] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (contactId) {
      loadContact()
      loadTennisHistory()
      loadSharedTeams()
    }
  }, [contactId])

  async function loadContact() {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Error loading contact:', error)
        toast({
          title: 'Error',
          description: 'Failed to load contact',
          variant: 'destructive',
        })
        router.push('/contacts')
      } else {
        setContact(data)
      }
    } catch (error: any) {
      console.error('Error loading contact:', error)
      toast({
        title: 'Error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      })
      router.push('/contacts')
    } finally {
      setLoading(false)
    }
  }

  async function loadTennisHistory() {
    try {
      setLoadingActivities(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || !contact) return

      const allActivities: TennisActivity[] = []

      // Find matches where both users participated
      if (contact.linked_profile_id) {
        // Get matches where current user and contact both played
        const { data: userLineups } = await supabase
          .from('match_lineups')
          .select(`
            id,
            match_id,
            matches!inner(
              id,
              date,
              time,
              opponent_name,
              location,
              match_result,
              team_id,
              teams(name)
            )
          `)
          .eq('player1_id', user.id)
          .or(`player2_id.eq.${user.id}`)

        const { data: contactLineups } = await supabase
          .from('match_lineups')
          .select(`
            id,
            match_id,
            matches!inner(
              id,
              date,
              time,
              opponent_name,
              location,
              match_result,
              team_id,
              teams(name)
            )
          `)
          .eq('player1_id', contact.linked_profile_id)
          .or(`player2_id.eq.${contact.linked_profile_id}`)

        // Find common matches
        const userMatchIds = new Set(userLineups?.map(l => l.match_id) || [])
        const commonMatches = contactLineups?.filter(l => userMatchIds.has(l.match_id)) || []

        for (const lineup of commonMatches) {
          const match = (lineup as any).matches
          const team = (match as any).teams
          
          // Get scores for this lineup
          const { data: scores } = await supabase
            .from('match_scores')
            .select('sets_won, sets_lost, games_won, games_lost')
            .eq('lineup_id', lineup.id)
            .single()

          allActivities.push({
            id: match.id,
            type: 'match',
            title: `Match vs ${match.opponent_name}`,
            date: match.date,
            time: match.time,
            location: match.location || undefined,
            team_name: team?.name,
            match_result: match.match_result,
            sets_won: scores?.sets_won,
            sets_lost: scores?.sets_lost,
            games_won: scores?.games_won,
            games_lost: scores?.games_lost,
          })
        }
      }

      // Find events where both users were invited/attended
      if (contact.email || contact.linked_profile_id) {
        const { data: userEvents } = await supabase
          .from('event_attendees')
          .select(`
            personal_event_id,
            personal_events!inner(
              id,
              title,
              date,
              time,
              location,
              activity_type,
              team_id,
              teams(name)
            )
          `)
          .eq('user_id', user.id)

        const contactEventQuery = contact.linked_profile_id
          ? supabase
              .from('event_attendees')
              .select(`
                personal_event_id,
                personal_events!inner(
                  id,
                  title,
                  date,
                  time,
                  location,
                  activity_type,
                  team_id,
                  teams(name)
                )
              `)
              .eq('user_id', contact.linked_profile_id)
          : supabase
              .from('event_attendees')
              .select(`
                personal_event_id,
                personal_events!inner(
                  id,
                  title,
                  date,
                  time,
                  location,
                  activity_type,
                  team_id,
                  teams(name)
                )
              `)
              .eq('email', contact.email?.toLowerCase())

        const { data: contactEvents } = await contactEventQuery

        const userEventIds = new Set(userEvents?.map(e => e.personal_event_id) || [])
        const commonEvents = contactEvents?.filter(e => userEventIds.has(e.personal_event_id)) || []

        for (const attendee of commonEvents) {
          const event = (attendee as any).personal_events
          const team = (event as any).teams
          
          allActivities.push({
            id: event.id,
            type: 'personal_activity',
            title: event.title,
            date: event.date,
            time: event.time,
            location: event.location || undefined,
            team_name: team?.name,
            activity_type: event.activity_type,
          })
        }
      }

      // Sort by date (newest first)
      allActivities.sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time || ''}`).getTime()
        const dateB = new Date(`${b.date} ${b.time || ''}`).getTime()
        return dateB - dateA
      })

      setActivities(allActivities)
    } catch (error: any) {
      console.error('Error loading tennis history:', error)
    } finally {
      setLoadingActivities(false)
    }
  }

  // Reload activities when contact loads
  useEffect(() => {
    if (contact) {
      loadTennisHistory()
      loadSharedTeams()
    }
  }, [contact])

  async function loadSharedTeams() {
    try {
      setLoadingSharedTeams(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || !contact) return

      // Find teams where both user and contact are/were roster members
      // Contact can be identified by linked_profile_id or email
      let contactRosterQuery = supabase
        .from('roster_members')
        .select(`
          team_id,
          teams!inner(
            id,
            name,
            organization,
            league,
            year
          )
        `)

      if (contact.linked_profile_id) {
        // Contact has an account - find by user_id
        contactRosterQuery = contactRosterQuery.eq('user_id', contact.linked_profile_id)
      } else if (contact.email) {
        // Contact doesn't have account - find by email
        contactRosterQuery = contactRosterQuery
          .eq('email', contact.email.toLowerCase())
          .is('user_id', null)
      } else {
        // No way to identify contact
        setSharedTeams([])
        setLoadingSharedTeams(false)
        return
      }

      const { data: contactRosters, error: contactError } = await contactRosterQuery

      if (contactError) {
        console.error('Error loading contact rosters:', contactError)
        setSharedTeams([])
        return
      }

      // Get user's roster memberships
      const { data: userRosters, error: userError } = await supabase
        .from('roster_members')
        .select(`
          team_id,
          teams!inner(
            id,
            name,
            organization,
            league,
            year
          )
        `)
        .eq('user_id', user.id)

      if (userError) {
        console.error('Error loading user rosters:', userError)
        setSharedTeams([])
        return
      }

      // Find teams where both are members
      const userTeamIds = new Set(userRosters?.map(r => r.team_id) || [])
      const shared = contactRosters
        ?.filter(r => userTeamIds.has(r.team_id))
        .map(r => {
          const team = (r as any).teams
          return {
            team_id: team.id,
            team_name: team.name,
            organization: team.organization,
            league: team.league,
            year: team.year,
          }
        }) || []

      // Remove duplicates and sort by year (newest first), then by team name
      const uniqueTeams = Array.from(
        new Map(shared.map(t => [t.team_id, t])).values()
      ).sort((a, b) => {
        if (a.year !== b.year) {
          return (b.year || 0) - (a.year || 0)
        }
        return a.team_name.localeCompare(b.team_name)
      })

      setSharedTeams(uniqueTeams)
    } catch (error: any) {
      console.error('Error loading shared teams:', error)
      setSharedTeams([])
    } finally {
      setLoadingSharedTeams(false)
    }
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  function handleCall() {
    if (contact?.phone) {
      window.location.href = `tel:${contact.phone}`
    }
  }

  function handleEmail() {
    if (contact?.email) {
      window.location.href = `mailto:${contact.email}`
    }
  }

  function handleMessage() {
    // TODO: Navigate to messages with this contact
    if (contact?.email) {
      window.location.href = `mailto:${contact.email}`
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!contact) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={contact.name} />
      
      <main className="flex-1 p-4 space-y-4">
        {/* Contact Header Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {getInitials(contact.name)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-semibold">{contact.name}</h2>
                  {contact.source === 'auto' && (
                    <Badge variant="outline" className="text-xs">
                      Auto
                    </Badge>
                  )}
                  {contact.relationship_type && (
                    <Badge variant="outline" className="text-xs">
                      {contact.relationship_type.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {contact.phone && (
                    <Button variant="outline" size="sm" onClick={handleCall}>
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                  )}
                  {contact.email && (
                    <Button variant="outline" size="sm" onClick={handleEmail}>
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                  )}
                  {contact.email && (
                    <Button variant="outline" size="sm" onClick={handleMessage}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information Tabs */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Information</TabsTrigger>
            <TabsTrigger value="history">
              Tennis History
              {activities.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activities.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contact.email && (
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{contact.email}</p>
                  </div>
                )}
                {contact.phone && (
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{contact.phone}</p>
                  </div>
                )}
                {contact.address && (
                  <div>
                    <Label className="text-muted-foreground">Address</Label>
                    <p className="font-medium">{contact.address}</p>
                  </div>
                )}
                {contact.notes && (
                  <div>
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="font-medium whitespace-pre-wrap">{contact.notes}</p>
                  </div>
                )}
                {contact.tags && contact.tags.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Tags</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {contact.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shared Teams */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Teams Together
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSharedTeams ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : sharedTeams.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No shared teams found</p>
                    <p className="text-xs mt-1">You haven't been on any teams together</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sharedTeams.map((team) => (
                      <div
                        key={team.team_id}
                        className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/teams/${team.team_id}`)}
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold mb-1">{team.team_name}</h4>
                          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                            {team.organization && (
                              <span>{team.organization}</span>
                            )}
                            {team.league && (
                              <span>• {team.league}</span>
                            )}
                            {team.year && (
                              <span>• {team.year}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {loadingActivities ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                </CardContent>
              </Card>
            ) : activities.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No shared tennis activities</h3>
                  <p className="text-sm text-muted-foreground">
                    You haven't played tennis together yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <Card key={activity.id} className="hover:bg-accent transition-colors">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {activity.type === 'match' ? (
                            <Trophy className="h-5 w-5 text-orange-500" />
                          ) : activity.type === 'personal_activity' ? (
                            <Zap className="h-5 w-5 text-blue-500" />
                          ) : (
                            <Users className="h-5 w-5 text-green-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-sm">{activity.title}</h3>
                            {activity.type === 'match' && activity.match_result && (
                              <Badge
                                variant={
                                  activity.match_result === 'won'
                                    ? 'default'
                                    : activity.match_result === 'lost'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                                className="text-xs"
                              >
                                {activity.match_result === 'won' ? 'Won' : activity.match_result === 'lost' ? 'Lost' : 'Tie'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(activity.date)}
                              {activity.time && ` at ${formatTime(activity.time)}`}
                            </span>
                            {activity.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {activity.location}
                              </span>
                            )}
                            {activity.team_name && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {activity.team_name}
                              </span>
                            )}
                          </div>
                          {activity.type === 'match' && (activity.sets_won !== undefined || activity.games_won !== undefined) && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {activity.sets_won !== undefined && activity.sets_lost !== undefined && (
                                <span>Sets: {activity.sets_won}-{activity.sets_lost}</span>
                              )}
                              {activity.games_won !== undefined && activity.games_lost !== undefined && (
                                <span className="ml-3">
                                  Games: {activity.games_won}-{activity.games_lost}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Dialog */}
      <AddEditContactDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        contact={contact}
        onSaved={() => {
          loadContact()
          setEditDialogOpen(false)
        }}
      />
    </div>
  )
}

