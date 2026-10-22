import { apiFetch } from './api'
import type { Container, ContainerFilter, YardStats } from '@/types/container'

/**
 * Container service — fetches data from the Spring Boot backend.
 * Errors propagate to the shared inventory loading state.
 */

export async function getAllContainers(): Promise<Container[]> {
  return apiFetch<Container[]>('/containers')
}

export async function getContainerById(id: string): Promise<Container | undefined> {
  try {
    return await apiFetch<Container>(`/containers/${id}`)
  } catch {
    return undefined
  }
}

export async function getContainerByNumber(query: string): Promise<Container | undefined> {
  const results = await apiFetch<Container[]>(`/containers?search=${encodeURIComponent(query)}`)
  const exact = results.filter(c => c.containerNumber.toLowerCase() === query.trim().toLowerCase())
  if (exact.length > 1) throw new Error('Multiple records share this container number; select a record by ID.')
  return exact[0]
}

export async function getContainersByStatus(status: string): Promise<Container[]> {
  return apiFetch<Container[]>(`/containers?status=${encodeURIComponent(status)}`)
}

export async function getContainersByTerminal(terminal: string): Promise<Container[]> {
  return apiFetch<Container[]>(`/containers?terminal=${encodeURIComponent(terminal)}`)
}

export async function getFilteredContainers(filter: ContainerFilter): Promise<Container[]> {
  const params = new URLSearchParams()
  if (filter.status !== 'all') params.set('status', filter.status)
  if (filter.type !== 'all') params.set('type', filter.type)
  if (filter.terminal !== 'all') params.set('terminal', filter.terminal)
  if (filter.searchQuery.trim()) params.set('search', filter.searchQuery.trim())

  const qs = params.toString()
  return apiFetch<Container[]>(`/containers${qs ? '?' + qs : ''}`)
}

export async function getYardStats(): Promise<YardStats> {
  return apiFetch<YardStats>('/containers/stats')
}
