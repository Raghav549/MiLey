import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Radio,
  BadgeCheck,
  Upload as UploadIcon,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  QrCode,
  Megaphone,
  Send,
  Trash2,
  Sparkles,
  BarChart3,
  Layers,
} from 'lucide-react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { storage } from '../lib/storage'
import { APP_DOMAIN } from '../lib/supabaseClient'
import { useLiveShared } from '../lib/useLive'
import { useFollows } from '../hooks/useFollows'
import { isAdmin } from '../permissions'
import { notifyUser } from '../hooks/useNotifications'
import QRCard from '../components/QRCard'
import { fallbackCover, formatCount } from '../musicHelpers'

const USERNAME_RE = /^[a-z0-9_]{3,24}$/

const CHANNEL_CATEGORIES = [
  'Electronic & Synth Studio',
  'Bollywood & Indie Collective',
  'Hip-Hop & Beats Label',
  'Lo-Fi & Chillhop Radio',
  'Pop & Vocal Showcase',
  'Podcast & Talk Network',
]

const ACCENT_COLORS = ['#00E0A8', '#FF3DAE', '#F59E0B', '#38BDF8', '#A855F7', '#10B981']

export default function ChannelDashboard() {
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const admin = isAdmin(user)
  const { getFollowerCount } = useFollows()
  const { data: channels = [] } = useLiveShared('channels', { order: '-createdAt', limit: 200 })
  const { data: allTracks = [] } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })

  const myChannel = useMemo(
    () => channels.find((c) => c.ownerId === user?.id),
    [channels, user?.id]
  )
  const myTracks = useMemo(
    () => allTracks.filter((t) => t.artistId === user?.id || (myChannel && t.channelId === myChannel.id)),
    [allTracks, user?.id, myChannel]
  )

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [category, setCategory] = useState(CHANNEL_CATEGORIES[0])
  const [accentColor, setAccentColor] = useState('#00E0A8')
  const [spotlightTrackId, setSpotlightTrackId] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [bannerFile, setBannerFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [qrOpen, setQrOpen] = useState(false)
  const [postText, setPostText] = useState('')
  const [postTrackId, setPostTrackId] = useState('')
  const [posting, setPosting] = useState(false)

  const { data: allPosts = [] } = useLiveShared('channel_posts', { order: '-createdAt', limit: 200 })
  const myPosts = useMemo(
    () => (myChannel ? allPosts.filter((p) => p.channelId === myChannel.id) : []),
    [allPosts, myChannel]
  )

  useEffect(() => {
    if (myChannel) {
      setName(myChannel.name || '')
      setUsername(myChannel.username || '')
      setBio(myChannel.bio || '')
      setCategory(myChannel.category || CHANNEL_CATEGORIES[0])
      setAccentColor(myChannel.accentColor || '#00E0A8')
      setSpotlightTrackId(myChannel.spotlightTrackId || '')
    }
  }, [myChannel?.id])

  const cleanSlug = (v) => v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24)

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSavedMsg('')
    const slug = cleanSlug(username)
    if (!name.trim()) return setError('Channel name is required.')
    if (!USERNAME_RE.test(slug)) {
      return setError('Username must be 3–24 chars: lowercase letters, numbers, or underscore.')
    }
    const taken = channels.find(
      (c) => (c.username || '').toLowerCase() === slug && c.id !== myChannel?.id
    )
    if (taken) return setError(`@${slug} is already taken. Try another handle.`)

    setSaving(true)
    try {
      let avatarUrl = myChannel?.avatarUrl || user?.avatarUrl || ''
      let bannerUrl = myChannel?.bannerUrl || ''
      if (avatarFile) {
        const up = await storage.upload('covers', avatarFile)
        avatarUrl = up.url
      }
      if (bannerFile) {
        const up = await storage.upload('covers', bannerFile)
        bannerUrl = up.url
      }

      const payload = {
        ownerId: user?.id,
        ownerName: user?.displayName || name.trim(),
        name: name.trim(),
        username: slug,
        bio: bio.trim(),
        category,
        accentColor,
        spotlightTrackId,
        avatarUrl,
        bannerUrl,
        verified: myChannel?.verified ?? true,
        status: myChannel?.status || 'approved',
      }

      if (myChannel) {
        await db.updateShared('channels', myChannel.id, payload)
      } else {
        await db.insertShared('channels', payload, `ch-${slug}`, { visibleTo: 'public' })
      }
      setSavedMsg('Channel saved and live on mileymusic.space!')
    } catch (err) {
      setError(err?.message || 'Failed to save channel.')
    } finally {
      setSaving(false)
    }
  }

  const requestVerification = async () => {
    if (!myChannel) return
    await db.updateShared('channels', myChannel.id, {
      verifyRequested: true,
      verified: true,
    })
    setSavedMsg('Verified Creator Badge activated for @' + myChannel.username + '!')
  }

  const toggleVerify = async (ch) => {
    if (!admin) return
    const next = !ch.verified
    await db.updateShared('channels', ch.id, { verified: next, verifyRequested: false })
    if (next) {
      notifyUser({
        recipientId: ch.ownerId,
        type: 'verified',
        title: `🎉 @${ch.username} is now Verified!`,
        body: 'Your channel has received the verified badge on MiLey.',
        link: `/channel/${ch.username}`,
      })
    }
  }

  const approveChannel = async (ch, newStatus) => {
    if (!admin) return
    await db.updateShared('channels', ch.id, { status: newStatus })
  }

  const postAnnouncement = async (e) => {
    e.preventDefault()
    if (!myChannel || !postText.trim()) return
    setPosting(true)
    try {
      await db.insertShared(
        'channel_posts',
        {
          channelId: myChannel.id,
          channelUsername: myChannel.username,
          channelName: myChannel.name,
          ownerId: user?.id,
          text: postText.trim(),
          trackId: postTrackId || '',
        },
        undefined,
        { visibleTo: 'public' }
      )
      setPostText('')
      setPostTrackId('')
    } finally {
      setPosting(false)
    }
  }

  const deletePost = async (id) => {
    await db.deleteShared('channel_posts', id)
  }

  const totalPlays = myTracks.reduce((s, t) => s + (t.plays || 0), 0)
  const totalLikes = myTracks.reduce((s, t) => s + (t.likes || 0), 0)
  const subscribers = getFollowerCount(user?.id)

  return (
    <div className="px-4 pt-5 pb-12 max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {myChannel ? 'Creator Channel Studio' : 'Create Your Channel'}
          </h1>
          <p className="text-xs text-text-secondary">
            Official creator hub on <span className="text-accent-primary font-mono">mileymusic.space</span>
          </p>
        </div>
        {myChannel && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setQrOpen(true)}
              aria-label="Channel QR code"
              className="p-2 rounded-full bg-bg-secondary border border-white/10 text-text-secondary hover:text-text-primary"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(`/channel/${myChannel.username}`)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-accent-primary/15 border border-accent-primary/40 text-accent-primary text-xs font-semibold"
            >
              @{myChannel.username} <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Live Channel Analytics & Quick Launch Bar */}
      {myChannel && (
        <div className="p-4 rounded-3xl bg-gradient-to-br from-bg-secondary via-bg-secondary to-accent-primary/10 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/85">
                Channel Studio Metrics
              </span>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold">
              <CheckCircle2 className="w-3 h-3" /> Live &amp; Approved
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-2xl bg-black/35 border border-white/5">
              <p className="text-base font-bold text-accent-primary">{formatCount(subscribers)}</p>
              <p className="text-[10px] text-text-secondary">Subscribers</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-black/35 border border-white/5">
              <p className="text-base font-bold text-white">{myTracks.length}</p>
              <p className="text-[10px] text-text-secondary">Tracks</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-black/35 border border-white/5">
              <p className="text-base font-bold text-accent-secondary">{formatCount(totalPlays)}</p>
              <p className="text-[10px] text-text-secondary">Streams</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-black/35 border border-white/5">
              <p className="text-base font-bold text-amber-400">{formatCount(totalLikes)}</p>
              <p className="text-[10px] text-text-secondary">Likes</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate('/upload?mode=bulk')}
              className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-accent-primary to-emerald-400 text-[#0B0B0B] text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-accent-primary/20"
            >
              <Layers className="w-4 h-4" /> Bulk Upload + Themes
            </button>
            <button
              type="button"
              onClick={() => navigate('/upload')}
              className="py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10"
            >
              <UploadIcon className="w-4 h-4" /> Single / Album Upload
            </button>
          </div>
        </div>
      )}

      {/* Channel Configuration Form */}
      <form
        onSubmit={handleSave}
        className="space-y-4 p-4 rounded-3xl bg-bg-secondary border border-white/10"
      >
        <div>
          <label className="text-xs text-text-secondary block mb-1">Channel Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Midnight Drift Records"
            className="w-full px-3.5 py-2.5 rounded-xl bg-bg-primary border border-white/10 text-sm focus:outline-none focus:border-accent-primary"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-secondary block mb-1">Unique Handle *</label>
            <div className="flex items-center px-3.5 py-2.5 rounded-xl bg-bg-primary border border-white/10 focus-within:border-accent-primary">
              <span className="text-sm text-text-secondary mr-1">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(cleanSlug(e.target.value))}
                placeholder="midnight_drift"
                className="flex-1 bg-transparent text-sm focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-text-secondary block mb-1">Channel Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-primary border border-white/10 text-sm focus:outline-none focus:border-accent-primary"
            >
              {CHANNEL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Accent Color & Pinned Track */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-secondary block mb-1.5">Channel Brand Color</label>
            <div className="flex items-center gap-2">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccentColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    accentColor === c ? 'scale-110 border-white' : 'border-transparent opacity-75'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {myTracks.length > 0 && (
            <div>
              <label className="text-xs text-text-secondary block mb-1">Pinned Spotlight Track</label>
              <select
                value={spotlightTrackId}
                onChange={(e) => setSpotlightTrackId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs focus:outline-none focus:border-accent-primary"
              >
                <option value="">Auto (Most Streamed Track)</option>
                {myTracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">Channel Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Tell listeners what kind of music and Song Themes you drop..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-bg-primary border border-white/10 text-sm focus:outline-none focus:border-accent-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-white/15 cursor-pointer hover:border-accent-primary/50 text-center">
            <Radio className="w-4 h-4 text-accent-primary mb-1" />
            <span className="text-[11px] font-medium truncate max-w-full">
              {avatarFile ? avatarFile.name : 'Channel Avatar'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
            />
          </label>
          <label className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-white/15 cursor-pointer hover:border-accent-primary/50 text-center">
            <UploadIcon className="w-4 h-4 text-accent-secondary mb-1" />
            <span className="text-[11px] font-medium truncate max-w-full">
              {bannerFile ? bannerFile.name : 'Channel Banner'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {savedMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {savedMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary text-[#0B0B0B] font-bold text-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : myChannel ? 'Update Channel Studio' : 'Create & Activate Channel'}
        </button>
      </form>

      {/* Channel Announcements / Drops with Optional Featured Track */}
      {myChannel && (
        <div className="p-4 rounded-3xl bg-bg-secondary border border-white/10 space-y-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-accent-primary" />
            <h2 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Channel Announcements &amp; Drops
            </h2>
          </div>
          <form onSubmit={postAnnouncement} className="space-y-2">
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={2}
              placeholder="Share news, release dates, or behind-the-scenes updates with your subscribers..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-primary border border-white/10 text-xs focus:outline-none focus:border-accent-primary"
            />
            <div className="flex items-center gap-2">
              {myTracks.length > 0 && (
                <select
                  value={postTrackId}
                  onChange={(e) => setPostTrackId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs text-white/80"
                >
                  <option value="">Attach a track drop (optional)</option>
                  {myTracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      🎵 {t.title}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                disabled={posting || !postText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent-primary text-[#0B0B0B] text-xs font-semibold disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" /> {posting ? 'Posting...' : 'Post Drop'}
              </button>
            </div>
          </form>
          {myPosts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              {myPosts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-bg-primary/60 text-xs"
                >
                  <p className="text-text-primary whitespace-pre-wrap flex-1">{p.text}</p>
                  <button
                    onClick={() => deletePost(p.id)}
                    aria-label="Delete post"
                    className="p-1 text-text-secondary hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Verification Status Card */}
      {myChannel && (
        <div className="p-4 rounded-2xl bg-bg-secondary border border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BadgeCheck
              className={`w-6 h-6 shrink-0 ${
                myChannel.verified ? 'text-accent-primary' : 'text-text-secondary'
              }`}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {myChannel.verified ? 'Verified Creator Channel' : 'Creator Verification'}
              </p>
              <p className="text-xs text-text-secondary">
                {myChannel.verified
                  ? 'Your official badge is active next to @' + myChannel.username
                  : 'Activate your verified creator badge on mileymusic.space'}
              </p>
            </div>
          </div>
          {!myChannel.verified && (
            <button
              onClick={requestVerification}
              className="px-3.5 py-2 rounded-full bg-accent-primary/15 border border-accent-primary/40 text-accent-primary text-xs font-semibold shrink-0"
            >
              Verify Now
            </button>
          )}
        </div>
      )}

      {/* Admin Moderation Panel */}
      {admin && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent-primary" />
            <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Admin · Channel Directory ({channels.length})
            </h2>
          </div>

          <div className="space-y-2">
            {channels.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-bg-secondary border border-white/5"
              >
                <div
                  onClick={() => navigate(`/channel/${c.username}`)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                >
                  <div
                    className="w-9 h-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-black"
                    style={{ background: fallbackCover(c.name) }}
                  >
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      (c.name || 'C')[0]
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-semibold truncate">{c.name}</p>
                      {c.verified && <BadgeCheck className="w-3.5 h-3.5 text-accent-primary" />}
                    </div>
                    <p className="text-[11px] text-text-secondary font-mono truncate">
                      @{c.username}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleVerify(c)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border ${
                    c.verified
                      ? 'bg-accent-primary/15 border-accent-primary/40 text-accent-primary'
                      : 'bg-white/5 border-white/10 text-text-secondary'
                  }`}
                >
                  {c.verified ? 'Verified ✓' : 'Grant Badge'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {qrOpen && myChannel && (
        <QRCard
          title={myChannel.name}
          subtitle={`@${myChannel.username} · mileymusic.space`}
          url={`${APP_DOMAIN}/#/channel/${myChannel.username}`}
          avatarUrl={myChannel.avatarUrl}
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  )
}
