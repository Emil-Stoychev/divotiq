// Content kinds shared by "My content", the library and module config panels.
// Field specs mirror server/services/content_schema.go (the server is the
// authority; these only drive the forms).

import { createId } from '../engine/ids'
import { LUCK_EFFECTS } from '../modules/luckCards'
import { RARITIES } from '../modules/shared'
import { contentSnapshot } from './index'

const rarityOptions = RARITIES.map((r) => ({ value: r.id, label: r.label }))
const luckOptions = Object.entries(LUCK_EFFECTS).map(([value, effect]) => ({ value, label: effect.label }))

export const CONTENT_KINDS = {
  challenge: {
    label: 'Предизвикателство',
    plural: 'Предизвикателства',
    icon: '🎯',
    moduleId: 'challenges',
    bodyLabel: 'Задача',
    bodyRequired: true,
    fields: [
      { key: 'durationSec', label: 'Време (сек., 0 = без таймер)', type: 'int', min: 0, max: 600, default: 30 },
      { key: 'points', label: 'Точки', type: 'int', min: 0, max: 10, default: 2 },
      { key: 'minPlayers', label: 'Минимум играчи', type: 'int', min: 1, max: 20, default: 2 },
      { key: 'ongoing', label: 'Продължаващ ефект', type: 'bool', default: false },
      { key: 'ongoingTurns', label: 'Колко хода трае', type: 'int', min: 1, max: 10, default: 1, showIf: (d) => d.ongoing },
    ],
  },
  whisper_phrase: { label: 'Whisper фраза', plural: 'Whisper фрази', icon: '🎧', moduleId: 'whisper', titleLabel: 'Фраза', noBody: true, fields: [] },
  luck_card: {
    label: 'Карта късмет',
    plural: 'Карти късмет',
    icon: '🍀',
    moduleId: 'luckCards',
    bodyLabel: 'Текст на картата',
    fields: [
      { key: 'effect', label: 'Ефект', type: 'enum', options: luckOptions, default: 'bonus_points' },
      { key: 'value', label: 'Стойност (точки / брой)', type: 'int', min: 0, max: 10, default: 1 },
      { key: 'rarity', label: 'Рядкост', type: 'enum', options: rarityOptions, default: 'common' },
    ],
  },
  effect: {
    label: 'Ефект',
    plural: 'Ефекти',
    icon: '🌀',
    moduleId: 'effects',
    bodyLabel: 'Правило',
    bodyRequired: true,
    fields: [{ key: 'turns', label: 'Продължителност (ходове)', type: 'int', min: 1, max: 10, default: 1 }],
  },
  mission: {
    label: 'Тайна мисия',
    plural: 'Тайни мисии',
    icon: '🕵️',
    moduleId: 'missions',
    bodyLabel: 'Мисия',
    bodyRequired: true,
    fields: [{ key: 'points', label: 'Точки', type: 'int', min: 0, max: 10, default: 3 }],
  },
  trivia: {
    label: 'Въпрос',
    plural: 'Въпроси',
    icon: '🧠',
    moduleId: 'miniGames',
    titleLabel: 'Въпрос',
    noBody: true,
    fields: [{ key: 'options', label: 'Отговори', type: 'options', default: ['', '', ''] }],
  },
  charades: { label: 'Пантомима', plural: 'Пантомими', icon: '🎭', moduleId: 'miniGames', titleLabel: 'Какво се показва', noBody: true, fields: [] },
  song: {
    label: 'Песен',
    plural: 'Песни',
    icon: '🎵',
    moduleId: 'miniGames',
    titleLabel: 'Песен',
    noBody: true,
    fields: [{ key: 'artist', label: 'Изпълнител', type: 'text', max: 80, default: '' }],
  },
  drawing: { label: 'Рисунка', plural: 'Рисунки', icon: '🎨', moduleId: 'miniGames', titleLabel: 'Какво се рисува', noBody: true, fields: [] },
  word_game: {
    label: 'Бързи думи',
    plural: 'Бързи думи',
    icon: '⚡',
    moduleId: 'miniGames',
    titleLabel: 'Категория',
    bodyLabel: 'Обяснение',
    fields: [
      { key: 'targetCount', label: 'Колко неща', type: 'int', min: 1, max: 20, default: 5 },
      { key: 'durationSec', label: 'Време (сек.)', type: 'int', min: 5, max: 300, default: 20 },
    ],
  },
  drinking: {
    label: 'Шот',
    plural: 'Шотове',
    icon: '🥃',
    moduleId: 'drinking',
    bodyLabel: 'Действие',
    fields: [
      { key: 'alternative', label: 'Безалкохолна алтернатива', type: 'text', min: 2, max: 200, default: '', required: true },
      { key: 'sips', label: 'Глътки', type: 'int', min: 1, max: 5, default: 1 },
    ],
  },
  gift: {
    label: 'Подарък',
    plural: 'Подаръци',
    icon: '🎁',
    moduleId: 'gifts',
    titleLabel: 'Подарък',
    bodyLabel: 'Описание',
    fields: [
      { key: 'rarity', label: 'Рядкост', type: 'enum', options: rarityOptions, default: 'common' },
      { key: 'mystery', label: 'Мистериозна кутия', type: 'bool', default: false },
    ],
  },
  wheel_preset: { label: 'Колело', plural: 'Колела', icon: '🎡', moduleId: 'wheel', bodyLabel: 'Описание', fields: [], special: 'segments' },
}

