import { useCallback, useEffect, useState } from 'react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'

export function useLikes() {
  const [likedIds, setLikedIds] = useState(new Set())
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!auth.isAuthenticated()) { setLoaded(true); return }
    try {
      const rows = await db.select('likedTracks', {}, { limit: 500 })
      setLikedIds(new Set(rows.map((r) => r.id)))
    } catch (e) { /* ignore */ }
    setLoaded(true)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const isLiked = useCallback((trackId) => likedIds.has(trackId), [likedIds])

  const toggleLike = useCallback(async (track) => {
    if (!auth.isAuthenticated()) {
      await auth.signIn()
      if (!auth.isAuthenticated()) return
    }
    const liked = likedIds.has(track.id)
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (liked) next.delete(track.id); else next.add(track.id)
      return next
    })
    try {
      if (liked) {
        await db.delete('likedTracks', track.id)
        await db.incrementShared('tracks', track.id, 'likesCount', -1)
      } else {
        await db.insert('likedTracks', {
          trackId: track.id,
          title: track.title,
          artistName: track.artistName,
          coverUrl: track.coverUrl,
          audioUrl: track.audioUrl,
          duration: track.duration,
          type: track.type,
          artistId: track.artistId,
        }, track.id)
        await db.incrementShared('tracks', track.id, 'likesCount', 1)
      }
    } catch (e) { /* ignore */ }
  }, [likedIds])

  return { isLiked, toggleLike, loaded }
}

export async function getLikedTracks() {
  const rows = await db.select('likedTracks', {}, { limit: 500, order: '-createdAt' })
  return rows.map((r) => ({ ...r, id: r.trackId || r.id }))
}
