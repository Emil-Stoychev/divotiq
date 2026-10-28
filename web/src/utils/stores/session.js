import { atom } from 'nanostores'
import { sessionsApi } from '@/api/endpoints'
import { applyAction, buildSummary, createSession, validateDraft } from '@/game'
import { createId } from '@/game/engine/ids'
import { randomSeed } from '@/game/engine/random'
import { $me } from './auth'
import { persistentJSON } from './persist'

// The active game. The engine state is the single source of truth; it is
// persisted locally on every change (guests and users) and, for signed-in
// users, synced to the server with optimistic versioning.
export const $session = persistentJSON('divotiq:session', null)
export const $sync = persistentJSON('divotiq:session-sync', emptySync())
export const $syncStatus = atom('idle') // idle | saving | saved | error | offline | conflict

function emptySync(sessionId = null) {
  return { sessionId, serverId: null, version: 0, lastHistoryId: null }
}

export function startGame(draft) {
  const result = validateDraft(draft)
  if (!result.valid) return { ok: false, errors: result }
  abandonCurrent()
  const state = createSession(draft, { id: createId('g'), now: Date.now(), seed: randomSeed() })
  $sync.set(emptySync(state.id))
  $session.set(state)
  scheduleSync(0)
  return { ok: true, state }
}

export function dispatch(type, extra = {}) {
  const state = $session.get()
  if (!state) return false
  const next = applyAction(state, { type, actionId: createId('a'), at: Date.now(), ...extra })
  if (next === state) return false
  $session.set(next)
  scheduleSync(next.status === 'finished' ? 0 : 900)
  return true
}

// Shortcut for actions on the current activity.
export function act(name, payload) {
  const state = $session.get()
  if (!state?.activity) return false
  return dispatch('activity/action', { activityId: state.activity.id, name, payload })
}

// A replaced, unfinished game stays in the account history as "abandoned".
function abandonCurrent() {
  const previous = $session.get()
  const sync = $sync.get()
  if (!$me.get() || !previous || previous.status === 'finished' || !sync.serverId || sync.sessionId !== previous.id) return
  sessionsApi
    .sync(sync.serverId, { baseVersion: sync.version, status: 'abandoned', state: previous, events: [] })
    .catch(() => {})
}

export function clearSession() {
  $session.set(null)
  $sync.set(emptySync())
  $syncStatus.set('idle')
}

// Loads a server session (from history) into the local slot.
export function resumeServerSession(serverSession) {
  $session.set(serverSession.state)
  $sync.set({
    sessionId: serverSession.state.id,
    serverId: serverSession.id,
    version: serverSession.stateVersion,
    lastHistoryId: serverSession.state.history.at(-1)?.id || null,
  })
}

// --- server sync -----------------------------------------------------------

let timer = null
let inFlight = false
let pending = false

export function scheduleSync(delayMs = 900) {
  if (!$me.get() || !$session.get()) return
  clearTimeout(timer)
  timer = setTimeout(syncNow, delayMs)
}

function eventsSince(state, lastHistoryId) {
  const index = lastHistoryId ? state.history.findIndex((h) => h.id === lastHistoryId) : -1
  return state.history.slice(index + 1).slice(0, 200).map((entry) => ({
    actionId: entry.id,
    type: entry.type,
    summary: entry.summary,
    playerName: state.players.find((p) => p.id === entry.playerId)?.name || '',
    moduleId: entry.moduleId,
    at: entry.at,
  }))
}

export async function syncNow() {
  const state = $session.get()
  if (!$me.get() || !state) return
  if (inFlight) {
    pending = true
    return
  }
  inFlight = true
  $syncStatus.set('saving')
  try {
    let sync = $sync.get()
    if (sync.sessionId !== state.id) sync = emptySync(state.id)
    if (!sync.serverId) {
      const created = await sessionsApi.create({
        clientId: state.id,
        configId: state.configId || '',
        title: state.title,
        modeKey: state.modeKey,
        state,
      })
      sync = { ...sync, serverId: created.id, version: created.stateVersion }
      $sync.set(sync)
    }
    const events = eventsSince(state, sync.lastHistoryId)
    const res = await sessionsApi.sync(sync.serverId, {
      baseVersion: sync.version,
      status: state.status,
      state,
      summary: state.status === 'finished' ? buildSummary(state) : undefined,
      events,
    })
    $sync.set({
      ...sync,
      version: res.stateVersion,
      lastHistoryId: events.length ? events.at(-1).actionId : sync.lastHistoryId,
    })
    $syncStatus.set('saved')
  } catch (err) {
    handleSyncError(err, state)
  } finally {
    inFlight = false
    if (pending) {
      pending = false
      scheduleSync(300)
    }
  }
}

function handleSyncError(err, state) {
  if (err.status === 409 && err.body?.session) {
    const remote = err.body.session
    // Keep whichever copy is further along; never silently drop local progress.
    if ((remote.state?.updatedAt || 0) > state.updatedAt) {
      $session.set(remote.state)
      $sync.set({ ...$sync.get(), version: remote.stateVersion, lastHistoryId: remote.state.history.at(-1)?.id || null })
      $syncStatus.set('conflict')
    } else {
      $sync.set({ ...$sync.get(), version: remote.stateVersion })
      scheduleSync(200)
    }
    return
  }
  if (err.status === 404) {
    // Deleted on the server (e.g. from another device): re-create on next sync.
    $sync.set(emptySync(state.id))
  }
  $syncStatus.set(err.status === 0 ? 'offline' : 'error')
}
