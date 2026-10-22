import { useState, useEffect, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Polygon, Popup, Tooltip, useMap } from 'react-leaflet'
import { latLngBounds, type LatLngTuple } from 'leaflet'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { useContainers } from '@/hooks/useContainers'
import { jnpaTerminalGeoJSON } from '@/data/jnpa/schematicGeo'
import RoadNetworkLayer from '@/components/map/RoadNetworkLayer'
import { INSPECTION_SCOPE_BOUNDS, type RoadDisplayMode } from '@/data/jnpa/roadDisplayScope'
import 'leaflet/dist/leaflet.css'

const PORT_BOUNDS = latLngBounds(INSPECTION_SCOPE_BOUNDS)
const PORT_CENTER: LatLngTuple = [PORT_BOUNDS.getCenter().lat, PORT_BOUNDS.getCenter().lng]
const COLORS: Record<string, string> = { NSFT: '#2563eb', NSICT: '#0891b2', NSIGT: '#7c3aed', APMT: '#d97706', BMCT: '#059669', NSDT: '#64748b' }
const BOUNDARIES = jnpaTerminalGeoJSON.features.map(feature => ({
  ...feature.properties,
  positions: feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as LatLngTuple),
}))

function MapLayout({ fitVersion }: { fitVersion: number }) {
  const map = useMap()
  useEffect(() => {
    let frame = 0
    const resize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }))
    }
    const observer = new ResizeObserver(resize)
    observer.observe(map.getContainer())
    resize()
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [map])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      map.invalidateSize({ pan: false })
      map.fitBounds(PORT_BOUNDS, { padding: [25, 25], maxZoom: 14, animate: false })
    })
    return () => cancelAnimationFrame(frame)
  }, [map, fitVersion])
  return null
}

