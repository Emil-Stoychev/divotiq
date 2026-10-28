import { useId } from 'react'

export default function Field({ label, hint, error, children, className = '' }) {
  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      {label && <span className="field__label">{label}</span>}
      {children}
      {error ? <span className="field__error" role="alert">{error}</span> : hint && <span className="field__hint">{hint}</span>}
    </div>
  )
}

export function TextInput({ label, hint, error, className, multiline, ...props }) {
  const id = useId()
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Field label={label && <label htmlFor={id}>{label}</label>} hint={hint} error={error} className={className}>
      <Tag id={id} className={`input ${multiline ? 'input--multiline' : ''}`} aria-invalid={error ? 'true' : undefined} {...props} />
    </Field>
  )
}

export function Select({ label, hint, error, options, value, onChange, className, ...props }) {
  const id = useId()
  return (
    <Field label={label && <label htmlFor={id}>{label}</label>} hint={hint} error={error} className={className}>
      <select id={id} className="input input--select" value={value} onChange={(e) => onChange(e.target.value)} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}
