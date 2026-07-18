import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { messaging } from '../lib/messaging'
import { storage } from '../lib/storage'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { useLiveShared } from '../lib/useLive'
import { usePlayer } from '../context/PlayerContext'
import { useTyping } from '../hooks/usePresence'
import { notify, markChannelNotificationsRead } from '../hooks/useNotifications'
import { encryptText, decryptText } from '../chatCrypto'
import {
  setMessageState, toggleReaction, togglePin, markChannelRead,
  blockUser, setChatPrefs,
} from '../chatHelpers'
import { Cover } from '../components/TrackViews'
import { timeAgo } from '../musicHelpers'
import { CHAT_THEMES, getChatTheme, setChatTheme, themeStyle } from '../chatThemes'
import {
  BackIcon, SendIcon, MicIcon, CoverIcon, MoreIcon, ReplyIcon, ForwardIcon, CopyIcon,
  PinIcon, TrashIcon, EditIcon, CloseIcon, CheckIcon, PlayIcon, LockIcon, MuteIcon,
  ArchiveIcon, BlockIcon, FlagIcon, PlusIcon, ThemeIcon, CoverIcon as ImageGlyph,
} from '../components/icons'

const REACTIONS = ['❤️', '😂', '🔥', '👍', '😮', '😢']
const SHARE_MARK = 'MILEYSHARE::'

