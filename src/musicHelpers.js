import { db } from './lib/db'

// Default suggestions — users can also type any custom language, genre or mood;
// new values are persisted to the shared `categories` table so everyone sees them.
export const GENRE_SUGGESTIONS = ['Pop', 'Hip-Hop', 'Rock', 'Electronic', 'R&B', 'Jazz', 'Classical', 'Acoustic', 'Indie', 'Lo-Fi', 'Folk', 'Devotional', 'Synthwave', 'Bollywood', 'Afrobeats']
export const LANGUAGE_SUGGESTIONS = ['Hindi', 'English', 'Punjabi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Spanish', 'Korean', 'Arabic', 'Instrumental']
export const MOOD_SUGGESTIONS = ['Chill', 'Sad', 'Romantic', 'Workout', 'Study', 'Party', 'Late Night', 'Focus']

export const GENRES = GENRE_SUGGESTIONS
export const LANGUAGES = LANGUAGE_SUGGESTIONS
export const MOODS = MOOD_SUGGESTIONS

// Built-in presets for Direct Upload Song Themes (used in single & bulk upload)
export const SONG_THEME_PRESETS = [
  {
    key: 'emerald_pulse',
    id: 'emerald_pulse',
    name: 'MiLey Signature',
    primaryColor: '#00E0A8',
    secondaryColor: '#FF3DAE',
    accentColor: '#6EE7B7',
    bgGradient: 'linear-gradient(135deg, rgba(0,224,168,0.28) 0%, rgba(255,61,174,0.24) 55%, #0B0B0B 100%)',
    visualizerStyle: 'bars',
    animatedBg: 'aurora',
    lyricsGlow: true,
    particleEffect: 'sparkles',
    badgeLabel: 'Signature',
  },
  {
    key: 'cyber_pink',
    id: 'cyber_pink',
    name: 'Cyber Rosé',
    primaryColor: '#FF3DAE',
    secondaryColor: '#A855F7',
    accentColor: '#F472B6',
    bgGradient: 'linear-gradient(135deg, rgba(255,61,174,0.32) 0%, rgba(168,85,247,0.24) 55%, #0B0B0B 100%)',
    visualizerStyle: 'wave',
    animatedBg: 'nebula',
    lyricsGlow: true,
    particleEffect: 'neon_orbs',
    badgeLabel: 'Cyber Rosé',
  },
  {
    key: 'midnight_cyan',
    id: 'midnight_cyan',
    name: 'Oceanic Cyan',
    primaryColor: '#06B6D4',
    secondaryColor: '#3B82F6',
    accentColor: '#67E8F9',
    bgGradient: 'linear-gradient(135deg, rgba(6,182,212,0.30) 0%, rgba(59,130,246,0.24) 55%, #0B0B0B 100%)',
    visualizerStyle: 'circle',
    animatedBg: 'waves',
    lyricsGlow: true,
    particleEffect: 'rain',
    badgeLabel: 'Oceanic',
  },
  {
    key: 'solar_gold',
    id: 'solar_gold',
    name: 'Solar Flare',
    primaryColor: '#F59E0B',
    secondaryColor: '#EF4444',
    accentColor: '#FDE047',
    bgGradient: 'linear-gradient(135deg, rgba(245,158,11,0.30) 0%, rgba(239,68,68,0.24) 55%, #0B0B0B 100%)',
    visualizerStyle: 'pulse',
    animatedBg: 'ember',
    lyricsGlow: true,
    particleEffect: 'embers',
    badgeLabel: 'Solar Gold',
  },
  {
    key: 'velvet_violet',
    id: 'velvet_violet',
    name: 'Velvet Haze',
    primaryColor: '#8B5CF6',
    secondaryColor: '#EC4899',
    accentColor: '#C4B5FD',
    bgGradient: 'linear-gradient(135deg, rgba(139,92,246,0.30) 0%, rgba(236,72,153,0.24) 55%, #0B0B0B 100%)',
    visualizerStyle: 'galaxy',
    animatedBg: 'vinyl',
    lyricsGlow: true,
    particleEffect: 'dust',
    badgeLabel: 'Velvet Haze',
  },
  {
    key: 'crimson_stage',
    id: 'crimson_stage',
    name: 'Crimson Stage',
    primaryColor: '#F43F5E',
    secondaryColor: '#FB923C',
    accentColor: '#FDA4AF',
    bgGradient: 'linear-gradient(135deg, rgba(244,63,94,0.32) 0%, rgba(251,146,60,0.22) 55%, #0B0B0B 100%)',
    visualizerStyle: 'spectrum',
    animatedBg: 'laser',
    lyricsGlow: true,
    particleEffect: 'lasers',
    badgeLabel: 'Stage Live',
  },
]

