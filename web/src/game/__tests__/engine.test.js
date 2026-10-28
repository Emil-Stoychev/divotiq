import { describe, expect, it } from 'vitest'
import { applyAction, availableSegments, segmentGeometry, validateDraft } from './setup'
import { act, activityAction, makeDraft, passIntro, start } from './helpers'

describe('session creation', () => {
  it('creates a well-defined initial state', () => {
    const state = start(makeDraft({ enabled: ['wheel', 'challenges'] }))
    expect(state.status).toBe('active')
    expect(state.turn).toMatchObject({ number: 1, round: 1, playerId: 'p1' })
    expect(Object.keys(state.modules).sort()).toEqual(['challenges', 'wheel'])
    expect(state.activity).toMatchObject({ moduleId: 'core', kind: 'turnStart' })
    expect(state.scores).toEqual({ p1: 0, p2: 0, p3: 0 })
  })

  it('is deterministic for the same seed', () => {
    const run = () => {
      let s = start(makeDraft({ enabled: ['wheel', 'challenges', 'luckCards'] }), 7)
      s = passIntro(s)
      s = activityAction(s, 'spin')
      return s.activity.data.resultId
    }
    expect(run()).toBe(run())
  })
})

describe('action idempotency', () => {
  it('ignores a repeated actionId', () => {
    let state = start(makeDraft({ enabled: ['wheel', 'challenges'] }))
    const action = { type: 'activity/action', activityId: state.activity.id, name: 'continue', actionId: 'dup', at: 2_000_000 }
    const once = applyAction(state, action)
    const twice = applyAction(once, action)
    expect(twice).toBe(once)
    expect(once.activity.moduleId).toBe('wheel')
  })

  it('ignores actions for a stale activity', () => {
    let state = passIntro(start(makeDraft({ enabled: ['wheel', 'challenges'] })))
    const staleId = 'act-999'
    const next = act(state, 'activity/action', { activityId: staleId, name: 'spin' })
    expect(next).toBe(state)
  })
})

describe('prize wheel', () => {
  it('returns an available outcome and ignores repeated spins', () => {
    let state = passIntro(start(makeDraft({ enabled: ['wheel', 'challenges', 'luckCards'] })))
    expect(state.activity.moduleId).toBe('wheel')
    state = activityAction(state, 'spin')
    expect(state.activity.phase).toBe('spinning')
    const result = state.activity.data.resultId
    const available = availableSegments(state.modules.wheel.config, Object.keys(state.modules)).map((s) => s.id)
    expect(available).toContain(result)

    const again = activityAction(state, 'spin')
    expect(again).toBe(state) // spin while spinning is ignored
    expect(again.activity.data.resultId).toBe(result)
  })

  it('lands the animation on the selected segment', () => {
    let state = passIntro(start(makeDraft({ enabled: ['wheel', 'challenges', 'luckCards', 'whisper'] }), 99))
    state = activityAction(state, 'spin')
    const { rotation, resultId, segmentIds } = state.activity.data
    const segments = state.modules.wheel.config.segments.filter((s) => segmentIds.includes(s.id))
    const geometry = segmentGeometry(segments, state.modules.wheel.config.probability)
    // The pointer sits at the top (0deg). Find which segment is under it.
    const pointerAngle = (((360 - (rotation % 360)) % 360) + 360) % 360
    const hit = geometry.find((g) => pointerAngle >= g.start && pointerAngle < g.start + g.sweep)
    expect(hit.segment.id).toBe(resultId)
  })

  it('never selects segments of disabled modules', () => {
    for (let seed = 1; seed < 40; seed += 1) {
      let state = passIntro(start(makeDraft({ enabled: ['wheel', 'challenges', 'gifts'] }), seed))
      state = activityAction(state, 'spin')
      const segment = state.modules.wheel.config.segments.find((s) => s.id === state.activity.data.resultId)
      expect(['challenges', 'gifts', 'points']).toContain(segment.target)
    }
  })

  it('removes one-time segments after use', () => {
    const segments = [
      { id: 's1', label: 'Веднъж', icon: '⭐', color: '#ffffff', target: 'points', weight: 1, once: true },
      { id: 's2', label: 'Предизвикателство', icon: '🎯', color: '#ff0000', target: 'challenges', weight: 1 },
    ]
    let found = false
    for (let seed = 1; seed < 30 && !found; seed += 1) {
      let state = passIntro(start(makeDraft({ enabled: ['wheel', 'challenges'], configs: { wheel: { segments } } }), seed))
      state = activityAction(state, 'spin')
      if (state.activity.data.resultId !== 's1') continue
      found = true
      state = activityAction(state, 'settle')
      expect(state.moduleState.wheel.removedIds).toContain('s1')
      expect(availableSegments(state.modules.wheel.config, ['wheel', 'challenges'], state.moduleState.wheel.removedIds)).toHaveLength(1)
    }
    expect(found).toBe(true)
  })

  it('wheel outcome triggers the target module', () => {
    let state = passIntro(start(makeDraft({ enabled: ['wheel', 'challenges'], configs: { wheel: { segments: [
      { id: 'a', label: 'А', icon: '🎯', color: '#ff0000', target: 'challenges', weight: 1 },
      { id: 'b', label: 'Б', icon: '🎯', color: '#00ff00', target: 'challenges', weight: 1 },
    ] } } })))
    state = activityAction(state, 'spin')
    state = activityAction(state, 'settle')
    state = activityAction(state, 'continue')
    expect(state.activity.moduleId).toBe('challenges')
    expect(state.activity.playerId).toBe('p1')
  })
})

