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
    activityTypeStr === 'class' || activityTypeStr === 'flex_league' || activityTypeStr === 'other'
    ? activityTypeStr 
    : 'other') as ActivityType
  
  const label = getActivityTypeLabel(normalizedType)
  const badgeClasses = getActivityTypeBadgeClass(normalizedType)

  return (
    <Badge 
      variant="default" 
      className={cn("text-[10px] px-1 py-0 h-4", badgeClasses, className)}
    >
      {label}
    </Badge>
  )
}


