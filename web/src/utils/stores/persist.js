import { persistentAtom } from '@nanostores/persistent'

// JSON persistent atom that survives corrupted / unavailable storage.
export function persistentJSON(key, initial) {
  return persistentAtom(key, initial, {
    encode: JSON.stringify,
    decode(raw) {
      try {
        return JSON.parse(raw)
      } catch {
        return initial
      }
    },
  })
}
