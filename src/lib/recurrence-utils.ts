/**
 * Shared recurrence utilities for all event types
 * Used by personal activities, team events, and any other recurring events
 */

import { parseISO, format, addDays, addWeeks, addMonths, addYears, getDay, isBefore, isAfter } from 'date-fns'

export type RecurrencePattern = 'daily' | 'weekly' | 'custom'
export type RecurrenceEndType = 'date' | 'occurrences' | 'never'
export type RecurrenceTimeUnit = 'day' | 'week' | 'month' | 'year'

export interface CustomRecurrenceData {
  interval: number
  timeUnit: RecurrenceTimeUnit
  selectedDays?: number[] // 0=Sunday, 1=Monday, ..., 6=Saturday (for weekly patterns)
}

export interface RecurrenceConfig {
  pattern: RecurrencePattern
  endType: RecurrenceEndType
  endDate?: string
  occurrences?: number
  customData?: CustomRecurrenceData
}

/**
 * Generate recurring dates based on pattern and end conditions
 * Works for daily, weekly, and custom recurrence patterns
 */
export function generateRecurringDates(
  startDate: string,
  pattern: RecurrencePattern,
  endType: RecurrenceEndType,
  endDate?: string,
  numOccurrences?: number,
  customData?: CustomRecurrenceData
): string[] {
  const dates: string[] = [startDate]
  const start = parseISO(startDate)
  let current = new Date(start)
  let count = 1

  const maxIterations = 1000 // Safety limit to prevent infinite loops

  if (pattern === 'custom' && customData) {
    const { interval, timeUnit, selectedDays } = customData
    
    if (endType === 'date' && endDate) {
      const end = parseISO(endDate)
      let iterations = 0
      
      while (current < end && iterations < maxIterations) {
        iterations++
        
        if (timeUnit === 'day') {
          current = addDays(current, interval)
        } else if (timeUnit === 'week') {
          if (selectedDays && selectedDays.length > 0) {
            // For weekly with selected days and interval:
            // The start date should already be on one of the selected days
            // For subsequent occurrences, just add interval weeks to maintain the same day of week
            // Example: interval=2, selectedDays=[3] (Wednesday), start=Wednesday Jan 15
            // - First occurrence: Jan 15 (already in dates array)
            // - Second: Jan 15 + 2 weeks = Jan 29 (Wednesday)
            // - Third: Jan 29 + 2 weeks = Feb 12 (Wednesday)
            current = addWeeks(current, interval)
          } else {
            // No selected days, just move forward by interval weeks
            current = addWeeks(current, interval)
          }
        } else if (timeUnit === 'month') {
          current = addMonths(current, interval)
        } else if (timeUnit === 'year') {
          current = addYears(current, interval)
        }
        
        if (current <= end) {
          dates.push(format(current, 'yyyy-MM-dd'))
        }
      }
    } else if (endType === 'occurrences' && numOccurrences) {
      while (count < numOccurrences && count < maxIterations) {
        count++
        
        if (timeUnit === 'day') {
          current = addDays(current, interval)
        } else if (timeUnit === 'week') {
          if (selectedDays && selectedDays.length > 0) {
            // For weekly with selected days and interval:
            // The start date should already be on one of the selected days
            // For subsequent occurrences, just add interval weeks to maintain the same day of week
            // Example: interval=2, selectedDays=[3] (Wednesday), start=Wednesday Jan 15
            // - First occurrence: Jan 15 (already in dates array)
            // - Second: Jan 15 + 2 weeks = Jan 29 (Wednesday)
            // - Third: Jan 29 + 2 weeks = Feb 12 (Wednesday)
            current = addWeeks(current, interval)
          } else {
            // No selected days, just move forward by interval weeks
            current = addWeeks(current, interval)
          }
        } else if (timeUnit === 'month') {
          current = addMonths(current, interval)
        } else if (timeUnit === 'year') {
          current = addYears(current, interval)
        }
        
        dates.push(format(current, 'yyyy-MM-dd'))
      }
    } else if (endType === 'never') {
      // Generate dates for a reasonable future period (e.g., 2 years)
      const end = addYears(start, 2)
      let iterations = 0
      
      while (current < end && iterations < maxIterations) {
        iterations++
        
        if (timeUnit === 'day') {
          current = addDays(current, interval)
        } else if (timeUnit === 'week') {
          if (selectedDays && selectedDays.length > 0) {
            // For weekly with selected days and interval:
            // Just add interval weeks to maintain the same day of week
            current = addWeeks(current, interval)
          } else {
            // No selected days, just move forward by interval weeks
            current = addWeeks(current, interval)
          }
        } else if (timeUnit === 'month') {
          current = addMonths(current, interval)
        } else if (timeUnit === 'year') {
          current = addYears(current, interval)
        }
        
        if (current <= end) {
          dates.push(format(current, 'yyyy-MM-dd'))
        }
      }
    }
  } else {
    // Simple daily or weekly patterns
    if (endType === 'date' && endDate) {
      const end = parseISO(endDate)
      while (current < end) {
        if (pattern === 'daily') {
          current = addDays(current, 1)
        } else if (pattern === 'weekly') {
          current = addWeeks(current, 1)
        }
        if (current <= end) {
          dates.push(format(current, 'yyyy-MM-dd'))
        }
      }
    } else if (endType === 'occurrences' && numOccurrences) {
      while (count < numOccurrences) {
        if (pattern === 'daily') {
          current = addDays(current, 1)
        } else if (pattern === 'weekly') {
          current = addWeeks(current, 1)
        }
        dates.push(format(current, 'yyyy-MM-dd'))
        count++
      }
    } else if (endType === 'never') {
      // Generate dates for 2 years
      const end = addYears(start, 2)
      while (current < end) {
        if (pattern === 'daily') {
          current = addDays(current, 1)
        } else if (pattern === 'weekly') {
          current = addWeeks(current, 1)
        }
        if (current <= end) {
          dates.push(format(current, 'yyyy-MM-dd'))
        }
      }
    }
  }

  return dates
}

/**
 * Validate recurrence configuration
 */
export function validateRecurrenceConfig(config: RecurrenceConfig): { valid: boolean; error?: string } {
  if (config.pattern === 'custom' && !config.customData) {
    return { valid: false, error: 'Custom recurrence pattern requires custom data' }
  }

  if (config.pattern === 'custom' && config.customData) {
    if (config.customData.interval < 1) {
      return { valid: false, error: 'Interval must be at least 1' }
    }

    if (config.customData.timeUnit === 'week' && (!config.customData.selectedDays || config.customData.selectedDays.length === 0)) {
      return { valid: false, error: 'Weekly custom recurrence requires at least one day selected' }
    }
  }

  if (config.endType === 'date' && !config.endDate) {
    return { valid: false, error: 'End date is required when ending on a specific date' }
  }

  if (config.endType === 'date' && config.endDate) {
    try {
      const end = parseISO(config.endDate)
      const start = parseISO(config.endDate) // This should be the start date, but we don't have it here
      // We'll validate this in the component where we have the start date
    } catch {
      return { valid: false, error: 'Invalid end date format' }
    }
  }

  if (config.endType === 'occurrences' && (!config.occurrences || config.occurrences < 2)) {
    return { valid: false, error: 'Number of occurrences must be at least 2' }
  }

  return { valid: true }
}

