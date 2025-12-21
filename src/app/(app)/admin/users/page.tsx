'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useIsSystemAdmin } from '@/hooks/use-is-system-admin'
import { Plus, Edit, Trash2, Users, Loader2, Search, Shield, LogIn } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { UserDialog } from '@/components/admin/user-dialog'
import { startImpersonation } from '@/lib/impersonation'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  ntrp_rating: number | null
  is_system_admin: boolean
  created_at: string
  roles: {
    team_id: string
    team_name: string
    role: string
  }[]
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { isAdmin, loading: adminLoading } = useIsSystemAdmin()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    if (!adminLoading) {
      if (!isAdmin) {
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to access this page',
          variant: 'destructive',
        })
        router.push('/home')
        return
      }
      loadUsers()
    }
  }, [isAdmin, adminLoading, router, toast])

  async function loadUsers() {
    const supabase = createClient()
    setLoading(true)

    try {
      // Load all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
        toast({
          title: 'Error',
          description: 'Failed to load users',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      // Load roster memberships to get roles
      const { data: rosterMembers, error: rosterError } = await supabase
        .from('roster_members')
        .select('user_id, team_id, role, teams(name)')
        .eq('is_active', true)

      if (rosterError) {
        console.error('Error loading roster members:', rosterError)
      }

      // Build a map of user roles
      const userRolesMap = new Map<string, { team_id: string; team_name: string; role: string }[]>()
      rosterMembers?.forEach((member) => {
        const teamName = (member.teams as any)?.name || 'Unknown Team'
        if (!userRolesMap.has(member.user_id)) {
          userRolesMap.set(member.user_id, [])
        }
        userRolesMap.get(member.user_id)!.push({
          team_id: member.team_id,
          team_name: teamName,
          role: member.role,
        })
      })

      // Combine profiles with roles
      const usersWithRoles: UserProfile[] = (profiles || []).map((profile) => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        phone: profile.phone,
        ntrp_rating: profile.ntrp_rating,
        is_system_admin: profile.is_system_admin || false,
        created_at: profile.created_at,
        roles: userRolesMap.get(profile.id) || [],
      }))

      setUsers(usersWithRoles)
    } catch (error) {
      console.error('Error loading users:', error)
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      })
    }

    setLoading(false)
  }

  async function handleImpersonateUser(user: UserProfile) {
    if (!confirm(`Are you sure you want to login as ${user.full_name || user.email}?`)) {
      return
    }

    const supabase = createClient()
    const { data: { user: adminUser } } = await supabase.auth.getUser()

    if (!adminUser) {
      toast({
        title: 'Error',
        description: 'Unable to get admin user information',
        variant: 'destructive',
      })
      return
    }

    // Call API to start impersonation
    const response = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      toast({
        title: 'Error',
        description: data.error || 'Failed to start impersonation',
        variant: 'destructive',
      })
      return
    }

    // Store impersonation state
    startImpersonation(
      data.impersonatedUser.id,
      data.impersonatedUser.email,
      data.impersonatedUser.full_name,
      data.originalAdmin.id,
      data.originalAdmin.email
    )

    toast({
      title: 'Impersonation Started',
      description: `Now viewing as ${data.impersonatedUser.full_name || data.impersonatedUser.email}`,
    })

    // Reload to apply impersonation
    window.location.href = '/home'
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    })

    const data = await response.json()

    if (!response.ok) {
      toast({
        title: 'Error',
        description: data.error || 'Failed to delete user',
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'User deleted',
        description: data.message || 'The user has been removed',
      })
      loadUsers()
    }
  }

  function getInitials(name: string | null, email: string) {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  function getRoleBadge(role: string) {
    switch (role) {
      case 'captain':
        return <Badge variant="default" className="text-xs">Captain</Badge>
      case 'co-captain':
        return <Badge variant="secondary" className="text-xs">Co-Captain</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Player</Badge>
    }
  }

  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase()
    return (
      user.email.toLowerCase().includes(searchLower) ||
      user.full_name?.toLowerCase().includes(searchLower) ||
      user.phone?.toLowerCase().includes(searchLower)
    )
  })

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return null // Will redirect
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="System Admin - Users" />

      <main className="flex-1 p-4 space-y-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Manage Users
              </CardTitle>
              <Button
                onClick={() => {
                  setEditingUser(null)
                  setShowUserDialog(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Users List */}
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {users.length === 0 
                  ? 'No users found. Click "Add User" to create a new user.'
                  : 'No users match your search.'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-start justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">
                            {user.full_name || 'No name'}
                          </h4>
                          {user.is_system_admin && (
                            <Badge variant="default" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              System Admin
                            </Badge>
                          )}
                          {user.ntrp_rating && (
                            <Badge variant="outline" className="text-xs">
                              NTRP {user.ntrp_rating}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>
                          {user.phone && (
                            <p className="text-sm text-muted-foreground">
                              {user.phone}
                            </p>
                          )}
                          {user.roles.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap mt-2">
                              <span className="text-xs text-muted-foreground">Roles:</span>
                              {user.roles.map((role, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  {getRoleBadge(role.role)}
                                  <span className="text-xs text-muted-foreground">
                                    {role.team_name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleImpersonateUser(user)}
                        title="Login as this user"
                      >
                        <LogIn className="h-4 w-4 mr-1" />
                        Login As
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingUser(user)
                          setShowUserDialog(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <UserDialog
          open={showUserDialog}
          onOpenChange={setShowUserDialog}
          user={editingUser}
          onSaved={loadUsers}
        />
      </main>
    </div>
  )
}

