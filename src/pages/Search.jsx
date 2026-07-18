import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { social } from '../lib/social'
import { TrackRow, Cover } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import { BackIcon, SearchIcon, MicIcon, FilterIcon, CloseIcon, ChannelIcon, ChartIcon, VerifiedIcon } from '../components/icons'
import { GENRE_SUGGESTIONS, LANGUAGE_SUGGESTIONS, MOOD_SUGGESTIONS, isPublicVisible } from '../musicHelpers'
import { useLiveShared } from '../lib/useLive'

const RECENT_KEY = 'miley_recent_searches'

export default function Search() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [tracks, setTracks] = useState([])
  const [albums, setAlbums] = useState([])
  const [artists, setArtists] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ language: '', genre: '', mood: '', duration: '', sort: 'relevance' })
  const [listening, setListening] = useState(false)
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch (e) { return [] } })
  const debounceRef = useRef(null)
  const recognitionRef = useRef(null)

  const { data: allTracksForTrending } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })

  const trendingSearches = useMemo(() => {
    const pubTracks = (allTracksForTrending || []).filter(isPublicVisible)
    return [...pubTracks].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 6).map((t) => t.title)
  }, [allTracksForTrending])

  const runSearch = (term) => setQ(term)

  const saveRecent = (term) => {
    if (!term.trim()) return
    setRecent((r) => {
      const next = [term, ...r.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, 8)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch (e) { /* ignore */ }
      return next
    })
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setTracks([]); setAlbums([]); setArtists([]); setPlaylists([]); setChannels([]); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const [t, a, p, ar, ch] = await Promise.all([
          db.searchShared('tracks', q, { fields: ['title', 'artistName', 'lyrics'], limit: 60 }),
          db.searchShared('albums', q, { fields: ['title', 'artistName'], limit: 20 }),
          db.searchShared('playlists', q, { fields: ['title'], limit: 20 }),
          social.searchUsers(q.trim()).catch(() => []),
          db.searchShared('channels', q, { fields: ['name', 'username'], limit: 20 }),
        ])
        setTracks(t.filter(isPublicVisible))
        setAlbums(a)
        setPlaylists(p.filter((pl) => !pl.visibility || pl.visibility === 'public'))
        setArtists(ar)
        setChannels(ch.filter((c) => c.status === 'approved' || !c.status))
        saveRecent(q.trim())
      } catch (e) { /* ignore */ }
      setLoading(false)
    }, 300)
  }, [q])

  const filteredTracks = useMemo(() => {
    let list = [...tracks]
    if (filters.language) list = list.filter((t) => (t.language || '').toLowerCase() === filters.language.toLowerCase())
    if (filters.genre) list = list.filter((t) => (t.genre || '').toLowerCase() === filters.genre.toLowerCase())
    if (filters.mood) list = list.filter((t) => (t.mood || '').toLowerCase() === filters.mood.toLowerCase())
    if (filters.duration === 'short') list = list.filter((t) => (t.duration || 0) < 180)
    if (filters.duration === 'medium') list = list.filter((t) => (t.duration || 0) >= 180 && (t.duration || 0) <= 360)
    if (filters.duration === 'long') list = list.filter((t) => (t.duration || 0) > 360)
    if (filters.sort === 'popularity') list.sort((a, b) => (b.plays || 0) - (a.plays || 0))
    if (filters.sort === 'newest') list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return list
  }, [tracks, filters])

  const startVoiceSearch = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    recognitionRef.current = rec
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript
      setQ(text)
    }
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.start()
  }

  const hasResults = filteredTracks.length || albums.length || playlists.length || artists.length || channels.length

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/60"><BackIcon size={22} /></button>
        <div className="flex-1 flex items-center gap-2 card-surface rounded-2xl px-4 py-2.5">
          <SearchIcon size={17} className="text-white/40 shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Songs, artists, albums, lyrics…"
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30"
          />
          {q && <button onClick={() => setQ('')} className="text-white/30"><CloseIcon size={14} /></button>}
        </div>
        {typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition) && (
          <button onClick={startVoiceSearch} className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${listening ? 'btn-brand' : 'card-surface text-white/50'}`}>
            <MicIcon size={18} color={listening ? '#0B0B0B' : undefined} />
          </button>
        )}
        <button onClick={() => setShowFilters((s) => !s)} className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${showFilters ? 'btn-brand' : 'card-surface text-white/50'}`}>
          <FilterIcon size={18} color={showFilters ? '#0B0B0B' : undefined} />
        </button>
      </div>

      {showFilters && (
        <div className="card-surface rounded-2xl p-4 mb-5 space-y-3 animate-fade-up">
          <FilterRow label="Language" value={filters.language} options={LANGUAGE_SUGGESTIONS} onChange={(v) => setFilters((f) => ({ ...f, language: v }))} />
          <FilterRow label="Genre" value={filters.genre} options={GENRE_SUGGESTIONS} onChange={(v) => setFilters((f) => ({ ...f, genre: v }))} />
          <FilterRow label="Mood" value={filters.mood} options={MOOD_SUGGESTIONS} onChange={(v) => setFilters((f) => ({ ...f, mood: v }))} />
          <FilterRow label="Duration" value={filters.duration} options={['short', 'medium', 'long']} labels={{ short: '< 3 min', medium: '3–6 min', long: '> 6 min' }} onChange={(v) => setFilters((f) => ({ ...f, duration: v }))} />
          <FilterRow label="Sort" value={filters.sort} options={['relevance', 'popularity', 'newest']} onChange={(v) => setFilters((f) => ({ ...f, sort: v }))} />
        </div>
      )}

      {!q.trim() && (
        <div className="animate-fade-up">
          {recent.length > 0 && (
            <Section title="Recently Searched">
              <div className="flex flex-wrap gap-2">
                {recent.map((r) => <button key={r} onClick={() => runSearch(r)} className="px-3 py-1.5 rounded-full text-xs bg-white/5 text-white/60">{r}</button>)}
              </div>
            </Section>
          )}
          {trendingSearches.length > 0 && (
            <Section title="Trending Searches">
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map((r) => <button key={r} onClick={() => runSearch(r)} className="px-3 py-1.5 rounded-full text-xs card-surface grad-brand-text flex items-center gap-1"><ChartIcon size={11} /> {r}</button>)}
              </div>
            </Section>
          )}
          <EmptyState icon={<SearchIcon size={24} className="grad-brand-text" />} title="Find your next favorite" subtitle="Search by track title, artist, album, playlist, channel, or even a lyric line." />
        </div>
      )}

      {q.trim() && !loading && !hasResults && (
        <EmptyState icon={<SearchIcon size={24} className="grad-brand-text" />} title={`No results for "${q}"`} subtitle="Try a different keyword or check your filters." />
      )}

      {artists.length > 0 && (
        <Section title="Users">
          <div className="flex gap-3 overflow-x-auto no-scrollbar overscroll-x-contain">
            {artists.map((p) => (
              <button key={p.id} onClick={() => navigate(`/artist/${p.id}`)} className="flex flex-col items-center gap-2 shrink-0 w-20">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/30 to-pink-500/30 flex items-center justify-center border border-white/10">
                  {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : <span className="font-display font-bold">{(p.displayName || '?')[0]}</span>}
                </div>
                <span className="text-xs text-white/70 truncate w-full text-center">{p.displayName}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {filteredTracks.length > 0 && (
        <Section title="Songs">
          <div className="space-y-0.5">
            {filteredTracks.map((t) => <TrackRow key={t.id} track={t} queueList={filteredTracks} showMenu={false} />)}
          </div>
        </Section>
      )}

      {albums.length > 0 && (
        <Section title="Albums">
          <div className="flex gap-3 overflow-x-auto no-scrollbar overscroll-x-contain">
            {albums.map((a) => (
              <button key={a.id} onClick={() => navigate(`/album/${a.id}`)} className="shrink-0 w-32 text-left">
                <div className="relative aspect-square"><Cover track={{ title: a.title, coverUrl: a.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                <p className="mt-2 text-sm text-white truncate">{a.title}</p>
              </button>
            ))}
          </div>
        </Section>
      )}

      {playlists.length > 0 && (
        <Section title="Playlists">
          <div className="flex gap-3 overflow-x-auto no-scrollbar overscroll-x-contain">
            {playlists.map((p) => (
              <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="shrink-0 w-32 text-left">
                <div className="relative aspect-square"><Cover track={{ title: p.title, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                <p className="mt-2 text-sm text-white truncate">{p.title}</p>
              </button>
            ))}
          </div>
        </Section>
      )}

      {channels.length > 0 && (
        <Section title="Channels">
          <div className="flex gap-3 overflow-x-auto no-scrollbar overscroll-x-contain">
            {channels.map((c) => (
              <button key={c.id} onClick={() => navigate(`/channel/${c.username}`)} className="flex flex-col items-center gap-2 shrink-0 w-20">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/30 to-pink-500/30 flex items-center justify-center border border-white/10">
                  {c.avatarUrl ? <img src={c.avatarUrl} className="w-full h-full object-cover" /> : <ChannelIcon size={18} className="text-white/60" />}
                </div>
                <span className="text-xs text-white/70 truncate w-full text-center flex items-center justify-center gap-0.5">{c.name}{c.verified && <VerifiedIcon size={11} className="grad-brand-text shrink-0" />}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="mb-7">
      <h2 className="font-display font-bold text-white mb-2.5">{title}</h2>
      {children}
    </section>
  )
}

function FilterRow({ label, value, options, labels, onChange }) {
  return (
    <div>
      <p className="text-xs text-white/40 mb-1.5">{label}</p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar overscroll-x-contain">
        <button onClick={() => onChange('')} className={`px-3 py-1.5 rounded-full text-xs shrink-0 ${!value ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}>Any</button>
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)} className={`px-3 py-1.5 rounded-full text-xs shrink-0 ${value === o ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}>
            {labels?.[o] || o}
          </button>
        ))}
      </div>
    </div>
  )
}
