import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { useLikes } from '../hooks/useLikes'
import { Cover } from './TrackViews'
import { formatDuration, parseLyrics } from '../musicHelpers'
import { PlayIcon, PauseIcon, NextIcon, PrevIcon, HeartIcon, EqIcon, ClockIcon, CloseIcon } from './icons'

export default function CameraTopBarBanner() {
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    togglePlay,
    next,
    prev,
    seek,
    openFullPlayer,
    eqPreset,
    setEqPreset,
    EQ_PRESETS,
    sleepUntil,
    setSleepTimer,
    cameraBannerExpanded,
    setCameraBannerExpanded,
  } = usePlayer()
  const { isLiked, toggleLike } = useLikes()
  const [hidden, setHidden] = useState(false)

  if (!currentTrack || hidden) return null

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0
  const liked = isLiked(currentTrack.id)
  const sleepLeft = sleepUntil ? Math.max(0, Math.ceil((sleepUntil - Date.now()) / 60000)) : 0
  const parsedLyrics = parseLyrics(currentTrack.lyrics || '')
  let currentLyric = ''
  if (parsedLyrics.lines.length > 0) {
    if (parsedLyrics.synced) {
      for (let i = 0; i < parsedLyrics.lines.length; i++) {
        if (progress >= parsedLyrics.lines[i].time) currentLyric = parsedLyrics.lines[i].text
      }
    } else {
      const idx = Math.min(parsedLyrics.lines.length - 1, Math.floor((pct / 100) * parsedLyrics.lines.length))
      currentLyric = parsedLyrics.lines[idx]?.text || ''
    }
  }

  return (
    <div className="fixed top-[calc(env(safe-area-inset-top,0px)+0.35rem)] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none w-full max-w-md px-3">
      {!cameraBannerExpanded ? (
        <div
          onClick={() => setCameraBannerExpanded(true)}
          className="pointer-events-auto flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-full bg-[#0B0B0B]/95 backdrop-blur-xl border border-white/15 shadow-2xl cursor-pointer hover:border-white/25 transition-all"
        >
          <div className={`w-6 h-6 rounded-full overflow-hidden shrink-0 ${isPlaying ? 'animate-spin-slow' : ''}`}>
            <Cover track={currentTrack} size={24} rounded="rounded-full" />
          </div>
          <span className="w-2 h-2 rounded-full bg-[#060606] border border-white/15 shrink-0" title="Camera cutout" />
          <p className="text-[11px] font-medium text-white truncate max-w-[125px]">{currentTrack.title}</p>
          <div className="flex items-end gap-0.5 h-3 px-0.5">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-0.5 rounded-full grad-brand transition-all"
                style={{ height: isPlaying ? `${35 + ((i * 27 + Math.floor(progress * 5)) % 65)}%` : '25%' }}
              />
            ))}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay() }}
            className="w-6 h-6 rounded-full btn-brand flex items-center justify-center shrink-0"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon size={11} color="#0B0B0B" /> : <PlayIcon size={11} color="#0B0B0B" />}
          </button>
        </div>
      ) : (
        <div className="pointer-events-auto w-full rounded-3xl bg-[#141414]/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-4 animate-sheet-up">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest grad-brand-text font-semibold">
              Camera Top Bar · Background Audio Active
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCameraBannerExpanded(false); openFullPlayer() }}
                className="text-[11px] text-white/60 hover:text-white px-2 py-0.5 rounded-lg card-surface"
              >
                Full Player
              </button>
              <button
                onClick={() => setCameraBannerExpanded(false)}
                className="text-white/50 hover:text-white p-1"
                aria-label="Collapse"
              >
                <CloseIcon size={15} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div onClick={() => { setCameraBannerExpanded(false); openFullPlayer() }} className="cursor-pointer">
              <Cover track={currentTrack} size={50} rounded="rounded-2xl" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
              <p className="text-xs text-white/50 truncate">{currentTrack.artistName || 'Unknown Artist'}</p>
              {currentLyric && (
                <p className="text-[11px] grad-brand-text font-medium truncate mt-0.5">♪ {currentLyric}</p>
              )}
            </div>
            <button
              onClick={() => toggleLike(currentTrack)}
              className={`p-2 ${liked ? 'text-[rgb(var(--color-secondary))]' : 'text-white/50'}`}
              aria-label="Like"
            >
              <HeartIcon size={18} filled={liked} />
            </button>
            <button onClick={prev} className="p-1.5 text-white/80" aria-label="Previous">
              <PrevIcon size={18} />
            </button>
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full btn-brand flex items-center justify-center shrink-0"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <PauseIcon size={17} color="#0B0B0B" /> : <PlayIcon size={17} color="#0B0B0B" />}
            </button>
            <button onClick={next} className="p-1.5 text-white/80" aria-label="Next">
              <NextIcon size={18} />
            </button>
          </div>

          <div className="mt-3">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={progress}
              onChange={(e) => seek(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, rgb(var(--color-primary)) 0%, rgb(var(--color-secondary)) ${pct}%, rgba(255,255,255,0.14) ${pct}%)`,
              }}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-white/40 mt-1">
              <span>{formatDuration(progress)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <EqIcon size={13} className="text-white/40 shrink-0 mr-1" />
              {Object.entries(EQ_PRESETS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setEqPreset(k)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0 ${
                    eqPreset === k ? 'btn-brand text-black' : 'card-surface text-white/60'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSleepTimer(sleepLeft > 0 ? 0 : 15)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0 flex items-center gap-1 ${
                sleepLeft > 0 ? 'btn-brand text-black' : 'card-surface text-white/60'
              }`}
            >
              <ClockIcon size={11} />
              {sleepLeft > 0 ? `${sleepLeft}m` : 'Sleep'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
