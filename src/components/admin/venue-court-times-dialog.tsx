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
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Trash2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

interface VenueCourtTime {
  id: string
  venue_id: string
  start_time: string // TIME format from database (HH:MM:SS)
  display_order: number
}

interface VenueCourtTimesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  venueName: string
  onSaved: () => void
}

export function VenueCourtTimesDialog({
  open,
  onOpenChange,
  venueId,
  venueName,
  onSaved,
}: VenueCourtTimesDialogProps) {
  const [courtTimes, setCourtTimes] = useState<VenueCourtTime[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newTime, setNewTime] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    if (open && venueId) {
      loadCourtTimes()
    }
  }, [open, venueId])

  async function loadCourtTimes() {
    if (!venueId) {
      setCourtTimes([])
      setLoading(false)
      return
    }

    setLoading(true)
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase
        .from('venue_court_times')
        .select('*')
        .eq('venue_id', venueId)
        .order('display_order', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        // Check if table doesn't exist (migration not run)
        if (error.code === '42P01') {
          toast({
            title: 'Table Not Found',
            description: 'The venue_court_times table does not exist. Please run the migration first.',
            variant: 'destructive',
          })
        } else if (error.code === '42501') {
          toast({
            title: 'Access Denied',
            description: 'You do not have permission to view court times.',
            variant: 'destructive',
          })
        } else {
          console.error('Error loading court times:', error)
          toast({
            title: 'Error',
            description: error.message || 'Failed to load court times',
            variant: 'destructive',
          })
        }
        setCourtTimes([])
      } else {
        setCourtTimes(data || [])
      }
    } catch (error: any) {
      console.error('Error loading court times:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to load court times',
        variant: 'destructive',
      })
      setCourtTimes([])
    } finally {
      setLoading(false)
    }
  }

  function formatTimeForInput(timeString: string): string {
    // Convert TIME format (HH:MM:SS) to input format (HH:MM)
    const [hours, minutes] = timeString.split(':')
    return `${hours}:${minutes}`
  }

  function formatTimeForDisplay(timeString: string): string {
    // Convert TIME format (HH:MM:SS) to 12-hour format with AM/PM
    try {
      const [hours, minutes] = timeString.split(':')
      const hour = parseInt(hours, 10)
      const minute = parseInt(minutes, 10)
      const date = new Date()
      date.setHours(hour, minute, 0)
      return format(date, 'h:mm a')
    } catch {
      return timeString
    }
  }

  async function handleAddTime() {
    if (!newTime.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a time',
        variant: 'destructive',
      })
      return
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(newTime)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid time in HH:MM format (e.g., 07:00, 19:30)',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    const supabase = createClient()

    try {
      // Convert HH:MM to TIME format (HH:MM:SS)
      const [hours, minutes] = newTime.split(':')
      const timeValue = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`

      // Check if time already exists
      const existing = courtTimes.find(ct => ct.start_time === timeValue)
      if (existing) {
        toast({
          title: 'Error',
          description: 'This time already exists',
          variant: 'destructive',
        })
        setSaving(false)
        return
      }

      const { data, error } = await supabase
        .from('venue_court_times')
        .insert({
          venue_id: venueId,
          start_time: timeValue,
          display_order: courtTimes.length,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: 'Error',
            description: 'This time already exists for this venue',
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
        setCourtTimes([...courtTimes, data])
        setNewTime('')
        toast({
          title: 'Court time added',
          description: 'The court time has been added successfully',
        })
      }
    } catch (error) {
      console.error('Error adding court time:', error)
      toast({
        title: 'Error',
        description: 'Failed to add court time',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTime(courtTimeId: string) {
    setSaving(true)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('venue_court_times')
        .delete()
        .eq('id', courtTimeId)

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        setCourtTimes(courtTimes.filter(ct => ct.id !== courtTimeId))
        toast({
          title: 'Court time removed',
          description: 'The court time has been removed',
        })
      }
    } catch (error) {
      console.error('Error deleting court time:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove court time',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleReorder(courtTimeId: string, direction: 'up' | 'down') {
    setSaving(true)
    const supabase = createClient()

    try {
      const currentIndex = courtTimes.findIndex(ct => ct.id === courtTimeId)
      if (currentIndex === -1) return

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (newIndex < 0 || newIndex >= courtTimes.length) {
        setSaving(false)
        return
      }

      const currentItem = courtTimes[currentIndex]
      const swapItem = courtTimes[newIndex]

      // Swap display_order values
      const { error: error1 } = await supabase
        .from('venue_court_times')
        .update({ display_order: swapItem.display_order })
        .eq('id', currentItem.id)

      if (error1) throw error1

      const { error: error2 } = await supabase
        .from('venue_court_times')
        .update({ display_order: currentItem.display_order })
        .eq('id', swapItem.id)

      if (error2) throw error2

      // Reload to get updated order
      await loadCourtTimes()
    } catch (error) {
      console.error('Error reordering court time:', error)
      toast({
        title: 'Error',
        description: 'Failed to reorder court time',
        variant: 'destructive',
      })
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Court Start Times</DialogTitle>
          <DialogDescription>
            Configure typical court start times for {venueName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add New Time */}
          <div className="space-y-2">
            <Label htmlFor="newTime">Add Court Start Time</Label>
            <div className="flex gap-2">
              <Input
                id="newTime"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                placeholder="HH:MM (e.g., 07:00, 19:30)"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddTime}
                disabled={saving || !newTime.trim()}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter time in 24-hour format (e.g., 07:00 for 7:00 AM, 19:30 for 7:30 PM)
            </p>
          </div>

          {/* Court Times List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : courtTimes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No court times configured yet</p>
              <p className="text-sm">Add court start times above</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Court Start Times ({courtTimes.length})</Label>
              <div className="border rounded-lg divide-y">
                {courtTimes.map((courtTime, index) => (
                  <div
                    key={courtTime.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {formatTimeForDisplay(courtTime.start_time)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({formatTimeForInput(courtTime.start_time)})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {index > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReorder(courtTime.id, 'up')}
                          disabled={saving}
                          title="Move up"
                        >
                          ↑
                        </Button>
                      )}
                      {index < courtTimes.length - 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReorder(courtTime.id, 'down')}
                          disabled={saving}
                          title="Move down"
                        >
                          ↓
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTime(courtTime.id)}
                        disabled={saving}
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
            disabled={saving}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

