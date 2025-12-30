'use client'

import { useState, useEffect } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface User {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  ntrp_rating: number | null
  is_system_admin: boolean
}

interface UserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onSaved: () => void
}

export function UserDialog({
  open,
  onOpenChange,
  user,
  onSaved,
}: UserDialogProps) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [ntrpRating, setNtrpRating] = useState('')
  const [isSystemAdmin, setIsSystemAdmin] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Reset form when dialog opens/closes or user changes
  useEffect(() => {
    if (open) {
      if (user) {
        setEmail(user.email || '')
        setFullName(user.full_name || '')
        setPhone(user.phone || '')
        setNtrpRating(user.ntrp_rating?.toString() || '')
        setIsSystemAdmin(user.is_system_admin || false)
        setPassword('') // Don't pre-fill password
      } else {
        setEmail('')
        setFullName('')
        setPhone('')
        setNtrpRating('')
        setIsSystemAdmin(false)
        setPassword('')
      }
    }
  }, [open, user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!email.trim()) {
      toast({
        title: 'Error',
        description: 'Email is required',
        variant: 'destructive',
      })
      return
    }

    // For new users, password is required
    if (!user && !password.trim()) {
      toast({
        title: 'Error',
        description: 'Password is required for new users',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      if (user) {
        // Update existing user via API
        const response = await fetch(`/api/admin/users/${user.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            fullName: fullName.trim() || null,
            phone: phone.trim() || null,
            ntrpRating: ntrpRating ? parseFloat(ntrpRating) : null,
            isSystemAdmin: isSystemAdmin,
            password: password.trim() || null,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          toast({
            title: 'Error',
            description: data.error || 'Failed to update user',
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'User updated',
            description: data.message || 'The user has been updated successfully',
          })
          onSaved()
          onOpenChange(false)
        }
      } else {
        // Create new user via API
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            password: password.trim(),
            fullName: fullName.trim() || null,
            phone: phone.trim() || null,
            ntrpRating: ntrpRating ? parseFloat(ntrpRating) : null,
            isSystemAdmin: isSystemAdmin,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          if (response.status === 409) {
            // User already exists
            toast({
              title: 'User Already Exists',
              description: 'A user with this email already exists. If they don\'t appear in the users list, they may need to sign in to create their profile. Use "Forgot Password" if they don\'t know their password.',
              variant: 'destructive',
              duration: 10000,
            })
          } else if (data.requiresAdminAPI) {
            const instructions = data.instructions ? '\n\n' + data.instructions.join('\n') : ''
            toast({
              title: 'Admin API Required',
              description: 'Creating users requires Supabase Admin API. If the user already exists in auth.users but not in profiles, have them sign in (use password reset if needed) to automatically create their profile.' + instructions,
              variant: 'destructive',
              duration: 15000,
            })
          } else if (data.error?.includes('already exists') || data.error?.includes('User already registered')) {
            toast({
              title: 'User Already Exists',
              description: 'This user already exists in the system. If they don\'t appear in the users list, they may need to sign in to create their profile. Use "Forgot Password" if they don\'t know their password.',
              variant: 'destructive',
              duration: 10000,
            })
          } else {
            toast({
              title: 'Error',
              description: data.error || 'Failed to create user',
              variant: 'destructive',
            })
          }
        } else {
          toast({
            title: 'User created',
            description: 'The user has been created successfully',
          })
          onSaved()
          onOpenChange(false)
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save user',
        variant: 'destructive',
      })
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Add User'}</DialogTitle>
          <DialogDescription>
            {user ? 'Update user information' : 'Create a new user account'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!!user} // Can't change email for existing users
            />
            {user && (
              <p className="text-xs text-muted-foreground">
                Email cannot be changed for existing users
              </p>
            )}
          </div>

          {!user && (
            <div className="space-y-2">
              <Label htmlFor="password">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Required for new user accounts
              </p>
            </div>
          )}

          {user && (
            <div className="space-y-2">
              <Label htmlFor="password">New Password (optional)</Label>
              <Input
                id="password"
                type="password"
                placeholder="Leave blank to keep current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Password updates require Admin API access
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
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

          <div className="space-y-2">
            <Label htmlFor="ntrpRating">NTRP Rating</Label>
            <Input
              id="ntrpRating"
              type="number"
              step="0.5"
              min="2.0"
              max="7.0"
              placeholder="4.0"
              value={ntrpRating}
              onChange={(e) => setNtrpRating(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isSystemAdmin">System Administrator</Label>
            <Switch
              id="isSystemAdmin"
              checked={isSystemAdmin}
              onCheckedChange={setIsSystemAdmin}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                user ? 'Update' : 'Create'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

