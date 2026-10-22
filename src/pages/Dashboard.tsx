import { useContainers } from '@/hooks/useContainers'
import { formatUtilization } from '@/utils/formatters'
import KpiCard from '@/features/dashboard/KpiCard'
import DashboardCharts from '@/features/dashboard/DashboardCharts'
import EnvironmentPanel from '@/features/dashboard/EnvironmentPanel'

function InventoryIcon({ kind }: { kind: 'boxes' | 'yard' | 'capacity' | 'utilization' }) {
  const paths = {
    boxes: 'M3 7h18v13H3zM3 7l9-4 9 4M8 10v7m4-7v7m4-7v7',
    yard: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
    capacity: 'M3 20h18M5 16V8m7 8V4m7 12v-6',
    utilization: 'M12 3a9 9 0 109 9h-9zm3 0v6h6',
  }
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round"><path d={paths[kind]} /></svg>
}

export default function DashboardPage() {
  const { stats, terminals, loading, error, refetch } = useContainers()
  if (loading) return <div role="status" className="p-8 text-sm text-text-muted animate-pulse">Loading port inventory…</div>
  if (error) return <div role="alert" className="p-8 space-y-3"><p className="font-semibold text-red-600">Dashboard unavailable</p><p className="text-sm text-text-muted">{error}</p><button onClick={() => void refetch()} className="px-4 py-2 rounded-md bg-accent-primary text-white text-sm">Retry inventory</button></div>
  if (!stats) return <div className="p-8 text-sm text-text-muted">No inventory snapshot available.</div>
  const yardRecords = stats.totalContainers - (stats.byStatus['gate-out'] ?? 0)

  return (
    <div className="p-5 lg:p-6 space-y-5 max-w-[1800px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold tracking-widest uppercase text-accent-primary">JNPA · Inventory overview</p><h1 className="text-2xl font-semibold tracking-tight text-text-primary mt-1">Port at a glance</h1><p className="text-sm text-text-muted mt-1">Shared inventory across {terminals.length} tracked terminals.</p></div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">Simulated data · JNPA reference</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Total Containers" value={stats.totalContainers.toLocaleString('en-IN')} subtitle="All tracked inventory records" icon={<InventoryIcon kind="boxes" />} />
        <KpiCard title="Yard Records" value={yardRecords.toLocaleString('en-IN')} subtitle={`Excludes gate-out · ${stats.byStatus['customs-hold'] ?? 0} on hold`} icon={<InventoryIcon kind="yard" />} />
        <KpiCard title="Stored Capacity" value={stats.totalCapacity.toLocaleString('en-IN')} subtitle="Reference capacity across tracked terminals" icon={<InventoryIcon kind="capacity" />} />
        <KpiCard title="Estimated Utilization" value={formatUtilization(stats.utilizationPercent)} subtitle="Record-based estimate; not measured occupancy" icon={<InventoryIcon kind="utilization" />} accent="success" isUtilization utilizationValue={stats.utilizationPercent} />
      </div>

      <div role="note" className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 font-semibold">i</span>
        <p><strong className="text-slate-800">Inventory snapshot.</strong> Timestamped operational event history is not present in this dataset. Vessel occupancy, gate movements and throughput are unavailable. Utilization uses yard records and stored capacity; schematic slot geometry is not a surveyed occupancy measurement.</p>
      </div>

      <section aria-label="Inventory analytics" className="space-y-3">
        <div className="flex justify-between items-center"><h2 className="text-sm font-semibold text-text-primary">Inventory composition</h2><span className="text-xs text-text-muted">Same shared snapshot</span></div>
        <DashboardCharts stats={stats} />
      </section>

      <section aria-label="Environment readings" className="bg-bg-card border border-border-subtle rounded-xl p-4 lg:p-5 shadow-card"><EnvironmentPanel /></section>
    </div>
  )
}
