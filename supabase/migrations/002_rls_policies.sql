-- MiLey Platform - Row Level Security (RLS) Policies
-- Security policies for all tables

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE liked_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================
-- Anyone can read public profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (trigger handles this)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- CHANNELS POLICIES
-- ============================================
-- Members can view their channels
CREATE POLICY "Members can view their channels"
  ON channels FOR SELECT
  USING (
    auth.uid() = created_by OR
    auth.uid() = ANY(member_ids) OR
    is_private = false
  );

-- Channel creators can update their channels
CREATE POLICY "Creators can update their channels"
  ON channels FOR UPDATE
  USING (auth.uid() = created_by);

-- Authenticated users can create channels
CREATE POLICY "Authenticated users can create channels"
  ON channels FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Channel creators can delete their channels
CREATE POLICY "Creators can delete their channels"
  ON channels FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================
-- USER_CHANNELS POLICIES
-- ============================================
CREATE POLICY "Users can view their channel memberships"
  ON user_channels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can join channels"
  ON user_channels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave channels"
  ON user_channels FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- MESSAGES POLICIES
-- ============================================
CREATE POLICY "Channel members can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channels
      WHERE id = messages.channel_id
      AND (auth.uid() = ANY(member_ids) OR is_private = false)
    )
  );

CREATE POLICY "Channel members can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM channels
      WHERE id = channel_id
      AND (auth.uid() = ANY(member_ids) OR is_private = false)
    )
  );

-- Users can update their own messages
CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (auth.uid() = sender_id);

-- Users can soft-delete their own messages
CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ============================================
-- MESSAGE_READS POLICIES
-- ============================================
CREATE POLICY "Users can view their own read status"
  ON message_reads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark messages as read"
  ON message_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own read status"
  ON message_reads FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- FOLLOWS POLICIES
-- ============================================
CREATE POLICY "Follows are publicly viewable"
  ON follows FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can follow others"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ============================================
-- BLOCKS POLICIES
-- ============================================
CREATE POLICY "Users can view their own blocks"
  ON blocks FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others"
  ON blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock"
  ON blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- ============================================
-- TRACKS POLICIES
-- ============================================
-- Public tracks visible to everyone, private only to owner
CREATE POLICY "Public tracks viewable by everyone"
  ON tracks FOR SELECT
  USING (
    visibility = 'public' OR
    (visibility = 'unlisted') OR
    (visibility = 'private' AND auth.uid() = artist_id) OR
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- Artists can insert their own tracks
CREATE POLICY "Artists can insert tracks"
  ON tracks FOR INSERT
  WITH CHECK (auth.uid() = artist_id);

-- Artists can update their own tracks
CREATE POLICY "Artists can update own tracks"
  ON tracks FOR UPDATE
  USING (auth.uid() = artist_id);

-- Artists can delete their own tracks
CREATE POLICY "Artists can delete own tracks"
  ON tracks FOR DELETE
  USING (auth.uid() = artist_id);

-- ============================================
-- ALBUMS POLICIES
-- ============================================
CREATE POLICY "Public albums viewable by everyone"
  ON albums FOR SELECT
  USING (
    visibility = 'public' OR
    (visibility = 'private' AND auth.uid() = artist_id)
  );

CREATE POLICY "Artists can insert albums"
  ON albums FOR INSERT
  WITH CHECK (auth.uid() = artist_id);

CREATE POLICY "Artists can update own albums"
  ON albums FOR UPDATE
  USING (auth.uid() = artist_id);

CREATE POLICY "Artists can delete own albums"
  ON albums FOR DELETE
  USING (auth.uid() = artist_id);

-- ============================================
-- ALBUM_TRACKS POLICIES
-- ============================================
CREATE POLICY "Album tracks viewable by everyone"
  ON album_tracks FOR SELECT
  USING (true);

CREATE POLICY "Album owners can manage tracks"
  ON album_tracks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM albums
      WHERE id = album_id AND artist_id = auth.uid()
    )
  );

CREATE POLICY "Album owners can remove tracks"
  ON album_tracks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM albums
      WHERE id = album_id AND artist_id = auth.uid()
    )
  );

-- ============================================
-- PLAYLISTS POLICIES
-- ============================================
CREATE POLICY "Public playlists viewable by everyone"
  ON playlists FOR SELECT
  USING (
    visibility != 'private' OR
    auth.uid() = owner_id
  );

CREATE POLICY "Users can create playlists"
  ON playlists FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Playlist owners can update"
  ON playlists FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Playlist owners can delete"
  ON playlists FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- PLAYLIST_TRACKS POLICIES
