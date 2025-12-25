'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { Loader2, X, Search, UserPlus, Mail } from 'lucide-react'
import { EventInvitation, Profile } from '@/types/database.types'

interface Invitee {
  id?: string // user_id if in app
  email: string
  name?: string
  type: 'teammate' | 'app_user' | 'email'
}

interface EventInvitationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  onInvited: () => void
}

export function EventInvitationDialog({
  open,
  onOpenChange,
  eventId,
  onInvited,
}: EventInvitationDialogProps) {
  const [invitees, setInvitees] = useState<Invitee[]>([])
  const [emailInput, setEmailInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [teammates, setTeammates] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([])
  const [invitationMessage, setInvitationMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadTeams()
      loadExistingInvitations()
    }
  }, [open, eventId])

  useEffect(() => {
    if (selectedTeamId) {
      loadTeammates(selectedTeamId)
    } else {
      setTeammates([])
    }
  }, [selectedTeamId])

  async function loadTeams() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

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
      if (teamsList.length > 0 && !selectedTeamId) {
        setSelectedTeamId(teamsList[0].id)
      }
    }
  }

  async function loadTeammates(teamId: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { data: rosterData } = await supabase
      .from('roster_members')
      .select('id, user_id, full_name, email, profiles(id, email, full_name)')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .neq('user_id', user.id) // Exclude current user

    if (rosterData) {
      const teammatesList = rosterData.map((rm: any) => ({
        id: rm.user_id || rm.id,
        name: rm.full_name || rm.profiles?.full_name || 'Unknown',
        email: rm.email || rm.profiles?.email || '',
      }))
      setTeammates(teammatesList)
    }
  }

  async function loadExistingInvitations() {
    const supabase = createClient()
    const { data } = await supabase
      .from('event_invitations')
      .select('invitee_id, invitee_email, invitee_name')
      .eq('event_id', eventId)
      .in('status', ['pending', 'accepted'])

    if (data) {
      const existingInvitees: Invitee[] = data.map((inv: any) => ({
        id: inv.invitee_id,
        email: inv.invitee_email,
        name: inv.invitee_name,
        type: inv.invitee_id ? 'app_user' : 'email',
      }))
      setInvitees(existingInvitees)
    }
  }

  async function searchUsers(query: string) {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(10)

    if (error) {
      console.error('Error searching users:', error)
      setSearchResults([])
    } else {
      setSearchResults(data || [])
    }

    setSearching(false)
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        searchUsers(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  function addTeammate(teammate: { id: string; name: string; email: string }) {
    if (invitees.some(inv => inv.email.toLowerCase() === teammate.email.toLowerCase())) {
      toast({
        title: 'Already added',
        description: `${teammate.name} is already in the invite list`,
        variant: 'default',
      })
      return
    }

    setInvitees([...invitees, {
      id: teammate.id,
      email: teammate.email,
      name: teammate.name,
      type: 'teammate',
    }])
  }

  function addAppUser(user: Profile) {
    if (invitees.some(inv => inv.email.toLowerCase() === user.email.toLowerCase())) {
      toast({
        title: 'Already added',
        description: `${user.full_name || user.email} is already in the invite list`,
        variant: 'default',
      })
      return
    }

    setInvitees([...invitees, {
      id: user.id,
      email: user.email,
      name: user.full_name || undefined,
      type: 'app_user',
    }])
    setSearchQuery('')
    setSearchResults([])
  }

  function addEmailInvitee() {
    const email = emailInput.trim().toLowerCase()
    if (!email) {
      toast({
        title: 'Email required',
        description: 'Please enter an email address',
        variant: 'destructive',
      })
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      })
      return
    }

    if (invitees.some(inv => inv.email.toLowerCase() === email)) {
      toast({
        title: 'Already added',
        description: 'This email is already in the invite list',
        variant: 'default',
      })
      return
    }

    setInvitees([...invitees, {
      email,
      name: nameInput.trim() || undefined,
      type: 'email',
    }])
    setEmailInput('')
    setNameInput('')
  }

  function removeInvitee(index: number) {
    setInvitees(invitees.filter((_, i) => i !== index))
  }

  async function sendInvitations() {
    if (invitees.length === 0) {
      toast({
        title: 'No invitees',
        description: 'Please add at least one person to invite',
        variant: 'destructive',
      })
      return
    }

    setSending(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in',
        variant: 'destructive',
      })
      setSending(false)
      return
    }

    // Check existing invitations to avoid duplicates
    const { data: existing } = await supabase
      .from('event_invitations')
      .select('invitee_email')
      .eq('event_id', eventId)
      .in('status', ['pending', 'accepted'])

    const existingEmails = new Set((existing || []).map((inv: any) => inv.invitee_email.toLowerCase()))

    const invitationsToCreate = invitees
      .filter(inv => !existingEmails.has(inv.email.toLowerCase()))
      .map(invitee => ({
        event_id: eventId,
        inviter_id: user.id,
        invitee_id: invitee.id || null,
        invitee_email: invitee.email,
        invitee_name: invitee.name || null,
        status: 'pending' as const,
        message: invitationMessage || null,
      }))

    if (invitationsToCreate.length === 0) {
      toast({
        title: 'All invited',
        description: 'All selected people have already been invited',
        variant: 'default',
      })
      setSending(false)
      return
    }

    const { error } = await supabase
      .from('event_invitations')
      .insert(invitationsToCreate)

    if (error) {
      toast({
        title: 'Error sending invitations',
        description: error.message,
        variant: 'destructive',
      })
      setSending(false)
      return
    }

    toast({
      title: 'Invitations sent',
      description: `Sent ${invitationsToCreate.length} invitation${invitationsToCreate.length > 1 ? 's' : ''}`,
    })

    // TODO: Send email notifications here
    // For app users: Send in-app notification
    // For non-app users: Send email via EmailService with invitation details
    // Email should include: event title, date, time, location, invitation message, accept/decline links

    setInvitees([])
    setInvitationMessage('')
    onInvited()
    onOpenChange(false)
    setSending(false)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite People to Activity</DialogTitle>
          <DialogDescription>
            Invite teammates, app users, or anyone via email to join this activity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Teammates Section */}
          {teams.length > 0 && (
            <div className="space-y-2">
              <Label>Invite from Teams</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedTeamId && teammates.length > 0 && (
                <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                  <div className="space-y-1">
                    {teammates.map((teammate) => (
                      <div
                        key={teammate.id}
                        className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={() => addTeammate(teammate)}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(teammate.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-medium">{teammate.name}</div>
                            <div className="text-xs text-muted-foreground">{teammate.email}</div>
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="sm">
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search App Users */}
          <div className="space-y-2">
            <Label>Search App Users</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {searching && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                <div className="space-y-1">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={() => addAppUser(user)}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">{user.full_name || user.email}</div>
                          {user.full_name && (
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          )}
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="sm">
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Email Invitation */}
          <div className="space-y-2">
            <Label>Invite via Email</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Email address"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addEmailInvitee()
                  }
                }}
              />
              <Input
                type="text"
                placeholder="Name (optional)"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addEmailInvitee()
                  }
                }}
              />
              <Button type="button" onClick={addEmailInvitee}>
                <Mail className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          {/* Invitation Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Invitation Message (Optional)</Label>
            <Textarea
              id="message"
              value={invitationMessage}
              onChange={(e) => setInvitationMessage(e.target.value)}
              placeholder="Add a personal message to your invitation..."
              rows={3}
            />
          </div>

          {/* Invitee List */}
          {invitees.length > 0 && (
            <div className="space-y-2">
              <Label>Invitees ({invitees.length})</Label>
              <div className="border rounded-md p-2 space-y-2 max-h-48 overflow-y-auto">
                {invitees.map((invitee, index) => (
                  <div
                    key={`${invitee.email}-${index}`}
                    className="flex items-center justify-between p-2 bg-accent rounded"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(invitee.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">
                          {invitee.name || invitee.email}
                        </div>
                        {invitee.name && (
                          <div className="text-xs text-muted-foreground">{invitee.email}</div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {invitee.type === 'teammate' ? 'Teammate' : 
                         invitee.type === 'app_user' ? 'App User' : 'Email'}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeInvitee(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button onClick={sendInvitations} disabled={sending || invitees.length === 0}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              `Send ${invitees.length} Invitation${invitees.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


