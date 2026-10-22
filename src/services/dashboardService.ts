import { apiFetch } from './api'

export interface PortMetrics {
  vesselsAtBerth: number | null
  gateIn24h: number | null
  gateOut24h: number | null
  throughputMtd: number | null
  importPercent: number
  exportPercent: number
  transshipmentPercent: number
}

export interface ThroughputPoint {
  month: string
  teus: number
}

export async function getDashboardSummary(): Promise<PortMetrics> {
  return apiFetch<PortMetrics>('/dashboard/summary')
}

export async function getThroughputTrend(): Promise<ThroughputPoint[]> {
  return apiFetch<ThroughputPoint[]>('/dashboard/throughput-trend')
}
