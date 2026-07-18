/**
 * MiLey Platform - User Module
 * Real Supabase user utilities and helpers
 */

import { auth } from './auth'
import { supabase } from './supabaseClient'
import { social } from './social'

// Get current app user ID (from auth)
export function getAppUserId() {
  const user = auth.getCurrentUser()
  return user?.id || null
}

// Get anonymous ID (for pre-auth tracking)
export function getAnonymousId() {
  let anonId = localStorage.getItem('miley_anon_id')
  if (!anonId) {
    anonId = crypto.randomUUID()
    localStorage.setItem('miley_anon_id', anonId)
  }
  return anonId
}

// Get current user's full profile
export async function getCurrentUserProfile() {
  const userId = getAppUserId()
  if (!userId) return null
  
  try {
    const profile = await social.getUserProfile(userId)
    return profile
  } catch (error) {
    console.error('Get current user profile error:', error)
    return null
  }
}

// Update current user's profile
export async function updateCurrentUserProfile(updates) {
  const userId = getAppUserId()
  if (!userId) throw new Error('Not authenticated')
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Update profile error:', error)
    throw error
  }
}

// Get user's follower count
export async function getUserFollowerCount(userId) {
  return social.getFollowersCount(userId)
}

// Get user's following count
export async function getUserFollowingCount(userId) {
  return social.getFollowingCount(userId)
}

// Check if current user follows another user
export async function checkIfFollowing(targetId) {
  const currentUserId = getAppUserId()
  if (!currentUserId) return false
  
  return social.isFollowing(currentUserId, targetId)
}

// Toggle follow status
export async function toggleFollow(targetId) {
  const isFollowing = await checkIfFollowing(targetId)
  
  if (isFollowing) {
    await social.unfollowUser(targetId)
    return false
  } else {
    await social.followUser(targetId)
    return true
  }
}

// Get user's tracks
export async function getUserTracks(userId, options = {}) {
  try {
    let query = supabase
      .from('tracks')
      .select('*')
      .eq('artist_id', userId)
      .eq('visibility', 'public')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
    
    if (options.limit) {
      query = query.limit(options.limit)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Get user tracks error:', error)
    return []
  }
}

// Get user's playlists
export async function getUserPlaylists(userId, options = {}) {
  try {
    let query = supabase
      .from('playlists')
      .select('*')
      .eq('owner_id', userId)
      .neq('visibility', 'private')
      .order('created_at', { ascending: false })
    
    if (options.limit) {
      query = query.limit(options.limit)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Get user playlists error:', error)
    return []
  }
}

// Get user's liked tracks count
export async function getUserLikedTracksCount(userId) {
  try {
    const { count, error } = await supabase
      .from('liked_tracks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    
    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Get liked tracks count error:', error)
    return 0
  }
}

// Verify user session
export async function verifySession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) throw error
    return !!session
  } catch (error) {
    console.error('Verify session error:', error)
    return false
  }
}

// Refresh user session
export async function refreshUserSession() {
  return auth.refreshSession()
}

// Sign out current user
export async function signOutCurrentUser() {
  return auth.signOut()
}

export const user = {
  getAppUserId,
  getAnonymousId,
  getCurrentUserProfile,
  updateCurrentUserProfile,
  getUserFollowerCount,
  getUserFollowingCount,
  checkIfFollowing,
  toggleFollow,
  getUserTracks,
  getUserPlaylists,
  getUserLikedTracksCount,
  verifySession,
  refreshUserSession,
  signOutCurrentUser,
}

export default user
