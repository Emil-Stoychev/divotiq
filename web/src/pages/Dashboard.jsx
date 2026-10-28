import { useStore } from '@nanostores/react'
import { useState } from 'react'
import { configsApi, sessionsApi } from '@/api/endpoints'
import { $me } from '@store/auth'
import { $draft, draftFromConfig } from '@store/draft'
import { getMode } from '@store/modes'
import { go } from '@store/router'
import { $session, resumeServerSession } from '@store/session'
import { toastError, toastSuccess } from '@store/toasts'
import { useAsync } from '@/hooks/useAsync'
import { getModule } from '@/game'
import SiteLayout from '@/layouts/SiteLayout'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'
import Tabs from '@/components/ui/Tabs'

export const formatDate = (value) =>
  new Date(value).toLocaleString('bg-BG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const STATUS = {
  active: { label: 'В ход', tone: 'green' },
  paused: { label: 'На пауза', tone: 'yellow' },
  finished: { label: 'Завършена', tone: 'accent' },
  abandoned: { label: 'Прекъсната', tone: 'default' },
}

function ConfigsTab() {
  const { data, loading, reload } = useAsync(() => configsApi.mine(), [])
  const [removing, setRemoving] = useState(null)
  const items = data?.items || []

  const open = async (config, step) => {
    try {
      const full = await configsApi.get(config.id)
      $draft.set(draftFromConfig(full))
      go('setupStep', { step })
    } catch (err) {
      toastError(err.message)
    }
  }
  const duplicate = async (config) => {
    try {
      await configsApi.duplicate(config.id)
      toastSuccess('Копието е създадено')
      reload()
    } catch (err) {
      toastError(err.message)
    }
  }
  const toggleVisibility = async (config) => {
    try {
      const full = await configsApi.get(config.id)
      await configsApi.update(config.id, { ...full, visibility: config.visibility === 'public' ? 'private' : 'public' })
      toastSuccess(config.visibility === 'public' ? 'Играта вече е лична' : 'Играта е споделена в библиотеката')
      reload()
    } catch (err) {
      toastError(err.message)
    }
  }
  const remove = async () => {
    try {
      await configsApi.remove(removing.id)
      setRemoving(null)
      reload()
    } catch (err) {
      toastError(err.message)
    }
  }

  if (loading) return <Spinner />
  if (!items.length) {
    return <EmptyState icon="🎲" title="Още няма запазени игри" text="Създай игра и натисни „Запази за по-късно“ на последната стъпка." action={<Button href="/new" icon="add">Нова игра</Button>} />
  }
  return (
    <>
      <div className="config-grid-cards">
        {items.map((config) => {
          const mode = getMode(config.modeKey)
          return (
            <article key={config.id} className="saved-config card">
              <header className="saved-config__head">
                <span className="emoji saved-config__icon" aria-hidden="true">{mode.icon}</span>
                <div>
                  <h3>{config.title}</h3>
                  <small className="text-muted">{mode.name} · {config.playerCount} играчи · обновена {formatDate(config.updatedAt)}</small>
                </div>
              </header>
              <div className="saved-config__modules">
                {config.enabledModules.map((id) => getModule(id) && <span key={id} title={getModule(id).name} className="emoji">{getModule(id).icon}</span>)}
              </div>
              <div className="saved-config__chips">
                {config.visibility === 'public' ? <Chip tone="green" icon="public">Публична</Chip> : <Chip icon="lock">Лична</Chip>}
                {config.playsCount > 0 && <Chip>Играна {config.playsCount}×</Chip>}
                {config.copiesCount > 0 && <Chip>Копирана {config.copiesCount}×</Chip>}
              </div>
              <footer className="saved-config__actions">
                <Button size="sm" icon="play_arrow" onClick={() => open(config, 'review')}>Играй</Button>
                <Button size="sm" variant="soft" icon="edit" onClick={() => open(config, 'modules')}>Редактирай</Button>
                <Button size="sm" variant="ghost" icon="content_copy" aria-label="Дублирай" title="Дублирай" onClick={() => duplicate(config)} />
                <Button size="sm" variant="ghost" icon={config.visibility === 'public' ? 'public_off' : 'public'} aria-label="Смени видимостта" title={config.visibility === 'public' ? 'Направи лична' : 'Сподели в библиотеката'} onClick={() => toggleVisibility(config)} />
                <Button size="sm" variant="ghost" icon="delete" aria-label="Изтрий" title="Изтрий" onClick={() => setRemoving(config)} />
              </footer>
            </article>
          )
        })}
      </div>
      <ConfirmDialog open={Boolean(removing)} title="Изтриване на игра" text={`„${removing?.title}“ ще бъде изтрита. Историята на изиграните игри остава.`} confirmLabel="Изтрий" onCancel={() => setRemoving(null)} onConfirm={remove} />
    </>
  )
}

function HistoryTab() {
  const { data, loading, reload } = useAsync(() => sessionsApi.list({ limit: 50 }), [])
  const local = useStore($session)
  const items = data?.items || []

  const resume = async (item) => {
    try {
      const full = await sessionsApi.get(item.id)
      resumeServerSession(full)
      go('play')
    } catch (err) {
      toastError(err.message)
    }
  }

  if (loading) return <Spinner />
  if (!items.length) return <EmptyState icon="📜" title="Още няма изиграни игри" text="Игрите ти се запазват автоматично, докато си влязъл в профила." />
  return (
    <ul className="history-cards">
      {items.map((item) => {
        const status = STATUS[item.status] || STATUS.active
        const isLocal = local && local.id === item.clientId
        const winners = item.summary?.winners || []
        return (
          <li key={item.id} className="history-card card">
            <a className="history-card__main" href={`/my/history/${item.id}`}>
              <span className="emoji history-card__icon" aria-hidden="true">{getMode(item.modeKey).icon}</span>
              <span className="history-card__text">
                <strong>{item.title}</strong>
                <small>{formatDate(item.startedAt)} · {item.playerCount} играчи{winners.length ? ` · 🏆 ${winners.join(', ')}` : ''}</small>
              </span>
              <Chip tone={status.tone}>{status.label}</Chip>
            </a>
            {(item.status === 'active' || item.status === 'paused') && (
              <Button size="sm" variant="accent" icon="play_arrow" onClick={() => (isLocal ? go('play') : resume(item))}>Продължи</Button>
            )}
          </li>
        )
      })}
      <li className="history-cards__more">
        <Button variant="ghost" size="sm" icon="refresh" onClick={reload}>Опресни</Button>
      </li>
    </ul>
  )
}

export default function Dashboard() {
  const me = useStore($me)
  const [tab, setTab] = useState('configs')
  return (
    <SiteLayout>
      <div className="container page-pad">
        <header className="page-head">
          <div>
            <span className="eyebrow">Здравей, {me?.name} {me?.avatar}</span>
            <h1 className="page-head__title">Моите игри</h1>
          </div>
          <div className="row">
            <Button variant="secondary" icon="library_books" href="/my/content">Моето съдържание</Button>
            <Button variant="secondary" icon="palette" href="/my/modes">Моите режими</Button>
            <Button icon="add" href="/new">Нова игра</Button>
          </div>
        </header>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'configs', label: 'Запазени игри', icon: '🎲' },
            { value: 'history', label: 'История', icon: '📜' },
          ]}
        />
        <div className="page-body">{tab === 'configs' ? <ConfigsTab /> : <HistoryTab />}</div>
      </div>
    </SiteLayout>
  )
}
