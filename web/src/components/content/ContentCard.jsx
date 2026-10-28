import { CONTENT_KINDS } from '@/game/content/kinds'
import { difficultyLabel } from '@/game/modules/shared'
import Chip from '@/components/ui/Chip'

// Compact display of one content item (library, my content, picker).
export default function ContentCard({ item, actions, selected, onClick }) {
  const kind = CONTENT_KINDS[item.kind]
  const Tag = onClick ? 'button' : 'article'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`content-card ${selected ? 'content-card--selected' : ''} ${onClick ? 'content-card--clickable' : ''}`}
      onClick={onClick}
      aria-pressed={onClick ? Boolean(selected) : undefined}
    >
      <header className="content-card__head">
        <span className="content-card__kind">
          <span className="emoji" aria-hidden="true">{kind?.icon}</span> {kind?.label}
        </span>
        {item.visibility === 'public' && item.isOwn && <Chip tone="green" icon="public">Публично</Chip>}
        {item.status === 'hidden' && <Chip tone="red" icon="visibility_off">Скрито</Chip>}
        {selected && <span className="material-symbols-rounded content-card__check" aria-hidden="true">check_circle</span>}
      </header>
      <h3 className="content-card__title">{item.title}</h3>
      {item.body && <p className="content-card__body">{item.body}</p>}
      {item.kind === 'trivia' && item.data?.options && (
        <ul className="content-card__options">
          {item.data.options.map((option, i) => (
            <li key={i} className={i === item.data.answerIndex ? 'is-correct' : ''}>{option}</li>
          ))}
        </ul>
      )}
      {item.kind === 'drinking' && item.data?.alternative && <p className="content-card__alt">🧃 {item.data.alternative}</p>}
      <footer className="content-card__meta">
        <Chip tone={item.difficulty}>{difficultyLabel(item.difficulty)}</Chip>
        {item.category && <Chip>{item.category}</Chip>}
        {(item.tags || []).slice(0, 3).map((tag) => (
          <Chip key={tag} tone="accent">#{tag}</Chip>
        ))}
        {item.author && <span className="content-card__author">{item.author.avatar} {item.author.name}</span>}
        {(item.favoritesCount > 0 || item.copiesCount > 0) && (
          <span className="content-card__stats">
            {item.favoritesCount > 0 && <span>♥ {item.favoritesCount}</span>}
            {item.copiesCount > 0 && <span>⧉ {item.copiesCount}</span>}
          </span>
        )}
      </footer>
      {actions && <div className="content-card__actions">{actions}</div>}
    </Tag>
  )
}
