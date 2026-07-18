-- MiLey Platform - Production Database Schema
-- Complete PostgreSQL schema for music streaming platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" FOR text search;

-- ============================================
-- PROFILES TABLE
-- Extended user profile information
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'MiLey User',
  custom_username TEXT UNIQUE,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  location TEXT,
  website TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verification_type TEXT, -- 'artist', 'label', 'creator'
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  tracks_count INTEGER DEFAULT 0,
  playlists_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHANNELS TABLE
-- For DMs, group chats, and artist channels
-- ============================================
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL DEFAULT 'dm', -- 'dm', 'group', 'channel'
  name TEXT,
  description TEXT,
  avatar_url TEXT,
  member_ids UUID[] DEFAULT '{}',
  member_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  last_message_at TIMESTAMPTZ,
  last_message_text TEXT,
  is_private BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'active', -- 'active', 'archived', 'banned'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER_CHANNELS TABLE
-- Junction table for channel memberships
-- ============================================
CREATE TABLE IF NOT EXISTS user_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  muted BOOLEAN DEFAULT FALSE,
  UNIQUE(channel_id, user_id)
);

-- ============================================
-- MESSAGES TABLE
-- Chat messages
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  text TEXT,
  type TEXT DEFAULT 'text', -- 'text', 'image', 'audio', 'video', 'file', 'system'
  media_url TEXT,
  reply_to UUID REFERENCES messages(id),
  edited BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MESSAGE_READS TABLE
-- Track read status of messages
-- ============================================
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- ============================================
-- FOLLOWS TABLE
-- User follow relationships
-- ============================================
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, target_id)
);

-- ============================================
-- BLOCKS TABLE
-- User blocking
-- ============================================
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- ============================================
-- TRACKS TABLE
-- Music tracks/songs
-- ============================================
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  artist_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  artist_name TEXT,
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  duration INTEGER DEFAULT 0, -- in seconds
  genre TEXT,
  language TEXT,
  mood TEXT,
  lyrics TEXT,
  type TEXT DEFAULT 'track', -- 'track', 'podcast', 'audiobook'
  visibility TEXT DEFAULT 'public', -- 'public', 'private', 'unlisted'
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'takedown'
  plays_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  is_downloadable BOOLEAN DEFAULT FALSE,
  is_explicit BOOLEAN DEFAULT FALSE,
  copyright_info TEXT,
  release_date DATE,
  metadata JSONB DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ALBUMS TABLE
-- Album collections
-- ============================================
CREATE TABLE IF NOT EXISTS albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  artist_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  artist_name TEXT,
  cover_url TEXT,
  description TEXT,
  type TEXT DEFAULT 'album', -- 'album', 'ep', 'single', 'compilation'
  visibility TEXT DEFAULT 'public',
  status TEXT DEFAULT 'pending',
  track_count INTEGER DEFAULT 0,
  plays_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  release_date DATE,
  label TEXT,
  copyright_info TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ALBUM_TRACKS TABLE
-- Junction table for album tracks
-- ============================================
CREATE TABLE IF NOT EXISTS album_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  track_order INTEGER NOT NULL,
  UNIQUE(album_id, track_id),
  UNIQUE(album_id, track_order)
);

-- ============================================
-- PLAYLISTS TABLE
-- User playlists
-- ============================================
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility TEXT DEFAULT 'private', -- 'private', 'public', 'collaborative'
  track_count INTEGER DEFAULT 0,
  plays_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  is_collaborative BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PLAYLIST_TRACKS TABLE
-- Junction table for playlist tracks
-- ============================================
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  track_order INTEGER NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playlist_id, track_id),
  UNIQUE(playlist_id, track_order)
);

-- ============================================
-- LIKED_TRACKS TABLE
-- User liked/favorited tracks
-- ============================================
CREATE TABLE IF NOT EXISTS liked_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL,
  title TEXT,
  artist_name TEXT,
  cover_url TEXT,
  audio_url TEXT,
  duration INTEGER,
  type TEXT,
  artist_id UUID,
  liked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, track_id)
);

-- ============================================
-- COMMENTS TABLE
-- Track comments
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  timestamp_seconds INTEGER, -- Comment timestamp within track
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COMMENT_LIKES TABLE
-- Comment likes
-- ============================================
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- ============================================
-- CATEGORIES TABLE
-- Genres, languages, moods
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_lower TEXT NOT NULL,
  type TEXT NOT NULL, -- 'genre', 'language', 'mood'
  description TEXT,
  icon_url TEXT,
  track_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name_lower, type)
);

-- ============================================
-- NOTIFICATIONS TABLE
-- User notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'follow', 'like', 'comment', 'mention', 'system', 'message'
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  actor_id UUID REFERENCES auth.users(id),
  actor_name TEXT,
  actor_avatar TEXT,
  target_id UUID,
  target_type TEXT,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REPORTS TABLE
