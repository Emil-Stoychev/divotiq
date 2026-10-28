import { useState } from 'react'
import { modesApi } from '@/api/endpoints'
import { startDraft } from '@store/draft'
import { loadCustomModes } from '@store/modes'
import { go } from '@store/router'
import { toastError, toastSuccess } from '@store/toasts'
import { useAsync } from '@/hooks/useAsync'
import { customModeFromApi } from '@/game/modes/modes'
import { THEME_LIST } from '@/game/modes/themes'
import { listModules } from '@/game'
import SiteLayout from '@/layouts/SiteLayout'
import { ChipToggleGroup } from '@/components/modules/common'
import ModeCard from '@/components/game/ModeCard'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { Select, TextInput } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import NumberStepper from '@/components/ui/NumberStepper'
import Spinner from '@/components/ui/Spinner'

const ICONS = ['✨', '🎉', '🎃', '💍', '🏖️', '🎓', '🍕', '⚽', '🎤', '🦄', '🔥', '🌙']
const empty = () => ({ name: '', description: '', theme: 'custom', icon: '✨', defaultModules: ['wheel', 'challenges', 'luckCards'], defaultSettings: { rounds: 5 } })

function ModeForm({ initial, onSubmit, onCancel, busy }) {
  const [mode, setMode] = useState(initial)
  const [error, setError] = useState('')
  const set = (patch) => setMode((m) => ({ ...m, ...patch }))
  const submit = (e) => {
    e.preventDefault()
    if (mode.name.trim().length < 2) return setError('Името трябва да е поне 2 символа')
    if (!mode.defaultModules.length) return setError('Изберете поне един модул')
    onSubmit({ ...mode, name: mode.name.trim(), description: mode.description.trim() })
  }
  return (
    <form className="stack" onSubmit={submit}>
      <TextInput label="Име на режима" value={mode.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} placeholder="напр. Моминско парти" />
      <TextInput label="Описание" value={mode.description} maxLength={140} onChange={(e) => set({ description: e.target.value })} />
      <div className="field">
        <span className="field__label">Иконка</span>
        <div className="avatar-picker">
          {ICONS.map((icon) => (
            <button key={icon} type="button" className={`avatar-picker__option ${mode.icon === icon ? 'avatar-picker__option--active' : ''}`} onClick={() => set({ icon })} aria-pressed={mode.icon === icon}>
              <span className="emoji">{icon}</span>
            </button>
          ))}
        </div>
      </div>
      <Select label="Тема" value={mode.theme} onChange={(theme) => set({ theme })} options={THEME_LIST.map((t) => ({ value: t.id, label: t.name }))} />
      <ChipToggleGroup
        label="Модули по подразбиране"
        options={listModules().map((m) => ({ value: m.id, label: m.shortName || m.name, icon: m.icon }))}
        value={mode.defaultModules}
        onChange={(defaultModules) => set({ defaultModules })}
      />
      <NumberStepper label="Рундове по подразбиране" value={mode.defaultSettings?.rounds || 5} min={1} max={50} onChange={(rounds) => set({ defaultSettings: { ...mode.defaultSettings, rounds } })} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="content-form__actions">
        <Button variant="ghost" onClick={onCancel}>Отказ</Button>
        <Button type="submit" icon="check" loading={busy}>Запази</Button>
      </div>
    </form>
  )
}

export default function MyModes() {
  const { data, loading, reload } = useAsync(() => modesApi.mine(), [])
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const items = data?.items || []

  const save = async (mode) => {
    setBusy(true)
    try {
      const body = { name: mode.name, description: mode.description, theme: mode.theme, icon: mode.icon, defaultModules: mode.defaultModules, defaultSettings: mode.defaultSettings }
      if (editing.id) await modesApi.update(editing.id, body)
      else await modesApi.create(body)
      toastSuccess('Режимът е запазен')
      setEditing(null)
      reload()
      loadCustomModes()
    } catch (err) {
      toastError(err.message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    try {
      await modesApi.remove(removing.id)
      setRemoving(null)
      reload()
      loadCustomModes()
    } catch (err) {
      toastError(err.message)
    }
  }
  const play = (mode) => {
    startDraft(customModeFromApi(mode))
    go('setupStep', { step: 'players' })
  }

  return (
    <SiteLayout>
      <div className="container page-pad">
        <header className="page-head">
          <div>
            <span className="eyebrow">Свои поводи</span>
            <h1 className="page-head__title">Моите режими</h1>
            <p className="text-muted">Режимът задава тема, предложени модули и рундове. Появява се до вградените поводи при нова игра.</p>
          </div>
          <Button icon="add" onClick={() => setEditing(empty())}>Нов режим</Button>
        </header>
        {loading ? (
          <Spinner />
        ) : !items.length ? (
          <EmptyState icon="👑" title="Още нямаш свои режими" text="Направи режим за моминско парти, Хелоуин или офис купон." action={<Button icon="add" onClick={() => setEditing(empty())}>Създай режим</Button>} />
        ) : (
          <div className="modes-list">
            {items.map((mode) => (
              <div key={mode.id} className="modes-list__item">
                <ModeCard mode={customModeFromApi(mode)} onSelect={() => play(mode)} compact />
                <div className="modes-list__tools">
                  <Button size="sm" variant="soft" icon="edit" onClick={() => setEditing({ ...empty(), ...mode })}>Редактирай</Button>
                  <Button size="sm" variant="ghost" icon="delete" aria-label="Изтрий" onClick={() => setRemoving(mode)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Редакция на режим' : 'Нов режим'}>
        {editing && <ModeForm key={editing.id || 'new'} initial={editing} busy={busy} onCancel={() => setEditing(null)} onSubmit={save} />}
      </Modal>
      <ConfirmDialog open={Boolean(removing)} title="Изтриване на режим" text={`Режимът „${removing?.name}“ ще бъде изтрит. Запазените игри не се променят.`} confirmLabel="Изтрий" onCancel={() => setRemoving(null)} onConfirm={remove} />
    </SiteLayout>
  )
}
