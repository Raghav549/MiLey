import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { messaging } from '../lib/messaging'
import { useLiveShared } from '../lib/useLive'
import { useFollows, followerCount, followingCount, getFollowersList, getFollowingList } from '../hooks/useFollows'
import { notify } from '../hooks/useNotifications'
import { TrackRow, Cover } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import FollowListModal from '../components/FollowListModal'
import { BackIcon, ProfileIcon, MessageIcon, ChannelIcon, ChartIcon, VerifiedIcon, SendIcon, SparkleIcon } from '../components/icons'
import { isPublicVisible, timeAgo } from '../musicHelpers'

export default function ArtistProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const me = auth.getCurrentUser()
  const [profile, setProfile] = useState(null)
  const [channel, setChannel] = useState(null)
  const [followers, setFollowers] = useState(0)
  const [followingTotal, setFollowingTotal] = useState(0)
  const [showFollowModal, setShowFollowModal] = useState(null) // 'followers' | 'following' | null
  const [shoutoutText, setShoutoutText] = useState('')
  const [supportToast, setSupportToast] = useState('')

  const { data: allTracks } = useLiveShared('tracks', { order: '-createdAt', limit: 400 })
  const { data: allAlbums } = useLiveShared('albums', { order: '-createdAt', limit: 100 })
  const { data: shoutouts } = useLiveShared('artist_shoutouts', { order: '-createdAt', limit: 50 })
  const { isFollowing, toggleFollow, followingIds } = useFollows()

  useEffect(() => {
    if (!id) return
    db.getShared('profiles', id).then((p) => {
      if (p) setProfile(p)
      else {
        const trackMatch = (allTracks || []).find((t) => t.artistId === id)
        if (trackMatch) {
          setProfile({ id, userId: id, displayName: trackMatch.artistName || 'MiLey Artist', bio: 'Official artist on mileymusic.space', verified: true })
        }
      }
    }).catch(() => {})
    db.selectShared('channels', { ownerId: id }, { limit: 1 }).then((r) => setChannel(r[0] || null)).catch(() => {})
  }, [id, allTracks])

  useEffect(() => {
    if (!id) return
    followerCount(id).then(setFollowers)
    followingCount(id).then(setFollowingTotal)
  }, [id, followingIds.size])

  const tracks = useMemo(() => (allTracks || []).filter((t) => t.artistId === id && isPublicVisible(t)), [allTracks, id])
  const albums = useMemo(() => (allAlbums || []).filter((a) => a.artistId === id && (!a.visibility || a.visibility === 'public')), [allAlbums, id])
  const artistShoutouts = useMemo(() => (shoutouts || []).filter((s) => (s.artistId || s.artist_id) === id), [shoutouts, id])
  const totalPlays = useMemo(() => tracks.reduce((sum, t) => sum + (t.plays || 0), 0), [tracks])

  const following = isFollowing(id)
  const isMe = me?.id === id

  const messageUser = async () => {
    if (isMe) return
    const ch = await messaging.createDM(id)
    navigate(`/chat/${ch.id}`)
  }

  const handleFollowToggle = async () => {
    const nowFollowing = await toggleFollow(id, 'artist', profile?.displayName || tracks[0]?.artistName || 'MiLey Artist', profile?.avatarUrl || '')
    const updatedCount = await followerCount(id)
    setFollowers(updatedCount)
    if (nowFollowing) {
      notify(id, { type: 'follow', title: 'New follower', body: `${me?.displayName || 'Someone'} started following you`, url: `/artist/${me?.id}` })
    }
  }

  const postShoutout = async (e) => {
    e.preventDefault()
    if (!shoutoutText.trim() || !me) return
    await db.insertShared('artist_shoutouts', {
      artistId: id,
      userId: me.id,
      userName: me.displayName || 'MiLey Fan',
      userAvatar: me.avatarUrl || '',
      message: shoutoutText.trim(),
    }, undefined, { visibleTo: 'public' })
    setShoutoutText('')
  }

  const sendSupport = (tier) => {
    setSupportToast(`Sent ${tier} support to ${profile?.displayName || 'Artist'}!`)
    setTimeout(() => setSupportToast(''), 3000)
  }

  return (
    <div className="max-w-4xl mx-auto w-full pb-8">
      <div className="relative h-40 md:h-56 w-full">
        {profile?.bannerUrl ? <img src={profile.bannerUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 to-pink-500/20" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"><BackIcon size={20} /></button>
      </div>

      <div className="px-5 -mt-12 relative">
        <div className="flex items-end justify-between">
          <div className="w-24 h-24 rounded-full border-4 border-[#0B0B0B] overflow-hidden bg-gradient-to-br from-emerald-500/40 to-pink-500/40 flex items-center justify-center">
            {profile?.avatarUrl ? <img src={profile.avatarUrl} className="w-full h-full object-cover" /> : <ProfileIcon size={30} className="text-white/60" />}
          </div>
          {!isMe && (
            <div className="flex gap-2 mb-1">
              <button onClick={messageUser} className="w-11 h-11 rounded-full card-surface flex items-center justify-center text-white"><MessageIcon size={17} /></button>
              <button
                onClick={handleFollowToggle}
                className={`px-5 py-2.5 rounded-2xl text-sm font-semibold ${following ? 'card-surface text-white' : 'btn-brand text-black'}`}
              >
                {following ? 'Following' : 'Follow'}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          <h1 className="font-display font-bold text-xl text-white">{profile?.displayName || tracks[0]?.artistName || 'MiLey user'}</h1>
          {(profile?.verified || channel?.verified) && <VerifiedIcon size={17} className="grad-brand-text" />}
        </div>
        {profile?.bio && <p className="text-sm text-white/50 mt-1 max-w-lg">{profile.bio}</p>}
        {channel && (
          <button onClick={() => navigate(`/channel/${channel.username}`)} className="mt-2 text-xs grad-brand-text font-medium flex items-center gap-1"><ChannelIcon size={13} /> Visit @{channel.username} channel</button>
        )}

        <div className="flex flex-wrap gap-5 mt-4 text-sm">
          <button onClick={() => setShowFollowModal('followers')} className="text-white hover:opacity-80"><b>{followers}</b> <span className="text-white/40">Followers</span></button>
          <button onClick={() => setShowFollowModal('following')} className="text-white hover:opacity-80"><b>{followingTotal}</b> <span className="text-white/40">Following</span></button>
          <span className="text-white"><b>{tracks.length}</b> <span className="text-white/40">Uploads</span></span>
          <span className="text-white flex items-center gap-1"><ChartIcon size={13} className="text-white/40" /><b>{totalPlays}</b> <span className="text-white/40">Plays</span></span>
        </div>

        {supportToast && (
          <div className="mt-4 card-surface rounded-2xl px-4 py-2.5 text-xs grad-brand-text font-semibold">
            {supportToast}
          </div>
        )}

        {albums.length > 0 && (
          <div className="mt-7">
            <p className="font-display font-bold text-white mb-3">Albums</p>
            <div className="flex gap-3 overflow-x-auto no-scrollbar overscroll-x-contain">
              {albums.map((a) => (
                <button key={a.id} onClick={() => navigate(`/album/${a.id}`)} className="shrink-0 w-32 text-left">
                  <div className="relative aspect-square"><Cover track={{ title: a.title, coverUrl: a.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                  <p className="mt-1.5 text-sm text-white truncate">{a.title}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-7">
          <p className="font-display font-bold text-white mb-3">Tracks</p>
          {tracks.length === 0 ? (
            <EmptyState icon={<ProfileIcon size={22} className="grad-brand-text" />} title="No public tracks yet" />
          ) : (
            <div className="space-y-0.5">{tracks.map((t) => <TrackRow key={t.id} track={t} queueList={tracks} showMenu={false} />)}</div>
          )}
        </div>

        {/* Special Artist Support & Fan Shoutouts */}
        <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card-surface rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <SparkleIcon size={16} className="grad-brand-text" />
              <p className="font-display font-bold text-sm text-white">Support Artist</p>
            </div>
            <p className="text-xs text-white/45 mb-3">Boost {profile?.displayName || 'this artist'} on the MiLey stage.</p>
            <div className="flex gap-2">
              {['⚡ Boost', '💎 Super Fan', '👑 Stage Crown'].map((tier) => (
                <button
                  key={tier}
                  onClick={() => sendSupport(tier)}
                  className="flex-1 py-2 px-2 rounded-xl text-xs font-medium card-surface text-white hover:bg-white/10"
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div className="card-surface rounded-2xl p-4">
            <p className="font-display font-bold text-sm text-white mb-2">Fan Shoutouts ({artistShoutouts.length})</p>
            <form onSubmit={postShoutout} className="flex gap-2 mb-3">
              <input
                value={shoutoutText}
                onChange={(e) => setShoutoutText(e.target.value)}
                placeholder="Write a shoutout…"
                className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none"
              />
              <button type="submit" className="w-9 h-9 rounded-xl btn-brand flex items-center justify-center shrink-0">
                <SendIcon size={14} color="#0B0B0B" />
              </button>
            </form>
            <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
              {artistShoutouts.length === 0 ? (
                <p className="text-xs text-white/30">Be the first fan to drop a shoutout.</p>
              ) : (
                artistShoutouts.slice(0, 6).map((s) => (
                  <div key={s.id} className="text-xs text-white/75 flex items-baseline justify-between gap-2">
                    <span className="truncate"><b className="text-white">{s.userName || 'Fan'}:</b> {s.message}</span>
                    <span className="text-[10px] text-white/30 shrink-0">{timeAgo(s.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showFollowModal === 'followers' && <FollowListModal title="Followers" loader={() => getFollowersList(id)} onClose={() => setShowFollowModal(null)} />}
      {showFollowModal === 'following' && <FollowListModal title="Following" loader={() => getFollowingList(id)} onClose={() => setShowFollowModal(null)} />}
    </div>
  )
}
