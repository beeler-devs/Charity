/**
 * Impersonation utilities for system admin
 * Allows admins to view the system as another user
 */

const IMPERSONATION_STORAGE_KEY = 'admin_impersonation'
const ORIGINAL_ADMIN_KEY = 'original_admin_id'

export interface ImpersonationState {
  impersonatedUserId: string
  impersonatedUserEmail: string
  impersonatedUserName: string | null
  originalAdminId: string
  originalAdminEmail: string
}

/**
 * Check if currently impersonating a user
 */
export function isImpersonating(): boolean {
  if (typeof window === 'undefined') return false
  const state = localStorage.getItem(IMPERSONATION_STORAGE_KEY)
  return !!state
}

/**
 * Get current impersonation state
 */
export function getImpersonationState(): ImpersonationState | null {
  if (typeof window === 'undefined') return null
  const state = localStorage.getItem(IMPERSONATION_STORAGE_KEY)
  if (!state) return null
  try {
    return JSON.parse(state)
  } catch {
    return null
  }
}

/**
 * Start impersonating a user
 */
export function startImpersonation(
  impersonatedUserId: string,
  impersonatedUserEmail: string,
  impersonatedUserName: string | null,
  originalAdminId: string,
  originalAdminEmail: string
) {
  if (typeof window === 'undefined') return
  
  const state: ImpersonationState = {
    impersonatedUserId,
    impersonatedUserEmail,
    impersonatedUserName,
    originalAdminId,
    originalAdminEmail,
  }
  
  localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(state))
  localStorage.setItem(ORIGINAL_ADMIN_KEY, originalAdminId)
}

/**
 * Stop impersonating and return to admin account
 */
export function stopImpersonation() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(IMPERSONATION_STORAGE_KEY)
  localStorage.removeItem(ORIGINAL_ADMIN_KEY)
  // Reload to clear any cached user data
  window.location.href = '/admin/users'
}

/**
 * Get the original admin ID (for API calls)
 */
export function getOriginalAdminId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ORIGINAL_ADMIN_KEY)
}

/**
 * Get impersonated user ID (for API calls that need to know the target user)
 */
export function getImpersonatedUserId(): string | null {
  if (typeof window === 'undefined') return null
  const state = getImpersonationState()
  return state?.impersonatedUserId || null
}

