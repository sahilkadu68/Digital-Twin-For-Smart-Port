import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import { Control, DomEvent, DomUtil, Polyline, canvas, geoJSON, type GeoJSON, type LatLngBounds, type LatLngBoundsLiteral, type LeafletMouseEvent, type PathOptions, type StyleFunction } from 'leaflet'
import type { Feature, FeatureCollection, LineString, MultiLineString, Position } from 'geojson'
import roadsUrl from '../../../jnpa_roads_candidate.geojson?url'
import { INSPECTION_SCOPE_BOUNDS, intersectsInspectionScope, type RoadDisplayMode } from '@/data/jnpa/roadDisplayScope'
import { TRAFFIC_LEVELS, TRAFFIC_SCENARIOS, type TrafficReading, type TrafficScenario } from '@/data/jnpa/simulatedTraffic'
import { getTrafficRecords } from '@/services/trafficService'

type RoadGeometry = LineString | MultiLineString
type RoadProperties = Record<string, unknown> | null
type RoadFeature = Feature<RoadGeometry, RoadProperties>
type RoadNetwork = {
  data: FeatureCollection<RoadGeometry, RoadProperties>
  portFeatures: RoadFeature[]
  sourceCount: number
  unsupportedCount: number
  bounds: LatLngBoundsLiteral
  sourceSha256: string | null
}
type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; network: RoadNetwork }
  | { kind: 'error'; message: string }

const ROAD_PANE = 'osm-road-network'
const MAJOR_ROADS = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link'])
const CONNECTOR_ROADS = new Set(['secondary', 'secondary_link', 'tertiary', 'tertiary_link'])
const MAJOR_STYLE: PathOptions = { color: '#b45309', weight: 3.5, opacity: 0.95 }
const CONNECTOR_STYLE: PathOptions = { color: '#0e7490', weight: 2.5, opacity: 0.9 }
const LOCAL_STYLE: PathOptions = { color: '#526477', weight: 1.4, opacity: 0.8 }
// Page-local asset cache: StrictMode and revisiting the map reuse the same request/data.
// This has no connection to inventory, API services or MongoDB.
let networkRequest: Promise<RoadNetwork> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2 && value.every(n => typeof n === 'number' && Number.isFinite(n))
    && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90
}

function isLine(value: unknown): value is Position[] {
  if (!Array.isArray(value) || value.length < 2 || !value.every(isPosition)) return false
  return value.some(p => p[0] !== value[0][0] || p[1] !== value[0][1])
}

function isRoadFeature(value: unknown): value is RoadFeature {
  if (!isRecord(value) || value.type !== 'Feature' || !isRecord(value.geometry)) return false
  if (value.properties !== null && !isRecord(value.properties)) return false
  const geometry = value.geometry
  return geometry.type === 'LineString' ? isLine(geometry.coordinates)
    : geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)
      && geometry.coordinates.length > 0 && geometry.coordinates.every(isLine)
}