export default function ChatRoom() {
  const { id: channelId } = useParams()
  const navigate = useNavigate()
  const me = auth.getCurrentUser()
  const [channel, setChannel] = useState(null)
  const [messagesList, setMessagesList] = useState([])
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [actionMsg, setActionMsg] = useState(null)
  const [showShare, setShowShare] = useState(false)
  const [showForward, setShowForward] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const [recording, setRecording] = useState(false)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showTheme, setShowTheme] = useState(false)
  const [theme, setThemeState] = useState(() => getChatTheme(channelId))
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const mediaRecRef = useRef(null)
  const chunksRef = useRef([])
  const { typingUsers, setTyping } = useTyping(channelId)

  const { data: states } = useLiveShared('message_state', { filters: { channelId }, limit: 500 })
  const { data: reactions } = useLiveShared('message_reactions', { filters: { channelId }, limit: 800 })
  const { data: pins } = useLiveShared('message_pins', { filters: { channelId }, limit: 100 })
  const { data: reads } = useLiveShared('message_reads', { filters: { channelId }, limit: 50 })

  const stateMap = useMemo(() => Object.fromEntries((states || []).map((s) => [s.messageId, s])), [states])
  const reactionMap = useMemo(() => {
    const m = {}
    for (const r of reactions || []) { (m[r.messageId] ||= []).push(r) }
    return m
  }, [reactions])
  const pinnedIds = useMemo(() => new Set((pins || []).map((p) => p.messageId)), [pins])
  const otherReads = useMemo(() => (reads || []).filter((r) => r.userId !== me?.id), [reads, me])

  const loadChannel = async () => {
    const chs = await messaging.getChannels().catch(() => [])
    setChannel(chs.find((c) => c.id === channelId) || null)
  }

  const loadMessages = async () => {
    const msgs = await messaging.getMessages(channelId, { limit: 60 }).catch(() => [])
    const decrypted = await Promise.all(msgs.map(async (m) => ({ ...m, content: await decryptText(channelId, m.content) })))
    setMessagesList(decrypted)
  }

  useEffect(() => {
    loadChannel()
    loadMessages()
    markChannelRead(channelId)
    markChannelNotificationsRead(channelId)
    const sub = messaging.onMessage(channelId, async (msg) => {
      const decryptedContent = await decryptText(channelId, msg.content)
      setMessagesList((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, { ...msg, content: decryptedContent }]))
      markChannelRead(channelId)
      markChannelNotificationsRead(channelId)
    })

    // The realtime socket can go quiet (phone locked, tab backgrounded, brief
    // network drop) and miss an INSERT event entirely. Rather than leaving the
    // thread stuck until the user leaves and re-opens it, silently reconcile
    // with the server the moment the tab/network comes back — event-driven,
    // never a polling timer.
    const resync = () => { if (document.visibilityState !== 'hidden') loadMessages() }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)
    window.addEventListener('focus', resync)

    return () => {
      sub.unsubscribe()
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      window.removeEventListener('focus', resync)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messagesList.length])

  const isDM = channel?.type === 'direct'
  const title = channel ? (isDM ? channel.otherUser?.displayName : channel.name) : '…'

  const send = async (payload) => {
    const meta = replyTo ? { replyToId: replyTo.id, replyPreview: (replyTo.content || '').slice(0, 80) } : {}
    let toSend = { ...payload }
    if (toSend.text) toSend.text = await encryptText(channelId, toSend.text)
    const msg = await messaging.send(channelId, toSend)
    // Show the sender their own message the instant the write confirms —
    // don't wait on the realtime echo (which can lag or, on a briefly dropped
    // socket, never arrive at all until a resync). The onMessage listener
    // already de-dupes by id, so this is always safe.
    setMessagesList((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, { ...msg, content: payload.text || msg.content }]))
    if (Object.keys(meta).length) await setMessageState({ ...msg, senderId: me.id }, meta)
    if (isDM && channel?.otherUser?.id) {
      notify(channel.otherUser.id, { type: 'message', title: me.displayName || 'New message', body: payload.text ? payload.text.slice(0, 60) : 'Sent you a message', url: `/chat/${channelId}`, meta: { channelId } })
    } else if (!isDM && Array.isArray(channel?.members)) {
      channel.members.filter((mid) => mid !== me.id).forEach((mid) => {
        notify(mid, { type: 'message', title: `${me.displayName || 'Someone'} in ${channel.name || 'group'}`, body: payload.text ? payload.text.slice(0, 60) : 'Sent a message', url: `/chat/${channelId}`, meta: { channelId } })
      })
    }
    setReplyTo(null)
  }

  const handleSendText = async () => {
    const val = text.trim()
    if (!val) return
    setText('')
    setTyping(false)
    await send({ text: val })
  }

  const handleImage = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const { url } = await storage.upload(f, f.name)
    await send({ image: url })
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => chunksRef.current.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        const { url } = await storage.upload(file, file.name)
        await send({ audio: url, duration: 0 })
      }
      mediaRecRef.current = rec
      rec.start()
      setRecording(true)
    } catch (e) { /* mic denied */ }
  }
  const stopRecording = () => {
    mediaRecRef.current?.stop()
    setRecording(false)
  }

  const shareItem = async (item, kind) => {
    const payload = SHARE_MARK + JSON.stringify({ kind, id: item.id, title: item.title, artistName: item.artistName, coverUrl: item.coverUrl, audioUrl: item.audioUrl })
    await send({ text: payload })
    setShowShare(false)
  }

  const forwardMessage = async (targetChannelId) => {
    const m = showForward
    if (m.type === 'text') {
      const enc = await encryptText(targetChannelId, m.content)
      await messaging.send(targetChannelId, { text: enc })
    } else if (m.type === 'image') await messaging.send(targetChannelId, { image: m.metadata?.imageUrl })
    else if (m.type === 'audio') await messaging.send(targetChannelId, { audio: m.metadata?.audioUrl, duration: m.metadata?.duration })
    setShowForward(null)
  }

  const filteredMessages = useMemo(() => {
    if (!search.trim()) return messagesList
    return messagesList.filter((m) => (m.content || '').toLowerCase().includes(search.toLowerCase()))
  }, [messagesList, search])

  const pinnedMessages = useMemo(() => messagesList.filter((m) => pinnedIds.has(m.id)), [messagesList, pinnedIds])

  if (!channelId) return null

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      <div className="shrink-0 flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 border-b border-white/5">
        <button onClick={() => navigate('/messages')} className="text-white/70"><BackIcon size={22} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{title || 'Chat'}</p>
          <p className="text-[11px] text-white/40 flex items-center gap-1">
            <LockIcon size={10} /> Encrypted {typingUsers.length > 0 ? '· typing…' : ''}
          </p>
        </div>
        <button onClick={() => setShowSearch((s) => !s)} className="p-2 text-white/50"><SearchGlyph /></button>
        <button onClick={() => setShowInfo(true)} className="p-2 text-white/50"><MoreIcon size={18} /></button>
      </div>

      {showSearch && (
        <div className="shrink-0 px-4 py-2 border-b border-white/5">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search in conversation…" className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none" />
        </div>
      )}

      {pinnedMessages.length > 0 && !showSearch && (
        <div className="shrink-0 px-4 py-2 border-b border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar overscroll-x-contain">
          <PinIcon size={13} className="text-white/40 shrink-0" />
          {pinnedMessages.map((m) => <span key={m.id} className="text-xs text-white/50 truncate shrink-0 max-w-[10rem]">{m.content}</span>)}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 py-4 space-y-2" style={themeStyle(theme)}>
        {filteredMessages.map((m) => (
          <MessageBubble
            key={m.id} msg={m} isMe={m.senderId === me?.id} state={stateMap[m.id]}
            reactions={reactionMap[m.id] || []} pinned={pinnedIds.has(m.id)}
            onOpenMenu={() => setActionMsg(m)}
            seen={isDM && otherReads.some((r) => new Date(r.lastReadAt) >= new Date(m.createdAt))}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="shrink-0 px-4 py-2 border-t border-white/5 flex items-center justify-between bg-white/5">
          <div className="min-w-0"><p className="text-[11px] text-white/40">Replying to</p><p className="text-xs text-white truncate">{replyTo.content}</p></div>
          <button onClick={() => setReplyTo(null)} className="text-white/40 shrink-0"><CloseIcon size={14} /></button>
        </div>
      )}

      <div className="shrink-0 flex items-center gap-2 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.6rem)] pt-2 border-t border-white/5">
        <button onClick={() => fileRef.current?.click()} className="p-2.5 text-white/50 shrink-0"><CoverIcon size={19} /></button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        <button onClick={() => setShowShare(true)} className="p-2.5 text-white/50 shrink-0"><PlusIcon size={19} /></button>
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setTyping(!!e.target.value) }}
          onBlur={() => setTyping(false)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSendText() }}
          placeholder="Message…"
          className="flex-1 min-w-0 bg-white/5 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none"
        />
        {text.trim() ? (
          <button onClick={handleSendText} className="w-11 h-11 rounded-full btn-brand flex items-center justify-center shrink-0"><SendIcon size={17} color="#0B0B0B" /></button>
        ) : (
          <button
            onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${recording ? 'bg-red-500' : 'btn-brand'}`}
          >
            <MicIcon size={18} color={recording ? '#fff' : '#0B0B0B'} />
          </button>
        )}
      </div>

      {actionMsg && (
        <MessageActionSheet
          msg={actionMsg} isMe={actionMsg.senderId === me?.id} pinned={pinnedIds.has(actionMsg.id)}
          onClose={() => setActionMsg(null)}
          onReply={() => { setReplyTo(actionMsg); setActionMsg(null) }}
          onForward={() => { setShowForward(actionMsg); setActionMsg(null) }}
          onCopy={() => { navigator.clipboard?.writeText(actionMsg.content || ''); setActionMsg(null) }}
          onPin={() => { togglePin(actionMsg, pinnedIds.has(actionMsg.id)); setActionMsg(null) }}
          onEdit={async (newText) => { const enc = await encryptText(channelId, newText); await setMessageState(actionMsg, { edited: true, editedText: enc }); setActionMsg(null); loadMessages() }}
          onDelete={() => { setMessageState(actionMsg, { deleted: true }); setActionMsg(null); loadMessages() }}
          onReact={(emoji) => { toggleReaction(actionMsg, emoji); setActionMsg(null) }}
        />
      )}

      {showTheme && (
        <ChatThemeSheet
          current={theme}
          onClose={() => setShowTheme(false)}
          onPick={(t) => { setChatTheme(channelId, t); setThemeState(t) }}
        />
      )}
      {showShare && <ShareSheet onClose={() => setShowShare(false)} onShare={shareItem} />}
      {showForward && <ForwardSheet onClose={() => setShowForward(null)} onForward={forwardMessage} />}
      {showInfo && (
        <ChatInfoSheet
          channel={channel} onClose={() => setShowInfo(false)}
          onTheme={() => { setShowInfo(false); setShowTheme(true) }}
          onMute={() => setChatPrefs(channelId, { muted: true })}
          onArchive={() => setChatPrefs(channelId, { archived: true })}
          onBlock={() => { if (channel?.otherUser?.id) blockUser(channel.otherUser.id) }}
          onReport={async () => {
            await db.insertShared('reports', { type: 'chat', channelId, reporterId: me.id, targetUserId: channel?.otherUser?.id || null }, undefined, { visibleTo: 'creator-and-admin' })
          }}
        />
      )}
    </div>
  )
}

function ChatThemeSheet({ current, onClose, onPick }) {
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const uploadCustom = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try {
      const { url } = await storage.upload(f, f.name)
      onPick({ id: 'custom', name: 'Custom', imageUrl: url, dark: true })
    } catch (err) { /* ignore */ }
    setBusy(false)
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#141414] rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white">Chat Theme</h3>
          <button onClick={onClose}><CloseIcon size={18} className="text-white/50" /></button>
        </div>
        <p className="text-[11px] text-white/40 mb-3">Only you see this background.</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadCustom} />
        <div className="grid grid-cols-3 gap-2.5">
          <button onClick={() => fileRef.current?.click()} className={`aspect-[3/4] rounded-2xl flex flex-col items-center justify-center gap-1 border-2 ${current?.id === 'custom' ? 'border-[rgb(var(--color-primary))]' : 'border-white/10'} bg-white/5`}>
            <ImageGlyph size={20} className="text-white/60" />
            <span className="text-[10px] text-white/60">{busy ? '…' : 'Custom'}</span>
          </button>
          {CHAT_THEMES.map((t) => (
            <button key={t.id} onClick={() => onPick(t)} className={`aspect-[3/4] rounded-2xl relative overflow-hidden border-2 ${current?.id === t.id ? 'border-[rgb(var(--color-primary))]' : 'border-white/10'}`} style={{ background: t.bg }}>
              <span className={`absolute bottom-1.5 left-0 right-0 text-center text-[10px] font-medium ${t.dark ? 'text-white/80' : 'text-black/70'}`}>{t.name}</span>
              {current?.id === t.id && <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full btn-brand flex items-center justify-center"><CheckIcon size={10} color="#0B0B0B" /></span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SearchGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.3-4.3" />
    </svg>
  )
}

function MessageBubble({ msg, isMe, state, reactions, pinned, onOpenMenu, seen }) {
  const { playTrack } = usePlayer()
  const deleted = state?.deleted
  const content = deleted ? 'This message was deleted' : (state?.editedText ? null : msg.content)
  const [decryptedEdit, setDecryptedEdit] = useState(null)

  useEffect(() => {
    if (state?.editedText) decryptText(msg.channelId, state.editedText).then(setDecryptedEdit)
  }, [state?.editedText, msg.channelId])

  let shareData = null
  const raw = deleted ? null : (decryptedEdit || content)
  if (raw && raw.startsWith(SHARE_MARK)) {
    try { shareData = JSON.parse(raw.slice(SHARE_MARK.length)) } catch (e) { shareData = null }
  }

  const grouped = useMemo(() => {
    const m = {}
    for (const r of reactions) { (m[r.emoji] ||= 0); m[r.emoji]++ }
    return m
  }, [reactions])

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        <button onClick={() => !deleted && onOpenMenu()} className={`rounded-2xl px-3.5 py-2.5 text-left ${isMe ? 'btn-brand text-black' : 'card-surface text-white'} ${deleted ? 'opacity-50 italic' : ''} ${pinned ? 'ring-1 ring-white/30' : ''}`}>
          {msg.type === 'image' && !deleted ? (
            <img src={msg.metadata?.imageUrl} className="rounded-xl max-w-[14rem] max-h-56 object-cover" />
          ) : msg.type === 'audio' && !deleted ? (
            <audio controls src={msg.metadata?.audioUrl} className="max-w-[14rem]" />
          ) : shareData ? (
            <div onClick={(e) => { e.stopPropagation(); if (shareData.audioUrl) playTrack(shareData, [shareData]) }} className={`flex items-center gap-2 ${isMe ? '' : 'card-surface'} rounded-xl p-1.5 -m-1.5 cursor-pointer`}>
              <Cover track={shareData} size={40} />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{shareData.kind === 'playlist' ? '🎵 Playlist' : '🎵 Track'}</p>
                <p className="text-xs truncate opacity-80">{shareData.title}</p>
              </div>
              {shareData.audioUrl && <PlayIcon size={16} />}
            </div>
          ) : (
            <p className="text-sm whitespace-pre-line break-words">{decryptedEdit || content}</p>
          )}
        </button>
        <div className="flex items-center gap-1.5 mt-1 px-1">
          {Object.entries(grouped).map(([e, n]) => <span key={e} className="text-[11px]">{e}{n > 1 ? n : ''}</span>)}
          <span className="text-[10px] text-white/25">{timeAgo(msg.createdAt)}</span>
          {state?.editedText && <span className="text-[10px] text-white/25">· edited</span>}
          {isMe && <span className="text-[10px] text-white/25">{seen ? '· Seen' : '· Sent'}</span>}
        </div>
      </div>
    </div>
  )
}

function MessageActionSheet({ msg, isMe, pinned, onClose, onReply, onForward, onCopy, onPin, onEdit, onDelete, onReact }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(msg.content || '')
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#141414] rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up">
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-4" />
        {editing ? (
          <div>
            <textarea value={val} onChange={(e) => setVal(e.target.value)} rows={3} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none mb-3 resize-none" />
            <button onClick={() => onEdit(val)} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm">Save Edit</button>
          </div>
        ) : (
          <>
            <div className="flex justify-center gap-3 mb-4">
              {REACTIONS.map((e) => <button key={e} onClick={() => onReact(e)} className="text-2xl active:scale-90 transition-transform">{e}</button>)}
            </div>
            <div className="space-y-1">
              <ActionBtn icon={<ReplyIcon size={17} />} label="Reply" onClick={onReply} />
              <ActionBtn icon={<ForwardIcon size={17} />} label="Forward" onClick={onForward} />
              <ActionBtn icon={<CopyIcon size={17} />} label="Copy" onClick={onCopy} />
              <ActionBtn icon={<PinIcon size={17} />} label={pinned ? 'Unpin' : 'Pin'} onClick={onPin} />
              {isMe && <ActionBtn icon={<EditIcon size={17} />} label="Edit" onClick={() => setEditing(true)} />}
              {isMe && <ActionBtn icon={<TrashIcon size={17} />} label="Delete" onClick={onDelete} danger />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ActionBtn({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 ${danger ? 'text-red-400' : 'text-white'}`}>
      {icon}<span className="text-sm font-medium">{label}</span>
    </button>
  )
}

