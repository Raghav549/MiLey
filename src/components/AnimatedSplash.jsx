import { useState, useEffect } from 'react'

export default function AnimatedSplash() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return !sessionStorage.getItem('miley_splash_shown')
  })
  const [fading, setFading] = useState(false)
  const [stage, setStage] = useState(0)

  const runSplashSequence = () => {
    setVisible(true)
    setFading(false)
    setStage(0)
    const t1 = setTimeout(() => setStage(1), 220)
    const t2 = setTimeout(() => setStage(2), 750)
    const t3 = setTimeout(() => setFading(true), 2150)
    const t4 = setTimeout(() => {
      setVisible(false)
      sessionStorage.setItem('miley_splash_shown', '1')
    }, 2600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }

  useEffect(() => {
    let cleanup = null
    if (visible) {
      cleanup = runSplashSequence()
    }
    const onReplay = () => {
      if (cleanup) cleanup()
      cleanup = runSplashSequence()
    }
    window.addEventListener('miley:replay-splash', onReplay)
    return () => {
      if (cleanup) cleanup()
      window.removeEventListener('miley:replay-splash', onReplay)
    }
  }, [])

  if (!visible) return null

  const skipSplash = () => {
    setFading(true)
    sessionStorage.setItem('miley_splash_shown', '1')
    setTimeout(() => setVisible(false), 260)
  }

  return (
    <div
      onClick={skipSplash}
      className={`fixed inset-0 z-[120] flex flex-col items-center justify-between overflow-hidden select-none cursor-pointer transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background:
          'radial-gradient(circle at 50% 35%, rgba(0, 224, 168, 0.22) 0%, rgba(255, 61, 174, 0.14) 38%, #060609 78%)',
      }}
    >
      {/* Top Camera Cutout Accent */}
      <div className="pt-4 flex flex-col items-center">
        <div className="px-4 py-1 rounded-full bg-black/80 border border-white/10 flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-accent-primary animate-ping" />
          <span className="text-[10px] font-mono tracking-[0.22em] text-white/70 uppercase">
            MILEY STUDIO ENGINE · ANDROID & WEB
          </span>
        </div>
      </div>

      {/* Center Sonic Vinyl + Heart Wave Emblem + 24-Bar Radial Equalizer */}
      <div className="relative flex flex-col items-center">
        {/* Expanding Sonic Aura Rings */}
        <div className="relative w-56 h-56 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full border border-accent-primary/30 animate-ping"
            style={{ animationDuration: '2.4s' }}
          />
          <div
            className="absolute inset-4 rounded-full border border-accent-secondary/35 animate-pulse"
            style={{ animationDuration: '1.8s' }}
          />
          <div
            className="absolute inset-8 rounded-full opacity-55 blur-2xl"
            style={{
              background: 'linear-gradient(135deg, #00E0A8 0%, #FF3DAE 55%, #6366F1 100%)',
            }}
          />

          {/* 3D Spinning Vinyl Disc */}
          <div
            className={`relative w-36 h-36 rounded-full flex items-center justify-center shadow-[0_0_55px_rgba(0,224,168,0.45)] transition-all duration-700 ${
              stage >= 1 ? 'scale-100 rotate-0 opacity-100' : 'scale-75 -rotate-45 opacity-0'
            }`}
            style={{
              background:
                'repeating-radial-gradient(circle at center, #0B0B10 0px, #0B0B10 4px, #191924 5px, #0B0B10 7px)',
              border: '2px solid rgba(255,255,255,0.16)',
            }}
          >
            {/* Vinyl Sheen */}
            <div
              className="absolute inset-0 rounded-full animate-spin"
              style={{
                animationDuration: '3.2s',
                background:
                  'conic-gradient(from 0deg, transparent 0deg, rgba(0,224,168,0.22) 60deg, transparent 120deg, rgba(255,61,174,0.22) 240deg, transparent 300deg)',
              }}
            />

            {/* Center MiLey Heart-Wave Core */}
            <div className="relative w-20 h-20 rounded-full bg-[#09090E] border-2 border-white/15 flex items-center justify-center shadow-inner">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="drop-shadow-[0_0_12px_rgba(0,224,168,0.65)]">
                <defs>
                  <linearGradient id="splashHeartGrad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00E0A8" />
                    <stop offset="0.55" stopColor="#FF3DAE" />
                    <stop offset="1" stopColor="#A855F7" />
                  </linearGradient>
                </defs>
                <circle cx="24" cy="24" r="20" stroke="url(#splashHeartGrad)" strokeWidth="2.4" strokeDasharray="6 3" />
                <path
                  d="M24 34c-6-3.1-9-7.8-9-12.6a6 6 0 0 1 9-5.2 6 6 0 0 1 9 5.2c0 4.8-3 9.5-9 12.6Z"
                  fill="url(#splashHeartGrad)"
                />
                <path d="M20 22v4M24 19v9M28 22v4" stroke="#0B0B0B" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Live Animated 20-Bar Equalizer */}
        <div className="mt-4 flex items-end justify-center gap-1 h-9 px-6">
          {Array.from({ length: 20 }).map((_, i) => {
            const heights = [35, 65, 90, 50, 80, 100, 60, 85, 45, 95, 95, 45, 85, 60, 100, 80, 50, 90, 65, 35]
            return (
              <span
                key={i}
                className="w-1 rounded-full transition-all duration-300 animate-pulse"
                style={{
                  height: `${stage >= 1 ? heights[i] : 20}%`,
                  background: i % 2 === 0 ? '#00E0A8' : '#FF3DAE',
                  animationDelay: `${i * 60}ms`,
                  animationDuration: '650ms',
                }}
              />
            )
          })}
        </div>

        {/* Brand Wordmark & Tagline */}
        <div
          className={`mt-5 text-center transition-all duration-700 ${
            stage >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <h1
            className="text-5xl font-extrabold tracking-tight"
            style={{
              fontFamily: 'var(--font-display)',
              background: 'linear-gradient(90deg, #FFFFFF 0%, #00E0A8 48%, #FF3DAE 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            MiLey
          </h1>
          <p className="mt-1.5 text-xs font-mono tracking-[0.28em] text-white/75 uppercase">
            GLOBAL BEATS · YOUR STAGE
          </p>
        </div>

        {/* Feature Pill Highlights */}
        <div
          className={`mt-5 flex items-center gap-2 transition-all duration-700 ${
            stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/5 border border-white/10 text-accent-primary">
            ✦ Song Themes
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/5 border border-white/10 text-accent-secondary">
            ✦ Live Listen Rooms
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/5 border border-white/10 text-cyan-300">
            ✦ Camera Music Bar
          </span>
        </div>
      </div>

      {/* Bottom Official Domain Footer */}
      <div className="pb-8 flex flex-col items-center gap-1.5">
        <div className="px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-white/80">
          mileymusic.space
        </div>
        <span className="text-[10px] text-white/40">Tap anywhere to enter immediately</span>
      </div>
    </div>
  )
}
