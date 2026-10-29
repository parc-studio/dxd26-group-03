import {
  bounceWalls,
  clampToPlayfield,
  resolveBodyCollisions,
  type PhysicsBody,
  type PlayfieldBounds,
} from './craftPhysics'
import {
  MERGE_EXPLODE_DAMPING,
  MERGE_EXPLODE_MAX_MS,
  MERGE_EXPLODE_SPEED_PX,
  MERGE_EXPLODE_STOP_SPEED_PX,
  MERGE_PARENT_SPLIT_PX,
} from './mergeTiming'

export interface ExplodeBody {
  id: string
  /** Unit direction of travel. */
  dir: { x: number; y: number }
}

function normalize(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y)
  if (len < 1e-6) return { x: 1, y: 0 }
  return { x: x / len, y: y / len }
}

/**
 * Build opposing fly-apart directions from the approach vector
 * (or a random axis if the approach is tiny), with a little perpendicular jitter.
 */
export function opposingExplodeDirs(
  approachX: number,
  approachY: number,
): [{ x: number; y: number }, { x: number; y: number }] {
  const base =
    Math.hypot(approachX, approachY) < 0.08
      ? (() => {
          const a = Math.random() * Math.PI * 2
          return { x: Math.cos(a), y: Math.sin(a) }
        })()
      : normalize(approachX, approachY)

  const perp = { x: -base.y, y: base.x }
  const jitter = (Math.random() - 0.5) * 0.4
  const a = normalize(base.x + perp.x * jitter, base.y + perp.y * jitter)
  return [a, { x: -a.x, y: -a.y }]
}

/**
 * Integrate exploding parents + the rest of the board with velocity, damping,
 * wall bounce, and element collisions. Positions are craft-space percents.
 */
export function runParentExplode(options: {
  mid: { x: number; y: number }
  /** Parents that receive the initial outward impulse. */
  bodies: ExplodeBody[]
  /** Other elements currently on the board (start at rest, can be pushed). */
  others?: { id: string; x: number; y: number; pinned?: boolean }[]
  spaceWidthPx: number
  spaceHeightPx: number
  playfield: PlayfieldBounds
  /** 1 = full burst; use ~0.35–0.45 under JewelleryReveal. */
  impulseScale?: number
  onFrame: (positions: Record<string, { x: number; y: number }>) => void
  onDone: () => void
}): () => void {
  const {
    mid,
    bodies,
    others = [],
    spaceWidthPx,
    spaceHeightPx,
    playfield,
    impulseScale = 1,
    onFrame,
    onDone,
  } = options

  const w = Math.max(1, spaceWidthPx)
  const h = Math.max(1, spaceHeightPx)
  const speedScale = (MERGE_PARENT_SPLIT_PX / 100) * impulseScale
  const speed0 = MERGE_EXPLODE_SPEED_PX * speedScale
  const maxMs = MERGE_EXPLODE_MAX_MS * Math.min(1, 0.55 + impulseScale * 0.45)
  const impulseIds = new Set(bodies.map((b) => b.id))

  const state: PhysicsBody[] = [
    ...bodies.map((body) => ({
      id: body.id,
      x: mid.x,
      y: mid.y,
      vx: ((body.dir.x * speed0) / w) * 100,
      vy: ((body.dir.y * speed0) / h) * 100,
    })),
    ...others
      .filter((o) => !impulseIds.has(o.id))
      .map((o) => ({
        id: o.id,
        x: o.x,
        y: o.y,
        vx: 0,
        vy: 0,
        pinned: Boolean(o.pinned),
      })),
  ]

  // Seat at mid / clamp before the first tick.
  for (const s of state) {
    if (impulseIds.has(s.id)) {
      const c = clampToPlayfield(mid.x, mid.y, playfield)
      s.x = c.x
      s.y = c.y
    } else {
      const c = clampToPlayfield(s.x, s.y, playfield)
      s.x = c.x
      s.y = c.y
    }
  }

  let raf = 0
  let last = performance.now()
  const started = last
  let finished = false

  const emit = () => {
    const positions: Record<string, { x: number; y: number }> = {}
    for (const s of state) {
      positions[s.id] = { x: s.x, y: s.y }
    }
    onFrame(positions)
  }

  const finish = () => {
    if (finished) return
    finished = true
    cancelAnimationFrame(raf)
    for (const s of state) {
      const c = clampToPlayfield(s.x, s.y, playfield)
      s.x = c.x
      s.y = c.y
      s.vx = 0
      s.vy = 0
    }
    // Final separation so nothing rests overlapping.
    for (let i = 0; i < 4; i++) {
      resolveBodyCollisions(state, w, h)
      bounceWalls(state, playfield)
    }
    emit()
    onDone()
  }

  const tick = (now: number) => {
    if (finished) return
    const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000))
    last = now

    const damp = Math.exp(-MERGE_EXPLODE_DAMPING * dt)
    let maxSpeedPx = 0

    for (const s of state) {
      if (s.pinned) {
        s.vx = 0
        s.vy = 0
        continue
      }
      s.vx *= damp
      s.vy *= damp
      s.x += s.vx * dt
      s.y += s.vy * dt
    }

    resolveBodyCollisions(state, w, h)
    bounceWalls(state, playfield)

    for (const s of state) {
      const speedPx = Math.hypot((s.vx / 100) * w, (s.vy / 100) * h)
      maxSpeedPx = Math.max(maxSpeedPx, speedPx)
    }

    emit()

    if (
      maxSpeedPx < MERGE_EXPLODE_STOP_SPEED_PX ||
      now - started > maxMs
    ) {
      finish()
      return
    }

    raf = requestAnimationFrame(tick)
  }

  emit()
  raf = requestAnimationFrame(tick)

  return () => {
    if (finished) return
    finished = true
    cancelAnimationFrame(raf)
  }
}
