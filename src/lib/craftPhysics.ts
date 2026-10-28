import type { CraftInstance } from '../types'

/** Approx half of a craft element — used for circle collisions (tweak freely). */
export const ELEMENT_HIT_RADIUS_PX = 34

/** Restitution when bouncing off playfield edges. */
export const WALL_BOUNCE = 0.62

/** Restitution for element–element bumps. */
export const BODY_BOUNCE = 0.72

export interface PlayfieldBounds {
  /** Inclusive percent limits for element centers. */
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface PhysicsBody {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  /** When true, position is pinned (e.g. finger-dragged); others bounce off it. */
  pinned?: boolean
}

export function defaultPlayfield(): PlayfieldBounds {
  return { minX: 8, maxX: 92, minY: 22, maxY: 90 }
}

/**
 * Playfield = craft space minus the brand/logo + hint band at the top.
 * Centers stay inset by the element hit radius.
 */
export function measurePlayfield(
  space: HTMLElement,
  brand: HTMLElement | null,
): PlayfieldBounds {
  const spaceRect = space.getBoundingClientRect()
  const w = Math.max(1, spaceRect.width)
  const h = Math.max(1, spaceRect.height)
  const rx = (ELEMENT_HIT_RADIUS_PX / w) * 100
  const ry = (ELEMENT_HIT_RADIUS_PX / h) * 100

  let topPct = 18
  if (brand) {
    const brandRect = brand.getBoundingClientRect()
    const gapPx = 10
    topPct = ((brandRect.bottom - spaceRect.top + gapPx) / h) * 100
  }

  return {
    minX: rx + 1,
    maxX: 100 - rx - 1,
    minY: Math.min(48, Math.max(16, topPct + ry * 0.15)),
    maxY: 100 - ry - 2,
  }
}

export function clampToPlayfield(
  x: number,
  y: number,
  bounds: PlayfieldBounds,
): { x: number; y: number } {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, y)),
  }
}

function radiusPct(spaceWidthPx: number, spaceHeightPx: number) {
  return {
    rx: (ELEMENT_HIT_RADIUS_PX / Math.max(1, spaceWidthPx)) * 100,
    ry: (ELEMENT_HIT_RADIUS_PX / Math.max(1, spaceHeightPx)) * 100,
  }
}

/** Ellipse overlap test in %-space (accounts for non-square craft canvas). */
function overlapNormal(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rx: number,
  ry: number,
): { nx: number; ny: number; depth: number } | null {
  const dx = bx - ax
  const dy = by - ay
  // Map to unit circle space.
  const sx = dx / (rx * 2)
  const sy = dy / (ry * 2)
  const dist = Math.hypot(sx, sy)
  if (dist >= 1 || dist < 1e-6) {
    if (dist < 1e-6) {
      // Identical centers — invent a push axis.
      return { nx: 1, ny: 0, depth: rx }
    }
    return null
  }
  const nx = (sx / dist) * (rx / Math.max(rx, ry))
  const ny = (sy / dist) * (ry / Math.max(rx, ry))
  const nLen = Math.hypot(nx, ny) || 1
  const ux = nx / nLen
  const uy = ny / nLen
  // Depth in %-ish units along the normal.
  const depth = (1 - dist) * Math.hypot(rx, ry)
  return { nx: ux, ny: uy, depth }
}

/**
 * Bounce dynamic bodies off playfield edges (reflect velocity).
 */
export function bounceWalls(
  bodies: PhysicsBody[],
  bounds: PlayfieldBounds,
): void {
  for (const b of bodies) {
    if (b.pinned) {
      const c = clampToPlayfield(b.x, b.y, bounds)
      b.x = c.x
      b.y = c.y
      continue
    }
    if (b.x < bounds.minX) {
      b.x = bounds.minX
      b.vx = Math.abs(b.vx) * WALL_BOUNCE
    } else if (b.x > bounds.maxX) {
      b.x = bounds.maxX
      b.vx = -Math.abs(b.vx) * WALL_BOUNCE
    }
    if (b.y < bounds.minY) {
      b.y = bounds.minY
      b.vy = Math.abs(b.vy) * WALL_BOUNCE
    } else if (b.y > bounds.maxY) {
      b.y = bounds.maxY
      b.vy = -Math.abs(b.vy) * WALL_BOUNCE
    }
  }
}

/**
 * Separate overlapping circles and exchange bounce impulses.
 * `skipPair(a,b)` can exempt merge partners during drag.
 */
