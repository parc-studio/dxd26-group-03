/**
 * Tilt the phone → craft pieces slowly slide toward the low side.
 *
 * Reads gravity from `devicemotion` (same secure-context / iOS permission
 * caveats as shakeDetect.ts) and runs a gentle physics loop on top of the
 * shared craftPhysics walls + collisions.
 */
import {
  bounceWalls,
  resolveBodyCollisions,
  type PhysicsBody,
  type PlayfieldBounds,
} from './craftPhysics'

/** Tilt below this (m/s², ≈ 8°) is ignored so a phone held flat stays still. */
const DEAD_ZONE = 1.4
/** px/s² of slide per m/s² of tilt beyond the dead zone. */
const ACCEL_PX = 40
/** Downward slide relative to left/right and upward (a held phone is always tipped toward you). */
const VERTICAL_FACTOR = 0.35
/** Velocity damping (1/s); top speed ≈ ACCEL_PX * tilt / DAMPING. */
const DAMPING = 4
/** Low-pass factor for the gravity reading (0..1, higher = snappier). */
const SMOOTHING = 0.15
/** Below this speed (px/s) a piece is considered at rest. */
const REST_SPEED_PX = 2

export interface TiltDriftOptions {
  /** Live pieces; `pinned` ones (e.g. under the finger) don't move. */
  getBodies: () => { id: string; x: number; y: number; pinned?: boolean }[]
  getSpace: () => { w: number; h: number; playfield: PlayfieldBounds }
  /** False while merges, jostles or overlays own the board. */
  isEnabled: () => boolean
  onFrame: (positions: Record<string, { x: number; y: number }>) => void
}

/** Screen-space slide direction (right, down) from a device gravity reading. */
function screenSlide(ax: number, ay: number): { x: number; y: number } {
  const angle = ((screen.orientation?.angle ?? 0) * Math.PI) / 180
  const sx = ax * Math.cos(angle) + ay * Math.sin(angle)
  const sy = -ax * Math.sin(angle) + ay * Math.cos(angle)
  // the reading points away from the ground: slide the opposite way on x,
  // and screen y grows downward
  return { x: -sx, y: sy }
}

export function attachTiltDrift(options: TiltDriftOptions): () => void {
  const gravity = { x: 0, y: 0 }
  const velocity = new Map<string, { vx: number; vy: number }>()

  const onMotion = (event: DeviceMotionEvent) => {
    const g = event.accelerationIncludingGravity
    if (g?.x == null || g.y == null) return
    const slide = screenSlide(g.x, g.y)
    gravity.x += (slide.x - gravity.x) * SMOOTHING
    gravity.y += (slide.y - gravity.y) * SMOOTHING
  }

  let raf = 0
  let last = performance.now()

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now

    if (!options.isEnabled()) {
      velocity.clear()
      return
    }

    const tilt = Math.hypot(gravity.x, gravity.y)
    const push = Math.max(0, tilt - DEAD_ZONE) * ACCEL_PX
    const ax = tilt > 0 ? (gravity.x / tilt) * push : 0
    const down = gravity.y > 0 ? VERTICAL_FACTOR : 1
    const ay = tilt > 0 ? (gravity.y / tilt) * push * down : 0
    if (push === 0 && velocity.size === 0) return

    const { w, h, playfield } = options.getSpace()
    const damp = Math.exp(-DAMPING * dt)
    const bodies: PhysicsBody[] = options.getBodies().map((b) => {
      const v = velocity.get(b.id) ?? { vx: 0, vy: 0 }
      return { ...b, ...v }
    })

    for (const b of bodies) {
      if (b.pinned) {
        b.vx = 0
        b.vy = 0
        continue
      }
      // velocities in px/s, positions in % of the space
      b.vx = (b.vx + ax * dt) * damp
      b.vy = (b.vy + ay * dt) * damp
      b.x += ((b.vx * dt) / w) * 100
      b.y += ((b.vy * dt) / h) * 100
    }
    resolveBodyCollisions(bodies, w, h)
    bounceWalls(bodies, playfield)

    const before = new Map(options.getBodies().map((b) => [b.id, b]))
    const positions: Record<string, { x: number; y: number }> = {}
    let moved = false
    velocity.clear()
    for (const b of bodies) {
      positions[b.id] = { x: b.x, y: b.y }
      const prev = before.get(b.id)
      if (prev && Math.abs(prev.x - b.x) + Math.abs(prev.y - b.y) > 0.001) {
        moved = true
      }
      if (Math.hypot(b.vx, b.vy) > REST_SPEED_PX) {
        velocity.set(b.id, { vx: b.vx, vy: b.vy })
      }
    }
    // pieces resting against a wall don't re-render every frame
    if (moved) options.onFrame(positions)
  }

  window.addEventListener('devicemotion', onMotion)
  raf = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('devicemotion', onMotion)
  }
}
