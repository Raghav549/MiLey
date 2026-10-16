import { useCallback, useMemo } from 'react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { useLiveShared } from '../lib/useLive'
import { notifyUser } from './useNotifications'

export function useFollows() {
  const user = auth.getCurrentUser()
  const { data: allFollows = [] } = useLiveShared('follows', { order: '-createdAt', limit: 1000 })

  const myFollows = useMemo(() => {
    if (!user?.id) return []
    return allFollows.filter((r) => r.followerId === user.id)
  }, [allFollows, user?.id])

  const followingIds = useMemo(() => {
    return new Set(myFollows.map((r) => r.targetId).filter(Boolean))
  }, [myFollows])

  const isFollowing = useCallback(
    (targetId) => Boolean(targetId && followingIds.has(targetId)),
    [followingIds]
  )

  const getFollowersOf = useCallback(
    (targetId) => {
      if (!targetId) return []
      return allFollows.filter((r) => r.targetId === targetId)
    },
    [allFollows]
  )

  const getFollowingOf = useCallback(
    (userId) => {
      if (!userId) return []
      return allFollows.filter((r) => r.followerId === userId)
    },
    [allFollows]
  )

  const getFollowerCount = useCallback(
    (targetId) => getFollowersOf(targetId).length,
    [getFollowersOf]
  )

  const getFollowingCount = useCallback(
    (userId) => getFollowingOf(userId).length,
    [getFollowingOf]
  )

  const toggleFollow = useCallback(
    async (targetId, meta = {}) => {
      const currentUser = auth.getCurrentUser()
      if (!currentUser?.id || !targetId || targetId === currentUser.id) return false
      const key = `${currentUser.id}:${targetId}`
      const currently = followingIds.has(targetId)

      if (currently) {
        await db.deleteShared('follows', key).catch(() => {})
        // Also delete any duplicate record matching followerId + targetId
        const existing = allFollows.filter(
          (r) => r.followerId === currentUser.id && r.targetId === targetId
        )
        for (const row of existing) {
          if (row.id && row.id !== key) {
            await db.deleteShared('follows', row.id).catch(() => {})
          }
        }
        return false
      } else {
        const myProf = await db.getShared('profiles', currentUser.id).catch(() => null)
        const targetProf = await db.getShared('profiles', targetId).catch(() => null)
        await db
          .upsertShared(
            'follows',
            {
              followerId: currentUser.id,
              followerName: myProf?.displayName || currentUser.displayName || 'MiLey Creator',
              followerAvatar: myProf?.avatarUrl || currentUser.avatarUrl || '',
              targetId,
              targetType: meta.targetType || 'artist',
              targetName: meta.targetName || targetProf?.displayName || 'MiLey Artist',
              targetAvatar: meta.targetAvatar || targetProf?.avatarUrl || '',
              targetUsername: meta.targetUsername || targetProf?.customUsername || '',
            },
            key,
            { visibleTo: 'public' }
          )
          .catch(() => {})

        notifyUser({
          recipientId: targetId,
          type: 'follow',
          title: `${myProf?.displayName || currentUser.displayName || 'Someone'} started following you`,
          body: meta.targetType === 'channel' ? `Subscribed to @${meta.targetUsername || meta.targetName || 'your channel'}` : 'Tap to view their profile',
          link: `/artist/${currentUser.id}`,
        })
        return true
      }
    },
    [followingIds, allFollows]
  )

  return {
    followingIds,
    followingList: myFollows,
    allFollows,
    isFollowing,
    getFollowersOf,
    getFollowingOf,
    getFollowerCount,
    getFollowingCount,
    toggleFollow,
  }
}
