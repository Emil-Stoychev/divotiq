import { createRouter, getPagePath, openPage } from '@nanostores/router'

export const router = createRouter({
  home: '/',
  setup: '/new',
  setupStep: '/new/:step',
  play: '/play',
  summary: '/play/summary',
  library: '/library',
  preset: '/game/:id',
  login: '/login',
  register: '/register',
  dashboard: '/my',
  myContent: '/my/content',
  myModes: '/my/modes',
  history: '/my/history/:id',
  account: '/account',
})

export const PROTECTED_ROUTES = new Set(['dashboard', 'myContent', 'myModes', 'history', 'account'])

export function go(route, params, search) {
  openPage(router, route, params, search)
}

export function pathTo(route, params) {
  return getPagePath(router, route, params)
}
