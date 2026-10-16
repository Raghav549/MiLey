import { usePlayer } from '../context/PlayerContext'
import { useLikes } from '../hooks/useLikes'
import { Cover } from './TrackViews'
import { PlayIcon, PauseIcon, NextIcon, HeartIcon, CloseIcon } from './icons'

export default function MiniPlayer({ bottomOffsetClass = 'bottom-20 md:bottom-4' }) {
  const { currentTrack, isPlaying, progress, duration, togglePlay, next, openFullPlayer, minimized, setMinimized } = usePlayer()
  const { isLiked, toggleLike } = useLikes()

  if (!currentTrack || minimized) return null
  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0
  const liked = isLiked(currentTrack.id)

  return (
    <div
      className={`fixed left-2 right-2 md:left-72 md:right-6 ${bottomOffsetClass} z-40 rounded-2xl overflow-hidden bg-[#141414]/95 backdrop-blur-xl border border-white/10 shadow-2xl`}
    >
      <div className="h-0.5 w-full bg-white/10">
        <div className="h-full grad-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button onClick={openFullPlayer} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <Cover track={currentTrack} size={44} rounded="rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
            <p className="text-xs text-white/50 truncate">{currentTrack.artistName || 'Unknown Artist'}</p>
          </div>
        </button>
        <button
          onClick={() => toggleLike(currentTrack)}
          className={`p-2 ${liked ? 'text-[rgb(var(--color-secondary))]' : 'text-white/50'}`}
          aria-label="Like"
        >
          <HeartIcon size={18} filled={liked} />
        </button>
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full btn-brand flex items-center justify-center shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon size={18} color="#0B0B0B" /> : <PlayIcon size={18} color="#0B0B0B" />}
        </button>
        <button onClick={next} className="p-2 text-white/70 hidden sm:block" aria-label="Next">
          <NextIcon size={18} />
        </button>
        <button onClick={() => setMinimized(true)} className="p-1.5 text-white/40 hover:text-white/70" aria-label="Minimize to floating disc">
          <CloseIcon size={15} />
        </button>
      </div>
    </div>
  )
}

export function FloatingDisc() {
  const { currentTrack, isPlaying, minimized, setMinimized, openFullPlayer, progress, duration } = usePlayer()
  if (!currentTrack || !minimized) return null
  const pct = duration > 0 ? Math.min(1, progress / duration) : 0
  const r = 24
  const c = 2 * Math.PI * r

  return (
    <button
      onClick={() => { setMinimized(false); openFullPlayer() }}
      aria-label="Restore player"
      className="fixed right-4 bottom-24 md:bottom-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-[#141414]"
    >
      <svg width="56" height="56" className="absolute inset-0 -rotate-90">
        <circle cx="28" cy="28" r={r} stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" fill="none" />
        <circle
          cx="28" cy="28" r={r}
          stroke="url(#miley-disc-grad)" strokeWidth="2.5" fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        />
        <defs>
          <linearGradient id="miley-disc-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-primary))" />
            <stop offset="100%" stopColor="rgb(var(--color-secondary))" />
          </linearGradient>
        </defs>
      </svg>
      <div className={`w-11 h-11 rounded-full overflow-hidden ${isPlaying ? 'animate-spin-slow' : ''}`}>
        <Cover track={currentTrack} size={44} rounded="rounded-full" />
      </div>
    </button>
  )
}
