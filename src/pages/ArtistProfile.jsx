import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Play,
  UserPlus,
  Check,
  MessageCircle,
  BadgeCheck,
  Disc,
  Music,
  Flag,
  Radio,
  Sparkles,
  Share2,
  QrCode,
  Send,
  Award,
  Headphones,
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

export default function ArtistProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { playTrack } = usePlayer()
  const { isLiked, toggleLike } = useLikes()
  const { isFollowing, toggleFollow, getFollowerCount, getFollowingCount } = useFollows()
  const [profile, setProfile] = useState(null)
  const [followModal, setFollowModal] = useState(null) // 'followers' | 'following' | null
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('Impersonation / fake artist')
  const [reportNotes, setReportNotes] = useState('')
  const [reportSent, setReportSent] = useState(false)
  const [tab, setTab] = useState('tracks') // 'tracks' | 'albums' | 'fanwall' | 'about'
  const [qrOpen, setQrOpen] = useState(false)
  const [shoutoutText, setShoutoutText] = useState('')

  const { data: allTracks = [] } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })
  const { data: allAlbums = [] } = useLiveShared('albums', { order: '-createdAt', limit: 100 })
  const { data: allChannels = [] } = useLiveShared('channels', { order: '-createdAt', limit: 150 })
  const { data: shoutouts = [] } = useLiveShared('artist_shoutouts', {
    filters: { artistId: id },
    order: '-createdAt',
    limit: 50,
  })

  useEffect(() => {
    if (!id) return
    db.getShared('profiles', id)
      .then((p) => setProfile(p))
      .catch(() => {})
  }, [id])

  const artistTracks = useMemo(
    () => allTracks.filter((t) => t.artistId === id),
    [allTracks, id]
  )
  const artistAlbums = useMemo(
    () => allAlbums.filter((a) => a.artistId === id),
    [allAlbums, id]
  )
  const artistChannel = useMemo(
    () => allChannels.find((c) => c.ownerId === id),
    [allChannels, id]
  )

  const artistName =
    profile?.displayName || artistTracks[0]?.artistName || artistChannel?.name || 'Artist'
  const avatarUrl = profile?.avatarUrl || artistChannel?.avatarUrl || artistTracks[0]?.coverUrl || ''
  const bannerUrl = profile?.bannerUrl || artistChannel?.bannerUrl || ''
  const totalPlays = artistTracks.reduce((s, t) => s + (t.plays || 0), 0)
  const totalLikes = artistTracks.reduce((s, t) => s + (t.likes || 0), 0)
  const monthlyListeners = Math.max(totalPlays * 3 + getFollowerCount(id) * 18, artistTracks.length * 120)
  const me = auth.getCurrentUser()
  const following = isFollowing(id)
  const followers = getFollowerCount(id)
  const followingCount = getFollowingCount(id)

  const spotlightTrack = useMemo(() => {
    if (!artistTracks.length) return null
    if (profile?.spotlightTrackId) {
      const found = artistTracks.find((t) => t.id === profile.spotlightTrackId)
      if (found) return found
    }
    return [...artistTracks].sort((a, b) => (b.plays || 0) - (a.plays || 0))[0]
  }, [artistTracks, profile?.spotlightTrackId])

  const startChat = async () => {
    try {
      const ch = await messaging.createDM(id)
      if (ch?.id) navigate(`/messages/${ch.id}`)
      else navigate('/messages')
    } catch {
      navigate('/messages')
    }
  }

  const shareUrl = `${APP_DOMAIN}/#/artist/${id}`

  const handleShare = async () => {
    await share.link({
      title: `${artistName} on MiLey`,
      text: `Listen to ${artistName} on MiLey (${APP_DOMAIN.replace('https://', '')})`,
      url: shareUrl,
    })
  }

  const postShoutout = async (e) => {
    e.preventDefault()
    if (!shoutoutText.trim() || !me) return
    await db.insertShared(
      'artist_shoutouts',
      {
        artistId: id,
        authorId: me.id,
        authorName: me.displayName || 'MiLey Fan',
        authorAvatar: me.avatarUrl || '',
        message: shoutoutText.trim(),
      },
      undefined,
      { visibleTo: 'public' }
    )
    setShoutoutText('')
  }

  const submitReport = async (e) => {
    e.preventDefault()
    await db.insertShared(
      'reports',
      {
        targetType: 'artist',
        targetId: id,
        targetName: artistName,
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

  const spotlightTheme = getSongTheme(spotlightTrack)

  return (
    <div className="pb-10 max-w-2xl mx-auto">
      {/* Banner Header */}
      <div
        className="relative h-56 px-4 pt-4 flex flex-col justify-between overflow-hidden"
        style={{
          background: bannerUrl
            ? `linear-gradient(to bottom, rgba(11,11,11,0.25), #0B0B0B), url(${bannerUrl}) center/cover`
            : `linear-gradient(160deg, ${spotlightTheme.primaryColor}44, ${spotlightTheme.secondaryColor}25 55%, #0B0B0B 95%)`,
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
              onClick={handleShare}
              title="Share artist on mileymusic.space"
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white/85 hover:text-white border border-white/10"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setQrOpen(true)}
              title="Artist QR Card"
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white/85 hover:text-white border border-white/10"
            >
              <QrCode className="w-4 h-4" />
            </button>
            {me?.id !== id && (
              <button
                onClick={() => setReportOpen(true)}
                title="Report artist"
                className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-text-secondary hover:text-red-400 border border-white/10"
              >
                <Flag className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-end gap-4 pb-3 relative z-10">
          <div
            className="w-24 h-24 rounded-full overflow-hidden border-2 shadow-2xl shrink-0 flex items-center justify-center text-2xl font-bold text-black"
            style={{
              background: fallbackCover(artistName),
              borderColor: spotlightTheme.primaryColor,
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={artistName} className="w-full h-full object-cover" />
            ) : (
              artistName[0]
            )}
          </div>
          <div className="min-w-0 pb-1 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-primary/20 border border-accent-primary/40 text-accent-primary text-[10px] font-semibold uppercase tracking-wider">
                <Award className="w-3 h-3" />
                {profile?.artistBadge || 'Verified Artist'}
              </span>
              {profile?.customUsername && (
                <span className="text-[11px] font-mono text-white/70">
                  @{profile.customUsername}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <h1
                className="text-2xl font-extrabold truncate"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {artistName}
              </h1>
              <BadgeCheck className="w-5 h-5 text-accent-primary shrink-0" />
            </div>
            <div className="flex items-center gap-3 text-xs text-text-secondary mt-1 flex-wrap">
              <button
                onClick={() => setFollowModal('followers')}
                className="hover:text-text-primary transition-colors"
              >
                <strong className="text-text-primary">{formatCount(followers)}</strong> followers
              </button>
              <span>·</span>
              <button
                onClick={() => setFollowModal('following')}
                className="hover:text-text-primary transition-colors"
              >
                <strong className="text-text-primary">{formatCount(followingCount)}</strong> following
              </button>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-accent-primary font-medium">
                <Headphones className="w-3 h-3" /> {formatCount(monthlyListeners)} monthly listeners
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-5 mt-3">
        {profile?.bio && (
          <p className="text-xs text-text-secondary leading-relaxed">{profile.bio}</p>
        )}

        {/* Official Creator Channel Banner (if artist owns a channel) */}
        {artistChannel && (
          <div
            onClick={() => navigate(`/channel/${artistChannel.username}`)}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-accent-primary/15 via-white/[0.04] to-accent-secondary/15 border border-accent-primary/30 flex items-center justify-between gap-3 cursor-pointer hover:border-accent-primary/60 transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-accent-primary/20 flex items-center justify-center text-accent-primary shrink-0">
                <Radio className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold text-white truncate">
                    Official Channel · {artistChannel.name}
                  </p>
                  {artistChannel.verified && (
                    <BadgeCheck className="w-3.5 h-3.5 text-accent-primary shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-text-secondary truncate">
                  @{artistChannel.username} · Visit official channel &amp; drops →
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-accent-primary text-[#0B0B0B] text-[11px] font-bold shrink-0">
              Open Channel
            </span>
          </div>
        )}

        {/* Action Row */}
        <div className="flex items-center gap-2.5">
          {artistTracks.length > 0 && (
            <button
              onClick={() => playTrack(artistTracks[0], artistTracks)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent-primary text-[#0B0B0B] text-xs font-bold shadow-lg shadow-accent-primary/25"
            >
              <Play className="w-4 h-4 fill-current" /> Play All
            </button>
          )}
          {me?.id !== id && (
            <>
              <button
                onClick={() =>
                  toggleFollow(id, {
                    targetType: 'artist',
                    targetName: artistName,
                    targetAvatar: avatarUrl,
                    targetUsername: profile?.customUsername || '',
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
                    <Check className="w-3.5 h-3.5" /> Following ({formatCount(followers)})
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" /> Follow Artist
                  </>
                )}
              </button>
              <button
                onClick={startChat}
                className="p-2.5 rounded-full bg-bg-secondary border border-white/15 text-text-primary hover:border-white/30"
                aria-label="Message artist"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Artist Spotlight Track Card */}
        {spotlightTrack && (
          <div
            onClick={() => playTrack(spotlightTrack, artistTracks)}
            className="relative p-3.5 rounded-2xl border overflow-hidden cursor-pointer group transition-all hover:scale-[1.01]"
            style={{
              borderColor: `${spotlightTheme.primaryColor}55`,
              background: spotlightTheme.bgStyle,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/20 relative">
                  {spotlightTrack.coverUrl && (
                    <img
                      src={spotlightTrack.coverUrl}
                      alt={spotlightTrack.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                    <Play className="w-5 h-5 text-white fill-current" />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: spotlightTheme.primaryColor }}
                    >
                      <Sparkles className="w-3 h-3" /> Artist Spotlight · {spotlightTheme.name}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-white truncate mt-0.5">
                    {spotlightTrack.title}
                  </p>
                  <p className="text-xs text-white/65 truncate">
                    {formatCount(spotlightTrack.plays || 0)} plays · {spotlightTrack.genre}
                  </p>
                </div>
              </div>
              <span
                className="px-3 py-1.5 rounded-full text-[11px] font-bold text-[#0B0B0B] shrink-0"
                style={{ backgroundColor: spotlightTheme.primaryColor }}
              >
                Spin Track
              </span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-bg-secondary border border-white/5 text-xs font-semibold">
          {[
            { id: 'tracks', label: `Tracks (${artistTracks.length})` },
            { id: 'albums', label: `Albums (${artistAlbums.length})` },
            { id: 'fanwall', label: `Fan Wall (${shoutouts.length})` },
            { id: 'about', label: 'About' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-2 rounded-xl transition-colors ${
                tab === t.id ? 'bg-accent-primary text-[#0B0B0B]' : 'text-text-secondary hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tracks Tab */}
        {tab === 'tracks' && (
          <section className="space-y-2">
            {artistTracks.length === 0 ? (
              <p className="text-xs text-text-secondary py-6 text-center">No tracks uploaded yet.</p>
            ) : (
              <div className="space-y-1">
                {artistTracks.map((t, i) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    list={artistTracks}
                    index={i}
                    isLiked={isLiked(t.id)}
                    onToggleLike={toggleLike}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Albums Tab */}
        {tab === 'albums' && (
          <section className="space-y-2.5">
            {artistAlbums.length === 0 ? (
              <p className="text-xs text-text-secondary py-6 text-center">No albums released yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {artistAlbums.map((a) => (
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

        {/* Fan Wall (Shoutouts) Tab */}
        {tab === 'fanwall' && (
          <section className="space-y-3">
            <form
              onSubmit={postShoutout}
              className="flex gap-2 p-2.5 rounded-2xl bg-bg-secondary border border-white/10"
            >
              <input
                value={shoutoutText}
                onChange={(e) => setShoutoutText(e.target.value)}
                placeholder={`Drop a fan shoutout for ${artistName}...`}
                className="flex-1 bg-transparent px-2 text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-accent-primary text-[#0B0B0B] text-xs font-bold flex items-center gap-1"
              >
                <Send className="w-3 h-3" /> Post
              </button>
            </form>

            {shoutouts.length === 0 ? (
              <p className="text-xs text-text-secondary text-center py-6">
                Be the first fan to drop a shoutout on {artistName}&apos;s wall!
              </p>
            ) : (
              <div className="space-y-2">
                {shoutouts.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-2xl bg-bg-secondary border border-white/5 flex items-start gap-2.5"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
                      style={{ background: fallbackCover(s.authorName || 'Fan') }}
                    >
                      {(s.authorName || 'F')[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white">{s.authorName}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{s.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* About Tab */}
        {tab === 'about' && (
          <section className="p-4 rounded-2xl bg-bg-secondary border border-white/10 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-base font-bold text-accent-primary">{formatCount(totalPlays)}</p>
                <p className="text-[10px] text-text-secondary uppercase">Total Streams</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-base font-bold text-accent-secondary">{formatCount(totalLikes)}</p>
                <p className="text-[10px] text-text-secondary uppercase">Track Likes</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-base font-bold text-white">{formatCount(followers)}</p>
                <p className="text-[10px] text-text-secondary uppercase">Followers</p>
              </div>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {profile?.bio || `${artistName} is an official creator on MiLey (${APP_DOMAIN.replace('https://', '')}).`}
            </p>
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-text-secondary">
              <span>Canonical Artist URL</span>
              <span className="text-accent-primary truncate max-w-[220px]">{shareUrl}</span>
            </div>
          </section>
        )}
      </div>

      <FollowListModal
        open={Boolean(followModal)}
        onClose={() => setFollowModal(null)}
        targetId={id}
        mode={followModal || 'followers'}
      />

      {qrOpen && (
        <QRCard
          title={artistName}
          subtitle={`Official Artist on mileymusic.space`}
          url={shareUrl}
          avatarUrl={avatarUrl}
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
              Report {artistName}
            </h3>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-primary border border-white/10 text-xs"
            >
              <option>Impersonation / fake artist</option>
              <option>Copyright infringement</option>
              <option>Inappropriate content</option>
              <option>Spam or scam</option>
            </select>
            <textarea
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              rows={3}
              placeholder="Details for admins (optional)"
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
