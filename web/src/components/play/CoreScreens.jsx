import { act } from '@store/session'
import { effectsFor, getModule, playableModuleIds } from '@/game'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import { ActivityFrame } from './parts'

export function TurnStartScreen({ state, activity, player }) {
  const { expired = [], notices = [] } = activity.data
  const effects = effectsFor(state, player.id)
  const immunity = state.immunities[player.id] || 0
  const rounds = state.settings.endCondition === 'rounds' ? ` от ${state.settings.rounds}` : ''
  return (
    <ActivityFrame icon="🎲" label={`Рунд ${state.turn.round}${rounds}`} className="turn-start">
      <div className="turn-start__hero">
        <Avatar emoji={player.avatar} size="xl" active />
        <p className="turn-start__eyebrow">Ред е на</p>
        <h2 className="turn-start__name">{player.name}</h2>
      </div>
      {(expired.length > 0 || notices.length > 0) && (
        <ul className="turn-start__notices">
          {expired.map((e, i) => <li key={`e${i}`}>⌛ Ефектът „{e.title}“ изтече</li>)}
          {notices.map((n, i) => <li key={`n${i}`}>📣 {n}</li>)}
        </ul>
      )}
      {effects.length > 0 && (
        <div className="turn-start__effects">
          <p>Активни ефекти:</p>
          {effects.map((effect) => (
            <span key={effect.id} className="effect-pill">🌀 {effect.title} · {effect.turnsRemaining} х.</span>
          ))}
        </div>
      )}
      {immunity > 0 && <p className="turn-start__immunity">🛡️ Имунитети: {immunity}</p>}
      <Button size="xl" iconEnd="arrow_forward" onClick={() => act('continue')} autoFocus>
        Започни хода
      </Button>
    </ActivityFrame>
  )
}

export function ChooseScreen({ state, activity, player }) {
  const ids = playableModuleIds(state)
  return (
    <ActivityFrame icon="👆" label="Избери какво следва" player={player}>
      {activity.data.reason && <p className="choose__reason">{activity.data.reason}</p>}
      <div className="choose__grid">
        {ids.map((id) => {
          const definition = getModule(id)
          return (
            <button key={id} type="button" className="choose__option" onClick={() => act('choose', { moduleId: id })}>
              <span className="emoji" aria-hidden="true">{definition.icon}</span>
              <span>{definition.shortName || definition.name}</span>
            </button>
          )
        })}
      </div>
    </ActivityFrame>
  )
}
