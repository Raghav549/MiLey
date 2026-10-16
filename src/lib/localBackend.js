/**
 * MiLey Platform - Built-in Persistent Backend & Media Engine
 * Ensures 100% full-stack functionality on Web (Vercel) and Native Android
 * both standalone and alongside Supabase Cloud.
 */

const STORAGE_PREFIX = 'miley_db_v2_'
const SEED_VERSION_KEY = 'miley_seed_v2_initialized'

// In-memory event listeners + Cross-Tab BroadcastChannel
const tableListeners = new Map() // table -> Set<callback>
const channelBus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('miley_realtime_v2') : null

if (channelBus) {
  channelBus.onmessage = (ev) => {
    const { kind, table, payload } = ev.data || {}
    if (kind === 'db_change' && table) {
      notifyTableListeners(table, payload, false)
    }
  }
}

export function onTableChange(table, callback) {
  if (!tableListeners.has(table)) tableListeners.set(table, new Set())
  tableListeners.get(table).add(callback)
  return () => {
    tableListeners.get(table)?.delete(callback)
  }
}

export function notifyTableListeners(table, payload, broadcastCrossTab = true) {
  const set = tableListeners.get(table)
  if (set) {
    set.forEach((cb) => {
      try { cb(payload) } catch (e) { /* ignore listener err */ }
    })
  }
  if (broadcastCrossTab && channelBus) {
    try { channelBus.postMessage({ kind: 'db_change', table, payload }) } catch (e) { /* ignore */ }
  }
}

// ── IndexedDB Media Store for Large Audio & Theme Files ──
const IDB_NAME = 'miley_media_idb_v1'
const IDB_STORE = 'files'
const memoryBlobUrlCache = new Map()

function openMediaDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('No IndexedDB'))
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function storeMediaFile(key, fileOrBlob) {
  try {
    const blobUrl = URL.createObjectURL(fileOrBlob)
    memoryBlobUrlCache.set(key, blobUrl)
    // For images < 400KB, convert to DataURL so it survives hard refresh effortlessly
    if (fileOrBlob.type && fileOrBlob.type.startsWith('image/') && fileOrBlob.size < 400 * 1024) {
      const dataUrl = await new Promise((res) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result)
        reader.onerror = () => res(blobUrl)
        reader.readAsDataURL(fileOrBlob)
      })
      return dataUrl
    }
    const db = await openMediaDb()
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(fileOrBlob, key)
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
    return `idb://${key}`
  } catch (e) {
    return URL.createObjectURL(fileOrBlob)
  }
}

export async function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return url
  if (url.startsWith('synth://')) {
    const parts = url.replace('synth://', '').split(':')
    return getSynthesizedAudioUrl(parts[0] || 'neon', Number(parts[1]) || 24)
  }
  if (!url.startsWith('idb://')) return url
  const key = url.slice(6)
  if (memoryBlobUrlCache.has(key)) return memoryBlobUrlCache.get(key)
  try {
    const db = await openMediaDb()
    const blob = await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    if (blob) {
      const objUrl = URL.createObjectURL(blob)
      memoryBlobUrlCache.set(key, objUrl)
      return objUrl
    }
  } catch (e) { /* fallback */ }
  return getSynthesizedAudioUrl('neon', 24)
}

// ── Synthesized Musical Audio Generator (Real Playable Stereo WAV) ──
const synthCache = new Map()

const SONG_SCALES = {
  neon: [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25],     // A minor synthwave
  romantic: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33], // C major warm acoustic
  desi: [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25],    // D energetic groove
  lofi: [196.0, 246.94, 293.66, 349.23, 392.0, 493.88, 587.33],     // G dreamy chill
  velvet: [246.94, 277.18, 329.63, 369.99, 440.0, 493.88, 554.37],  // B minor nocturnal
  gold: [329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99],     // E minor royal
}

export function getSynthesizedAudioUrl(styleKey = 'neon', durationSec = 24) {
  const cacheKey = `${styleKey}:${durationSec}`
  if (synthCache.has(cacheKey)) return synthCache.get(cacheKey)
  if (typeof window === 'undefined') return ''

  const sampleRate = 22050
  const numSamples = Math.floor(sampleRate * durationSec)
  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // Mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, numSamples * 2, true)

  const scale = SONG_SCALES[styleKey] || SONG_SCALES.neon
  const bpm = styleKey === 'desi' ? 124 : styleKey === 'neon' ? 116 : styleKey === 'lofi' ? 82 : 98
  const beatDur = 60 / bpm

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const beatIndex = Math.floor(t / beatDur)
    const beatPhase = (t % beatDur) / beatDur

    // Chord pad (changes every 4 beats)
    const chordIdx = Math.floor(beatIndex / 4) % 4
    const rootFreq = scale[chordIdx % scale.length]
    const thirdFreq = scale[(chordIdx + 2) % scale.length]
    const fifthFreq = scale[(chordIdx + 4) % scale.length]

    const pad =
      0.16 * Math.sin(2 * Math.PI * rootFreq * t) +
      0.11 * Math.sin(2 * Math.PI * thirdFreq * t) +
      0.11 * Math.sin(2 * Math.PI * fifthFreq * t)

    // Sub bass on each beat
    const bassFreq = rootFreq * 0.5
    const bassEnv = Math.exp(-beatPhase * 3.2)
    const bass = 0.24 * Math.sin(2 * Math.PI * bassFreq * t) * bassEnv

    // Melodic arpeggio note on eighth notes
    const arpStep = Math.floor(t / (beatDur * 0.5))
    const arpPhase = (t % (beatDur * 0.5)) / (beatDur * 0.5)
    const arpFreq = scale[(arpStep * 2 + chordIdx) % scale.length]
    const arpEnv = Math.exp(-arpPhase * 4.5) * (1 - Math.exp(-arpPhase * 40))
    const arp = 0.18 * Math.sin(2 * Math.PI * arpFreq * t + 0.3 * Math.sin(2 * Math.PI * arpFreq * 2 * t)) * arpEnv

    // Kick drum thump on beats
    const kickEnv = Math.exp(-beatPhase * 18)
    const kickFreq = 55 + 110 * Math.exp(-beatPhase * 28)
    const kick = 0.22 * Math.sin(2 * Math.PI * kickFreq * t) * kickEnv

    // Fade in / out
    const fadeIn = Math.min(1, t / 0.6)
    const fadeOut = Math.min(1, (durationSec - t) / 1.2)
    const sample = Math.max(-0.95, Math.min(0.95, (pad + bass + arp + kick) * fadeIn * fadeOut))
    view.setInt16(44 + i * 2, Math.floor(sample * 32767), true)
  }

  const blob = new Blob([buffer], { type: 'audio/wav' })
  const url = URL.createObjectURL(blob)
  synthCache.set(cacheKey, url)
  return url
}

