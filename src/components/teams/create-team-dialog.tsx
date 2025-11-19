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

interface CreateTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateTeamDialog({ open, onOpenChange, onCreated }: CreateTeamDialogProps) {
  const [name, setName] = useState('')
  const [leagueFormat, setLeagueFormat] = useState<'USTA' | 'CUP' | 'FLEX'>('USTA')
  const [season, setSeason] = useState('')
  const [ratingLimit, setRatingLimit] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create a team',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    const { error } = await supabase.from('teams').insert({
      name,
      captain_id: user.id,
      league_format: leagueFormat,
      season: season || null,
      rating_limit: ratingLimit ? parseFloat(ratingLimit) : null,
    })

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Team created',
        description: `${name} has been created successfully`,
      })
      setName('')
      setSeason('')
      setRatingLimit('')
      onCreated()
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Team</DialogTitle>
          <DialogDescription>
            Add a new team to manage your roster and matches
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                placeholder="e.g., Spring 4.0 Mixed"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="format">League Format</Label>
              <Select value={leagueFormat} onValueChange={(v) => setLeagueFormat(v as 'USTA' | 'CUP' | 'FLEX')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USTA">USTA</SelectItem>
                  <SelectItem value="CUP">CUP</SelectItem>
                  <SelectItem value="FLEX">FLEX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="season">Season (optional)</Label>
              <Input
                id="season"
                placeholder="e.g., Spring 2025"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rating">Rating Limit (optional)</Label>
              <Input
                id="rating"
                type="number"
                step="0.5"
                min="2.0"
                max="10.0"
                placeholder="e.g., 8.0"
                value={ratingLimit}
                onChange={(e) => setRatingLimit(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
