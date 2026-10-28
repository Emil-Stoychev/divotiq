import Icon from './Icon'

// `icon` is either a Material Symbols name ("public") or an emoji ("🎯").
export default function Chip({ children, tone = 'default', icon, className = '' }) {
  return (
    <span className={`chip chip--${tone} ${className}`}>
      {icon && (/^[a-z_]+$/.test(icon) ? <Icon name={icon} className="chip__icon" /> : <span className="emoji">{icon}</span>)}
      {children}
    </span>
  )
}
