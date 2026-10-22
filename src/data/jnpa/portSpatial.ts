import type { Container } from '@/types/container'
import { YARD_GRIDS } from '@/data/yardGeometry'
import { validatedStacks } from '@/data/yardAssignments'

export type Point = [number, number] // east, south, metres; Y is elevation
export const TERMINAL_SURFACE_Y = .45
export const BANK_TOP_Y = .65
type Pixel = [number, number]
export type TerminalType = 'container' | 'shallow'
export interface JNPATerminal {
  id: string; name: string; type: TerminalType
  x: number; z: number; rotation: number; width: number; depth: number
  quayLength: number; quay: [Point, Point]; footprint: Point[]
  yardRows: number; yardColumns: number; accent: string
}

// WGS84 local tangent approximation. One scene unit = one metre, north = -Z.
// Origin is a numerical reference, NOT a claimed gate or geographic port centre.
export const GEO_ORIGIN = { longitude: 72.975, latitude: 18.94 }
export function projectGeo(lon: number, lat: number): Point {
  return [(lon - GEO_ORIGIN.longitude) * 111320 * Math.cos(GEO_ORIGIN.latitude * Math.PI / 180),
    -(lat - GEO_ORIGIN.latitude) * 111320]
}

// Physical map traces from JNPA_2026_LULC.pdf p1, rendered 1888 x 1334.
// Use embedded /VP /Measure registration, NOT label positions or page coordinates
// mistaken for GPS. Coarse outlines are visual estimates, not cadastral polygons.
export function mapPoint([x, y]: Pixel): Point {
  const pdfX = x * 2383.93 / 1888, pdfY = 1683.78 - y * 1683.78 / 1334
  return projectGeo(72.9234 + (pdfX - 96.7367) / (2300.45 - 96.7367) * (73.0492 - 72.9234),
    18.885 + (pdfY - 122.69) / (1571.38 - 122.69) * (18.9677 - 18.885))
}
const trace = (points: Pixel[]) => points.map(mapPoint)
const add = (a: Point, b: Point, n = 1): Point => [a[0] + b[0] * n, a[1] + b[1] * n]
const mainStart = mapPoint([382, 300]), mainEnd = mapPoint([472, 115])
const mainLength = Math.hypot(mainEnd[0] - mainStart[0], mainEnd[1] - mainStart[1])
const mainAxis: Point = [(mainEnd[0] - mainStart[0]) / mainLength, (mainEnd[1] - mainStart[1]) / mainLength]
const mainQuay = (from: number, length: number): [Point, Point] => [add(mainStart, mainAxis, from), add(mainStart, mainAxis, from + length)]
function quayAt(a: Pixel, b: Pixel, length: number): [Point, Point] {
  const start = mapPoint(a), end = mapPoint(b), d = Math.hypot(end[0] - start[0], end[1] - start[1])
  return [start, add(start, [(end[0] - start[0]) / d, (end[1] - start[1]) / d], length)]
}
function terminal(id: string, name: string, footprint: Pixel[], origin: Pixel, along: Pixel, rear: Pixel,
  quay: [Point, Point], quayLength: number, columns: number, accent: string): JNPATerminal {
  const a = mapPoint(origin), b = mapPoint(along), c = mapPoint(rear)
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]), angle = Math.atan2(b[1] - a[1], b[0] - a[0])
  const depth = -(c[0] - a[0]) * Math.sin(angle) + (c[1] - a[1]) * Math.cos(angle)
  return { id, name, type: id === 'NSDT' ? 'shallow' : 'container', x: a[0], z: a[1], rotation: -angle,
    width, depth, quayLength, quay, footprint: trace(footprint), yardColumns: columns,
    yardRows: Math.ceil(YARD_GRIDS[id].blocks / columns), accent }
}

