/**
 * MiLey Platform - Social & Messaging Core Module
 * Full support for user search, follows, DMs, group chats, and blocking
 */

import { auth } from './auth'
import { db } from './db'

export async function searchUsers(query) {
  const q = (query || '').trim().toLowerCase()
  const profiles = await db.selectShared('profiles', {}, { limit: 300 })
  const filtered = q
    ? profiles.filter(
        (p) =>
          (p.displayName || '').toLowerCase().includes(q) ||
          (p.customUsername || '').toLowerCase().includes(q) ||
          (p.bio || '').toLowerCase().includes(q)
      )
    : profiles
  return filtered.slice(0, 25).map((p) => ({
    id: p.userId || p.id,
    displayName: p.displayName || 'MiLey User',
    avatarUrl: p.avatarUrl || '',
    username: p.customUsername || '',
    verified: !!p.verified,
    artistBadge: p.artistBadge || '',
  }))
}

export async function getUserProfile(userId) {
  if (!userId) return null
  return db.getShared('profiles', userId)
}

export async function followUser(targetId, meta = {}) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')
  const id = `${user.id}:${targetId}`
  const targetProfile = await db.getShared('profiles', targetId)
  const myProfile = await db.getShared('profiles', user.id)

  const record = await db.upsertShared(
    'follows',
    {
      followerId: user.id,
      targetId,
      targetType: meta.targetType || 'artist',
      targetName: meta.targetName || targetProfile?.displayName || 'MiLey User',
      targetAvatar: meta.targetAvatar || targetProfile?.avatarUrl || '',
      targetUsername: meta.targetUsername || targetProfile?.customUsername || '',
      followerName: myProfile?.displayName || user.displayName || 'MiLey User',
      followerAvatar: myProfile?.avatarUrl || user.avatarUrl || '',
    },
    id,
    { visibleTo: 'public' }
  )
  return record
}

export async function unfollowUser(targetId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')
  const id = `${user.id}:${targetId}`
  await db.deleteShared('follows', id)
  return true
}

export async function isFollowing(followerId, targetId) {
  if (!followerId || !targetId) return false
  const rows = await db.selectShared('follows', { followerId, targetId }, { limit: 1 })
  return rows.length > 0
}

export async function getFollowersCount(targetId) {
  return db.countShared('follows', { targetId })
}

export async function getFollowingCount(followerId) {
  return db.countShared('follows', { followerId })
}

// ── DM & Group Chat Channels ──
export async function getOrCreateDMChannel(otherUserId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  const allChannels = await db.selectShared('dm_channels', {}, { limit: 300 })
  const existing = allChannels.find(
    (c) =>
      c.type === 'direct' &&
      Array.isArray(c.members) &&
      c.members.includes(user.id) &&
      c.members.includes(otherUserId)
  )

  const otherProfile = await db.getShared('profiles', otherUserId)
  const otherChannel = (await db.selectShared('channels', { ownerId: otherUserId }, { limit: 1 }))[0]
  const otherUser = {
    id: otherUserId,
    displayName: otherProfile?.displayName || otherChannel?.name || 'MiLey Creator',
    avatarUrl: otherProfile?.avatarUrl || otherChannel?.avatarUrl || '',
  }

  if (existing) {
    return { ...existing, otherUser }
  }

  const pairKey = [user.id, otherUserId].sort().join('__')
  const channelId = `dm_${pairKey}`
  const created = await db.upsertShared(
    'dm_channels',
    {
      id: channelId,
      type: 'direct',
      members: [user.id, otherUserId],
      memberProfiles: {
        [user.id]: {
          id: user.id,
          displayName: user.displayName || 'MiLey Creator',
          avatarUrl: user.avatarUrl || '',
        },
        [otherUserId]: otherUser,
      },
      lastMessage: null,
      lastMessageAt: new Date().toISOString(),
    },
    channelId,
    { visibleTo: 'public' }
  )

  return { ...created, otherUser }
}

export async function createGroupChannel({ name, members = [] }) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')
  const allMembers = [...new Set([user.id, ...members])]
  const channelId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  return db.insertShared(
    'dm_channels',
    {
      id: channelId,
      type: 'group',
      name: name || 'MiLey Group',
      members: allMembers,
      createdBy: user.id,
      lastMessage: null,
      lastMessageAt: new Date().toISOString(),
    },
    channelId,
    { visibleTo: 'public' }
  )
}

