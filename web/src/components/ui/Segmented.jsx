export default function Segmented({ label, options, value, onChange, size = 'md' }) {
  return (
    <div className="segmented-field">
      {label && <span className="field__label">{label}</span>}
      <div className={`segmented segmented--${size}`} role="radiogroup" aria-label={typeof label === 'string' ? label : undefined}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            disabled={option.disabled}
            title={option.title}
            className={`segmented__option ${value === option.value ? 'segmented__option--active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.icon && <span className="emoji">{option.icon}</span>}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
