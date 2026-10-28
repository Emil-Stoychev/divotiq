import { SYSTEM_CHARADES, SYSTEM_DRAWING, SYSTEM_SONGS, SYSTEM_TRIVIA, SYSTEM_WORD_GAMES } from '../content'
import { createTimer } from '../engine/timers'
import { registerModule } from './registry'
import { buildPool, clampInt, drawFromPool, handleTimerAction, stopTimer } from './shared'

// Mini-games are a registry of their own: each entry describes its content
// pool, default settings and flow. New mini-games are added with
// registerMiniGame() without touching the module or the engine.
//
// Flows:
//   'performance' — the active player secretly sees a prompt, then performs it
//                   (charades, humming, drawing); someone guesses within a timer.
//   'quiz'        — a multiple-choice question; correct answer earns points.
//   'rapid'       — a public category; name N things before the timer ends.

const miniGames = new Map()

export function registerMiniGame(definition) {
  miniGames.set(definition.id, Object.freeze(definition))
}

export function listMiniGames() {
  return [...miniGames.values()]
}

export function getMiniGame(id) {
  return miniGames.get(id)
}

registerMiniGame({
  id: 'charades',
  name: 'Пантомима',
  icon: '🎭',
  flow: 'performance',
  contentKind: 'charades',
  system: SYSTEM_CHARADES,
  instructions: 'Покажи без думи и звуци. Който познае, печели точки заедно с теб.',
  defaults: { enabled: true, durationSec: 60 },
})

registerMiniGame({
  id: 'song',
  name: 'Познай песента',
  icon: '🎵',
  flow: 'performance',
  contentKind: 'song',
  system: SYSTEM_SONGS,
  instructions: 'Изтананикай песента без думи. Останалите познават заглавието.',
  defaults: { enabled: true, durationSec: 45 },
})

registerMiniGame({
  id: 'drawing',
  name: 'Рисувай',
  icon: '🎨',
  flow: 'performance',
  contentKind: 'drawing',
  system: SYSTEM_DRAWING,
  instructions: 'Нарисувай на лист (без букви и цифри). Останалите познават.',
  defaults: { enabled: true, durationSec: 60 },
})

registerMiniGame({
  id: 'trivia',
  name: 'Въпрос',
  icon: '🧠',
  flow: 'quiz',
  contentKind: 'trivia',
  system: SYSTEM_TRIVIA,
  instructions: 'Избери верния отговор.',
  defaults: { enabled: true, durationSec: 20 },
})

registerMiniGame({
  id: 'wordGame',
  name: 'Бързи думи',
  icon: '⚡',
  flow: 'rapid',
  contentKind: 'word_game',
  system: SYSTEM_WORD_GAMES,
  instructions: 'Кажи нужния брой неща от категорията, преди времето да изтече.',
  defaults: { enabled: true, durationSec: 20 },
})

function gamePool(ctx, config, game) {
  const custom = (config.customItems || []).filter((item) => item.kind === game.contentKind)
  return buildPool({ ...config, customItems: custom }, game.system, ctx.state.theme)
}

function enabledGames(config) {
  return listMiniGames().filter((game) => config.games?.[game.id]?.enabled)
}

