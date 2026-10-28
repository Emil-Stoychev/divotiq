// The game engine: a pure reducer over a serialisable session state.
//
//   createSession(draft, { id, now, seed }) -> state
//   applyAction(state, action)              -> state (same reference when ignored)
//
// Every action carries a unique `actionId` and a timestamp `at`. Processed ids
// are remembered, so a double tap, a retried request or a replay after reload
// can never apply the same transition (e.g. award the same gift) twice.
// All randomness comes from the seed stored in the state.

import { getModule } from '../modules/registry'
import { createRandom } from './random'
import { pauseTimer } from './timers'

export const ENGINE_VERSION = 1
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 20
export const MAX_PLAYER_NAME = 24
const MAX_PROCESSED_ACTIONS = 300
const MAX_HISTORY = 1500
const MAX_ADVANCE_STEPS = 30

export const DEFAULT_SETTINGS = Object.freeze({
  turnSource: 'wheel', // wheel | random | host
  turnOrder: 'sequential', // sequential | random
  endCondition: 'rounds', // rounds | manual
  rounds: 5,
  scoring: true,
})

export const CORE_MODULE_ID = 'core'

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

export function createSession(draft, { id, now, seed }) {
  const settings = { ...DEFAULT_SETTINGS, ...(draft.settings || {}) }
  const players = draft.players.map((player) => ({
    id: player.id,
    name: player.name.trim(),
    avatar: player.avatar || '🙂',
  }))

  const modules = {}
  for (const [moduleId, entry] of Object.entries(draft.modules || {})) {
    const definition = getModule(moduleId)
    if (!definition || !entry?.enabled) continue
    modules[moduleId] = {
      enabled: true,
      config: { ...definition.defaultConfig(), ...(entry.config || {}) },
    }
  }

  const state = {
    engineVersion: ENGINE_VERSION,
    id,
    title: draft.title?.trim() || 'Парти игра',
    modeKey: draft.modeKey || 'classic',
    theme: draft.theme || 'classic',
    configId: draft.configId || null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    players,
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    modules,
    settings,
    turn: {
      number: 1,
      round: 1,
      turnsInRound: 1,
      playerIndex: 0,
      playerId: players[0]?.id,
      begun: false,
      extraTurn: false,
    },
    nextPlayerOverride: null,
    activity: null,
    queue: [],
    effects: [],
    immunities: {},
    skipTurns: {},
    moduleState: {},
    history: [],
    counters: { activity: 0, effect: 0, history: 0 },
    rng: seed >>> 0,
    processedActionIds: [],
  }

  const ctx = createContext(state, { actionId: 'init', at: now })
  for (const moduleId of Object.keys(modules)) {
    const definition = getModule(moduleId)
    state.moduleState[moduleId] = definition.initState
      ? definition.initState(modules[moduleId].config, ctx)
      : {}
  }
  for (const moduleId of Object.keys(modules)) {
    getModule(moduleId).onGameStart?.(ctx)
  }
  ctx.log('Играта започна', { type: 'game/start', moduleId: CORE_MODULE_ID, playerId: null })
  advance(state, ctx)
  state.rng = ctx.rng.seed()
  return state
}

// ---------------------------------------------------------------------------
// Context passed to module handlers
// ---------------------------------------------------------------------------

