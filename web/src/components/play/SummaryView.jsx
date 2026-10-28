import { boardRanks, moduleName } from '@/game'
import Avatar from '@/components/ui/Avatar'

const MISSION_STATUS = { completed: '✅ Изпълнена', failed: '❌ Провалена', expired: '⌛ Неизпълнена', active: '…' }

// Renders a stored summary (buildSummary output). Used after a game and in history.
export default function SummaryView({ summary, showScores = true }) {
  const board = summary.leaderboard || []
  const ranks = boardRanks(board)
  const podium = [board[1], board[0], board[2]].filter(Boolean)
  const moduleCounts = Object.entries(summary.moduleCounts || {}).sort((a, b) => b[1] - a[1])
  return (
    <div className="summary">
      {showScores && board.length > 0 && (
        <div className="podium" aria-label="Подиум">
          {podium.map((p) => {
            const place = ranks[board.indexOf(p)]
            return (
              <div key={p.name} className={`podium__place podium__place--${board.indexOf(p) + 1}`}>
                <Avatar emoji={p.avatar} size={place === 1 ? 'xl' : 'lg'} />
                <span className="podium__name">{p.name}</span>
                <span className="podium__score">{p.score} т.</span>
                <span className="podium__block">{place === 1 ? '👑' : place}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="summary__grid">
        {showScores && (
          <section className="card summary__card">
            <h3>Класиране</h3>
            <ol className="scoreboard scoreboard--static">
              {board.map((p, i) => (
                <li key={p.name} className="scoreboard__row">
                  <span className="scoreboard__rank">{ranks[i]}</span>
                  <Avatar emoji={p.avatar} size="sm" />
                  <span className="scoreboard__name">{p.name}</span>
                  <span className="scoreboard__score">{p.score}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
        <section className="card summary__card">
          <h3>Статистика</h3>
          <dl className="stats">
            <div><dt>Време</dt><dd>{summary.durationMinutes} мин.</dd></div>
            <div><dt>Ходове</dt><dd>{summary.turns}</dd></div>
            <div><dt>Рундове</dt><dd>{summary.rounds}</dd></div>
          </dl>
          {moduleCounts.length > 0 && (
            <ul className="module-counts">
              {moduleCounts.map(([id, count]) => (
                <li key={id}><span>{moduleName(id)}</span><span>{count}</span></li>
              ))}
            </ul>
          )}
        </section>
        {summary.gifts?.length > 0 && (
          <section className="card summary__card">
            <h3>🎁 Подаръци</h3>
            <ul className="summary__list">
              {summary.gifts.map((g, i) => (
                <li key={i}><strong>{g.owner}</strong> — {g.name}</li>
              ))}
            </ul>
          </section>
        )}
        {summary.missions?.length > 0 && (
          <section className="card summary__card">
            <h3>🕵️ Тайни мисии</h3>
            <ul className="summary__list">
              {summary.missions.map((m, i) => (
                <li key={i}>
                  <strong>{m.owner}</strong>: {m.title} <small>{MISSION_STATUS[m.status] || m.status}</small>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
