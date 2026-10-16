import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { realtime } from '../lib/realtime'
import { useLiveShared } from '../lib/useLive'
import { notify } from '../hooks/useNotifications'
import { useMyPermissions, setModeration, isActiveBan, logAdmin, isMainAdmin, PERMISSION_KEYS } from '../permissions'
import { sendOfficial, broadcastOfficial } from '../officialDM'
import EmptyState from '../components/EmptyState'
import { timeAgo } from '../musicHelpers'
import {
  FlagIcon, BackIcon, TrashIcon, VerifiedIcon, ChannelIcon, CheckIcon, CloseIcon,
  ChartIcon, UsersIcon, ShieldIcon, SearchIcon, LockIcon, UploadIcon, RoomIcon, PodcastIcon,
} from '../components/icons'

const TAB_DEFS = [
  { key: 'dashboard', label: 'Dashboard', perm: 'dashboard' },
  { key: 'requests', label: 'Channel Requests', perm: 'channelApproval' },
  { key: 'verify', label: 'Verification', perm: 'verificationApproval' },
  { key: 'users', label: 'Users', perm: 'userManagement' },
  { key: 'reports', label: 'Reports', perm: 'reports' },
  { key: 'announce', label: 'Announcements', perm: 'notifications' },
  { key: 'staff', label: 'Sub-Admins', perm: 'main' },
  { key: 'log', label: 'Activity Log', perm: 'dashboard' },
]

export default function AdminReports() {
  const navigate = useNavigate()
  const { role, perms, isAdminish } = useMyPermissions()

  const tabs = useMemo(() => TAB_DEFS.filter((t) => t.perm === 'main' ? role === 'main' : !!perms[t.perm]), [role, perms])
  const [tab, setTab] = useState(null)
  useEffect(() => { if (tabs.length && (!tab || !tabs.find((t) => t.key === tab))) setTab(tabs[0].key) }, [tabs, tab])

  if (!isAdminish) {
    return <div className="h-full flex items-center justify-center text-white/40 text-sm px-8 text-center">This area is restricted to MiLey administrators.</div>
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-4 md:px-6 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] pb-10">
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => navigate(-1)} className="text-white/60 md:hidden"><BackIcon size={20} /></button>
        <ShieldIcon size={22} className="grad-brand-text" />
        <h1 className="font-display font-bold text-xl text-white">{role === 'main' ? 'Admin Control Center' : role === 'prachi' ? 'Channel Moderation' : 'Moderation Panel'}</h1>
      </div>
      <p className="text-xs text-white/35 mb-5">{role === 'main' ? 'Full platform administration' : role === 'prachi' ? 'Approve or reject channel creation requests' : 'Delegated moderation access'}</p>

      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar overscroll-x-contain">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-full text-sm font-medium shrink-0 ${tab === t.key ? 'btn-brand text-black' : 'card-surface text-white/60'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'requests' && <ChannelRequestsTab />}
      {tab === 'verify' && <VerificationTab />}
      {tab === 'users' && <UsersTab canBan={!!perms.ban} />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'announce' && <AnnouncementsTab />}
      {tab === 'staff' && <StaffTab />}
      {tab === 'log' && <ActivityLogTab />}
    </div>
  )
}

// ── Dashboard ──
function StatCard({ icon, label, value, accent }) {
  return (
    <div className="card-surface rounded-2xl p-4 flex flex-col gap-1.5">
      <div className={`flex items-center gap-1.5 ${accent ? 'grad-brand-text' : 'text-white/40'}`}>{icon}<span className="text-[11px] text-white/40 font-medium">{label}</span></div>
      <span className="font-display font-bold text-white text-2xl">{value}</span>
    </div>
  )
}

