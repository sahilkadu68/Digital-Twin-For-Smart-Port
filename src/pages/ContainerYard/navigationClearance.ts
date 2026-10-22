import { JNPA_TERMINALS, SHEVA_HILL, TERMINAL_SURFACE_Y, terminalBuildingLayout, type ContainerPlacement, type Point } from '@/data/jnpa/portSpatial'
import { equipmentPlacements } from '@/data/jnpa/equipmentPlacement'
import type { EquipmentRecord } from '@/hooks/useInventory'

type Volume = { minX: number; maxX: number; minZ: number; maxZ: number; bottom: number; top: number }
function inside(x: number, z: number, polygon: Point[]) {
  let result = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result
  }
  return result
}

/** Broad-phase, terminal-local buckets avoid raycasting every instance per frame.
 * Bounds protect containers and the representative solid buildings/vessels; they
 * are navigation clearance, not operational collision or surveyed geography. */
export function buildNavigationClearance(placements: Iterable<ContainerPlacement>, illustrated: boolean, equipment: readonly EquipmentRecord[] = []) {
  const groups = JNPA_TERMINALS.map(t => ({ t, c: Math.cos(t.rotation), s: Math.sin(t.rotation), buckets: new Map<string, Volume[]>() }))
  const add = (group: typeof groups[number], volume: Volume) => {
    for (let x = Math.floor(volume.minX / 32); x <= Math.floor(volume.maxX / 32); x++) for (let z = Math.floor(volume.minZ / 32); z <= Math.floor(volume.maxZ / 32); z++) {
      const key = x + ':' + z, list = group.buckets.get(key) ?? []; list.push(volume); group.buckets.set(key, list)
    }
  }
  for (const p of placements) {
    const group = groups.find(g => g.t.id === p.terminal.id)!
    add(group, { minX: p.x - p.length / 2 - .5, maxX: p.x + p.length / 2 + .5,
      minZ: p.z - p.width / 2 - .5, maxZ: p.z + p.width / 2 + .5, bottom: p.bottom - .5, top: p.top + .5 })
  }
  for (const group of groups) for (const p of equipmentPlacements(group.t,equipment)) {
    const [x,z]=p.position
    // Open portal: keep travel aisles clear, protect legs, head beam and hoist.
    for (const side of [-1,1]) add(group,{minX:x-5,maxX:x+5,minZ:z+side*p.width/2-1.3,maxZ:z+side*p.width/2+1.3,bottom:TERMINAL_SURFACE_Y,top:p.height+1})
    add(group,{minX:x-4.5,maxX:x+4.5,minZ:z-p.width/2-2,maxZ:z+p.width/2+2,bottom:p.height-2,top:p.height+2.5})
    add(group,{minX:x-6.8,maxX:x+6.8,minZ:z-2,maxZ:z+2,bottom:13.8,top:p.height+1})
  }
  if (illustrated) for (const group of groups) {
    const { t } = group, {width:w,depth,x,z}=terminalBuildingLayout(t)
    add(group, { minX: x - w / 2 - 3, maxX: x + w / 2 + 3, minZ: z - depth/2-3, maxZ: z + depth/2+3, bottom: TERMINAL_SURFACE_Y, top: 19 })
    add(group, { minX: x + w * .6 - 13, maxX: x + w * .6 + 13, minZ: z - Math.min(22,depth*.8)/2-1, maxZ: z + Math.min(22,depth*.8)/2+1, bottom: TERMINAL_SURFACE_Y, top: 9 })
  }
  const floorAt = (x: number, z: number) => {
    // The hill is intentionally conservative: no measured elevation dataset.
    if (inside(x, z, SHEVA_HILL)) return 50
    return JNPA_TERMINALS.some(t => inside(x, z, t.footprint)) ? 2.5 + TERMINAL_SURFACE_Y : 2
  }
  const obstructionTop = (x: number, y: number, z: number) => {
    let top = -Infinity
    for (const g of groups) {
      const dx = x - g.t.x, dz = z - g.t.z, lx = g.c * dx - g.s * dz, lz = g.s * dx + g.c * dz
      for (const v of g.buckets.get(Math.floor(lx / 32) + ':' + Math.floor(lz / 32)) ?? []) {
        if (lx >= v.minX && lx <= v.maxX && lz >= v.minZ && lz <= v.maxZ && y >= v.bottom && y <= v.top) top = Math.max(top, v.top)
      }
    }
    // Conservative envelopes follow the same procedural quay frames/counts;
    // they are not claims about actual equipment locations or berth occupancy.
    if (illustrated) for (const t of JNPA_TERMINALS) {
      const [a, b] = t.quay
      const angle = Math.atan2(b[1] - a[1], b[0] - a[0]), dx = x - a[0], dz = z - a[1]
      const lx = Math.cos(angle) * dx + Math.sin(angle) * dz, lz = -Math.sin(angle) * dx + Math.cos(angle) * dz
      const count = { BMCT: 16, NSFT: 6, NSICT: 6, NSIGT: 3, APMT: 6 }[t.id] ?? 0
      for (let i = 0; i < count; i++) {
        const cx = (i + .5) * t.quayLength / count
        if (Math.abs(lx - cx) < 15 && lz > 4 && lz < 33 && y < 94) top = Math.max(top, 94)
        if (Math.abs(lx - cx) < 15 && lz > -68 && lz < 49 && y > 55 && y < 65) top = Math.max(top, 65)
      }
      for (const [id, offset, length, width] of [['BMCT', 480, 330, 48], ['BMCT', 1400, 300, 43], ['APMT', 350, 270, 39]] as const) {
        if (id === t.id && Math.abs(lx - offset) < length / 2 + 2 && Math.abs(lz + width / 2 + 9) < width / 2 + 2 && y < 45) top = Math.max(top, 45)
      }
    }
    return top
  }
  return { floorAt, obstructionTop }
}
export type NavigationClearance = ReturnType<typeof buildNavigationClearance>
