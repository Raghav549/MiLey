import { useCallback, useEffect, useState } from 'react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'

const followListeners = new Set()
function notifyFollowListeners() {
  followListeners.forEach((fn) => {
    try { fn() } catch (e) { /* ignore */ }
  })
}

export function useFollows() {
  const [followingRows, setFollowingRows] = useState([])
  const [followingIds, setFollowingIds] = useState(new Set())
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const user = auth.getCurrentUser()
    if (!user) {
      setFollowingRows([])
      setFollowingIds(new Set())
      setLoaded(true)
      return
    }
    try {
      const rows = await db.selectShared('follows', { followerId: user.id }, { limit: 500 })
      const list = Array.isArray(rows) ? rows : []
      setFollowingRows(list)
      setFollowingIds(new Set(list.map((r) => r.targetId || r.target_id).filter(Boolean)))
    } catch (e) { /* ignore */ }
    setLoaded(true)
  }, [])

  useEffect(() => {
    refresh()
    followListeners.add(refresh)
    const unsubAuth = auth.onAuthChange(() => refresh())
    return () => {
      followListeners.delete(refresh)
      unsubAuth?.()
    }
  }, [refresh])

  const isFollowing = useCallback((targetId) => followingIds.has(targetId), [followingIds])

  const toggleFollow = useCallback(async (targetId, targetType = 'artist', targetName = 'MiLey Artist', targetAvatar = '', targetUsername = '') => {
    if (!targetId) return false
    if (!auth.isAuthenticated()) {
      await auth.signIn()
      if (!auth.isAuthenticated()) return false
    }
    const user = auth.getCurrentUser()
    if (!user || user.id === targetId) return false

    const id = `${user.id}:${targetId}`
    const already = followingIds.has(targetId)

    setFollowingIds((prev) => {
      const next = new Set(prev)
      if (already) next.delete(targetId)
      else next.add(targetId)
      return next
    })

    try {
      if (already) {
        const existing = followingRows.find((r) => (r.targetId || r.target_id) === targetId)
        await db.deleteShared('follows', existing?.id || id)
      } else {
        await db.insertShared('follows', {
          followerId: user.id,
          targetId,
          targetType: targetType || 'artist',
          targetName: targetName || 'MiLey user',
          targetAvatar: targetAvatar || '',
          targetUsername: targetUsername || null,
          followerName: user.displayName || 'MiLey user',
          followerAvatar: user.avatarUrl || '',
        }, id, { visibleTo: 'public' })
      }
      await refresh()
      notifyFollowListeners()
      return !already
    } catch (e) {
      await refresh()
      return already
    }
  }, [followingIds, followingRows, refresh])

  return { isFollowing, toggleFollow, followingRows, followingIds, loaded, refresh }
}

export async function followerCount(targetId) {
  if (!targetId) return 0
  try {
    const rows = await db.selectShared('follows', { targetId }, { limit: 500 })
    return Array.isArray(rows) ? rows.length : 0
  } catch (e) {
    return 0
  }
}

export async function followingCount(userId) {
  if (!userId) return 0
  try {
    const rows = await db.selectShared('follows', { followerId: userId }, { limit: 500 })
    return Array.isArray(rows) ? rows.length : 0
  } catch (e) {
    return 0
  }
}

// Full clickable list of who follows `targetId`.
export async function getFollowersList(targetId) {
  try {
    const rows = await db.selectShared('follows', { targetId }, { limit: 500 })
    return (rows || []).map((r) => ({
      id: r.followerId || r.follower_id,
      name: r.followerName || r.follower_name || 'MiLey user',
      avatarUrl: r.followerAvatar || r.follower_avatar || '',
      kind: 'user',
    }))
  } catch (e) { return [] }
}

// Full clickable list of who/what `userId` follows.
export async function getFollowingList(userId) {
  try {
    const rows = await db.selectShared('follows', { followerId: userId }, { limit: 500 })
    return (rows || []).map((r) => ({
      id: r.targetId || r.target_id,
      name: r.targetName || r.target_name || 'MiLey user',
      avatarUrl: r.targetAvatar || r.target_avatar || '',
      kind: r.targetType || r.target_type || 'user',
      username: r.targetUsername || r.target_username || '',
    }))
  } catch (e) { return [] }
}
