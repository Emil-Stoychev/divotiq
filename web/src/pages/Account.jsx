import { useStore } from '@nanostores/react'
import { useState } from 'react'
import { accountApi } from '@/api/endpoints'
import { $me } from '@store/auth'
import { go } from '@store/router'
import { clearSession } from '@store/session'
import { $settings, updateSettings } from '@store/settings'
import { toastError, toastSuccess } from '@store/toasts'
import SiteLayout from '@/layouts/SiteLayout'
import AvatarPicker from '@/components/ui/AvatarPicker'
import Button from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import Toggle from '@/components/ui/Toggle'

function ProfileCard({ me }) {
  const [name, setName] = useState(me.name)
  const [avatar, setAvatar] = useState(me.avatar)
  const [busy, setBusy] = useState(false)
  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      $me.set(await accountApi.update({ name: name.trim(), avatar }))
      toastSuccess('Профилът е запазен')
    } catch (err) {
      toastError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="card account-card" onSubmit={save}>
      <h2>Профил</h2>
      <TextInput label="Име" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      <TextInput label="Имейл" value={me.email} disabled />
      <div className="field">
        <span className="field__label">Аватар</span>
        <AvatarPicker value={avatar} onChange={setAvatar} />
      </div>
      <Button type="submit" icon="save" loading={busy} disabled={name.trim() === me.name && avatar === me.avatar}>Запази</Button>
    </form>
  )
}

function PasswordCard() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const save = async (e) => {
    e.preventDefault()
    setError('')
    if (form.newPassword.length < 8) return setError('Новата парола трябва да е поне 8 символа')
    if (form.newPassword !== form.confirm) return setError('Паролите не съвпадат')
    setBusy(true)
    try {
      await accountApi.password({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      toastSuccess('Паролата е сменена')
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="card account-card" onSubmit={save}>
      <h2>Парола</h2>
      <TextInput label="Текуща парола" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} />
      <TextInput label="Нова парола" type="password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} />
      <TextInput label="Повтори новата парола" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" icon="key" loading={busy} disabled={!form.currentPassword || !form.newPassword}>Смени паролата</Button>
    </form>
  )
}

function SettingsCard() {
  const settings = useStore($settings)
  const change = (patch) => {
    updateSettings(patch)
    accountApi.update({ preferences: { ...$settings.get(), ...patch } }).catch(() => {})
  }
  return (
    <section className="card account-card">
      <h2>Настройки</h2>
      <Toggle id="acc-sound" label="Звук" description="Таймери, колело и награди" checked={settings.sound} onChange={(sound) => change({ sound })} />
      <Toggle id="acc-effects" label="Визуални ефекти" description="Сняг, конфети и балончета на фона" checked={settings.effects} onChange={(effects) => change({ effects })} />
      <Toggle id="acc-motion" label="Намалено движение" description="Без анимации на колелото и картите" checked={settings.reducedMotion} onChange={(reducedMotion) => change({ reducedMotion })} />
    </section>
  )
}

function DangerCard() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const remove = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await accountApi.remove(password)
      $me.set(null)
      clearSession()
      go('home')
      toastSuccess('Профилът е изтрит')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <section className="card account-card account-card--danger">
      <h2>Изтриване на профила</h2>
      <p className="text-muted">Изтрива профила, запазените игри, историята, режимите и съдържанието ти. Не може да се отмени.</p>
      <Button variant="danger" icon="delete_forever" onClick={() => setOpen(true)}>Изтрий профила</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Сигурен ли си?" size="sm">
        <form className="stack" onSubmit={remove}>
          <p className="text-muted">Въведи паролата си, за да потвърдиш.</p>
          <TextInput label="Парола" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" variant="danger" icon="delete_forever" loading={busy} disabled={!password}>Изтрий завинаги</Button>
        </form>
      </Modal>
    </section>
  )
}

export default function Account() {
  const me = useStore($me)
  return (
    <SiteLayout>
      <div className="container page-pad">
        <header className="page-head">
          <div>
            <span className="eyebrow">Профил</span>
            <h1 className="page-head__title">Профил и настройки</h1>
          </div>
        </header>
        <div className="account-grid">
          <ProfileCard me={me} />
          <div className="stack">
            <SettingsCard />
            <PasswordCard />
            <DangerCard />
          </div>
        </div>
      </div>
    </SiteLayout>
  )
}
