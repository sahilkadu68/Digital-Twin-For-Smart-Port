import type { ReportSummary } from '@/services/reportService'
import type { jsPDF } from 'jspdf'

const NAVY = [15, 36, 56] as const
const TEAL = [0, 120, 129] as const
const number = (value: number, decimals = 0) => value.toLocaleString('en-IN', { maximumFractionDigits: decimals })
const percent = (value: number | null) => value === null ? 'Unavailable' : `${number(value, 1)}%`
const humanize = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ')
const entries = (data: Record<string, number>) => Object.entries(data).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
const ascii = (value: string) => value.replace(/[–—]/g, '-').replace(/µ/g, 'u').replace(/³/g, '3').replace(/°/g, ' deg ').replace(/[^\x20-\x7e\n]/g, ' ')
function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value || 'Not recorded' : date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST'
}
function filename(report: ReportSummary, extension: string) {
  return `JNPA_Operations_${report.terminalFilter.replace(/[^a-z0-9_-]/gi, '_')}_${report.generatedAt.replace(/[^0-9]/g, '').slice(0, 14)}.${extension}`
}
function teuFactor(type: string): number | null {
  return type === '20ft' ? 1 : ['40ft', '40ft-HC', '45ft-HC'].includes(type) ? 2 : null
}

/** Traceable observations only; the backend owns all metric calculations. */
export function reportInsights(report: ReportSummary): string[] {
  const op = report.operations, result: string[] = []
  if (!report.totalContainers) result.push('No inventory records match the selected filters. Zero arrivals do not establish zero port activity.')
  const high = op.yards.filter(row => row.utilizationPercent !== null && row.utilizationPercent >= 85)
  if (high.length) result.push(`Capacity review: ${high.map(row => `${row.terminal} ${percent(row.utilizationPercent)}`).join('; ')}. Review threshold: 85%; at/above capacity: 100%.`)
  const missing = op.yards.filter(row => row.utilizationPercent === null)
  if (missing.length) result.push(`Capacity information unavailable or invalid for ${missing.map(row => row.terminal).join(', ')}; utilization is not inferred.`)
  if (op.utilizationPercent === null && !missing.length) result.push('Overall utilization is unavailable because usable capacity information is incomplete.')
  const quality = Object.entries(op.quality).filter(([, value]) => value > 0)
  if (quality.length) result.push(`Data review: ${quality.map(([key, value]) => `${humanize(key)}: ${number(value)}`).join('; ')}. Counts can overlap and are not summed as unique records.`)
  else result.push('No issues flagged by the implemented quality checks; this does not certify record completeness or physical accuracy.')
  if (!op.environment) result.push('No environmental snapshot available; no current environmental condition is inferred.')
  else if (op.environmentStale === true) result.push('Environmental timestamp is over 24 hours old or more than 5 minutes in the future. Treat readings as reference data.')
  else if (op.environmentStale === null) result.push('Environmental freshness cannot be established from its timestamp.')
  if (report.containsSimulatedData) result.push('Contains simulated inventory. Figures describe the stored model and are not verified JNPA operational performance.')
  return result
}

export function environmentalRows(report: ReportSummary): (string | number)[][] {
  const env = report.operations.environment
  if (!env) return [['No readings recorded', 'Unavailable', '', 'Not assessed']]
  return (['aqi', 'pm25', 'pm10', 'so2', 'no2', 'co', 'temperature', 'humidity', 'windSpeed', 'visibility', 'noise'] as const).map(key => {
    const reading = env[key]
    return reading ? [reading.label || reading.parameter, Number.isFinite(reading.value) ? reading.value : 'Unavailable', reading.unit, reading.condition || 'Not specified']
      : [humanize(key), 'Unavailable', '', 'Not specified']
  })
}
function freshness(report: ReportSummary) {
  return report.operations.environmentStale === null ? 'Unknown' : report.operations.environmentStale ? 'Stale / future timestamp' : 'Within 24 hours'
}
function metrics(report: ReportSummary): [string, number | string, string][] {
  const op = report.operations
  return [['Total containers', report.totalContainers, 'matching records'], ['Active containers', op.activeContainers, 'excludes gate-out'],
    ['Departed containers', op.departedContainers, 'gate-out records'], ['Total TEUs', report.totalTeus, 'project size convention'],
    ['Recorded cargo weight', report.totalWeightTonnes, 'metric tonnes'], ['Yard utilization', percent(op.utilizationPercent), 'filtered cohort estimate'],
    ['Selected yard capacity', op.capacity, 'stored capacity units']]
}

