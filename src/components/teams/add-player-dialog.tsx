'use client'

import { useState } from 'react'
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

interface AddPlayerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  onAdded: () => void
}

export function AddPlayerDialog({ open, onOpenChange, teamId, onAdded }: AddPlayerDialogProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [ntrpRating, setNtrpRating] = useState('')
  const [role, setRole] = useState<'captain' | 'co-captain' | 'player'>('player')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.from('roster_members').insert({
      team_id: teamId,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      ntrp_rating: ntrpRating ? parseFloat(ntrpRating) : null,
      role,
    })

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
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
      onAdded()
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Player</DialogTitle>
          <DialogDescription>
            Add a new player to your team roster
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAdd}>
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !fullName}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Player
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
