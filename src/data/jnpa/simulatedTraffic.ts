export type TrafficScenario = 'normal' | 'peak' | 'severe'
export const TRAFFIC_SCENARIOS: Record<TrafficScenario, string> = {
  normal: 'Normal Operations', peak: 'Peak Hour', severe: 'Severe Congestion',
}
export const TRAFFIC_LEVELS = [
  { label: 'Low', color: '#16a34a', max: 24 },
  { label: 'Moderate', color: '#eab308', max: 49 },
  { label: 'High', color: '#f97316', max: 74 },
  { label: 'Severe', color: '#dc2626', max: 100 },
] as const

// The browser only displays persisted backend values; no local score generator.
export interface TrafficReading {
  roadId: string
  score: number
  level: string
  color: string
  speed: number | null
  baseline: number | undefined
  speedBasis: string
  generatedAt: string
}
