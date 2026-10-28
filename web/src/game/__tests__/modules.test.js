import { describe, expect, it } from 'vitest'
import { applyAction, effectsFor, giftsFor, publicView, remainingMs } from './setup'
import { act, activityAction, makeDraft, passIntro, start } from './helpers'

const randomTurns = { turnSource: 'random' }

// Starts a game where only `moduleId` is playable and returns the state at its activity.
function playOnly(moduleId, { configs = {}, settings = {}, extra = [], playerCount = 3, seed = 5 } = {}) {
  let state = start(makeDraft({ enabled: [moduleId, ...extra], configs, settings: { ...randomTurns, ...settings }, playerCount }), seed)
  state = passIntro(state)
  return state
}

describe('challenges', () => {
  it('runs a timed challenge with pause/resume and awards points', () => {
    let state = playOnly('challenges', { configs: { challenges: { includeOngoing: false } } })
    expect(state.activity.kind).toBe('challenge')
    const { timer } = state.activity.data
    expect(timer.running).toBe(false)

    state = act(state, 'activity/action', { activityId: state.activity.id, name: 'timer/start' })
    const startedAt = state.activity.data.timer.startedAt
    expect(remainingMs(state.activity.data.timer, startedAt + 2000)).toBe(timer.durationMs - 2000)

    state = activityAction(state, 'timer/pause')
    const paused = state.activity.data.timer
    expect(paused.running).toBe(false)
    // Remaining time is frozen while paused.
    expect(remainingMs(paused, paused.elapsedMs + 1e9)).toBe(remainingMs(paused, 0))

    const points = state.activity.data.challenge.points
    state = activityAction(state, 'success')
    expect(state.activity.data.outcome).toBe('success')
    expect(state.scores.p1).toBe(points)
    state = activityAction(state, 'continue')
    expect(state.turn.playerId).toBe('p2')
  })

  it('immunity skips a challenge without penalty, only when available', () => {
    let state = playOnly('challenges', { configs: { challenges: { failAction: 'losePoint' } } })
    expect(activityAction(state, 'useImmunity')).toBe(state)
    state.immunities.p1 = 1
    state = activityAction(state, 'useImmunity')
    expect(state.activity.data.outcome).toBe('immune')
    expect(state.immunities.p1).toBe(0)
  })

  it('failed challenge triggers the configured penalty module', () => {
    let state = playOnly('challenges', {
      extra: ['drinking'],
      configs: { challenges: { failAction: 'drinking' }, drinking: { adultsConfirmed: true } },
      seed: 3,
    })
    // random turn source may pick drinking first; skip until we're on a challenge
    for (let i = 0; i < 10 && state.activity.moduleId !== 'challenges'; i += 1) {
      state = passIntro(activityAction(state, 'skip'))
    }
    state = activityAction(state, 'fail')
    state = activityAction(state, 'continue')
    expect(state.activity.moduleId).toBe('drinking')
  })
})

describe('ongoing effects', () => {
  it('activate on success and expire after the player\'s next turns', () => {
    const ongoing = { id: 'ong', title: 'Говори като робот', body: '', ongoing: true, ongoingTurns: 2, points: 1, difficulty: 'easy', modes: ['any'] }
    let state = playOnly('challenges', {
      configs: { challenges: { useSystemContent: false, customItems: [ongoing], allowRepeat: true } },
      playerCount: 2,
      settings: { rounds: 10 },
    })
    state = activityAction(state, 'success')
    expect(effectsFor(state, 'p1')).toHaveLength(1)
    state = activityAction(state, 'continue')

    // p2 turn: p1 effect unaffected
    state = passIntro(state)
    expect(effectsFor(state, 'p1')[0].turnsRemaining).toBe(2)
    state = activityAction(state, 'skip')
    // p1 next turn: 2 -> 1 (turn start activity shows it is still active)
    expect(state.activity.kind).toBe('turnStart')
    expect(effectsFor(state, 'p1')[0].turnsRemaining).toBe(1)
    state = activityAction(passIntro(state), 'skip')
    state = activityAction(passIntro(state), 'skip') // p2
    // p1's second turn: expires and is reported on the turn intro
    expect(effectsFor(state, 'p1')).toHaveLength(0)
    expect(state.activity.data.expired[0].title).toBe('Говори като робот')
  })

  it('host can remove an effect', () => {
    let state = playOnly('effects')
    state = activityAction(state, 'accept')
    const [effect] = state.effects
    state = act(state, 'effects/remove', { effectId: effect.id })
    expect(state.effects).toHaveLength(0)
  })

  it('respects max effects per player', () => {
    let state = playOnly('effects', { configs: { effects: { maxPerPlayer: 1 } }, playerCount: 2 })
    state = activityAction(state, 'accept')
    expect(state.effects).toHaveLength(1)
    // play until p1 gets another effect
    state = activityAction(passIntro(state), 'accept') // p2
    state = activityAction(passIntro(state), 'accept') // p1 again
    expect(effectsFor(state, 'p1')).toHaveLength(1)
  })
})

