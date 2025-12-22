import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, formatStr: string = 'MMM d, yyyy'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return format(dateObj, formatStr)
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const formattedHour = hour % 12 || 12
  return `${formattedHour}:${minutes}${minutes === '00' ? '' : ''} ${ampm}`
}

export function calculateEndTime(startTime: string, durationMinutes: number | null | undefined): string {
  if (!durationMinutes) return startTime
  
  const [hours, minutes] = startTime.split(':')
  const startHour = parseInt(hours, 10)
  const startMinute = parseInt(minutes, 10)
  
  const totalMinutes = startHour * 60 + startMinute + durationMinutes
  const endHour = Math.floor(totalMinutes / 60) % 24
  const endMinute = totalMinutes % 60
  
  // Handle case where endMinute is exactly 60 (should be 0 with hour incremented)
  // This shouldn't happen with proper modulo, but ensure clean output
  const finalHour = endMinute === 60 ? (endHour + 1) % 24 : endHour
  const finalMinute = endMinute === 60 ? 0 : endMinute
  
  return `${finalHour.toString().padStart(2, '0')}:${finalMinute.toString().padStart(2, '0')}`
}

export function getWarmupMessage(
  status: 'booked' | 'none_yet' | 'no_warmup',
  time?: string | null,
  court?: string | null
): string {
  switch (status) {
    case 'booked':
      return `Warm-up: ${time ? formatTime(time) : 'TBD'} on Court ${court || 'TBD'} (we have it booked!)`
    case 'none_yet':
      return 'Please help find a warm-up court.'
    case 'no_warmup':
      return 'Warm up on your own.'
    default:
      return ''
  }
}

export function getAvailabilityColor(status: string): string {
  switch (status) {
    case 'available':
      return 'bg-green-500'
    case 'unavailable':
      return 'bg-gray-400'
    case 'maybe':
      return 'bg-yellow-500'
    case 'late':
      return 'bg-orange-500'
    default:
      return 'bg-gray-200'
  }
}

export function getStatusIcon(status: 'in_lineup' | 'off' | 'pending'): {
  icon: string
  color: string
  label: string
} {
  switch (status) {
    case 'in_lineup':
      return { icon: 'check', color: 'text-green-500', label: 'In Lineup' }
    case 'off':
      return { icon: 'minus', color: 'text-gray-400', label: 'Off' }
    case 'pending':
      return { icon: 'clock', color: 'text-yellow-500', label: 'Pending' }
    default:
      return { icon: 'help', color: 'text-gray-400', label: 'Unknown' }
  }
}

export function calculateFairPlayScore(
  matchesPlayed: number,
  totalTeamMatches: number
): number {
  if (totalTeamMatches === 0) return 100
  const playPercentage = (matchesPlayed / totalTeamMatches) * 100
  return Math.round(100 - playPercentage)
}

export function parseCSVSchedule(csvText: string): Array<{
  date: string
  time: string
  opponent: string
  venue?: string
  venueAddress?: string
  isHome?: boolean
  duration?: number
  warmupStatus?: string
  warmupTime?: string
  warmupCourt?: string
}> {
  const lines = csvText.trim().split('\n')
  const results: Array<{
    date: string
    time: string
    opponent: string
    venue?: string
    venueAddress?: string
    isHome?: boolean
    duration?: number
    warmupStatus?: string
    warmupTime?: string
    warmupCourt?: string
  }> = []

  // Skip header if present
  const startIndex = lines[0].toLowerCase().includes('date') ? 1 : 0

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.split(',').map(p => p.trim())
    if (parts.length >= 3) {
      // CSV format: Date, Time, Opponent, Home/Away, Venue, Venue Address, Duration, Warmup Status, Warmup Time, Warmup Court
      const match: any = {
        date: parts[0],
        time: parts[1],
        opponent: parts[2],
      }

      // Home/Away (index 3)
      if (parts[3]) {
        match.isHome = parts[3].toLowerCase() === 'home' || parts[3].toLowerCase() === 'true'
      }

      // Venue (index 4)
      if (parts[4]) {
        match.venue = parts[4]
      }

      // Venue Address (index 5)
      if (parts[5]) {
        match.venueAddress = parts[5]
      }

      // Duration (index 6)
      if (parts[6] && !isNaN(parseInt(parts[6]))) {
        match.duration = parseInt(parts[6])
      }

      // Warmup Status (index 7)
      if (parts[7]) {
        const status = parts[7].toLowerCase()
        if (['booked', 'none_yet', 'no_warmup'].includes(status)) {
          match.warmupStatus = status
        }
      }

      // Warmup Time (index 8)
      if (parts[8]) {
        match.warmupTime = parts[8]
      }

      // Warmup Court (index 9)
      if (parts[9]) {
        match.warmupCourt = parts[9]
      }

      results.push(match)
    }
  }

  return results
}

export function parseCSVPlayers(csvText: string): Array<{
  fullName: string
  email?: string
  phone?: string
  ntrpRating?: number
  role?: 'captain' | 'co-captain' | 'player'
}> {
  const lines = csvText.trim().split('\n')
  const results: Array<{
    fullName: string
    email?: string
    phone?: string
    ntrpRating?: number
    role?: 'captain' | 'co-captain' | 'player'
  }> = []

  // Skip header if present
  const firstLine = lines[0].toLowerCase()
  const hasHeader = firstLine.includes('name') || firstLine.includes('email') || firstLine.includes('full')
  const startIndex = hasHeader ? 1 : 0

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Handle CSV with quoted fields that may contain commas
    const parts: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    parts.push(current.trim()) // Add the last part

    // Remove quotes from parts
    const cleanedParts = parts.map(p => p.replace(/^"|"$/g, ''))

    if (cleanedParts.length >= 1 && cleanedParts[0]) {
      // CSV format: Full Name, Email, Phone, NTRP Rating, Role
      const player: any = {
        fullName: cleanedParts[0],
      }

      // Email (index 1)
      if (cleanedParts[1] && cleanedParts[1].includes('@')) {
        player.email = cleanedParts[1].trim()
      }

      // Phone (index 2)
      if (cleanedParts[2]) {
        player.phone = cleanedParts[2].trim()
      }

      // NTRP Rating (index 3)
      if (cleanedParts[3] && !isNaN(parseFloat(cleanedParts[3]))) {
        const rating = parseFloat(cleanedParts[3])
        if (rating >= 1.0 && rating <= 7.0) {
          player.ntrpRating = rating
        }
      }

      // Role (index 4)
      if (cleanedParts[4]) {
        const role = cleanedParts[4].toLowerCase().trim()
        if (role === 'captain' || role === 'co-captain' || role === 'player') {
          player.role = role
        } else if (role === 'cocaptain' || role === 'co_captain') {
          player.role = 'co-captain'
        } else {
          player.role = 'player' // Default
        }
      } else {
        player.role = 'player' // Default
      }

      results.push(player)
    }
  }

  return results
}

export function generateLineupSummary(
  lineups: Array<{
    court_slot: number
    player1_name: string
    player2_name: string
  }>
): string {
  return lineups
    .sort((a, b) => a.court_slot - b.court_slot)
    .map(l => `Court ${l.court_slot}: ${l.player1_name} & ${l.player2_name}`)
    .join('\n')
}
