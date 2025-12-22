'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { CalendarItem } from '@/lib/calendar-utils'
import { getTeamColorClass } from '@/lib/team-colors'
import { getEventTypeBadgeClass, getEventTypeLabel } from '@/lib/event-type-colors'
import { formatTime, formatDate, calculateEndTime } from '@/lib/utils'
import { Check, X, HelpCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalendarItemTileProps {
  item: CalendarItem
  compact?: boolean
  showDate?: boolean
}

export function CalendarItemTile({ item, compact = false, showDate = false }: CalendarItemTileProps) {
  const router = useRouter()

  const getAvailabilityIcon = () => {
    if (!item.availabilityStatus) return null
    
    switch (item.availabilityStatus) {
      case 'available':
        return <Check className="h-3 w-3 text-green-500" />
      case 'unavailable':
        return <X className="h-3 w-3 text-red-500" />
      case 'maybe':
        return <HelpCircle className="h-3 w-3 text-yellow-500" />
      case 'late':
        return <Clock className="h-3 w-3 text-orange-500" />
      default:
        return null
    }
  }

  const handleClick = () => {
    if (item.type === 'match') {
      router.push(`/teams/${item.teamId}/matches/${item.id}`)
    } else {
      router.push(`/teams/${item.teamId}/events/${item.id}`)
    }
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'rounded-md cursor-pointer transition-colors hover:opacity-80 border-l-4',
        getTeamColorClass(item.teamId, 'border', item.teamColor),
        getTeamColorClass(item.teamId, 'bgLight', item.teamColor),
        compact ? 'p-1.5' : 'p-2'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {item.type === 'match' ? (
              <Badge 
                variant="default" 
                className="text-[10px] px-1 py-0 h-4"
              >
                Match
              </Badge>
            ) : item.eventType === 'practice' ? (
              <Badge 
                variant="default" 
                className="text-[10px] px-1 py-0 h-4 bg-blue-500"
              >
                Practice
              </Badge>
            ) : item.eventType === 'warmup' ? (
              <Badge 
                variant="default" 
                className="text-[10px] px-1 py-0 h-4 bg-orange-500"
              >
                Warmup
              </Badge>
            ) : item.eventType === 'social' ? (
              <Badge 
                variant="default" 
                className="text-[10px] px-1 py-0 h-4 bg-pink-500"
              >
                Social
              </Badge>
            ) : item.eventType ? (
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-[10px] px-1 py-0 h-4",
                  getEventTypeBadgeClass(item.eventType)
                )}
              >
                {getEventTypeLabel(item.eventType)}
              </Badge>
            ) : null}
            {getAvailabilityIcon()}
          </div>
          
          {showDate && (
            <p className={cn(
              'text-foreground mb-1 font-bold',
              compact ? 'text-lg' : 'text-xl'
            )}>
              {formatDate(item.date, 'd')}
            </p>
          )}
          
          <p className={cn(
            'font-medium truncate',
            compact ? 'text-xs' : 'text-sm'
          )}>
            {item.name}
          </p>
          
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xs text-muted-foreground">
              {item.type === 'event' && item.duration 
                ? `${formatTime(item.time)}-${formatTime(calculateEndTime(item.time, item.duration))}`
                : item.type === 'event' && !item.duration
                ? `${formatTime(item.time)} (no end time)`
                : formatTime(item.time)}
            </p>
            <p className={cn(
              'text-muted-foreground truncate',
              compact ? 'text-[10px]' : 'text-xs'
            )}>
              {item.teamName}
            </p>
            {item.availabilitySummary && !compact && (
              <p className="text-xs text-muted-foreground">
                • {item.availabilitySummary.available} available
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

