import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Users, Radio, Check, UserPlus } from 'lucide-react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { useFollows } from '../hooks/useFollows'
import { fallbackCover } from '../musicHelpers'

/**
 * Modal showing either Followers (who follows targetId) or Following (who targetId follows)
 * with live Follow / Unfollow actions and Channel vs Artist routing.
 */
export default function FollowListModal({ open, onClose, targetId, mode = 'followers', title }) {
  const navigate = useNavigate()
  const me = auth.getCurrentUser()
  const { allFollows, isFollowing, toggleFollow } = useFollows()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !targetId) return
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const profiles = await db.selectShared('profiles', {}, { limit: 300 }).catch(() => [])
        const channels = await db.selectShared('channels', {}, { limit: 200 }).catch(() => [])
        const pMap = new Map(profiles.map((p) => [p.userId || p.id, p]))
        const cByOwner = new Map(channels.map((c) => [c.ownerId, c]))

        if (mode === 'followers') {
          const rows = allFollows.filter((f) => f.targetId === targetId)
          const list = rows.map((r) => {
            const p = pMap.get(r.followerId)
            const ch = cByOwner.get(r.followerId)
            return {
              id: r.followerId,
              name: p?.displayName || r.followerName || ch?.name || 'MiLey Listener',
              avatar: p?.avatarUrl || r.followerAvatar || ch?.avatarUrl || '',
              username: ch?.username || p?.customUsername || '',
              type: ch ? 'channel' : 'artist',
            }
          })
          if (alive) setItems(list)
        } else {
          const rows = allFollows.filter((f) => f.followerId === targetId)
          const list = rows.map((r) => {
            const p = pMap.get(r.targetId)
            const ch = cByOwner.get(r.targetId)
            const isCh = r.targetType === 'channel' || Boolean(ch && r.targetUsername)
            return {
              id: r.targetId,
              name: r.targetName || ch?.name || p?.displayName || 'MiLey Artist',
              avatar: r.targetAvatar || ch?.avatarUrl || p?.avatarUrl || '',
              username: r.targetUsername || ch?.username || p?.customUsername || '',
              type: isCh ? 'channel' : 'artist',
            }
          })
          if (alive) setItems(list)
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [open, targetId, mode, allFollows])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-bg-secondary border border-white/15 p-5 max-h-[75vh] flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent-primary" />
            <h3 className="text-base font-bold capitalize" style={{ fontFamily: 'var(--font-display)' }}>
              {title || mode} ({items.length})
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/5 text-text-secondary hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {loading ? (
            <p className="text-xs text-text-secondary text-center py-8">Loading...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-8 space-y-1">
              <p className="text-xs text-text-secondary">
                {mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
              </p>
            </div>
          ) : (
            items.map((u) => {
              const following = isFollowing(u.id)
              const isMe = me?.id === u.id
              return (
                <div
                  key={`${u.id}-${u.type}`}
                  className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/5 border border-white/5 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      if (u.type === 'channel' && u.username) {
                        navigate(`/channel/${u.username}`)
                      } else {
                        navigate(`/artist/${u.id}`)
                      }
                    }}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div
                      className="w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-black"
                      style={{ background: fallbackCover(u.name) }}
                    >
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        (u.name || 'U')[0].toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate">{u.name}</p>
                        {u.type === 'channel' && (
                          <span className="px-1.5 py-0.5 rounded-full bg-accent-primary/15 text-accent-primary text-[9px] font-mono inline-flex items-center gap-0.5 shrink-0">
                            <Radio className="w-2.5 h-2.5" /> Channel
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-secondary truncate">
                        {u.username ? `@${u.username}` : 'MiLey Creator'}
                      </p>
                    </div>
                  </button>

                  {!isMe && (
                    <button
                      type="button"
                      onClick={() =>
                        toggleFollow(u.id, {
                          targetType: u.type,
                          targetName: u.name,
                          targetAvatar: u.avatar,
                          targetUsername: u.username,
                        })
                      }
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold shrink-0 flex items-center gap-1 transition-all ${
                        following
                          ? 'bg-white/10 text-white border border-white/15 hover:bg-red-500/20 hover:text-red-300'
                          : 'bg-accent-primary text-[#0B0B0B]'
                      }`}
                    >
                      {following ? (
                        <>
                          <Check className="w-3 h-3" /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" /> Follow
                        </>
                      )}
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
