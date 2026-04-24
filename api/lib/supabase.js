import { createClient } from '@supabase/supabase-js'

let adminClient = null

export function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  console.log('[Supabase Config]:', { url, keyLength: key.length })
  if (!url || !key) {
    throw new Error('Supabase is not configured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing')
  }
  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return adminClient
}

export function isSupabaseConfigured() {
  return Boolean((process.env.SUPABASE_URL || '').trim() && (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim())
}
