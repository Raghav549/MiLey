import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { storage } from '../lib/storage'
import { push } from '../lib/push'
import { usePlayer } from '../context/PlayerContext'
import { useLiveShared } from '../lib/useLive'
import { getLikedTracks } from '../hooks/useLikes'
import { useFollows, followerCount, getFollowersList, getFollowingList } from '../hooks/useFollows'
import { useNotifications } from '../hooks/useNotifications'
import { PROFILE_THEMES, profileThemeGrad, timeAgo } from '../musicHelpers'
import { isAdmin } from '../permissions'
import QRCard from '../components/QRCard'
import FollowListModal from '../components/FollowListModal'
import {
  ProfileIcon, EditIcon, CheckIcon, CloseIcon, HeartIcon, UploadIcon,
  ClockIcon, BellIcon, ShieldIcon, ChannelIcon, MessageIcon, QrIcon,
  LinkIcon, ThemeIcon,
} from '../components/icons'

const THEMES = [
  { key: 'emerald', label: 'Emerald & Pink', primary: '0 224 168', secondary: '255 61 174' },
  { key: 'violet', label: 'Electric Violet', primary: '168 85 247', secondary: '56 189 248' },
  { key: 'sunset', label: 'Solar Coral', primary: '251 146 60', secondary: '244 63 94' },
]

function applyAccent(key) {
  const t = THEMES.find((x) => x.key === key) || THEMES[0]
  document.documentElement.style.setProperty('--color-primary', t.primary)
  document.documentElement.style.setProperty('--color-secondary', t.secondary)
  try { localStorage.setItem('miley_accent', t.key) } catch (e) { /* ignore */ }
}

function NotifCount() {
  const { unread } = useNotifications()
  if (!unread) return null
  return <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full btn-brand text-black">{unread}</span>
}

