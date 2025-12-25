'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from 'lucide-react'
import { format } from 'date-fns'

interface CustomRecurrenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  startDate: string
  recurrence: {
    interval: number
    timeUnit: 'day' | 'week' | 'month' | 'year'
    selectedDays: number[]
  }
  endType: 'date' | 'occurrences' | 'never'
  endDate: string
  occurrences: string
  onSave: (
    recurrence: {
      interval: number
      timeUnit: 'day' | 'week' | 'month' | 'year'
      selectedDays: number[]
    },
    newEndType: 'date' | 'occurrences' | 'never',
    newEndDate: string,
    newOccurrences: string
  ) => void
  onDiscard: () => void
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function CustomRecurrenceDialog({
  open,
  onOpenChange,
  startDate,
  recurrence,
  endType: initialEndType,
  endDate: initialEndDate,
  occurrences: initialOccurrences,
  onSave,
  onDiscard,
}: CustomRecurrenceDialogProps) {
  const [interval, setInterval] = useState(recurrence.interval)
  const [timeUnit, setTimeUnit] = useState(recurrence.timeUnit)
  const [selectedDays, setSelectedDays] = useState<number[]>(recurrence.selectedDays)
  const [endType, setEndType] = useState<'date' | 'occurrences' | 'never'>(initialEndType)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [occurrences, setOccurrences] = useState(initialOccurrences)

  useEffect(() => {
    if (open) {
      setInterval(recurrence.interval)
      setTimeUnit(recurrence.timeUnit)
      setSelectedDays(recurrence.selectedDays)
      setEndType(initialEndType)
      setEndDate(initialEndDate)
      setOccurrences(initialOccurrences)
    }
  }, [open, recurrence, initialEndType, initialEndDate, initialOccurrences])

  function toggleDay(dayIndex: number) {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter(d => d !== dayIndex))
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort())
    }
  }

  function handleSave() {
    if (timeUnit === 'week' && selectedDays.length === 0) {
      return // Don't save if weekly but no days selected
    }
    onSave(
      {
        interval,
        timeUnit,
        selectedDays: timeUnit === 'week' ? selectedDays : [],
      },
      endType,
      endDate,
      occurrences
    )
    onOpenChange(false)
  }

  function handleDiscard() {
    onDiscard()
    onOpenChange(false)
  }

  // Generate summary text
  function getSummaryText(): string {
    if (timeUnit === 'week' && selectedDays.length > 0) {
      const dayNames = selectedDays.map(d => DAY_NAMES[d])
      let summary = `Occurs every ${interval} ${timeUnit}${interval > 1 ? 's' : ''} on ${dayNames.join(', ')}`
      
      if (endType === 'date' && endDate) {
        try {
          const formattedDate = format(new Date(endDate), 'MMM d, yyyy')
          summary += ` until ${formattedDate}`
        } catch {
          summary += ` until ${endDate}`
        }
      } else if (endType === 'occurrences' && occurrences) {
        summary += `, ${occurrences} times`
      }
      
      return summary
    }
    
    return `Occurs every ${interval} ${timeUnit}${interval > 1 ? 's' : ''}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Repeat</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Start Date */}
          <div className="space-y-2">
            <Label>Start</Label>
            <div className="relative">
              <Input
                type="date"
                value={startDate}
                readOnly
                className="pr-10"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Repeat Every */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm">Repeat every</span>
                <Select
                  value={interval.toString()}
                  onValueChange={(value) => setInterval(parseInt(value))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={timeUnit}
                  onValueChange={(value) => {
                    setTimeUnit(value as 'day' | 'week' | 'month' | 'year')
                    if (value !== 'week') {
                      setSelectedDays([])
                    }
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">day</SelectItem>
                    <SelectItem value="week">week</SelectItem>
                    <SelectItem value="month">month</SelectItem>
                    <SelectItem value="year">year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Day Selection for Weekly */}
            {timeUnit === 'week' && (
              <div className="flex items-center gap-2 pt-2">
                {DAY_LABELS.map((label, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleDay(index)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      selectedDays.includes(index)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* End Condition */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{getSummaryText()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={endType}
                onValueChange={(value) => setEndType(value as 'date' | 'occurrences' | 'never')}
              >
                <SelectTrigger className="w-auto min-w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">On a specific date</SelectItem>
                  <SelectItem value="occurrences">After number of occurrences</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {endType === 'date' && (
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="pr-10"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                {endDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setEndDate('')
                      setEndType('never')
                    }}
                    className="text-sm text-primary hover:underline"
                  >
                    Remove end date
                  </button>
                )}
              </div>
            )}

            {endType === 'occurrences' && (
              <div className="space-y-2">
                <Input
                  type="number"
                  min="2"
                  value={occurrences}
                  onChange={(e) => setOccurrences(e.target.value)}
                  placeholder="e.g., 10"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
          >
            Discard
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground"
          >
            Remove
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={
              (endType === 'date' && !endDate) ||
              (endType === 'occurrences' && (!occurrences || parseInt(occurrences) < 2)) ||
              (timeUnit === 'week' && selectedDays.length === 0)
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