function parseRoadNetwork(value: unknown): RoadNetwork {
  if (!isRecord(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    throw new Error('The road asset is not a GeoJSON FeatureCollection.')
  }
  const features: RoadFeature[] = []
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  for (const feature of value.features) {
    if (!isRoadFeature(feature)) continue
    // Retain original feature objects, IDs, properties and every coordinate position.
    features.push(feature)
    const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates
    for (const line of lines) for (const [lng, lat] of line) {
      west = Math.min(west, lng)
      south = Math.min(south, lat)
      east = Math.max(east, lng)
      north = Math.max(north, lat)
    }
  }
  if (features.length === 0) throw new Error('The road asset contains no valid LineString or MultiLineString features.')
  return {
    data: { ...value, type: 'FeatureCollection', features },
    portFeatures: features.filter(feature => intersectsInspectionScope(feature.geometry)),
    sourceCount: value.features.length,
    unsupportedCount: value.features.length - features.length,
    bounds: [[south, west], [north, east]],
    sourceSha256: null,
  }
}

function loadRoadNetwork(): Promise<RoadNetwork> {
  if (!networkRequest) {
    networkRequest = fetch(roadsUrl)
      .then(async response => {
        if (!response.ok) throw new Error(`Road asset request failed (HTTP ${response.status}).`)
        const bytes = await response.arrayBuffer()
        const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
        const network = parseRoadNetwork(value)
        if (globalThis.crypto?.subtle) {
          const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
          network.sourceSha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
        }
        return network
      })
      .catch((error: unknown) => {
        networkRequest = null
        throw error
      })
  }
  return networkRequest
}

const roadStyle: StyleFunction<RoadProperties> = feature => {
  const highway = feature?.properties?.highway
  if (typeof highway === 'string' && MAJOR_ROADS.has(highway)) return MAJOR_STYLE
  if (typeof highway === 'string' && CONNECTOR_ROADS.has(highway)) return CONNECTOR_STYLE
  return LOCAL_STYLE
}

function countViewportIntersections(layer: GeoJSON<RoadProperties, RoadGeometry>, viewport: LatLngBounds): number {
  let count = 0
  // Leaflet caches each feature's geographic bounds. This is a bounds test, not
  // a test of line/pixel visibility, and works while the road layer is hidden.
  layer.eachLayer(featureLayer => {
    if (featureLayer instanceof Polyline && featureLayer.getBounds().intersects(viewport)) count++
  })
  return count
}

// Screen-space picking keeps the shared canvas non-interactive, allowing all
// existing terminal polygons, popups and map controls to receive their clicks.
function closestRoad(layer: GeoJSON<RoadProperties, RoadGeometry>, map: ReturnType<typeof useMap>, event: LeafletMouseEvent): RoadFeature | null {
  const click = map.latLngToContainerPoint(event.latlng)
  const metres = map.distance(event.latlng, map.containerPointToLatLng([click.x + 7, click.y]))
  const searchBounds = event.latlng.toBounds(metres * 2)
  let nearest: RoadFeature | null = null, bestDistance = 7 * 7
  layer.eachLayer(candidate => {
    if (!(candidate instanceof Polyline) || !candidate.getBounds().intersects(searchBounds)) return
    const road = candidate.feature as RoadFeature | undefined
    if (!road) return
    const lines = road.geometry.type === 'LineString' ? [road.geometry.coordinates] : road.geometry.coordinates
    for (const line of lines) {
      let a = map.latLngToContainerPoint([line[0][1], line[0][0]])
      for (let i = 1; i < line.length; i++) {
        const b = map.latLngToContainerPoint([line[i][1], line[i][0]])
        const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy
        const t = length ? Math.max(0, Math.min(1, ((click.x - a.x) * dx + (click.y - a.y) * dy) / length)) : 0
        const distance = (click.x - a.x - t * dx) ** 2 + (click.y - a.y - t * dy) ** 2
        if (distance < bestDistance) { bestDistance = distance; nearest = road }
        a = b
      }
    }
  })
  return nearest
}

export default function RoadNetworkLayer({ mode, onModeChange }: { mode: RoadDisplayMode; onModeChange: (mode: RoadDisplayMode) => void }) {
  const map = useMap()
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const [retryVersion, setRetryVersion] = useState(0)
  const [visible, setVisible] = useState(true)
  const [trafficEnabled, setTrafficEnabled] = useState(true)
  const [scenario, setScenario] = useState<TrafficScenario>('normal')
  const [trafficRetry, setTrafficRetry] = useState(0)
  const [trafficState, setTrafficState] = useState<
    { kind: 'idle' | 'loading' } | { kind: 'ready'; scenario: TrafficScenario; records: Map<string, TrafficReading> }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })
  const [selectedRoad, setSelectedRoad] = useState<RoadFeature | null>(null)
  const detailsRef = useRef<HTMLDetailsElement | null>(null)
  const [viewportFeatureCount, setViewportFeatureCount] = useState<number | null>(null)
  const layerRef = useRef<GeoJSON<RoadProperties, RoadGeometry> | null>(null)
  const network = loadState.kind === 'ready' ? loadState.network : null
  const trafficRecords = trafficEnabled && trafficState.kind === 'ready' && trafficState.scenario === scenario ? trafficState.records : null
  const selectedTraffic = selectedRoad ? trafficRecords?.get(String(selectedRoad.properties?.['@id'])) : null
  const displayData = useMemo(() => network
    ? mode === 'port' ? { ...network.data, features: network.portFeatures } : network.data
    : null, [network, mode])

  useEffect(() => {
    const container = DomUtil.create('div', 'leaflet-control bg-white rounded-lg border border-slate-200 p-2 shadow-sm text-xs text-slate-700')
    container.style.width = '190px'
    container.style.maxWidth = 'calc(100vw - 100px)'
    DomEvent.disableClickPropagation(container)
    DomEvent.disableScrollPropagation(container)
    const control = new Control({ position: 'bottomright' })
    control.onAdd = () => container
    control.addTo(map)
    setHost(container)
    return () => { control.remove(); DomEvent.off(container) }
  }, [map])

  useEffect(() => {
    let cancelled = false
    setLoadState({ kind: 'loading' })
    loadRoadNetwork().then(
      loaded => { if (!cancelled) setLoadState({ kind: 'ready', network: loaded }) },
      (error: unknown) => {
        if (!cancelled) setLoadState({ kind: 'error', message: error instanceof Error ? error.message : 'Unable to load the road asset.' })
      },
    )
    return () => { cancelled = true }
  }, [retryVersion])

  useEffect(() => {
    if (!network || !trafficEnabled) { setTrafficState({ kind: 'idle' }); return }
    if (!network.sourceSha256) {
      setTrafficState({ kind: 'error', message: 'Road checksum verification unavailable. Open using localhost or HTTPS.' })
      return
    }
    const controller = new AbortController()
    setTrafficState({ kind: 'loading' })
    getTrafficRecords(scenario, network.data.features.map(road => String(road.properties?.['@id'])), controller.signal, network.sourceSha256).then(
      records => { if (!controller.signal.aborted) setTrafficState({ kind: 'ready', scenario, records }) },
      (error: unknown) => { if (!controller.signal.aborted) setTrafficState({ kind: 'error', message: error instanceof Error ? error.message : 'Traffic API unavailable' }) },
    )
    return () => { controller.abort() }
  }, [network, trafficEnabled, scenario, trafficRetry])

  useEffect(() => {
    if (!displayData) return
    const pane = map.getPane(ROAD_PANE) ?? map.createPane(ROAD_PANE)
    // Above basemap tiles (200), below the existing terminal polygons (400).
    pane.style.zIndex = '350'
    pane.style.pointerEvents = 'none'
    const renderer = canvas({ pane: ROAD_PANE, padding: 0.2 })
    try {
      layerRef.current = geoJSON<RoadProperties, RoadGeometry>(displayData, {
        pane: ROAD_PANE,
        style: feature => ({ ...roadStyle(feature), renderer, smoothFactor: 0 }),
        interactive: false,
        bubblingMouseEvents: false,
        attribution: 'Road geometry &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL)',
      })
    } catch (error) {
      setLoadState({ kind: 'error', message: `Could not render roads: ${error instanceof Error ? error.message : 'unknown rendering error'}` })
    }
    const layer = layerRef.current
    return () => { layer?.remove(); renderer.remove(); layerRef.current = null }
  }, [map, displayData])

  useEffect(() => {
    if (!network || !layerRef.current) return
    layerRef.current.setStyle(feature => {
      const base = roadStyle(feature)
      if (!trafficEnabled || !feature) return base
      const traffic = trafficRecords?.get(String(feature.properties?.['@id']))
      if (!traffic) return { ...base, color: '#94a3b8' }
      return { ...base, color: traffic.color, weight: (base.weight ?? 1.4) + 1, opacity: 1 }
    })
  }, [network, displayData, trafficEnabled, trafficRecords])

  useEffect(() => {
    setSelectedRoad(null)
    if (!displayData || !visible || !trafficEnabled) return
    const selectRoad = (event: LeafletMouseEvent) => {
      if (!layerRef.current) return
      const road = closestRoad(layerRef.current, map, event)
      setSelectedRoad(road)
      if (road && detailsRef.current) detailsRef.current.open = true
    }
    map.on('click', selectRoad)
    return () => { map.off('click', selectRoad) }
  }, [map, displayData, visible, trafficEnabled])

  useEffect(() => {
    if (!displayData || !layerRef.current) return
    try {
      if (visible) layerRef.current.addTo(map)
      else layerRef.current.remove()
    } catch (error) {
      setLoadState({ kind: 'error', message: `Could not display roads: ${error instanceof Error ? error.message : 'unknown rendering error'}` })
    }
  }, [map, displayData, visible])

  useEffect(() => {
    if (!displayData || !layerRef.current) {
      setViewportFeatureCount(null)
      return
    }
    const updateCount = () => {
      if (layerRef.current) setViewportFeatureCount(countViewportIntersections(layerRef.current, map.getBounds()))
    }
    updateCount()
    map.on('moveend zoomend resize', updateCount)
    return () => { map.off('moveend zoomend resize', updateCount) }
  }, [map, displayData])

  if (!host) return null
  return createPortal(
    <section aria-label="OpenStreetMap road layer" className="space-y-2">
      <label className="flex items-center justify-between gap-4">
        <span className="font-semibold">OSM roads</span>
        <input type="checkbox" checked={visible} disabled={!network} onChange={event => setVisible(event.target.checked)} className="accent-blue-600" />
      </label>
      {loadState.kind === 'loading' && <p role="status">Loading road geometry…</p>}
      {loadState.kind === 'error' && <div role="alert" className="space-y-1 text-red-700"><p>{loadState.message}</p><button type="button" onClick={() => setRetryVersion(v => v + 1)} className="underline font-semibold">Retry roads</button></div>}
      <label className="flex items-center justify-between gap-2 text-[10px] font-semibold">
        Traffic · SIMULATED
        <input type="checkbox" checked={trafficEnabled} disabled={!network} onChange={event => setTrafficEnabled(event.target.checked)} className="accent-blue-600" />
      </label>
      {trafficEnabled && <>
        <label className="block text-[10px]">Scenario
          <select value={scenario} disabled={!network || !visible} onChange={event => setScenario(event.target.value as TrafficScenario)} className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1 py-1 text-xs">
            {Object.entries(TRAFFIC_SCENARIOS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div aria-label="Simulated congestion legend" className="grid grid-cols-2 gap-1 text-[10px]">
          {TRAFFIC_LEVELS.map((level, i) => <p key={level.label} className="flex items-center gap-1"><span aria-hidden="true" className="inline-block w-3 border-t-[3px]" style={{ borderColor: level.color }} />{level.label} {i === 0 ? 0 : TRAFFIC_LEVELS[i - 1].max + 1}–{level.max}</p>)}
        </div>
        {(trafficState.kind === 'loading' || trafficState.kind === 'idle') && <p role="status" className="text-[10px] text-slate-500">Loading persisted traffic…</p>}
        {trafficState.kind === 'ready' && trafficState.records.size === 0 && <p role="status" className="text-[10px] text-amber-800">No persisted traffic for this scenario. Roads shown in grey.</p>}
        {trafficState.kind === 'error' && <div role="alert" className="text-[10px] text-red-700"><p>{trafficState.message} Roads shown in grey.</p><button type="button" className="underline" onClick={() => setTrafficRetry(v => v + 1)}>Retry traffic</button></div>}
      </>}
      {network && <div className="space-y-1">
        <p className="text-[10px] text-slate-500">{mode === 'port' ? 'Port inspection view' : 'Complete export view'}</p>
        <div className="flex flex-wrap gap-1">
          <button type="button" aria-pressed={mode === 'port'} onClick={() => { onModeChange('port'); map.fitBounds(INSPECTION_SCOPE_BOUNDS, { padding: [25, 25], maxZoom: 14 }) }} className="rounded border border-slate-300 px-2 py-1 font-semibold hover:bg-slate-50 aria-pressed:bg-blue-50">Port view</button>
          <button type="button" aria-pressed={mode === 'full'} onClick={() => { onModeChange('full'); map.fitBounds(network.bounds, { padding: [35, 35], maxZoom: 16 }) }} className="rounded border border-slate-300 px-2 py-1 font-semibold hover:bg-slate-50 aria-pressed:bg-blue-50">Full road network</button>
        </div>
      </div>}
      {!trafficEnabled && <div aria-label="Road legend" className="space-y-0.5 border-t border-slate-100 pt-1 text-[10px]">
        <p className="flex items-center gap-2"><span aria-hidden="true" className="inline-block w-4 border-t-[3px] border-amber-700" />Major roads</p>
        <p className="flex items-center gap-2"><span aria-hidden="true" className="inline-block w-4 border-t-2 border-cyan-700" />Secondary / tertiary</p>
        <p className="flex items-center gap-2"><span aria-hidden="true" className="inline-block w-4 border-t border-slate-600" />Local / service / other</p>
      </div>}
      <details ref={detailsRef}>
        <summary className="cursor-pointer font-semibold">Road details</summary>
        <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
          {selectedRoad && <div role="status" className="space-y-1 border-b border-slate-200 pb-2">
            <p className="font-semibold break-words">{String(selectedRoad.properties?.name ?? selectedRoad.properties?.['@id'] ?? selectedRoad.id ?? 'Unnamed road')}</p>
            <p className="break-words">{String(selectedRoad.properties?.['@id'] ?? selectedRoad.id ?? 'ID not specified')}</p>
            <p>SIMULATED · {TRAFFIC_SCENARIOS[scenario]}</p>
            {selectedTraffic ? <>
              <p>Congestion: {selectedTraffic.score}/100 · {selectedTraffic.level}</p>
              <p>{selectedTraffic.speed === null ? 'Estimated speed unavailable' : `Simulated speed: ~${selectedTraffic.speed} km/h`}</p>
              {selectedTraffic.baseline !== undefined && <p className="text-[10px] text-slate-500">Baseline: {Math.round(selectedTraffic.baseline)} km/h · {selectedTraffic.speedBasis}; not a measured speed.</p>}
              <p className="text-[10px] text-slate-500">Persisted simulation generated: {selectedTraffic.generatedAt}</p>
            </> : <p>Persisted traffic unavailable for this road.</p>}
          </div>}
          {network && <>
            <div role="status" className="space-y-1 text-slate-500">
              <p>Source features loaded: {network.data.features.length.toLocaleString('en-IN')} / {network.sourceCount.toLocaleString('en-IN')}</p>
              <p>Road layer: {visible ? 'Enabled' : 'Disabled'}</p>
              <p>Features in selected scope: {displayData?.features.length.toLocaleString('en-IN')}</p>
              <p>Selected feature bounds intersecting viewport: {viewportFeatureCount === null ? 'Calculating…' : viewportFeatureCount.toLocaleString('en-IN')}</p>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-500">Geographic bounds intersection is not a count of individually visible or unobscured roads.</p>
            <p className="text-[10px] leading-relaxed text-slate-500">Local roads can overlap at overview zoom. Zoom in for detail.</p>
            <p className="text-[10px] leading-relaxed text-slate-500">Port view uses an approximate inspection extent from the 2022/2026 land-use maps, not an authoritative port boundary. Entire edge-crossing ways are retained. Some approach roads extend beyond the view. Full road network restores the complete export.</p>
            {network.unsupportedCount > 0 && <p role="alert" className="text-amber-800">{network.unsupportedCount} unsupported or invalid features could not be displayed. The source is unchanged.</p>}
          </>}
          <p className="text-[10px] leading-relaxed text-slate-500">Traffic is SIMULATED, not live. Values are read from the backend/MongoDB; no local score fallback. Click near a road for details. The seed model uses class and shared vertices. Direction, demand, queues and turn restrictions are not modelled. Untagged grade separation may be unresolved. Gate and junction identities are not assigned.</p>
        </div>
      </details>
    </section>,
    host,
  )
}
