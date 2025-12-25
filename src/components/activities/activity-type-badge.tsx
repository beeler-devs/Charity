'use client'

import { Badge } from '@/components/ui/badge'
import { getActivityTypeLabel, getActivityTypeBadgeClass } from '@/lib/event-type-colors'
import { ActivityType } from '@/lib/calendar-utils'
import { cn } from '@/lib/utils'

interface ActivityTypeBadgeProps {
  activityType?: ActivityType | string | null
  className?: string
}

/**
 * Centralized component for rendering activity type badges
 * Ensures consistent styling across all pages using getActivityTypeBadgeClass()
 * 
 * @param activityType - The activity type (scrimmage, lesson, class, flex_league, other)
 * @param className - Additional CSS classes
 */
export function ActivityTypeBadge({ 
  activityType, 
  className 
}: ActivityTypeBadgeProps) {
  // Normalize activityType - handle null/undefined consistently
  const activityTypeStr = String(activityType || 'other').toLowerCase()
  const normalizedType = (activityTypeStr === 'scrimmage' || activityTypeStr === 'lesson' || 
    activityTypeStr === 'class' || activityTypeStr === 'flex_league' || activityTypeStr === 'booked_court' || activityTypeStr === 'other'
    ? activityTypeStr 
    : 'other') as ActivityType
  
  const label = getActivityTypeLabel(normalizedType)
  const badgeClasses = getActivityTypeBadgeClass(normalizedType)
  
  // Get the background color for inline style to ensure it overrides
  const getBackgroundColor = () => {
    switch (normalizedType) {
      case 'scrimmage':
        return 'rgb(22, 163, 74)' // green-600
      case 'lesson':
        return 'rgb(79, 70, 229)' // indigo-600
      case 'class':
        return 'rgb(13, 148, 136)' // teal-600
      case 'flex_league':
        return 'rgb(217, 119, 6)' // amber-600
      case 'booked_court':
        return 'rgb(124, 58, 237)' // violet-600
      case 'other':
      default:
        return 'rgb(75, 85, 99)' // gray-600
    }
  }

  return (
    <Badge 
      variant="outline" 
      className={cn("text-[10px] px-1 py-0 h-4 !text-white border-0", badgeClasses, className)}
      style={{ 
        backgroundColor: getBackgroundColor(),
        color: 'white',
        opacity: 1
      }}
    >
      {label}
    </Badge>
  )
}



