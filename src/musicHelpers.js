import { APP_DOMAIN } from './lib/supabaseClient'
import { makeSvgArt } from './lib/localBackend'

export { APP_DOMAIN }

export const GENRES = [
  'Bollywood', 'Classical', 'Pop', 'Hip-Hop', 'R&B', 'Electronic', 'Rock',
  'Indie', 'Punjabi', 'Sufi', 'Devotional', 'Lo-Fi', 'Jazz', 'Acoustic', 'Podcast',
]

export const LANGUAGES = [
  'Hindi', 'English', 'Punjabi', 'Tamil', 'Telugu', 'Bengali',
  'Marathi', 'Spanish', 'Korean', 'Instrumental',
]

export const MOODS = [
  { id: 'happy', label: 'Happy', color: '#FFBE0B', gradient: 'from-amber-500/30 to-orange-600/10' },
  { id: 'chill', label: 'Chill', color: '#00E0A8', gradient: 'from-emerald-500/30 to-teal-700/10' },
  { id: 'romantic', label: 'Romantic', color: '#FF3DAE', gradient: 'from-pink-500/30 to-rose-700/10' },
  { id: 'workout', label: 'Workout', color: '#FF5722', gradient: 'from-orange-500/30 to-red-700/10' },
  { id: 'sad', label: 'Melancholy', color: '#6366F1', gradient: 'from-indigo-500/30 to-slate-800/10' },
  { id: 'party', label: 'Party', color: '#A855F7', gradient: 'from-purple-500/30 to-pink-700/10' },
  { id: 'focus', label: 'Focus', color: '#06B6D4', gradient: 'from-cyan-500/30 to-blue-800/10' },
  { id: 'devotional', label: 'Peace', color: '#F59E0B', gradient: 'from-yellow-500/30 to-amber-800/10' },
]

export const SONG_THEME_PRESETS = [
  {
    id: 'cyber-neon',
    name: 'Cyber Neon Pulse',
    primaryColor: '#00E0A8',
    secondaryColor: '#06B6D4',
    visualizer: 'bars',
    bgStyle: 'radial-gradient(circle at 20% 20%, rgba(0,224,168,0.42), rgba(6,182,212,0.18) 55%, #08090E 100%)',
    previewBg: makeSvgArt('THEME', 'CYBER NEON', '#00E0A8', '#080C18'),
  },
  {
    id: 'velvet-rose',
    name: 'Velvet Rose Glow',
    primaryColor: '#FF3DAE',
    secondaryColor: '#9333EA',
    visualizer: 'circular',
    bgStyle: 'radial-gradient(circle at 80% 20%, rgba(255,61,174,0.45), rgba(147,51,234,0.2) 55%, #0D0714 100%)',
    previewBg: makeSvgArt('THEME', 'VELVET ROSE', '#FF3DAE', '#16081C'),
  },
  {
    id: 'royal-gold',
    name: 'Royal Gold Stage',
    primaryColor: '#F59E0B',
    secondaryColor: '#EF4444',
    visualizer: 'vinyl',
    bgStyle: 'radial-gradient(circle at 50% 15%, rgba(245,158,11,0.45), rgba(239,68,68,0.18) 55%, #120B07 100%)',
    previewBg: makeSvgArt('THEME', 'ROYAL GOLD', '#F59E0B', '#180E06'),
  },
  {
    id: 'emerald-monsoon',
    name: 'Emerald Monsoon',
    primaryColor: '#10B981',
    secondaryColor: '#0EA5E9',
    visualizer: 'wave',
    bgStyle: 'radial-gradient(circle at 25% 30%, rgba(16,185,129,0.42), rgba(14,165,233,0.18) 55%, #061012 100%)',
    previewBg: makeSvgArt('THEME', 'MONSOON', '#10B981', '#061316'),
  },
  {
    id: 'sakura-starlight',
    name: 'Sakura Starlight',
    primaryColor: '#EC4899',
    secondaryColor: '#6366F1',
    visualizer: 'orbs',
    bgStyle: 'radial-gradient(circle at 70% 25%, rgba(236,72,153,0.42), rgba(99,102,241,0.22) 55%, #0B0818 100%)',
    previewBg: makeSvgArt('THEME', 'SAKURA', '#EC4899', '#0E0920'),
  },
  {
    id: 'cosmic-studio',
    name: 'Cosmic Studio 808',
    primaryColor: '#A855F7',
    secondaryColor: '#EC4899',
    visualizer: 'bars',
    bgStyle: 'radial-gradient(circle at 50% 20%, rgba(168,85,247,0.45), rgba(236,72,153,0.20) 55%, #090612 100%)',
    previewBg: makeSvgArt('THEME', 'COSMIC 808', '#A855F7', '#11081F'),
  },
  {
    id: 'midnight-aurora',
    name: 'Midnight Aurora',
    primaryColor: '#38BDF8',
    secondaryColor: '#00E0A8',
    visualizer: 'circular',
    bgStyle: 'radial-gradient(circle at 30% 20%, rgba(56,189,248,0.42), rgba(0,224,168,0.18) 55%, #060B14 100%)',
    previewBg: makeSvgArt('THEME', 'AURORA', '#38BDF8', '#060D1A'),
  },
]

export const VISUALIZER_STYLES = [
  { id: 'bars', label: 'Spectrum Bars' },
  { id: 'circular', label: 'Circular Halo' },
  { id: 'vinyl', label: 'Vinyl Pulse' },
  { id: 'wave', label: 'Wave Ribbon' },
  { id: 'orbs', label: 'Floating Orbs' },
]

