/**
 * API base URL — configured via environment variable.
 * Defaults to http://localhost:8081/api/v1 for local development.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api/v1'

/**
 * Generic fetch wrapper with error handling.
 */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`)
  }
  if (res.status === 204) return null as T
  return res.json()
}

export { API_BASE, apiFetch }
