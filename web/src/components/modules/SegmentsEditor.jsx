import { WHEEL_TARGETS } from '@/game'
import { createId } from '@/game/engine/ids'
import Button from '@/components/ui/Button'

const TARGET_OPTIONS = Object.entries(WHEEL_TARGETS).map(([value, t]) => ({ value, label: `${t.icon} ${t.label}` }))

export function newSegment(target = 'challenges') {
  const preset = WHEEL_TARGETS[target]
  return { id: createId('seg'), label: preset.label, icon: preset.icon, color: preset.color, target, weight: 1, once: false }
}

// Editable list of wheel segments. `enabledModules` marks segments whose
// target module is switched off (they are skipped during the game).
export default function SegmentsEditor({ segments, onChange, probability = 'equal', enabledModules }) {
  const update = (id, patch) => onChange(segments.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const move = (index, delta) => {
    const next = [...segments]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    onChange(next)
  }
  const changeTarget = (segment, target) => {
    const preset = WHEEL_TARGETS[target]
    const old = WHEEL_TARGETS[segment.target]
    // Keep custom labels/icons; only replace the ones that were still defaults.
    update(segment.id, {
      target,
      label: segment.label === old?.label ? preset.label : segment.label,
      icon: segment.icon === old?.icon ? preset.icon : segment.icon,
      color: segment.color === old?.color ? preset.color : segment.color,
    })
  }

  return (
    <div className="segments-editor">
      {segments.map((segment, index) => {
        const inactive = enabledModules && !['points', 'spinAgain', 'nothing'].includes(segment.target) && !enabledModules.includes(segment.target)
        return (
          <div key={segment.id || index} className={`segments-editor__row ${inactive ? 'segments-editor__row--inactive' : ''}`}>
            <label className="segments-editor__color" style={{ background: segment.color }} title="Цвят">
              <input type="color" value={segment.color} onChange={(e) => update(segment.id, { color: e.target.value })} aria-label="Цвят на сегмента" />
            </label>
            <input className="input segments-editor__icon" value={segment.icon} maxLength={4} onChange={(e) => update(segment.id, { icon: e.target.value })} aria-label="Иконка" />
            <input className="input segments-editor__label" value={segment.label} maxLength={30} onChange={(e) => update(segment.id, { label: e.target.value })} aria-label="Име на сегмента" />
            <select className="input input--select segments-editor__target" value={segment.target} onChange={(e) => changeTarget(segment, e.target.value)} aria-label="Действие">
              {TARGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {probability === 'weighted' && (
              <input
                className="input segments-editor__weight"
                type="number"
                min={1}
                max={10}
                value={segment.weight}
                onChange={(e) => update(segment.id, { weight: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
                aria-label="Тежест"
                title="Тежест (1–10)"
              />
            )}
            <button
              type="button"
              className={`segments-editor__once ${segment.once ? 'segments-editor__once--on' : ''}`}
              onClick={() => update(segment.id, { once: !segment.once })}
              aria-pressed={segment.once}
              title="Еднократен — изчезва след като се падне"
            >
              1×
            </button>
            <div className="segments-editor__tools">
              <Button variant="ghost" size="sm" icon="arrow_upward" aria-label="Нагоре" disabled={index === 0} onClick={() => move(index, -1)} />
              <Button variant="ghost" size="sm" icon="arrow_downward" aria-label="Надолу" disabled={index === segments.length - 1} onClick={() => move(index, 1)} />
              <Button variant="ghost" size="sm" icon="delete" aria-label="Премахни" disabled={segments.length <= 2} onClick={() => onChange(segments.filter((s) => s.id !== segment.id))} />
            </div>
            {inactive && <span className="segments-editor__warn">Модулът е изключен — сегментът няма да участва</span>}
          </div>
        )
      })}
      {segments.length < 16 && (
        <Button variant="soft" size="sm" icon="add" onClick={() => onChange([...segments, newSegment('points')])}>
          Добави сегмент
        </Button>
      )}
    </div>
  )
}