describe('gifts', () => {
  const gifts = [
    { id: 'g1', name: 'Шоколад', rarity: 'common' },
    { id: 'g2', name: 'Чаша', rarity: 'rare', mystery: true },
  ]

  it('awards a gift once and tracks inventory', () => {
    let state = playOnly('gifts', { configs: { gifts: { useDefaultGifts: false, gifts } } })
    const giftId = state.activity.data.giftId
    const gift = state.moduleState.gifts.items.find((g) => g.id === giftId)
    if (gift.mystery) {
      expect(gift.revealed).toBe(false)
      state = activityAction(state, 'reveal')
    }
    const accept = { type: 'activity/action', activityId: state.activity.id, name: 'accept', actionId: 'accept-1', at: 5_000_000 }
    state = applyAction(state, accept)
    expect(giftsFor(state, 'p1').map((g) => g.id)).toEqual([giftId])
    // Replaying the same action (e.g. after reload) does not award twice
    expect(applyAction(state, accept)).toBe(state)
    expect(state.moduleState.gifts.items.filter((g) => g.status === 'awarded')).toHaveLength(1)
  })

  it('lets the host choose a recipient', () => {
    let state = playOnly('gifts', { configs: { gifts: { useDefaultGifts: false, gifts, recipient: 'choose' } } })
    expect(state.activity.phase).toBe('choose')
    state = activityAction(state, 'chooseRecipient', { playerId: 'p3' })
    if (!state.moduleState.gifts.items.find((g) => g.id === state.activity.data.giftId).revealed) state = activityAction(state, 'reveal')
    state = activityAction(state, 'accept')
    expect(giftsFor(state, 'p3')).toHaveLength(1)
  })

  it('exchanges gifts consistently', () => {
    let state = start(makeDraft({ enabled: ['gifts', 'luckCards'], settings: randomTurns }), 1)
    const items = state.moduleState.gifts.items
    items[0].ownerId = 'p1'
    items[0].status = 'awarded'
    items[1].ownerId = 'p2'
    items[1].status = 'awarded'
    state = passIntro(state)
    // force an exchange activity
    state.queue = []
    state.activity = { id: 'act-x', moduleId: 'gifts', kind: 'exchange', phase: 'select', playerId: 'p1', params: {}, data: { rule: 'swap' }, startedAt: 0 }
    state = activityAction(state, 'exchange', { myGiftId: items[0].id, theirGiftId: items[1].id })
    expect(giftsFor(state, 'p1').map((g) => g.id)).toEqual([items[1].id])
    expect(giftsFor(state, 'p2').map((g) => g.id)).toEqual([items[0].id])
    // total owned gifts unchanged
    expect(state.moduleState.gifts.items.filter((g) => g.ownerId)).toHaveLength(2)
  })

  it('rejects exchanging a gift you do not own', () => {
    let state = start(makeDraft({ enabled: ['gifts'], settings: randomTurns }), 1)
    const items = state.moduleState.gifts.items
    items[0].ownerId = 'p3'
    items[1].ownerId = 'p2'
    state = passIntro(state)
    state.activity = { id: 'act-y', moduleId: 'gifts', kind: 'exchange', phase: 'select', playerId: 'p1', params: {}, data: { rule: 'swap' }, startedAt: 0 }
    expect(activityAction(state, 'exchange', { myGiftId: items[0].id, theirGiftId: items[1].id })).toBe(state)
  })
})

