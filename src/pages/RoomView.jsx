import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Mic,
  MicOff,
  Send,
  Music,
  Users,
  Smile,
  Crown,
  Hand,
  Lock,
  Plus,
  Trash2,
  Play,
  Palette,
  SkipForward,
  Flame,
  Volume2,
  ThumbsUp,
  Sparkles,
  Share2,
  QrCode,
  BarChart2,
  Heart,
  Disc3,
  Mic2,
} from 'lucide-react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { realtime } from '../lib/realtime'
import { share } from '../lib/share'
import { APP_DOMAIN } from '../lib/supabaseClient'
import { useLiveShared, usePresence } from '../lib/useLive'
import { usePlayer } from '../context/PlayerContext'
import { useLikes } from '../hooks/useLikes'
import { useVoiceChat } from '../hooks/useVoiceChat'
import LyricsView from '../components/LyricsView'
import QRCard from '../components/QRCard'
import {
  ROOM_BACKGROUNDS,
  roomBgStyle,
  fallbackCover,
  getSongTheme,
  formatDuration,
} from '../musicHelpers'

const REACTIONS = ['🔥', '❤️', '🎵', '👏', '🚀', '✨', '💃', '🎧']

const DJ_SOUNDBOARD = [
  { id: 'airhorn', label: 'Airhorn', emoji: '📯', freq: 520, type: 'sawtooth' },
  { id: 'drop', label: '808 Drop', emoji: '💥', freq: 95, type: 'sine' },
  { id: 'cheer', label: 'Applause', emoji: '👏', freq: 740, type: 'triangle' },
  { id: 'scratch', label: 'Scratch', emoji: '💿', freq: 410, type: 'square' },
  { id: 'chime', label: 'Starlight', emoji: '✨', freq: 980, type: 'sine' },
]

// Synthesize zero-latency DJ Soundboard audio effects via Web Audio API
function playDjSoundEffect(sfx) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = sfx.type || 'sawtooth'
    osc.frequency.setValueAtTime(sfx.freq || 440, ctx.currentTime)
    if (sfx.id === 'drop') {
      osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.55)
    } else if (sfx.id === 'airhorn') {
      osc.frequency.setValueAtTime(520, ctx.currentTime)
      osc.frequency.setValueAtTime(620, ctx.currentTime + 0.12)
    } else if (sfx.id === 'chime') {
      osc.frequency.exponentialRampToValueAtTime(1480, ctx.currentTime + 0.45)
    }
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.56)
  } catch {
    /* ignore */
  }
}

