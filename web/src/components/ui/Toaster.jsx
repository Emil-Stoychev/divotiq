import { useStore } from '@nanostores/react'
import { $toasts, dismissToast } from '@store/toasts'
import Icon from './Icon'

const ICONS = { success: 'check_circle', error: 'error', info: 'info' }

export default function Toaster() {
  const toasts = useStore($toasts)
  return (
    <div className="toaster" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
          <Icon name={ICONS[t.type] || 'info'} />
          <span className="toast__message">{t.message}</span>
          <button type="button" className="toast__close" onClick={() => dismissToast(t.id)} aria-label="Затвори">
            <Icon name="close" />
          </button>
        </div>
      ))}
    </div>
  )
}
