import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Radio,
  Plus,
  Users,
  Music,
  Lock,
  Unlock,
  Trash2,
  Flame,
  Sparkles,
  Disc3,
  Headphones,
} from 'lucide-react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { storage } from '../lib/storage'
import { useLiveShared } from '../lib/useLive'
import EmptyState from '../components/EmptyState'
import { ROOM_BACKGROUNDS, roomBgStyle, getSongTheme } from '../musicHelpers'
import { notifyFollowers } from '../hooks/useNotifications'

const ROOM_CATEGORIES = [
  { id: 'all', label: 'All Live' },
  { id: 'Music Party', label: 'Music Party' },
  { id: 'LoFi & Chill', label: 'LoFi & Chill' },
  { id: 'DJ Stage', label: 'DJ Stage' },
  { id: 'Podcast', label: 'Podcast & Talk' },
]

export default function Rooms() {
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const { data: rooms = [] } = useLiveShared('rooms', { order: '-createdAt', limit: 50 })

  const [categoryFilter, setCategoryFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [category, setCategory] = useState('Music Party')
  const [bgTheme, setBgTheme] = useState('neon')
  const [customBgFile, setCustomBgFile] = useState(null)
  const [openDj, setOpenDj] = useState(true)
  const [autoDj, setAutoDj] = useState(true)
  const [isPrivate, setIsPrivate] = useState(false)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filteredRooms = useMemo(() => {
    if (categoryFilter === 'all') return rooms
    return rooms.filter((r) => (r.category || 'Music Party') === categoryFilter)
  }, [rooms, categoryFilter])

  const createRoom = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      let customBgUrl = ''
      let finalTheme = bgTheme
      if (customBgFile) {
        const up = await storage.upload('covers', customBgFile)
        customBgUrl = up.url
        finalTheme = 'custom'
      }
      const room = await db.insertShared(
        'rooms',
        {
          name: name.trim(),
          topic: topic.trim() || 'Vibe & listen together on mileymusic.space',
          category,
          hostId: user?.id,
          hostName: user?.displayName || 'Host',
          hostAvatar: user?.avatarUrl || '',
          bgTheme: finalTheme,
          customBgUrl,
          openDj,
          autoDj,
          syncSongTheme: true,
          vibeScore: 88,
          isPrivate,
          password: isPrivate ? password.trim() : '',
          speakerIds: user?.id ? [user.id] : [],
          raisedHandIds: [],
          queue: [],
          poll: {
            question: 'Which vibe should spin next in this Listen Room?',
            options: [
              { id: 'opt1', text: 'Cyberpunk Synth & Bass', votes: 5 },
              { id: 'opt2', text: 'Bollywood Midnight Lo-Fi', votes: 4 },
              { id: 'opt3', text: 'High-Energy Club Drops', votes: 3 },
            ],
            voters: {},
          },
        },
        undefined,
        { visibleTo: 'public' }
      )
      if (!isPrivate && room?.id) {
        notifyFollowers({
          actorId: user?.id,
          actorName: user?.displayName || 'A creator',
          type: 'live_room',
          title: `🔴 ${user?.displayName || 'A creator'} started a Listen Room`,
          body: name.trim(),
          link: `/rooms/${room.id}`,
        })
      }
      setCreating(false)
      setName('')
      setTopic('')
      setPassword('')
      setCustomBgFile(null)
      if (room?.id) navigate(`/rooms/${room.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteRoom = async (roomId, e) => {
    e.stopPropagation()
    await db.deleteShared('rooms', roomId)
  }

  return (
    <div className="px-4 pt-5 pb-10 max-w-2xl mx-auto space-y-5">
      {/* Hero Header */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-accent-primary/20 via-bg-secondary to-accent-secondary/20 border border-white/10 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-mono uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" /> Live Audio Stages
          </div>
          <h1 className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
            Listen Rooms
          </h1>
          <p className="text-xs text-text-secondary max-w-md">
            Spin tracks in sync with Song Themes, trigger DJ soundboard SFX, vote on live polls,
            and hang out on voice stage.
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-accent-primary to-accent-secondary text-[#0B0B0B] text-xs font-bold shadow-lg shadow-accent-primary/25 shrink-0"
        >
          <Plus className="w-4 h-4" /> Start Room
        </button>
      </div>

      {/* Category Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {ROOM_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoryFilter(cat.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
              categoryFilter === cat.id
                ? 'bg-accent-primary text-[#0B0B0B]'
                : 'bg-bg-secondary text-text-secondary hover:text-white border border-white/5'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Create Listen Room Modal / Drawer */}
      {creating && (
        <form
          onSubmit={createRoom}
          className="p-4 rounded-3xl bg-bg-secondary border border-white/15 space-y-3 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-accent-primary" /> Launch a Live Listen Room
            </h2>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-xs text-text-secondary hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Room name (e.g., Late Night Lo-Fi Lounge)"
              className="sm:col-span-2 px-3.5 py-2.5 rounded-xl bg-bg-primary border border-white/10 text-sm focus:outline-none focus:border-accent-primary"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-bg-primary border border-white/10 text-xs focus:outline-none focus:border-accent-primary"
            >
              {ROOM_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic / vibe description"
            className="w-full px-3.5 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs focus:outline-none focus:border-accent-primary"
          />

          <div>
            <label className="text-xs text-text-secondary block mb-1.5">Room Stage Theme</label>
            <div className="grid grid-cols-3 gap-2">
              {ROOM_BACKGROUNDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBgTheme(b.id)
                    setCustomBgFile(null)
                  }}
                  style={roomBgStyle(b.id)}
                  className={`h-12 rounded-xl text-[11px] font-semibold border transition-transform ${
                    bgTheme === b.id && !customBgFile
                      ? 'border-accent-primary scale-[1.02]'
                      : 'border-white/10'
                  }`}
                >
                  <span className="px-2 py-0.5 rounded bg-black/50 backdrop-blur">{b.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-bg-primary border border-white/10">
              <div>
                <p className="text-xs font-semibold">Open DJ Queue</p>
                <p className="text-[10px] text-text-secondary">
                  Allow any listener to queue &amp; spin tracks
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenDj((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  openDj ? 'bg-accent-primary text-[#0B0B0B]' : 'bg-white/10 text-text-secondary'
                }`}
              >
                {openDj ? 'On' : 'Host Only'}
              </button>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-bg-primary border border-white/10">
              <div>
                <p className="text-xs font-semibold">Auto-DJ Rotation</p>
                <p className="text-[10px] text-text-secondary">
                  Auto-play top upvoted queue songs
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoDj((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  autoDj ? 'bg-accent-primary text-[#0B0B0B]' : 'bg-white/10 text-text-secondary'
                }`}
              >
                {autoDj ? 'Active' : 'Manual'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-bg-primary border border-white/10">
            <div className="flex items-center gap-2">
              {isPrivate ? (
                <Lock className="w-4 h-4 text-accent-secondary" />
              ) : (
                <Unlock className="w-4 h-4 text-accent-primary" />
              )}
              <div>
                <p className="text-xs font-semibold">
                  {isPrivate ? 'Private Room (Password Locked)' : 'Public Listen Room'}
                </p>
                <p className="text-[10px] text-text-secondary">
                  {isPrivate ? 'Only people with the password can enter' : 'Anyone can join & vibe'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate((v) => !v)}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isPrivate ? 'bg-accent-secondary text-white' : 'bg-white/10 text-text-secondary'
              }`}
            >
              {isPrivate ? 'Locked' : 'Public'}
            </button>
          </div>

          {isPrivate && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set room password..."
              className="w-full px-3.5 py-2 rounded-xl bg-bg-primary border border-accent-secondary/40 text-xs focus:outline-none"
            />
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary text-[#0B0B0B] font-bold text-xs shadow-lg"
          >
            {submitting ? 'Creating Listen Room...' : 'Launch Live Listen Room'}
          </button>
        </form>
      )}

      {/* Room Cards Grid */}
      {filteredRooms.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No active Listen Rooms in this category"
          subtitle="Start a room to spin tracks with Song Themes, voice chat, and DJ soundboard."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredRooms.map((r) => {
            const trackTheme = getSongTheme({ songTheme: r.currentSongTheme })
            return (
              <div
                key={r.id}
                onClick={() => navigate(`/rooms/${r.id}`)}
                style={roomBgStyle(r.bgTheme, r.customBgUrl)}
                className="relative p-4 rounded-3xl border border-white/15 cursor-pointer hover:scale-[1.01] transition-all overflow-hidden flex flex-col justify-between min-h-[168px] shadow-xl group"
              >
                {/* Top Status Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/85 text-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/50 backdrop-blur text-white/85 border border-white/10">
                      {r.category || 'Music Party'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <Flame className="w-2.5 h-2.5" /> {r.vibeScore || 88}% Vibe
                    </span>
                    {r.isPrivate && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 text-accent-secondary">
                        <Lock className="w-2.5 h-2.5" /> Locked
                      </span>
                    )}
                  </div>
                  {r.hostId === user?.id && (
                    <button
                      onClick={(e) => deleteRoom(r.id, e)}
                      aria-label="Delete room"
                      className="p-1.5 rounded-full bg-black/40 text-white/70 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Middle Room Title & Topic */}
                <div className="my-3">
                  <h3
                    className="text-base font-extrabold leading-snug group-hover:text-accent-primary transition-colors"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {r.name}
                  </h3>
                  <p className="text-xs text-white/75 truncate mt-0.5">{r.topic}</p>
                </div>

                {/* Currently Spinning Song Preview Bar */}
                <div className="space-y-2">
                  {r.currentTrackTitle && (
                    <div
                      className="p-2 rounded-2xl bg-black/55 backdrop-blur-md border flex items-center justify-between gap-2"
                      style={{ borderColor: `${trackTheme.primaryColor}55` }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Disc3
                          className="w-4 h-4 shrink-0 animate-spin"
                          style={{
                            animationDuration: '4s',
                            color: trackTheme.primaryColor,
                          }}
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-white truncate">
                            {r.currentTrackTitle}
                          </p>
                          <p className="text-[9.5px] text-white/65 truncate">
                            {r.currentTrackArtist || 'Spinning Now'} · {trackTheme.name}
                          </p>
                        </div>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded-full text-[9px] font-bold text-[#0B0B0B] shrink-0"
                        style={{ backgroundColor: trackTheme.primaryColor }}
                      >
                        Join Stage
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-white/80">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-accent-primary" /> Host: {r.hostName}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-white/70">
                      <Headphones className="w-3 h-3 text-accent-secondary" />
                      {(r.speakerIds || []).length + 3} tuning in
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
