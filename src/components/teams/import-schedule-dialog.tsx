'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { parseCSVSchedule } from '@/lib/utils'

interface ImportScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  onImported: () => void
}

export function ImportScheduleDialog({
  open,
  onOpenChange,
  teamId,
  onImported,
}: ImportScheduleDialogProps) {
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function handleImport() {
    if (!csvText.trim()) {
      toast({
        title: 'Error',
        description: 'Please paste your schedule data',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const parsedSchedule = parseCSVSchedule(csvText)

      if (parsedSchedule.length === 0) {
        toast({
          title: 'Error',
          description: 'Could not parse any matches from the data',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      const supabase = createClient()

      const matchesToInsert = parsedSchedule.map((match) => ({
        team_id: teamId,
        date: match.date,
        time: match.time,
        opponent_name: match.opponent,
        venue: match.venue || null,
        is_home: match.isHome ?? true,
      }))

      const { error } = await supabase.from('matches').insert(matchesToInsert)

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Schedule imported',
          description: `${parsedSchedule.length} matches have been added`,
        })
        setCsvText('')
        onImported()
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to parse schedule data',
        variant: 'destructive',
      })
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Schedule</DialogTitle>
          <DialogDescription>
            Paste your schedule data in CSV format
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Schedule Data</Label>
            <Textarea
              placeholder={`Date,Time,Opponent,Venue,Home/Away
2025-01-15,18:00,Team A,Court 1,Home
2025-01-22,19:00,Team B,Court 2,Away`}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Format: Date (YYYY-MM-DD), Time (HH:MM), Opponent, Venue (optional), Home/Away (optional)
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={loading || !csvText.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
