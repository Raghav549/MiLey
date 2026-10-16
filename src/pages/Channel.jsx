import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Play,
  BadgeCheck,
  UserPlus,
  Check,
  MessageCircle,
  Radio,
  Share2,
  QrCode,
  Megaphone,
  Flag,
  Sparkles,
  Disc,
  Upload as UploadIcon,
} from 'lucide-react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { messaging } from '../lib/messaging'
import { share } from '../lib/share'
import { APP_DOMAIN } from '../lib/supabaseClient'
import { useLiveShared } from '../lib/useLive'
import { usePlayer } from '../context/PlayerContext'
import { useLikes } from '../hooks/useLikes'
import { useFollows } from '../hooks/useFollows'
import { TrackRow } from '../components/TrackViews'
import FollowListModal from '../components/FollowListModal'
import QRCard from '../components/QRCard'
import { fallbackCover, formatCount, getSongTheme } from '../musicHelpers'

export default function Channel() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { playTrack } = usePlayer()
  const { isLiked, toggleLike } = useLikes()
  const { isFollowing, toggleFollow, getFollowerCount } = useFollows()
  const me = auth.getCurrentUser()

  const { data: channels = [] } = useLiveShared('channels', { order: '-createdAt', limit: 200 })
  const { data: allTracks = [] } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })
  const { data: allAlbums = [] } = useLiveShared('albums', { order: '-createdAt', limit: 100 })
  const { data: posts = [] } = useLiveShared('channel_posts', { order: '-createdAt', limit: 200 })

  const channel = useMemo(() => {
    const slug = (username || '').toLowerCase()
    return channels.find((c) => (c.username || '').toLowerCase() === slug)
  }, [channels, username])

  const [followModal, setFollowModal] = useState(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [tab, setTab] = useState('tracks') // 'tracks' | 'posts' | 'albums' | 'about'
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('Copyright infringement')
  const [reportNotes, setReportNotes] = useState('')
  const [reportSent, setReportSent] = useState(false)

  const channelTracks = useMemo(() => {
    if (!channel) return []
    return allTracks.filter(
      (t) => t.channelId === channel.id || t.artistId === channel.ownerId
    )
  }, [allTracks, channel])

  const channelAlbums = useMemo(() => {
    if (!channel) return []
    return allAlbums.filter(
      (a) => a.channelId === channel.id || a.artistId === channel.ownerId
    )
  }, [allAlbums, channel])

  const channelPosts = useMemo(() => {
    if (!channel) return []
    return posts.filter((p) => p.channelId === channel.id)
  }, [posts, channel])

  const spotlightTrack = useMemo(() => {
    if (!channelTracks.length) return null
    if (channel?.spotlightTrackId) {
      const found = channelTracks.find((t) => t.id === channel.spotlightTrackId)
      if (found) return found
    }
    return [...channelTracks].sort((a, b) => (b.plays || 0) - (a.plays || 0))[0]
  }, [channelTracks, channel?.spotlightTrackId])

  if (!channel) {
    return (
      <div className="px-4 pt-8 max-w-md mx-auto text-center space-y-3">
        <Radio className="w-10 h-10 text-text-secondary mx-auto" />
        <p className="text-base font-bold">Channel @{username} not found</p>
        <button
          onClick={() => navigate('/explore')}
          className="px-4 py-2 rounded-full bg-accent-primary text-[#0B0B0B] text-xs font-semibold"
        >
          Browse Channels
        </button>
      </div>
    )
  }

  const totalPlays = channelTracks.reduce((s, t) => s + (t.plays || 0), 0)
  const following = isFollowing(channel.ownerId)
  const followers = getFollowerCount(channel.ownerId)
  const accentColor = channel.accentColor || '#00E0A8'
  const shareUrl = `${APP_DOMAIN}/#/channel/${channel.username}`

  const shareChannel = async () => {
    await share.link({
      title: `${channel.name} (@${channel.username}) on MiLey`,
      text: channel.bio || `Listen to ${channel.name} on MiLey (${APP_DOMAIN.replace('https://', '')})`,
      url: shareUrl,
    })
  }

  const startChat = async () => {
    try {
      const ch = await messaging.createDM(channel.ownerId)
      if (ch?.id) navigate(`/messages/${ch.id}`)
      else navigate('/messages')
    } catch {
      navigate('/messages')
    }
  }

  const submitReport = async (e) => {
    e.preventDefault()
    await db.insertShared(
      'reports',
      {
        targetType: 'channel',
        targetId: channel.id,
        targetName: `@${channel.username}`,
        reason: reportReason,
        notes: reportNotes.trim(),
        reporterId: me?.id,
        reporterName: me?.displayName || 'User',
        status: 'open',
      },
      undefined,
      { visibleTo: 'public' }
    )
    setReportSent(true)
    setTimeout(() => {
      setReportOpen(false)
      setReportSent(false)
      setReportNotes('')
    }, 1100)
  }

  return (
    <div className="pb-10 max-w-2xl mx-auto">
      {/* Channel Banner */}
      <div
        className="relative h-52 px-4 pt-4 flex flex-col justify-between overflow-hidden"
        style={{
          background: channel.bannerUrl
            ? `linear-gradient(to bottom, rgba(11,11,11,0.25), #0B0B0B), url(${channel.bannerUrl}) center/cover`
            : `linear-gradient(160deg, ${accentColor}44, rgba(255,61,174,0.28), #0B0B0B 90%)`,
        }}
      >
        <div className="flex items-center justify-between relative z-10">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={shareChannel}
              aria-label="Share channel"
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/10"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setQrOpen(true)}
              aria-label="Channel QR code"
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/10"
            >
              <QrCode className="w-4 h-4" />
            </button>
            {me?.id !== channel.ownerId && (
              <button
                onClick={() => setReportOpen(true)}
                aria-label="Report channel"
                className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-text-secondary hover:text-red-400 border border-white/10"
              >
                <Flag className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-end gap-4 pb-2 relative z-10">
          <div
            className="w-20 h-20 rounded-2xl overflow-hidden border-2 shadow-xl shrink-0 flex items-center justify-center text-xl font-bold text-black"
            style={{
              background: fallbackCover(channel.name),
              borderColor: accentColor,
            }}
          >
            {channel.avatarUrl ? (
              <img src={channel.avatarUrl} alt={channel.name} className="w-full h-full object-cover" />
            ) : (
              (channel.name || 'C')[0]
            )}
          </div>
          <div className="min-w-0 pb-1">
            <div className="flex items-center gap-1.5">
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border"
                style={{
                  color: accentColor,
                  borderColor: `${accentColor}55`,
                  backgroundColor: `${accentColor}1A`,
                }}
              >
                {channel.category || 'Creator Channel'}
              </span>
              <span className="text-xs text-text-secondary font-mono">@{channel.username}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <h1 className="text-2xl font-bold truncate" style={{ fontFamily: 'var(--font-display)' }}>
                {channel.name}
              </h1>
              {channel.verified && (
                <BadgeCheck className="w-5 h-5 text-accent-primary shrink-0" title="Verified Channel" />
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-text-secondary mt-1 flex-wrap">
              <button onClick={() => setFollowModal('followers')} className="hover:text-text-primary">
                <strong className="text-text-primary">{formatCount(followers)}</strong> subscribers
              </button>
              <span>·</span>
              <span>{channelTracks.length} tracks</span>
              <span>·</span>
              <span>{formatCount(totalPlays)} streams</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-5 mt-3">
        {channel.bio && <p className="text-xs text-text-secondary leading-relaxed">{channel.bio}</p>}

        <div className="flex items-center gap-2.5 flex-wrap">
          {channelTracks.length > 0 && (
            <button
              onClick={() => playTrack(channelTracks[0], channelTracks)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[#0B0B0B] text-xs font-bold shadow-lg"
              style={{ backgroundColor: accentColor }}
            >
              <Play className="w-4 h-4 fill-current" /> Play Channel
            </button>
          )}
          {me?.id === channel.ownerId ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/channel-setup')}
                className="px-4 py-2.5 rounded-full bg-bg-secondary border border-white/15 text-xs font-semibold hover:border-white/30"
              >
                Manage Channel
              </button>
              <button
                onClick={() => navigate('/upload')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-accent-primary/15 border border-accent-primary/40 text-accent-primary text-xs font-semibold"
              >
                <UploadIcon className="w-3.5 h-3.5" /> Bulk Upload
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() =>
                  toggleFollow(channel.ownerId, {
                    targetType: 'channel',
                    targetName: channel.name,
                    targetAvatar: channel.avatarUrl || '',
                    targetUsername: channel.username,
                  })
                }
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all ${
                  following
                    ? 'bg-white/10 border-accent-primary/40 text-accent-primary'
                    : 'bg-bg-secondary border-white/15 text-text-primary hover:border-accent-primary'
                }`}
              >
                {following ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Subscribed ({formatCount(followers)})
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" /> Subscribe
                  </>
                )}
              </button>
              <button
                onClick={startChat}
                className="p-2.5 rounded-full bg-bg-secondary border border-white/15"
                aria-label="Message channel owner"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Channel Spotlight Track */}
        {spotlightTrack && (
          <div
            onClick={() => playTrack(spotlightTrack, channelTracks)}
            className="p-3.5 rounded-2xl border overflow-hidden cursor-pointer transition-all hover:scale-[1.01]"
            style={{
              borderColor: `${getSongTheme(spotlightTrack).primaryColor}55`,
              background: getSongTheme(spotlightTrack).bgStyle,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/20">
                  {spotlightTrack.coverUrl && (
                    <img
                      src={spotlightTrack.coverUrl}
                      alt={spotlightTrack.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider"
                    style={{ color: getSongTheme(spotlightTrack).primaryColor }}
                  >
                    <Sparkles className="w-3 h-3" /> Pinned Channel Drop · {getSongTheme(spotlightTrack).name}
                  </span>
                  <p className="text-sm font-bold text-white truncate">{spotlightTrack.title}</p>
                </div>
              </div>
              <span
                className="px-3 py-1 rounded-full text-[11px] font-bold text-[#0B0B0B] shrink-0"
                style={{ backgroundColor: getSongTheme(spotlightTrack).primaryColor }}
              >
                Play
              </span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1.5 bg-bg-secondary p-1 rounded-2xl border border-white/5 text-xs font-medium">
          <button
            onClick={() => setTab('tracks')}
            className={`py-2 rounded-xl ${
              tab === 'tracks' ? 'bg-accent-primary text-[#0B0B0B] font-semibold' : 'text-text-secondary'
            }`}
          >
            Tracks ({channelTracks.length})
          </button>
          <button
            onClick={() => setTab('posts')}
            className={`py-2 rounded-xl flex items-center justify-center gap-1 ${
              tab === 'posts' ? 'bg-accent-primary text-[#0B0B0B] font-semibold' : 'text-text-secondary'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" /> Drops ({channelPosts.length})
          </button>
          <button
            onClick={() => setTab('albums')}
            className={`py-2 rounded-xl ${
              tab === 'albums' ? 'bg-accent-primary text-[#0B0B0B] font-semibold' : 'text-text-secondary'
            }`}
          >
            Albums ({channelAlbums.length})
          </button>
          <button
            onClick={() => setTab('about')}
            className={`py-2 rounded-xl ${
              tab === 'about' ? 'bg-accent-primary text-[#0B0B0B] font-semibold' : 'text-text-secondary'
            }`}
          >
            About
          </button>
        </div>

        {tab === 'tracks' && (
          <section className="space-y-2">
            {channelTracks.length === 0 ? (
              <p className="text-xs text-text-secondary py-6 text-center">No tracks uploaded yet.</p>
            ) : (
              <div className="space-y-1">
                {channelTracks.map((t, i) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    list={channelTracks}
                    index={i}
                    isLiked={isLiked(t.id)}
                    onToggleLike={toggleLike}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'posts' && (
          <section className="space-y-2.5">
            {channelPosts.length === 0 ? (
              <p className="text-xs text-text-secondary py-6 text-center">
                No announcements posted yet.
              </p>
            ) : (
              channelPosts.map((p) => {
                const attachedTrack = p.trackId
                  ? channelTracks.find((t) => t.id === p.trackId) || allTracks.find((t) => t.id === p.trackId)
                  : null
                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl bg-bg-secondary border border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-text-secondary">
                      <span className="font-semibold text-accent-primary flex items-center gap-1">
                        @{channel.username}
                        {channel.verified && <BadgeCheck className="w-3.5 h-3.5" />}
                      </span>
                      <span>
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Just now'}
                      </span>
                    </div>
                    <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
                      {p.text}
                    </p>
                    {attachedTrack && (
                      <div
                        onClick={() => playTrack(attachedTrack, channelTracks)}
                        className="mt-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/[0.08]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
                            {attachedTrack.coverUrl && (
                              <img
                                src={attachedTrack.coverUrl}
                                alt={attachedTrack.title}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {attachedTrack.title}
                            </p>
                            <p className="text-[10px] text-text-secondary truncate">
                              Featured Drop · Tap to Play
                            </p>
                          </div>
                        </div>
                        <Play className="w-4 h-4 text-accent-primary fill-current mr-1" />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </section>
        )}

        {tab === 'albums' && (
          <section className="space-y-2.5">
            {channelAlbums.length === 0 ? (
              <p className="text-xs text-text-secondary py-6 text-center">No albums on this channel yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {channelAlbums.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => navigate(`/album/${a.id}`)}
                    className="p-2.5 rounded-2xl bg-bg-secondary border border-white/5 hover:border-white/15 cursor-pointer"
                  >
                    <div
                      className="aspect-square rounded-xl overflow-hidden mb-2"
                      style={{ background: fallbackCover(a.title) }}
                    >
                      {a.coverUrl && (
                        <img src={a.coverUrl} alt={a.title} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <p className="text-xs font-semibold truncate">{a.title}</p>
                    <p className="text-[11px] text-text-secondary">{a.genre || 'Album'}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'about' && (
          <section className="p-4 rounded-2xl bg-bg-secondary border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">Official Handle</span>
              <span className="font-mono text-accent-primary">@{channel.username}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">Category</span>
              <span className="font-medium text-white">{channel.category || 'Music Label & Studio'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">Share URL</span>
              <span className="font-mono text-white/80 truncate max-w-[200px]">{shareUrl}</span>
            </div>
            <button
              onClick={() => navigate(`/artist/${channel.ownerId}`)}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors"
            >
              View Channel Owner Artist Profile →
            </button>
          </section>
        )}
      </div>

      <FollowListModal
        open={Boolean(followModal)}
        onClose={() => setFollowModal(null)}
        targetId={channel.ownerId}
        mode="followers"
        title={`Subscribers of @${channel.username}`}
      />

      {qrOpen && (
        <QRCard
          title={channel.name}
          subtitle={`@${channel.username} · mileymusic.space`}
          url={shareUrl}
          avatarUrl={channel.avatarUrl}
          onClose={() => setQrOpen(false)}
        />
      )}

      {reportOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setReportOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitReport}
            className="w-full max-w-sm rounded-3xl bg-bg-secondary border border-white/15 p-5 space-y-3"
          >
            <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Report @{channel.username}
            </h3>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-primary border border-white/10 text-xs"
            >
              <option>Copyright infringement</option>
              <option>Impersonation / fake channel</option>
              <option>Inappropriate or abusive content</option>
              <option>Spam or scam</option>
            </select>
            <textarea
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              rows={3}
              placeholder="Additional details for admins"
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-primary border border-white/10 text-xs"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="flex-1 py-2.5 rounded-full bg-white/5 text-xs text-text-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-full bg-red-500 text-white text-xs font-semibold"
              >
                {reportSent ? 'Reported ✓' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
