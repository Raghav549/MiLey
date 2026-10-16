import { useState } from 'react'
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Share2,
  Download,
  Volume2,
  ListMusic,
  Mic2,
  Sliders,
  Timer,
  Sparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlayer, EQ_PRESETS } from '../context/PlayerContext'
import { useLikes } from '../hooks/useLikes'
import { share } from '../lib/share'
import { download } from '../lib/download'
import { APP_DOMAIN } from '../lib/supabaseClient'
import LyricsView from './LyricsView'
import { formatDuration, fallbackCover } from '../musicHelpers'

export default function FullPlayer() {
  const navigate = useNavigate()
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    next,
    prev,
    currentTime,
    duration,
    seek,
    volume,
    setVolume,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
    fullOpen,
    setFullOpen,
    queue,
    playTrack,
    eqPreset,
    setEqPreset,
    bassBoost,
    setBassBoost,
    sleepRemaining,
    startSleepTimer,
    activeSongTheme,
  } = usePlayer()
  const { isLiked, toggleLike } = useLikes()
  const [view, setView] = useState('art') // 'art' | 'lyrics' | 'queue' | 'fx'

  if (!fullOpen || !currentTrack) return null

  const liked = isLiked(currentTrack.id)
  const primary = activeSongTheme.primaryColor || '#00E0A8'
  const secondary = activeSongTheme.secondaryColor || '#FF3DAE'

  const cycleRepeat = () => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))
  }

  const handleShare = async () => {
    const shareUrl = currentTrack.channelUsername
      ? `${APP_DOMAIN}/#/channel/${currentTrack.channelUsername}`
      : `${APP_DOMAIN}/#/artist/${currentTrack.artistId || ''}`
    try {
      await share.link({
        title: currentTrack.title,
        text: `Listening to "${currentTrack.title}" by ${currentTrack.artistName || 'Unknown'} on MiLey (mileymusic.space)`,
        url: shareUrl,
      })
    } catch {
      /* user cancelled */
    }
  }

  const handleDownload = async () => {
    if (!currentTrack.audioUrl) return
    const safe = `${currentTrack.title || 'track'} - ${currentTrack.artistName || 'MiLey'}`.replace(
      /[\\/:*?"<>|]/g,
      '_'
    )
    await download.saveFile(currentTrack.audioUrl, `${safe}.wav`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between px-6 pt-6 pb-8 overflow-y-auto"
      style={{
        background: activeSongTheme.bgStyle,
      }}
    >
      {/* Optional Direct Uploaded Song Theme Background Canvas */}
      {activeSongTheme.bgImageUrl && (
        <div
          className="fixed inset-0 opacity-25 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url(${activeSongTheme.bgImageUrl})` }}
        />
      )}
      <div className="fixed inset-0 bg-gradient-to-b from-black/45 via-black/65 to-[#08080D]/95 pointer-events-none" />

      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between">
        <button
          onClick={() => setFullOpen(false)}
          className="p-2 rounded-full bg-white/10 text-text-primary"
          aria-label="Close player"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-black/50 border border-white/15 mb-1.5"
            style={{ color: primary }}
          >
            <Sparkles className="w-2.5 h-2.5" /> {activeSongTheme.name}
          </span>
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10">
            <button
              onClick={() => setView('art')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                view === 'art' ? 'text-[#0B0B0B] font-semibold' : 'text-text-secondary'
              }`}
              style={view === 'art' ? { backgroundColor: primary } : undefined}
            >
              Now Playing
            </button>
            <button
              onClick={() => setView('lyrics')}
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${
                view === 'lyrics' ? 'text-[#0B0B0B] font-semibold' : 'text-text-secondary'
              }`}
              style={view === 'lyrics' ? { backgroundColor: primary } : undefined}
            >
              <Mic2 className="w-3 h-3" /> Lyrics
            </button>
            <button
              onClick={() => setView('queue')}
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${
                view === 'queue' ? 'text-[#0B0B0B] font-semibold' : 'text-text-secondary'
              }`}
              style={view === 'queue' ? { backgroundColor: primary } : undefined}
            >
              <ListMusic className="w-3 h-3" /> Queue ({queue.length})
            </button>
            <button
              onClick={() => setView('fx')}
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${
                view === 'fx' ? 'text-[#0B0B0B] font-semibold' : 'text-text-secondary'
              }`}
              style={view === 'fx' ? { backgroundColor: primary } : undefined}
            >
              <Sliders className="w-3 h-3" /> EQ
              {sleepRemaining > 0 ? ` · ${Math.ceil(sleepRemaining / 60)}m` : ''}
            </button>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="p-2 rounded-full bg-white/10 text-text-primary"
          aria-label="Share track"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Center Content */}
      <div className="relative z-10 my-4 flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
        {view === 'art' && (
          <div className="flex flex-col items-center">
            <div
              className={`relative w-72 h-72 sm:w-80 sm:h-80 overflow-hidden shadow-2xl border-2 transition-all ${
                activeSongTheme.visualizer === 'vinyl' || activeSongTheme.visualizer === 'circular'
                  ? `rounded-full ${isPlaying ? 'animate-spin' : ''}`
                  : 'rounded-3xl'
              }`}
              style={{
                animationDuration: '12s',
                borderColor: primary,
                background: fallbackCover(currentTrack.title),
                boxShadow: `0 20px 60px -10px ${primary}66, 0 0 30px -5px ${secondary}44`,
              }}
            >
              {currentTrack.coverUrl && (
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              )}
              {(activeSongTheme.visualizer === 'vinyl' ||
                activeSongTheme.visualizer === 'circular') && (
                <div
                  className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-[#08080D] border-4 flex items-center justify-center"
                  style={{ borderColor: primary }}
                >
                  <div className="w-3 h-3 rounded-full bg-white/60" />
                </div>
              )}
            </div>

            {/* Song Theme Live Spectrum Equalizer Bar under Art */}
            <div className="mt-5 flex items-end justify-center gap-1.5 h-8 px-4">
              {Array.from({ length: 22 }).map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-300 ${
                    isPlaying ? 'animate-pulse' : ''
                  }`}
                  style={{
                    height: isPlaying ? `${28 + ((i * 29) % 72)}%` : '20%',
                    backgroundColor: i % 2 === 0 ? primary : secondary,
                    animationDelay: `${i * 65}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {view === 'lyrics' && (
          <LyricsView lyrics={currentTrack.lyrics} currentTime={currentTime} onSeek={seek} />
        )}

        {view === 'queue' && (
          <div className="h-72 overflow-y-auto space-y-2 pr-1">
            {queue.map((t, i) => {
              const active = t.id === currentTrack.id
              return (
                <div
                  key={`${t.id}-${i}`}
                  onClick={() => playTrack(t, queue)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer ${
                    active ? 'bg-accent-primary/15 border border-accent-primary/40' : 'bg-white/5'
                  }`}
                >
                  <span className="text-xs font-mono text-text-secondary w-5">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{t.title}</p>
                    <p className="text-xs text-text-secondary truncate">{t.artistName}</p>
                  </div>
                  <span className="text-xs font-mono text-text-secondary">
                    {formatDuration(t.duration)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {view === 'fx' && (
          <div className="h-72 overflow-y-auto space-y-4 pr-1">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-accent-primary" /> Equalizer Preset
                </span>
                <span className="text-[11px] font-mono text-accent-primary">
                  {EQ_PRESETS[eqPreset]?.label || 'Flat'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(EQ_PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => setEqPreset(key)}
                    className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                      eqPreset === key
                        ? 'bg-accent-primary text-[#0B0B0B] border-accent-primary font-semibold'
                        : 'bg-bg-primary/60 border-white/10 text-text-secondary'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="pt-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-text-secondary">Bass Boost</span>
                  <span className="font-mono text-accent-secondary">+{bassBoost} dB</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={bassBoost}
                  onChange={(e) => setBassBoost(Number(e.target.value))}
                  className="w-full accent-[#FF3DAE]"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-accent-secondary" /> Sleep Timer
                </span>
                <span className="text-[11px] font-mono text-text-secondary">
                  {sleepRemaining > 0
                    ? `${Math.floor(sleepRemaining / 60)}:${String(sleepRemaining % 60).padStart(
                        2,
                        '0'
                      )} left`
                    : 'Off'}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[0, 15, 30, 45, 60].map((min) => (
                  <button
                    key={min}
                    onClick={() => startSleepTimer(min)}
                    className={`py-2 rounded-xl text-xs font-medium border ${
                      (min === 0 && sleepRemaining === 0) ||
                      (min > 0 && Math.ceil(sleepRemaining / 60) === min)
                        ? 'bg-accent-secondary text-white border-accent-secondary font-semibold'
                        : 'bg-bg-primary/60 border-white/10 text-text-secondary'
                    }`}
                  >
                    {min === 0 ? 'Off' : `${min}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="relative z-10 max-w-md w-full mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate" style={{ fontFamily: 'var(--font-display)' }}>
              {currentTrack.title}
            </h2>
            <button
              onClick={() => {
                if (currentTrack.artistId) {
                  setFullOpen(false)
                  navigate(`/artist/${currentTrack.artistId}`)
                }
              }}
              className="text-sm text-text-secondary hover:text-accent-primary truncate block text-left"
            >
              {currentTrack.artistName || 'Unknown Artist'}
              {currentTrack.genre ? ` · ${currentTrack.genre}` : ''}
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => toggleLike(currentTrack)}
              aria-label="Like"
              className="p-2.5 rounded-full bg-white/5 hover:bg-white/10"
            >
              <Heart
                className={`w-5 h-5 ${
                  liked ? 'fill-accent-secondary text-accent-secondary' : 'text-text-secondary'
                }`}
              />
            </button>
            <button
              onClick={handleDownload}
              aria-label="Save offline"
              className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-text-secondary"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrubber */}
        <div>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.5}
            value={Math.min(currentTime, duration || 1)}
            onChange={(e) => seek( parseFloat(e.target.value) )}
            className="w-full cursor-pointer h-1.5"
            style={{ accentColor: primary }}
          />
          <div className="flex justify-between text-[11px] font-mono text-text-secondary mt-1">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Transport */}
        <div className="flex items-center justify-between px-2">
          <button
            onClick={() => setShuffle((s) => !s)}
            className={`p-2 rounded-full ${shuffle ? 'text-accent-primary' : 'text-text-secondary'}`}
            aria-label="Shuffle"
          >
            <Shuffle className="w-5 h-5" />
          </button>
          <button
            onClick={prev}
            className="p-3 rounded-full text-text-primary hover:bg-white/10 active:scale-90"
            aria-label="Previous"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full text-[#0B0B0B] flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            style={{
              background: `linear-gradient(135deg, ${primary}, ${secondary})`,
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>
          <button
            onClick={next}
            className="p-3 rounded-full text-text-primary hover:bg-white/10 active:scale-90"
            aria-label="Next"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>
          <button
            onClick={cycleRepeat}
            className={`p-2 rounded-full ${
              repeat !== 'off' ? 'text-accent-primary' : 'text-text-secondary'
            }`}
            aria-label="Repeat"
          >
            {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3 px-2 pt-1">
          <Volume2 className="w-4 h-4 text-text-secondary shrink-0" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full h-1"
            style={{ accentColor: primary }}
          />
        </div>
      </div>
    </div>
  )
}
