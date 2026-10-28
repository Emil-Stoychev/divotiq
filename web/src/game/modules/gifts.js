import { SYSTEM_GIFTS } from '../content'
import { registerModule } from './registry'
import { RARITIES } from './shared'

// Gifts may be physical (the app only tracks allocation) or virtual. Each gift
// item has a status: available -> awarded -> exchanged. Awarding checks the
// status first, so a gift can never be awarded twice.

export const EXCHANGE_RULES = [
  { id: 'swap', label: 'Размяна (едно за друго)' },
  { id: 'steal', label: 'Открадни (вземи подарък)' },
]

function rarityWeight(config, rarity) {
  return config.rarityWeights?.[rarity] ?? RARITIES.find((r) => r.id === rarity)?.weight ?? 10
}

function ownedBy(state, playerId) {
  return state.items.filter((item) => item.ownerId === playerId)
}

registerModule({
  id: 'gifts',
  order: 4,
  name: 'Подаръци и награди',
  shortName: 'Подарък',
  description: 'Истински или виртуални подаръци с рядкост, мистериозни кутии и размени.',
  icon: '🎁',
  category: 'Награди',

  defaultConfig: () => ({
    useDefaultGifts: true,
    gifts: [],
    rarityWeights: Object.fromEntries(RARITIES.map((r) => [r.id, r.weight])),
    recipient: 'current', // current | choose
    allowExchange: true,
    exchangeRule: 'swap',
    maxPerPlayer: 0,
    whenEmpty: 'points', // points | skip
  }),

  validateConfig(config) {
    const errors = []
    const custom = config.gifts || []
    if (!config.useDefaultGifts && custom.length === 0) {
      errors.push({ field: 'gifts', message: 'Добавете поне един подарък или включете виртуалните награди' })
    }
    if (custom.some((g) => !g.name?.trim())) errors.push({ field: 'gifts', message: 'Всеки подарък трябва да има име' })
    if (custom.length > 60) errors.push({ field: 'gifts', message: 'Максимум 60 подаръка' })
    return errors
  },

  summarizeConfig: (config) => [
    `${(config.gifts || []).length + (config.useDefaultGifts ? SYSTEM_GIFTS.length : 0)} подаръка`,
    config.allowExchange ? 'С размени' : 'Без размени',
  ],

  initState(config) {
    const source = [...(config.useDefaultGifts ? SYSTEM_GIFTS : []), ...(config.gifts || [])]
    return {
      items: source.map((gift, index) => ({
        id: gift.id || `gift-${index}`,
        name: gift.name,
        description: gift.description || '',
        rarity: gift.rarity || 'common',
        type: gift.type || 'physical',
        mystery: Boolean(gift.mystery),
        status: 'available',
        ownerId: null,
        revealed: !gift.mystery,
        awardedTurn: null,
      })),
      exchanges: 0,
    }
  },

  start(ctx, params, playerId) {
    const config = ctx.config('gifts')
    const state = ctx.moduleState('gifts')

    if (params.kind === 'exchange') {
      if (!config.allowExchange) return null
      const others = state.items.filter((i) => i.ownerId && i.ownerId !== playerId)
      if (!others.length) return null
      if (config.exchangeRule === 'swap' && !ownedBy(state, playerId).length) return null
      return { kind: 'exchange', phase: 'select', data: { rule: config.exchangeRule, outcome: null } }
    }

    const available = state.items.filter((i) => i.status === 'available')
    if (!available.length) {
      if (config.whenEmpty === 'points') return { kind: 'empty', phase: 'result', data: { outcome: 'empty' } }
      return null
    }
    const gift = ctx.rng.weighted(available, (item) => rarityWeight(config, item.rarity))
    const needsChoice = config.recipient === 'choose'
    return {
      kind: 'award',
      phase: needsChoice ? 'choose' : 'reveal',
      data: { giftId: gift.id, recipientId: needsChoice ? null : playerId, outcome: null },
    }
  },

  handle(ctx, activity, name, payload) {
    const config = ctx.config('gifts')
    const state = ctx.moduleState('gifts')
    const { data } = activity

    if (activity.kind === 'empty') {
      if (name !== 'continue') return false
      ctx.addPoints(activity.playerId, 1, 'няма останали подаръци')
      ctx.complete()
      return true
    }

    if (activity.kind === 'award') {
      const gift = state.items.find((i) => i.id === data.giftId)
      if (name === 'chooseRecipient') {
        if (activity.phase !== 'choose' || !ctx.player(payload.playerId)) return false
        data.recipientId = payload.playerId
        activity.phase = 'reveal'
        return true
      }
      if (name === 'reveal') {
        if (activity.phase !== 'reveal' || !gift || gift.revealed) return false
        gift.revealed = true
        return true
      }
      if (name === 'accept') {
        if (activity.phase !== 'reveal' || !gift || gift.status !== 'available' || !data.recipientId) return false
        const limit = config.maxPerPlayer || 0
        if (limit && ownedBy(state, data.recipientId).length >= limit) {
          data.outcome = 'limit'
          activity.phase = 'result'
          ctx.log(`${ctx.playerName(data.recipientId)} вече има максимален брой подаръци`, { type: 'gift/limit' })
          return true
        }
        gift.status = 'awarded'
        gift.ownerId = data.recipientId
        gift.revealed = true
        gift.awardedTurn = ctx.state.turn.number
        data.outcome = 'awarded'
        activity.phase = 'result'
        ctx.log(`${ctx.playerName(data.recipientId)} получи „${gift.name}“`, { type: 'gift/award', playerId: data.recipientId })
        return true
      }
      if (name === 'continue' && activity.phase === 'result') {
        ctx.complete()
        return true
      }
      return false
    }

    if (activity.kind === 'exchange') {
      if (name === 'cancel') {
        ctx.complete()
        return true
      }
      if (name === 'continue' && activity.phase === 'result') {
        ctx.complete()
        return true
      }
      if (name !== 'exchange' || activity.phase !== 'select') return false
      const theirs = state.items.find((i) => i.id === payload.theirGiftId)
      if (!theirs || !theirs.ownerId || theirs.ownerId === activity.playerId) return false
      const formerOwner = theirs.ownerId
      if (data.rule === 'swap') {
        const mine = state.items.find((i) => i.id === payload.myGiftId)
        if (!mine || mine.ownerId !== activity.playerId) return false
        mine.ownerId = formerOwner
        mine.status = 'exchanged'
        ctx.log(`${ctx.playerName(activity.playerId)} размени „${mine.name}“ за „${theirs.name}“ с ${ctx.playerName(formerOwner)}`, {
          type: 'gift/exchange',
        })
      } else {
        ctx.log(`${ctx.playerName(activity.playerId)} взе „${theirs.name}“ от ${ctx.playerName(formerOwner)}`, { type: 'gift/steal' })
      }
      theirs.ownerId = activity.playerId
      theirs.status = 'exchanged'
      state.exchanges += 1
      data.outcome = 'exchanged'
      data.exchange = { theirGiftId: theirs.id, myGiftId: payload.myGiftId || null, formerOwner }
      activity.phase = 'result'
      return true
    }
    return false
  },
})

export function inventoryOf(state, playerId) {
  return (state.moduleState.gifts?.items || []).filter((item) => item.ownerId === playerId)
}
