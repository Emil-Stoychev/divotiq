import { useState } from 'react'
import { contentApi } from '@/api/endpoints'
import { toastError, toastSuccess } from '@store/toasts'
import { useAsync } from '@/hooks/useAsync'
import { CONTENT_KIND_LIST, CONTENT_KINDS } from '@/game/content/kinds'
import SiteLayout from '@/layouts/SiteLayout'
import ContentCard from '@/components/content/ContentCard'
import ContentForm, { emptyContent } from '@/components/content/ContentForm'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import Tabs from '@/components/ui/Tabs'

const toBody = (item) => ({
  kind: item.kind,
  title: item.title,
  body: item.body,
  category: item.category,
  difficulty: item.difficulty,
  tags: item.tags,
  data: item.data,
  visibility: item.visibility,
})

export default function MyContent() {
  const [tab, setTab] = useState('mine')
  const [kind, setKind] = useState('')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState('')

  const { data, loading, reload } = useAsync(
    () => (tab === 'mine' ? contentApi.mine({ kind: kind || undefined, q: query.trim() || undefined, limit: 100 }) : contentApi.favorites({ kind: kind || undefined, limit: 100 })),
    [tab, kind, query],
  )
  const items = data?.items || []

  const save = async (item) => {
    setBusy(true)
    setServerError('')
    try {
      if (editing.id) await contentApi.update(editing.id, toBody(item))
      else await contentApi.create(toBody(item))
      toastSuccess(editing.id ? 'Промените са запазени' : 'Съдържанието е създадено')
      setEditing(null)
      reload()
    } catch (err) {
      setServerError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    try {
      await contentApi.remove(removing.id)
      setRemoving(null)
      reload()
    } catch (err) {
      toastError(err.message)
    }
  }

  const unfavorite = async (item) => {
    try {
      await contentApi.favorite(item.id)
      reload()
    } catch (err) {
      toastError(err.message)
    }
  }

  return (
    <SiteLayout>
      <div className="container page-pad">
        <header className="page-head">
          <div>
            <span className="eyebrow">Твоите идеи</span>
            <h1 className="page-head__title">Моето съдържание</h1>
            <p className="text-muted">Предизвикателства, фрази, карти, мисии и още — използвай ги в своите игри или ги сподели с общността.</p>
          </div>
          <Button icon="add" onClick={() => { setServerError(''); setEditing(emptyContent(kind || 'challenge')) }}>Ново съдържание</Button>
        </header>

        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'mine', label: 'Създадени от мен', icon: '✍️' }, { value: 'favorites', label: 'Любими', icon: '♥' }]} />
        <div className="filters">
          <Select
            label="Тип"
            value={kind}
            onChange={setKind}
            options={[{ value: '', label: 'Всички типове' }, ...CONTENT_KIND_LIST.map((k) => ({ value: k.id, label: `${k.icon} ${k.plural}` }))]}
          />
          {tab === 'mine' && <input className="input filters__search" type="search" placeholder="Търси…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Търси" />}
        </div>

        {loading ? (
          <Spinner />
        ) : !items.length ? (
          tab === 'mine' ? (
            <EmptyState icon="✍️" title="Още нямаш свое съдържание" text="Създай първото си предизвикателство или Whisper фраза." action={<Button icon="add" onClick={() => setEditing(emptyContent(kind || 'challenge'))}>Създай</Button>} />
          ) : (
            <EmptyState icon="♥" title="Нямаш любими" text="Отбелязвай съдържание в библиотеката със сърчице." action={<Button href="/library" icon="auto_stories">Към библиотеката</Button>} />
          )
        ) : (
          <div className="content-grid">
            {items.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                actions={
                  tab === 'mine' ? (
                    <>
                      <Button size="sm" variant="soft" icon="edit" onClick={() => { setServerError(''); setEditing(item) }}>Редактирай</Button>
                      <Button size="sm" variant="ghost" icon="delete" aria-label="Изтрий" onClick={() => setRemoving(item)} />
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" icon="heart_broken" onClick={() => unfavorite(item)}>Махни от любими</Button>
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? `Редакция: ${CONTENT_KINDS[editing.kind]?.label}` : 'Ново съдържание'} size="md">
        {editing && (
          <ContentForm
            key={editing.id || 'new'}
            initial={editing}
            allowedKinds={editing.id ? [editing.kind] : undefined}
            busy={busy}
            serverError={serverError}
            onCancel={() => setEditing(null)}
            onSubmit={save}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(removing)}
        title="Изтриване"
        text={`„${removing?.title}“ ще бъде изтрито. Игрите, които вече го използват, запазват своето копие.`}
        confirmLabel="Изтрий"
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
      />
    </SiteLayout>
  )
}
