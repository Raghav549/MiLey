/**
 * MiLey Platform - Messaging Module
 * Real Supabase implementation for messaging features
 * This module re-exports from social.js for backwards compatibility
 */

export {
  sendMessage,
  getMessages,
  markMessageRead,
  getUnreadCount,
  getOrCreateDMChannel,
  getUserChannels,
  joinChannel,
  leaveChannel,
} from './social'

// Additional messaging helpers

import { supabase } from './supabaseClient'
import { auth } from './auth'

// Send typing indicator
export async function sendTypingIndicator(channelId, isTyping = true) {
  const user = auth.getCurrentUser()
  if (!user) return

  try {
    await supabase.channel(`typing:${channelId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: user.id,
        isTyping,
        timestamp: Date.now(),
      },
    })
  } catch (error) {
    console.error('Send typing error:', error)
  }
}

// Listen for typing indicators
export function listenToTyping(channelId, callback) {
  const channel = supabase.channel(`typing:${channelId}`)

  channel.on('broadcast', { event: 'typing' }, (payload) => {
    callback(payload.payload)
  })

  channel.subscribe()

  return () => {
    supabase.removeChannel(`typing:${channelId}`)
  }
}

// Mark all messages in channel as read
export async function markChannelRead(channelId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    // Get latest message
    const { data: latestMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (latestMessage) {
      await supabase
        .from('message_reads')
        .upsert({
          message_id: latestMessage.id,
          channel_id: channelId,
          user_id: user.id,
          read_at: new Date().toISOString(),
        })
    }

    return true
  } catch (error) {
    console.error('Mark channel read error:', error)
    throw error
  }
}

// Delete a message (soft delete)
export async function deleteMessage(messageId) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { error } = await supabase
      .from('messages')
      .update({ deleted: true, text: '[Deleted]' })
      .eq('id', messageId)
      .eq('sender_id', user.id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Delete message error:', error)
    throw error
  }
}

// Edit a message
export async function editMessage(messageId, newText) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { data, error } = await supabase
      .from('messages')
      .update({ 
        text: newText, 
        edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .eq('sender_id', user.id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Edit message error:', error)
    throw error
  }
}

// Send media message (image, audio, video)
export async function sendMediaMessage(channelId, fileUrl, fileType, options = {}) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        sender_id: user.id,
        text: options.caption || null,
        type: fileType, // 'image', 'audio', 'video', 'file'
        media_url: fileUrl,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    
    // Update channel last message
    await supabase
      .from('channels')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_text: `[${fileType}] ${options.caption || ''}`,
      })
      .eq('id', channelId)

    return data
  } catch (error) {
    console.error('Send media message error:', error)
    throw error
  }
}

// Get message reactions (if implemented)
export async function getMessageReactions(messageId) {
  try {
    const { data, error } = await supabase
      .from('message_reactions')
      .select('*, user:user_id(id, display_name, avatar_url)')
      .eq('message_id', messageId)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Get reactions error:', error)
    return []
  }
}

// Add reaction to message
export async function addReaction(messageId, emoji) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { data, error } = await supabase
      .from('message_reactions')
      .insert({
        message_id: messageId,
        user_id: user.id,
        emoji: emoji,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Add reaction error:', error)
    throw error
  }
}

// Remove reaction from message
export async function removeReaction(messageId, emoji) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  try {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Remove reaction error:', error)
    throw error
  }
}

export const messaging = {
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
