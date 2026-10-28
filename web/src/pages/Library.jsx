import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'
import { adminApi, configsApi, contentApi } from '@/api/endpoints'
import { $me, isAdmin } from '@store/auth'
import { $allModes, getMode } from '@store/modes'
import { go } from '@store/router'
import { toastError, toastSuccess } from '@store/toasts'
import { useAsync } from '@/hooks/useAsync'
import { CONTENT_KIND_LIST } from '@/game/content/kinds'
import { DIFFICULTIES } from '@/game/modules/shared'
import { getModule } from '@/game'
import SiteLayout from '@/layouts/SiteLayout'
import ContentCard from '@/components/content/ContentCard'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { Select, TextInput } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import Tabs from '@/components/ui/Tabs'

const PAGE = 30

function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

function ReportModal({ item, onClose }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await contentApi.report(item.id, reason.trim())
      toastSuccess(res.message)
      onClose()
    } catch (err) {
      toastError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={Boolean(item)} onClose={onClose} title="Сигнал за неподходящо съдържание" size="sm">
      <form className="stack" onSubmit={submit}>
        <p className="text-muted">„{item?.title}“</p>
        <TextInput multiline rows={3} label="Причина (по желание)" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button type="submit" variant="danger" icon="flag" loading={busy}>Изпрати сигнал</Button>
      </form>
    </Modal>
  )
}

function ContentTab() {
  const me = useStore($me)
  const [filters, setFilters] = useState({ kind: '', difficulty: '', sort: 'popular', q: '', tag: '' })
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [reporting, setReporting] = useState(null)
  const q = useDebounced(filters.q)
  const tag = useDebounced(filters.tag)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    contentApi
      .library({ kind: filters.kind || undefined, difficulty: filters.difficulty || undefined, sort: filters.sort, q: q.trim() || undefined, tag: tag.trim().replace(/^#/, '') || undefined, limit: PAGE, offset })
      .then((res) => {
        if (cancelled) return
        setItems((current) => (offset ? [...current, ...res.items] : res.items))
        setTotal(res.total)
      })
      .catch((err) => !cancelled && toastError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filters.kind, filters.difficulty, filters.sort, q, tag, offset])

  const set = (patch) => {
    setOffset(0)
    setFilters((f) => ({ ...f, ...patch }))
  }
  const replace = (updated) => setItems((list) => list.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)))
  const needLogin = () => go('login', {}, { next: '/library' })

  const favorite = async (item) => {
    if (!me) return needLogin()
    try {
      const res = await contentApi.favorite(item.id)
      replace({ id: item.id, isFavorite: res.isFavorite, favoritesCount: res.favoritesCount })
    } catch (err) {
      toastError(err.message)
    }
  }
  const copy = async (item) => {
    if (!me) return needLogin()
    try {
      await contentApi.copy(item.id)
      replace({ id: item.id, copiesCount: (item.copiesCount || 0) + 1 })
      toastSuccess('Копирано в „Моето съдържание“ — можеш да го редактираш')
    } catch (err) {
      toastError(err.message)
    }
  }

  return (
    <>
      <div className="filters">
        <input className="input filters__search" type="search" placeholder="Търси предизвикателства, фрази, въпроси…" value={filters.q} onChange={(e) => set({ q: e.target.value })} aria-label="Търси" />
        <Select label="Тип" value={filters.kind} onChange={(kind) => set({ kind })} options={[{ value: '', label: 'Всички' }, ...CONTENT_KIND_LIST.map((k) => ({ value: k.id, label: `${k.icon} ${k.plural}` }))]} />
        <Select label="Трудност" value={filters.difficulty} onChange={(difficulty) => set({ difficulty })} options={[{ value: '', label: 'Всякаква' }, ...DIFFICULTIES.map((d) => ({ value: d.id, label: d.label }))]} />
        <Select
          label="Подреди"
          value={filters.sort}
          onChange={(sort) => set({ sort })}
          options={[
            { value: 'popular', label: 'Най-харесвани' },
            { value: 'new', label: 'Най-нови' },
            { value: 'title', label: 'По азбучен ред' },
          ]}
        />
        <TextInput label="Таг" value={filters.tag} placeholder="#коледа" onChange={(e) => set({ tag: e.target.value })} />
      </div>
      {loading && !items.length ? (
        <Spinner />
      ) : !items.length ? (
        <EmptyState icon="🔍" title="Нищо не намерихме" text="Опитай с други филтри — или сподели първото съдържание от този тип!" action={me && <Button href="/my/content" icon="add">Създай съдържание</Button>} />
      ) : (
        <>
          <p className="text-muted small">{total} резултата</p>
          <div className="content-grid">
            {items.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                actions={
                  <>
                    <Button size="sm" variant={item.isFavorite ? 'accent' : 'soft'} icon={item.isFavorite ? 'favorite' : 'favorite_border'} onClick={() => favorite(item)} aria-pressed={item.isFavorite}>
                      {item.isFavorite ? 'Любимо' : 'Харесай'}
                    </Button>
                    {!item.isOwn && <Button size="sm" variant="soft" icon="content_copy" onClick={() => copy(item)}>Копирай</Button>}
                    {!item.isOwn && <Button size="sm" variant="ghost" icon="flag" aria-label="Сигнал" title="Сигнал за неподходящо" onClick={() => (me ? setReporting(item) : needLogin())} />}
                  </>
                }
              />
            ))}
          </div>
          {items.length < total && (
            <div className="center">
              <Button variant="secondary" loading={loading} onClick={() => setOffset(items.length)}>Зареди още</Button>
            </div>
          )}
        </>
      )}
      <ReportModal item={reporting} onClose={() => setReporting(null)} />
    </>
  )
}

