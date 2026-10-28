import { useStore } from '@nanostores/react'
import { configsApi } from '@/api/endpoints'
import { $me } from '@store/auth'
import { $draft, draftFromConfig, startDraft } from '@store/draft'
import { $allModes } from '@store/modes'
import { go } from '@store/router'
import { toastError } from '@store/toasts'
import { useAsync } from '@/hooks/useAsync'
import ModeCard from '@/components/game/ModeCard'
import Button from '@/components/ui/Button'

function SavedConfigs() {
  const { data, loading } = useAsync(() => configsApi.mine(), [])
  const items = data?.items || []
  if (loading || !items.length) return null
  const load = async (id) => {
    try {
      const config = await configsApi.get(id)
      $draft.set(draftFromConfig(config))
      go('setupStep', { step: 'review' })
    } catch (err) {
      toastError(err.message)
    }
  }
  return (
    <section className="setup-saved">
      <h3 className="setup-saved__title">Или продължи от запазена игра</h3>
      <div className="setup-saved__list">
        {items.slice(0, 6).map((config) => (
          <button key={config.id} type="button" className="setup-saved__item" onClick={() => load(config.id)}>
            <span className="material-symbols-rounded" aria-hidden="true">bookmark</span>
            <span>
              <strong>{config.title}</strong>
              <small>{config.playerCount} играчи · {config.enabledModules.length} модула</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default function StepOccasion() {
  const modes = useStore($allModes)
  const draft = useStore($draft)
  const me = useStore($me)

  const choose = (mode) => {
    if (draft?.modeKey !== mode.key) startDraft(mode)
    go('setupStep', { step: 'players' })
  }

  return (
    <div className="setup-step">
      <header className="setup-step__head">
        <h1 className="setup-step__title">Какъв е поводът?</h1>
        <p className="text-muted">Режимът задава тема, звуци и предложени модули. Всичко може да се промени по-късно.</p>
      </header>
      <div className="mode-grid">
        {modes.map((mode) => (
          <ModeCard key={mode.key} mode={mode} selected={draft?.modeKey === mode.key} onSelect={choose} />
        ))}
      </div>
      {me ? (
        <>
          <p className="setup-step__aside">
            Искаш свой повод с тема и модули? <a href="/my/modes">Създай собствен режим</a>
          </p>
          <SavedConfigs />
        </>
      ) : (
        <p className="setup-step__aside">
          <Button variant="ghost" size="sm" href="/library" icon="auto_stories">Готови игри от общността</Button>
        </p>
      )}
    </div>
  )
}
