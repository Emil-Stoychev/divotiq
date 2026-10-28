import { registerModule } from './registry'
import { clampInt } from './shared'

export const WHEEL_TARGETS = {
  challenges: { label: 'Предизвикателство', icon: '🎯', color: '#ef4444' },
  whisper: { label: 'Whisper', icon: '🎧', color: '#8b5cf6' },
  gifts: { label: 'Подарък', icon: '🎁', color: '#f59e0b' },
  luckCards: { label: 'Късмет', icon: '🍀', color: '#22c55e' },
  effects: { label: 'Ефект', icon: '🌀', color: '#06b6d4' },
  missions: { label: 'Тайна мисия', icon: '🕵️', color: '#6366f1' },
  drinking: { label: 'Шот', icon: '🥃', color: '#f97316' },
  miniGames: { label: 'Мини игра', icon: '🎮', color: '#ec4899' },
  points: { label: '+1 точка', icon: '⭐', color: '#eab308' },
  spinAgain: { label: 'Завърти пак', icon: '🔄', color: '#3b82f6' },
  nothing: { label: 'Пас', icon: '😴', color: '#64748b' },
}

const NON_MODULE_TARGETS = ['points', 'spinAgain', 'nothing']
const MAX_CHAINED_SPINS = 3

export function defaultSegments() {
  return [
    seg('challenges', 3),
    seg('whisper', 2),
    seg('gifts', 2),
    seg('luckCards', 2),
    seg('effects', 1),
    seg('missions', 1),
    seg('drinking', 2),
    seg('miniGames', 2),
    seg('points', 1),
  ]
}

function seg(target, weight = 1, extra = {}) {
  const preset = WHEEL_TARGETS[target]
  return { id: `seg-${target}`, label: preset.label, icon: preset.icon, color: preset.color, target, weight, once: false, ...extra }
}

export function isSegmentAvailable(segment, enabledModuleIds) {
  return NON_MODULE_TARGETS.includes(segment.target) || enabledModuleIds.includes(segment.target)
}

export function availableSegments(config, enabledModuleIds, removedIds = []) {
  return (config.segments || []).filter(
    (segment) => isSegmentAvailable(segment, enabledModuleIds) && !removedIds.includes(segment.id),
  )
}

// Returns [{ segment, start, sweep }] in degrees, clockwise from the top.
export function segmentGeometry(segments, probability) {
  const weights = segments.map((s) => (probability === 'weighted' ? Math.max(1, s.weight || 1) : 1))
  const total = weights.reduce((sum, w) => sum + w, 0) || 1
  let start = 0
  return segments.map((segment, index) => {
    const sweep = (weights[index] / total) * 360
    const entry = { segment, start, sweep }
    start += sweep
    return entry
  })
}

// Rotation (deg) that brings the chosen segment's centre under the top pointer.
export function rotationForSegment(geometry, segmentId, currentRotation, rng) {
  const entry = geometry.find((g) => g.segment.id === segmentId)
  const centre = entry.start + entry.sweep / 2
  const jitter = (rng.next() - 0.5) * entry.sweep * 0.6
  const base = currentRotation - (currentRotation % 360)
  const fullTurns = 5 + rng.int(3)
  let target = base + fullTurns * 360 + (360 - centre - jitter)
  while (target <= currentRotation + 360 * 4) target += 360
  return target
}

const enabledIds = (ctx) => Object.keys(ctx.state.modules)

registerModule({
  id: 'wheel',
  order: 1,
  name: 'Колело на късмета',
  shortName: 'Колело',
  description: 'Завърти колелото и виж какво те очаква. Сегментите водят към другите модули.',
  icon: '🎡',
  category: 'Основа',
  playable: false,

  defaultConfig: () => ({
    segments: defaultSegments(),
    probability: 'equal', // equal | weighted
    removeOneTime: true,
    spinSeconds: 5,
    sound: true,
  }),

  validateConfig(config, context) {
    const errors = []
    const segments = config.segments || []
    if (segments.some((s) => !s.label?.trim())) errors.push({ field: 'segments', message: 'Всеки сегмент трябва да има име' })
    if (segments.length > 16) errors.push({ field: 'segments', message: 'Максимум 16 сегмента' })
    if (availableSegments(config, context.enabledModules).length < 2) {
      errors.push({ field: 'segments', message: 'Колелото има нужда от поне 2 активни сегмента (сегментите към изключени модули не участват)' })
    }
    return errors
  },

  summarizeConfig: (config, context) => [
    `${availableSegments(config, context?.enabledModules || []).length} сегмента`,
    config.probability === 'weighted' ? 'Тегловен шанс' : 'Равен шанс',
  ],

  initState: () => ({ rotation: 0, removedIds: [] }),

  start(ctx) {
    const state = ctx.moduleState('wheel')
    const segments = availableSegments(ctx.config('wheel'), enabledIds(ctx), state.removedIds)
    if (!segments.length) return null
    return { kind: 'spin', phase: 'ready', data: { spins: 0 } }
  },

  handle(ctx, activity, name) {
    const config = ctx.config('wheel')
    const state = ctx.moduleState('wheel')
    const { data } = activity

    if (name === 'spin') {
      // Repeated taps while spinning (or after the result) are ignored.
      if (activity.phase !== 'ready') return false
      const segments = availableSegments(config, enabledIds(ctx), state.removedIds)
      if (!segments.length) return false
      const chosen =
        config.probability === 'weighted' ? ctx.rng.weighted(segments, (s) => s.weight || 1) : ctx.rng.pick(segments)
      const geometry = segmentGeometry(segments, config.probability)
      const rotation = rotationForSegment(geometry, chosen.id, state.rotation, ctx.rng)
      state.rotation = rotation
      activity.phase = 'spinning'
      data.resultId = chosen.id
      data.segmentIds = segments.map((s) => s.id)
      data.rotation = rotation
      data.spinMs = clampInt(config.spinSeconds, 2, 10, 5) * 1000
      data.spins += 1
      return true
    }

    if (name === 'settle') {
      if (activity.phase !== 'spinning') return false
      const segment = config.segments.find((s) => s.id === data.resultId)
      activity.phase = 'result'
      if (segment?.once && config.removeOneTime) state.removedIds.push(segment.id)
      ctx.log(`Колелото посочи „${segment?.label}“`, { type: 'wheel/result', moduleId: 'wheel' })
      return true
    }

    if (name === 'continue') {
      if (activity.phase !== 'result') return false
      const segment = config.segments.find((s) => s.id === data.resultId)
      const target = segment?.target
      if (target === 'spinAgain' && data.spins < MAX_CHAINED_SPINS) {
        activity.phase = 'ready'
        delete data.resultId
        return true
      }
      if (target === 'points') {
        ctx.addPoints(activity.playerId, 1, 'колелото')
      } else if (target && !NON_MODULE_TARGETS.includes(target)) {
        ctx.enqueueFront(target, { via: 'wheel' }, activity.playerId)
      }
      ctx.complete()
      return true
    }
    return false
  },
})