function ConfigsTab() {
  const modes = useStore($allModes)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('')
  const q = useDebounced(query)
  const { data, loading } = useAsync(() => configsApi.library({ q: q.trim() || undefined, mode: mode || undefined, sort: 'popular', limit: 48 }), [q, mode])
  const items = data?.items || []
  return (
    <>
      <div className="filters">
        <input className="input filters__search" type="search" placeholder="Търси готови игри…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Търси" />
        <Select label="Повод" value={mode} onChange={setMode} options={[{ value: '', label: 'Всички' }, ...modes.filter((m) => !m.isCustom).map((m) => ({ value: m.key, label: `${m.icon} ${m.name}` }))]} />
      </div>
      {loading ? (
        <Spinner />
      ) : !items.length ? (
        <EmptyState icon="🎲" title="Още няма споделени игри" text="Запази своя игра като публична и тя ще се появи тук." />
      ) : (
        <div className="config-grid-cards">
          {items.map((config) => {
            const m = getMode(config.modeKey)
            return (
              <a key={config.id} className="saved-config card card--interactive" href={`/game/${config.id}`}>
                <header className="saved-config__head">
                  <span className="emoji saved-config__icon" aria-hidden="true">{m.icon}</span>
                  <div>
                    <h3>{config.title}</h3>
                    <small className="text-muted">{m.name}{config.author ? ` · ${config.author.avatar} ${config.author.name}` : ''}</small>
                  </div>
                </header>
                {config.description && <p className="saved-config__description">{config.description}</p>}
                <div className="saved-config__modules">
                  {config.enabledModules.map((id) => getModule(id) && <span key={id} title={getModule(id).name} className="emoji">{getModule(id).icon}</span>)}
                </div>
                <small className="text-muted">Копирана {config.copiesCount}× · Играна {config.playsCount}×</small>
              </a>
            )
          })}
        </div>
      )}
    </>
  )
}

function ModerationTab() {
  const { data, loading, reload } = useAsync(() => adminApi.reported(), [])
  const items = data?.items || []
  const moderate = async (item, status) => {
    try {
      await adminApi.moderate(item.id, status)
      toastSuccess(status === 'hidden' ? 'Скрито' : 'Възстановено')
      reload()
    } catch (err) {
      toastError(err.message)
    }
  }
  if (loading) return <Spinner />
  if (!items.length) return <EmptyState icon="✅" title="Няма сигнали" />
  return (
    <div className="content-grid">
      {items.map((item) => (
        <ContentCard
          key={item.id}
          item={item}
          actions={
            <>
              <span className="text-muted small">Сигнали: {item.reportsCount}</span>
              {item.status === 'hidden' ? (
                <Button size="sm" variant="success" icon="visibility" onClick={() => moderate(item, 'active')}>Възстанови</Button>
              ) : (
                <Button size="sm" variant="danger" icon="visibility_off" onClick={() => moderate(item, 'hidden')}>Скрий</Button>
              )}
            </>
          }
        />
      ))}
    </div>
  )
}

export default function Library({ search }) {
  const me = useStore($me)
  const [tab, setTab] = useState(search?.tab === 'games' ? 'games' : 'content')
  const tabs = [
    { value: 'content', label: 'Съдържание', icon: '✍️' },
    { value: 'games', label: 'Готови игри', icon: '🎲' },
    isAdmin(me) && { value: 'moderation', label: 'Модерация', icon: '🛡️' },
  ].filter(Boolean)
  return (
    <SiteLayout>
      <div className="container page-pad">
        <header className="page-head">
          <div>
            <span className="eyebrow">Общността</span>
            <h1 className="page-head__title">Библиотека</h1>
            <p className="text-muted">Публично съдържание и готови игри от други играчи. Харесай, копирай и използвай в своите игри.</p>
          </div>
          {me ? <Button icon="add" href="/my/content">Сподели свое</Button> : <Button variant="secondary" href="/register">Създай профил, за да споделяш</Button>}
        </header>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        <div className="page-body">
          {tab === 'content' && <ContentTab />}
          {tab === 'games' && <ConfigsTab />}
          {tab === 'moderation' && <ModerationTab />}
        </div>
      </div>
    </SiteLayout>
  )
}
