import type { Container } from '@/types/container'
import { validPosition, occupiesYard, validatedStacks } from '@/data/yardAssignments'
export { validPosition } from '@/data/yardAssignments'

export function inventoryQuality(containers: Container[]) {
  const numbers = new Map<string, number>()
  const slots = new Map<string, number>()
  for (const c of containers) {
    numbers.set(c.containerNumber, (numbers.get(c.containerNumber) ?? 0) + 1)
    if (occupiesYard(c)) {
      const slot = JSON.stringify([c.terminal, c.block, c.row, c.column, c.level])
      slots.set(slot, (slots.get(slot) ?? 0) + 1)
    }
  }
  return {
    duplicateNumbers: [...numbers.values()].filter(n => n > 1).length,
    collidingSlots: [...slots.values()].filter(n => n > 1).length,
    invalidPositions: containers.filter(c => occupiesYard(c) && !validPosition(c)).length,
    unresolvedAssignments: validatedStacks(containers).unresolved.length,
  }
}
