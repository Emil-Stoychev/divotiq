import { atom } from 'nanostores'
import { get, post } from '@/api/core'

export const $me = atom(null)
export const $authReady = atom(false)

export async function fetchMe() {
  try {
    const user = await get('/me')
    $me.set(user)
    return user
  } catch {
    $me.set(null)
    return null
  } finally {
    $authReady.set(true)
  }
}

export async function login(email, password) {
  const user = await post('/login', { email, password })
  $me.set(user)
  return user
}

export async function register(name, email, password) {
  const user = await post('/register', { name, email, password })
  $me.set(user)
  return user
}

export async function logout() {
  try {
    await post('/logout')
  } finally {
    $me.set(null)
  }
}

export function isAdmin(user = $me.get()) {
  return Boolean(user && user.role === 'admin')
}
