import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthGate from './components/AuthGate'
import BottomNav from './components/BottomNav'
import MiniPlayer from './components/MiniPlayer'
import FullPlayer from './components/FullPlayer'
import AnimatedSplash from './components/AnimatedSplash'
import CameraTopBarBanner from './components/CameraTopBarBanner'
import { PlayerProvider, usePlayer } from './context/PlayerContext'
import { PortraitLockOverlay } from './hooks/usePortraitLock.jsx'
import { useEffect } from 'react'
import { auth } from './lib/auth'
import { ensureOfficialWelcome } from './officialDM'
import Home from './pages/Home'
import Explore from './pages/Explore'
import Search from './pages/Search'
import Library from './pages/Library'
import Upload from './pages/Upload'
import Profile from './pages/Profile'
import ArtistProfile from './pages/ArtistProfile'
import AlbumDetail from './pages/AlbumDetail'
import PlaylistDetail from './pages/PlaylistDetail'
import Messages from './pages/Messages'
import ChatRoom from './pages/ChatRoom'
import Rooms from './pages/Rooms'
import RoomView from './pages/RoomView'
import Channel from './pages/Channel'
import ChannelDashboard from './pages/ChannelDashboard'
import Premieres, { PremiereRoom } from './pages/Premieres'
import Notifications from './pages/Notifications'
import AdminReports from './pages/AdminReports'
import OfficialInbox from './pages/OfficialInbox'

function AppShell() {
  const { currentTrack } = usePlayer()

  useEffect(() => {
    const u = auth.getCurrentUser()
    if (u?.id) ensureOfficialWelcome(u)
  }, [])

  return (
    <div
      className={`min-h-screen bg-bg-primary text-text-primary ${
        currentTrack ? 'pt-11 pb-36' : 'pb-20'
      }`}
    >
      {/* Android Camera Top Bar / Cutout Pro Music Banner */}
      <CameraTopBarBanner />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/search" element={<Search />} />
        <Route path="/library" element={<Library />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/artist/:id" element={<ArtistProfile />} />
        <Route path="/album/:id" element={<AlbumDetail />} />
        <Route path="/playlist/:id" element={<PlaylistDetail />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/:id" element={<ChatRoom />} />
        <Route path="/chat/:id" element={<ChatRoom />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/rooms/:id" element={<RoomView />} />
        <Route path="/channel-setup" element={<ChannelDashboard />} />
        <Route path="/channel-dashboard" element={<ChannelDashboard />} />
        <Route path="/channel/:username" element={<Channel />} />
        <Route path="/premieres" element={<Premieres />} />
        <Route path="/premieres/:id" element={<PremiereRoom />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/official" element={<OfficialInbox />} />
        <Route path="/admin/official-inbox" element={<OfficialInbox />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <MiniPlayer />
      <FullPlayer />
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <PortraitLockOverlay />
      <AnimatedSplash />
      <AuthGate>
        <PlayerProvider>
          <AppShell />
        </PlayerProvider>
      </AuthGate>
    </HashRouter>
  )
}
