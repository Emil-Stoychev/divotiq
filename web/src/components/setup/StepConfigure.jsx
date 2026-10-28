import { useStore } from '@nanostores/react'
import { useState } from 'react'
import { $draft, resetModuleConfig, updateModuleConfig } from '@store/draft'
import { enabledModuleIds, getModule, moduleContext, validateModuleConfig, validateSettings } from '@/game'
import { CONFIG_PANELS } from '@/components/modules/configPanels'
import Button from '@/components/ui/Button'
import GameRules from './GameRules'

const RULES = 'rules'

export default function StepConfigure() {
  const draft = useStore($draft)
  const enabled = enabledModuleIds(draft)
  const [selected, setSelected] = useState(RULES)
  const active = selected === RULES || enabled.includes(selected) ? selected : RULES
  const context = moduleContext(draft)

  const definition = active !== RULES ? getModule(active) : null
  const Panel = definition ? CONFIG_PANELS[active] : null
  const errors = definition ? validateModuleConfig(draft, active) : []
  const config = definition ? { ...definition.defaultConfig(), ...draft.modules[active].config } : null

  const items = [
    { id: RULES, icon: '⚙️', name: 'Общи правила', errors: validateSettings(draft).length },
    ...enabled.map((id) => ({ id, icon: getModule(id).icon, name: getModule(id).name, errors: validateModuleConfig(draft, id).length })),
  ]

  return (
    <div className="setup-step">
      <header className="setup-step__head">
        <h1 className="setup-step__title">Настрой детайлите</h1>
        <p className="text-muted">Всичко има разумни настройки по подразбиране — промени само каквото искаш.</p>
      </header>
      <div className="configure">
        <nav className="configure__nav" aria-label="Модули">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`configure__tab ${active === item.id ? 'is-active' : ''}`}
              onClick={() => setSelected(item.id)}
              aria-current={active === item.id ? 'true' : undefined}
            >
              <span className="emoji" aria-hidden="true">{item.icon}</span>
              <span className="configure__tab-name">{item.name}</span>
              {item.errors > 0 && <span className="configure__badge" aria-label={`${item.errors} проблема`}>!</span>}
            </button>
          ))}
        </nav>
        <div className="configure__panel card">
          {definition ? (
            <>
              <header className="configure__panel-head">
                <span className="emoji configure__panel-icon" aria-hidden="true">{definition.icon}</span>
                <div>
                  <h2>{definition.name}</h2>
                  <p className="text-muted">{definition.description}</p>
                </div>
                <Button variant="ghost" size="sm" icon="restart_alt" onClick={() => resetModuleConfig(active)}>По подразбиране</Button>
              </header>
              <Panel key={active} config={config} errors={errors} context={context} onChange={(patch) => updateModuleConfig(active, patch)} />
            </>
          ) : (
            <>
              <header className="configure__panel-head">
                <span className="emoji configure__panel-icon" aria-hidden="true">⚙️</span>
                <div>
                  <h2>Общи правила</h2>
                  <p className="text-muted">Ред на ходовете, край на играта и визуална тема.</p>
                </div>
              </header>
              <GameRules />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
