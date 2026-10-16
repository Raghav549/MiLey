import { useState, useEffect } from 'react'
import { auth, signInAsStudioUser, signUp } from '../lib/auth'
import { APP_DOMAIN } from '../lib/supabaseClient'
import Logo from './Logo'
import { Sparkles, Mail, Lock, User, ArrowRight, Disc3 } from 'lucide-react'

export default function AuthGate({ children }) {
  const [user, setUser] = useState(() => auth.getCurrentUser())
  const [mode, setMode] = useState('studio') // 'studio' | 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setUser(auth.getCurrentUser())
    return auth.onAuthChange((u) => setUser(u))
  }, [])

  if (user) return children

  const handleInstantStudio = async () => {
    setLoading(true)
    setError('')
    try {
      const u = await signInAsStudioUser({
        displayName: displayName.trim() || 'MiLey Studio Creator',
        email: email.trim() || 'creator@mileymusic.space',
      })
      setUser(u)
    } catch (err) {
      setError(err?.message || 'Could not start session')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }
    setLoading(true)
    setError('')
    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password || 'miley12345', {
          displayName: displayName.trim() || email.split('@')[0],
        })
      } else {
        await auth.signIn({
          email: email.trim(),
          password: password || 'miley12345',
          displayName: displayName.trim() || undefined,
        })
      }
      setUser(auth.getCurrentUser())
    } catch (err) {
      setError(err?.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-between px-6 py-10 bg-bg-primary text-text-primary relative overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 20% 15%, rgba(0, 224, 168, 0.22), transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 61, 174, 0.18), transparent 55%), #0B0B0B',
      }}
    >
      <div className="pt-2 flex items-center justify-between">
        <Logo size={36} />
        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-accent-primary">
          mileymusic.space
        </span>
      </div>

      <div className="my-auto max-w-md w-full mx-auto space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/25 text-accent-primary text-xs font-medium">
            <Disc3 className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '5s' }} />
            Global Beats · Your Stage
          </div>
          <h1
            className="text-4xl font-extrabold leading-tight tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Stream, Upload &amp; Host Live{' '}
            <span className="bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
              Listen Rooms.
            </span>
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            Experience creator channels, bulk song uploads with custom Song Themes, and continuous camera-bar playback on{' '}
            <span className="text-white font-medium">{APP_DOMAIN.replace('https://', '')}</span>.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-white/5 border border-white/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setMode('studio'); setError('') }}
            className={`py-2 rounded-xl transition-all ${
              mode === 'studio' ? 'bg-accent-primary text-[#0B0B0B]' : 'text-text-secondary hover:text-white'
            }`}
          >
            Instant Studio
          </button>
          <button
            type="button"
            onClick={() => { setMode('signin'); setError('') }}
            className={`py-2 rounded-xl transition-all ${
              mode === 'signin' ? 'bg-accent-primary text-[#0B0B0B]' : 'text-text-secondary hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError('') }}
            className={`py-2 rounded-xl transition-all ${
              mode === 'signup' ? 'bg-accent-primary text-[#0B0B0B]' : 'text-text-secondary hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300">
            {error}
          </div>
        )}

        {mode === 'studio' ? (
          <div className="space-y-3 p-5 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Creator / Listener Name (optional)</label>
              <div className="relative">
                <User className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="MiLey Studio Creator"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:border-accent-primary"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleInstantStudio}
              className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-accent-primary to-emerald-400 text-[#0B0B0B] shadow-lg shadow-accent-primary/25 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? 'Entering MiLey Studio...' : 'Enter MiLey Studio Instantly'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleEmailSubmit}
            className="space-y-3 p-5 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl"
          >
            {mode === 'signup' && (
              <div className="relative">
                <User className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Artist or Listener Name"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:border-accent-primary"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mileymusic.space"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-accent-primary to-accent-secondary text-[#0B0B0B] shadow-lg hover:opacity-95 active:scale-[0.99] transition-all"
            >
              {loading ? 'Please wait...' : mode === 'signup' ? 'Create MiLey Account' : 'Sign In to MiLey'}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => auth.signIn({ provider: 'google' })}
          className="w-full py-3 px-5 rounded-2xl font-semibold text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all flex items-center justify-center gap-2"
        >
          Continue with Google Account
        </button>
      </div>

      <p className="text-xs text-text-secondary/60 text-center">
        Official Platform · <span className="text-white/80 font-mono">mileymusic.space</span> · Web &amp; Android Native
      </p>
    </div>
  )
}