function createContext(state, action) {
  const rng = createRandom(state.rng)
  const ctx = {
    state,
    rng,
    now: action.at,
    actionId: action.actionId,
    completed: false,

    currentPlayerId: () => state.turn.playerId,
    player: (playerId) => state.players.find((p) => p.id === playerId),
    playerName: (playerId) => state.players.find((p) => p.id === playerId)?.name || '—',
    otherPlayers: (playerId) => state.players.filter((p) => p.id !== playerId),
    nextPlayerAfter: (playerId) => {
      const index = state.players.findIndex((p) => p.id === playerId)
      return state.players[(index + 1) % state.players.length]
    },
    isEnabled: (moduleId) => Boolean(state.modules[moduleId]?.enabled),
    config: (moduleId) => state.modules[moduleId]?.config || {},
    moduleState: (moduleId) => {
      if (!state.moduleState[moduleId]) state.moduleState[moduleId] = {}
      return state.moduleState[moduleId]
    },

    addPoints(playerId, amount, reason) {
      if (!state.settings.scoring || !amount || !(playerId in state.scores)) return 0
      const before = state.scores[playerId]
      state.scores[playerId] = Math.max(0, before + amount)
      const applied = state.scores[playerId] - before
      if (reason && applied !== 0) {
        ctx.log(`${ctx.playerName(playerId)} ${applied > 0 ? '+' : ''}${applied} т. · ${reason}`, {
          type: 'score',
          playerId,
        })
      }
      return applied
    },

    log(summary, extra = {}) {
      state.counters.history += 1
      state.history.push({
        id: `${action.actionId}:${state.counters.history}`,
        turn: state.turn.number,
        round: state.turn.round,
        playerId: extra.playerId === undefined ? state.turn.playerId : extra.playerId,
        moduleId: extra.moduleId || state.activity?.moduleId || CORE_MODULE_ID,
        type: extra.type || 'event',
        summary,
        at: action.at,
      })
      if (state.history.length > MAX_HISTORY) state.history.splice(0, state.history.length - MAX_HISTORY)
    },

    enqueue(moduleId, params = {}, playerId = state.turn.playerId) {
      state.queue.push({ moduleId, params, playerId })
    },
    enqueueFront(moduleId, params = {}, playerId = state.turn.playerId) {
      state.queue.unshift({ moduleId, params, playerId })
    },

    addEffect({ playerId, title, text, turns = 1, sourceModuleId }) {
      const limit = state.modules.effects?.config?.maxPerPlayer ?? 3
      const own = state.effects.filter((e) => e.playerId === playerId)
      if (own.length >= limit) {
        const oldest = own[0]
        state.effects = state.effects.filter((e) => e.id !== oldest.id)
      }
      state.counters.effect += 1
      const effect = {
        id: `effect-${state.counters.effect}`,
        playerId,
        title,
        text,
        turnsRemaining: Math.max(1, turns),
        sourceModuleId,
        createdTurn: state.turn.number,
      }
      state.effects.push(effect)
      ctx.log(`${ctx.playerName(playerId)} получи ефект „${title}“`, { type: 'effect/add', playerId })
      return effect
    },
    removeEffect(effectId) {
      state.effects = state.effects.filter((e) => e.id !== effectId)
    },

    grantImmunity(playerId, amount = 1) {
      state.immunities[playerId] = (state.immunities[playerId] || 0) + amount
    },
    consumeImmunity(playerId) {
      if (!state.immunities[playerId]) return false
      state.immunities[playerId] -= 1
      return true
    },
    setNextPlayer(playerId) {
      if (state.players.some((p) => p.id === playerId)) state.nextPlayerOverride = playerId
    },
    grantExtraTurn() {
      state.turn.extraTurn = true
    },
    skipNextTurn(playerId) {
      state.skipTurns[playerId] = (state.skipTurns[playerId] || 0) + 1
    },

    complete() {
      ctx.completed = true
    },
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Flow control
// ---------------------------------------------------------------------------

function nextActivityId(state) {
  state.counters.activity += 1
  return `act-${state.counters.activity}`
}

function setActivity(state, ctx, { moduleId, kind, phase, data, playerId, params }) {
  state.activity = {
    id: nextActivityId(state),
    moduleId,
    kind,
    phase,
    playerId,
    params: params || {},
    data: data || {},
    startedAt: ctx.now,
  }
}

function startQueued(state, ctx, request) {
  if (request.moduleId === CORE_MODULE_ID) {
    setActivity(state, ctx, { ...request.params, moduleId: CORE_MODULE_ID, playerId: request.playerId })
    return true
  }
  const definition = getModule(request.moduleId)
  if (!definition || !ctx.isEnabled(request.moduleId)) return false
  // Make the request's player visible to the module as the "active" player.
  const started = definition.start(ctx, request.params || {}, request.playerId)
  if (!started) {
    ctx.log(`${definition.name}: няма налично съдържание — пропускаме`, {
      type: 'activity/empty',
      moduleId: request.moduleId,
    })
    // The turn's main activity could not start: let the host pick another one
    // instead of silently burning the player's turn.
    if (request.params?.turnContent) {
      setActivity(state, ctx, {
        moduleId: CORE_MODULE_ID,
        kind: 'choose',
        phase: 'choose',
        playerId: request.playerId,
        data: { reason: `${definition.name}: няма налично съдържание` },
      })
      return true
    }
    return false
  }
  setActivity(state, ctx, {
    moduleId: request.moduleId,
    kind: started.kind,
    phase: started.phase,
    data: started.data,
    playerId: request.playerId,
    params: request.params,
  })
  return true
}

// Moves the game forward until there is an activity to show (or it ends).
function advance(state, ctx) {
  for (let step = 0; step < MAX_ADVANCE_STEPS; step += 1) {
    if (state.status !== 'active' || state.activity) return
    if (state.queue.length) {
      startQueued(state, ctx, state.queue.shift())
      continue
    }
    if (!state.turn.begun) {
      beginTurn(state, ctx)
      continue
    }
    moveToNextPlayer(state, ctx)
  }
  if (!state.activity && state.status === 'active') {
    // Safety net: nothing playable could start. Offer the host a choice.
    setActivity(state, ctx, { moduleId: CORE_MODULE_ID, kind: 'choose', phase: 'choose', playerId: state.turn.playerId })
  }
}

function beginTurn(state, ctx) {
  const playerId = state.turn.playerId
  state.turn.begun = true

  const expired = []
  state.effects = state.effects.filter((effect) => {
    if (effect.playerId !== playerId || effect.createdTurn >= state.turn.number) return true
    effect.turnsRemaining -= 1
    if (effect.turnsRemaining > 0) return true
    expired.push({ title: effect.title, playerId })
    ctx.log(`Ефектът „${effect.title}“ на ${ctx.playerName(playerId)} изтече`, { type: 'effect/expire', playerId })
    return false
  })

  const notices = []
  for (const moduleId of Object.keys(state.modules)) {
    const result = getModule(moduleId)?.onTurnStart?.(ctx)
    if (Array.isArray(result)) notices.push(...result)
  }
  if (state.status !== 'active') return

  setActivity(state, ctx, {
    moduleId: CORE_MODULE_ID,
    kind: 'turnStart',
    phase: 'intro',
    playerId,
    data: { expired, notices },
  })
}

function moveToNextPlayer(state, ctx) {
  const { players } = state
  let index = state.turn.playerIndex
  const extraTurn = state.turn.extraTurn

  if (extraTurn) {
    ctx.log(`${ctx.playerName(state.turn.playerId)} играе още един ход`, { type: 'turn/extra' })
  } else if (state.nextPlayerOverride) {
    index = players.findIndex((p) => p.id === state.nextPlayerOverride)
  } else if (state.settings.turnOrder === 'random' && players.length > 1) {
    const others = players.map((_, i) => i).filter((i) => i !== index)
    index = ctx.rng.pick(others)
  } else {
    index = (index + 1) % players.length
  }
  state.nextPlayerOverride = null

  // Honour "skip your next turn" penalties (bounded so we never loop forever).
  let consumedTurns = extraTurn ? 0 : 1
  if (!extraTurn) {
    for (let guard = 0; guard < players.length; guard += 1) {
      const candidate = players[index]
      if (!state.skipTurns[candidate.id]) break
      state.skipTurns[candidate.id] -= 1
      ctx.log(`${candidate.name} пропуска хода си`, { type: 'turn/skip', playerId: candidate.id })
      index = (index + 1) % players.length
      consumedTurns += 1
    }
  }

  // A round is complete once every player has had (or skipped) a turn.
  let round = state.turn.round
  let turnsInRound = state.turn.turnsInRound + consumedTurns
  while (turnsInRound > players.length) {
    round += 1
    turnsInRound -= players.length
  }
  if (state.settings.endCondition === 'rounds' && round > state.settings.rounds) {
    finishGame(state, ctx, 'Всички рундове са изиграни')
    return
  }
  state.turn = {
    number: state.turn.number + 1,
    round,
    turnsInRound,
    playerIndex: index,
    playerId: players[index].id,
    begun: false,
    extraTurn: false,
  }
}

function beginTurnContent(state, ctx) {
  const source = state.settings.turnSource
  if (source === 'wheel' && ctx.isEnabled('wheel')) {
    ctx.enqueue('wheel', { turnContent: true })
    return
  }
  if (source === 'host') {
    ctx.enqueue(CORE_MODULE_ID, { kind: 'choose', phase: 'choose' })
    return
  }
  const playable = playableModuleIds(state)
  if (!playable.length) {
    ctx.enqueue(CORE_MODULE_ID, { kind: 'choose', phase: 'choose' })
    return
  }
  ctx.enqueue(ctx.rng.pick(playable), { turnContent: true })
}

export function playableModuleIds(state) {
  return Object.keys(state.modules).filter((id) => {
    const definition = getModule(id)
    return definition?.playable && id !== 'wheel' && state.modules[id].enabled
  })
}

function finishGame(state, ctx, reason) {
  if (state.status === 'finished') return
  if (state.activity?.data?.timer) {
    state.activity.data.timer = pauseTimer(state.activity.data.timer, ctx.now)
  }
  state.status = 'finished'
  state.finishedAt = ctx.now
  state.activity = null
  state.queue = []
  for (const moduleId of Object.keys(state.modules)) {
    getModule(moduleId)?.onFinish?.(ctx)
  }
  ctx.log(reason ? `Край на играта · ${reason}` : 'Край на играта', {
    type: 'game/finish',
    moduleId: CORE_MODULE_ID,
    playerId: null,
  })
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function handleCoreActivity(state, ctx, activity, name, payload) {
  if (activity.kind === 'turnStart' && name === 'continue') {
    ctx.complete()
    beginTurnContent(state, ctx)
    return true
  }
  if (activity.kind === 'choose' && name === 'choose') {
    const moduleId = payload?.moduleId
    if (!playableModuleIds(state).includes(moduleId)) return false
    ctx.complete()
    ctx.enqueue(moduleId, { turnContent: true })
    return true
  }
  return false
}

function handleActivityAction(state, ctx, action) {
  const activity = state.activity
  if (state.status !== 'active' || !activity || activity.id !== action.activityId) return false
  if (activity.moduleId === CORE_MODULE_ID) {
    return handleCoreActivity(state, ctx, activity, action.name, action.payload)
  }
  const definition = getModule(activity.moduleId)
  if (!definition) return false
  return definition.handle(ctx, activity, action.name, action.payload || {}) !== false
}

function handleCommand(state, ctx, action) {
  if (state.status === 'finished') return false
  const definition = getModule(action.moduleId)
  if (!definition?.command || !ctx.isEnabled(action.moduleId)) return false
  return definition.command(ctx, action.name, action.payload || {}) !== false
}

function pauseActivityTimer(state, now) {
  const timer = state.activity?.data?.timer
  if (timer?.running) state.activity.data.timer = pauseTimer(timer, now)
}

function reduce(state, ctx, action) {
  switch (action.type) {
    case 'activity/action':
      return handleActivityAction(state, ctx, action)
    case 'activity/skip': {
      if (state.status !== 'active' || !state.activity || state.activity.id !== action.activityId) return false
      const definition = getModule(state.activity.moduleId)
      ctx.log(`${definition?.name || 'Ход'} беше пропуснат`, { type: 'activity/skip' })
      ctx.complete()
      return true
    }
    case 'game/command':
      return handleCommand(state, ctx, action)
    case 'effects/remove': {
      if (!state.effects.some((e) => e.id === action.effectId)) return false
      const effect = state.effects.find((e) => e.id === action.effectId)
      ctx.removeEffect(action.effectId)
      ctx.log(`Ефектът „${effect.title}“ беше премахнат`, { type: 'effect/remove', playerId: effect.playerId })
      return true
    }
    case 'game/pause':
      if (state.status !== 'active') return false
      pauseActivityTimer(state, ctx.now)
      state.status = 'paused'
      ctx.log('Играта е на пауза', { type: 'game/pause', playerId: null })
      return true
    case 'game/resume':
      if (state.status !== 'paused') return false
      state.status = 'active'
      ctx.log('Играта продължава', { type: 'game/resume', playerId: null })
      return true
    case 'game/finish':
      if (state.status === 'finished') return false
      finishGame(state, ctx, action.reason)
      return true
    default:
      return false
  }
}

export function applyAction(state, action) {
  if (!state || !action?.actionId || typeof action.at !== 'number') return state
  if (state.processedActionIds.includes(action.actionId)) return state

  const draft = structuredClone(state)
  const ctx = createContext(draft, action)
  const changed = reduce(draft, ctx, action)
  if (!changed) return state

  if (ctx.completed && draft.activity) {
    draft.activity = null
  }
  advance(draft, ctx)

  draft.rng = ctx.rng.seed()
  draft.updatedAt = action.at
  draft.processedActionIds.push(action.actionId)
  if (draft.processedActionIds.length > MAX_PROCESSED_ACTIONS) {
    draft.processedActionIds.splice(0, draft.processedActionIds.length - MAX_PROCESSED_ACTIONS)
  }
  return draft
}
