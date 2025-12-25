import { EventType, ActivityType } from './calendar-utils'
import { cn } from './utils'

/**
 * Get the color classes for an event type badge
 * This is the centralized styling - all badges should use this
 */
export function getEventTypeBadgeClass(eventType?: EventType): string {
  switch (eventType) {
    case 'practice':
      return 'bg-blue-400 !text-white'
    case 'warmup':
      return 'bg-orange-500 !text-white'
    case 'social':
      return 'bg-pink-500 !text-white'
    case 'other':
      return 'bg-purple-500 !text-white'
    default:
      return 'bg-purple-500 !text-white'
  }
}

/**
 * Get the color classes for an activity type badge
 * Distinct colors from event types to differentiate personal activities
 */
export function getActivityTypeBadgeClass(activityType?: ActivityType): string {
  switch (activityType) {
    case 'scrimmage':
      return 'bg-green-600 !text-white'
    case 'lesson':
      return 'bg-indigo-600 !text-white'
    case 'class':
      return 'bg-teal-600 !text-white'
    case 'flex_league':
      return 'bg-amber-600 !text-white'
    case 'other':
      return 'bg-gray-600 !text-white'
    default:
      return 'bg-gray-600 !text-white'
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
    case 'social':
      return 'Social'
    case 'other':
      return 'Other'
    default:
      return 'Event'
  }
}

/**
 * Get the display label for an activity type
 */
export function getActivityTypeLabel(activityType?: ActivityType): string {
  switch (activityType) {
    case 'scrimmage':
      return 'Scrimmage'
    case 'lesson':
      return 'Lesson'
    case 'class':
      return 'Class'
    case 'flex_league':
      return 'Flex League'
    case 'other':
      return 'Other'
    default:
      return 'Activity'
  }
}

/**
 * Get all available event types
 */
export function getEventTypes(): { value: EventType; label: string }[] {
  return [
    { value: 'practice', label: 'Practice' },
    { value: 'warmup', label: 'Warmup' },
    { value: 'social', label: 'Social' },
    { value: 'other', label: 'Other' },
  ]
}

/**
 * Get all available activity types
 */
export function getActivityTypes(): { value: ActivityType; label: string }[] {
  return [
    { value: 'scrimmage', label: 'Scrimmage' },
    { value: 'lesson', label: 'Lesson' },
    { value: 'class', label: 'Class' },
    { value: 'flex_league', label: 'Flex League' },
    { value: 'other', label: 'Other' },
  ]
}