export default function RoomView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const {
    playTrack,
    currentTrack,
    isPlaying,
    togglePlay,
    currentTime,
    duration,
    seek,
  } = usePlayer()
  const { isLiked, toggleLike } = useLikes()
  const [room, setRoom] = useState(null)
  const [text, setText] = useState('')
  const [pickingTrack, setPickingTrack] = useState(false)
  const [pickingTheme, setPickingTheme] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)
  const [showPollModal, setShowPollModal] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOpt1, setPollOpt1] = useState('')
  const [pollOpt2, setPollOpt2] = useState('')
  const [qrOpen, setQrOpen] = useState(false)
  const [floatingEmojis, setFloatingEmojis] = useState([])
  const [sfxBanner, setSfxBanner] = useState(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [skipVotes, setSkipVotes] = useState(() => new Set())
  const endRef = useRef(null)
  const lastPlayedIdRef = useRef(null)

  const { peers = [] } = usePresence(`room:${id}`, {
    userId: user?.id,
    name: user?.displayName || 'Listener',
    avatar: user?.avatarUrl || '',
  })

  const { joined, muted, activeSpeakers, joinVoice, leaveVoice, toggleMute } = useVoiceChat(
    id,
    user
  )

  const { data: allTracks = [] } = useLiveShared('tracks', { order: '-createdAt', limit: 150 })
  const { data: messages = [] } = useLiveShared('room_messages', {
    filters: { roomId: id },
    order: '-createdAt',
    limit: 80,
  })

  const sortedMessages = [...messages].reverse()

  useEffect(() => {
    if (!id) return
    db.getShared('rooms', id)
      .then((r) => setRoom(r))
      .catch(() => {})
    const unsub = db.subscribeShared('rooms', (ev) => {
      if (ev.data?.id === id) setRoom(ev.data)
    })
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [id])

  // Auto-sync playback when room track changes
  useEffect(() => {
    if (!room?.currentTrackId || allTracks.length === 0) return
    if (lastPlayedIdRef.current === room.currentTrackId) return
    const found = allTracks.find((t) => t.id === room.currentTrackId)
    if (found) {
      lastPlayedIdRef.current = found.id
      playTrack(found, allTracks)
    }
  }, [room?.currentTrackId, allTracks, playTrack])

  // Realtime broadcasts for floating reactions, DJ soundboard SFX, and skip votes
  useEffect(() => {
    if (!id) return
    const ch = realtime.channel(`room-fx:${id}`)
    ch.on('broadcast', { event: 'emoji' }, (payload) => {
      const emoji = payload?.emoji || '🔥'
      const eid = `${Date.now()}-${Math.random()}`
      setFloatingEmojis((prev) => [...prev, { id: eid, emoji, left: 15 + Math.random() * 70 }])
      setTimeout(() => {
        setFloatingEmojis((prev) => prev.filter((e) => e.id !== eid))
      }, 2200)
    })
    ch.on('broadcast', { event: 'sfx' }, (payload) => {
      if (!payload?.sfx) return
      playDjSoundEffect(payload.sfx)
      setSfxBanner(`${payload.userName || 'DJ'} triggered ${payload.sfx.emoji} ${payload.sfx.label}!`)
      setTimeout(() => setSfxBanner(null), 2400)
    })
    ch.on('broadcast', { event: 'skip_vote' }, (payload) => {
      if (!payload?.userId) return
      setSkipVotes((prev) => new Set([...prev, payload.userId]))
    })
    ch.subscribe()
    return () => {
      ch.unsubscribe()
    }
  }, [id])

  useEffect(() => {
    setSkipVotes(new Set())
  }, [room?.currentTrackId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sortedMessages.length])

  const isHost = room && user?.id && room.hostId === user.id
  const speakerIds = room?.speakerIds || (room?.hostId ? [room.hostId] : [])
  const raisedHandIds = room?.raisedHandIds || []
  const isSpeaker = Boolean(isHost || (user?.id && speakerIds.includes(user.id)))
  const hasRaisedHand = Boolean(user?.id && raisedHandIds.includes(user.id))
  const canSpin = Boolean(isHost || room?.openDj || isSpeaker)
  const queue = Array.isArray(room?.queue) ? room.queue : []

  const spinningTrack =
    allTracks.find((t) => t.id === room?.currentTrackId) || currentTrack || allTracks[0]
  const activeTheme = getSongTheme(
    spinningTrack || { songTheme: room?.currentSongTheme }
  )

  const boostVibe = async (delta = 4) => {
    if (!room) return
    const nextScore = Math.min(100, (room.vibeScore || 85) + delta)
    await db.updateShared('rooms', id, { vibeScore: nextScore })
    if (nextScore >= 100) {
      // Trigger celebratory stage emoji shower
      ;['🔥', '🎉', '✨', '🚀', '💃'].forEach((em, i) => {
        setTimeout(() => {
          const eid = `${Date.now()}-${i}-${Math.random()}`
          setFloatingEmojis((prev) => [...prev, { id: eid, emoji: em, left: 15 + i * 16 }])
          setTimeout(() => {
            setFloatingEmojis((prev) => prev.filter((e) => e.id !== eid))
          }, 2200)
        }, i * 110)
      })
    }
  }

  const sendEmoji = (emoji) => {
    const ch = realtime.channel(`room-fx:${id}`)
    ch.subscribe()
    ch.send({ type: 'broadcast', event: 'emoji', payload: { emoji } })
    const eid = `${Date.now()}-${Math.random()}`
    setFloatingEmojis((prev) => [...prev, { id: eid, emoji, left: 20 + Math.random() * 60 }])
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== eid))
    }, 2200)
    boostVibe(2)
  }

  const triggerDjSoundboard = (sfx) => {
    playDjSoundEffect(sfx)
    setSfxBanner(`You triggered ${sfx.emoji} ${sfx.label}!`)
    setTimeout(() => setSfxBanner(null), 2400)
    const ch = realtime.channel(`room-fx:${id}`)
    ch.subscribe()
    ch.send({
      type: 'broadcast',
      event: 'sfx',
      payload: { sfx, userName: user?.displayName || 'DJ' },
    })
    boostVibe(3)
  }

  const sendChat = async (e) => {
    e.preventDefault()
    const clean = text.trim()
    if (!clean) return
    setText('')
    await db.insertShared(
      'room_messages',
      {
        roomId: id,
        senderId: user?.id,
        senderName: user?.displayName || 'Listener',
        text: clean,
      },
      undefined,
      { visibleTo: 'public' }
    )
  }

  const spinTrack = async (track) => {
    setPickingTrack(false)
    if (!canSpin) return
    lastPlayedIdRef.current = track.id
    playTrack(track, allTracks)
    const theme = getSongTheme(track)
    await db.updateShared('rooms', id, {
      currentTrackId: track.id,
      currentTrackTitle: track.title,
      currentTrackArtist: track.artistName,
      currentTrackCover: track.coverUrl || '',
      currentSongTheme: theme,
    })
  }

  const addToRoomQueue = async (track) => {
    setPickingTrack(false)
    const item = {
      id: track.id,
      title: track.title,
      artistName: track.artistName,
      coverUrl: track.coverUrl || '',
      addedBy: user?.displayName || 'Listener',
      upvotes: 1,
      upvoterIds: user?.id ? [user.id] : [],
      songTheme: getSongTheme(track),
    }
    const nextQ = [...queue, item]
    await db.updateShared('rooms', id, { queue: nextQ })
    if (!room?.currentTrackId && canSpin) {
      await spinTrack(track)
    }
  }

  const upvoteQueueItem = async (idx) => {
    if (!user?.id) return
    const nextQ = queue.map((item, i) => {
      if (i !== idx) return item
      const voters = new Set(item.upvoterIds || [])
      if (voters.has(user.id)) {
        voters.delete(user.id)
      } else {
        voters.add(user.id)
      }
      return {
        ...item,
        upvoterIds: [...voters],
        upvotes: voters.size,
      }
    })
    // Sort queue by highest upvotes
    nextQ.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
    await db.updateShared('rooms', id, { queue: nextQ })
  }

  const playNextFromQueue = async () => {
    if (!canSpin || queue.length === 0) return
    const [first, ...rest] = queue
    const full = allTracks.find((t) => t.id === first.id) || first
    await db.updateShared('rooms', id, {
      queue: rest,
      currentTrackId: full.id,
      currentTrackTitle: full.title,
      currentTrackArtist: full.artistName,
      currentTrackCover: full.coverUrl || '',
      currentSongTheme: getSongTheme(full),
    })
    lastPlayedIdRef.current = full.id
    playTrack(full, allTracks)
  }

  const removeFromQueue = async (idx) => {
    const nextQ = queue.filter((_, i) => i !== idx)
    await db.updateShared('rooms', id, { queue: nextQ })
  }

  const voteSkip = async () => {
    if (!user?.id) return
    const nextVotes = new Set([...skipVotes, user.id])
    setSkipVotes(nextVotes)
    const ch = realtime.channel(`room-fx:${id}`)
    ch.subscribe()
    ch.send({ type: 'broadcast', event: 'skip_vote', payload: { userId: user.id } })
    const threshold = Math.max(1, Math.ceil(Math.max(peers.length, 1) / 2))
    if (nextVotes.size >= threshold && queue.length > 0) {
      setSkipVotes(new Set())
      await playNextFromQueue()
    }
  }

  const votePollOption = async (optId) => {
    if (!room?.poll || !user?.id) return
    const prevVote = room.poll.voters?.[user.id]
    if (prevVote === optId) return
    const nextOptions = (room.poll.options || []).map((o) => {
      let v = o.votes || 0
      if (o.id === prevVote) v = Math.max(0, v - 1)
      if (o.id === optId) v += 1
      return { ...o, votes: v }
    })
    const nextPoll = {
      ...room.poll,
      options: nextOptions,
      voters: { ...(room.poll.voters || {}), [user.id]: optId },
    }
    await db.updateShared('rooms', id, { poll: nextPoll })
  }

  const createNewPoll = async (e) => {
    e.preventDefault()
    if (!pollQuestion.trim() || !pollOpt1.trim() || !pollOpt2.trim()) return
    const nextPoll = {
      question: pollQuestion.trim(),
      options: [
        { id: 'opt1', text: pollOpt1.trim(), votes: 1 },
        { id: 'opt2', text: pollOpt2.trim(), votes: 0 },
      ],
      voters: user?.id ? { [user.id]: 'opt1' } : {},
    }
    await db.updateShared('rooms', id, { poll: nextPoll })
    setShowPollModal(false)
    setPollQuestion('')
    setPollOpt1('')
    setPollOpt2('')
  }

  const toggleRaiseHand = async () => {
    if (!user?.id || !room) return
    const next = hasRaisedHand
      ? raisedHandIds.filter((u) => u !== user.id)
      : [...new Set([...raisedHandIds, user.id])]
    await db.updateShared('rooms', id, { raisedHandIds: next })
  }

  const approveSpeaker = async (uid) => {
    if (!isHost || !room) return
    const nextSpeakers = [...new Set([...speakerIds, uid])]
    const nextHands = raisedHandIds.filter((u) => u !== uid)
    await db.updateShared('rooms', id, {
      speakerIds: nextSpeakers,
      raisedHandIds: nextHands,
    })
  }

  const revokeSpeaker = async (uid) => {
    if (!isHost || !room || uid === room.hostId) return
    const nextSpeakers = speakerIds.filter((u) => u !== uid)
    await db.updateShared('rooms', id, { speakerIds: nextSpeakers })
  }

  const toggleOpenDj = async () => {
    if (!isHost || !room) return
    await db.updateShared('rooms', id, { openDj: !room.openDj })
  }

  const toggleSyncSongTheme = async () => {
    if (!room) return
    await db.updateShared('rooms', id, { syncSongTheme: !room.syncSongTheme })
  }

  const changeRoomTheme = async (bgId) => {
    setPickingTheme(false)
    if (!isHost) return
    await db.updateShared('rooms', id, { bgTheme: bgId, customBgUrl: '' })
  }

  const shareRoomUrl = `${APP_DOMAIN}/#/rooms/${id}`

  const handleShareRoom = async () => {
    await share.link({
      title: `${room?.name || 'Listen Room'} on MiLey`,
      text: `Join our live Listen Room "${room?.name || ''}" on MiLey (mileymusic.space)!`,
      url: shareRoomUrl,
    })
  }

  // Password gate for locked rooms
  if (room?.isPrivate && !isHost && !unlocked) {
    const checkPw = (e) => {
      e.preventDefault()
      if (pwInput.trim() === (room.password || '')) {
        setUnlocked(true)
        setPwErr('')
      } else {
        setPwErr('Incorrect room password.')
      }
    }
    return (
      <div
        style={roomBgStyle(room.bgTheme, room.customBgUrl)}
        className="min-h-screen flex items-center justify-center p-4"
      >
        <form
          onSubmit={checkPw}
          className="w-full max-w-sm p-6 rounded-3xl bg-black/70 backdrop-blur-xl border border-white/15 space-y-4 text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-accent-secondary/20 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-accent-secondary" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              {room.name}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              This Listen Room is password-locked by {room.hostName}.
            </p>
          </div>
          <input
            type="password"
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            placeholder="Enter room password..."
            autoFocus
            className="w-full px-4 py-2.5 rounded-xl bg-bg-primary border border-white/15 text-sm text-center focus:outline-none focus:border-accent-primary"
          />
          {pwErr && <p className="text-xs text-red-400">{pwErr}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/rooms')}
              className="flex-1 py-2.5 rounded-full bg-white/10 text-xs font-semibold"
            >
              Back
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-full bg-accent-primary text-[#0B0B0B] text-xs font-bold"
            >
              Unlock Room
            </button>
          </div>
        </form>
      </div>
    )
  }

  const stageStyle =
    room?.syncSongTheme !== false
      ? { background: activeTheme.bgStyle }
      : roomBgStyle(room?.bgTheme, room?.customBgUrl)

  const totalPollVotes = (room?.poll?.options || []).reduce((s, o) => s + (o.votes || 0), 0) || 1
  const pct =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 35

  return (
    <div
      style={stageStyle}
      className="min-h-screen px-4 pt-4 pb-8 max-w-2xl mx-auto flex flex-col justify-between relative overflow-hidden transition-all duration-700"
    >
      {/* Floating Emoji Overlay */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-40">
        {floatingEmojis.map((e) => (
          <span
            key={e.id}
            style={{ left: `${e.left}%` }}
            className="absolute bottom-24 text-3xl animate-bounce"
          >
            {e.emoji}
          </span>
        ))}
      </div>

      {/* Live DJ Soundboard Toast Banner */}
      {sfxBanner && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-black/85 border border-accent-primary text-xs font-bold text-accent-primary shadow-2xl animate-bounce">
          {sfxBanner}
        </div>
      )}

      {/* Top Room Header */}
      <div className="space-y-3 relative z-10">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => {
              leaveVoice()
              navigate('/rooms')
            }}
            className="w-9 h-9 rounded-full bg-black/45 backdrop-blur flex items-center justify-center border border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="text-center min-w-0 flex-1">
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <p className="text-sm font-extrabold truncate" style={{ fontFamily: 'var(--font-display)' }}>
                {room?.name || 'Listen Room'}
              </p>
              {room?.isPrivate && <Lock className="w-3 h-3 text-accent-secondary shrink-0" />}
            </div>
            <p className="text-[11px] text-white/70 truncate">
              {Math.max(peers.length, 1)} in room · {room?.category || 'Music Party'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleSyncSongTheme}
              title="Sync Room Stage with Active Song Theme"
              className={`px-2.5 py-1.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border ${
                room?.syncSongTheme !== false
                  ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                  : 'bg-black/40 border-white/10 text-white/70'
              }`}
            >
              <Sparkles className="w-3 h-3" /> Theme Sync
            </button>
            <button
              onClick={handleShareRoom}
              aria-label="Share room"
              className="w-9 h-9 rounded-full bg-black/45 backdrop-blur flex items-center justify-center border border-white/10"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setQrOpen(true)}
              aria-label="Room QR card"
              className="w-9 h-9 rounded-full bg-black/45 backdrop-blur flex items-center justify-center border border-white/10"
            >
              <QrCode className="w-4 h-4" />
            </button>
            {isHost && (
              <button
                onClick={() => setPickingTheme((v) => !v)}
                aria-label="Change room theme"
                className="w-9 h-9 rounded-full bg-black/45 backdrop-blur flex items-center justify-center border border-white/10"
              >
                <Palette className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Room Vibe / Hype Meter Bar */}
        <div className="p-2.5 rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Flame className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span className="text-amber-300 font-bold uppercase">
                  Room Vibe Meter · {room?.vibeScore || 88}% 🔥
                </span>
                <span className="text-white/60">100% triggers stage party</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${room?.vibeScore || 88}%`,
                    background: `linear-gradient(90deg, ${activeTheme.primaryColor}, #F59E0B, ${activeTheme.secondaryColor})`,
                  }}
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => boostVibe(5)}
            className="px-3 py-1.5 rounded-full bg-amber-400 text-[#0B0B0B] text-[11px] font-extrabold shrink-0 active:scale-95 transition-transform"
          >
            ⚡ Boost Vibe
          </button>
        </div>

        {/* CENTRAL SYNCED TURNTABLE & NOW SPINNING STAGE */}
        <div
          className="p-4 rounded-3xl bg-black/55 backdrop-blur-2xl border shadow-2xl space-y-3"
          style={{
            borderColor: `${activeTheme.primaryColor}66`,
            boxShadow: `0 16px 40px -10px ${activeTheme.primaryColor}44`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              {/* Spinning 3D Turntable Vinyl */}
              <div
                onClick={togglePlay}
                className={`relative w-16 h-16 rounded-full overflow-hidden border-2 shrink-0 cursor-pointer shadow-lg ${
                  isPlaying ? 'animate-spin' : ''
                }`}
                style={{
                  animationDuration: '7s',
                  borderColor: activeTheme.primaryColor,
                  background: fallbackCover(
                    room?.currentTrackTitle || spinningTrack?.title || 'Room'
                  ),
                }}
              >
                {(room?.currentTrackCover || spinningTrack?.coverUrl) && (
                  <img
                    src={room?.currentTrackCover || spinningTrack?.coverUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-[#07070C] border border-white/40" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono uppercase bg-white/10 border border-white/10"
                    style={{ color: activeTheme.primaryColor }}
                  >
                    <Sparkles className="w-2.5 h-2.5" /> {activeTheme.name}
                  </span>
                  <span className="text-[10px] font-mono text-white/60">
                    {room?.openDj ? 'Open DJ Deck' : 'Host DJ Deck'}
                  </span>
                </div>
                <p className="text-base font-bold text-white truncate mt-0.5">
                  {room?.currentTrackTitle || spinningTrack?.title || 'Select a track to spin'}
                </p>
                <p className="text-xs text-white/70 truncate">
                  {room?.currentTrackArtist || spinningTrack?.artistName || 'Tap + Queue to spin'}
                </p>
              </div>
            </div>

            {/* Stage Controls: Like, Lyrics, Vote Skip, Spin/Queue */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {spinningTrack && (
                <button
                  onClick={() => toggleLike(spinningTrack)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/15"
                  title="Like spinning track"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      isLiked(spinningTrack.id)
                        ? 'fill-accent-secondary text-accent-secondary'
                        : 'text-white/80'
                    }`}
                  />
                </button>
              )}
              <button
                onClick={() => setShowLyrics((v) => !v)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1 border ${
                  showLyrics
                    ? 'bg-accent-primary text-[#0B0B0B] border-accent-primary'
                    : 'bg-white/10 border-white/10 text-white/85'
                }`}
              >
                <Mic2 className="w-3 h-3" /> Lyrics
              </button>
              {queue.length > 0 && (
                <button
                  onClick={voteSkip}
                  className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-semibold flex items-center gap-1"
                  title="Vote to skip to next song"
                >
                  <SkipForward className="w-3 h-3" />
                  Skip ({skipVotes.size}/{Math.max(1, Math.ceil(Math.max(peers.length, 1) / 2))})
                </button>
              )}
              <button
                onClick={() => setPickingTrack((v) => !v)}
                className="px-3 py-1.5 rounded-full text-[#0B0B0B] text-xs font-bold flex items-center gap-1 shadow"
                style={{ backgroundColor: activeTheme.primaryColor }}
              >
                <Plus className="w-3.5 h-3.5" /> {canSpin ? 'Spin / Queue' : 'Add Queue'}
              </button>
            </div>
          </div>

          {/* Live Stage Spectrum Bar + Progress */}
          <div className="space-y-1.5">
            <div className="flex items-end justify-center gap-1 h-5">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className={`flex-1 rounded-full transition-all duration-300 ${
                    isPlaying ? 'animate-pulse' : ''
                  }`}
                  style={{
                    height: isPlaying ? `${25 + ((i * 31) % 75)}%` : '20%',
                    backgroundColor:
                      i % 2 === 0 ? activeTheme.primaryColor : activeTheme.secondaryColor,
                    animationDelay: `${i * 55}ms`,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-white/65">
              <span>{formatDuration(currentTime)}</span>
              <div className="flex-1 h-1 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${activeTheme.primaryColor}, ${activeTheme.secondaryColor})`,
                  }}
                />
              </div>
              <span>{formatDuration(duration || spinningTrack?.duration || 195)}</span>
            </div>
          </div>

          {/* Live Synced Lyrics Drawer inside Listen Room */}
          {showLyrics && spinningTrack && (
            <div className="pt-2 border-t border-white/10">
              <LyricsView
                lyrics={spinningTrack.lyrics}
                currentTime={currentTime}
                onSeek={seek}
              />
            </div>
          )}
        </div>

        {/* LIVE DJ SOUNDBOARD PAD BAR */}
        <div className="p-2.5 rounded-2xl bg-black/45 backdrop-blur-xl border border-white/10 flex items-center justify-between gap-2 overflow-x-auto">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/70 flex items-center gap-1 shrink-0 pl-1">
            <Volume2 className="w-3.5 h-3.5 text-accent-primary" /> DJ Soundboard:
          </span>
          <div className="flex items-center gap-1.5">
            {DJ_SOUNDBOARD.map((sfx) => (
              <button
                key={sfx.id}
                type="button"
                onClick={() => triggerDjSoundboard(sfx)}
                className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 border border-white/10 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-all"
              >
                <span>{sfx.emoji}</span>
                <span>{sfx.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Upvotable Song Queue + Live Room Poll Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Upvotable Song Queue */}
          <div className="p-3 rounded-2xl bg-black/45 backdrop-blur border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-white/85 uppercase tracking-wider flex items-center gap-1">
                <Disc3 className="w-3.5 h-3.5 text-accent-primary" /> Up Next Queue ({queue.length})
              </p>
              <div className="flex items-center gap-1.5">
                {isHost && (
                  <button
                    onClick={toggleOpenDj}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80"
                  >
                    {room?.openDj ? 'Open DJ: ON' : 'Host Only'}
                  </button>
                )}
                {canSpin && queue.length > 0 && (
                  <button
                    onClick={playNextFromQueue}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-primary text-[#0B0B0B] text-[10px] font-bold"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" /> Play Next
                  </button>
                )}
              </div>
            </div>

            {queue.length === 0 ? (
              <p className="text-[11px] text-white/50 py-2">
                Queue is empty. Tap &quot;Spin / Queue&quot; to add tracks &amp; vote!
              </p>
            ) : (
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {queue.map((q, idx) => (
                  <div
                    key={`${q.id}-${idx}`}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate text-[11px]">
                        {idx + 1}. {q.title}
                      </p>
                      <p className="text-[10px] text-white/60 truncate">
                        {q.artistName} · by {q.addedBy}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => upvoteQueueItem(idx)}
                        className="px-2 py-0.5 rounded-full bg-accent-primary/15 border border-accent-primary/30 text-accent-primary text-[10px] font-bold flex items-center gap-1"
                        title="Upvote song to move up queue"
                      >
                        <ThumbsUp className="w-2.5 h-2.5" /> {q.upvotes || 1}
                      </button>
                      {(isHost || q.addedBy === user?.displayName) && (
                        <button
                          onClick={() => removeFromQueue(idx)}
                          className="p-1 text-white/50 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Room Poll / Track Battle Widget */}
          <div className="p-3 rounded-2xl bg-black/45 backdrop-blur border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-white/85 uppercase tracking-wider flex items-center gap-1">
                <BarChart2 className="w-3.5 h-3.5 text-accent-secondary" /> Live Room Poll
              </p>
              <button
                onClick={() => setShowPollModal((v) => !v)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-accent-primary font-semibold"
              >
                + New Poll
              </button>
            </div>
            {room?.poll ? (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-white leading-snug">
                  {room.poll.question}
                </p>
                {(room.poll.options || []).map((opt) => {
                  const optPct = Math.round(((opt.votes || 0) / totalPollVotes) * 100)
                  const voted = room.poll.voters?.[user?.id] === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => votePollOption(opt.id)}
                      className={`w-full relative overflow-hidden p-2 rounded-xl border text-left transition-all ${
                        voted
                          ? 'border-accent-primary bg-accent-primary/15'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-accent-primary/20 pointer-events-none transition-all duration-300"
                        style={{ width: `${optPct}%` }}
                      />
                      <div className="relative flex items-center justify-between text-[11px] font-semibold">
                        <span className="truncate">{opt.text}</span>
                        <span className="font-mono text-[10px] text-accent-primary">
                          {optPct}% ({opt.votes || 0})
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-[11px] text-white/50 py-2">
                Start a live poll to ask the room what to spin next!
              </p>
            )}
          </div>
        </div>

        {/* New Poll Modal */}
        {showPollModal && (
          <form
            onSubmit={createNewPoll}
            className="p-3.5 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/15 space-y-2"
          >
            <p className="text-xs font-bold">Launch a Live Room Poll</p>
            <input
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Question (e.g., Next genre: Bollywood vs Electronic?)"
              className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={pollOpt1}
                onChange={(e) => setPollOpt1(e.target.value)}
                placeholder="Option 1"
                className="px-3 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs"
              />
              <input
                value={pollOpt2}
                onChange={(e) => setPollOpt2(e.target.value)}
                placeholder="Option 2"
                className="px-3 py-2 rounded-xl bg-bg-primary border border-white/10 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPollModal(false)}
                className="px-3 py-1.5 rounded-full bg-white/10 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-full bg-accent-primary text-[#0B0B0B] text-xs font-bold"
              >
                Publish Poll
              </button>
            </div>
          </form>
        )}

        {/* Theme Picker Drawer (Host) */}
        {pickingTheme && isHost && (
          <div className="p-3 rounded-2xl bg-black/80 backdrop-blur border border-white/15">
            <p className="text-xs font-semibold mb-2">Change Room Stage Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {ROOM_BACKGROUNDS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => changeRoomTheme(b.id)}
                  style={roomBgStyle(b.id)}
                  className={`h-11 rounded-xl text-[11px] font-semibold border ${
                    room?.bgTheme === b.id ? 'border-accent-primary' : 'border-white/10'
                  }`}
                >
                  <span className="px-2 py-0.5 rounded bg-black/50 backdrop-blur">{b.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Track Picker Drawer */}
        {pickingTrack && (
          <div className="max-h-56 overflow-y-auto p-3 rounded-2xl bg-black/85 backdrop-blur border border-white/15 space-y-1.5">
            <p className="text-xs font-semibold text-text-secondary mb-1">
              Choose a song to spin or add to the room queue
            </p>
            {allTracks.map((t) => {
              const tTheme = getSongTheme(t)
              return (
                <div
                  key={t.id}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold truncate">{t.title}</span>
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[9px] font-mono"
                        style={{
                          color: tTheme.primaryColor,
                          backgroundColor: `${tTheme.primaryColor}20`,
                        }}
                      >
                        {tTheme.name}
                      </span>
                    </div>
                    <span className="text-text-secondary text-[11px] block truncate">
                      {t.artistName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canSpin && (
                      <button
                        onClick={() => spinTrack(t)}
                        className="px-2.5 py-1 rounded-full bg-accent-primary text-[#0B0B0B] text-[11px] font-bold"
                      >
                        Spin Now
                      </button>
                    )}
                    <button
                      onClick={() => addToRoomQueue(t)}
                      className="px-2.5 py-1 rounded-full bg-white/10 text-white text-[11px] font-semibold"
                    >
                      + Queue
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Speakers & Listeners Voice Stage */}
        <div className="p-3 rounded-2xl bg-black/35 backdrop-blur border border-white/10 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-white/80 flex items-center gap-1.5 uppercase tracking-wider">
                <Crown className="w-3.5 h-3.5 text-amber-400" /> Stage Speakers
              </p>
              {isHost && raisedHandIds.length > 0 && (
                <span className="text-[11px] text-amber-300 font-semibold">
                  {raisedHandIds.length} hand{raisedHandIds.length > 1 ? 's' : ''} raised
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {peers
                .filter((p) => p.userId === room?.hostId || speakerIds.includes(p.userId))
                .map((p, idx) => {
                  const speaking = activeSpeakers.has(p.userId)
                  const pIsHost = p.userId === room?.hostId
                  return (
                    <div
                      key={p.userId || idx}
                      onClick={() => {
                        if (isHost && !pIsHost) revokeSpeaker(p.userId)
                      }}
                      className="flex flex-col items-center shrink-0 w-16 cursor-pointer"
                    >
                      <div
                        className={`relative w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold text-black transition-all ${
                          speaking ? 'ring-4 ring-accent-primary scale-105' : 'ring-2 ring-white/20'
                        }`}
                        style={{ background: fallbackCover(p.name || 'S') }}
                      >
                        {p.avatar ? (
                          <img
                            src={p.avatar}
                            alt={p.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          (p.name || 'S')[0]
                        )}
                        {pIsHost && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center">
                            <Crown className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-white/90 truncate w-full text-center mt-1">
                        {p.name || 'Speaker'}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>

          {peers.some((p) => p.userId !== room?.hostId && !speakerIds.includes(p.userId)) && (
            <div>
              <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Users className="w-3 h-3" /> Listeners
              </p>
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {peers
                  .filter((p) => p.userId !== room?.hostId && !speakerIds.includes(p.userId))
                  .map((p, idx) => {
                    const handUp = raisedHandIds.includes(p.userId)
                    return (
                      <div
                        key={p.userId || idx}
                        onClick={() => {
                          if (isHost && handUp) approveSpeaker(p.userId)
                        }}
                        className="flex flex-col items-center shrink-0 w-14 cursor-pointer"
                      >
                        <div
                          className={`relative w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-black ${
                            handUp ? 'ring-2 ring-amber-400' : ''
                          }`}
                          style={{ background: fallbackCover(p.name || 'L') }}
                        >
                          {p.avatar ? (
                            <img
                              src={p.avatar}
                              alt={p.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            (p.name || 'L')[0]
                          )}
                          {handUp && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center text-[10px]">
                              ✋
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-white/75 truncate w-full text-center mt-1">
                          {p.name || 'Listener'}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Chat Stream */}
      <div className="my-3 flex-1 max-h-52 overflow-y-auto space-y-2 px-1 relative z-10">
        {sortedMessages.length === 0 ? (
          <p className="text-xs text-white/60 text-center py-6">
            Say hi, request a song, or hit a DJ Soundboard pad!
          </p>
        ) : (
          sortedMessages.map((m) => (
            <div
              key={m.id}
              className="px-3 py-1.5 rounded-2xl bg-black/45 backdrop-blur border border-white/10 text-xs inline-block max-w-full mr-2"
            >
              <span className="font-semibold text-accent-primary mr-1.5">{m.senderName}:</span>
              <span className="text-white/95">{m.text}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Bottom Controls: Emoji Bar + Mic/Hand + Chat Input */}
      <div className="space-y-2.5 relative z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-black/45 backdrop-blur px-2.5 py-1.5 rounded-full border border-white/10 overflow-x-auto">
            <Smile className="w-3.5 h-3.5 text-white/70 mr-1 shrink-0" />
            {REACTIONS.map((em) => (
              <button
                key={em}
                onClick={() => sendEmoji(em)}
                className="text-base hover:scale-125 transition-transform px-1"
              >
                {em}
              </button>
            ))}
          </div>

          {isSpeaker ? (
            !joined ? (
              <button
                onClick={joinVoice}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent-primary text-[#0B0B0B] text-xs font-bold shadow-lg shrink-0"
              >
                <Mic className="w-3.5 h-3.5" /> Join Mic
              </button>
            ) : (
              <button
                onClick={toggleMute}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold shrink-0 ${
                  muted ? 'bg-white/15 text-white' : 'bg-accent-secondary text-white'
                }`}
              >
                {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                {muted ? 'Muted' : 'On Air'}
              </button>
            )
          ) : (
            <button
              onClick={toggleRaiseHand}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold shrink-0 ${
                hasRaisedHand
                  ? 'bg-amber-400 text-black'
                  : 'bg-black/45 border border-white/15 text-white'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              {hasRaisedHand ? 'Hand Raised ✋' : 'Request Mic'}
            </button>
          )}
        </div>

        <form onSubmit={sendChat} className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Chat with the Listen Room..."
            className="flex-1 px-4 py-2.5 rounded-full bg-black/50 backdrop-blur border border-white/15 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-accent-primary"
          />
          <button
            type="submit"
            aria-label="Send chat"
            className="w-10 h-10 rounded-full bg-accent-primary text-[#0B0B0B] flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {qrOpen && (
        <QRCard
          title={room?.name || 'Listen Room'}
          subtitle={`Live Listen Room · mileymusic.space`}
          url={shareRoomUrl}
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  )
}
