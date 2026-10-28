import { SYSTEM_LUCK_CARDS } from '../content'
import { registerModule } from './registry'
import { buildPool, RARITIES } from './shared'

// Card effects. `needsTarget` effects ask the host to pick another player.
export const LUCK_EFFECTS = {
  spin_again: { label: 'Още един ход' },
  immunity: { label: 'Имунитет' },
  give_points: { label: 'Подари точки', needsTarget: true },
  choose_next: { label: 'Избери следващия', needsTarget: true },
  exchange_gift: { label: 'Размяна на подарък', requires: 'gifts' },
  group_event: { label: 'Групово събитие' },
  bonus_points: { label: 'Бонус точки' },
  skip_turn: { label: 'Пропусни ход', negative: true },
  steal_points: { label: 'Открадни точки', needsTarget: true },
}

function pool(ctx, config) {
  const state = ctx.moduleState('luckCards')
  return buildPool(config, SYSTEM_LUCK_CARDS, ctx.state.theme, (card) => {
    const effect = LUCK_EFFECTS[card.effect]
    if (!effect) return false
    if (effect.negative && !config.allowNegative) return false
    if (effect.requires && !ctx.isEnabled(effect.requires)) return false
    if (config.usageLimit > 0 && (state.uses[card.id] || 0) >= config.usageLimit) return false
    return true
  })
}

registerModule({
  id: 'luckCards',
  order: 5,
  name: 'Карти късмет',
  shortName: 'Късмет',
  description: 'Изтегли карта: допълнителен ход, имунитет, кражба на точки, групови събития…',
  icon: '🍀',
  category: 'Награди',

  defaultConfig: () => ({
    useSystemContent: true,
    customItems: [],
    difficulties: [],
    rarityWeights: Object.fromEntries(RARITIES.map((r) => [r.id, r.weight])),
    usageLimit: 2,
    allowNegative: true,
  }),

  validateConfig(config, context) {
    const fakeCtx = {
      moduleState: () => ({ uses: {} }),
      state: { theme: context.theme },
      isEnabled: (id) => context.enabledModules.includes(id),
    }
    return pool(fakeCtx, config).length ? [] : [{ field: 'customItems', message: 'Няма налични карти късмет' }]
  },

  summarizeConfig: (config) => [
    config.usageLimit > 0 ? `До ${config.usageLimit} пъти на карта` : 'Без лимит',
    config.allowNegative ? 'С наказания' : 'Само позитивни',
  ],

  initState: () => ({ uses: {}, drawn: 0 }),

  start(ctx) {
    const config = ctx.config('luckCards')
    const cards = pool(ctx, config)
    if (!cards.length) return null
    const card = ctx.rng.weighted(cards, (c) => config.rarityWeights?.[c.rarity] ?? 10)
    return { kind: 'card', phase: 'draw', data: { card, targetId: null, outcome: null } }
  },

  handle(ctx, activity, name, payload) {
    const state = ctx.moduleState('luckCards')
    const { data } = activity
    const { card } = data
    const effect = LUCK_EFFECTS[card.effect]
    const playerId = activity.playerId

    if (name === 'flip') {
      if (activity.phase !== 'draw') return false
      activity.phase = 'revealed'
      state.uses[card.id] = (state.uses[card.id] || 0) + 1
      state.drawn += 1
      ctx.log(`${ctx.playerName(playerId)} изтегли „${card.title}“`, { type: 'luck/draw' })
      return true
    }

    if (name === 'apply') {
      if (activity.phase !== 'revealed') return false
      const targetId = payload.targetId
      if (effect.needsTarget && (!ctx.player(targetId) || targetId === playerId)) return false
      const value = card.value || 0
      switch (card.effect) {
        case 'spin_again':
          ctx.grantExtraTurn()
          break
        case 'immunity':
          ctx.grantImmunity(playerId, Math.max(1, value))
          ctx.log(`${ctx.playerName(playerId)} получи имунитет`, { type: 'luck/immunity' })
          break
        case 'give_points':
          ctx.addPoints(targetId, value || 2, `подарък от ${ctx.playerName(playerId)}`)
          break
        case 'choose_next':
          ctx.setNextPlayer(targetId)
          ctx.log(`${ctx.playerName(playerId)} избра ${ctx.playerName(targetId)} за следващ`, { type: 'luck/chooseNext' })
          break
        case 'exchange_gift':
          ctx.enqueueFront('gifts', { kind: 'exchange', via: 'luckCard' }, playerId)
          break
        case 'bonus_points':
          ctx.addPoints(playerId, value || 1, `„${card.title}“`)
          break
        case 'skip_turn':
          ctx.skipNextTurn(playerId)
          break
        case 'steal_points': {
          const taken = -ctx.addPoints(targetId, -(value || 1), `откраднати от ${ctx.playerName(playerId)}`)
          if (taken > 0) ctx.addPoints(playerId, taken, `кражба от ${ctx.playerName(targetId)}`)
          break
        }
        case 'group_event':
        default:
          ctx.log(`Групово събитие: ${card.title}`, { type: 'luck/group' })
      }
      data.targetId = targetId || null
      ctx.complete()
      return true
    }
    return false
  },
})