registerModule({
  id: 'miniGames',
  order: 9,
  name: 'Мини игри',
  shortName: 'Мини игра',
  description: 'Пантомима, въпроси, познай песента, рисуване и бързи думи.',
  icon: '🎮',
  category: 'Игри',

  defaultConfig: () => ({
    useSystemContent: true,
    customItems: [],
    difficulties: ['easy', 'medium', 'hard'],
    allowRepeat: false,
    pointsWin: 2,
    pointsGuesser: 1,
    games: Object.fromEntries(listMiniGames().map((game) => [game.id, { ...game.defaults }])),
  }),

  validateConfig(config, context) {
    const errors = []
    const games = enabledGames(config)
    if (!games.length) errors.push({ field: 'games', message: 'Включете поне една мини игра' })
    const fakeCtx = { state: { theme: context.theme } }
    for (const game of games) {
      if (!gamePool(fakeCtx, config, game).length) errors.push({ field: 'games', message: `Няма съдържание за „${game.name}“` })
    }
    return errors
  },

  summarizeConfig: (config) => [enabledGames(config).map((g) => g.name).join(', ') || 'Няма'],

  initState: () => ({ usedIds: [], played: {} }),

  start(ctx, params, playerId) {
    const config = ctx.config('miniGames')
    const state = ctx.moduleState('miniGames')
    const candidates = enabledGames(config).filter((game) => gamePool(ctx, config, game).length)
    if (!candidates.length) return null
    const game = params.gameId ? getMiniGame(params.gameId) : ctx.rng.pick(candidates)
    if (!game) return null
    const item = drawFromPool(ctx, 'miniGames', gamePool(ctx, config, game), { allowRepeat: config.allowRepeat })
    if (!item) return null
    state.played[game.id] = (state.played[game.id] || 0) + 1
    const durationSec = clampInt(config.games[game.id]?.durationSec ?? item.durationSec ?? game.defaults.durationSec, 5, 300, 30)
    const data = { gameId: game.id, item, timer: createTimer(item.durationSec || durationSec), outcome: null, guesserId: null }

    if (game.flow === 'quiz') {
      // Shuffle options deterministically and remember where the answer went.
      const order = ctx.rng.shuffle(item.options.map((_, i) => i))
      data.options = order.map((i) => item.options[i])
      data.answerIndex = order.indexOf(item.answerIndex)
      data.selectedIndex = null
      return { kind: game.id, phase: 'question', data }
    }
    if (game.flow === 'rapid') {
      data.targetCount = item.targetCount || 5
      return { kind: game.id, phase: 'ready', data }
    }
    return { kind: game.id, phase: 'secret', data: { ...data, performerId: playerId } }
  },

  handle(ctx, activity, name, payload) {
    const config = ctx.config('miniGames')
    const game = getMiniGame(activity.data.gameId)
    const { data } = activity
    const playerId = activity.playerId
    const label = data.item.title

    if (['playing', 'question', 'ready'].includes(activity.phase)) {
      const timerResult = handleTimerAction(ctx, activity, name)
      if (timerResult !== undefined) return timerResult
    }

    const finish = (outcome) => {
      stopTimer(ctx, activity)
      data.outcome = outcome
      activity.phase = 'result'
    }

    if (name === 'continue') {
      if (activity.phase !== 'result') return false
      ctx.complete()
      return true
    }
    if (name === 'skip') {
      if (activity.phase === 'result') return false
      stopTimer(ctx, activity)
      ctx.log(`${game.name} беше пропусната`, { type: 'minigame/skip' })
      ctx.complete()
      return true
    }

    if (game.flow === 'quiz') {
      if (name !== 'answer' || activity.phase !== 'question') return false
      const index = Number(payload.index)
      if (!Number.isInteger(index) || index < 0 || index >= data.options.length) return false
      data.selectedIndex = index
      const correct = index === data.answerIndex
      finish(correct ? 'correct' : 'wrong')
      if (correct) ctx.addPoints(playerId, config.pointsWin, 'верен отговор')
      ctx.log(`${ctx.playerName(playerId)} ${correct ? 'отговори вярно' : 'сгреши'} на „${label}“`, { type: 'minigame/quiz' })
      return true
    }

    if (game.flow === 'rapid') {
      if (name === 'start' && activity.phase === 'ready') {
        activity.phase = 'playing'
        return handleTimerAction(ctx, activity, 'timer/start')
      }
      if (activity.phase !== 'playing') return false
      if (name === 'success') {
        finish('success')
        ctx.addPoints(playerId, config.pointsWin, `„${label}“`)
        ctx.log(`${ctx.playerName(playerId)} се справи с „${label}“`, { type: 'minigame/success' })
        return true
      }
      if (name === 'fail' || name === 'timeUp') {
        finish('fail')
        ctx.log(`${ctx.playerName(playerId)} не успя с „${label}“`, { type: 'minigame/fail' })
        return true
      }
      return false
    }

    // performance flow
    if (name === 'start' && activity.phase === 'secret') {
      activity.phase = 'playing'
      return handleTimerAction(ctx, activity, 'timer/start')
    }
    if (activity.phase !== 'playing') return false
    if (name === 'guessed') {
      const guesser = ctx.player(payload.playerId)
      if (!guesser || guesser.id === playerId) return false
      data.guesserId = guesser.id
      finish('guessed')
      ctx.addPoints(playerId, config.pointsWin, game.name)
      ctx.addPoints(guesser.id, config.pointsGuesser, `позна „${label}“`)
      ctx.log(`${guesser.name} позна „${label}“ (${game.name})`, { type: 'minigame/guessed' })
      return true
    }
    if (name === 'fail' || name === 'timeUp') {
      finish('fail')
      ctx.log(`Никой не позна „${label}“ (${game.name})`, { type: 'minigame/fail' })
      return true
    }
    return false
  },
})
