import type { CraftInstance } from '../types'

/** Approx hit radius in % of craft space (comfortable for fingers). */
const HIT_RADIUS = 9

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
  let best: CraftInstance | null = null
  let bestDist = HIT_RADIUS

  for (const el of instances) {
    if (el.instanceId === draggedId) continue
    const dist = Math.hypot(el.x - x, el.y - y)
    if (dist < bestDist) {
      bestDist = dist
      best = el
    }
  }

  return best
}
