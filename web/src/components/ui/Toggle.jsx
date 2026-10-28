export default function Toggle({ checked, onChange, label, description, disabled, id }) {
  const inputId = id || `toggle-${label?.replace(/\s+/g, '-')}`
  return (
    <label className={`toggle ${disabled ? 'toggle--disabled' : ''}`} htmlFor={inputId}>
      {(label || description) && (
        <span className="toggle__text">
          {label && <span className="toggle__label">{label}</span>}
          {description && <span className="toggle__description">{description}</span>}
        </span>
      )}
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        className="toggle__input"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
    </label>
  )
}
