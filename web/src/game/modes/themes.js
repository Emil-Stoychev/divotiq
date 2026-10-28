// Visual themes. A theme only changes presentation (colours, backdrop effect,
// sound flavour) — never gameplay. Kept in sync with server KnownThemes.

export const THEMES = {
  christmas: { id: 'christmas', name: 'Коледа', backdrop: 'snow', sound: 'bells', swatch: ['#e23b3b', '#1f9d55', '#ffc93c'] },
  birthday: { id: 'birthday', name: 'Рожден ден', backdrop: 'confetti', sound: 'party', swatch: ['#ff5fa2', '#a855f7', '#ffd166'] },
  classic: { id: 'classic', name: 'Класическа', backdrop: 'sparkles', sound: 'classic', swatch: ['#4f8cff', '#7c5cff', '#22d3ee'] },
  drinking: { id: 'drinking', name: 'Парти', backdrop: 'bubbles', sound: 'party', swatch: ['#ff8a1f', '#ffc93c', '#ef4444'] },
  family: { id: 'family', name: 'Семейна', backdrop: 'sparkles', sound: 'classic', swatch: ['#14b8a6', '#f59e0b', '#38bdf8'] },
  custom: { id: 'custom', name: 'Кралска', backdrop: 'sparkles', sound: 'classic', swatch: ['#8b5cf6', '#ec4899', '#ffc93c'] },
  neon: { id: 'neon', name: 'Неон', backdrop: 'sparkles', sound: 'classic', swatch: ['#22d3ee', '#f0abfc', '#a3e635'] },
}

export const THEME_LIST = Object.values(THEMES)

export function getTheme(id) {
  return THEMES[id] || THEMES.classic
}
