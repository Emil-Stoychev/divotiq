import Icon from './Icon'

export default function NumberStepper({ label, value, onChange, min = 0, max = 100, step = 1, suffix = '', hint }) {
  const clamp = (n) => Math.min(max, Math.max(min, n))
  return (
    <div className="stepper">
      <div className="stepper__text">
        <span className="stepper__label">{label}</span>
        {hint && <span className="stepper__hint">{hint}</span>}
      </div>
      <div className="stepper__control" role="group" aria-label={label}>
        <button type="button" className="stepper__btn" onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label="Намали">
          <Icon name="remove" />
        </button>
        <output className="stepper__value" aria-live="polite">
          {value}
          {suffix && <small>{suffix}</small>}
        </output>
        <button type="button" className="stepper__btn" onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label="Увеличи">
          <Icon name="add" />
        </button>
      </div>
    </div>
  )
}
