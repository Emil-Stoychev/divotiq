import { useState } from 'react'
import { CONTENT_KINDS, defaultData, validateContent } from '@/game/content/kinds'
import { DIFFICULTIES } from '@/game/modules/shared'
import Button from '@/components/ui/Button'
import { Select, TextInput } from '@/components/ui/Field'
import NumberStepper from '@/components/ui/NumberStepper'
import Segmented from '@/components/ui/Segmented'
import Toggle from '@/components/ui/Toggle'
import SegmentsEditor from '@/components/modules/SegmentsEditor'
import { defaultSegments } from '@/game'

// Keeps the marked answer pointing at the same option after one is removed.
function shiftAnswer(answerIndex, removedIndex) {
  if (removedIndex === answerIndex) return 0
  return removedIndex < answerIndex ? answerIndex - 1 : answerIndex
}

export function emptyContent(kind, extra = {}) {
  return {
    kind,
    title: '',
    body: '',
    category: '',
    difficulty: 'medium',
    tags: [],
    data: kind === 'wheel_preset' ? { segments: defaultSegments().slice(0, 6) } : defaultData(kind),
    visibility: 'private',
    ...extra,
  }
}

// Generic editor for one content item. `allowedKinds` limits the type picker,
// `showVisibility` toggles the public/private choice (only for saved content).
export default function ContentForm({ initial, allowedKinds, showVisibility = true, submitLabel = 'Запази', onSubmit, onCancel, busy, serverError }) {
  const [item, setItem] = useState(() => structuredClone(initial))
  const [errors, setErrors] = useState({})
  const kind = CONTENT_KINDS[item.kind]
  const kinds = allowedKinds || Object.keys(CONTENT_KINDS)

  const set = (patch) => setItem((current) => ({ ...current, ...patch }))
  const setData = (patch) => setItem((current) => ({ ...current, data: { ...current.data, ...patch } }))

  const changeKind = (next) => setItem((current) => ({ ...emptyContent(next), title: current.title, body: current.body, visibility: current.visibility }))

  const submit = (event) => {
    event.preventDefault()
    const clean = {
      ...item,
      title: item.title.trim(),
      body: kind.noBody ? '' : item.body.trim(),
      tags: item.tags.map((t) => t.trim()).filter(Boolean),
    }
    if (clean.kind === 'trivia') clean.data = { ...clean.data, options: clean.data.options.map((o) => o.trim()) }
    const found = validateContent(clean)
    setErrors(found)
    if (Object.keys(found).length) return
    onSubmit(clean)
  }

  return (
    <form className="content-form" onSubmit={submit} noValidate>
      {kinds.length > 1 && (
        <Select
          label="Тип"
          value={item.kind}
          onChange={changeKind}
          options={kinds.map((id) => ({ value: id, label: `${CONTENT_KINDS[id].icon} ${CONTENT_KINDS[id].label}` }))}
        />
      )}
      <TextInput
        label={kind.titleLabel || 'Заглавие'}
        value={item.title}
        maxLength={120}
        onChange={(e) => set({ title: e.target.value })}
        error={errors.title}
        placeholder={item.kind === 'whisper_phrase' ? 'напр. Кокошката снесе златно яйце' : ''}
      />
      {!kind.noBody && (
        <TextInput
          multiline
          rows={3}
          label={kind.bodyLabel || 'Описание'}
          value={item.body}
          maxLength={600}
          onChange={(e) => set({ body: e.target.value })}
          error={errors.body}
        />
      )}

      {item.kind === 'trivia' && (
        <div className="field">
          <span className="field__label">Отговори (маркирай верния)</span>
          <div className="trivia-options">
            {item.data.options.map((option, index) => (
              <div key={index} className="trivia-options__row">
                <button
                  type="button"
                  className={`trivia-options__mark ${item.data.answerIndex === index ? 'trivia-options__mark--on' : ''}`}
                  onClick={() => setData({ answerIndex: index })}
                  aria-label={`Отговор ${index + 1} е верен`}
                  aria-pressed={item.data.answerIndex === index}
                >
                  <span className="material-symbols-rounded">{item.data.answerIndex === index ? 'check_circle' : 'radio_button_unchecked'}</span>
                </button>
                <input
                  className="input"
                  value={option}
                  maxLength={80}
                  placeholder={`Отговор ${index + 1}`}
                  onChange={(e) => setData({ options: item.data.options.map((o, i) => (i === index ? e.target.value : o)) })}
                />
                {item.data.options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="close"
                    aria-label="Премахни отговора"
                    onClick={() =>
                      setData({
                        options: item.data.options.filter((_, i) => i !== index),
                        answerIndex: shiftAnswer(item.data.answerIndex, index),
                      })
                    }
                  />
                )}
              </div>
            ))}
          </div>
          {item.data.options.length < 6 && (
            <Button variant="soft" size="sm" icon="add" onClick={() => setData({ options: [...item.data.options, ''] })}>
              Добави отговор
            </Button>
          )}
          {errors.options && <span className="field__error">{errors.options}</span>}
        </div>
      )}

      {item.kind === 'wheel_preset' && (
        <SegmentsEditor segments={item.data.segments} onChange={(segments) => setData({ segments })} probability="weighted" />
      )}

      <div className="content-form__grid">
        {kind.fields
          .filter((field) => field.type !== 'options' && (!field.showIf || field.showIf(item.data)))
          .map((field) => {
            if (field.type === 'int') {
              return (
                <NumberStepper
                  key={field.key}
                  label={field.label}
                  value={item.data[field.key] ?? field.default}
                  min={field.min}
                  max={field.max}
                  onChange={(value) => setData({ [field.key]: value })}
                  hint={errors[field.key]}
                />
              )
            }
            if (field.type === 'bool') {
              return <Toggle key={field.key} id={`cf-${field.key}`} label={field.label} checked={item.data[field.key]} onChange={(value) => setData({ [field.key]: value })} />
            }
            if (field.type === 'enum') {
              return <Select key={field.key} label={field.label} value={item.data[field.key]} options={field.options} onChange={(value) => setData({ [field.key]: value })} />
            }
            return (
              <TextInput
                key={field.key}
                label={field.label}
                value={item.data[field.key] || ''}
                maxLength={field.max}
                error={errors[field.key]}
                onChange={(e) => setData({ [field.key]: e.target.value })}
              />
            )
          })}
      </div>

      <Segmented
        label="Трудност"
        size="sm"
        value={item.difficulty}
        onChange={(difficulty) => set({ difficulty })}
        options={DIFFICULTIES.map((d) => ({ value: d.id, label: d.label }))}
      />

      <div className="content-form__grid">
        <TextInput label="Категория" value={item.category} maxLength={40} onChange={(e) => set({ category: e.target.value })} placeholder="напр. Музика" />
        <TextInput
          label="Тагове"
          hint="Разделени със запетая"
          value={item.tags.join(', ')}
          onChange={(e) => set({ tags: e.target.value.split(',').slice(0, 8) })}
          placeholder="коледа, смях"
        />
      </div>

      {showVisibility && (
        <Segmented
          label="Видимост"
          value={item.visibility}
          onChange={(visibility) => set({ visibility })}
          options={[
            { value: 'private', label: 'Само за мен', icon: '🔒' },
            { value: 'public', label: 'Публично в библиотеката', icon: '🌍' },
          ]}
        />
      )}
      {showVisibility && item.visibility === 'public' && (
        <p className="content-form__note">Публичното съдържание се вижда от всички. Без лични данни, обиди и линкове — неподходящото се скрива след сигнали.</p>
      )}

      {serverError && <p className="form-error" role="alert">{serverError}</p>}

      <div className="content-form__actions">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Отказ</Button>}
        <Button type="submit" loading={busy} icon="check">{submitLabel}</Button>
      </div>
    </form>
  )
}
