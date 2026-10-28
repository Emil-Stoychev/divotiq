import { applyAction, createDraft, createSession, getBuiltInModeForTests } from './setup'

let counter = 0
export function act(state, type, extra = {}) {
  counter += 1
  return applyAction(state, { type, actionId: `a${counter}`, at: 1_000_000 + counter * 1000, ...extra })
}

export function activityAction(state, name, payload) {
  return act(state, 'activity/action', { activityId: state.activity.id, name, payload })
}

export function players(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Играч ${i + 1}`, avatar: '🦊' }))
}

export function makeDraft({ modeKey = 'classic', enabled, configs = {}, settings = {}, playerCount = 3 } = {}) {
  const draft = createDraft(getBuiltInModeForTests(modeKey))
  draft.players = players(playerCount)
  if (enabled) {
    for (const id of Object.keys(draft.modules)) draft.modules[id].enabled = enabled.includes(id)
  }
  for (const [id, config] of Object.entries(configs)) {
    draft.modules[id].config = { ...draft.modules[id].config, ...config }
  }
  draft.settings = { ...draft.settings, ...settings }
  return draft
}

export function start(draft, seed = 42) {
  return createSession(draft, { id: 'session-test', now: 1_000_000, seed })
}

// Skips through the turn-start intro screen.
export function passIntro(state) {
  if (state.activity?.kind === 'turnStart') return activityAction(state, 'continue')
  return state
}
