# MiLey Platform - Backend Setup Guide

## Overview

This document provides complete instructions for setting up the MiLey music streaming platform with a production-ready Supabase backend.

## Prerequisites

1. Node.js 18+ installed
2. A Supabase account (free tier works for development)
3. Git for version control

## Quick Start

### 1. Clone and Install

```bash
cd /workspace
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose your organization
4. Set a project name (e.g., "miley-music")
5. Set a strong database password
6. Choose a region close to your users
7. Wait for project creation (~2 minutes)

### 3. Get Your Credentials

1. Go to Settings > API in your Supabase dashboard
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 4. Configure Environment

Create `.env.local` file:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_ADMIN_UIDS=your-admin-user-id
```

### 5. Run Database Migrations

In Supabase Dashboard:

1. Go to SQL Editor
2. Create new query
3. Copy contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and run
5. Repeat for `002_rls_policies.sql` and `003_storage_policies.sql`

Or use Supabase CLI:

```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

### 6. Configure Authentication Providers

#### Email/Password (Enabled by default)

No configuration needed.

#### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```
6. Copy Client ID and Client Secret
7. In Supabase: Authentication > Providers > Google
8. Enable and paste credentials

#### Apple OAuth

1. Go to [Apple Developer](https://developer.apple.com/)
2. Create App ID with Sign in with Apple capability
3. Create Service ID
4. Generate private key
5. In Supabase: Authentication > Providers > Apple
6. Configure with your credentials

#### Phone OTP

1. In Supabase: Authentication > Providers > Phone
2. Enable Phone provider
3. Configure SMS provider (Twilio recommended):
   - Get Twilio Account SID and Auth Token
   - Enter in Supabase settings
4. Set message template

### 7. Configure Storage Buckets

Buckets are created automatically by migration `003_storage_policies.sql`.

Verify in Storage > Buckets:
- `songs` (private, 100MB limit)
- `covers` (public, 10MB limit)
- `banners` (public, 10MB limit)
- `profiles` (public, 5MB limit)
- `documents` (private, 20MB limit)
- `backgrounds` (public, 10MB limit)

### 8. Create First Admin User

After signing up your first user:

```sql
-- In SQL Editor, replace with your user ID
INSERT INTO staff (user_id, role, permissions)
VALUES ('your-user-uuid-here', 'super_admin', '{"all": true}');
```

Find your user ID in Authentication > Users.

### 9. Test the Application

```bash
npm run dev
```

Open http://localhost:5173 and test:
- Sign up with email
- Upload a profile picture
- Create a track upload
- Test messaging

## Production Deployment

### Environment Variables for Production

Set these in your hosting platform:

```env
VITE_SUPABASE_URL=https://your-production.supabase.co
VITE_SUPABASE_ANON_KEY=production-anon-key
VITE_ADMIN_UIDS=admin-uuid-1,admin-uuid-2
```

### Recommended Hosting

- **Vercel**: Best for React/Vite apps
- **Netlify**: Great alternative
- **Cloudflare Pages**: Fast global CDN

### Database Backups

Enable automatic backups in Supabase:
- Settings > Database > Backups
- Enable daily backups
- Consider point-in-time recovery for production

### Monitoring

1. Enable Supabase logging
2. Set up alerts for:
   - High error rates
   - Storage quota warnings
   - API rate limits

## Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] Storage bucket policies configured
- [ ] OAuth providers secured
- [ ] Admin users properly set up
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Regular backups scheduled

## Troubleshooting

### "Permission denied" errors

Check RLS policies in `supabase/migrations/002_rls_policies.sql`.

### Upload failures

Verify storage bucket policies and file size limits.

### Authentication issues

Check that your redirect URLs match exactly in OAuth provider settings.

## Support

- Supabase Docs: https://supabase.com/docs
- This project's README
- Supabase Discord community

## License

See main project LICENSE.
