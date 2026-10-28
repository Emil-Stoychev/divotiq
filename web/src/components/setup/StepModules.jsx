import { useStore } from '@nanostores/react'
import { $draft, setModuleEnabled } from '@store/draft'
import { getMode } from '@store/modes'
import { getModule, listModules, moduleContext, validateModuleConfig } from '@/game'
import Chip from '@/components/ui/Chip'
import Toggle from '@/components/ui/Toggle'

export default function StepModules({ showErrors, global = [] }) {
  const draft = useStore($draft)
  const mode = getMode(draft.modeKey)
  const context = moduleContext(draft)
  const enabledCount = context.enabledModules.length

  return (
    <div className="setup-step">
      <header className="setup-step__head">
        <h1 className="setup-step__title">Сглоби играта</h1>
        <p className="text-muted">
          Включи модулите, които искаш. Колелото решава какво се случва всеки ход, но можеш да играеш и без него. Включени: {enabledCount}
        </p>
      </header>
      <div className="module-grid">
        {listModules().map((definition) => {
          const entry = draft.modules[definition.id]
          const enabled = Boolean(entry?.enabled)
          const excluded = mode.excludedModules?.includes(definition.id)
          const suggested = mode.suggestedModules?.includes(definition.id)
          const errors = enabled ? validateModuleConfig(draft, definition.id) : []
          const summary = enabled ? definition.summarizeConfig?.({ ...definition.defaultConfig(), ...entry.config }, context)?.filter(Boolean) || [] : []
          const tooFewPlayers = definition.minPlayers && draft.players.length < definition.minPlayers
          return (
            <article key={definition.id} className={`module-card ${enabled ? 'module-card--on' : ''} ${excluded ? 'module-card--excluded' : ''}`}>
              <div className="module-card__top">
                <span className="module-card__icon emoji" aria-hidden="true">{definition.icon}</span>
                <Toggle
                  id={`mod-${definition.id}`}
                  label={<span className="visually-hidden">{definition.name}</span>}
                  checked={enabled}
                  disabled={excluded}
                  onChange={(value) => setModuleEnabled(definition.id, value)}
                />
              </div>
              <h3 className="module-card__name">{definition.name}</h3>
              <p className="module-card__description">{definition.description}</p>
              <div className="module-card__chips">
                {suggested && !excluded && <Chip tone="yellow" icon="star">Препоръчан</Chip>}
                {definition.adultsOnly && <Chip tone="red">18+</Chip>}
                {excluded && <Chip tone="red" icon="block">Не е за този режим</Chip>}
                {definition.minPlayers > 2 && <Chip tone={tooFewPlayers ? 'red' : 'default'}>{definition.minPlayers}+ играчи</Chip>}
                {!definition.playable && <Chip tone="accent">Основа</Chip>}
              </div>
              {enabled && summary.length > 0 && <p className="module-card__summary">{summary.join(' · ')}</p>}
              {enabled && errors.length > 0 && (
                <p className="module-card__error">
                  <span className="material-symbols-rounded" aria-hidden="true">error</span> {errors[0].message}
                </p>
              )}
            </article>
          )
        })}
      </div>
      {showErrors && global.length > 0 && (
        <ul className="config-errors" role="alert">
          {global.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
    </div>
  )
}

export function moduleLabel(id) {
  return getModule(id)?.name || id
}
