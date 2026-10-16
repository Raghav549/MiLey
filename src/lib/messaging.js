/**
 * MiLey Platform - Messaging Module
 * Full DM & Group Chat Messaging Engine
 */

import {
  sendMessage,
  getMessages,
  markMessageRead,
  getUnreadCount,
  getOrCreateDMChannel,
  createGroupChannel,
  getUserChannels,
  joinChannel,
  leaveChannel,
} from './social'
import { db } from './db'
import { realtime } from './realtime'
import { auth } from './auth'

export {
  sendMessage,
  getMessages,
  markMessageRead,
  getUnreadCount,
  getOrCreateDMChannel,
  getUserChannels,
  joinChannel,
  leaveChannel,
}

export async function getChannels() {
  return getUserChannels()
}

export async function createDM(otherUserId) {
  return getOrCreateDMChannel(otherUserId)
}

export async function createGroup(opts) {
  return createGroupChannel(opts)
}

export async function send(channelId, payload) {
  return sendMessage(channelId, payload)
}

export function onMessage(channelId, callback) {
  const unsub = db.subscribeShared('dm_messages', (ev) => {
    if (ev.type === 'INSERT' && ev.data && ev.data.channelId === channelId) {
      callback(ev.data)
    }
  }, { channelId })
  return {
    unsubscribe: () => {
      if (typeof unsub === 'function') unsub()
      else unsub?.unsubscribe?.()
    },
  }
}

export async function sendTypingIndicator(channelId, isTyping = true) {
  const user = auth.getCurrentUser()
  if (!user) return
  await realtime.broadcast(`typing:${channelId}`, {
    userId: user.id,
    isTyping,
    timestamp: Date.now(),
  })
}

export function listenToTyping(channelId, callback) {
  return realtime.listenToBroadcasts(`typing:${channelId}`, callback)
}

export async function markChannelRead(channelId) {
  const user = auth.getCurrentUser()
  if (!user) return false
  const id = `${channelId}_${user.id}`
  await db.upsertShared('message_reads', {
    channelId,
    userId: user.id,
    lastReadAt: new Date().toISOString(),
  }, id)
  return true
}

export async function deleteMessage(messageId) {
  await db.updateShared('dm_messages', messageId, { deleted: true, content: '[Deleted]', text: '[Deleted]' })
  return true
}

export async function editMessage(messageId, newText) {
  return db.updateShared('dm_messages', messageId, {
    content: newText,
    text: newText,
    edited: true,
  })
}

export async function sendMediaMessage(channelId, fileUrl, fileType, options = {}) {
  return sendMessage(channelId, {
    type: fileType,
    content: options.caption || `[${fileType}]`,
    metadata: { [`${fileType}Url`]: fileUrl },
  })
}

export async function getMessageReactions(messageId) {
  return db.selectShared('message_reactions', { messageId })
}

export async function addReaction(messageId, emoji) {
  const user = auth.getCurrentUser()
  if (!user) return null
  const id = `${messageId}_${user.id}_${emoji}`
  return db.upsertShared('message_reactions', { messageId, userId: user.id, emoji }, id)
}

export async function removeReaction(messageId, emoji) {
  const user = auth.getCurrentUser()
  if (!user) return true
  const id = `${messageId}_${user.id}_${emoji}`
  return db.deleteShared('message_reactions', id)
}

export const messaging = {
  getChannels,
  createDM,
  createGroup,
  send,
  onMessage,
  sendMessage,
  getMessages,
  markMessageRead,
  getUnreadCount,
  getOrCreateDMChannel,
  getUserChannels,
  joinChannel,
  leaveChannel,
  sendTypingIndicator,
  listenToTyping,
  markChannelRead,
  deleteMessage,
  editMessage,
  sendMediaMessage,
  getMessageReactions,
  addReaction,
  removeReaction,
}

export default messaging
