import type { LineString, MultiLineString, Position } from 'geojson'

export type RoadDisplayMode = 'port' | 'full'

// Approximate INSPECTION DISPLAY envelope from the reviewed scope previews.
// Not a surveyed/legal port boundary or a set of identified gate coordinates.
// Provenance: docs/reference/Report_on_land_Use_Plan_for_JNPA___August_2022__23_2022_10_06_17_04_09.pdf,
// PDF page 236 (registered WGS84 / UTM 43N), and JNPA_2026_LULC.pdf page 1
// (registered WGS84). Physical map footprints, including the larger western
// terminal footprint in 2026, were traced in image space and inverse-registered.
// Their convex envelope is the exact preview reviewed before implementation.
// Registration/visual tracing is approximate; decimal precision is not accuracy.
// Selection retains WHOLE intersecting ways, including all 38 preview edge ways.
// No geometry, tags or topology are edited. Full mode bypasses this selection.
export const INSPECTION_SCOPE_RING: readonly (readonly [number, number])[] = [
  [72.93216000269068, 18.938986622627283],
  [72.92508577826106, 18.926524996173043],
  [72.95631502758437, 18.890178645375144],
  [72.96908461686256, 18.88462669516113],
  [72.98254728773966, 18.88334829693097],
  [72.99522774276619, 18.88490538606161],
  [73.00264471499314, 18.88925093987537],
  [73.01374912502865, 18.89754653895983],
  [73.02706549327358, 18.908353835602973],
  [73.0336681321825, 18.918379405015184],
  [73.03337825009244, 18.942201604425076],
  [73.02585386696747, 18.9463902908658],
  [72.99960822980756, 18.953581519462162],
  [72.95125116632498, 18.96565035511273],
]

export const INSPECTION_SCOPE_BOUNDS: [[number, number], [number, number]] = [
  [Math.min(...INSPECTION_SCOPE_RING.map(p => p[1])), Math.min(...INSPECTION_SCOPE_RING.map(p => p[0]))],
  [Math.max(...INSPECTION_SCOPE_RING.map(p => p[1])), Math.max(...INSPECTION_SCOPE_RING.map(p => p[0]))],
]

type Point = readonly number[]
const EPSILON = 1e-12 // Numerical comparisons only; no coordinate snapping.

function orientation(a: Point, b: Point, c: Point): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return Math.abs(orientation(a, b, p)) <= EPSILON
    && p[0] >= Math.min(a[0], b[0]) - EPSILON && p[0] <= Math.max(a[0], b[0]) + EPSILON
    && p[1] >= Math.min(a[1], b[1]) - EPSILON && p[1] <= Math.max(a[1], b[1]) + EPSILON
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = orientation(a, b, c), abD = orientation(a, b, d)
  const cdA = orientation(c, d, a), cdB = orientation(c, d, b)
  return ((abC > 0 && abD < 0 || abC < 0 && abD > 0) && (cdA > 0 && cdB < 0 || cdA < 0 && cdB > 0))
    || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)
}

function insideScope(p: Point): boolean {
  let inside = false
  for (let i = 0; i < INSPECTION_SCOPE_RING.length; i++) {
    const a = INSPECTION_SCOPE_RING[i], b = INSPECTION_SCOPE_RING[(i + 1) % INSPECTION_SCOPE_RING.length]
    if (onSegment(a, b, p)) return true
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

function lineIntersectsScope(line: Position[]): boolean {
  if (line.some(insideScope)) return true
  // Also retain lines that traverse the scope with every vertex outside it.
  for (let i = 1; i < line.length; i++) {
    for (let j = 0; j < INSPECTION_SCOPE_RING.length; j++) {
      if (segmentsIntersect(line[i - 1], line[i], INSPECTION_SCOPE_RING[j], INSPECTION_SCOPE_RING[(j + 1) % INSPECTION_SCOPE_RING.length])) return true
    }
  }
  return false
}

export function intersectsInspectionScope(geometry: LineString | MultiLineString): boolean {
  return geometry.type === 'LineString' ? lineIntersectsScope(geometry.coordinates)
    : geometry.coordinates.some(lineIntersectsScope)
}
