export default function Icon({ name, className = '', label }) {
  return (
    <span className={`material-symbols-rounded ${className}`} aria-hidden={label ? undefined : 'true'} aria-label={label} role={label ? 'img' : undefined}>
      {name}
    </span>
  )
}
