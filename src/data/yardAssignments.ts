import { YARD_GRIDS } from './yardGeometry'
import type { Container } from '@/types/container'

export const ASSIGNMENT_POLICY = 'simulated-four-high-v1'
export const occupiesYard = (c: Pick<Container, 'status'>) => c.status?.toLowerCase() !== 'gate-out'
export const stackKey = (c: Container) => JSON.stringify([c.terminal, c.block, c.row, c.column])
export const lengthClass = (c: Container) => ({ '20ft': 20, '40ft': 40, '40ft-HC': 40, '45ft-HC': 45 })[c.type]
export function validPosition(c: Container): boolean {
  const g = YARD_GRIDS[c.terminal], block = Number(c.block?.split('-').pop())
  return !!g && !!c.id && !!lengthClass(c) && c.yard === `${g.prefix}-YARD`
    && c.block === `${g.prefix}-${String(block).padStart(2, '0')}` && block > 0 && block <= g.blocks
    && [c.row, c.column, c.level].every(Number.isInteger)
    && c.row > 0 && c.row <= g.rows && c.column > 0 && c.column <= g.columns && c.level > 0 && c.level <= 4
}

/** Validation only: never packs, reorders, or reassigns a record for rendering.
 * A broken stack is withheld for review instead of inventing support/positions. */
export function validatedStacks(records: readonly Container[]) {
  const stacks = new Map<string, Container[]>(), unresolved: Container[] = []
  for (const c of records) {
    if (!occupiesYard(c)) continue
    if (!validPosition(c)) { unresolved.push(c); continue }
    const key = stackKey(c), list = stacks.get(key) ?? []; list.push(c); stacks.set(key, list)
  }
  for (const [key, list] of stacks) {
    list.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
    if (list.length > 4 || list.some((c, i) => c.level !== i + 1 || lengthClass(c) !== lengthClass(list[0]))) {
      unresolved.push(...list); stacks.delete(key)
    }
  }
  return { stacks, unresolved }
}

/** Explicit simulated-inventory repair plan, used by the backed-up migration.
 * Preserve terminal/yard/block and all compatible existing stacks; compact levels,
 * separate incompatible lengths and overflow into same-block capacity only.
 * No capacity or uncertain provenance => review, never a cross-yard guess. */
export function planYardRepair(records: readonly Container[]) {
  const result = records.map(c => ({ ...c })), unresolved = new Set<string>()
  const groups = new Map<string, Container[]>()
  for (const c of result) {
    if (!occupiesYard(c)) continue
    const g = YARD_GRIDS[c.terminal]
    if (!c.simulated || !g || !lengthClass(c) || c.yard !== `${g.prefix}-YARD` || !validPosition({ ...c, level: 1 })) {
      unresolved.add(c.id); continue
    }
    const key = `${c.terminal}:${c.block}`, list = groups.get(key) ?? []; list.push(c); groups.set(key, list)
  }
  for (const list of groups.values()) {
    const g = YARD_GRIDS[list[0].terminal], stacks = new Map<string, Container[]>(), pending: Container[] = []
    for (const c of [...list].sort((a, b) => a.id.localeCompare(b.id))) {
      const key = `${c.row}:${c.column}`, stack = stacks.get(key) ?? []; stack.push(c); stacks.set(key, stack)
    }
    for (const stack of stacks.values()) {
      stack.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
      const counts = new Map<number, number>()
      for (const c of stack) counts.set(lengthClass(c), (counts.get(lengthClass(c)) ?? 0) + 1)
      const length = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
      const keep = stack.filter(c => lengthClass(c) === length).slice(0, 4)
      pending.push(...stack.filter(c => !keep.includes(c)))
      stack.splice(0, stack.length, ...keep)
      stack.forEach((c, i) => { c.level = i + 1 })
    }
    pending.sort((a, b) => a.id.localeCompare(b.id))
    for (const c of pending) {
      let destination: Container[] | undefined, row = 0, column = 0
      for (let r = 1; r <= g.rows && !destination; r++) for (let col = 1; col <= g.columns && !destination; col++) {
        const key = `${r}:${col}`, stack = stacks.get(key) ?? []
        if (stack.length < 4 && (!stack.length || lengthClass(stack[0]) === lengthClass(c))) {
          destination = stack; stacks.set(key, stack); row = r; column = col
        }
      }
      if (!destination) { unresolved.add(c.id); continue }
      c.row = row; c.column = column; c.level = destination.length + 1; destination.push(c)
    }
  }
  const checked = validatedStacks(result)
  checked.unresolved.forEach(c => unresolved.add(c.id))
  return { records: result, unresolved: [...unresolved].sort() }
}
