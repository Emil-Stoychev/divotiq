const API_PREFIX = '/api'

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function parseBody(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function statusFallbackMessage(status) {
  if (status === 401) return 'Нужно е да влезете в профила си'
  if (status === 403) return 'Нямате достъп'
  if (status === 404) return 'Не е намерено'
  if (status === 413) return 'Заявката е твърде голяма'
  if (status === 429) return 'Твърде много заявки. Опитайте след малко.'
  if (status === 502 || status === 503 || status === 504) return 'Сървърът временно не е достъпен'
  return `Грешка при заявката (${status || 0})`
}

function extractErrorMessage(data, status) {
  if (data && typeof data === 'object' && typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim()
  }
  return statusFallbackMessage(status)
}

export async function apiFetch(path, options = {}) {
  const url = `${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`
  const headers = { Accept: 'application/json', ...(options.headers || {}) }
  const hasJsonBody = options.body !== undefined && !(options.body instanceof FormData)
  if (hasJsonBody) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(url, {
      credentials: 'include',
      ...options,
      headers,
      body: hasJsonBody ? JSON.stringify(options.body) : options.body,
    })
  } catch {
    throw new ApiError('Няма връзка със сървъра', 0)
  }

  const data = await parseBody(res)
  if (!res.ok) throw new ApiError(extractErrorMessage(data, res.status), res.status, data)
  return data
}

export const get = (path, options) => apiFetch(path, { ...options, method: 'GET' })
export const post = (path, body, options) => apiFetch(path, { ...options, method: 'POST', body })
export const put = (path, body, options) => apiFetch(path, { ...options, method: 'PUT', body })
export const patch = (path, body, options) => apiFetch(path, { ...options, method: 'PATCH', body })
export const del = (path, options) => apiFetch(path, { ...options, method: 'DELETE' })

export function toQuery(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}
