import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, ListMusic, Clock, Users, Plus, Trash2, Play, Radio, Check } from 'lucide-react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { useLive, useLiveShared } from '../lib/useLive'
import { usePlayer } from '../context/PlayerContext'
import { useLikes } from '../hooks/useLikes'
import { useFollows } from '../hooks/useFollows'
import { TrackRow } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import { fallbackCover } from '../musicHelpers'

const TABS = [
  { id: 'liked', label: 'Liked', icon: Heart },
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'history', label: 'Recent', icon: Clock },
  { id: 'following', label: 'Following', icon: Users },
]

export default function Library() {
  const navigate = useNavigate()
  const { playTrack } = usePlayer()
  const { likedIds, isLiked, toggleLike } = useLikes()
  const { followingList, toggleFollow } = useFollows()
  const [tab, setTab] = useState('liked')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const { data: allTracks = [] } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })
  const { data: playlists = [] } = useLiveShared('playlists', { order: '-createdAt', limit: 100 })
  const { data: history = [] } = useLive('history', { order: '-playedAt', limit: 50 })

  const user = auth.getCurrentUser()
  const myPlaylists = useMemo(
    () => playlists.filter((p) => p.ownerId === user?.id),
    [playlists, user?.id]
  )

  const likedTracks = useMemo(
    () => allTracks.filter((t) => likedIds.has(t.id)),
    [allTracks, likedIds]
  )

  const historyTracks = useMemo(() => {
    const byId = new Map(allTracks.map((t) => [t.id, t]))
    return history.map((h) => byId.get(h.trackId) || { ...h, id: h.trackId }).filter((t) => t?.audioUrl)
  }, [history, allTracks])

  const createPlaylist = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    await db.insertShared(
      'playlists',
      {
        name,
        title: name,
        ownerId: user?.id,
        ownerName: user?.displayName || 'You',
        trackIds: [],
        coverUrl: '',
        visibility: 'public',
      },
      undefined,
      { visibleTo: 'public' }
    )
    setNewName('')
    setCreating(false)
  }

  const deletePlaylist = async (id, e) => {
    e.stopPropagation()
    await db.deleteShared('playlists', id)
  }

  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Your Library
        </h1>
        {tab === 'playlists' && (
          <button
            onClick={() => setCreating((v) => !v)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-accent-primary text-[#0B0B0B] text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> New Playlist
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1.5 bg-bg-secondary p-1 rounded-2xl border border-white/5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors ${
              tab === id ? 'bg-accent-primary text-[#0B0B0B] font-semibold' : 'text-text-secondary'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'liked' &&
        (likedTracks.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No liked songs yet"
            subtitle="Tap the heart on any track to save it here."
          />
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => playTrack(likedTracks[0], likedTracks)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-accent-primary text-[#0B0B0B] text-xs font-semibold"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Play All ({likedTracks.length})
            </button>
            <div className="space-y-1">
              {likedTracks.map((t, i) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  list={likedTracks}
                  index={i}
                  isLiked={isLiked(t.id)}
                  onToggleLike={toggleLike}
                />
              ))}
            </div>
          </div>
        ))}

      {tab === 'playlists' && (
        <div className="space-y-3">
          {creating && (
            <form
              onSubmit={createPlaylist}
              className="flex gap-2 p-3 rounded-2xl bg-bg-secondary border border-white/10"
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist name (e.g., Late Night Vibes)"
                autoFocus
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-1.5 rounded-full bg-accent-primary text-[#0B0B0B] text-xs font-semibold"
              >
                Create
              </button>
            </form>
          )}
          {myPlaylists.length === 0 ? (
            <EmptyState
              icon={ListMusic}
              title="No playlists yet"
              subtitle="Create custom playlists to organize your favorite tracks."
            />
          ) : (
            <div className="space-y-2">
              {myPlaylists.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/playlist/${p.id}`)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-bg-secondary border border-white/5 hover:border-white/15 cursor-pointer"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: fallbackCover(p.name) }}
                  >
                    <ListMusic className="w-5 h-5 text-black/80" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.name || p.title}</p>
                    <p className="text-xs text-text-secondary">
                      {(p.trackIds || []).length} tracks
                    </p>
                  </div>
                  <button
                    onClick={(e) => deletePlaylist(p.id, e)}
                    className="p-2 text-text-secondary hover:text-red-400"
                    aria-label="Delete playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'history' &&
        (historyTracks.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nothing played recently"
            subtitle="Songs you listen to will show up here."
          />
        ) : (
          <div className="space-y-1">
            {historyTracks.map((t, i) => (
              <TrackRow
                key={`${t.id}-${i}`}
                track={t}
                list={historyTracks}
                index={i}
                isLiked={isLiked(t.id)}
                onToggleLike={toggleLike}
              />
            ))}
          </div>
        ))}

      {tab === 'following' &&
        (followingList.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Not following any artists or channels yet"
            subtitle="Follow artists and subscribe to channels to see their latest releases."
          />
        ) : (
          <div className="space-y-2">
            {followingList.map((f) => {
              const isChannel = f.targetType === 'channel' && f.targetUsername
              return (
                <div
                  key={f.id || f.targetId}
                  onClick={() =>
                    navigate(
                      isChannel ? `/channel/${f.targetUsername}` : `/artist/${f.targetId}`
                    )
                  }
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl bg-bg-secondary border border-white/5 hover:border-white/15 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold text-black"
                      style={{ background: fallbackCover(f.targetName) }}
                    >
                      {f.targetAvatar ? (
                        <img
                          src={f.targetAvatar}
                          alt={f.targetName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (f.targetName || 'A')[0]
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate">
                          {f.targetName || 'Artist'}
                        </p>
                        {isChannel ? (
                          <span className="px-2 py-0.5 rounded-full bg-accent-primary/15 text-accent-primary text-[10px] font-mono inline-flex items-center gap-1">
                            <Radio className="w-2.5 h-2.5" /> Channel
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[10px] font-mono">
                            Artist
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary truncate">
                        {f.targetUsername ? `@${f.targetUsername} · ` : ''}
                        Tap to view {isChannel ? 'channel' : 'artist profile'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFollow(f.targetId, {
                        targetType: f.targetType,
                        targetName: f.targetName,
                        targetAvatar: f.targetAvatar,
                        targetUsername: f.targetUsername,
                      })
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-xs font-semibold text-white border border-white/10 flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5 text-accent-primary" /> Following
                  </button>
                </div>
              )
            })}
          </div>
        ))}
    </div>
  )
}