function DashboardTab() {
  const { data: channels } = useLiveShared('channels', { limit: 500 })
  const { data: rooms } = useLiveShared('rooms', { limit: 200 })
  const { data: reports } = useLiveShared('reports', { limit: 300 })
  const { data: tracks } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })
  const { data: profiles } = useLiveShared('profiles', { order: '-createdAt', limit: 300 })
  const { data: mods } = useLiveShared('user_moderation', { limit: 500 })
  const [online, setOnline] = useState(1)

  useEffect(() => {
    const p = realtime.presence('miley-global', { name: auth.getCurrentUser()?.displayName || 'user' })
    p.onSync((users) => setOnline(users.length || 1))
    return () => p.leave?.()
  }, [])

  const activeRooms = (rooms || []).filter((r) => !r.ended)
  const pendingChannels = (channels || []).filter((c) => c.status === 'pending')
  const verifyReqs = (channels || []).filter((c) => c.verificationRequested && !c.verified)
  const activeBans = (mods || []).filter(isActiveBan)
  const permBans = activeBans.filter((m) => !m.banUntil)
  const tempBans = activeBans.filter((m) => m.banUntil)

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon={<UsersIcon size={15} />} label="Online now" value={online} accent />
        <StatCard icon={<UsersIcon size={15} />} label="Accounts" value={(profiles || []).length} />
        <StatCard icon={<RoomIcon size={15} />} label="Active rooms" value={activeRooms.length} accent />
        <StatCard icon={<RoomIcon size={15} />} label="Total rooms" value={(rooms || []).length} />
        <StatCard icon={<ChannelIcon size={15} />} label="Channels" value={(channels || []).length} />
        <StatCard icon={<ChannelIcon size={15} />} label="Pending channels" value={pendingChannels.length} accent />
        <StatCard icon={<UploadIcon size={15} />} label="Songs" value={(tracks || []).length} />
        <StatCard icon={<VerifiedIcon size={15} />} label="Verify requests" value={verifyReqs.length} />
        <StatCard icon={<FlagIcon size={15} />} label="Open reports" value={(reports || []).length} />
        <StatCard icon={<LockIcon size={15} />} label="Permanent bans" value={permBans.length} />
        <StatCard icon={<LockIcon size={15} />} label="Temp bans" value={tempBans.length} />
      </div>

      <h3 className="font-display font-bold text-white mt-7 mb-3">Recently created accounts</h3>
      <div className="space-y-2">
        {(profiles || []).slice(0, 6).map((p) => (
          <div key={p.id} className="card-surface rounded-xl p-3 flex items-center gap-3">
            <Avatar url={p.avatarUrl} name={p.displayName} />
            <span className="text-sm text-white truncate flex-1">{p.displayName || 'MiLey user'}</span>
            <span className="text-[11px] text-white/30">{timeAgo(p.createdAt)}</span>
          </div>
        ))}
        {(!profiles || profiles.length === 0) && <p className="text-xs text-white/30">No accounts yet.</p>}
      </div>

      <h3 className="font-display font-bold text-white mt-7 mb-3">Recently uploaded songs</h3>
      <div className="space-y-2">
        {(tracks || []).slice(0, 6).map((t) => (
          <div key={t.id} className="card-surface rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/30 to-pink-500/30 overflow-hidden shrink-0">{t.coverUrl && <img src={t.coverUrl} className="w-full h-full object-cover" />}</div>
            <div className="min-w-0 flex-1"><p className="text-sm text-white truncate">{t.title}</p><p className="text-[11px] text-white/40 truncate">{t.artistName}</p></div>
            <span className="text-[11px] text-white/30 shrink-0">{timeAgo(t.createdAt)}</span>
          </div>
        ))}
        {(!tracks || tracks.length === 0) && <p className="text-xs text-white/30">No songs uploaded yet.</p>}
      </div>
    </div>
  )
}

function Avatar({ url, name, size = 36 }) {
  return (
    <div className="rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/40 to-pink-500/40 flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      {url ? <img src={url} className="w-full h-full object-cover" /> : <span className="font-display font-bold text-white/70 text-sm">{(name || '?')[0]}</span>}
    </div>
  )
}

