import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
const base = process.env.VALIDATION_API_BASE || 'http://localhost:8082/api/v1'
const get = async path => {
  const res = await fetch(base + path)
  assert.equal(res.status, 200, path)
  return res.json()
}
const all = await get('/containers')
const summary = await get('/reports/summary')
const broad = await get('/reports/summary?startDate=2000-01-01&endDate=2030-12-31')
const stats = await get('/containers/stats')
const terminals = await get('/terminals')
assert.equal(summary.totalContainers, all.length)
assert.equal(broad.totalContainers, all.length)
assert.equal(stats.totalContainers, all.length)
assert.equal(stats.utilizationPercent, Math.round(all.filter(c => c.status !== 'gate-out').length / stats.totalCapacity * 1000) / 10)
assert.equal(new Set(all.map(c => c.id)).size, all.length)
let checks = 5
for (const t of terminals) {
  const expected = all.filter(c => c.terminal === t.code).length
  assert.equal((await get(`/containers?terminal=${t.code}`)).length, expected)
  assert.equal((await get(`/reports/summary?terminal=${t.code}`)).totalContainers, expected)
  assert.equal(summary.byTerminal[t.code], expected)
  checks += 3
}
for (const status of new Set(all.map(c => c.status))) {
  assert.equal((await get(`/containers?status=${status}`)).length, all.filter(c => c.status === status).length)
  checks++
}
for (const type of new Set(all.map(c => c.type))) {
  assert.equal((await get(`/containers?type=${type}`)).length, all.filter(c => c.type === type).length)
  checks++
}
for (const trade of ['import', 'export', 'transshipment']) {
  assert.equal((await get(`/reports/summary?trade=${trade}`)).totalContainers, all.filter(c => (c.tradeCategory || c.status) === trade).length)
  checks++
}
for (const day of ['2024-05-01', '2024-07-02']) {
  assert.equal((await get(`/reports/summary?startDate=${day}&endDate=${day}`)).totalContainers, all.filter(c => c.arrivalDate === day).length)
  checks++
}
assert.equal((await get('/reports/summary?startDate=2026-10-01&endDate=2026-10-31')).totalContainers, 0)
for (const qs of ['startDate=bad', 'startDate=2025-01-01&endDate=2024-01-01', 'trade=made-up']) {
  assert.equal((await fetch(base + '/reports/summary?' + qs)).status, 400); checks++
}
for (const c of [all[0], all.at(-1)]) { assert.deepEqual(await get('/containers/' + encodeURIComponent(c.id)), c); checks++ }
assert.equal((await get('/dashboard/summary')).throughputMtd, null)
assert.deepEqual(await get('/dashboard/throughput-trend'), [])
const result = { generatedAt: new Date().toISOString(), api: base, checks: checks + 3, totalContainers: all.length,
  broadRangeTotal: broad.totalContainers, totalTeus: summary.totalTeus, byTerminal: summary.byTerminal,
  totalCapacity: stats.totalCapacity, occupiedRecords: all.filter(c => c.status !== 'gate-out').length,
  utilizationPercent: stats.utilizationPercent, simulated: all.filter(c => c.simulated === true).length }
writeFileSync('docs/api-validation.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