export const CONTENT_KIND_LIST = Object.entries(CONTENT_KINDS).map(([id, kind]) => ({ id, ...kind }))

export const MINI_GAME_KIND_TO_GAME = { charades: 'charades', song: 'song', drawing: 'drawing', trivia: 'trivia', word_game: 'wordGame' }

export function kindsForModule(moduleId) {
  return CONTENT_KIND_LIST.filter((kind) => kind.moduleId === moduleId).map((kind) => kind.id)
}

export function defaultData(kindId) {
  const kind = CONTENT_KINDS[kindId]
  const data = {}
  for (const field of kind?.fields || []) data[field.key] = structuredClone(field.default)
  if (kindId === 'trivia') data.answerIndex = 0
  return data
}

// Client-side checks so the form can explain problems before the request;
// the server repeats every check.
export function validateContent(item) {
  const errors = {}
  const kind = CONTENT_KINDS[item.kind]
  if (!kind) return { kind: 'Изберете тип' }
  const title = item.title?.trim() || ''
  if (title.length < 2) errors.title = 'Поне 2 символа'
  if (title.length > 120) errors.title = 'Максимум 120 символа'
  if (kind.bodyRequired && (item.body?.trim() || '').length < 3) errors.body = 'Опишете съдържанието'
  if ((item.body || '').length > 600) errors.body = 'Максимум 600 символа'
  for (const field of kind.fields) {
    const value = item.data?.[field.key]
    if (field.type === 'int' && (!Number.isInteger(value) || value < field.min || value > field.max)) {
      errors[field.key] = `Между ${field.min} и ${field.max}`
    }
    if (field.type === 'text' && field.required && (value?.trim() || '').length < (field.min || 1)) errors[field.key] = 'Задължително поле'
  }
  if (item.kind === 'trivia') {
    const options = (item.data.options || []).map((o) => o.trim())
    if (options.length < 2 || options.some((o) => !o)) errors.options = 'Попълнете поне 2 отговора без празни'
    if (!(item.data.answerIndex >= 0 && item.data.answerIndex < options.length)) errors.options = 'Маркирайте верния отговор'
  }
  if (item.kind === 'wheel_preset' && (item.data?.segments || []).length < 2) errors.segments = 'Поне 2 сегмента'
  return errors
}

// API / local content item -> the item shape a module config stores.
export function toModuleItem(item) {
  const source = item.id ? item : { ...item, id: createId('local') }
  if (source.kind === 'gift') {
    return {
      id: `snap-${source.id}`,
      sourceId: source.id,
      name: source.title,
      description: source.body || '',
      rarity: source.data?.rarity || 'common',
      mystery: Boolean(source.data?.mystery),
      type: 'physical',
    }
  }
  const snapshot = contentSnapshot(source)
  if (source.kind === 'song' && source.data?.artist) snapshot.body = source.data.artist
  return snapshot
}
