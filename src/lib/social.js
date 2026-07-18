/**
 * MiLey Platform - Social Module
 * Real Supabase implementation for follows, messaging, social features
 */

import { supabase } from './supabaseClient'
import { auth } from './auth'
import { db } from './db'

// Search users by query
export async function searchUsers(query) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name as displayName, avatar_url as avatarUrl, custom_username as username')
      .or(`display_name.ilike.%${query}%,custom_username.ilike.%${query}%`)
      .limit(20)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('User search error:', error)
    return []
  }
}

// Get user profile by ID
export async function getUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Get profile error:', error)
    return null
  }
}

// Follow a user
export async function followUser(targetId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { data, error } = await supabase
      .from('follows')
      .insert({
        follower_id: user.id,
        target_id: targetId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Follow error:', error)
    throw error
  }
}

// Unfollow a user
export async function unfollowUser(targetId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('target_id', targetId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Unfollow error:', error)
    throw error
  }
}

// Check if following
export async function isFollowing(followerId, targetId) {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('target_id', targetId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return !!data
  } catch (error) {
    console.error('Is following error:', error)
    return false
  }
}

// Get followers count
export async function getFollowersCount(userId) {
  try {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('target_id', userId)

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Followers count error:', error)
    return 0
  }
}

// Get following count
export async function getFollowingCount(userId) {
  try {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Following count error:', error)
    return 0
  }
}

// Send direct message
export async function sendMessage(channelId, text, options = {}) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        sender_id: user.id,
        text: text,
        type: options.type || 'text',
        reply_to: options.replyTo || null,
        edited: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    
    // Update last message in channel
    await supabase
      .from('channels')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_text: text,
      })
      .eq('id', channelId)

    return data
  } catch (error) {
    console.error('Send message error:', error)
    throw error
  }
}

// Get messages for a channel
export async function getMessages(channelId, options = {}) {
  const { limit = 50, before = null } = options

  try {
    let query = supabase
      .from('messages')
      .select('*, sender:sender_id(id, display_name, avatar_url)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Get messages error:', error)
    return []
  }
}

// Mark message as read
export async function markMessageRead(messageId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { error } = await supabase
      .from('message_reads')
      .upsert({
        message_id: messageId,
        user_id: user.id,
        read_at: new Date().toISOString(),
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Mark read error:', error)
    throw error
  }
}

// Get unread message count for a channel
export async function getUnreadCount(channelId) {
  const user = auth.getCurrentUser()
  if (!user) return 0

  try {
    // Get last read timestamp
    const { data: lastRead } = await supabase
      .from('message_reads')
      .select('read_at')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .order('read_at', { ascending: false })
      .single()

    // Count messages after last read
    let query = supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .neq('sender_id', user.id)

    if (lastRead?.read_at) {
      query = query.gt('created_at', lastRead.read_at)
    }

    const { count, error } = await query

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Unread count error:', error)
    return 0
  }
}

// Create or get DM channel between two users
export async function getOrCreateDMChannel(otherUserId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    // Check if channel exists
    const { data: existing } = await supabase
      .from('channels')
      .select('*')
      .eq('type', 'dm')
      .contains('member_ids', [user.id])
      .contains('member_ids', [otherUserId])
      .single()

    if (existing) return existing

    // Create new channel
    const { data, error } = await supabase
      .from('channels')
      .insert({
        type: 'dm',
        member_ids: [user.id, otherUserId],
        created_by: user.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Get/create DM channel error:', error)
    throw error
  }
}

// Get user's channels
export async function getUserChannels() {
  const user = auth.getCurrentUser()
  if (!user) return []

  try {
    const { data, error } = await supabase
      .from('channels')
      .select('*, members:user_channels(user_id, joined_at)')
      .contains('member_ids', [user.id])
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Get channels error:', error)
    return []
  }
}

// Join a channel
export async function joinChannel(channelId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { data, error } = await supabase
      .from('user_channels')
      .insert({
        channel_id: channelId,
        user_id: user.id,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Join channel error:', error)
    throw error
  }
}

// Leave a channel
export async function leaveChannel(channelId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { error } = await supabase
      .from('user_channels')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', user.id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Leave channel error:', error)
    throw error
  }
}

// Block a user
export async function blockUser(blockedId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { data, error } = await supabase
      .from('blocks')
      .insert({
        blocker_id: user.id,
        blocked_id: blockedId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Block user error:', error)
    throw error
  }
}

// Unblock a user
export async function unblockUser(blockedId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blockedId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Unblock user error:', error)
    throw error
  }
}

// Get blocked users
export async function getBlockedUsers() {
  const user = auth.getCurrentUser()
  if (!user) return []

  try {
    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_id, blocked:blocked_id(id, display_name, avatar_url)')
      .eq('blocker_id', user.id)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Get blocked users error:', error)
    return []
  }
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
  getUserChannels,
  joinChannel,
  leaveChannel,
  blockUser,
  unblockUser,
  getBlockedUsers,
}

export default social