export async function exportToPDF(report: ReportSummary, periodLabel = report.reportPeriod) {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })
  doc.setProperties({ title: 'JNPA Port Operations Report', subject: 'Filtered inventory snapshot; not historical throughput', creator: 'Smart Port Digital Twin' })
  const left = 15, width = 180, bottom = 275
  let y = 25
  const text = (value: string, x: number, at: number, size = 9, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...NAVY)
    doc.text(ascii(value), x, at)
  }
  const ensure = (height: number) => { if (y + height > bottom) { doc.addPage(); y = 26 } }
  const paragraph = (value: string, size = 9) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size)
    const lines = doc.splitTextToSize(ascii(value), width) as string[]
    for (const line of lines) { ensure(5); text(line, left, y, size); y += 4.8 }
    y += 2
  }
  const section = (title: string, description?: string, reserve = 40) => {
    ensure(reserve); text(title, left, y, 12, true); y += 7
    if (description) paragraph(description, 8)
  }
  const table = (head: string[], body: (string | number)[][], numericColumns: number[] = []) => {
    ensure(18)
    autoTable(doc, {
      startY: y, head: [head.map(ascii)], body: body.length ? body.map(row => row.map(cell => typeof cell === 'string' ? ascii(cell) : cell)) : [['No matching records', ...head.slice(1).map(() => '-')]],
      margin: { top: 25, bottom: 22, left, right: left }, showHead: 'everyPage', rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.4, overflow: 'linebreak', textColor: [...NAVY], lineColor: [222, 230, 235], lineWidth: .1 },
      headStyles: { fillColor: [...NAVY], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 248, 250] },
      columnStyles: Object.fromEntries(numericColumns.map(index => [index, { halign: 'right' }])),
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9
  }
  // Vector charts remain sharp in print and require neither a browser canvas nor another library.
  const bars = (data: [string, number][]) => {
    if (!data.length || !data.some(([, value]) => value > 0)) { paragraph('No matching values to chart.', 8); return }
    const shown = data.slice(0, 6)
    if (data.length > 6) shown.push([`Other (${data.length - 6} categories)`, data.slice(6).reduce((sum, [, value]) => sum + value, 0)])
    ensure(shown.length * 7 + 8)
    const max = Math.max(...shown.map(([, value]) => value), 1)
    shown.forEach(([label, value]) => {
      doc.setFontSize(8)
      const labelLines = doc.splitTextToSize(ascii(humanize(label)), 48) as string[]
      // Chart labels may be shortened; the following table retains every full label.
      text(labelLines.length > 1 ? labelLines[0].slice(0, 26) + '...' : labelLines[0], left, y + 3, 8)
      doc.setFillColor(234, 240, 243); doc.rect(left + 51, y, 103, 4.5, 'F')
      doc.setFillColor(...TEAL); doc.rect(left + 51, y, 103 * Math.max(0, value) / max, 4.5, 'F')
      doc.setFontSize(8); doc.text(number(value), left + width, y + 3.5, { align: 'right' }); y += 7
    })
    y += 5
  }
  const distribution = (title: string, data: Record<string, number>, extra?: (key: string) => string) => {
    const rows = entries(data)
    section(title, 'Matching inventory records; chart shows leading categories. Full detail is retained below.', 90)
    bars(rows)
    table(['Category', 'Containers', 'Share of matching records', ...(extra ? ['TEU factor'] : [])], rows.map(([key, count]) => [humanize(key), number(count), report.totalContainers ? percent(count / report.totalContainers * 100) : '-', ...(extra ? [extra(key)] : [])]), [1, 2])
  }

  text('PORT OPERATIONS REPORT', left, y, 19, true); y += 8
  text('SMART PORT DIGITAL TWIN  /  JNPA REFERENCE', left, y, 9); y += 9
  paragraph(`Generated: ${dateLabel(report.generatedAt)} | Reporting period: ${periodLabel}`, 8)
  paragraph(`Filters: Terminal ${report.terminalFilter} | Trade ${report.tradeFilter} | Status ${report.statusFilter}`, 8)
  paragraph(report.containsSimulatedData ? 'SIMULATED DATA - Stored synthetic inventory; not verified JNPA operational figures.' : 'SOURCE PROVENANCE UNVERIFIED - Absence of a simulation flag does not establish operational accuracy.', 8)
  section('Executive summary', 'Current stored inventory filtered by recorded arrival date. Not a historical occupancy or throughput report.', 78)
  const start = y, cardWidth = 43.5
  metrics(report).forEach(([label, value, unit], index) => {
    const x = left + index % 4 * 45.5, top = start + Math.floor(index / 4) * 25
    doc.setFillColor(242, 247, 249); doc.roundedRect(x, top, cardWidth, 22, 1.5, 1.5, 'F')
    doc.setFillColor(...TEAL); doc.rect(x, top, cardWidth, .8, 'F')
    text(label, x + 3, top + 6, 7.5)
    const labelValue = typeof value === 'number' ? number(value, label === 'Recorded cargo weight' ? 1 : 0) : value
    text(labelValue, x + 3, top + 14, labelValue.length > 12 ? 11 : 15, true)
    text(unit, x + 3, top + 19, 6.8)
  })
  y = start + 56
  paragraph(`Trade categories: Import ${number(report.importCount)} | Export ${number(report.exportCount)} | Transshipment ${number(report.transshipmentCount)} | Other ${number(report.otherCount)}.`, 8)
  section('Operational observations', 'Rule-based observations from this snapshot; review flags are not confirmed operational incidents.', 32)
  reportInsights(report).forEach((insight, i) => paragraph(`${i + 1}. ${insight}`, 8.5))

  doc.addPage(); y = 26
  section('Terminal-wise yard utilization', 'Filtered active records / corresponding stored yard capacity. Unknown capacity is not inferred. Review: high >=85%; at/above capacity >=100%.', 45)
  table(['Terminal', 'Active', 'Capacity', 'Utilization', 'Capacity review'], report.operations.yards.map(row => [row.terminal, number(row.active), number(row.capacity), percent(row.utilizationPercent), row.status]), [1, 2, 3])
  distribution('Terminal-wise container distribution', report.byTerminal)
  distribution('Container status', report.byStatus)
  distribution('Container types', report.byType, key => teuFactor(key) === null ? 'Unknown; excluded' : String(teuFactor(key)))
  distribution('Cargo categories', report.byCargo)

  section('Recorded arrival trend', 'Arrivals are grouped by recorded arrival date, not throughput. Chart bins sum consecutive recorded dates; gaps are not filled or inferred.', 100)
  const arrivals = report.arrivalTrend
  if (arrivals.length) {
    const bins: { label: string; count: number }[] = [], step = Math.ceil(arrivals.length / 14)
    for (let i = 0; i < arrivals.length; i += step) {
      const group = arrivals.slice(i, i + step)
      bins.push({ label: group.length === 1 ? group[0].period : `${group[0].period} to ${group[group.length - 1].period}`, count: group.reduce((sum, point) => sum + point.count, 0) })
    }
    const chartY = y, chartHeight = 37, maximum = Math.max(1, ...bins.map(bin => bin.count)), column = width / bins.length
    doc.setDrawColor(190, 204, 211); doc.line(left, chartY + chartHeight, left + width, chartY + chartHeight)
    bins.forEach((bin, index) => {
      const h = chartHeight * bin.count / maximum, x = left + index * column
      doc.setFillColor(...TEAL); doc.rect(x + 1, chartY + chartHeight - h, Math.max(1, column - 2), h, 'F')
      text(String(index + 1), x + column / 2 - 1, chartY + chartHeight + 4, 7)
    })
    y += 48
    paragraph(`Chart peak: ${number(maximum)} arrivals per bin. Bin numbers identify the date ranges below.`, 8)
    table(['Chart bin', 'Recorded date / range', 'Arrivals'], bins.map((bin, index) => [String(index + 1), bin.label, number(bin.count)]), [0, 2])
    table(['Recorded arrival date', 'Containers'], arrivals.map(point => [point.period, number(point.count)]), [1])
  } else paragraph('No valid recorded arrival dates in this cohort.')

  section('Environmental snapshot', 'SIMULATED / UNVERIFIED - Latest port-wide reference readings, independent of inventory filters. Conditions are application display labels, not regulatory certification.', 80)
  paragraph(`Recorded: ${dateLabel(report.operations.environment?.timestamp || '')} | Freshness: ${freshness(report)}`, 8)
  paragraph(`Location: ${report.operations.environment?.location || 'Not recorded'}. Freshness rule: over 24 hours old or more than 5 minutes in the future is flagged.`, 8)
  table(['Parameter', 'Recorded value', 'Unit', 'Stored/display condition'], environmentalRows(report), [1])
  section('Data quality and metric definitions', 'Checks refer to the filtered cohort. Counts can overlap; duplicate groups do not establish duplicate physical containers.', 40)
  table(['Quality check', 'Count'], Object.entries(report.operations.quality).map(([key, count]) => [humanize(key), number(count)]), [1])
  report.operations.notes.forEach((note, i) => paragraph(`${i + 1}. ${note}`, 8))

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    text('JNPA  /  PORT OPERATIONS', left, 11, 8, true)
    doc.setDrawColor(...TEAL); doc.setLineWidth(.6); doc.line(left, 16, left + width, 16)
    doc.setDrawColor(215, 225, 230); doc.setLineWidth(.2); doc.line(left, 281, left + width, 281)
    text(report.containsSimulatedData ? 'SIMULATED INVENTORY | Reference model' : 'Reference model | Provenance unverified', left, 286, 7)
    doc.setFontSize(7); doc.text(`Page ${page} of ${pages}`, left + width, 286, { align: 'right' })
    text(`Generated ${dateLabel(report.generatedAt)}`, left, 291, 6.5)
  }
  doc.save(filename(report, 'pdf'))
}

