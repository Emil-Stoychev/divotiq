// Tiny WebAudio synth — no audio files needed. Every call is a no-op when the
// user disabled sound or the browser blocks audio.
import { $settings } from '@store/settings'

let audioContext = null

function context() {
  if (!$settings.get().sound) return null
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)()
    if (audioContext.state === 'suspended') audioContext.resume()
    return audioContext
  } catch {
    return null
  }
}

function tone(freq, { start = 0, duration = 0.12, type = 'sine', gain = 0.12 } = {}) {
  const ctx = context()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  const t0 = ctx.currentTime + start
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(amp).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

const flavours = {
  bells: [1046, 1318, 1568],
  party: [784, 988, 1175],
  classic: [659, 880, 1046],
}

export const sound = {
  tick: () => tone(1400, { duration: 0.03, type: 'square', gain: 0.03 }),
  click: () => tone(520, { duration: 0.05, type: 'triangle', gain: 0.06 }),
  success(theme = 'classic') {
    const notes = flavours[theme === 'christmas' ? 'bells' : theme === 'birthday' || theme === 'drinking' ? 'party' : 'classic']
    notes.forEach((f, i) => tone(f, { start: i * 0.09, duration: 0.22, type: 'triangle', gain: 0.1 }))
  },
  fail: () => {
    tone(330, { duration: 0.18, type: 'sawtooth', gain: 0.05 })
    tone(247, { start: 0.15, duration: 0.3, type: 'sawtooth', gain: 0.05 })
  },
  reveal: () => {
    tone(523, { duration: 0.1, type: 'sine', gain: 0.08 })
    tone(784, { start: 0.08, duration: 0.25, type: 'sine', gain: 0.08 })
  },
  fanfare: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, { start: i * 0.12, duration: 0.24, type: 'triangle', gain: 0.1 })),
  alarm: () => [880, 660, 880, 660].forEach((f, i) => tone(f, { start: i * 0.16, duration: 0.14, type: 'square', gain: 0.05 })),
}
