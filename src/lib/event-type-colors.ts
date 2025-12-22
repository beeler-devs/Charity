import { EventType } from './calendar-utils'
import { cn } from './utils'

/**
 * Get the color classes for an event type badge
 */
export function getEventTypeBadgeClass(eventType?: EventType): string {
  switch (eventType) {
    case 'practice':
      return 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
    case 'warmup':
      return 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200'
    case 'fun':
      return 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
    case 'social':
      return 'bg-pink-100 text-pink-800 border-pink-300 hover:bg-pink-200'
    case 'other':
      return 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200'
  }
}

/**
 * Get the display label for an event type
 */
export function getEventTypeLabel(eventType?: EventType): string {
  switch (eventType) {
    case 'practice':
      return 'Practice'
    case 'warmup':
      return 'Warmup'
    case 'fun':
      return 'Fun'
    case 'social':
      return 'Social'
    case 'other':
      return 'Other'
    default:
      return 'Event'
  }
}

/**
 * Get all available event types
 */
export function getEventTypes(): { value: EventType; label: string }[] {
  return [
    { value: 'practice', label: 'Practice' },
    { value: 'warmup', label: 'Warmup' },
    { value: 'fun', label: 'Fun' },
    { value: 'social', label: 'Social' },
    { value: 'other', label: 'Other' },
  ]
}