describe('luck cards', () => {
  const only = (card) => ({ luckCards: { useSystemContent: false, customItems: [{ id: 'c', title: 'Т', body: '', rarity: 'common', ...card }] } })

  it('spin again gives the same player another turn', () => {
    let state = playOnly('luckCards', { configs: only({ effect: 'spin_again' }) })
    state = activityAction(state, 'flip')
    state = activityAction(state, 'apply')
    expect(state.turn.playerId).toBe('p1')
    expect(state.turn.number).toBe(2)
  })

  it('choose next sets the next player and requires a valid target', () => {
    let state = playOnly('luckCards', { configs: only({ effect: 'choose_next' }), playerCount: 4 })
    state = activityAction(state, 'flip')
    expect(activityAction(state, 'apply', { targetId: 'p1' })).toBe(state) // cannot choose yourself
    state = activityAction(state, 'apply', { targetId: 'p4' })
    expect(state.turn.playerId).toBe('p4')
  })

  it('steal points never goes below zero', () => {
    let state = playOnly('luckCards', { configs: only({ effect: 'steal_points', value: 3 }) })
    state.scores.p2 = 1
    state = activityAction(state, 'flip')
    state = activityAction(state, 'apply', { targetId: 'p2' })
    expect(state.scores).toMatchObject({ p1: 1, p2: 0 })
  })

  it('skip turn penalty skips the player next time', () => {
    let state = playOnly('luckCards', { configs: only({ effect: 'skip_turn' }), playerCount: 2 })
    state = activityAction(activityAction(state, 'flip'), 'apply')
    // p2 plays, then p1 should be skipped -> p2 again
    state = activityAction(passIntro(state), 'skip')
    expect(state.turn.playerId).toBe('p2')
  })

  it('honours usage limits', () => {
    let state = playOnly('luckCards', { configs: { luckCards: { ...only({ effect: 'bonus_points', value: 1 }).luckCards, usageLimit: 1 } } })
    state = activityAction(activityAction(state, 'flip'), 'apply')
    // card exhausted -> next luck activity cannot start, engine falls back to a host choice
    state = passIntro(state)
    expect(state.activity.kind).toBe('choose')
  })
})

describe('whisper challenge', () => {
  it('separates reader and guesser and scores both', () => {
    let state = playOnly('whisper')
    const { data } = state.activity
    expect(data.guesserId).toBe('p1')
    expect(data.readerId).toBe('p2')
    expect(state.activity.phase).toBe('handoff')
    expect(activityAction(state, 'correct')).toBe(state) // cannot score before playing
    state = activityAction(state, 'readerReady')
    state = activityAction(state, 'start')
    expect(state.activity.data.timer.running).toBe(true)
    state = activityAction(state, 'correct')
    expect(state.scores).toMatchObject({ p1: 2, p2: 1 })
    expect(state.activity.data.timer.running).toBe(false)
  })

  it('uses up attempts on wrong answers', () => {
    let state = playOnly('whisper', { configs: { whisper: { attempts: 2 } } })
    state = activityAction(activityAction(state, 'readerReady'), 'start')
    state = activityAction(state, 'wrong')
    expect(state.activity.data.attemptsLeft).toBe(1)
    state = activityAction(state, 'wrong')
    expect(state.activity.phase).toBe('result')
    expect(state.activity.data.outcome).toBe('noAttempts')
  })
})

