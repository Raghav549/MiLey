import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  Flame,
  Sparkles,
  Disc,
  Radio,
  Upload as UploadIcon,
  MessageCircle,
  Calendar,
  Bell,
  BadgeCheck,
  Layers,
} from 'lucide-react'
import { useLiveShared } from '../lib/useLive'
import { usePlayer } from '../context/PlayerContext'
import { useLikes } from '../hooks/useLikes'
import { useNotifications } from '../hooks/useNotifications'
import Logo from '../components/Logo'
import { TrackCard, TrackRow } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import { MOODS, fallbackCover, getSongTheme } from '../musicHelpers'

export default function Home() {
  const navigate = useNavigate()
  const { playTrack } = usePlayer()
  const { isLiked, toggleLike } = useLikes()
  const { unreadCount } = useNotifications()

  const { data: tracks = [], loading } = useLiveShared('tracks', {
    order: '-createdAt',
    limit: 200,
  })
  const { data: rooms = [] } = useLiveShared('rooms', { order: '-createdAt', limit: 20 })
  const { data: channels = [] } = useLiveShared('channels', { order: '-createdAt', limit: 30 })

  const trending = useMemo(
    () =>
      [...tracks]
        .sort((a, b) => (b.plays || 0) + (b.likes || 0) * 3 - ((a.plays || 0) + (a.likes || 0) * 3))
        .slice(0, 10),
    [tracks]
  )

  const featured = trending[0] || tracks[0]
  const featuredTheme = getSongTheme(featured)

  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto space-y-7">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div
          onClick={() => window.dispatchEvent(new CustomEvent('miley:replay-splash'))}
          className="cursor-pointer"
          title="Tap to replay Animated Splash Screen"
        >
          <Logo size={32} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/premieres')}
            aria-label="Premieres"
            className="p-2 rounded-full bg-bg-secondary border border-white/10 text-text-secondary hover:text-text-primary"
          >
            <Calendar className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/rooms')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-secondary border border-white/10 text-xs font-medium hover:border-accent-primary/40"
          >
            <Radio className="w-3.5 h-3.5 text-accent-secondary animate-pulse" />
            <span>Rooms {rooms.length > 0 ? `(${rooms.length})` : ''}</span>
          </button>
          <button
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
            className="relative p-2 rounded-full bg-bg-secondary border border-white/10 text-text-secondary hover:text-text-primary"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent-secondary text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('/messages')}
            aria-label="Messages"
            className="p-2 rounded-full bg-bg-secondary border border-white/10 text-text-secondary hover:text-text-primary"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Featured Banner with Active Song Theme */}
      {featured ? (
        <div
          onClick={() => playTrack(featured, tracks)}
          className="relative rounded-3xl overflow-hidden p-5 cursor-pointer border shadow-xl transition-all hover:scale-[1.005]"
          style={{
            borderColor: `${featuredTheme.primaryColor}55`,
            background: featured.coverUrl
              ? `linear-gradient(125deg, rgba(11,11,11,0.92) 25%, ${featuredTheme.primaryColor}33 100%), url(${featured.coverUrl}) center/cover`
              : featuredTheme.bgStyle,
          }}
        >
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/60 border border-white/15"
            style={{ color: featuredTheme.primaryColor }}
          >
            <Flame className="w-3.5 h-3.5" /> Featured Track · {featuredTheme.name}
          </span>
          <h1
            className="mt-3 text-2xl sm:text-3xl font-bold leading-tight line-clamp-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {featured.title}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {featured.artistName || 'Unknown Artist'}{' '}
            {featured.genre ? `· ${featured.genre}` : ''}
          </p>
          <div className="mt-4 flex items-center gap-2.5 flex-wrap">
            <button
              onClick={(e) => {
                e.stopPropagation()
                playTrack(featured, tracks)
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[#0B0B0B] font-semibold text-sm shadow-lg"
              style={{ backgroundColor: featuredTheme.primaryColor }}
            >
              <Play className="w-4 h-4 fill-current" /> Play Now
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate('/upload?mode=bulk')
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white"
            >
              <Layers className="w-3.5 h-3.5 text-accent-primary" /> Bulk Upload + Themes
            </button>
          </div>
        </div>
      ) : (
        !loading && (
          <EmptyState
            icon={Disc}
            title="Welcome to MiLey — Drop the First Beat"
            subtitle="Upload songs or albums with Direct Song Themes on mileymusic.space."
            action={
              <button
                onClick={() => navigate('/upload?mode=bulk')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent-primary text-[#0B0B0B] font-semibold text-xs"
              >
                <UploadIcon className="w-4 h-4" /> Bulk Upload Tracks + Themes
              </button>
            }
          />
        )
      )}

      {/* Mood Quick Filters */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Vibe by Mood
          </h2>
          <button
            onClick={() => navigate('/explore')}
            className="text-xs text-accent-primary font-medium"
          >
            See all
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {MOODS.slice(0, 8).map((m) => (
            <button
              key={m.id}
              onClick={() => navigate(`/explore?mood=${m.id}`)}
              className={`p-3 rounded-2xl bg-gradient-to-br ${m.gradient} border border-white/10 text-left hover:scale-[1.02] transition-transform`}
            >
              <span
                className="block w-2.5 h-2.5 rounded-full mb-2"
                style={{ background: m.color }}
              />
              <span className="text-xs font-semibold">{m.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Creator Channels */}
      {channels.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-base font-bold flex items-center gap-1.5"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <Radio className="w-4 h-4 text-accent-primary" /> Creator Channels
            </h2>
            <button
              onClick={() => navigate('/channel-setup')}
              className="text-xs text-accent-primary font-medium"
            >
              Your Channel
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {channels.slice(0, 12).map((ch) => (
              <div
                key={ch.id}
                onClick={() => navigate(`/channel/${ch.username}`)}
                className="w-28 shrink-0 p-2.5 rounded-2xl bg-bg-secondary border border-white/5 hover:border-accent-primary/40 cursor-pointer text-center"
              >
                <div
                  className="w-14 h-14 rounded-2xl mx-auto overflow-hidden flex items-center justify-center text-base font-bold text-black mb-1.5"
                  style={{ background: fallbackCover(ch.name) }}
                >
                  {ch.avatarUrl ? (
                    <img
                      src={ch.avatarUrl}
                      alt={ch.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (ch.name || 'C')[0]
                  )}
                </div>
                <div className="flex items-center justify-center gap-0.5">
                  <p className="text-xs font-semibold truncate">{ch.name}</p>
                  {ch.verified && (
                    <BadgeCheck className="w-3.5 h-3.5 text-accent-primary shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-text-secondary font-mono truncate">
                  @{ch.username}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trending Carousel */}
      {trending.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-base font-bold flex items-center gap-1.5"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <Flame className="w-4 h-4 text-accent-secondary" /> Trending Right Now
            </h2>
          </div>
          <div className="flex gap-3.5 overflow-x-auto pb-2 -mx-4 px-4">
            {trending.map((t) => (
              <TrackCard
                key={t.id}
                track={t}
                list={trending}
                isLiked={isLiked(t.id)}
                onToggleLike={toggleLike}
              />
            ))}
          </div>
        </section>
      )}

      {/* Fresh Releases */}
      {tracks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2
              className="text-base font-bold flex items-center gap-1.5"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <Sparkles className="w-4 h-4 text-accent-primary" /> Fresh Drops
            </h2>
            <span className="text-xs text-text-secondary">{tracks.length} tracks</span>
          </div>
          <div className="space-y-1">
            {tracks.slice(0, 15).map((t, i) => (
              <TrackRow
                key={t.id}
                track={t}
                list={tracks}
                index={i}
                isLiked={isLiked(t.id)}
                onToggleLike={toggleLike}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
