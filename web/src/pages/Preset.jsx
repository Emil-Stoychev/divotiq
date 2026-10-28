import { useStore } from '@nanostores/react'
import { configsApi } from '@/api/endpoints'
import { $me } from '@store/auth'
import { $draft, draftFromConfig } from '@store/draft'
import { getMode } from '@store/modes'
import { go } from '@store/router'
import { toastError, toastSuccess } from '@store/toasts'
import { useAsync } from '@/hooks/useAsync'
import { getModule, listModules } from '@/game'
import { getTheme } from '@/game/modes/themes'
import SiteLayout from '@/layouts/SiteLayout'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'

export default function Preset({ params }) {
  const me = useStore($me)
  const { data: config, loading, error } = useAsync(() => configsApi.get(params.id), [params.id])

  if (loading) return <SiteLayout><Spinner /></SiteLayout>
  if (!config) {
    return (
      <SiteLayout>
        <div className="container page-pad">
          <EmptyState icon="🔒" title="Играта не е достъпна" text={error?.message || 'Може да е лична или изтрита.'} action={<Button href="/library?tab=games">Към готовите игри</Button>} />
        </div>
      </SiteLayout>
    )
  }

  const mode = getMode(config.modeKey)
  const theme = getTheme(config.theme)
  const enabled = listModules().filter((m) => config.modules?.[m.id]?.enabled)

  const play = () => {
    const draft = draftFromConfig(config)
    // Shared presets never carry player names: keep the host's current players.
    if (!draft.players.length) draft.players = $draft.get()?.players || []
    $draft.set(draft)
    go('setupStep', { step: 'players' })
  }
  const copy = async () => {
    try {
      await configsApi.duplicate(config.id)
      toastSuccess('Копирано в „Моите игри“')
    } catch (err) {
      toastError(err.message)
    }
  }

  return (
    <SiteLayout>
      <div className="container page-pad preset">
        <a className="back-link" href="/library?tab=games"><span className="material-symbols-rounded">arrow_back</span> Готови игри</a>
        <header className="preset__hero card" style={{ '--c1': theme.swatch[0], '--c2': theme.swatch[1] }}>
          <span className="preset__icon emoji" aria-hidden="true">{mode.icon}</span>
          <div>
            <span className="eyebrow">{mode.name} · тема „{theme.name}“</span>
            <h1 className="page-head__title">{config.title}</h1>
            {config.description && <p className="text-muted">{config.description}</p>}
            {config.author && <p className="preset__author">{config.author.avatar} {config.author.name}</p>}
          </div>
        </header>
        <section className="card">
          <h2 className="section-title">Модули</h2>
          <ul className="review__modules">
            {enabled.map((definition) => {
              const cfg = { ...definition.defaultConfig(), ...config.modules[definition.id].config }
              const summary = definition.summarizeConfig?.(cfg, { enabledModules: enabled.map((m) => m.id), theme: config.theme })?.filter(Boolean) || []
              return (
                <li key={definition.id}>
                  <span className="emoji" aria-hidden="true">{definition.icon}</span>
                  <span>
                    <strong>{definition.name}</strong>
                    <small>{summary.join(' · ')}</small>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="text-muted small">
            {config.settings?.endCondition === 'manual' ? 'Без лимит на рундове' : `${config.settings?.rounds || 5} рунда`} · ходът се решава от{' '}
            {config.settings?.turnSource === 'wheel' ? 'колелото' : config.settings?.turnSource === 'host' ? 'домакина' : 'случаен модул'}
            {getModule('missions') && config.modules?.missions?.enabled ? ' · изисква поне 3 играчи' : ''}
          </p>
        </section>
        <div className="row">
          <Button size="lg" icon="play_arrow" onClick={play}>Играй тази игра</Button>
          {me && !config.isOwn && <Button size="lg" variant="secondary" icon="content_copy" onClick={copy}>Копирай в моите игри</Button>}
          {!me && <Button variant="ghost" href={`/login?next=/game/${config.id}`}>Влез, за да я запазиш</Button>}
        </div>
      </div>
    </SiteLayout>
  )
}
