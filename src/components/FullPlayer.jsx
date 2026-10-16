import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { useLikes } from '../hooks/useLikes'
import { share } from '../lib/share'
import { download } from '../lib/download'
import { Cover } from './TrackViews'
import { formatDuration, parseLyrics, getSongTheme } from '../musicHelpers'
import {
  BackIcon, PlayIcon, PauseIcon, NextIcon, PrevIcon, HeartIcon,
  ShuffleIcon, RepeatIcon, ShareIcon, DownloadIcon, EqIcon, ClockIcon, ThemeIcon,
} from './icons'

export default function FullPlayer() {
  const navigate = useNavigate()
  const {
    currentTrack, isPlaying, progress, duration, queue, queueIndex,
    shuffle, repeat, eqPreset, sleepUntil, fullPlayerOpen,
    togglePlay, seek, next, prev, setShuffle, setRepeat, setEqPreset,
    setSleepTimer, closeFullPlayer, playQueue, EQ_PRESETS,
    setCameraBannerExpanded,
  } = usePlayer()
  const { isLiked, toggleLike } = useLikes()
  const [pane, setPane] = useState('art') // 'art' | 'lyrics' | 'queue' | 'eq'

  const parsed = useMemo(() => parseLyrics(currentTrack?.lyrics || ''), [currentTrack?.lyrics])
  const activeLyricIdx = useMemo(() => {
    if (!parsed.synced) return -1
    let idx = -1
    for (let i = 0; i < parsed.lines.length; i++) {
      if (progress >= parsed.lines[i].time) idx = i
    }
    return idx
  }, [parsed, progress])

  if (!fullPlayerOpen || !currentTrack) return null
  const liked = isLiked(currentTrack.id)
  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0
  const sleepLeft = sleepUntil ? Math.max(0, Math.ceil((sleepUntil - Date.now()) / 60000)) : 0
  const songTheme = getSongTheme(currentTrack)
  const hasCustomTheme = !!(currentTrack.songTheme || currentTrack.song_theme)

  const handleShare = async () => {
    try {
      await share.share({
        title: currentTrack.title,
        text: `Listening to ${currentTrack.title} on MiLey`,
        url: 'https://mileymusic.space',
      })
    } catch (e) { /* ignore */ }
  }

  const handleDownload = async () => {
    if (!currentTrack.audioUrl) return
    try { await download.fromUrl(currentTrack.audioUrl, `${currentTrack.title || 'track'}.mp3`) } catch (e) { /* ignore */ }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden animate-sheet-up"
      style={{
        height: 'var(--visual-height, 100dvh)',
        background: hasCustomTheme
          ? songTheme.bgGradient
          : 'radial-gradient(circle at 30% 15%, rgba(255,61,174,0.22), transparent 55%), radial-gradient(circle at 75% 75%, rgba(0,224,168,0.18), transparent 60%), #0B0B0B',
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3">
        <button onClick={closeFullPlayer} className="w-10 h-10 rounded-full card-surface flex items-center justify-center text-white/80" aria-label="Collapse">
          <BackIcon size={20} />
        </button>
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-widest text-white/40">Now Playing</p>
          <p className="text-xs text-white/70 font-medium truncate max-w-[180px]">
            {currentTrack.albumTitle || (hasCustomTheme ? `${songTheme.name} Theme` : currentTrack.genre) || 'MiLey Stream'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setCameraBannerExpanded?.(true); closeFullPlayer() }}
            className="w-10 h-10 rounded-full card-surface flex items-center justify-center text-white/80"
            title="Pin to Camera Top Bar"
            aria-label="Camera Top Bar"
          >
            <ThemeIcon size={17} />
          </button>
          <button onClick={handleShare} className="w-10 h-10 rounded-full card-surface flex items-center justify-center text-white/80" aria-label="Share">
            <ShareIcon size={18} />
          </button>
        </div>
      </div>

      {/* Center stage: art OR lyrics OR queue OR eq */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 overflow-hidden">
        {pane === 'art' && (
          <div className="w-full max-w-xs aspect-square relative flex items-center justify-center">
            <div
              className="w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-white/10"
              style={hasCustomTheme ? { boxShadow: `0 20px 60px -15px ${songTheme.primaryColor}45` } : undefined}
            >
              <Cover track={currentTrack} size="fill" rounded="rounded-3xl" />
            </div>
            {hasCustomTheme && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/10">
                <span className="text-[10px] font-medium text-white/80 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: songTheme.primaryColor }} />
                  {songTheme.name} · {songTheme.visualizerStyle}
                </span>
                <div className="flex items-end gap-0.5 h-3">
                  {[0, 1, 2, 3, 4].map((b) => (
                    <span
                      key={b}
                      className="w-0.5 rounded-full transition-all"
                      style={{
                        height: isPlaying ? `${35 + ((b * 23 + Math.floor(progress * 4)) % 65)}%` : '25%',
                        background: b % 2 === 0 ? songTheme.primaryColor : songTheme.secondaryColor,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {pane === 'lyrics' && (
          <div className="w-full max-w-md h-full overflow-y-auto no-scrollbar py-4 text-center space-y-3">
            {parsed.lines.length === 0 ? (
              <p className="text-white/40 text-sm pt-16">No lyrics uploaded for this track yet.</p>
            ) : (
              parsed.lines.map((l, i) => (
                <p
                  key={i}
                  onClick={() => parsed.synced && seek(l.time)}
                  className={`transition-all cursor-pointer ${
                    i === activeLyricIdx
                      ? 'text-lg font-bold grad-brand-text scale-105'
                      : 'text-sm text-white/50'
                  }`}
                >
                  {l.text}
                </p>
              ))
            )}
          </div>
        )}

        {pane === 'queue' && (
          <div className="w-full max-w-md h-full overflow-y-auto no-scrollbar py-2 space-y-1.5">
            <p className="text-xs text-white/40 pb-1">Up Next ({queue.length} tracks)</p>
            {queue.map((t, i) => (
              <button
                key={t.id + '-' + i}
                onClick={() => playQueue(queue, i)}
                className={`w-full flex items-center gap-3 p-2 rounded-xl text-left ${
                  i === queueIndex ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <Cover track={t} size={40} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm truncate ${i === queueIndex ? 'grad-brand-text font-semibold' : 'text-white'}`}>{t.title}</p>
                  <p className="text-xs text-white/40 truncate">{t.artistName}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {pane === 'eq' && (
          <div className="w-full max-w-md space-y-5 py-2">
            <div>
              <p className="text-xs text-white/50 mb-2 flex items-center gap-2"><EqIcon size={15} /> Sound Equalizer</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(EQ_PRESETS).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setEqPreset(k)}
                    className={`py-3 px-4 rounded-2xl text-sm font-medium text-left transition-all ${
                      eqPreset === k ? 'btn-brand text-black' : 'card-surface text-white/80'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-2 flex items-center gap-2">
                <ClockIcon size={15} /> Sleep Timer {sleepLeft > 0 ? `(${sleepLeft}m left)` : ''}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[0, 15, 30, 60].map((m) => (
                  <button
                    key={m}
                    onClick={() => setSleepTimer(m)}
                    className={`py-2.5 rounded-xl text-xs font-medium ${
                      (m === 0 && !sleepUntil) || (m > 0 && Math.abs(sleepLeft - m) <= 2)
                        ? 'btn-brand text-black'
                        : 'card-surface text-white/70'
                    }`}
                  >
                    {m === 0 ? 'Off' : `${m}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Track title + actions */}
      <div className="px-7 pt-3 max-w-md mx-auto w-full">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-bold text-xl text-white truncate">{currentTrack.title}</h2>
            <button
              onClick={() => {
                if (currentTrack.artistId) {
                  closeFullPlayer()
                  navigate(`/artist/${currentTrack.artistId}`)
                }
              }}
              className="text-sm text-white/55 truncate hover:text-white"
            >
              {currentTrack.artistName || 'Unknown Artist'}
            </button>
          </div>
          {currentTrack.audioUrl && (
            <button onClick={handleDownload} className="p-2 text-white/50 hover:text-white" aria-label="Download">
              <DownloadIcon size={20} />
            </button>
          )}
          <button
            onClick={() => toggleLike(currentTrack)}
            className={`p-2 ${liked ? 'text-[rgb(var(--color-secondary))]' : 'text-white/50'}`}
            aria-label="Like"
          >
            <HeartIcon size={22} filled={liked} />
          </button>
        </div>

        {/* Seek bar */}
        <div className="mt-4">
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
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-white/40 mt-1">
            <span>{formatDuration(progress)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Main transport */}
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={() => setShuffle(!shuffle)}
            className={`p-2 ${shuffle ? 'text-[rgb(var(--color-primary))]' : 'text-white/40'}`}
            aria-label="Shuffle"
          >
            <ShuffleIcon size={20} />
          </button>
          <button onClick={prev} className="p-2 text-white" aria-label="Previous">
            <PrevIcon size={26} />
          </button>
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full btn-brand flex items-center justify-center shadow-xl"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon size={26} color="#0B0B0B" /> : <PlayIcon size={26} color="#0B0B0B" />}
          </button>
          <button onClick={next} className="p-2 text-white" aria-label="Next">
            <NextIcon size={26} />
          </button>
          <button
            onClick={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')}
            className={`p-2 relative ${repeat !== 'off' ? 'text-[rgb(var(--color-primary))]' : 'text-white/40'}`}
            aria-label="Repeat"
          >
            <RepeatIcon size={20} />
            {repeat === 'one' && (
              <span className="absolute top-1 right-1 text-[9px] font-bold text-[rgb(var(--color-primary))]">1</span>
            )}
          </button>
        </div>

        {/* Mode switch pills */}
        <div className="flex items-center justify-around mt-5 mb-[calc(env(safe-area-inset-bottom,0px)+1rem)] card-surface rounded-2xl p-1">
          {[
            { k: 'art', l: 'Artwork' },
            { k: 'lyrics', l: 'Lyrics' },
            { k: 'queue', l: `Queue (${queue.length})` },
            { k: 'eq', l: 'EQ & Sleep' },
          ].map(({ k, l }) => (
            <button
              key={k}
              onClick={() => setPane(k)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                pane === k ? 'bg-white/10 text-white' : 'text-white/50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