// ── Channel creation requests ──
function ChannelRequestsTab() {
  const { data: channels, refetch } = useLiveShared('channels', { order: '-createdAt', limit: 500 })
  const pending = (channels || []).filter((c) => c.status === 'pending')

  const decide = async (c, approve) => {
    await db.updateShared('channels', c.id, { status: approve ? 'approved' : 'rejected' }).catch(() => {})
    await logAdmin(approve ? 'channel_approved' : 'channel_rejected', { channelId: c.id, name: c.name, username: c.username })
    notify(c.ownerId, approve
      ? { type: 'channel', title: 'Channel approved ✓', body: `${c.name} is live — you can now upload music.`, url: '/channel-dashboard' }
      : { type: 'channel', title: 'Channel not approved', body: `Your channel ${c.name} wasn't approved. Update details and resubmit.`, url: '/channel-dashboard' })
    await sendOfficial(c.ownerId, approve
      ? { title: 'Your channel is approved 🎉', body: `Congratulations! ${c.name} (@${c.username}) is now live on MiLey. You can start uploading and sharing your music with the world.`, actionLabel: 'Open Channel Studio', actionUrl: '/channel-dashboard', banner: c.bannerUrl || '' }
      : { title: 'Channel request update', body: `We reviewed your channel ${c.name} (@${c.username}) and it wasn't approved this time.`, reason: 'Please review your channel details and imagery, then resubmit for another review.', actionLabel: 'Update & Resubmit', actionUrl: '/channel-dashboard' })
    refetch()
  }

  if (pending.length === 0) return <EmptyState icon={<ChannelIcon size={24} className="grad-brand-text" />} title="No pending channel requests" subtitle="New channel creation requests will appear here for approval." />

  return (
    <div className="space-y-3">
      {pending.map((c) => (
        <div key={c.id} className="card-surface rounded-2xl overflow-hidden">
          {c.bannerUrl && <img src={c.bannerUrl} className="w-full h-24 object-cover" />}
          <div className="p-4">
            <div className="flex items-center gap-3">
              <Avatar url={c.avatarUrl} name={c.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white font-semibold truncate">{c.name}</p>
                <p className="text-xs text-white/40 truncate">@{c.username} · {c.category}{c.language ? ` · ${c.language}` : ''}{c.country ? ` · ${c.country}` : ''}</p>
              </div>
            </div>
            {c.description && <p className="text-xs text-white/60 mt-3">{c.description}</p>}
            <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] text-white/40">
              <p>Owner: <span className="text-white/70">{c.ownerName || '—'}</span></p>
              <p>Email: <span className="text-white/70 break-all">{c.ownerEmail || c.contact || '—'}</span></p>
              <p>Submitted: <span className="text-white/70">{new Date(c.createdAt).toLocaleDateString()}</span></p>
              {c.verificationRequested && <p className="grad-brand-text">Verification requested</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => decide(c, true)} className="flex-1 btn-brand text-black font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5"><CheckIcon size={15} color="#0B0B0B" /> Approve</button>
              <button onClick={() => decide(c, false)} className="flex-1 card-surface text-white/70 font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5"><CloseIcon size={15} /> Reject</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Verification ──
function VerificationTab() {
  const { data: channels, refetch } = useLiveShared('channels', { order: '-createdAt', limit: 500 })
  const requests = (channels || []).filter((c) => c.verificationRequested && !c.verified)
  const verified = (channels || []).filter((c) => c.verified)

  const approve = async (c) => {
    await db.updateShared('channels', c.id, { verified: true, verificationRequested: false, verificationRejected: false }).catch(() => {})
    await logAdmin('verification_approved', { channelId: c.id, name: c.name })
    notify(c.ownerId, { type: 'channel', title: 'Channel verified ✓', body: `${c.name} is now verified on MiLey`, url: `/channel/${c.username}` })
    await sendOfficial(c.ownerId, { title: 'You’re verified ✓', body: `${c.name} now carries the green verified badge across MiLey. This badge appears beside your channel name everywhere on the platform.`, actionLabel: 'View Channel', actionUrl: `/channel/${c.username}` })
    refetch()
  }
  const reject = async (c) => {
    await db.updateShared('channels', c.id, { verificationRequested: false, verificationRejected: true }).catch(() => {})
    await logAdmin('verification_rejected', { channelId: c.id, name: c.name })
    notify(c.ownerId, { type: 'channel', title: 'Verification declined', body: `Your request for ${c.name} wasn't approved this time.`, url: '/channel-dashboard' })
    await sendOfficial(c.ownerId, { title: 'Verification request update', body: `We reviewed the verification request for ${c.name}.`, reason: 'Your channel didn’t meet the verification criteria this time. Keep growing your audience and content, then request again later.', actionLabel: 'Open Channel Studio', actionUrl: '/channel-dashboard' })
    refetch()
  }
  const revoke = async (c) => {
    await db.updateShared('channels', c.id, { verified: false }).catch(() => {})
    await logAdmin('verification_revoked', { channelId: c.id, name: c.name })
    refetch()
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-white mb-2">Pending requests</h3>
      {requests.length === 0 && <p className="text-xs text-white/30 mb-4">No verification requests right now.</p>}
      <div className="space-y-2 mb-6">
        {requests.map((c) => (
          <div key={c.id} className="card-surface rounded-2xl p-4 flex items-center gap-3">
            <Avatar url={c.avatarUrl} name={c.name} size={44} />
            <div className="min-w-0 flex-1"><p className="text-sm text-white font-medium truncate">{c.name}</p><p className="text-xs text-white/40 truncate">@{c.username} · {c.category}</p></div>
            <button onClick={() => approve(c)} className="w-9 h-9 rounded-full btn-brand flex items-center justify-center shrink-0"><CheckIcon size={15} color="#0B0B0B" /></button>
            <button onClick={() => reject(c)} className="w-9 h-9 rounded-full card-surface flex items-center justify-center text-white/50 shrink-0"><CloseIcon size={15} /></button>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-white mb-2">Verified channels</h3>
      {verified.length === 0 && <p className="text-xs text-white/30">No verified channels yet.</p>}
      <div className="space-y-2">
        {verified.map((c) => (
          <div key={c.id} className="card-surface rounded-2xl p-3 flex items-center gap-3">
            <Avatar url={c.avatarUrl} name={c.name} size={38} />
            <div className="min-w-0 flex-1 flex items-center gap-1"><p className="text-sm text-white font-medium truncate">{c.name}</p><VerifiedIcon size={14} className="grad-brand-text shrink-0" /></div>
            <button onClick={() => revoke(c)} className="text-xs text-white/40 px-2 shrink-0">Revoke</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Users ──
function UsersTab({ canBan }) {
  const { data: profiles } = useLiveShared('profiles', { order: '-createdAt', limit: 500 })
  const { data: channels } = useLiveShared('channels', { limit: 500 })
  const { data: mods } = useLiveShared('user_moderation', { limit: 500 })
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)

  const modMap = useMemo(() => { const m = {}; for (const x of (mods || [])) m[x.userId] = x; return m }, [mods])
  const channelMap = useMemo(() => { const m = {}; for (const c of (channels || [])) m[c.ownerId] = c; return m }, [channels])

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (profiles || []).filter((p) => !term || (p.displayName || '').toLowerCase().includes(term) || (p.customUsername || '').toLowerCase().includes(term))
  }, [profiles, q])

  return (
    <div>
      <div className="flex items-center gap-2 card-surface rounded-2xl px-3 py-2.5 mb-4">
        <SearchIcon size={15} className="text-white/40 shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users by name or username…" className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30" />
      </div>
      <div className="space-y-2">
        {list.map((p) => {
          const mod = modMap[p.userId || p.id]
          const banned = isActiveBan(mod)
          return (
            <button key={p.id} onClick={() => setSelected(p)} className="w-full card-surface rounded-2xl p-3 flex items-center gap-3 text-left">
              <Avatar url={p.avatarUrl} name={p.displayName} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{p.displayName || 'MiLey user'}</p>
                <p className="text-[11px] text-white/40 truncate">{p.customUsername ? `@${p.customUsername}` : (p.userId || p.id).slice(0, 8)}{channelMap[p.userId || p.id] ? ' · has channel' : ''}</p>
              </div>
              {banned && <span className="text-[10px] font-semibold text-red-400 shrink-0">BANNED</span>}
              {mod?.muted && !banned && <span className="text-[10px] font-semibold text-yellow-400 shrink-0">MUTED</span>}
            </button>
          )
        })}
        {list.length === 0 && <p className="text-xs text-white/30">No users match.</p>}
      </div>
      {selected && <UserActionSheet profile={selected} mod={modMap[selected.userId || selected.id]} channel={channelMap[selected.userId || selected.id]} canBan={canBan} onClose={() => setSelected(null)} />}
    </div>
  )
}

// Official-DM copy for moderation actions, so the affected user gets a clear,
// formatted notice from MiLey explaining what happened.
const MOD_MESSAGES = {
  user_banned: { title: 'Your account has been suspended', body: 'Your MiLey account has been permanently suspended following a review.', reason: 'Violation of MiLey community guidelines.', actionLabel: 'Contact Support', actionUrl: '/' },
  user_temp_banned: (d) => ({ title: 'Your account has been temporarily restricted', body: `Your MiLey account is restricted for ${d?.days || 'a few'} day(s).`, reason: 'Temporary restriction following a community guidelines review. Access is restored automatically when the period ends.' }),
  user_unbanned: { title: 'Your account has been reinstated', body: 'Welcome back — your MiLey account restrictions have been lifted. Please continue to follow our community guidelines.' },
  user_muted: { title: 'You have been muted', body: 'An admin has muted your account. You can still browse, but some interactions are limited for now.', reason: 'Community guidelines review.' },
  user_unmuted: { title: 'You can post again', body: 'Your mute has been lifted. Thanks for keeping MiLey a great place.' },
  uploads_suspended: { title: 'Uploads suspended', body: 'Your ability to upload music has been suspended pending a review.', reason: 'Content or copyright review.', actionLabel: 'Contact Support', actionUrl: '/' },
  uploads_restored: { title: 'Uploads restored', body: 'You can upload music again. Thanks for your patience.' },
  channel_suspended: { title: 'Your channel has been suspended', body: 'Your channel has been suspended and is temporarily hidden from MiLey.', reason: 'Community or content guidelines review.', actionLabel: 'Contact Support', actionUrl: '/' },
  channel_restored: { title: 'Your channel is active again', body: 'Your channel has been restored and is visible on MiLey once more.' },
}

function UserActionSheet({ profile, mod, channel, canBan, onClose }) {
  const uid = profile.userId || profile.id
  const banned = isActiveBan(mod)
  const [busy, setBusy] = useState(false)

  const run = async (label, patch, detail) => {
    setBusy(true)
    await setModeration(uid, patch)
    await logAdmin(label, { userId: uid, name: profile.displayName, ...detail })
    const mod = MOD_MESSAGES[label]
    if (mod) await sendOfficial(uid, typeof mod === 'function' ? mod(detail) : mod)
    setBusy(false)
    onClose()
  }
  const tempBan = async () => {
    const days = Number(prompt('Ban duration in days?', '3'))
    if (!days || days <= 0) return
    const until = new Date(Date.now() + days * 86400000).toISOString()
    await run('user_temp_banned', { banned: true, banUntil: until }, { days })
  }
  const verifyChannel = async (val) => {
    if (!channel) return
    setBusy(true)
    await db.updateShared('channels', channel.id, { verified: val, verificationRequested: false }).catch(() => {})
    await logAdmin(val ? 'verification_approved' : 'verification_revoked', { channelId: channel.id, name: channel.name })
    if (val) {
      notify(channel.ownerId, { type: 'channel', title: 'Channel verified ✓', body: `${channel.name} is now verified`, url: `/channel/${channel.username}` })
      await sendOfficial(channel.ownerId, { title: 'You’re verified ✓', body: `${channel.name} now carries the green verified badge across MiLey.`, actionLabel: 'View Channel', actionUrl: `/channel/${channel.username}` })
    }
    setBusy(false); onClose()
  }
  const resetPw = async () => {
    await logAdmin('password_reset_requested', { userId: uid })
    notify(uid, { type: 'system', title: 'Password reset requested', body: 'An admin asked you to reset your password. Use "Forgot password" on the sign-in screen.', url: '/' })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] overflow-y-auto" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <div className="flex items-center gap-3 mb-4">
          <Avatar url={profile.avatarUrl} name={profile.displayName} size={44} />
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white truncate">{profile.displayName || 'MiLey user'}</p><p className="text-[11px] text-white/40 truncate">{profile.customUsername ? `@${profile.customUsername}` : uid.slice(0, 12)}</p></div>
          <button onClick={onClose} className="text-white/50"><CloseIcon size={18} /></button>
        </div>

        <div className="space-y-1">
          {canBan && (banned ? (
            <Action label="Unban user" onClick={() => run('user_unbanned', { banned: false, banUntil: null })} disabled={busy} />
          ) : (
            <>
              <Action label="Permanent ban" danger onClick={() => run('user_banned', { banned: true, banUntil: null })} disabled={busy} />
              <Action label="Temporary ban…" danger onClick={tempBan} disabled={busy} />
            </>
          ))}
          <Action label={mod?.muted ? 'Unmute user' : 'Mute user'} onClick={() => run(mod?.muted ? 'user_unmuted' : 'user_muted', { muted: !mod?.muted })} disabled={busy} />
          <Action label={mod?.uploadsSuspended ? 'Restore uploads' : 'Suspend uploads'} onClick={() => run('uploads_' + (mod?.uploadsSuspended ? 'restored' : 'suspended'), { uploadsSuspended: !mod?.uploadsSuspended })} disabled={busy} />
          {channel && <Action label={mod?.channelSuspended ? 'Restore channel' : 'Suspend channel'} onClick={() => run('channel_' + (mod?.channelSuspended ? 'restored' : 'suspended'), { channelSuspended: !mod?.channelSuspended })} disabled={busy} />}
          {channel && (channel.verified
            ? <Action label="Revoke verification" onClick={() => verifyChannel(false)} disabled={busy} />
            : <Action label="Verify channel" onClick={() => verifyChannel(true)} disabled={busy} />)}
          <Action label="Request password reset" onClick={resetPw} disabled={busy} />
          {canBan && <Action label="Delete account (block + purge access)" danger onClick={() => run('account_deleted', { deleted: true, banned: true, banUntil: null })} disabled={busy} />}
        </div>
      </div>
    </div>
  )
}

function Action({ label, onClick, danger, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`w-full text-left px-3 py-3 rounded-xl text-sm font-medium hover:bg-white/5 disabled:opacity-40 ${danger ? 'text-red-400' : 'text-white'}`}>{label}</button>
  )
}

// ── Reports ──
function ReportsTab() {
  const { data: reports, refetch } = useLiveShared('reports', { order: '-createdAt', limit: 300 })
  const dismiss = async (id) => { await db.deleteShared('reports', id).catch(() => {}); await logAdmin('report_dismissed', { id }); refetch() }
  if (!reports || reports.length === 0) return <EmptyState icon={<FlagIcon size={24} className="grad-brand-text" />} title="No reports" subtitle="Content and chat reports filed by users appear here." />
  return (
    <div className="space-y-2">
      {reports.map((r) => (
        <div key={r.id} className="card-surface rounded-2xl p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-white font-medium capitalize">{r.targetType || r.type || 'content'} report {r.targetName ? `· ${r.targetName}` : ''}</p>
            <p className="text-xs text-white/60">{r.reason || 'Reported by user'}{r.notes ? ` — ${r.notes}` : ''}</p>
            <p className="text-[10px] text-white/25 mt-1">{timeAgo(r.createdAt)}</p>
          </div>
          <button onClick={() => dismiss(r.id)} className="p-2 text-white/40 shrink-0"><TrashIcon size={16} /></button>
        </div>
      ))}
    </div>
  )
}

// ── Announcements ──
function AnnouncementsTab() {
  const { data: profiles } = useLiveShared('profiles', { order: '-createdAt', limit: 1000 })
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [banner, setBanner] = useState('')
  const [actionLabel, setActionLabel] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const recipientIds = useMemo(() => [...new Set((profiles || []).map((p) => p.userId || p.id).filter(Boolean))], [profiles])
  const canSend = title.trim().length > 1 && body.trim().length > 1 && recipientIds.length > 0

  const send = async () => {
    if (!canSend || sending) return
    setSending(true)
    try {
      const count = await broadcastOfficial(recipientIds, {
        title: title.trim(),
        body: body.trim(),
        banner: banner.trim(),
        actionLabel: actionLabel.trim(),
        actionUrl: actionUrl.trim() || (actionLabel.trim() ? '/' : ''),
      })
      await logAdmin('announcement_sent', { title: title.trim(), count })
      setResult({ ok: true, count })
      setTitle(''); setBody(''); setBanner(''); setActionLabel(''); setActionUrl('')
    } catch (e) {
      setResult({ ok: false })
    } finally {
      setSending(false); setConfirming(false)
    }
  }

  const field = 'w-full bg-transparent outline-none text-sm text-white placeholder-white/30 card-surface rounded-2xl px-4 py-3'

  return (
    <div className="space-y-3">
      <div className="card-surface rounded-2xl p-4">
        <p className="text-sm text-white font-medium mb-1">Broadcast an official update</p>
        <p className="text-[11px] text-white/40">Delivered as a formatted Direct Message from the verified MiLey channel to all {recipientIds.length} members, with a push notification.</p>
      </div>

      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. New feature: Voice Room themes)" className={field} maxLength={80} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body…" rows={4} className={`${field} resize-none`} maxLength={600} />
      <input value={banner} onChange={(e) => setBanner(e.target.value)} placeholder="Banner image URL (optional)" className={field} />
      <div className="flex gap-2">
        <input value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} placeholder="Button label (optional)" className={field} maxLength={30} />
        <input value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} placeholder="Button link (e.g. /explore)" className={field} />
      </div>

      {banner.trim() && (
        <img src={banner.trim()} alt="" className="w-full h-32 object-cover rounded-2xl" onError={(e) => { e.currentTarget.style.display = 'none' }} />
      )}

      {result && (
        <div className={`rounded-2xl px-4 py-3 text-sm ${result.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
          {result.ok ? `Announcement delivered to ${result.count} members.` : 'Something went wrong sending the announcement.'}
        </div>
      )}

      {!confirming ? (
        <button onClick={() => { setResult(null); setConfirming(true) }} disabled={!canSend} className={`w-full py-3 rounded-2xl font-semibold ${canSend ? 'btn-brand text-black' : 'card-surface text-white/30'}`}>
          Send announcement
        </button>
      ) : (
        <div className="card-surface rounded-2xl p-4 space-y-3">
          <p className="text-sm text-white">Send this to all {recipientIds.length} members? This can't be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className="flex-1 py-2.5 rounded-xl card-surface text-white/60 text-sm">Cancel</button>
            <button onClick={send} disabled={sending} className="flex-1 py-2.5 rounded-xl btn-brand text-black font-semibold text-sm">{sending ? 'Sending…' : 'Confirm & send'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-Admins ──
function StaffTab() {
  const { data: staff, refetch } = useLiveShared('staff', { limit: 200 })
  const { data: profiles } = useLiveShared('profiles', { order: '-createdAt', limit: 500 })
  const [q, setQ] = useState('')
  const [editRec, setEditRec] = useState(null)

  const staffIds = new Set((staff || []).map((s) => s.userId))
  const candidates = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return (profiles || []).filter((p) => !staffIds.has(p.userId || p.id) && ((p.displayName || '').toLowerCase().includes(term) || (p.customUsername || '').toLowerCase().includes(term))).slice(0, 6)
  }, [profiles, q, staff])

  const promote = async (p) => {
    const uid = p.userId || p.id
    const rec = await db.insertShared('staff', { userId: uid, name: p.displayName || 'MiLey user', permissions: { moderation: true, reports: true } }, undefined, { visibleTo: 'public' }).catch(() => null)
    await logAdmin('subadmin_added', { userId: uid, name: p.displayName })
    notify(uid, { type: 'system', title: 'You are now a Sub-Admin', body: 'An admin granted you moderation access on MiLey.', url: '/admin/reports' })
    setQ('')
    if (rec) setEditRec(rec)
    refetch()
  }
  const remove = async (rec) => {
    await db.deleteShared('staff', rec.id).catch(() => {})
    await logAdmin('subadmin_removed', { userId: rec.userId, name: rec.name })
    refetch()
  }

  return (
    <div>
      <p className="text-xs text-white/40 mb-2">Promote a user to Sub-Admin, then fine-tune their permissions.</p>
      <div className="flex items-center gap-2 card-surface rounded-2xl px-3 py-2.5 mb-2">
        <SearchIcon size={15} className="text-white/40 shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a user to promote…" className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30" />
      </div>
      {candidates.length > 0 && (
        <div className="card-surface rounded-2xl mb-4 overflow-hidden">
          {candidates.map((p) => (
            <button key={p.id} onClick={() => promote(p)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left">
              <Avatar url={p.avatarUrl} name={p.displayName} size={32} />
              <span className="text-sm text-white flex-1 truncate">{p.displayName || 'MiLey user'}</span>
              <span className="text-xs grad-brand-text font-medium">Promote</span>
            </button>
          ))}
        </div>
      )}

      <h3 className="text-sm font-semibold text-white mt-4 mb-2">Current sub-admins</h3>
      {(!staff || staff.length === 0) && <p className="text-xs text-white/30">No sub-admins yet.</p>}
      <div className="space-y-2">
        {(staff || []).map((s) => (
          <div key={s.id} className="card-surface rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <Avatar url={s.avatarUrl} name={s.name} size={38} />
              <div className="min-w-0 flex-1"><p className="text-sm text-white truncate">{s.name}</p><p className="text-[11px] text-white/40">{Object.values(s.permissions || {}).filter(Boolean).length} permissions</p></div>
              <button onClick={() => setEditRec(s)} className="text-xs grad-brand-text font-medium px-2">Edit</button>
              <button onClick={() => remove(s)} className="text-white/30 p-1"><TrashIcon size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      {editRec && <PermissionEditor rec={editRec} onClose={() => setEditRec(null)} onSaved={() => { setEditRec(null); refetch() }} />}
    </div>
  )
}

function PermissionEditor({ rec, onClose, onSaved }) {
  const [perms, setPerms] = useState(rec.permissions || {})
  const [saving, setSaving] = useState(false)
  const toggle = (k) => setPerms((p) => ({ ...p, [k]: !p[k] }))
  const save = async () => {
    setSaving(true)
    await db.updateShared('staff', rec.id, { permissions: perms }).catch(() => {})
    await logAdmin('subadmin_permissions_updated', { userId: rec.userId, name: rec.name })
    setSaving(false)
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] overflow-y-auto" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <div className="flex items-center justify-between mb-4"><h3 className="font-display font-bold text-white text-lg">{rec.name} · Permissions</h3><button onClick={onClose} className="text-white/50"><CloseIcon size={18} /></button></div>
        <div className="space-y-1 mb-4">
          {PERMISSION_KEYS.map((p) => (
            <button key={p.key} onClick={() => toggle(p.key)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5">
              <span className="text-sm text-white">{p.label}</span>
              <span className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${perms[p.key] ? 'grad-brand justify-end' : 'bg-white/10 justify-start'}`}><span className="w-5 h-5 rounded-full bg-white" /></span>
            </button>
          ))}
        </div>
        <button onClick={save} disabled={saving} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save Permissions'}</button>
      </div>
    </div>
  )
}

// ── Activity log ──
function ActivityLogTab() {
  const { data: log } = useLiveShared('admin_log', { order: '-createdAt', limit: 200 })
  if (!log || log.length === 0) return <EmptyState icon={<ChartIcon size={24} className="grad-brand-text" />} title="No activity yet" subtitle="Every admin and sub-admin action is recorded here." />
  return (
    <div className="space-y-1.5">
      {log.map((e) => (
        <div key={e.id} className="card-surface rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white"><span className="grad-brand-text font-medium">{e.actorName}</span> · {(e.action || '').replace(/_/g, ' ')}</p>
            {e.detail?.name && <p className="text-[11px] text-white/40 truncate">{e.detail.name}{e.detail.days ? ` · ${e.detail.days}d` : ''}</p>}
          </div>
          <span className="text-[11px] text-white/25 shrink-0">{timeAgo(e.createdAt)}</span>
        </div>
      ))}
    </div>
  )
}