describe('turn flow', () => {
  it('advances players and finishes after the configured rounds', () => {
    let state = start(makeDraft({ enabled: ['challenges'], settings: { turnSource: 'random', rounds: 2 }, playerCount: 2 }))
    const seen = []
    for (let i = 0; i < 20 && state.status === 'active'; i += 1) {
      state = passIntro(state)
      seen.push(state.activity.playerId)
      state = activityAction(state, 'skip')
    }
    expect(state.status).toBe('finished')
    expect(seen).toEqual(['p1', 'p2', 'p1', 'p2'])
  })

  it('supports pause and resume', () => {
    let state = start(makeDraft({ enabled: ['challenges'], settings: { turnSource: 'random' } }))
    state = passIntro(state)
    state = activityAction(state, 'timer/start')
    expect(state.activity.data.timer.running).toBe(true)
    state = act(state, 'game/pause')
    expect(state.status).toBe('paused')
    expect(state.activity.data.timer.running).toBe(false)
    expect(activityAction(state, 'success')).toBe(state) // no actions while paused
    state = act(state, 'game/resume')
    expect(state.status).toBe('active')
  })

  it('host turn source lets the host pick the module', () => {
    let state = passIntro(start(makeDraft({ enabled: ['challenges', 'whisper'], settings: { turnSource: 'host' } })))
    expect(state.activity.kind).toBe('choose')
    expect(activityAction(state, 'choose', { moduleId: 'drinking' })).toBe(state)
    state = activityAction(state, 'choose', { moduleId: 'whisper' })
    expect(state.activity.moduleId).toBe('whisper')
  })

  it('manual end finishes the game', () => {
    let state = start(makeDraft({ enabled: ['challenges'], settings: { turnSource: 'random', endCondition: 'manual' } }))
    state = act(state, 'game/finish')
    expect(state.status).toBe('finished')
    expect(state.activity).toBeNull()
  })
})

describe('draft validation', () => {
  it('rejects insufficient players', () => {
    const draft = makeDraft({ playerCount: 1 })
    const result = validateDraft(draft)
    expect(result.valid).toBe(false)
    expect(result.players[0]).toMatch(/поне 2/)
  })

  it('rejects duplicate names', () => {
    const draft = makeDraft({ playerCount: 2 })
    draft.players[1].name = draft.players[0].name
    expect(validateDraft(draft).players.join()).toMatch(/повтаря/)
  })

  it('requires a playable module and validates module config', () => {
    const onlyWheel = makeDraft({ enabled: ['wheel'] })
    expect(validateDraft(onlyWheel).valid).toBe(false)

    const drinking = makeDraft({ enabled: ['wheel', 'drinking', 'challenges'] })
    expect(validateDraft(drinking).modules.drinking[0].field).toBe('adultsConfirmed')
    drinking.modules.drinking.config.adultsConfirmed = true
    expect(validateDraft(drinking).modules.drinking).toBeUndefined()
  })

  it('enforces module minimum players', () => {
    const draft = makeDraft({ enabled: ['wheel', 'missions', 'challenges'], playerCount: 2 })
    expect(validateDraft(draft).modules.missions[0].message).toMatch(/поне 3/)
  })

  it('wheel needs two active segments', () => {
    const draft = makeDraft({ enabled: ['wheel', 'challenges'], configs: { wheel: { segments: [
      { id: 'x', label: 'Подарък', icon: '🎁', color: '#000000', target: 'gifts', weight: 1 },
      { id: 'y', label: 'Предизвикателство', icon: '🎯', color: '#000000', target: 'challenges', weight: 1 },
    ] } } })
    expect(validateDraft(draft).modules.wheel[0].field).toBe('segments')
  })

  it('modules can be enabled/disabled independently', () => {
    const draft = makeDraft({ enabled: ['wheel', 'challenges', 'whisper'] })
    draft.modules.whisper.enabled = false
    const state = start(draft)
    expect(state.modules.whisper).toBeUndefined()
    expect(state.modules.challenges.enabled).toBe(true)
  })
})

describe('leaderboard ranks', () => {
  it('gives tied scores the same place', async () => {
    const { boardRanks } = await import('../engine/selectors')
    expect(boardRanks([{ score: 3 }, { score: 3 }, { score: 1 }, { score: 0 }])).toEqual([1, 1, 3, 4])
    expect(boardRanks([])).toEqual([])
  })
})
