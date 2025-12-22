import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addDays, subDays, format, isSameDay as dateFnsIsSameDay, isToday as dateFnsIsToday, parseISO } from 'date-fns'

export interface CalendarDay {
  date: Date
  dateString: string // YYYY-MM-DD format
  dayOfMonth: number
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
}

export type EventType = 'practice' | 'warmup' | 'fun' | 'social' | 'other'

export interface CalendarItem {
  id: string
  type: 'match' | 'event'
  date: string // YYYY-MM-DD
  time: string
  duration?: number | null // Duration in minutes (for events)
  teamId: string
  teamName: string
  teamColor?: string | null // Saved team color from database
  name: string // opponent name for match, event name for event
  availabilityStatus?: 'available' | 'unavailable' | 'maybe' | 'late'
  eventType?: EventType // Only for events
  availabilitySummary?: {
    available: number
    maybe: number
    unavailable: number
    total: number
  }
}

/**
 * Get all days for a month view (including leading/trailing days from adjacent months)
 */
export function getMonthDays(date: Date): CalendarDay[] {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  
  // Get the start of the week for the first day of the month
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }) // Sunday
  
  // Get the end of the week for the last day of the month
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  
  return days.map(day => ({
    date: day,
    dateString: format(day, 'yyyy-MM-dd'),
    dayOfMonth: day.getDate(),
    isCurrentMonth: day.getMonth() === date.getMonth(),
    isToday: dateFnsIsToday(day),
    isWeekend: day.getDay() === 0 || day.getDay() === 6,
  }))
}

/**
 * Get days for a week view starting from Sunday
 * @param date - The current date
 * @param numWeeks - Number of weeks to display (default: 2)
 */
export function getWeekDays(date: Date, numWeeks: number = 2): CalendarDay[] {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 }) // Sunday
  const totalDays = numWeeks * 7
  const weekEnd = addDays(weekStart, totalDays - 1)
  
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  
  return days.map(day => ({
    date: day,
    dateString: format(day, 'yyyy-MM-dd'),
    dayOfMonth: day.getDate(),
    isCurrentMonth: true, // Always true for week view
    isToday: dateFnsIsToday(day),
    isWeekend: day.getDay() === 0 || day.getDay() === 6,
  }))
}

/**
 * Group calendar items by date
 */
export function groupItemsByDate(items: CalendarItem[]): Record<string, CalendarItem[]> {
  return items.reduce((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = []
    }
    acc[item.date].push(item)
    return acc
  }, {} as Record<string, CalendarItem[]>)
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return dateFnsIsToday(dateObj)
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2
  return dateFnsIsSameDay(d1, d2)
}

/**
 * Format date for calendar display
 */
export function formatCalendarDate(date: Date, formatStr: string = 'MMM d, yyyy'): string {
  return format(date, formatStr)
}

/**
 * Get date range for loading data for a month view (includes buffer)
 */
export function getDateRangeForMonth(date: Date): { start: string; end: string } {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  
  // Add 1 week buffer on each side for adjacent month days
  const start = subDays(startOfWeek(monthStart, { weekStartsOn: 0 }), 7)
  const end = addDays(endOfWeek(monthEnd, { weekStartsOn: 0 }), 7)
  
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  }
}

/**
 * Get date range for loading data for a week view
 * @param date - The current date
 * @param numWeeks - Number of weeks to display (default: 2)
 */
export function getDateRangeForWeek(date: Date, numWeeks: number = 2): { start: string; end: string } {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 })
  const totalDays = numWeeks * 7
  const weekEnd = addDays(weekStart, totalDays - 1)
  
  return {
    start: format(weekStart, 'yyyy-MM-dd'),
    end: format(weekEnd, 'yyyy-MM-dd'),
  }
}

/**
 * Get weekday names
 */
export function getWeekdayNames(short: boolean = true): string[] {
  if (short) {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  }
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
}

/**
 * Navigate to previous month
 */
export function getPreviousMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1)
}

/**
 * Navigate to next month
 */
export function getNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

/**
 * Navigate to previous week
 * @param date - The current date
 * @param numWeeks - Number of weeks to go back (default: 2)
 */
export function getPreviousWeek(date: Date, numWeeks: number = 2): Date {
  return subDays(date, numWeeks * 7)
}

/**
 * Navigate to next week
 * @param date - The current date
 * @param numWeeks - Number of weeks to go forward (default: 2)
 */
export function getNextWeek(date: Date, numWeeks: number = 2): Date {
  return addDays(date, numWeeks * 7)
}

