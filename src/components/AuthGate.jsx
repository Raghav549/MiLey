import { useEffect, useState } from 'react'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { isActiveBan } from '../permissions'
import { sendWelcomeOnce } from '../officialDM'
import Logo from './Logo'

export default function AuthGate({ children }) {
  const [user, setUser] = useState(auth.getCurrentUser())
  const [busy, setBusy] = useState(false)
  const [mod, setMod] = useState(null)

  useEffect(() => auth.onAuthChange(setUser), [])
  useEffect(() => {
    if (!user) { setMod(null); return }
    db.getShared('user_moderation', user.id).then(setMod).catch(() => setMod(null))
    sendWelcomeOnce(user)
  }, [user?.id])

  if (user && isActiveBan(mod)) {
    const until = mod.banUntil ? new Date(mod.banUntil).toLocaleDateString() : null
    return (
      <div className="h-full w-full flex flex-col items-center justify-center px-8 text-center" style={{ background: '#0B0B0B' }}>
        <Logo size={44} />
        <h1 className="font-display font-bold text-xl text-white mt-6 mb-2">Account suspended</h1>
        <p className="text-white/40 text-sm max-w-xs">{until ? `Your access is restricted until ${until}.` : 'Your access to MiLey has been restricted by an administrator.'}</p>
        <button onClick={() => auth.signOut()} className="mt-8 card-surface px-6 py-3 rounded-2xl text-sm font-medium text-white/60">Sign out</button>
      </div>
    )
  }

  if (user) return children

  const handleSignIn = async () => {
    setBusy(true)
    await auth.signIn()
    setBusy(false)
  }

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center px-8 text-center relative overflow-hidden"
      style={{ background: 'radial-gradient(circle at 50% 20%, rgba(255,61,174,0.14), transparent 55%), radial-gradient(circle at 50% 80%, rgba(0,224,168,0.12), transparent 55%), #0B0B0B' }}
    >
      <div className="pt-[env(safe-area-inset-top,0px)]" />
      <div className="animate-fade-up mb-8">
        <Logo size={56} />
      </div>
      <h1 className="font-display font-bold text-2xl text-white mb-2 animate-fade-up" style={{ animationDelay: '.08s' }}>
        Global Beats, Your Stage.
      </h1>
      <p className="text-white/40 text-sm max-w-xs mb-10 animate-fade-up" style={{ animationDelay: '.16s' }}>
        Stream music from channels everywhere, upload your own tracks, and build your own sound universe.
      </p>
      <button
        onClick={handleSignIn}
        disabled={busy}
        className="btn-brand text-black font-semibold px-8 py-3.5 rounded-2xl text-sm animate-fade-up disabled:opacity-60"
        style={{ animationDelay: '.24s' }}
      >
        {busy ? 'Signing in…' : 'Continue to MiLey'}
      </button>
      <p className="text-white/25 text-xs mt-4 animate-fade-up" style={{ animationDelay: '.3s' }}>
        Sign in with email or Google — free, takes seconds.
      </p>
    </div>
  )
}
