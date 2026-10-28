import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'
import { $me } from '@store/auth'
import { go } from '@store/router'
import { $session, $syncStatus, dispatch } from '@store/session'
import { $settings, updateSettings } from '@store/settings'
import { currentPlayer, publicView } from '@/game'
import { screenFor } from '@/components/modules'
import { EffectsPanel, GiftsPanel, HistoryPanel, MissionsPanel, Scoreboard } from '@/components/play/SidePanels'
import { sound } from '@/sound/sound'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Logo from '@/components/ui/Logo'
import Tabs from '@/components/ui/Tabs'

const SYNC_LABELS = {
  saving: { icon: 'cloud_sync', label: 'Запазване…' },
  saved: { icon: 'cloud_done', label: 'Запазено в профила' },
  error: { icon: 'cloud_off', label: 'Неуспешно запазване — пазим локално' },
  offline: { icon: 'cloud_off', label: 'Няма връзка — пазим локално' },
  conflict: { icon: 'sync_problem', label: 'Заредена е по-новата версия' },
  idle: { icon: 'save', label: 'Запазено на устройството' },
}

const SUCCESS = /\/(success|correct|guessed|award|complete)$/
const FAIL = /\/(fail|miss|timeout)$/

// Plays sounds for new history entries (one place instead of every button).
function useEventSounds(state) {
  const last = useRef(state?.history.at(-1)?.id)
  useEffect(() => {
    if (!state) return
    const index = state.history.findIndex((h) => h.id === last.current)
    const fresh = state.history.slice(index + 1)
    last.current = state.history.at(-1)?.id
    if (!fresh.length || fresh.length > 10) return
    const types = fresh.map((h) => h.type)
    if (types.includes('game/finish')) sound.fanfare()
    else if (types.some((t) => SUCCESS.test(t))) sound.success(state.theme)
    else if (types.some((t) => FAIL.test(t))) sound.fail()
    else if (types.some((t) => t === 'luck/draw' || t === 'gift/award')) sound.reveal()
  }, [state?.history.length]) // eslint-disable-line react-hooks/exhaustive-deps
}

function SyncIndicator() {
  const me = useStore($me)
  const status = useStore($syncStatus)
  const info = me ? SYNC_LABELS[status] : SYNC_LABELS.idle
  return (
    <span className={`sync-indicator sync-indicator--${me ? status : 'local'}`} title={info.label}>
      <span className="material-symbols-rounded" aria-hidden="true">{info.icon}</span>
      <span className="sync-indicator__label">{info.label}</span>
    </span>
  )
}

function GameMenu({ onFinish }) {
  const settings = useStore($settings)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div className="user-menu" ref={ref}>
      <Button variant="ghost" size="sm" icon="more_vert" aria-label="Меню на играта" aria-expanded={open} onClick={() => setOpen((v) => !v)} />
      {open && (
        <div className="user-menu__panel" role="menu">
          <button type="button" role="menuitem" onClick={() => updateSettings({ sound: !settings.sound })}>
            <span className="material-symbols-rounded">{settings.sound ? 'volume_up' : 'volume_off'}</span> Звук: {settings.sound ? 'вкл.' : 'изкл.'}
          </button>
          <button type="button" role="menuitem" onClick={() => updateSettings({ effects: !settings.effects })}>
            <span className="material-symbols-rounded">auto_awesome</span> Ефекти: {settings.effects ? 'вкл.' : 'изкл.'}
          </button>
          <a role="menuitem" href="/"><span className="material-symbols-rounded">home</span> Към началото</a>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onFinish() }}>
            <span className="material-symbols-rounded">flag</span> Приключи играта
          </button>
        </div>
      )}
    </div>
  )
}

