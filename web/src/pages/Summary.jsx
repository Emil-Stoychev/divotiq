import { useStore } from '@nanostores/react'
import { useEffect } from 'react'
import { $me } from '@store/auth'
import { $draft, draftFromSession } from '@store/draft'
import { go } from '@store/router'
import { $session, $sync, $syncStatus, clearSession } from '@store/session'
import { buildSummary, publicView } from '@/game'
import SiteLayout from '@/layouts/SiteLayout'
import SummaryView from '@/components/play/SummaryView'
import Button from '@/components/ui/Button'

export default function Summary() {
  const session = useStore($session)
  const me = useStore($me)
  const sync = useStore($sync)
  const syncStatus = useStore($syncStatus)

  useEffect(() => {
    if (!session) go('home')
    else if (session.status !== 'finished') go('play')
  }, [session])

  if (!session || session.status !== 'finished') return null
  const summary = buildSummary(publicView(session))
  const winners = summary.winners

  const playAgain = () => {
    $draft.set(draftFromSession(session))
    clearSession()
    go('setupStep', { step: 'review' })
  }

  return (
    <SiteLayout>
      <div className="container summary-page">
        <header className="summary-page__head">
          <span className="eyebrow">Край на играта</span>
          <h1 className="summary-page__title">
            {winners.length === 1 ? `🏆 ${winners[0]} печели!` : winners.length > 1 ? `🏆 Равенство: ${winners.join(', ')}` : '🎉 Страхотна игра!'}
          </h1>
          <p className="text-muted">„{session.title}“ · всяка дивотия създава история!</p>
        </header>
        <SummaryView summary={summary} showScores={session.settings.scoring} />
        <div className="summary-page__actions">
          <Button size="lg" icon="replay" onClick={playAgain}>Играй отново</Button>
          <Button size="lg" variant="secondary" icon="add" onClick={() => { clearSession(); go('setup') }}>Нова игра</Button>
          {me && sync.serverId ? (
            <Button variant="ghost" icon="history" href={`/my/history/${sync.serverId}`}>
              {syncStatus === 'saving' ? 'Запазване…' : 'Виж в историята'}
            </Button>
          ) : (
            !me && <Button variant="ghost" icon="login" href="/login?next=/play/summary">Влез, за да запазиш играта</Button>
          )}
        </div>
      </div>
    </SiteLayout>
  )
}
