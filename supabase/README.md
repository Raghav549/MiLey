# MiLey Platform - Supabase Backend

This directory contains the complete backend implementation for the MiLey music streaming platform using Supabase.

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API

### 2. Run Migrations

Run the migrations in order:

```bash
# Using Supabase CLI
supabase db reset  # For local development
supabase db push   # For production

# Or manually in SQL Editor:
# 1. Copy contents of migrations/001_initial_schema.sql
# 2. Paste into SQL Editor and run
# 3. Repeat for 002_rls_policies.sql and 003_storage_policies.sql
```

### 3. Configure Authentication

In Supabase Dashboard > Authentication > Providers:

1. **Email**: Enable by default
2. **Google OAuth**: 
   - Create credentials in Google Cloud Console
   - Add authorized redirect URLs
   - Enable in Supabase
3. **Apple OAuth**:
   - Create credentials in Apple Developer Console
   - Enable in Supabase
4. **Phone OTP**:
   - Configure SMS provider (Twilio, MessageBird, etc.)
   - Enable in Supabase

### 4. Configure Storage Buckets

The migration creates these buckets automatically:
- `songs` - Private audio files (100MB limit)
- `covers` - Public album/track covers (10MB limit)
- `banners` - Public banner images (10MB limit)
- `profiles` - Public profile pictures (5MB limit)
- `documents` - Private verification documents (20MB limit)
- `backgrounds` - Public background images (10MB limit)

### 5. Set Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional:
- `VITE_ADMIN_UIDS` - Comma-separated admin user IDs

### 6. Create Admin User

After deploying, create your first admin:

```sql
-- In Supabase SQL Editor
INSERT INTO staff (user_id, role, permissions)
VALUES ('your-user-uuid', 'super_admin', '{"all": true}');
```

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `profiles` | Extended user profiles |
| `tracks` | Music tracks/songs |
| `albums` | Album collections |
| `playlists` | User playlists |
| `liked_tracks` | User favorites |
| `comments` | Track comments |

### Social Tables

| Table | Description |
|-------|-------------|
| `follows` | User follow relationships |
| `blocks` | User blocking |
| `channels` | Chat channels (DM, group, artist) |
| `messages` | Chat messages |
| `message_reads` | Read status tracking |

### Voice Rooms

| Table | Description |
|-------|-------------|
| `voice_rooms` | Voice room info |
| `room_participants` | Room participants |
| `voice_signals` | WebRTC signalling |

### Moderation

| Table | Description |
|-------|-------------|
| `reports` | Content/user reports |
| `staff` | Admin/moderator accounts |
| `user_moderation` | User moderation records |
| `admin_log` | Audit log |

## Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

- Users can only modify their own content
- Public content is visible to everyone
- Staff/admins have elevated permissions
- Follows, likes, and comments are properly secured

See `migrations/002_rls_policies.sql` for detailed policies.

## Edge Functions (Optional)

For advanced features, create Edge Functions:

```bash
supabase functions new send-notification
supabase functions new process-upload
supabase functions new generate-token
```

## Realtime Features

Supabase Realtime is used for:
- Online presence tracking
- Live chat messages
- Voice room signalling
- Notification updates

## Analytics

Track events with the `analytics` table:

```javascript
import { supabase } from './src/lib/supabaseClient'

await supabase.from('analytics').insert({
  event_type: 'track_play',
  track_id: 'track-uuid',
  data: { duration: 180, completed: true }
})
```

## Support

For issues or questions:
1. Check Supabase documentation
2. Review migration files for schema details
3. Check RLS policies for permission issues
