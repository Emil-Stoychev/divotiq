import { atom, computed } from 'nanostores'
import { modesApi } from '@/api/endpoints'
import { BUILT_IN_MODES, customModeFromApi, getBuiltInMode } from '@/game/modes/modes'

export const $customModes = atom([])

export const $allModes = computed($customModes, (custom) => [...BUILT_IN_MODES, ...custom.map(customModeFromApi)])

export async function loadCustomModes() {
  try {
    const { items } = await modesApi.mine()
    $customModes.set(items)
  } catch {
    $customModes.set([])
  }
}

export function getMode(key) {
  return getBuiltInMode(key) || $allModes.get().find((m) => m.key === key) || getBuiltInMode('classic')
}
