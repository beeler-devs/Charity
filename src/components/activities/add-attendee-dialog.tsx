'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Loader2, X, Search, UserCheck, UserX } from 'lucide-react'
import { EmailService } from '@/services/EmailService'

interface SearchResult {
  id?: string // user_id if in app
  email: string
  name?: string
  isAppUser: boolean
  source: 'profile' | 'roster' | 'contact'
}

interface AddAttendeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  onAdded: () => void
  initialEditScope?: 'series' | 'single'
}

export function AddAttendeeDialog({
  open,
  onOpenChange,
  eventId,
  onAdded,
  initialEditScope,
}: AddAttendeeDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedAttendees, setSelectedAttendees] = useState<Array<SearchResult & { actionType: 'direct' | 'invite' }>>([])
  const [loading, setLoading] = useState(false)
  const [existingAttendees, setExistingAttendees] = useState<Set<string>>(new Set())
  const [isRecurring, setIsRecurring] = useState(false)
  const [editScope, setEditScope] = useState<'series' | 'single'>('single')
  const [seriesEvents, setSeriesEvents] = useState<Array<{ id: string; date: string }>>([])
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadEventInfo()
      loadExistingAttendees()
      resetForm()
    }
  }, [open, eventId])

  async function loadEventInfo() {
    const supabase = createClient()
    
    // Check if this is a personal event with recurrence
    const { data: personalEvent } = await supabase
      .from('personal_events')
      .select('recurrence_series_id, recurrence_pattern, date')
      .eq('id', eventId)
      .single()

    if (personalEvent?.recurrence_series_id) {
      setIsRecurring(true)
      
      // Load all events in the series
      const { data: series } = await supabase
        .from('personal_events')
        .select('id, date')
        .eq('recurrence_series_id', personalEvent.recurrence_series_id)
        .order('date', { ascending: true })

      if (series) {
        setSeriesEvents(series)
        
        // Determine default scope
        if (initialEditScope) {
          setEditScope(initialEditScope)
        } else {
          // Default to 'single' for future events, 'series' for past events
          const eventDate = new Date(personalEvent.date)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          
          if (eventDate >= today) {
            setEditScope('single')
          } else {
            setEditScope('series')
          }
        }
      }
    } else {
      setIsRecurring(false)
      setEditScope('single')
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

  async function loadExistingAttendees() {
    const supabase = createClient()
    const { data } = await supabase
      .from('event_attendees')
      .select('email, user_id')
      .eq('personal_event_id', eventId)

    if (data) {
      const emails = new Set<string>()
      data.forEach(att => {
        if (att.email) {
          emails.add(att.email.toLowerCase())
        }
        if (att.user_id) {
          emails.add(att.user_id) // Track by user_id too
        }
      })
      setExistingAttendees(emails)
    }
  }

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
    const results: SearchResult[] = []
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
        } else if (contact.name && !emailLower) {
          // Contact without email - still show in results but mark as needing email
          // We'll allow user to add email manually
          const nameKey = contact.name.toLowerCase()
          if (!seenEmails.has(nameKey)) {
            results.push({
              id: contact.linked_profile_id || undefined,
              email: contact.email || '', // Will need to be filled in
              name: contact.name,
              isAppUser: !!contact.linked_profile_id,
              source: 'contact',
            })
            if (contact.linked_profile_id) seenUserIds.add(contact.linked_profile_id)
            seenEmails.add(nameKey)
          }
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

  function handleSelectResult(result: SearchResult) {
    // Check if already selected
    const emailLower = result.email.toLowerCase()
    if (selectedAttendees.some(att => att.email.toLowerCase() === emailLower)) {
      toast({
        title: 'Already selected',
        description: 'This person is already in your list',
        variant: 'default',
      })
      return
    }

    // Check if already an attendee
    if (existingAttendees.has(emailLower) || (result.id && existingAttendees.has(result.id))) {
      toast({
        title: 'Already added',
        description: 'This person is already an attendee',
        variant: 'destructive',
      })
      return
    }

    // Auto-select action type based on whether user is in app
    const actionType: 'direct' | 'invite' = result.isAppUser ? 'direct' : 'direct'
    
    // Add to selected list
    setSelectedAttendees([...selectedAttendees, { ...result, actionType }])
    
    // Clear search
    setSearchQuery('')
    setSearchResults([])
  }

  function removeSelectedAttendee(index: number) {
    setSelectedAttendees(selectedAttendees.filter((_, i) => i !== index))
  }

  function resetForm() {
    setSearchQuery('')
    setSearchResults([])
    setSelectedAttendees([])
    setIsRecurring(false)
    setEditScope('single')
    setSeriesEvents([])
  }

  async function handleAddAll() {
    if (selectedAttendees.length === 0) {
      toast({
        title: 'No attendees selected',
        description: 'Please select at least one person to add',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    try {
      // Get event data for invitations
      const { data: eventData } = await supabase
        .from('personal_events')
        .select('title, date, time, location')
        .eq('id', eventId)
        .single()

      const directAttendees: any[] = []
      const invitations: any[] = []

      // Separate direct attendees and invitations
      selectedAttendees.forEach(attendee => {
        const emailLower = attendee.email.toLowerCase()
        
        if (attendee.actionType === 'direct') {
          const attendeeData: any = {
            personal_event_id: eventId,
            email: emailLower,
            name: attendee.name?.trim() || null,
            availability_status: 'available',
            added_via: 'direct',
          }

          if (attendee.isAppUser && attendee.id) {
            attendeeData.user_id = attendee.id
          }

          directAttendees.push(attendeeData)
        } else {
          invitations.push({
            event_id: eventId,
            inviter_id: user.id,
            invitee_id: attendee.isAppUser ? attendee.id : null,
            invitee_email: emailLower,
            invitee_name: attendee.name?.trim() || null,
            status: 'pending',
          })
        }
      })

      // Insert direct attendees
      if (directAttendees.length > 0) {
        // If recurring and scope is 'series', add to all events in series
        if (isRecurring && editScope === 'series' && seriesEvents.length > 0) {
          const allAttendees: any[] = []
          
          seriesEvents.forEach(seriesEvent => {
            directAttendees.forEach(attendee => {
              allAttendees.push({
                ...attendee,
                personal_event_id: seriesEvent.id,
              })
            })
          })

          const { error: attendeeError } = await supabase
            .from('event_attendees')
            .insert(allAttendees)

          if (attendeeError) {
            throw attendeeError
          }
        } else {
          // Single event or single scope
          const { error: attendeeError } = await supabase
            .from('event_attendees')
            .insert(directAttendees)

          if (attendeeError) {
            throw attendeeError
          }
        }
      }

      // Insert invitations
      if (invitations.length > 0) {
        // If recurring and scope is 'series', add to all events in series
        if (isRecurring && editScope === 'series' && seriesEvents.length > 0) {
          const allInvitations: any[] = []
          
          seriesEvents.forEach(seriesEvent => {
            invitations.forEach(invitation => {
              allInvitations.push({
                ...invitation,
                event_id: seriesEvent.id,
              })
            })
          })

          const { error: inviteError } = await supabase
            .from('event_invitations')
            .insert(allInvitations)

          if (inviteError) {
            throw inviteError
          }
        } else {
          // Single event or single scope
          const { error: inviteError } = await supabase
            .from('event_invitations')
            .insert(invitations)

          if (inviteError) {
            throw inviteError
          }
        }

        // Send invitation emails for non-app users
        if (eventData) {
          const emailPromises = invitations
            .filter(inv => !inv.invitee_id) // Only non-app users
            .map(async (inv) => {
              const emailData = EmailService.compileEventInvitationEmail({
                eventName: eventData.title,
                eventDate: eventData.date,
                eventTime: eventData.time,
                eventLocation: eventData.location || undefined,
                inviterName: user.user_metadata?.full_name || 'Someone',
                inviteeName: inv.invitee_name || undefined,
              })

              emailData.to = inv.invitee_email

              try {
                await fetch('/api/email/send-invitation', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ emailData }),
                })
              } catch (emailError) {
                console.error('Error sending invitation email:', emailError)
                // Don't fail the whole operation if email fails
              }
            })

          await Promise.all(emailPromises)
        }
      }

      const addedCount = directAttendees.length
      const invitedCount = invitations.length
      
      toast({
        title: 'Attendees added',
        description: addedCount > 0 && invitedCount > 0
          ? `${addedCount} attendee${addedCount !== 1 ? 's' : ''} added and ${invitedCount} invitation${invitedCount !== 1 ? 's' : ''} sent`
          : addedCount > 0
          ? `${addedCount} attendee${addedCount !== 1 ? 's' : ''} added`
          : `${invitedCount} invitation${invitedCount !== 1 ? 's' : ''} sent`,
      })

      // Refresh parent component
      onAdded()
      
      // Reset form
      resetForm()
      
      // Reload existing attendees to update the duplicate check
      await loadExistingAttendees()
    } catch (error: any) {
      console.error('Error adding attendees:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to add attendees',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Attendees</DialogTitle>
          <DialogDescription>
            Search for people to add to this activity. Click on a name to add them to your list.
          </DialogDescription>
        </DialogHeader>

        {/* Recurring Event Scope Selection */}
        {isRecurring && (
          <div className="space-y-2 py-2 border-b px-6">
            <Label>Apply to</Label>
            <Select value={editScope} onValueChange={(value: 'series' | 'single') => setEditScope(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">This occurrence only</SelectItem>
                <SelectItem value="series">All occurrences ({seriesEvents.length} events)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {editScope === 'series' 
                ? `Attendees will be added to all ${seriesEvents.length} events in this series.`
                : 'Attendees will only be added to this specific event.'}
            </p>
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search contacts</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
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
                {searchResults.map((result, idx) => {
                  const emailLower = result.email.toLowerCase()
                  const isAlreadySelected = selectedAttendees.some(att => att.email.toLowerCase() === emailLower)
                  const isAlreadyAttendee = existingAttendees.has(emailLower) || (result.id && existingAttendees.has(result.id))
                  
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectResult(result)}
                      disabled={isAlreadySelected || isAlreadyAttendee}
                      className={`w-full p-2 flex items-center gap-2 text-left ${
                        isAlreadySelected || isAlreadyAttendee
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
                          {isAlreadyAttendee && (
                            <Badge variant="outline" className="text-xs">
                              Already Added
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
                    <Badge variant="secondary" className="text-xs mr-2">
                      {attendee.actionType === 'direct' ? 'Attendee' : 'Invite'}
                    </Badge>
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

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleAddAll} 
            disabled={loading || selectedAttendees.length === 0}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {selectedAttendees.length > 0 ? `${selectedAttendees.length} ` : ''}Attendee{selectedAttendees.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