export const VISUALIZER_STYLES = [
  { id: 'bars', label: 'Studio Bars' },
  { id: 'wave', label: 'Silk Wave' },
  { id: 'circle', label: 'Halo Ring' },
  { id: 'pulse', label: 'Bass Pulse' },
  { id: 'galaxy', label: 'Vinyl Orbit' },
  { id: 'spectrum', label: 'Laser Spectrum' },
]

export function getSongTheme(track) {
  if (!track) return SONG_THEME_PRESETS[0]
  const raw = track.songTheme || track.song_theme
  if (raw && typeof raw === 'object' && raw.primaryColor) {
    const preset = SONG_THEME_PRESETS.find((p) => p.key === (raw.key || raw.id)) || SONG_THEME_PRESETS[0]
    return { ...preset, ...raw }
  }
  if (typeof raw === 'string') {
    const found = SONG_THEME_PRESETS.find((p) => p.key === raw || p.id === raw)
    if (found) return found
  }
  return SONG_THEME_PRESETS[0]
}

export const ROOM_PURPOSES = ['Music', 'Friends', 'Chill', 'Gaming', 'Podcast', 'Discussion', 'Study', 'Community', 'Custom']

export const ROOM_SEAT_COUNT = 9

export const COVER_PLACEHOLDER_GRADIENTS = [
  'from-emerald-500/40 to-pink-500/40',
  'from-pink-500/40 to-emerald-400/30',
  'from-emerald-400/30 to-purple-500/30',
  'from-fuchsia-500/30 to-emerald-500/30',
]

export function gradientFor(seed) {
  const s = (seed || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return COVER_PLACEHOLDER_GRADIENTS[s % COVER_PLACEHOLDER_GRADIENTS.length]
}


function makeRoomSvgBanner(c1, c2, c3) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200"><defs><radialGradient id="a" cx="20%" cy="15%" r="70%"><stop offset="0%" stop-color="${c1}" stop-opacity="0.55"/><stop offset="100%" stop-color="#0B0B0B" stop-opacity="0"/></radialGradient><radialGradient id="b" cx="85%" cy="80%" r="70%"><stop offset="0%" stop-color="${c2}" stop-opacity="0.5"/><stop offset="100%" stop-color="#0B0B0B" stop-opacity="0"/></radialGradient><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c3}"/><stop offset="100%" stop-color="#07070C"/></linearGradient></defs><rect width="800" height="1200" fill="url(#bg)"/><rect width="800" height="1200" fill="url(#a)"/><rect width="800" height="1200" fill="url(#b)"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const ROOM_BACKGROUNDS = [
  {
    key: 'aurora',
    label: 'Aurora Stage',
    url: makeRoomSvgBanner('#00E0A8', '#FF3DAE', '#081318'),
    css: 'radial-gradient(circle at 20% 15%, rgba(0,224,168,0.42), transparent 55%), radial-gradient(circle at 80% 85%, rgba(255,61,174,0.38), transparent 55%), linear-gradient(160deg, #071318 0%, #14091E 55%, #08080C 100%)',
  },
  {
    key: 'sunset',
    label: 'Velvet Lounge',
    url: makeRoomSvgBanner('#FF3DAE', '#F59E0B', '#1A0916'),
    css: 'radial-gradient(circle at 75% 20%, rgba(255,61,174,0.45), transparent 55%), radial-gradient(circle at 25% 80%, rgba(251,146,60,0.35), transparent 55%), linear-gradient(160deg, #1A0916 0%, #1F1108 55%, #09080C 100%)',
  },
  {
    key: 'ocean',
    label: 'Midnight Neon',
    url: makeRoomSvgBanner('#38BDF8', '#6366F1', '#071224'),
    css: 'radial-gradient(circle at 25% 25%, rgba(56,189,248,0.42), transparent 55%), radial-gradient(circle at 80% 75%, rgba(99,102,241,0.42), transparent 55%), linear-gradient(160deg, #071224 0%, #0E0B26 55%, #07070C 100%)',
  },
  {
    key: 'violet',
    label: 'Cyber Pulse',
    url: makeRoomSvgBanner('#A855F7', '#EC4899', '#140824'),
    css: 'radial-gradient(circle at 30% 20%, rgba(168,85,247,0.45), transparent 55%), radial-gradient(circle at 75% 80%, rgba(236,72,153,0.38), transparent 55%), linear-gradient(160deg, #140824 0%, #1F091D 55%, #09070C 100%)',
  },
  {
    key: 'gold',
    label: 'Golden Hour',
    url: makeRoomSvgBanner('#FBBF24', '#F43F5E', '#1C1406'),
    css: 'radial-gradient(circle at 70% 20%, rgba(251,191,36,0.4), transparent 55%), radial-gradient(circle at 25% 80%, rgba(244,63,94,0.32), transparent 55%), linear-gradient(160deg, #1C1406 0%, #1C0B10 55%, #090808 100%)',
  },
]

