'use client'

import { CalendarDay, CalendarItem, getWeekDays, groupItemsByDate, getWeekdayNames } from '@/lib/calendar-utils'
import { CalendarItemTile } from './calendar-item-tile'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface WeekViewProps {
  currentDate: Date
  items: CalendarItem[]
  numWeeks?: number
  onPrevious?: () => void
  onNext?: () => void
}

export function WeekView({ currentDate, items, numWeeks = 2, onPrevious, onNext }: WeekViewProps) {
  const weekDays = getWeekDays(currentDate, numWeeks)
  const weekdayNames = getWeekdayNames(true)
  const itemsByDate = groupItemsByDate(items)

  // Sort items within each day by time
  const sortItemsByTime = (items: CalendarItem[]) => {
    return [...items].sort((a, b) => {
      // Convert time strings (HH:MM) to comparable numbers
      const timeA = a.time.replace(':', '')
      const timeB = b.time.replace(':', '')
      return timeA.localeCompare(timeB)
    })
  }

  // Split days into weeks
  const weeks: CalendarDay[][] = []
  for (let i = 0; i < numWeeks; i++) {
    weeks.push(weekDays.slice(i * 7, (i + 1) * 7))
  }
  
  // Get month name from first day
  const monthName = format(weekDays[0].date, 'MMMM yyyy')

  const renderWeek = (weekDays: CalendarDay[], weekIndex: number) => (
    <div key={weekIndex} className="grid grid-cols-7 gap-0.5 items-start">
      {weekDays.map((day) => {
        const dayItems = sortItemsByTime(itemsByDate[day.dateString] || [])

        return (
          <Card
            key={day.dateString}
            className={cn(
              'overflow-hidden w-full',
              day.isToday && 'ring-2 ring-primary',
              dayItems.length === 0 && 'min-h-[60px]'
            )}
          >
            {/* Date header - always shown */}
            <div className="px-1.5 pt-1 pb-0.5">
              <p className="text-base font-bold text-foreground leading-tight">
                {format(day.date, 'd')}
              </p>
            </div>

            {/* Items - auto-height based on content */}
            {dayItems.length > 0 ? (
              <div className="px-1.5 pb-1.5 space-y-1">
                {dayItems.map((item) => (
                  <CalendarItemTile
                    key={item.id}
                    item={item}
                    compact={true}
                    showDate={false}
                  />
                ))}
              </div>
            ) : (
              <div className="px-1.5 pb-1.5" style={{ minHeight: '48px' }} />
            )}
          </Card>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-0.5 pb-2">
      {/* Header with month and weekday names */}
      <div className="grid grid-cols-7 gap-1 mb-0.5">
        <div className="col-span-7 flex items-center justify-center gap-2 mb-1">
          {onPrevious && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevious}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <h3 className="text-lg font-semibold">{monthName}</h3>
          {onNext && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        {weekdayNames.map((dayName, index) => (
          <div key={index} className="text-center p-2 bg-muted/30 rounded-md">
            <p className="text-xs font-semibold text-muted-foreground">{dayName}</p>
          </div>
        ))}
      </div>

      {/* Render all weeks */}
      {weeks.map((week, index) => (
        <div key={index} className={index > 0 ? 'mt-0.5' : ''}>
          {renderWeek(week, index)}
        </div>
      ))}
    </div>
  )
}

