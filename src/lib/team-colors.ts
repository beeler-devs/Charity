/**
 * Team color system for calendar visual identification
 * Generates consistent colors based on team ID using a hash function
 */

// Predefined color palette using Tailwind's 500 shades
const TEAM_COLORS = [
  { name: 'blue', hex: '#3b82f6', bgClass: 'bg-blue-500', borderClass: 'border-l-blue-500', textClass: 'text-blue-500' },
  { name: 'green', hex: '#22c55e', bgClass: 'bg-green-500', borderClass: 'border-l-green-500', textClass: 'text-green-500' },
  { name: 'purple', hex: '#a855f7', bgClass: 'bg-purple-500', borderClass: 'border-l-purple-500', textClass: 'text-purple-500' },
  { name: 'orange', hex: '#f97316', bgClass: 'bg-orange-500', borderClass: 'border-l-orange-500', textClass: 'text-orange-500' },
  { name: 'pink', hex: '#ec4899', bgClass: 'bg-pink-500', borderClass: 'border-l-pink-500', textClass: 'text-pink-500' },
  { name: 'teal', hex: '#14b8a6', bgClass: 'bg-teal-500', borderClass: 'border-l-teal-500', textClass: 'text-teal-500' },
  { name: 'red', hex: '#ef4444', bgClass: 'bg-red-500', borderClass: 'border-l-red-500', textClass: 'text-red-500' },
  { name: 'yellow', hex: '#eab308', bgClass: 'bg-yellow-500', borderClass: 'border-l-yellow-500', textClass: 'text-yellow-500' },
  { name: 'indigo', hex: '#6366f1', bgClass: 'bg-indigo-500', borderClass: 'border-l-indigo-500', textClass: 'text-indigo-500' },
  { name: 'cyan', hex: '#06b6d4', bgClass: 'bg-cyan-500', borderClass: 'border-l-cyan-500', textClass: 'text-cyan-500' },
]

/**
 * Simple hash function to convert team ID to a number
 */
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Get team color object based on team ID
 */
export function getTeamColor(teamId: string) {
  const hash = hashCode(teamId)
  const index = hash % TEAM_COLORS.length
  return TEAM_COLORS[index]
}

/**
 * Get Tailwind CSS class for team color background
 */
export function getTeamColorClass(teamId: string, type: 'bg' | 'border' | 'text' = 'bg'): string {
  const color = getTeamColor(teamId)
  
  switch (type) {
    case 'bg':
      return color.bgClass
    case 'border':
      return color.borderClass
    case 'text':
      return color.textClass
    default:
      return color.bgClass
  }
}

/**
 * Get hex color value for team
 */
export function getTeamColorHex(teamId: string): string {
  return getTeamColor(teamId).hex
}

/**
 * Get color name for team
 */
export function getTeamColorName(teamId: string): string {
  return getTeamColor(teamId).name
}

/**
 * Get all available colors (for legend/documentation)
 */
export function getAllTeamColors() {
  return TEAM_COLORS
}


