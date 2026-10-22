import { apiFetch } from './api'
import type { EnvironmentSnapshot, TrendPoint } from '@/types/environment'

export async function getEnvironmentSnapshot(): Promise<EnvironmentSnapshot | null> {
  return apiFetch<EnvironmentSnapshot | null>('/environment/current')
}

export async function getAqiTrend(): Promise<TrendPoint[]> {
  return apiFetch<TrendPoint[]>('/environment/trend')
}
