const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api/v1'

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers)
  const method = (options?.method || 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' })
    if (!response.ok) throw new ApiError('Unable to secure request. Please try again.', response.status)
    const csrf: { token: string; headerName: string } = await response.json()
    headers.set(csrf.headerName, csrf.token)
  }
  if (options?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' })
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('auth-expired'))
    const body = await res.json().catch(() => null)
    const retry = res.headers.get('Retry-After')
    throw new ApiError((body?.message || `Request failed (${res.status}).`) + (retry ? ` Retry in ${retry} seconds.` : ''), res.status)
  }
  if (res.status === 204) return null as T
  return res.json()
}
export { API_BASE, apiFetch }
