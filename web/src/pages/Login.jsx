import { useState } from 'react'
import { login } from '@store/auth'
import { pathTo } from '@store/router'
import AuthLayout from '@/layouts/AuthLayout'
import Button from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'

export default function Login({ search }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) return setError('Въведете имейл и парола')
    setBusy(true)
    try {
      await login(email.trim(), password)
      // useRouteGuards redirects to ?next or the dashboard.
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const next = search?.next ? `?next=${encodeURIComponent(search.next)}` : ''
  return (
    <AuthLayout title="Добре дошъл отново!" subtitle="Влез, за да продължиш със запазените игри, съдържанието и историята си.">
      <form className="auth-form" onSubmit={submit} noValidate>
        <TextInput label="Имейл" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <TextInput label="Парола" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" size="lg" block loading={busy} icon="login">Вход</Button>
      </form>
      <p className="auth-switch">
        Нямаш профил? <a href={`${pathTo('register')}${next}`}>Регистрирай се</a>
      </p>
    </AuthLayout>
  )
}
