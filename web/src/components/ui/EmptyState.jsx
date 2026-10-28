export default function EmptyState({ icon = '✨', title, text, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon emoji" aria-hidden="true">{icon}</span>
      <h3 className="empty-state__title">{title}</h3>
      {text && <p className="empty-state__text">{text}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  )
}
