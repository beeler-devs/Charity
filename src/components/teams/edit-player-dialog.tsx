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
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { RosterMember } from '@/types/database.types'

interface EditPlayerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  player: RosterMember | null
  onUpdated: () => void
}

export function EditPlayerDialog({ open, onOpenChange, teamId, player, onUpdated }: EditPlayerDialogProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [ntrpRating, setNtrpRating] = useState('')
  const [role, setRole] = useState<'captain' | 'co-captain' | 'player'>('player')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Populate form when player changes
  useEffect(() => {
    if (player) {
      setFullName(player.full_name || '')
      setEmail(player.email || '')
      setPhone(player.phone || '')
      setNtrpRating(player.ntrp_rating?.toString() || '')
      setRole(player.role as 'captain' | 'co-captain' | 'player')
    } else {
      // Reset form
      setFullName('')
      setEmail('')
      setPhone('')
      setNtrpRating('')
      setRole('player')
    }
  }, [player, open])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!player) return

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

    // Verify user is captain
    const { data: teamData } = await supabase
      .from('teams')
      .select('captain_id, co_captain_id')
      .eq('id', teamId)
      .single()

    if (!teamData || (teamData.captain_id !== user.id && teamData.co_captain_id !== user.id)) {
      toast({
        title: 'Permission denied',
        description: 'Only team captains can edit players',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    // Update roster member
    const { error } = await supabase
      .from('roster_members')
      .update({
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        ntrp_rating: ntrpRating ? parseFloat(ntrpRating) : null,
        role,
      })
      .eq('id', player.id)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Player updated',
        description: `${fullName}'s information has been updated`,
      })
      onUpdated()
      onOpenChange(false)
    }

    setLoading(false)
  }

  if (!player) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Player</DialogTitle>
          <DialogDescription>
            Update player information. Note: If this player is linked to a user account, some fields may be managed by the user.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpdate}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!player.user_id}
              />
              {player.user_id && (
                <p className="text-xs text-muted-foreground">
                  Email is managed by the user account
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
                  min="1.0"
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !fullName}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}






