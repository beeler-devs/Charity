'use client'

import { CalendarDay, CalendarItem, getMonthDays, groupItemsByDate, getWeekdayNames } from '@/lib/calendar-utils'
import { CalendarItemTile } from './calendar-item-tile'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface MonthViewProps {
  currentDate: Date
  items: CalendarItem[]
  onPrevious?: () => void
  onNext?: () => void
}

export function MonthView({ currentDate, items, onPrevious, onNext }: MonthViewProps) {
  const monthDays = getMonthDays(currentDate)
  const weekdayNames = getWeekdayNames(true)
  const itemsByDate = groupItemsByDate(items)
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null)

  const selectedDayItems = selectedDay ? (itemsByDate[selectedDay.dateString] || []) : []
  const monthName = format(currentDate, 'MMMM yyyy')

  return (
    <>
      <div className="space-y-2">
        {/* Month name and navigation */}
        <div className="flex items-center justify-center gap-3 mb-2">
          {onPrevious && (
            <Button
              variant="outline"
              size="icon"
              onClick={onPrevious}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <h3 className="text-lg font-semibold min-w-[140px] text-center">
            {monthName}
          </h3>
          {onNext && (
            <Button
              variant="outline"
              size="icon"
              onClick={onNext}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1">
          {weekdayNames.map((name) => (
            <div
              key={name}
              className="text-xs font-medium text-center text-muted-foreground py-1"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((day) => {
            const dayItems = itemsByDate[day.dateString] || []
            const visibleItems = dayItems.slice(0, 3)
            const hasMore = dayItems.length > 3

            return (
              <div
                key={day.dateString}
                onClick={() => {
                  if (dayItems.length > 0) {
                    setSelectedDay(day)
                  }
                }}
                className={cn(
                  'min-h-[80px] border rounded-lg p-1.5 cursor-pointer transition-colors',
                  day.isCurrentMonth ? 'bg-background' : 'bg-muted/30',
                  day.isToday && 'ring-2 ring-primary',
                  dayItems.length > 0 && 'hover:bg-accent/50'
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      !day.isCurrentMonth && 'text-muted-foreground',
                      day.isToday && 'text-primary'
                    )}
                  >
                    {day.dayOfMonth}
                  </span>
                  {dayItems.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {dayItems.length}
                    </span>
                  )}
                </div>

                {/* Items preview */}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <CalendarItemTile
                      key={item.id}
                      item={item}
                      compact={true}
                    />
                  ))}
                  
                  {hasMore && (
                    <div className="text-[10px] text-primary text-center py-0.5">
                      +{dayItems.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Day detail sheet */}
      <Sheet open={selectedDay !== null} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>
              {selectedDay && (
                <>
                  {selectedDay.date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </>
              )}
            </SheetTitle>
            <SheetDescription>
              {selectedDayItems.length} {selectedDayItems.length === 1 ? 'item' : 'items'} scheduled
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
            {selectedDayItems.map((item) => (
              <CalendarItemTile
                key={item.id}
                item={item}
                compact={false}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

