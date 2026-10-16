/**
 * MiLey Platform - Main Backend SDK Export
 * Official Domain: https://mileymusic.space
 */

import { supabase, getSession, getUser, onAuthStateChange, isSupabaseConfigured, APP_DOMAIN, MILEY_HOST, getAppUrl } from './supabaseClient'
import { auth, isAuthenticated, getCurrentUser, getCurrentUserAsync, signIn, signUp, signOut, signInWithGoogle, signInWithApple, verifyOtp, resetPassword, updatePassword, updateUserProfile, onAuthChange, isAppOwner, setAdminMode, getAuthToken, refreshSession, adoptSession } from './auth'
import { db, select, get, insert, update, upsert, remove as deleteRecord, count, increment, search, subscribe, selectShared, getShared, insertShared, updateShared, upsertShared, deleteShared, countShared, incrementShared, searchShared, subscribeShared, batchInsert, batchUpdate, batchDelete } from './db'
import { storage, upload, uploadResumable, remove as storageRemove, getPublicUrl, getSignedUrl, list, download, uploadSong, uploadCover, uploadBanner, uploadSongThemeAsset, uploadProfileImage, uploadDocument } from './storage'
import { realtime, presence, subscribeToChanges, broadcast, listenToBroadcasts, sendVoiceSignal, listenToVoiceSignals } from './realtime'
import { social, searchUsers, getUserProfile, followUser, unfollowUser, isFollowing, getFollowersCount, getFollowingCount, sendMessage, getMessages, markMessageRead, getUnreadCount, getOrCreateDMChannel, getUserChannels, joinChannel, leaveChannel, blockUser, unblockUser, getBlockedUsers } from './social'
import { messaging, sendTypingIndicator, listenToTyping, markChannelRead, deleteMessage, editMessage, sendMediaMessage, getMessageReactions, addReaction, removeReaction } from './messaging'
import { user, getAppUserId, getAnonymousId, getCurrentUserProfile, updateCurrentUserProfile, getUserFollowerCount, getUserFollowingCount, checkIfFollowing, toggleFollow, getUserTracks, getUserPlaylists, getUserLikedTracksCount, verifySession, refreshUserSession, signOutCurrentUser } from './user'
import { useLive, useLiveShared, usePresence } from './useLive'

export {
  supabase, getSession, getUser, onAuthStateChange, isSupabaseConfigured, APP_DOMAIN, MILEY_HOST, getAppUrl,
  auth, isAuthenticated, getCurrentUser, getCurrentUserAsync, signIn, signUp, signOut, signInWithGoogle, signInWithApple, verifyOtp, resetPassword, updatePassword, updateUserProfile, onAuthChange, isAppOwner, setAdminMode, getAuthToken, refreshSession, adoptSession,
  db, select, get, insert, update, upsert, deleteRecord as delete, count, increment, search, subscribe, selectShared, getShared, insertShared, updateShared, upsertShared, deleteShared, countShared, incrementShared, searchShared, subscribeShared, batchInsert, batchUpdate, batchDelete,
  storage, upload, uploadResumable, storageRemove, getPublicUrl, getSignedUrl, list, download, uploadSong, uploadCover, uploadBanner, uploadSongThemeAsset, uploadProfileImage, uploadDocument,
  realtime, presence, subscribeToChanges, broadcast, listenToBroadcasts, sendVoiceSignal, listenToVoiceSignals,
  social, searchUsers, getUserProfile, followUser, unfollowUser, isFollowing, getFollowersCount, getFollowingCount, sendMessage, getMessages, markMessageRead, getUnreadCount, getOrCreateDMChannel, getUserChannels, joinChannel, leaveChannel, blockUser, unblockUser, getBlockedUsers,
  messaging, sendTypingIndicator, listenToTyping, markChannelRead, deleteMessage, editMessage, sendMediaMessage, getMessageReactions, addReaction, removeReaction,
  user, getAppUserId, getAnonymousId, getCurrentUserProfile, updateCurrentUserProfile, getUserFollowerCount, getUserFollowingCount, checkIfFollowing, toggleFollow, getUserTracks, getUserPlaylists, getUserLikedTracksCount, verifySession, refreshUserSession, signOutCurrentUser,
  useLive, useLiveShared, usePresence,
}

export default {
  supabase,
  auth,
  db,
  storage,
  realtime,
  social,
  messaging,
  user,
  useLive,
  useLiveShared,
  usePresence,
}