export function getSongTheme(track) {
  const defaultPreset = SONG_THEME_PRESETS[0]
  if (!track) return defaultPreset
  const custom = track.songTheme || {}
  const preset = SONG_THEME_PRESETS.find((p) => p.id === custom.presetId) || defaultPreset
  const primaryColor = custom.primaryColor || preset.primaryColor || '#00E0A8'
  const secondaryColor = custom.secondaryColor || preset.secondaryColor || '#FF3DAE'
  const visualizer = custom.visualizer || preset.visualizer || 'bars'
  const name = custom.name || preset.name || 'Cyber Neon Pulse'
  const bgImageUrl = custom.bgImageUrl || ''
  const bgStyle = `radial-gradient(circle at 30% 20%, ${primaryColor}55, ${secondaryColor}28 55%, #08080C 100%)`
  return {
    presetId: custom.presetId || preset.id,
    name,
    primaryColor,
    secondaryColor,
    visualizer,
    bgImageUrl,
    bgStyle,
  }
}

export const ROOM_BACKGROUNDS = [
  { id: 'neon', label: 'Neon Stage', style: 'radial-gradient(circle at 30% 20%, rgba(0,224,168,0.35), transparent 55%), radial-gradient(circle at 80% 70%, rgba(255,61,174,0.3), transparent 55%), #0B0B0B' },
  { id: 'sunset', label: 'Sunset Lounge', style: 'linear-gradient(160deg, #3b0a2a 0%, #1a0b2e 50%, #0b0b0b 100%)' },
  { id: 'ocean', label: 'Midnight Ocean', style: 'linear-gradient(160deg, #042f2e 0%, #0c192c 55%, #0b0b0b 100%)' },
  { id: 'gold', label: 'Royal Gold', style: 'radial-gradient(circle at 50% 10%, rgba(245,158,11,0.32), transparent 60%), #0B0B0B' },
  { id: 'cyber', label: 'Cyber Grid', style: 'radial-gradient(circle at 20% 80%, rgba(168,85,247,0.38), transparent 50%), radial-gradient(circle at 80% 20%, rgba(6,182,212,0.32), transparent 50%), #0B0B0B' },
  { id: 'crimson', label: 'Velvet Crimson', style: 'linear-gradient(160deg, #3b0712 0%, #1a0610 55%, #0b0b0b 100%)' },
  { id: 'nebula', label: 'Cosmic Nebula', url: makeSvgArt('NEBULA', 'COSMIC STAGE', '#A855F7', '#090616') },
  { id: 'city', label: 'Night City', url: makeSvgArt('CYBER CITY', 'TOKYO NIGHTS', '#00E0A8', '#061018') },
  { id: 'vinyl', label: 'Vinyl Studio', url: makeSvgArt('VINYL 808', 'ANALOG ROOM', '#F59E0B', '#140C06') },
]

export function roomBgStyle(bgId, customUrl) {
  if (bgId === 'custom' && customUrl) {
    return {
      backgroundImage: `linear-gradient(to bottom, rgba(11,11,11,0.45), rgba(11,11,11,0.88)), url(${customUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  const found = ROOM_BACKGROUNDS.find(b => b.id === bgId) || ROOM_BACKGROUNDS[0]
  if (found.url) {
    return {
      backgroundImage: `linear-gradient(to bottom, rgba(11,11,11,0.45), rgba(11,11,11,0.88)), url(${found.url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return { background: found.style }
}

export function formatDuration(sec) {
  if (!sec || !isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export function formatCount(n) {
  const num = Number(n) || 0
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(num)
}

export function parseLyrics(raw) {
  if (!raw || typeof raw !== 'string') return { synced: false, lines: [] }
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const lrcRe = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/
  const parsed = []
  let syncedCount = 0
  for (const line of lines) {
    const m = line.match(lrcRe)
    if (m) {
      syncedCount++
      const min = parseInt(m[1], 10)
      const sec = parseInt(m[2], 10)
      const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0
      parsed.push({ time: min * 60 + sec + ms / 1000, text: m[4] || '♪' })
    } else {
      parsed.push({ time: null, text: line })
    }
  }
  if (syncedCount >= 2) {
    return {
      synced: true,
      lines: parsed.filter(l => l.time !== null).sort((a, b) => a.time - b.time),
    }
  }
  return { synced: false, lines: parsed.map((l, i) => ({ time: i * 4, text: l.text })) }
}

export function fallbackCover(seed = 'MiLey') {
  const palette = [
    ['#00E0A8', '#0D9488'],
    ['#FF3DAE', '#9333EA'],
    ['#FFBE0B', '#F97316'],
    ['#06B6D4', '#3B82F6'],
    ['#A855F7', '#EC4899'],
  ]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const [c1, c2] = palette[h % palette.length]
  return `linear-gradient(135deg, ${c1}, ${c2})`
}

export const GENRE_SUGGESTIONS = GENRES
export const LANGUAGE_SUGGESTIONS = LANGUAGES
export const MOOD_SUGGESTIONS = MOODS.map((m) => m.label)

export function isPublicVisible(item) {
  if (!item) return false
  if (item.isHidden || item.deleted) return false
  if (item.visibility && item.visibility !== 'public') return false
  return true
}

export async function ensureCategory(name, _type = 'genre') {
  return (name || '').trim()
}

export function timeAgo(iso) {
  if (!iso) return 'just now'
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

