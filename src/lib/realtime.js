/**
 * MiLey Platform - Realtime Module
 * Hybrid Supabase Realtime + Cross-Tab BroadcastChannel Presence & Signalling
 */

import { supabase, isSupabaseConfigured } from './supabaseClient'
import { auth } from './auth'
import { db } from './db'

const presenceChannels = new Map()
const rtBus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('miley_presence_bus_v2') : null
const localPresenceState = new Map() // channelName -> Map<userId, info>

export function presence(channelName, userInfo = {}) {
  const user = auth.getCurrentUser()
  if (!user || !channelName) return createNoopPresence()

  const channelId = `presence:${channelName}`
  let onSyncCallback = null
  let onJoinCallback = null
  let onLeaveCallback = null

  if (!localPresenceState.has(channelName)) {
    localPresenceState.set(channelName, new Map())
  }
  const roomMap = localPresenceState.get(channelName)
  const selfEntry = {
    id: user.id,
    userId: user.id,
    ...userInfo,
    updatedAt: Date.now(),
  }
  roomMap.set(user.id, selfEntry)

  const emitSync = () => {
    if (onSyncCallback) {
      onSyncCallback([...roomMap.values()])
    }
  }

  let busHandler = null
  if (rtBus) {
    busHandler = (ev) => {
      const msg = ev.data || {}
      if (msg.channelName !== channelName) return
      if (msg.type === 'join' || msg.type === 'update') {
        const isNew = !roomMap.has(msg.entry.id)
        roomMap.set(msg.entry.id, msg.entry)
        if (isNew && onJoinCallback) onJoinCallback(msg.entry)
        emitSync()
      } else if (msg.type === 'leave') {
        const left = roomMap.get(msg.userId)
        roomMap.delete(msg.userId)
        if (left && onLeaveCallback) onLeaveCallback(left)
        emitSync()
      }
    }
    rtBus.addEventListener('message', busHandler)
    try { rtBus.postMessage({ channelName, type: 'join', entry: selfEntry }) } catch {}
  }

  let sbChannel = null
  if (isSupabaseConfigured) {
    try {
      sbChannel = supabase.channel(channelName, {
        config: { presence: { key: channelName } },
      })

      sbChannel.on('presence', { event: 'sync' }, () => {
        const state = sbChannel.presenceState()
        Object.values(state).forEach((presences) => {
          presences.forEach((p) => {
            if (p.userid) {
              roomMap.set(p.userid, { id: p.userid, userId: p.userid, ...p })
            }
          })
        })
        emitSync()
      })

      sbChannel.on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p) => {
          if (p.userid) {
            const entry = { id: p.userid, userId: p.userid, ...p }
            roomMap.set(p.userid, entry)
            if (onJoinCallback) onJoinCallback(entry)
          }
        })
        emitSync()
      })

      sbChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p) => {
          if (p.userid) {
            roomMap.delete(p.userid)
            if (onLeaveCallback) onLeaveCallback({ id: p.userid, userId: p.userid, ...p })
          }
        })
        emitSync()
      })

      sbChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await sbChannel.track({ userid: user.id, ...userInfo })
        }
      })
    } catch {}
  }

  // Trigger initial sync asynchronously so callers can register .onSync() first
  setTimeout(emitSync, 10)

  const instance = {
    onSync: (cb) => {
      onSyncCallback = cb
      cb([...roomMap.values()])
      return instance
    },
    onJoin: (cb) => {
      onJoinCallback = cb
      return instance
    },
    onLeave: (cb) => {
      onLeaveCallback = cb
      return instance
    },
    updateInfo: (newInfo) => {
      const updated = { id: user.id, userId: user.id, ...newInfo, updatedAt: Date.now() }
      roomMap.set(user.id, updated)
      emitSync()
      if (rtBus) {
        try { rtBus.postMessage({ channelName, type: 'update', entry: updated }) } catch {}
      }
      if (sbChannel) {
        try { sbChannel.track({ userid: user.id, ...newInfo }) } catch {}
      }
    },
    leave: () => {
      roomMap.delete(user.id)
      if (rtBus && busHandler) {
        try { rtBus.postMessage({ channelName, type: 'leave', userId: user.id }) } catch {}
        rtBus.removeEventListener('message', busHandler)
      }
      if (sbChannel) {
        try { sbChannel.unsubscribe() } catch {}
      }
      presenceChannels.delete(channelId)
    },
  }

  presenceChannels.set(channelId, instance)
  return instance
}

function createNoopPresence() {
  const self = {
    onSync: (cb) => { cb?.([]); return self },
    onJoin: () => self,
    onLeave: () => self,
    updateInfo: () => {},
    leave: () => {},
  }
  return self
}

export function subscribeToChanges(table, callback, filters = {}) {
  return db.subscribe(table, callback, filters)
}

export async function broadcast(channelName, message) {
  const user = auth.getCurrentUser()
  const payload = {
    ...message,
    senderId: user?.id || 'anon',
    timestamp: Date.now(),
  }
  if (rtBus) {
    try { rtBus.postMessage({ channelName, type: 'broadcast', payload }) } catch {}
  }
  if (isSupabaseConfigured) {
    try {
      await supabase.channel(channelName).send({
        type: 'broadcast',
        event: 'message',
        payload,
      })
    } catch {}
  }
  return true
}

export function listenToBroadcasts(channelName, callback) {
  let busHandler = null
  if (rtBus) {
    busHandler = (ev) => {
      const msg = ev.data || {}
      if (msg.channelName === channelName && msg.type === 'broadcast') {
        callback(msg.payload)
      }
    }
    rtBus.addEventListener('message', busHandler)
  }

  let sbChannel = null
  if (isSupabaseConfigured) {
    try {
      sbChannel = supabase.channel(channelName)
      sbChannel.on('broadcast', { event: 'message' }, (p) => callback(p.payload))
      sbChannel.subscribe()
    } catch {}
  }

  return () => {
    if (rtBus && busHandler) rtBus.removeEventListener('message', busHandler)
    if (sbChannel) supabase.removeChannel(sbChannel)
  }
}

export async function sendVoiceSignal(roomId, signal) {
  const user = auth.getCurrentUser()
  if (!user) return false
  await db.insertShared('voice_sig', {
    room: roomId,
    from: user.id,
    to: signal.to,
    kind: signal.type,
    sdp: typeof signal.data === 'string' ? signal.data : JSON.stringify(signal.data),
    t: Date.now(),
  })
  return true
}

export function listenToVoiceSignals(roomId, callback) {
  const user = auth.getCurrentUser()
  if (!user) return () => {}
  return db.subscribeShared('voice_sig', (payload) => {
    const s = payload?.data
    if (s && s.to === user.id && s.room === roomId) {
      callback(s)
    }
  })
}

export const realtime = {
  presence,
  subscribeToChanges,
  broadcast,
  listenToBroadcasts,
  sendVoiceSignal,
  listenToVoiceSignals,
}

export default realtime
