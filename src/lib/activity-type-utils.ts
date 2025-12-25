/**
 * Activity type utilities with user preference support
 */

import { ActivityType } from './calendar-utils'
import { createClient } from './supabase/client'

export interface ActivityTypeOption {
  value: ActivityType
  label: string
}

/**
 * Default activity types (fallback if user preferences not available)
 */
export const DEFAULT_ACTIVITY_TYPES: ActivityTypeOption[] = [
  { value: 'scrimmage', label: 'Scrimmage' },
  { value: 'lesson', label: 'Lesson' },
  { value: 'class', label: 'Class' },
  { value: 'flex_league', label: 'Flex League' },
  { value: 'booked_court', label: 'Booked Court' },
  { value: 'other', label: 'Other' },
]

/**
 * Get activity types for the current user
 * Returns user's enabled activity types in their preferred order
 * Falls back to default types if preferences not available
 */
export async function getUserActivityTypes(): Promise<ActivityTypeOption[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return DEFAULT_ACTIVITY_TYPES
    }

    // Get user's preferences
    const { data, error } = await supabase.rpc('get_user_activity_types', {
      target_user_id: user.id,
    })

    if (error || !data || data.length === 0) {
      // Fallback to defaults
      return DEFAULT_ACTIVITY_TYPES
    }

    // Map preferences to options, filtering out disabled types
    const enabledPreferences = data.filter((pref: any) => pref.is_enabled)
    const typeMap = new Map(DEFAULT_ACTIVITY_TYPES.map(t => [t.value, t.label]))

    return enabledPreferences.map((pref: any) => ({
      value: pref.activity_type as ActivityType,
      label: typeMap.get(pref.activity_type) || pref.activity_type,
    }))
  } catch (error) {
    console.error('Error loading user activity types:', error)
    return DEFAULT_ACTIVITY_TYPES
  }
}

/**
 * Get all activity types (for configuration page)
 * Returns all available types regardless of user preferences
 */
export function getAllActivityTypes(): ActivityTypeOption[] {
  return DEFAULT_ACTIVITY_TYPES
}

