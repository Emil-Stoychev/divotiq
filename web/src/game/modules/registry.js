// Module registry. A module is a plain object (see docs/MODULES.md):
//   id, name, description, icon, category, playable,
//   defaultConfig(), validateConfig(config, context), summarizeConfig(config),
//   initState(config, context), start(ctx, params), handle(ctx, activity, name, payload),
//   command?(ctx, name, payload), onTurnStart?(ctx), onFinish?(ctx)
// The engine only talks to modules through this interface, so adding a new
// module never requires touching the engine.

const modules = new Map()

export function registerModule(definition) {
  if (!definition?.id) throw new Error('Module must have an id')
  if (modules.has(definition.id)) throw new Error(`Module "${definition.id}" already registered`)
  modules.set(definition.id, Object.freeze({ playable: true, minPlayers: 2, ...definition }))
}

export function getModule(id) {
  return modules.get(id)
}

export function listModules() {
  return [...modules.values()].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
}

export function hasModule(id) {
  return modules.has(id)
}
