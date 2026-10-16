# MiLey — Global Beats, Your Stage (`mileymusic.space`)

**Official Web Domain:** [https://mileymusic.space](https://mileymusic.space) (`http://mileymusic.space`)  
**Android Package ID:** `space.mileymusic.app`

MiLey is a full-stack music streaming, creator channel, bulk upload, and live audio social platform built for both the **Web (`mileymusic.space`)** and **Native Android (`/android`)**.

---

## ✨ Key Platform Features

### 1. Unique Bulk Song Upload System + Direct Upload Song Themes
- **Multi-Track Bulk Queue (`/upload?mode=bulk`)**: Drag and drop multiple MP3/WAV/M4A/FLAC files simultaneously, or load the built-in 3-track studio sample pack with 1 click.
- **Per-Song Direct Upload Song Theme Studio**:
  - Upload a **custom Song Theme background canvas image** directly for each individual song in your bulk upload queue.
  - Choose from 7 animated theme presets (*Cyber Neon Pulse*, *Velvet Rose Glow*, *Royal Gold Stage*, *Emerald Monsoon*, *Sakura Starlight*, *Cosmic Studio 808*, *Midnight Aurora*).
  - Customize **Primary & Secondary Neon Glow Colors** and **Visualizer Style** (*Spectrum Bars*, *Circular Halo*, *Vinyl Pulse*, *Wave Ribbon*, *Floating Orbs*).
  - Every song's theme automatically powers the **Full Player**, **Track Cards**, **Live Listen Room Stage**, and the **Android Camera Top Bar Music Banner**.

### 2. Rebuilt Live Listen Rooms (`/rooms` & `/rooms/:id`)
- **Central Synced Vinyl Turntable Stage**: Real-time track sync with Song Theme stage lighting, 24-bar reactive audio visualizer, and inline **Live Synced Lyrics** drawer.
- **Room Vibe / Hype Meter (`0–100% 🔥`)**: Interactive room energy bar with **⚡ Boost Vibe** button and stage confetti celebration at 100%.
- **Live DJ Soundboard**: Zero-latency Web Audio synthesized sound pads (`📯 Airhorn`, `💥 808 Drop`, `👏 Applause`, `💿 Scratch`, `✨ Starlight`) broadcast across the room.
- **Upvotable Song Queue & Live Room Polls**: Listeners upvote queued tracks to bubble them to the top and vote in real-time room polls.
- **WebRTC Voice Stage**: Speaker stage with mic mute/unmute, speaking halo indicator, and listener hand-raising (`✋ Request Mic`).

### 3. Special Artist & Creator Channel System
- **Artist Profiles (`/artist/:id`)**: Verified Artist badges, monthly listeners metric, pinned **Artist Spotlight Track** with Song Theme aura, Albums grid, and an interactive **Fan Shoutout Wall**.
- **Creator Channel Studio (`/channel-setup` & `/channel/:username`)**: Instant channel creation & approval, Verified Creator badge, channel brand accent color, pinned spotlight drop, channel analytics dashboard, and subscriber announcements with attached track drops.

### 4. Reactive Follow & Subscription System
- Real-time follow/unfollow across Artist Profiles, Creator Channels, Library (`Following` tab), and Follower/Following modals with instant count updates and proper routing (`/channel/:username` vs `/artist/:id`).

### 5. Native Android App + Animated Splash + Camera Top Bar Pro Music Banner
- **Unique Animated Professional Splash Screen (`SplashActivity.java` & `AnimatedSplash.jsx`)**: Choreographed 3D spinning vinyl disc, pulsing neon aura rings, and 20-bar spectrum equalizer.
- **Continuous Background Music Playback (`MusicPlaybackService.java`)**: Foreground media service + `PARTIAL_WAKE_LOCK` + MediaSession lock-screen controls ensure music keeps playing when the user minimizes or closes the app.
- **Camera Top Bar Pro Music Banner (`CameraTopBarBanner.jsx` & `CameraTopBarService.java`)**:
  - Anchored around the Android front camera punch-hole cutout (`top-1.5 left-1/2 -translate-x-1/2`).
  - **Compact Cutout Mode**: True-black capsule with Song Theme neon border, spinning miniature vinyl art on the left of the camera lens, camera lens cutout indicator + active audio LED in the center, and live equalizer bars + play/pause on the right.
  - **Expanded Pro Banner Mode**: Full glassmorphic player with Song Theme canvas background, EQ preset quick-switcher, seek bar, Like/Prev/Play/Next controls, and **Pop-Out Floating Banner (PiP / System Overlay)** mode.

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Build production bundle (verified for Vercel & Android)
npm run build
```

---

## 🌐 Deploying to Vercel (`https://mileymusic.space`)

1. Push this repository to GitHub and import it into [Vercel](https://vercel.com).
2. `vercel.json` is pre-configured with Vite build settings and SPA rewrites.
3. Add your custom domain **`mileymusic.space`** (`https://mileymusic.space` and `http://mileymusic.space`) in **Vercel → Project Settings → Domains**.
4. *(Optional for Global Cloud Sync)* In **Vercel → Project Settings → Environment Variables**, add:
   - `VITE_APP_URL` = `https://mileymusic.space`
   - `VITE_SUPABASE_URL` = `https://your-project-id.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-supabase-anon-key`
   *(Note: Even before adding Supabase keys, the app works 100% out-of-the-box on Vercel using the built-in Hybrid Studio Engine.)*

---

## 🗄️ Connecting Supabase Cloud Backend

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the migrations in `supabase/migrations/` in order:
   - `001_initial_schema.sql`
   - `002_rls_policies.sql`
   - `003_storage_policies.sql`
   - `004_complete_miley_schema.sql`
3. In **Authentication → URL Configuration**, set **Site URL** to `https://mileymusic.space` and add `https://mileymusic.space/**` and `space.mileymusic.app://callback` to **Redirect URLs**.

---

## 📱 Building the Native Android App (`/android`)

1. Sync the latest web build into the Android assets folder:
   ```bash
   npm run android:sync
   ```
2. Open the `/android` folder in **Android Studio** (or build via Gradle CLI):
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
3. Install the generated APK on any Android device:
   - Grant **Notification** and **Display over other apps** permissions when prompted to enable the **Native Floating Camera Top Bar Music Banner** when the app is closed or minimized.