export default function Play() {
  const fullState = useStore($session)
  const [finishing, setFinishing] = useState(false)
  const [tab, setTab] = useState('scores')
  useEventSounds(fullState)

  useEffect(() => {
    if (fullState?.status === 'finished') go('summary')
  }, [fullState?.status])

  if (!fullState) {
    return (
      <div className="game-shell game-shell--empty">
        <EmptyState icon="🎲" title="Няма активна игра" text="Създай нова игра за няколко секунди." action={<Button href="/new" icon="add">Нова игра</Button>} />
      </div>
    )
  }
  if (fullState.status === 'finished') return null

  const state = publicView(fullState)
  const activity = state.activity
  const player = activity ? state.players.find((p) => p.id === activity.playerId) || currentPlayer(state) : currentPlayer(state)
  const Screen = activity ? screenFor(activity) : null
  const paused = state.status === 'paused'
  const rounds = state.settings.endCondition === 'rounds' ? `/${state.settings.rounds}` : ''

  const tabs = [
    { value: 'scores', label: state.settings.scoring ? 'Класиране' : 'Играчи', icon: '🏆' },
    { value: 'effects', label: 'Ефекти', icon: '🌀', count: state.effects.length || undefined },
    state.moduleState.missions && { value: 'missions', label: 'Мисии', icon: '🕵️' },
    state.moduleState.gifts && { value: 'gifts', label: 'Подаръци', icon: '🎁' },
    { value: 'history', label: 'История', icon: '📜' },
  ].filter(Boolean)

  const finish = () => {
    dispatch('game/finish', { reason: 'Домакинът приключи играта' })
    setFinishing(false)
  }

  return (
    <div className="game-shell">
      <header className="game-bar">
        <Logo size="sm" />
        <div className="game-bar__title">
          <strong>{state.title}</strong>
          <span>Рунд {state.turn.round}{rounds} · Ход {state.turn.number}</span>
        </div>
        <div className="game-bar__actions">
          <SyncIndicator />
          <Button variant="soft" size="sm" icon={paused ? 'play_arrow' : 'pause'} onClick={() => dispatch(paused ? 'game/resume' : 'game/pause')}>
            {paused ? 'Продължи' : 'Пауза'}
          </Button>
          <GameMenu onFinish={() => setFinishing(true)} />
        </div>
      </header>

      <div className="game-layout">
        <main className="game-stage" id="main">
          {activity && Screen ? (
            <div className="game-stage__activity" key={activity.id}>
              <Screen state={state} fullState={fullState} activity={activity} player={player} />
              {activity.moduleId !== 'core' && (
                <button type="button" className="game-stage__skip" onClick={() => dispatch('activity/skip', { activityId: activity.id })}>
                  Пропусни този модул
                </button>
              )}
            </div>
          ) : (
            <EmptyState icon="🤔" title="Няма какво да се покаже" />
          )}
        </main>
        <aside className="game-side">
          <Tabs tabs={tabs} value={tab} onChange={setTab} className="game-side__tabs" />
          <div className="game-side__panel">
            {tab === 'scores' && <Scoreboard state={state} />}
            {tab === 'effects' && <EffectsPanel state={state} />}
            {tab === 'missions' && <MissionsPanel state={state} fullState={fullState} />}
            {tab === 'gifts' && <GiftsPanel state={state} />}
            {tab === 'history' && <HistoryPanel state={state} />}
          </div>
          <Button variant="ghost" size="sm" icon="flag" onClick={() => setFinishing(true)} className="game-side__finish">Приключи играта</Button>
        </aside>
      </div>

      {paused && (
        <div className="pause-overlay" role="dialog" aria-modal="true" aria-label="Пауза">
          <div className="pause-overlay__panel">
            <span className="emoji" aria-hidden="true">☕</span>
            <h2>Пауза</h2>
            <p className="text-muted">Таймерите са спрени. Продължете, когато сте готови.</p>
            <Button size="xl" icon="play_arrow" onClick={() => dispatch('game/resume')} autoFocus>Продължи играта</Button>
            <Button variant="ghost" icon="flag" onClick={() => setFinishing(true)}>Приключи играта</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={finishing}
        title="Да приключим ли играта?"
        text="Ще видите крайното класиране, подаръците и мисиите. Това не може да се отмени."
        confirmLabel="Приключи"
        onCancel={() => setFinishing(false)}
        onConfirm={finish}
      />
    </div>
  )
}
