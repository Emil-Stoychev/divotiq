// Seeded PRNG (mulberry32). The seed lives in the session state, so every
// random decision is reproducible and a page reload never re-rolls a result.

export function createRandom(seed) {
  let current = seed >>> 0

  function next() {
    current = (current + 0x6d2b79f5) >>> 0
    let t = current
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function int(maxExclusive) {
    return Math.floor(next() * maxExclusive)
  }

  function pick(items) {
    if (!items.length) return undefined
    return items[int(items.length)]
  }

  function weighted(items, getWeight) {
    const weights = items.map((item) => Math.max(0, Number(getWeight(item)) || 0))
    const total = weights.reduce((sum, w) => sum + w, 0)
    if (total <= 0) return pick(items)
    let roll = next() * total
    for (let i = 0; i < items.length; i += 1) {
      roll -= weights[i]
      if (roll < 0) return items[i]
    }
    return items[items.length - 1]
  }

  function shuffle(items) {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = int(i + 1)
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  return {
    next,
    int,
    pick,
    weighted,
    shuffle,
    seed: () => current,
  }
}

export function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]
  }
  return Math.floor(Math.random() * 4294967296)
}