describe('secret missions', () => {
  it('assigns missions privately at the start', () => {
    let state = start(makeDraft({ enabled: ['missions', 'challenges'], settings: randomTurns, playerCount: 3 }))
    expect(state.activity).toMatchObject({ moduleId: 'missions', kind: 'briefing', phase: 'handoff', playerId: 'p1' })
    const secret = state.moduleState.missions.assignments[0]
    expect(secret.text.length).toBeGreaterThan(0)

    const view = publicView(state)
    expect(view.moduleState.missions.assignments.every((m) => m.text === '')).toBe(true)
    expect(JSON.stringify(view.moduleState.missions)).not.toContain(secret.text)

    for (const playerId of ['p1', 'p2', 'p3']) {
      expect(state.activity.playerId).toBe(playerId)
      state = activityAction(activityAction(state, 'show'), 'hide')
    }
    expect(state.activity.kind).toBe('turnStart')
  })

  it('completes a mission once and awards points', () => {
    let state = start(makeDraft({ enabled: ['missions', 'challenges'], settings: randomTurns }))
    const mission = state.moduleState.missions.assignments.find((m) => m.playerId === 'p2')
    state = act(state, 'game/command', { moduleId: 'missions', name: 'complete', payload: { assignmentId: mission.id } })
    expect(state.scores.p2).toBe(mission.points)
    const again = act(state, 'game/command', { moduleId: 'missions', name: 'complete', payload: { assignmentId: mission.id } })
    expect(again).toBe(state)
    expect(publicView(state).moduleState.missions.assignments.find((m) => m.id === mission.id).text).toBe(mission.text)
  })

  it('reveals missions on the summary after the game', () => {
    let state = start(makeDraft({ enabled: ['missions', 'challenges'], settings: randomTurns }))
    state = act(state, 'game/finish')
    const view = publicView(state)
    expect(view.moduleState.missions.assignments.every((m) => m.text.length > 0)).toBe(true)
    expect(view.moduleState.missions.assignments.every((m) => m.status === 'expired')).toBe(true)
  })
})

describe('drinking', () => {
  it('alternative is never penalised and skipping is optional', () => {
    let state = playOnly('drinking', { configs: { drinking: { adultsConfirmed: true, allowSkip: false } } })
    expect(state.activity.data.outcome.alternative).toBeTruthy()
    expect(activityAction(state, 'skip')).toBe(state)
    const before = { ...state.scores }
    state = activityAction(state, 'alternative')
    expect(state.scores).toEqual(before)
    expect(state.turn.playerId).toBe('p2')
  })
})

describe('mini games', () => {
  it('trivia shuffles options but keeps the correct answer', () => {
    const q = { id: 'q', kind: 'trivia', title: '2+2?', options: ['4', '3', '5', '6'], answerIndex: 0, difficulty: 'easy' }
    let state = playOnly('miniGames', {
      configs: { miniGames: { useSystemContent: false, customItems: [q], games: { trivia: { enabled: true } } } },
    })
    expect(state.activity.kind).toBe('trivia')
    const { options, answerIndex } = state.activity.data
    expect(options[answerIndex]).toBe('4')
    state = activityAction(state, 'answer', { index: answerIndex })
    expect(state.activity.data.outcome).toBe('correct')
    expect(state.scores.p1).toBe(2)
  })

  it('charades awards performer and guesser', () => {
    const word = { id: 'w', kind: 'charades', title: 'Карам ски', difficulty: 'easy' }
    let state = playOnly('miniGames', {
      configs: { miniGames: { useSystemContent: false, customItems: [word], games: { charades: { enabled: true, durationSec: 30 } } } },
    })
    state = activityAction(state, 'start')
    expect(activityAction(state, 'guessed', { playerId: 'p1' })).toBe(state) // performer cannot guess
    state = activityAction(state, 'guessed', { playerId: 'p3' })
    expect(state.scores).toMatchObject({ p1: 2, p3: 1 })
  })
})

describe('persistence', () => {
  it('a JSON round-trip (reload) continues identically', () => {
    let state = passIntro(start(makeDraft({ enabled: ['wheel', 'challenges', 'gifts', 'luckCards'] }), 11))
    state = activityAction(state, 'spin')
    const reloaded = JSON.parse(JSON.stringify(state))
    const a = activityAction(state, 'settle')
    const action = { type: 'activity/action', activityId: reloaded.activity.id, name: 'settle', actionId: 'x-settle', at: 9_000_000 }
    const b = applyAction(reloaded, action)
    expect(b.activity.data.resultId).toBe(a.activity.data.resultId)
    expect(b.moduleState).toEqual(a.moduleState)
  })
})
