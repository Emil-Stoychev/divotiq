export default function Avatar({ emoji, name, size = 'md', active = false, className = '' }) {
  return (
    <span className={`avatar avatar--${size} ${active ? 'avatar--active' : ''} ${className}`} title={name}>
      <span className="emoji" aria-hidden="true">{emoji || '🙂'}</span>
      {name && <span className="visually-hidden">{name}</span>}
    </span>
  )
}
