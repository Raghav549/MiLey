# MiLey Backend Setup Guide (`mileymusic.space`)

Complete step-by-step instructions to deploy the MiLey platform backend and connect both the **Web App (`https://mileymusic.space`)** and the **Native Android App (`space.mileymusic.app`)**.

---

## 1. Built-in Hybrid Backend (Zero-Config Out of the Box)

MiLey includes a **Dual-Engine Hybrid Backend (`src/lib/`)**:
- **Local Studio Engine (`src/lib/localBackend.js`)**: Automatically activates when `VITE_SUPABASE_URL` is not configured. It provides persistent storage (`localStorage` + `IndexedDB` for uploaded audio/images/Song Themes), real-time cross-tab `BroadcastChannel` sync, pre-seeded creator channels, tracks with Song Themes, and active Listen Rooms.
- **Supabase Cloud Engine (`src/lib/supabaseClient.js`)**: Automatically activates as soon as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env` or Vercel Environment Variables.

---

## 2. Supabase Cloud Setup (For Multi-User Global Production)

### Step 1: Create Project
1. Go to [https://supabase.com](https://supabase.com) and create a project named `miley-production`.
2. Copy your **Project URL** and **Anon Public Key** from **Project Settings → API**.

### Step 2: Run SQL Migrations
Open **Supabase Dashboard → SQL Editor** and run the migration files in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_storage_policies.sql`
4. `supabase/migrations/004_complete_miley_schema.sql`

### Step 3: Configure Authentication Redirects for `mileymusic.space`
In **Supabase Dashboard → Authentication → URL Configuration**:
- **Site URL**: `https://mileymusic.space`
- **Redirect URLs**:
  - `https://mileymusic.space/**`
  - `http://mileymusic.space/**`
  - `space.mileymusic.app://callback`

### Step 4: Set Environment Variables (`.env` & Vercel)
```env
VITE_APP_URL=https://mileymusic.space
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ADMIN_UIDS=your-user-uuid
VITE_APP_OWNER_ID=your-user-uuid
```
