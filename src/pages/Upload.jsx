import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Upload as UploadIcon,
  Music,
  Image as ImageIcon,
  Disc,
  Mic2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Radio,
  Sparkles,
  UserPlus,
  X,
  Layers,
  Palette,
  Wand2,
  Activity,
} from 'lucide-react'
import { storage, uploadSongThemeAsset } from '../lib/storage'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { social } from '../lib/social'
import { useLiveShared } from '../lib/useLive'
import {
  GENRES,
  LANGUAGES,
  MOODS,
  SONG_THEME_PRESETS,
  VISUALIZER_STYLES,
} from '../musicHelpers'
import { canUploadChannel } from '../permissions'
import { notifyFollowers, notifyUser } from '../hooks/useNotifications'
import { makeSvgArt } from '../lib/localBackend'

function readAudioDuration(file) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const a = new Audio()
      a.preload = 'metadata'
      a.onloadedmetadata = () => {
        const d = isFinite(a.duration) ? Math.round(a.duration) : 0
        URL.revokeObjectURL(url)
        resolve(d)
      }
      a.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(0)
      }
      a.src = url
    } catch {
      resolve(0)
    }
  })
}

export default function Upload() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user = auth.getCurrentUser()
  const { data: channels = [] } = useLiveShared('channels', { order: '-createdAt', limit: 200 })
  const myChannel = useMemo(
    () => channels.find((c) => c.ownerId === user?.id),
    [channels, user?.id]
  )

  const [mode, setMode] = useState(() => {
    const m = searchParams.get('mode')
    return m === 'bulk' || m === 'single' || m === 'album' || m === 'podcast' ? m : 'bulk'
  })

  useEffect(() => {
    const m = searchParams.get('mode')
    if (m && ['bulk', 'single', 'album', 'podcast'].includes(m)) {
      setMode(m)
    }
  }, [searchParams])

  // Single / Album / Podcast State
  const [title, setTitle] = useState('')
  const [artistName, setArtistName] = useState(user?.displayName || 'MiLey Studio Creator')
  const [genre, setGenre] = useState('Bollywood')
  const [language, setLanguage] = useState('Hindi')
  const [mood, setMood] = useState('happy')
  const [lyrics, setLyrics] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [audioFile, setAudioFile] = useState(null)
  const [albumTracks, setAlbumTracks] = useState([{ title: '', file: null, lyrics: '' }])
  const [collaborators, setCollaborators] = useState([])
  const [collabQuery, setCollabQuery] = useState('')
  const [collabResults, setCollabResults] = useState([])

  // Single Song Direct Song Theme State
  const [singleThemePresetId, setSingleThemePresetId] = useState(SONG_THEME_PRESETS[0].id)
  const [singleThemeName, setSingleThemeName] = useState(SONG_THEME_PRESETS[0].name)
  const [singlePrimaryColor, setSinglePrimaryColor] = useState(SONG_THEME_PRESETS[0].primaryColor)
  const [singleSecondaryColor, setSingleSecondaryColor] = useState(
    SONG_THEME_PRESETS[0].secondaryColor
  )
  const [singleVisualizer, setSingleVisualizer] = useState(SONG_THEME_PRESETS[0].visualizer)
  const [singleThemeBgFile, setSingleThemeBgFile] = useState(null)
  const [singleThemeBgPreview, setSingleThemeBgPreview] = useState('')

  // ── BULK SONG UPLOAD + PER-SONG DIRECT UPLOAD SONG THEMES STATE ──
  const [bulkItems, setBulkItems] = useState([])
  const [batchGenre, setBatchGenre] = useState('Electronic')
  const [batchLanguage, setBatchLanguage] = useState('English')
  const [batchMood, setBatchMood] = useState('party')
  const [batchPresetId, setBatchPresetId] = useState(SONG_THEME_PRESETS[0].id)

  const [uploading, setUploading] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const searchCollabs = async (q) => {
    setCollabQuery(q)
    if (!q.trim()) {
      setCollabResults([])
      return
    }
    try {
      const res = await social.searchUsers(q.trim())
      setCollabResults(
        (res || []).filter(
          (u) => u.id !== user?.id && !collaborators.some((c) => c.id === u.id)
        )
      )
    } catch {
      setCollabResults([])
    }
  }

  const addCollab = (u) => {
    setCollaborators((prev) => [
      ...prev,
      { id: u.id, displayName: u.displayName || 'Artist', avatarUrl: u.avatarUrl || '' },
    ])
    setCollabQuery('')
    setCollabResults([])
  }

  const removeCollab = (id) =>
    setCollaborators((prev) => prev.filter((c) => c.id !== id))

  const addAlbumRow = () =>
    setAlbumTracks((prev) => [...prev, { title: '', file: null, lyrics: '' }])
  const removeAlbumRow = (i) =>
    setAlbumTracks((prev) => prev.filter((_, idx) => idx !== i))
  const updateAlbumRow = (i, patch) =>
    setAlbumTracks((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  // Add multiple audio files to the Bulk Upload Queue, each initialized with a unique Song Theme
  const handleBulkFilesSelect = async (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    setError('')
    const existingCount = bulkItems.length

    const newEntries = await Promise.all(
      files.map(async (file, idx) => {
        const dur = await readAudioDuration(file)
        const preset =
          SONG_THEME_PRESETS[(existingCount + idx) % SONG_THEME_PRESETS.length]
        const rawTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ')
        return {
          id: `bulk-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          file,
          syntheticAudioUrl: '',
          title: rawTitle || `Studio Track ${existingCount + idx + 1}`,
          artistName: myChannel?.name || user?.displayName || 'MiLey Studio Creator',
          genre: batchGenre,
          language: batchLanguage,
          mood: batchMood,
          duration: dur || 195,
          lyrics: '',
          coverFile: null,
          coverPreview: '',
          // Direct Upload Song Theme per track
          themePresetId: preset.id,
          themeName: preset.name,
          primaryColor: preset.primaryColor,
          secondaryColor: preset.secondaryColor,
          visualizer: preset.visualizer,
          themeBgFile: null,
          themeBgPreview: '',
          status: 'ready', // 'ready' | 'uploading' | 'done' | 'error'
        }
      })
    )
    setBulkItems((prev) => [...prev, ...newEntries])
  }

  // Instant 1-Click Sample Studio Pack for testing Bulk Song Upload + Direct Song Themes immediately
  const loadSampleBulkStudioPack = () => {
    setError('')
    const sampleDefinitions = [
      {
        title: 'Cybernetic Monsoon (VIP Mix)',
        genre: 'Electronic',
        language: 'Hindi',
        mood: 'party',
        duration: 196,
        syntheticAudioUrl: 'synth://cyber-monsoon',
        coverPreview: makeSvgArt('CYBER MONSOON', 'VIP MIX', '#00E0A8', '#07121E'),
        preset: SONG_THEME_PRESETS[0],
        themeBgPreview: makeSvgArt('THEME CANVAS', 'CYBER NEON', '#00E0A8', '#050C16'),
        lyrics: '[00:00.00] Rain falls on the neon highway\n[00:04.00] Bassline echoing through the night\n[00:08.00] Global beats on mileymusic.space',
      },
      {
        title: 'Velvet Starlight Confession',
        genre: 'Pop',
        language: 'English',
        mood: 'romantic',
        duration: 208,
        syntheticAudioUrl: 'synth://velvet-starlight',
        coverPreview: makeSvgArt('VELVET STAR', 'CONFESSION', '#FF3DAE', '#1A081E'),
        preset: SONG_THEME_PRESETS[1],
        themeBgPreview: makeSvgArt('THEME CANVAS', 'VELVET ROSE', '#FF3DAE', '#16071B'),
        lyrics: '[00:00.00] Under the rose gold skyline\n[00:04.00] Every heartbeat in stereo\n[00:08.00] Spinning live in the Listen Room',
      },
      {
        title: 'Golden Hour 808 Drift',
        genre: 'Hip-Hop',
        language: 'Punjabi',
        mood: 'workout',
        duration: 182,
        syntheticAudioUrl: 'synth://golden-808',
        coverPreview: makeSvgArt('GOLDEN 808', 'DRIFT', '#F59E0B', '#1C1006'),
        preset: SONG_THEME_PRESETS[2],
        themeBgPreview: makeSvgArt('THEME CANVAS', 'ROYAL GOLD', '#F59E0B', '#180D05'),
        lyrics: '[00:00.00] Turn the subwoofers all the way up\n[00:04.00] Royal gold on the stage tonight\n[00:08.00] Unstoppable energy from start to finish',
      },
    ]

    const items = sampleDefinitions.map((s, idx) => ({
      id: `bulk-sample-${Date.now()}-${idx}`,
      file: null,
      syntheticAudioUrl: s.syntheticAudioUrl,
      title: s.title,
      artistName: myChannel?.name || user?.displayName || 'MiLey Studio Creator',
      genre: s.genre,
      language: s.language,
      mood: s.mood,
      duration: s.duration,
      lyrics: s.lyrics,
      coverFile: null,
      coverPreview: s.coverPreview,
      themePresetId: s.preset.id,
      themeName: s.preset.name,
      primaryColor: s.preset.primaryColor,
      secondaryColor: s.preset.secondaryColor,
      visualizer: s.preset.visualizer,
      themeBgFile: null,
      themeBgPreview: s.themeBgPreview,
      status: 'ready',
    }))

    setBulkItems((prev) => [...prev, ...items])
  }

  const updateBulkItem = (id, patch) => {
    setBulkItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const removeBulkItem = (id) => {
    setBulkItems((prev) => prev.filter((item) => item.id !== id))
  }

  const applyPresetToBulkItem = (id, presetId) => {
    const preset = SONG_THEME_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    updateBulkItem(id, {
      themePresetId: preset.id,
      themeName: preset.name,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      visualizer: preset.visualizer,
    })
  }

  const applyBatchDefaultsToAll = () => {
    const preset = SONG_THEME_PRESETS.find((p) => p.id === batchPresetId) || SONG_THEME_PRESETS[0]
    setBulkItems((prev) =>
      prev.map((item) => ({
        ...item,
        genre: batchGenre,
        language: batchLanguage,
        mood: batchMood,
        themePresetId: preset.id,
        themeName: preset.name,
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        visualizer: preset.visualizer,
      }))
    )
  }

  const handleBulkThemeBgUpload = (id, file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      updateBulkItem(id, {
        themeBgFile: file,
        themeBgPreview: typeof reader.result === 'string' ? reader.result : '',
      })
    }
    reader.readAsDataURL(file)
  }

  const handleBulkCoverUpload = (id, file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      updateBulkItem(id, {
        coverFile: file,
        coverPreview: typeof reader.result === 'string' ? reader.result : '',
      })
    }
    reader.readAsDataURL(file)
  }

  const handleSingleThemePresetChange = (presetId) => {
    const preset = SONG_THEME_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setSingleThemePresetId(preset.id)
    setSingleThemeName(preset.name)
    setSinglePrimaryColor(preset.primaryColor)
    setSingleSecondaryColor(preset.secondaryColor)
    setSingleVisualizer(preset.visualizer)
  }

  const handleSingleThemeBgFile = (file) => {
    if (!file) return
    setSingleThemeBgFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setSingleThemeBgPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  // Ensure the creator has an active channel automatically if needed
  const ensureCreatorChannel = async () => {
    if (myChannel && canUploadChannel(myChannel, user)) return myChannel
    const slug = (user?.displayName || 'miley_creator')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 20)
    const created = await db.upsertShared(
      'channels',
      {
        id: myChannel?.id || `ch-${user?.id || 'studio'}`,
        ownerId: user?.id,
        ownerName: user?.displayName || 'MiLey Studio Creator',
        name: myChannel?.name || `${user?.displayName || 'MiLey'} Studio`,
        username: myChannel?.username || slug || 'miley_studio',
        bio: 'Official Creator Channel on mileymusic.space',
        avatarUrl: user?.avatarUrl || '',
        verified: true,
        status: 'approved',
      },
      myChannel?.id || `ch-${user?.id || 'studio'}`,
      { visibleTo: 'public' }
    )
    return created
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setDone(false)

    try {
      setUploading(true)
      const activeChannel = await ensureCreatorChannel()

      // ── MODE 1: BULK SONGS + DIRECT UPLOAD SONG THEMES ──
      if (mode === 'bulk') {
        if (bulkItems.length === 0) {
          setUploading(false)
          return setError(
            'Add at least one audio file or click "Load 3 Sample Studio Tracks" to bulk upload.'
          )
        }

        for (let i = 0; i < bulkItems.length; i++) {
          const item = bulkItems[i]
          updateBulkItem(item.id, { status: 'uploading' })
          setProgressText(
            `Bulk Uploading (${i + 1}/${bulkItems.length}): "${item.title}" + Direct Song Theme (${item.themeName})...`
          )

          let audioUrl = item.syntheticAudioUrl
          if (item.file) {
            const upAudio = await storage.upload('tracks', item.file)
            audioUrl = upAudio.url
          } else if (!audioUrl) {
            audioUrl = `synth://${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
          }

          let coverUrl = item.coverPreview
          if (item.coverFile) {
            const upCover = await storage.upload('covers', item.coverFile)
            coverUrl = upCover.url
          } else if (!coverUrl) {
            coverUrl = makeSvgArt(
              item.title.slice(0, 14),
              item.artistName.slice(0, 16),
              item.primaryColor,
              '#090A10'
            )
          }

          let themeBgUrl = item.themeBgPreview || ''
          if (item.themeBgFile) {
            const upThemeBg = await uploadSongThemeAsset(item.themeBgFile, item.id)
            themeBgUrl = upThemeBg.url
          }

          const songTheme = {
            presetId: item.themePresetId,
            name: item.themeName || 'Custom Song Theme',
            primaryColor: item.primaryColor || '#00E0A8',
            secondaryColor: item.secondaryColor || '#FF3DAE',
            visualizer: item.visualizer || 'bars',
            bgImageUrl: themeBgUrl,
          }

          await db.insertShared(
            'tracks',
            {
              title: item.title.trim() || `Track ${i + 1}`,
              artistName: item.artistName.trim() || activeChannel.name,
              artistId: user?.id,
              channelId: activeChannel.id,
              channelUsername: activeChannel.username,
              channelName: activeChannel.name,
              channelVerified: Boolean(activeChannel.verified),
              genre: item.genre,
              language: item.language,
              mood: item.mood,
              lyrics: (item.lyrics || '').trim(),
              coverUrl,
              audioUrl,
              duration: item.duration || 195,
              type: 'song',
              plays: 1,
              likes: 0,
              songTheme,
              collaborators: collaborators.map((c) => ({
                id: c.id,
                name: c.displayName,
                avatar: c.avatarUrl,
              })),
            },
            undefined,
            { visibleTo: 'public' }
          )

          updateBulkItem(item.id, { status: 'done' })
        }

        notifyFollowers({
          actorId: user?.id,
          actorName: activeChannel.name,
          type: 'new_track',
          title: `${activeChannel.name} dropped ${bulkItems.length} new tracks with custom Song Themes`,
          body: bulkItems.map((b) => b.title).slice(0, 3).join(', '),
          link: `/channel/${activeChannel.username}`,
        })

        setDone(true)
        setProgressText('')
        setTimeout(() => navigate('/'), 1000)
        return
      }

      // ── MODE 2: SINGLE SONG / PODCAST / ALBUM ──
      if (!title.trim()) {
        setUploading(false)
        return setError('Please enter a title.')
      }

      let coverUrl = ''
      if (coverFile) {
        setProgressText('Uploading cover artwork...')
        const uploadedCover = await storage.upload('covers', coverFile)
        coverUrl = uploadedCover.url
      } else {
        coverUrl = makeSvgArt(
          title.trim().slice(0, 14),
          artistName.trim().slice(0, 16),
          singlePrimaryColor,
          '#090A10'
        )
      }

      let themeBgUrl = singleThemeBgPreview || ''
      if (singleThemeBgFile) {
        setProgressText('Uploading direct Song Theme canvas...')
        const upTheme = await uploadSongThemeAsset(singleThemeBgFile)
        themeBgUrl = upTheme.url
      }

      const songTheme = {
        presetId: singleThemePresetId,
        name: singleThemeName,
        primaryColor: singlePrimaryColor,
        secondaryColor: singleSecondaryColor,
        visualizer: singleVisualizer,
        bgImageUrl: themeBgUrl,
      }

      if (mode === 'single' || mode === 'podcast') {
        let audioUrl = ''
        let dur = 195
        if (audioFile) {
          setProgressText('Uploading audio file...')
          const uploadedAudio = await storage.upload('tracks', audioFile)
          audioUrl = uploadedAudio.url
          dur = (await readAudioDuration(audioFile)) || 195
        } else {
          audioUrl = `synth://${title.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        }

        setProgressText('Publishing track & Song Theme...')
        const collabNames = collaborators.map((c) => c.displayName).filter(Boolean)
        const baseArtist = artistName.trim() || activeChannel.name || 'Unknown Artist'
        const displayArtist =
          collabNames.length > 0
            ? `${baseArtist} feat. ${collabNames.join(', ')}`
            : baseArtist

        const created = await db.insertShared(
          'tracks',
          {
            title: title.trim(),
            artistName: displayArtist,
            artistId: user?.id,
            channelId: activeChannel.id,
            channelUsername: activeChannel.username,
            channelName: activeChannel.name,
            channelVerified: Boolean(activeChannel.verified),
            collaborators: collaborators.map((c) => ({
              id: c.id,
              name: c.displayName,
              avatar: c.avatarUrl,
            })),
            genre: mode === 'podcast' ? 'Podcast' : genre,
            language,
            mood,
            lyrics: lyrics.trim(),
            coverUrl,
            audioUrl,
            duration: dur,
            type: mode,
            plays: 1,
            likes: 0,
            songTheme,
          },
          undefined,
          { visibleTo: 'public' }
        )

        notifyFollowers({
          actorId: user?.id,
          actorName: activeChannel.name,
          type: 'new_track',
          title: `${activeChannel.name} dropped a new ${mode === 'podcast' ? 'episode' : 'track'}`,
          body: title.trim(),
          link: `/channel/${activeChannel.username}`,
          meta: { trackId: created?.id, coverUrl },
        })
        for (const c of collaborators) {
          notifyUser({
            recipientId: c.id,
            type: 'collab',
            title: `${activeChannel.name} tagged you as a collaborator`,
            body: title.trim(),
            link: `/channel/${activeChannel.username}`,
          })
        }
      } else if (mode === 'album') {
        const valid = albumTracks.filter((r) => r.title.trim())
        if (valid.length === 0) {
          setUploading(false)
          return setError('Add at least one track title to the album.')
        }
        setProgressText('Creating album...')
        const album = await db.insertShared(
          'albums',
          {
            title: title.trim(),
            artistName: artistName.trim() || activeChannel.name,
            artistId: user?.id,
            channelId: activeChannel.id,
            channelUsername: activeChannel.username,
            genre,
            language,
            coverUrl,
          },
          undefined,
          { visibleTo: 'public' }
        )

        for (let i = 0; i < valid.length; i++) {
          const row = valid[i]
          setProgressText(`Uploading track ${i + 1} of ${valid.length}: ${row.title}...`)
          let audioUrl = `synth://${row.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`
          let dur = 195
          if (row.file) {
            const up = await storage.upload('tracks', row.file)
            audioUrl = up.url
            dur = (await readAudioDuration(row.file)) || 195
          }
          await db.insertShared(
            'tracks',
            {
              title: row.title.trim(),
              artistName: artistName.trim() || activeChannel.name,
              artistId: user?.id,
              channelId: activeChannel.id,
              channelUsername: activeChannel.username,
              channelName: activeChannel.name,
              channelVerified: Boolean(activeChannel.verified),
              albumId: album.id,
              albumTitle: title.trim(),
              trackNumber: i + 1,
              genre,
              language,
              mood,
              lyrics: (row.lyrics || '').trim(),
              coverUrl,
              audioUrl,
              duration: dur,
              type: 'song',
              plays: 1,
              likes: 0,
              songTheme,
            },
            undefined,
            { visibleTo: 'public' }
          )
        }
      }

      setDone(true)
      setProgressText('')
      setTimeout(() => navigate('/'), 900)
    } catch (err) {
      setError(err?.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Creator Upload &amp; Song Theme Studio
          </h1>
          <p className="text-xs text-text-secondary">
            Uploading to{' '}
            <span className="text-accent-primary font-mono font-semibold">
              @{myChannel?.username || 'miley_studio'}
            </span>{' '}
            on <span className="text-white/80 font-mono">mileymusic.space</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/channel-setup')}
          className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-accent-primary flex items-center gap-1 shrink-0"
        >
          <Radio className="w-3 h-3" /> Channel Studio
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-4 gap-1.5 bg-bg-secondary p-1 rounded-2xl border border-white/5">
        {[
          { id: 'bulk', label: 'Bulk + Themes', icon: Layers },
          { id: 'single', label: 'Single Song', icon: Music },
          { id: 'album', label: 'Album', icon: Disc },
          { id: 'podcast', label: 'Podcast', icon: Mic2 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id)
              setError('')
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
              mode === id
                ? 'bg-accent-primary text-[#0B0B0B] font-bold shadow-md'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          BULK SONG UPLOAD SYSTEM WITH PER-SONG DIRECT UPLOAD SONG THEMES
         ══════════════════════════════════════════════════════════════════ */}
      {mode === 'bulk' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Multi-file Dropzone + Sample Studio Pack Button */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-accent-primary/15 via-bg-secondary to-accent-secondary/15 border border-accent-primary/35 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary text-[10px] font-mono uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" /> Direct Per-Song Theme Engine
                </span>
                <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  Bulk Song Upload + Direct Upload Song Themes
                </h2>
                <p className="text-xs text-text-secondary max-w-lg">
                  Select multiple audio files at once. Each song in your bulk queue gets its own
                  direct-upload Song Theme background canvas, neon color palette, and reactive
                  visualizer style.
                </p>
              </div>
              <button
                type="button"
                onClick={loadSampleBulkStudioPack}
                className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-accent-primary flex items-center gap-1.5 shrink-0 transition-all"
              >
                <Wand2 className="w-3.5 h-3.5" /> Load 3 Sample Studio Tracks
              </button>
            </div>

            <label className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-accent-primary/40 bg-black/35 hover:border-accent-primary cursor-pointer transition-all text-center">
              <UploadIcon className="w-8 h-8 text-accent-primary mb-2" />
              <p className="text-sm font-bold text-white">
                Click or Drop Multiple Audio Files Here (MP3, WAV, M4A, FLAC)
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                Each selected song will appear below with its own Direct Song Theme Studio
              </p>
              <input
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => handleBulkFilesSelect(e.target.files)}
              />
            </label>

            {/* Batch Default Controls */}
            {bulkItems.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-white/75 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-accent-primary" /> Batch Defaults ({bulkItems.length} Songs Queued)
                  </span>
                  <button
                    type="button"
                    onClick={applyBatchDefaultsToAll}
                    className="px-3 py-1 rounded-full bg-accent-primary text-[#0B0B0B] text-[11px] font-bold"
                  >
                    Apply Defaults to All {bulkItems.length} Songs
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <select
                    value={batchGenre}
                    onChange={(e) => setBatchGenre(e.target.value)}
                    className="px-2.5 py-2 rounded-xl bg-bg-secondary border border-white/10 text-xs"
                  >
                    {GENRES.map((g) => (
                      <option key={g} value={g}>
                        Genre: {g}
                      </option>
                    ))}
                  </select>
                  <select
                    value={batchLanguage}
                    onChange={(e) => setBatchLanguage(e.target.value)}
                    className="px-2.5 py-2 rounded-xl bg-bg-secondary border border-white/10 text-xs"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        Lang: {l}
                      </option>
                    ))}
                  </select>
                  <select
                    value={batchMood}
                    onChange={(e) => setBatchMood(e.target.value)}
                    className="px-2.5 py-2 rounded-xl bg-bg-secondary border border-white/10 text-xs"
                  >
                    {MOODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        Mood: {m.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={batchPresetId}
                    onChange={(e) => setBatchPresetId(e.target.value)}
                    className="px-2.5 py-2 rounded-xl bg-bg-secondary border border-white/10 text-xs"
                  >
                    {SONG_THEME_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        Theme: {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Per-Song Bulk Queue Cards with Direct Upload Song Themes */}
          {bulkItems.length > 0 && (
            <div className="space-y-4">
              {bulkItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="rounded-3xl bg-bg-secondary border overflow-hidden transition-all shadow-xl"
                  style={{
                    borderColor: `${item.primaryColor}55`,
                  }}
                >
                  {/* Top Live Song Theme Stage Header Preview */}
                  <div
                    className="relative p-4 flex items-center justify-between gap-3 overflow-hidden"
                    style={{
                      background: `radial-gradient(circle at 20% 20%, ${item.primaryColor}55, ${item.secondaryColor}30 55%, #090910 100%)`,
                    }}
                  >
                    {item.themeBgPreview && (
                      <div
                        className="absolute inset-0 opacity-35 bg-cover bg-center pointer-events-none"
                        style={{ backgroundImage: `url(${item.themeBgPreview})` }}
                      />
                    )}
                    <div className="relative z-10 flex items-center gap-3 min-w-0">
                      <div
                        className="w-12 h-12 rounded-2xl overflow-hidden border-2 shrink-0 flex items-center justify-center font-bold text-black relative"
                        style={{
                          borderColor: item.primaryColor,
                          background: item.coverPreview
                            ? `url(${item.coverPreview}) center/cover`
                            : `linear-gradient(135deg, ${item.primaryColor}, ${item.secondaryColor})`,
                        }}
                      >
                        {!item.coverPreview && `#${idx + 1}`}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-black/60 border border-white/15"
                            style={{ color: item.primaryColor }}
                          >
                            ✦ Song Theme: {item.themeName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/50 text-white/75">
                            {item.visualizer.toUpperCase()} VISUALIZER
                          </span>
                          {item.status === 'done' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-black">
                              Published ✓
                            </span>
                          )}
                          {item.status === 'uploading' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-black animate-pulse">
                              Uploading...
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-white truncate mt-1">
                          {item.title || `Track #${idx + 1}`}
                        </p>
                      </div>
                    </div>

                    {/* Mini Live Theme Spectrum Preview + Delete */}
                    <div className="relative z-10 flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex items-end gap-1 h-6 px-2 py-1 rounded-xl bg-black/45 border border-white/10">
                        {[50, 90, 65, 100, 75, 95].map((h, bIdx) => (
                          <span
                            key={bIdx}
                            className="w-1 rounded-full animate-pulse"
                            style={{
                              height: `${h}%`,
                              backgroundColor:
                                bIdx % 2 === 0 ? item.primaryColor : item.secondaryColor,
                              animationDelay: `${bIdx * 90}ms`,
                            }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBulkItem(item.id)}
                        className="p-2 rounded-full bg-black/50 text-white/70 hover:text-red-400 border border-white/10"
                        title="Remove from bulk queue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Body: Track Metadata + Direct Upload Song Theme Controls */}
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-text-secondary block mb-1">
                          Song Title *
                        </label>
                        <input
                          value={item.title}
                          onChange={(e) => updateBulkItem(item.id, { title: e.target.value })}
                          placeholder="Track title"
                          className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs focus:outline-none focus:border-accent-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-text-secondary block mb-1">
                          Artist / Creator Name
                        </label>
                        <input
                          value={item.artistName}
                          onChange={(e) =>
                            updateBulkItem(item.id, { artistName: e.target.value })
                          }
                          placeholder="Artist name"
                          className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs focus:outline-none focus:border-accent-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={item.genre}
                        onChange={(e) => updateBulkItem(item.id, { genre: e.target.value })}
                        className="px-2.5 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs"
                      >
                        {GENRES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                      <select
                        value={item.language}
                        onChange={(e) => updateBulkItem(item.id, { language: e.target.value })}
                        className="px-2.5 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <select
                        value={item.mood}
                        onChange={(e) => updateBulkItem(item.id, { mood: e.target.value })}
                        className="px-2.5 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs"
                      >
                        {MOODS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* DIRECT UPLOAD SONG THEME STUDIO FOR THIS TRACK */}
                    <div className="p-3.5 rounded-2xl bg-black/35 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                          <Sparkles
                            className="w-3.5 h-3.5"
                            style={{ color: item.primaryColor }}
                          />
                          Direct Upload Song Theme Studio (Song #{idx + 1})
                        </span>
                        <span className="text-[10px] font-mono text-text-secondary">
                          Syncs with Full Player, Listen Room &amp; Android Camera Top Bar
                        </span>
                      </div>

                      {/* Preset Selector Pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        {SONG_THEME_PRESETS.map((preset) => {
                          const active = item.themePresetId === preset.id
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => applyPresetToBulkItem(item.id, preset.id)}
                              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold shrink-0 flex items-center gap-1.5 border transition-all ${
                                active
                                  ? 'bg-white/15 border-white text-white shadow'
                                  : 'bg-white/5 border-white/10 text-text-secondary hover:text-white'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{
                                  background: `linear-gradient(135deg, ${preset.primaryColor}, ${preset.secondaryColor})`,
                                }}
                              />
                              {preset.name}
                            </button>
                          )
                        })}
                      </div>

                      {/* Custom Colors + Visualizer Style + Direct Theme Image Upload */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-center">
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-bg-secondary border border-white/10">
                          <input
                            type="color"
                            value={item.primaryColor}
                            onChange={(e) =>
                              updateBulkItem(item.id, { primaryColor: e.target.value })
                            }
                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                          />
                          <div className="min-w-0">
                            <p className="text-[10px] text-text-secondary">Primary Glow</p>
                            <p className="text-[11px] font-mono uppercase">{item.primaryColor}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 p-2 rounded-xl bg-bg-secondary border border-white/10">
                          <input
                            type="color"
                            value={item.secondaryColor}
                            onChange={(e) =>
                              updateBulkItem(item.id, { secondaryColor: e.target.value })
                            }
                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                          />
                          <div className="min-w-0">
                            <p className="text-[10px] text-text-secondary">Secondary Glow</p>
                            <p className="text-[11px] font-mono uppercase">
                              {item.secondaryColor}
                            </p>
                          </div>
                        </div>

                        <div className="p-2 rounded-xl bg-bg-secondary border border-white/10">
                          <p className="text-[10px] text-text-secondary mb-0.5">
                            Visualizer Mode
                          </p>
                          <select
                            value={item.visualizer}
                            onChange={(e) =>
                              updateBulkItem(item.id, { visualizer: e.target.value })
                            }
                            className="w-full bg-transparent text-[11px] font-semibold focus:outline-none"
                          >
                            {VISUALIZER_STYLES.map((v) => (
                              <option key={v.id} value={v.id} className="bg-bg-secondary">
                                {v.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Direct Upload Song Theme Visual File */}
                        <label className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-dashed border-accent-primary/50 bg-accent-primary/10 hover:bg-accent-primary/15 cursor-pointer text-center">
                          <ImageIcon className="w-3.5 h-3.5 text-accent-primary shrink-0" />
                          <span className="text-[10px] font-bold text-accent-primary truncate">
                            {item.themeBgFile
                              ? item.themeBgFile.name
                              : 'Direct Upload Theme BG'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleBulkThemeBgUpload(item.id, e.target.files?.[0])
                            }
                          />
                        </label>
                      </div>

                      {/* Per-Song Cover Art + Lyrics Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-bg-secondary border border-white/10 hover:border-white/25 cursor-pointer text-xs">
                          <ImageIcon className="w-3.5 h-3.5 text-accent-secondary shrink-0" />
                          <span className="truncate">
                            {item.coverFile ? item.coverFile.name : 'Upload Track Cover Art'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleBulkCoverUpload(item.id, e.target.files?.[0])
                            }
                          />
                        </label>
                        <input
                          value={item.lyrics}
                          onChange={(e) => updateBulkItem(item.id, { lyrics: e.target.value })}
                          placeholder="Optional lyrics or [00:12.00] synced LRC lines..."
                          className="sm:col-span-2 px-3 py-2 rounded-xl bg-bg-secondary border border-white/10 text-xs focus:outline-none focus:border-accent-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {done && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> All {bulkItems.length} tracks &amp; Direct Song Themes published! Redirecting...
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary text-[#0B0B0B] font-bold text-sm shadow-lg shadow-accent-primary/25 disabled:opacity-50"
          >
            {uploading
              ? progressText || 'Publishing Bulk Songs & Themes...'
              : `Publish ${bulkItems.length || ''} Bulk Songs + Direct Song Themes`}
          </button>
        </form>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SINGLE SONG / ALBUM / PODCAST FORM (WITH DIRECT SONG THEME STUDIO)
         ══════════════════════════════════════════════════════════════════ */}
      {mode !== 'bulk' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary block mb-1">
                {mode === 'album'
                  ? 'Album Title *'
                  : mode === 'podcast'
                  ? 'Episode Title *'
                  : 'Track Title *'}
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Midnight Rain"
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-secondary border border-white/10 text-sm focus:outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Artist / Host Name</label>
              <input
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Your artist name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-secondary border border-white/10 text-sm focus:outline-none focus:border-accent-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {mode !== 'podcast' && (
              <div>
                <label className="text-xs text-text-secondary block mb-1">Genre</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-white/10 text-xs focus:outline-none focus:border-accent-primary"
                >
                  {GENRES.filter((g) => g !== 'Podcast').map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs text-text-secondary block mb-1">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-white/10 text-xs focus:outline-none focus:border-accent-primary"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Mood</label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-white/10 text-xs focus:outline-none focus:border-accent-primary"
              >
                {MOODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Direct Song Theme Studio for Single/Album/Podcast */}
          <div className="p-4 rounded-2xl bg-bg-secondary border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-accent-primary" /> Direct Upload Song Theme
              </span>
              <span className="text-[10px] font-mono text-accent-primary">{singleThemeName}</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {SONG_THEME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSingleThemePresetChange(p.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold shrink-0 flex items-center gap-1.5 border ${
                    singleThemePresetId === p.id
                      ? 'bg-white/15 border-white text-white'
                      : 'bg-white/5 border-white/10 text-text-secondary'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: `linear-gradient(135deg, ${p.primaryColor}, ${p.secondaryColor})`,
                    }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-bg-primary border border-white/10">
                <input
                  type="color"
                  value={singlePrimaryColor}
                  onChange={(e) => setSinglePrimaryColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent"
                />
                <span className="text-[11px] font-mono">{singlePrimaryColor}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-bg-primary border border-white/10">
                <input
                  type="color"
                  value={singleSecondaryColor}
                  onChange={(e) => setSingleSecondaryColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent"
                />
                <span className="text-[11px] font-mono">{singleSecondaryColor}</span>
              </div>
              <label className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-dashed border-accent-primary/40 bg-accent-primary/10 cursor-pointer text-[11px] font-semibold text-accent-primary">
                <ImageIcon className="w-3.5 h-3.5" />
                <span className="truncate">
                  {singleThemeBgFile ? singleThemeBgFile.name : 'Theme Canvas BG'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleSingleThemeBgFile(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          {/* Cover & Audio Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col items-center justify-center p-4 rounded-2xl bg-bg-secondary border border-dashed border-white/15 cursor-pointer hover:border-accent-primary/50 text-center">
              <ImageIcon className="w-6 h-6 text-accent-primary mb-1.5" />
              <span className="text-xs font-medium truncate max-w-full">
                {coverFile ? coverFile.name : 'Choose Cover Artwork'}
              </span>
              <span className="text-[10px] text-text-secondary">
                JPG / PNG (Auto-generated if omitted)
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              />
            </label>

            {mode !== 'album' && (
              <label className="flex flex-col items-center justify-center p-4 rounded-2xl bg-bg-secondary border border-dashed border-white/15 cursor-pointer hover:border-accent-primary/50 text-center">
                <UploadIcon className="w-6 h-6 text-accent-secondary mb-1.5" />
                <span className="text-xs font-medium truncate max-w-full">
                  {audioFile ? audioFile.name : 'Choose Audio File'}
                </span>
                <span className="text-[10px] text-text-secondary">
                  MP3, WAV, M4A (Studio synth fallback if omitted)
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>

          {/* Collaborators */}
          {mode !== 'album' && (
            <div className="p-3.5 rounded-2xl bg-bg-secondary border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-accent-primary" /> Collaborators (feat.)
                </label>
                <span className="text-[10px] text-text-secondary">Optional</span>
              </div>
              {collaborators.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {collaborators.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-primary/15 border border-accent-primary/30 text-accent-primary text-xs font-medium"
                    >
                      {c.displayName}
                      <button type="button" onClick={() => removeCollab(c.id)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                value={collabQuery}
                onChange={(e) => searchCollabs(e.target.value)}
                placeholder="Search artists to credit as featured..."
                className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs focus:outline-none focus:border-accent-primary"
              />
              {collabResults.length > 0 && (
                <div className="max-h-36 overflow-y-auto space-y-1 pt-1">
                  {collabResults.slice(0, 5).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => addCollab(u)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-xs text-left"
                    >
                      <span className="truncate">{u.displayName || 'Artist'}</span>
                      <span className="text-[10px] text-accent-primary">+ Add</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode !== 'album' ? (
            <div>
              <label className="text-xs text-text-secondary block mb-1">
                Lyrics / Show Notes (supports LRC timestamps like{' '}
                <code className="text-accent-primary">[00:12.50] line</code>)
              </label>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={4}
                placeholder={'[00:05.00] First line of the song\n[00:10.50] Second line...'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-secondary border border-white/10 text-xs font-mono focus:outline-none focus:border-accent-primary"
              />
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold">Album Tracks</label>
                <button
                  type="button"
                  onClick={addAlbumRow}
                  className="flex items-center gap-1 text-xs text-accent-primary font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Track
                </button>
              </div>
              {albumTracks.map((row, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-bg-secondary border border-white/5 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-text-secondary w-5">
                      {idx + 1}.
                    </span>
                    <input
                      value={row.title}
                      onChange={(e) => updateAlbumRow(idx, { title: e.target.value })}
                      placeholder="Track title"
                      className="flex-1 bg-bg-primary px-3 py-1.5 rounded-lg text-xs border border-white/10 focus:outline-none"
                    />
                    <label className="px-3 py-1.5 rounded-lg bg-white/5 text-xs cursor-pointer truncate max-w-[140px]">
                      {row.file ? row.file.name : 'Audio file'}
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) =>
                          updateAlbumRow(idx, { file: e.target.files?.[0] || null })
                        }
                      />
                    </label>
                    {albumTracks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAlbumRow(idx)}
                        className="p-1.5 text-text-secondary hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {done && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Published! Redirecting to home...
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary text-[#0B0B0B] font-bold text-sm disabled:opacity-50"
          >
            {uploading ? progressText || 'Uploading...' : `Publish ${mode}`}
          </button>
        </form>
      )}
    </div>
  )
}
