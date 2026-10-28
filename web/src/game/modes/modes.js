// Built-in occasions. A mode only *suggests* modules and defaults; it never
// hardcodes the game flow — users can enable/disable any compatible module.

export const BUILT_IN_MODES = [
  {
    key: 'christmas',
    name: 'Коледа',
    description: 'Празнични игри, подаръци и специално настроение',
    icon: '🎄',
    theme: 'christmas',
    suggestedModules: ['wheel', 'challenges', 'whisper', 'gifts', 'luckCards', 'missions'],
    excludedModules: [],
    defaultSettings: { rounds: 5 },
  },
  {
    key: 'birthday',
    name: 'Рожден ден',
    description: 'Празнувай с игри, изненади и много смях',
    icon: '🎂',
    theme: 'birthday',
    suggestedModules: ['wheel', 'challenges', 'gifts', 'luckCards', 'miniGames'],
    excludedModules: [],
    defaultSettings: { rounds: 5 },
  },
  {
    key: 'classic',
    name: 'Стандартен',
    description: 'Класически игри и предизвикателства за всяка компания',
    icon: '🎲',
    theme: 'classic',
    suggestedModules: ['wheel', 'challenges', 'whisper', 'luckCards', 'effects', 'miniGames'],
    excludedModules: [],
    defaultSettings: { rounds: 4 },
  },
  {
    key: 'drinking',
    name: 'Парти с пиене',
    description: 'За пълнолетни — винаги с безалкохолна алтернатива',
    icon: '🍻',
    theme: 'drinking',
    adultsOnly: true,
    suggestedModules: ['wheel', 'challenges', 'drinking', 'luckCards', 'effects'],
    excludedModules: [],
    defaultSettings: { rounds: 5 },
  },
  {
    key: 'family',
    name: 'Семейна вечер',
    description: 'Подходящо за всички възрасти, без алкохол',
    icon: '🏡',
    theme: 'family',
    suggestedModules: ['wheel', 'challenges', 'whisper', 'miniGames', 'gifts'],
    excludedModules: ['drinking'],
    defaultSettings: { rounds: 4 },
  },
  {
    key: 'custom',
    name: 'Свой режим',
    description: 'Създай свой уникален сценарий',
    icon: '👑',
    theme: 'custom',
    suggestedModules: ['wheel', 'challenges', 'luckCards'],
    excludedModules: [],
    defaultSettings: {},
  },
]

export function getBuiltInMode(key) {
  return BUILT_IN_MODES.find((mode) => mode.key === key)
}

// Converts a user's custom mode from the API into the same shape.
export function customModeFromApi(mode) {
  return {
    key: mode.key,
    id: mode.id,
    name: mode.name,
    description: mode.description || 'Твой режим',
    icon: mode.icon || '✨',
    theme: mode.theme,
    suggestedModules: mode.defaultModules || [],
    excludedModules: [],
    defaultSettings: mode.defaultSettings || {},
    isCustom: true,
  }
}
