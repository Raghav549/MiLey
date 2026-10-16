/**
 * MiLey Platform - Supabase & Domain Configuration
 * Official Domain: https://mileymusic.space
 */

import { createClient } from '@supabase/supabase-js'

export const APP_DOMAIN = 'https://mileymusic.space'
export const MILEY_HOST = 'mileymusic.space'

export function getAppUrl(path = '') {
  const base = (import.meta.env.VITE_APP_URL || APP_DOMAIN).replace(/\/+$/, '')
  if (!path) return base
  return `${base}${path.startsWith('/') ? path : '/' + path}`
}

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

// Detect whether real Supabase credentials have been provided
export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawKey &&
  rawUrl.startsWith('http') &&
  !rawUrl.includes('your-project.supabase.co') &&
  !rawUrl.includes('your-production.supabase.co') &&
  !rawUrl.includes('xxxxx.supabase.co') &&
  rawKey !== 'your-anon-key' &&
  rawKey !== 'your-anon-key-here' &&
  rawKey !== 'production-anon-key'
)

const supabaseUrl = isSupabaseConfigured ? rawUrl : 'https://placeholder.mileymusic.space'
const supabaseAnonKey = isSupabaseConfigured ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJtaWxleW11c2ljLnNwYWNlIiwicm9sZSI6ImFub24ifQ.placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: isSupabaseConfigured,
    persistSession: isSupabaseConfigured,
    detectSessionInUrl: isSupabaseConfigured,
    flowType: 'pkce',
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export async function getSession() {
  if (!isSupabaseConfigured) return null
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  return session
}

export async function getUser() {
  if (!isSupabaseConfigured) return null
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured) {
    return { data: { subscription: { unsubscribe: () => {} } } }
  }
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
}

export default supabase
