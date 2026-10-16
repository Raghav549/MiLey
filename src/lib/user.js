/**
 * MiLey Platform - User Module
 */

import { auth } from './auth'
import { db } from './db'
import { social } from './social'

export function getAppUserId() {
  const u = auth.getCurrentUser()
  return u?.id || null
}

export function getAnonymousId() {
  let anonId = localStorage.getItem('miley_anon_id')
  if (!anonId) {
    anonId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `anon-${Date.now()}`
    localStorage.setItem('miley_anon_id', anonId)
  }
  return anonId
}

export async function getCurrentUserProfile() {
  const userId = getAppUserId()
  if (!userId) return null
  return social.getUserProfile(userId)
}

export async function updateCurrentUserProfile(updates) {
  const userId = getAppUserId()
  if (!userId) throw new Error('Not authenticated')
  return db.upsertShared('profiles', { ...updates, userId }, userId)
}

export async function getUserFollowerCount(userId) {
  return social.getFollowersCount(userId)
}

export async function getUserFollowingCount(userId) {
  return social.getFollowingCount(userId)
}

export async function checkIfFollowing(targetId) {
  const currentUserId = getAppUserId()
  if (!currentUserId) return false
  return social.isFollowing(currentUserId, targetId)
}

export async function toggleFollow(targetId) {
  const isF = await checkIfFollowing(targetId)
  if (isF) {
    await social.unfollowUser(targetId)
    return false
  } else {
    await social.followUser(targetId)
    return true
  }
}

export async function getUserTracks(userId, options = {}) {
  return db.selectShared('tracks', { artistId: userId }, { order: '-createdAt', limit: options.limit || 100 })
}

export async function getUserPlaylists(userId, options = {}) {
  return db.selectShared('playlists', { ownerId: userId }, { order: '-createdAt', limit: options.limit || 100 })
}

export async function getUserLikedTracksCount() {
  const rows = await db.select('likedTracks', {}, { limit: 500 })
  return rows.length
}

export async function verifySession() {
  return auth.isAuthenticated()
}

export async function refreshUserSession() {
  return auth.refreshSession()
}

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
