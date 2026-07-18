import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { useFollows } from '../hooks/useFollows'
import { SectionRow, TrackCard, Cover } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import Logo from '../components/Logo'
import { isPublicVisible, formatDuration } from '../musicHelpers'
import { UploadIcon, ChartIcon, PodcastIcon, LiveIcon, UsersIcon, SearchIcon, MessageIcon, BellIcon, RoomIcon, CalendarIcon, VerifiedIcon, ChannelIcon } from '../components/icons'
import { usePlayer } from '../context/PlayerContext'
import { useNotifications, useUnreadMessageCount } from '../hooks/useNotifications'
import { useLiveShared as useLiveSharedRooms } from '../lib/useLive'

export default function Home() {
  const navigate = useNavigate()
  const { data: allTracks, loading: tracksLoading } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })
  const { data: albums, loading: albumsLoading } = useLiveShared('albums', { order: '-createdAt', limit: 40 })
  const { data: playlists } = useLiveShared('playlists', { order: '-createdAt', limit: 60 })
  const { data: channels } = useLiveShared('channels', { order: '-createdAt', limit: 40 })
  const { isFollowing } = useFollows()
  const { playQueue } = usePlayer()
  const { unreadCount } = useNotifications()
  const unreadMsgCount = useUnreadMessageCount()
  const { data: liveRooms } = useLiveSharedRooms('voice_rooms', { order: '-createdAt', limit: 10 })
  const { data: premieres } = useLiveSharedRooms('premieres', { order: 'scheduledAt', limit: 6 })
  const activeRooms = (liveRooms || []).filter((r) => !r.ended && r.visibility !== 'private')
  const upcomingPremieres = (premieres || []).filter((p) => new Date(p.scheduledAt).getTime() > Date.now() - 3600000)

  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!auth.isAuthenticated()) return
    db.select('history', {}, { limit: 40, order: '-createdAt' }).then(setHistory).catch(() => {})
  }, [])

  const publicTracks = useMemo(() => (allTracks || []).filter(isPublicVisible), [allTracks])
  const songs = useMemo(() => publicTracks.filter((t) => t.type !== 'podcast'), [publicTracks])
  const podcasts = useMemo(() => publicTracks.filter((t) => t.type === 'podcast'), [publicTracks])

  const newReleases = songs.slice(0, 14)
  const trending = useMemo(() => [...songs].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 14), [songs])
  const charts = trending.slice(0, 10)

  const dedupHistory = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const h of history) {
      if (seen.has(h.trackId)) continue
      seen.add(h.trackId)
      out.push({ ...h, id: h.trackId })
    }
    return out
  }, [history])
  const continueListening = dedupHistory.slice(0, 6)
  const recentlyPlayed = dedupHistory.slice(0, 14)

  const friendActivity = useMemo(
    () => songs.filter((t) => t.artistId && isFollowing(t.artistId)).slice(0, 14),
    [songs, isFollowing]
  )

  const publicPlaylists = useMemo(() => (playlists || []).filter((p) => !p.visibility || p.visibility === 'public'), [playlists])
  const moodCollections = publicPlaylists.filter((p) => p.mood)
  const genreCollections = publicPlaylists.filter((p) => p.genre)
  const recommendedPlaylists = publicPlaylists.slice(0, 14)
  const communityPicks = publicPlaylists.filter((p) => p.isCommunityPick)

  const loading = tracksLoading || albumsLoading
  const isEmpty = !loading && publicTracks.length === 0

  if (isEmpty) {
    return (
      <div className="h-full px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <Logo size={30} />
        <EmptyState
          icon={<UploadIcon size={26} className="grad-brand-text" />}
          title="The stage is empty — for now"
          subtitle="MiLey starts with zero fake songs. Be the first to upload a track, album or podcast and it'll appear here for the world."
          action={
            <button onClick={() => navigate('/upload')} className="btn-brand text-black font-semibold px-6 py-3 rounded-2xl text-sm">
              Upload your first track
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <Logo size={28} />
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/messages')} className="relative w-10 h-10 rounded-full card-surface flex items-center justify-center text-white/60">
            <MessageIcon size={17} />
            {unreadMsgCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full grad-brand text-[9px] font-bold text-black flex items-center justify-center">{unreadMsgCount}</span>}
          </button>
          <button onClick={() => navigate('/notifications')} className="relative w-10 h-10 rounded-full card-surface flex items-center justify-center text-white/60">
            <BellIcon size={17} />
            {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full grad-brand text-[9px] font-bold text-black flex items-center justify-center">{unreadCount}</span>}
          </button>
          <button onClick={() => navigate('/search')} className="w-10 h-10 rounded-full card-surface flex items-center justify-center text-white/60">
            <SearchIcon size={18} />
          </button>
        </div>
      </div>

      {continueListening.length > 0 && (
        <SectionRow title="Continue Listening">
          {continueListening.map((t) => <TrackCard key={t.id} track={t} queueList={continueListening} wide />)}
        </SectionRow>
      )}

      {recentlyPlayed.length > 0 && (
        <SectionRow title="Recently Played">
          {recentlyPlayed.map((t) => <TrackCard key={t.id} track={t} queueList={recentlyPlayed} />)}
        </SectionRow>
      )}

      {trending.length > 0 && (
        <SectionRow title="Trending Now">
          {trending.map((t) => <TrackCard key={t.id} track={t} queueList={trending} />)}
        </SectionRow>
      )}

      {newReleases.length > 0 && (
        <SectionRow title="New Releases">
          {newReleases.map((t) => <TrackCard key={t.id} track={t} queueList={newReleases} />)}
        </SectionRow>
      )}

      {charts.length > 0 && (
        <section className="mb-7">
          <div className="flex items-center gap-2 mb-3 px-1">
            <ChartIcon size={17} className="grad-brand-text" />
            <h2 className="font-display font-bold text-lg text-white">Charts</h2>
          </div>
          <div className="card-surface rounded-2xl p-2 md:p-3">
            {charts.map((t, i) => (
              <button key={t.id} onClick={() => playQueue(charts, i)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5">
                <span className="w-6 text-center font-display font-bold text-white/30">{i + 1}</span>
                <Cover track={t} size={44} />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-white truncate">{t.title}</p>
                  <p className="text-xs text-white/40 truncate">{t.artistName}</p>
                </div>
                <span className="text-xs text-white/30">{t.plays || 0} plays</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {albums && albums.length > 0 && (
        <SectionRow title="Albums" onSeeAll={() => navigate('/explore')}>
          {albums.map((a) => (
            <button key={a.id} onClick={() => navigate(`/album/${a.id}`)} className="text-left shrink-0 w-32 md:w-40">
              <div className="relative aspect-square"><Cover track={{ title: a.title, coverUrl: a.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
              <p className="mt-2 text-sm font-medium text-white truncate">{a.title}</p>
              <p className="text-xs text-white/40 truncate">{a.artistName}</p>
            </button>
          ))}
        </SectionRow>
      )}

      {channels && channels.filter((c) => c.status === 'approved' || !c.status).length > 0 && (
        <SectionRow title="Channels">
          {channels.filter((c) => (c.status === 'approved' || !c.status)).map((c) => (
            <button key={c.id} onClick={() => navigate(`/channel/${c.username}`)} className="text-left shrink-0 w-24 md:w-28 flex flex-col items-center">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border border-white/10 bg-gradient-to-br from-emerald-500/30 to-pink-500/30 flex items-center justify-center">
                {c.avatarUrl ? <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" /> : <ChannelIcon size={24} className="text-white/60" />}
              </div>
              <div className="mt-2 flex items-center gap-1 max-w-full">
                <p className="text-xs font-medium text-white truncate">{c.name}</p>
                {c.verified && <VerifiedIcon size={12} className="grad-brand-text shrink-0" />}
              </div>
            </button>
          ))}
        </SectionRow>
      )}

      {recommendedPlaylists.length > 0 && (
        <SectionRow title="Recommended Playlists">
          {recommendedPlaylists.map((p) => (
            <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="text-left shrink-0 w-32 md:w-40">
              <div className="relative aspect-square"><Cover track={{ title: p.title, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
              <p className="mt-2 text-sm font-medium text-white truncate">{p.title}</p>
              <p className="text-xs text-white/40 truncate">By {p.ownerName || 'MiLey user'}</p>
            </button>
          ))}
        </SectionRow>
      )}

      {moodCollections.length > 0 && (
        <SectionRow title="Mood Collections">
          {moodCollections.map((p) => (
            <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="text-left shrink-0 w-32 md:w-40">
              <div className="relative aspect-square"><Cover track={{ title: p.mood, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
              <p className="mt-2 text-sm font-medium text-white truncate">{p.mood}</p>
              <p className="text-xs text-white/40 truncate">{p.title}</p>
            </button>
          ))}
        </SectionRow>
      )}

      {genreCollections.length > 0 && (
        <SectionRow title="Genre Collections">
          {genreCollections.map((p) => (
            <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="text-left shrink-0 w-32 md:w-40">
              <div className="relative aspect-square"><Cover track={{ title: p.genre, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
              <p className="mt-2 text-sm font-medium text-white truncate">{p.genre}</p>
              <p className="text-xs text-white/40 truncate">{p.title}</p>
            </button>
          ))}
        </SectionRow>
      )}

      {podcasts.length > 0 && (
        <section className="mb-7">
          <div className="flex items-center gap-2 mb-3 px-1"><PodcastIcon size={17} className="grad-brand-text" /><h2 className="font-display font-bold text-lg text-white">Podcasts</h2></div>
          <div className="flex gap-3.5 overflow-x-auto no-scrollbar overscroll-x-contain px-1">
            {podcasts.map((t) => <TrackCard key={t.id} track={t} queueList={podcasts} />)}
          </div>
        </section>
      )}

      <section className="mb-7">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2"><LiveIcon size={17} className="grad-brand-text" /><h2 className="font-display font-bold text-lg text-white">Voice Rooms</h2></div>
          <button onClick={() => navigate('/rooms')} className="text-xs font-medium text-white/40">See all</button>
        </div>
        {activeRooms.length === 0 ? (
          <div className="card-surface rounded-2xl p-5 text-sm text-white/40">No live voice rooms right now — <button onClick={() => navigate('/rooms')} className="grad-brand-text font-medium">start one</button> and listen in sync with friends.</div>
        ) : (
          <div className="flex gap-3.5 overflow-x-auto no-scrollbar overscroll-x-contain px-1">
            {activeRooms.map((r) => (
              <button key={r.id} onClick={() => navigate(`/rooms/${r.id}`)} className="card-surface rounded-2xl p-3 shrink-0 w-40 text-left">
                <div className="w-full aspect-square mb-2"><Cover track={{ title: r.name, coverUrl: r.coverUrl }} size="fill" rounded="rounded-xl" /></div>
                <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-[rgb(var(--color-secondary))] animate-pulse" /><span className="text-xs text-white/40">Live</span></div>
                <p className="text-sm font-medium text-white truncate">{r.name}</p>
                <p className="text-xs text-white/40 truncate">by {r.hostName}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      {upcomingPremieres.length > 0 && (
        <section className="mb-7">
          <div className="flex items-center gap-2 mb-3 px-1"><CalendarIcon size={17} className="grad-brand-text" /><h2 className="font-display font-bold text-lg text-white">Music Premieres</h2></div>
          <div className="flex gap-3.5 overflow-x-auto no-scrollbar overscroll-x-contain px-1">
            {upcomingPremieres.map((p) => (
              <button key={p.id} onClick={() => navigate(`/premieres/${p.id}`)} className="text-left shrink-0 w-32 md:w-40">
                <div className="relative aspect-square"><Cover track={{ title: p.title, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                <p className="mt-2 text-sm font-medium text-white truncate">{p.title}</p>
                <p className="text-xs text-white/40 truncate">{new Date(p.scheduledAt).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {communityPicks.length > 0 && (
        <SectionRow title="Community Picks">
          {communityPicks.map((p) => (
            <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="text-left shrink-0 w-32 md:w-40">
              <div className="relative aspect-square"><Cover track={{ title: p.title, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
              <p className="mt-2 text-sm font-medium text-white truncate">{p.title}</p>
            </button>
          ))}
        </SectionRow>
      )}

      {friendActivity.length > 0 && (
        <section className="mb-7">
          <div className="flex items-center gap-2 mb-3 px-1"><UsersIcon size={17} className="grad-brand-text" /><h2 className="font-display font-bold text-lg text-white">Friend Activity</h2></div>
          <div className="flex gap-3.5 overflow-x-auto no-scrollbar overscroll-x-contain px-1">
            {friendActivity.map((t) => <TrackCard key={t.id} track={t} queueList={friendActivity} />)}
          </div>
        </section>
      )}
    </div>
  )
}
