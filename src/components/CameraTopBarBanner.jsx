import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Heart,
  ChevronDown,
  Maximize2,
  Sliders,
  PictureInPicture2,
  Sparkles,
  Radio,
} from 'lucide-react'
import { usePlayer, EQ_PRESETS } from '../context/PlayerContext'
import { useLikes } from '../hooks/useLikes'
import { formatDuration, fallbackCover } from '../musicHelpers'

const EQ_KEYS = Object.keys(EQ_PRESETS)

export default function CameraTopBarBanner() {
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
    setFullOpen,
    eqPreset,
    setEqPreset,
    activeSongTheme,
    cameraBannerExpanded,
    setCameraBannerExpanded,
    backgroundPlayActive,
  } = usePlayer()

  const { isLiked, toggleLike } = useLikes()
  const [pipActive, setPipActive] = useState(false)
  const [justChangedTrackId, setJustChangedTrackId] = useState(null)

  // Pulse indicator when track changes
  useEffect(() => {
    if (!currentTrack?.id) return
    setJustChangedTrackId(currentTrack.id)
    const timer = setTimeout(() => setJustChangedTrackId(null), 2600)
    return () => clearTimeout(timer)
  }, [currentTrack?.id])

  if (!currentTrack) return null

  const liked = isLiked(currentTrack.id)
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const primary = activeSongTheme.primaryColor || '#00E0A8'
  const secondary = activeSongTheme.secondaryColor || '#FF3DAE'

  const cycleEqPreset = (e) => {
    e.stopPropagation()
    const idx = EQ_KEYS.indexOf(eqPreset)
    const nextKey = EQ_KEYS[(idx + 1) % EQ_KEYS.length]
    setEqPreset(nextKey)
  }

  // Launch floating Picture-in-Picture / Native Android Overlay Camera Banner
  const handleFloatingBanner = async (e) => {
    e.stopPropagation()
    if (window.MiLeyNative?.launchFloatingCameraBanner) {
      try {
        window.MiLeyNative.launchFloatingCameraBanner(
          JSON.stringify({
            title: currentTrack.title,
            artist: currentTrack.artistName,
            primaryColor: primary,
            secondaryColor: secondary,
          })
        )
        setPipActive(true)
        return
      } catch { /* fallback to Document PiP */ }
    }

    if ('documentPictureInPicture' in window) {
      try {
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width: 360,
          height: 120,
        })
        pipWin.document.body.style.margin = '0'
        pipWin.document.body.style.background = '#07070B'
        pipWin.document.body.style.color = '#F5F5F7'
        pipWin.document.body.style.fontFamily = 'system-ui, sans-serif'
        pipWin.document.body.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;height:100%;box-sizing:border-box;background:radial-gradient(circle at 20% 20%, ${primary}44, ${secondary}22 60%, #07070B 100%);border-bottom:2px solid ${primary};">
            <div style="display:flex;align-items:center;gap:12px;min-width:0;">
              <img src="${currentTrack.coverUrl || ''}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid ${primary};" />
              <div style="min-width:0;">
                <div style="font-size:10px;letter-spacing:0.15em;color:${primary};font-weight:700;text-transform:uppercase;">MILEY CAMERA TOP BAR</div>
                <div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;">${currentTrack.title}</div>
                <div style="font-size:12px;color:#9CA3AF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;">${currentTrack.artistName || 'MiLey Artist'}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <button id="pip-prev" style="background:rgba(255,255,255,0.1);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;">⏮</button>
              <button id="pip-play" style="background:${primary};border:none;color:#050507;font-weight:bold;width:38px;height:38px;border-radius:50%;cursor:pointer;">⏯</button>
              <button id="pip-next" style="background:rgba(255,255,255,0.1);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;">⏭</button>
            </div>
          </div>
        `
        pipWin.document.getElementById('pip-prev')?.addEventListener('click', () => prev())
        pipWin.document.getElementById('pip-play')?.addEventListener('click', () => togglePlay())
        pipWin.document.getElementById('pip-next')?.addEventListener('click', () => next())
        setPipActive(true)
        pipWin.addEventListener('pagehide', () => setPipActive(false))
        return
      } catch { /* ignore */ }
    }
    setPipActive((v) => !v)
  }

  return (
    <div className="fixed top-1.5 left-1/2 -translate-x-1/2 z-[75] w-full max-w-[440px] px-3 pointer-events-none flex flex-col items-center">
      {/* COMPACT ANDROID CAMERA TOP BAR / PUNCH-HOLE CAPSULE */}
      {!cameraBannerExpanded && (
        <div
          onClick={() => setCameraBannerExpanded(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') setCameraBannerExpanded(true) }}
          className={`pointer-events-auto group relative flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-full bg-[#050508]/95 backdrop-blur-2xl transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
            justChangedTrackId ? 'scale-105' : ''
          }`}
          style={{
            border: `1.5px solid ${primary}88`,
            boxShadow: isPlaying
              ? `0 6px 28px -4px ${primary}66, 0 0 14px -2px ${secondary}55`
              : '0 6px 20px rgba(0,0,0,0.75)',
            minWidth: '276px',
            maxWidth: '370px',
          }}
          title="Tap to expand Camera Top Bar Music Banner"
        >
          {/* Left of Camera Cutout: Spinning Vinyl Disc + Track Info */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={`relative w-7 h-7 rounded-full overflow-hidden shrink-0 border ${
                isPlaying ? 'animate-spin' : ''
              }`}
              style={{
                animationDuration: '6s',
                borderColor: primary,
                background: fallbackCover(currentTrack.title),
              }}
            >
              {currentTrack.coverUrl && (
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-[#050508] border border-white/30" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-bold text-white truncate leading-tight">
                  {currentTrack.title}
                </p>
              </div>
              <p className="text-[9.5px] text-white/65 truncate leading-tight">
                {currentTrack.artistName || 'MiLey Artist'}
              </p>
            </div>
          </div>

          {/* Center Android Front Camera Lens Cutout Indicator */}
          <div className="flex items-center gap-1.5 shrink-0 px-1">
            <div
              className="w-3.5 h-3.5 rounded-full bg-black border border-white/20 flex items-center justify-center shadow-inner"
              title="Camera Top Bar Cutout Anchor"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#121829] border border-cyan-400/30" />
            </div>
            {/* Active Background Audio LED Dot */}
            <span
              className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'animate-pulse' : 'opacity-40'}`}
              style={{ backgroundColor: isPlaying ? '#00E0A8' : '#9CA3AF' }}
              title={isPlaying ? 'Background Audio Active' : 'Paused'}
            />
          </div>

          {/* Right of Camera Cutout: Live Theme Visualizer + Quick Play/Pause */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-end gap-[2px] h-4 px-1">
              {[0.55, 0.95, 0.7, 1.0, 0.6].map((mult, idx) => (
                <span
                  key={idx}
                  className={`w-[2.5px] rounded-full transition-all duration-300 ${
                    isPlaying ? 'animate-pulse' : ''
                  }`}
                  style={{
                    height: isPlaying ? `${Math.round(mult * 15)}px` : '4px',
                    background: idx % 2 === 0 ? primary : secondary,
                    animationDelay: `${idx * 110}ms`,
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                togglePlay()
              }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[#050508] transition-transform active:scale-90"
              style={{ backgroundColor: primary }}
            >
              {isPlaying ? (
                <Pause className="w-3 h-3 fill-current" />
              ) : (
                <Play className="w-3 h-3 fill-current ml-0.5" />
              )}
            </button>
          </div>

          {/* Bottom Micro Progress Hairline */}
          <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-200"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${primary}, ${secondary})`,
              }}
            />
          </div>
        </div>
      )}

      {/* EXPANDED PRO CAMERA TOP BAR MUSIC BANNER */}
      {cameraBannerExpanded && (
        <div
          className="pointer-events-auto relative w-full rounded-3xl overflow-hidden border backdrop-blur-2xl shadow-2xl transition-all duration-300 animate-fade-in"
          style={{
            borderColor: `${primary}77`,
            background: activeSongTheme.bgStyle,
            boxShadow: `0 18px 50px -8px ${primary}55, 0 0 28px -6px ${secondary}44`,
          }}
        >
          {/* Optional Custom Uploaded Song Theme Background Image */}
          {activeSongTheme.bgImageUrl && (
            <div
              className="absolute inset-0 opacity-30 bg-cover bg-center pointer-events-none"
              style={{ backgroundImage: `url(${activeSongTheme.bgImageUrl})` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/75 to-[#07070C]/95 pointer-events-none" />

          <div className="relative p-3.5">
            {/* Top Status Row: Camera Cutout Pill + Song Theme Badge + Collapse */}
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-black/60 border border-white/15"
                  style={{ color: primary }}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  {activeSongTheme.name}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  {backgroundPlayActive ? 'BG KEEP-ALIVE ON' : 'CAMERA BAR PRO'}
                </span>
              </div>

              {/* Simulated Camera Cutout Lens in Center-Right */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={cycleEqPreset}
                  className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/15 text-[10px] font-mono text-white/85 flex items-center gap-1 border border-white/10"
                  title="Cycle Audio Equalizer Preset"
                >
                  <Sliders className="w-2.5 h-2.5" style={{ color: primary }} />
                  {EQ_PRESETS[eqPreset]?.label || 'Flat'}
                </button>
                <button
                  type="button"
                  onClick={handleFloatingBanner}
                  className={`p-1.5 rounded-full border transition-colors ${
                    pipActive
                      ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                      : 'bg-white/10 border-white/10 text-white/75 hover:text-white'
                  }`}
                  title="Pop-Out Floating Camera Music Banner (Keep on top when closing/switching)"
                >
                  <PictureInPicture2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCameraBannerExpanded(false)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80"
                  aria-label="Minimize Camera Banner"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Main Track Row: Spinning Vinyl Art + Metadata + Transport */}
            <div className="flex items-center gap-3">
              <div
                onClick={() => {
                  setCameraBannerExpanded(false)
                  setFullOpen(true)
                }}
                className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 cursor-pointer border-2 shadow-lg group"
                style={{
                  borderColor: primary,
                  background: fallbackCover(currentTrack.title),
                }}
              >
                {currentTrack.coverUrl && (
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Maximize2 className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p
                  onClick={() => {
                    setCameraBannerExpanded(false)
                    setFullOpen(true)
                  }}
                  className="text-sm font-bold text-white truncate cursor-pointer hover:underline"
                >
                  {currentTrack.title}
                </p>
                <p
                  onClick={() => {
                    if (currentTrack.artistId) {
                      setCameraBannerExpanded(false)
                      navigate(`/artist/${currentTrack.artistId}`)
                    }
                  }}
                  className="text-xs text-white/70 truncate cursor-pointer hover:text-white"
                >
                  {currentTrack.artistName || 'MiLey Artist'}
                  {currentTrack.genre ? ` · ${currentTrack.genre}` : ''}
                </p>

                {/* Live 12-Bar Song Theme Spectrum Visualizer */}
                <div className="mt-1.5 flex items-end gap-1 h-3.5">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-1 rounded-full transition-all duration-300 ${
                        isPlaying ? 'animate-pulse' : ''
                      }`}
                      style={{
                        height: isPlaying ? `${30 + ((i * 23) % 70)}%` : '22%',
                        background: i % 2 === 0 ? primary : secondary,
                        animationDelay: `${i * 75}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Transport Controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleLike(currentTrack)}
                  className="p-2 rounded-full text-white/75 hover:text-white active:scale-90"
                  aria-label="Like track"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      liked ? 'fill-accent-secondary text-accent-secondary' : ''
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={prev}
                  className="p-2 rounded-full text-white/85 hover:bg-white/10 active:scale-90"
                  aria-label="Previous"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[#050508] shadow-lg active:scale-95 transition-transform"
                  style={{
                    background: `linear-gradient(135deg, ${primary}, ${secondary})`,
                  }}
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
                  onClick={next}
                  className="p-2 rounded-full text-white/85 hover:bg-white/10 active:scale-90"
                  aria-label="Next"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>
              </div>
            </div>

            {/* Interactive Scrub Bar + Timestamps */}
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-[10px] font-mono text-white/60 w-8">
                {formatDuration(currentTime)}
              </span>
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                  seek(ratio * (duration || currentTrack.duration || 0))
                }}
                className="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden cursor-pointer relative"
              >
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${primary}, ${secondary})`,
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-white/60 w-8 text-right">
                {formatDuration(duration || currentTrack.duration || 0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
