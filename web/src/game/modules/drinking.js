import { SYSTEM_DRINKING } from '../content'
import { registerModule } from './registry'
import { buildPool, clampInt, drawFromPool } from './shared'

// Optional adult module. Every outcome has an equal non-alcoholic alternative,
// choosing it is never penalised, and the game never requires alcohol.

registerModule({
  id: 'drinking',
  order: 8,
  name: 'Шот (игра с пиене)',
  shortName: 'Шот',
  description: 'За пълнолетни. Винаги с безалкохолна алтернатива без наказание.',
  icon: '🥃',
  category: 'Парти',
  adultsOnly: true,

  defaultConfig: () => ({
    useSystemContent: true,
    customItems: [],
    difficulties: [],
    allowRepeat: false,
    adultsConfirmed: false,
    allowSkip: true,
    maxSips: 3,
  }),

  validateConfig(config, context) {
    const errors = []
    if (!config.adultsConfirmed) {
      errors.push({ field: 'adultsConfirmed', message: 'Потвърдете, че всички играчи на този модул са пълнолетни' })
    }
    const pool = buildPool(config, SYSTEM_DRINKING, context.theme, (item) => (item.sips || 1) <= config.maxSips)
    if (!pool.length) errors.push({ field: 'customItems', message: 'Няма налични действия с избраните ограничения' })
    if (pool.some((item) => !item.alternative)) errors.push({ field: 'customItems', message: 'Всяко действие трябва да има безалкохолна алтернатива' })
    return errors
  },

  summarizeConfig: (config) => [`До ${config.maxSips} глътки`, config.allowSkip ? 'Може да се пропуска' : 'Без пропускане', 'Винаги с алтернатива'],

  initState: () => ({ usedIds: [], drinks: 0, alternatives: 0 }),

  start(ctx) {
    const config = ctx.config('drinking')
    const maxSips = clampInt(config.maxSips, 1, 5, 3)
    const pool = buildPool(config, SYSTEM_DRINKING, ctx.state.theme, (item) => (item.sips || 1) <= maxSips && item.alternative)
    const outcome = drawFromPool(ctx, 'drinking', pool, { allowRepeat: config.allowRepeat })
    if (!outcome) return null
    return { kind: 'drink', phase: 'show', data: { outcome, choice: null } }
  },

  handle(ctx, activity, name) {
    const config = ctx.config('drinking')
    const state = ctx.moduleState('drinking')
    if (activity.phase !== 'show') return false
    const playerName = ctx.playerName(activity.playerId)
    const { outcome } = activity.data
    if (name === 'drink') {
      state.drinks += 1
      ctx.log(`${playerName}: „${outcome.title}“`, { type: 'drinking/drink' })
    } else if (name === 'alternative') {
      state.alternatives += 1
      ctx.log(`${playerName} избра алтернативата на „${outcome.title}“`, { type: 'drinking/alternative' })
    } else if (name === 'skip' && config.allowSkip) {
      ctx.log(`${playerName} пропусна „${outcome.title}“`, { type: 'drinking/skip' })
    } else {
      return false
    }
    activity.data.choice = name
    ctx.complete()
    return true
  },
})
