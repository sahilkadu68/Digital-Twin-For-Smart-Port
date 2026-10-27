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
  : name === 'xlsx' ? { ...xlsx, writeFile: wb => { workbook = xlsx.read(xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' }) } }
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
    assert.ok(text.includes('Active matching records'))
    assert.ok(text.includes('SIMULATED DATA'))
    assert.ok(text.includes('not historical occupancy'))
    await exportToExcel(report)
    assert.ok(workbook.SheetNames.includes('Operations & Quality'))
    const summary = xlsx.utils.sheet_to_json(workbook.Sheets.Summary, { header: 1 })
    assert.ok(summary.some(row => row[0] === 'Total Containers' && row[1] === count))
    const operations = xlsx.utils.sheet_to_json(workbook.Sheets['Operations & Quality'], { header: 1 })
    assert.ok(operations.some(row => row[0] === 'Active matching records' && row[1] === count))
    if (count) assert.equal(xlsx.utils.sheet_to_json(workbook.Sheets['Arrival Trend']).length, count)
    console.log(`PASS: ${count} test arrivals; PDF ${pdf.getNumberOfPages()} pages; XLSX ${workbook.SheetNames.length} sheets; metadata and metrics retained.`)
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