// Quay lengths published by JNPA/operators; yard frames/outline traces are estimates.
// APMT is the application's stable ID for GTI. NSDT remains its existing ID and
// is associated approximately with the map's shallow/distribution yard, not renamed.
// One trace owns both the terminal pad and coastal reclamation edge. Keeping
// separate nearly-equal outlines risks terminal pavement over water as they evolve.
const BMCT_FOOTPRINT: Pixel[] = [[125,637],[294,440],[396,532],[441,611],[370,598],[275,600],[224,637],[165,675]]
export const JNPA_TERMINALS: JNPATerminal[] = [
  terminal('NSFT', 'Nhava Sheva Free Port Terminal', [[421,299],[439,248],[557,294],[522,344]],
    [425,299],[452,252],[530,333], mainQuay(0,680),680,2,'#4c8cc7'),
  terminal('NSICT', 'Nhava Sheva International Container Terminal', [[439,248],[470,195],[540,224],[514,276]],
    [443,246],[470,200],[523,262], mainQuay(680,600),600,1,'#48aab1'),
  terminal('NSIGT', 'Nhava Sheva (India) Gateway Terminal', [[514,276],[540,224],[594,245],[582,280],[557,294]],
    [520,274],[542,231],[578,288], mainQuay(1280,330),330,1,'#a681ce'),
  terminal('APMT', 'Gateway Terminals India', [[341,421],[383,362],[473,399],[424,466]],
    [347,421],[385,369],[457,448], quayAt([301,390],[359,320],712),712,2,'#cf9451'),
  terminal('BMCT', 'Bharat Mumbai Container Terminal', BMCT_FOOTPRINT,
    [163,626],[292,471],[235,626], quayAt([125,637],[294,440],2000),2000,6,'#4ba58c'),
  terminal('NSDT', 'Nhava Sheva Distribution / Shallow Water Yard', [[383,362],[414,310],[521,346],[473,399]],
    [391,360],[420,316],[500,386], quayAt([361,316],[385,281],445),445,2,'#8b9eae'),
]

// Continuous coastal land connects BMCT with the original terminal cluster.
// Open-water cut-ins and broad mangrove margins are deliberately coarse traces.
export const PORT_LAND = trace([[472,115],[382,300],[402,310],[370,340],[341,380],[313,415],[324,430],
  ...[1,0,7,6,5,4,3].map(i=>BMCT_FOOTPRINT[i]),[480,670],[570,730],[650,778],
  [590,890],[520,1000],[552,1080],[700,1180],[835,1080],[1000,980],[1182,940],[1370,850],
  [1495,780],[1530,480],[1488,470],[1425,675],[1339,639],[1181,697],[1135,680],[1179,600],
  [1199,550],[1175,470],[1130,380],[1110,320],[1050,321],[986,436],[945,462],[889,500],
  [855,514],[840,492],[807,457],[793,435],[745,381],[680,333],[634,296],[585,277],[595,244],[474,185]])
export const SHEVA_HILL = trace([[440,489],[473,399],[531,340],[605,311],[653,359],[653,535],[611,595],[545,640],[489,569]])
export const MANGROVES = trace([[675,334],[745,381],[815,447],[856,515],[888,496],[981,436],[1048,322],[1106,324],
  [1176,478],[1185,559],[1116,675],[890,806],[782,683],[690,603]])
export const TANK_FARM = trace([[583,681],[644,693],[780,772],[829,824],[742,814],[644,751]])
// Rail corridor physically recognizable in both 2022 p236 and 2026 p1.
// Track count/sleeper spacing below are presentation assumptions, not a track survey.
export const RAIL_SPINE = trace([[548,337],[460,428],[411,488],[408,530],[451,593],[516,650],[652,740],[823,866],[967,827],[1340,650]])
export const BMCT_RAIL = trace([[319,489],[395,558],[478,640],[652,740]])
export const QUAY_LINKS = [
  trace([[382,300],[421,299]]),trace([[400,264],[439,274]]),
  trace([[420,225],[452,250]]),trace([[443,180],[470,204]]),trace([[464,135],[473,190]]),
  trace([[301,390],[341,421]]),trace([[359,320],[391,347]]),
]

