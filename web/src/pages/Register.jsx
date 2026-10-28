import { useState } from 'react'
import { register } from '@store/auth'
import { pathTo } from '@store/router'
import AuthLayout from '@/layouts/AuthLayout'
import Button from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'

function validate({ name, email, password, confirm }) {
  const errors = {}
  if (name.trim().length < 2 || name.trim().length > 40) errors.name = 'Между 2 и 40 символа'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Невалиден имейл адрес'
  if (password.length < 8) errors.password = 'Поне 8 символа'
  if (confirm !== password) errors.confirm = 'Паролите не съвпадат'
  return errors
}

export default function Register({ search }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      await register(form.name.trim(), form.email.trim(), form.password)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const next = search?.next ? `?next=${encodeURIComponent(search.next)}` : ''
  return (
    <AuthLayout title="Създай профил" subtitle="Безплатно. Запазвай игри, компании, свое съдържание и историята на всяка дивотия.">
      <form className="auth-form" onSubmit={submit} noValidate>
        <TextInput label="Име" autoComplete="nickname" maxLength={40} value={form.name} onChange={set('name')} error={errors.name} autoFocus />
        <TextInput label="Имейл" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        <TextInput label="Парола" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="Поне 8 символа" />
        <TextInput label="Повтори паролата" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" size="lg" block loading={busy} icon="person_add">Регистрация</Button>
      </form>
      <p className="auth-switch">
        Вече имаш профил? <a href={`${pathTo('login')}${next}`}>Влез</a>
      </p>
    </AuthLayout>
  )
}
