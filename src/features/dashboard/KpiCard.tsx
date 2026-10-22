import type { ReactNode } from 'react'
import { UTILIZATION_THRESHOLDS } from '@/constants'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  trend?: { value: number; label?: string }
  accent?: 'default' | 'success' | 'warning' | 'danger'
  isUtilization?: boolean
  utilizationValue?: number
}

const ACCENT_ICON_BG: Record<string, string> = {
  default: 'bg-accent-primary/10 text-accent-primary',
  success: 'bg-status-available/10 text-status-available',
  warning: 'bg-status-reserved/10 text-status-reserved',
  danger:  'bg-status-maintenance/10 text-status-maintenance',
}

function getUtilizationColor(pct: number): string {
  if (pct >= UTILIZATION_THRESHOLDS.high)   return 'text-status-maintenance'
  if (pct >= UTILIZATION_THRESHOLDS.medium) return 'text-status-reserved'
  return 'text-status-available'
}

export default function KpiCard({
  title, value, subtitle, icon, trend,
  accent = 'default', isUtilization = false, utilizationValue,
}: KpiCardProps) {
  const pct = utilizationValue ?? 0

  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-5 flex flex-col gap-4 shadow-card min-w-0 h-full">
      {/* Top row */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-text-muted tracking-wide">{title}</p>
        <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${ACCENT_ICON_BG[accent]}`}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <div>
        <p className={`text-3xl font-semibold tracking-tight tabular-nums leading-none ${isUtilization ? getUtilizationColor(pct) : 'text-text-primary'}`}>
          {value}
        </p>
        {subtitle && <p className="text-xs leading-relaxed text-text-muted mt-2 min-h-[2.5em]">{subtitle}</p>}
      </div>

      {/* Utilization bar */}
      {isUtilization && utilizationValue !== undefined && (
        <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden border border-border-subtle">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct >= UTILIZATION_THRESHOLDS.high
                ? 'bg-status-maintenance'
                : pct >= UTILIZATION_THRESHOLDS.medium
                  ? 'bg-status-reserved'
                  : 'bg-status-available'
            }`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}

      {/* Trend */}
      {trend && (
        <div className="flex items-center gap-1">
          <svg
            className={`w-3 h-3 ${trend.value >= 0 ? 'text-status-available' : 'text-status-maintenance'}`}
            fill="currentColor" viewBox="0 0 24 24"
          >
            {trend.value >= 0
              ? <path d="M7 14l5-5 5 5H7z" />
              : <path d="M7 10l5 5 5-5H7z" />}
          </svg>
          <span className={`text-xs ${trend.value >= 0 ? 'text-status-available' : 'text-status-maintenance'}`}>
            {Math.abs(trend.value)}%
          </span>
          {trend.label && <span className="text-xs text-text-muted">{trend.label}</span>}
        </div>
      )}
    </div>
  )
}
