// Helpers shared by content-driven modules.

import { filterByMode } from '../content'
import { createTimer, pauseTimer, startTimer } from '../engine/timers'

export const DIFFICULTIES = [
  { id: 'easy', label: 'Лесно' },
  { id: 'medium', label: 'Средно' },
  { id: 'hard', label: 'Трудно' },
]

export const RARITIES = [
  { id: 'common', label: 'Обикновен', weight: 60 },
  { id: 'rare', label: 'Рядък', weight: 25 },
  { id: 'epic', label: 'Епичен', weight: 10 },
  { id: 'legendary', label: 'Легендарен', weight: 5 },
]

export const rarityLabel = (id) => RARITIES.find((r) => r.id === id)?.label || 'Обикновен'
export const difficultyLabel = (id) => DIFFICULTIES.find((d) => d.id === id)?.label || 'Средно'

export const contentDefaults = () => ({
  useSystemContent: true,
  customItems: [],
  difficulties: ['easy', 'medium', 'hard'],
  allowRepeat: false,
})

// Builds the playable pool for a content module.
export function buildPool(config, systemItems, modeTheme, extraFilter = () => true) {
  const system = config.useSystemContent === false ? [] : filterByMode(systemItems, modeTheme)
  const all = [...system, ...(config.customItems || [])]
  const difficulties = config.difficulties?.length ? config.difficulties : null
  return all.filter((item) => {
    if (difficulties && item.difficulty && !difficulties.includes(item.difficulty)) return false
    return extraFilter(item)
  })
}

// Draws an item, avoiding repeats unless allowed. When everything was used,
// the deck is reshuffled (used ids reset) rather than failing.
export function drawFromPool(ctx, moduleId, pool, { allowRepeat = false, weight } = {}) {
  if (!pool.length) return null
  const state = ctx.moduleState(moduleId)
  if (!state.usedIds) state.usedIds = []
  let candidates = allowRepeat ? pool : pool.filter((item) => !state.usedIds.includes(item.id))
  if (!candidates.length) {
    state.usedIds = []
    candidates = pool
  }
  const item = weight ? ctx.rng.weighted(candidates, weight) : ctx.rng.pick(candidates)
  if (!allowRepeat) state.usedIds.push(item.id)
  return item
}

export function validateContentConfig(config, systemItems, modeTheme, label) {
  const errors = []
  if (config.difficulties && config.difficulties.length === 0) {
    errors.push({ field: 'difficulties', message: 'Изберете поне една трудност' })
  }
  if (!buildPool(config, systemItems, modeTheme).length) {
    errors.push({ field: 'customItems', message: `Няма налично съдържание за „${label}“. Включете системното или добавете свое.` })
  }
  return errors
}

export function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

// Standard timer actions for activities that keep a timer in `data.timer`.
export function handleTimerAction(ctx, activity, name) {
  const { data } = activity
  if (!name.startsWith('timer/')) return undefined
  if (!data.timer) return false
  if (name === 'timer/start' || name === 'timer/resume') {
    if (data.timer.running) return false
    data.timer = startTimer(data.timer, ctx.now)
    return true
  }
  if (name === 'timer/pause') {
    if (!data.timer.running) return false
    data.timer = pauseTimer(data.timer, ctx.now)
    return true
  }
  if (name === 'timer/reset') {
    data.timer = createTimer(data.timer.durationMs / 1000)
    return true
  }
  return false
}

export function stopTimer(ctx, activity) {
  if (activity.data.timer?.running) activity.data.timer = pauseTimer(activity.data.timer, ctx.now)
}

export function modeTheme(ctx) {
  return ctx.state.theme
}
