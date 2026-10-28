import { getModule } from '../modules'
import { CORE_MODULE_ID } from './session'

export function currentPlayer(state) {
  return state.players.find((p) => p.id === state.turn.playerId)
}

export function leaderboard(state) {
  return [...state.players]
    .map((player) => ({ ...player, score: state.scores[player.id] || 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'bg'))
}

// Competition ranking for a score-sorted board: equal scores share a place (1, 1, 3).
export function boardRanks(board) {
  return board.map((player, index) => board.findIndex((other) => other.score === player.score) + 1)
}

export function winners(state) {
  const board = leaderboard(state)
  if (!board.length || board[0].score === 0) return []
  return board.filter((p) => p.score === board[0].score)
}

export function effectsFor(state, playerId) {
  return state.effects.filter((effect) => effect.playerId === playerId)
}

export function giftsFor(state, playerId) {
  return (state.moduleState.gifts?.items || []).filter((item) => item.ownerId === playerId)
}

export function missionsFor(state, playerId) {
  return (state.moduleState.missions?.assignments || []).filter((m) => m.playerId === playerId)
}

export function moduleName(moduleId) {
  if (moduleId === CORE_MODULE_ID) return 'Игра'
  return getModule(moduleId)?.name || moduleId
}

// Compact summary stored with finished sessions and shown on the summary page.
export function buildSummary(state) {
  const board = leaderboard(state)
  const counts = {}
  for (const entry of state.history) {
    if (entry.moduleId && entry.moduleId !== CORE_MODULE_ID) counts[entry.moduleId] = (counts[entry.moduleId] || 0) + 1
  }
  const durationMs = (state.finishedAt || state.updatedAt) - state.createdAt
  return {
    title: state.title,
    modeKey: state.modeKey,
    theme: state.theme,
    turns: state.turn.number,
    rounds: state.turn.round,
    durationMinutes: Math.max(1, Math.round(durationMs / 60000)),
    winners: winners(state).map((p) => p.name),
    leaderboard: board.map((p) => ({ name: p.name, avatar: p.avatar, score: p.score })),
    gifts: (state.moduleState.gifts?.items || [])
      .filter((g) => g.ownerId)
      .map((g) => ({ name: g.name, owner: state.players.find((p) => p.id === g.ownerId)?.name })),
    missions: (state.moduleState.missions?.assignments || []).map((m) => ({
      owner: state.players.find((p) => p.id === m.playerId)?.name,
      title: m.title,
      status: m.status,
    })),
    moduleCounts: counts,
  }
}

// A copy of the state that is safe to render on the shared/public screen:
// secret mission texts are removed unless the mission is resolved or the game
// is over (and revealing is enabled).
export function publicView(state) {
  const missions = state.moduleState.missions
  if (!missions) return state
  const reveal = state.status === 'finished' && state.modules.missions?.config?.revealOnFinish
  return {
    ...state,
    moduleState: {
      ...state.moduleState,
      missions: {
        ...missions,
        assignments: missions.assignments.map((m) =>
          reveal || m.status === 'completed' ? m : { ...m, title: 'Тайна мисия', text: '' },
        ),
      },
    },
  }
}
