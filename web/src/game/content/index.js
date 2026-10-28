// Normalises system and user/library content into a common pool-item shape.

export * from './challenges'
export * from './whisper'
export * from './luckCards'
export * from './effects'
export * from './missions'
export * from './miniGames'
export * from './drinking'
export * from './gifts'

// Converts an API content item ({ title, body, data: {...} }) into a
// snapshot used inside module configs. The snapshot keeps a sourceId so the
// origin is known, but later edits to the original never change saved games.
export function contentSnapshot(item) {
  return {
    id: `snap-${item.id}`,
    sourceId: item.id,
    title: item.title,
    body: item.body || '',
    category: item.category || '',
    difficulty: item.difficulty || 'medium',
    tags: item.tags || [],
    modes: ['any'],
    custom: true,
    kind: item.kind,
    ...(item.data || {}),
  }
}

// Returns items suitable for the session's mode.
export function filterByMode(items, modeTheme) {
  return items.filter((item) => {
    const modes = item.modes || ['any']
    return modes.includes('any') || modes.includes(modeTheme)
  })
}
