import { useState, useEffect, useCallback } from 'react'
import { getReportSummary, type ReportSummary, type ReportFilters } from '@/services/reportService'
import { exportToPDF, exportToExcel } from '@/utils/reportExport'
import Panel from '@/components/ui/Panel'
import BaseChart from '@/components/charts/BaseChart'
import { CHART_COLORS, CHART_TEXT_COLOR, CHART_GRID_COLOR, CHART_TOOLTIP_STYLE } from '@/constants'
import { useInventory } from '@/hooks/useInventory'
import type { EChartsOption } from 'echarts'

// ── Date helpers ─────────────────────────────────────────────────────────────

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function daysAgo(n: number): string {
  const d = new Date(today() + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-md p-4 flex flex-col gap-1 shadow-panel">
      <p className="text-xs text-text-muted font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</p>
      {sub && <p className="text-2xs text-text-disabled">{sub}</p>}
    </div>
  )
}

function SimulatedBanner() {
  return (
    <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
      <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <span><strong>Contains simulated data.</strong> Synthetic records do not represent verified JNPA transactions.</span>
    </div>
  )
}

// ── Donut Chart (inline, avoids importing DonutChart which may have different props) ──

function SmallDonut({ data, height = 220 }: { data: { name: string; value: number }[]; height?: number }) {
  const colors = Object.values(CHART_COLORS)
  const option: EChartsOption = {
    tooltip: { ...CHART_TOOLTIP_STYLE, trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', left: 'right', top: 'center', textStyle: { color: CHART_TEXT_COLOR, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      data: data.map((d, i) => ({ name: d.name, value: d.value, itemStyle: { color: colors[i % colors.length] } })),
      label: { show: false },
      emphasis: { scale: true, scaleSize: 4 },
    }],
  }
  return <BaseChart option={option} height={height} />
}

// ── Bar chart for trend ───────────────────────────────────────────────────────

function TrendBar({ labels, values, height = 220 }: { labels: string[]; values: number[]; height?: number }) {
  const option: EChartsOption = {
    tooltip: { ...CHART_TOOLTIP_STYLE, trigger: 'axis' },
    grid: { left: 48, right: 12, top: 16, bottom: 52, containLabel: false },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: CHART_TEXT_COLOR, fontSize: 10, rotate: 45 },
      axisLine: { lineStyle: { color: CHART_GRID_COLOR } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: CHART_TEXT_COLOR, fontSize: 10 },
      splitLine: { lineStyle: { color: CHART_GRID_COLOR } },
    },
    series: [{
      type: 'bar',
      data: values,
      itemStyle: { color: CHART_COLORS.blue, borderRadius: [3, 3, 0, 0] },
      barMaxWidth: 40,
    }],
  }
  return <BaseChart option={option} height={height} />
}

// ── Main breakdown table ──────────────────────────────────────────────────────

