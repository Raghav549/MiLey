import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { PlayerProvider, usePlayer } from './context/PlayerContext'
import { MobileBottomNav, SidebarNav } from './components/BottomNav'
import MiniPlayer, { FloatingDisc } from './components/MiniPlayer'
import FullPlayer from './components/FullPlayer'
import AuthGate from './components/AuthGate'
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
import { usePortraitLock, LandscapeGuard } from './hooks/usePortraitLock'

function Shell() {
  const { currentTrack, fullPlayerOpen } = usePlayer()
  const location = useLocation()
  const isLandscape = usePortraitLock()

  const hasMini = !!currentTrack
  // Immersive screens (chat thread, live room, premiere room) manage their own
  // full-height layout — the bottom nav + mini player must NOT overlay them or
  // they'd cover the message input. A floating disc replaces the mini player there.
  const immersive = /^\/(chat|rooms|premieres)\/[^/]+/.test(location.pathname) || location.pathname === '/official'
  const mainPadBottom = immersive
    ? ''
    : hasMini ? 'pb-[7.5rem] md:pb-[5.5rem]' : 'pb-[5.5rem] md:pb-6'

  return (
    <div className="h-full flex bg-[#0B0B0B] text-white">
      <LandscapeGuard active={isLandscape} />
      <SidebarNav />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
        <main key={location.pathname} className={`flex-1 min-h-0 overflow-y-auto no-scrollbar ${mainPadBottom}`}>
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
            <Route path="/chat/:id" element={<ChatRoom />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/rooms/:id" element={<RoomView />} />
            <Route path="/channel/:username" element={<Channel />} />
            <Route path="/channel-dashboard" element={<ChannelDashboard />} />
            <Route path="/premieres" element={<Premieres />} />
            <Route path="/premieres/:id" element={<PremiereRoom />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/official" element={<OfficialInbox />} />
          </Routes>
        </main>
        {!immersive && hasMini && <MiniPlayer bottomOffsetClass="bottom-[4.75rem] md:bottom-4" />}
        {!immersive && <MobileBottomNav />}
        {immersive && <FloatingDisc />}
      </div>
      {fullPlayerOpen && <FullPlayer />}
    </div>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(true) }, [])
  if (!ready) return null
  return (
    <HashRouter>
      <PlayerProvider>
        <AuthGate>
          <Shell />
        </AuthGate>
      </PlayerProvider>
    </HashRouter>
  )
}
