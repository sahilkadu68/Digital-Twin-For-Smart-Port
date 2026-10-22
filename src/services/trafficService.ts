import { apiFetch } from './api'
import { TRAFFIC_LEVELS, type TrafficReading, type TrafficScenario } from '@/data/jnpa/simulatedTraffic'

// Pins the preserved source asset to the persisted dataset; matching IDs alone
// must not silently join traffic generated from a different geometry revision.
const SOURCE_SHA256 = '4f115d3293cc7dca3d702f142d8236e044d1106b56b0fef4479a8bdd7724fbcb'
const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

export async function getTrafficRecords(scenario: TrafficScenario, roadIds: readonly string[], signal?: AbortSignal, sourceSha256 = SOURCE_SHA256): Promise<Map<string, TrafficReading>> {
  if (sourceSha256 !== SOURCE_SHA256) throw new Error('Road asset revision differs from the reviewed traffic source. No simulated colors displayed.')
  const data: unknown = await apiFetch(`/traffic?scenario=${encodeURIComponent(scenario)}`, { signal })
  if (!isRecord(data) || data.scenario !== scenario || data.simulated !== true || !Array.isArray(data.records))
    throw new Error('Invalid traffic API response. No simulated colors displayed.')
  const result = new Map<string, TrafficReading>()
  if (data.records.length === 0) return result
  const expected = new Set(roadIds)
  for (const row of data.records) {
    if (!isRecord(row) || typeof row.roadId !== 'string' || !expected.has(row.roadId) || result.has(row.roadId)
      || row.scenario !== scenario || row.simulated !== true || row.sourceSha256 !== SOURCE_SHA256
      || row.modelVersion !== 'shared-vertex-v1' || typeof row.generatedAt !== 'string'
      || typeof row.score !== 'number' || !Number.isInteger(row.score) || row.score < 0 || row.score > 100
      || typeof row.speedBasis !== 'string') throw new Error('Traffic data is incompatible, duplicated or invalid. No simulated colors displayed.')
    const level = TRAFFIC_LEVELS.find(item => (row.score as number) <= item.max)
    if (!level || row.level !== level.label
      || !(row.estimatedSpeedKmh === null || typeof row.estimatedSpeedKmh === 'number' && Number.isFinite(row.estimatedSpeedKmh) && row.estimatedSpeedKmh >= 0)
      || !(row.baselineSpeedKmh === null || typeof row.baselineSpeedKmh === 'number' && Number.isFinite(row.baselineSpeedKmh) && row.baselineSpeedKmh > 0))
      throw new Error('Traffic score, level or speed is invalid.')
    result.set(row.roadId, { roadId: row.roadId, score: row.score, level: level.label, color: level.color,
      speed: row.estimatedSpeedKmh, baseline: row.baselineSpeedKmh ?? undefined,
      speedBasis: row.speedBasis, generatedAt: row.generatedAt })
  }
  if (result.size !== expected.size) throw new Error(`Traffic dataset incomplete: ${result.size}/${expected.size} roads. No simulated colors displayed.`)
  return result
}
