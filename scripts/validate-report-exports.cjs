// In-memory regression tests: actual export code and libraries; no application or database writes.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript')
const jspdf = require('jspdf'), xlsx = require('xlsx')
let pdf, workbook
function TestPDF(...args) {
  const doc = new jspdf.jsPDF(...args)
  doc.save = () => { pdf = doc }
  return doc
}
const customRequire = name => name === 'jspdf' ? { __esModule: true, default: TestPDF }
  : name === 'xlsx' ? { ...xlsx, writeFile: wb => { workbook = xlsx.read(xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', cellNF: true, cellStyles: true }) } }
  : require(name)
const moduleObject = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/reportExport.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, { exports: moduleObject.exports, module: moduleObject, require: customRequire, console, Date })
const { exportToPDF, exportToExcel } = moduleObject.exports
function fixture(count) {
  return { generatedAt: '2026-10-27T12:00:00Z', reportPeriod: 'All dates', terminalFilter: 'ALL', tradeFilter: 'ALL', statusFilter: 'ALL',
    totalContainers: count, totalTeus: count * 2, totalWeightTonnes: count, importCount: count, exportCount: 0, transshipmentCount: 0, otherCount: 0,
    byTerminal: count ? { BMCT: count } : {}, byStatus: count ? { import: count } : {}, byType: count ? { '40ft': count } : {}, byCargo: count ? { general: count } : {},
    arrivalTrend: Array.from({ length: count }, (_, i) => ({ period: `TEST date ${i + 1}`, count: 1 })), containsSimulatedData: true,
    operations: { activeContainers: count, departedContainers: 0, capacity: 1000, utilizationPercent: count / 10,
      yards: [{ terminal: 'BMCT', active: count, capacity: 1000, utilizationPercent: count / 10, status: 'Within capacity' }],
      quality: { invalidWeights: 0 }, environment: null, environmentStale: null,
      notes: ['TEST FIXTURE - not operational data.', 'Utilization is matching active records / selected terminal capacity; not historical occupancy.'] } }
}
;(async () => {
  for (const count of [0, 3, 500]) {
    const report = fixture(count)
    await exportToPDF(report, report.reportPeriod)
    assert.ok(pdf.output('arraybuffer').byteLength > 1000)
    const text = Object.values(pdf.internal.pages).flat().join('\n')
    assert.ok(text.includes('Active containers'))
    assert.ok(text.includes('SIMULATED DATA'))
    assert.ok(text.includes('not historical occupancy'))
    await exportToExcel(report)
    assert.ok(workbook.SheetNames.includes('Operations & Quality'))
    const summary = xlsx.utils.sheet_to_json(workbook.Sheets['Executive Summary'], { header: 1 })
    assert.ok(summary.some(row => row[0] === 'Total containers' && row[1] === count))
    const operations = xlsx.utils.sheet_to_json(workbook.Sheets['Operations & Quality'], { header: 1 })
    assert.ok(operations.some(row => row[0] === 'Active matching records' && row[1] === count))
    if (count) assert.equal(xlsx.utils.sheet_to_json(workbook.Sheets['Arrival Trend'], { range: 5 }).length, count)
    assert.ok(workbook.Sheets['Container Statistics']['!autofilter'] || count === 0)
    assert.ok(workbook.Sheets['Terminal Utilization']['!autofilter'])
    assert.equal(workbook.Sheets['Executive Summary'].B12.z, '0.0%')
    console.log(`PASS: ${count} test arrivals; PDF ${pdf.getNumberOfPages()} pages; XLSX ${workbook.SheetNames.length} sheets; metadata and metrics retained.`)
  }
  const { reportInsights } = moduleObject.exports
  const warning = fixture(2)
  warning.operations.yards[0].utilizationPercent = 110
  warning.operations.yards.push({ terminal: 'UNKNOWN', active: 1, capacity: 0, utilizationPercent: null, status: 'Capacity unavailable' })
  warning.operations.quality.invalidWeights = 1
  warning.operations.environment = { timestamp: '2024-01-01T00:00:00Z' }
  warning.operations.environmentStale = true
  const insights = reportInsights(warning).join(' ')
  assert.ok(insights.includes('110%') && insights.includes('UNKNOWN') && insights.includes('invalid Weights') && insights.includes('24 hours'))
  console.log('PASS: high utilization, missing capacity, data quality and stale environment insights.')
  if (process.env.REPORT_SAMPLE_JSON && process.env.REPORT_SAMPLE_DIR) {
    const path = require('node:path'), target = process.env.REPORT_SAMPLE_DIR
    const report = JSON.parse(fs.readFileSync(process.env.REPORT_SAMPLE_JSON, 'utf8'))
    const before = JSON.stringify(report)
    await exportToPDF(report, report.reportPeriod)
    await exportToExcel(report)
    assert.equal(JSON.stringify(report), before, 'Exports must not mutate the source snapshot')
    fs.mkdirSync(target, { recursive: true })
    fs.writeFileSync(path.join(target, 'JNPA_Port_Operations_Sample.pdf'), Buffer.from(pdf.output('arraybuffer')))
    fs.writeFileSync(path.join(target, 'JNPA_Port_Operations_Sample.xlsx'), xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx', cellStyles: true }))
    assert.ok(xlsx.utils.sheet_to_json(workbook.Sheets['Executive Summary'], { header: 1 }).some(row => row[0] === 'Total containers' && row[1] === report.totalContainers))
    console.log(`SAMPLE: ${report.totalContainers} existing records; PDF ${pdf.getNumberOfPages()} pages; workbook ${workbook.SheetNames.length} sheets. Files saved to ${target}`)
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
