import { useStore } from '@nanostores/react'
import { $draft, updateDraft } from '@store/draft'
import { THEME_LIST } from '@/game/modes/themes'
import { validateSettings } from '@/game'
import { ConfigErrors, ConfigSection } from '@/components/modules/common'
import NumberStepper from '@/components/ui/NumberStepper'
import Segmented from '@/components/ui/Segmented'
import Toggle from '@/components/ui/Toggle'

// Global rules: who plays next, how turns are filled and when the game ends.
export default function GameRules() {
  const draft = useStore($draft)
  const { settings } = draft
  const wheelOn = Boolean(draft.modules.wheel?.enabled)
  const set = (patch) => updateDraft((d) => Object.assign(d.settings, patch))
  const errors = validateSettings(draft).map((message) => ({ message }))

  return (
    <>
      <ConfigSection title="Ход" description="Какво се случва, когато дойде редът на играча.">
        <Segmented
          label="Съдържание на хода"
          value={settings.turnSource}
          onChange={(turnSource) => set({ turnSource })}
          options={[
            { value: 'wheel', label: 'Колелото решава', icon: '🎡', disabled: !wheelOn, title: wheelOn ? undefined : 'Включете колелото' },
            { value: 'random', label: 'Случаен модул', icon: '🎲' },
            { value: 'host', label: 'Домакинът избира', icon: '👆' },
          ]}
        />
        <Segmented
          label="Ред на играчите"
          value={settings.turnOrder}
          onChange={(turnOrder) => set({ turnOrder })}
          options={[
            { value: 'sequential', label: 'По ред' },
            { value: 'random', label: 'Случаен' },
          ]}
        />
      </ConfigSection>
      <ConfigSection title="Край на играта">
        <Segmented
          label="Играта свършва"
          value={settings.endCondition}
          onChange={(endCondition) => set({ endCondition })}
          options={[
            { value: 'rounds', label: 'След брой рундове' },
            { value: 'manual', label: 'Когато решим' },
          ]}
        />
        {settings.endCondition === 'rounds' && (
          <NumberStepper label="Рундове" hint="Рунд = всеки играч е имал по един ход" value={settings.rounds} min={1} max={50} onChange={(rounds) => set({ rounds })} />
        )}
        <Toggle id="set-scoring" label="Точки и класиране" checked={settings.scoring} onChange={(scoring) => set({ scoring })} />
      </ConfigSection>
      <ConfigSection title="Тема">
        <div className="theme-picker">
          {THEME_LIST.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`theme-picker__option ${draft.theme === theme.id ? 'is-active' : ''}`}
              onClick={() => updateDraft((d) => { d.theme = theme.id })}
              aria-pressed={draft.theme === theme.id}
              style={{ '--c1': theme.swatch[0], '--c2': theme.swatch[1], '--c3': theme.swatch[2] }}
            >
              <span className="theme-picker__swatch" aria-hidden="true" />
              {theme.name}
            </button>
          ))}
        </div>
      </ConfigSection>
      <ConfigErrors errors={errors} />
    </>
  )
}
