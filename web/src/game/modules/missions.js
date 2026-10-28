import { SYSTEM_MISSIONS } from '../content'
import { registerModule } from './registry'
import { buildPool, clampInt, contentDefaults, drawFromPool, validateContentConfig } from './shared'

// Secret missions are private. The public screen only ever shows that a player
// *has* a mission; the text appears on the owner's press-and-hold reveal and in
// the post-game summary (if enabled). Completion is verified by the host.

function assignMission(ctx, playerId) {
  const config = ctx.config('missions')
  const state = ctx.moduleState('missions')
  const mission = drawFromPool(ctx, 'missions', buildPool(config, SYSTEM_MISSIONS, ctx.state.theme))
  if (!mission) return null
  state.counter += 1
  const assignment = {
    id: `mission-${state.counter}`,
    playerId,
    title: mission.title,
    text: mission.body,
    points: mission.points ?? config.pointsOnComplete,
    status: 'active',
    assignedRound: ctx.state.turn.round,
    deadlineRound: config.deadlineRounds > 0 ? ctx.state.turn.round + config.deadlineRounds : null,
    seen: false,
  }
  state.assignments.push(assignment)
  return assignment
}

registerModule({
  id: 'missions',
  order: 7,
  name: 'Тайни мисии',
  shortName: 'Тайна мисия',
  description: 'Всеки получава скрита задача. Изпълни я, без другите да разберат.',
  icon: '🕵️',
  category: 'Игри',
  minPlayers: 3,

  defaultConfig: () => ({
    ...contentDefaults(),
    assignOnStart: true,
    missionsPerPlayer: 1,
    pointsOnComplete: 3,
    deadlineRounds: 0,
    revealOnFinish: true,
  }),

  validateConfig(config, context) {
    const errors = validateContentConfig(config, SYSTEM_MISSIONS, context.theme, 'Тайни мисии')
    if (config.missionsPerPlayer < 1 || config.missionsPerPlayer > 3) errors.push({ field: 'missionsPerPlayer', message: 'Между 1 и 3 мисии на играч' })
    return errors
  },

  summarizeConfig: (config) => [
    config.assignOnStart ? `${config.missionsPerPlayer} в началото` : 'Само от колелото',
    `${config.pointsOnComplete} т.`,
    config.deadlineRounds ? `Срок ${config.deadlineRounds} рунда` : 'До края',
  ],

  initState: () => ({ assignments: [], usedIds: [], counter: 0 }),

  onGameStart(ctx) {
    const config = ctx.config('missions')
    if (!config.assignOnStart) return
    for (const player of ctx.state.players) {
      const ids = []
      for (let i = 0; i < clampInt(config.missionsPerPlayer, 1, 3, 1); i += 1) {
        const assignment = assignMission(ctx, player.id)
        if (assignment) ids.push(assignment.id)
      }
      if (ids.length) ctx.enqueue('missions', { kind: 'briefing', assignmentIds: ids }, player.id)
    }
  },

  start(ctx, params, playerId) {
    let ids = params.assignmentIds
    if (!ids) {
      const assignment = assignMission(ctx, playerId)
      if (!assignment) return null
      ids = [assignment.id]
    }
    return { kind: 'briefing', phase: 'handoff', data: { assignmentIds: ids } }
  },

  handle(ctx, activity, name) {
    const state = ctx.moduleState('missions')
    if (name === 'show') {
      if (activity.phase !== 'handoff') return false
      activity.phase = 'secret'
      return true
    }
    if (name === 'hide') {
      if (activity.phase !== 'secret') return false
      for (const assignment of state.assignments) {
        if (activity.data.assignmentIds.includes(assignment.id)) assignment.seen = true
      }
      ctx.log(`${ctx.playerName(activity.playerId)} получи тайна мисия`, { type: 'mission/assign' })
      ctx.complete()
      return true
    }
    return false
  },

  command(ctx, name, payload) {
    const state = ctx.moduleState('missions')
    const assignment = state.assignments.find((a) => a.id === payload.assignmentId)
    if (!assignment || assignment.status !== 'active') return false
    if (name === 'complete') {
      assignment.status = 'completed'
      assignment.resolvedRound = ctx.state.turn.round
      ctx.addPoints(assignment.playerId, assignment.points, 'изпълнена тайна мисия')
      ctx.log(`${ctx.playerName(assignment.playerId)} изпълни тайна мисия: „${assignment.title}“`, { type: 'mission/complete', playerId: assignment.playerId, moduleId: 'missions' })
      return true
    }
    if (name === 'fail') {
      assignment.status = 'failed'
      assignment.resolvedRound = ctx.state.turn.round
      ctx.log(`Тайната мисия на ${ctx.playerName(assignment.playerId)} е провалена`, { type: 'mission/fail', playerId: assignment.playerId, moduleId: 'missions' })
      return true
    }
    return false
  },

  onTurnStart(ctx) {
    const state = ctx.moduleState('missions')
    const notices = []
    for (const assignment of state.assignments) {
      if (assignment.status === 'active' && assignment.deadlineRound && ctx.state.turn.round > assignment.deadlineRound) {
        assignment.status = 'failed'
        notices.push(`Мисията на ${ctx.playerName(assignment.playerId)} изтече`)
        ctx.log(`Срокът на мисията на ${ctx.playerName(assignment.playerId)} изтече`, { type: 'mission/expire', playerId: assignment.playerId, moduleId: 'missions' })
      }
    }
    return notices
  },

  onFinish(ctx) {
    for (const assignment of ctx.moduleState('missions').assignments) {
      if (assignment.status === 'active') assignment.status = 'expired'
    }
  },
})
