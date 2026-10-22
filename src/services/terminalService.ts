import { apiFetch } from './api'
import type { Terminal } from '@/types/terminal'

export async function getTerminals(): Promise<Terminal[]> {
  return apiFetch<Terminal[]>('/terminals')
}

export async function getTerminalByCode(code: string): Promise<Terminal | undefined> {
  try {
    return await apiFetch<Terminal>(`/terminals/${code}`)
  } catch {
    return undefined
  }
}

