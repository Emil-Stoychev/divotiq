// Wizard drafts: the editable setup before a session starts.

import { getModule, listModules } from '../modules'
import { DEFAULT_SETTINGS, MAX_PLAYER_NAME, MAX_PLAYERS, MIN_PLAYERS } from './session'

export function createDraft(mode) {
  const modules = {}
  for (const definition of listModules()) {
    const excluded = mode.excludedModules?.includes(definition.id)
    modules[definition.id] = {
      enabled: !excluded && mode.suggestedModules.includes(definition.id),
      config: definition.defaultConfig(),
    }
  }
  return {
    modeKey: mode.key,
    theme: mode.theme,
    title: mode.name === 'Свой режим' ? 'Моята игра' : mode.name,
    players: [],
    modules,
    settings: { ...DEFAULT_SETTINGS, ...(mode.defaultSettings || {}) },
    configId: null,
  }
}

export function enabledModuleIds(draft) {
  return Object.entries(draft.modules || {})
    .filter(([id, entry]) => entry.enabled && getModule(id))
    .map(([id]) => id)
}

export function moduleContext(draft) {
  return {
    theme: draft.theme,
    modeKey: draft.modeKey,
    players: draft.players,
    enabledModules: enabledModuleIds(draft),
  }
}

export function validatePlayers(players) {
  const errors = []
  if (players.length < MIN_PLAYERS) errors.push(`Нужни са поне ${MIN_PLAYERS} играчи`)
  if (players.length > MAX_PLAYERS) errors.push(`Максимум ${MAX_PLAYERS} играчи`)
  const names = new Set()
  for (const player of players) {
    const name = player.name?.trim() || ''
    if (!name) errors.push('Всеки играч трябва да има име')
    else if (name.length > MAX_PLAYER_NAME) errors.push(`Името „${name.slice(0, 10)}…“ е твърде дълго`)
    else if (names.has(name.toLowerCase())) errors.push(`Името „${name}“ се повтаря`)
    names.add(name.toLowerCase())
  }
  return [...new Set(errors)]
}

export function validateModuleConfig(draft, moduleId) {
  const definition = getModule(moduleId)
  const entry = draft.modules[moduleId]
  if (!definition || !entry) return []
  const errors = []
  if (definition.minPlayers && draft.players.length && draft.players.length < definition.minPlayers) {
    errors.push({ field: 'players', message: `Модулът изисква поне ${definition.minPlayers} играчи` })
  }
  return [...errors, ...(definition.validateConfig?.({ ...definition.defaultConfig(), ...entry.config }, moduleContext(draft)) || [])]
}

export function validateSettings(draft) {
  const errors = []
  const { settings } = draft
  if (settings.endCondition === 'rounds' && (settings.rounds < 1 || settings.rounds > 50)) {
    errors.push('Рундовете трябва да са между 1 и 50')
  }
  if (settings.turnSource === 'wheel' && !draft.modules.wheel?.enabled) {
    errors.push('Ходовете се определят от колелото, но то е изключено')
  }
  return errors
}

// Full validation used before starting a game.
export function validateDraft(draft) {
  const players = validatePlayers(draft.players)
  const modules = {}
  const enabled = enabledModuleIds(draft)
  for (const id of enabled) {
    const errors = validateModuleConfig(draft, id)
    if (errors.length) modules[id] = errors
  }
  const global = validateSettings(draft)
  const playable = enabled.filter((id) => getModule(id).playable)
  if (!playable.length) global.push('Включете поне един модул с игри (не само колелото)')
  const valid = !players.length && !Object.keys(modules).length && !global.length
  return { valid, players, modules, global }
}

// Rough duration estimate in minutes.
export function estimateMinutes(draft) {
  const players = Math.max(draft.players.length, MIN_PLAYERS)
  const rounds = draft.settings.endCondition === 'rounds' ? draft.settings.rounds : 5
  return Math.round((players * rounds * 75) / 60)
}