export async function exportToExcel(report: ReportSummary) {
  const XLSX = await import('xlsx'), wb = XLSX.utils.book_new()
  wb.Props = { Title: 'JNPA Port Operations Report', Author: 'Smart Port Digital Twin', Subject: 'Filtered inventory snapshot', Comments: 'Not historical throughput. Read Operations & Quality definitions.' }
  type Cell = string | number | null
  const addSheet = (name: string, head: string[], body: Cell[][], widths: number[], formats: Record<number, string> = {}) => {
    const rows: Cell[][] = [[`JNPA | ${name}`], [`Generated ${dateLabel(report.generatedAt)} | Period: ${report.reportPeriod}`],
      [`Filters: terminal=${report.terminalFilter}; trade=${report.tradeFilter}; status=${report.statusFilter}`],
      [report.containsSimulatedData ? 'SIMULATED INVENTORY - not verified operational performance' : 'Inventory provenance unverified'], [], head, ...body]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = widths.map(wch => ({ wch }))
    ws['!merges'] = [0, 1, 2, 3].map(r => ({ s: { r, c: 0 }, e: { r, c: head.length - 1 } }))
    ws['!rows'] = rows.map((row, index) => ({ hpt: index < 4 ? (index === 0 ? 26 : 24) : index === 5 ? 26 : Math.min(110, 18 * Math.max(1, ...row.map((cell, col) => Math.ceil(String(cell ?? '').length / Math.max(10, widths[col] || 25))))) }))
    if (body.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ r: 5, c: 0 }, { r: rows.length - 1, c: head.length - 1 }) }
    for (let r = 6; r < rows.length; r++) for (let c = 0; c < head.length; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (cell?.t === 'n') cell.z = formats[c] || '#,##0'
      // All source text is written as a string, never an Excel formula.
    }
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  // SheetJS CE preserves widths, row heights and formats but not arbitrary font/alignment styling.
  // Split long prose into continuation rows so notes remain readable without a styling dependency.
  const proseRows = (rows: Cell[][], limit = 88): Cell[][] => rows.flatMap(row => {
    if (typeof row[1] !== 'string' || row[1].length <= limit) return [row]
    const words = row[1].split(/\s+/), lines: string[] = []
    for (const word of words) {
      if (!lines.length || lines[lines.length - 1].length + word.length + 1 > limit) lines.push(word)
      else lines[lines.length - 1] += ' ' + word
    }
    return lines.map((line, index) => [index ? `${row[0]} (continued)` : row[0], line, index ? '' : row[2]])
  })
  const summary: Cell[][] = metrics(report).map(([label, value, unit]) => [label, label === 'Yard utilization' ? report.operations.utilizationPercent === null ? 'Unavailable' : report.operations.utilizationPercent / 100 : value, unit])
  summary.push(['Import containers', report.importCount, 'matching records'], ['Export containers', report.exportCount, 'matching records'],
    ['Transshipment containers', report.transshipmentCount, 'matching records'], ['Other trade categories', report.otherCount, 'matching records'])
  addSheet('Executive Summary', ['Metric / observation', 'Value', 'Unit / interpretation'], [...summary, ...proseRows(reportInsights(report).map((insight, index) => [`Observation ${index + 1}`, insight, 'Snapshot rule; see definitions']))], [34, 94, 45])
  const summarySheet = wb.Sheets['Executive Summary']
  summarySheet.B11.z = '#,##0.0'
  if (summarySheet.B12.t === 'n') summarySheet.B12.z = '0.0%'
  const stats: Cell[][] = []
  for (const [dimension, data] of [['Terminal', report.byTerminal], ['Trade', { Import: report.importCount, Export: report.exportCount, Transshipment: report.transshipmentCount, Other: report.otherCount }], ['Status', report.byStatus], ['Container type', report.byType], ['Cargo category', report.byCargo]] as const) {
    for (const [label, count] of entries(data)) stats.push([dimension, label, count, report.totalContainers ? count / report.totalContainers : null, dimension === 'Container type' ? teuFactor(label) ?? 'Unknown; excluded' : 'Not applicable'])
  }
  addSheet('Container Statistics', ['Dimension', 'Category', 'Containers', 'Share of matching records', 'TEU factor (types only)'], stats, [22, 40, 20, 28, 26], { 3: '0.0%' })
  addSheet('Terminal Utilization', ['Terminal', 'Active matching records', 'Stored capacity', 'Cohort utilization', 'Capacity review'], report.operations.yards.map(row => [row.terminal, row.active, row.capacity, row.utilizationPercent === null ? null : row.utilizationPercent / 100, row.status]), [20, 27, 24, 24, 45], { 3: '0.0%' })
  addSheet('Environmental Snapshot', ['Parameter / metadata', 'Recorded value', 'Unit', 'Condition / context'], [
    ['Recorded at', report.operations.environment?.timestamp || 'Unavailable', 'ISO timestamp', 'Latest port-wide snapshot; independent of filters'],
    ['Location', report.operations.environment?.location || 'Not recorded', '', 'SIMULATED / UNVERIFIED'],
    ['Freshness', freshness(report), '', '>24h old or >5min in future is flagged'],
    ...environmentalRows(report),
  ], [34, 48, 18, 62], { 1: '#,##0.0' })
  addSheet('Operations & Quality', ['Check / definition', 'Value / explanation', 'Scope'], proseRows([
    ['Active matching records', report.operations.activeContainers, 'Excludes gate-out'],
    ...Object.entries(report.operations.quality).map(([key, count]) => [humanize(key), count, 'Filtered cohort; counts may overlap']),
    ...report.operations.notes.map((note, index) => [`Definition ${index + 1}`, note, 'Backend metric definition']),
  ], 102), [40, 110, 42])
  if (report.arrivalTrend.length) addSheet('Arrival Trend', ['Recorded arrival date', 'Containers'], report.arrivalTrend.map(point => [point.period, point.count]), [30, 26])
  XLSX.writeFile(wb, filename(report, 'xlsx'), { cellStyles: true })
}
