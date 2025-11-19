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
  return `${formattedHour}:${minutes} ${ampm}`
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
  isHome?: boolean
}> {
  const lines = csvText.trim().split('\n')
  const results: Array<{
    date: string
    time: string
    opponent: string
    venue?: string
    isHome?: boolean
  }> = []

  // Skip header if present
  const startIndex = lines[0].toLowerCase().includes('date') ? 1 : 0

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.split(',').map(p => p.trim())
    if (parts.length >= 3) {
      results.push({
        date: parts[0],
        time: parts[1],
        opponent: parts[2],
        venue: parts[3] || undefined,
        isHome: parts[4]?.toLowerCase() === 'home' || parts[4]?.toLowerCase() === 'true',
      })
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
