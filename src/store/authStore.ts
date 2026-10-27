import { create } from 'zustand'
import { apiFetch } from '@/services/api'

interface AuthState {
  user: { email: string } | null
  ready: boolean
  check: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null, ready: false,
  check: async () => {
    try { set({ user: await apiFetch('/auth/me'), ready: true }) }
    catch { set({ user: null, ready: true }) }
  },
  login: async (email, password) => {
    await apiFetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: email, password }) })
    await get().check()
    if (!get().user) throw new Error('Unable to load your session. Please try again.')
  },
  logout: async () => {
    await apiFetch('/auth/logout', { method: 'POST' })
    window.dispatchEvent(new Event('auth-expired'))
  },
}))
window.addEventListener('auth-expired', () => useAuthStore.setState({ user: null, ready: true }))
