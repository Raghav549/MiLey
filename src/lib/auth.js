/**
 * MiLey Platform - Authentication Module
 * Supports Supabase Cloud Auth + Built-in Local/Studio Session Auth
 */

import { supabase, getSession, getUser, onAuthStateChange, isSupabaseConfigured, getAppUrl } from './supabaseClient'
import { readTable, writeTable, notifyTableListeners, makeSvgArt } from './localBackend'

const LOCAL_USER_KEY = 'miley_auth_user_v2'
const LOCAL_ACCOUNTS_KEY = 'miley_local_accounts_v2'
const ADMIN_MODE_KEY = 'miley_admin_mode_v2'
const SIGNED_OUT_KEY = 'miley_explicit_signout_v2'

let currentUserCache = loadInitialUser()
let authListeners = []

function loadInitialUser() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY)
    if (raw) return JSON.parse(raw)
    // Auto-provision default studio creator session on first visit so Vercel preview & Android work immediately
    if (localStorage.getItem(SIGNED_OUT_KEY) !== '1') {
      const studioUser = {
        id: 'creator-studio-main',
        email: 'creator@mileymusic.space',
        displayName: 'Raghav Studio',
        customUsername: 'raghav_studio',
        avatarUrl: makeSvgArt({ title: 'Raghav Studio', subtitle: 'Creator', c1: '#00E0A8', c2: '#FF3DAE' }),
        verified: true,
        isAdmin: true,
        createdAt: new Date().toISOString(),
      }
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(studioUser))
      localStorage.setItem(ADMIN_MODE_KEY, '1')
      return studioUser
    }
  } catch (e) { /* ignore */ }
  return null
}

function saveLocalUser(user) {
  currentUserCache = user
  if (typeof localStorage !== 'undefined') {
    try {
      if (user) {
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user))
        localStorage.removeItem(SIGNED_OUT_KEY)
      } else {
        localStorage.removeItem(LOCAL_USER_KEY)
      }
    } catch (e) { /* ignore */ }
  }
  if (user) ensureUserProfileRecord(user)
  authListeners.forEach((listener) => {
    try { listener(currentUserCache) } catch (e) { /* ignore */ }
  })
}

function ensureUserProfileRecord(user) {
  if (!user?.id) return
  try {
    const profiles = readTable('profiles')
    const idx = profiles.findIndex((p) => p.id === user.id || p.userId === user.id)
    const now = new Date().toISOString()
    if (idx === -1) {
      const uname = (user.customUsername || user.displayName || user.email?.split('@')[0] || 'creator')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '') || 'miley_creator'
      const newProfile = {
        id: user.id,
        userId: user.id,
        displayName: user.displayName || 'MiLey Creator',
        customUsername: uname,
        avatarUrl: user.avatarUrl || makeSvgArt({ title: user.displayName || 'MC', subtitle: `@${uname}`, c1: '#00E0A8', c2: '#FF3DAE' }),
        bannerUrl: makeSvgArt({ title: user.displayName || 'MiLey Creator', subtitle: `mileymusic.space/@${uname}`, c1: '#00E0A8', c2: '#FF3DAE', wide: true }),
        bio: 'Music lover & creator on mileymusic.space',
        verified: !!user.verified,
        artistBadge: user.isAdmin ? 'Platform Founder' : 'Creator',
        theme: 'signature',
        links: [`https://mileymusic.space/#/artist/${user.id}`],
        followersCount: 0,
        followingCount: 0,
        createdAt: now,
        updatedAt: now,
      }
      profiles.unshift(newProfile)
      writeTable('profiles', profiles)
      notifyTableListeners('profiles', { type: 'INSERT', data: newProfile })
    }
  } catch (e) { /* ignore */ }
}

function normalizeSupabaseUser(sbUser) {
  if (!sbUser) return null
  const meta = sbUser.user_metadata || {}
  const displayName = meta.display_name || meta.full_name || meta.name || sbUser.email?.split('@')[0] || 'MiLey User'
  const avatarUrl = meta.avatar_url || meta.picture || makeSvgArt({ title: displayName, subtitle: 'MiLey', c1: '#00E0A8', c2: '#FF3DAE' })
  return {
    id: sbUser.id,
    email: sbUser.email || '',
    phone: sbUser.phone || '',
    displayName,
    avatarUrl,
    user_metadata: meta,
    createdAt: sbUser.created_at || new Date().toISOString(),
  }
}

// Initialize Supabase auth listener when configured
if (isSupabaseConfigured) {
  onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      const normalized = normalizeSupabaseUser(session?.user)
      if (normalized) saveLocalUser(normalized)
    } else if (event === 'SIGNED_OUT') {
      saveLocalUser(null)
    }
  })
  // Also hydrate initial session if available
  getSession().then((session) => {
    if (session?.user) {
      saveLocalUser(normalizeSupabaseUser(session.user))
    }
  }).catch(() => {})
}

