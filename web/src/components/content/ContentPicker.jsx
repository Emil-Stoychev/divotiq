import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'
import { contentApi } from '@/api/endpoints'
import { $me } from '@store/auth'
import { CONTENT_KINDS } from '@/game/content/kinds'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import Segmented from '@/components/ui/Segmented'
import Spinner from '@/components/ui/Spinner'
import Tabs from '@/components/ui/Tabs'
import ContentCard from './ContentCard'

const SOURCES = [
  { value: 'library', label: 'Библиотека', icon: '🌍' },
  { value: 'mine', label: 'Моето', icon: '🗂️' },
  { value: 'favorites', label: 'Любими', icon: '♥' },
]

// Lets the host pull saved/library content into a module config. Picked items
// are copied as snapshots, so later edits of the originals never change games.
export default function ContentPicker({ open, onClose, kinds, onPick, excludeSourceIds = [] }) {
  const me = useStore($me)
  const [source, setSource] = useState('library')
  const [kind, setKind] = useState(kinds[0])
  const [query, setQuery] = useState('')
  const [state, setState] = useState({ loading: false, items: [], error: null })
  const [selected, setSelected] = useState({})

  useEffect(() => {
    if (!open) return undefined
    setSelected({})
    setKind(kinds[0])
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined
    if (source !== 'library' && !me) {
      setState({ loading: false, items: [], error: null })
      return undefined
    }
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    const timer = setTimeout(async () => {
      try {
        const params = { kind, q: query.trim() || undefined, limit: 60, sort: source === 'library' ? 'popular' : undefined }
        const res = await (source === 'library' ? contentApi.library(params) : source === 'mine' ? contentApi.mine(params) : contentApi.favorites(params))
        if (!cancelled) setState({ loading: false, items: res.items, error: null })
      } catch (err) {
        if (!cancelled) setState({ loading: false, items: [], error: err.message })
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, source, kind, query, me])

  const picked = Object.values(selected)
  const toggle = (item) =>
    setSelected((current) => {
      const next = { ...current }
      if (next[item.id]) delete next[item.id]
      else next[item.id] = item
      return next
    })

  const visible = state.items.filter((item) => !excludeSourceIds.includes(item.id))

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Добави съдържание"
      footer={
        <>
          <span className="text-muted">{picked.length ? `Избрани: ${picked.length}` : 'Избери едно или повече'}</span>
          <Button
            icon="add"
            disabled={!picked.length}
            onClick={() => {
              onPick(picked)
              onClose()
            }}
          >
            Добави
          </Button>
        </>
      }
    >
      <div className="picker">
        <Tabs tabs={SOURCES} value={source} onChange={setSource} />
        {kinds.length > 1 && (
          <Segmented
            size="sm"
            value={kind}
            onChange={setKind}
            options={kinds.map((id) => ({ value: id, label: CONTENT_KINDS[id].label, icon: CONTENT_KINDS[id].icon }))}
          />
        )}
        <input className="input" type="search" placeholder="Търси…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Търси" />
        {source !== 'library' && !me ? (
          <EmptyState icon="🔐" title="Нужен е профил" text="Влез, за да използваш своето и любимото си съдържание." action={<Button href="/login" size="sm">Вход</Button>} />
        ) : state.loading ? (
          <Spinner />
        ) : state.error ? (
          <EmptyState icon="⚠️" title="Грешка" text={state.error} />
        ) : !visible.length ? (
          <EmptyState icon="🔍" title="Няма намерено съдържание" text={source === 'mine' ? 'Създай съдържание от „Моето съдържание“.' : 'Опитай с друго търсене.'} />
        ) : (
          <div className="picker__grid">
            {visible.map((item) => (
              <ContentCard key={item.id} item={item} selected={Boolean(selected[item.id])} onClick={() => toggle(item)} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
