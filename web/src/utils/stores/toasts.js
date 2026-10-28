import { atom } from 'nanostores'

export const $toasts = atom([])
let counter = 0

export function toast(message, type = 'info', timeoutMs = 3800) {
  counter += 1
  const id = counter
  $toasts.set([...$toasts.get(), { id, message, type }])
  setTimeout(() => dismissToast(id), timeoutMs)
  return id
}

export const toastError = (err) => toast(err?.message || String(err), 'error', 5200)
export const toastSuccess = (message) => toast(message, 'success')

export function dismissToast(id) {
  $toasts.set($toasts.get().filter((t) => t.id !== id))
}
