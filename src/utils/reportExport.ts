/**
 * Export utilities for the Report Generation feature.
 *
 * PDF  — jsPDF + jspdf-autotable
 * XLSX — xlsx (already a project dependency)
 */

// ── PDF ───────────────────────────────────────────────────────────────────────

import type { ReportSummary } from '@/services/reportService'

/** Helper: pretty-format a number with thousands separator */
function n(v: number, decimals = 0) {
  return v.toLocaleString('en-IN', { maximumFractionDigits: decimals })
}

/** Build an ISO timestamp label */
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export async function exportToPDF(report: ReportSummary, periodLabel: string) {
  // Dynamically import so the bundle is split
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PAGE_W = 210
  const MARGIN = 14
  const CONTENT_W = PAGE_W - MARGIN * 2

  // ── Header ──────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42)  // slate-900
  doc.rect(0, 0, PAGE_W, 36, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('SMART PORT DIGITAL TWIN', MARGIN, 11)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('JNPA · Navi Mumbai  —  Report Generation', MARGIN, 18)

  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)   // slate-400
  doc.text(`Generated: ${fmtDate(report.generatedAt)}`, MARGIN, 25)
  doc.text(`Period: ${report.reportPeriod}`, MARGIN, 31)

  // Simulated-data banner
  if (report.containsSimulatedData) {
    doc.setFillColor(234, 179, 8)   // amber-500
    doc.rect(0, 36, PAGE_W, 6, 'F')
    doc.setTextColor(30, 27, 12)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text(
      'SIMULATED DATA - Synthetic records do not represent verified JNPA operational figures.',
      PAGE_W / 2, 40, { align: 'center' }
    )
  }

  let y = report.containsSimulatedData ? 50 : 44

  // ── Filters applied ──────────────────────────────────────────────────
  doc.setTextColor(51, 65, 85)    // slate-700
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const filterLines = doc.splitTextToSize(`Filters - Terminal: ${report.terminalFilter} | Trade: ${report.tradeFilter.toUpperCase()} | Status: ${report.statusFilter} | Period: ${periodLabel}`, CONTENT_W)
  doc.text(filterLines, MARGIN, y)
  y += filterLines.length * 4 + 5

  // ── Summary metric boxes ─────────────────────────────────────────────
  const metrics = [
    { label: 'Total Containers', value: n(report.totalContainers) },
    { label: 'Total TEUs',       value: n(report.totalTeus) },
    { label: 'Recorded weight (t)',       value: n(report.totalWeightTonnes, 1) },
    { label: 'Imports',          value: n(report.importCount) },
    { label: 'Exports',          value: n(report.exportCount) },
    { label: 'Transshipment',    value: n(report.transshipmentCount) },
  ]

  const BOX_W = CONTENT_W / 3
  const BOX_H = 18

  metrics.forEach((m, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const bx = MARGIN + col * BOX_W
    const by = y + row * (BOX_H + 2)

    doc.setFillColor(248, 250, 252)   // slate-50
    doc.setDrawColor(226, 232, 240)   // slate-200
    doc.roundedRect(bx, by, BOX_W - 1, BOX_H, 2, 2, 'FD')

    doc.setTextColor(100, 116, 139)   // slate-500
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(m.label, bx + 4, by + 5)

    doc.setTextColor(15, 23, 42)      // slate-900
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(m.value, bx + 4, by + 14)
  })

  y += 2 * (BOX_H + 2) + 6

  // ── Terminal breakdown table ─────────────────────────────────────────
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Terminal Distribution', MARGIN, y)
  y += 4

  const terminalRows = Object.entries(report.byTerminal).map(([term, cnt]) => [
    term,
    n(cnt as number),
    report.totalContainers > 0
      ? ((cnt as number / report.totalContainers) * 100).toFixed(1) + '%'
      : '—',
  ])

  autoTable(doc, {
    startY: y,
    head: [['Terminal', 'Containers', 'Share']],
    body: terminalRows,
    margin: { left: MARGIN, right: MARGIN, bottom: 18 },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8

  // ── Status breakdown table ───────────────────────────────────────────
  if (y > 230) { doc.addPage(); y = 20 }

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Container Status Breakdown', MARGIN, y)
  y += 4

  const statusRows = Object.entries(report.byStatus)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([status, cnt]) => [
      status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      n(cnt as number),
    ])

  autoTable(doc, {
    startY: y,
    head: [['Status', 'Count']],
    body: statusRows,
    margin: { left: MARGIN, right: MARGIN, bottom: 18 },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8

  // ── Container type breakdown ─────────────────────────────────────────
  if (y > 230) { doc.addPage(); y = 20 }

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Container Type Breakdown', MARGIN, y)
  y += 4

  const typeRows = Object.entries(report.byType).map(([type, cnt]) => [
    type,
    n(cnt as number),
    teuLabel(type),
  ])

  autoTable(doc, {
    startY: y,
    head: [['Type', 'Count', 'TEU Factor']],
    body: typeRows,
    margin: { left: MARGIN, right: MARGIN, bottom: 18 },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  // ── Arrival trend table ──────────────────────────────────────────────
  if (report.arrivalTrend.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8
    if (y > 230) { doc.addPage(); y = 20 }

    doc.setTextColor(15, 23, 42)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Arrival Trend (by Date)', MARGIN, y)
    y += 4

    const trendRows = report.arrivalTrend.map(pt => [pt.period, n(pt.count)])

    autoTable(doc, {
      startY: y,
      head: [['Arrival Date', 'Containers']],
      body: trendRows,
      margin: { left: MARGIN, right: MARGIN, bottom: 18 },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })
  }

  // ── Footer on each page ──────────────────────────────────────────────
  doc.addPage()
  autoTable(doc, {
    startY: 20, head: [['Operational context / data quality', 'Value']], body: operationalRows(report),
    margin: { left: MARGIN, right: MARGIN, bottom: 18 },
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 60 } }, headStyles: { fillColor: [15,23,42] },
  })
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setDrawColor(226, 232, 240)
    doc.line(MARGIN, 285, PAGE_W - MARGIN, 285)
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.setFont('helvetica', 'normal')
    doc.text(`Smart Port Digital Twin | JNPA Reference | ${report.containsSimulatedData ? 'Contains simulated data' : 'Provenance not verified'}`, MARGIN, 290)
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN, 290, { align: 'right' })
  }

  doc.save(reportFilename(report, 'pdf'))
}


// ── XLSX ──────────────────────────────────────────────────────────────────────

export async function exportToExcel(report: ReportSummary) {
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()

  // Sheet 1 — Summary
  const summaryData = [
    ['Smart Port Digital Twin — JNPA Report'],
    [''],
    ['Generated At', fmtDate(report.generatedAt)],
    ['Report Period', report.reportPeriod],
    ['Terminal Filter', report.terminalFilter],
    ['Trade Filter', report.tradeFilter.toUpperCase()],
    ['Status Filter', report.statusFilter],
    [''],
    ['Simulated Data', report.containsSimulatedData ? 'YES — figures are synthetic seed data' : 'No'],
    [''],
    ['SUMMARY METRICS', ''],
    ['Total Containers', report.totalContainers],
    ['Total TEUs', report.totalTeus],
    ['Total Weight (tonnes)', report.totalWeightTonnes],
    ['Import Containers', report.importCount],
    ['Export Containers', report.exportCount],
    ['Transshipment Containers', report.transshipmentCount],
    ['Other Status Containers', report.otherCount],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  wsSummary['!cols'] = [{ wch: 35 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  // Sheet 2 — Terminal Breakdown
  const termRows: (string | number)[][] = [['Terminal', 'Containers', 'Share (%)']]
  for (const [term, cnt] of Object.entries(report.byTerminal)) {
    termRows.push([
      term,
      cnt as number,
      report.totalContainers > 0
        ? +((cnt as number / report.totalContainers) * 100).toFixed(2)
        : 0,
    ])
  }
  const wsTerminals = XLSX.utils.aoa_to_sheet(termRows)
  wsTerminals['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsTerminals, 'Terminal Breakdown')

  // Sheet 3 — Trade & Status
  const tradeRows: (string | number)[][] = [
    ['Category', 'Count'],
    ['Import', report.importCount],
    ['Export', report.exportCount],
    ['Transshipment', report.transshipmentCount],
    ['Other', report.otherCount],
    [''],
    ['Status', 'Count'],
    ...Object.entries(report.byStatus)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([s, c]) => [s, c as number]),
  ]
  const wsTrade = XLSX.utils.aoa_to_sheet(tradeRows)
  wsTrade['!cols'] = [{ wch: 25 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsTrade, 'Trade & Status')

  // Sheet 4 — Container Types & Cargo
  const typeRows: (string | number)[][] = [
    ['Container Type', 'Count', 'TEU Factor'],
    ...Object.entries(report.byType).map(([t, c]) => [
      t, c as number, teuLabel(t),
    ]),
    [''],
    ['Cargo Type', 'Count'],
    ...Object.entries(report.byCargo)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([t, c]) => [t, c as number]),
  ]
  const wsTypes = XLSX.utils.aoa_to_sheet(typeRows)
  wsTypes['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsTypes, 'Container Types')

  // Sheet 5 — Arrival Trend
  if (report.arrivalTrend.length > 0) {
    const trendRows: (string | number)[][] = [['Arrival Date', 'Containers']]
    report.arrivalTrend.forEach(pt => trendRows.push([pt.period, pt.count]))
    const wsTrend = XLSX.utils.aoa_to_sheet(trendRows)
    wsTrend['!cols'] = [{ wch: 18 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsTrend, 'Arrival Trend')
  }

  const operations = XLSX.utils.aoa_to_sheet([['Operational context / data quality', 'Value'], ...operationalRows(report)])
  operations['!cols'] = [{ wch: 40 }, { wch: 100 }]
  XLSX.utils.book_append_sheet(wb, operations, 'Operations & Quality')
  XLSX.writeFile(wb, reportFilename(report, 'xlsx'))
}

function teuLabel(type: string): string {
  return type === '20ft' ? '1 TEU' : ['40ft','40ft-HC','45ft-HC'].includes(type) ? '2 TEU' : 'Unknown; excluded'
}
function reportFilename(report: ReportSummary, extension: string) {
  return `JNPA_${report.terminalFilter.replace(/[^a-z0-9_-]/gi,'_')}_${report.generatedAt.replace(/[^0-9]/g,'').slice(0,14)}.${extension}`
}
export function operationalRows(report: ReportSummary): (string | number)[][] {
  const op = report.operations
  const rows: (string | number)[][] = [
    ['Active matching records', op.activeContainers], ['Departed matching records', op.departedContainers],
    ['Selected terminal capacity', op.capacity], ['Cohort utilization (%)', op.utilizationPercent ?? 'Unavailable'],
    ['Status filter', report.statusFilter],
    ...op.yards.map(row => [`Yard ${row.terminal}`, `${row.active} active / ${row.capacity} capacity; ${row.utilizationPercent ?? 'unavailable'}%; ${row.status}`]),
    ...Object.entries(op.quality).map(([key, value]) => [key.replace(/([A-Z])/g,' $1'), value]),
  ]
  const env = op.environment
  rows.push(['Environment timestamp', env?.timestamp ?? 'Unavailable'], ['Environment freshness', op.environmentStale === null ? 'Unknown' : op.environmentStale ? 'Stale/future timestamp' : 'Within 24 hours'])
  if (env) for (const key of ['aqi','pm25','pm10','so2','no2','co','temperature','humidity','windSpeed','visibility','noise'] as const) {
    const reading = env[key]
    if (reading) rows.push([reading.parameter, `${reading.value} ${reading.unit}; ${reading.condition}`])
  }
  Object.entries(report.byCargo).forEach(([key, count]) => rows.push([`Cargo: ${key}`, count]))
  op.notes.forEach((note, i) => rows.push([`Definition / limitation ${i + 1}`, note]))
  return rows
}
