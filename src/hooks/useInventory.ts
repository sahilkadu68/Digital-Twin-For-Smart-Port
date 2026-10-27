import { useEffect } from 'react'
import { create } from 'zustand'
import { getAllContainers } from '@/services/containerService'
import { getTerminals } from '@/services/terminalService'
import { apiFetch } from '@/services/api'
import type { Container, YardStats, ContainerStatus } from '@/types/container'
import type { Terminal } from '@/types/terminal'
import type { PortMetrics } from '@/services/dashboardService'
import { occupiesYard } from '@/data/yardAssignments'
export { occupiesYard } from '@/data/yardAssignments'

export interface EquipmentRecord {
  id: string
  equipmentId: string
  terminal: string
  block: string
  type: string
  status: 'active' | 'idle' | 'maintenance'
  utilization: number
  liftsPerHour: number
  simulated?: boolean
}

interface InventoryState {
  containers: Container[]
  terminals: Terminal[]
  equipment: EquipmentRecord[]
  stats: YardStats | null
  metrics: PortMetrics | null
  loading: boolean
  error: string | null
  loadedAt: string | null
}
const useInventoryStore = create<InventoryState>(() => ({
  containers: [], terminals: [], equipment: [], stats: null, metrics: null,
  loading: true, error: null, loadedAt: null,
}))
let pending: Promise<void> | null = null
let generation = 0
window.addEventListener('auth-expired', () => {
  generation++
  pending = null
  useInventoryStore.setState({ containers: [], terminals: [], equipment: [], stats: null, metrics: null, loadedAt: null, error: null, loading: false })
})

export const tradeCategory = (c: Container) => c.tradeCategory?.trim().toLowerCase()
  || (['import', 'export', 'transshipment'].includes(c.status) ? c.status : 'unknown')

export function refreshInventory(): Promise<void> {
  if (pending) return pending
  useInventoryStore.setState({ loading: true, error: null })
  const requestedGeneration = generation
  pending = Promise.all([getAllContainers(), getTerminals(), apiFetch<EquipmentRecord[]>('/equipment')])
    .then(([containers, terminals, equipment]) => {
      if (generation !== requestedGeneration) return
      const byStatus = Object.fromEntries(['import', 'export', 'transshipment', 'gate-in', 'gate-out', 'customs-hold', 'inspection', 'empty', 'loaded'].map(s => [s, 0])) as Record<ContainerStatus, number>
      containers.forEach(c => { const s = c.status?.toLowerCase() as ContainerStatus; byStatus[s] = (byStatus[s] ?? 0) + 1 })
      const totalCapacity = terminals.reduce((n, t) => n + t.yardCapacity, 0)
      const occupied = containers.filter(occupiesYard).length
      const percent = (trade: string) => containers.length ? Math.round(containers.filter(c => tradeCategory(c) === trade).length / containers.length * 1000) / 10 : 0
      const metrics: PortMetrics = { vesselsAtBerth: null, gateIn24h: null, gateOut24h: null, throughputMtd: null,
        importPercent: percent('import'), exportPercent: percent('export'), transshipmentPercent: percent('transshipment') }
      useInventoryStore.setState({ containers, terminals, equipment, metrics, loadedAt: new Date().toISOString(), stats: {
        totalContainers: containers.length, totalCapacity, byStatus,
        utilizationPercent: totalCapacity ? Math.round(occupied / totalCapacity * 1000) / 10 : 0,
      } })
    })
    .catch(e => { if (generation !== requestedGeneration) return; useInventoryStore.setState({ error: e instanceof Error ? e.message : 'Inventory unavailable' }) })
    .finally(() => { if (generation !== requestedGeneration) return; pending = null; useInventoryStore.setState({ loading: false }) })
  return pending
}

export function useInventory() {
  const state = useInventoryStore()
  useEffect(() => {
    const loadedAt = useInventoryStore.getState().loadedAt
    if ((!loadedAt || Date.now() - Date.parse(loadedAt) > 60_000) && !pending) void refreshInventory()
  }, [])
  return { ...state, refetch: refreshInventory }
}
