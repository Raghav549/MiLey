import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { PlayerProvider } from './context/PlayerContext'
import AuthGate from './components/AuthGate'
import BottomNav, { SidebarNav, MobileBottomNav } from './components/BottomNav'
import MiniPlayer, { FloatingDisc } from './components/MiniPlayer'
import FullPlayer from './components/FullPlayer'
import AnimatedSplash from './components/AnimatedSplash'
import CameraTopBarBanner from './components/CameraTopBarBanner'
import { usePortraitLock } from './hooks/usePortraitLock'
import Home from './pages/Home'
import Explore from './pages/Explore'
import Search from './pages/Search'
import Upload from './pages/Upload'
import Library from './pages/Library'
import Profile from './pages/Profile'
import ArtistProfile from './pages/ArtistProfile'
import AlbumDetail from './pages/AlbumDetail'
import PlaylistDetail from './pages/PlaylistDetail'
import Channel from './pages/Channel'
import ChannelDashboard from './pages/ChannelDashboard'
import Rooms from './pages/Rooms'
import RoomView from './pages/RoomView'
import Premieres from './pages/Premieres'
import Notifications from './pages/Notifications'
import Messages from './pages/Messages'
import ChatRoom from './pages/ChatRoom'
import AdminReports from './pages/AdminReports'
import OfficialInbox from './pages/OfficialInbox'

const ACCENTS = {
  emerald: { primary: '0 224 168', secondary: '255 61 174' },
  violet: { primary: '168 85 247', secondary: '56 189 248' },
  sunset: { primary: '251 146 60', secondary: '244 63 94' },
}

export default function App() {
  const location = useLocation()
  const PortraitOverlay = usePortraitLock()
  const inLiveRoom = /^\/rooms\/[^/]+$/.test(location.pathname)

  useEffect(() => {
    try {
      const k = localStorage.getItem('miley_accent')
      const a = ACCENTS[k]
      if (a) {
        document.documentElement.style.setProperty('--color-primary', a.primary)
        document.documentElement.style.setProperty('--color-secondary', a.secondary)
      }
    } catch (e) { /* ignore */ }
  }, [])

  return (
    <PlayerProvider>
      <AnimatedSplash />
      <CameraTopBarBanner />
      <AuthGate>
        <div className="h-full flex flex-col overflow-hidden" style={{ background: '#0B0B0B' }}>
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {!inLiveRoom && <SidebarNav />}
            <main className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${inLiveRoom ? 'pb-0' : 'pb-40 md:pb-28'}`}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/search" element={<Search />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/library" element={<Library />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/artist/:id" element={<ArtistProfile />} />
                <Route path="/album/:id" element={<AlbumDetail />} />
                <Route path="/playlist/:id" element={<PlaylistDetail />} />
                <Route path="/channel/:username" element={<Channel />} />
                <Route path="/channel-dashboard" element={<ChannelDashboard />} />
                <Route path="/studio/channel" element={<ChannelDashboard />} />
                <Route path="/rooms" element={<Rooms />} />
                <Route path="/rooms/:id" element={<RoomView />} />
                <Route path="/premieres" element={<Premieres />} />
                <Route path="/premieres/:id" element={<Premieres />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/messages/:id" element={<ChatRoom />} />
                <Route path="/chat/:id" element={<ChatRoom />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/official" element={<OfficialInbox />} />
                <Route path="/official-inbox" element={<OfficialInbox />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>

          {!inLiveRoom && <MiniPlayer bottomOffsetClass="bottom-[4.75rem] md:bottom-4" />}
          {!inLiveRoom && <FloatingDisc />}
          {!inLiveRoom && <MobileBottomNav />}
          <BottomNav />
          <FullPlayer />
          {PortraitOverlay && <PortraitOverlay />}
        </div>
      </AuthGate>
    </PlayerProvider>
  )
}
