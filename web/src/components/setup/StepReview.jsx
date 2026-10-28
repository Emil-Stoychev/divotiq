import { useStore } from '@nanostores/react'
import { useState } from 'react'
import { configsApi } from '@/api/endpoints'
import { $me } from '@store/auth'
import { $draft, draftToConfigBody, updateDraft } from '@store/draft'
import { getMode } from '@store/modes'
import { go } from '@store/router'
import { $session, startGame } from '@store/session'
import { toastError, toastSuccess } from '@store/toasts'
import { enabledModuleIds, estimateMinutes, getModule, moduleContext, validateDraft } from '@/game'
import { getTheme } from '@/game/modes/themes'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { TextInput } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import Segmented from '@/components/ui/Segmented'

const TURN_SOURCE = { wheel: 'Колелото решава', random: 'Случаен модул', host: 'Домакинът избира' }

function SaveConfig({ draft, open, onClose }) {
  const [visibility, setVisibility] = useState('private')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [asNew, setAsNew] = useState(false)
  const updating = Boolean(draft.configId) && !asNew

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const body = draftToConfigBody(draft, { visibility, description: description.trim() })
      const saved = updating ? await configsApi.update(draft.configId, body) : await configsApi.create(body)
      updateDraft((d) => { d.configId = saved.id })
      toastSuccess(updating ? 'Промените са запазени' : 'Играта е запазена в профила ти')
      onClose()
    } catch (err) {
      toastError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={updating ? 'Запази промените' : 'Запази играта'} size="sm">
      <form className="stack" onSubmit={save}>
        <TextInput multiline rows={2} label="Кратко описание (по желание)" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
        <Segmented
          label="Видимост"
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: 'private', label: 'Само за мен', icon: '🔒' },
            { value: 'public', label: 'Сподели в библиотеката', icon: '🌍' },
          ]}
        />
        {visibility === 'public' && <p className="text-muted small">Имената на играчите никога не се показват публично — само настройките.</p>}
        {draft.configId && (
          <label className="check">
            <input type="checkbox" checked={asNew} onChange={(e) => setAsNew(e.target.checked)} /> Запази като нова игра
          </label>
        )}
        <Button type="submit" icon="save" loading={busy}>Запази</Button>
      </form>
    </Modal>
  )
}

export default function StepReview() {
  const draft = useStore($draft)
  const me = useStore($me)
  const session = useStore($session)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [saving, setSaving] = useState(false)
  const result = validateDraft(draft)
  const mode = getMode(draft.modeKey)
  const theme = getTheme(draft.theme)
  const enabled = enabledModuleIds(draft)
  const context = moduleContext(draft)

  const problems = [
    ...result.players.map((message) => ({ message, step: 'players' })),
    ...result.global.map((message) => ({ message, step: message.includes('модул') ? 'modules' : 'configure' })),
    ...Object.entries(result.modules).flatMap(([id, errors]) => errors.map((e) => ({ message: `${getModule(id).name}: ${e.message}`, step: 'configure' }))),
  ]

  const launch = () => {
    const started = startGame(draft)
    if (!started.ok) {
      toastError('Има проблеми в настройките')
      return
    }
    go('play')
  }

  const start = () => {
    if (session && session.status !== 'finished') setConfirmReplace(true)
    else launch()
  }

  return (
    <div className="setup-step">
      <header className="setup-step__head">
        <h1 className="setup-step__title">Готови ли сте?</h1>
        <p className="text-muted">Провери играта и започнете. Прогресът се пази автоматично — дори при презареждане.</p>
      </header>

      <div className="review">
        <div className="review__main card">
          <TextInput label="Име на играта" value={draft.title} maxLength={80} onChange={(e) => updateDraft((d) => { d.title = e.target.value })} />
          <div className="review__facts">
            <div className="review__fact">
              <span className="emoji">{mode.icon}</span>
              <span><small>Повод</small><strong>{mode.name}</strong></span>
            </div>
            <div className="review__fact">
              <span className="review__swatch" style={{ background: `linear-gradient(135deg, ${theme.swatch[0]}, ${theme.swatch[1]})` }} />
              <span><small>Тема</small><strong>{theme.name}</strong></span>
            </div>
            <div className="review__fact">
              <span className="emoji">⏱️</span>
              <span><small>Около</small><strong>{estimateMinutes(draft)} мин.</strong></span>
            </div>
            <div className="review__fact">
              <span className="emoji">🔁</span>
              <span><small>Край</small><strong>{draft.settings.endCondition === 'rounds' ? `${draft.settings.rounds} рунда` : 'Когато решите'}</strong></span>
            </div>
          </div>

          <h3 className="review__label">Играчи ({draft.players.length})</h3>
          <div className="review__players">
            {draft.players.map((p) => (
              <span key={p.id} className="review__player"><Avatar emoji={p.avatar} size="sm" /> {p.name}</span>
            ))}
            <Button variant="ghost" size="sm" icon="edit" onClick={() => go('setupStep', { step: 'players' })}>Промени</Button>
          </div>

          <h3 className="review__label">Модули ({enabled.length}) · {TURN_SOURCE[draft.settings.turnSource]}</h3>
          <ul className="review__modules">
            {enabled.map((id) => {
              const definition = getModule(id)
              const summary = definition.summarizeConfig?.({ ...definition.defaultConfig(), ...draft.modules[id].config }, context)?.filter(Boolean) || []
              return (
                <li key={id}>
                  <span className="emoji" aria-hidden="true">{definition.icon}</span>
                  <span>
                    <strong>{definition.name}</strong>
                    <small>{summary.join(' · ')}</small>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <aside className="review__side">
          {problems.length > 0 ? (
            <div className="card review__problems" role="alert">
              <h3><span className="material-symbols-rounded">error</span> Поправи преди старт</h3>
              <ul>
                {problems.map((problem, i) => (
                  <li key={i}>
                    {problem.message}
                    <button type="button" className="link" onClick={() => go('setupStep', { step: problem.step })}>Поправи</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="card review__ready">
              <span className="emoji" aria-hidden="true">🚀</span>
              <p>Всичко е наред. Подайте устройството на <strong>{draft.players[0]?.name}</strong> — започва първи.</p>
            </div>
          )}
          <Button size="xl" block icon="play_arrow" disabled={problems.length > 0} onClick={start}>Започни играта</Button>
          {me ? (
            <Button variant="secondary" block icon={draft.configId ? 'save' : 'bookmark_add'} onClick={() => setSaving(true)}>
              {draft.configId ? 'Запази промените' : 'Запази за по-късно'}
            </Button>
          ) : (
            <p className="text-muted small center">
              <a href="/login?next=/new/review">Влез</a>, за да запазиш тази игра и историята ѝ.
            </p>
          )}
        </aside>
      </div>

      {me && <SaveConfig draft={draft} open={saving} onClose={() => setSaving(false)} />}
      <ConfirmDialog
        open={confirmReplace}
        title="Има незавършена игра"
        text={`„${session?.title}“ още не е приключила. Ако започнеш нова, тя ще бъде заменена${me ? ' (остава в историята ти)' : ''}.`}
        confirmLabel="Започни нова"
        tone="primary"
        onCancel={() => setConfirmReplace(false)}
        onConfirm={() => {
          setConfirmReplace(false)
          launch()
        }}
      />
    </div>
  )
}
