import type { CraftInstance } from '../types'

/** Approx hit radius in % of craft space (comfortable for fingers / merge). */
const HIT_RADIUS = 11

function nearestWithinRadius(
  instances: CraftInstance[],
  draggedId: string,
  x: number,
  y: number,
  matches?: (catalogId: string) => boolean,
): CraftInstance | null {
  let best: CraftInstance | null = null
  let bestDist = HIT_RADIUS

  for (const el of instances) {
    if (el.instanceId === draggedId) continue
    if (matches && !matches(el.catalogId)) continue
    const dist = Math.hypot(el.x - x, el.y - y)
    if (dist < bestDist) {
      bestDist = dist
      best = el
    }
  }

  return best
}

/**
 * Find the nearest other instance under the drop point.
 * Returns null if nothing is close enough.
 */
export function findDropTarget(
  instances: CraftInstance[],
  draggedId: string,
  x: number,
  y: number,
): CraftInstance | null {
  return nearestWithinRadius(instances, draggedId, x, y)
}

/** Nearest in-range instance whose catalog id passes `matches`. */
export function findMatchingTarget(
  instances: CraftInstance[],
  draggedId: string,
  x: number,
  y: number,
  matches: (catalogId: string) => boolean,
): CraftInstance | null {
  return nearestWithinRadius(instances, draggedId, x, y, matches)
}
