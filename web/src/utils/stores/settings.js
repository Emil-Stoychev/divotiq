import { computed } from 'nanostores'
import { persistentJSON } from './persist'

export const $settings = persistentJSON('divotiq:settings', {
  sound: true,
  effects: true,
  reducedMotion: false,
})

const systemReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export const $reducedMotion = computed($settings, (s) => Boolean(s.reducedMotion || systemReducedMotion))

export function updateSettings(patch) {
  $settings.set({ ...$settings.get(), ...patch })
}
