-- ============================================================================
-- MiLey Platform - Complete Production Schema Migration (004)
-- Official Domain: https://mileymusic.space
-- Adds song_theme JSONB, channels, channel_posts, premieres, notifications,
-- reports, dm_channels, dm_messages, artist_shoutouts, and camelCase/snake_case support
-- ============================================================================

-- 1. Extend tracks table with song_theme (Direct Upload Song Themes), channel fields & collaborators
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS song_theme JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS channel_id TEXT,
  ADD COLUMN IF NOT EXISTS channel_username TEXT,
  ADD COLUMN IF NOT EXISTS channel_name TEXT,
  ADD COLUMN IF NOT EXISTS channel_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS album_title TEXT,
  ADD COLUMN IF NOT EXISTS track_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'song',
  ADD COLUMN IF NOT EXISTS collaborators JSONB DEFAULT '[]'::jsonb;

-- 2. Extend profiles table with custom_username, artist_badge, spotlight_track_id
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_username TEXT,
  ADD COLUMN IF NOT EXISTS artist_badge TEXT DEFAULT 'Verified Artist',
  ADD COLUMN IF NOT EXISTS spotlight_track_id TEXT,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT true;

-- 3. Creator Channels table
CREATE TABLE IF NOT EXISTS public.channels (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  owner_id TEXT NOT NULL,
  owner_name TEXT,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  bio TEXT DEFAULT '',
  category TEXT DEFAULT 'Electronic & Synth Studio',
  accent_color TEXT DEFAULT '#00E0A8',
  spotlight_track_id TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  banner_url TEXT DEFAULT '',
  verified BOOLEAN DEFAULT true,
  verify_requested BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'approved',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Channel Posts / Announcements table
CREATE TABLE IF NOT EXISTS public.channel_posts (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  channel_id TEXT NOT NULL,
  channel_username TEXT,
  channel_name TEXT,
  owner_id TEXT NOT NULL,
  text TEXT NOT NULL,
  track_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Artist Fan Wall Shoutouts table
CREATE TABLE IF NOT EXISTS public.artist_shoutouts (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  artist_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT DEFAULT 'MiLey Fan',
  author_avatar TEXT DEFAULT '',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Extend rooms table for rebuilt Listen Room features
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Music Party',
  ADD COLUMN IF NOT EXISTS host_name TEXT DEFAULT 'Host',
  ADD COLUMN IF NOT EXISTS host_avatar TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bg_theme TEXT DEFAULT 'neon',
  ADD COLUMN IF NOT EXISTS custom_bg_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS open_dj BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_dj BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_song_theme BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS vibe_score INTEGER DEFAULT 88,
  ADD COLUMN IF NOT EXISTS speaker_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS raised_hand_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS queue JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS poll JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS current_track_title TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS current_track_artist TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS current_track_cover TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS current_song_theme JSONB DEFAULT '{}'::jsonb;

-- 7. Listen Room Chat Messages table
CREATE TABLE IF NOT EXISTS public.room_messages (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT DEFAULT 'Listener',
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Scheduled Premieres table
CREATE TABLE IF NOT EXISTS public.premieres (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  scheduled_at TIMESTAMPTZ NOT NULL,
  channel_id TEXT,
  channel_username TEXT,
  channel_name TEXT,
  channel_verified BOOLEAN DEFAULT false,
  host_id TEXT,
  track_id TEXT,
  track_title TEXT,
  cover_url TEXT DEFAULT '',
  rsvp_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  recipient_id TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  type TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  link TEXT DEFAULT '/',
  meta JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Moderation Reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_name TEXT,
  reason TEXT NOT NULL,
  notes TEXT DEFAULT '',
  reporter_id TEXT,
  reporter_name TEXT,
  status TEXT DEFAULT 'open',
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Direct & Group Chat Channels + Messages
CREATE TABLE IF NOT EXISTS public.dm_channels (
  id TEXT PRIMARY KEY,
  type TEXT DEFAULT 'direct',
  name TEXT DEFAULT '',
  members JSONB DEFAULT '[]'::jsonb,
  member_profiles JSONB DEFAULT '{}'::jsonb,
  last_message JSONB,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  channel_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT DEFAULT 'MiLey User',
  content TEXT DEFAULT '',
  text TEXT DEFAULT '',
  type TEXT DEFAULT 'text',
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted BOOLEAN DEFAULT false,
  edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Official @MiLey Inbox & Keys
CREATE TABLE IF NOT EXISTS public.official_messages (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_avatar TEXT,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  jwk TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
