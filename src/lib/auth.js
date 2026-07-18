/**
 * MiLey Platform - Authentication Module
 * Real Supabase Auth implementation with Email, Google, Apple, Phone OTP support
 */

import { supabase, getSession, getUser, onAuthStateChange } from './supabaseClient'

// Cache for current user
let currentUserCache = null
let authListeners = []

// Initialize auth state listener
onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    currentUserCache = session?.user || null
  } else if (event === 'SIGNED_OUT') {
    currentUserCache = null
  }
  // Notify all listeners
  authListeners.forEach(listener => listener(currentUserCache))
})

// Check if user is authenticated
export function isAuthenticated() {
  return !!currentUserCache
}

// Get current user (sync, from cache)
export function getCurrentUser() {
  return currentUserCache
}

// Get current user (async, fresh from server)
export async function getCurrentUserAsync() {
  try {
    const user = await getUser()
    currentUserCache = user
    return user
  } catch {
    currentUserCache = null
    return null
  }
}

// Sign in with email/password or magic link
export async function signIn(options = {}) {
  const { email, password, phone } = options
  
  try {
    if (email && password) {
      // Email/password sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      currentUserCache = data.user
      return { user: data.user, session: data.session }
    } else if (email) {
      // Magic link / OTP
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
      })
      if (error) throw error
      return { message: 'Check your email for the login link' }
    } else if (phone) {
      // Phone OTP
      const { data, error } = await supabase.auth.signInWithOtp({
        phone,
      })
      if (error) throw error
      return { message: 'Check your phone for the OTP code' }
    }
    
    // Default: trigger OAuth flow (Google)
    return await signInWithGoogle()
  } catch (error) {
    console.error('Sign in error:', error)
    throw error
  }
}

// Sign in with Google
export async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (error) throw error
    return { url: data.url }
  } catch (error) {
    console.error('Google sign in error:', error)
    throw error
  }
}

// Sign in with Apple
export async function signInWithApple() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    return { url: data.url }
  } catch (error) {
    console.error('Apple sign in error:', error)
    throw error
  }
}

// Sign up with email/password
export async function signUp(options = {}) {
  const { email, password, displayName } = options
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    currentUserCache = data.user
    return { user: data.user, session: data.session }
  } catch (error) {
    console.error('Sign up error:', error)
    throw error
  }
}

// Verify OTP code
export async function verifyOtp(params) {
  try {
    const { data, error } = await supabase.auth.verifyOtp(params)
    if (error) throw error
    currentUserCache = data.user
    return { user: data.user, session: data.session }
  } catch (error) {
    console.error('OTP verification error:', error)
    throw error
  }
}

// Sign out
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    currentUserCache = null
    authListeners.forEach(listener => listener(null))
  } catch (error) {
    console.error('Sign out error:', error)
    throw error
  }
}

// Reset password
export async function resetPassword(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) throw error
    return { message: 'Check your email for the password reset link' }
  } catch (error) {
    console.error('Password reset error:', error)
    throw error
  }
}

// Update password
export async function updatePassword(newPassword) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (error) throw error
    currentUserCache = data.user
    return { user: data.user }
  } catch (error) {
    console.error('Password update error:', error)
    throw error
  }
}

// Update user profile
export async function updateUserProfile(updates) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      data: updates,
    })
    if (error) throw error
    currentUserCache = data.user
    return { user: data.user }
  } catch (error) {
    console.error('Profile update error:', error)
    throw error
  }
}

// Subscribe to auth changes
export function onAuthChange(callback) {
  authListeners.push(callback)
  // Immediately call with current state
  callback(currentUserCache)
  
  // Return unsubscribe function
  return () => {
    authListeners = authListeners.filter(l => l !== callback)
  }
}

// Check if current user is app owner
export function isAppOwner() {
  const adminUids = (import.meta.env.VITE_ADMIN_UIDS || '').split(',').filter(Boolean)
  return currentUserCache && adminUids.includes(currentUserCache.id)
}

// Get auth token
export async function getAuthToken() {
  const session = await getSession()
  return session?.access_token || null
}

// Refresh session
export async function refreshSession() {
  try {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) throw error
    currentUserCache = data.user
    return { user: data.user, session: data.session }
  } catch (error) {
    console.error('Session refresh error:', error)
    throw error
  }
}

// Adopt existing session (for migration)
export function adoptSession(session) {
  currentUserCache = session?.user || null
}
