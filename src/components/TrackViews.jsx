import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { useLikes } from '../hooks/useLikes'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { share } from '../lib/share'
import { download } from '../lib/download'
import { coverGradient, formatDuration, getSongTheme } from '../musicHelpers'
import { PlayIcon, PauseIcon, HeartIcon, MoreIcon, PlusIcon, ShareIcon, DownloadIcon, FlagIcon, MusicNoteIcon, ThemeIcon } from './icons'

export function Cover({ track, size = 48, rounded = 'rounded-xl', className = '' }) {
  const fill = size === 'fill'
  const url = track?.coverUrl
  return (
    <div
      style={{
        ...(fill ? {} : { width: size, height: size }),
        background: url ? '#1a1a1a' : coverGradient(track?.title || track?.id || ''),
      }}
      className={`${fill ? 'w-full h-full' : 'shrink-0'} ${rounded} overflow-hidden flex items-center justify-center relative ${className}`}
    >
      {url ? (
        <img src={url} alt={track?.title || ''} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <MusicNoteIcon size={fill ? 28 : Math.max(16, Math.floor(size * 0.42))} color="rgba(255,255,255,0.85)" />
      )}
    </div>
  )
}

export function TrackCard({ track, queueList, size = 148 }) {
  const { currentTrack, isPlaying, playTrack, playQueue, togglePlay } = usePlayer()
  const active = currentTrack?.id === track.id
  const hasTheme = !!(track?.songTheme || track?.song_theme)
  const theme = hasTheme ? getSongTheme(track) : null

  const handleClick = () => {
    if (active) togglePlay()
    else if (queueList && queueList.length) {
      const idx = queueList.findIndex((t) => t.id === track.id)
      playQueue(queueList, Math.max(0, idx))
    } else playTrack(track)
  }

  return (
    <button
      onClick={handleClick}
      style={{ width: size }}
      className="shrink-0 text-left group focus:outline-none"
    >
      <div style={{ width: size, height: size }} className="relative rounded-2xl overflow-hidden">
        <Cover track={track} size={size} rounded="rounded-2xl" />
        {theme && (
          <span
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-semibold text-white backdrop-blur-md border border-white/15 flex items-center gap-1"
            style={{ background: 'rgba(11,11,11,0.72)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: theme.primaryColor }} />
            {theme.badgeLabel || theme.name}
          </span>
        )}
        <div
          className={`absolute inset-0 bg-black/35 flex items-end justify-end p-2.5 transition-opacity ${
            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <span className="w-10 h-10 rounded-full btn-brand flex items-center justify-center shadow-lg">
            {active && isPlaying ? <PauseIcon size={18} color="#0B0B0B" /> : <PlayIcon size={18} color="#0B0B0B" />}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-white truncate">{track.title}</p>
      <p className="text-xs text-white/50 truncate">{track.artistName || 'Unknown Artist'}</p>
    </button>
  )
}

export function TrackRow({ track, queueList, index, onRemove, rightSlot, showMenu = true }) {
  const { currentTrack, isPlaying, playTrack, playQueue, togglePlay } = usePlayer()
  const { isLiked, toggleLike } = useLikes()
  const [sheetOpen, setSheetOpen] = useState(false)
  const active = currentTrack?.id === track.id
  const liked = isLiked(track.id)
  const hasTheme = !!(track?.songTheme || track?.song_theme)
  const theme = hasTheme ? getSongTheme(track) : null

  const handlePlay = () => {
    if (active) togglePlay()
    else if (queueList && queueList.length) {
      const idx = queueList.findIndex((t) => t.id === track.id)
      playQueue(queueList, Math.max(0, idx))
    } else playTrack(track)
  }

  return (
    <>
      <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.04] transition-colors">
        {typeof index === 'number' && (
          <span className="w-5 text-xs text-white/40 text-center font-medium">
            {active && isPlaying ? '♪' : index + 1}
          </span>
        )}
        <button onClick={handlePlay} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div className="relative">
            <Cover track={track} size={46} rounded="rounded-xl" />
            {active && (
              <span className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
                {isPlaying ? <PauseIcon size={16} color="#00E0A8" /> : <PlayIcon size={16} color="#00E0A8" />}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className={`text-sm font-medium truncate ${active ? 'grad-brand-text' : 'text-white'}`}>{track.title}</p>
              {theme && (
                <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: theme.primaryColor }} title={`Song Theme: ${theme.name}`} />
              )}
            </div>
            <p className="text-xs text-white/45 truncate">
              {track.artistName || 'Unknown Artist'}
              {track.genre ? ` · ${track.genre}` : ''}
            </p>
          </div>
        </button>
        {track.duration ? (
          <span className="text-xs text-white/35 hidden sm:inline">{formatDuration(track.duration)}</span>
        ) : null}
        <button
          onClick={() => toggleLike(track)}
          aria-label="Like"
          className={`p-2 ${liked ? 'text-[rgb(var(--color-secondary))]' : 'text-white/40 hover:text-white/70'}`}
        >
          <HeartIcon size={17} filled={liked} />
        </button>
        {rightSlot}
        {showMenu && (
          <button onClick={() => setSheetOpen(true)} className="p-2 text-white/40 hover:text-white/70" aria-label="More">
            <MoreIcon size={17} />
          </button>
        )}
      </div>
      {sheetOpen && <TrackActionSheet track={track} onClose={() => setSheetOpen(false)} onRemove={onRemove} />}
    </>
  )
}

export function TrackActionSheet({ track, onClose, onRemove }) {
  const navigate = useNavigate()
  const { addToQueue } = usePlayer()
  const [playlists, setPlaylists] = useState(null)
  const [reported, setReported] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [showReport, setShowReport] = useState(false)

  const loadPlaylists = async () => {
    const user = auth.getCurrentUser()
    if (!user) return
    const rows = await db.selectShared('playlists', { ownerId: user.id }, { limit: 50 })
    setPlaylists(rows)
  }

  const addTrackToPlaylist = async (pl) => {
    const ids = Array.isArray(pl.trackIds) ? pl.trackIds : []
    if (!ids.includes(track.id)) {
      await db.updateShared('playlists', pl.id, { trackIds: [...ids, track.id] })
    }
    onClose()
  }

  const handleShare = async () => {
    try {
      await share.share({
        title: track.title,
        text: `Listen to ${track.title} by ${track.artistName || 'an artist'} on MiLey`,
        url: `https://mileymusic.space${window.location.pathname}`,
      })
    } catch (e) { /* ignore */ }
    onClose()
  }

  const handleDownload = async () => {
    if (!track.audioUrl) return
    try { await download.fromUrl(track.audioUrl, `${track.title || 'track'}.mp3`) } catch (e) { /* ignore */ }
    onClose()
  }

  const submitReport = async () => {
    if (!reportReason.trim()) return
    const user = auth.getCurrentUser()
    try {
      await db.insertShared('reports', {
        targetType: 'track',
        targetId: track.id,
        targetTitle: track.title,
        reason: reportReason.trim(),
        reporterId: user?.id || 'anon',
      }, undefined, { visibleTo: 'public' })
      setReported(true)
      setTimeout(onClose, 900)
    } catch (e) { onClose() }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center"
      style={{ height: 'var(--visual-height, 100dvh)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-md bg-[#141414] border-t md:border border-white/10 rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up max-h-[80dvh] overflow-y-auto"
      >
        <div className="flex items-center gap-3 pb-4 border-b border-white/10">
          <Cover track={track} size={48} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white truncate">{track.title}</p>
            <p className="text-xs text-white/50 truncate">{track.artistName}</p>
          </div>
        </div>

        {playlists ? (
          <div className="pt-3 space-y-1">
            <p className="text-xs text-white/40 px-2 pb-1">Choose a playlist</p>
            {playlists.length === 0 && (
              <button
                onClick={() => { onClose(); navigate('/library') }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/5"
              >
                No playlists yet — create one in Library
              </button>
            )}
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => addTrackToPlaylist(pl)}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-white hover:bg-white/5"
              >
                {pl.title}
              </button>
            ))}
          </div>
        ) : showReport ? (
          <div className="pt-4 space-y-3">
            {reported ? (
              <p className="text-sm text-emerald-400 py-3 text-center">Thanks — our team will review this track.</p>
            ) : (
              <>
                <p className="text-xs text-white/50">Why are you reporting this track?</p>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Copyright infringement, inappropriate audio, spam…"
                  className="w-full bg-white/5 rounded-xl p-3 text-sm text-white placeholder-white/30 outline-none"
                  rows={3}
                />
                <button onClick={submitReport} className="w-full btn-brand text-black font-semibold py-2.5 rounded-xl text-sm">
                  Submit Report
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="pt-2 space-y-1 text-sm">
            <SheetBtn icon={<PlusIcon size={18} />} label="Play Next in Queue" onClick={() => { addToQueue(track); onClose() }} />
            <SheetBtn icon={<PlusIcon size={18} />} label="Add to Playlist" onClick={loadPlaylists} />
            {track.artistId && (
              <SheetBtn icon={<MusicNoteIcon size={18} />} label="View Artist" onClick={() => { onClose(); navigate(`/artist/${track.artistId}`) }} />
            )}
            <SheetBtn icon={<ShareIcon size={18} />} label="Share Track" onClick={handleShare} />
            {track.audioUrl && (
              <SheetBtn icon={<DownloadIcon size={18} />} label="Save Offline / Download" onClick={handleDownload} />
            )}
            {onRemove && (
              <SheetBtn icon={<FlagIcon size={18} />} label="Remove from this list" onClick={() => { onRemove(track); onClose() }} />
            )}
            <SheetBtn icon={<FlagIcon size={18} />} label="Report Track" danger onClick={() => setShowReport(true)} />
          </div>
        )}
      </div>
    </div>
  )
}

function SheetBtn({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left ${
        danger ? 'text-red-400' : 'text-white'
      }`}
    >
      <span className="text-white/60">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