-- ============================================
CREATE POLICY "Playlist tracks viewable by everyone"
  ON playlist_tracks FOR SELECT
  USING (true);

CREATE POLICY "Playlist owners/collaborators can add tracks"
  ON playlist_tracks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE id = playlist_id
      AND (owner_id = auth.uid() OR is_collaborative = true)
    )
  );

CREATE POLICY "Playlist owners/collaborators can remove tracks"
  ON playlist_tracks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE id = playlist_id
      AND (owner_id = auth.uid() OR is_collaborative = true)
    )
  );

-- ============================================
-- LIKED_TRACKS POLICIES
-- ============================================
CREATE POLICY "Users can view their own liked tracks"
  ON liked_tracks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can like tracks"
  ON liked_tracks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike tracks"
  ON liked_tracks FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- COMMENTS POLICIES
-- ============================================
CREATE POLICY "Comments on public tracks viewable by everyone"
  ON comments FOR SELECT
  USING (
    NOT is_hidden OR
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can comment"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- COMMENT_LIKES POLICIES
-- ============================================
CREATE POLICY "Comment likes viewable by everyone"
  ON comment_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like comments"
  ON comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike comments"
  ON comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- CATEGORIES POLICIES
-- ============================================
CREATE POLICY "Categories viewable by everyone"
  ON categories FOR SELECT
  USING (true);

-- Only admins can manage categories
CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true); -- Handled by server-side functions/triggers

-- ============================================
-- REPORTS POLICIES
-- ============================================
CREATE POLICY "Users can view their own reports"
  ON reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Staff can view all reports"
  ON reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can submit reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Staff can update reports"
  ON reports FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())
  );

-- ============================================
-- STAFF POLICIES
-- ============================================
CREATE POLICY "Staff can view their own records"
  ON staff FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all staff"
  ON staff FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- ============================================
-- ADMIN_LOG POLICIES
-- ============================================
CREATE POLICY "Admins can view admin log"
  ON admin_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- ============================================
-- USER_MODERATION POLICIES
-- ============================================
CREATE POLICY "Users can view their own moderation status"
  ON user_moderation FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all moderation records"
  ON user_moderation FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Staff can update moderation records"
  ON user_moderation FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())
  );

-- ============================================
-- VOICE_ROOMS POLICIES
-- ============================================
CREATE POLICY "Voice rooms viewable by everyone"
  ON voice_rooms FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create voice rooms"
  ON voice_rooms FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their rooms"
  ON voice_rooms FOR UPDATE
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts can end their rooms"
  ON voice_rooms FOR DELETE
  USING (auth.uid() = host_id);

-- ============================================
-- ROOM_PARTICIPANTS POLICIES
-- ============================================
CREATE POLICY "Participants can view their participation"
  ON room_participants FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM voice_rooms WHERE id = room_id AND status = 'active'
  ));

CREATE POLICY "Users can join rooms"
  ON room_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
  ON room_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- VOICE_SIGNALS POLICIES
-- ============================================
CREATE POLICY "Room participants can view signals"
  ON voice_signals FOR SELECT
  USING (
    auth.uid() = from_user_id OR
    auth.uid() = to_user_id OR
    EXISTS (SELECT 1 FROM room_participants WHERE room_id = voice_signals.room_id AND user_id = auth.uid())
  );

CREATE POLICY "Room participants can send signals"
  ON voice_signals FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- ============================================
-- ANALYTICS POLICIES
-- ============================================
CREATE POLICY "Analytics insertable by everyone"
  ON analytics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Track owners can view their analytics"
  ON analytics FOR SELECT
  USING (
    track_id IS NULL OR
    EXISTS (SELECT 1 FROM tracks WHERE id = track_id AND artist_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())
  );

-- ============================================
-- VERIFICATION_REQUESTS POLICIES
-- ============================================
CREATE POLICY "Users can view their own verification requests"
  ON verification_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all verification requests"
  ON verification_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can submit verification requests"
  ON verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can review verification requests"
  ON verification_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())
  );

-- ============================================
-- CHANNEL_REQUESTS POLICIES
-- ============================================
CREATE POLICY "Users can view their own channel requests"
  ON channel_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all channel requests"
  ON channel_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can submit channel requests"
  ON channel_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can review channel requests"
  ON channel_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())
  );

-- ============================================
-- PUSH_TOKENS POLICIES
-- ============================================
CREATE POLICY "Users can view their own push tokens"
  ON push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can register push tokens"
  ON push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their push tokens"
  ON push_tokens FOR DELETE
  USING (auth.uid() = user_id);
