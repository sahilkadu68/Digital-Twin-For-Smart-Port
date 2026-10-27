import type { EnvironmentSnapshot } from '@/types/environment'
import { apiFetch } from './api'

// ── Types ────────────────────────────────────────────────────────────────────

export interface TrendPoint {
  period: string
  count: number
}

export interface ReportSummary {
  statusFilter: string
  operations: {
    activeContainers: number; departedContainers: number; capacity: number; utilizationPercent: number | null
    yards: { terminal: string; active: number; capacity: number; utilizationPercent: number | null; status: string }[]
    quality: Record<string, number>; environment: EnvironmentSnapshot | null; environmentStale: boolean | null; notes: string[]
  }
  generatedAt: string
  reportPeriod: string
  terminalFilter: string
  tradeFilter: string
  totalContainers: number
  totalTeus: number
  totalWeightTonnes: number
  importCount: number
  exportCount: number
  transshipmentCount: number
  otherCount: number
  byTerminal: Record<string, number>
  byStatus: Record<string, number>
  byType: Record<string, number>
  byCargo: Record<string, number>
  arrivalTrend: TrendPoint[]
  containsSimulatedData: boolean
}

// ── Filters ───────────────────────────────────────────────────────────────────

export interface ReportFilters {
  status?: string
  terminal: string     // 'ALL' or terminal code
  trade: string        // 'ALL' | 'import' | 'export' | 'transshipment'
  startDate: string    // yyyy-MM-dd or ''
  endDate: string      // yyyy-MM-dd or ''
}

// ── Service function ──────────────────────────────────────────────────────────

export async function getReportSummary(filters: ReportFilters): Promise<ReportSummary> {
  const params = new URLSearchParams()
  params.set('terminal', filters.terminal || 'ALL')
  params.set('status', filters.status || 'ALL')
  params.set('trade', filters.trade || 'ALL')
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  return apiFetch<ReportSummary>(`/reports/summary?${params.toString()}`)
}
