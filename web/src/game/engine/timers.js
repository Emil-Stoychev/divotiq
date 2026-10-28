// Timers are plain data stored in activity state: the remaining time is derived
// from timestamps, so pause/resume and page reloads keep the correct value.

export function createTimer(durationSec) {
  return {
    durationMs: Math.max(1, Math.round(durationSec)) * 1000,
    elapsedMs: 0,
    startedAt: null,
    running: false,
  }
}

export function startTimer(timer, now) {
  if (!timer || timer.running) return timer
  return { ...timer, running: true, startedAt: now }
}

export function pauseTimer(timer, now) {
  if (!timer || !timer.running) return timer
  return {
    ...timer,
    running: false,
    startedAt: null,
    elapsedMs: Math.min(timer.durationMs, timer.elapsedMs + (now - timer.startedAt)),
  }
}

export function elapsedMs(timer, now) {
  if (!timer) return 0
  const live = timer.running ? now - timer.startedAt : 0
  return Math.min(timer.durationMs, timer.elapsedMs + Math.max(0, live))
}

export function remainingMs(timer, now) {
  if (!timer) return 0
  return Math.max(0, timer.durationMs - elapsedMs(timer, now))
}

export function isTimerExpired(timer, now) {
  return Boolean(timer) && remainingMs(timer, now) <= 0
}

export function formatSeconds(ms) {
  const total = Math.ceil(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
