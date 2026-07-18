/**
 * MiLey Platform - Realtime Module
 * Supabase Realtime for presence, messaging, voice room signalling
 */

import { supabase } from './supabaseClient'
import { auth } from './auth'

// Presence channel management
const presenceChannels = new Map()

// Create a presence channel for online status
export function presence(channelName, userInfo) {
  const user = auth.getCurrentUser()
  if (!user) return createMockPresence()

  const channelId = `presence:${channelName}`
  
  // Check if we already have this channel
  if (presenceChannels.has(channelId)) {
    const existing = presenceChannels.get(channelId)
    existing.updateInfo(userInfo)
    return existing
  }

  // Create new presence channel
  const channel = supabase.channel(channelName, {
    config: {
      presence: {
        key: channelName,
      },
    },
  })

  let onSyncCallback = null
  let onJoinCallback = null
  let onLeaveCallback = null
  let currentUsers = new Map()

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    const users = []
    
    Object.values(state).forEach(presences => {
      presences.forEach(p => {
        if (p.userid) {
          users.push({
            id: p.userid,
            userId: p.userid,
            ...p.state,
          })
        }
      })
    })
    
    currentUsers = new Map(users.map(u => [u.id || u.userId, u]))
    
    if (onSyncCallback) {
      onSyncCallback(users)
    }
  })

  channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
    newPresences.forEach(p => {
      if (onJoinCallback && p.userid) {
        onJoinCallback({
          id: p.userid,
          userId: p.userid,
          ...p.state,
        })
      }
    })
  })

  channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    leftPresences.forEach(p => {
      if (onLeaveCallback && p.userid) {
        onLeaveCallback({
          id: p.userid,
          userId: p.userid,
          ...p.state,
        })
      }
    })
  })

  // Subscribe and track presence
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        userid: user.id,
        ...userInfo,
      })
    }
  })

  const presenceInstance = {
    onSync: (callback) => {
      onSyncCallback = callback
      return presenceInstance
    },
    onJoin: (callback) => {
      onJoinCallback = callback
      return presenceInstance
    },
    onLeave: (callback) => {
      onLeaveCallback = callback
      return presenceInstance
    },
    updateInfo: (newInfo) => {
      channel.track({
        userid: user.id,
        ...newInfo,
      })
    },
    leave: () => {
      channel.unsubscribe()
      presenceChannels.delete(channelId)
    },
  }

  presenceChannels.set(channelId, presenceInstance)
  return presenceInstance
}

// Mock presence for when user is not authenticated
function createMockPresence() {
  return {
    onSync: () => ({ onSync: () => null, onJoin: () => null, onLeave: () => null }),
    onJoin: () => ({ onSync: () => null, onJoin: () => null, onLeave: () => null }),
    onLeave: () => ({ onSync: () => null, onJoin: () => null, onLeave: () => null }),
    updateInfo: () => {},
    leave: () => {},
  }
}

// Subscribe to database changes with realtime
export function subscribeToChanges(table, callback, filters = {}) {
  const user = auth.getCurrentUser()
  if (!user) return () => {}

  const channelName = `db:${table}:${Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(':')}`
  
  const channel = supabase.channel(channelName)

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: table,
      ...filters,
    },
    (payload) => {
      callback({
        type: payload.eventType,
        data: payload.new || payload.old,
        oldData: payload.old,
      })
    }
  )

  channel.subscribe()

  return () => {
    supabase.removeChannel(channelName)
  }
}

// Broadcast message to a channel
export async function broadcast(channelName, message) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  const channel = supabase.channel(channelName)
  
  try {
    await channel.send({
      type: 'broadcast',
      event: 'message',
      payload: {
        ...message,
        senderId: user.id,
        timestamp: Date.now(),
      },
    })
    return true
  } catch (error) {
    console.error('Broadcast error:', error)
    throw error
  }
}

// Listen for broadcast messages
export function listenToBroadcasts(channelName, callback) {
  const channel = supabase.channel(channelName)

  channel.on('broadcast', { event: 'message' }, (payload) => {
    callback(payload.payload)
  })

  channel.subscribe()

  return () => {
    supabase.removeChannel(channelName)
  }
}

// Voice room signalling helpers
export async function sendVoiceSignal(roomId, signal) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { error } = await supabase.from('voice_signals').insert({
      room_id: roomId,
      from_user_id: user.id,
      to_user_id: signal.to,
      signal_type: signal.type,
      signal_data: signal.data,
      created_at: new Date().toISOString(),
    })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Voice signal error:', error)
    throw error
  }
}

export function listenToVoiceSignals(roomId, callback) {
  const user = auth.getCurrentUser()
  if (!user) return () => {}

  return subscribeToChanges('voice_signals', (payload) => {
    if (payload.data.to_user_id === user.id && payload.data.room_id === roomId) {
      callback(payload.data)
    }
  }, { room_id: roomId })
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
