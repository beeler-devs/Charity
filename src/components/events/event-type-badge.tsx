'use client'

import { Badge } from '@/components/ui/badge'
import { getEventTypeLabel, getEventTypeBadgeClass } from '@/lib/event-type-colors'
import { EventType } from '@/lib/calendar-utils'
import { cn } from '@/lib/utils'

interface EventTypeBadgeProps {
  eventType?: EventType | string | null
  hidePractice?: boolean // If true, returns null for practice events (default: false)
  className?: string
}

/**
 * Centralized component for rendering event type badges
 * Ensures consistent styling across all pages using getEventTypeBadgeClass()
 * 
 * @param eventType - The event type (practice, warmup, social, other)
 * @param hidePractice - If true, practice events won't render a badge (default: false)
 * @param className - Additional CSS classes
 */
export function EventTypeBadge({ 
  eventType, 
  hidePractice = false, 
  className 
}: EventTypeBadgeProps) {
  // Normalize eventType - handle null/undefined consistently
  // Convert to string first to ensure consistent comparison
  const eventTypeStr = String(eventType || 'other').toLowerCase()
  const normalizedType = (eventTypeStr === 'practice' || eventTypeStr === 'warmup' || eventTypeStr === 'social' || eventTypeStr === 'other' 
    ? eventTypeStr 
    : 'other') as EventType

  // Don't render badge for practice events if hidePractice is true
  // Check after normalization to ensure consistent behavior
  if (hidePractice && normalizedType === 'practice') {
    return null
  }
  
  const label = getEventTypeLabel(normalizedType)
  const badgeClasses = getEventTypeBadgeClass(normalizedType)

  return (
    <Badge 
      variant="default" 
      className={cn("text-[10px] px-1 py-0 h-4", badgeClasses, className)}
    >
      {label}
    </Badge>
  )
}




