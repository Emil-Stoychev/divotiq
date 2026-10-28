import { SYSTEM_CHALLENGES } from '../content'
import { createTimer, pauseTimer } from '../engine/timers'
import { registerModule } from './registry'
import { buildPool, contentDefaults, drawFromPool, handleTimerAction, stopTimer, validateContentConfig } from './shared'

export const FAIL_ACTIONS = [
  { id: 'none', label: 'Без наказание' },
  { id: 'losePoint', label: '−1 точка' },
  { id: 'drinking', label: 'Изпълнява „Шот“', requires: 'drinking' },
  { id: 'luckCard', label: 'Тегли карта късмет', requires: 'luckCards' },
]

export const SUCCESS_REWARDS = [
  { id: 'none', label: 'Само точки' },
  { id: 'gift', label: 'Подарък', requires: 'gifts' },
  { id: 'luckCard', label: 'Карта късмет', requires: 'luckCards' },
]

function pool(ctx, config) {
  const players = ctx.state.players.length
  return buildPool(config, SYSTEM_CHALLENGES, ctx.state.theme, (item) => {
    if (item.ongoing && !config.includeOngoing) return false
    if ((item.minPlayers || 1) > players) return false
    if (item.maxPlayers && item.maxPlayers < players) return false
    if (config.categories?.length && !config.categories.includes(item.category)) return false
    return true
  })
}

registerModule({
  id: 'challenges',
  order: 2,
  name: 'Предизвикателства',
  shortName: 'Предизвикателство',
  description: 'Смешни задачи с таймер, точки, награди и продължаващи ефекти.',
  icon: '🎯',
  category: 'Игри',

  defaultConfig: () => ({
    ...contentDefaults(),
    useTimer: true,
    defaultDurationSec: 30,
    pointsOnSuccess: 2,
    failAction: 'none',
    successReward: 'none',
    rewardChance: 30,
    includeOngoing: true,
    categories: [],
  }),

  validateConfig(config, context) {
    const errors = validateContentConfig(config, SYSTEM_CHALLENGES, context.theme, 'Предизвикателства')
    const fail = FAIL_ACTIONS.find((f) => f.id === config.failAction)
    if (fail?.requires && !context.enabledModules.includes(fail.requires)) {
      errors.push({ field: 'failAction', message: 'Наказанието изисква модул, който е изключен' })
    }
    const reward = SUCCESS_REWARDS.find((r) => r.id === config.successReward)
    if (reward?.requires && !context.enabledModules.includes(reward.requires)) {
      errors.push({ field: 'successReward', message: 'Наградата изисква модул, който е изключен' })
    }
    if (config.defaultDurationSec < 5 || config.defaultDurationSec > 600) {
      errors.push({ field: 'defaultDurationSec', message: 'Времето трябва да е между 5 и 600 секунди' })
    }
    return errors
  },

  summarizeConfig: (config) => [
    config.useTimer ? `Таймер ${config.defaultDurationSec} сек.` : 'Без таймер',
    `${config.pointsOnSuccess} т. за успех`,
    FAIL_ACTIONS.find((f) => f.id === config.failAction)?.label,
  ],

  initState: () => ({ usedIds: [], completed: 0, failed: 0 }),

  start(ctx) {
    const config = ctx.config('challenges')
    const challenge = drawFromPool(ctx, 'challenges', pool(ctx, config), { allowRepeat: config.allowRepeat })
    if (!challenge) return null
    const duration = challenge.durationSec || config.defaultDurationSec
    const timer = config.useTimer && !challenge.ongoing && duration > 0 ? createTimer(duration) : null
    return { kind: 'challenge', phase: 'ready', data: { challenge, timer, outcome: null } }
  },

  handle(ctx, activity, name) {
    const timerResult = handleTimerAction(ctx, activity, name)
    if (timerResult !== undefined) return timerResult

    const config = ctx.config('challenges')
    const state = ctx.moduleState('challenges')
    const { challenge } = activity.data
    const playerId = activity.playerId
    const playerName = ctx.playerName(playerId)

    if (activity.phase !== 'ready') {
      if (name === 'continue' && activity.phase === 'result') {
        ctx.complete()
        return true
      }
      return false
    }

    if (name === 'success') {
      stopTimer(ctx, activity)
      state.completed += 1
      ctx.addPoints(playerId, challenge.points ?? config.pointsOnSuccess, `„${challenge.title}“`)
      ctx.log(`${playerName} изпълни „${challenge.title}“`, { type: 'challenge/success', playerId })
      if (challenge.ongoing) {
        ctx.addEffect({
          playerId,
          title: challenge.title,
          text: challenge.body,
          turns: challenge.ongoingTurns || 1,
          sourceModuleId: 'challenges',
        })
      }
      const reward = SUCCESS_REWARDS.find((r) => r.id === config.successReward)
      if (reward?.requires && ctx.isEnabled(reward.requires) && ctx.rng.int(100) < config.rewardChance) {
        activity.data.reward = reward.id
        ctx.enqueueFront(reward.requires === 'gifts' ? 'gifts' : 'luckCards', { via: 'challenge' }, playerId)
      }
      activity.phase = 'result'
      activity.data.outcome = 'success'
      return true
    }

    if (name === 'fail') {
      stopTimer(ctx, activity)
      state.failed += 1
      ctx.log(`${playerName} не успя с „${challenge.title}“`, { type: 'challenge/fail', playerId })
      if (config.failAction === 'losePoint') ctx.addPoints(playerId, -1, 'провалено предизвикателство')
      if (config.failAction === 'drinking' && ctx.isEnabled('drinking')) ctx.enqueueFront('drinking', { via: 'penalty' }, playerId)
      if (config.failAction === 'luckCard' && ctx.isEnabled('luckCards')) ctx.enqueueFront('luckCards', { via: 'penalty' }, playerId)
      activity.phase = 'result'
      activity.data.outcome = 'fail'
      return true
    }

    if (name === 'useImmunity') {
      if (!ctx.consumeImmunity(playerId)) return false
      stopTimer(ctx, activity)
      ctx.log(`${playerName} използва имунитет срещу „${challenge.title}“`, { type: 'challenge/immunity', playerId })
      activity.phase = 'result'
      activity.data.outcome = 'immune'
      return true
    }

    if (name === 'skip') {
      if (activity.data.timer) activity.data.timer = pauseTimer(activity.data.timer, ctx.now)
      ctx.log(`${playerName} пропусна „${challenge.title}“`, { type: 'challenge/skip', playerId })
      ctx.complete()
      return true
    }
    return false
  },
})