export function localToWorld(t: JNPATerminal, x: number, z: number): Point {
  const c = Math.cos(t.rotation), s = Math.sin(t.rotation)
  return [t.x + c * x + s * z, t.z - s * x + c * z]
}
export function blockLayout(t: JNPATerminal, index: number) {
  const grid = YARD_GRIDS[t.id], width = grid.columns * 14.5, depth = grid.rows * 3.3
  const gapX = 24, gapZ = 17
  const totalWidth = t.yardColumns * width + (t.yardColumns - 1) * gapX
  const totalDepth = t.yardRows * depth + (t.yardRows - 1) * gapZ
  return { x: (t.width - totalWidth) / 2 + (index % t.yardColumns) * (width + gapX),
    z: (t.depth - totalDepth) / 2 + Math.floor(index / t.yardColumns) * (depth + gapZ), width, depth }
}
export function terminalBuildingLayout(t: JNPATerminal) {
  const depth = Math.max(0, Math.min(45, blockLayout(t, 0).z - 16))
  return { x: t.width / 2, z: t.depth - 8 - depth / 2, width: Math.min(180, t.width * .38), depth }
}
export function containerTransform(c: Container, bottom = BANK_TOP_Y) {
  const t = JNPA_TERMINALS.find(t => t.id === c.terminal)
  if (!t) return null
  const b = blockLayout(t, Number(c.block.split('-').pop()) - 1)
  // Horizontal logical assignments are unchanged. Vertical placement comes from
  // the complete inventory layout, never a fixed level * nominal-height pitch.
  const length = c.type === '20ft' ? 6.058 : c.type === '45ft-HC' ? 13.716 : 12.192
  const height = c.type.includes('HC') ? 2.896 : 2.591
  const x = b.x + (c.column - 1) * 14.5 + 7.25, z = b.z + (c.row - 1) * 3.3 + 1.65
  return { x, z, y: bottom + height / 2, length, height, width: 2.438, terminal: t }
}
export type ContainerPlacement = NonNullable<ReturnType<typeof containerTransform>> & {
  record: Container; bottom: number; top: number; displayTier: number; stackKey: string; issues: string[]
}
/** Render canonical validated assignments exactly, with cumulative physical
 * heights. No visual-only reordering or reassignment; broken stacks need review. */
export function buildContainerLayout(records: readonly Container[]) {
  const { stacks } = validatedStacks(records)
  const layout = new Map<string, ContainerPlacement>()
  for (const [stackKey, records] of stacks) {
    let bottom = BANK_TOP_Y
    records.forEach(record => {
      const p = containerTransform(record, bottom)!
      const top = bottom + p.height
      layout.set(record.id, { ...p, record, bottom, top, displayTier: record.level, stackKey, issues: [] })
      bottom = top
    })
  }
  return layout
}
/** Retain real lower records as muted context when a filter hides the support of
 * a visible box. This prevents filter-induced floating without moving any box. */
export function filteredStackSupports(visible: readonly Container[], layout: ReadonlyMap<string, ContainerPlacement>) {
  const ids = new Set(visible.map(c => c.id)), highest = new Map<string, number>()
  for (const c of visible) {
    const p = layout.get(c.id)
    if (p) highest.set(p.stackKey, Math.max(highest.get(p.stackKey) ?? 0, p.displayTier))
  }
  return [...layout.values()].filter(p => !ids.has(p.record.id) && p.displayTier < (highest.get(p.stackKey) ?? 0)).map(p => p.record)
}
export function terminalBounds(t?: JNPATerminal) {
  const points = (t ? [t] : JNPA_TERMINALS).flatMap(t => [...t.footprint, ...t.quay])
  return { minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
    minZ: Math.min(...points.map(p => p[1])), maxZ: Math.max(...points.map(p => p[1])) }
}
