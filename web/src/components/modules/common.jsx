import { useStore } from '@nanostores/react'
import { useState } from 'react'
import { contentApi } from '@/api/endpoints'
import { $me } from '@store/auth'
import { toastError, toastSuccess } from '@store/toasts'
import { CONTENT_KINDS, toModuleItem } from '@/game/content/kinds'
import { DIFFICULTIES } from '@/game/modules/shared'
import ContentForm, { emptyContent } from '@/components/content/ContentForm'
import ContentPicker from '@/components/content/ContentPicker'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Toggle from '@/components/ui/Toggle'

export function ConfigSection({ title, description, children }) {
  return (
    <section className="config-section">
      {title && <h4 className="config-section__title">{title}</h4>}
      {description && <p className="config-section__description">{description}</p>}
      <div className="config-section__body">{children}</div>
    </section>
  )
}

export function ConfigErrors({ errors }) {
  if (!errors?.length) return null
  return (
    <ul className="config-errors" role="alert">
      {errors.map((error, i) => (
        <li key={i}>
          <span className="material-symbols-rounded" aria-hidden="true">error</span> {error.message}
        </li>
      ))}
    </ul>
  )
}

export function ChipToggleGroup({ label, options, value, onChange, hint }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  return (
    <div className="field">
      {label && <span className="field__label">{label}</span>}
      <div className="chip-toggles" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`chip-toggle ${value.includes(option.value) ? 'chip-toggle--on' : ''}`}
            aria-pressed={value.includes(option.value)}
            onClick={() => toggle(option.value)}
          >
            {option.icon && <span className="emoji">{option.icon}</span>}
            {option.label}
          </button>
        ))}
      </div>
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  )
}

// Custom items stored inside a module config, with "write your own" and
// "import from the library" entry points.
export function CustomItemsEditor({ items, onChange, kinds, itemLabel = (item) => item.title || item.name, emptyText }) {
  const me = useStore($me)
  const [adding, setAdding] = useState(false)
  const [picking, setPicking] = useState(false)
  const [saveToAccount, setSaveToAccount] = useState(true)
  const [busy, setBusy] = useState(false)

  const add = (newItems) => onChange([...items, ...newItems.map(toModuleItem)])

  const submit = async (content) => {
    if (me && saveToAccount) {
      setBusy(true)
      try {
        const saved = await contentApi.create({ ...content, visibility: 'private' })
        add([saved])
        toastSuccess('Запазено и в „Моето съдържание“')
      } catch (err) {
        toastError(err.message)
        setBusy(false)
        return
      }
      setBusy(false)
    } else {
      add([content])
    }
    setAdding(false)
  }

  return (
    <div className="custom-items">
      {items.length ? (
        <ul className="custom-items__list">
          {items.map((item) => (
            <li key={item.id} className="custom-items__item">
              <span className="emoji" aria-hidden="true">{CONTENT_KINDS[item.kind]?.icon || '✨'}</span>
              <span className="custom-items__text">
                <span className="custom-items__title">{itemLabel(item)}</span>
                {item.sourceId && !item.sourceId.startsWith('local') && <span className="custom-items__source">от библиотеката / профила</span>}
              </span>
              <Button variant="ghost" size="sm" icon="delete" aria-label="Премахни" onClick={() => onChange(items.filter((i) => i.id !== item.id))} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="custom-items__empty">{emptyText || 'Още няма добавено собствено съдържание.'}</p>
      )}
      <div className="row">
        <Button variant="soft" size="sm" icon="edit" onClick={() => setAdding(true)}>Напиши свое</Button>
        <Button variant="soft" size="sm" icon="travel_explore" onClick={() => setPicking(true)}>От библиотеката</Button>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Ново съдържание" size="md">
        <ContentForm
          initial={emptyContent(kinds[0])}
          allowedKinds={kinds}
          showVisibility={false}
          submitLabel="Добави в играта"
          busy={busy}
          onCancel={() => setAdding(false)}
          onSubmit={submit}
        />
        {me && (
          <div className="custom-items__save">
            <Toggle id="save-to-account" label="Запази и в моето съдържание" checked={saveToAccount} onChange={setSaveToAccount} />
          </div>
        )}
      </Modal>
      <ContentPicker
        open={picking}
        onClose={() => setPicking(false)}
        kinds={kinds}
        onPick={add}
        excludeSourceIds={items.map((i) => i.sourceId).filter(Boolean)}
      />
    </div>
  )
}

// Standard content block for content-driven modules.
export function ContentSourcePanel({ config, onChange, kinds, systemCount, withDifficulties = true, errors = [] }) {
  return (
    <ConfigSection title="Съдържание">
      <Toggle
        id={`sys-${kinds[0]}`}
        label="Вградено съдържание"
        description={systemCount != null ? `${systemCount} готови за този повод` : 'Готовите предложения на Дивотия'}
        checked={config.useSystemContent !== false}
        onChange={(useSystemContent) => onChange({ useSystemContent })}
      />
      {withDifficulties && (
        <ChipToggleGroup
          label="Трудност"
          options={DIFFICULTIES.map((d) => ({ value: d.id, label: d.label }))}
          value={config.difficulties || []}
          onChange={(difficulties) => onChange({ difficulties })}
        />
      )}
      {'allowRepeat' in config && (
        <Toggle id={`rep-${kinds[0]}`} label="Разреши повторения" description="Иначе всяко се пада веднъж, докато тестето свърши" checked={config.allowRepeat} onChange={(allowRepeat) => onChange({ allowRepeat })} />
      )}
      <div className="field">
        <span className="field__label">Собствено съдържание</span>
        <CustomItemsEditor items={config.customItems || []} kinds={kinds} onChange={(customItems) => onChange({ customItems })} />
      </div>
      <ConfigErrors errors={errors.filter((e) => ['customItems', 'difficulties'].includes(e.field))} />
    </ConfigSection>
  )
}