function BreakdownTable({ title, rows, total }: {
  title: string
  rows: [string, number][]
  total: number
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">{title}</h4>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-bg-elevated">
            <th className="px-3 py-2 text-left text-text-muted font-medium">Category</th>
            <th className="px-3 py-2 text-right text-text-muted font-medium">Count</th>
            <th className="px-3 py-2 text-right text-text-muted font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, count], i) => (
            <tr key={label} className={i % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-elevated'}>
              <td className="px-3 py-1.5 text-text-primary capitalize">{label.replace(/-/g, ' ')}</td>
              <td className="px-3 py-1.5 text-right text-text-primary font-mono">{count.toLocaleString('en-IN')}</td>
              <td className="px-3 py-1.5 text-right text-text-secondary">
                {total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Summary text ─────────────────────────────────────────────────────────────

function buildSummaryText(r: ReportSummary): string {
  const total = r.totalContainers
  if (total === 0) return 'No containers found for the selected filters and period.'

  const topTerminalEntry = Object.entries(r.byTerminal).sort((a, b) => (b[1] as number) - (a[1] as number))[0]
  const topTerminal = topTerminalEntry ? `${topTerminalEntry[0]} (${(((topTerminalEntry[1] as number) / total) * 100).toFixed(0)}%)` : '—'

  const importPct  = total > 0 ? ((r.importCount  / total) * 100).toFixed(0) : '0'
  const exportPct  = total > 0 ? ((r.exportCount  / total) * 100).toFixed(0) : '0'
  const tsPct      = total > 0 ? ((r.transshipmentCount / total) * 100).toFixed(0) : '0'

  return `The report covers ${total.toLocaleString('en-IN')} containers (${r.totalTeus.toLocaleString('en-IN')} TEUs) across the selected period. ` +
    `Trade mix: Import ${importPct}%, Export ${exportPct}%, Transshipment ${tsPct}%. ` +
    `Highest volume terminal: ${topTerminal}. ` +
    `Total cargo weight: ${r.totalWeightTonnes.toLocaleString('en-IN')} tonnes.`
}

// ── Period presets ────────────────────────────────────────────────────────────

const PERIOD_PRESETS = [
  { label: 'All Dates', value: 'all' },
  { label: 'Last 7 Days',  value: 'week' },
  { label: 'Last 30 Days', value: 'month' },
  { label: 'Custom',     value: 'custom' },
] as const

type PeriodPreset = typeof PERIOD_PRESETS[number]['value']

function resolvePresetDates(preset: PeriodPreset): { startDate: string; endDate: string } {
  if (preset === 'week')  return { startDate: daysAgo(6),  endDate: today() }
  if (preset === 'month') return { startDate: daysAgo(29), endDate: today() }
  return { startDate: '', endDate: '' }
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { terminals, error: inventoryError } = useInventory()
  const [preset, setPreset]     = useState<PeriodPreset>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [terminal,  setTerminal]  = useState('ALL')
  const [trade,     setTrade]     = useState('ALL')

  const [report,    setReport]    = useState<ReportSummary | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null)

  const fetchReport = useCallback(async () => {
    setReport(null)
    setLoading(true)
    setError(null)
    const filters: ReportFilters = {
      terminal,
      trade,
      startDate: preset !== 'custom' ? resolvePresetDates(preset).startDate : startDate,
      endDate:   preset !== 'custom' ? resolvePresetDates(preset).endDate   : endDate,
    }
    try {
      if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) throw new Error('Start date must not exceed end date.')
      const data = await getReportSummary(filters)
      setReport(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [terminal, trade, preset, startDate, endDate])

  // Auto-fetch on mount
  useEffect(() => { fetchReport() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportPDF = async () => {
    if (!report) return
    setExporting('pdf')
    try { await exportToPDF(report, report.reportPeriod) }
    finally { setExporting(null) }
  }

  const handleExportExcel = async () => {
    if (!report) return
    setExporting('xlsx')
    try { await exportToExcel(report) }
    finally { setExporting(null) }
  }

  const effectiveStart = preset !== 'custom' ? resolvePresetDates(preset).startDate : startDate
  const effectiveEnd   = preset !== 'custom' ? resolvePresetDates(preset).endDate   : endDate

  // ── Trend data ──────────────────────────────────────────────────────
  const trendLabels = report?.arrivalTrend.map(p => p.period) ?? []
  const trendValues = report?.arrivalTrend.map(p => p.count) ?? []

  // ── Donut data ──────────────────────────────────────────────────────
  const tradeDonut = report ? [
    { name: 'Import',       value: report.importCount },
    { name: 'Export',       value: report.exportCount },
    { name: 'Transshipment',value: report.transshipmentCount },
    { name: 'Other',        value: report.otherCount },
  ].filter(d => d.value > 0) : []

  const terminalDonut = report
    ? Object.entries(report.byTerminal)
        .map(([name, value]) => ({ name, value: value as number }))
    : []

  const typeDonut = report
    ? Object.entries(report.byType)
        .map(([name, value]) => ({ name, value: value as number }))
    : []

  return (
    <div className="p-5 space-y-5 h-[calc(100vh-theme(spacing.topbar))] flex flex-col overflow-y-auto">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-end justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Report Generation</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Generate operational snapshots from the live MongoDB container dataset.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            disabled={!report || loading || exporting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-red-200 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting === 'pdf' ? (
              <span className="animate-spin w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={!report || loading || exporting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-green-200 bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting === 'xlsx' ? (
              <span className="animate-spin w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            Export Excel
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <Panel title="Report Filters" padding="md" className="shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Period preset */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Report Period</label>
            <div className="flex gap-1">
              {PERIOD_PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium border transition-colors ${
                    preset === p.value
                      ? 'bg-accent-primary text-white border-accent-primary'
                      : 'bg-bg-elevated text-text-secondary border-border-subtle hover:border-accent-primary/50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range (shown always, editable only for Custom) */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Start Date</label>
            <input
              type="date"
              value={preset === 'custom' ? startDate : effectiveStart}
              onChange={e => { setStartDate(e.target.value); setEndDate(effectiveEnd); setPreset('custom') }}
              className="w-full px-2.5 py-1.5 rounded border border-border-subtle bg-bg-elevated text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">End Date</label>
            <input
              type="date"
              value={preset === 'custom' ? endDate : effectiveEnd}
              onChange={e => { setEndDate(e.target.value); setStartDate(effectiveStart); setPreset('custom') }}
              className="w-full px-2.5 py-1.5 rounded border border-border-subtle bg-bg-elevated text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
            />
          </div>

          {/* Terminal */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Terminal</label>
            <select
              value={terminal}
              onChange={e => setTerminal(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-border-subtle bg-bg-elevated text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
            >
              <option value="ALL">All Terminals</option>
              {terminals.map(t => <option key={t.code} value={t.code}>{t.code}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2 — trade filter + generate button */}
        <div className="mt-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Trade / Category</label>
            <div className="flex gap-1">
              {(['ALL', 'import', 'export', 'transshipment'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTrade(t)}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors capitalize ${
                    trade === t
                      ? 'bg-accent-primary text-white border-accent-primary'
                      : 'bg-bg-elevated text-text-secondary border-border-subtle hover:border-accent-primary/50'
                  }`}
                >
                  {t === 'ALL' ? 'All' : t}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded bg-accent-primary text-white text-xs font-semibold hover:bg-accent-primary/90 transition-colors disabled:opacity-60"
          >
            {loading ? (
              <><span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" /> Generating…</>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generate Report
              </>
            )}
          </button>
        </div>
      </Panel>

      {/* ── Error state ── */}
      {(error || inventoryError) && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error || inventoryError}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 rounded-md bg-bg-elevated animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Report content ── */}
      {report && !loading && !error && (
        <div className="space-y-5">

          {/* Simulated banner */}
          {report.containsSimulatedData && <SimulatedBanner />}

          {/* Summary text */}
          <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-900 leading-relaxed">
            <strong className="font-semibold">Summary:</strong> {buildSummaryText(report)}
            <div className="mt-1 text-blue-500 text-2xs">
              Generated: {new Date(report.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
              &nbsp;·&nbsp; Period: {report.reportPeriod}
            </div>
          </div>

          {report.totalContainers === 0 && <p role="status" className="text-sm text-text-muted">No inventory records match these filters. Try All Dates; seeded records may be historical.</p>}
          <p className="text-xs text-text-muted">Current inventory grouped by recorded arrival date; this is not historical throughput or gate movement history.</p>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Total Containers" value={report.totalContainers} />
            <MetricCard label="Total TEUs" value={report.totalTeus} sub="20ft=1, 40ft=2 TEU" />
            <MetricCard label="Weight (t)" value={report.totalWeightTonnes.toLocaleString('en-IN', { maximumFractionDigits: 0 })} sub="tonnes (gross)" />
            <MetricCard label="Import" value={report.importCount} sub={`${report.totalContainers > 0 ? ((report.importCount / report.totalContainers) * 100).toFixed(0) : 0}% of total`} />
            <MetricCard label="Export" value={report.exportCount} sub={`${report.totalContainers > 0 ? ((report.exportCount / report.totalContainers) * 100).toFixed(0) : 0}% of total`} />
            <MetricCard label="Transshipment" value={report.transshipmentCount} sub={`${report.totalContainers > 0 ? ((report.transshipmentCount / report.totalContainers) * 100).toFixed(0) : 0}% of total`} />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Panel title="Trade Breakdown" subtitle="Import / Export / Transshipment">
              {tradeDonut.length > 0
                ? <SmallDonut data={tradeDonut} />
                : <div className="h-48 flex items-center justify-center text-text-disabled text-xs">No data</div>
              }
            </Panel>

            <Panel title="Terminal Distribution" subtitle="Containers per terminal">
              {terminalDonut.length > 0
                ? <SmallDonut data={terminalDonut} />
                : <div className="h-48 flex items-center justify-center text-text-disabled text-xs">No data</div>
              }
            </Panel>

            <Panel title="Container Type Mix" subtitle="20ft / 40ft / HC">
              {typeDonut.length > 0
                ? <SmallDonut data={typeDonut} />
                : <div className="h-48 flex items-center justify-center text-text-disabled text-xs">No data</div>
              }
            </Panel>
          </div>

          {/* Arrival trend */}
          {trendLabels.length > 0 && (
            <Panel
              title="Arrival Trend"
              subtitle={`Containers by recorded arrival date (${trendLabels.length} date${trendLabels.length > 1 ? 's' : ''})`}
            >
              <TrendBar labels={trendLabels} values={trendValues} height={220} />
            </Panel>
          )}

          {/* Breakdown tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <Panel title="Terminal Breakdown" padding="sm">
              <BreakdownTable
                title="Containers per terminal"
                rows={Object.entries(report.byTerminal)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .map(([k, v]) => [k, v as number])}
                total={report.totalContainers}
              />
            </Panel>

            <Panel title="Status Breakdown" padding="sm">
              <BreakdownTable
                title="Containers per operational status"
                rows={Object.entries(report.byStatus)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .map(([k, v]) => [k, v as number])}
                total={report.totalContainers}
              />
            </Panel>

            <Panel title="Cargo Type Breakdown" padding="sm">
              <BreakdownTable
                title="Containers per cargo category"
                rows={Object.entries(report.byCargo)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .map(([k, v]) => [k, v as number])}
                total={report.totalContainers}
              />
            </Panel>
          </div>

        </div>
      )}

      {/* Empty state */}
      {!report && !loading && !error && (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          Set filters and click <strong className="mx-1">Generate Report</strong> to begin.
        </div>
      )}
    </div>
  )
}
