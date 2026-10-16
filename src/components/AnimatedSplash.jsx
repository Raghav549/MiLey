import { useEffect, useState } from 'react'
import Logo from './Logo'

export default function AnimatedSplash() {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1200)
    const t2 = setTimeout(() => setVisible(false), 1600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-400 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background:
          'radial-gradient(circle at 50% 25%, rgba(255,61,174,0.18), transparent 55%), radial-gradient(circle at 50% 75%, rgba(0,224,168,0.16), transparent 55%), #0B0B0B',
      }}
    >
      <div className="relative flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          <div
            className="absolute w-28 h-28 rounded-full animate-ping opacity-20"
            style={{ background: 'linear-gradient(135deg, rgb(var(--color-primary)), rgb(var(--color-secondary)))' }}
          />
          <div className="relative p-5 rounded-3xl card-surface shadow-2xl">
            <Logo size={44} />
          </div>
        </div>
        <p className="mt-4 text-xs text-white/45 tracking-widest uppercase font-medium">mileymusic.space</p>
        <div className="mt-5 flex items-end gap-1 h-5">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span
              key={i}
              className="w-1 rounded-full grad-brand animate-pulse"
              style={{
                height: `${40 + ((i * 29) % 60)}%`,
                animationDelay: `${i * 90}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
