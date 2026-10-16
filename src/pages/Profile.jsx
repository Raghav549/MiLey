import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera,
  LogOut,
  Music,
  Upload as UploadIcon,
  Edit2,
  Trash2,
  Check,
  Bell,
  BellRing,
  Share2,
  QrCode,
  Radio,
  BadgeCheck,
  ShieldAlert,
  Inbox,
  Sparkles,
  Layers,
  Smartphone,
} from 'lucide-react'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { storage } from '../lib/storage'
import { push } from '../lib/push'
import { share } from '../lib/share'
import { APP_DOMAIN } from '../lib/supabaseClient'
import { useLiveShared } from '../lib/useLive'
import { usePlayer } from '../context/PlayerContext'
import { useLikes } from '../hooks/useLikes'
import { useFollows } from '../hooks/useFollows'
import { TrackRow } from '../components/TrackViews'
import EditTrackModal from '../components/EditTrackModal'
import FollowListModal from '../components/FollowListModal'
import QRCard from '../components/QRCard'
import { isAdmin } from '../permissions'
import { fallbackCover, formatCount } from '../musicHelpers'

export default function Profile() {
  const navigate = useNavigate()
  const { isLiked, toggleLike } = useLikes()
  const { setCameraBannerExpanded, currentTrack } = usePlayer()
  const { getFollowerCount, getFollowingCount } = useFollows()
  const user = auth.getCurrentUser()
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [customUsername, setCustomUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '')
  const [bannerUrl, setBannerUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [pushPerm, setPushPerm] = useState(() => push.getPermission())
  const [pushSubscribed, setPushSubscribed] = useState(
    () => localStorage.getItem('miley_push') === '1'
  )
  const [qrOpen, setQrOpen] = useState(false)
  const [editingTrack, setEditingTrack] = useState(null)
  const [followModal, setFollowModal] = useState(null)

  const { data: allTracks = [] } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })
  const { data: channels = [] } = useLiveShared('channels', { order: '-createdAt', limit: 200 })
  const myTracks = useMemo(
    () => allTracks.filter((t) => t.artistId === user?.id),
    [allTracks, user?.id]
  )
  const myChannel = useMemo(
    () => channels.find((c) => c.ownerId === user?.id),
    [channels, user?.id]
  )
  const totalPlays = useMemo(
    () => myTracks.reduce((sum, t) => sum + (t.plays || 0), 0),
    [myTracks]
  )

  const followersCount = getFollowerCount(user?.id)
  const followingCount = getFollowingCount(user?.id)

  useEffect(() => {
    if (!user?.id) return
    db.getShared('profiles', user.id)
      .then((p) => {
        if (p) {
          setDisplayName(p.displayName || user.displayName || '')
          setCustomUsername(p.customUsername || '')
          setBio(p.bio || '')
          setAvatarUrl(p.avatarUrl || user.avatarUrl || '')
          setBannerUrl(p.bannerUrl || '')
        }
      })
      .catch(() => {})
  }, [user?.id])

  const uploadImg = async (file, setter) => {
    if (!file) return
    const res = await storage.upload('covers', file)
    setter(res.url)
  }

  const cleanUsername = (v) => v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24)

  const saveProfile = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      const slug = cleanUsername(customUsername)
      await db.upsertShared(
        'profiles',
        {
          userId: user.id,
          displayName: displayName.trim() || user.displayName || 'MiLey Artist',
          customUsername: slug,
          bio: bio.trim(),
          avatarUrl,
          bannerUrl,
        },
        user.id,
        { visibleTo: 'public' }
      )
      await auth.updateUserProfile({
        displayName: displayName.trim() || user.displayName,
        avatarUrl,
      })
      setCustomUsername(slug)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const deleteTrack = async (id) => {
    await db.deleteShared('tracks', id)
  }

  const enablePush = async () => {
    try {
      const perm = await push.requestPermission()
      setPushPerm(perm)
      if (perm === 'granted') {
        await push.subscribe()
        localStorage.setItem('miley_push', '1')
        setPushSubscribed(true)
      }
    } catch {
      /* ignore */
    }
  }

  const profileShareUrl = myChannel
    ? `${APP_DOMAIN}/#/channel/${myChannel.username}`
    : `${APP_DOMAIN}/#/artist/${user?.id}`

  const shareProfile = async () => {
    await share.link({
      title: `${displayName || 'Artist'} on MiLey`,
      text: bio || `Listen to ${displayName || 'my tracks'} on MiLey (${APP_DOMAIN.replace('https://', '')})`,
      url: profileShareUrl,
    })
  }

  const replayAnimatedSplash = () => {
    window.dispatchEvent(new CustomEvent('miley:replay-splash'))
  }

  return (
    <div className="pb-10 max-w-2xl mx-auto">
      {/* Banner */}
      <div
        className="relative h-44 px-4 pt-4 flex items-end"
        style={{
          background: bannerUrl
            ? `linear-gradient(to bottom, rgba(11,11,11,0.2), #0B0B0B), url(${bannerUrl}) center/cover`
            : 'linear-gradient(135deg, rgba(0,224,168,0.35), rgba(255,61,174,0.35), #0B0B0B)',
        }}
      >
        {editing && (
          <label className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur text-xs flex items-center gap-1.5 cursor-pointer">
            <Camera className="w-3.5 h-3.5" /> Banner
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => uploadImg(e.target.files?.[0], setBannerUrl)}
            />
          </label>
        )}
        <div className="flex items-end gap-4 translate-y-6">
          <div
            className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-bg-primary shrink-0 flex items-center justify-center text-2xl font-bold text-black"
            style={{ background: fallbackCover(displayName || 'You') }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              (displayName || 'U')[0]
            )}
            {editing && (
              <label className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer">
                <Camera className="w-5 h-5 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadImg(e.target.files?.[0], setAvatarUrl)}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-9 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="space-y-2">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name"
                  className="w-full px-3 py-2 rounded-xl bg-bg-secondary border border-white/10 text-sm"
                />
                <div className="flex items-center px-3 py-2 rounded-xl bg-bg-secondary border border-white/10">
                  <span className="text-xs text-text-secondary mr-1">@</span>
                  <input
                    value={customUsername}
                    onChange={(e) => setCustomUsername(cleanUsername(e.target.value))}
                    placeholder="custom_username"
                    className="flex-1 bg-transparent text-xs font-mono focus:outline-none"
                  />
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Bio — tell listeners about your music"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-bg-secondary border border-white/10 text-xs"
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xl font-bold truncate" style={{ fontFamily: 'var(--font-display)' }}>
                    {displayName || 'Artist'}
                  </h1>
                  <BadgeCheck className="w-5 h-5 text-accent-primary shrink-0" />
                </div>
                {customUsername && (
                  <p className="text-xs text-accent-primary font-mono">@{customUsername}</p>
                )}
                <p className="text-xs text-text-secondary mt-0.5">
                  {bio || 'Music lover & creator on MiLey (mileymusic.space)'}
                </p>
                <div className="flex items-center gap-3 text-xs text-text-secondary mt-2">
                  <button
                    onClick={() => setFollowModal('followers')}
                    className="hover:text-text-primary"
                  >
                    <strong className="text-text-primary">{formatCount(followersCount)}</strong> followers
                  </button>
                  <span>·</span>
                  <button
                    onClick={() => setFollowModal('following')}
                    className="hover:text-text-primary"
                  >
                    <strong className="text-text-primary">{formatCount(followingCount)}</strong> following
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <button
                onClick={saveProfile}
                disabled={saving}
                className="flex items-center gap-1 px-3.5 py-2 rounded-full bg-accent-primary text-[#0B0B0B] text-xs font-semibold"
              >
                <Check className="w-3.5 h-3.5" /> Save
              </button>
            ) : (
              <>
                <button
                  onClick={shareProfile}
                  aria-label="Share profile"
                  className="p-2 rounded-full bg-bg-secondary border border-white/10 text-text-secondary hover:text-text-primary"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setQrOpen(true)}
                  aria-label="Show QR card"
                  className="p-2 rounded-full bg-bg-secondary border border-white/10 text-text-secondary hover:text-text-primary"
                >
                  <QrCode className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 px-3.5 py-2 rounded-full bg-bg-secondary border border-white/10 text-xs font-medium"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
              </>
            )}
            <button
              onClick={() => auth.signOut()}
              className="p-2 rounded-full bg-bg-secondary border border-white/10 text-text-secondary hover:text-red-400"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Channel Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-accent-primary/15 to-accent-secondary/15 border border-accent-primary/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-accent-primary/20 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 text-accent-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-xs font-semibold truncate">
                  {myChannel ? myChannel.name : 'Create your MiLey Channel'}
                </p>
                {myChannel?.verified && (
                  <BadgeCheck className="w-3.5 h-3.5 text-accent-primary shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-text-secondary truncate">
                {myChannel
                  ? `@${myChannel.username} · Upload music & grow subscribers`
                  : 'Get a unique @username handle to upload songs'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {myChannel && (
              <button
                onClick={() => navigate(`/channel/${myChannel.username}`)}
                className="px-3 py-1.5 rounded-full bg-white/10 text-xs font-medium"
              >
                View
              </button>
            )}
            <button
              onClick={() => navigate('/channel-setup')}
              className="px-3 py-1.5 rounded-full bg-accent-primary text-[#0B0B0B] text-xs font-semibold"
            >
              {myChannel ? 'Manage' : 'Create'}
            </button>
          </div>
        </div>

        {/* Native Android & Studio Quick Tools Card */}
        <div className="p-3.5 rounded-2xl bg-bg-secondary border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-accent-primary" />
              <p className="text-xs font-bold">Android &amp; Studio Experience Controls</p>
            </div>
            <span className="text-[10px] font-mono text-accent-primary">mileymusic.space</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={replayAnimatedSplash}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold flex flex-col items-center gap-1 text-center"
            >
              <Sparkles className="w-4 h-4 text-accent-primary" />
              Replay Splash
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentTrack) setCameraBannerExpanded(true)
                else navigate('/')
              }}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold flex flex-col items-center gap-1 text-center"
            >
              <Smartphone className="w-4 h-4 text-accent-secondary" />
              Camera Music Bar
            </button>
            <button
              type="button"
              onClick={() => navigate('/upload?mode=bulk')}
              className="p-2.5 rounded-xl bg-accent-primary/15 hover:bg-accent-primary/25 border border-accent-primary/30 text-[11px] font-semibold text-accent-primary flex flex-col items-center gap-1 text-center"
            >
              <Layers className="w-4 h-4" />
              Bulk Upload
            </button>
          </div>
        </div>

        {/* Push Notification Toggle */}
        <div className="p-3.5 rounded-2xl bg-bg-secondary border border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-accent-secondary/15 flex items-center justify-center shrink-0">
              {pushSubscribed ? (
                <BellRing className="w-4 h-4 text-accent-secondary" />
              ) : (
                <Bell className="w-4 h-4 text-text-secondary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold">Push Notifications</p>
              <p className="text-[11px] text-text-secondary truncate">
                {pushSubscribed
                  ? 'Enabled for premieres, new tracks & room invites'
                  : 'Get notified when channels drop new tracks or go live'}
              </p>
            </div>
          </div>
          {!pushSubscribed && pushPerm !== 'denied' && (
            <button
              onClick={enablePush}
              className="px-3 py-1.5 rounded-full bg-accent-secondary text-white text-xs font-semibold shrink-0"
            >
              Enable
            </button>
          )}
        </div>

        {/* Admin Panel Shortcuts */}
        {isAdmin(user) && (
          <div className="space-y-2">
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">Admin · Reports &amp; Moderation</p>
                  <p className="text-[11px] text-text-secondary truncate">
                    Review flagged songs, channels &amp; approve channel requests
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/admin/reports')}
                className="px-3 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold shrink-0"
              >
                Open
              </button>
            </div>
            <div className="p-3.5 rounded-2xl bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Inbox className="w-5 h-5 text-accent-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">Admin · @MiLey Official Inbox</p>
                  <p className="text-[11px] text-text-secondary truncate">
                    Read &amp; reply to user messages sent to @MiLey Official
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/admin/official-inbox')}
                className="px-3 py-1.5 rounded-full bg-accent-primary text-[#0B0B0B] text-xs font-semibold shrink-0"
              >
                Inbox
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-3 rounded-2xl bg-bg-secondary border border-white/5 text-center">
            <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              {myTracks.length}
            </p>
            <p className="text-[11px] text-text-secondary">Uploads</p>
          </div>
          <div className="p-3 rounded-2xl bg-bg-secondary border border-white/5 text-center">
            <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              {formatCount(totalPlays)}
            </p>
            <p className="text-[11px] text-text-secondary">Total Plays</p>
          </div>
          <div className="p-3 rounded-2xl bg-bg-secondary border border-white/5 text-center">
            <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              {myTracks.reduce((s, t) => s + (t.likes || 0), 0)}
            </p>
            <p className="text-[11px] text-text-secondary">Likes</p>
          </div>
        </div>

        {/* My Uploads */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Your Uploaded Tracks
            </h2>
            <button
              onClick={() => navigate('/upload')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent-primary/15 text-accent-primary text-xs font-semibold"
            >
              <UploadIcon className="w-3.5 h-3.5" /> Upload
            </button>
          </div>

          {myTracks.length === 0 ? (
            <div className="text-center py-8 rounded-2xl bg-bg-secondary/50 border border-white/5">
              <Music className="w-7 h-7 text-text-secondary mx-auto mb-2" />
              <p className="text-xs text-text-secondary">You haven&apos;t uploaded any tracks yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {myTracks.map((t, i) => (
                <div key={t.id} className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <TrackRow
                      track={t}
                      list={myTracks}
                      index={i}
                      isLiked={isLiked(t.id)}
                      onToggleLike={toggleLike}
                    />
                  </div>
                  <button
                    onClick={() => setEditingTrack(t)}
                    className="p-2 text-text-secondary hover:text-accent-primary"
                    aria-label="Edit track"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteTrack(t.id)}
                    className="p-2 text-text-secondary hover:text-red-400"
                    aria-label="Delete track"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {editingTrack && (
        <EditTrackModal track={editingTrack} onClose={() => setEditingTrack(null)} />
      )}

      <FollowListModal
        open={Boolean(followModal)}
        onClose={() => setFollowModal(null)}
        targetId={user?.id}
        mode={followModal || 'followers'}
      />

      {qrOpen && (
        <QRCard
          title={myChannel ? myChannel.name : displayName || 'Artist'}
          subtitle={myChannel ? `@${myChannel.username} · mileymusic.space` : 'MiLey Artist · mileymusic.space'}
          url={profileShareUrl}
          avatarUrl={myChannel?.avatarUrl || avatarUrl}
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  )
}
