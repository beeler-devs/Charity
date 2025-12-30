import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

/**
 * Creates a Supabase client with admin privileges using the service role key.
 * This client bypasses RLS and allows admin operations like creating users.
 * 
 * WARNING: This should ONLY be used in server-side API routes, never exposed to the client.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase admin environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    )
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