export function resolveBodyCollisions(
  bodies: PhysicsBody[],
  spaceWidthPx: number,
  spaceHeightPx: number,
  skipPair?: (aId: string, bId: string) => boolean,
): void {
  const { rx, ry } = radiusPct(spaceWidthPx, spaceHeightPx)

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]
      const b = bodies[j]
      if (skipPair?.(a.id, b.id)) continue

      const hit = overlapNormal(a.x, a.y, b.x, b.y, rx, ry)
      if (!hit) continue

      const { nx, ny, depth } = hit
      const separate = depth * 0.55

      if (a.pinned && b.pinned) continue
      if (a.pinned) {
        b.x += nx * separate * 2
        b.y += ny * separate * 2
      } else if (b.pinned) {
        a.x -= nx * separate * 2
        a.y -= ny * separate * 2
      } else {
        a.x -= nx * separate
        a.y -= ny * separate
        b.x += nx * separate
        b.y += ny * separate
      }

      // Relative velocity along normal.
      const rvx = b.vx - a.vx
      const rvy = b.vy - a.vy
      const velAlong = rvx * nx + rvy * ny
      if (velAlong > 0) continue

      const impulse = -(1 + BODY_BOUNCE) * velAlong * 0.5
      if (!a.pinned) {
        a.vx -= impulse * nx
        a.vy -= impulse * ny
      }
      if (!b.pinned) {
        b.vx += impulse * nx
        b.vy += impulse * ny
      }
    }
  }
}

/**
 * While dragging: keep the dragged piece under the finger, push others away,
 * and clamp everyone to the playfield. Merge partners are allowed to overlap.
 */
export function resolveDragPush(
  instances: CraftInstance[],
  draggedId: string,
  draggedPos: { x: number; y: number },
  bounds: PlayfieldBounds,
  spaceWidthPx: number,
  spaceHeightPx: number,
  isMergePartner: (otherCatalogId: string) => boolean,
): CraftInstance[] {
  const pinned = clampToPlayfield(draggedPos.x, draggedPos.y, bounds)
  const bodies: PhysicsBody[] = instances.map((el) => ({
    id: el.instanceId,
    x: el.instanceId === draggedId ? pinned.x : el.x,
    y: el.instanceId === draggedId ? pinned.y : el.y,
    vx: 0,
    vy: 0,
    pinned: el.instanceId === draggedId,
  }))

  const catalogByInstance = new Map(
    instances.map((el) => [el.instanceId, el.catalogId]),
  )
  const draggedCatalog = catalogByInstance.get(draggedId)

  const skipPair = (aId: string, bId: string) => {
    if (!draggedCatalog) return false
    if (aId !== draggedId && bId !== draggedId) return false
    const otherId = aId === draggedId ? bId : aId
    const otherCatalog = catalogByInstance.get(otherId)
    return Boolean(otherCatalog && isMergePartner(otherCatalog))
  }

  for (let pass = 0; pass < 4; pass++) {
    resolveBodyCollisions(bodies, spaceWidthPx, spaceHeightPx, skipPair)
    bounceWalls(bodies, bounds)
    // Keep dragged pinned to the finger each pass.
    const dragBody = bodies.find((b) => b.id === draggedId)
    if (dragBody) {
      dragBody.x = pinned.x
      dragBody.y = pinned.y
      dragBody.vx = 0
      dragBody.vy = 0
    }
  }

  const byId = new Map(bodies.map((b) => [b.id, b]))
  return instances.map((el) => {
    const b = byId.get(el.instanceId)
    if (!b) return el
    const c = clampToPlayfield(b.x, b.y, bounds)
    return { ...el, x: c.x, y: c.y }
  })
}

/**
 * Static separation pass (starters / post-settle).
 * Optional `allowsOverlap(catalogA, catalogB)` skips bounce between pairs that
 * may stack (recipes + appointment/booking pairs).
 */
export function separateAll(
  instances: CraftInstance[],
  bounds: PlayfieldBounds,
  spaceWidthPx: number,
  spaceHeightPx: number,
  allowsOverlap?: (catalogA: string, catalogB: string) => boolean,
): CraftInstance[] {
  const bodies: PhysicsBody[] = instances.map((el) => ({
    id: el.instanceId,
    x: el.x,
    y: el.y,
    vx: 0,
    vy: 0,
  }))

  const catalogByInstance = new Map(
    instances.map((el) => [el.instanceId, el.catalogId]),
  )

  const skipPair =
    allowsOverlap &&
    ((aId: string, bId: string) => {
      const a = catalogByInstance.get(aId)
      const b = catalogByInstance.get(bId)
      return Boolean(a && b && allowsOverlap(a, b))
    })

  for (let pass = 0; pass < 6; pass++) {
    resolveBodyCollisions(
      bodies,
      spaceWidthPx,
      spaceHeightPx,
      skipPair || undefined,
    )
    bounceWalls(bodies, bounds)
  }

  const byId = new Map(bodies.map((b) => [b.id, b]))
  return instances.map((el) => {
    const b = byId.get(el.instanceId)
    if (!b) return el
    const c = clampToPlayfield(b.x, b.y, bounds)
    return { ...el, x: c.x, y: c.y }
  })
}
