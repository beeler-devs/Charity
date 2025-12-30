'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Loader2, UserCheck, UserX, Search, Users } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface FoundUser {
  id: string
  email: string
  full_name: string | null
  ntrp_rating: number | null
}

interface AddPlayerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  onAdded: () => void
}

export function AddPlayerDialog({ open, onOpenChange, teamId, onAdded }: AddPlayerDialogProps) {
  const [mode, setMode] = useState<'search' | 'manual'>('search') // 'search' for existing users, 'manual' for new
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [ntrpRating, setNtrpRating] = useState('')
  const [role, setRole] = useState<'captain' | 'co-captain' | 'player'>('player')
  const [loading, setLoading] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null)
  const [emailChecked, setEmailChecked] = useState(false)
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoundUser[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<FoundUser | null>(null)
  
  const { toast } = useToast()
  
  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setMode('search')
      setFullName('')
      setEmail('')
      setPhone('')
      setNtrpRating('')
      setRole('player')
      setFoundUser(null)
      setEmailChecked(false)
      setSearchQuery('')
      setSearchResults([])
      setSelectedUser(null)
    }
  }, [open])

  // Search for users when search query changes (debounced)
  useEffect(() => {
    if (mode === 'search' && searchQuery.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        searchUsers(searchQuery.trim())
      }, 300) // Debounce 300ms
      
      return () => clearTimeout(timeoutId)
    } else {
      setSearchResults([])
    }
  }, [searchQuery, mode])
  
  // Check for existing user when email changes (manual mode)
  useEffect(() => {
    if (mode === 'manual' && email && email.includes('@')) {
      checkForExistingUser(email)
    } else {
      setFoundUser(null)
      setEmailChecked(false)
    }
  }, [email, mode])

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
    const results: FoundUser[] = []
    const seenUserIds = new Set<string>()
    const seenEmails = new Set<string>()
    
    // First, search profiles (all app users)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, ntrp_rating')
      .or(`full_name.ilike.%${searchLower}%,email.ilike.%${searchLower}%`)
      .limit(20)
      .order('full_name', { ascending: true, nullsFirst: false })
    
    if (!profilesError && profiles) {
      profiles.forEach(profile => {
        if (profile.id && profile.email) {
          results.push(profile)
          seenUserIds.add(profile.id)
          seenEmails.add(profile.email.toLowerCase())
        }
      })
    }
    
    // Also search roster members from user's teams (includes non-app users)
    // Get all teams the current user is on
    const { data: userRosterMemberships } = await supabase
      .from('roster_members')
      .select('team_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
    
    if (userRosterMemberships && userRosterMemberships.length > 0) {
      const userTeamIds = userRosterMemberships.map(rm => rm.team_id)
      
      // Search roster members from user's teams
      const { data: rosterMembers, error: rosterError } = await supabase
        .from('roster_members')
        .select('user_id, email, full_name, ntrp_rating, profiles(id, email, full_name, ntrp_rating)')
        .in('team_id', userTeamIds)
        .eq('is_active', true)
        .or(`full_name.ilike.%${searchLower}%,email.ilike.%${searchLower}%`)
        .limit(20)
      
      if (!rosterError && rosterMembers) {
        rosterMembers.forEach((rm: any) => {
          const email = rm.email?.toLowerCase() || ''
          const profile = Array.isArray(rm.profiles) ? rm.profiles[0] : rm.profiles
          
          // Skip if already in results (from profiles search)
          if (rm.user_id && seenUserIds.has(rm.user_id)) {
            return
          }
          if (email && seenEmails.has(email)) {
            return
          }
          
          // Prefer profile data if available, otherwise use roster member data
          if (profile) {
            // User has a profile - should already be in results from profiles search
            // But add if somehow missed
            if (!seenUserIds.has(profile.id)) {
              results.push({
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name,
                ntrp_rating: profile.ntrp_rating,
              })
              seenUserIds.add(profile.id)
              seenEmails.add(profile.email.toLowerCase())
            }
          } else if (rm.email) {
            // Non-app user - add from roster member data
            results.push({
              id: rm.user_id || '', // May be null for non-app users, but we'll use email as identifier
              email: rm.email,
              full_name: rm.full_name,
              ntrp_rating: rm.ntrp_rating,
            })
            if (rm.user_id) {
              seenUserIds.add(rm.user_id)
            }
            seenEmails.add(email)
          }
        })
      }
    }
    
    // Sort results by name
    results.sort((a, b) => {
      const nameA = (a.full_name || a.email || '').toLowerCase()
      const nameB = (b.full_name || b.email || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })
    
    setSearchResults(results.slice(0, 20))
    setSearching(false)
  }
  
  async function checkForExistingUser(emailToCheck: string) {
    setCheckingEmail(true)
    const supabase = createClient()

    // Check if user exists with this email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, ntrp_rating')
      .eq('email', emailToCheck.toLowerCase().trim())
      .maybeSingle()

    if (profile) {
      setFoundUser(profile)
      // Pre-fill fields with user data
      if (profile.full_name && !fullName) {
        setFullName(profile.full_name)
      }
      if (profile.ntrp_rating && !ntrpRating) {
        setNtrpRating(profile.ntrp_rating.toString())
      }
    } else {
      setFoundUser(null)
    }

    setEmailChecked(true)
    setCheckingEmail(false)
  }
  
  function handleSelectUser(user: FoundUser) {
    setSelectedUser(user)
    setFoundUser(user)
    setEmail(user.email)
    setFullName(user.full_name || '')
    setNtrpRating(user.ntrp_rating?.toString() || '')
    setSearchQuery('')
    setSearchResults([])
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

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

    // Determine which user to use (selected from search or found by email)
    const userToAdd = selectedUser || foundUser
    
    // If user exists in app, add directly to roster
    if (userToAdd && userToAdd.id) {
      // Check if user is already on roster (including inactive)
      const { data: existingMember } = await supabase
        .from('roster_members')
        .select('id, is_active')
        .eq('team_id', teamId)
        .eq('user_id', userToAdd.id)
        .maybeSingle()

      if (existingMember) {
        if (existingMember.is_active) {
          toast({
            title: 'Already on roster',
            description: `${userToAdd.full_name || userToAdd.email} is already on this team`,
            variant: 'destructive',
          })
        } else {
          // Reactivate inactive member
          const oldRole = existingMember.role as 'captain' | 'co-captain' | 'player' | undefined
          const newRole = role || oldRole || 'player'
          const roleChanged = oldRole !== newRole

          const { error: reactivateError } = await supabase
            .from('roster_members')
            .update({
              is_active: true,
              full_name: fullName || userToAdd.full_name || '',
              email: email || userToAdd.email || '',
              phone: phone || null,
              ntrp_rating: ntrpRating ? parseFloat(ntrpRating) : userToAdd.ntrp_rating || null,
              role: newRole,
            })
            .eq('id', existingMember.id)

          if (reactivateError) {
            toast({
              title: 'Error',
              description: reactivateError.message,
              variant: 'destructive',
            })
          } else {
            // If role changed and player has a user_id, update team's captain/co_captain_id
            if (roleChanged && userToAdd.id) {
              const teamUpdates: { captain_id?: string | null; co_captain_id?: string | null } = {}

              // Clear old role assignments
              if (oldRole === 'captain') {
                teamUpdates.captain_id = null
              }
              if (oldRole === 'co-captain') {
                teamUpdates.co_captain_id = null
              }

              // Set new role assignments
              if (newRole === 'captain') {
                teamUpdates.captain_id = userToAdd.id
                if (oldRole === 'co-captain') {
                  teamUpdates.co_captain_id = null
                }
              } else if (newRole === 'co-captain') {
                teamUpdates.co_captain_id = userToAdd.id
                if (oldRole === 'captain') {
                  teamUpdates.captain_id = null
                }
              }

              // Update team if there are changes
              if (Object.keys(teamUpdates).length > 0) {
                const { error: teamError } = await supabase
                  .from('teams')
                  .update(teamUpdates)
                  .eq('id', teamId)

                if (teamError) {
                  console.error('Error updating team captain/co-captain:', teamError)
                }
              }
            }

            toast({
              title: 'Player added',
              description: `${userToAdd.full_name || userToAdd.email} has been added to the roster`,
            })
            setFullName('')
            setEmail('')
            setPhone('')
            setNtrpRating('')
            setRole('player')
            setFoundUser(null)
            setSelectedUser(null)
            setEmailChecked(false)
            onAdded()
          }
        }
        setLoading(false)
        return
      }

      // Add user directly to roster
      const { error: insertError } = await supabase
        .from('roster_members')
        .insert({
          team_id: teamId,
          user_id: userToAdd.id,
          full_name: fullName || userToAdd.full_name || '',
          email: email || userToAdd.email || '',
          phone: phone || null,
          ntrp_rating: ntrpRating ? parseFloat(ntrpRating) : userToAdd.ntrp_rating || null,
          role: role || 'player',
          is_active: true,
        })

      if (insertError) {
        toast({
          title: 'Error adding player',
          description: insertError.message,
          variant: 'destructive',
        })
      } else {
        // If role is captain or co-captain, update team's captain_id or co_captain_id
        if (role === 'captain' || role === 'co-captain') {
          const teamUpdates: { captain_id?: string | null; co_captain_id?: string | null } = {}
          
          if (role === 'captain') {
            teamUpdates.captain_id = userToAdd.id
          } else if (role === 'co-captain') {
            teamUpdates.co_captain_id = userToAdd.id
          }

          const { error: teamError } = await supabase
            .from('teams')
            .update(teamUpdates)
            .eq('id', teamId)

          if (teamError) {
            console.error('Error updating team captain/co-captain:', teamError)
            toast({
              title: 'Warning',
              description: 'Player added, but team assignment may not have been updated. Please check team settings.',
              variant: 'default',
            })
          }
        }

        toast({
          title: 'Player added!',
          description: `${userToAdd.full_name || userToAdd.email} has been added to the roster`,
        })
        setFullName('')
        setEmail('')
        setPhone('')
        setNtrpRating('')
        setRole('player')
        setFoundUser(null)
        setSelectedUser(null)
        setEmailChecked(false)
        onAdded()
      }
      setLoading(false)
      return
    } else {
      // Fall back to adding as non-user roster member
      // First check if email already exists on roster (including inactive members)
      if (email) {
        const normalizedEmail = email.toLowerCase().trim()
        
        // Check for existing roster member by email (including inactive)
        const { data: existingMemberByEmail } = await supabase
          .from('roster_members')
          .select('id, full_name, email, user_id, is_active')
          .eq('team_id', teamId)
          .ilike('email', normalizedEmail)
          .maybeSingle()

        if (existingMemberByEmail) {
          if (existingMemberByEmail.is_active) {
            toast({
              title: 'Already on roster',
              description: `${existingMemberByEmail.full_name || existingMemberByEmail.email || email} is already on this team`,
              variant: 'destructive',
            })
          } else {
            // Inactive member exists - reactivate them instead
            const { error: reactivateError } = await supabase
              .from('roster_members')
              .update({
                is_active: true,
                full_name: fullName || existingMemberByEmail.full_name,
                phone: phone || existingMemberByEmail.phone,
                ntrp_rating: ntrpRating ? parseFloat(ntrpRating) : existingMemberByEmail.ntrp_rating,
                role: role || existingMemberByEmail.role,
              })
              .eq('id', existingMemberByEmail.id)

            if (reactivateError) {
              toast({
                title: 'Error',
                description: reactivateError.message,
                variant: 'destructive',
              })
            } else {
              toast({
                title: 'Player reactivated',
                description: `${fullName || existingMemberByEmail.full_name} has been added back to the roster`,
              })
              setFullName('')
              setEmail('')
              setPhone('')
              setNtrpRating('')
              setRole('player')
              setFoundUser(null)
              setSelectedUser(null)
              setEmailChecked(false)
              onAdded()
            }
            setLoading(false)
            return
          }
          setLoading(false)
          return
        }
        
        // Also check if there's a user with this email who is already on the roster
        const { data: profileWithEmail } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .eq('email', normalizedEmail)
          .maybeSingle()
        
        if (profileWithEmail) {
          const { data: existingMemberByUserId } = await supabase
            .from('roster_members')
            .select('id, full_name, email, is_active')
            .eq('team_id', teamId)
            .eq('user_id', profileWithEmail.id)
            .maybeSingle()
          
          if (existingMemberByUserId) {
            if (existingMemberByUserId.is_active) {
              toast({
                title: 'Already on roster',
                description: `${profileWithEmail.full_name || profileWithEmail.email} is already on this team`,
                variant: 'destructive',
              })
            } else {
              // Inactive member exists - reactivate them
              const { error: reactivateError } = await supabase
                .from('roster_members')
                .update({
                  is_active: true,
                  role: role || existingMemberByUserId.role,
                })
                .eq('id', existingMemberByUserId.id)

              if (reactivateError) {
                toast({
                  title: 'Error',
                  description: reactivateError.message,
                  variant: 'destructive',
                })
              } else {
                toast({
                  title: 'Player reactivated',
                  description: `${profileWithEmail.full_name || profileWithEmail.email} has been added back to the roster`,
                })
                setFullName('')
                setEmail('')
                setPhone('')
                setNtrpRating('')
                setRole('player')
                setFoundUser(null)
                setSelectedUser(null)
                setEmailChecked(false)
                onAdded()
              }
            }
            setLoading(false)
            return
          }
        }
      }

      const { error } = await supabase.from('roster_members').insert({
        team_id: teamId,
        full_name: fullName,
        email: email || null,
        phone: phone || null,
        ntrp_rating: ntrpRating ? parseFloat(ntrpRating) : null,
        role,
      })

      if (error) {
        // Check if it's a duplicate key error
        if (error.code === '23505' || error.message.includes('duplicate key')) {
          toast({
            title: 'Already on roster',
            description: `${fullName || email} is already on this team`,
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Error',
            description: error.message,
            variant: 'destructive',
          })
        }
      } else {
        toast({
          title: 'Player added',
          description: `${fullName} has been added to the roster`,
        })
        setFullName('')
        setEmail('')
        setPhone('')
        setNtrpRating('')
        setRole('player')
        setFoundUser(null)
        setEmailChecked(false)
        onAdded()
      }
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Player to Roster</DialogTitle>
          <DialogDescription>
            Search for existing users or add a new player manually
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAdd}>
          <div className="space-y-4 py-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'search' | 'manual')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="search">
                  <Search className="h-4 w-4 mr-2" />
                  Search Existing
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <Users className="h-4 w-4 mr-2" />
                  Add New
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="search" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Search for User</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  {searching && (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                  
                  {selectedUser && (
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                      <UserCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          Selected: {selectedUser.full_name || selectedUser.email}
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300">
                          {selectedUser.email}
                          {selectedUser.ntrp_rating && ` • NTRP ${selectedUser.ntrp_rating}`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(null)
                          setFoundUser(null)
                          setEmail('')
                          setFullName('')
                          setNtrpRating('')
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  )}
                  
                  {!selectedUser && searchResults.length > 0 && (
                    <div className="border rounded-md p-2 max-h-60 overflow-y-auto">
                      <div className="space-y-1">
                        {searchResults.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => handleSelectUser(user)}
                            className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {(user.full_name || user.email)
                                  .split(' ')
                                  .map(n => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {user.full_name || 'No name'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {user.email}
                              </p>
                            </div>
                            {user.ntrp_rating && (
                              <Badge variant="secondary" className="text-xs">
                                NTRP {user.ntrp_rating}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {!selectedUser && searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No users found matching "{searchQuery}"
                    </div>
                  )}
                  
                  {!selectedUser && searchQuery.length < 2 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Type at least 2 characters to search
                    </div>
                  )}
                </div>
                
                {selectedUser && (
                  <div className="space-y-2">
                    <Label htmlFor="role-search">Role</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as 'captain' | 'co-captain' | 'player')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="player">Player</SelectItem>
                        <SelectItem value="co-captain">Co-Captain</SelectItem>
                        <SelectItem value="captain">Captain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="manual" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  {checkingEmail && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking for user...
                    </p>
                  )}
                  {emailChecked && foundUser && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-md">
                      <UserCheck className="h-4 w-4 text-green-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          User found: {foundUser.full_name || foundUser.email}
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300">
                          Will send invitation instead of adding directly
                        </p>
                      </div>
                    </div>
                  )}
                  {emailChecked && !foundUser && email && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-md">
                      <UserX className="h-4 w-4 text-blue-600" />
                      <p className="text-xs text-blue-900 dark:text-blue-100">
                        No user found - will add as roster member
                      </p>
                    </div>
                  )}
                </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={foundUser !== null}
              />
              {foundUser && (
                <p className="text-xs text-muted-foreground">
                  Auto-filled from user profile
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rating">NTRP Rating</Label>
                <Input
                  id="rating"
                  type="number"
                  step="0.5"
                  min="2.0"
                  max="7.0"
                  placeholder="4.0"
                  value={ntrpRating}
                  onChange={(e) => setNtrpRating(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as 'captain' | 'co-captain' | 'player')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="co-captain">Co-Captain</SelectItem>
                    <SelectItem value="captain">Captain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={
                loading || 
                (mode === 'search' && !selectedUser) ||
                (mode === 'manual' && (!fullName || !email))
              }
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'search' && selectedUser
                ? 'Send Invitation'
                : mode === 'manual' && foundUser
                ? 'Send Invitation'
                : 'Add Player'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