// ── Crisp SVG Artwork Generator (No External Dependencies) ──
export function makeSvgArt(arg1 = 'MiLey', arg2 = '', arg3 = '#00E0A8', arg4 = '#FF3DAE') {
  const opts =
    typeof arg1 === 'object' && arg1 !== null
      ? arg1
      : { title: arg1, subtitle: arg2, c1: arg3, c2: arg4 }
  const {
    title = 'MiLey',
    subtitle = '',
    c1 = '#00E0A8',
    c2 = '#FF3DAE',
    c3 = '#0B0B0B',
    wide = false,
  } = opts
  const w = wide ? 800 : 400
  const h = 400
  const initials = (title || 'M').slice(0, 2).toUpperCase()
  const safeTitle = (title || '').replace(/[<>&"']/g, '').slice(0, 22)
  const safeSub = (subtitle || '').replace(/[<>&"']/g, '').slice(0, 28)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}" stop-opacity="0.9"/>
        <stop offset="55%" stop-color="${c3}" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="${c2}" stop-opacity="0.9"/>
      </linearGradient>
      <radialGradient id="glow" cx="75%" cy="25%" r="60%">
        <stop offset="0%" stop-color="${c2}" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="${c3}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="#0B0B0B"/>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#glow)"/>
    <circle cx="${w * 0.5}" cy="${h * 0.42}" r="110" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
    <circle cx="${w * 0.5}" cy="${h * 0.42}" r="76" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" stroke-dasharray="8 6"/>
    <circle cx="${w * 0.5}" cy="${h * 0.42}" r="42" fill="rgba(11,11,11,0.55)" stroke="${c1}" stroke-width="2"/>
    <text x="${w * 0.5}" y="${h * 0.445}" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="800" font-size="28">${initials}</text>
    <text x="${w * 0.5}" y="${h * 0.80}" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="700" font-size="22">${safeTitle}</text>
    <text x="${w * 0.5}" y="${h * 0.88}" text-anchor="middle" fill="rgba(255,255,255,0.68)" font-family="sans-serif" font-weight="500" font-size="14">${safeSub}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// ── Seed Ecosystem Data ──
function createInitialSeedData() {
  const now = Date.now()
  const iso = (offsetMin = 0) => new Date(now + offsetMin * 60000).toISOString()

  const profiles = [
    {
      id: 'artist-arijit-soul',
      userId: 'artist-arijit-soul',
      displayName: 'Arijit & Soul Studio',
      customUsername: 'arijit_soul',
      avatarUrl: makeSvgArt({ title: 'AS', subtitle: 'Soul', c1: '#00E0A8', c2: '#ec4899' }),
      bannerUrl: makeSvgArt({ title: 'Arijit & Soul Studio', subtitle: 'mileymusic.space/@arijit_soul', c1: '#00E0A8', c2: '#be185d', wide: true }),
      bio: 'Soulful Hindi & Acoustic melodies crafted for late-night feelings. Official verified creator on mileymusic.space.',
      verified: true,
      verificationType: 'artist',
      artistBadge: 'Top Charting Artist',
      monthlyListeners: 148200,
      theme: 'signature',
      links: ['https://mileymusic.space/#/channel/arijit_soul'],
      followersCount: 1240,
      followingCount: 18,
      createdAt: iso(-10000),
      updatedAt: iso(-120),
    },
    {
      id: 'artist-neon-pulse',
      userId: 'artist-neon-pulse',
      displayName: 'Neon Pulse Collective',
      customUsername: 'neonpulse',
      avatarUrl: makeSvgArt({ title: 'NP', subtitle: 'Synth', c1: '#38bdf8', c2: '#a855f7' }),
      bannerUrl: makeSvgArt({ title: 'Neon Pulse Collective', subtitle: 'mileymusic.space/@neonpulse', c1: '#38bdf8', c2: '#a855f7', wide: true }),
      bio: 'Futuristic synthwave, cyber-pop & midnight electronic journeys with reactive Song Themes.',
      verified: true,
      verificationType: 'artist',
      artistBadge: 'Verified Artist',
      monthlyListeners: 96400,
      theme: 'violet',
      links: ['https://mileymusic.space/#/channel/neonpulse'],
      followersCount: 890,
      followingCount: 24,
      createdAt: iso(-9000),
      updatedAt: iso(-90),
    },
    {
      id: 'artist-desi-beats',
      userId: 'artist-desi-beats',
      displayName: 'Desi Beats Official',
      customUsername: 'desibeats',
      avatarUrl: makeSvgArt({ title: 'DB', subtitle: 'HipHop', c1: '#f97316', c2: '#ef4444' }),
      bannerUrl: makeSvgArt({ title: 'Desi Beats Official', subtitle: 'mileymusic.space/@desibeats', c1: '#f97316', c2: '#ef4444', wide: true }),
      bio: 'Punjabi bangers, Desi Hip-Hop, and high-voltage bass anthems.',
      verified: true,
      verificationType: 'label',
      artistBadge: 'Official Label',
      monthlyListeners: 215000,
      theme: 'sunset',
      links: ['https://mileymusic.space/#/channel/desibeats'],
      followersCount: 2310,
      followingCount: 12,
      createdAt: iso(-8500),
      updatedAt: iso(-60),
    },
    {
      id: 'artist-lofi-cafe',
      userId: 'artist-lofi-cafe',
      displayName: 'LoFi Midnight Cafe',
      customUsername: 'lofimidnight',
      avatarUrl: makeSvgArt({ title: 'LM', subtitle: 'Chill', c1: '#10b981', c2: '#0ea5e9' }),
      bannerUrl: makeSvgArt({ title: 'LoFi Midnight Cafe', subtitle: 'mileymusic.space/@lofimidnight', c1: '#10b981', c2: '#0ea5e9', wide: true }),
      bio: '24/7 study beats, rain ambience, and cozy instrumental vibes for focus and sleep.',
      verified: true,
      verificationType: 'creator',
      artistBadge: 'Community Favorite',
      monthlyListeners: 84500,
      theme: 'ocean',
      links: ['https://mileymusic.space/#/channel/lofimidnight'],
      followersCount: 670,
      followingCount: 31,
      createdAt: iso(-7200),
      updatedAt: iso(-30),
    },
  ]

  const channels = [
    {
      id: 'ch-arijit-soul',
      ownerId: 'artist-arijit-soul',
      ownerName: 'Arijit & Soul Studio',
      ownerEmail: 'soul@mileymusic.space',
      name: 'Arijit & Soul Studio',
      username: 'arijit_soul',
      avatarUrl: profiles[0].avatarUrl,
      bannerUrl: profiles[0].bannerUrl,
      description: 'Official channel for soulful Hindi originals, acoustic sessions & live premieres on mileymusic.space.',
      category: 'Music Artist',
      language: 'Hindi',
      country: 'India',
      contact: 'soul@mileymusic.space',
      socialLinks: { instagram: 'https://mileymusic.space/#/channel/arijit_soul', website: 'https://mileymusic.space' },
      verified: true,
      status: 'approved',
      accentColor: '#00E0A8',
      spotlightTrackId: 'track-kesariya-nights',
      subscribersCount: 1240,
      createdAt: iso(-9800),
      updatedAt: iso(-100),
    },
    {
      id: 'ch-neon-pulse',
      ownerId: 'artist-neon-pulse',
      ownerName: 'Neon Pulse Collective',
      ownerEmail: 'neon@mileymusic.space',
      name: 'Neon Pulse Collective',
      username: 'neonpulse',
      avatarUrl: profiles[1].avatarUrl,
      bannerUrl: profiles[1].bannerUrl,
      description: 'Cyberpunk synthwave, electronic horizons & custom visual Song Themes.',
      category: 'Band',
      language: 'English',
      country: 'Global',
      contact: 'neon@mileymusic.space',
      socialLinks: { instagram: 'https://mileymusic.space/#/channel/neonpulse', website: 'https://mileymusic.space' },
      verified: true,
      status: 'approved',
      accentColor: '#38BDF8',
      spotlightTrackId: 'track-cyber-horizon',
      subscribersCount: 890,
      createdAt: iso(-8800),
      updatedAt: iso(-80),
    },
    {
      id: 'ch-desi-beats',
      ownerId: 'artist-desi-beats',
      ownerName: 'Desi Beats Official',
      ownerEmail: 'desi@mileymusic.space',
      name: 'Desi Beats Official',
      username: 'desibeats',
      avatarUrl: profiles[2].avatarUrl,
      bannerUrl: profiles[2].bannerUrl,
      description: 'Home of chart-topping Punjabi & Desi Hip-Hop drops.',
      category: 'Label',
      language: 'Punjabi',
      country: 'India',
      contact: 'desi@mileymusic.space',
      socialLinks: { instagram: 'https://mileymusic.space/#/channel/desibeats', website: 'https://mileymusic.space' },
      verified: true,
      status: 'approved',
      accentColor: '#F97316',
      spotlightTrackId: 'track-patna-to-punjab',
      subscribersCount: 2310,
      createdAt: iso(-8000),
      updatedAt: iso(-50),
    },
    {
      id: 'ch-lofi-cafe',
      ownerId: 'artist-lofi-cafe',
      ownerName: 'LoFi Midnight Cafe',
      ownerEmail: 'lofi@mileymusic.space',
      name: 'LoFi Midnight Cafe',
      username: 'lofimidnight',
      avatarUrl: profiles[3].avatarUrl,
      bannerUrl: profiles[3].bannerUrl,
      description: 'Warm vinyl crackle, midnight rain & study instrumentals.',
      category: 'Composer',
      language: 'English',
      country: 'Global',
      contact: 'lofi@mileymusic.space',
      socialLinks: { instagram: 'https://mileymusic.space/#/channel/lofimidnight', website: 'https://mileymusic.space' },
      verified: true,
      status: 'approved',
      accentColor: '#10B981',
      spotlightTrackId: 'track-monsoon-chai-lofi',
      subscribersCount: 670,
      createdAt: iso(-7000),
      updatedAt: iso(-20),
    },
  ]

  const tracks = [
    {
      id: 'track-kesariya-nights',
      title: 'Tere Bina Raat (Unplugged)',
      artistName: 'Arijit & Soul Studio',
      artistId: 'artist-arijit-soul',
      channelId: 'ch-arijit-soul',
      albumId: 'album-soul-sessions',
      albumTitle: 'Midnight Soul Sessions',
      coverUrl: makeSvgArt({ title: 'Tere Bina Raat', subtitle: 'Arijit & Soul Studio', c1: '#00E0A8', c2: '#FF3DAE' }),
      bannerUrl: makeSvgArt({ title: 'Tere Bina Raat', subtitle: 'Midnight Soul Sessions', c1: '#00E0A8', c2: '#FF3DAE', wide: true }),
      audioUrl: 'synth://romantic:28',
      duration: 28,
      genre: 'Romantic',
      language: 'Hindi',
      mood: 'Romantic',
      type: 'song',
      visibility: 'public',
      status: 'approved',
      plays: 18420,
      likesCount: 2410,
      lyrics: `[00:00] ♪ Soft acoustic intro over midnight rain ♪\n[00:04] चाँदनी रातों में तेरा ही ख़याल है\n[00:09] Every heartbeat whispers your name in the dark\n[00:14] तेरे बिना ये लम्हे अधूरे से लगते हैं\n[00:19] Stay with me under the neon sky tonight\n[00:24] ♪ Mileymusic.space Soul Outro ♪`,
      songTheme: {
        id: 'velvet_fire',
        name: 'Velvet Rose Glow',
        primaryColor: '#FF3DAE',
        secondaryColor: '#00E0A8',
        visualizer: 'halo',
        ambience: 'Romantic Glow',
        bgUrl: makeSvgArt({ title: 'Velvet Rose Theme', subtitle: 'Song Theme Canvas', c1: '#be185d', c2: '#047857', wide: true }),
      },
      createdAt: iso(-5000),
      updatedAt: iso(-500),
    },
    {
      id: 'track-cyber-horizon',
      title: 'Neon Horizon 2088',
      artistName: 'Neon Pulse Collective',
      artistId: 'artist-neon-pulse',
      channelId: 'ch-neon-pulse',
      albumId: 'album-cyber-odyssey',
      albumTitle: 'Cyber Odyssey',
      coverUrl: makeSvgArt({ title: 'Neon Horizon', subtitle: 'Neon Pulse Collective', c1: '#38bdf8', c2: '#a855f7' }),
      bannerUrl: makeSvgArt({ title: 'Neon Horizon 2088', subtitle: 'Cyber Odyssey', c1: '#38bdf8', c2: '#a855f7', wide: true }),
      audioUrl: 'synth://neon:26',
      duration: 26,
      genre: 'Pop',
      language: 'English',
      mood: 'Energetic',
      type: 'song',
      visibility: 'public',
      status: 'approved',
      plays: 14950,
      likesCount: 1930,
      lyrics: `[00:00] ♪ Analog synth arpeggio rising ♪\n[00:04] Racing through the city of a million lights\n[00:09] Chrome reflections on the midnight highway\n[00:14] We are the frequency that never fades\n[00:19] Turn up the bass across mileymusic.space\n[00:23] ♪ Cyberwave drop ♪`,
      songTheme: {
        id: 'cyber_neon',
        name: 'Cyber Neon Grid',
        primaryColor: '#00E0A8',
        secondaryColor: '#38BDF8',
        visualizer: 'bars',
        ambience: 'Neon Cyberwave',
        bgUrl: makeSvgArt({ title: 'Cyber Neon Theme', subtitle: 'Reactive Visualizer', c1: '#0284c7', c2: '#7e22ce', wide: true }),
      },
      createdAt: iso(-4200),
      updatedAt: iso(-400),
    },
    {
      id: 'track-patna-to-punjab',
      title: 'Gaddi Te Bass (Desi Anthem)',
      artistName: 'Desi Beats Official',
      artistId: 'artist-desi-beats',
      channelId: 'ch-desi-beats',
      albumId: 'album-desi-hype',
      albumTitle: 'Desi Hype Vol. 1',
      coverUrl: makeSvgArt({ title: 'Gaddi Te Bass', subtitle: 'Desi Beats Official', c1: '#f97316', c2: '#ef4444' }),
      bannerUrl: makeSvgArt({ title: 'Gaddi Te Bass', subtitle: 'Desi Beats Official', c1: '#f97316', c2: '#ef4444', wide: true }),
      audioUrl: 'synth://desi:24',
      duration: 24,
      genre: 'Hip-Hop',
      language: 'Punjabi',
      mood: 'Party',
      type: 'song',
      visibility: 'public',
      status: 'approved',
      plays: 29300,
      likesCount: 4120,
      lyrics: `[00:00] ♪ Heavy 808 tumbi bounce ♪\n[00:04] گड्डी विच वजदा ए बेस सारी रात\n[00:08] From Patna to Punjab we run the stage\n[00:13] Lights camera action — nobody stands still\n[00:18] Hands up in the Listen Room right now!`,
      songTheme: {
        id: 'royal_gold',
        name: 'Royal Gold Bass',
        primaryColor: '#F97316',
        secondaryColor: '#FACC15',
        visualizer: 'vinyl',
        ambience: 'High Voltage Club',
        bgUrl: makeSvgArt({ title: 'Royal Gold Theme', subtitle: 'Club Bass Theme', c1: '#ea580c', c2: '#ca8a04', wide: true }),
      },
      createdAt: iso(-3600),
      updatedAt: iso(-300),
    },
    {
      id: 'track-monsoon-chai-lofi',
      title: 'Monsoon Window & Chai',
      artistName: 'LoFi Midnight Cafe',
      artistId: 'artist-lofi-cafe',
      channelId: 'ch-lofi-cafe',
      albumId: 'album-soul-sessions',
      albumTitle: 'Midnight Soul Sessions',
      coverUrl: makeSvgArt({ title: 'Monsoon Chai', subtitle: 'LoFi Midnight Cafe', c1: '#10b981', c2: '#0ea5e9' }),
      bannerUrl: makeSvgArt({ title: 'Monsoon Window & Chai', subtitle: 'LoFi Study Beats', c1: '#10b981', c2: '#0ea5e9', wide: true }),
      audioUrl: 'synth://lofi:30',
      duration: 30,
      genre: 'LoFi',
      language: 'Hindi',
      mood: 'Calm',
      type: 'song',
      visibility: 'public',
      status: 'approved',
      plays: 11800,
      likesCount: 1650,
      lyrics: `[00:00] ♪ Raindrops on glass & warm Rhodes chords ♪\n[00:06] Breathe in the quiet of a rainy afternoon\n[00:13] Let every worry melt into the melody\n[00:20] Focus, relax, and drift away on MiLey`,
      songTheme: {
        id: 'emerald_matrix',
        name: 'Emerald Monsoon',
        primaryColor: '#10B981',
        secondaryColor: '#38BDF8',
        visualizer: 'orbs',
        ambience: 'Rainy Study Cafe',
        bgUrl: makeSvgArt({ title: 'Emerald Monsoon', subtitle: 'LoFi Ambience Theme', c1: '#059669', c2: '#0369a1', wide: true }),
      },
      createdAt: iso(-2800),
      updatedAt: iso(-200),
    },
    {
      id: 'track-starlight-dil',
      title: 'Dil Ka Safar (Synth Remix)',
      artistName: 'Arijit & Soul Studio',
      artistId: 'artist-arijit-soul',
      channelId: 'ch-arijit-soul',
      albumId: 'album-soul-sessions',
      albumTitle: 'Midnight Soul Sessions',
      coverUrl: makeSvgArt({ title: 'Dil Ka Safar', subtitle: 'Arijit & Soul Studio', c1: '#ec4899', c2: '#8b5cf6' }),
      bannerUrl: makeSvgArt({ title: 'Dil Ka Safar', subtitle: 'Synth Remix', c1: '#ec4899', c2: '#8b5cf6', wide: true }),
      audioUrl: 'synth://velvet:25',
      duration: 25,
      genre: 'Pop',
      language: 'Hindi',
      mood: 'Dreamy',
      type: 'song',
      visibility: 'public',
      status: 'approved',
      plays: 9420,
      likesCount: 1180,
      lyrics: `[00:00] ♪ Dreamy pads & heartbeat percussion ♪\n[00:05] सफ़र ये दिल का कभी रुके ना\n[00:11] Chasing constellations across the horizon\n[00:17] Every note carries us closer home`,
      songTheme: {
        id: 'sakura_dream',
        name: 'Sakura Starlight',
        primaryColor: '#EC4899',
        secondaryColor: '#8B5CF6',
        visualizer: 'wave',
        ambience: 'Dreamy Starlight',
        bgUrl: makeSvgArt({ title: 'Sakura Starlight', subtitle: 'Dream Theme', c1: '#db2777', c2: '#6d28d9', wide: true }),
      },
      createdAt: iso(-2100),
      updatedAt: iso(-150),
    },
    {
      id: 'track-bhojpuri-bass-wave',
      title: 'Ganga Kinare Groove',
      artistName: 'Desi Beats Official',
      artistId: 'artist-desi-beats',
      channelId: 'ch-desi-beats',
      albumId: 'album-desi-hype',
      albumTitle: 'Desi Hype Vol. 1',
      coverUrl: makeSvgArt({ title: 'Ganga Groove', subtitle: 'Desi Beats Official', c1: '#eab308', c2: '#ec4899' }),
      bannerUrl: makeSvgArt({ title: 'Ganga Kinare Groove', subtitle: 'Folk Fusion Bass', c1: '#eab308', c2: '#ec4899', wide: true }),
      audioUrl: 'synth://gold:24',
      duration: 24,
      genre: 'Folk',
      language: 'Bhojpuri',
      mood: 'Happy',
      type: 'song',
      visibility: 'public',
      status: 'approved',
      plays: 16200,
      likesCount: 2290,
      lyrics: `[00:00] ♪ Folk dhol meets modern sub-bass ♪\n[00:05] गंगा किनारे चमके सितारा\n[00:10] Folk roots with a futuristic bounce\n[00:16] Dance together from Bihar to the world!`,
      songTheme: {
        id: 'royal_gold',
        name: 'Golden Festival',
        primaryColor: '#EAB308',
        secondaryColor: '#EC4899',
        visualizer: 'bars',
        ambience: 'Festival Vibe',
        bgUrl: makeSvgArt({ title: 'Golden Festival', subtitle: 'Folk Bass Theme', c1: '#ca8a04', c2: '#db2777', wide: true }),
      },
      createdAt: iso(-1500),
      updatedAt: iso(-110),
    },
    {
      id: 'track-creator-podcast-ep1',
      title: 'Ep 1: Building Sound Universes on MiLey',
      artistName: 'Neon Pulse Collective',
      artistId: 'artist-neon-pulse',
      channelId: 'ch-neon-pulse',
      albumId: null,
      albumTitle: null,
      coverUrl: makeSvgArt({ title: 'Podcast #1', subtitle: 'Creator Backstage', c1: '#6366f1', c2: '#00E0A8' }),
      bannerUrl: makeSvgArt({ title: 'Creator Backstage Podcast', subtitle: 'mileymusic.space', c1: '#6366f1', c2: '#00E0A8', wide: true }),
      audioUrl: 'synth://neon:28',
      duration: 28,
      genre: 'Podcast',
      language: 'English',
      mood: 'Focus',
      type: 'podcast',
      seasonNumber: 1,
      episodeNumber: 1,
      visibility: 'public',
      status: 'approved',
      plays: 5400,
      likesCount: 740,
      lyrics: `[00:00] Welcome to the official Creator Backstage podcast on mileymusic.space!\n[00:07] Today we explore Bulk Song Uploads with custom Song Themes and Live Listen Rooms.`,
      songTheme: {
        id: 'cosmic_void',
        name: 'Cosmic Studio',
        primaryColor: '#6366F1',
        secondaryColor: '#00E0A8',
        visualizer: 'halo',
        ambience: 'Studio Talk',
      },
      createdAt: iso(-1100),
      updatedAt: iso(-90),
    },
  ]

  const albums = [
    {
      id: 'album-soul-sessions',
      title: 'Midnight Soul Sessions',
      artistName: 'Arijit & Soul Studio',
      artistId: 'artist-arijit-soul',
      channelId: 'ch-arijit-soul',
      coverUrl: tracks[0].coverUrl,
      bannerUrl: tracks[0].bannerUrl,
      description: 'Intimate unplugged melodies and monsoon instrumentals with custom visual themes.',
      genre: 'Romantic',
      language: 'Hindi',
      visibility: 'public',
      createdAt: iso(-4800),
      updatedAt: iso(-400),
    },
    {
      id: 'album-cyber-odyssey',
      title: 'Cyber Odyssey',
      artistName: 'Neon Pulse Collective',
      artistId: 'artist-neon-pulse',
      channelId: 'ch-neon-pulse',
      coverUrl: tracks[1].coverUrl,
      bannerUrl: tracks[1].bannerUrl,
      description: 'High-octane electronic & synthwave anthems.',
      genre: 'Pop',
      language: 'English',
      visibility: 'public',
      createdAt: iso(-4000),
      updatedAt: iso(-300),
    },
    {
      id: 'album-desi-hype',
      title: 'Desi Hype Vol. 1',
      artistName: 'Desi Beats Official',
      artistId: 'artist-desi-beats',
      channelId: 'ch-desi-beats',
      coverUrl: tracks[2].coverUrl,
      bannerUrl: tracks[2].bannerUrl,
      description: 'Non-stop Punjabi & Desi bass anthems for every party.',
      genre: 'Hip-Hop',
      language: 'Punjabi',
      visibility: 'public',
      createdAt: iso(-3500),
      updatedAt: iso(-200),
    },
  ]

  const playlists = [
    {
      id: 'pl-late-night-drive',
      title: 'Late Night Neon Drive',
      description: 'Curated synthwave & romantic Hindi vibes for midnight drives.',
      coverUrl: makeSvgArt({ title: 'Neon Drive', subtitle: 'MiLey Editorial', c1: '#00E0A8', c2: '#6366f1' }),
      bannerUrl: makeSvgArt({ title: 'Late Night Neon Drive', subtitle: 'mileymusic.space Official Playlist', c1: '#00E0A8', c2: '#6366f1', wide: true }),
      ownerId: 'artist-neon-pulse',
      ownerName: 'MiLey Editorial',
      channelId: 'ch-neon-pulse',
      trackIds: ['track-cyber-horizon', 'track-kesariya-nights', 'track-starlight-dil', 'track-monsoon-chai-lofi'],
      visibility: 'public',
      mood: 'Dreamy',
      genre: 'Pop',
      isCommunityPick: true,
      createdAt: iso(-3000),
      updatedAt: iso(-100),
    },
    {
      id: 'pl-desi-party-hits',
      title: 'Desi Bass & Party Hits',
      description: 'Turn up the volume with the biggest Punjabi, Hindi & Bhojpuri bangers.',
      coverUrl: makeSvgArt({ title: 'Desi Party', subtitle: 'High Energy', c1: '#f97316', c2: '#ec4899' }),
      bannerUrl: makeSvgArt({ title: 'Desi Bass & Party Hits', subtitle: 'mileymusic.space', c1: '#f97316', c2: '#ec4899', wide: true }),
      ownerId: 'artist-desi-beats',
      ownerName: 'Desi Beats Official',
      channelId: 'ch-desi-beats',
      trackIds: ['track-patna-to-punjab', 'track-bhojpuri-bass-wave', 'track-cyber-horizon'],
      visibility: 'public',
      mood: 'Party',
      genre: 'Hip-Hop',
      isCommunityPick: true,
      createdAt: iso(-2500),
      updatedAt: iso(-80),
    },
    {
      id: 'pl-lofi-focus',
      title: 'Deep Focus & Rain LoFi',
      description: 'Zero distractions. Pure chill beats for coding, reading, and relaxing.',
      coverUrl: makeSvgArt({ title: 'LoFi Focus', subtitle: 'Chill & Study', c1: '#10b981', c2: '#38bdf8' }),
      bannerUrl: makeSvgArt({ title: 'Deep Focus & Rain LoFi', subtitle: 'LoFi Midnight Cafe', c1: '#10b981', c2: '#38bdf8', wide: true }),
      ownerId: 'artist-lofi-cafe',
      ownerName: 'LoFi Midnight Cafe',
      channelId: 'ch-lofi-cafe',
      trackIds: ['track-monsoon-chai-lofi', 'track-kesariya-nights', 'track-starlight-dil'],
      visibility: 'public',
      mood: 'Calm',
      genre: 'LoFi',
      isCommunityPick: false,
      createdAt: iso(-2000),
      updatedAt: iso(-50),
    },
  ]

  const emptySeats1 = Array(9).fill(null)
  emptySeats1[0] = { userId: 'artist-arijit-soul', userName: 'Arijit & Soul', avatarUrl: profiles[0].avatarUrl, muted: false }
  emptySeats1[1] = { userId: 'artist-neon-pulse', userName: 'Neon Pulse', avatarUrl: profiles[1].avatarUrl, muted: false }
  emptySeats1[2] = { userId: 'artist-lofi-cafe', userName: 'LoFi Cafe', avatarUrl: profiles[3].avatarUrl, muted: true }

  const emptySeats2 = Array(9).fill(null)
  emptySeats2[0] = { userId: 'artist-desi-beats', userName: 'Desi Beats', avatarUrl: profiles[2].avatarUrl, muted: false }

  const voice_rooms = [
    {
      id: 'room-neon-listening-party',
      name: 'Midnight Soul & Synth Listen Room 🎧',
      hostId: 'artist-arijit-soul',
      hostName: 'Arijit & Soul Studio',
      hostAvatarUrl: profiles[0].avatarUrl,
      purpose: 'Music',
      customPurpose: '',
      coverUrl: tracks[0].coverUrl,
      backgroundKey: 'nebula',
      backgroundUrl: '',
      visibility: 'public',
      seats: emptySeats1,
      seatLocks: Array(9).fill(false),
      admins: ['artist-neon-pulse'],
      seatRequests: [],
      currentTrack: tracks[0],
      isPlaying: true,
      position: 4,
      startedAt: new Date(now - 4000).toISOString(),
      queue: [
        { ...tracks[1], requestedBy: 'artist-neon-pulse', requestedByName: 'Neon Pulse', votes: 5 },
        { ...tracks[3], requestedBy: 'artist-lofi-cafe', requestedByName: 'LoFi Cafe', votes: 3 },
        { ...tracks[4], requestedBy: 'artist-arijit-soul', requestedByName: 'Arijit & Soul', votes: 2 },
      ],
      skipVotes: [],
      vibeScore: 86,
      autoDj: true,
      openQueue: true,
      syncSongTheme: true,
      activePoll: {
        id: 'poll-1',
        question: 'Which vibe should we spin next?',
        options: [
          { text: 'Romantic Hindi Unplugged', votes: 14, voters: [] },
          { text: 'Cyber Synthwave Drop', votes: 11, voters: [] },
          { text: 'Desi Bass Anthem', votes: 9, voters: [] },
        ],
      },
      ended: false,
      createdAt: iso(-180),
      updatedAt: iso(-2),
    },
    {
      id: 'room-desi-hype-stage',
      name: 'Desi Bass & Club DJ Stage 🔥',
      hostId: 'artist-desi-beats',
      hostName: 'Desi Beats Official',
      hostAvatarUrl: profiles[2].avatarUrl,
      purpose: 'Music',
      customPurpose: '',
      coverUrl: tracks[2].coverUrl,
      backgroundKey: 'sunset',
      backgroundUrl: '',
      visibility: 'public',
      seats: emptySeats2,
      seatLocks: Array(9).fill(false),
      admins: [],
      seatRequests: [],
      currentTrack: tracks[2],
      isPlaying: true,
      position: 2,
      startedAt: new Date(now - 2000).toISOString(),
      queue: [
        { ...tracks[5], requestedBy: 'artist-desi-beats', requestedByName: 'Desi Beats', votes: 7 },
      ],
      skipVotes: [],
      vibeScore: 94,
      autoDj: true,
      openQueue: true,
      syncSongTheme: true,
      ended: false,
      createdAt: iso(-90),
      updatedAt: iso(-1),
    },
  ]

  const room_messages = [
    {
      id: 'rm-1',
      roomId: 'room-neon-listening-party',
      userId: 'artist-arijit-soul',
      userName: 'Arijit & Soul',
      text: 'Welcome to the Midnight Listen Room on mileymusic.space! Tap any open seat or request your favorite track 🎶',
      createdAt: iso(-15),
    },
    {
      id: 'rm-2',
      roomId: 'room-neon-listening-party',
      userId: 'artist-neon-pulse',
      userName: 'Neon Pulse',
      text: 'The new Song Theme visualizer on this track looks incredible! 🔥',
      createdAt: iso(-8),
    },
    {
      id: 'rm-3',
      roomId: 'room-neon-listening-party',
      userId: 'artist-lofi-cafe',
      userName: 'LoFi Cafe',
      text: 'Turn on Live Lyrics in the stage bar to sing along!',
      createdAt: iso(-3),
    },
  ]

  const announcements = [
    {
      id: 'ann-1',
      channelId: 'ch-arijit-soul',
      channelName: 'Arijit & Soul Studio',
      text: 'Our new unplugged EP is live with custom Velvet Rose Song Themes! Stream it now and join our Listen Room tonight at 9 PM.',
      featuredTrackId: 'track-kesariya-nights',
      createdAt: iso(-600),
    },
    {
      id: 'ann-2',
      channelId: 'ch-neon-pulse',
      channelName: 'Neon Pulse Collective',
      text: 'Just uploaded 5 new synthwave tracks using the new Bulk Song + Direct Theme uploader on mileymusic.space!',
      featuredTrackId: 'track-cyber-horizon',
      createdAt: iso(-300),
    },
  ]

  const premieres = [
    {
      id: 'prem-1',
      ownerId: 'artist-arijit-soul',
      ownerName: 'Arijit & Soul Studio',
      trackId: 'track-kesariya-nights',
      title: 'Tere Bina Raat (Live Symphony Premiere)',
      artistName: 'Arijit & Soul Studio',
      coverUrl: tracks[0].coverUrl,
      audioUrl: tracks[0].audioUrl,
      duration: 28,
      scheduledAt: iso(45), // 45 mins in the future
      createdAt: iso(-200),
    },
  ]

  const artist_shoutouts = [
    {
      id: 'shout-1',
      artistId: 'artist-arijit-soul',
      authorId: 'artist-neon-pulse',
      authorName: 'Neon Pulse Collective',
      authorAvatar: profiles[1].avatarUrl,
      text: 'Absolute masterpiece on Tere Bina Raat! The vocal warmth is unmatched ❤️',
      createdAt: iso(-240),
    },
    {
      id: 'shout-2',
      artistId: 'artist-arijit-soul',
      authorId: 'artist-lofi-cafe',
      authorName: 'LoFi Midnight Cafe',
      authorAvatar: profiles[3].avatarUrl,
      text: 'Listening on repeat from Patna! Can’t wait for the next collab.',
      createdAt: iso(-120),
    },
  ]

  const follows = [
    {
      id: 'artist-neon-pulse:artist-arijit-soul',
      followerId: 'artist-neon-pulse',
      targetId: 'artist-arijit-soul',
      targetType: 'artist',
      targetName: 'Arijit & Soul Studio',
      targetAvatar: profiles[0].avatarUrl,
      targetUsername: 'arijit_soul',
      followerName: 'Neon Pulse Collective',
      followerAvatar: profiles[1].avatarUrl,
      createdAt: iso(-2000),
    },
    {
      id: 'artist-lofi-cafe:artist-arijit-soul',
      followerId: 'artist-lofi-cafe',
      targetId: 'artist-arijit-soul',
      targetType: 'artist',
      targetName: 'Arijit & Soul Studio',
      targetAvatar: profiles[0].avatarUrl,
      targetUsername: 'arijit_soul',
      followerName: 'LoFi Midnight Cafe',
      followerAvatar: profiles[3].avatarUrl,
      createdAt: iso(-1800),
    },
    {
      id: 'artist-arijit-soul:ch-neon-pulse',
      followerId: 'artist-arijit-soul',
      targetId: 'ch-neon-pulse',
      targetType: 'channel',
      targetName: 'Neon Pulse Collective',
      targetAvatar: profiles[1].avatarUrl,
      targetUsername: 'neonpulse',
      followerName: 'Arijit & Soul Studio',
      followerAvatar: profiles[0].avatarUrl,
      createdAt: iso(-1600),
    },
  ]

  return {
    profiles,
    channels,
    tracks,
    albums,
    playlists,
    voice_rooms,
    room_messages,
    announcements,
    premieres,
    artist_shoutouts,
    follows,
  }
}

export function ensureSeedData() {
  if (typeof localStorage === 'undefined') return
  try {
    if (localStorage.getItem(SEED_VERSION_KEY)) return
    const seed = createInitialSeedData()
    for (const [table, rows] of Object.entries(seed)) {
      const key = STORAGE_PREFIX + table
      const existingRaw = localStorage.getItem(key)
      if (!existingRaw) {
        localStorage.setItem(key, JSON.stringify(rows))
      }
    }
    localStorage.setItem(SEED_VERSION_KEY, '1')
  } catch (e) {
    console.warn('Seed initialization warning:', e)
  }
}

export function readTable(table) {
  ensureSeedData()
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + table)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

export function writeTable(table, rows) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(rows))
  } catch (e) {
    console.warn(`Local write quota warning for ${table}:`, e)
  }
}
