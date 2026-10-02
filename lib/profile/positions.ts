import { SECTIONS, type Section } from "./schema"

const newestFirst = (s: Section) => SECTIONS.find((x) => x.key === s)!.newestFirst

/**
 * Positions for `count` new items appended to a section, keeping their given order.
 * Newest-first sections put them above everything (negative positions are fine).
 */
export function positionsForNew(section: Section, existing: number[], count: number): number[] {
  if (!count) return []
  if (newestFirst(section)) {
    const top = existing.length ? Math.min(...existing) : 0
    return Array.from({ length: count }, (_, i) => top - count + i)
  }
  const bottom = existing.length ? Math.max(...existing) : -1
  return Array.from({ length: count }, (_, i) => bottom + 1 + i)
}

/** Swap with the neighbour above (-1) or below (+1); returns the two position updates, or [] at an edge. */
export function swapPositions(
  ordered: { id: string; position: number }[],
  id: string,
  dir: -1 | 1,
): { id: string; position: number }[] {
  const i = ordered.findIndex((x) => x.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= ordered.length) return []
  const a = ordered[i]
  const b = ordered[j]
  // equal positions (legacy data) would make a swap a no-op: separate them
  const pa = a.position === b.position ? b.position + dir : b.position
  return [
    { id: a.id, position: pa },
    { id: b.id, position: a.position },
  ]
}
