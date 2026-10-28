import { del, get, patch, post, put, toQuery } from './core'

export const contentApi = {
  mine: (params) => get(`/content${toQuery(params)}`),
  favorites: (params) => get(`/content/favorites${toQuery(params)}`),
  library: (params) => get(`/library/content${toQuery(params)}`),
  create: (body) => post('/content', body),
  update: (id, body) => put(`/content/${id}`, body),
  remove: (id) => del(`/content/${id}`),
  copy: (id) => post(`/content/${id}/copy`),
  favorite: (id) => post(`/content/${id}/favorite`),
  report: (id, reason) => post(`/content/${id}/report`, { reason }),
}

export const configsApi = {
  mine: () => get('/configs'),
  library: (params) => get(`/library/configs${toQuery(params)}`),
  get: (id) => get(`/configs/${id}`),
  create: (body) => post('/configs', body),
  update: (id, body) => put(`/configs/${id}`, body),
  remove: (id) => del(`/configs/${id}`),
  duplicate: (id) => post(`/configs/${id}/duplicate`),
}

export const modesApi = {
  mine: () => get('/modes'),
  create: (body) => post('/modes', body),
  update: (id, body) => put(`/modes/${id}`, body),
  remove: (id) => del(`/modes/${id}`),
}

export const playerListsApi = {
  mine: () => get('/player-lists'),
  create: (body) => post('/player-lists', body),
  remove: (id) => del(`/player-lists/${id}`),
}

export const sessionsApi = {
  list: (params) => get(`/sessions${toQuery(params)}`),
  get: (id) => get(`/sessions/${id}`),
  events: (id) => get(`/sessions/${id}/events`),
  create: (body) => post('/sessions', body),
  sync: (id, body) => put(`/sessions/${id}`, body),
  remove: (id) => del(`/sessions/${id}`),
}

export const accountApi = {
  update: (body) => patch('/me', body),
  password: (body) => put('/me/password', body),
  remove: (password) => del('/me', { body: { password } }),
}

export const adminApi = {
  reported: () => get('/admin/reported'),
  moderate: (id, status) => patch(`/admin/content/${id}`, { status }),
}
