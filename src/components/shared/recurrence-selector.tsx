'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from 'lucide-react'
import { CustomRecurrenceDialog } from '@/components/activities/custom-recurrence-dialog'
import { RecurrencePattern, RecurrenceEndType, CustomRecurrenceData } from '@/lib/recurrence-utils'

interface RecurrenceSelectorProps {
  isRecurring: boolean
  onRecurringChange: (recurring: boolean) => void
  pattern: RecurrencePattern
  onPatternChange: (pattern: RecurrencePattern) => void
  endType: RecurrenceEndType
  onEndTypeChange: (endType: RecurrenceEndType) => void
  endDate: string
  onEndDateChange: (date: string) => void
  occurrences: string
  onOccurrencesChange: (occurrences: string) => void
  customRecurrence: CustomRecurrenceData
  onCustomRecurrenceChange: (data: CustomRecurrenceData) => void
  startDate: string
  showNeverOption?: boolean // Whether to show "Never" as an end option (default: false for team events, true for personal)
}

export function RecurrenceSelector({
  isRecurring,
  onRecurringChange,
  pattern,
  onPatternChange,
  endType,
  onEndTypeChange,
  endDate,
  onEndDateChange,
  occurrences,
  onOccurrencesChange,
  customRecurrence,
  onCustomRecurrenceChange,
  startDate,
  showNeverOption = false,
}: RecurrenceSelectorProps) {
  const [showCustomDialog, setShowCustomDialog] = useState(false)

  if (!isRecurring) {
    return (
      <div className="flex items-center space-x-2">
        <Checkbox
          id="isRecurring"
          checked={isRecurring}
          onCheckedChange={(checked) => onRecurringChange(checked === true)}
        />
        <Label htmlFor="isRecurring" className="font-normal cursor-pointer">
          This is a recurring event
        </Label>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center space-x-2 mb-4">
        <Checkbox
          id="isRecurring"
          checked={isRecurring}
          onCheckedChange={(checked) => onRecurringChange(checked === true)}
        />
        <Label htmlFor="isRecurring" className="font-normal cursor-pointer">
          This is a recurring event
        </Label>
      </div>

      {isRecurring && (
        <div className="space-y-4 pl-6 border-l-2">
          {/* Recurrence Pattern */}
          <div className="space-y-2">
            <Label htmlFor="recurrencePattern">Recurrence Pattern</Label>
            <Select
              value={pattern}
              onValueChange={(value) => onPatternChange(value as RecurrencePattern)}
            >
              <SelectTrigger id="recurrencePattern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Recurrence Button */}
          {pattern === 'custom' && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCustomDialog(true)}
                className="w-full"
              >
                Configure Custom Recurrence
              </Button>
              {customRecurrence && (
                <p className="text-xs text-muted-foreground">
                  Every {customRecurrence.interval} {customRecurrence.timeUnit}
                  {customRecurrence.timeUnit === 'week' && customRecurrence.selectedDays && customRecurrence.selectedDays.length > 0
                    ? ` on ${customRecurrence.selectedDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`
                    : ''}
                </p>
              )}
            </div>
          )}

          {/* End Type Selection */}
          <div className="space-y-2">
            <Label>End Recurrence</Label>
            <Select value={endType} onValueChange={(value) => onEndTypeChange(value as RecurrenceEndType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">On a specific date</SelectItem>
                <SelectItem value="occurrences">After number of occurrences</SelectItem>
                {showNeverOption && <SelectItem value="never">Never</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* End Date or Occurrences */}
          {endType === 'date' ? (
            <div className="space-y-2">
              <Label htmlFor="endDate">
                End Date <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  min={startDate}
                  required
                  className="pr-10"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          ) : endType === 'occurrences' ? (
            <div className="space-y-2">
              <Label htmlFor="occurrences">
                Number of Occurrences <span className="text-destructive">*</span>
              </Label>
              <Input
                id="occurrences"
                type="number"
                min="2"
                value={occurrences}
                onChange={(e) => onOccurrencesChange(e.target.value)}
                placeholder="e.g., 10"
                required
              />
              <p className="text-xs text-muted-foreground">
                The event will repeat {occurrences ? `${occurrences} times` : 'multiple times'} starting from {startDate}
              </p>
            </div>
          ) : null}
        </div>
      )}

      <CustomRecurrenceDialog
        open={showCustomDialog}
        onOpenChange={setShowCustomDialog}
        startDate={startDate}
        recurrence={customRecurrence}
        endType={endType}
        endDate={endDate}
        occurrences={occurrences}
        onSave={(newRecurrence, newEndType, newEndDate, newOccurrences) => {
          onCustomRecurrenceChange(newRecurrence)
          onEndTypeChange(newEndType)
          onEndDateChange(newEndDate)
          onOccurrencesChange(newOccurrences)
        }}
        onDiscard={() => {}}
      />
    </>
  )
}

