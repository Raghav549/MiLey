import { useState } from 'react'
import {
  Play,
  Pause,
  Heart,
  MoreHorizontal,
  Download,
  BadgeCheck,
  Flag,
  Sparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { download } from '../lib/download'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { fallbackCover, formatDuration, formatCount, getSongTheme } from '../musicHelpers'

export function Cover({ track, size = 48, rounded = 'rounded-xl', className = '' }) {
  const title = track?.title || track?.name || 'MiLey'
  const url = track?.coverUrl || track?.avatarUrl || ''
  const style =
    size === 'fill'
      ? { background: fallbackCover(title) }
      : { width: size, height: size, background: fallbackCover(title) }
  return (
    <div
      style={style}
      className={`relative overflow-hidden shrink-0 flex items-center justify-center font-bold text-black ${
        size === 'fill' ? 'w-full h-full' : ''
      } ${rounded} ${className}`}
    >
      {url ? (
        <img src={url} alt={title} className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs">{(title || 'M')[0].toUpperCase()}</span>
      )}
    </div>
  )
}

export function TrackCard({ track, list, queueList, isLiked, onToggleLike }) {
  const navigate = useNavigate()
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer()
  const active = currentTrack?.id === track.id
  const theme = getSongTheme(track)
  const effectiveList = list || queueList

  const handlePlay = (e) => {
    e.stopPropagation()
    if (active) togglePlay()
    else playTrack(track, effectiveList)
  }

  return (
    <div
      onClick={handlePlay}
      className="group relative w-40 shrink-0 cursor-pointer select-none"
    >
      <div
        className="relative w-40 h-40 rounded-2xl overflow-hidden shadow-lg border transition-all group-hover:scale-[1.02]"
        style={{
          background: fallbackCover(track.title),
          borderColor: active ? theme.primaryColor : 'rgba(255,255,255,0.1)',
          boxShadow: active ? `0 8px 25px -4px ${theme.primaryColor}55` : undefined,
        }}
      >
        {track.coverUrl && (
          <img
            src={track.coverUrl}
            alt={track.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />

        {/* Song Theme Top Pill */}
        {track.songTheme && (
          <span
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-mono bg-black/70 backdrop-blur border border-white/15 flex items-center gap-1 truncate max-w-[130px]"
            style={{ color: theme.primaryColor }}
          >
            <Sparkles className="w-2.5 h-2.5 shrink-0" />
            {theme.name}
          </span>
        )}

        <button
          onClick={handlePlay}
          aria-label={active && isPlaying ? 'Pause' : 'Play'}
          className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full text-[#0B0B0B] flex items-center justify-center shadow-lg transition-transform active:scale-90"
          style={{ backgroundColor: theme.primaryColor || '#00E0A8' }}
        >
          {active && isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
        {track.genre && (
          <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/60 backdrop-blur text-white/90">
            {track.genre}
          </span>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-sm font-semibold truncate">{track.title}</p>
        <div className="flex items-center justify-between gap-1">
          {track.channelUsername ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/channel/${track.channelUsername}`)
              }}
              className="text-xs text-text-secondary hover:text-accent-primary truncate text-left inline-flex items-center gap-1"
            >
              <span className="truncate">@{track.channelUsername}</span>
              {track.channelVerified && (
                <BadgeCheck className="w-3.5 h-3.5 text-accent-primary shrink-0" />
              )}
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (track.artistId) navigate(`/artist/${track.artistId}`)
              }}
              className="text-xs text-text-secondary hover:text-text-primary truncate text-left"
            >
              {track.artistName || 'Unknown Artist'}
            </button>
          )}
          {onToggleLike && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleLike(track)
              }}
              aria-label="Like track"
              className="p-1 text-text-secondary hover:text-accent-secondary shrink-0"
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  isLiked ? 'fill-accent-secondary text-accent-secondary' : ''
                }`}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function TrackRow({ track, list, queueList, index, isLiked, onToggleLike, rightSlot }) {
  const navigate = useNavigate()
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer()
  const active = currentTrack?.id === track.id
  const [reportOpen, setReportOpen] = useState(false)
  const [reason, setReason] = useState('Copyright infringement')
  const [notes, setNotes] = useState('')
  const [sent, setSent] = useState(false)
  const theme = getSongTheme(track)
  const effectiveList = list || queueList

  const handlePlay = () => {
    if (active) togglePlay()
    else playTrack(track, effectiveList)
  }

  const handleDownload = (e) => {
    e.stopPropagation()
    if (!track.audioUrl) return
    const safe = `${track.title || 'track'} - ${track.artistName || 'MiLey'}`.replace(
      /[\\/:*?"<>|]/g,
      '_'
    )
    download.saveFile(track.audioUrl, `${safe}.wav`)
  }

  const submitReport = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const u = auth.getCurrentUser()
    await db.insertShared(
      'reports',
      {
        targetType: 'track',
        targetId: track.id,
        targetName: `${track.title} — ${track.artistName || ''}`,
        reason,
        notes: notes.trim(),
        reporterId: u?.id,
        reporterName: u?.displayName || 'User',
        status: 'open',
      },
      undefined,
      { visibleTo: 'public' }
    )
    setSent(true)
    setTimeout(() => {
      setReportOpen(false)
      setSent(false)
      setNotes('')
    }, 1200)
  }

  return (
    <div
      onClick={handlePlay}
      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
        active ? 'bg-white/10 border border-accent-primary/30' : 'hover:bg-white/5'
      }`}
    >
      {typeof index === 'number' && (
        <span className="w-5 text-xs font-mono text-text-secondary text-center shrink-0">
          {active && isPlaying ? '♪' : index + 1}
        </span>
      )}
      <div
        className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10"
        style={{
          background: fallbackCover(track.title),
          borderColor: track.songTheme ? `${theme.primaryColor}66` : undefined,
        }}
      >
        {track.coverUrl && (
          <img
            src={track.coverUrl}
            alt={track.title}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          {active && isPlaying ? (
            <Pause className="w-4 h-4 text-white fill-current" />
          ) : (
            <Play className="w-4 h-4 text-white fill-current" />
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p
            className={`text-sm font-semibold truncate ${
              active ? 'text-accent-primary' : 'text-text-primary'
            }`}
          >
            {track.title}
          </p>
          {track.songTheme && (
            <span
              className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono border shrink-0"
              style={{
                color: theme.primaryColor,
                borderColor: `${theme.primaryColor}44`,
                backgroundColor: `${theme.primaryColor}15`,
              }}
            >
              <Sparkles className="w-2.5 h-2.5" /> {theme.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-secondary truncate">
          {track.channelUsername ? (
            <span
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/channel/${track.channelUsername}`)
              }}
              className="hover:text-accent-primary truncate inline-flex items-center gap-0.5"
            >
              @{track.channelUsername}
              {track.channelVerified && (
                <BadgeCheck className="w-3 h-3 text-accent-primary shrink-0" />
              )}
            </span>
          ) : (
            <span
              onClick={(e) => {
                e.stopPropagation()
                if (track.artistId) navigate(`/artist/${track.artistId}`)
              }}
              className="hover:text-text-primary truncate"
            >
              {track.artistName || 'Unknown Artist'}
            </span>
          )}
          {track.plays > 0 && <span>· {formatCount(track.plays)} plays</span>}
        </div>
      </div>

      {track.duration > 0 && (
        <span className="text-xs font-mono text-text-secondary shrink-0">
          {formatDuration(track.duration)}
        </span>
      )}

      {onToggleLike && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleLike(track)
          }}
          aria-label="Like track"
          className="p-1.5 text-text-secondary hover:text-accent-secondary"
        >
          <Heart
            className={`w-4 h-4 ${
              isLiked ? 'fill-accent-secondary text-accent-secondary' : ''
            }`}
          />
        </button>
      )}

      <button
        onClick={handleDownload}
        aria-label="Save offline"
        className="p-1.5 text-text-secondary hover:text-text-primary"
      >
        <Download className="w-4 h-4" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation()
          setReportOpen(true)
        }}
        aria-label="Report track"
        title="Report track"
        className="p-1.5 text-text-secondary hover:text-red-400"
      >
        <Flag className="w-3.5 h-3.5" />
      </button>

      {rightSlot}

      {reportOpen && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            setReportOpen(false)
          }}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitReport}
            className="w-full max-w-sm rounded-3xl bg-bg-secondary border border-white/15 p-5 space-y-3"
          >
            <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Report Track
            </h3>
            <p className="text-xs text-text-secondary truncate">{track.title}</p>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-primary border border-white/10 text-xs"
            >
              <option>Copyright infringement</option>
              <option>Hate speech or harassment</option>
              <option>Explicit / inappropriate audio</option>
              <option>Spam or misleading metadata</option>
            </select>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional details for admins"
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
                {sent ? 'Reported ✓' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
