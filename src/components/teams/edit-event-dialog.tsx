'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import { addDays, addWeeks, format, parseISO, isBefore, isAfter } from 'date-fns'
import { Event } from '@/types/database.types'

interface EditEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: Event | null
  teamId: string
  onUpdated: () => void
}

export function EditEventDialog({
  open,
  onOpenChange,
  event,
  teamId,
  onUpdated,
}: EditEventDialogProps) {
  const [eventName, setEventName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState<'daily' | 'weekly' | 'custom'>('weekly')
  const [endType, setEndType] = useState<'date' | 'occurrences'>('date')
  const [endDate, setEndDate] = useState('')
  const [occurrences, setOccurrences] = useState('')
  const [editScope, setEditScope] = useState<'series' | 'single'>('series')
  const [seriesEvents, setSeriesEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (event && open) {
      setEventName(event.event_name || '')
      setDate(event.date || '')
      setTime(event.time || '')
      setLocation(event.location || '')
      setDescription(event.description || '')
      
      // Check if this is part of a recurring series
      const hasSeriesId = (event as any).recurrence_series_id
      setIsRecurring(!!hasSeriesId)
      
      if (hasSeriesId) {
        setRecurrencePattern((event as any).recurrence_pattern || 'weekly')
        setEndType((event as any).recurrence_end_date ? 'date' : 'occurrences')
        setEndDate((event as any).recurrence_end_date || '')
        setOccurrences((event as any).recurrence_occurrences?.toString() || '')
        loadSeriesEvents((event as any).recurrence_series_id)
        
        // Determine if event has passed
        const eventDate = parseISO(event.date)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (isBefore(eventDate, today)) {
          setEditScope('series') // Default to series if event passed
        }
      }
    }
  }, [event, open])

  async function loadSeriesEvents(seriesId: string) {
    if (!seriesId) return
    
    const supabase = createClient()
    // Note: recurrence_series_id may not exist in DB schema yet
    // This query will fail gracefully if the column doesn't exist
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('recurrence_series_id', seriesId)
      .order('date', { ascending: true })
    
    if (error) {
      // Column doesn't exist yet - this is expected until migration is run
      console.warn('recurrence_series_id column not found:', error.message)
      setSeriesEvents([])
    } else if (data) {
      setSeriesEvents(data)
    }
  }

  function generateRecurringDates(startDate: string, pattern: 'daily' | 'weekly' | 'custom', endDateStr?: string, numOccurrences?: number): string[] {
    const dates: string[] = [startDate]
    const start = parseISO(startDate)
    let current = new Date(start)
    let count = 1

    if (endDateStr) {
      const end = parseISO(endDateStr)
      while (current < end) {
        if (pattern === 'daily') {
          current = addDays(current, 1)
        } else if (pattern === 'weekly') {
          current = addWeeks(current, 1)
        }
        if (current <= end) {
          dates.push(format(current, 'yyyy-MM-dd'))
        }
      }
    } else if (numOccurrences) {
      while (count < numOccurrences) {
        if (pattern === 'daily') {
          current = addDays(current, 1)
        } else if (pattern === 'weekly') {
          current = addWeeks(current, 1)
        }
        dates.push(format(current, 'yyyy-MM-dd'))
        count++
      }
    }

    return dates
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!eventName || !date || !time) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields (Event Name, Date, Time)',
        variant: 'destructive',
      })
      return
    }

    if (isRecurring) {
      if (recurrencePattern === 'custom') {
        toast({
          title: 'Error',
          description: 'Custom recurrence patterns are not yet supported. Please use Daily or Weekly.',
          variant: 'destructive',
        })
        return
      }
      if (endType === 'date' && !endDate) {
        toast({
          title: 'Error',
          description: 'Please specify an end date for the recurring event',
          variant: 'destructive',
        })
        return
      }
      if (endType === 'occurrences' && (!occurrences || parseInt(occurrences) < 2)) {
        toast({
          title: 'Error',
          description: 'Please specify the number of occurrences (must be at least 2)',
          variant: 'destructive',
        })
        return
      }
      if (endType === 'date' && isBefore(parseISO(endDate), parseISO(date))) {
        toast({
          title: 'Error',
          description: 'End date must be after the start date',
          variant: 'destructive',
        })
        return
      }
    }

    setLoading(true)

    try {
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

      const { data: teamData } = await supabase
        .from('teams')
        .select('captain_id, co_captain_id')
        .eq('id', teamId)
        .single()

      if (!teamData || (teamData.captain_id !== user.id && teamData.co_captain_id !== user.id)) {
        toast({
          title: 'Permission denied',
          description: 'Only team captains can edit events',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      if (!event) {
        setLoading(false)
        return
      }

      const eventDate = parseISO(event.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const isPastEvent = isBefore(eventDate, today)

      if (editScope === 'single' || !isRecurring) {
        // Edit single event only
        const { error } = await supabase
          .from('events')
          .update({
            event_name: eventName,
            date,
            time,
            location: location || null,
            description: description || null,
          })
          .eq('id', event.id)

        if (error) {
          toast({
            title: 'Error',
            description: error.message,
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Event updated',
            description: 'The event has been updated successfully',
          })
          onUpdated()
          onOpenChange(false)
        }
      } else {
        // Edit recurring series
        const seriesId = (event as any).recurrence_series_id || crypto.randomUUID()
        
        // Get all future events in the series (including current event if not past)
        const futureEvents = seriesEvents.filter(e => {
          const eDate = parseISO(e.date)
          return !isBefore(eDate, today) || e.id === event.id
        })

        // Generate new dates based on updated recurrence settings
        const dates = generateRecurringDates(
          date,
          recurrencePattern,
          endType === 'date' ? endDate : undefined,
          endType === 'occurrences' ? parseInt(occurrences) : undefined
        )

        // Delete all future events in the series
        const futureEventIds = futureEvents.map(e => e.id)
        if (futureEventIds.length > 0) {
          await supabase
            .from('events')
            .delete()
            .in('id', futureEventIds)
        }

        // Create new events with updated information
        const eventsToCreate = dates.map(eventDate => ({
          team_id: teamId,
          event_name: eventName,
          date: eventDate,
          time,
          location: location || null,
          description: description || null,
          recurrence_series_id: seriesId,
          recurrence_original_date: date,
          recurrence_pattern: recurrencePattern,
          recurrence_end_date: endType === 'date' ? endDate : null,
          recurrence_occurrences: endType === 'occurrences' ? parseInt(occurrences) : null,
        }))

        const { error } = await supabase.from('events').insert(eventsToCreate)

        if (error) {
          toast({
            title: 'Error',
            description: error.message,
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Recurring series updated',
            description: `${dates.length} event${dates.length > 1 ? 's' : ''} have been updated successfully`,
          })
          onUpdated()
          onOpenChange(false)
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update event',
        variant: 'destructive',
      })
    }

    setLoading(false)
  }

  const isPartOfSeries = isRecurring && seriesEvents.length > 1
  const eventDate = event ? parseISO(event.date) : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isPastEvent = eventDate ? isBefore(eventDate, today) : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
          <DialogDescription>
            {isPartOfSeries && !isPastEvent
              ? 'Update this event or all future events in the series'
              : 'Update event details'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Edit Scope Selection (only for recurring series with future events) */}
          {isPartOfSeries && !isPastEvent && (
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <Label>Edit Options</Label>
              <Select value={editScope} onValueChange={(value) => setEditScope(value as 'series' | 'single')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="series">
                    All future events in this series ({seriesEvents.filter(e => {
                      const eDate = parseISO(e.date)
                      return !isBefore(eDate, today) || e.id === event?.id
                    }).length} events)
                  </SelectItem>
                  <SelectItem value="single">
                    This event only
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Event Name */}
          <div className="space-y-2">
            <Label htmlFor="eventName">
              Event Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="eventName"
              placeholder="Team Practice, Dinner, etc."
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Time */}
            <div className="space-y-2">
              <Label>
                Time <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Select
                  value={time.split(':')[0] || ''}
                  onValueChange={(hour) => {
                    const minute = time.split(':')[1] || '00'
                    setTime(`${hour}:${minute}`)
                  }}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Hour" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0')
                      return (
                        <SelectItem key={hour} value={hour}>
                          {hour}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <span className="flex items-center">:</span>
                <Select
                  value={time.split(':')[1] || ''}
                  onValueChange={(minute) => {
                    const hour = time.split(':')[0] || '00'
                    setTime(`${hour}:${minute}`)
                  }}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent>
                    {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((minute) => (
                      <SelectItem key={minute} value={minute}>
                        {minute}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="Court name, restaurant, etc."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Additional details about the event..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Recurring Event Options (only shown when editing series) */}
          {editScope === 'series' && isRecurring && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRecurring"
                  checked={isRecurring}
                  onCheckedChange={(checked) => setIsRecurring(checked === true)}
                  disabled
                />
                <Label htmlFor="isRecurring" className="font-normal cursor-pointer">
                  This is a recurring event
                </Label>
              </div>

              <div className="space-y-4 pl-6 border-l-2">
                {/* Recurrence Pattern */}
                <div className="space-y-2">
                  <Label htmlFor="recurrencePattern">Recurrence Pattern</Label>
                  <Select
                    value={recurrencePattern}
                    onValueChange={(value) => setRecurrencePattern(value as 'daily' | 'weekly' | 'custom')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* End Type Selection */}
                <div className="space-y-2">
                  <Label>End Recurrence</Label>
                  <Select value={endType} onValueChange={(value) => setEndType(value as 'date' | 'occurrences')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">On a specific date</SelectItem>
                      <SelectItem value="occurrences">After number of occurrences</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* End Date or Occurrences */}
                {endType === 'date' ? (
                  <div className="space-y-2">
                    <Label htmlFor="endDate">
                      End Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={date}
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="occurrences">
                      Number of Occurrences <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="occurrences"
                      type="number"
                      min="2"
                      value={occurrences}
                      onChange={(e) => setOccurrences(e.target.value)}
                      placeholder="e.g., 10"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      The event will repeat {occurrences ? `${occurrences} times` : 'multiple times'} starting from {date}
                    </p>
                  </div>
                )}

                {recurrencePattern === 'custom' && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Custom recurrence patterns are coming soon. For now, please use Daily or Weekly.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