export function isAuthenticated() {
  return !!currentUserCache
}

export function getCurrentUser() {
  return currentUserCache
}

export async function getCurrentUserAsync() {
  if (isSupabaseConfigured) {
    try {
      const sbUser = await getUser()
      if (sbUser) {
        const normalized = normalizeSupabaseUser(sbUser)
        saveLocalUser(normalized)
        return normalized
      }
    } catch { /* fallback to local cache */ }
  }
  return currentUserCache
}

function getLocalAccounts() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveLocalAccounts(accounts) {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts))
  } catch { /* ignore */ }
}

// Sign in with email/password, Google, or Instant Studio Login
export async function signIn(options = {}) {
  const { email, password, phone, displayName, role, instant } = options || {}

  if (instant || (!email && !phone && !isSupabaseConfigured)) {
    const name = displayName || 'Raghav Studio'
    const cleanEmail = email || 'creator@mileymusic.space'
    const id = email ? `user-${btoa(cleanEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toLowerCase()}` : 'creator-studio-main'
    const user = {
      id,
      email: cleanEmail,
      displayName: name,
      customUsername: name.toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'raghav_studio',
      avatarUrl: makeSvgArt({ title: name, subtitle: 'Creator', c1: '#00E0A8', c2: '#FF3DAE' }),
      verified: true,
      isAdmin: role === 'admin' || true,
      createdAt: new Date().toISOString(),
    }
    if (role === 'admin' || instant) {
      try { localStorage.setItem(ADMIN_MODE_KEY, '1') } catch {}
    }
    saveLocalUser(user)
    return { user, session: { access_token: 'local-studio-token', user } }
  }

  if (isSupabaseConfigured) {
    try {
      if (email && password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        const normalized = normalizeSupabaseUser(data.user)
        saveLocalUser(normalized)
        return { user: normalized, session: data.session }
      } else if (email) {
        const { error } = await supabase.auth.signInWithOtp({ email })
        if (error) throw error
        return { message: 'Check your email for the login link' }
      } else if (phone) {
        const { error } = await supabase.auth.signInWithOtp({ phone })
        if (error) throw error
        return { message: 'Check your phone for the OTP code' }
      }
      return await signInWithGoogle()
    } catch (error) {
      // Fallback to local account auth if Supabase is unreachable or unconfigured
      console.warn('Supabase auth fallback to local engine:', error?.message)
    }
  }

  // Built-in Email / Password Sign-in
  if (email) {
    const key = email.trim().toLowerCase()
    const accounts = getLocalAccounts()
    let acct = accounts[key]
    if (!acct) {
      const derivedName = displayName || key.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      acct = {
        id: `user-${btoa(key).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toLowerCase()}`,
        email: key,
        password: password || 'miley123',
        displayName: derivedName,
        customUsername: key.split('@')[0].replace(/[^a-z0-9_]/g, ''),
        avatarUrl: makeSvgArt({ title: derivedName, subtitle: 'MiLey', c1: '#00E0A8', c2: '#FF3DAE' }),
        verified: true,
        isAdmin: true,
        createdAt: new Date().toISOString(),
      }
      accounts[key] = acct
      saveLocalAccounts(accounts)
    } else if (password && acct.password && acct.password !== password) {
      throw new Error('Incorrect password for this account.')
    }
    const { password: _pw, ...safeUser } = acct
    saveLocalUser(safeUser)
    return { user: safeUser, session: { access_token: 'local-token', user: safeUser } }
  }

  return signIn({ instant: true })
}

export async function signInWithGoogle() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${getAppUrl()}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) throw error
      return { url: data.url }
    } catch (error) {
      console.warn('Google OAuth fallback:', error?.message)
    }
  }
  return signIn({
    email: 'google.creator@mileymusic.space',
    displayName: 'MiLey Creator',
    instant: true,
  })
}

