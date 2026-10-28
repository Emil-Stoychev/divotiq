import { SYSTEM_EFFECTS } from '../content'
import { registerModule } from './registry'
import { buildPool, clampInt, drawFromPool } from './shared'

// Ongoing effects are tracked by the engine (state.effects) and expire after
// the affected player's N next turns. This module is the playable source of
// effects and holds the global effect settings (max per player).

registerModule({
  id: 'effects',
  order: 6,
  name: 'Продължаващи ефекти',
  shortName: 'Ефект',
  description: 'Правила, които остават активни няколко хода: акценти, забранени думи, жестове…',
  icon: '🌀',
  category: 'Игри',

  defaultConfig: () => ({
    useSystemContent: true,
    customItems: [],
    difficulties: [],
    allowRepeat: false,
    defaultTurns: 1,
    maxPerPlayer: 2,
    target: 'self', // self | choose
    pointsOnAccept: 1,
  }),

  validateConfig(config, context) {
    const errors = []
    if (!buildPool(config, SYSTEM_EFFECTS, context.theme).length) errors.push({ field: 'customItems', message: 'Няма налични ефекти' })
    if (config.maxPerPlayer < 1 || config.maxPerPlayer > 5) errors.push({ field: 'maxPerPlayer', message: 'Между 1 и 5 ефекта на играч' })
    return errors
  },

  summarizeConfig: (config) => [`До ${config.maxPerPlayer} на играч`, config.target === 'choose' ? 'Играчът избира на кого' : 'За текущия играч'],

  initState: () => ({ usedIds: [] }),

  start(ctx) {
    const config = ctx.config('effects')
    const effect = drawFromPool(ctx, 'effects', buildPool(config, SYSTEM_EFFECTS, ctx.state.theme), { allowRepeat: config.allowRepeat })
    if (!effect) return null
    return {
      kind: 'effect',
      phase: config.target === 'choose' ? 'choose' : 'reveal',
      data: { effect, targetId: null },
    }
  },

  handle(ctx, activity, name, payload) {
    const config = ctx.config('effects')
    const { data } = activity
    if (name === 'chooseTarget') {
      if (activity.phase !== 'choose' || !ctx.player(payload.playerId)) return false
      data.targetId = payload.playerId
      activity.phase = 'reveal'
      return true
    }
    if (name === 'accept') {
      if (activity.phase !== 'reveal') return false
      const targetId = data.targetId || activity.playerId
      ctx.addEffect({
        playerId: targetId,
        title: data.effect.title,
        text: data.effect.body,
        turns: clampInt(data.effect.turns || config.defaultTurns, 1, 10, 1),
        sourceModuleId: 'effects',
      })
      if (targetId === activity.playerId) ctx.addPoints(targetId, config.pointsOnAccept, 'прие ефект')
      ctx.complete()
      return true
    }
    if (name === 'useImmunity') {
      const targetId = data.targetId || activity.playerId
      if (activity.phase !== 'reveal' || !ctx.consumeImmunity(targetId)) return false
      ctx.log(`${ctx.playerName(targetId)} използва имунитет срещу ефект`, { type: 'effect/immunity' })
      ctx.complete()
      return true
    }
    return false
  },
})