-- Content/user reports
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_content_id UUID, -- track_id, comment_id, etc.
  content_type TEXT NOT NULL, -- 'user', 'track', 'comment', 'message', 'channel'
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'reviewing', 'resolved', 'dismissed'
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STAFF TABLE
-- Admin/moderator staff members
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  role TEXT NOT NULL DEFAULT 'moderator', -- 'moderator', 'admin', 'super_admin'
  permissions JSONB DEFAULT '{}',
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADMIN_LOG TABLE
-- Admin activity audit log
-- ============================================
CREATE TABLE IF NOT EXISTS admin_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  detail JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER_MODERATION TABLE
-- User moderation records
-- ============================================
CREATE TABLE IF NOT EXISTS user_moderation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  banned BOOLEAN DEFAULT FALSE,
  ban_until TIMESTAMPTZ,
  ban_reason TEXT,
  muted BOOLEAN DEFAULT FALSE,
  mute_until TIMESTAMPTZ,
  mute_reason TEXT,
  strikes_count INTEGER DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  notes TEXT,
  moderated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VOICE_ROOMS TABLE
-- Voice room information
-- ============================================
CREATE TABLE IF NOT EXISTS voice_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  host_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  purpose TEXT DEFAULT 'Music',
  background_key TEXT DEFAULT 'nebula',
  max_participants INTEGER DEFAULT 50,
  is_private BOOLEAN DEFAULT FALSE,
  password_hash TEXT,
  participant_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- 'active', 'ended', 'banned'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROOM_PARTICIPANTS TABLE
-- Voice room participants
-- ============================================
CREATE TABLE IF NOT EXISTS room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES voice_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'listener', -- 'host', 'speaker', 'listener'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  UNIQUE(room_id, user_id)
);

-- ============================================
-- VOICE_SIGNALS TABLE
-- WebRTC signalling for voice rooms
-- ============================================
CREATE TABLE IF NOT EXISTS voice_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES voice_rooms(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL, -- 'offer', 'answer', 'ice-candidate'
  signal_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANALYTICS TABLE
-- Platform analytics
-- ============================================
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  track_id UUID REFERENCES tracks(id),
  album_id UUID REFERENCES albums(id),
  playlist_id UUID REFERENCES playlists(id),
  data JSONB DEFAULT '{}',
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VERIFICATION_REQUESTS TABLE
-- Artist/creator verification requests
-- ============================================
CREATE TABLE IF NOT EXISTS verification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL, -- 'artist', 'label', 'creator'
  display_name TEXT,
  social_links JSONB DEFAULT '[]',
  documents_urls TEXT[],
  bio TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(user_id, status) WHERE status = 'pending'
);

-- ============================================
-- CHANNEL_REQUESTS TABLE
-- Channel creation requests (for non-approved users)
-- ============================================
CREATE TABLE IF NOT EXISTS channel_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_name TEXT NOT NULL,
  channel_description TEXT,
  channel_avatar_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  created_channel_id UUID REFERENCES channels(id)
);

-- ============================================
-- PUSH_TOKENS TABLE
-- Push notification tokens
-- ============================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'web', 'ios', 'android'
  device_info JSONB DEFAULT '{}',
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(custom_username);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_target ON follows(target_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
CREATE INDEX IF NOT EXISTS idx_tracks_plays ON tracks(plays_count DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_created ON tracks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists(owner_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_track ON analytics(track_id);
CREATE INDEX IF NOT EXISTS idx_comments_track ON comments(track_id);
CREATE INDEX IF NOT EXISTS idx_liked_tracks_user ON liked_tracks(user_id);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_tracks_search ON tracks USING gin(to_tsvector('english', title || ' ' || COALESCE(artist_name, '')));
CREATE INDEX IF NOT EXISTS idx_profiles_search ON profiles USING gin(to_tsvector('english', display_name || ' ' || COALESCE(custom_username, '')));

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'MiLey User'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tracks_updated_at BEFORE UPDATE ON tracks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_albums_updated_at BEFORE UPDATE ON albums FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON playlists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_moderation_updated_at BEFORE UPDATE ON user_moderation FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment counter
CREATE OR REPLACE FUNCTION increment_field(
  table_name TEXT,
  record_id UUID,
  field_name TEXT,
  increment_amount INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  result INTEGER;
BEGIN
  EXECUTE format(
    'UPDATE %I SET %I = %I + $1 WHERE id = $2 RETURNING %I',
    table_name, field_name, field_name, field_name
  ) INTO result USING increment_amount, record_id;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync follower counts
CREATE OR REPLACE FUNCTION sync_follower_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.target_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET followers_count = followers_count - 1 WHERE id = OLD.target_id;
    UPDATE profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_follower_counts_after_follow
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION sync_follower_counts();

-- Row Level Security (RLS) must be enabled per table
-- See supabase/rls-policies.sql for detailed policies
