// Generate array of 30-min time slots between start and end hours
export function generateTimeSlots(startHour: number, endHour: number): string[] {
  const slots: string[] = []
  for (let hour = startHour; hour <= endHour; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`)
    if (hour < endHour) {
      slots.push(`${hour.toString().padStart(2, '0')}:30`)
    }
  }
  return slots
}

// Get day-of-week name from date
export function getDayOfWeek(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[date.getDay()]
}

// Get default availability for a specific day
export function getDefaultsForDay(
  availabilityDefaults: Record<string, string[]>,
  dayOfWeek: string
): string[] {
  return availabilityDefaults[dayOfWeek] || []
}

// Calculate status from time slots
export function calculateStatus(timeSlots: string[]): 'available' | 'unavailable' {
  return timeSlots.length > 0 ? 'available' : 'unavailable'
}

// Format time for display (18:00 -> 6:00 PM)
export function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`
}

// Get all days of the week
export function getAllDays(): string[] {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
}

// Format time range from array of slots
export function formatTimeRange(slots: string[]): string {
  if (slots.length === 0) return 'Not available'
  
  const sortedSlots = [...slots].sort()
  const firstSlot = sortedSlots[0]
  const lastSlot = sortedSlots[sortedSlots.length - 1]
  
  // Add 30 minutes to the last slot to get the end time
  const [lastHour, lastMin] = lastSlot.split(':').map(Number)
  const endHour = lastMin === 30 ? lastHour + 1 : lastHour
  const endMin = lastMin === 30 ? 0 : 30
  const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`
  
  return `${formatTimeDisplay(firstSlot)} - ${formatTimeDisplay(endTime)}`
}

// Check if a specific time is within available slots
export function isTimeAvailable(
  time: string,  // e.g., '19:00'
  availableSlots: string[]
): boolean {
  return availableSlots.includes(time)
}

// Auto-calculate match availability status from defaults
export function calculateMatchAvailability(
  matchDate: string,
  matchTime: string,
  availabilityDefaults: Record<string, string[]> | null | undefined
): 'available' | 'unavailable' {
  // If no defaults set, user is available anytime (default behavior)
  if (!availabilityDefaults || Object.keys(availabilityDefaults).length === 0) {
    return 'available'
  }
  
  const dayOfWeek = getDayOfWeek(new Date(matchDate))
  const slotsForDay = getDefaultsForDay(availabilityDefaults, dayOfWeek)
  
  return isTimeAvailable(matchTime, slotsForDay) ? 'available' : 'unavailable'
}

// Get all time slots for all days (used for default "available anytime")
export function getAllTimeSlots(): Record<string, string[]> {
  const allSlots = generateTimeSlots(6, 22)
  const defaults: Record<string, string[]> = {}
  
  getAllDays().forEach(day => {
    defaults[day] = [...allSlots]
  })
  
  return defaults
}