function ShareSheet({ onClose, onShare }) {
  const { data: tracks } = useLiveShared('tracks', { order: '-createdAt', limit: 60 })
  const { data: playlists } = useLiveShared('playlists', { order: '-createdAt', limit: 40 })
  const [tab, setTab] = useState('tracks')
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#141414] rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-display font-bold text-white">Share</h3><button onClick={onClose}><CloseIcon size={18} className="text-white/50" /></button></div>
        <div className="flex gap-2 mb-3">
          {['tracks', 'playlists'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize ${tab === t ? 'btn-brand text-black' : 'card-surface text-white/60'}`}>{t}</button>)}
        </div>
        <div className="space-y-1">
          {(tab === 'tracks' ? tracks : playlists)?.map((item) => (
            <button key={item.id} onClick={() => onShare(item, tab === 'tracks' ? 'track' : 'playlist')} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 text-left">
              <Cover track={item} size={40} />
              <span className="text-sm text-white truncate">{item.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ForwardSheet({ onClose, onForward }) {
  const [channels, setChannels] = useState([])
  useEffect(() => { messaging.getChannels().then(setChannels).catch(() => {}) }, [])
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#141414] rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <h3 className="font-display font-bold text-white mb-3">Forward to…</h3>
        <div className="space-y-1">
          {channels.map((c) => (
            <button key={c.id} onClick={() => onForward(c.id)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 text-left">
              <span className="text-sm text-white truncate">{c.type === 'direct' ? c.otherUser?.displayName : c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChatInfoSheet({ channel, onClose, onTheme, onMute, onArchive, onBlock, onReport }) {
  const [done, setDone] = useState('')
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#141414] rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up">
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-4" />
        <p className="text-sm font-semibold text-white mb-3 text-center">{channel?.type === 'direct' ? channel.otherUser?.displayName : channel?.name}</p>
        <div className="space-y-1">
          <ActionBtn icon={<ThemeIcon size={17} />} label="Chat theme" onClick={onTheme} />
          <ActionBtn icon={<MuteIcon size={17} />} label="Mute" onClick={() => { onMute(); setDone('Muted') }} />
          <ActionBtn icon={<ArchiveIcon size={17} />} label="Archive" onClick={() => { onArchive(); setDone('Archived'); onClose() }} />
          {channel?.type === 'direct' && <ActionBtn icon={<BlockIcon size={17} />} label="Block user" onClick={() => { onBlock(); setDone('Blocked') }} danger />}
          <ActionBtn icon={<FlagIcon size={17} />} label="Report" onClick={() => { onReport(); setDone('Reported') }} danger />
        </div>
        {done && <p className="text-xs text-center text-white/40 mt-3">{done}</p>}
      </div>
    </div>
  )
}
