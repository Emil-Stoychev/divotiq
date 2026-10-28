import { useState } from 'react'
import { dispatch } from '@store/session'
import { boardRanks, effectsFor, giftsFor, leaderboard, moduleName } from '@/game'
import { rarityLabel } from '@/game/modules/shared'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { HoldToReveal } from './parts'

export function Scoreboard({ state }) {
  const board = leaderboard(state)
  const ranks = boardRanks(board)
  const scoring = state.settings.scoring
  const hasMissions = Boolean(state.moduleState.missions)
  return (
    <ol className="scoreboard">
      {(scoring ? board : state.players).map((player, index) => {
        const current = player.id === state.turn.playerId
        const effects = effectsFor(state, player.id).length
        const gifts = giftsFor(state, player.id).length
        const immunity = state.immunities[player.id] || 0
        const skips = state.skipTurns[player.id] || 0
        const missions = hasMissions ? state.moduleState.missions.assignments.filter((m) => m.playerId === player.id && m.status === 'active').length : 0
        return (
          <li key={player.id} className={`scoreboard__row ${current ? 'is-current' : ''}`}>
            {scoring && <span className="scoreboard__rank">{ranks[index]}</span>}
            <Avatar emoji={player.avatar} size="sm" active={current} />
            <span className="scoreboard__name">
              {player.name}
              <span className="scoreboard__badges">
                {effects > 0 && <span title="Активни ефекти">🌀{effects}</span>}
                {gifts > 0 && <span title="Подаръци">🎁{gifts}</span>}
                {immunity > 0 && <span title="Имунитети">🛡️{immunity}</span>}
                {missions > 0 && <span title="Активни тайни мисии">🕵️{missions}</span>}
                {skips > 0 && <span title="Пропуска ход">😴</span>}
              </span>
            </span>
            {scoring && (
              <span key={state.scores[player.id]} className="scoreboard__score">
                {state.scores[player.id] || 0}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function EffectsPanel({ state }) {
  if (!state.effects.length) return <EmptyState icon="🌀" title="Няма активни ефекти" text="Ефектите от предизвикателства и карти се появяват тук." />
  return (
    <ul className="side-list">
      {state.effects.map((effect) => {
        const player = state.players.find((p) => p.id === effect.playerId)
        return (
          <li key={effect.id} className="side-list__item">
            <Avatar emoji={player?.avatar} size="xs" />
            <span className="side-list__text">
              <strong>{effect.title}</strong>
              <small>{player?.name} · още {effect.turnsRemaining} {effect.turnsRemaining === 1 ? 'ход' : 'хода'}</small>
              {effect.text && <small className="side-list__desc">{effect.text}</small>}
            </span>
            <Button variant="ghost" size="sm" icon="close" aria-label={`Премахни ${effect.title}`} onClick={() => dispatch('effects/remove', { effectId: effect.id })} />
          </li>
        )
      })}
    </ul>
  )
}

// The host marks missions as done/failed. Texts stay hidden unless the owner
// holds the reveal button.
export function MissionsPanel({ state, fullState }) {
  const [confirm, setConfirm] = useState(null)
  const assignments = fullState.moduleState.missions?.assignments || []
  if (!assignments.length) return <EmptyState icon="🕵️" title="Няма мисии" />
  const statusLabel = { active: 'Активна', completed: 'Изпълнена ✅', failed: 'Провалена ❌', expired: 'Изтекла' }
  return (
    <>
      <ul className="side-list">
        {assignments.map((mission) => {
          const player = state.players.find((p) => p.id === mission.playerId)
          return (
            <li key={mission.id} className={`side-list__item side-list__item--${mission.status}`}>
              <Avatar emoji={player?.avatar} size="xs" />
              <span className="side-list__text">
                <strong>{player?.name}</strong>
                <small>{statusLabel[mission.status]}{mission.deadlineRound ? ` · до рунд ${mission.deadlineRound}` : ''}</small>
                {mission.status === 'completed' ? (
                  <small className="side-list__desc">{mission.title}</small>
                ) : (
                  <HoldToReveal label="Само за собственика: задръж">
                    <span className="side-list__secret">{mission.title}: {mission.text}</span>
                  </HoldToReveal>
                )}
              </span>
              {mission.status === 'active' && state.status !== 'finished' && (
                <span className="side-list__tools">
                  <Button variant="success" size="sm" icon="check" aria-label="Изпълнена" onClick={() => setConfirm({ mission, name: 'complete', player })} />
                  <Button variant="ghost" size="sm" icon="close" aria-label="Провалена" onClick={() => setConfirm({ mission, name: 'fail', player })} />
                </span>
              )}
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.name === 'complete' ? 'Мисията е изпълнена?' : 'Мисията е провалена?'}
        text={confirm?.name === 'complete' ? `${confirm?.player?.name} получава ${confirm?.mission.points} точки.` : `Мисията на ${confirm?.player?.name} ще бъде отбелязана като провалена.`}
        confirmLabel={confirm?.name === 'complete' ? 'Изпълнена' : 'Провалена'}
        tone={confirm?.name === 'complete' ? 'success' : 'danger'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          dispatch('game/command', { moduleId: 'missions', name: confirm.name, payload: { assignmentId: confirm.mission.id } })
          setConfirm(null)
        }}
      />
    </>
  )
}

export function GiftsPanel({ state }) {
  const items = state.moduleState.gifts?.items || []
  const owned = items.filter((g) => g.ownerId)
  const left = items.filter((g) => g.status === 'available').length
  return (
    <>
      <p className="side-note">Остават {left} от {items.length} подаръка</p>
      {owned.length ? (
        <ul className="side-list">
          {owned.map((gift) => {
            const owner = state.players.find((p) => p.id === gift.ownerId)
            return (
              <li key={gift.id} className="side-list__item">
                <Avatar emoji={owner?.avatar} size="xs" />
                <span className="side-list__text">
                  <strong>{gift.name}</strong>
                  <small>{owner?.name} · {rarityLabel(gift.rarity)}{gift.status === 'exchanged' ? ' · разменен' : ''}</small>
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState icon="🎁" title="Още няма раздадени подаръци" />
      )}
    </>
  )
}

export function HistoryPanel({ state }) {
  const entries = state.history.slice(-40).reverse()
  return (
    <ul className="history-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className="history-list__module">{moduleName(entry.moduleId)}</span>
          <span>{entry.summary}</span>
        </li>
      ))}
    </ul>
  )
}
