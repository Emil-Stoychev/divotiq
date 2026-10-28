export default function Spinner({ label = 'Зареждане…' }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__dot" />
      <span className="spinner__dot" />
      <span className="spinner__dot" />
      <span className="visually-hidden">{label}</span>
    </div>
  )
}
