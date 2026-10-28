import { createDraft, getModule, listModules } from '@/game'
import { persistentJSON } from './persist'

// The wizard's working copy. Persisted so a refresh never loses the setup.
export const $draft = persistentJSON('divotiq:draft', null)

export function startDraft(mode) {
  const previous = $draft.get()
  const draft = createDraft(mode)
  // Keep the players the host already typed when switching occasion.
  if (previous?.players?.length) draft.players = previous.players
  $draft.set(draft)
  return draft
}

export function updateDraft(mutate) {
  const current = $draft.get()
  if (!current) return
  const next = structuredClone(current)
  mutate(next)
  $draft.set(next)
}

export function setModuleEnabled(moduleId, enabled) {
  updateDraft((draft) => {
    draft.modules[moduleId] = draft.modules[moduleId] || { enabled: false, config: getModule(moduleId).defaultConfig() }
    draft.modules[moduleId].enabled = enabled
    if (moduleId === 'wheel' && !enabled && draft.settings.turnSource === 'wheel') draft.settings.turnSource = 'random'
    if (moduleId === 'wheel' && enabled) draft.settings.turnSource = 'wheel'
  })
}

export function updateModuleConfig(moduleId, patch) {
  updateDraft((draft) => {
    const entry = draft.modules[moduleId]
    entry.config = { ...entry.config, ...(typeof patch === 'function' ? patch(entry.config) : patch) }
  })
}

export function resetModuleConfig(moduleId) {
  updateDraft((draft) => {
    draft.modules[moduleId].config = getModule(moduleId).defaultConfig()
  })
}

// Saved config (API) -> draft. Unknown/removed modules are dropped; new
// modules get their defaults so old configs keep working.
export function draftFromConfig(config, { keepPlayers = true } = {}) {
  const modules = {}
  for (const definition of listModules()) {
    const saved = config.modules?.[definition.id]
    modules[definition.id] = {
      enabled: Boolean(saved?.enabled),
      config: { ...definition.defaultConfig(), ...(saved?.config || {}) },
    }
  }
  return {
    modeKey: config.modeKey,
    theme: config.theme,
    title: config.title,
    players: keepPlayers ? config.players || [] : [],
    modules,
    settings: { ...config.settings },
    configId: config.isOwn ? config.id : null,
  }
}

export function draftToConfigBody(draft, extra = {}) {
  return {
    title: draft.title,
    modeKey: draft.modeKey,
    theme: draft.theme,
    players: draft.players,
    modules: draft.modules,
    settings: draft.settings,
    ...extra,
  }
}

// Finished/active session -> draft, for "play again with the same setup".
export function draftFromSession(state) {
  const modules = {}
  for (const definition of listModules()) {
    const entry = state.modules[definition.id]
    modules[definition.id] = {
      enabled: Boolean(entry?.enabled),
      config: entry ? structuredClone(entry.config) : definition.defaultConfig(),
    }
  }
  return {
    modeKey: state.modeKey,
    theme: state.theme,
    title: state.title,
    players: state.players.map((p) => ({ ...p })),
    modules,
    settings: { ...state.settings },
    configId: state.configId || null,
  }
}
