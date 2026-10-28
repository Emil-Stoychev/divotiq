export const WIZARD_STEPS = [
  { id: 'occasion', label: 'Повод', icon: 'celebration' },
  { id: 'players', label: 'Играчи', icon: 'group' },
  { id: 'modules', label: 'Модули', icon: 'extension' },
  { id: 'configure', label: 'Настройки', icon: 'tune' },
  { id: 'review', label: 'Преглед', icon: 'rocket_launch' },
]

export default function WizardProgress({ current, onStep, reachable }) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === current)
  return (
    <nav className="wizard-progress" aria-label="Стъпки">
      <ol>
        {WIZARD_STEPS.map((step, index) => {
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo'
          const enabled = reachable(step.id)
          return (
            <li key={step.id} className={`wizard-progress__step wizard-progress__step--${state}`}>
              <button type="button" disabled={!enabled} onClick={() => onStep(step.id)} aria-current={state === 'current' ? 'step' : undefined}>
                <span className="wizard-progress__dot">
                  {state === 'done' ? <span className="material-symbols-rounded">check</span> : index + 1}
                </span>
                <span className="wizard-progress__label">{step.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