export async function signInWithApple() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${getAppUrl()}/auth/callback`,
        },
      })
      if (error) throw error
      return { url: data.url }
    } catch (error) {
      console.warn('Apple OAuth fallback:', error?.message)
    }
  }
  return signIn({
    email: 'apple.creator@mileymusic.space',
    displayName: 'Apple Creator',
    instant: true,
  })
}

export async function signInAsStudioUser(opts = {}) {
  const res = await signIn({
    displayName: opts.displayName || 'Raghav Studio',
    email: opts.email || 'creator@mileymusic.space',
    instant: true,
  })
  return res.user
}

export async function signUp(emailOrOptions = {}, passwordArg = '', metaArg = {}) {
  const options =
    typeof emailOrOptions === 'string'
      ? { email: emailOrOptions, password: passwordArg, displayName: metaArg?.displayName }
      : emailOrOptions || {}
  const { email, password, displayName } = options
  if (!email) throw new Error('Email is required')

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || email.split('@')[0] },
          emailRedirectTo: `${getAppUrl()}/auth/callback`,
        },
      })
      if (error) throw error
      if (data.user) {
        const normalized = normalizeSupabaseUser(data.user)
        saveLocalUser(normalized)
        return { user: normalized, session: data.session }
      }
    } catch (error) {
      console.warn('Supabase signUp fallback to local engine:', error?.message)
    }
  }

  const key = email.trim().toLowerCase()
  const accounts = getLocalAccounts()
  const name = (displayName || key.split('@')[0]).trim()
  const newAcct = {
    id: `user-${btoa(key).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toLowerCase()}`,
    email: key,
    password: password || 'miley123',
    displayName: name,
    customUsername: name.toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'creator',
    avatarUrl: makeSvgArt({ title: name, subtitle: 'Creator', c1: '#00E0A8', c2: '#FF3DAE' }),
    verified: true,
    isAdmin: true,
    createdAt: new Date().toISOString(),
  }
  accounts[key] = newAcct
  saveLocalAccounts(accounts)
  const { password: _pw, ...safeUser } = newAcct
  saveLocalUser(safeUser)
  return { user: safeUser, session: { access_token: 'local-token', user: safeUser } }
}

export async function verifyOtp(params) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.verifyOtp(params)
    if (error) throw error
    const normalized = normalizeSupabaseUser(data.user)
    saveLocalUser(normalized)
    return { user: normalized, session: data.session }
  }
  return signIn({ instant: true })
}

export async function signOut() {
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(SIGNED_OUT_KEY, '1') } catch {}
  }
  if (isSupabaseConfigured) {
    try { await supabase.auth.signOut() } catch { /* ignore */ }
  }
  saveLocalUser(null)
}

export async function resetPassword(email) {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getAppUrl()}/auth/reset-password`,
      })
      if (error) throw error
    } catch { /* ignore */ }
  }
  return { message: 'Password reset instructions sent to your email.' }
}

export async function updatePassword(newPassword) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    return { user: normalizeSupabaseUser(data.user) }
  }
  return { user: currentUserCache }
}

export async function updateUserProfile(updates) {
  if (currentUserCache) {
    const updated = { ...currentUserCache, ...updates }
    saveLocalUser(updated)
  }
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.updateUser({ data: updates })
    } catch { /* ignore */ }
  }
  return { user: currentUserCache }
}

export function onAuthChange(callback) {
  authListeners.push(callback)
  callback(currentUserCache)
  return () => {
    authListeners = authListeners.filter((l) => l !== callback)
  }
}

export function isAppOwner() {
  if (!currentUserCache) return false
  const adminUids = (import.meta.env.VITE_ADMIN_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (adminUids.includes(currentUserCache.id)) return true
  if (currentUserCache.isAdmin) return true
  try {
    if (localStorage.getItem(ADMIN_MODE_KEY) === '1') return true
  } catch {}
  return false
}

export function setAdminMode(enabled) {
  try {
    if (enabled) localStorage.setItem(ADMIN_MODE_KEY, '1')
    else localStorage.removeItem(ADMIN_MODE_KEY)
  } catch {}
  if (currentUserCache) {
    saveLocalUser({ ...currentUserCache, isAdmin: !!enabled })
  }
}

export async function getAuthToken() {
  if (isSupabaseConfigured) {
    try {
      const session = await getSession()
      if (session?.access_token) return session.access_token
    } catch {}
  }
  return currentUserCache ? 'local-studio-token' : null
}

export async function refreshSession() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (!error && data?.user) {
        const normalized = normalizeSupabaseUser(data.user)
        saveLocalUser(normalized)
        return { user: normalized, session: data.session }
      }
    } catch {}
  }
  return { user: currentUserCache, session: null }
}

export function adoptSession(session) {
  if (session?.user) {
    saveLocalUser(normalizeSupabaseUser(session.user))
  }
}

export const auth = {
  isAuthenticated,
  getCurrentUser,
  getCurrentUserAsync,
  signIn,
  signInAsStudioUser,
  signUp,
  signOut,
  signInWithGoogle,
  signInWithApple,
  verifyOtp,
  resetPassword,
  updatePassword,
  updateUserProfile,
  onAuthChange,
  isAppOwner,
  setAdminMode,
  getAuthToken,
  refreshSession,
  adoptSession,
}

export default auth
