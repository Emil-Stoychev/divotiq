import { getTheme } from '@/game/modes/themes'

export default function ModeCard({ mode, selected, onSelect, compact = false, href }) {
  const theme = getTheme(mode.theme)
  const [c1, c2] = theme.swatch
  const Tag = href ? 'a' : 'button'
  return (
    <Tag
      type={href ? undefined : 'button'}
      href={href}
      className={`mode-card ${compact ? 'mode-card--compact' : ''} ${selected ? 'mode-card--selected' : ''}`}
      style={{ '--c1': c1, '--c2': c2 }}
      onClick={onSelect ? () => onSelect(mode) : undefined}
      aria-pressed={onSelect ? Boolean(selected) : undefined}
    >
      <span className="mode-card__icon emoji" aria-hidden="true">{mode.icon}</span>
      <span className="mode-card__text">
        <span className="mode-card__name">{mode.name}</span>
        <span className="mode-card__description">{mode.description}</span>
      </span>
      {mode.adultsOnly && <span className="mode-card__badge">18+</span>}
      {selected && <span className="mode-card__check material-symbols-rounded" aria-hidden="true">check_circle</span>}
    </Tag>
  )
}
