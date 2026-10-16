import { Play, Pause, SkipForward, Sparkles } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext'
import { fallbackCover } from '../musicHelpers'

export function FloatingDisc() {
  const { currentTrack, isPlaying, setFullOpen, activeSongTheme } = usePlayer()
  if (!currentTrack) return null
  return (
    <button
      onClick={() => setFullOpen(true)}
      aria-label="Open player"
      className="fixed z-30 right-3 top-16 w-12 h-12 rounded-full shadow-2xl overflow-hidden border-2 active:scale-95 transition-transform"
      style={{
        borderColor: activeSongTheme?.primaryColor || '#00E0A8',
        background: fallbackCover(currentTrack.title),
      }}
    >
      <div className={`w-full h-full ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }}>
        {currentTrack.coverUrl && (
          <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
        )}
      </div>
    </button>
  )
}

export default function MiniPlayer({ bottomOffsetClass = 'bottom-16' }) {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    next,
    setFullOpen,
    currentTime,
    duration,
    activeSongTheme,
  } = usePlayer()

  if (!currentTrack) return null
  const pct = duration ? Math.min(100, (currentTime / duration) * 100) : 0
  const primary = activeSongTheme?.primaryColor || '#00E0A8'
  const secondary = activeSongTheme?.secondaryColor || '#FF3DAE'

  return (
    <div className={`fixed left-0 right-0 z-30 px-3 ${bottomOffsetClass}`}>
      <div
        onClick={() => setFullOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') setFullOpen(true) }}
        className="w-full max-w-2xl mx-auto flex items-center gap-3 bg-bg-secondary/95 backdrop-blur-2xl rounded-2xl px-3 py-2.5 shadow-2xl relative overflow-hidden active:scale-[0.99] transition-transform cursor-pointer border"
        style={{
          borderColor: `${primary}55`,
          boxShadow: `0 10px 30px -8px ${primary}44`,
        }}
      >
        <div
          className="absolute bottom-0 left-0 h-0.5 transition-all duration-150"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${primary}, ${secondary})`,
          }}
        />
        <div
          className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/15"
          style={{ background: fallbackCover(currentTrack.title) }}
        >
          {currentTrack.coverUrl && (
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
            <span
              className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-white/5"
              style={{ color: primary }}
            >
              <Sparkles className="w-2.5 h-2.5" /> {activeSongTheme?.name}
            </span>
          </div>
          <p className="text-xs text-text-secondary truncate">
            {currentTrack.artistName || 'MiLey Artist'}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            togglePlay()
          }}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[#0B0B0B]"
          style={{ backgroundColor: primary }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            next()
          }}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white/75 hover:text-white"
          aria-label="Next track"
        >
          <SkipForward className="w-4 h-4 fill-current" />
        </button>
      </div>
    </div>
  )
}
