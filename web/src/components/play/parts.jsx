import { useEffect, useRef, useState } from 'react'
import { act } from '@store/session'
import { formatSeconds, isTimerExpired, remainingMs } from '@/game'
import { useNow } from '@/hooks/useNow'
import { sound } from '@/sound/sound'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'

// Frame shared by every activity screen.
export function ActivityFrame({ icon, label, player, tone, children, actions, className = '' }) {
  return (
    <section className={`activity ${tone ? `activity--${tone}` : ''} ${className}`} aria-live="polite">
      <header className="activity__head">
        <span className="activity__module">
          <span className="emoji" aria-hidden="true">{icon}</span> {label}
        </span>
        {player && (
          <span className="activity__player">
            <Avatar emoji={player.avatar} size="sm" /> {player.name}
          </span>
        )}
      </header>
      <div className="activity__body">{children}</div>
      {actions && <footer className="activity__actions">{actions}</footer>}
    </section>
  )
}

// Live countdown for a timer stored in the activity. When it runs out the
// screen dispatches `expireAction` once (the engine ignores duplicates anyway).
export function ActivityTimer({ timer, expireAction, controls = true, size = 'md' }) {
  const now = useNow(Boolean(timer?.running), 200)
  const remaining = remainingMs(timer, now)
  const expired = isTimerExpired(timer, now)
  const fired = useRef(false)
  const lastSecond = useRef(null)

  useEffect(() => {
    if (!timer?.running) return
    const seconds = Math.ceil(remaining / 1000)
    if (seconds <= 5 && seconds > 0 && seconds !== lastSecond.current) sound.tick()
    lastSecond.current = seconds
  }, [remaining, timer?.running])

  useEffect(() => {
    if (expired && timer?.running && !fired.current) {
      fired.current = true
      sound.alarm()
      if (expireAction) act(expireAction)
      else act('timer/pause')
    }
    if (!expired) fired.current = false
  }, [expired, timer?.running, expireAction])

  if (!timer) return null
  const progress = 1 - remaining / timer.durationMs
  const urgent = remaining <= 5000 && timer.running
  return (
    <div className={`timer timer--${size} ${urgent ? 'timer--urgent' : ''} ${expired ? 'timer--expired' : ''}`}>
      <div className="timer__ring" style={{ '--progress': progress }} role="timer" aria-label={`Остават ${Math.ceil(remaining / 1000)} секунди`}>
        <span className="timer__value">{expired ? 'Край!' : formatSeconds(remaining)}</span>
      </div>
      {controls && !expired && (
        <div className="timer__controls">
          {timer.running ? (
            <Button variant="soft" size="sm" icon="pause" onClick={() => act('timer/pause')}>Пауза</Button>
          ) : (
            <Button variant="soft" size="sm" icon="play_arrow" onClick={() => act(timer.elapsedMs ? 'timer/resume' : 'timer/start')}>
              {timer.elapsedMs ? 'Продължи' : 'Старт'}
            </Button>
          )}
          {timer.elapsedMs > 0 && !timer.running && (
            <Button variant="ghost" size="sm" icon="restart_alt" aria-label="Нулирай таймера" onClick={() => act('timer/reset')} />
          )}
        </div>
      )}
    </div>
  )
}

// Press-and-hold to see a secret on a shared screen. Releasing hides it again,
// so others never catch it by accident. Keyboard: hold Space/Enter.
export function HoldToReveal({ children, label = 'Задръж, за да видиш', onSeen }) {
  const [shown, setShown] = useState(false)
  const seen = useRef(false)
  const show = () => {
    setShown(true)
    if (!seen.current) {
      seen.current = true
      onSeen?.()
    }
  }
  const hide = () => setShown(false)
  return (
    <div className={`hold-reveal ${shown ? 'hold-reveal--shown' : ''}`}>
      <div className="hold-reveal__secret" aria-hidden={!shown}>
        {shown ? children : <span className="hold-reveal__placeholder">••••••</span>}
      </div>
      <button
        type="button"
        className="hold-reveal__button"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId)
          show()
        }}
        onPointerUp={hide}
        onPointerCancel={hide}
        onPointerLeave={hide}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && (e.preventDefault(), show())}
        onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && hide()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="material-symbols-rounded" aria-hidden="true">{shown ? 'visibility' : 'touch_app'}</span>
        {shown ? 'Пусни, за да скриеш' : label}
      </button>
    </div>
  )
}

// "Hand the device to X" screen used before secret content.
export function Handoff({ player, text, buttonLabel = 'Аз съм, покажи', onReady }) {
  return (
    <div className="handoff">
      <Avatar emoji={player?.avatar} size="xl" />
      <p className="handoff__title">Подай устройството на <strong>{player?.name}</strong></p>
      {text && <p className="handoff__text">{text}</p>}
      <Button size="lg" icon="lock_open" onClick={onReady}>{buttonLabel}</Button>
    </div>
  )
}

export function PlayerChooser({ players, onChoose, excludeId, selectedId, label }) {
  return (
    <div className="player-chooser">
      {label && <p className="player-chooser__label">{label}</p>}
      <div className="player-chooser__grid">
        {players
          .filter((p) => p.id !== excludeId)
          .map((player) => (
            <button
              key={player.id}
              type="button"
              className={`player-chooser__option ${selectedId === player.id ? 'is-selected' : ''}`}
              onClick={() => onChoose(player.id)}
            >
              <Avatar emoji={player.avatar} size="lg" />
              <span>{player.name}</span>
            </button>
          ))}
      </div>
    </div>
  )
}

export function Outcome({ tone = 'success', icon, title, text, children }) {
  return (
    <div className={`outcome outcome--${tone}`}>
      {icon && <span className="outcome__icon emoji" aria-hidden="true">{icon}</span>}
      <p className="outcome__title">{title}</p>
      {text && <p className="outcome__text">{text}</p>}
      {children}
    </div>
  )
}

export function ContinueButton({ label = 'Продължи', ...props }) {
  return (
    <Button size="lg" iconEnd="arrow_forward" onClick={() => act('continue')} {...props}>
      {label}
    </Button>
  )
}
