import { useState } from 'react'
import { X, Check, Image as ImageIcon, Sparkles } from 'lucide-react'
import { db } from '../lib/db'
import { storage, uploadSongThemeAsset } from '../lib/storage'
import { GENRES, LANGUAGES, MOODS, SONG_THEME_PRESETS, VISUALIZER_STYLES, getSongTheme } from '../musicHelpers'

export default function EditTrackModal({ track, onClose }) {
  const existingTheme = getSongTheme(track)
  const [title, setTitle] = useState(track.title || '')
  const [artistName, setArtistName] = useState(track.artistName || '')
  const [genre, setGenre] = useState(track.genre || 'Bollywood')
  const [language, setLanguage] = useState(track.language || 'Hindi')
  const [mood, setMood] = useState(track.mood || 'happy')
  const [lyrics, setLyrics] = useState(track.lyrics || '')
  const [coverFile, setCoverFile] = useState(null)

  // Song Theme Edit State
  const [presetId, setPresetId] = useState(existingTheme.presetId || SONG_THEME_PRESETS[0].id)
  const [themeName, setThemeName] = useState(existingTheme.name || SONG_THEME_PRESETS[0].name)
  const [primaryColor, setPrimaryColor] = useState(existingTheme.primaryColor || '#00E0A8')
  const [secondaryColor, setSecondaryColor] = useState(existingTheme.secondaryColor || '#FF3DAE')
  const [visualizer, setVisualizer] = useState(existingTheme.visualizer || 'bars')
  const [themeBgFile, setThemeBgFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const selectPreset = (id) => {
    const p = SONG_THEME_PRESETS.find((x) => x.id === id)
    if (!p) return
    setPresetId(p.id)
    setThemeName(p.name)
    setPrimaryColor(p.primaryColor)
    setSecondaryColor(p.secondaryColor)
    setVisualizer(p.visualizer)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      let coverUrl = track.coverUrl || ''
      if (coverFile) {
        const up = await storage.upload('covers', coverFile)
        coverUrl = up.url
      }
      let bgImageUrl = existingTheme.bgImageUrl || ''
      if (themeBgFile) {
        const upBg = await uploadSongThemeAsset(themeBgFile, track.id)
        bgImageUrl = upBg.url
      }
      await db.updateShared('tracks', track.id, {
        title: title.trim(),
        artistName: artistName.trim(),
        genre,
        language,
        mood,
        lyrics: lyrics.trim(),
        coverUrl,
        songTheme: {
          presetId,
          name: themeName,
          primaryColor,
          secondaryColor,
          visualizer,
          bgImageUrl,
        },
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
        className="w-full max-w-md rounded-3xl bg-bg-secondary border border-white/15 p-5 space-y-3 max-h-[88vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Edit Track &amp; Song Theme
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="text-[11px] text-text-secondary block mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-white/10 text-sm focus:outline-none focus:border-accent-primary"
          />
        </div>

        <div>
          <label className="text-[11px] text-text-secondary block mb-1">Artist Name</label>
          <input
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-white/10 text-sm focus:outline-none focus:border-accent-primary"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="px-2.5 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs"
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-2.5 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            className="px-2.5 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs"
          >
            {MOODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Song Theme Editor */}
        <div className="p-3 rounded-2xl bg-black/35 border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-accent-primary" /> Song Theme Studio
            </span>
            <span className="text-[10px] font-mono" style={{ color: primaryColor }}>
              {themeName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {SONG_THEME_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPreset(p.id)}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold shrink-0 border ${
                  presetId === p.id
                    ? 'bg-white/15 border-white text-white'
                    : 'bg-white/5 border-white/10 text-text-secondary'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-bg-primary border border-white/10">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer bg-transparent"
              />
              <span className="text-[10px] font-mono">{primaryColor}</span>
            </div>
            <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-bg-primary border border-white/10">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer bg-transparent"
              />
              <span className="text-[10px] font-mono">{secondaryColor}</span>
            </div>
            <select
              value={visualizer}
              onChange={(e) => setVisualizer(e.target.value)}
              className="px-2 py-1.5 rounded-xl bg-bg-primary border border-white/10 text-[10px]"
            >
              {VISUALIZER_STYLES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-dashed border-accent-primary/40 bg-accent-primary/10 cursor-pointer text-[11px] font-semibold text-accent-primary">
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="truncate">
              {themeBgFile ? themeBgFile.name : 'Replace Direct Song Theme Background'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setThemeBgFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <label className="flex items-center justify-center gap-2 p-3 rounded-xl bg-bg-primary border border-dashed border-white/15 cursor-pointer text-xs">
          <ImageIcon className="w-4 h-4 text-accent-primary" />
          <span className="truncate">{coverFile ? coverFile.name : 'Replace Cover Image'}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
          />
        </label>

        <div>
          <label className="text-[11px] text-text-secondary block mb-1">Lyrics (LRC or plain)</label>
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs font-mono focus:outline-none focus:border-accent-primary"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-full bg-accent-primary text-[#0B0B0B] font-bold text-xs flex items-center justify-center gap-1.5"
        >
          <Check className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Track & Song Theme'}
        </button>
      </form>
    </div>
  )
}
