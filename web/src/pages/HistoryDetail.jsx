import { useStore } from '@nanostores/react'
import { useState } from 'react'
import { sessionsApi } from '@/api/endpoints'
import { go } from '@store/router'
import { $session, resumeServerSession } from '@store/session'
import { toastError } from '@store/toasts'
import { useAsync } from '@/hooks/useAsync'
import { buildSummary, moduleName, publicView } from '@/game'
import SiteLayout from '@/layouts/SiteLayout'
import SummaryView from '@/components/play/SummaryView'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'
import { formatDate } from './Dashboard'

export default function HistoryDetail({ params }) {
  const local = useStore($session)
  const session = useAsync(() => sessionsApi.get(params.id), [params.id])
  const events = useAsync(() => sessionsApi.events(params.id), [params.id])
  const [removing, setRemoving] = useState(false)
  const data = session.data

  const remove = async () => {
    try {
      await sessionsApi.remove(params.id)
      go('dashboard')
    } catch (err) {
      toastError(err.message)
    }
  }

  if (session.loading) return <SiteLayout><Spinner /></SiteLayout>
  if (!data) {
    return (
      <SiteLayout>
        <div className="container page-pad">
          <EmptyState icon="📜" title="Играта не е намерена" text={session.error?.message} action={<Button href="/my">Към моите игри</Button>} />
        </div>
      </SiteLayout>
    )
  }

  const summary = data.summary?.leaderboard ? data.summary : data.state ? buildSummary(publicView(data.state)) : null
  const unfinished = data.status === 'active' || data.status === 'paused'
  const list = events.data?.items || []

  return (
    <SiteLayout>
      <div className="container page-pad">
        <header className="page-head">
          <div>
            <a className="back-link" href="/my"><span className="material-symbols-rounded">arrow_back</span> Моите игри</a>
            <h1 className="page-head__title">{data.title}</h1>
            <p className="text-muted">{formatDate(data.startedAt)} · {data.playerCount} играчи</p>
          </div>
          <div className="row">
            {unfinished && (
              <Button
                icon="play_arrow"
                onClick={() => {
                  if (local?.id !== data.clientId) resumeServerSession(data)
                  go('play')
                }}
              >
                Продължи играта
              </Button>
            )}
            <Button variant="ghost" icon="delete" onClick={() => setRemoving(true)}>Изтрий</Button>
          </div>
        </header>
        {summary && <SummaryView summary={summary} showScores={data.state?.settings?.scoring !== false} />}
        <section className="card timeline">
          <h3>Хронология</h3>
          {events.loading ? (
            <Spinner />
          ) : list.length ? (
            <ol className="timeline__list">
              {list.map((event) => (
                <li key={event.actionId}>
                  <time>{new Date(event.at).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })}</time>
                  <span className="timeline__module">{moduleName(event.moduleId)}</span>
                  <span>{event.summary}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">Няма записани събития.</p>
          )}
        </section>
      </div>
      <ConfirmDialog open={removing} title="Изтриване от историята" text="Записът на тази игра ще бъде изтрит завинаги." confirmLabel="Изтрий" onCancel={() => setRemoving(false)} onConfirm={remove} />
    </SiteLayout>
  )
}
