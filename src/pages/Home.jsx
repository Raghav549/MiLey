import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/auth'
import { useLiveShared } from '../lib/useLive'
import { usePlayer } from '../context/PlayerContext'
import { useNotifications } from '../hooks/useNotifications'
import Logo from '../components/Logo'
import { TrackCard, TrackRow, Cover } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import { SearchIcon, SparkleIcon, RadioIcon, PodcastIcon, RoomIcon, CalendarIcon, ChannelIcon, BellIcon, MessageIcon, UploadIcon } from '../components/icons'
import { MOOD_SUGGESTIONS, isPublicVisible } from '../musicHelpers'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const { history } = usePlayer()
  const { unread } = useNotifications()
  const { data: allTracks, loading } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })
  const { data: allPlaylists } = useLiveShared('playlists', { order: '-createdAt', limit: 120 })
  const { data: categories } = useLiveShared('categories', { order: 'name', limit: 200 })
  const { data: activeRooms } = useLiveShared('voice_rooms', { order: '-createdAt', limit: 20 })
  const [selectedMood, setSelectedMood] = useState('All')

  const publicTracks = useMemo(() => (allTracks || []).filter(isPublicVisible), [allTracks])
  const songs = useMemo(() => publicTracks.filter((t) => t.type !== 'podcast'), [publicTracks])
  const podcasts = useMemo(() => publicTracks.filter((t) => t.type === 'podcast'), [publicTracks])
  const publicPlaylists = useMemo(
    () => (allPlaylists || []).filter((p) => !p.visibility || p.visibility === 'public'),
    [allPlaylists]
  )

  const moods = useMemo(() => {
    const dynamic = (categories || []).filter((c) => c.kind === 'mood').map((c) => c.name)
    return ['All', ...Array.from(new Set([...MOOD_SUGGESTIONS, ...dynamic]))]
  }, [categories])

  const trending = useMemo(
    () => [...songs].sort((a, b) => (b.plays || 0) + (b.likesCount || 0) * 2 - ((a.plays || 0) + (a.likesCount || 0) * 2)).slice(0, 12),
    [songs]
  )

  const newReleases = useMemo(() => songs.slice(0, 12), [songs])

  const forYou = useMemo(() => {
    const topGenre = history[0]?.genre
    const pool = selectedMood === 'All'
      ? (topGenre ? songs.filter((t) => t.genre === topGenre) : songs)
      : songs.filter((t) => (t.mood || '').toLowerCase() === selectedMood.toLowerCase())
    return (pool.length ? pool : songs).slice(0, 12)
  }, [songs, history, selectedMood])

  const liveRoomCount = useMemo(() => (activeRooms || []).filter((r) => !r.ended).length, [activeRooms])

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] space-y-7 max-w-6xl mx-auto w-full">
      {/* Top header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 md:hidden">
          <Logo size={32} />
        </div>
        <div className="hidden md:block">
          <p className="text-xs text-white/40">{greeting()}</p>
          <h1 className="font-display font-bold text-2xl text-white">
            {user?.displayName || 'Welcome to MiLey'}
          </h1>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => navigate('/search')}
            className="flex items-center gap-2 card-surface rounded-2xl px-3.5 py-2 text-xs text-white/50 hover:text-white/80"
          >
            <SearchIcon size={16} />
            <span>Search songs, artists, podcasts…</span>
          </button>
          <button
            onClick={() => navigate('/messages')}
            aria-label="Messages"
            className="w-10 h-10 rounded-2xl card-surface flex items-center justify-center text-white/75 hover:text-white relative shrink-0"
          >
            <MessageIcon size={18} />
          </button>
          <button
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
            className="w-10 h-10 rounded-2xl card-surface flex items-center justify-center text-white/75 hover:text-white relative shrink-0"
          >
            <BellIcon size={18} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full btn-brand text-[10px] font-bold text-black flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Quick actions hub */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <QuickAction
          icon={<RoomIcon size={18} className="grad-brand-text" />}
          title="Voice Rooms"
          sub={liveRoomCount ? `${liveRoomCount} live now` : 'Host or join'}
          onClick={() => navigate('/rooms')}
        />
        <QuickAction
          icon={<UploadIcon size={18} className="grad-brand-text" />}
          title="Bulk Studio"
          sub="Direct song themes"
          onClick={() => navigate('/upload')}
        />
        <QuickAction
          icon={<CalendarIcon size={18} className="grad-brand-text" />}
          title="Premieres"
          sub="Live countdowns"
          onClick={() => navigate('/premieres')}
        />
        <QuickAction
          icon={<ChannelIcon size={18} className="grad-brand-text" />}
          title="My Channel"
          sub="Creator studio"
          onClick={() => navigate('/channel-dashboard')}
        />
      </div>

      {/* Mood filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar overscroll-x-contain py-1">
        {moods.map((m) => (
          <button
            key={m}
            onClick={() => setSelectedMood(m)}
            className={`px-4 py-2 rounded-full text-xs font-medium shrink-0 transition-all ${
              selectedMood === m ? 'btn-brand text-black' : 'card-surface text-white/70 hover:text-white'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {!loading && publicTracks.length === 0 && (
        <EmptyState
          icon={<SparkleIcon size={26} className="grad-brand-text" />}
          title="The stage is yours"
          subtitle="No public tracks have been uploaded yet. Be the first creator on MiLey — upload a song, album, or podcast."
          action={
            <button onClick={() => navigate('/upload')} className="btn-brand text-black font-semibold px-6 py-3 rounded-2xl text-sm">
              Upload First Track
            </button>
          }
        />
      )}

      {/*Recently played*/}
      {history.length > 0 && (
        <Section title="Recently Played" action={() => navigate('/library')}>
          <div className="flex gap-4 overflow-x-auto no-scrollbar overscroll-x-contain pb-1">
            {history.slice(0, 10).map((t) => (
              <TrackCard key={t.id} track={t} queueList={history} />
            ))}
          </div>
        </Section>
      )}

      {/* Recommended For You */}
      {forYou.length > 0 && (
        <Section
          title={selectedMood === 'All' ? 'Recommended For You' : `${selectedMood} Picks`}
          icon={<SparkleIcon size={18} className="grad-brand-text" />}
        >
          <div className="flex gap-4 overflow-x-auto no-scrollbar overscroll-x-contain pb-1">
            {forYou.map((t) => (
              <TrackCard key={t.id} track={t} queueList={forYou} />
            ))}
          </div>
        </Section>
      )}

      {/* Trending Songs */}
      {trending.length > 0 && (
        <Section title="Trending Songs" icon={<RadioIcon size={18} className="grad-brand-text" />} action={() => navigate('/explore')}>
          <div className="flex gap-4 overflow-x-auto no-scrollbar overscroll-x-contain pb-1">
            {trending.map((t) => (
              <TrackCard key={t.id} track={t} queueList={trending} />
            ))}
          </div>
        </Section>
      )}

      {/* New Releases */}
      {newReleases.length > 0 && (
        <Section title="New Releases">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {newReleases.slice(0, 6).map((t, i) => (
              <TrackRow key={t.id} track={t} queueList={newReleases} index={i} />
            ))}
          </div>
        </Section>
      )}

      {/* Popular Playlists */}
      {publicPlaylists.length > 0 && (
        <Section title="Popular Playlists" action={() => navigate('/explore')}>
          <div className="flex gap-4 overflow-x-auto no-scrollbar overscroll-x-contain pb-1">
            {publicPlaylists.slice(0, 10).map((pl) => (
              <button
                key={pl.id}
                onClick={() => navigate(`/playlist/${pl.id}`)}
                className="w-36 shrink-0 text-left group"
              >
                <div className="w-36 h-36">
                  <Cover track={{ title: pl.title, coverUrl: pl.coverUrl }} size={144} rounded="rounded-2xl" />
                </div>
                <p className="mt-2 text-sm font-medium text-white truncate">{pl.title}</p>
                <p className="text-xs text-white/45 truncate">by {pl.ownerName || 'MiLey'}</p>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Featured Podcasts */}
      {podcasts.length > 0 && (
        <Section title="Featured Podcasts" icon={<PodcastIcon size={18} className="grad-brand-text" />}>
          <div className="flex gap-4 overflow-x-auto no-scrollbar overscroll-x-contain pb-1">
            {podcasts.slice(0, 10).map((t) => (
              <TrackCard key={t.id} track={t} queueList={podcasts} />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, icon, action, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-display font-bold text-lg text-white">{title}</h2>
        </div>
        {action && (
          <button onClick={action} className="text-xs text-white/50 hover:text-white">
            See all
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function QuickAction({ icon, title, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="card-surface rounded-2xl p-3.5 flex items-center gap-3 text-left hover:bg-white/[0.06] transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white truncate">{title}</p>
        <p className="text-[11px] text-white/40 truncate">{sub}</p>
      </div>
    </button>
  )
}
