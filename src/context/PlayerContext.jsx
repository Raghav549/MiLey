import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { db } from '../lib/db'
import { resolveMediaUrl } from '../lib/localBackend'
import { getSongTheme } from '../musicHelpers'

const PlayerContext = createContext(null)

export const EQ_PRESETS = {
  flat:       { label: 'Flat',        gains: [0, 0, 0, 0, 0] },
  bass:       { label: 'Bass Boost',  gains: [7, 5, 0, 1, 2] },
  bollywood:  { label: 'Bollywood',   gains: [4, 2, 3, 4, 5] },
  vocal:      { label: 'Vocal',       gains: [-2, 1, 5, 4, 1] },
  electronic: { label: 'Electronic',  gains: [6, 3, -1, 3, 6] },
  acoustic:   { label: 'Acoustic',    gains: [3, 2, 1, 3, 4] },
}

const EQ_FREQS = [60, 230, 910, 3600, 14000]

export function PlayerProvider({ children }) {
  const audioRef = useRef(null)
  const audioCtxRef = useRef(null)
  const filtersRef = useRef([])
  const bassNodeRef = useRef(null)
  const sourceAttachedRef = useRef(false)

  const [currentTrack, setCurrentTrack] = useState(null)
  const [queue, setQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.9)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off') // 'off' | 'all' | 'one'
  const [fullOpen, setFullOpen] = useState(false)
  const [eqPreset, setEqPreset] = useState(() => localStorage.getItem('miley_eq') || 'flat')
  const [bassBoost, setBassBoost] = useState(() => Number(localStorage.getItem('miley_bass') || 0))
  const [sleepRemaining, setSleepRemaining] = useState(0) // seconds, 0 = off
  const [cameraBannerExpanded, setCameraBannerExpanded] = useState(false)
  const [cameraBannerPinned, setCameraBannerPinned] = useState(true)
  const [backgroundPlayActive, setBackgroundPlayActive] = useState(false)
  const sleepTimerRef = useRef(null)

  const activeSongTheme = getSongTheme(currentTrack)

  // Lazy-create HTMLAudioElement
  if (!audioRef.current && typeof window !== 'undefined') {
    const a = new Audio()
    a.preload = 'auto'
    a.crossOrigin = 'anonymous'
    audioRef.current = a
  }

  const ensureAudioGraph = useCallback(() => {
    if (sourceAttachedRef.current || !audioRef.current) return
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const src = ctx.createMediaElementSource(audioRef.current)
      const bass = ctx.createBiquadFilter()
      bass.type = 'lowshelf'
      bass.frequency.value = 100
      bass.gain.value = bassBoost

      const filters = EQ_FREQS.map((freq, idx) => {
        const f = ctx.createBiquadFilter()
        f.type = idx === 0 ? 'lowshelf' : idx === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking'
        f.frequency.value = freq
        f.Q.value = 1.0
        const preset = EQ_PRESETS[eqPreset] || EQ_PRESETS.flat
        f.gain.value = preset.gains[idx] || 0
        return f
      })

      let node = src
      node.connect(bass)
      node = bass
      for (const f of filters) {
        node.connect(f)
        node = f
      }
      node.connect(ctx.destination)

      audioCtxRef.current = ctx
      bassNodeRef.current = bass
      filtersRef.current = filters
      sourceAttachedRef.current = true
    } catch {
      // Fallback: raw audio element works without WebAudio graph
    }
  }, [bassBoost, eqPreset])

  useEffect(() => {
    const preset = EQ_PRESETS[eqPreset] || EQ_PRESETS.flat
    filtersRef.current.forEach((f, i) => {
      if (f) f.gain.value = preset.gains[i] || 0
    })
    localStorage.setItem('miley_eq', eqPreset)
  }, [eqPreset])

  useEffect(() => {
    if (bassNodeRef.current) bassNodeRef.current.gain.value = bassBoost
    localStorage.setItem('miley_bass', String(bassBoost))
  }, [bassBoost])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const loadAndPlay = useCallback(async (track) => {
    if (!track || !audioRef.current) return
    setCurrentTrack(track)
    setCurrentTime(0)
    setDuration(track.duration || 0)

    const el = audioRef.current
    try {
      const resolvedUrl = await resolveMediaUrl(track.audioUrl)
      el.src = resolvedUrl || ''
      el.currentTime = 0
      ensureAudioGraph()
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {})
      }
      await el.play()
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
    }

    // Record play count + recent history
    if (track.id) {
      db.incrementShared('tracks', track.id, 'plays', 1).catch(() => {})
      db.upsert('history', {
        trackId: track.id,
        title: track.title,
        artistName: track.artistName,
        coverUrl: track.coverUrl,
        audioUrl: track.audioUrl,
        duration: track.duration || 0,
        playedAt: new Date().toISOString(),
      }, track.id).catch(() => {})
    }
  }, [ensureAudioGraph])

  const playTrack = useCallback((track, list = null) => {
    if (!track) return
    if (Array.isArray(list) && list.length > 0) {
      const idx = Math.max(0, list.findIndex(t => t.id === track.id))
      setQueue(list)
      setQueueIndex(idx)
    } else if (!queue.some(t => t.id === track.id)) {
      setQueue(prev => [...prev, track])
      setQueueIndex(queue.length)
    } else {
      setQueueIndex(queue.findIndex(t => t.id === track.id))
    }
    loadAndPlay(track)
  }, [queue, loadAndPlay])

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el || !currentTrack) return
    if (el.paused) {
      ensureAudioGraph()
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {})
      }
      el.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      el.pause()
      setIsPlaying(false)
    }
  }, [currentTrack, ensureAudioGraph])

  const next = useCallback(() => {
    if (queue.length === 0) return
    let nextIdx = queueIndex + 1
    if (shuffle && queue.length > 1) {
      nextIdx = Math.floor(Math.random() * queue.length)
    } else if (nextIdx >= queue.length) {
      if (repeat === 'all') nextIdx = 0
      else {
        setIsPlaying(false)
        return
      }
    }
    setQueueIndex(nextIdx)
    loadAndPlay(queue[nextIdx])
  }, [queue, queueIndex, shuffle, repeat, loadAndPlay])

  const prev = useCallback(() => {
    const el = audioRef.current
    if (el && el.currentTime > 3) {
      el.currentTime = 0
      return
    }
    if (queue.length === 0) return
    const prevIdx = queueIndex > 0 ? queueIndex - 1 : queue.length - 1
    setQueueIndex(prevIdx)
    loadAndPlay(queue[prevIdx])
  }, [queue, queueIndex, loadAndPlay])

  const seek = useCallback((sec) => {
    const el = audioRef.current
    if (!el || !isFinite(sec)) return
    el.currentTime = Math.max(0, Math.min(sec, el.duration || duration || sec))
    setCurrentTime(el.currentTime)
  }, [duration])

  const playQueue = useCallback((list = [], startIndex = 0) => {
    if (!Array.isArray(list) || list.length === 0) return
    const idx = Math.max(0, Math.min(startIndex, list.length - 1))
    setQueue(list)
    setQueueIndex(idx)
    loadAndPlay(list[idx])
  }, [loadAndPlay])

  const openFullPlayer = useCallback(() => {
    setFullOpen(true)
  }, [])
  const addToQueue = useCallback((track) => {
    if (!track) return
    setQueue(prev => (prev.some(t => t.id === track.id) ? prev : [...prev, track]))
  }, [])

  // Wire audio element events
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setCurrentTime(el.currentTime || 0)
    const onMeta = () => {
      if (el.duration && isFinite(el.duration)) setDuration(el.duration)
    }
    const onEnd = () => {
      if (repeat === 'one') {
        el.currentTime = 0
        el.play().catch(() => {})
      } else {
        next()
      }
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('ended', onEnd)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
    }
  }, [repeat, next])

  // Sync with Native Android Bridge (Foreground Music Service + Camera Top Bar Cutout Banner) & MediaSession API
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Expose global callback hooks for Native Android Service buttons (Play/Pause/Next/Prev from Camera Top Bar & Notification)
    window.__mileyPlayerControls = {
      togglePlay,
      next,
      prev,
      seek,
    }

    if (currentTrack && window.MiLeyNative) {
      try {
        window.MiLeyNative.updateNowPlaying?.(
          JSON.stringify({
            id: currentTrack.id,
            title: currentTrack.title || 'Untitled',
            artist: currentTrack.artistName || 'MiLey Artist',
            coverUrl: currentTrack.coverUrl || '',
            isPlaying,
            duration: Math.round(duration || currentTrack.duration || 0),
            position: Math.round(currentTime || 0),
            primaryColor: activeSongTheme.primaryColor,
            secondaryColor: activeSongTheme.secondaryColor,
            themeName: activeSongTheme.name,
          })
        )
      } catch { /* ignore */ }
    }

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && currentTrack) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: currentTrack.title || 'Untitled',
          artist: currentTrack.artistName || 'Unknown Artist',
          album: currentTrack.albumTitle || `MiLey · ${activeSongTheme.name}`,
          artwork: currentTrack.coverUrl
            ? [{ src: currentTrack.coverUrl, sizes: '512x512', type: 'image/png' }]
            : [],
        })
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
        navigator.mediaSession.setActionHandler('play', () => togglePlay())
        navigator.mediaSession.setActionHandler('pause', () => togglePlay())
        navigator.mediaSession.setActionHandler('previoustrack', () => prev())
        navigator.mediaSession.setActionHandler('nexttrack', () => next())
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime != null) seek(details.seekTime)
        })
      } catch { /* ignore */ }
    }
  }, [currentTrack, isPlaying, duration, currentTime, activeSongTheme, togglePlay, prev, next, seek])

  // Keep music playing when user backgrounds/closes app & activate Camera Top Bar Banner
  useEffect(() => {
    if (typeof document === 'undefined') return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (currentTrack && isPlaying) {
          setBackgroundPlayActive(true)
          if (audioCtxRef.current?.state === 'suspended') {
            audioCtxRef.current.resume().catch(() => {})
          }
          try {
            window.MiLeyNative?.onAppBackgrounded?.(
              JSON.stringify({
                title: currentTrack.title,
                artist: currentTrack.artistName,
                primaryColor: activeSongTheme.primaryColor,
                secondaryColor: activeSongTheme.secondaryColor,
                isPlaying: true,
              })
            )
          } catch { /* ignore */ }
        }
      } else {
        try {
          window.MiLeyNative?.onAppForegrounded?.()
        } catch { /* ignore */ }
        if (currentTrack && isPlaying) {
          // Briefly expand the Camera Top Bar Banner on return to show continuous playback status
          setCameraBannerExpanded(true)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [currentTrack, isPlaying, activeSongTheme])

  // Hydrate initial featured track so Camera Top Bar Music Banner & MiniPlayer are ready on launch
  useEffect(() => {
    let mounted = true
    db.selectShared('tracks', {}, { order: '-createdAt', limit: 5 })
      .then((rows) => {
        if (mounted && Array.isArray(rows) && rows.length > 0) {
          setCurrentTrack((prev) => prev || rows[0])
          setQueue((prev) => (prev.length > 0 ? prev : rows))
          setDuration((prev) => prev || rows[0].duration || 198)
          if (audioRef.current && !audioRef.current.src && rows[0].audioUrl) {
            resolveMediaUrl(rows[0].audioUrl)
              .then((resolved) => {
                if (mounted && audioRef.current && !audioRef.current.src) {
                  audioRef.current.src = resolved || ''
                }
              })
              .catch(() => {})
          }
        }
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  // Sleep timer countdown
  const startSleepTimer = useCallback((minutes) => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
    if (!minutes || minutes <= 0) {
      setSleepRemaining(0)
      return
    }
    setSleepRemaining(minutes * 60)
    sleepTimerRef.current = setInterval(() => {
      setSleepRemaining(prevSec => {
        if (prevSec <= 1) {
          clearInterval(sleepTimerRef.current)
          if (audioRef.current) audioRef.current.pause()
          setIsPlaying(false)
          return 0
        }
        return prevSec - 1
      })
    }, 1000)
  }, [])

  useEffect(() => () => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
  }, [])

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        queueIndex,
        isPlaying,
        currentTime,
        duration,
        volume,
        setVolume,
        shuffle,
        setShuffle,
        repeat,
        setRepeat,
        fullOpen,
        setFullOpen,
        openFullPlayer,
        playTrack,
        playQueue,
        togglePlay,
        next,
        prev,
        seek,
        addToQueue,
        setQueue,
        eqPreset,
        setEqPreset,
        bassBoost,
        setBassBoost,
        sleepRemaining,
        startSleepTimer,
        activeSongTheme,
        cameraBannerExpanded,
        setCameraBannerExpanded,
        cameraBannerPinned,
        setCameraBannerPinned,
        backgroundPlayActive,
      }}
    >
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be inside PlayerProvider')
  return ctx
}
