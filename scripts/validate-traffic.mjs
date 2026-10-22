import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'

const base = process.env.VALIDATION_API_BASE || 'http://localhost:8082/api/v1'
const roads = JSON.parse(readFileSync('jnpa_roads_candidate.geojson', 'utf8')).features
const ids = roads.map(f => f.properties['@id'])
const hash = createHash('sha256').update(readFileSync('jnpa_roads_candidate.geojson')).digest('hex')
function moduleFrom(source, requireModule = () => ({})) {
  const module = { exports: {} }
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  vm.runInNewContext(js, { module, exports: module.exports, require: requireModule, fetch, console })
  return module.exports
}
const constants = moduleFrom(readFileSync('src/data/jnpa/simulatedTraffic.ts', 'utf8'))
const api = moduleFrom(readFileSync('src/services/api.ts', 'utf8').replace('import.meta.env.VITE_API_BASE_URL', JSON.stringify(base)))
const serviceText = readFileSync('src/services/trafficService.ts', 'utf8')
const service = moduleFrom(serviceText, name => name === './api' ? api : constants)
const scenarios = {}
let checks = 0
for (const scenario of ['normal', 'peak', 'severe']) {
  const records = await service.getTrafficRecords(scenario, ids)
  assert.equal(records.size, 2893)
  const raw = await (await fetch(base + '/traffic?scenario=' + scenario)).json()
  for (const row of raw.records) {
    assert.equal(row.sourceSha256, hash)
    assert.deepEqual(row.roadMetadata, roads.find(f => f.properties['@id'] === row.roadId).properties)
    assert.equal(row.id, scenario + ':' + row.roadId)
  }
  scenarios[scenario] = { records, raw }
  checks += 2893 * 3 + 1
}
for (const id of ids) {
  const n = scenarios.normal.records.get(id), p = scenarios.peak.records.get(id), s = scenarios.severe.records.get(id)
  assert.ok(n.score <= p.score && p.score <= s.score)
  checks++
}
const road = await (await fetch(base + '/traffic/road?scenario=peak&roadId=way%2F45096112')).json()
assert.equal(road.score, scenarios.peak.records.get(road.roadId).score)
assert.equal((await fetch(base + '/traffic?scenario=invalid')).status, 400)
assert.equal((await fetch(base + '/traffic/road?roadId=way%2Fmissing')).status, 404)
checks += 3
const fixture = scenarios.normal.raw
const fake = value => moduleFrom(serviceText, name => name === './api' ? { apiFetch: async () => value } : constants)
assert.equal((await fake({ ...fixture, records: [] }).getTrafficRecords('normal', ids)).size, 0)
for (const bad of [
  null, { ...fixture, scenario: 'peak' }, { ...fixture, simulated: false },
  { ...fixture, records: fixture.records.slice(1) },
  { ...fixture, records: [...fixture.records, fixture.records[0]] },
  { ...fixture, records: [{ ...fixture.records[0], score: 101 }] },
  { ...fixture, records: [{ ...fixture.records[0], sourceSha256: 'mismatch' }] },
]) { await assert.rejects(() => fake(bad).getTrafficRecords('normal', ids)); checks++ }
const unavailable = moduleFrom(serviceText, name => name === './api' ? { apiFetch: async () => { throw new Error('offline') } } : constants)
await assert.rejects(() => unavailable.getTrafficRecords('normal', ids), /offline/)
const controller = new AbortController(); controller.abort()
await assert.rejects(() => service.getTrafficRecords('normal', ids, controller.signal))
checks += 3
console.log(JSON.stringify({ result: 'PASS', api: base, checks, persistedScenarios: Object.fromEntries(Object.entries(scenarios).map(([s, v]) => [s, v.records.size])), sourceSha256: hash, frontend: 'Actual apiFetch and traffic service executed against HTTP; invalid/empty/failure/abort cases exercised' }, null, 2))