export function roomBackgroundCss(key) {
  return (ROOM_BACKGROUNDS.find((b) => b.key === key) || ROOM_BACKGROUNDS[0]).css
}

export function roomBackgroundStyle(roomOrKey) {
  if (typeof roomOrKey === 'string') {
    const preset = ROOM_BACKGROUNDS.find((b) => b.key === roomOrKey) || ROOM_BACKGROUNDS[0]
    if (preset.url) {
      return {
        backgroundImage: `linear-gradient(180deg, rgba(8,8,12,0.45) 0%, rgba(8,8,12,0.75) 65%, rgba(8,8,12,0.92) 100%), url(${preset.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    return { background: preset.css }
  }
  const room = roomOrKey
  const custom = room?.backgroundUrl
  if (custom) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(8,8,12,0.55) 0%, rgba(8,8,12,0.78) 60%, rgba(8,8,12,0.92) 100%), url(${custom})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  const preset = ROOM_BACKGROUNDS.find((b) => b.key === room?.backgroundKey) || ROOM_BACKGROUNDS[0]
  if (preset.url) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(8,8,12,0.45) 0%, rgba(8,8,12,0.75) 65%, rgba(8,8,12,0.92) 100%), url(${preset.url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return { background: preset.css }
}

export function makeEmptySeats() {
  return Array.from({ length: 9 }, () => null)
}

export const PROFILE_THEMES = [
  { key: 'signature', label: 'Signature', grad: 'from-emerald-500/30 to-pink-500/30' },
  { key: 'ocean', label: 'Ocean', grad: 'from-cyan-500/30 to-blue-600/30' },
  { key: 'sunset', label: 'Sunset', grad: 'from-orange-500/30 to-pink-600/30' },
  { key: 'violet', label: 'Violet', grad: 'from-purple-500/30 to-indigo-600/30' },
]

export function profileThemeGrad(key) {
  return (PROFILE_THEMES.find((t) => t.key === key) || PROFILE_THEMES[0]).grad
}

const GRADIENTS = [
  'linear-gradient(135deg, #00E0A8 0%, #0EA5E9 100%)',
  'linear-gradient(135deg, #FF3DAE 0%, #8B5CF6 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)',
  'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
  'linear-gradient(135deg, #EC4899 0%, #6366F1 100%)',
  'linear-gradient(135deg, #06B6D4 0%, #A855F7 100%)',
]

export function coverGradient(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return GRADIENTS[h % GRADIENTS.length]
}

export function formatDuration(sec) {
  if (!sec || !isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export function timeAgo(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function parseLyrics(raw = '') {
  if (!raw) return { synced: false, lines: [] }
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const timed = []
  const re = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]\s*(.*)$/
  for (const line of lines) {
    const m = line.match(re)
    if (m) {
      const t = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) / 100 : 0)
      timed.push({ time: t, text: m[4] || '♪' })
    }
  }
  if (timed.length >= 2) return { synced: true, lines: timed }
  return { synced: false, lines: lines.map((text) => ({ time: 0, text })) }
}

export async function ensureCategory(name, kind) {
  const clean = (name || '').trim()
  if (!clean) return
  const id = `${kind}:${clean.toLowerCase()}`
  try {
    await db.upsertShared('categories', { name: clean, kind }, id, { visibleTo: 'public' })
  } catch (e) { /* ignore */ }
}

export function isPublicVisible(track) {
  if (!track) return false
  if (track.visibility && track.visibility !== 'public') return false
  if (track.scheduledAt && new Date(track.scheduledAt).getTime() > Date.now()) return false
  return true
}