export default function PortMapPage() {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }) }, [])
  const navigate = useNavigate()
  const setActiveTerminal = useAppStore(s => s.setActiveTerminal)
  const { containers, terminals, loading, error, refetch } = useContainers()
  const [showTerminals, setShowTerminals] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [fitVersion, setFitVersion] = useState(0)
  const [roadMode, setRoadMode] = useState<RoadDisplayMode>('port')
  const [tileVersion, setTileVersion] = useState(0)
  const [tilesLoaded, setTilesLoaded] = useState(false)
  const [tileError, setTileError] = useState(false)
  const [tileSlow, setTileSlow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setTileSlow(true), 12000)
    return () => clearTimeout(timer)
  }, [tileVersion])
  const counts = useMemo(() => containers.reduce<Record<string, number>>((result, c) => {
    result[c.terminal] = (result[c.terminal] ?? 0) + 1
    return result
  }, {}), [containers])
  const openYard = useCallback((code: string) => {
    if (!terminals.some(t => t.code === code)) return
    useAppStore.getState().resetFilters()
    setActiveTerminal(code)
    navigate('/container-yard')
  }, [terminals, setActiveTerminal, navigate])
  const countLabel = (code: string) => loading ? 'Loading…' : error ? 'Unavailable' : `${(counts[code] ?? 0).toLocaleString('en-IN')} records`

  return (
    <div className="p-5 flex flex-col gap-4 min-h-[620px]" style={{ height: 'calc(100dvh - 52px)' }}>
      <header className="flex flex-wrap justify-between items-end gap-3 shrink-0">
        <div><p className="text-xs font-semibold tracking-widest uppercase text-accent-primary">Geospatial overview</p><h1 className="text-2xl font-semibold tracking-tight mt-1">Port Map</h1><p className="text-xs text-text-muted mt-1">JNPA / Nhava Sheva · basemap context with schematic terminal overlays</p></div>
        <button onClick={() => { setRoadMode('port'); setFitVersion(v => v + 1) }} title="Fit approximate port inspection extent" className="px-3 py-2 bg-white border border-border-subtle rounded-lg text-xs font-medium">Fit port area</button>
      </header>
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-4">
        <section aria-label="Interactive port map" className="relative min-h-[400px] overflow-hidden rounded-xl border border-border-subtle bg-slate-100 shadow-card">
          <MapContainer center={PORT_CENTER} zoom={14} scrollWheelZoom style={{ height: '100%', width: '100%', position: 'absolute', inset: 0, zIndex: 0 }}>
            <MapLayout fitVersion={fitVersion} />
            <TileLayer key={tileVersion} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' eventHandlers={{ tileload: () => setTilesLoaded(true), tileerror: () => setTileError(true) }} />
            <RoadNetworkLayer mode={roadMode} onModeChange={setRoadMode} />
            {showTerminals && BOUNDARIES.map(boundary => (
              <Polygon key={boundary.id} positions={boundary.positions} pathOptions={{ color: COLORS[boundary.id], fillColor: COLORS[boundary.id], fillOpacity: selected === boundary.id ? 0.32 : 0.15, weight: selected === boundary.id ? 3 : 2 }} eventHandlers={{ click: () => setSelected(boundary.id) }}>
                <Tooltip permanent direction="center" className="font-semibold text-xs">{boundary.id}</Tooltip>
                <Popup><div className="space-y-2 min-w-[180px]"><strong>{boundary.id}</strong><p>{terminals.find(t => t.code === boundary.id)?.name ?? boundary.name}</p><p className="font-semibold">{countLabel(boundary.id)}</p><p className="text-xs text-amber-700">Schematic boundary · not surveyed</p><button onClick={() => openYard(boundary.id)} className="w-full rounded bg-blue-600 text-white py-2 text-xs">Open {boundary.id} yard</button></div></Popup>
              </Polygon>
            ))}
          </MapContainer>
          <div className="absolute bottom-7 left-3 z-[400] rounded-lg bg-white/95 border border-slate-200 px-3 py-2 text-xs shadow-sm pointer-events-none"><strong>Terminal overlays</strong><p className="text-slate-500 mt-0.5">Colored outlines are schematic, not surveyed.</p></div>
          {((!tilesLoaded && tileSlow) || tileError) && <div role="alert" className="absolute top-3 left-14 right-3 z-[400] flex items-center justify-between gap-3 bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-lg text-xs"><span>{tilesLoaded ? 'Some basemap tiles failed to load.' : 'Basemap tiles unavailable. Check the internet connection.'} Terminal outlines remain schematic; this is not a complete basemap.</span><button className="shrink-0 underline font-semibold" onClick={() => { setTileError(false); setTileSlow(false); setTilesLoaded(false); setTileVersion(v => v + 1) }}>Retry tiles</button></div>}
          {!tilesLoaded && !tileSlow && !tileError && <div role="status" className="absolute top-3 left-14 z-[400] rounded bg-white/95 px-3 py-2 text-xs">Loading basemap…</div>}
        </section>
        <aside className="min-h-0 overflow-y-auto space-y-3 pr-1">
          <section className="bg-white rounded-xl border border-border-subtle p-4"><div className="flex justify-between items-center"><h2 className="text-sm font-semibold">Terminal inventory</h2><span className="text-xs text-text-muted">{terminals.length} tracked</span></div><label className="flex items-center justify-between mt-3 text-xs text-text-muted">Show schematic boundaries<input type="checkbox" checked={showTerminals} onChange={e => setShowTerminals(e.target.checked)} className="accent-blue-600" /></label><p className="text-xs text-text-muted mt-2">Global counts · independent of yard filters</p></section>
          {loading && <p role="status" className="text-xs p-3">Loading terminal inventory…</p>}
          {error && <div role="alert" className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">{error}<button className="underline block mt-2" onClick={() => void refetch()}>Retry inventory</button></div>}
          {!loading && !error && terminals.length === 0 && <p className="text-xs p-3">No terminal records available.</p>}
          {terminals.map(t => {
            const mapped = BOUNDARIES.some(b => b.id === t.code)
            return <section key={t.code} className={`rounded-xl border bg-white p-3 transition-colors ${selected === t.code ? 'border-blue-400 ring-1 ring-blue-100' : 'border-border-subtle'}`}>
              <button onClick={() => setSelected(t.code)} className="w-full text-left" aria-pressed={selected === t.code}><div className="flex justify-between items-center gap-2"><span className="flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[t.code] ?? '#64748b' }} />{t.code}</span><span className="text-xs font-semibold tabular-nums">{countLabel(t.code)}</span></div><p className="text-xs text-text-muted leading-relaxed mt-1">{t.name}</p></button>
              {!mapped && <p className="mt-2 text-xs text-amber-700">Boundary unavailable · no polygon shown</p>}
              <button onClick={() => openYard(t.code)} className="mt-2 text-xs font-semibold text-blue-700 hover:underline">Open {t.code} yard →</button>
            </section>
          })}
          <p className="text-xs leading-relaxed text-text-muted px-1 pb-2">OSM road geometry is loaded separately from the basemap. It is not a verified routing network; gate and junction identities remain unverified. No live traffic is available. Inventory records are simulated.</p>
        </aside>
      </div>
    </div>
  )
}
