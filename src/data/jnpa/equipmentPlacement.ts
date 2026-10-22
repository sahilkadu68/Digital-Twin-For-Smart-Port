import type { EquipmentRecord } from '@/hooks/useInventory'
import { YARD_GRIDS } from '@/data/yardGeometry'
import { blockLayout, type JNPATerminal, type Point } from './portSpatial'

export interface RTGPlacement {
  id: string; equipmentId: string; block: string; position: Point
  width: number; height: number; color: string
  placementKind: 'illustrative-within-stored-block'
}
/** Stored terminal/block association; deterministic illustrative travel position.
 * Multiple stored cranes in one block receive separate positions, not duplicates.
 * No precise coordinates, operational movement, or telemetry are inferred. */
export function equipmentPlacements(terminal: JNPATerminal, equipment: readonly EquipmentRecord[]): RTGPlacement[] {
  const grid = YARD_GRIDS[terminal.id], groups = new Map<string, EquipmentRecord[]>()
  for (const e of equipment) {
    if (e.type !== 'rtg' || e.terminal !== terminal.id) continue
    const index = Number(e.block?.split('-').pop()) - 1
    if (index < 0 || index >= grid.blocks || e.block !== `${grid.prefix}-${String(index + 1).padStart(2,'0')}`) continue
    const list = groups.get(e.block) ?? []; list.push(e); groups.set(e.block, list)
  }
  return [...groups].flatMap(([block, records]) => {
    const b = blockLayout(terminal, Number(block.split('-').pop()) - 1)
    return [...records].sort((a,b) => a.id.localeCompare(b.id)).map((e,i) => ({
      id: e.id, equipmentId: e.equipmentId, block, placementKind: 'illustrative-within-stored-block' as const,
      position: [b.x + b.width * (i + 1)/(records.length + 1), b.z + b.depth/2] as Point,
      width: b.depth + 6, height: 18,
      color: e.status === 'maintenance' ? '#c3914a' : '#72aaae',
    }))
  })
}