export async function getUserChannels() {
  const user = auth.getCurrentUser()
  if (!user) return []
  const all = await db.selectShared('dm_channels', {}, { order: '-lastMessageAt', limit: 200 })
  const profiles = await db.selectShared('profiles', {}, { limit: 300 })
  const profileMap = new Map(profiles.map((p) => [p.userId || p.id, p]))

  const mine = all.filter((c) => Array.isArray(c.members) && c.members.includes(user.id))
  return mine.map((c) => {
    if (c.type === 'direct') {
      const otherId = (c.members || []).find((m) => m !== user.id) || user.id
      const cached = c.memberProfiles?.[otherId]
      const prof = profileMap.get(otherId)
      return {
        ...c,
        otherUser: {
          id: otherId,
          displayName: prof?.displayName || cached?.displayName || 'MiLey Creator',
          avatarUrl: prof?.avatarUrl || cached?.avatarUrl || '',
        },
      }
    }
    return c
  })
}

export async function sendMessage(channelId, payloadOrText, options = {}) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  let type = options.type || 'text'
  let content = ''
  let metadata = {}

  if (typeof payloadOrText === 'string') {
    content = payloadOrText
  } else if (payloadOrText && typeof payloadOrText === 'object') {
    if (payloadOrText.image) {
      type = 'image'
      content = '[Image]'
      metadata = { imageUrl: payloadOrText.image }
    } else if (payloadOrText.audio) {
      type = 'audio'
      content = '[Voice message]'
      metadata = { audioUrl: payloadOrText.audio, duration: payloadOrText.duration || 0 }
    } else {
      type = payloadOrText.type || 'text'
      content = payloadOrText.text || payloadOrText.content || ''
      metadata = payloadOrText.metadata || {}
    }
  }

  const now = new Date().toISOString()
  const msg = await db.insertShared(
    'dm_messages',
    {
      channelId,
      senderId: user.id,
      senderName: user.displayName || 'MiLey Creator',
      content,
      text: content,
      type,
      metadata,
      createdAt: now,
    },
    undefined,
    { visibleTo: 'public' }
  )

  await db.updateShared('dm_channels', channelId, {
    lastMessage: {
      id: msg.id,
      content,
      senderId: user.id,
      createdAt: now,
    },
    lastMessageAt: now,
  }).catch(() => {})

  return msg
}

export async function getMessages(channelId, options = {}) {
  const { limit = 60 } = options
  const rows = await db.selectShared('dm_messages', { channelId }, { order: 'createdAt', limit: limit * 2 })
  return rows.slice(-limit)
}

export async function markMessageRead(messageId) {
  const user = auth.getCurrentUser()
  if (!user) return false
  await db.upsertShared('message_reads', { messageId, userId: user.id, lastReadAt: new Date().toISOString() }, `${messageId}_${user.id}`)
  return true
}

export async function getUnreadCount(channelId) {
  const user = auth.getCurrentUser()
  if (!user) return 0
  const notifs = await db.selectShared('notifications', { recipientId: user.id, type: 'message' }, { limit: 100 })
  return notifs.filter((n) => !n.read && n.meta?.channelId === channelId).length
}

export async function joinChannel(channelId) {
  const user = auth.getCurrentUser()
  if (!user) return null
  const ch = await db.getShared('dm_channels', channelId)
  if (!ch) return null
  const members = [...new Set([...(ch.members || []), user.id])]
  return db.updateShared('dm_channels', channelId, { members })
}

export async function leaveChannel(channelId) {
  const user = auth.getCurrentUser()
  if (!user) return true
  const ch = await db.getShared('dm_channels', channelId)
  if (!ch) return true
  const members = (ch.members || []).filter((id) => id !== user.id)
  await db.updateShared('dm_channels', channelId, { members })
  return true
}

export async function blockUser(blockedId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')
  const id = `${user.id}_${blockedId}`
  return db.upsertShared('blocks', { blockerId: user.id, blockedId }, id)
}

export async function unblockUser(blockedId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')
  return db.deleteShared('blocks', `${user.id}_${blockedId}`)
}

export async function getBlockedUsers() {
  const user = auth.getCurrentUser()
  if (!user) return []
  return db.selectShared('blocks', { blockerId: user.id })
}

export const social = {
  searchUsers,
  getUserProfile,
  followUser,
  unfollowUser,
  isFollowing,
  getFollowersCount,
  getFollowingCount,
  sendMessage,
  getMessages,
  markMessageRead,
  getUnreadCount,
  getOrCreateDMChannel,
  createGroupChannel,
  getUserChannels,
  joinChannel,
  leaveChannel,
  blockUser,
  unblockUser,
  getBlockedUsers,
}

export default social