export default function Profile() {
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const { history } = usePlayer()
  const { data: allTracks } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })
  const { followingIds } = useFollows()
  const [profile, setProfile] = useState(null)
  const [likedCount, setLikedCount] = useState(0)
  const [followers, setFollowers] = useState(0)
  const [editing, setEditing] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [followModal, setFollowModal] = useState(null) // 'followers' | 'following' | null
  const [pushPerm, setPushPerm] = useState('default')
  const [accent, setAccent] = useState(() => {
    try { return localStorage.getItem('miley_accent') || 'emerald' } catch { return 'emerald' }
  })

  useEffect(() => {
    applyAccent(accent)
  }, [accent])

  useEffect(() => {
    if (!user) return
    db.getShared('profiles', user.id).then((p) => {
      if (p) setProfile(p)
      else {
        const seed = { displayName: user.displayName || 'MiLey Listener', bio: '', avatarUrl: user.avatarUrl || '', userId: user.id }
        db.upsertShared('profiles', seed, user.id, { visibleTo: 'public' }).then(setProfile).catch(() => setProfile(seed))
      }
    }).catch(() => {})
    getLikedTracks().then((t) => setLikedCount(t.length))
    followerCount(user.id).then(setFollowers)
    try { setPushPerm(push.getPermission()) } catch (e) { /* ignore */ }
  }, [user, followingIds.size])

  const myUploads = useMemo(() => (allTracks || []).filter((t) => t.artistId === user?.id), [allTracks, user])
  const minutesListened = Math.max(1, Math.round(history.length * 3.4))

  const enablePush = async () => {
    try {
      const p = await push.requestPermission()
      setPushPerm(p)
      if (p === 'granted') await push.subscribe()
    } catch (e) { /* ignore */ }
  }

  const grad = profileThemeGrad(profile?.theme)
  const profileUrl = `https://mileymusic.space/artist/${user?.id || ''}`

  return (
    <div className="max-w-3xl mx-auto w-full pb-8">
      {/* Banner */}
      <div className="relative h-36 md:h-48 w-full overflow-hidden">
        {profile?.bannerUrl ? (
          <img src={profile.bannerUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${grad}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] via-[#0B0B0B]/30 to-transparent" />
      </div>

      <div className="px-4 md:px-8 -mt-12 relative">
        <div className="flex items-end justify-between gap-3">
          <div className={`w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br ${grad} flex items-center justify-center shrink-0 border-4 border-[#0B0B0B]`}>
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <ProfileIcon size={32} className="text-white/60" />
            )}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => setShowQR(true)} aria-label="Share QR" className="w-10 h-10 rounded-full card-surface flex items-center justify-center text-white/70">
              <QrIcon size={17} />
            </button>
            <button onClick={() => setEditing(true)} aria-label="Edit profile" className="w-10 h-10 rounded-full card-surface flex items-center justify-center text-white/70">
              <EditIcon size={16} />
            </button>
          </div>
        </div>

        <h1 className="font-display font-bold text-xl text-white mt-3 truncate">
          {profile?.displayName || user?.displayName || 'MiLey Listener'}
        </h1>
        {profile?.customUsername && (
          <p className="text-xs grad-brand-text font-medium">@{profile.customUsername}</p>
        )}
        <p className="text-xs text-white/40 truncate">{user?.email || ''}</p>
        {profile?.bio && <p className="text-sm text-white/65 mt-2">{profile.bio}</p>}

        {/* External links */}
        {Array.isArray(profile?.links) && profile.links.filter(Boolean).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {profile.links.filter(Boolean).map((l, i) => (
              <a key={i} href={l} target="_blank" rel="noreferrer" className="text-xs grad-brand-text flex items-center gap-1 card-surface px-2.5 py-1 rounded-full">
                <LinkIcon size={11} />
                <span className="truncate max-w-[160px]">{l.replace(/^https?:\/\//, '')}</span>
              </a>
            ))}
          </div>
        )}

        <div className="flex gap-5 mt-3 text-xs">
          <button onClick={() => setFollowModal('followers')} className="text-white hover:opacity-80"><b>{followers}</b> <span className="text-white/40">Followers</span></button>
          <button onClick={() => setFollowModal('following')} className="text-white hover:opacity-80"><b>{followingIds.size}</b> <span className="text-white/40">Following</span></button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Stat icon={<UploadIcon size={16} />} label="Uploads" value={myUploads.length} />
          <Stat icon={<HeartIcon size={16} />} label="Liked" value={likedCount} />
          <Stat icon={<ClockIcon size={16} />} label="Minutes" value={minutesListened} />
        </div>

        {/* Creator / social shortcuts */}
        <div className="mt-6 space-y-2">
          <button
            onClick={() => navigate('/channel-dashboard')}
            className="w-full card-surface rounded-2xl p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <ChannelIcon size={18} className="grad-brand-text" />
              <div>
                <p className="text-sm font-medium text-white">Creator Channel Studio</p>
                <p className="text-xs text-white/40">Manage your public artist or podcast channel</p>
              </div>
            </div>
            <span className="text-xs grad-brand-text font-semibold">Open →</span>
          </button>

          <button
            onClick={() => navigate('/messages')}
            className="w-full card-surface rounded-2xl p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <MessageIcon size={18} className="grad-brand-text" />
              <div>
                <p className="text-sm font-medium text-white">Encrypted Messages & Groups</p>
                <p className="text-xs text-white/40">Private DMs and group chats with friends</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/notifications')}
            className="w-full card-surface rounded-2xl p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <BellIcon size={18} className="grad-brand-text" />
              <div>
                <p className="text-sm font-medium text-white">Notifications</p>
                <p className="text-xs text-white/40">Follows, likes, channel approvals & room invites</p>
              </div>
            </div>
            <NotifCount />
          </button>

          <button
            onClick={enablePush}
            className="w-full card-surface rounded-2xl p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <BellIcon size={18} className="grad-brand-text" />
              <div>
                <p className="text-sm font-medium text-white">Push Alerts for New Releases</p>
                <p className="text-xs text-white/40">
                  {pushPerm === 'granted' ? 'Enabled on this device' : 'Get notified when artists drop tracks'}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/10 text-white/70">
              {pushPerm === 'granted' ? 'Active' : 'Enable'}
            </span>
          </button>

          {isAdmin(user) && (
            <button
              onClick={() => navigate('/admin/reports')}
              className="w-full card-surface rounded-2xl p-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <ShieldIcon size={18} className="grad-brand-text" />
                <div>
                  <p className="text-sm font-medium text-white">Moderation & Channel Review</p>
                  <p className="text-xs text-white/40">Approve channels, badges, and review reports</p>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* App Accent Theme */}
        <div className="mt-6">
          <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5"><ThemeIcon size={14} /> App Accent Color</p>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.key}
                onClick={() => setAccent(t.key)}
                className={`card-surface rounded-2xl p-3 text-left border ${
                  accent === t.key ? 'border-white/40' : 'border-transparent'
                }`}
              >
                <div
                  className="w-full h-4 rounded-full mb-2"
                  style={{ background: `linear-gradient(135deg, rgb(${t.primary}), rgb(${t.secondary}))` }}
                />
                <p className="text-xs text-white font-medium truncate">{t.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Listening Activity Timeline */}
        {history.length > 0 && (
          <div className="mt-7">
            <p className="font-display font-bold text-white mb-3">Activity Timeline</p>
            <div className="space-y-2">
              {history.slice(0, 8).map((h, i) => (
                <div key={h.id + i} className="flex items-center gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full grad-brand shrink-0" />
                  <span className="text-white/60 truncate">Played <span className="text-white">{h.title}</span></span>
                  <span className="text-white/25 text-xs ml-auto shrink-0">{timeAgo(h.playedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => auth.signOut()}
          className="w-full mt-8 py-3 rounded-2xl text-sm font-medium text-white/50 card-surface"
        >
          Sign out
        </button>
      </div>

      {editing && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(p) => { setProfile(p); setEditing(false) }}
        />
      )}
      {showQR && <QRCard url={profileUrl} name={profile?.displayName || user?.displayName || 'MiLey user'} onClose={() => setShowQR(false)} />}
      {followModal === 'followers' && <FollowListModal title="Followers" loader={() => getFollowersList(user.id)} onClose={() => setFollowModal(null)} />}
      {followModal === 'following' && <FollowListModal title="Following" loader={() => getFollowingList(user.id)} onClose={() => setFollowModal(null)} />}
    </div>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div className="card-surface rounded-2xl p-3 flex flex-col items-center gap-1">
      <div className="grad-brand-text">{icon}</div>
      <span className="font-display font-bold text-white text-lg">{value}</span>
      <span className="text-[10px] text-white/40">{label}</span>
    </div>
  )
}

function EditProfileModal({ profile, onClose, onSaved }) {
  const user = auth.getCurrentUser()
  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [customUsername, setCustomUsername] = useState(profile?.customUsername || '')
  const [links, setLinks] = useState((profile?.links && profile.links.length ? profile.links : ['']))
  const [theme, setTheme] = useState(profile?.theme || 'signature')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatarUrl || '')
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(profile?.bannerUrl || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      let avatarUrl = profile?.avatarUrl || ''
      let bannerUrl = profile?.bannerUrl || ''
      if (avatarFile) { const r = await storage.upload(avatarFile, avatarFile.name); avatarUrl = r.url }
      if (bannerFile) { const r = await storage.upload(bannerFile, bannerFile.name); bannerUrl = r.url }
      const data = {
        displayName: displayName.trim() || 'MiLey user', bio, avatarUrl, bannerUrl, userId: user.id,
        customUsername: customUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
        links: links.map((l) => l.trim()).filter(Boolean), theme,
      }
      const saved = await db.upsertShared('profiles', data, user.id, { visibleTo: 'public' })
      onSaved(saved)
    } catch (e) { /* ignore */ }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] overflow-y-auto" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white text-lg">Edit Profile</h3>
          <button onClick={onClose} className="text-white/50"><CloseIcon size={18} /></button>
        </div>

        <label className="block w-full aspect-[3/1] rounded-2xl card-surface overflow-hidden mb-4 cursor-pointer relative">
          {bannerPreview ? <img src={bannerPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">Cover Banner</div>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setBannerFile(f); setBannerPreview(URL.createObjectURL(f)) } }} />
        </label>

        <label className="w-20 h-20 rounded-full card-surface overflow-hidden mx-auto -mt-12 mb-4 block cursor-pointer border-4 border-[#141414]">
          {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">Avatar</div>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)) } }} />
        </label>

        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
        <input value={customUsername} onChange={(e) => setCustomUsername(e.target.value)} placeholder="Custom username (e.g. luna_music)" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" rows={3} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none resize-none" />

        <p className="text-xs text-white/40 mb-2">Profile links</p>
        {links.map((l, i) => (
          <input key={i} value={l} onChange={(e) => setLinks((arr) => arr.map((x, xi) => xi === i ? e.target.value : x))} placeholder="https://…" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-2 outline-none" />
        ))}
        <button onClick={() => setLinks((arr) => [...arr, ''])} className="text-xs grad-brand-text font-medium mb-4">+ Add another link</button>

        <p className="text-xs text-white/40 mb-2">Profile theme</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {PROFILE_THEMES.map((t) => (
            <button key={t.key} onClick={() => setTheme(t.key)} className={`aspect-square rounded-xl bg-gradient-to-br ${t.grad} border-2 ${theme === t.key ? 'border-white' : 'border-transparent'}`} title={t.label} />
          ))}
        </div>

        <button onClick={save} disabled={saving} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
