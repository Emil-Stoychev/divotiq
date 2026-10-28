import { useMemo } from 'react'
import { useStore } from '@nanostores/react'
import { getTheme } from '@/game/modes/themes'
import { $reducedMotion, $settings } from '@store/settings'

const COUNTS = { snow: 42, confetti: 30, bubbles: 22, sparkles: 26 }
const CONFETTI_COLORS = ['#ff5fa2', '#ffd166', '#a855f7', '#22d3ee', '#22c55e', '#ff7a1a']

// Deterministic pseudo-random so particles don't jump between renders.
const rand = (i, salt) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export default function ThemeBackdrop({ theme }) {
  const settings = useStore($settings)
  const reducedMotion = useStore($reducedMotion)
  const kind = getTheme(theme).backdrop

  const particles = useMemo(
    () =>
      Array.from({ length: COUNTS[kind] || 0 }, (_, i) => ({
        left: `${rand(i, 1) * 100}%`,
        delay: `${-rand(i, 2) * 18}s`,
        duration: `${10 + rand(i, 3) * 14}s`,
        size: kind === 'snow' ? 3 + rand(i, 4) * 6 : kind === 'bubbles' ? 8 + rand(i, 4) * 22 : 6 + rand(i, 4) * 8,
        drift: `${(rand(i, 5) - 0.5) * 120}px`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        top: `${rand(i, 6) * 100}%`,
      })),
    [kind],
  )

  if (!settings.effects || reducedMotion) return <div className="backdrop backdrop--static" aria-hidden="true" />

  return (
    <div className={`backdrop backdrop--${kind}`} aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={`${kind}-${i}`}
          className="backdrop__particle"
          style={{
            left: p.left,
            top: kind === 'sparkles' ? p.top : undefined,
            width: p.size,
            height: kind === 'confetti' ? p.size * 0.45 : p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
            '--drift': p.drift,
            '--color': p.color,
          }}
        />
      ))}
    </div>
  )
}
