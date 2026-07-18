/**
 * MiLey Platform - Main Export
 * Production-ready full-stack music platform backend
 */

// Core modules
export { supabase, getSession, getUser, onAuthStateChange } from './supabaseClient'
export { auth, isAuthenticated, getCurrentUser, getCurrentUserAsync, signIn, signUp, signOut, signInWithGoogle, signInWithApple, verifyOtp, resetPassword, updatePassword, updateUserProfile, onAuthChange, isAppOwner, getAuthToken, refreshSession, adoptSession } from './auth'
export { db, select, get, insert, update, upsert, remove as delete, count, increment, search, subscribe, selectShared, getShared, insertShared, updateShared, upsertShared, deleteShared, countShared, incrementShared, searchShared, subscribeShared, batchInsert, batchUpdate, batchDelete } from './db'
export { storage, upload, uploadResumable, remove as storageRemove, getPublicUrl, getSignedUrl, list, download, uploadSong, uploadCover, uploadBanner, uploadProfileImage, uploadDocument } from './storage'
export { realtime, presence, subscribeToChanges, broadcast, listenToBroadcasts, sendVoiceSignal, listenToVoiceSignals } from './realtime'
export { social, searchUsers, getUserProfile, followUser, unfollowUser, isFollowing, getFollowersCount, getFollowingCount, sendMessage, getMessages, markMessageRead, getUnreadCount, getOrCreateDMChannel, getUserChannels, joinChannel, leaveChannel, blockUser, unblockUser, getBlockedUsers } from './social'
export { messaging, sendTypingIndicator, listenToTyping, markChannelRead, deleteMessage, editMessage, sendMediaMessage, getMessageReactions, addReaction, removeReaction } from './messaging'
export { user, getAppUserId, getAnonymousId, getCurrentUserProfile, updateCurrentUserProfile, getUserFollowerCount, getUserFollowingCount, checkIfFollowing, toggleFollow, getUserTracks, getUserPlaylists, getUserLikedTracksCount, verifySession, refreshUserSession, signOutCurrentUser } from './user'
export { useLive, useLiveShared, usePresence } from './useLive'

// Default export with all modules
export default {
  supabase: (await import('./supabaseClient')).supabase,
  auth: (await import('./auth')).auth,
  db: (await import('./db')).db,
  storage: (await import('./storage')).storage,
  realtime: (await import('./realtime')).realtime,
  social: (await import('./social')).social,
  messaging: (await import('./messaging')).messaging,
  user: (await import('./user')).user,
  useLive: (await import('./useLive')).useLive,
  useLiveShared: (await import('./useLive')).useLiveShared,
  usePresence: (await import('./useLive')).usePresence,
}
