import { SYSTEM_WHISPER_PHRASES } from '../content'
import { createTimer } from '../engine/timers'
import { registerModule } from './registry'
import { buildPool, clampInt, contentDefaults, drawFromPool, handleTimerAction, stopTimer, validateContentConfig } from './shared'

// Whisper Challenge: the guesser wears headphones with loud music; the reader
// mouths a secret phrase. The phrase is shown only on the reader's screen
// (single-device: press-and-hold while others look away). The app never tries
// to verify answers — the group judges.

function pickReader(ctx, config, guesserId) {
  const others = ctx.otherPlayers(guesserId)
  if (config.readerSelection === 'random') return ctx.rng.pick(others).id
  return ctx.nextPlayerAfter(guesserId).id
}

registerModule({
  id: 'whisper',
  order: 3,
  name: 'Whisper Challenge',
  shortName: 'Whisper',
  description: 'Слушалки с музика на макс и четене по устните. Таймер, опити и точки.',
  icon: '🎧',
  category: 'Игри',

  defaultConfig: () => ({
    ...contentDefaults(),
    durationSec: 45,
    attempts: 3,
    scoring: true,
    pointsGuesser: 2,
    pointsReader: 1,
    readerSelection: 'next', // next | random
    allowReveal: true,
  }),

  validateConfig(config, context) {
    const errors = validateContentConfig(config, SYSTEM_WHISPER_PHRASES, context.theme, 'Whisper фрази')
    if (config.durationSec < 10 || config.durationSec > 300) errors.push({ field: 'durationSec', message: 'Времето трябва да е между 10 и 300 секунди' })
    if (config.attempts < 1 || config.attempts > 10) errors.push({ field: 'attempts', message: 'Опитите трябва да са между 1 и 10' })
    return errors
  },

  summarizeConfig: (config) => [`${config.durationSec} сек.`, `${config.attempts} опита`, config.scoring ? 'С точки' : 'Без точки'],

  initState: () => ({ usedIds: [], guessed: 0, missed: 0 }),

  start(ctx, params, playerId) {
    const config = ctx.config('whisper')
    const phrase = drawFromPool(ctx, 'whisper', buildPool(config, SYSTEM_WHISPER_PHRASES, ctx.state.theme), {
      allowRepeat: config.allowRepeat,
    })
    if (!phrase) return null
    return {
      kind: 'whisper',
      phase: 'handoff',
      data: {
        phrase,
        guesserId: playerId,
        readerId: pickReader(ctx, config, playerId),
        attemptsLeft: clampInt(config.attempts, 1, 10, 3),
        timer: createTimer(clampInt(config.durationSec, 10, 300, 45)),
        outcome: null,
      },
    }
  },

  handle(ctx, activity, name) {
    const config = ctx.config('whisper')
    const state = ctx.moduleState('whisper')
    const { data } = activity

    if (activity.phase === 'playing') {
      const timerResult = handleTimerAction(ctx, activity, name)
      if (timerResult !== undefined) return timerResult
    }

    const finish = (outcome) => {
      stopTimer(ctx, activity)
      activity.phase = 'result'
      data.outcome = outcome
    }

    switch (name) {
      case 'readerReady':
        if (activity.phase !== 'handoff') return false
        activity.phase = 'reader'
        return true
      case 'start':
        if (activity.phase !== 'reader') return false
        activity.phase = 'playing'
        return handleTimerAction(ctx, activity, 'timer/start')
      case 'correct':
        if (activity.phase !== 'playing') return false
        finish('correct')
        state.guessed += 1
        if (config.scoring) {
          ctx.addPoints(data.guesserId, config.pointsGuesser, 'позна Whisper фразата')
          ctx.addPoints(data.readerId, config.pointsReader, 'Whisper четец')
        }
        ctx.log(`${ctx.playerName(data.guesserId)} позна „${data.phrase.title}“`, { type: 'whisper/correct' })
        return true
      case 'wrong':
        if (activity.phase !== 'playing') return false
        data.attemptsLeft -= 1
        if (data.attemptsLeft <= 0) {
          finish('noAttempts')
          state.missed += 1
          ctx.log(`${ctx.playerName(data.guesserId)} не позна „${data.phrase.title}“`, { type: 'whisper/miss' })
        }
        return true
      case 'timeUp':
        if (activity.phase !== 'playing') return false
        finish('timeout')
        state.missed += 1
        ctx.log(`Времето за „${data.phrase.title}“ изтече`, { type: 'whisper/timeout' })
        return true
      case 'reveal':
        if (!config.allowReveal || activity.phase !== 'playing') return false
        finish('revealed')
        state.missed += 1
        ctx.log(`Фразата „${data.phrase.title}“ беше разкрита`, { type: 'whisper/reveal' })
        return true
      case 'skip':
        if (activity.phase === 'result') return false
        stopTimer(ctx, activity)
        ctx.log('Whisper рундът беше пропуснат', { type: 'whisper/skip' })
        ctx.complete()
        return true
      case 'continue':
        if (activity.phase !== 'result') return false
        ctx.complete()
        return true
      default:
        return false
    }
  },
})
