import { useStore } from '@nanostores/react'
import { useEffect } from 'react'
import { $reducedMotion } from '@store/settings'
import { act } from '@store/session'
import { availableSegments, WHEEL_TARGETS } from '@/game'
import { sound } from '@/sound/sound'
import WheelGraphic from '@/components/game/WheelGraphic'
import Button from '@/components/ui/Button'
import { ActivityFrame } from './parts'

export default function WheelScreen({ state, activity, player }) {
  const reduced = useStore($reducedMotion)
  const config = state.modules.wheel.config
  const wheelState = state.moduleState.wheel
  const { phase, data } = activity
  const segments =
    phase === 'ready'
      ? availableSegments(config, Object.keys(state.modules), wheelState.removedIds)
      : data.segmentIds.map((id) => config.segments.find((s) => s.id === id)).filter(Boolean)
  const result = data.resultId ? config.segments.find((s) => s.id === data.resultId) : null
  const spinning = phase === 'spinning'

  // The engine already chose the result; this only waits for the animation.
  useEffect(() => {
    if (!spinning) return undefined
    const duration = reduced ? 300 : data.spinMs
    const ticks = []
    if (config.sound && !reduced) {
      let t = 0
      let gap = 60
      while (t < duration - 200) {
        ticks.push(setTimeout(() => sound.tick(), t))
        t += gap
        gap *= 1.07
      }
    }
    const done = setTimeout(() => {
      act('settle')
      if (config.sound) sound.reveal()
    }, duration + 150)
    return () => {
      clearTimeout(done)
      ticks.forEach(clearTimeout)
    }
  }, [spinning, activity.id, data.spins]) // eslint-disable-line react-hooks/exhaustive-deps

  const target = result ? WHEEL_TARGETS[result.target] : null
  const resultText =
    result?.target === 'spinAgain'
      ? data.spins < 3 ? 'Завърти още веднъж!' : 'Стига въртене — пас!'
      : result?.target === 'points'
        ? 'Печелиш точка!'
        : result?.target === 'nothing'
          ? 'Този път почиваш.'
          : `Следва: ${target?.label || result?.label}`

  return (
    <ActivityFrame icon="🎡" label="Колело на късмета" player={player} className="wheel-screen">
      <div className="wheel-screen__stage">
        <WheelGraphic
          segments={segments}
          probability={config.probability}
          rotation={spinning || phase === 'result' ? data.rotation : wheelState.rotation}
          durationMs={spinning && !reduced ? data.spinMs : 0}
          highlightId={phase === 'result' ? data.resultId : null}
        />
        <button type="button" className="wheel-screen__hub" onClick={() => act('spin')} disabled={phase !== 'ready'} aria-label="Завърти колелото">
          {phase === 'ready' ? 'Завърти' : spinning ? '…' : <span className="emoji">{result?.icon}</span>}
        </button>
      </div>
      {phase === 'ready' && (
        <Button size="xl" icon="autorenew" onClick={() => act('spin')}>Завърти колелото</Button>
      )}
      {spinning && <p className="wheel-screen__status">Колелото се върти…</p>}
      {phase === 'result' && result && (
        <div className="wheel-screen__result" style={{ '--seg': result.color }}>
          <span className="wheel-screen__result-icon emoji">{result.icon}</span>
          <div>
            <p className="wheel-screen__result-label">{result.label}</p>
            <p className="wheel-screen__result-text">{resultText}</p>
          </div>
          <Button size="lg" iconEnd={result.target === 'spinAgain' && data.spins < 3 ? 'autorenew' : 'arrow_forward'} onClick={() => act('continue')} autoFocus>
            {result.target === 'spinAgain' && data.spins < 3 ? 'Към колелото' : 'Продължи'}
          </Button>
        </div>
      )}
    </ActivityFrame>
  )
}
